import { NextRequest, NextResponse } from "next/server";
import { getPerModelScores } from "./ia";

export const runtime = "nodejs";

type Suggestion = {
  id: string;
  title: string;
  impactPts: number;
  effort: "low" | "med" | "high";
  detail?: string;
};
type Breakdown = { category: string; score: number; items: Record<string, any> };

const WEIGHTS = { crawl: 0.35, disc: 0.25, content: 0.20, render: 0.15, i18n: 0.05 } as const;

function normalizeUrl(q: string) {
  const raw = q.trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

async function fetchWithTimeout(resource: string, options: RequestInit = {}, ms = 12000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(resource, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchSafe(u: string, ua: string) {
  try {
    const r = await fetchWithTimeout(u, {
      headers: {
        "User-Agent":
          ua ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome Safari",
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
    });
    const text = r.ok ? await r.text() : "";
    return { ok: r.ok, status: r.status, headers: r.headers, text, url: r.url || u };
  } catch (e: any) {
    return { ok: false, status: 0, headers: new Headers(), text: "", url: u, error: String(e) };
  }
}

const getHeader = (h: Headers, k: string) =>
  h.get(k) || Array.from(h.entries()).find(([kk]) => kk.toLowerCase() === k.toLowerCase())?.[1] || "";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("url");
  if (!q) return NextResponse.json({ error: "Falta ?url=" }, { status: 400 });

  const strict = ["1", "true", "yes"].includes(
    (req.nextUrl.searchParams.get("strict") || "").toLowerCase()
  );

  const url = normalizeUrl(q);
  const ua = "oai-searchbot";

  // Fetch principal + robots.txt con timeout
  const [page, robotsRes] = await Promise.all([
    fetchSafe(url, ua),
    fetchSafe(new URL("/robots.txt", url).toString(), ua),
  ]);

  // Corte temprano
  if (page.status === 404 || page.status === 410) {
    return NextResponse.json({ error: "Esta página no existe." }, { status: page.status });
  }
  if (!page.ok) {
    const msg = page.status
      ? `No se pudo acceder a la página (HTTP ${page.status}).`
      : "No se pudo acceder a la página.";
    return NextResponse.json({ error: msg }, { status: page.status || 502 });
  }

  // --------- Extracción de señales ----------
  const html = page.text || "";
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").trim();
  const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "").replace(/<[^>]+>/g, "").trim();
  const metaRobots =
    (html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)/i)?.[1] || "").toLowerCase();
  const xRobots = (getHeader(page.headers, "x-robots-tag") || "").toLowerCase();
  const canonicalHref =
    (html.match(/<link[^>]+rel=["']?canonical["']?[^>]*href=["']?([^"'>\s]+)/i)?.[1] || "").trim();
  const contentType = (getHeader(page.headers, "content-type") || "").toLowerCase();
  const lang = (html.match(/<html[^>]+lang=["']?([^"'>\s]+)/i)?.[1] || "").toLowerCase();

  const jsonLd = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map(
    (m) => m[1]
  );
  const hasSchema = jsonLd.length > 0;
  const hasFAQ = jsonLd.some((s) => /"@type"\s*:\s*"(faqpage|howto)"/i.test(s));

  const textOnly = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<\/?[^>]+>/g, " ");
  const textRatio = html.length ? textOnly.replace(/\s+/g, " ").trim().length / html.length : 0;

  const https = url.startsWith("https://");
  const paywallHint = /paywall|suscr[ií]base|subscribe|metered/i.test(html.toLowerCase());

  // soft 404
  const lower = html.toLowerCase();
  const looks404 =
    /(^|\b)(404|not found|p[aá]gina no encontrada|pagina no encontrada|no se encontr[oó]|page not found)(\b|$)/i.test(
      lower
    ) || /<title[^>]*>[^<]*(404|not found)/i.test(html);

  // Meta description (Extras)
  const metaDescMatch = html.match(
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i
  );
  const metaDescription = metaDescMatch ? metaDescMatch[1].trim() : "";
  const metaDescLen = metaDescription.length;
  const metaDescOk = metaDescLen >= 50 && metaDescLen <= 160;

  // robots.txt (simple)
  const robotsTxt = (robotsRes.text || "").toLowerCase();
  const lines = robotsTxt.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const groups: Record<string, string[]> = {};
  let currentUA = "";
  for (const l of lines) {
    const m = l.match(/^(user-agent|disallow)\s*:\s*(.+)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim().toLowerCase();
    if (k === "user-agent") {
      currentUA = v;
      groups[currentUA] = groups[currentUA] || [];
    }
    if (k === "disallow") {
      groups[currentUA] = groups[currentUA] || [];
      groups[currentUA].push(v);
    }
  }
  const hasSitemap = lines.some((l) => l.startsWith("sitemap:"));

  const isAllowedFor = (uaName: string) => {
    const rules = groups[uaName] ?? groups["*"] ?? [];
    const hardBlock = rules.some((p) => p === "/" || p === "/*");
    return !hardBlock;
  };
  const robotsAllowed = isAllowedFor("oai-searchbot");
  const robotsAllowedOAI = robotsAllowed;
  const robotsAllowedGPT = isAllowedFor("gptbot");
  const robotsAllowedStar = isAllowedFor("*");

  // --------- Motivos de bloqueo + bandera accesible ---------
  const blockedReasons: string[] = [];
  if (/noindex|none/.test(metaRobots)) blockedReasons.push('Meta robots: "noindex/none"');
  if (xRobots.includes("noindex") || xRobots.includes("none"))
    blockedReasons.push('X-Robots-Tag: "noindex/none"');
  if (!robotsAllowed) {
    const uaGroup = groups["oai-searchbot"] ?? groups["*"] ?? [];
    const rules = uaGroup.length ? uaGroup.join(", ") : "(Disallow: /)";
    blockedReasons.push(`robots.txt bloquea a "oai-searchbot" → ${rules}`);
  }
  if (!/text\/html/.test(contentType)) blockedReasons.push(`Content-Type no HTML (${contentType || "desconocido"})`);

  const accessibleForOAI = blockedReasons.length === 0;

  // --------- Scoring ----------
  const suggestions: Suggestion[] = [];
  const breakdown: Breakdown[] = [];

  const TRATIO_MIN = strict ? 0.22 : 0.18;

  // Crawlabilidad
  let crawl = 100;
  const crawlItems = {
    http2xx: page.ok,
    https,
    contentTypeHtml: /text\/html/.test(contentType),
    robotsAllowed,
    xRobotsOk: !(xRobots.includes("noindex") || xRobots.includes("none") || xRobots.includes("noai")),
  };
  if (!crawlItems.http2xx) {
    crawl -= 40;
    suggestions.push({ id: "http", title: "La URL no responde 2xx", impactPts: 40, effort: "med" });
  }
  if (!crawlItems.https) {
    crawl -= 20;
    suggestions.push({ id: "https", title: "Forzar HTTPS", impactPts: 20, effort: "low" });
  }
  if (!crawlItems.contentTypeHtml) {
    crawl -= 8;
    suggestions.push({
      id: "ctype",
      title: "Enviar Content-Type text/html",
      impactPts: 8,
      effort: "low",
      detail: "Ej.: Content-Type: text/html; charset=utf-8",
    });
  }
  if (!crawlItems.robotsAllowed) {
    crawl -= 35;
    suggestions.push({
      id: "robots",
      title: "robots.txt bloquea al bot",
      impactPts: 35,
      effort: "low",
      detail: 'Eliminá "Disallow: /" o reglas globales para "oai-searchbot" o "*".',
    });
  }
  if (!crawlItems.xRobotsOk) {
    crawl -= 25;
    suggestions.push({
      id: "xrobots",
      title: "Quitar X-Robots-Tag noindex/none/noai",
      impactPts: 25,
      effort: "low",
      detail: 'Cabecera: X-Robots-Tag: none → quitá "noindex/none/noai".',
    });
  }
  breakdown.push({ category: "Crawlabilidad", score: Math.max(0, crawl), items: crawlItems });

  // Descubribilidad
  let disc = 100;
  const discItems = {
    titleOk: title.length >= 10 && title.length <= 70,
    canonicalOk: !!canonicalHref,
    metaNoindex: /noindex|none/.test(metaRobots),
    sitemapInRobots: hasSitemap,
  };
  if (!discItems.titleOk) {
    disc -= 12;
    suggestions.push({
      id: "title",
      title: "Optimizar <title> (10–70)",
      impactPts: 12,
      effort: "low",
      detail: "Incluí keywords foco, marca y evita títulos largos/duplicados.",
    });
  }
  if (!discItems.canonicalOk) {
    disc -= 8;
    suggestions.push({
      id: "canonical",
      title: 'Agregar <link rel="canonical">',
      impactPts: 8,
      effort: "low",
      detail: 'Ej.: <link rel="canonical" href="https://tu-dominio.com/ruta/" />',
    });
  }
  if (discItems.metaNoindex) {
    disc -= 25;
    suggestions.push({
      id: "noindex",
      title: "Quitar meta robots noindex/none",
      impactPts: 25,
      effort: "low",
      detail: 'Ej.: <meta name="robots" content="index, follow">',
    });
  }
  if (!discItems.sitemapInRobots) {
    disc -= 8;
    suggestions.push({
      id: "sitemap",
      title: "Declarar Sitemap en robots.txt",
      impactPts: 8,
      effort: "low",
      detail: "Ej.: Sitemap: https://tu-dominio.com/sitemap.xml",
    });
  }
  breakdown.push({ category: "Descubribilidad", score: Math.max(0, disc), items: discItems });

  // Contenido & Semántica
  let cont = 100;
  const contItems = {
    h1Ok: !!h1,
    textRatioOk: textRatio >= TRATIO_MIN,
    schemaOk: hasSchema,
    faqOk: hasFAQ,
  };
  if (!contItems.h1Ok) {
    cont -= 10;
    suggestions.push({
      id: "h1",
      title: "Añadir un H1 descriptivo",
      impactPts: 10,
      effort: "low",
      detail: "1 solo H1 por página, claro y con keyword principal.",
    });
  }
  if (!contItems.textRatioOk) {
    cont -= 22;
    suggestions.push({
      id: "ssr",
      title: "Servir contenido en HTML inicial (SSR/prerender)",
      impactPts: 22,
      effort: "med",
      detail: "Evitá páginas vacías que dependen 100% de JS para el contenido crítico.",
    });
  }
  if (!contItems.schemaOk) {
    cont -= 10;
    suggestions.push({
      id: "schema",
      title: "Agregar schema.org (JSON-LD)",
      impactPts: 10,
      effort: "med",
      detail: "Usá tipos Article/Product/Organization, etc. según el caso.",
    });
  }
  if (!contItems.faqOk) {
    cont -= 4;
    suggestions.push({
      id: "faq",
      title: "Agregar FAQPage/HowTo",
      impactPts: 4,
      effort: "low",
      detail: "Estructurá preguntas comunes en JSON-LD (si aplica).",
    });
  }
  breakdown.push({
    category: "Contenido & Semántica",
    score: Math.max(0, cont),
    items: contItems,
  });

  // Render / Robustez
  let rend = 100;
  const serverHeader = (page.headers.get("server") || "") + " " + (page.headers.get("cf-ray") || "");
  const antiBotLikely = /cloudflare|captcha/i.test(serverHeader);
  const rendItems = { antiBotLikely, paywallHint, soft404: looks404 };
  if (antiBotLikely) {
    rend -= 15;
    suggestions.push({
      id: "antibot",
      title: "Evitar bloqueos anti-bot a crawlers legítimos",
      impactPts: 15,
      effort: "med",
      detail: "Permití a bots conocidos con UA whitelisting/rules específicas.",
    });
  }
  if (paywallHint) {
    rend -= 12;
    suggestions.push({
      id: "paywall",
      title: "Evitar paywall duro en contenido clave",
      impactPts: 12,
      effort: "high",
      detail: "Usá vistas parciales o excerpt accesible para indexación.",
    });
  }
  if (looks404) {
    rend -= 25;
    suggestions.push({
      id: "soft404",
      title: "La página parece un soft 404",
      impactPts: 25,
      effort: "med",
      detail: "Devolvé 404 real en server o serví contenido útil no-404.",
    });
  }
  breakdown.push({ category: "Render/Robustez", score: Math.max(0, rend), items: rendItems });

  // i18n
  let i18n = 100;
  const i18nItems = { langAttr: !!lang };
  if (!i18nItems.langAttr) {
    i18n -= 5;
    suggestions.push({
      id: "lang",
      title: "Definir atributo lang en <html>",
      impactPts: 5,
      effort: "low",
      detail: 'Ej.: <html lang="es">',
    });
  }
  breakdown.push({ category: "Internacionalización", score: Math.max(0, i18n), items: i18nItems });

  const overall = Math.round(
    breakdown[0].score * WEIGHTS.crawl +
      breakdown[1].score * WEIGHTS.disc +
      breakdown[2].score * WEIGHTS.content +
      breakdown[3].score * WEIGHTS.render +
      breakdown[4].score * WEIGHTS.i18n
  );
  suggestions.sort((a, b) => b.impactPts - a.impactPts);

  // --------- EXTRAS ----------
  const hsts = !!getHeader(page.headers, "strict-transport-security");
  const csp = !!getHeader(page.headers, "content-security-policy");
  const xfo = !!getHeader(page.headers, "x-frame-options");
  const cspHasFrameAncestors = (getHeader(page.headers, "content-security-policy") || "")
    .toLowerCase()
    .includes("frame-ancestors");
  const clickjackProtected = xfo || cspHasFrameAncestors;

  const metaNoAI = /\bnoai\b/.test(metaRobots);
  const xRobotsNoAI = /\bnoai\b/.test(xRobots);

  const extras = {
    metaDescription: {
      present: !!metaDescription,
      length: metaDescLen,
      ok: metaDescOk,
      sample: metaDescription.slice(0, 200),
    },
    aiDirectives: { metaNoAI, xRobotsNoAI },
    robotsPerBot: { oai: robotsAllowedOAI, gpt: robotsAllowedGPT, wildcard: robotsAllowedStar },
    securityHeaders: { hsts, csp, clickjackProtected },
  };

  const extrasSuggestions: { title: string; detail?: string }[] = [];
  if (!metaDescription) extrasSuggestions.push({ title: "Agregar meta description (50–160 caracteres)" });
  else if (!metaDescOk)
    extrasSuggestions.push({
      title: "Ajustar meta description a 50–160 caracteres",
      detail: `Actual: ${metaDescLen}`,
    });
  if (!hsts) extrasSuggestions.push({ title: "Habilitar HSTS (Strict-Transport-Security)" });
  if (!csp) extrasSuggestions.push({ title: "Definir Content-Security-Policy (básica, con frame-ancestors si aplica)" });
  if (!clickjackProtected)
    extrasSuggestions.push({ title: "Proteger contra clickjacking (X-Frame-Options o frame-ancestors en CSP)" });
  if (!robotsAllowedGPT) extrasSuggestions.push({ title: "robots.txt bloquea a gptbot (revisar reglas)" });

  // ====== IA Readiness / Per-model scores (usando TUS nombres) ======
  const auditedUrl = page.url || url;

  // Flatten de items
  const flatItems: Record<string, any> = {};
  for (const b of breakdown) Object.assign(flatItems, b.items || {});

  const httpsFlag     = /^https:\/\//i.test(auditedUrl);
  const status2xx     = !!flatItems["http2xx"];
  const textRatioOk   = !!flatItems["textRatioOk"];
  const hasCanonical  = !!flatItems["canonicalOk"];
  const schemaOk      = !!flatItems["schemaOk"];
  const h1Ok          = !!flatItems["h1Ok"];

  let perModelScores: Record<string, number> | undefined;
  let iaReadiness: number | undefined;

  try {
    const scored = await getPerModelScores({
      url: auditedUrl,
      https: httpsFlag,
      status2xx,
      textRatioOk,
      hasCanonical,
      schema: schemaOk,
      h1: h1Ok,
    });

    perModelScores = scored.perModelScores;
    iaReadiness = scored.iaReadiness;

    // anexamos hints del scorer a extrasSuggestions
    for (const h of scored.hints) extrasSuggestions.push({ title: h });
  } catch (e) {
    console.error("[IA readiness] error:", e);
  }

  return NextResponse.json({
    url,
    finalUrl: page.url,
    uaTried: ua,
    strict,
    accessibleForOAI,
    blockedReasons,
    overall,
    breakdown,
    suggestions,
    extras,
    extrasSuggestions,
    perModelScores,   // 👈 nuevo
    iaReadiness,      // 👈 nuevo
    raw: {
      status: page.status,
      contentType,
      robotsAllowed,
      sitemaps: lines.filter((l) => l.startsWith("sitemap:")),
    },
  });
}

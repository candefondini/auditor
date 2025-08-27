// app/api/audit/ia.ts
// Helper para calcular puntajes por IA SIN tocar tu /api/audit aún.

export type AiModelKey = "chatgpt" | "gemini" | "copilot" | "perplexity" | "claude";

export const AI_PROFILES: Record<AiModelKey, {
  label: string;
  ua: string;  // UA usado para pedir la página como si fuera ese bot
  weights: {
    robotsAllow: number;
    antiAIDirectives: number; // meta/x-robots "noai", etc.
    textWithoutJS: number;    // contenido visible sin JS
    metaTitle: number;
    metaDescription: number;
    https: number;
    status2xx: number;
    canonical: number;
    schema: number;
    h1: number;
  };
}> = {
  chatgpt: {
    label: "ChatGPT",
    ua: "Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://oai.com)",
    weights: { robotsAllow: 30, antiAIDirectives: 35, textWithoutJS: 10, metaTitle: 5, metaDescription: 6, https: 3, status2xx: 4, canonical: 3, schema: 2, h1: 2 }
  },
  gemini: {
    label: "Gemini",
    ua: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    weights: { robotsAllow: 28, antiAIDirectives: 28, textWithoutJS: 12, metaTitle: 6, metaDescription: 7, https: 4, status2xx: 5, canonical: 4, schema: 4, h1: 2 }
  },
  copilot: {
    label: "Copilot",
    ua: "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    weights: { robotsAllow: 28, antiAIDirectives: 28, textWithoutJS: 12, metaTitle: 5, metaDescription: 6, https: 4, status2xx: 5, canonical: 4, schema: 4, h1: 4 }
  },
  perplexity: {
    label: "Perplexity",
    ua: "Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/bot)",
    weights: { robotsAllow: 26, antiAIDirectives: 30, textWithoutJS: 15, metaTitle: 5, metaDescription: 6, https: 4, status2xx: 5, canonical: 3, schema: 3, h1: 3 }
  },
  claude: {
    label: "Claude",
    ua: "Mozilla/5.0 (compatible; ClaudeBot/1.0)",
    weights: { robotsAllow: 26, antiAIDirectives: 30, textWithoutJS: 12, metaTitle: 6, metaDescription: 6, https: 4, status2xx: 5, canonical: 3, schema: 4, h1: 4 }
  }
};

// -------------------- helpers de red/parseo --------------------

type FetchRes = { ok: boolean; status: number; text: string; headers: Headers };
const fetchText = async (url: string, ua?: string, timeoutMs = 12000): Promise<FetchRes> => {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, {
      headers: ua ? { "User-Agent": ua } : {},
      redirect: "follow",
      signal: ctrl.signal,
    });
    const text = await r.text().catch(() => "");
    return { ok: r.ok, status: r.status, text, headers: r.headers };
  } catch {
    return { ok: false, status: 0, text: "", headers: new Headers() };
  } finally {
    clearTimeout(to);
  }
};

const uaTokenForRobots = (ua: string): string => {
  const l = ua.toLowerCase();
  if (l.includes("bingbot")) return "bingbot";
  if (l.includes("googlebot")) return "googlebot";
  if (l.includes("perplexity")) return "perplexitybot";
  if (l.includes("claude")) return "claudebot";
  if (l.includes("gptbot") || l.includes("oai") || l.includes("openai")) return "gptbot";
  return "*";
};

type RobotsEval = { allowedForUA: boolean; hasAIBlock: boolean };

const parseRobotsAllow = (robotsTxt: string, uaToken: string): RobotsEval => {
  // parser simple: busca bloque específico y si no, el bloque '*'
  const lines = robotsTxt.split(/\r?\n/);
  const blocks: Record<string, string[]> = {};
  let current: string | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const [k, v] = line.split(":").map(s => s?.trim());
    if (!k || !v) continue;
    if (/^user-agent$/i.test(k)) {
      current = v.toLowerCase();
      blocks[current] ||= [];
    } else if (current && (/^allow$/i.test(k) || /^disallow$/i.test(k))) {
      blocks[current].push(`${k}:${v}`);
    }
  }

  const pick = blocks[uaToken.toLowerCase()] || blocks["*"] || [];
  const hasDisallowAll = pick.some(x => x.toLowerCase() === "disallow:/");
  const hasAIBlock = /gptbot|oai|openai|perplexity|claude/i.test(robotsTxt) && /disallow\s*:/i.test(robotsTxt);

  return { allowedForUA: !hasDisallowAll, hasAIBlock };
};

type MetaEval = {
  metaNoindex: boolean;
  metaNoAI: boolean;
  xRobotsNoAI: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  metaDescriptionLen: number;
  h1Present: boolean;
  hasCanonical: boolean;
  schemaPresent: boolean;
};

const evalHtmlSignals = (html: string, headers: Headers): MetaEval => {
  const find = (re: RegExp) => (html.match(re)?.[1] || "").trim();
  const has = (re: RegExp) => re.test(html);

  const robotsMeta = ((): string => {
    const m1 = html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i)?.[1] || "";
    const m2 = html.match(/<meta[^>]+name=["']googlebot["'][^>]*content=["']([^"']+)["']/i)?.[1] || "";
    return `${m1} ${m2}`.toLowerCase();
  })();

  const xRobots = (headers.get("x-robots-tag") || "").toLowerCase();
  const title = find(/<title[^>]*>([^<]*)<\/title>/i);
  const desc  = find(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i);

  return {
    metaNoindex: /noindex/.test(robotsMeta) || /noindex/.test(xRobots),
    metaNoAI: /noai/.test(robotsMeta) || /noai/.test(xRobots),
    xRobotsNoAI: /noai/.test(xRobots),
    hasTitle: !!title,
    hasMetaDescription: !!desc,
    metaDescriptionLen: desc.length,
    h1Present: has(/<h1[\s>][\s\S]*?<\/h1>/i),
    hasCanonical: has(/<link[^>]+rel=["']canonical["'][^>]+>/i),
    schemaPresent: has(/application\/ld\+json/i) || has(/itemscope/i),
  };
};

// -------------------- scoring --------------------

type BotSignals = {
  robotsAllow: boolean;
  antiAI: boolean;
  textWithoutJS: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  metaDescriptionOk: boolean;
  https: boolean;
  status2xx: boolean;
  hasCanonical: boolean;
  schema: boolean;
  h1: boolean;
};

const clamp = (n:number, a=0, b=100)=>Math.max(a, Math.min(b, n));

export const scoreForModel = (model: AiModelKey, s: BotSignals): number => {
  const W = AI_PROFILES[model].weights;
  let pts = 0;

  pts += s.robotsAllow ? W.robotsAllow : 0;
  pts += !s.antiAI ? W.antiAIDirectives : 0;
  pts += s.textWithoutJS ? W.textWithoutJS : 0;
  pts += s.hasTitle ? W.metaTitle : 0;
  pts += s.hasMetaDescription ? W.metaDescription : 0;
  pts += s.https ? W.https : 0;
  pts += s.status2xx ? W.status2xx : 0;
  pts += s.hasCanonical ? W.canonical : 0;
  pts += s.schema ? W.schema : 0;
  pts += s.h1 ? W.h1 : 0;

  if (s.hasMetaDescription && !s.metaDescriptionOk) pts -= Math.round(W.metaDescription * 0.5);

  return clamp(Math.round(pts));
};

// -------------------- API simple para integrar luego --------------------

export async function getPerModelScores(input: {
  url: string;
  // señales globales que quizás ya tengas calculadas en tu auditor:
  textRatioOk?: boolean;
  https?: boolean;
  status2xx?: boolean;
  hasCanonical?: boolean;
  schema?: boolean;
  h1?: boolean;
}): Promise<{
  perModelScores: Record<AiModelKey, number>;
  iaReadiness: number;
  hints: string[]; // sugerencias simples (alt/meta)
}> {
  const urlNorm = input.url;
  const https = typeof input.https === "boolean" ? input.https : /^https:\/\//i.test(urlNorm);
  const status2xx = input.status2xx ?? true;

  // robots.txt (una sola vez)
  const robotsUrl = new URL("/robots.txt", urlNorm).toString();
  const robotsRes = await fetchText(robotsUrl);
  const robotsTxt = robotsRes.ok ? robotsRes.text : "";

  const perModelScores: Record<AiModelKey, number> = {} as any;
  const hints: string[] = [];

  // Para hints de imágenes/description tomamos la primera respuesta que tengamos HTML
  let sampleHtml = "";

  for (const key of Object.keys(AI_PROFILES) as AiModelKey[]) {
    const { ua } = AI_PROFILES[key];
    const token = uaTokenForRobots(ua);

    const robotsEval = robotsTxt
      ? parseRobotsAllow(robotsTxt, token)
      : { allowedForUA: true, hasAIBlock: false };

    const htmlRes = await fetchText(urlNorm, ua);
    const html = htmlRes.ok ? htmlRes.text : "";
    const meta = html ? evalHtmlSignals(html, htmlRes.headers) : {
      metaNoindex:false, metaNoAI:false, xRobotsNoAI:false,
      hasTitle:false, hasMetaDescription:false, metaDescriptionLen:0,
      h1Present:false, hasCanonical:false, schemaPresent:false
    };

    if (!sampleHtml && html) sampleHtml = html;

    const signals: BotSignals = {
      robotsAllow: robotsEval.allowedForUA && !meta.metaNoindex,
      antiAI: meta.metaNoAI || meta.xRobotsNoAI || robotsEval.hasAIBlock,
      textWithoutJS: !!input.textRatioOk,
      hasTitle: meta.hasTitle,
      hasMetaDescription: meta.hasMetaDescription,
      metaDescriptionOk: meta.metaDescriptionLen >= 50 && meta.metaDescriptionLen <= 160,
      https,
      status2xx,
      hasCanonical: meta.hasCanonical || !!input.hasCanonical,
      schema: meta.schemaPresent || !!input.schema,
      h1: meta.h1Present || !!input.h1,
    };

    perModelScores[key] = scoreForModel(key, signals);
  }

  // Hints rápidos (como en tu captura)
  if (sampleHtml) {
    const imgTags = (sampleHtml.match(/<img\b[^>]*>/gi) || []);
    const imgsWithoutAlt = imgTags.filter(t => !/alt\s*=/.test(t)).length;
    if (imgsWithoutAlt > 0) hints.push(`Add alt attributes to images (+8) — ${imgsWithoutAlt} sin alt.`);

    const hasDesc = /<meta[^>]+name=["']description["'][^>]*content=["'][^"']+["']/i.test(sampleHtml);
    const descLen = (sampleHtml.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || "").length;
    if (!hasDesc || descLen < 50 || descLen > 160) {
      hints.push("Improve meta description (+5) — usar ~50–160 caracteres.");
    }
  }

  const values = Object.values(perModelScores);
  const iaReadiness = values.length ? Math.round(values.reduce((a,b)=>a+b,0) / values.length) : 0;

  return { perModelScores, iaReadiness, hints };
}

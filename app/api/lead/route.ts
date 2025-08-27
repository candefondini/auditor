// app/api/lead/route.ts
import { NextResponse } from "next/server";
import { resolveMx, resolve4, resolve6 } from "node:dns/promises";

const DISPOSABLE = new Set([
  "mailinator.com", "tempmail.com", "10minutemail.com", "guerrillamail.com", "yopmail.com"
]);

function validEmailSyntax(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function suggestDomain(domain: string): string | null {
  const typos: Record<string, string> = {
    "gmil.com": "gmail.com",
    "gamil.com": "gmail.com",
    "gmial.com": "gmail.com",
    "gmeil.com": "gmail.com",
    "gmail.co": "gmail.com",
    "gmail.con": "gmail.com",
    "hotmail.co": "hotmail.com",
    "hotmial.com": "hotmail.com",
    "outlook.co": "outlook.com",
    "yahho.com": "yahoo.com",
    "yaho.com": "yahoo.com",
  };
  return typos[domain] || null;
}

async function domainHasMail(domain: string) {
  try {
    const mx = await resolveMx(domain);
    if (mx && mx.length > 0) return true;
  } catch {}
  try { const a = await resolve4(domain); if (a?.length) return true; } catch {}
  try { const aaaa = await resolve6(domain); if (aaaa?.length) return true; } catch {}
  return false;
}

// Helper para leer body en JSON o form-data sin romper
async function readSafeBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { return await req.json(); } catch { return {}; }
  }
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      return Object.fromEntries(Array.from(form.entries()));
    } catch { return {}; }
  }
  // Intento final: probar JSON igual
  try { return await req.json(); } catch { return {}; }
}

export async function POST(req: Request) {
  try {
    const raw = await readSafeBody(req);

    // Sanea tipos (evita toString sobre undefined / objetos raros)
    const toStr = (v: unknown) => (typeof v === "string" ? v : "");
    const nombre = toStr(raw?.nombre).trim();
    const email  = toStr(raw?.email).trim().toLowerCase();
    const site   = toStr(raw?.site).trim();
    const comentario = toStr(raw?.comentario).trim();

    // Requeridos
    if (!email || !site) {
      return new NextResponse("email y site son requeridos", { status: 400 });
    }

    // Email válido
    if (!validEmailSyntax(email)) {
      return new NextResponse("Email inválido. Revisalo (ej: nombre@dominio.com).", { status: 400 });
    }

    const domain = email.split("@")[1] || "";
    if (!domain) {
      return new NextResponse("Email inválido (sin dominio).", { status: 400 });
    }

    // Typos comunes
    const suggestion = suggestDomain(domain);
    if (suggestion) {
      return new NextResponse(`El dominio "${domain}" parece un error tipográfico. ¿Quisiste decir "${suggestion}"?`, { status: 400 });
    }

    // Bloqueo de temporales
    if (DISPOSABLE.has(domain)) {
      return new NextResponse("No aceptamos emails temporales. Usá un email real.", { status: 400 });
    }

    // DNS (MX/A)
    const ok = await domainHasMail(domain);
    if (!ok) {
      return new NextResponse(`El dominio "${domain}" no existe o no recibe correo. Revisá tu email.`, { status: 400 });
    }

    // Enviar a n8n
    const url = process.env.N8N_WEBHOOK_URL;
    if (!url) {
      console.error("[LEAD] Falta N8N_WEBHOOK_URL en variables de entorno");
      return new NextResponse("Configuración del servidor incompleta", { status: 500 });
    }

    const payload = {
      nombre,
      email,
      site,
      comentario,
      createdAt: new Date().toISOString(),
      ip: req.headers.get("x-forwarded-for") || "",
      userAgent: req.headers.get("user-agent") || "",
    };

    // Timeout defensivo
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch((e) => {
      throw new Error(`No se pudo conectar con n8n: ${e?.message || e}`);
    });
    clearTimeout(t);

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`n8n devolvió ${res.status}: ${text}`);
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[ERROR lead]", e);
    const msg = typeof e?.message === "string" ? e.message : "Error";
    return new NextResponse(msg, { status: 500 });
  }
}

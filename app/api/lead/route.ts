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
    gmil: "gmail.com", gamil: "gmail.com", gmial: "gmail.com", gmeil: "gmail.com",
    "gmail.co": "gmail.com", "gmail.con": "gmail.com",
    "hotmail.co": "hotmail.com", "hotmial.com": "hotmail.com",
    "outlook.co": "outlook.com",
    yahho: "yahoo.com", yaho: "yahoo.com",
  };
  return typos[domain] || null;
}

async function domainHasMail(domain: string) {
  try { const mx = await resolveMx(domain); if (mx?.length) return true; } catch {}
  try { const a = await resolve4(domain); if (a?.length) return true; } catch {}
  try { const aaaa = await resolve6(domain); if (aaaa?.length) return true; } catch {}
  return false;
}

// Lee cuerpo en JSON o form-data sin romper
async function readSafeBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    try { return await req.json(); } catch {}
  }
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    try {
      const form = await req.formData();
      return Object.fromEntries(Array.from(form.entries()));
    } catch {}
  }
  try { return await req.json(); } catch {}
  return {};
}

// Normaliza a E.164 AR (+54) si no trae '+'
function toE164AR(raw: string) {
  if (!raw) return "";
  let p = String(raw).replace(/[^\d+]/g, "");
  if (!p.startsWith("+")) {
    if (p.startsWith("0")) p = p.slice(1);
    p = "+54" + p;
  }
  return p;
}

export async function POST(req: Request) {
  try {
    const raw = await readSafeBody(req);
    const toStr = (v: unknown) => (typeof v === "string" ? v : "");

    const nombre = toStr(raw?.nombre).trim();
    const email  = toStr(raw?.email).trim().toLowerCase();
    const site   = toStr(raw?.site).trim();
    const comentario = toStr(raw?.comentario).trim();
    const phoneRaw   = toStr(raw?.phone).trim();
    const phoneE164  = toE164AR(phoneRaw);

    // Requeridos mínimos
    if (!email || !site) {
      return new NextResponse("email y site son requeridos", { status: 400 });
    }
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

    // DNS (MX/A/AAAA)
    const ok = await domainHasMail(domain);
    if (!ok) {
      return new NextResponse(`El dominio "${domain}" no existe o no recibe correo. Revisá tu email.`, { status: 400 });
    }

    // Webhooks n8n
    const urlLead = process.env.N8N_WEBHOOK_URL;                 // flujo principal (mail/registro)
    const urlWhatsapp = process.env.N8N_WHATSAPP_WEBHOOK_URL;    // flujo WhatsApp (OPCIONAL)

    if (!urlLead) {
      return new NextResponse("Falta N8N_WEBHOOK_URL", { status: 500 });
    }

    // Payload para tu flujo principal
    const payloadLead = {
      nombre, email, site, comentario,
      phone: phoneE164,
      createdAt: new Date().toISOString(),
      ip: req.headers.get("x-forwarded-for") || "",
      userAgent: req.headers.get("user-agent") || "",
    };

    // Timeout defensivo para ambos fetch
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 8000);

    // 1) Enviar SIEMPRE al flujo principal (mail/registro)
    const resLead = await fetch(urlLead, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payloadLead),
      signal: controller.signal,
    });

    // 2) (OPCIONAL) Enviar al flujo WhatsApp SOLO si la env está seteada
    let resWspStatus: number | null = null;
    if (urlWhatsapp) {
      const resWsp = await fetch(urlWhatsapp, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // mapping que espera el flujo de WhatsApp: { name, email, phone, url, message }
        body: JSON.stringify({
          name: nombre,
          email,
          phone: phoneE164, // +549...
          url: site,
          message: comentario,
        }),
        signal: controller.signal,
      });
      resWspStatus = resWsp.status;
      if (!resWsp.ok) {
        const txt = await resWsp.text().catch(() => "");
        console.error("n8n WHATSAPP no OK:", resWsp.status, txt);
        // No cortamos la respuesta al usuario por esto.
      }
    }

    clearTimeout(t);

    if (!resLead.ok) {
      const txt = await resLead.text().catch(() => "");
      console.error("n8n LEAD no OK:", resLead.status, txt);
      // Igual respondemos 200 para no romper UX del form, pero podés cambiarlo si querés.
    }

    // Respuesta al cliente
    return NextResponse.json({
      ok: true,
      whatsappForwarded: Boolean(urlWhatsapp),
      whatsappStatus: resWspStatus,
    });
  } catch (e: any) {
    console.error("[ERROR lead]", e);
    const msg = typeof e?.message === "string" ? e.message : "Error";
    return new NextResponse(msg, { status: 500 });
  }
}

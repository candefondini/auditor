import { NextResponse } from "next/server";
import { resolveMx, resolve4, resolve6 } from "node:dns/promises";

const DISPOSABLE = new Set([
  "mailinator.com","tempmail.com","10minutemail.com","guerrillamail.com","yopmail.com"
]);

function validEmailSyntax(email: string) {
  // formato básico (ya reforzado en el front)
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
  // (fallback) algunos dominios aceptan mail por A/AAAA, raro pero posible
  try { const a = await resolve4(domain); if (a?.length) return true; } catch {}
  try { const aaaa = await resolve6(domain); if (aaaa?.length) return true; } catch {}
  return false;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = String(body?.email || "").trim().toLowerCase();
    const site  = String(body?.site  || "").trim();

    // 1) Requeridos
    if (!email || !site) {
      return new NextResponse("email y site son requeridos", { status: 400 });
    }

    // 2) Sintaxis
    if (!validEmailSyntax(email)) {
      return new NextResponse("Email inválido. Revisalo (ej: nombre@dominio.com).", { status: 400 });
    }

    // 3) Dominio
    const domain = email.split("@")[1];

    // 3.a) Tipos/typos comunes → sugerir corrección
    const suggestion = suggestDomain(domain);
    if (suggestion) {
      return new NextResponse(`El dominio "${domain}" parece un error tipográfico. ¿Quisiste decir "${suggestion}"?`, { status: 400 });
    }

    // 3.b) Bloquear desechables (opcional)
    if (DISPOSABLE.has(domain)) {
      return new NextResponse("No aceptamos emails temporales. Usá un email real.", { status: 400 });
    }

    // 3.c) DNS (MX/A) — existencia real
    const ok = await domainHasMail(domain);
    if (!ok) {
      return new NextResponse(`El dominio "${domain}" no existe o no recibe correo (sin MX). Revisá tu email.`, { status: 400 });
    }

    // ---- OK: continuar flujo normal ----
    // console.log("[LEAD]", body);

    // (Opcional) reenviar a n8n
    // if (process.env.N8N_WEBHOOK_URL) {
    //   await fetch(process.env.N8N_WEBHOOK_URL, {
    //     method: "POST",
    //     headers: { "Content-Type": "application/json" },
    //     body: JSON.stringify({
    //       ...body,
    //       createdAt: new Date().toISOString(),
    //       ip: req.headers.get("x-forwarded-for") || "",
    //       userAgent: req.headers.get("user-agent") || "",
    //     }),
    //   });
    // }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return new NextResponse(e?.message || "Error", { status: 500 });
  }
}

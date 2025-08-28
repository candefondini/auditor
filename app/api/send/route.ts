//app/api/send/route.ts

import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const WEBHOOK = process.env.N8N_WEBHOOK_URL;
  console.log("DEBUG /api/send N8N_WEBHOOK_URL =", process.env.N8N_WEBHOOK_URL);
  if (!WEBHOOK) {
    return NextResponse.json({ error: "Falta N8N_WEBHOOK_URL" }, { status: 500 });
  }

  const payload = await req.json();
  const r = await fetch(WEBHOOK, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return NextResponse.json({ error: "Webhook falló", details: text || r.statusText }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

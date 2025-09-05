"use client";

import { useEffect, useMemo, useState } from "react";

const WAPP_NUMBER = process.env.NEXT_PUBLIC_WAPP_NUMBER || "14155238886"; // sandbox por defecto
const WAPP_JOIN   = process.env.NEXT_PUBLIC_WAPP_JOIN || "";             // ej: "join mean-vapor"

export default function LeadCTA({ score, url }: { score: number; url: string }) {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    phone: "",
    sitio: url || "",
    comentario: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [inviteText, setInviteText] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const isE164 = (v: string) => /^\+\d{6,15}$/.test(v.trim());
  const tone = (n: number) => (n <= 70 ? "red" : n <= 80 ? "amber" : "green");

  // Mensaje sugerido (con score)
  const defaultInvite = useMemo(() => {
    const nombre = (form.nombre || "").trim();
    const sitio  = (form.sitio  || "").trim();
    const lineaJoin  = WAPP_JOIN ? `${WAPP_JOIN}\n` : "";            // solo sandbox
    const lineaScore = Number.isFinite(score) ? `Mi score actual es ${score}.\n` : "";
    return (
      `${lineaJoin}` +
      `Hola! Soy ${nombre || "—"}.\n` +
      `${lineaScore}` +
      `Acabo de pedir una auditoría para ${sitio || "mi sitio"}.\n` +
      `¿Podemos seguir por acá así te paso info para el plan? 🙌`
    );
  }, [form.nombre, form.sitio, score]);

  useEffect(() => setInviteText(defaultInvite), [defaultInvite]);

  // Links wa.me (número sin +)
  const cleanNumber = String(WAPP_NUMBER).replace(/[^\d]/g, "");
  const joinLink = WAPP_JOIN
    ? `https://wa.me/${cleanNumber}?text=${encodeURIComponent(WAPP_JOIN)}`
    : "";
  const waLink = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(inviteText)}`;

  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(inviteText); alert("Mensaje copiado ✅"); }
    catch { alert("No se pudo copiar el mensaje 😕"); }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "WhatsApp", text: inviteText, url: waLink }); } catch {}
    } else {
      window.open(waLink, "_blank", "noopener,noreferrer");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading"); setErrorMsg(null);

    if (!isE164(form.phone)) {
      setStatus("error");
      setErrorMsg("Ingresá tu WhatsApp en formato internacional, ej: +5492610000000");
      return;
    }

    try {
      // Tu backend hace mail/registro. (Ya NO mandamos WhatsApp desde el server)
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre,
          email: form.email,
          site: form.sitio,
          comentario: form.comentario,
          phone: form.phone,
        }),
      });

      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || "No pudimos procesar tu solicitud en este momento.");
      }

      setStatus("ok"); // esto muestra el recuadro de WhatsApp
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Error desconocido");
    }
  };

  return (
    <div className="lead-card">
      {/* Header */}
      <div className="lead-header">
        <div className="section-eyebrow">Contacto</div>
        <div className="lead-title-row">
          <h2 className="section-heading">Mejorar mi puntaje</h2>
          <span className={`score-chip chip-${tone(score)}`} title="Score actual">{score}</span>
        </div>
        <div className="section-divider" />
        <p className="section-kicker">Te escribimos con un plan rápido para subir tu score.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="lead-form">
        <div className="grid">
          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" type="text" name="nombre" value={form.nombre}
              onChange={handleChange} placeholder="Tu nombre" required />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" name="email" value={form.email}
              onChange={handleChange} placeholder="tu@email.com" required />
          </div>

          <div className="field">
            <label htmlFor="phone">WhatsApp</label>
            <input id="phone" type="tel" name="phone" value={form.phone}
              onChange={handleChange} placeholder="+5492610000000" required />
          </div>

          <div className="field field-full">
            <label htmlFor="sitio">Sitio</label>
            <input id="sitio" type="url" name="sitio" value={form.sitio}
              onChange={handleChange} placeholder="https://tu-sitio.com" required />
          </div>

          <div className="field field-full">
            <label htmlFor="comentario">Comentario <span className="muted">(opcional)</span></label>
            <textarea id="comentario" name="comentario" value={form.comentario}
              onChange={handleChange} placeholder="Contanos si solicitás algo en particular…" rows={4} />
          </div>
        </div>

        <div className="actions">
          <button type="submit" disabled={status === "loading"} className="btn-audit">
            {status === "loading" ? "Enviando…" : "Enviar"}
          </button>

          {status === "ok" && <span className="pill pill-ok">¡Enviado con éxito!</span>}
          {status === "error" && <span className="pill pill-bad">Error{errorMsg ? ` — ${errorMsg}` : ""}</span>}
        </div>
      </form>

      {/* Panel para iniciar el chat (aparece cuando el submit fue OK) */}
      {status === "ok" && (
        <div className="start-chat">
          <div className="start-chat__title">Iniciá la conversación por WhatsApp</div>

          {WAPP_JOIN && (
            <>
              <p className="hint">Sandbox: primero unite mandando el JOIN.</p>
              <a className="btn-secondary" href={joinLink} target="_blank" rel="noopener noreferrer">
                1) Enviar JOIN
              </a>
              <div style={{ height: 8 }} />
            </>
          )}

          <label className="start-chat__label">Mensaje sugerido (podés editarlo):</label>
          <textarea className="start-chat__text" value={inviteText}
            onChange={(e) => setInviteText(e.target.value)} rows={5} />

          <div className="start-chat__actions">
            <button type="button" className="btn-secondary" onClick={() => navigator.clipboard.writeText(inviteText)}>
              Copiar
            </button>
            <a className="btn-wapp" href={waLink} target="_blank" rel="noopener noreferrer">
              {WAPP_JOIN ? "2) Abrir WhatsApp" : "Abrir WhatsApp"}
            </a>
          </div>
        </div>
      )}

      <style jsx>{`
        .lead-card { width: min(480px, 92vw); background: color-mix(in srgb, #fff 9%, transparent);
          border: 1px solid color-mix(in srgb, #fff 16%, transparent); border-radius: 14px; padding: 12px 14px; }
        .lead-header { display: flex; flex-direction: column; gap: 6px; }
        .lead-title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .grid { display: grid; gap: 10px; grid-template-columns: 1fr; }
        @media (min-width:640px){ .grid{ grid-template-columns:1fr 1fr } .field-full{ grid-column:1/-1 } }
        .field { display:flex; flex-direction:column; gap:4px; }
        .actions { display:flex; justify-content:flex-end; align-items:center; gap:8px; margin-top:10px; }
        .btn-audit { min-width:100px; padding:8px 12px; border-radius:10px; }
        .start-chat { margin-top:16px; padding:12px; border:1px dashed color-mix(in srgb, var(--ring) 60%, transparent); border-radius:12px; }
        .start-chat__title { font-weight:700; margin-bottom:8px; }
        .start-chat__label { font-size:12px; color:var(--muted); }
        .start-chat__text { width:100%; margin-top:6px; border-radius:10px; padding:8px 10px; }
        .start-chat__actions { display:flex; gap:8px; margin-top:10px; }
        .btn-secondary { padding:8px 10px; border-radius:10px; border:1px solid color-mix(in srgb, var(--ring) 72%, transparent); }
        .btn-wapp { padding:8px 10px; border-radius:10px; background:#25D366; color:#04140a; text-decoration:none; font-weight:700; }
      `}</style>
    </div>
  );
}

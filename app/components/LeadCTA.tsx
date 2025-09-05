"use client";

import { useMemo, useState } from "react";

type Props = { score: number; url: string };

export default function LeadCTA({ score, url }: Props) {
  // 👉 seteá TU número de WhatsApp para PROD cuando lo tengas.
  // Para Twilio Sandbox, usá +14155238886 (sin + para wa.me)
  const TWILIO_SANDBOX = "+14155238886";

  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState(""); // opcional para que el usuario lo vea/edite
  const [sitio, setSitio] = useState(url || "");
  const [mensaje, setMensaje] = useState("");

  // Mensaje sugerido (sin "join"). Incluye score y sitio.
  const sugerido = useMemo(() => {
    const nom = (nombre || "").trim() || "Soy un usuario";
    const link = (sitio || "").trim() || "https://tu-sitio.com";
    return (
      `Hola! ${nom}.\n` +
      `Mi score actual es ${score}.\n` +
      `Acabo de pedir una auditoría para ${link}.\n` +
      `¿Podemos seguir por acá así te paso info para el plan?`
    );
  }, [nombre, sitio, score]);

  // Link wa.me (NO incluir “join” acá)
  const waLink = useMemo(() => {
    const numberNoPlus = (TWILIO_SANDBOX || "").replace(/^\+/, ""); // ej 14155238886
    const text = encodeURIComponent(mensaje || sugerido);
    return `https://wa.me/${numberNoPlus}?text=${text}`;
  }, [mensaje, sugerido]);

  return (
    <div className="lead-card">
      <div className="lead-header">
        <div className="section-eyebrow">Contacto</div>
        <h2 className="section-heading">Iniciá la conversación por WhatsApp</h2>
        <p className="section-kicker">
          Te dejamos un mensaje listo para enviar. Si es la primera vez con este número de pruebas de Twilio,
          primero mandá <strong>join &lt;keyword&gt;</strong> una única vez y después enviá el mensaje.
        </p>
      </div>

      <div className="lead-form">
        <div className="grid">
          <div className="field">
            <label htmlFor="nombre">Tu nombre</label>
            <input id="nombre" value={nombre} onChange={e=>setNombre(e.target.value)} placeholder="Tu nombre" />
          </div>

          <div className="field">
            <label htmlFor="telefono">WhatsApp (opcional)</label>
            <input id="telefono" value={telefono} onChange={e=>setTelefono(e.target.value)} placeholder="+54XXXXXXXXXX" />
          </div>

          <div className="field field-full">
            <label htmlFor="sitio">Sitio</label>
            <input id="sitio" value={sitio} onChange={e=>setSitio(e.target.value)} placeholder="https://tu-sitio.com" />
          </div>

          <div className="field field-full">
            <label htmlFor="mensaje">
              Mensaje sugerido <span className="muted">(podés editarlo)</span>
            </label>
            <textarea
              id="mensaje"
              rows={5}
              value={mensaje || sugerido}
              onChange={e=>setMensaje(e.target.value)}
            />
          </div>
        </div>

        <div className="actions">
          <button className="btn-audit" onClick={() => navigator.clipboard.writeText(mensaje || sugerido)}>
            Copiar
          </button>
          <a className="btn-audit" href={waLink} target="_blank" rel="noreferrer">
            Abrir WhatsApp
          </a>
        </div>
      </div>

      <style jsx>{`
        .lead-card { width:min(560px, 96vw); background:color-mix(in srgb, #fff 8%, transparent);
          border:1px solid color-mix(in srgb, #fff 16%, transparent); border-radius:14px; padding:14px; }
        .lead-header{display:flex;flex-direction:column;gap:6px}
        .lead-form{margin-top:10px}
        .grid{display:grid;gap:10px;grid-template-columns:1fr}
        @media (min-width:640px){ .grid{grid-template-columns:1fr 1fr} .field-full{grid-column:1/-1} }
        .field{display:flex;flex-direction:column;gap:4px}
        .field input,.field textarea{background:color-mix(in srgb, var(--panel) 75%, transparent);border:1px solid color-mix(in srgb, var(--ring) 72%, transparent);
          border-radius:10px;padding:7px 10px}
        .actions{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
        .btn-audit{padding:8px 12px;border-radius:10px;background:var(--brand, #0ea5e9);color:white;text-decoration:none;border:none;cursor:pointer}
      `}</style>
    </div>
  );
}

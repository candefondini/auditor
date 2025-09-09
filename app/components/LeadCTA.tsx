"use client";

import { useMemo, useState } from "react";

type Props = {
  /** Puntaje global OAI (0–100). */
  oaiScore?: number;
  /** Preparación para IA (0–100). */
  iaScore?: number;
  /** Compat: si aún usás 'score', lo tratamos como oaiScore */
  score?: number;
  url: string;
};

export default function LeadCTA({ oaiScore, iaScore, score, url }: Props) {
  const WHATSAPP_NUMBER = "+14155238886"; // sandbox (cambiá por tu nro en prod)

  // Compat: si viene 'score' viejo, lo usamos como OAI
  const oai = Number.isFinite(oaiScore) ? Number(oaiScore) : Number(score);
  const ia  = Number(iaScore);

  const [nombre, setNombre] = useState("");
  const [sitio, setSitio] = useState(url || "");
  const [mensajeManual, setMensajeManual] = useState("");

  const iaLine  = Number.isFinite(ia)  ? `Preparación IA: ${ia}/100.` : "";
  const oaiLine = Number.isFinite(oai) ? `Score OAI: ${oai}/100.` : "";

  const mensajeSugerido = useMemo(() => {
    const nom  = (nombre || "").trim() || "un usuario";
    const link = (sitio || "").trim() || "https://tu-sitio.com";

    const puntajes =
      iaLine && oaiLine
        ? `Mis puntajes — ${iaLine.replace(/\.$/, "")} · ${oaiLine}`
        : iaLine || oaiLine;

    return [
      `Hola! Soy ${nom}.`,
      `Acabo de pedir una auditoría para ${link}.`,
      puntajes,
      `¿Seguimos por acá así te paso info para el plan?`,
    ]
      .filter(Boolean)
      .join("\n");
  }, [nombre, sitio, iaLine, oaiLine]);

  const waLink = useMemo(() => {
    const numberNoPlus = WHATSAPP_NUMBER.replace(/^\+/, "");
    const text = encodeURIComponent(mensajeManual || mensajeSugerido);
    return `https://wa.me/${numberNoPlus}?text=${text}`;
  }, [mensajeManual, mensajeSugerido]);

  return (
    <div className="wrap">
      <div className="panel">
        <h2 className="title">Iniciá la conversación por WhatsApp</h2>
        <p className="sub">Te dejamos un mensaje listo para enviar.</p>

        <div className="grid">
          <div className="field">
            <label htmlFor="nombre">Tu nombre</label>
            <input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Tu nombre"
              autoComplete="name"
            />
          </div>

          <div className="field full">
            <label htmlFor="sitio">Sitio</label>
            <input
              id="sitio"
              value={sitio}
              onChange={(e) => setSitio(e.target.value)}
              placeholder="https://tu-sitio.com"
              inputMode="url"
            />
          </div>

          <div className="field full">
            <label htmlFor="mensaje">
              Mensaje sugerido <span className="muted">(podés editarlo)</span>
            </label>
            <textarea
              id="mensaje"
              rows={5}
              value={mensajeManual || mensajeSugerido}
              onChange={(e) => setMensajeManual(e.target.value)}
            />
          </div>
        </div>

        <a id="whatsapp-btn" className="btn" href={waLink} target="_blank" rel="noreferrer">
          Abrir WhatsApp
        </a>
      </div>

      <style jsx>{`
        .wrap { display: grid; place-items: center; }
        .panel {
          width: min(660px, 96vw);
          border-radius: 16px;
          padding: 18px;
          background: color-mix(in srgb, #0b1320 75%, transparent);
          border: 1px solid color-mix(in srgb, #ffffff 16%, transparent);
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.2);
        }
        .title { margin: 0 0 6px 0; font-size: 24px; line-height: 1.25; }
        .sub { margin: 0 0 14px 0; color: var(--muted, #9aa3af); font-size: 14px; }
        .grid { display: grid; gap: 12px; grid-template-columns: 1fr 1fr; margin-bottom: 12px; }
        .full { grid-column: 1 / -1; }
        .field { display: flex; flex-direction: column; gap: 6px; }
        label { font-size: 12px; font-weight: 700; color: var(--muted, #9aa3af); }
        input, textarea {
          width: 100%;
          background: color-mix(in srgb, var(--panel, #0f172a) 78%, transparent);
          color: var(--text, #e5e7eb);
          border: 1px solid color-mix(in srgb, var(--ring, #94a3b8) 62%, transparent);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          transition: border .15s, box-shadow .15s;
        }
        input:focus, textarea:focus {
          border-color: color-mix(in srgb, var(--brand, #22d3ee) 65%, transparent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand, #22d3ee) 20%, transparent);
        }
        .muted { color: var(--muted, #9aa3af); font-weight: 500; }
        .btn {
          display: inline-flex; align-items: center; justify-content: center;
          width: 100%; padding: 12px 14px; border-radius: 12px;
          background: var(--brand, #06b6d4); color: #fff; text-decoration: none;
          font-weight: 800; letter-spacing: .2px;
        }
        .btn:hover { filter: brightness(1.05); }
        @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

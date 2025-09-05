"use client";

import { useMemo, useState } from "react";

type Props = { score: number; url: string };

export default function LeadCTA({ score, url }: Props) {
  // ⚙️ Configurá acá el número destino de WhatsApp.
  // - Sandbox Twilio: +14155238886 (dejalo así para pruebas)
  // - Producción: reemplazalo por tu número verificado
  const WHATSAPP_NUMBER = "+14155238886";

  // (Opcional) keyword del sandbox para mostrar el tip
  const TWILIO_JOIN_KEYWORD = "mean-vapor"; // cambiá si tu sandbox dice otro

  const [nombre, setNombre] = useState("");
  const [sitio, setSitio] = useState(url || "");
  const [mensajeManual, setMensajeManual] = useState("");

  // Mensaje sugerido: incluye score y link del sitio
  const mensajeSugerido = useMemo(() => {
    const nom = (nombre || "").trim() || "Soy un usuario";
    const link = (sitio || "").trim() || "https://tu-sitio.com";
    return (
      `Hola! Soy ${nom}.\n` +
      `Acabo de pedir una auditoría para ${link}.\n` +
      `Mi score actual es ${score}.\n` +
       +
      `¿Podemos seguir por acá así te paso info para el plan?`
    );
  }, [nombre, sitio, score]);

  // Enlace wa.me sin “join”, solo el saludo
  const waLink = useMemo(() => {
    const numberNoPlus = WHATSAPP_NUMBER.replace(/^\+/, "");
    const text = encodeURIComponent(mensajeManual || mensajeSugerido);
    return `https://wa.me/${numberNoPlus}?text=${text}`;
  }, [WHATSAPP_NUMBER, mensajeManual, mensajeSugerido]);

  return (
    <div className="card">
      <div className="header">
        <div className="eyebrow">Contacto</div>
        <h2>Iniciá la conversación por WhatsApp</h2>
        <p className="kicker">
          Te dejamos un mensaje listo para enviar.
          {TWILIO_JOIN_KEYWORD && (
            <>
              {" "}
              Si es tu primera vez con el número de prueba, enviá{" "}
              <code>join {TWILIO_JOIN_KEYWORD}</code> una única vez y después
              mandá el mensaje.
            </>
          )}
        </p>
      </div>

      <div className="form">
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

        <div className="actions">
          <a className="btn primary" href={waLink} target="_blank" rel="noreferrer">
            Abrir WhatsApp
          </a>
        </div>
      </div>

      <style jsx>{`
        .card {
          width: min(660px, 96vw);
          margin: 0 auto;
          background: color-mix(in srgb, #ffffff 10%, transparent);
          border: 1px solid color-mix(in srgb, #ffffff 18%, transparent);
          border-radius: 16px;
          padding: 18px 18px 16px;
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }
        .header {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .eyebrow {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.04em;
          color: var(--muted, #9aa3af);
          text-transform: uppercase;
        }
        h2 {
          margin: 0;
          font-size: 22px;
          line-height: 1.2;
        }
        .kicker {
          margin: 2px 0 0 0;
          color: var(--muted, #9aa3af);
          font-size: 14px;
        }
        code {
          background: rgba(148, 163, 184, 0.15);
          padding: 2px 6px;
          border-radius: 8px;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
            "Liberation Mono", "Courier New", monospace;
        }
        .form {
          margin-top: 14px;
        }
        .grid {
          display: grid;
          gap: 12px;
          grid-template-columns: 1fr 1fr;
        }
        .full {
          grid-column: 1 / -1;
        }
        .field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        label {
          font-size: 12px;
          font-weight: 700;
          color: var(--muted, #9aa3af);
        }
        input,
        textarea {
          width: 100%;
          background: color-mix(in srgb, var(--panel, #0b1220) 75%, transparent);
          color: var(--text, #e5e7eb);
          border: 1px solid color-mix(in srgb, var(--ring, #94a3b8) 65%, transparent);
          border-radius: 12px;
          padding: 10px 12px;
          font-size: 14px;
          outline: none;
          transition: border 0.15s ease, box-shadow 0.15s ease;
        }
        input:focus,
        textarea:focus {
          border-color: color-mix(in srgb, var(--brand, #22d3ee) 60%, transparent);
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand, #22d3ee) 18%, transparent);
        }
        .muted {
          color: var(--muted, #9aa3af);
          font-weight: 500;
        }
        .actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 10px;
          gap: 8px;
        }
        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 10px 14px;
          border-radius: 12px;
          text-decoration: none;
          font-weight: 700;
          border: none;
          cursor: pointer;
          user-select: none;
        }
        .btn.primary {
          background: var(--brand, #06b6d4);
          color: white;
        }
        .btn.primary:hover {
          filter: brightness(1.05);
        }
        @media (max-width: 640px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

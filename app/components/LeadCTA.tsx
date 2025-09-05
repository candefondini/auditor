"use client";

import { useState } from "react";

export default function LeadCTA({ score, url }: { score: number; url: string }) {
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    phone: "",         // 👈 nuevo
    sitio: url || "",
    comentario: "",
  });
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 👇 REEMPLAZÁ por tu Production URL de n8n (no /webhook-test/)
  const N8N_WEBHOOK_URL = "https://coso.app.n8n.cloud/webhook/form-auditor";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const isE164 = (value: string) => /^\+\d{6,15}$/.test(value.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);

    // Validación mínima de teléfono
    if (!isE164(form.phone)) {
      setStatus("error");
      setErrorMsg("Ingresá el WhatsApp en formato internacional, ej: +54XXXXXXXXXX");
      return;
    }

    try {
      // Lo que ya esperaba tu API local para mail
      const payloadApi = {
        nombre: form.nombre,
        email: form.email,
        site: form.sitio, // tu /api/lead espera "site"
        comentario: form.comentario,
      };

      // Lo que va al flujo de n8n → Twilio WhatsApp
      const payloadN8n = {
        name: form.nombre,
        email: form.email,
        phone: form.phone,     // 👈 clave para WhatsApp
        url: form.sitio,
        message: form.comentario,
      };

      // Enviamos ambas cosas en paralelo (mail + WhatsApp)
      const [resApi, resN8n] = await Promise.allSettled([
        fetch("/api/lead", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payloadApi),
        }),
        fetch(N8N_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // Si tu n8n está detrás de CORS estricto y falla,
          // podemos agregar un preflight/OPTIONS en n8n o usar proxy en /api/lead.
          body: JSON.stringify(payloadN8n),
        }),
      ]);

      const apiOk =
        resApi.status === "fulfilled" && (resApi.value as Response).ok;
      const n8nOk =
        resN8n.status === "fulfilled" && (resN8n.value as Response).ok;

      if (!apiOk && !n8nOk) {
        throw new Error("No pudimos procesar tu solicitud en este momento.");
      }

      setStatus("ok");
      setForm({ nombre: "", email: "", phone: "", sitio: "", comentario: "" });
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Error desconocido");
    }
  };

  const tone = (n: number) => (n <= 70 ? "red" : n <= 80 ? "amber" : "green");

  return (
    <div className="lead-card">
      {/* Header */}
      <div className="lead-header">
        <div className="section-eyebrow">Contacto</div>
        <div className="lead-title-row">
          <h2 className="section-heading">Mejorar mi puntaje</h2>
          <span className={`score-chip chip-${tone(score)}`} title="Score actual">
            {score}
          </span>
        </div>
        <div className="section-divider" />
        <p className="section-kicker">Te escribimos con un plan rápido para subir tu score.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="lead-form">
        <div className="grid">
          <div className="field">
            <label htmlFor="nombre">Nombre</label>
            <input
              id="nombre"
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Tu nombre"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="tu@email.com"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="phone">WhatsApp</label>
            <input
              id="phone"
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="+54XXXXXXXXXX"
              required
            />
          </div>

          <div className="field field-full">
            <label htmlFor="sitio">Sitio</label>
            <input
              id="sitio"
              type="url"
              name="sitio"
              value={form.sitio}
              onChange={handleChange}
              placeholder="https://tu-sitio.com"
              required
            />
          </div>

          <div className="field field-full">
            <label htmlFor="comentario">
              Comentario <span className="muted">(opcional)</span>
            </label>
            <textarea
              id="comentario"
              name="comentario"
              value={form.comentario}
              onChange={handleChange}
              placeholder="Contanos si solicitás algo en particular..."
              rows={4}
            />
          </div>
        </div>

        <div className="actions">
          <button type="submit" disabled={status === "loading"} className="btn-audit">
            {status === "loading" ? "Enviando…" : "Enviar"}
          </button>

          {status === "ok" && <span className="pill pill-ok">¡Enviado con éxito!</span>}
          {status === "error" && (
            <span className="pill pill-bad">
              Error{errorMsg ? ` — ${errorMsg}` : ""}
            </span>
          )}
        </div>
      </form>

      {/* Scoped styles */}
      <style jsx>{`
        .lead-card {
          width: min(440px, 92vw);
          background: color-mix(in srgb, #ffffff 9%, transparent);
          border: 1px solid color-mix(in srgb, #ffffff 16%, transparent);
          border-radius: 14px;
          box-shadow: var(--shadow-1), inset 0 1px 0 rgba(255, 255, 255, 0.05);
          padding: 12px 14px;
          color: var(--text);
          margin: 0 auto;
        }
        .lead-header { display: flex; flex-direction: column; gap: 6px; }
        .lead-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .lead-form { margin-top: 10px; }
        .grid { display: grid; gap: 10px; grid-template-columns: 1fr; }
        @media (min-width: 640px) {
          .grid { grid-template-columns: 1fr 1fr; }
          .field-full { grid-column: 1 / -1; }
        }
        .field { display: flex; flex-direction: column; gap: 4px; }
        .field label { font-size: 12px; font-weight: 700; color: var(--muted); }
        .field input, .field textarea {
          width: 100%;
          background: color-mix(in srgb, var(--panel) 75%, transparent);
          color: var(--text);
          border: 1px solid color-mix(in srgb, var(--ring) 72%, transparent);
          border-radius: 10px;
          padding: 7px 10px;
          font-size: 13px;
          outline: none;
        }
        .actions { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 10px; }
        .btn-audit { min-width: 100px; padding: 8px 12px; border-radius: 10px; }
      `}</style>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type LeadCTAProps = { score?: number; url?: string; buttonText?: string; };

export default function LeadCTA({ score, url, buttonText = "Quiero mejorar mi puntaje" }: LeadCTAProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="card" role="region" aria-label="CTA lead">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="m-0 text-[15px] font-extrabold">¿Querés subir tu puntaje?</h3>
            <p className="m-0 mt-1 small muted">
              Te contactamos con un plan concreto para {url ? <strong>{url}</strong> : "tu sitio"}.
              {typeof score === "number" && <> Score actual: <span className="pill">{score}</span></>}
            </p>
          </div>
          <button
            className="btn-audit"
            type="button"
            onClick={() => { console.log("open modal"); setOpen(true); }}
          >
            {buttonText}
          </button>
        </div>
      </div>

      {open && <LeadModal defaultUrl={url} onClose={() => setOpen(false)} />}
    </>
  );
}

function LeadModal({ defaultUrl, onClose }: { defaultUrl?: string; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // en LeadModal
useEffect(() => {
  const prev = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  return () => { document.body.style.overflow = prev; };
}, []);

<input name="email" type="email" required pattern="[^@\s]+@[^@\s]+\.[^@\s]+" title="Email inválido" className="input-url" />

  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // evita problemas de SSR

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true); setErr(null);

    const fd = new FormData(e.currentTarget);
    const payload = {
      name: String(fd.get("name") || ""),
      email: String(fd.get("email") || ""),
      site: String(fd.get("site") || defaultUrl || ""),
      message: String(fd.get("message") || ""),
      source: "auditor",
      pagePath: typeof window !== "undefined" ? location.pathname : "",
    };

    try {
      const r = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw new Error(await r.text());
      setOk(true);
    } catch (e: any) {
      setErr(e?.message || "Error al enviar. Probá nuevamente.");
    } finally {
      setLoading(false);
    }
  }

  // ⬇️ Portal al <body> para evitar z-index/transform/overflow de ancestros
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Formulario de contacto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, zIndex: 999999,
        display: "grid", placeItems: "center",
        padding: 16, background: "rgba(0,0,0,.45)"
      }}
    >
      <div className="card max-w-md w-full" style={{ background: "var(--panel)" }}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="m-0 text-[15px] font-extrabold">Mejorar mi puntaje</h4>
          <button className="btn-secondary" type="button" onClick={onClose}>Cerrar</button>
        </div>

        {ok ? (
          <p className="mt-3">¡Listo! Te vamos a escribir en breve. ✅</p>
        ) : (
          <form className="mt-3 space-y-3" onSubmit={submit}>
            <div className="grid gap-2">
              <label className="small muted">Nombre</label>
              <input name="name" required className="input-url" placeholder="Tu nombre" />
            </div>
            <div className="grid gap-2">
              <label className="small muted">Email</label>
              <input
  name="email"
  type="email"
  required
  pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
  title="Ingresá un email válido (ej: nombre@dominio.com)"
  className="input-url"
  placeholder="tu@email.com"
/>
            </div>
            <div className="grid gap-2">
              <label className="small muted">Sitio</label>
              <input name="site" defaultValue={defaultUrl} className="input-url" placeholder="https://tu-sitio.com" />
            </div>
            <div className="grid gap-2">
              <label className="small muted">Comentario (opcional)</label>
              <textarea name="message" rows={3} className="input-url" placeholder="Contanos qué querés mejorar" />
            </div>

            {err && <div className="error-message">{err}</div>}

            <button className="btn-audit" type="submit" disabled={loading}>
              {loading ? "Enviando..." : "Enviar"}
            </button>
          </form>
        )}
      </div>
    </div>,
    document.body
  );
}

"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import LeadCTA from "./components/LeadCTA";

/* Tipos */
import type { HTMLAttributes, ElementType } from "react";
import type { MotionProps } from "framer-motion";

/* ---------------- Helpers ---------------- */
const LABELS: Record<string, string> = {
  http2xx: "La página responde correctamente",
  https: "Conexión segura (HTTPS)",
  contentTypeHtml: "Se entrega como una página web",
  robotsAllowed: "Permite la indexación de los bots",
  xRobotsOk: "Cabeceras no bloquean los bots de búsqueda",
  titleOk: "Título claro (10–70 caracteres)",
  canonicalOk: "Canonical definido",
  metaNoindex: "No bloquea con “meta robots”",
  sitemapInRobots: "Sitemap declarado en robots.txt",
  h1Ok: "Contiene un encabezado principal (H1)",
  textRatioOk: "Contenido visible en el HTML inicial",
  schemaOk: "Datos estructurados (schema.org)",
  faqOk: "FAQ/HowTo (si aplica)",
  antiBotLikely: "No tiene bloqueos agresivos contra bots",
  paywallHint: "No tiene un paywall que bloquea el contenido",
  soft404: "No aparenta ser un ‘Soft 404’",
  langAttr: "Idioma correctamente declarado (lang)",
};
const NEGATIVE_TRUE = new Set(["metaNoindex", "antiBotLikely", "paywallHint", "soft404"]);
const tone = (n: number) => (n <= 70 ? "red" : n <= 80 ? "amber" : "green");

const normalizeUrl = (raw: string) =>
  /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;

function isValidAuditableUrl(raw: string): boolean {
  const input = raw.trim();
  if (!input) return false;
  const withProto = normalizeUrl(input);
  try {
    const u = new URL(withProto);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname;
    if (!/^[a-z0-9.-]+$/i.test(host)) return false;
    if (!/\.[a-z]{2,}$/i.test(host)) return false;
    return true;
  } catch {
    return false;
  }
}

type PerModel = "chatgpt" | "gemini" | "copilot" | "perplexity" | "claude";
type AuditResponse = {
  url?: string;
  finalUrl?: string;
  uaTried?: string;
  strict?: boolean;
  accessibleForOAI?: boolean;
  blockedReasons?: string[];
  overall?: number;
  iaReadiness?: number;
  perModelScores?: Partial<Record<PerModel, number>>;
  iaHints?: string[];
  breakdown?: { category: string; score: number; items: Record<string, any> }[];
  suggestions?: { id: string; title: string; impactPts: number; effort: "low" | "med" | "high"; detail?: string }[];
  extrasSuggestions?: { title: string; detail?: string }[];
  raw?: any;
  [key: string]: any;
};

/* ---------- Modal ---------- */
function useLockBody(lock: boolean) {
  useEffect(() => {
    const original = document.body.style.overflow;
    if (lock) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [lock]);
}

function Modal({
  open,
  onClose,
  children,
  labelledBy,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
}) {
  useLockBody(open);
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "grid",
        placeItems: "center",
        background: "rgba(0,0,0,.6)",
        backdropFilter: "blur(4px)",
      }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "min(880px, 92vw)",
          maxHeight: "85vh",
          overflow: "auto",
          background: "color-mix(in srgb, #ffffff 10%, transparent)",
          border: "1px solid color-mix(in srgb, #ffffff 18%, transparent)",
          borderRadius: 18,
          padding: 16,
          color: "#fff",
          boxShadow: "0 12px 40px rgba(0,0,0,.45)",
          animation: "modalIn .18s ease-out",
        }}
      >
        {children}
      </div>
      <style>{`
        @keyframes modalIn {
          from { transform: translateY(12px); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
}

/* ---- Card ---- */
type CardProps = HTMLAttributes<HTMLDivElement> & Partial<MotionProps> & { as?: ElementType };
const Card: React.FC<CardProps> = ({ children, style, as: Comp = "div", ...rest }) => (
  <Comp
    {...rest}
    style={{
      background: "color-mix(in srgb, #ffffff 9%, transparent)",
      color: "#fff",
      borderRadius: 18,
      padding: 12,
      boxShadow: "0 8px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05)",
      border: "1px solid color-mix(in srgb, #ffffff 16%, transparent)",
      transition: "transform .2s ease, box-shadow .2s ease",
      ...style,
    }}
    onMouseEnter={(e: any) => {
      e.currentTarget.style.transform = "translateY(-3px)";
      e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,.5)";
    }}
    onMouseLeave={(e: any) => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow =
        "0 8px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05)";
    }}
  >
    {children}
  </Comp>
);

/* ---- SearchBar ---- */
const SEARCH_CARD_STYLE: React.CSSProperties = {
  width: "min(1128px, calc(100vw - 32px))",
  padding: 16,
  marginInline: "auto",
};

type SearchBarProps = {
  url: string;
  setUrl: (v: string) => void;
  loading: boolean;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  error?: string | null;
  top?: boolean;
};

const SearchBar = memo(function SearchBar({
  url,
  setUrl,
  loading,
  onSubmit,
  error,
  top = false,
}: SearchBarProps) {
  return (
    <Card style={{ ...SEARCH_CARD_STYLE, ...(top ? { marginTop: 12, marginBottom: 10 } : {}) }}>
      <form className="input-container" onSubmit={onSubmit} noValidate id="auditar-form">
        <input
          id="url-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tu-sitio.com.ar/pagina"
          className="input-url"
          inputMode="url"
          autoComplete="off"
          style={{ flex: "1 1 0%", minWidth: 0 }}
        />
        <button id="auditar-btn" type="submit" disabled={loading} className="btn-audit">
          {loading ? "Auditando..." : "Auditar"}
        </button>
      </form>
      {!top && error && <div className="error-message" style={{ marginTop: 10 }}>Error: {error}</div>}
    </Card>
  );
});

/* ---------------- Home ---------------- */
const STORAGE_KEY = "auditor:last";

export default function Home() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [url, setUrl] = useState("");
  const [data, setData] = useState<AuditResponse>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const hasResult =
    typeof data.overall === "number" &&
    Array.isArray(data.breakdown) &&
    data.breakdown.length > 0;

  // Rehidratar si volvemos desde /reporte
  useEffect(() => {
    if (!mounted) return;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.data?.overall) {
          setData(parsed.data);
          setUrl(parsed.url || "");
        }
      }
    } catch {}
  }, [mounted]);

  const audit = async () => {
    setLoading(true);
    setErr(null);
    setData({});
    setShowForm(false);
    try {
      const safeUrl = normalizeUrl(url);
      const r = await fetch(`/api/audit?url=${encodeURIComponent(safeUrl)}`);
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as any;
        throw new Error(j.error || `No se pudo auditar (HTTP ${r.status}).`);
      }
      const j = (await r.json()) as AuditResponse;
      setData(j);

      // Guardar último resultado para recuperar al volver de /reporte
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ data: j, url: j.finalUrl || j.url || safeUrl })
        );
      } catch {}
    } catch (e: any) {
      setErr(e?.message || "Ocurrió un error inesperado.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (loading) return;
    if (!isValidAuditableUrl(url)) {
      setErr("Ingresá una URL válida (https/http). Aceptamos dominios .ar y multinivel como .com.ar");
      return;
    }
    audit();
  };

  if (!mounted) {
    return (
      <main className="main-container" style={{ color: "#fff" }}>
        <header className="header">
          <div className="header-content">
            <h1 className="title-glitch" data-text="IA Friendly">
              IA Friendly
            </h1>
          </div>
        </header>
        <div className="content-container" />
      </main>
    );
  }

  return (
    <main className="main-container" style={{ color: "#fff" }}>
      <motion.header
        className="header"
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="header-content">
          <h1 className="title-glitch" data-text="IA Friendly">
            IA Friendly
          </h1>
        </div>
      </motion.header>

      <div className="content-container">
        {!hasResult ? (
          <div
            style={{
              display: "grid",
              placeItems: "center",
              minHeight: "calc(100dvh - 160px)",
              padding: "12px 0",
            }}
          >
            <SearchBar
              url={url}
              setUrl={setUrl}
              loading={loading}
              onSubmit={handleSubmit}
              error={err}
            />
          </div>
        ) : (
          <>
            <SearchBar url={url} setUrl={setUrl} loading={loading} onSubmit={handleSubmit} top />
            {err && <div className="error-message">Error: {err}</div>}
          </>
        )}

        {hasResult && (
          <div ref={reportRef} style={{ display: "grid", gap: 16 }}>
            {/* === RESULTADOS (resumen) === */}
            <div className="two-col-md">
              {/* Preparación IA (Índice técnico) */}
              <Card
                as={motion.div}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div className="section-title">
                  <div className="section-eyebrow">Resultados</div>
                  <h2 className="section-heading">
                    Preparación para IA{" "}
                    <span className="chip small" title="Índice técnico por modelo">
                      Índice técnico
                    </span>{" "}
                  </h2>
                  <div className="section-divider" />
                  <p className="section-kicker">
                    Qué tan listo está tu sitio (0–100) para que los modelos entiendan tu
                    contenido.
                  </p>
                </div>

                {typeof data.iaReadiness === "number" && (
                  <div className="score-header" style={{ marginTop: 10 }}>
                    <div className="score-value" style={{ marginBottom: 6 }}>
                      Preparación global:{" "}
                      <span className={`score-chip chip-${tone(data.iaReadiness)}`}>
                        {data.iaReadiness}
                      </span>
                      /100
                    </div>
                    <div className="score-bar">
                      <div
                        className={`score-progress progress-${tone(data.iaReadiness)}`}
                        style={{ width: `${data.iaReadiness}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Por modelo */}
                <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                  {(() => {
                    const scores = (data.perModelScores || {}) as Partial<
                      Record<string, number>
                    >;
                    const rows: Array<[string, number | undefined]> = [
                      ["ChatGPT", scores.chatgpt],
                      ["Gemini", scores.gemini],
                      ["Copilot", scores.copilot],
                      ["Perplexity", scores.perplexity],
                      ["Claude", scores.claude],
                    ];
                    return (
                      <ul
                        style={{
                          listStyle: "none",
                          padding: 0,
                          margin: 0,
                          display: "grid",
                          gap: 6,
                          fontSize: 14,
                        }}
                      >
                        {rows.map(([label, val]) => (
                          <li
                            key={label}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              background: "rgba(255,255,255,.04)",
                              padding: "6px 8px",
                              borderRadius: 10,
                            }}
                          >
                            <span>{label}</span>
                            <span
                              className={`score-chip chip-${tone(
                                typeof val === "number" ? val : 0
                              )}`}
                            >
                              {typeof val === "number" ? val : "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </div>
              </Card>

              {/* Sugerencias IA */}
              <Card
                as={motion.div}
                initial={false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{ display: "flex", flexDirection: "column", gap: 8 }}
              >
                <div className="section-title">
                  <div className="section-eyebrow">Optimización</div>
                  <h2 className="section-heading">Sugerencias para IA</h2>
                  <div className="section-divider" />
                  <p className="section-kicker">
                    Acciones para que los crawlers de IA entiendan mejor tu sitio.
                  </p>
                </div>

                <ul
                  style={{
                    listStyle: "disc",
                    paddingLeft: 18,
                    marginTop: 8,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  {Array.isArray(data.iaHints) && data.iaHints.length > 0 ? (
                    data.iaHints.map((h: string, i: number) => <li key={i}>{h}</li>)
                  ) : (
                    <li style={{ opacity: 0.7 }}>Sin sugerencias específicas para IA.</li>
                  )}
                </ul>
              </Card>
            </div>

            {/* === BARRA DE ACCIONES === */}
            <Card>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div className="muted small">
                  Incluye <strong>Score OAI</strong>{" "}
                  <span className="chip small" title="Puntaje global OAI-SearchBot">
                    Puntaje global
                  </span>
                  , accesibilidad para OAI-SearchBot, checklist técnico y extras.
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Link
                    id="ver-informe-btn"
                    className="btn-audit"
                    href={`/reporte?u=${encodeURIComponent(
                      data.finalUrl || data.url || url
                    )}`}
                    prefetch
                    onClick={() => {
                      try {
                        sessionStorage.setItem(
                          STORAGE_KEY,
                          JSON.stringify({
                            data,
                            url: data.finalUrl || data.url || url,
                          })
                        );
                      } catch {}
                    }}
                  >
                    Ver informe completo
                  </Link>

                  {/* ⚠️ Botón con ID para GTM */}
                  <button
                    id="contactanos-btn"
                    type="button"
                    className="btn-secondary"
                    onClick={() => setShowForm(true)}
                  >
                    Contactanos para subir tu puntaje
                  </button>
                </div>
              </div>
            </Card>

            {/* Modal */}
            <Modal
              open={showForm}
              onClose={() => setShowForm(false)}
              labelledBy="contactanos-title"
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "start",
                  gap: 10,
                }}
              >
                <h3 id="contactanos-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  Contactanos
                </h3>
                <button
                  id="modal-cerrar-btn"
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowForm(false)}
                >
                  Cerrar
                </button>
              </div>
              <div id="leadcta-container" style={{ marginTop: 12 }}>
                {/* Desde GTM podés capturar el click a WhatsApp
                   usando "Click URL contiene wa.me" dentro de este contenedor */}
                <LeadCTA score={data.overall!} url={data.finalUrl || data.url!} />
              </div>
            </Modal>
          </div>
        )}
      </div>

      <footer className="site-footer" aria-label="Pie de página">
        <div className="footer-inner">
          DEVELOPED BY{" "}
          <a
            id="coso-link"
            href="https://coso.ar"
            className="brand brand-link"
            target="_blank"
            rel="noopener noreferrer"
            title="Ir a coso.ar"
          >
            COSO
          </a>
        </div>
      </footer>

      <style jsx global>{`
        .chip.small {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 10px;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.18);
          margin: 0 6px;
          vertical-align: middle;
        }
      `}</style>
    </main>
  );
}

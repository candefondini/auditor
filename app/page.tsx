"use client";

import React, { useEffect, useRef, useState, memo } from "react";
import { motion } from "framer-motion";
import LeadCTA from "./components/LeadCTA";

/* Tipos para Framer + React */
import type { HTMLAttributes, ElementType } from "react";
import type { MotionProps } from "framer-motion";

/* ---------------- Tipos & helpers ---------------- */
const LABELS: Record<string, string> = {
  // Crawlabilidad
  http2xx: "La página responde correctamente",
  https: "Conexión segura (HTTPS)",
  contentTypeHtml: "Se entrega como una página web",
  robotsAllowed: "Permite la indexación de los bots",
  xRobotsOk: "Cabeceras no bloquean los bots de búsqueda",
  // Descubribilidad
  titleOk: "Título claro (10–70 caracteres)",
  canonicalOk: "Canonical definido",
  metaNoindex: "No bloquea con “meta robots”",
  sitemapInRobots: "Sitemap declarado en robots.txt",
  // Contenido & Semántica
  h1Ok: "Contiene un encabezado principal (H1)",
  textRatioOk: "Contenido visible en el HTML inicial",
  schemaOk: "Datos estructurados (schema.org)",
  faqOk: "FAQ/HowTo (si aplica)",
  // Render / Robustez
  antiBotLikely: "No tiene bloqueos agresivos contra bots",
  paywallHint: "No tiene un paywall que bloquea el contenido",
  soft404: "No aparenta ser un ‘Soft 404’",
  // i18n
  langAttr: "Idioma correctamente declarado (lang)",
};

const NEGATIVE_TRUE = new Set(["metaNoindex", "antiBotLikely", "paywallHint", "soft404"]);
const tone = (n: number) => (n <= 70 ? "red" : n <= 80 ? "amber" : "green");

/** Normaliza agregando https:// si falta */
const normalizeUrl = (raw: string) =>
  /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;

/** Valida URLs http(s) con TLD de 2+ letras y soporta multinivel (.com.ar, .gob.ar, etc.) */
function isValidAuditableUrl(raw: string): boolean {
  const input = raw.trim();
  if (!input) return false;
  const withProto = normalizeUrl(input);
  try {
    const u = new URL(withProto);
    if (!/^https?:$/.test(u.protocol)) return false;
    const host = u.hostname;
    if (!/^[a-z0-9.-]+$/i.test(host)) return false; // letras/números/guiones/puntos
    if (!/\.[a-z]{2,}$/i.test(host)) return false; // TLD de 2+ letras (.ar ok), multinivel ok
    return true;
  } catch {
    return false;
  }
}

type PerModel = "chatgpt" | "gemini" | "copilot" | "perplexity" | "claude";

/** Tipo minimal para destrabar TS sin listar TODO ahora. */
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

  suggestions?: {
    id: string;
    title: string;
    impactPts: number;
    effort: "low" | "med" | "high";
    detail?: string;
  }[];

  extras?: {
    metaDescription: { present: boolean; length: number; ok: boolean; sample: string };
    aiDirectives: { metaNoAI: boolean; xRobotsNoAI: boolean };
    robotsPerBot: { oai: boolean; gpt: boolean; wildcard: boolean };
    securityHeaders: { hsts: boolean; csp: boolean; clickjackProtected: boolean };
  };

  extrasSuggestions?: { title: string; detail?: string }[];
  raw?: any;

  [key: string]: any;
};

/* ---------- Modal “Contactanos” (bloquea scroll) ---------- */
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

/* ---- Helper Card (hover) ---- */
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

/* --------- SearchBar (memo) - estable, no pierde foco --------- */
const SEARCH_CARD_STYLE: React.CSSProperties = {
  width: "min(1128px, calc(100vw - 32px))", // mismo tope que .content-container
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
      <form className="input-container" onSubmit={onSubmit} noValidate>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://tu-sitio.com.ar/pagina"
          className="input-url"
          inputMode="url"
          autoComplete="off"
          style={{ flex: "1 1 0%", minWidth: 0 }}
        />
        <button type="submit" disabled={loading} className="btn-audit">
          {loading ? "Auditando..." : "Auditar"}
        </button>
      </form>
      {!top && error && <div className="error-message" style={{ marginTop: 10 }}>Error: {error}</div>}
    </Card>
  );
});

/* ---------------- Componente ---------------- */
export default function Home() {
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
      setErr(
        "Ingresá una URL válida (https/http). Aceptamos dominios .ar y multinivel como .com.ar"
      );
      return;
    }
    audit();
  };

  return (
    <main className="main-container" style={{ color: "#fff" }}>
      <motion.header
        className="header"
        initial={{ opacity: 0, y: -8 }}
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
        {/* ======= ESTADO: SIN RESULTADOS ======= */}
        {!hasResult ? (
          <div style={{ display: "grid", gap: 12 }}>
            {/* Intro rica en texto para subir textRatio y evitar soft 404 */}
            <Card style={{ ...SEARCH_CARD_STYLE }}>
              <div className="section-title">
                <div className="section-eyebrow">Qué es</div>
                <h2 className="section-heading">Auditá tu sitio para crawlers de IA</h2>
                <div className="section-divider" />
                <p className="section-kicker">
                  IA Friendly analiza señales técnicas que usan OAI-SearchBot, gptbot y otros
                  crawlers. Te da un <strong>score de 0 a 100</strong> y un plan claro para mejorar.
                </p>
              </div>

              <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                <ul
                  style={{
                    listStyle: "disc",
                    paddingLeft: 18,
                    display: "grid",
                    gap: 6,
                  }}
                >
                  <li>
                    <strong>Crawlabilidad:</strong> HTTPS, <code>robots.txt</code>, cabeceras.
                  </li>
                  <li>
                    <strong>Descubribilidad:</strong> <code>&lt;title&gt;</code>, canonical, sitemap.
                  </li>
                  <li>
                    <strong>Contenido & semántica:</strong> H1, JSON-LD, contenido en HTML inicial.
                  </li>
                  <li>
                    <strong>Render/robustez:</strong> bloqueos anti-bot, paywalls y soft 404.
                  </li>
                  <li>
                    <strong>Internacionalización:</strong> atributo <code>lang</code>.
                  </li>
                </ul>
                <p className="muted small">
                  Tip: cuanto más contenido útil sirvas en el HTML inicial (SSR/prerender), mejor
                  te interpretan los crawlers y sube tu score.
                </p>
              </div>
            </Card>

            {/* Buscador */}
            <SearchBar
              url={url}
              setUrl={setUrl}
              loading={loading}
              onSubmit={handleSubmit}
              error={err}
            />

            {/* Mini-FAQ visible para sumar semántica */}
            <Card style={{ ...SEARCH_CARD_STYLE }}>
              <h2 className="section-heading" style={{ marginTop: 0 }}>Preguntas frecuentes</h2>
              <div className="section-divider" />
              <details style={{ marginTop: 8 }}>
                <summary><strong>¿Qué mide el score OAI?</strong></summary>
                <p style={{ marginTop: 6 }}>
                  Combina señales de crawlabilidad, descubribilidad, contenido semántico,
                  robustez de render e i18n. Es un indicador práctico de preparación para IA.
                </p>
              </details>
              <details style={{ marginTop: 8 }}>
                <summary><strong>¿Cómo mejoro rápido?</strong></summary>
                <p style={{ marginTop: 6 }}>
                  Agregá contenido clave en el HTML inicial, sumá JSON-LD (schema.org) y revisá
                  <code> robots.txt</code> y cabeceras para no bloquear bots legítimos.
                </p>
              </details>
              <details style={{ marginTop: 8 }}>
                <summary><strong>¿Necesito cambios de servidor?</strong></summary>
                <p style={{ marginTop: 6 }}>
                  Ayuda habilitar HSTS, una CSP compatible y proteger contra clickjacking. Declarar
                  sitemap y canonical también suma.
                </p>
              </details>
            </Card>
          </div>
        ) : (
          <>
            {/* ======= BUSCADOR (estado con resultados) ======= */}
            <SearchBar url={url} setUrl={setUrl} loading={loading} onSubmit={handleSubmit} top />
            {err && <div className="error-message">Error: {err}</div>}
          </>
        )}

        {/* ======= RESULTADOS ======= */}
        {hasResult && (
          <div ref={reportRef} style={{ display: "grid", gap: 16 }}>
            {/* Estado accesible / bloqueado */}
            <Card
              style={{
                marginTop: 6,
                borderLeft: `4px solid ${data.accessibleForOAI ? "#1b7f4d" : "#b21f2d"}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <strong>
                    {data.accessibleForOAI ? "Accesible para OAI-SearchBot" : "Bloqueado para OAI-SearchBot"}
                  </strong>
                  <div className="muted small" style={{ marginTop: 4, wordBreak: "break-word" }}>
                    URL solicitada: {data.url}
                    {data.finalUrl && data.finalUrl !== data.url ? <> · URL final: {data.finalUrl}</> : null}
                    {typeof data.strict !== "undefined" ? <> · modo estricto: {String(data.strict)}</> : null}
                  </div>
                </div>
                <div className={`score-chip chip-${tone(data.overall!)}`} title="Score OAI">
                  {data.overall}
                </div>
              </div>

              {data.accessibleForOAI === false && (data.blockedReasons?.length || 0) > 0 && (
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  {(data.blockedReasons || []).map((r: string, i: number) => (
                    <li key={i} className="muted">
                      {r}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {/* ========== Fila: Preparación IA + Sugerencias IA ========== */}
            {(data.perModelScores ||
              typeof data.iaReadiness === "number" ||
              (Array.isArray(data.iaHints) && data.iaHints.length > 0)) && (
              <div className="two-col-md">
                {/* Preparación IA */}
                <Card
                  as={motion.div}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div className="section-title">
                    <div className="section-eyebrow">Resultados</div>
                    <h2 className="section-heading">Preparación para IA</h2>
                    <div className="section-divider" />
                    <p className="section-kicker">Qué tan listo está tu sitio (0–100).</p>
                  </div>

                  {typeof data.iaReadiness === "number" && (
                    <div className="score-header" style={{ marginTop: 10 }}>
                      <div className="score-value" style={{ marginBottom: 6 }}>
                        Preparación global:{" "}
                        <span className={`score-chip chip-${tone(data.iaReadiness)}`}>{data.iaReadiness}</span>
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

                  <div style={{ marginTop: 12, display: "grid", gap: 6 }}>
                    {(() => {
                      const scores = (data.perModelScores || {}) as Partial<Record<string, number>>;
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
                              <span className={`score-chip chip-${tone(typeof val === "number" ? val : 0)}`}>
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
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <div className="section-title">
                    <div className="section-eyebrow">Optimización</div>
                    <h2 className="section-heading">Sugerencias para IA</h2>
                    <div className="section-divider" />
                    <p className="section-kicker">Acciones para que los crawlers de IA entiendan mejor tu sitio.</p>
                  </div>

                  <ul style={{ listStyle: "disc", paddingLeft: 18, marginTop: 8, display: "grid", gap: 6 }}>
                    {Array.isArray(data.iaHints) && data.iaHints.length > 0 ? (
                      data.iaHints.map((h: string, i: number) => <li key={i}>{h}</li>)
                    ) : (
                      <li style={{ opacity: 0.7 }}>Sin sugerencias específicas para IA.</li>
                    )}
                  </ul>
                </Card>
              </div>
            )}

            {/* ============= SECCIÓN FINAL EN DOS COLUMNAS ============= */}
            <div className="two-col-md" style={{ marginTop: 4 }}>
              {/* IZQUIERDA: URL + SCORE + BREAKDOWN */}
              <motion.section
                className="score-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.08 }}
              >
                <Card>
                  <div className="score-header">
                    <div className="score-details">
                      <div className="muted" style={{ wordBreak: "break-word" }}>
                        {data.finalUrl || data.url}
                      </div>
                      <div className="score-value" style={{ margin: "6px 0" }}>
                        Score OAI: <span className={`score-chip chip-${tone(data.overall!)}`}>{data.overall}</span>/100
                      </div>
                      <div className="muted">UA: {data.uaTried}</div>
                    </div>
                    <div className="score-bar">
                      <div
                        className={`score-progress progress-${tone(data.overall!)}`}
                        style={{ width: `${data.overall}%` }}
                      />
                    </div>
                  </div>

                  <div className="categories">
                    {(data.breakdown || []).map((b: any, i: number) => (
                      <motion.div
                        key={b.category}
                        className="category-card card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.1 + i * 0.04 }}
                      >
                        <div className="category-header">
                          <h3>{b.category}</h3>
                          <span className={`category-score badge-${tone(b.score)}`}>{b.score}</span>
                        </div>
                        <ul className="category-items">
                          {Object.entries(b.items || {}).map(([k, v]) => {
                            const label = LABELS[k] || k;
                            const normalized =
                              typeof v === "boolean" ? (NEGATIVE_TRUE.has(k) ? !v : v) : v;
                            return (
                              <li key={k} className="category-item">
                                <span>{label}</span>
                                <span>
                                  {typeof normalized === "boolean" ? (normalized ? "✔" : "✖") : String(normalized)}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </motion.div>
                    ))}
                  </div>
                </Card>
              </motion.section>

              {/* DERECHA: Sugerencias por impacto */}
              <motion.aside
                className="extra-section"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.12 }}
              >
                <Card>
                  <div className="section-title">
                    <div className="section-eyebrow">Optimización</div>
                    <h2 className="section-heading">Sugerencias (por impacto)</h2>
                    <div className="section-divider" />
                  </div>
                  <ul className="suggestion-list" style={{ marginTop: 10 }}>
                    {(data.suggestions || []).map((s: any, i: number) => (
                      <motion.li
                        key={s.id || i}
                        className="suggestion-item"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.02 + i * 0.03 }}
                        whileHover={{ x: 4 }}
                        title={s.detail || s.title}
                      >
                        <div>
                          <div style={{ fontWeight: 600 }}>{s.title}</div>
                          {s.detail && <div className="muted small">{s.detail}</div>}
                        </div>
                        <div>
                          {s.impactPts} pts · {s.effort}
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              </motion.aside>
            </div>

            {/* Sugerencias Extras */}
            {(data.extrasSuggestions?.length || 0) > 0 && (
              <Card style={{ marginTop: 16 }}>
                <div className="section-title">
                  <div className="section-eyebrow">Optimización</div>
                  <h2 className="section-heading">Sugerencias Extras</h2>
                  <div className="section-divider" />
                </div>
                <ul style={{ listStyle: "disc", paddingLeft: 18, display: "grid", gap: 6, marginTop: 8 }}>
                  {(data.extrasSuggestions || []).map((s, i) => (
                    <li key={i}>
                      <span style={{ fontWeight: 600 }}>{s.title}</span>
                      {s.detail && <span className="muted"> — {s.detail}</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Gate + botón “Contactanos” (modal) */}
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
                <div>
                  <h3 style={{ margin: 0 }}>¿Querés subir tu puntaje?</h3>
                  <p style={{ margin: "4px 0 0 0" }}>
                    Con una asesoría rápida te ayudamos a implementar las mejoras clave.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-audit"
                  onClick={() => setShowForm(true)}
                  aria-expanded={showForm}
                >
                  Contactanos
                </button>
              </div>
            </Card>

            {/* Modal */}
            <Modal open={showForm} onClose={() => setShowForm(false)} labelledBy="contactanos-title">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                <h3 id="contactanos-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>
                  Contactanos
                </h3>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cerrar
                </button>
              </div>
              <div style={{ marginTop: 12 }}>
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
    </main>
  );
}

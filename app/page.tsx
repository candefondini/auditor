"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import LeadCTA from "./components/LeadCTA";

/* 👇 IMPORTS DE TIPOS PARA FRAMER + REACT */
import type { HTMLAttributes, ElementType } from "react";
import type { MotionProps } from "framer-motion";

// ---------------- Tipos & helpers ----------------
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
const normalizeUrl = (raw: string) => (/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`);

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

// ---------- Modal “Contactanos” (bloquea scroll) ----------
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

// ---- Helper Card (hover) ----
// -> tipado para aceptar props de Motion (initial, animate, transition, whileHover, etc.)
type CardProps = HTMLAttributes<HTMLDivElement> & Partial<MotionProps> & {
  as?: ElementType;
};

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

// ---------------- Componente ----------------
export default function Home() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<AuditResponse>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const hasResult = typeof data.overall === "number" && Array.isArray(data.breakdown) && data.breakdown.length > 0;

  const audit = async () => {
    setLoading(true);
    setErr(null);
    setData({});
    setShowForm(false);

    try {
      const r = await fetch(`/api/audit?url=${encodeURIComponent(normalizeUrl(url))}`);
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
    if (!url || loading) return;
    audit();
  };

  const downloadJSON = () => {
    if (!hasResult) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit-report.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ===== PDF por datos (jsPDF + autotable) — preserva scroll =====
  const downloadPDF = async () => {
    if (!hasResult) return;
    setExporting(true);
    const prevY = window.scrollY;
    try {
      const jsPDFmod = await import("jspdf");
      const JsPDF = (jsPDFmod as any).jsPDF || (jsPDFmod as any).default;

      const autoTableMod = await import("jspdf-autotable");
      const autoTable = (autoTableMod as any).default;

      const doc = new JsPDF({ unit: "pt", format: "a4" });
      const margin = 40;

      const now = new Date();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("IA Friendly — Reporte", margin, 52);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generado: ${now.toLocaleString()}`, margin, 70);

      autoTable(doc, {
        startY: 90,
        head: [["Campo", "Valor"]],
        body: [
          ["URL solicitada", data.url || "-"],
          ["URL final", data.finalUrl || "-"],
          ["UA usada", data.uaTried || "-"],
          ["Accesible para OAI", data.accessibleForOAI ? "Sí" : "No"],
          ["Score OAI", typeof data.overall === "number" ? `${data.overall}/100` : "—"],
          ["Modo estricto", String(data.strict ?? "—")],
        ],
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        theme: "striped",
        margin: { left: margin, right: margin },
      });
      let y = (doc as any).lastAutoTable.finalY + 12;

      if (typeof data.iaReadiness === "number" || data.perModelScores) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Preparación para IA", margin, y);
        y += 6;

        const per = data.perModelScores || {};
        autoTable(doc, {
          startY: y,
          head: [["Métrica", "Valor"]],
          body: [
            ["Preparación global", typeof data.iaReadiness === "number" ? `${data.iaReadiness}/100` : "—"],
            ["ChatGPT", typeof per.chatgpt === "number" ? `${per.chatgpt}/100` : "—"],
            ["Gemini", typeof per.gemini === "number" ? `${per.gemini}/100` : "—"],
            ["Copilot", typeof per.copilot === "number" ? `${per.copilot}/100` : "—"],
            ["Perplexity", typeof per.perplexity === "number" ? `${per.perplexity}/100` : "—"],
            ["Claude", typeof per.claude === "number" ? `${per.claude}/100` : "—"],
          ],
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: [30, 41, 59] },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          theme: "striped",
          margin: { left: margin, right: margin },
          tableWidth: "auto",
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      if (data.accessibleForOAI === false && data.blockedReasons?.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Motivos de bloqueo", margin, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const reasons = data.blockedReasons.map((r: string) => [`• ${r}`]);
        autoTable(doc, {
          startY: y,
          body: reasons,
          styles: { fontSize: 10, cellPadding: 2 },
          theme: "plain",
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Breakdown por categoría", margin, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Categoría", "Score"]],
        body: (data.breakdown || []).map((b: any) => [b.category, String(b.score)]),
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        theme: "striped",
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Checklist de señales", margin, y);
      y += 6;
      const checklist: [string, string][] = [];
      for (const b of data.breakdown || []) {
        for (const [k, v] of Object.entries(b.items || {})) {
          const label = LABELS[k] || `${b.category}: ${k}`;
          const normalized = typeof v === "boolean" ? (NEGATIVE_TRUE.has(k) ? !v : v) : v;
          checklist.push([label, typeof normalized === "boolean" ? (normalized ? "Cumple" : "No cumple") : String(normalized)]);
        }
      }
      autoTable(doc, {
        startY: y,
        head: [["Señal", "Estado"]],
        body: checklist,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 360 } },
        theme: "striped",
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      autoTable(doc, {
        startY: y,
        head: [["Título", "Impacto (pts)", "Esfuerzo", "Detalle"]],
        body: (data.suggestions || []).map((s: any) => [s.title, String(s.impactPts), s.effort, s.detail || ""]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 220 }, 3: { cellWidth: 220 } },
        theme: "striped",
        margin: { left: margin, right: margin },
      });

      doc.save("audit-report.pdf");
    } catch (e) {
      console.error(e);
      alert("No pude generar el PDF. Probá de nuevo.");
    } finally {
      setExporting(false);
      requestAnimationFrame(() =>
        window.scrollTo({ top: prevY, left: 0, behavior: "instant" as any })
      );
    }
  };

  return (
    <main className="main-container" style={{ color: "#fff" }}>
      <motion.header className="header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <div className="header-content">
          <h1 className="title-glitch" data-text="IA Friendly">IA Friendly</h1>
        </div>
      </motion.header>

      <div className="content-container">
        {/* INPUT */}
        <Card style={{ marginTop: 12, marginBottom: 10, padding: 12 }}>
          <form className="input-container" onSubmit={handleSubmit}>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://tu-sitio.com/pagina"
              className="input-url"
              autoFocus
            />
            <button type="submit" disabled={!url || loading} className="btn-audit">
              {loading ? "Auditando..." : "Auditar"}
            </button>
          </form>
        </Card>

        {err && <div className="error-message">Error: {err}</div>}

        {hasResult && (
          <>
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
                    <strong>{data.accessibleForOAI ? "Accesible para OAI-SearchBot" : "Bloqueado para OAI-SearchBot"}</strong>
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
                      <li key={i} className="muted">{r}</li>
                    ))}
                  </ul>
                )}
              </Card>

              {/* ========== Fila: Preparación IA + Sugerencias IA ========== */}
              {(data.perModelScores || typeof data.iaReadiness === "number" || (Array.isArray(data.iaHints) && data.iaHints.length > 0)) && (
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
                          Preparación global: <span className={`score-chip chip-${tone(data.iaReadiness)}`}>{data.iaReadiness}</span>/100
                        </div>
                        <div className="score-bar">
                          <div className={`score-progress progress-${tone(data.iaReadiness)}`} style={{ width: `${data.iaReadiness}%` }} />
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
                          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: 6, fontSize: 14 }}>
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

              {/* ============= SECCIÓN FINAL EN DOS COLUMNAS (mismo ancho) ============= */}
              <div className="two-col-md" style={{ marginTop: 4 }}>
                {/* IZQUIERDA: URL + SCORE + BREAKDOWN */}
                <motion.section className="score-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.08 }}>
                  <Card>
                    <div className="score-header">
                      <div className="score-details">
                        <div className="muted" style={{ wordBreak: "break-word" }}>{data.finalUrl || data.url}</div>
                        <div className="score-value" style={{ margin: "6px 0" }}>
                          Score OAI: <span className={`score-chip chip-${tone(data.overall!)}`}>{data.overall}</span>/100
                        </div>
                        <div className="muted">UA: {data.uaTried}</div>
                      </div>
                      <div className="score-bar">
                        <div className={`score-progress progress-${tone(data.overall!)}`} style={{ width: `${data.overall}%` }} />
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
                              const normalized = typeof v === "boolean" ? (NEGATIVE_TRUE.has(k) ? !v : v) : v;
                              return (
                                <li key={k} className="category-item">
                                  <span>{label}</span>
                                  <span>{typeof normalized === "boolean" ? (normalized ? "✔" : "✖") : String(normalized)}</span>
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
                <motion.aside className="extra-section" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, delay: 0.12 }}>
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

              {/* NUEVA SECCIÓN: Sugerencias Extras (abajo del impacto) */}
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
                  <button type="button" className="btn-audit" onClick={() => setShowForm(true)} aria-expanded={showForm}>
                    Contactanos
                  </button>
                </div>
              </Card>

              {/* Modal del formulario */}
              <Modal open={showForm} onClose={() => setShowForm(false)} labelledBy="contactanos-title">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 10 }}>
                  <h3 id="contactanos-title" style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Contactanos</h3>
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cerrar</button>
                </div>
                <div style={{ marginTop: 12 }}>
                  <LeadCTA score={data.overall!} url={data.finalUrl || data.url!} />
                </div>
              </Modal>

              {/* Botones de exportación */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                style={{
                  display: "flex",
                  gap: 12,
                  justifyContent: "center",
                  marginTop: 4,
                  marginBottom: 8,
                  flexWrap: "wrap",
                }}
              >
                <button type="button" onClick={downloadPDF} className="btn-download" disabled={exporting}>
                  {exporting ? "Generando PDF..." : "Exportar PDF"}
                </button>

                <button type="button" onClick={downloadJSON} className="btn-download">
                  Descargar JSON
                </button>
              </motion.div>
            </div>
          </>
        )}
      </div>

      <footer className="site-footer" aria-label="Pie de página">
        <div className="footer-inner">
          DEVELOPED BY{" "}
          <a href="https://coso.ar" className="brand brand-link" target="_blank" rel="noopener noreferrer" title="Ir a coso.ar">
            COSO
          </a>
        </div>
      </footer>
    </main>
  );
}

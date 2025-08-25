"use client";

import { useState, useRef } from "react";
import { motion } from "framer-motion";
import LeadCTA from "./components/LeadCTA";


// Tipado de la respuesta del endpoint /api/audit
type OaiRes = {
  url: string;
  finalUrl?: string;
  uaTried: string;
  strict?: boolean;
  accessibleForOAI: boolean;
  blockedReasons: string[];
  overall: number;
  breakdown: {
    category: string;
    score: number;
    items: Record<string, any>;
  }[];
  suggestions: {
    id: string;
    title: string;
    impactPts: number;
    effort: "low" | "med" | "high";
    detail?: string;
  }[];
  extras: {
    metaDescription: { present: boolean; length: number; ok: boolean; sample: string };
    aiDirectives: { metaNoAI: boolean; xRobotsNoAI: boolean };
    robotsPerBot: { oai: boolean; gpt: boolean; wildcard: boolean };
    securityHeaders: { hsts: boolean; csp: boolean; clickjackProtected: boolean };
  };
  extrasSuggestions: { title: string; detail?: string }[];
  raw: any;
};

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

export default function Home() {
  const [url, setUrl] = useState("");
  const [data, setData] = useState<OaiRes | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const audit = async () => {
    setLoading(true); setErr(null); setData(null);
    try {
      const r = await fetch(`/api/audit?url=${encodeURIComponent(normalizeUrl(url))}`);
      if (!r.ok) {
        const j = await r.json().catch(() => ({} as any));
        throw new Error(j.error || `No se pudo auditar (HTTP ${r.status}).`);
      }
      setData(await r.json());
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
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit-report.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  // ===== PDF por datos (jsPDF + autotable) =====
  const downloadPDF = async () => {
    if (!data) return;
    setExporting(true);
    try {
      // ✅ compatible con default o named export
const jsPDFmod = await import("jspdf");
const JsPDF = (jsPDFmod as any).jsPDF || (jsPDFmod as any).default;

const autoTableMod = await import("jspdf-autotable");
const autoTable = (autoTableMod as any).default;

const doc = new JsPDF({ unit: "pt", format: "a4" });
      const margin = 40;

      // Header
      const now = new Date();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text("IA Friendly — Reporte", margin, 52);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Generado: ${now.toLocaleString()}`, margin, 70);

      // Resumen principal
      autoTable(doc, {
        startY: 90,
        head: [["Campo", "Valor"]],
        body: [
          ["URL solicitada", data.url],
          ["URL final", data.finalUrl || "-"],
          ["UA usada", data.uaTried],
          ["Accesible para OAI", data.accessibleForOAI ? "Sí" : "No"],
          ["Score OAI", `${data.overall}/100`],
          ["Modo estricto", String(data.strict ?? "—")],
        ],
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        theme: "striped",
        margin: { left: margin, right: margin },
      });
      let y = (doc as any).lastAutoTable.finalY + 12;

      // Si hay bloqueos, listarlos
      if (!data.accessibleForOAI && data.blockedReasons?.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Motivos de bloqueo", margin, y);
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        const reasons = data.blockedReasons.map((r) => [`• ${r}`]);
        autoTable(doc, {
          startY: y,
          body: reasons,
          styles: { fontSize: 10, cellPadding: 2 },
          theme: "plain",
          margin: { left: margin, right: margin },
        });
        y = (doc as any).lastAutoTable.finalY + 12;
      }

      // Breakdown por categoría
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Breakdown por categoría", margin, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Categoría", "Score"]],
        body: data.breakdown.map((b) => [b.category, String(b.score)]),
        styles: { fontSize: 10, cellPadding: 4 },
        headStyles: { fillColor: [30, 41, 59] },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        theme: "striped",
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Checklist de señales (ítems de todas las categorías)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Checklist de señales", margin, y);
      y += 6;

      // Checklist de señales
      const checklist: [string, string][] = [];
      for (const b of data.breakdown) {
        for (const [k, v] of Object.entries(b.items)) {
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

      // Sugerencias
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Sugerencias (por impacto)", margin, y);
      y += 6;
      autoTable(doc, {
        startY: y,
        head: [["Título", "Impacto (pts)", "Esfuerzo", "Detalle"]],
        body: data.suggestions.map((s) => [s.title, String(s.impactPts), s.effort, s.detail || ""]),
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 220 }, 3: { cellWidth: 220 } },
        theme: "striped",
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 12;

      // Extras
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Extras", margin, y);
      y += 6;

      const extrasBody: [string, string][] = [
        ["Meta description", data.extras.metaDescription.present ? `${data.extras.metaDescription.length} chars` : "faltante"],
        ["Meta description OK (50–160)", data.extras.metaDescription.ok ? "Sí" : "No"],
        ["robots oai/gpt/*", `oai:${data.extras.robotsPerBot.oai ? "OK" : "BLOCK"} · gpt:${data.extras.robotsPerBot.gpt ? "OK" : "BLOCK"} · *:${data.extras.robotsPerBot.wildcard ? "OK" : "BLOCK"}`],
        ["AI directives", `meta noAI: ${data.extras.aiDirectives.metaNoAI ? "sí" : "no"} · x-robots noAI: ${data.extras.aiDirectives.xRobotsNoAI ? "sí" : "no"}`],
        ["Seguridad", `HSTS ${data.extras.securityHeaders.hsts ? "✔" : "✖"} · CSP ${data.extras.securityHeaders.csp ? "✔" : "✖"} · Anti-clickjacking ${data.extras.securityHeaders.clickjackProtected ? "✔" : "✖"}`],
      ];

      autoTable(doc, {
        startY: y,
        head: [["Clave", "Valor"]],
        body: extrasBody,
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [30, 41, 59] },
        columnStyles: { 0: { cellWidth: 180 } },
        theme: "striped",
        margin: { left: margin, right: margin },
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      if (data.extrasSuggestions?.length) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Sugerencias extra", margin, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [["Título", "Detalle"]],
          body: data.extrasSuggestions.map((s) => [s.title, s.detail || ""]),
          styles: { fontSize: 9, cellPadding: 3 },
          headStyles: { fillColor: [30, 41, 59] },
          columnStyles: { 0: { cellWidth: 220 }, 1: { cellWidth: 300 } },
          theme: "striped",
          margin: { left: margin, right: margin },
        });
      }

      // Footer con paginación
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(
          `IA Friendly • ${data.finalUrl || data.url}`,
          margin,
          doc.internal.pageSize.getHeight() - 20
        );
        doc.text(
          `Página ${i} de ${pageCount}`,
          doc.internal.pageSize.getWidth() - margin,
          doc.internal.pageSize.getHeight() - 20,
          { align: "right" }
        );
      }

      doc.save("audit-report.pdf");
    } catch (e) {
      console.error(e);
      alert("No pude generar el PDF. Probá de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="main-container">
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

        {err && <div className="error-message">Error: {err}</div>}

        {data && (
          <>
            <div ref={reportRef}>
              <motion.div
                className="card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.05 }}
                style={{
                  marginTop: 16,
                  padding: 14,
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
                  <div className={`score-chip chip-${tone(data.overall)}`} title="Score OAI">
                    {data.overall}
                  </div>
                </div>

                {!data.accessibleForOAI && data.blockedReasons.length > 0 && (
                  <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                    {data.blockedReasons.map((r, i) => (
                      <li key={i} className="muted">
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>

              <div className="grid-container">
                <motion.section
                  className="score-section card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.08 }}
                  whileHover={{ y: -8 }}
                >
                  <div className="score-header">
                    <div className="score-details">
                      <div className="muted" style={{ wordBreak: "break-word" }}>
                        {data.finalUrl || data.url}
                      </div>
                      <div className="score-value">
                        Score OAI: <span className={`score-chip chip-${tone(data.overall)}`}>{data.overall}</span>/100
                      </div>
                      <div className="muted">UA: {data.uaTried}</div>
                    </div>
                    <div className="score-bar">
                      <div
                        className={`score-progress progress-${tone(data.overall)}`}
                        style={{ width: `${data.overall}%` }}
                      />
                    </div>
                  </div>

                  <div className="categories">
                    {data.breakdown.map((b, i) => (
                      <motion.div
                        key={b.category}
                        className="category-card card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.1 + i * 0.04 }}
                        whileHover={{ y: -6 }}
                      >
                        <div className="category-header">
                          <h3>{b.category}</h3>
                          <span className={`category-score badge-${tone(b.score)}`}>{b.score}</span>
                        </div>
                        <ul className="category-items">
                          {Object.entries(b.items).map(([k, v]) => {
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

                  <div className="suggestions">
                    <h3>Sugerencias (por impacto)</h3>
                    <ul className="suggestion-list">
                      {data.suggestions.map((s, i) => (
                        <motion.li
                          key={s.id}
                          className="suggestion-item"
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3, delay: 0.1 + i * 0.03 }}
                          whileHover={{ x: 4 }}
                          title={s.detail || s.title}
                        >
                          <div>
                            <div>{s.title}</div>
                            {s.detail && <div className="muted small">{s.detail}</div>}
                          </div>
                          <div>
                            {s.impactPts} pts · {s.effort}
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  </div>
                </motion.section>

                <motion.aside
                  className="extra-section card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.12 }}
                  whileHover={{ y: -8 }}
                >
                  <div className="extra-header">
                    <h3>Extras</h3>
                  </div>
                  <div className="extra-info">
                    <div className="meta-description">
                      <span>Meta description</span>
                      <span className={`pill ${data.extras.metaDescription.ok ? "pill-ok" : "pill-bad"}`}>
                        {data.extras.metaDescription.present ? `${data.extras.metaDescription.length} chars` : "faltante"}
                      </span>
                    </div>

                    <div className="robots-info">
                      <span>robots.txt por bot</span>
                      <span className={`pill ${data.extras.robotsPerBot.oai ? "pill-ok" : "pill-bad"}`}>
                        {data.extras.robotsPerBot.oai ? "permitido ✔" : "bloqueado ✖"}
                      </span>
                    </div>

                    <div className="security-info">
                      <span>Seguridad</span>
                      <span className="muted small">
                        HSTS {data.extras.securityHeaders.hsts ? "✔" : "✖"} · CSP {data.extras.securityHeaders.csp ? "✔" : "✖"} · Anti-clickjacking{" "}
                        {data.extras.securityHeaders.clickjackProtected ? "✔" : "✖"}
                      </span>
                    </div>
                  </div>

                  {data.extrasSuggestions?.length > 0 && (
                    <div className="extras-suggest card-subtle">
                      <h4 className="muted">Sugerencias extra</h4>
                      <ul className="extras-list">
                        {data.extrasSuggestions.map((s, i) => (
                          <li key={i}>
                            <span className="li-title">{s.title}</span>
                            {s.detail && <span className="muted"> — {s.detail}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.aside>
              </div>
            </div>
            
<div style={{ marginTop: 28, marginBottom: 12 }}>
  <LeadCTA score={data.overall} url={data.finalUrl || data.url} />
</div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.15 }}
              style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24, marginBottom: 8, flexWrap: "wrap" }}
            >
              <button type="button" onClick={downloadPDF} className="btn-download" disabled={exporting}>
                {exporting ? "Generando PDF..." : "Exportar PDF"}
              </button>

              <button type="button" onClick={downloadJSON} className="btn-download">
                Descargar JSON
              </button>
            </motion.div>
          </>
        )}
      </div>
      

      <footer className="site-footer" aria-label="Pie de página">
  <div className="footer-inner">
    DEVELOPED BY{" "}
    <a
      href="https://coso.ar"
      className="brand"
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

"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";

/* ---------- tipos mínimos ---------- */
type PerModel = "chatgpt" | "gemini" | "copilot" | "perplexity" | "claude";
type AuditResponse = {
  url?: string; finalUrl?: string; uaTried?: string; strict?: boolean;
  accessibleForOAI?: boolean; blockedReasons?: string[]; overall?: number;
  iaReadiness?: number; perModelScores?: Partial<Record<PerModel, number>>; iaHints?: string[];
  breakdown?: { category: string; score: number; items: Record<string, any> }[];
  suggestions?: { id: string; title: string; impactPts: number; effort: "low"|"med"|"high"; detail?: string }[];
  extrasSuggestions?: { title: string; detail?: string }[];
  [k: string]: any;
};

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

/* ---------- UI helpers ---------- */
function Card(props: any) {
  return (
    <div
      {...props}
      style={{
        background: "color-mix(in srgb, #ffffff 9%, transparent)",
        color: "#fff",
        borderRadius: 18,
        padding: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05)",
        border: "1px solid color-mix(in srgb, #ffffff 16%, transparent)",
        ...props.style,
      }}
    />
  );
}

/* ================================================ */

export default function ReportePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const u = sp.get("u") || "";

  const [data, setData] = useState<AuditResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!u) return;
      try {
        setLoading(true);
        setErr(null);
        const safeUrl = normalizeUrl(u);
        const r = await fetch(`/api/audit?url=${encodeURIComponent(safeUrl)}`);
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j?.error || `No se pudo auditar (HTTP ${r.status}).`);
        }
        const j = (await r.json()) as AuditResponse;
        setData(j);
      } catch (e: any) {
        setErr(e?.message || "Ocurrió un error.");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [u]);

  const handleBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <main className="main-container" style={{ color: "#fff" }}>
      {/* === Header idéntico al de la home + CTA volver === */}
      <motion.header
        className="header"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
      >
        <div className="header-content">
          <h1 className="title-glitch" data-text="IA Friendly">IA Friendly</h1>
          <button className="btn-secondary" onClick={handleBack} aria-label="Volver a la página principal">
            ← Volver
          </button>
        </div>
      </motion.header>

      <div className="content-container" style={{ maxWidth: 1128, marginInline: "auto" }}>
        {/* Título del reporte, más jerarquía */}
        <div style={{ margin: "14px 0 10px" }}>
          <div className="section-eyebrow">Reporte</div>
          <h2
            className="section-heading"
            style={{
              margin: 0,
              fontSize: "clamp(22px, 3.2vw, 34px)",
              fontWeight: 900,
              letterSpacing: "-0.02em",
            }}
          >
            Informe completo
          </h2>
          <div className="section-divider" />
          <div className="muted" style={{ marginTop: 6, wordBreak: "break-word" }}>
            URL analizada: <strong>{u || "—"}</strong>
          </div>
        </div>

        {loading && <div className="muted">Cargando…</div>}
        {err && <div className="error-message">Error: {err}</div>}
        {!loading && !err && !data && <div className="muted">Sin datos aún.</div>}

        {data && (
          <div style={{ display: "grid", gap: 16 }}>
            {/* ===== Cómo leer este informe ===== */}
            <Card>
              <strong>Cómo leer este informe</strong>
              <ul style={{ margin: "8px 0 0 18px" }}>
                <li>
                  <strong>Preparación para IA</strong>{" "}
                  <span className="chip small" title="Índice técnico por modelo">Índice técnico</span>{" "}
                  : mide tu <em>implementación técnica</em> para que los modelos (ChatGPT, Gemini, Copilot, Perplexity, Claude)
                  puedan leer/entender tu sitio. Se calcula por modelo (0–100).
                </li>
                <li>
                  <strong>Score OAI</strong>{" "}
                  <span className="chip small" title="Puntaje global OAI-SearchBot">Puntaje global</span>{" "}
                  : compatibilidad y señales para el crawler OAI-SearchBot (robots, headers, HTML inicial, canonical, schema, etc.).
                  También 0–100.
                </li>
              </ul>

              {/* En otras palabras (más claro) */}
              <div className="card-subtle" style={{ marginTop: 12 }}>
                <strong>En otras palabras:</strong>
                <ul style={{ margin: "6px 0 0 18px" }}>
                  <li>
                    <b>Preparación IA</b> = <i>Calidad interna</i>. ¿Tu página está
                    estructurada y marcada de forma que los modelos puedan <u>leer</u> y <u>entender</u> el contenido?
                    (HTML, headings, datos estructurados, contenido visible, etc.).
                  </li>
                  <li>
                    <b>Score OAI</b> = <i>Descubribilidad externa</i>. ¿El bot de OpenAI puede <u>llegar</u> e
                    <u>indexar</u> tu página sin trabas? (robots, x-robots, sitemap, canonical, seguridad, soft-404…).
                  </li>
                </ul>
              </div>
            </Card>

            {/* ===== Accesibilidad + Score OAI ===== */}
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
                <div className="score-value" title="Puntaje global OAI-SearchBot" style={{ whiteSpace: "nowrap" }}>
                  Score OAI <span className="chip small">Puntaje global</span>{" "}
                  : <span className={`score-chip chip-${tone(data.overall!)}`}>{data.overall}</span>/100
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

            {/* ===== Dos columnas: breakdown + sugerencias ===== */}
            <div className="two-col-md" style={{ marginTop: 4 }}>
              {/* IZQ: Detalle + barras */}
              <motion.section
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
                        Score OAI <span className="chip small">Puntaje global</span>{" "}
                        : <span className={`score-chip chip-${tone(data.overall!)}`}>{data.overall}</span>/100
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

              {/* DER: Sugerencias por impacto */}
              <motion.aside
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
                        <div>{s.impactPts} pts · {s.effort}</div>
                      </motion.li>
                    ))}
                  </ul>
                </Card>
              </motion.aside>
            </div>

            {/* ===== Extras ===== */}
            {(data.extrasSuggestions?.length || 0) > 0 && (
              <Card style={{ marginTop: 16 }}>
                <div className="section-title">
                  <div className="section-eyebrow">Optimización</div>
                  <h2 className="section-heading">Sugerencias Extras</h2>
                  <div className="section-divider" />
                </div>
                <ul
                  style={{ listStyle: "disc", paddingLeft: 18, display: "grid", gap: 6, marginTop: 8 }}
                >
                  {(data.extrasSuggestions || []).map((s, i) => (
                    <li key={i}>
                      <span style={{ fontWeight: 600 }}>{s.title}</span>
                      {s.detail && <span className="muted"> — {s.detail}</span>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* ===== Botón Volver al final ===== */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn-audit" style={{ marginTop: 20 }} onClick={handleBack}>
                ← Volver
              </button>
            </div>
          </div>
        )}

        {/* Chips pequeñas (por si este archivo se usa standalone) */}
        <style jsx global>{`
          .chip.small{
            display:inline-block;
            padding:2px 6px;
            border-radius:999px;
            font-size:10px;
            font-weight:700;
            background:rgba(255,255,255,.08);
            border:1px solid rgba(255,255,255,.18);
            margin: 0 6px;        /* espacio simétrico a ambos lados */
            vertical-align:middle;
          }
        `}</style>
      </div>

      {/* Footer igual al de la home */}
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

// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://prompte.ar"),
  title: { default: "IA Friendly", template: "%s | prompte.ar" },
  // ⬇️ description 50–160 chars para cerrar el warning del auditor
  description:
    "Auditá si tu sitio es accesible para crawlers de IA (OAI-SearchBot, gptbot). Obtené score, sugerencias técnicas, schema y mejoras SEO.",
  applicationName: "prompte.ar",
  keywords: ["accesibilidad", "SEO", "auditor", "OAI", "prompte", "coso"],
  authors: [{ name: "Coso", url: "https://coso.ar" }],
  creator: "Coso",
  publisher: "Coso",
  alternates: { canonical: "/", languages: { "es-AR": "/" } },
  openGraph: {
    type: "website",
    url: "https://prompte.ar",
    siteName: "prompte.ar",
    title: "IA Friendly",
    // ⬇️ misma descripción que la principal
    description:
      "Auditá si tu sitio es accesible para crawlers de IA (OAI-SearchBot, gptbot). Obtené score, sugerencias técnicas, schema y mejoras SEO.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "IA Friendly" }],
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title: "IA Friendly",
    // ⬇️ misma descripción que la principal
    description:
      "Auditá si tu sitio es accesible para crawlers de IA (OAI-SearchBot, gptbot). Obtené score, sugerencias técnicas, schema y mejoras SEO.",
    images: ["/og.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.ico", rel: "shortcut icon" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  category: "technology",
  referrer: "strict-origin-when-cross-origin",
  formatDetection: { email: false, address: false, telephone: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const GTM_ID = "GTM-K5X5H8QK";

  return (
    <html lang="es">
      {/* GTM script (in head) */}
      <Script id="gtm-base" strategy="afterInteractive">
        {`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `}
      </Script>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* GTM noscript (justo al abrir body) */}
        <noscript
          dangerouslySetInnerHTML={{
            __html: `
              <iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_ID}"
                      height="0" width="0"
                      style="display:none;visibility:hidden"></iframe>
            `,
          }}
        />

        {children}

        {/* Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Coso",
              url: "https://coso.ar",
              logo: "https://prompte.ar/og.png",
              sameAs: [],
            }),
          }}
        />

        {/* WebApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "IA Friendly",
              url: "https://prompte.ar",
              applicationCategory: "DeveloperApplication",
              operatingSystem: "All",
            }),
          }}
        />

        {/* ⬇️ FAQPage: sube FAQ/HowTo y ayuda al contenido semántico */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "¿Qué mide el score OAI?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text:
                      "Evalúa crawlabilidad, descubribilidad, contenido semántico, robustez de renderizado e internacionalización. Cuanto más alto, mejor preparado está tu sitio para crawlers de IA.",
                  },
                },
                {
                  "@type": "Question",
                  name: "¿Cómo puedo mejorar mi puntaje?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text:
                      "Sumá contenido útil en el HTML inicial (SSR/prerender), agregá datos estructurados en JSON-LD, optimizá metadatos y evitá bloqueos en robots.txt y cabeceras.",
                  },
                },
                {
                  "@type": "Question",
                  name: "¿Requiere cambios de servidor?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text:
                      "Ayuda activar HSTS, una política CSP compatible y protección contra clickjacking. También conviene declarar sitemap, canonical y mantener robots.txt abierto.",
                  },
                },
              ],
            }),
          }}
        />
      </body>
    </html>
  );
}

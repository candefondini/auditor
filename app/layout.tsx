// app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://promte.ar"),
  title: { default: "IA Friendly", template: "%s | promte.ar" },
  description: "Auditoría de accesibilidad para OAI-SearchBot.",
  applicationName: "promte.ar",
  keywords: ["accesibilidad", "SEO", "auditor", "OAI", "promte", "coso"],
  authors: [{ name: "Coso", url: "https://coso.ar" }],
  creator: "Coso",
  publisher: "Coso",
  alternates: { canonical: "/", languages: { "es-AR": "/" } },
  openGraph: {
    type: "website",
    url: "https://promte.ar",
    siteName: "promte.ar",
    title: "IA Friendly",
    description: "Auditoría de accesibilidad para OAI-SearchBot.",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "IA Friendly" }],
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title: "IA Friendly",
    description: "Auditoría de accesibilidad para OAI-SearchBot.",
    images: ["/og.png"],
  },
  robots: {
    index: true, follow: true,
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
  return (
    <html lang="es">
      {/* ===== GTM: script en <head> ===== */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start': new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0], j=d.createElement(s), dl=l!='dataLayer'?'&l='+l:'';
j.async=true; j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl; f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-K5X5H8QK');
            `.trim(),
          }}
        />
      </head>

      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* ===== GTM: noscript iframe apenas abre <body> ===== */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-K5X5H8QK"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>

        {children}

        {/* Datos estructurados Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Coso",
              url: "https://coso.ar",
              logo: "https://promte.ar/og.png",
              sameAs: [],
            }),
          }}
        />

        {/* Datos estructurados WebApplication */}
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
      </body>
    </html>
  );
}

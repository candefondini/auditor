import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a", // cambia si usás otro color primario
};

export const metadata: Metadata = {
  metadataBase: new URL("https://promte.ar"), // <-- ajustá dominio final
  title: {
    default: "OAI Accessibility Auditor",
    template: "%s | promte.ar",
  },
  description: "Auditoría de accesibilidad para OAI-SearchBot.",
  applicationName: "promte.ar",
  keywords: ["accesibilidad", "SEO", "auditor", "OAI", "promte", "coso"],
  authors: [{ name: "Coso", url: "https://coso.ar" }],
  creator: "Coso",
  publisher: "Coso",
  alternates: {
    canonical: "/",
    languages: { "es-AR": "/" },
  },
  openGraph: {
    type: "website",
    url: "https://promte.ar",
    siteName: "promte.ar",
    title: "OAI Accessibility Auditor",
    description: "Auditoría de accesibilidad para OAI-SearchBot.",
    images: [
      {
        url: "/og.png", // poné og.png en /public (1200x630 recomendado)
        width: 1200,
        height: 630,
        alt: "OAI Accessibility Auditor",
      },
    ],
    locale: "es_AR",
  },
  twitter: {
    card: "summary_large_image",
    title: "OAI Accessibility Auditor",
    description: "Auditoría de accesibilidad para OAI-SearchBot.",
    images: ["/og.png"],
    // site: "@tuCuenta", creator: "@tuCuenta" // opcional
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
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
  // verification: { google: "CODIGO_DE_VERIFICACION" }, // si usás Search Console
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {/* Datos estructurados Organization */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "Coso",
      "url": "https://coso.ar",
      "logo": "https://promte.ar/og.png",
      "sameAs": []
    })
  }}
/>

{/* Datos estructurados WebApplication */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "OAI Accessibility Auditor",
      "url": "https://promte.ar",
      "applicationCategory": "DeveloperApplication",
      "operatingSystem": "All"
    })
  }}
/>

      </body>
    </html>
  );
}

// src/app/layout.jsx
import 'bootstrap/dist/css/bootstrap.min.css';
import BootstrapClient from '@/components/BootstrapClient.jsx';

export const metadata = {
  title: "Nombre del Sitio",
  description: "Descripción breve del sitio o negocio.",
  keywords: ["sitio web", "empresa", "servicios"],
  authors: [{ name: "Tu Nombre o Empresa" }],
  metadataBase: new URL("https://art-xi-six.vercel.app/"),
  openGraph: {
    title: "Nombre del Sitio",
    description: "Descripción breve del sitio o negocio.",
    url: "https://art-xi-six.vercel.app/",
    siteName: "Nombre del Sitio",
    images: [
      {
        url: "/logo.png",
        width: 1200,
        height: 630,
        alt: "Nombre del Sitio",
      },
    ],
    locale: "es_AR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Nombre del Sitio",
    description: "Descripción breve del sitio o negocio.",
    images: ["/logo.png"],
    creator: "@juanmatoniolo",
  },
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  manifest: "/manifest.json",
  themeColor: "#ffffff",
  viewport:
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
  robots: {
    index: true,
    follow: true,
  },

};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body suppressHydrationWarning={true}>
        <BootstrapClient />
        {children}
      </body>
    </html>
  );
}
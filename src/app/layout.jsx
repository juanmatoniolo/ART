// src/app/layout.jsx
import 'bootstrap/dist/css/bootstrap.min.css';
import BootstrapClient from '@/components/BootstrapClient.jsx';

// ✅ METADATA SEO (compatible con Next.js 14+)
export const metadata = {
  title: {
    default: "Clínica de la Unión S.A. | Sistema Médico Interno",
    template: "%s | Clínica de la Unión S.A.",
  },
  description:
    "Sistema de gestión médica integral de la Clínica de la Unión S.A. — Administración de pacientes, empleados, nomencladores y facturación médica en un entorno seguro y moderno.",
  keywords: [
    "Clínica de la Unión",
    "gestión médica",
    "sistema clínico",
    "turnos médicos",
    "facturación médica",
    "nomencladores nacionales",
    "AOTER",
    "bioquímica",
  ],
  authors: [{ name: "Clínica de la Unión S.A." }],
  creator: "Clínica de la Unión S.A.",
  publisher: "Clínica de la Unión S.A.",
  metadataBase: new URL("https://clinica-union.vercel.app/"),

  openGraph: {
    title: "Clínica de la Unión S.A. | Sistema Médico Interno",
    description:
      "Sistema administrativo interno de la Clínica de la Unión S.A. con herramientas para gestión de pacientes, empleados y facturación médica.",
    url: "https://clinica-union.vercel.app/",
    siteName: "Clínica de la Unión S.A.",
    images: [
      {
        url: "/assets/Clinica-Union-SA.png",
        width: 1200,
        height: 630,
        alt: "Clínica de la Unión S.A. - Logo institucional",
      },
    ],
    locale: "es_AR",
    type: "website",
  },

  twitter: {
    card: "summary_large_image",
    title: "Clínica de la Unión S.A.",
    description:
      "Plataforma administrativa interna para la gestión médica y administrativa de la Clínica de la Unión S.A.",
    images: ["/assets/Clinica-Union-SA.png"],
    creator: "@clinicaunion",
  },

  icons: {
    icon: "/assets/Clinica-Union-SA.png",
    shortcut: "/assets/Clinica-Union-SA.png",
    apple: "/assets/Clinica-Union-SA.png",
  },

  manifest: "/manifest.json",

  // 🧠 Seguridad SEO: no indexar el panel administrativo
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

// ✅ CONFIGURACIÓN DE VIEWPORT (separada)
export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f3d26", // Verde institucional médico
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

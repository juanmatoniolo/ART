import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { SessionProvider } from '@/context/SessionContext';

// 👇 Fuente principal — sans-serif moderna, excelente legibilidad
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  // Si querés usar la versión variable (recomendado), no pongas "weight"
});

// 👇 Fuente monoespaciada — para códigos (prácticas, labs, DNI, matrículas)
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://art-xi-six.vercel.app';

export const metadata = {
  title: {
    default: 'Clínica de la Unión S.A. | Sistema Médico Interno',
    template: '%s | Clínica de la Unión S.A.',
  },
  description:
    'Sistema de gestión médica integral de la Clínica de la Unión S.A. — Administración de pacientes, empleados, nomencladores y facturación médica en un entorno seguro y moderno.',
  keywords: [
    'Clínica de la Unión',
    'gestión médica',
    'sistema clínico',
    'turnos médicos',
    'facturación médica',
    'nomencladores nacionales',
    'AOTER',
    'bioquímica',
  ],
  authors: [{ name: 'Clínica de la Unión S.A.' }],
  creator: 'Clínica de la Unión S.A.',
  publisher: 'Clínica de la Unión S.A.',
  metadataBase: new URL(baseUrl),
  openGraph: {
    title: 'Clínica de la Unión S.A. | Sistema Médico Interno',
    description:
      'Sistema administrativo interno de la Clínica de la Unión S.A. con herramientas para gestión de pacientes, empleados y facturación médica.',
    url: baseUrl,
    siteName: 'Clínica de la Unión S.A.',
    images: [
      {
        url: '/logo.jpg',
        width: 1200,
        height: 630,
        alt: 'Clínica de la Unión S.A. - Logo institucional',
      },
    ],
    locale: 'es_AR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Clínica de la Unión S.A.',
    description:
      'Plataforma administrativa interna para la gestión médica y administrativa de la Clínica de la Unión S.A.',
    images: ['/logo.jpg'],
    creator: '@clinicaunion',
  },
  icons: {
    icon: '/logo.jpg',
    shortcut: '/logo.jpg',
    apple: '/logo.jpg',
  },
  manifest: '/manifest.json',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f3d26',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="bg-bg text-text antialiased" suppressHydrationWarning>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
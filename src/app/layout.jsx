// src/app/layout.jsx
import BootstrapClient from '@/components/BootstrapClient.jsx';

export const metadata = {
  title: 'Clínica de la Unión',
  description: 'Sistema de gestión médica',
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
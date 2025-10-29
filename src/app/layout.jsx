// src/app/layout.jsx
import 'bootstrap/dist/css/bootstrap.min.css';
import BootstrapClient from '@/components/BootstrapClient.jsx';

export const metadata = {
  title: 'Clínica de la Unión',
  description: 'Sistema de gestión médica',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <BootstrapClient />
        {children}
      </body>
    </html>
  );
}
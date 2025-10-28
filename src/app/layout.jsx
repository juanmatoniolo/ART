// app/layout.jsx

import 'bootstrap/dist/css/bootstrap.min.css';
import BootstrapClient from '@/components/Boostrap/BootstrapClient';
import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: "Clínica de la Unión S.A.",
  description: "Sistema de gestión médica y facturación"
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body suppressHydrationWarning={true}>
        <BootstrapClient />
        <nav className="navbar navbar-expand-lg navbar-dark px-3">
          <div className="container-fluid">
            <Link className="navbar-brand" href="/">Clínica de la Unión S.A.</Link>
            <div className="collapse navbar-collapse justify-content-end">
              <ul className="navbar-nav mb-2 mb-lg-0">
                <li className="nav-item">
                  <Link className="nav-link" href="/Nomeclador-Nacional">Nomeclador Nacional</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" href="/AOTER">AOTER</Link>
                </li>    <li className="nav-item">
                  <Link className="nav-link" href="/Bioquimica">Bioquimica</Link>
                </li>
                <li className="nav-item">
                  <Link className="nav-link" href="/Facturacion">Facturación</Link>
                </li>
              </ul>
            </div>
          </div>
        </nav>
        <main className="container py-4">
          {children}
        </main>
      </body>
    </html>
  );
}
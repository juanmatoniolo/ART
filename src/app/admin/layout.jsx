// src/app/admin/layout.jsx
'use client';

import BootstrapClient from '@/components/BootstrapClient';
import '@/app/globals.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearSession } from '@/utils/session';
import styles from './page.module.css';


export default function AdminLayout({ children }) {
  const router = useRouter();

  const cerrarSesion = () => {
    clearSession();
    router.push('/login');
  };

  return (
    <>
      <BootstrapClient />

      {/* ✅ NAVBAR RESPONSIVE */}
      <nav className={`navbar navbar-expand-lg navbar-dark bg-success shadow-sm sticky-top ${styles.navbar}`}>
        <div className="container-fluid px-3">
          <Link className={`navbar-brand fw-bold text-light ${styles.brand}`} href="/admin">
            Clínica de la Unión S.A.
          </Link>

          <button
            className="navbar-toggler border-0"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <div className="collapse navbar-collapse justify-content-end" id="navbarNav">
            <ul className="navbar-nav mb-2 mb-lg-0 text-center">
              <li className="nav-item">
                <Link className={`nav-link px-3 ${styles.navLink}`} href="/admin/Nomeclador-Nacional">
                  Nomeclador Nacional
                </Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link px-3 ${styles.navLink}`} href="/admin/AOTER">
                  AOTER
                </Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link px-3 ${styles.navLink}`} href="/admin/Bioquimica">
                  Bioquímica
                </Link>
              </li>
              <li className="nav-item">
                <Link className={`nav-link px-3 ${styles.navLink}`} href="/admin/Facturacion">
                  Facturación
                </Link>
              </li>
              <li className="nav-item">
                <button className="btn btn-outline-light ms-lg-3 mt-2 mt-lg-0" onClick={cerrarSesion}>
                  🚪 Cerrar sesión
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* ✅ CONTENIDO PRINCIPAL */}
      <main className={`container-fluid p-3 p-md-4 ${styles.main}`}>
        <div className={`rounded-4 shadow-sm bg-white p-3 p-md-4 ${styles.content}`}>
          {children}
        </div>
      </main>

      {/* ✅ FOOTER SIMPLE */}
      <footer className={`text-center py-3 text-muted small ${styles.footer}`}>
        © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
      </footer>
    </>
  );
}
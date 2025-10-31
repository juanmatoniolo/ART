'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import BootstrapClient from '@/components/BootstrapClient';
import '@/app/globals.css';
import { clearSession, getSession } from '@/utils/session';
import styles from './page.module.css';
import Head from 'next/head';

import {
  Home,
  Users,
  Briefcase,
  FileText,
  Library,
  FileSpreadsheet,
  FileSignature,
  Beaker,
  LogOut,
  UserCircle,
  Settings,
} from 'lucide-react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState({ name: 'Usuario', role: 'admin' });

  useEffect(() => {
    const s = getSession?.();
    if (s?.user) {
      setUser({
        name: s.user.displayName || s.user.email || 'Usuario',
        role: s.user.role || 'admin',
      });
    }
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const cerrarSesion = () => {
    clearSession();
    router.push('/login');
  };

  const isActive = (href) => pathname?.startsWith(href);

  return (
    <>
      <BootstrapClient />
      <Head>
        <meta name="robots" content="noindex,nofollow" />
        <title>Panel Administrativo | Clínica de la Unión S.A.</title>
      </Head>

      {/* === NAVBAR === */}
      <nav className={`navbar navbar-expand-lg shadow-sm sticky-top ${styles.navbar}`}>
        <div className="container-fluid gap-2">
          <button
            className="btn btn-success d-lg-none"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#adminSidebar"
            aria-controls="adminSidebar"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          <Link href="/admin" className="navbar-brand d-flex align-items-center gap-2 text-light">
            <Image
              src="/logo.png"
              alt="Clínica de la Unión S.A."
              width={42}
              height={42}
              className="rounded-2"
              priority
            />
            <span className="fw-semibold">Clínica de la Unión S.A.</span>
          </Link>

          <div className="dropdown ms-auto">
            <button
              className="btn btn-outline-light btn-sm dropdown-toggle d-flex align-items-center gap-2"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <div className={`${styles.avatar} text-uppercase`}>
                {(user.name || 'U').slice(0, 2)}
              </div>
              <div className="text-start d-none d-sm-block">
                <div className="small fw-semibold">{user.name}</div>
                <div className="small opacity-75">{user.role}</div>
              </div>
            </button>
            <ul className="dropdown-menu dropdown-menu-end shadow">
              <li>
                <Link className="dropdown-item d-flex align-items-center gap-2" href="/admin/perfil">
                  <UserCircle size={16} /> Perfil
                </Link>
              </li>
              <li>
                <Link className="dropdown-item d-flex align-items-center gap-2" href="/admin/configuracion">
                  <Settings size={16} /> Configuración
                </Link>
              </li>
              <li><hr className="dropdown-divider" /></li>
              <li>
                <button className="dropdown-item text-danger d-flex align-items-center gap-2" onClick={cerrarSesion}>
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* === SIDEBAR === */}
      <div className="container-fluid">
        <div className="row">
          <aside className={`d-none d-lg-block col-lg-3 col-xl-2 ${styles.aside}`}>
            <div className="sticky-top" style={{ top: '72px' }}>
              <nav className={`list-group list-group-flush ${styles.sidebar}`}>
                <Link
                  href="/admin"
                  className={`list-group-item d-flex align-items-center gap-2 ${isActive('/admin') ? styles.active : ''}`}
                >
                  <Home size={18} /> Dashboard
                </Link>

                {/* === SECCIÓN GESTIÓN === */}
                <div className={styles.sectionTitle}>Gestión</div>
                <Link
                  href="/admin/pacientes"
                  className={`${styles.menuButton} d-flex align-items-center gap-2 ${isActive('/admin/pacientes') ? styles.active : ''}`}
                >
                  <Users size={18} /> Pacientes
                </Link>
                <Link
                  href="/admin/empleados"
                  className={`${styles.menuButton} d-flex align-items-center gap-2 ${isActive('/admin/empleados') ? styles.active : ''}`}
                >
                  <Briefcase size={18} /> Empleados
                </Link>
                <Link
                  href="/admin/facturacion"
                  className={`${styles.menuButton} d-flex align-items-center gap-2 ${isActive('/admin/facturacion') ? styles.active : ''}`}
                >
                  <FileText size={18} /> Generador de facturas
                </Link>

                {/* === SECCIÓN NOMENCLADORES === */}
                <div className={styles.sectionTitle}>Nomencladores</div>
                <Link
                  href="/admin/nomencladores"
                  className={`list-group-item d-flex align-items-center gap-2 ${isActive('/admin/nomencladores') ? styles.active : ''}`}
                >
                  <Library size={18} /> Unificado
                </Link>

                <div className="d-grid gap-1 p-3 pt-2">
                  <Link href="/admin/nomencladores/nacional" className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center gap-1">
                    <FileSpreadsheet size={16} /> Nacional
                  </Link>
                  <Link href="/admin/nomencladores/aoter" className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center gap-1">
                    <FileSignature size={16} /> AOTER
                  </Link>
                  <Link href="/admin/nomencladores/bioquimica" className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center gap-1">
                    <Beaker size={16} /> Bioquímica
                  </Link>
                  <Link href="/admin/nomencladores/convenios" className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center gap-1">
                    <FileText size={16} /> Convenios ART
                  </Link>
                </div>
              </nav>
            </div>
          </aside>

          {/* === CONTENIDO PRINCIPAL === */}
          <main className={`col-12 col-lg-9 col-xl-10 p-3 p-md-4 ${styles.main}`}>
            <div className={`rounded-4 shadow-sm ${styles.content}`}>
              {children}
            </div>
            <footer className={`text-center py-3 small ${styles.footer}`}>
              © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
            </footer>
          </main>
        </div>
      </div>
    </>
  );
}

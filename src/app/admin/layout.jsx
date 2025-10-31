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

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState({ name: 'Usuario', role: 'admin' });
  const [query, setQuery] = useState('');
  const [theme, setTheme] = useState('dark'); // por defecto oscuro

  useEffect(() => {
    const s = getSession?.();
    if (s?.user) {
      setUser({
        name: s.user.displayName || s.user.email || 'Usuario',
        role: s.user.role || 'admin',
      });
    }
  }, []);

  // Cargar tema desde localStorage o sistema
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark =
      window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;

    const currentTheme = savedTheme || (prefersDark ? 'dark' : 'light');
    setTheme(currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, []);

  // Cambiar tema y guardar
  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const cerrarSesion = () => {
    clearSession();
    router.push('/login');
  };

  const onSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/admin/buscar?q=${encodeURIComponent(q)}`);
  };

  const isActive = (href) => pathname?.startsWith(href);

  return (
    <>
      <BootstrapClient />
      <Head>
        <meta name="robots" content="noindex,nofollow" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Panel Administrativo | Clínica de la Unión S.A.</title>
      </Head>

      {/* ==== NAVBAR ==== */}
      <nav className={`navbar navbar-expand-lg shadow-sm sticky-top ${styles.navbar}`}>
        <div className="container-fluid gap-2">
          {/* Menu toggler móvil */}
          <button
            className="btn btn-success d-lg-none"
            type="button"
            data-bs-toggle="offcanvas"
            data-bs-target="#adminSidebar"
            aria-controls="adminSidebar"
            aria-label="Abrir menú"
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Marca */}
          <Link href="/admin" className="navbar-brand d-flex align-items-center gap-2">
            <Image
              src="/assets/Clinica-Union-SA.png"
              alt="Clínica de la Unión S.A."
              width={32}
              height={32}
              className="rounded-2"
              priority
            />
            <span className="fw-semibold">Clínica de la Unión S.A.</span>
          </Link>

          {/* Buscador desktop */}
          <form className="d-none d-md-flex ms-auto me-3" role="search" onSubmit={onSearch}>
            <input
              className="form-control form-control-sm"
              type="search"
              placeholder="Buscar pacientes, empleados o nomencladores…"
              aria-label="Buscar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>

          {/* Toggle de tema 🌙 / ☀️ */}
          <button
            className="btn btn-outline-light btn-sm me-2"
            onClick={toggleTheme}
            aria-label="Cambiar tema"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          {/* Menú usuario */}
          <div className="dropdown">
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
              <li><Link className="dropdown-item" href="/admin/perfil">Perfil</Link></li>
              <li><Link className="dropdown-item" href="/admin/configuracion">Configuración</Link></li>
              <li><hr className="dropdown-divider" /></li>
              <li><button className="dropdown-item text-danger" onClick={cerrarSesion}>Cerrar sesión</button></li>
            </ul>
          </div>
        </div>

        {/* Buscador móvil */}
        <div className="container-fluid d-md-none p-2 pt-0">
          <form role="search" onSubmit={onSearch}>
            <input
              className="form-control form-control-sm"
              type="search"
              placeholder="Buscar…"
              aria-label="Buscar"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </form>
        </div>
      </nav>

      {/* ==== SIDEBAR OFFCANVAS (MÓVIL) ==== */}
      <div
        className={`offcanvas offcanvas-start text-light ${styles.sidebarOffcanvas}`}
        tabIndex="-1"
        id="adminSidebar"
        aria-labelledby="adminSidebarLabel"
      >
        <div className="offcanvas-header border-bottom border-secondary">
          <h5 className="offcanvas-title" id="adminSidebarLabel">Panel administrador</h5>
          <button type="button" className="btn-close btn-close-white" data-bs-dismiss="offcanvas" aria-label="Cerrar"></button>
        </div>
        <div className="offcanvas-body p-0">
          <nav className={`list-group list-group-flush ${styles.sidebar}`}>
            <Link className={`list-group-item list-group-item-action ${isActive('/admin') ? styles.active : ''}`} href="/admin">🏠 Dashboard</Link>

            <div className="list-group-item bg-transparent fw-semibold small text-uppercase opacity-75">Gestión</div>
            <Link className={`list-group-item list-group-item-action ${isActive('/admin/pacientes') ? styles.active : ''}`} href="/admin/pacientes">👨‍⚕️ Pacientes</Link>
            <Link className={`list-group-item list-group-item-action ${isActive('/admin/empleados') ? styles.active : ''}`} href="/admin/empleados">🧑‍💼 Empleados</Link>
            <Link className={`list-group-item list-group-item-action ${isActive('/admin/facturacion') ? styles.active : ''}`} href="/admin/facturacion">🧾 Facturación</Link>

            <div className="list-group-item bg-transparent fw-semibold small text-uppercase opacity-75">Nomencladores</div>
            <Link className={`list-group-item list-group-item-action ${isActive('/admin/nomencladores') ? styles.active : ''}`} href="/admin/nomencladores">📚 Unificado</Link>

            <div className="d-grid gap-1 p-3 pt-2">
              <Link href="/admin/nomencladores/nacional" className="btn btn-outline-light btn-sm">Nacional</Link>
              <Link href="/admin/nomencladores/aoter" className="btn btn-outline-light btn-sm">AOTER</Link>
              <Link href="/admin/nomencladores/bioquimica" className="btn btn-outline-light btn-sm">Bioquímica</Link>
              <Link href="/admin/nomencladores/convenios" className="btn btn-outline-light btn-sm">Convenios ART</Link>
            </div>
          </nav>
        </div>
      </div>

      {/* ==== LAYOUT GENERAL ==== */}
      <div className="container-fluid">
        <div className="row">
          <aside className={`d-none d-lg-block col-lg-3 col-xl-2 ${styles.aside}`}>
            <div className="sticky-top" style={{ top: '72px' }}>
              <nav className={`list-group list-group-flush ${styles.sidebar}`}>
                <Link className={`list-group-item list-group-item-action ${isActive('/admin') ? styles.active : ''}`} href="/admin">🏠 Dashboard</Link>
                <div className="list-group-item bg-transparent fw-semibold small text-uppercase opacity-75">Gestión</div>
                <Link className={`list-group-item list-group-item-action ${isActive('/admin/pacientes') ? styles.active : ''}`} href="/admin/pacientes">👨‍⚕️ Pacientes</Link>
                <Link className={`list-group-item list-group-item-action ${isActive('/admin/empleados') ? styles.active : ''}`} href="/admin/empleados">🧑‍💼 Empleados</Link>
                <Link className={`list-group-item list-group-item-action ${isActive('/admin/facturacion') ? styles.active : ''}`} href="/admin/facturacion">🧾 Generador de facturas</Link>
                <div className="list-group-item bg-transparent fw-semibold small text-uppercase opacity-75">Nomencladores</div>
                <Link className={`list-group-item list-group-item-action ${isActive('/admin/nomencladores') ? styles.active : ''}`} href="/admin/nomencladores">📚 Unificado</Link>
                <div className="d-grid gap-1 p-3 pt-2">
                  <Link href="/admin/nomencladores/nacional" className="btn btn-outline-light btn-sm">Nacional</Link>
                  <Link href="/admin/nomencladores/aoter" className="btn btn-outline-light btn-sm">AOTER</Link>
                  <Link href="/admin/nomencladores/bioquimica" className="btn btn-outline-light btn-sm">Bioquímica</Link>
                  <Link href="/admin/nomencladores/convenios" className="btn btn-outline-light btn-sm">Convenios ART</Link>
                </div>
              </nav>
            </div>
          </aside>

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

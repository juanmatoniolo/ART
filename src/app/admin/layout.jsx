'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import '@/app/globals.css';
import styles from './page.module.css';
import { clearSession, getSession } from '@/utils/session';

import {
  Users,
  Briefcase,
  FileText,
  Library,
  Handshake,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const s = getSession?.();
    if (!s) return;
    document.documentElement.setAttribute('data-theme', 'dark');
  }, []);

  const cerrarSesion = () => {
    clearSession();
    router.push('/login');
  };

const isActive = (href) => {
  // Evita activar el padre si la ruta tiene más profundidad
  return pathname === href;
};


  return (
    <div className={styles.layout}>
      {/* === SIDEBAR === */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <Image src="/logo.png" alt="Logo" width={42} height={42} className="rounded-2" />
          {!collapsed && <span className={styles.brand}>Clínica Unión</span>}
        </div>

        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label="Colapsar menú"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <nav className={styles.navMenu}>
          <Link
            href="/admin/pacientes"
            className={`${styles.menuItem} ${isActive('/admin/pacientes') ? styles.active : ''}`}
          >
            <Users size={20} />
            {!collapsed && <span>Pacientes</span>}
          </Link>

          <Link
            href="/admin/empleados"
            className={`${styles.menuItem} ${isActive('/admin/empleados') ? styles.active : ''}`}
          >
            <Briefcase size={20} />
            {!collapsed && <span>Empleados</span>}
          </Link>

          <Link
            href="/admin/Facturacion"
            className={`${styles.menuItem} ${isActive('/admin/Facturacion') ? styles.active : ''}`}
          >
            <FileText size={20} />
            {!collapsed && <span>Facturación</span>}
          </Link>

          <div className={styles.sectionTitle}>{!collapsed && 'Nomencladores'}</div>

          <Link
            href="/admin/nomencladores"
            className={`${styles.menuItem} ${isActive('/admin/nomencladores') ? styles.active : ''}`}
          >
            <Library size={20} />
            {!collapsed && <span>Nomencladores</span>}
          </Link>

          <Link
            href="/admin/nomencladores/editar"
            className={`${styles.menuItem} ${isActive('/admin/nomencladores/editar') ? styles.active : ''}`}
          >
            <Handshake size={20} />
            {!collapsed && <span>Convenios</span>}
          </Link>

          <div className={styles.sectionTitle}>{!collapsed && 'Utilidades'}</div>

          <Link
            href="/admin/utilidades"
            className={`${styles.menuItem} ${isActive('/admin/utilidades') ? styles.active : ''}`}
          >
            <Settings size={20} />
            {!collapsed && <span>Utilidades</span>}
          </Link>

          <Link
            href="/admin/med-descartables"
            className={`${styles.menuItem} ${isActive('/admin/med-descartables') ? styles.active : ''}`}
          >
            <Library size={20} />
            {!collapsed && <span>Med + Descartables</span>}
          </Link>

          <div className={styles.sectionTitle}>{!collapsed && 'Usuario'}</div>

          <button
            className={styles.menuItem}
            onClick={() => router.push('/admin/configuracion')}
          >
            <Settings size={20} />
            {!collapsed && <span>Configuración</span>}
          </button>

          <button
            className={`${styles.menuItem} ${styles.logoutBtn}`}
            onClick={cerrarSesion}
          >
            <LogOut size={20} />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </nav>
      </aside>

      {/* === CONTENIDO PRINCIPAL === */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
        </footer>
      </main>
    </div>
  );
}

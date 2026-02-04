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
  Sun,
  Moon,
} from 'lucide-react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Solo se ejecuta en el cliente
  useEffect(() => {
    setIsClient(true);
    
    const s = getSession?.();
    if (!s) {
      router.push('/login');
      return;
    }
    
    // Verificar tema guardado en localStorage
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      // Usar tema guardado
      if (savedTheme === 'dark') {
        setDarkMode(true);
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        setDarkMode(false);
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } else {
      // Si no hay tema guardado, usar preferencia del sistema
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        setDarkMode(true);
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
      } else {
        setDarkMode(false);
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
      }
    }
  }, [router]);

  // Función para cambiar tema
  const toggleTheme = () => {
    const newDarkMode = !darkMode;
    setDarkMode(newDarkMode);
    
    if (newDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('theme', 'light');
    }
  };

  const cerrarSesion = () => {
    clearSession();
    router.push('/login');
  };

  const isActive = (href) => {
    return pathname === href;
  };

  // Evitar renderizado hasta que estemos en el cliente
  if (!isClient) {
    return (
      <div className={styles.layout}>
        <div className={styles.loading}>Cargando...</div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* === SIDEBAR === */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <Image 
            src="/logo.png" 
            alt="Logo" 
            width={42} 
            height={42} 
            className="rounded-2"
            priority
          />
          {!collapsed && <span className={styles.brand}>Clínica Unión</span>}
        </div>

        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
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

          {/* Botón para cambiar tema */}
          <button
            className={`${styles.menuItem} ${styles.themeToggleBtn}`}
            onClick={toggleTheme}
            aria-label={darkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            {!collapsed && <span>{darkMode ? 'Modo Claro' : 'Modo Oscuro'}</span>}
          </button>

          <button
            className={styles.menuItem}
            onClick={() => router.push('/admin/configuracion')}
            aria-label="Configuración"
          >
            <Settings size={20} />
            {!collapsed && <span>Configuración</span>}
          </button>

          <button
            className={`${styles.menuItem} ${styles.logoutBtn}`}
            onClick={cerrarSesion}
            aria-label="Cerrar sesión"
          >
            <LogOut size={20} />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </nav>
      </aside>

      {/* === CONTENIDO PRINCIPAL === */}
      <main className={styles.main}>
        {/* Botón de tema flotante - solo visible cuando sidebar está colapsado */}
        {collapsed && (
          <div className={styles.floatingThemeToggle}>
            <button 
              className={styles.themeSwitch} 
              onClick={toggleTheme}
              aria-label={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            <span className={styles.themeLabel}>{darkMode ? 'Claro' : 'Oscuro'}</span>
          </div>
        )}
        
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
        </footer>
      </main>
    </div>
  );
}
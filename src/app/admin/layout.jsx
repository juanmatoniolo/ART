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
  LogOut,
  UserCircle,
  Settings,
  Menu,
  X,
} from 'lucide-react';

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState({ name: 'Usuario', role: 'admin' });
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

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
      {/* === NAVBAR === */}
      <header className={styles.navbar}>
        <div className={styles.navContainer}>
          {/* LOGO */}
          <Link href="/admin" className={styles.logoContainer}>
            <Image src="/logo.png" alt="Logo" width={42} height={42} className="rounded-2" />
            <span>Clínica de la Unión S.A.</span>
          </Link>

          {/* PERFIL (DESKTOP) */}
          <div className={styles.profileDesktop}>
            <div
              className={styles.avatar}
              onClick={() => setShowDropdown((prev) => !prev)}
            >
              {(user.name || 'U').slice(0, 2).toUpperCase()}
            </div>

            {showDropdown && (
              <div className={styles.dropdownMenu}>
                <div className={styles.dropdownItemHeader}>
                  <UserCircle size={18} /> {user.name}
                </div>
                <div className={styles.dropdownItemSub}>
                  {user.role === 'admin' ? 'Administrador' : user.role}
                </div>
                <hr className={styles.dropdownDivider} />
                <button
                  className={styles.dropdownItem}
                  onClick={() => router.push('/admin/configuracion')}
                >
                  <Settings size={16} /> Configuración
                </button>
                <button className={styles.dropdownItemLogout} onClick={cerrarSesion}>
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </div>
            )}
          </div>

          {/* MENÚ HAMBURGUESA (MOBILE) */}
          <button
            className={styles.menuButton}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-label="Abrir menú"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </header>

      {/* === SIDEBAR === */}
      <aside className={`${styles.sidebar} ${menuOpen ? styles.sidebarOpen : ''}`}>
        <nav className={styles.navMenu}>
          <div className={styles.sectionTitle}>Gestión</div>
          <Link
            href="/admin/pacientes"
            className={`${styles.menuItem} ${isActive('/admin/pacientes') ? styles.active : ''
              }`}
          >
            <Users size={18} /> Pacientes
          </Link>
          <Link
            href="/admin/empleados"
            className={`${styles.menuItem} ${isActive('/admin/empleados') ? styles.active : ''
              }`}
          >
            <Briefcase size={18} /> Empleados
          </Link>
          <Link
            href="/admin/facturacion"
            className={`${styles.menuItem} ${isActive('/admin/facturacion') ? styles.active : ''
              }`}
          >
            <FileText size={18} /> Facturación
          </Link>

          <div className={styles.sectionTitle}>Nomencladores</div>
          <Link
            href="/admin/nomencladores"
            className={`${styles.menuItem} ${isActive('/admin/nomencladores') ? styles.active : ''
              }`}
          >
            <Library size={18} /> Nomencladores
          </Link>
          <Link
            href="/admin/nomencladores/editar"
            className={`${styles.menuItem} ${isActive('/admin/nomencladores/editar') ? styles.active : ''
              }`}
          >
            <Users size={18} /> Crear Convenios
          </Link>

          {/* === PERFIL (SOLO MOBILE) === */}
          <div className={styles.profileMobile}>
            <div className={styles.avatar}>
              {(user.name || 'U').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className={styles.userName}>{user.name}</div>
              <div className={styles.userRole}>{user.role}</div>
            </div>
            <button onClick={cerrarSesion} className={styles.logoutBtnMobile}>
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </nav>
      </aside>

      {/* === MAIN CONTENT === */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
        </footer>
      </main>
    </>
  );
}

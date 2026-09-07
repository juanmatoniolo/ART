'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import styles from './os.module.css';

const NAV_ITEMS = [
  { href: '/os/inicio', label: 'Inicio', icon: '📊' },
  { href: '/os/facturacionos', label: 'Facturación', icon: '🧾' },
  { href: '/os/conveniosos', label: 'Convenios', icon: '🤝' },
];

export default function OSLayout({ children }) {
  const { usuario, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [checkingSession, setCheckingSession] = useState(true);
  const [tema, setTema] = useState('light');

  // Cargar tema guardado
  useEffect(() => {
    const savedTheme = localStorage.getItem('os-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTema(savedTheme);
    }
  }, []);

  // Guardar tema al cambiar
  useEffect(() => {
    localStorage.setItem('os-theme', tema);
  }, [tema]);

  useEffect(() => {
    const timer = setTimeout(() => setCheckingSession(false), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!checkingSession && !usuario) {
      router.replace('/login');
    }
  }, [checkingSession, usuario, router]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const toggleTema = () => {
    setTema((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  if (checkingSession) {
    return <div className={styles.wrapper}>Cargando sesión...</div>;
  }

  if (!usuario) {
    return null;
  }

  if (usuario.TipoEmpleado !== 'OS') {
    return (
      <div className={styles.wrapper} data-theme={tema}>
        <div className={styles.accessDenied}>
          <h2>Acceso denegado</h2>
          <p>No tenés permisos para acceder a esta sección.</p>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            🚪 Volver al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.wrapper} data-theme={tema}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Obras Sociales</h1>
            <div className={styles.userInfo}>
              <span className={styles.userName}>
                {usuario?.nombre || usuario?.user || 'Usuario'}
              </span>
              <span className={styles.userRole}>{usuario?.TipoEmpleado}</span>
            </div>
          </div>
          <div className={styles.headerActions}>
            <button
              onClick={toggleTema}
              className={styles.themeToggleBtn}
              title={tema === 'light' ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
            >
              {tema === 'light' ? '🌙' : '☀️'}
            </button>
            <button onClick={handleLogout} className={styles.logoutBtn} title="Cerrar sesión">
              🚪 Salir
            </button>
          </div>
        </div>
      </header>

      <nav className={styles.mainNav} aria-label="Secciones de Obras Sociales">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${styles.tabBtn} ${isActive ? styles.tabActive : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className={styles.tabIcon}>{item.icon}</span>
              <span className={styles.tabLabel}>{item.label}</span>
              {isActive && <span className={styles.tabUnderline} />}
            </Link>
          );
        })}
      </nav>

      <section className={styles.content}>{children}</section>
    </main>
  );
}
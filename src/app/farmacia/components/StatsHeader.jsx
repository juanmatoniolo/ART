"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from '@/context/SessionContext';
import s from '../farmaciaDashboard.module.css';

export default function StatsHeader({
  theme,
  toggleTheme,
  loadingLogout,
  onIngresoMercaderia,
}) {
  const { usuario, logout } = useSession();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const inicial = usuario?.nombre ? usuario.nombre.charAt(0).toUpperCase() : '?';
  const nombreUsuario = usuario?.nombre || 'Usuario';
  const rolUsuario = usuario?.TipoEmpleado || 'Sin rol';

  return (
    <header className={s.dashboardHeader}>
      <div className={s.headerTop}>
        <div className={s.titleGroup}>
          <div>
            <h1 className={s.dashboardTitle}>Dashboard Farmacia</h1>
            <div className={s.userInfo}>
          
              <span className={s.userName}>{nombreUsuario}</span>
            
            </div>
          </div>
        </div>

        <div className={s.headerActions}>
          <button
            onClick={toggleTheme}
            className={s.toggleThemeBtn}
            title="Cambiar tema"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <button onClick={onIngresoMercaderia} className={`${s.actionBtn} ${s.btn_secondary}`}>
            📦 Ingreso de mercadería
          </button>

          <Link
            href="/farmacia/reparto"
            className={`${s.actionBtn} ${s.btn_reparto}`}
            style={{ textDecoration: 'none' }}
            title="Reparto"
          >
            🚚 Reparto
          </Link>

          <button
            onClick={handleLogout}
            className={s.logoutBtn}
            disabled={loadingLogout}
            title="Salir"
          >
            {loadingLogout ? '⏳' : '🚪'} Salir
          </button>
        </div>
      </div>
    </header>
  );
}
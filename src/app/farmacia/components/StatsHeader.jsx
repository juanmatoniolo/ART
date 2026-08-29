'use client';
import Link from 'next/link';
import s from '../farmaciaDashboard.module.css';

export default function StatsHeader({
  theme,
  toggleTheme,
  onLogout,
  loadingLogout,
  usuario,
  rol,
  usuarios,
  onSelectUser,
  usuarioSeleccionado,
  onIngresoMercaderia,
}) {
  return (
    <header className={s.dashboardHeader}>
      <div className={s.headerTop}>
        <div className={s.titleGroup}>
          <div>
            <h1 className={s.dashboardTitle}>Dashboard Farmacia</h1>
            <div className={s.userInfo}>
              <span className={s.userName}>{usuario}</span>
              <span className={s.userRole}>{rol}</span>
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
            onClick={onLogout}
            className={s.logoutBtn}
            disabled={loadingLogout}
            title="Salir"
          >
            {loadingLogout ? '⏳' : '🚪'} Salir
          </button>
        </div>
      </div>

      {usuarios && usuarios.length > 1 && (
        <div style={{ marginTop: '0.5rem' }}>
          <select
            className={s.filterSelect}
            value={usuarioSeleccionado?.id || ''}
            onChange={(e) => onSelectUser(e.target.value)}
          >
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nombre} ({u.TipoEmpleado})
              </option>
            ))}
          </select>
        </div>
      )}
    </header>
  );
}
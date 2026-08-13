"use client";
import s from "../farmaciaDashboard.module.css";
import { formatCurrency } from "../utils/farmacia";
import LogoutButton from "./LogoutButton"; // 👈 importamos el logout

export default function StatsHeader({
  estadisticas,
  onAgregar,
  onCargaMasiva,
  onReparto,
  onExportar,
  theme,
  toggleTheme,
  onLogout,          // 👈 nueva prop
  loadingLogout,     // 👈 nueva prop
}) {
  return (
    <header className={s.dashboardHeader}>
      <div className={s.headerTop}>
        <div className={s.titleGroup}>
          <span className={s.titleIcon}>🏥</span>
          <div>
            <h1 className={s.dashboardTitle}>Farmacia Dashboard</h1>
            <p className={s.dashboardSubtitle}>Gestión de stock, movimientos y precios</p>
          </div>
        </div>
 
        <div className={s.headerActions}>
          <button className={s.toggleThemeBtn} onClick={toggleTheme} title="Cambiar tema">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={onAgregar}>
            <span>➕</span> <span className={s.actionBtnLabel}>Agregar</span>
          </button>
          <button className={`${s.actionBtn} ${s.btn_secondary}`} onClick={onCargaMasiva}>
            <span>📤</span> <span className={s.actionBtnLabel}>Carga masiva</span>
          </button>
          <button className={`${s.actionBtn} ${s.btn_danger}`} onClick={onReparto}>
            <span>🚚</span> <span className={s.actionBtnLabel}>Reparto</span>
          </button>
          <button className={`${s.actionBtn} ${s.btn_import}`} onClick={onExportar}>
            <span>📊</span> <span className={s.actionBtnLabel}>Exportar</span>
          </button>
          {/* Botón toggle tema */}
          {/* 👇 Logout integrado */}
          <LogoutButton theme={theme} onLogout={onLogout} loading={loadingLogout} />
        </div>
      </div>
    </header>
  );
}
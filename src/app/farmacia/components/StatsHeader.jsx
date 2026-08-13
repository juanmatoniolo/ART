"use client";
import s from "../farmaciaDashboard.module.css";
import { formatCurrency } from "../utils/farmacia";

export default function StatsHeader({
  estadisticas,
  onAgregar,
  onCargaMasiva,
  onReparto,
  onExportar,
  theme,
  toggleTheme,
  onLogout,
  loadingLogout,
  usuario,    // <-- nombre del usuario (ej: "Silvina")
  rol,        // <-- rol del usuario (ej: "ADM Farmacia")
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
          {/* 👤 Información del usuario */}
          {usuario && (
            <div className={s.userInfo}>
              <span className={s.userName}>
                <span>👤</span> {usuario}
              </span>
              {rol && <span className={s.userRole}>{rol}</span>}
            </div>
          )}

          <button
            className={s.toggleThemeBtn}
            onClick={toggleTheme}
            title="Cambiar tema"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          <button
            className={`${s.actionBtn} ${s.btn_primary}`}
            onClick={onAgregar}
            title="Agregar producto"
          >
            <span>➕</span> <span className={s.actionBtnLabel}>Agregar</span>
          </button>

          <button
            className={`${s.actionBtn} ${s.btn_secondary}`}
            onClick={onCargaMasiva}
            title="Carga masiva"
          >
            <span>📤</span> <span className={s.actionBtnLabel}>Carga masiva</span>
          </button>

          <button
            className={`${s.actionBtn} ${s.btn_danger}`}
            onClick={onReparto}
            title="Repartir"
          >
            <span>🚚</span> <span className={s.actionBtnLabel}>Reparto</span>
          </button>

          <button
            className={`${s.actionBtn} ${s.btn_import}`}
            onClick={onExportar}
            title="Exportar datos"
          >
            <span>📊</span> <span className={s.actionBtnLabel}>Exportar</span>
          </button>

          {/* 🔓 Logout integrado (sin componente externo) */}
          <button
            className={`${s.actionBtn} ${s.btnCancel}`}
            onClick={onLogout}
            disabled={loadingLogout}
            title="Cerrar sesión"
          >
            <span>🚪</span>
            <span className={s.actionBtnLabel}>
              {loadingLogout ? 'Saliendo...' : 'Salir'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
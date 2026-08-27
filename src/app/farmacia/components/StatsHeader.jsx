"use client";
import Link from "next/link";
import s from "../farmaciaDashboard.module.css";
import { formatCurrency } from "../utils/farmacia";

export default function StatsHeader({
  estadisticas,
  onAgregar,
  onCargaMasiva,
  repartoHref, // ← nueva prop para el enlace de reparto
  onExportar,
  theme,
  toggleTheme,
  onLogout,
  loadingLogout,
  usuario,
  rol,
  usuarios,
  onSelectUser,
  usuarioSeleccionado,
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
          {/* 👤 Selector de usuario */}
          {usuarios && usuarios.length > 0 && (
            <div className={s.userSelector}>
              <select
                className={s.userSelect}
                value={usuarioSeleccionado?.id || ""}
                onChange={(e) => onSelectUser(e.target.value)}
              >
                {usuarios.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nombre} ({u.TipoEmpleado})
                  </option>
                ))}
              </select>
              <span className={s.userRoleBadge}>{rol}</span>
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

          {/* ✅ Reparto como Link (en lugar de botón) */}
          <Link
            href={repartoHref}
            className={`${s.actionBtn} ${s.btn_danger}`}
            title="Repartir"
          >
            <span>🚚</span> <span className={s.actionBtnLabel}>Reparto</span>
          </Link>

          <button
            className={`${s.actionBtn} ${s.btn_import}`}
            onClick={onExportar}
            title="Exportar datos"
          >
            <span>📊</span> <span className={s.actionBtnLabel}>Exportar</span>
          </button>

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
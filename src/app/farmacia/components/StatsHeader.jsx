"use client";
import s from "../farmaciaDashboard.module.css";
import { formatCurrency } from "../utils/farmacia";

export default function StatsHeader({ estadisticas, onAgregar, onCargaMasiva, onReparto, onExportar, theme, toggleTheme }) {
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
                <div className={s.headerStats}>
                    <div className={s.statPill}>
                        <span className={s.statPillIcon}>📦</span>
                        <span className={s.statPillValue}>{estadisticas.totalItems}</span>
                        <span className={s.statPillLabel}>productos</span>
                    </div>
                    <div className={s.statPill}>
                        <span className={s.statPillIcon}>⚠️</span>
                        <span className={s.statPillValue}>{estadisticas.itemsBajoStock}</span>
                        <span className={s.statPillLabel}>bajo stock</span>
                    </div>
                </div>
                <div className={s.headerActions}>
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
                    <button className={s.toggleThemeBtn} onClick={toggleTheme} title="Cambiar tema">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                </div>
            </div>
        </header>
    );
}
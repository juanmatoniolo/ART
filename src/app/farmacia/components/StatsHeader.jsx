"use client";
import s from "../farmaciaDashboard.module.css";
import { formatCurrency } from "../utils/farmacia";

export default function StatsHeader({ estadisticas, onAgregar, onCargaMasiva, onReparto, onExportar }) {
    return (
        <header className={s.dashboardHeader}>
            <div className={s.headerTop}>
                <div className={s.titleGroup}>
                    <div className={s.titleIcon}>🏥</div>
                    <div>
                        <h1 className={s.dashboardTitle}>Farmacia</h1>
                        <p className={s.dashboardSubtitle}>Control de stock e inventario</p>
                    </div>
                </div>

                <div className={s.headerStats}>
                    <StatPill icon="📦" value={estadisticas.totalItems} label="Productos" />
                    <StatPill
                        icon="⚠️" value={estadisticas.itemsBajoStock} label="Bajo stock"
                        valueColor={estadisticas.itemsBajoStock > 0 ? "#f59e0b" : "#10b981"}
                    />
                    <StatPill icon="❌" value={estadisticas.itemsSinStock} label="Sin stock"
                        valueColor={estadisticas.itemsSinStock > 0 ? "#ef4444" : "#10b981"}
                    />
                    <StatPill icon="💰" value={formatCurrency(estadisticas.valorTotalStock)} label="Valor total" />
                </div>
            </div>

            <div className={s.headerActions}>
                <ActionBtn icon="➕" label="Nuevo Producto" onClick={onAgregar} variant="primary" />
                <ActionBtn icon="📥" label="Carga Masiva" onClick={onCargaMasiva} variant="secondary" />
                <ActionBtn icon="🚚" label="Repartir" onClick={onReparto} variant="danger" />
                <ActionBtn icon="📊" label="Exportar" onClick={onExportar} variant="success" />
            </div>
        </header>
    );
}

function StatPill({ icon, value, label, valueColor }) {
    return (
        <div className={s.statPill}>
            <span className={s.statPillIcon}>{icon}</span>
            <div>
                <div className={s.statPillValue} style={valueColor ? { color: valueColor } : {}}>
                    {value}
                </div>
                <div className={s.statPillLabel}>{label}</div>
            </div>
        </div>
    );
}

function ActionBtn({ icon, label, onClick, variant }) {
    return (
        <button className={`${s.actionBtn} ${s[`btn_${variant}`]}`} onClick={onClick}>
            <span>{icon}</span>
            <span className={s.actionBtnLabel}>{label}</span>
        </button>
    );
}
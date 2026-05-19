"use client";
import s from "../farmaciaDashboard.module.css";
import { formatCurrency, getStockColor, getStockStatus } from "../utils/farmacia";

export default function DashboardTab({ estadisticas, itemsBajoStockList, movimientos }) {
    return (
        <div className={s.dashboardGrid}>
            {/* Stat cards */}
            <div className={s.statsRow}>
                {[
                    { icon: "📦", label: "Total Productos", value: estadisticas.totalItems, variant: "" },
                    { icon: "⚠️", label: "Bajo Stock", value: estadisticas.itemsBajoStock, variant: s.cardWarn },
                    { icon: "❌", label: "Sin Stock", value: estadisticas.itemsSinStock, variant: s.cardDanger },
                    { icon: "💰", label: "Valor total", value: formatCurrency(estadisticas.valorTotalStock), variant: s.cardSuccess },
                ].map(c => (
                    <div key={c.label} className={`${s.statCard} ${c.variant}`}>
                        <div className={s.statCardIcon}>{c.icon}</div>
                        <div className={s.statCardValue}>{c.value}</div>
                        <div className={s.statCardLabel}>{c.label}</div>
                    </div>
                ))}
            </div>

            <div className={s.dashboardCols}>
                {/* Alertas */}
                <section className={s.panel}>
                    <div className={s.panelHeader}>
                        <h3 className={s.panelTitle}><span>⚠️</span> Alertas de Stock</h3>
                        {itemsBajoStockList.length > 0 &&
                            <span className={s.badgeDanger}>{itemsBajoStockList.length}</span>}
                    </div>
                    {itemsBajoStockList.length === 0 ? (
                        <div className={s.emptyState}>
                            <span>✅</span><p>Todo el stock está en niveles óptimos</p>
                        </div>
                    ) : itemsBajoStockList.slice(0, 6).map(item => (
                        <AlertItem key={item.id} item={item} />
                    ))}
                </section>

                {/* Últimos movimientos */}
                <section className={s.panel}>
                    <div className={s.panelHeader}>
                        <h3 className={s.panelTitle}><span>📋</span> Últimos Movimientos</h3>
                    </div>
                    {movimientos.slice(0, 5).map(mov => (
                        <MovimientoMini key={mov.id} mov={mov} />
                    ))}
                </section>
            </div>
        </div>
    );
}

function AlertItem({ item }) {
    const color = getStockColor(item.stockActual, item.stockMinimo);
    const pct = Math.min(100, (item.stockActual / item.stockMinimo) * 100);
    return (
        <div className={s.alertItem}>
            <span className={s.alertItemIcon}>{item.tipo === "medicamento" ? "💊" : "🧷"}</span>
            <div className={s.alertItemBody}>
                <p className={s.alertItemName}>{item.nombre.replace(/_/g, " ")}</p>
                <div className={s.stockBar}>
                    <div className={s.stockBarFill} style={{ width: `${pct}%`, background: color }} />
                </div>
            </div>
            <div className={s.alertItemCount}>
                <span style={{ color, fontWeight: 700 }}>{item.stockActual}</span>
                <span className={s.alertItemMin}>/{item.stockMinimo}</span>
            </div>
        </div>
    );
}

function MovimientoMini({ mov }) {
    const isIngreso = mov.tipo === "ingreso";
    const total = mov.productos?.reduce((s, p) => s + p.cantidad * p.precioUnitario, 0) || 0;
    return (
        <div className={s.movMini}>
            <div className={s.movMiniLeft}>
                <span className={`${s.movBadge} ${isIngreso ? s.movBadgeIn : s.movBadgeOut}`}>
                    {isIngreso ? "📥 INGRESO" : "🚚 REPARTO"}
                </span>
                {!isIngreso && <span className={s.movDest}>📍 {mov.destino}</span>}
            </div>
            <div className={s.movMiniRight}>
                <span className={s.movValue}>{formatCurrency(total)}</span>
                <span className={s.movDate}>{mov.fechaLegible}</span>
            </div>
        </div>
    );
}
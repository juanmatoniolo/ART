"use client";
import s from "../farmaciaDashboard.module.css";
import { formatCurrency } from "../utils/farmacia";

export default function MovimientosTab({ movimientos }) {
    return (
        <div className={s.panel}>
            <div className={s.panelHeader}>
                <h3 className={s.panelTitle}>📋 Historial de Movimientos</h3>
                <span className={s.badgeNeutral}>{movimientos.length} registros</span>
            </div>

            {movimientos.length === 0 ? (
                <div className={s.emptyState}><span>📭</span><p>No hay movimientos registrados</p></div>
            ) : (
                <div className={s.movList}>
                    {movimientos.map(mov => (
                        <MovimientoCard key={mov.id} mov={mov} />
                    ))}
                </div>
            )}
        </div>
    );
}

function MovimientoCard({ mov }) {
    const isIngreso = mov.tipo === "ingreso";
    const totalVal = mov.valorTotal ||
        mov.productos?.reduce((s, p) => s + p.cantidad * p.precioUnitario, 0) || 0;

    return (
        <div className={`${s.movCard} ${isIngreso ? s.movCardIn : s.movCardOut}`}>
            <div className={s.movCardHeader}>
                <div className={s.movCardLeft}>
                    <span className={`${s.movBadge} ${isIngreso ? s.movBadgeIn : s.movBadgeOut}`}>
                        {isIngreso ? "📥 INGRESO" : "🚚 REPARTO"}
                    </span>
                    {!isIngreso && <span className={s.movDest}>📍 {mov.destino}</span>}
                    {!isIngreso && mov.responsable && (
                        <span className={s.movResp}>👤 {mov.responsable}</span>
                    )}
                </div>
                <div className={s.movCardRight}>
                    <span className={s.movUser}>👤 {mov.usuario}</span>
                    <span className={s.movDate}>{mov.fechaFormatted}</span>
                </div>
            </div>

            <div className={s.movCardStats}>
                <span>📋 {mov.totalProductos || mov.productos?.length || 0} productos</span>
                <span>📦 {mov.totalUnidades || 0} unidades</span>
                <span className={isIngreso ? s.movValIn : s.movValOut}>
                    💰 {formatCurrency(totalVal)}
                </span>
            </div>

            <div className={s.movTableWrap}>
                <table className={s.movTable}>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Tipo</th>
                            <th>Presentación</th>
                            <th>Cantidad</th>
                            <th>Stock Ant.</th>
                            <th>Stock Nuevo</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mov.productos?.map((p, i) => (
                            <tr key={i}>
                                <td>{p.itemNombre.replace(/_/g, " ")}</td>
                                <td>
                                    <span className={p.tipo === "medicamento" ? s.badgeMed : s.badgeDesc}>
                                        {p.tipo === "medicamento" ? "Medicamento" : "Descartable"}
                                    </span>
                                </td>
                                <td>{p.presentacion}</td>
                                <td>
                                    <span className={isIngreso ? s.cantPos : s.cantNeg}>
                                        {isIngreso ? "+" : "-"}{p.cantidad}
                                    </span>
                                </td>
                                <td>{p.stockAnterior}</td>
                                <td><strong>{p.stockNuevo}</strong></td>
                                <td>{formatCurrency(p.cantidad * p.precioUnitario)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
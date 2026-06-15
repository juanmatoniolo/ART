"use client";
import Icon from "./Icon";
import { formatCurrency } from "../utils/farmacia";

export default function MovimientosTab({ movimientos }) {
    return (
        <div className="fxmov">
            <div className="fxmov-head">
                <h2><Icon name="list" size={24} /> Historial de movimientos</h2>
                <span className="fxmov-count">{movimientos.length} registros</span>
            </div>

            {movimientos.length === 0 ? (
                <div className="fxempty"><Icon name="inbox" size={40} /><p>No hay movimientos registrados</p></div>
            ) : (
                <div className="fxmov-list">
                    {movimientos.map(mov => <MovCard key={mov.id} mov={mov} />)}
                </div>
            )}

            <style>{`
                .fxmov { display: flex; flex-direction: column; gap: 14px; color: #1f2937; }
                .fxmov-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
                .fxmov-head h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 24px; font-weight: 800; }
                .fxmov-count { background: #f3f4f6; color: #374151; font-weight: 700; font-size: 14px; padding: 6px 14px; border-radius: 999px; }
                .fxmov-list { display: flex; flex-direction: column; gap: 12px; }
                .fxempty { text-align: center; padding: 48px 16px; color: #9ca3af; }
                .fxempty p { margin: 10px 0 0; font-size: 17px; }

                .fxmc { background: #fff; border: 2px solid #e5e7eb; border-left-width: 6px; border-radius: 16px; padding: 14px; }
                .fxmc.in { border-left-color: #059669; }
                .fxmc.out { border-left-color: #2563eb; }
                .fxmc-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
                .fxmc-badge { display: inline-flex; align-items: center; gap: 6px; font-weight: 800; font-size: 14px; padding: 6px 12px; border-radius: 999px; }
                .fxmc-badge.in { background: #ecfdf5; color: #059669; }
                .fxmc-badge.out { background: #eff6ff; color: #2563eb; }
                .fxmc-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 14px; color: #6b7280; }
                .fxmc-date { margin-left: auto; font-size: 14px; color: #9ca3af; }
                .fxmc-stats { display: flex; gap: 14px; flex-wrap: wrap; font-size: 14px; color: #374151; margin-bottom: 10px; }
                .fxmc-stats b { font-weight: 800; }
                .fxmc-stats .val.in { color: #059669; }
                .fxmc-stats .val.out { color: #2563eb; }
                .fxmc-table-wrap { overflow-x: auto; }
                table.fxmc-table { width: 100%; border-collapse: collapse; font-size: 14px; }
                .fxmc-table th { text-align: left; padding: 8px; background: #f9fafb; color: #6b7280; font-weight: 700; white-space: nowrap; }
                .fxmc-table td { padding: 8px; border-top: 1px solid #f3f4f6; white-space: nowrap; }
                .fxqty.pos { color: #059669; font-weight: 800; }
                .fxqty.neg { color: #dc2626; font-weight: 800; }
            `}</style>
        </div>
    );
}

function MovCard({ mov }) {
    const isIn = mov.tipo === "ingreso";
    const total = mov.valorTotal || 0;
    return (
        <div className={"fxmc " + (isIn ? "in" : "out")}>
            <div className="fxmc-head">
                <span className={"fxmc-badge " + (isIn ? "in" : "out")}>
                    <Icon name={isIn ? "download" : "truck"} size={16} /> {isIn ? "Ingreso" : "Reparto"}
                </span>
                {!isIn && mov.destino && <span className="fxmc-chip"><Icon name="pin" size={15} /> {mov.destino}</span>}
                {!isIn && mov.responsable && <span className="fxmc-chip"><Icon name="user" size={15} /> {mov.responsable}</span>}
                <span className="fxmc-date">{mov.fechaFormatted}</span>
            </div>

            <div className="fxmc-stats">
                <span><b>{mov.totalProductos || 0}</b> productos</span>
                <span><b>{mov.totalUnidades || 0}</b> unidades</span>
                <span className={"val " + (isIn ? "in" : "out")}>{formatCurrency(total)}</span>
            </div>

            <div className="fxmc-table-wrap">
                <table className="fxmc-table">
                    <thead>
                        <tr><th>Producto</th><th>Cant.</th><th>Antes</th><th>Después</th><th>Valor</th></tr>
                    </thead>
                    <tbody>
                        {mov.productos?.map((p, i) => (
                            <tr key={i}>
                                <td>{p.itemNombre.replace(/_/g, " ")}</td>
                                <td><span className={"fxqty " + (isIn ? "pos" : "neg")}>{isIn ? "+" : "−"}{p.cantidad}</span></td>
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
"use client";
import Icon from "./Icon";
import { formatCurrency, getStockColor } from "../utils/farmacia";

export default function DashboardTab({ estadisticas, itemsBajoStockList, movimientos }) {
    const cards = [
        { icon: "box", label: "Total productos", value: estadisticas.totalItems, color: "#2563eb" },
        { icon: "alert", label: "Bajo stock", value: estadisticas.itemsBajoStock, color: "#d97706" },
        { icon: "close", label: "Sin stock", value: estadisticas.itemsSinStock, color: "#dc2626" },
        { icon: "money", label: "Valor total", value: formatCurrency(estadisticas.valorTotalStock), color: "#059669" },
    ];

    return (
        <div className="fxdash">
            <div className="fxdash-stats">
                {cards.map(c => (
                    <div key={c.label} className="fxdash-card">
                        <span className="fxdash-card-ic" style={{ background: c.color + "1a", color: c.color }}>
                            <Icon name={c.icon} size={24} />
                        </span>
                        <div className="fxdash-card-val">{c.value}</div>
                        <div className="fxdash-card-lbl">{c.label}</div>
                    </div>
                ))}
            </div>

            <div className="fxdash-cols">
                <section className="fxpanel">
                    <div className="fxpanel-head">
                        <h3><Icon name="alert" size={22} /> Alertas de stock</h3>
                        {itemsBajoStockList.length > 0 && <span className="fxbadge-danger">{itemsBajoStockList.length}</span>}
                    </div>
                    {itemsBajoStockList.length === 0 ? (
                        <div className="fxempty2"><Icon name="check" size={32} /><p>Todo el stock está en niveles óptimos</p></div>
                    ) : itemsBajoStockList.slice(0, 6).map(item => {
                        const color = getStockColor(item.stockActual, item.stockMinimo);
                        const pct = Math.min(100, (item.stockActual / (item.stockMinimo || 1)) * 100);
                        return (
                            <div key={item.id} className="fxalert">
                                <span style={{ color }}><Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={22} /></span>
                                <div className="fxalert-body">
                                    <p>{item.nombre.replace(/_/g, " ")}</p>
                                    <div className="fxalert-bar"><div style={{ width: pct + "%", background: color }} /></div>
                                </div>
                                <span className="fxalert-num"><strong style={{ color }}>{item.stockActual}</strong>/{item.stockMinimo}</span>
                            </div>
                        );
                    })}
                </section>

                <section className="fxpanel">
                    <div className="fxpanel-head"><h3><Icon name="list" size={22} /> Últimos movimientos</h3></div>
                    {movimientos.length === 0 ? (
                        <div className="fxempty2"><Icon name="inbox" size={32} /><p>Sin movimientos aún</p></div>
                    ) : movimientos.slice(0, 5).map(mov => {
                        const isIn = mov.tipo === "ingreso";
                        const total = mov.valorTotal || 0;
                        return (
                            <div key={mov.id} className="fxmovmini">
                                <span className={"fxmovbadge " + (isIn ? "in" : "out")}>
                                    <Icon name={isIn ? "download" : "truck"} size={16} /> {isIn ? "Ingreso" : "Reparto"}
                                </span>
                                {!isIn && <span className="fxmovmini-dest"><Icon name="pin" size={15} /> {mov.destino}</span>}
                                <span className="fxmovmini-val">{formatCurrency(total)}</span>
                                <span className="fxmovmini-date">{mov.fechaLegible}</span>
                            </div>
                        );
                    })}
                </section>
            </div>

            <style>{`
                .fxdash { display: flex; flex-direction: column; gap: 14px; color: #1f2937; }
                .fxdash-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
                .fxdash-card { background: #fff; border: 2px solid #e5e7eb; border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
                .fxdash-card-ic { width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
                .fxdash-card-val { font-size: 24px; font-weight: 800; }
                .fxdash-card-lbl { font-size: 14px; color: #6b7280; }

                .fxdash-cols { display: grid; grid-template-columns: 1fr; gap: 14px; }
                .fxpanel { background: #fff; border: 2px solid #e5e7eb; border-radius: 16px; padding: 16px; }
                .fxpanel-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
                .fxpanel-head h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; font-weight: 800; }
                .fxbadge-danger { background: #fef2f2; color: #dc2626; font-weight: 800; font-size: 14px; padding: 4px 12px; border-radius: 999px; }

                .fxalert { display: flex; align-items: center; gap: 12px; padding: 10px 0; border-bottom: 1px solid #f3f4f6; }
                .fxalert-body { flex: 1; min-width: 0; }
                .fxalert-body p { margin: 0 0 6px; font-size: 16px; font-weight: 600; }
                .fxalert-bar { height: 8px; background: #f1f1f1; border-radius: 999px; overflow: hidden; }
                .fxalert-bar div { height: 100%; border-radius: 999px; }
                .fxalert-num { font-size: 16px; color: #9ca3af; white-space: nowrap; }

                .fxmovmini { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 10px 0; border-bottom: 1px solid #f3f4f6; font-size: 14px; }
                .fxmovbadge { display: inline-flex; align-items: center; gap: 5px; font-weight: 700; font-size: 13px; padding: 5px 10px; border-radius: 999px; }
                .fxmovbadge.in { background: #ecfdf5; color: #059669; }
                .fxmovbadge.out { background: #eff6ff; color: #2563eb; }
                .fxmovmini-dest { display: inline-flex; align-items: center; gap: 4px; color: #6b7280; }
                .fxmovmini-val { margin-left: auto; font-weight: 800; }
                .fxmovmini-date { width: 100%; color: #9ca3af; font-size: 13px; }

                .fxempty2 { text-align: center; padding: 28px 8px; color: #9ca3af; }
                .fxempty2 p { margin: 8px 0 0; }

                @media (min-width: 768px) {
                    .fxdash-stats { grid-template-columns: repeat(4, 1fr); }
                    .fxdash-cols { grid-template-columns: 1fr 1fr; }
                }
            `}</style>
        </div>
    );
}
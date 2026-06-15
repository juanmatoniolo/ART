"use client";
import Icon from "./Icon";
import { formatCurrency } from "../utils/farmacia";

export default function StatsHeader({ estadisticas, onAgregar, onCargaMasiva, onReparto, onExportar }) {
    const stats = [
        { icon: "box", value: estadisticas.totalItems, label: "Productos", color: "#2563eb" },
        { icon: "alert", value: estadisticas.itemsBajoStock, label: "Bajo stock", color: estadisticas.itemsBajoStock > 0 ? "#d97706" : "#059669" },
        { icon: "close", value: estadisticas.itemsSinStock, label: "Sin stock", color: estadisticas.itemsSinStock > 0 ? "#dc2626" : "#059669" },
        { icon: "money", value: formatCurrency(estadisticas.valorTotalStock), label: "Valor total", color: "#2563eb" },
    ];

    return (
        <header className="fxhead">
            <div className="fxhead-title">
                <span className="fxhead-logo"><Icon name="pills" size={28} /></span>
                <div>
                    <h1>Farmacia</h1>
                    <p>Control de stock e inventario</p>
                </div>
            </div>

            <div className="fxhead-stats">
                {stats.map(st => (
                    <div key={st.label} className="fxstat">
                        <span className="fxstat-ic" style={{ color: st.color }}><Icon name={st.icon} size={22} /></span>
                        <div>
                            <div className="fxstat-val" style={{ color: st.color }}>{st.value}</div>
                            <div className="fxstat-lbl">{st.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="fxhead-actions">
                <button className="fxha fxha-primary" onClick={onAgregar}><Icon name="plus" size={22} /> Nuevo</button>
                <button className="fxha fxha-soft" onClick={onCargaMasiva}><Icon name="download" size={22} /> Cargar</button>
                <button className="fxha fxha-danger" onClick={onReparto}><Icon name="truck" size={22} /> Repartir</button>
                <button className="fxha fxha-soft" onClick={onExportar}><Icon name="chart" size={22} /> Exportar</button>
            </div>

            <style>{`
                .fxhead { background: #fff; border-bottom: 1px solid #e5e7eb; padding: 16px; display: flex; flex-direction: column; gap: 14px; color: #1f2937; }
                .fxhead-title { display: flex; align-items: center; gap: 12px; }
                .fxhead-logo { width: 52px; height: 52px; border-radius: 14px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
                .fxhead-title h1 { margin: 0; font-size: 24px; font-weight: 800; }
                .fxhead-title p { margin: 2px 0 0; font-size: 14px; color: #6b7280; }

                .fxhead-stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
                .fxstat { display: flex; align-items: center; gap: 10px; background: #f9fafb; border: 1px solid #eef0f2; border-radius: 14px; padding: 12px; }
                .fxstat-ic { display: flex; }
                .fxstat-val { font-size: 20px; font-weight: 800; line-height: 1.1; }
                .fxstat-lbl { font-size: 13px; color: #6b7280; }

                .fxhead-actions { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
                .fxha { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 17px; font-weight: 700; min-height: 56px; border-radius: 14px; border: none; cursor: pointer; }
                .fxha-primary { background: #2563eb; color: #fff; }
                .fxha-danger { background: #dc2626; color: #fff; }
                .fxha-soft { background: #eef2ff; color: #1e3a8a; }
                .fxha:active { filter: brightness(.95); }

                @media (min-width: 768px) {
                    .fxhead { padding: 20px 24px; }
                    .fxhead-stats { grid-template-columns: repeat(4, 1fr); }
                    .fxhead-actions { grid-template-columns: repeat(4, 1fr); max-width: 720px; }
                }
            `}</style>
        </header>
    );
}
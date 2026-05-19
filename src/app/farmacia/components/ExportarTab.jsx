"use client";
import s from "../farmaciaDashboard.module.css";
import { formatCurrency } from "../utils/farmacia";

export default function ExportarTab({ estadisticas, movimientos, onExportar }) {
    const cards = [
        {
            tipo: "stock", icon: "📦", titulo: "Inventario Completo",
            desc: "Todos los productos con stock y valores",
            stats: [`${estadisticas.totalItems} productos`, formatCurrency(estadisticas.valorTotalStock)]
        },
        {
            tipo: "movimientos", icon: "📋", titulo: "Historial de Movimientos",
            desc: "Todos los ingresos y repartos registrados",
            stats: [`${movimientos.length} movimientos`, `${movimientos.filter(m => m.tipo === "ingreso").length} ingresos`]
        },
        {
            tipo: "stock_bajo", icon: "⚠️", titulo: "Stock Bajo / Crítico",
            desc: "Productos que requieren reabastecimiento",
            stats: [`${estadisticas.itemsBajoStock} productos`, `${estadisticas.itemsSinStock} sin stock`]
        },
    ];

    return (
        <div className={s.panel}>
            <div className={s.panelHeader}>
                <h3 className={s.panelTitle}>📤 Exportar Datos</h3>
            </div>

            <div className={s.exportGrid}>
                {cards.map(c => (
                    <button key={c.tipo} className={s.exportCard} onClick={() => onExportar(c.tipo)}>
                        <span className={s.exportCardIcon}>{c.icon}</span>
                        <h4 className={s.exportCardTitle}>{c.titulo}</h4>
                        <p className={s.exportCardDesc}>{c.desc}</p>
                        <div className={s.exportCardStats}>
                            {c.stats.map((st, i) => <span key={i}>{st}</span>)}
                        </div>
                    </button>
                ))}
            </div>

            <div className={s.exportInfo}>
                <strong>📝 Información:</strong> Los archivos se exportan en formato CSV compatible con Excel.
                Los datos incluyen cálculos de valor total automáticos.
            </div>
        </div>
    );
}
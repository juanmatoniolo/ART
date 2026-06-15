"use client";
import Icon from "./Icon";
import { formatCurrency } from "../utils/farmacia";

export default function ExportarTab({ estadisticas, movimientos, onExportar }) {
    const cards = [
        {
            tipo: "stock", icon: "box", titulo: "Inventario completo",
            desc: "Todos los productos con stock y valores",
            stats: [`${estadisticas.totalItems} productos`, formatCurrency(estadisticas.valorTotalStock)],
        },
        {
            tipo: "movimientos", icon: "list", titulo: "Historial de movimientos",
            desc: "Todos los ingresos y repartos registrados",
            stats: [`${movimientos.length} movimientos`, `${movimientos.filter(m => m.tipo === "ingreso").length} ingresos`],
        },
        {
            tipo: "stock_bajo", icon: "alert", titulo: "Stock bajo / crítico",
            desc: "Productos que requieren reabastecimiento",
            stats: [`${estadisticas.itemsBajoStock} productos`, `${estadisticas.itemsSinStock} sin stock`],
        },
    ];

    return (
        <div className="fxexp">
            <h2><Icon name="upload2" size={24} /> Exportar datos</h2>
            <p className="fxexp-intro">Tocá una opción para descargar el archivo (CSV, se abre con Excel).</p>

            <div className="fxexp-grid">
                {cards.map(c => (
                    <button key={c.tipo} className="fxexp-card" onClick={() => onExportar(c.tipo)}>
                        <span className="fxexp-ic"><Icon name={c.icon} size={28} /></span>
                        <span className="fxexp-titulo">{c.titulo}</span>
                        <span className="fxexp-desc">{c.desc}</span>
                        <span className="fxexp-stats">{c.stats.map((st, i) => <span key={i}>{st}</span>)}</span>
                        <span className="fxexp-go"><Icon name="download" size={20} /> Descargar</span>
                    </button>
                ))}
            </div>

            <style>{`
                .fxexp { display: flex; flex-direction: column; gap: 8px; color: #1f2937; }
                .fxexp h2 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 24px; font-weight: 800; }
                .fxexp-intro { margin: 0 0 8px; color: #6b7280; font-size: 15px; }
                .fxexp-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
                .fxexp-card {
                    text-align: left; background: #fff; border: 2px solid #e5e7eb; border-radius: 16px;
                    padding: 18px; cursor: pointer; display: flex; flex-direction: column; gap: 8px;
                }
                .fxexp-card:active { border-color: #2563eb; background: #f8faff; }
                .fxexp-ic { width: 52px; height: 52px; border-radius: 14px; background: #eff6ff; color: #2563eb; display: flex; align-items: center; justify-content: center; }
                .fxexp-titulo { font-size: 19px; font-weight: 800; }
                .fxexp-desc { font-size: 15px; color: #6b7280; }
                .fxexp-stats { display: flex; gap: 8px; flex-wrap: wrap; }
                .fxexp-stats span { background: #f3f4f6; color: #374151; font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
                .fxexp-go { display: inline-flex; align-items: center; gap: 8px; margin-top: 4px; color: #2563eb; font-weight: 800; font-size: 16px; }

                @media (min-width: 768px) { .fxexp-grid { grid-template-columns: repeat(3, 1fr); } }
            `}</style>
        </div>
    );
}
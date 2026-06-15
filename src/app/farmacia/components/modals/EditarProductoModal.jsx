"use client";
import { useState } from "react";
import Icon from "../Icon";
import { Overlay, Header, Field } from "./AgregarModal";
import { formatCurrency } from "../../utils/farmacia";

export default function EditarProductoModal({ item, onClose, onSubmit }) {
    const [precio, setPrecio] = useState(String(item.precio));
    const [stockMinimo, setStockMinimo] = useState(String(item.stockMinimo));
    const [stockActual, setStockActual] = useState(String(item.stockActual));
    const [loading, setLoading] = useState(false);

    const valido = parseFloat(precio) > 0;

    const handleSubmit = async () => {
        if (!valido) return;
        setLoading(true);
        // El hook editarProducto espera UN solo objeto (item + cambios).
        const ok = await onSubmit({
            ...item,
            precio: parseFloat(precio),
            precioReferencia: parseFloat(precio),
            stockMinimo: parseInt(stockMinimo) || 10,
            stockActual: parseInt(stockActual) || 0,
        });
        setLoading(false);
        if (ok) onClose();
    };

    return (
        <Overlay onClose={onClose}>
            <Header icon="edit" title="Editar producto" onClose={onClose} />
            <div className="fxm-body">
                <div className="fxe-prod">
                    <span className="fxe-ic"><Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={26} /></span>
                    <div>
                        <p className="fxe-name">{item.nombre.replace(/_/g, " ")}</p>
                        <p className="fxe-meta">{item.tipo === "medicamento" ? "Medicamento" : "Descartable"} · {item.presentacion}</p>
                    </div>
                </div>

                <div className="fxm-grid2">
                    <Field label="Precio de costo ($)">
                        <input className="fxm-input" type="number" step="0.01" min="0.01" inputMode="decimal"
                            value={precio} onChange={e => setPrecio(e.target.value)} />
                    </Field>
                    <Field label="Stock actual">
                        <input className="fxm-input" type="number" min="0" inputMode="numeric"
                            value={stockActual} onChange={e => setStockActual(e.target.value)} />
                    </Field>
                    <Field label="Stock mínimo (alerta)">
                        <input className="fxm-input" type="number" min="1" inputMode="numeric"
                            value={stockMinimo} onChange={e => setStockMinimo(e.target.value)} />
                    </Field>
                </div>
            </div>
            <div className="fxm-footer">
                <button className="fxm-btn ghost" onClick={onClose}>Cancelar</button>
                <button className="fxm-btn primary" onClick={handleSubmit} disabled={!valido || loading}>
                    <Icon name="check" size={20} /> {loading ? "Guardando..." : "Guardar"}
                </button>
            </div>

            <style>{`
                .fxe-prod { display: flex; align-items: center; gap: 12px; background: #f9fafb; border: 1px solid #eef0f2; border-radius: 14px; padding: 14px; }
                .fxe-ic { color: #2563eb; display: flex; }
                .fxe-name { margin: 0; font-size: 18px; font-weight: 800; }
                .fxe-meta { margin: 3px 0 0; font-size: 14px; color: #6b7280; }
            `}</style>
        </Overlay>
    );
}
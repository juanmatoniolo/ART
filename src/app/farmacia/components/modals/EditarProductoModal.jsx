"use client";
import { useState } from "react";
import s from "../../farmaciaDashboard.module.css";
import { Overlay, CloseBtn, Field } from "./AgregarModal";
import { formatCurrency } from "../../utils/farmacia";

export default function EditarProductoModal({ item, onClose, onSubmit }) {
    const [precio, setPrecio] = useState(String(item.precio));
    const [stockMinimo, setStockMinimo] = useState(String(item.stockMinimo));
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!precio || parseFloat(precio) <= 0) return;
        setLoading(true);
        const ok = await onSubmit(item, {
            precio: parseFloat(precio),
            stockMinimo: parseInt(stockMinimo) || 10,
        });
        setLoading(false);
        if (ok) onClose();
    };

    return (
        <Overlay onClose={onClose}>
            <div className={s.modalHeader}>
                <h3 className={s.modalTitle}>✏️ Editar Producto</h3>
                <CloseBtn onClick={onClose} />
            </div>

            <div className={s.modalBody}>
                {/* Info del producto (readonly) */}
                <div className={s.editProductInfo}>
                    <span className={s.editProductIcon}>
                        {item.tipo === "medicamento" ? "💊" : "🧷"}
                    </span>
                    <div>
                        <p className={s.editProductName}>{item.nombre.replace(/_/g, " ")}</p>
                        <p className={s.editProductMeta}>
                            {item.tipo === "medicamento" ? "Medicamento" : "Descartable"} · {item.presentacion}
                        </p>
                    </div>
                </div>

                <div className={s.editCurrentValues}>
                    <div className={s.editCurrentItem}>
                        <span className={s.editCurrentLabel}>Precio actual</span>
                        <span className={s.editCurrentValue}>{formatCurrency(item.precio)}</span>
                    </div>
                    <div className={s.editCurrentItem}>
                        <span className={s.editCurrentLabel}>Stock mínimo actual</span>
                        <span className={s.editCurrentValue}>{item.stockMinimo}</span>
                    </div>
                    <div className={s.editCurrentItem}>
                        <span className={s.editCurrentLabel}>Stock actual</span>
                        <span className={s.editCurrentValue}>{item.stockActual}</span>
                    </div>
                </div>

                <div className={s.formGrid2}>
                    <Field label="Nuevo precio ($)">
                        <input
                            className={s.formInput}
                            type="number" step="0.01" min="0.01"
                            value={precio}
                            onChange={e => setPrecio(e.target.value)}
                        />
                    </Field>
                    <Field label="Nuevo stock mínimo">
                        <input
                            className={s.formInput}
                            type="number" min="1"
                            value={stockMinimo}
                            onChange={e => setStockMinimo(e.target.value)}
                        />
                    </Field>
                </div>
            </div>

            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                <button
                    className={`${s.actionBtn} ${s.btn_primary}`}
                    onClick={handleSubmit}
                    disabled={loading || !precio || parseFloat(precio) <= 0}
                >
                    {loading ? "Guardando..." : "Guardar cambios"}
                </button>
            </div>
        </Overlay>
    );
}
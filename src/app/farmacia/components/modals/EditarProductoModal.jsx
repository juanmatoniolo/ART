"use client";
import { useState } from "react";
import Icon from "../Icon";
import { Overlay, Header, Field } from "./AgregarModal";
import s from "../../farmaciaDashboard.module.css";

export default function EditarProductoModal({ item, onClose, onSubmit }) {
    const [precioCosto, setPrecioCosto] = useState(
        String(item.precioCosto ?? item.precio ?? "")
    );
    const [precioFacturacion, setPrecioFacturacion] = useState(
        String(item.precioFacturacion ?? "")
    );
    const [precioOtros, setPrecioOtros] = useState(
        String(item.precioOtros ?? "")
    );
    const [stockMinimo, setStockMinimo] = useState(String(item.stockMinimo ?? ""));
    const [stockActual, setStockActual] = useState(String(item.stockActual ?? ""));
    const [loading, setLoading] = useState(false);

    const valido = parseFloat(precioCosto) > 0;

    const handleSubmit = async () => {
        if (!valido) return;
        setLoading(true);
        const ok = await onSubmit({
            ...item,
            precioCosto: parseFloat(precioCosto),
            precioFacturacion: parseFloat(precioFacturacion) || 0,
            precioOtros: parseFloat(precioOtros) || 0,
            stockMinimo: parseInt(stockMinimo) || 10,
            stockActual: parseInt(stockActual) || 0,
        });
        setLoading(false);
        if (ok) onClose();
    };

    return (
        <Overlay onClose={onClose}>
            <Header icon="edit" title="Editar producto" onClose={onClose} />
            <div className={s.modalBody}>
                <div className={s.editProductInfo}>
                    <span className={s.editProductIcon}><Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={26} /></span>
                    <div>
                        <p className={s.editProductName}>{item.nombre.replace(/_/g, " ")}</p>
                        <p className={s.editProductMeta}>{item.tipo === "medicamento" ? "Medicamento" : "Descartable"} · {item.presentacion}</p>
                    </div>
                </div>

                <Field label="Precio de costo ($) *">
                    <input className={s.formInput} type="number" step="0.01" min="0.01" inputMode="decimal"
                        value={precioCosto} onChange={e => setPrecioCosto(e.target.value)} />
                </Field>

                <div className={s.formGrid2}>
                    <Field label="Precio facturación ($)">
                        <input className={s.formInput} type="number" step="0.01" min="0" inputMode="decimal"
                            value={precioFacturacion} onChange={e => setPrecioFacturacion(e.target.value)} />
                    </Field>
                    <Field label="Otros precios ($)">
                        <input className={s.formInput} type="number" step="0.01" min="0" inputMode="decimal"
                            value={precioOtros} onChange={e => setPrecioOtros(e.target.value)} />
                    </Field>
                </div>

                <div className={s.formGrid2}>
                    <Field label="Stock actual">
                        <input className={s.formInput} type="number" min="0" inputMode="numeric"
                            value={stockActual} onChange={e => setStockActual(e.target.value)} />
                    </Field>
                    <Field label="Stock mínimo (alerta)">
                        <input className={s.formInput} type="number" min="1" inputMode="numeric"
                            value={stockMinimo} onChange={e => setStockMinimo(e.target.value)} />
                    </Field>
                </div>
            </div>
            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={handleSubmit} disabled={!valido || loading}>
                    <Icon name="check" size={20} /> {loading ? "Guardando..." : "Guardar"}
                </button>
            </div>
        </Overlay>
    );
}
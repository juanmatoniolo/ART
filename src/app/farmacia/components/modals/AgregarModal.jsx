"use client";
import { useState } from "react";
import s from "../../farmaciaDashboard.module.css";

const PRESENTACIONES = {
    medicamento: ["ampolla", "vial", "tabletas", "frasco", "bolsa", "jeringa", "gasas", "tubo", "tiras"],
    descartable: ["unidad", "rollo", "juego", "bolsa", "frasco", "kit", "set", "tubo"],
};

const INITIAL = { nombre: "", tipo: "medicamento", presentacion: "ampolla", precio: "", stockActual: "0", stockMinimo: "10" };

export default function AgregarModal({ onClose, onSubmit }) {
    const [form, setForm] = useState(INITIAL);

    const set_ = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleTipo = (tipo) => setForm(f => ({
        ...f, tipo,
        presentacion: tipo === "medicamento" ? "ampolla" : "unidad"
    }));

    const handleSubmit = async () => {
        const ok = await onSubmit(form);
        if (ok) { setForm(INITIAL); onClose(); }
    };

    return (
        <Overlay onClose={onClose}>
            <div className={s.modalHeader}>
                <h3 className={s.modalTitle}>➕ Nuevo Producto</h3>
                <CloseBtn onClick={onClose} />
            </div>
            <div className={s.modalBody}>
                <div className={s.formGrid2}>
                    <Field label="Nombre *">
                        <input className={s.formInput} value={form.nombre}
                            onChange={e => set_("nombre", e.target.value)} placeholder="Ej: Paracetamol 500mg" />
                    </Field>
                    <Field label="Tipo">
                        <select className={s.formSelect} value={form.tipo} onChange={e => handleTipo(e.target.value)}>
                            <option value="medicamento">💊 Medicamento</option>
                            <option value="descartable">🧷 Descartable</option>
                        </select>
                    </Field>
                    <Field label="Presentación">
                        <select className={s.formSelect} value={form.presentacion} onChange={e => set_("presentacion", e.target.value)}>
                            {PRESENTACIONES[form.tipo].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </Field>
                    <Field label="Precio unitario ($) *">
                        <input className={s.formInput} type="number" step="0.01" min="0" value={form.precio}
                            onChange={e => set_("precio", e.target.value)} placeholder="0.00" />
                    </Field>
                    <Field label="Stock inicial">
                        <input className={s.formInput} type="number" min="0" value={form.stockActual}
                            onChange={e => set_("stockActual", e.target.value)} />
                    </Field>
                    <Field label="Stock mínimo *">
                        <input className={s.formInput} type="number" min="1" value={form.stockMinimo}
                            onChange={e => set_("stockMinimo", e.target.value)} />
                    </Field>
                </div>
            </div>
            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={handleSubmit}>Agregar Producto</button>
            </div>
        </Overlay>
    );
}

export function Overlay({ onClose, children, wide }) {
    return (
        <div className={s.overlay} onClick={onClose}>
            <div className={`${s.modal} ${wide ? s.modalWide : ""}`} onClick={e => e.stopPropagation()}>
                {children}
            </div>
        </div>
    );
}

export function CloseBtn({ onClick }) {
    return <button className={s.closeBtn} onClick={onClick}>✕</button>;
}

export function Field({ label, children }) {
    return (
        <div className={s.formField}>
            <label className={s.formLabel}>{label}</label>
            {children}
        </div>
    );
}
"use client";
import { useState } from "react";
import Icon from "../Icon";
import s from "../../farmaciaDashboard.module.css";

const PRESENTACIONES = {
    medicamento: ["ampolla", "vial", "tabletas", "frasco", "bolsa", "jeringa", "gasas", "tubo", "tiras"],
    descartable: ["unidad", "rollo", "juego", "bolsa", "frasco", "kit", "set", "tubo"],
};

const INITIAL = {
    nombre: "",
    tipo: "medicamento",
    presentacion: "ampolla",
    precioCosto: "",
    precioFacturacion: "",
    precioOtros: "",
    stockActual: "0",
    stockMinimo: "10"
};

export default function AgregarModal({ onClose, onSubmit }) {
    const [form, setForm] = useState(INITIAL);
    const [loading, setLoading] = useState(false);

    const set_ = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const handleTipo = (tipo) => setForm(f => ({ ...f, tipo, presentacion: tipo === "medicamento" ? "ampolla" : "unidad" }));

    const valido = form.nombre.trim() && parseFloat(form.precioCosto) > 0;

    const handleSubmit = async () => {
        if (!valido) return;
        setLoading(true);
        const ok = await onSubmit({
            nombre: form.nombre.trim(),
            tipo: form.tipo,
            presentacion: form.presentacion,
            precioCosto: parseFloat(form.precioCosto),
            precioFacturacion: parseFloat(form.precioFacturacion) || 0,
            precioOtros: parseFloat(form.precioOtros) || 0,
            stockActual: parseInt(form.stockActual) || 0,
            stockMinimo: parseInt(form.stockMinimo) || 10,
        });
        setLoading(false);
        if (ok) { setForm(INITIAL); onClose(); }
    };

    return (
        <Overlay onClose={onClose}>
            <Header icon="plus" title="Nuevo producto" onClose={onClose} />
            <div className={s.modalBody}>
                <div className={s.formField}>
                    <label className={s.formLabel}>Nombre del producto</label>
                    <input className={s.formInput} value={form.nombre}
                        onChange={e => set_("nombre", e.target.value)} placeholder="Ej: Paracetamol 500mg" autoFocus />
                </div>

                <div className={s.formField}>
                    <label className={s.formLabel}>Tipo</label>
                    <div className={s.precioChips} style={{ gap: '0.5rem' }}>
                        <button className={`${s.precioChip} ${form.tipo === "medicamento" ? s.precioChipActive : ""}`} onClick={() => handleTipo("medicamento")}>
                            <Icon name="pills" size={22} /> Medicamento
                        </button>
                        <button className={`${s.precioChip} ${form.tipo === "descartable" ? s.precioChipActive : ""}`} onClick={() => handleTipo("descartable")}>
                            <Icon name="box" size={22} /> Descartable
                        </button>
                    </div>
                </div>

                <div className={s.formGrid2}>
                    <div className={s.formField}>
                        <label className={s.formLabel}>Presentación</label>
                        <select className={s.formSelect} value={form.presentacion} onChange={e => set_("presentacion", e.target.value)}>
                            {PRESENTACIONES[form.tipo].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </div>
                </div>

                <div className={s.formField}>
                    <label className={s.formLabel}>Precio de costo ($) *</label>
                    <input className={s.formInput} type="number" step="0.01" min="0.01" value={form.precioCosto}
                        onChange={e => set_("precioCosto", e.target.value)} placeholder="0.00" inputMode="decimal" />
                </div>

                <div className={s.formGrid2}>
                    <div className={s.formField}>
                        <label className={s.formLabel}>Precio facturación ($)</label>
                        <input className={s.formInput} type="number" step="0.01" min="0" value={form.precioFacturacion}
                            onChange={e => set_("precioFacturacion", e.target.value)} placeholder="0.00" inputMode="decimal" />
                    </div>
                    <div className={s.formField}>
                        <label className={s.formLabel}>Otros precios ($)</label>
                        <input className={s.formInput} type="number" step="0.01" min="0" value={form.precioOtros}
                            onChange={e => set_("precioOtros", e.target.value)} placeholder="0.00" inputMode="decimal" />
                    </div>
                </div>

                <div className={s.formGrid2}>
                    <div className={s.formField}>
                        <label className={s.formLabel}>Stock inicial</label>
                        <input className={s.formInput} type="number" min="0" value={form.stockActual}
                            onChange={e => set_("stockActual", e.target.value)} inputMode="numeric" />
                    </div>
                    <div className={s.formField}>
                        <label className={s.formLabel}>Stock mínimo (alerta)</label>
                        <input className={s.formInput} type="number" min="1" value={form.stockMinimo}
                            onChange={e => set_("stockMinimo", e.target.value)} inputMode="numeric" />
                    </div>
                </div>
            </div>
            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={handleSubmit} disabled={!valido || loading}>
                    <Icon name="check" size={20} /> {loading ? "Guardando..." : "Agregar"}
                </button>
            </div>
        </Overlay>
    );
}

/* ─── Primitivas compartidas ─────────────── */
export function Overlay({ onClose, children, wide }) {
    return (
        <div className={s.overlay} onClick={onClose}>
            <div className={`${s.modal} ${wide ? s.modalWide : ""}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                {children}
            </div>
        </div>
    );
}

export function Header({ icon, title, onClose, tone }) {
    const style = tone === 'danger' ? { background: 'var(--c-red)' } : {};
    return (
        <div className={s.modalHeader} style={style}>
            <h3 className={s.modalTitle}>{icon && <Icon name={icon} size={24} />} {title}</h3>
            <CloseBtn onClick={onClose} />
        </div>
    );
}

export function CloseBtn({ onClick }) {
    return <button className={s.closeBtn} onClick={onClick} aria-label="Cerrar"><Icon name="close" size={22} /></button>;
}

export function Field({ label, children }) {
    return (
        <div className={s.formField}>
            <label className={s.formLabel}>{label}</label>
            {children}
        </div>
    );
}
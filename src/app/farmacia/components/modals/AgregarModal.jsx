"use client";
import { useState } from "react";
import Icon from "../Icon";

const PRESENTACIONES = {
    medicamento: ["ampolla", "vial", "tabletas", "frasco", "bolsa", "jeringa", "gasas", "tubo", "tiras"],
    descartable: ["unidad", "rollo", "juego", "bolsa", "frasco", "kit", "set", "tubo"],
};

const INITIAL = { nombre: "", tipo: "medicamento", presentacion: "ampolla", precio: "", stockActual: "0", stockMinimo: "10" };

export default function AgregarModal({ onClose, onSubmit }) {
    const [form, setForm] = useState(INITIAL);
    const [loading, setLoading] = useState(false);

    const set_ = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const handleTipo = (tipo) => setForm(f => ({ ...f, tipo, presentacion: tipo === "medicamento" ? "ampolla" : "unidad" }));

    const valido = form.nombre.trim() && parseFloat(form.precio) > 0;

    const handleSubmit = async () => {
        if (!valido) return;
        setLoading(true);
        const ok = await onSubmit(form);
        setLoading(false);
        if (ok) { setForm(INITIAL); onClose(); }
    };

    return (
        <Overlay onClose={onClose}>
            <Header icon="plus" title="Nuevo producto" onClose={onClose} />
            <div className="fxm-body">
                <Field label="Nombre del producto">
                    <input className="fxm-input" value={form.nombre}
                        onChange={e => set_("nombre", e.target.value)} placeholder="Ej: Paracetamol 500mg" autoFocus />
                </Field>

                <Field label="Tipo">
                    <div className="fxm-toggle">
                        <button className={"fxm-toggle-btn" + (form.tipo === "medicamento" ? " on" : "")} onClick={() => handleTipo("medicamento")}>
                            <Icon name="pills" size={22} /> Medicamento
                        </button>
                        <button className={"fxm-toggle-btn" + (form.tipo === "descartable" ? " on" : "")} onClick={() => handleTipo("descartable")}>
                            <Icon name="box" size={22} /> Descartable
                        </button>
                    </div>
                </Field>

                <div className="fxm-grid2">
                    <Field label="Presentación">
                        <select className="fxm-select" value={form.presentacion} onChange={e => set_("presentacion", e.target.value)}>
                            {PRESENTACIONES[form.tipo].map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                    </Field>
                    <Field label="Precio de costo ($)">
                        <input className="fxm-input" type="number" step="0.01" min="0" value={form.precio}
                            onChange={e => set_("precio", e.target.value)} placeholder="0.00" inputMode="decimal" />
                    </Field>
                    <Field label="Stock inicial">
                        <input className="fxm-input" type="number" min="0" value={form.stockActual}
                            onChange={e => set_("stockActual", e.target.value)} inputMode="numeric" />
                    </Field>
                    <Field label="Stock mínimo (alerta)">
                        <input className="fxm-input" type="number" min="1" value={form.stockMinimo}
                            onChange={e => set_("stockMinimo", e.target.value)} inputMode="numeric" />
                    </Field>
                </div>
            </div>
            <div className="fxm-footer">
                <button className="fxm-btn ghost" onClick={onClose}>Cancelar</button>
                <button className="fxm-btn primary" onClick={handleSubmit} disabled={!valido || loading}>
                    <Icon name="check" size={20} /> {loading ? "Guardando..." : "Agregar"}
                </button>
            </div>
        </Overlay>
    );
}

/* ─── Primitivas compartidas (las usan todos los modales) ─────────────── */
export function Overlay({ onClose, children, wide }) {
    return (
        <div className="fxm-overlay" onClick={onClose}>
            <div className={"fxm-modal" + (wide ? " wide" : "")} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                {children}
            </div>
            <style>{CSS}</style>
        </div>
    );
}

export function Header({ icon, title, onClose, tone }) {
    return (
        <div className={"fxm-head" + (tone ? " " + tone : "")}>
            <h3 className="fxm-title">{icon && <Icon name={icon} size={24} />} {title}</h3>
            <CloseBtn onClick={onClose} />
        </div>
    );
}

export function CloseBtn({ onClick }) {
    return <button className="fxm-close" onClick={onClick} aria-label="Cerrar"><Icon name="close" size={22} /></button>;
}

export function Field({ label, children }) {
    return (
        <div className="fxm-field">
            <label className="fxm-label">{label}</label>
            {children}
        </div>
    );
}

const CSS = `
.fxm-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(15,23,42,.5);
    display: flex; align-items: flex-end; justify-content: center; padding: 0; }
.fxm-modal { background: #fff; width: 100%; max-width: 560px; max-height: 92vh;
    border-radius: 22px 22px 0 0; display: flex; flex-direction: column; overflow: hidden;
    box-shadow: 0 -8px 40px rgba(0,0,0,.2); animation: fxm-up .22s ease; color: #1f2937; }
.fxm-modal.wide { max-width: 920px; }
@keyframes fxm-up { from { transform: translateY(30px); opacity: .6 } to { transform: none; opacity: 1 } }

.fxm-head { display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 16px 18px; border-bottom: 1px solid #e5e7eb; background: #2563eb; color: #fff; }
.fxm-head.danger { background: #dc2626; }
.fxm-head.success { background: #059669; }
.fxm-head.warning { background: #d97706; }
.fxm-title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 20px; font-weight: 800; }
.fxm-close { background: rgba(255,255,255,.18); border: none; color: #fff; cursor: pointer;
    width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
.fxm-close:active { background: rgba(255,255,255,.3); }

.fxm-body { padding: 18px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.fxm-footer { display: flex; gap: 10px; padding: 14px 18px; border-top: 1px solid #e5e7eb; background: #fafafa; }
.fxm-footer .fxm-btn { flex: 1; }

.fxm-field { display: flex; flex-direction: column; gap: 6px; }
.fxm-label { font-size: 15px; font-weight: 700; color: #374151; }
.fxm-input, .fxm-select { width: 100%; box-sizing: border-box; font-size: 18px; min-height: 54px;
    padding: 0 14px; border: 2px solid #d1d5db; border-radius: 12px; background: #fff; color: #1f2937; }
.fxm-input:focus, .fxm-select:focus { outline: none; border-color: #2563eb; }
.fxm-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.fxm-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.fxm-toggle-btn { display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 16px; font-weight: 700; min-height: 54px; border-radius: 12px;
    border: 2px solid #d1d5db; background: #fff; color: #6b7280; cursor: pointer; }
.fxm-toggle-btn.on { border-color: #2563eb; background: #eff6ff; color: #1e3a8a; }

.fxm-btn { display: flex; align-items: center; justify-content: center; gap: 8px;
    font-size: 17px; font-weight: 800; min-height: 54px; padding: 0 18px;
    border-radius: 12px; border: none; cursor: pointer; }
.fxm-btn.primary { background: #2563eb; color: #fff; }
.fxm-btn.danger { background: #dc2626; color: #fff; }
.fxm-btn.ghost { background: #fff; color: #374151; border: 2px solid #d1d5db; }
.fxm-btn:disabled { opacity: .5; cursor: not-allowed; }

@media (min-width: 768px) {
    .fxm-overlay { align-items: center; padding: 20px; }
    .fxm-modal { border-radius: 22px; }
}
`;
"use client";
import { useState } from "react";
import s from "../../farmaciaDashboard.module.css";
import Icon from "../Icon";

export default function ExportarPreciosModal({ listas = [], onExportar, onClose }) {
    const activas = [...listas].filter(l => l.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0));
    const [seleccion, setSeleccion] = useState(() => activas.map(l => l.id));

    const toggle = (id) => setSeleccion(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    const todas = seleccion.length === activas.length && activas.length > 0;
    const toggleTodas = () => setSeleccion(todas ? [] : activas.map(l => l.id));
    const exportar = () => { if (seleccion.length) { onExportar(seleccion); onClose(); } };

    return (
        <div className={s.overlay} onClick={onClose}>
            <div className={s.modal} onClick={e => e.stopPropagation()}>
                <div className={s.modalHeader}>
                    <h3 className={s.modalTitle}><Icon name="download" size={20} /> Exportar listas de precios</h3>
                    <button className={s.closeBtn} onClick={onClose}><Icon name="close" size={18} /></button>
                </div>

                <div className={s.modalBody}>
                    <p className={s.expSelInfo}>Elegí qué listas incluir. El CSV traerá una columna por lista.</p>

                    <button className={`${s.expSelRow} ${s.expSelRowAll} ${todas ? s.expSelRowOn : ""}`} onClick={toggleTodas}>
                        <span className={`${s.expSelCheck} ${s.svgIc}`}>{todas && <Icon name="check" size={16} />}</span>
                        <span className={s.expSelName}>Seleccionar todas</span>
                        <span className={s.expSelCount}>{activas.length}</span>
                    </button>

                    <div className={s.expSelList} style={{ marginTop: ".5rem" }}>
                        {activas.map(l => {
                            const on = seleccion.includes(l.id);
                            return (
                                <button key={l.id} className={`${s.expSelRow} ${on ? s.expSelRowOn : ""}`} onClick={() => toggle(l.id)}>
                                    <span className={`${s.expSelCheck} ${s.svgIc}`}>{on && <Icon name="check" size={16} />}</span>
                                    <span className={s.expSelName}>{l.nombre}</span>
                                    <span className={s.expSelMult}>×{l.multiplicador}</span>
                                </button>
                            );
                        })}
                        {activas.length === 0 && <p style={{ color: "var(--c-muted)" }}>No hay listas creadas.</p>}
                    </div>
                </div>

                <div className={s.modalFooter}>
                    <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                    <button className={`${s.actionBtn} ${s.btn_secondary}`} onClick={exportar} disabled={!seleccion.length}>
                        <Icon name="download" size={18} /> Exportar ({seleccion.length})
                    </button>
                </div>
            </div>
        </div>
    );
}
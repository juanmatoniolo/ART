"use client";
import { useState } from "react";
import s from "../../farmaciaDashboard.module.css";
import Icon from "../Icon";

const VACIA = { nombre: "", multiplicador: "1.5" };

export default function GestionarListasModal({ listas = [], onGuardar, onEliminar, onClose }) {
    const [form, setForm] = useState(VACIA);
    const [editId, setEditId] = useState(null);
    const [guardando, setGuardando] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
    const editar = (l) => { setEditId(l.id); setForm({ nombre: l.nombre, multiplicador: String(l.multiplicador) }); };
    const cancelar = () => { setEditId(null); setForm(VACIA); };

    const mult = parseFloat(form.multiplicador) || 0;
    const recargo = mult > 0 ? Math.round((mult - 1) * 100) : 0;
    const valido = form.nombre.trim() && mult > 0;

    const guardar = async () => {
        if (!valido) return;
        setGuardando(true);
        const payload = {
            ...(editId ? { id: editId } : {}),
            nombre: form.nombre.trim(), multiplicador: mult, activo: true,
            orden: editId ? (listas.find(l => l.id === editId)?.orden ?? listas.length) : listas.length,
        };
        const ok = await onGuardar(payload);
        setGuardando(false);
        if (ok) cancelar();
    };

    const eliminar = async (l) => {
        if (!confirm(`¿Eliminar la lista "${l.nombre}"?`)) return;
        await onEliminar(l.id);
        if (editId === l.id) cancelar();
    };

    return (
        <div className={s.overlay} onClick={onClose}>
            <div className={`${s.modal} ${s.modalWide}`} onClick={e => e.stopPropagation()}>
                <div className={s.modalHeader}>
                    <h3 className={s.modalTitle}><Icon name="settings" size={20} /> Gestionar Listas de Precios</h3>
                    <button className={s.closeBtn} onClick={onClose}><Icon name="close" size={18} /></button>
                </div>

                <div className={s.modalBody}>
                    <div className={s.gestionGrid}>
                        {/* Formulario */}
                        <div className={`${s.gestionBox} ${s.gestionBoxAlt}`}>
                            <p className={s.gestionTitle}>{editId ? "Editar lista" : "Nueva lista"}</p>

                            <div className={s.formField}>
                                <label className={s.formLabel}>Nombre de la lista</label>
                                <input className={s.formInput} placeholder="Ej: Venta, Mesa de entrada, Facturación"
                                    value={form.nombre} onChange={e => set("nombre", e.target.value)} />
                            </div>

                            <div className={s.formField} style={{ marginTop: ".75rem" }}>
                                <label className={s.formLabel}>Multiplicar el costo por</label>
                                <div className={s.gestionMultRow}>
                                    <span className={s.gestionMultSign}>×</span>
                                    <input className={s.formInput} style={{ width: 110 }} type="number" step="0.1" min="0"
                                        value={form.multiplicador} onChange={e => set("multiplicador", e.target.value)} />
                                    <span className={s.gestionHint}>({recargo >= 0 ? "+" : ""}{recargo}% sobre el costo)</span>
                                </div>
                            </div>

                            <div className={s.gestionExample}>
                                Ejemplo: costo $10.000 → <strong>${(10000 * mult).toLocaleString("es-AR")}</strong>
                            </div>

                            <div style={{ display: "flex", gap: ".5rem", justifyContent: "flex-end" }}>
                                {editId && <button className={s.btnCancel} onClick={cancelar}>Cancelar</button>}
                                <button className={`${s.actionBtn} ${s.btn_primary}`} disabled={!valido || guardando} onClick={guardar}>
                                    <Icon name="check" size={18} /> {guardando ? "Guardando..." : editId ? "Guardar" : "Crear lista"}
                                </button>
                            </div>

                            <p className={s.gestionTip}>Referencia: Mesa de entrada = ×1.5 · Venta = ×8</p>
                        </div>

                        {/* Listado */}
                        <div className={s.gestionBox}>
                            <p className={s.gestionTitle}>Listas actuales ({listas.length})</p>
                            {listas.length === 0 ? (
                                <p style={{ color: "var(--c-muted)" }}>Aún no hay listas. Creá la primera.</p>
                            ) : (
                                [...listas].sort((a, b) => (a.orden || 0) - (b.orden || 0)).map(l => (
                                    <div key={l.id} className={s.gestionItem}>
                                        <div>
                                            <p className={s.gestionItemName}>{l.nombre}</p>
                                            <p className={s.gestionItemMeta}>×{l.multiplicador} · +{Math.round((l.multiplicador - 1) * 100)}%</p>
                                        </div>
                                        <div className={s.tableActions}>
                                            <button className={`${s.iconBtn} ${s.svgIc}`} onClick={() => editar(l)} title="Editar"><Icon name="edit" size={18} /></button>
                                            <button className={`${s.iconBtn} ${s.iconBtnDanger} ${s.svgIc}`} onClick={() => eliminar(l)} title="Eliminar"><Icon name="trash" size={18} /></button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className={s.modalFooter}>
                    <button className={s.btnCancel} onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}
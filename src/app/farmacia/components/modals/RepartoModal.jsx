"use client";
import { useState, useMemo, useEffect } from "react";
import Icon from "../Icon";
import { Overlay, Header, Field } from "./AgregarModal";
import { normalizeText, formatCurrency } from "../../utils/farmacia";
import s from "../../farmaciaDashboard.module.css";

const DESTINOS = ["Guardia", "Primer Piso", "Segundo Piso", "Quirófano", "UTI",
    "Pediatría", "Maternidad", "Administración", "Depósito", "Otro"];

export default function RepartoModal({ onClose, onSubmit, items }) {
    const [paso, setPaso] = useState("datos");
    const [destino, setDestino] = useState("Guardia");
    const [responsable, setResp] = useState("");
    const [nota, setNota] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [sugerencias, setSug] = useState([]);
    const [seleccionados, setSel] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!busqueda.trim()) { setSug([]); return; }
        const q = normalizeText(busqueda);
        setSug(items.filter(i => i.stockActual > 0 && normalizeText(i.nombre).includes(q)).slice(0, 8));
    }, [busqueda, items]);

    const agregar = (item) => {
        setBusqueda(""); setSug([]);
        if (seleccionados.find(p => p.id === item.id)) return;
        setSel(prev => [...prev, { ...item, cantidad: 1, stockAnterior: item.stockActual, stockNuevo: item.stockActual - 1 }]);
    };
    const setCantidad = (id, val) => {
        setSel(prev => prev.map(p => {
            if (p.id !== id) return p;
            const n = Math.max(1, Math.min(parseInt(val) || 1, p.stockAnterior));
            return { ...p, cantidad: n, stockNuevo: p.stockAnterior - n };
        }));
    };
    const quitar = (id) => setSel(prev => prev.filter(p => p.id !== id));

    const totales = useMemo(() => seleccionados.reduce((a, p) => ({
        unidades: a.unidades + p.cantidad,
        valor: a.valor + p.cantidad * (p.precioCosto || 0)
    }), { unidades: 0, valor: 0 }), [seleccionados]);

    const handleSubmit = async () => {
        setLoading(true);
        const productos = seleccionados.map(p => ({ ...p, cantidadReparto: String(p.cantidad) }));
        const ok = await onSubmit(productos, { destino, responsable, nota });
        setLoading(false);
        if (ok) onClose();
    };

    // Helper de steps (usamos clases del módulo: .stepIndicator, .stepDot, .stepLine)
    const Steps = ({ n }) => (
        <div className={s.stepIndicator}>
            {[1, 2, 3].map((i, idx) => (
                <span key={i} style={{ display: "contents" }}>
                    <span className={`${s.stepDot} ${n === i ? s.stepDotActive : n > i ? s.stepDotDone : ""}`}>
                        {n > i ? <Icon name="check" size={16} /> : i}
                    </span>
                    {idx < 2 && <span className={s.stepLine} />}
                </span>
            ))}
        </div>
    );

    return (
        <Overlay onClose={onClose}>
            <Header icon="truck" title="Repartir a un sector" onClose={onClose} tone="danger" />

            <div className={s.modalBody}>
                <Steps n={paso === "datos" ? 1 : paso === "productos" ? 2 : 3} />

                {paso === "datos" && (
                    <>
                        <Field label="¿A qué sector va?">
                            <div className={s.destinoGrid}>
                                {DESTINOS.map(d => (
                                    <button key={d} className={`${s.destinoChip} ${destino === d ? s.destinoChipActive : ""}`} onClick={() => setDestino(d)}>
                                        {d}
                                    </button>
                                ))}
                            </div>
                        </Field>
                        <Field label="¿Quién lo recibe? (responsable)">
                            <input className={s.formInput} value={responsable} onChange={e => setResp(e.target.value)} placeholder="Nombre y apellido" />
                        </Field>
                        <Field label="Observaciones (opcional)">
                            <textarea className={s.formTextarea} rows={2}
                                value={nota} onChange={e => setNota(e.target.value)} placeholder="Notas adicionales..." />
                        </Field>
                    </>
                )}

                {paso === "productos" && (
                    <>
                        <div className={s.repartoSearch}>
                            <div className={s.searchWrap}>
                                <span className={`${s.searchIconInner} ${s.svgIc}`}><Icon name="search" size={18} /></span>
                                <input className={s.searchInput} placeholder="Buscar medicamento o descartable..."
                                    value={busqueda} onChange={e => setBusqueda(e.target.value)} autoComplete="off" />
                                {busqueda && (
                                    <button className={s.searchClear} onClick={() => { setBusqueda(""); setSug([]); }} aria-label="Limpiar">
                                        <Icon name="close" size={18} />
                                    </button>
                                )}
                            </div>
                            {sugerencias.length > 0 && (
                                <div className={s.autocompleteList}>
                                    {sugerencias.map(item => (
                                        <button key={item.id} className={s.autocompleteItem} onClick={() => agregar(item)}>
                                            <span className={s.autocompleteIcon}><Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={22} /></span>
                                            <div className={s.autocompleteInfo}>
                                                <p className={s.autocompleteName}>{item.nombre.replace(/_/g, " ")}</p>
                                                <p className={s.autocompleteMeta}>{item.presentacion} · Stock: {item.stockActual}</p>
                                            </div>
                                            <span className={s.autocompleteAdd}><Icon name="plus" size={20} /></span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {seleccionados.length === 0 ? (
                            <div className={s.emptyState}><span><Icon name="search" size={36} /></span><p>Buscá productos para agregar</p></div>
                        ) : (
                            <div className={s.repartoList}>
                                {seleccionados.map(p => (
                                    <div key={p.id} className={s.repartoItem}>
                                        <div className={s.repartoItemInfo}>
                                            <p className={s.repartoItemName}>{p.nombre.replace(/_/g, " ")}</p>
                                            <p className={s.repartoItemMeta}>Queda: <strong style={{ color: "var(--c-red)" }}>{p.stockNuevo}</strong> de {p.stockAnterior}</p>
                                        </div>
                                        <div className={s.repartoCantControls}>
                                            <button className={s.cantBtn} onClick={() => setCantidad(p.id, p.cantidad - 1)} disabled={p.cantidad <= 1} aria-label="Menos">
                                                <Icon name="minus" size={20} />
                                            </button>
                                            <span className={s.cantDisplay}>{p.cantidad}</span>
                                            <button className={s.cantBtn} onClick={() => setCantidad(p.id, p.cantidad + 1)} disabled={p.cantidad >= p.stockAnterior} aria-label="Más">
                                                <Icon name="plus" size={20} />
                                            </button>
                                        </div>
                                        <button className={s.removeBtn} onClick={() => quitar(p.id)} aria-label="Quitar">
                                            <Icon name="close" size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {paso === "confirmacion" && (
                    <>
                        <div className={s.confirmSummary}>
                            <div className={s.confirmRow}><span><Icon name="pin" size={18} /> Sector</span><strong>{destino}</strong></div>
                            <div className={s.confirmRow}><span><Icon name="user" size={18} /> Recibe</span><strong>{responsable}</strong></div>
                            <div className={s.confirmRow}><span><Icon name="box" size={18} /> Productos</span><strong>{seleccionados.length}</strong></div>
                            <div className={s.confirmRow}><span><Icon name="list" size={18} /> Unidades</span><strong>{totales.unidades}</strong></div>
                            <div className={s.confirmRow}><span><Icon name="money" size={18} /> Valor</span><strong style={{ color: "var(--c-red)" }}>{formatCurrency(totales.valor)}</strong></div>
                            {nota && <div className={s.confirmRow}><span><Icon name="edit" size={18} /> Nota</span><span>{nota}</span></div>}
                        </div>
                        <div className={s.confirmItems}>
                            {seleccionados.map(p => (
                                <div key={p.id} className={s.confirmItem}>
                                    <Icon name={p.tipo === "medicamento" ? "pills" : "box"} size={20} />
                                    <span className={s.confirmItemName}>{p.nombre.replace(/_/g, " ")}</span>
                                    <span className={s.confirmItemQty}>×{p.cantidad}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className={s.modalFooter}>
                {paso === "datos" && (
                    <>
                        <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                        <button className={`${s.actionBtn} ${s.btn_danger}`} disabled={!responsable.trim()} onClick={() => setPaso("productos")}>
                            Siguiente <Icon name="arrowRight" size={20} />
                        </button>
                    </>
                )}
                {paso === "productos" && (
                    <>
                        <button className={s.btnCancel} onClick={() => setPaso("datos")}><Icon name="arrowLeft" size={20} /> Atrás</button>
                        <button className={`${s.actionBtn} ${s.btn_danger}`} disabled={!seleccionados.length} onClick={() => setPaso("confirmacion")}>
                            Revisar ({seleccionados.length}) <Icon name="arrowRight" size={20} />
                        </button>
                    </>
                )}
                {paso === "confirmacion" && (
                    <>
                        <button className={s.btnCancel} onClick={() => setPaso("productos")}><Icon name="arrowLeft" size={20} /> Atrás</button>
                        <button className={`${s.actionBtn} ${s.btn_danger}`} onClick={handleSubmit} disabled={loading}>
                            <Icon name="check" size={20} /> {loading ? "Procesando..." : "Confirmar reparto"}
                        </button>
                    </>
                )}
            </div>
        </Overlay>
    );
}
"use client";
import { useState, useMemo, useEffect } from "react";
import Icon from "../Icon";
import { Overlay, Header, Field } from "./AgregarModal";
import { normalizeText, formatCurrency } from "../../utils/farmacia";

const DESTINOS = ["Guardia", "Primer Piso", "Segundo Piso", "Quirófano", "UTI",
    "Pediatría", "Maternidad", "Administración", "Depósito", "Otro"];

export default function RepartoModal({ onClose, onSubmit, items }) {
    const [paso, setPaso] = useState("datos"); // datos | productos | confirmacion
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
        unidades: a.unidades + p.cantidad, valor: a.valor + p.cantidad * p.precio
    }), { unidades: 0, valor: 0 }), [seleccionados]);

    const handleSubmit = async () => {
        setLoading(true);
        const productos = seleccionados.map(p => ({ ...p, cantidadReparto: String(p.cantidad) }));
        const ok = await onSubmit(productos, { destino, responsable, nota });
        setLoading(false);
        if (ok) onClose();
    };

    const Steps = ({ n }) => (
        <div className="rp-steps">
            {[1, 2, 3].map((i, idx) => (
                <span key={i} style={{ display: "contents" }}>
                    <span className={"rp-dot" + (n === i ? " on" : n > i ? " done" : "")}>
                        {n > i ? <Icon name="check" size={16} /> : i}
                    </span>
                    {idx < 2 && <span className="rp-line" />}
                </span>
            ))}
        </div>
    );

    return (
        <Overlay onClose={onClose}>
            <Header icon="truck" title="Repartir a un sector" onClose={onClose} tone="danger" />

            <div className="fxm-body">
                <Steps n={paso === "datos" ? 1 : paso === "productos" ? 2 : 3} />

                {/* PASO 1 */}
                {paso === "datos" && (
                    <>
                        <Field label="¿A qué sector va?">
                            <div className="rp-dest">
                                {DESTINOS.map(d => (
                                    <button key={d} className={"rp-chip" + (destino === d ? " on" : "")} onClick={() => setDestino(d)}>{d}</button>
                                ))}
                            </div>
                        </Field>
                        <Field label="¿Quién lo recibe? (responsable)">
                            <input className="fxm-input" value={responsable} onChange={e => setResp(e.target.value)} placeholder="Nombre y apellido" />
                        </Field>
                        <Field label="Observaciones (opcional)">
                            <textarea className="fxm-input" style={{ minHeight: 80, padding: 12, resize: "vertical" }} rows={2}
                                value={nota} onChange={e => setNota(e.target.value)} placeholder="Notas adicionales..." />
                        </Field>
                    </>
                )}

                {/* PASO 2 */}
                {paso === "productos" && (
                    <>
                        <div className="rp-search">
                            <div className="fxlp-search" style={{ marginBottom: 0 }}>
                                <Icon name="search" size={22} />
                                <input placeholder="Buscar medicamento o descartable..." value={busqueda}
                                    onChange={e => setBusqueda(e.target.value)} autoComplete="off" />
                                {busqueda && <button onClick={() => { setBusqueda(""); setSug([]); }} aria-label="Limpiar"><Icon name="close" size={18} /></button>}
                            </div>
                            {sugerencias.length > 0 && (
                                <div className="rp-auto">
                                    {sugerencias.map(item => (
                                        <button key={item.id} className="rp-auto-item" onClick={() => agregar(item)}>
                                            <span className="ic"><Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={22} /></span>
                                            <div className="info">
                                                <p className="n">{item.nombre.replace(/_/g, " ")}</p>
                                                <p className="m">{item.presentacion} · Stock: {item.stockActual}</p>
                                            </div>
                                            <Icon name="plus" size={20} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {seleccionados.length === 0 ? (
                            <div className="rp-empty"><Icon name="search" size={36} /><p>Buscá productos para agregar</p></div>
                        ) : (
                            <div className="rp-list">
                                {seleccionados.map(p => (
                                    <div key={p.id} className="rp-item">
                                        <div className="info">
                                            <p className="n">{p.nombre.replace(/_/g, " ")}</p>
                                            <p className="m">Queda: <strong style={{ color: "#dc2626" }}>{p.stockNuevo}</strong> de {p.stockAnterior}</p>
                                        </div>
                                        <div className="qty">
                                            <button onClick={() => setCantidad(p.id, p.cantidad - 1)} disabled={p.cantidad <= 1} aria-label="Menos"><Icon name="minus" size={20} /></button>
                                            <span>{p.cantidad}</span>
                                            <button onClick={() => setCantidad(p.id, p.cantidad + 1)} disabled={p.cantidad >= p.stockAnterior} aria-label="Más"><Icon name="plus" size={20} /></button>
                                        </div>
                                        <button className="rp-x" onClick={() => quitar(p.id)} aria-label="Quitar"><Icon name="close" size={20} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </>
                )}

                {/* PASO 3 */}
                {paso === "confirmacion" && (
                    <>
                        <div className="rp-sum">
                            <div className="row"><span><Icon name="pin" size={18} /> Sector</span><strong>{destino}</strong></div>
                            <div className="row"><span><Icon name="user" size={18} /> Recibe</span><strong>{responsable}</strong></div>
                            <div className="row"><span><Icon name="box" size={18} /> Productos</span><strong>{seleccionados.length}</strong></div>
                            <div className="row"><span><Icon name="list" size={18} /> Unidades</span><strong>{totales.unidades}</strong></div>
                            <div className="row"><span><Icon name="money" size={18} /> Valor</span><strong style={{ color: "#dc2626" }}>{formatCurrency(totales.valor)}</strong></div>
                            {nota && <div className="row"><span><Icon name="edit" size={18} /> Nota</span><span>{nota}</span></div>}
                        </div>
                        <div className="rp-items">
                            {seleccionados.map(p => (
                                <div key={p.id} className="rp-conf">
                                    <Icon name={p.tipo === "medicamento" ? "pills" : "box"} size={20} />
                                    <span className="n">{p.nombre.replace(/_/g, " ")}</span>
                                    <span className="q">×{p.cantidad}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <div className="fxm-footer">
                {paso === "datos" && (
                    <>
                        <button className="fxm-btn ghost" onClick={onClose}>Cancelar</button>
                        <button className="fxm-btn danger" disabled={!responsable.trim()} onClick={() => setPaso("productos")}>
                            Siguiente <Icon name="arrowRight" size={20} />
                        </button>
                    </>
                )}
                {paso === "productos" && (
                    <>
                        <button className="fxm-btn ghost" onClick={() => setPaso("datos")}><Icon name="arrowLeft" size={20} /> Atrás</button>
                        <button className="fxm-btn danger" disabled={!seleccionados.length} onClick={() => setPaso("confirmacion")}>
                            Revisar ({seleccionados.length}) <Icon name="arrowRight" size={20} />
                        </button>
                    </>
                )}
                {paso === "confirmacion" && (
                    <>
                        <button className="fxm-btn ghost" onClick={() => setPaso("productos")}><Icon name="arrowLeft" size={20} /> Atrás</button>
                        <button className="fxm-btn danger" onClick={handleSubmit} disabled={loading}>
                            <Icon name="check" size={20} /> {loading ? "Procesando..." : "Confirmar reparto"}
                        </button>
                    </>
                )}
            </div>

            <style>{`
                .rp-steps { display: flex; align-items: center; justify-content: center; gap: 6px; }
                .rp-dot { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-weight: 800; font-size: 16px; background: #f1f1f1; color: #9ca3af; }
                .rp-dot.on { background: #dc2626; color: #fff; }
                .rp-dot.done { background: #fee2e2; color: #dc2626; }
                .rp-line { width: 36px; height: 3px; background: #f1f1f1; border-radius: 3px; }

                .rp-dest { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
                .rp-chip { min-height: 52px; border-radius: 12px; border: 2px solid #d1d5db; background: #fff;
                    font-size: 16px; font-weight: 700; color: #374151; cursor: pointer; }
                .rp-chip.on { border-color: #dc2626; background: #fef2f2; color: #b91c1c; }

                .rp-search { position: relative; }
                .rp-auto { position: absolute; top: 100%; left: 0; right: 0; z-index: 5; margin-top: 6px;
                    background: #fff; border: 2px solid #e5e7eb; border-radius: 14px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,.12); }
                .rp-auto-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px;
                    border: none; border-bottom: 1px solid #f3f4f6; background: #fff; cursor: pointer; text-align: left; color: #1f2937; }
                .rp-auto-item:active { background: #f9fafb; }
                .rp-auto-item .ic { color: #dc2626; display: flex; }
                .rp-auto-item .info { flex: 1; min-width: 0; }
                .rp-auto-item .n { margin: 0; font-size: 16px; font-weight: 700; }
                .rp-auto-item .m { margin: 2px 0 0; font-size: 13px; color: #6b7280; }

                .rp-empty { text-align: center; padding: 28px; color: #9ca3af; }
                .rp-empty p { margin: 8px 0 0; }

                .rp-list { display: flex; flex-direction: column; gap: 10px; }
                .rp-item { display: flex; align-items: center; gap: 10px; background: #fff; border: 2px solid #e5e7eb; border-radius: 14px; padding: 12px; }
                .rp-item .info { flex: 1; min-width: 0; }
                .rp-item .n { margin: 0; font-size: 16px; font-weight: 700; }
                .rp-item .m { margin: 2px 0 0; font-size: 13px; color: #6b7280; }
                .rp-item .qty { display: flex; align-items: center; gap: 4px; }
                .rp-item .qty button { width: 44px; height: 44px; border-radius: 10px; border: 2px solid #d1d5db;
                    background: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #374151; }
                .rp-item .qty button:disabled { opacity: .4; }
                .rp-item .qty span { min-width: 32px; text-align: center; font-size: 18px; font-weight: 800; }
                .rp-x { width: 40px; height: 40px; border-radius: 10px; border: none; background: #fef2f2; color: #dc2626;
                    cursor: pointer; display: flex; align-items: center; justify-content: center; }

                .rp-sum { background: #f9fafb; border: 1px solid #eef0f2; border-radius: 14px; padding: 6px 14px; }
                .rp-sum .row { display: flex; align-items: center; justify-content: space-between; gap: 10px;
                    padding: 12px 0; border-bottom: 1px solid #f1f1f1; font-size: 16px; }
                .rp-sum .row:last-child { border-bottom: none; }
                .rp-sum .row span { display: inline-flex; align-items: center; gap: 6px; color: #6b7280; }

                .rp-items { display: flex; flex-direction: column; gap: 6px; }
                .rp-conf { display: flex; align-items: center; gap: 10px; padding: 10px 12px; background: #fff; border: 1px solid #eef0f2; border-radius: 10px; }
                .rp-conf .n { flex: 1; font-weight: 600; }
                .rp-conf .q { font-weight: 800; color: #dc2626; }

                @media (min-width: 768px) { .rp-dest { grid-template-columns: repeat(3, 1fr); } }
            `}</style>
        </Overlay>
    );
}
"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import s from "../../farmaciaDashboard.module.css";
import { Overlay, CloseBtn, Field } from "./AgregarModal";
import { normalizeText, formatCurrency } from "../../utils/farmacia";

const DESTINOS = ["Guardia", "Primer Piso", "Segundo Piso", "Quirófano", "UTI",
    "Pediatría", "Maternidad", "Administración", "Depósito", "Otro"];

export default function RepartoModal({ onClose, onSubmit, items }) {
    const [paso, setPaso] = useState("datos");   // datos | productos | confirmacion
    const [destino, setDestino] = useState("Guardia");
    const [responsable, setResp] = useState("");
    const [nota, setNota] = useState("");
    const [busqueda, setBusqueda] = useState("");
    const [sugerencias, setSugер] = useState([]);
    const [seleccionados, setSelected] = useState([]);
    const [loading, setLoading] = useState(false);
    const searchRef = useRef();

    // Autocompletado
    useEffect(() => {
        if (!busqueda.trim()) { setSugер([]); return; }
        const q = normalizeText(busqueda);
        const res = items
            .filter(i => i.stockActual > 0 && normalizeText(i.nombre).includes(q))
            .slice(0, 8);
        setSugер(res);
    }, [busqueda, items]);

    const agregar = (item) => {
        setBusqueda(""); setSugер([]);
        if (seleccionados.find(p => p.id === item.id)) return;
        setSelected(prev => [...prev, {
            ...item, cantidad: 1,
            stockAnterior: item.stockActual,
            stockNuevo: item.stockActual - 1
        }]);
    };

    const setCantidad = (id, val) => {
        const n = Math.max(1, Math.min(parseInt(val) || 1,
            seleccionados.find(p => p.id === id)?.stockAnterior || 1));
        setSelected(prev => prev.map(p => p.id !== id ? p : {
            ...p, cantidad: n, stockNuevo: p.stockAnterior - n
        }));
    };

    const quitar = (id) => setSelected(prev => prev.filter(p => p.id !== id));

    const totales = useMemo(() => seleccionados.reduce((acc, p) => ({
        unidades: acc.unidades + p.cantidad,
        valor: acc.valor + p.cantidad * p.precio
    }), { unidades: 0, valor: 0 }), [seleccionados]);

    const handleSubmit = async () => {
        setLoading(true);
        const productosConKey = seleccionados.map(p => ({ ...p, cantidadReparto: String(p.cantidad) }));
        const ok = await onSubmit(productosConKey, { destino, responsable, nota });
        setLoading(false);
        if (ok) onClose();
    };

    // ── PASO 1: Datos ─────────────────────────────────────────────────────
    if (paso === "datos") return (
        <Overlay onClose={onClose}>
            <div className={s.modalHeader} style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>
                <h3 className={s.modalTitle} style={{ color: "#fff" }}>🚚 Nuevo Despacho</h3>
                <CloseBtn onClick={onClose} />
            </div>
            <div className={s.modalBody}>
                <div className={s.stepIndicator}>
                    <div className={`${s.stepDot} ${s.stepDotActive}`}>1</div>
                    <div className={s.stepLine} />
                    <div className={s.stepDot}>2</div>
                    <div className={s.stepLine} />
                    <div className={s.stepDot}>3</div>
                </div>
                <p className={s.stepLabel}>Datos del despacho</p>

                <div style={{ display: "flex", flexDirection: "column", gap: ".875rem", marginTop: "1rem" }}>
                    <Field label="📍 Destino">
                        <div className={s.destinoGrid}>
                            {DESTINOS.map(d => (
                                <button key={d}
                                    className={`${s.destinoChip} ${destino === d ? s.destinoChipActive : ""}`}
                                    onClick={() => setDestino(d)}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </Field>
                    <Field label="👤 Responsable *">
                        <input className={s.formInput} value={responsable}
                            onChange={e => setResp(e.target.value)}
                            placeholder="Nombre del responsable" />
                    </Field>
                    <Field label="📝 Observaciones (opcional)">
                        <textarea className={s.formTextarea} rows={2} value={nota}
                            onChange={e => setNota(e.target.value)}
                            placeholder="Notas adicionales..." />
                    </Field>
                </div>
            </div>
            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                <button className={`${s.actionBtn} ${s.btn_danger}`}
                    disabled={!responsable.trim()}
                    onClick={() => setPaso("productos")}>
                    Siguiente →
                </button>
            </div>
        </Overlay>
    );

    // ── PASO 2: Productos ─────────────────────────────────────────────────
    if (paso === "productos") return (
        <Overlay onClose={onClose}>
            <div className={s.modalHeader} style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>
                <h3 className={s.modalTitle} style={{ color: "#fff" }}>🚚 Productos a repartir</h3>
                <CloseBtn onClick={onClose} />
            </div>
            <div className={s.modalBody}>
                <div className={s.stepIndicator}>
                    <div className={s.stepDot}>1</div>
                    <div className={s.stepLine} />
                    <div className={`${s.stepDot} ${s.stepDotActive}`}>2</div>
                    <div className={s.stepLine} />
                    <div className={s.stepDot}>3</div>
                </div>
                <p className={s.stepLabel}>Buscá y agregá productos</p>

                {/* Buscador tipo WhatsApp */}
                <div className={s.repartoSearch} ref={searchRef}>
                    <div className={s.searchWrap} style={{ marginTop: ".75rem" }}>
                        <span className={s.searchIconInner}>🔍</span>
                        <input
                            className={s.searchInput}
                            placeholder="Buscar medicamento o descartable..."
                            value={busqueda}
                            onChange={e => setBusqueda(e.target.value)}
                            autoComplete="off"
                        />
                        {busqueda && (
                            <button className={s.searchClear} onClick={() => { setBusqueda(""); setSugер([]); }}>
                                ✕
                            </button>
                        )}
                    </div>

                    {sugerencias.length > 0 && (
                        <div className={s.autocompleteList}>
                            {sugerencias.map(item => (
                                <div key={item.id} className={s.autocompleteItem} onClick={() => agregar(item)}>
                                    <span className={s.autocompleteIcon}>
                                        {item.tipo === "medicamento" ? "💊" : "🧷"}
                                    </span>
                                    <div className={s.autocompleteInfo}>
                                        <p className={s.autocompleteName}>{item.nombre.replace(/_/g, " ")}</p>
                                        <p className={s.autocompleteMeta}>
                                            {item.presentacion} · Stock: {item.stockActual}
                                        </p>
                                    </div>
                                    <span className={s.autocompleteAdd}>+</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Lista seleccionados */}
                {seleccionados.length === 0 ? (
                    <div className={s.emptyState} style={{ padding: "2rem" }}>
                        <span>🔍</span>
                        <p>Buscá productos para agregar</p>
                    </div>
                ) : (
                    <div className={s.repartoList}>
                        {seleccionados.map(p => (
                            <div key={p.id} className={s.repartoItem}>
                                <div className={s.repartoItemInfo}>
                                    <p className={s.repartoItemName}>{p.nombre.replace(/_/g, " ")}</p>
                                    <p className={s.repartoItemMeta}>
                                        Stock: {p.stockAnterior} → <strong style={{ color: "#ef4444" }}>{p.stockNuevo}</strong>
                                    </p>
                                </div>
                                <div className={s.repartoCantControls}>
                                    <button className={s.cantBtn}
                                        onClick={() => setCantidad(p.id, p.cantidad - 1)}
                                        disabled={p.cantidad <= 1}>−</button>
                                    <span className={s.cantDisplay}>{p.cantidad}</span>
                                    <button className={s.cantBtn}
                                        onClick={() => setCantidad(p.id, p.cantidad + 1)}
                                        disabled={p.cantidad >= p.stockAnterior}>+</button>
                                </div>
                                <button className={s.removeBtn} onClick={() => quitar(p.id)}>✕</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={() => setPaso("datos")}>← Atrás</button>
                <button className={`${s.actionBtn} ${s.btn_danger}`}
                    disabled={seleccionados.length === 0}
                    onClick={() => setPaso("confirmacion")}>
                    Confirmar ({seleccionados.length}) →
                </button>
            </div>
        </Overlay>
    );

    // ── PASO 3: Confirmación ──────────────────────────────────────────────
    return (
        <Overlay onClose={onClose}>
            <div className={s.modalHeader} style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>
                <h3 className={s.modalTitle} style={{ color: "#fff" }}>🚚 Confirmar despacho</h3>
                <CloseBtn onClick={onClose} />
            </div>
            <div className={s.modalBody}>
                <div className={s.stepIndicator}>
                    <div className={s.stepDot}>1</div>
                    <div className={s.stepLine} />
                    <div className={s.stepDot}>2</div>
                    <div className={s.stepLine} />
                    <div className={`${s.stepDot} ${s.stepDotActive}`}>3</div>
                </div>
                <p className={s.stepLabel}>Revisá antes de confirmar</p>

                <div className={s.confirmSummary}>
                    <div className={s.confirmRow}><span>📍 Destino</span><strong>{destino}</strong></div>
                    <div className={s.confirmRow}><span>👤 Responsable</span><strong>{responsable}</strong></div>
                    <div className={s.confirmRow}><span>📦 Productos</span><strong>{seleccionados.length}</strong></div>
                    <div className={s.confirmRow}><span>📊 Unidades</span><strong>{totales.unidades}</strong></div>
                    <div className={s.confirmRow}>
                        <span>💰 Valor total</span>
                        <strong style={{ color: "#ef4444" }}>{formatCurrency(totales.valor)}</strong>
                    </div>
                    {nota && <div className={s.confirmRow}><span>📝 Nota</span><span>{nota}</span></div>}
                </div>

                <div className={s.confirmItems}>
                    {seleccionados.map(p => (
                        <div key={p.id} className={s.confirmItem}>
                            <span>{p.tipo === "medicamento" ? "💊" : "🧷"}</span>
                            <span className={s.confirmItemName}>{p.nombre.replace(/_/g, " ")}</span>
                            <span className={s.confirmItemQty} style={{ color: "#ef4444" }}>×{p.cantidad}</span>
                        </div>
                    ))}
                </div>
            </div>
            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={() => setPaso("productos")}>← Atrás</button>
                <button className={`${s.actionBtn} ${s.btn_danger}`}
                    onClick={handleSubmit} disabled={loading}>
                    {loading ? "Procesando..." : "✅ Confirmar despacho"}
                </button>
            </div>
        </Overlay>
    );
}
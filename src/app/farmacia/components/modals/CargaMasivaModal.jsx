"use client";
import { useState, useEffect, useMemo } from "react";
import s from "../../farmaciaDashboard.module.css";
import { Overlay, CloseBtn } from "./AgregarModal";
import { normalizeText, formatCurrency } from "../../utils/farmacia";

export default function CargaMasivaModal({ onClose, onSubmit, cargarCatalogo }) {
    const [catalogo, setCatalogo] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [seleccionados, setSeleccionados] = useState([]);

    useEffect(() => { cargarCatalogo().then(setCatalogo); }, []);

    const filtrado = useMemo(() =>
        catalogo.filter(i =>
            normalizeText(i.nombre).includes(normalizeText(busqueda)) ||
            normalizeText(i.presentacion).includes(normalizeText(busqueda))
        ), [catalogo, busqueda]);

    const agregar = (item) => {
        if (seleccionados.find(p => p.id === item.id)) return;
        setSeleccionados(prev => [...prev, {
            ...item, cantidad: "1",
            stockAnterior: item.stockActual || 0,
            stockNuevo: (item.stockActual || 0) + 1
        }]);
    };

    const quitar = (id) => setSeleccionados(prev => prev.filter(p => p.id !== id));

    const setCantidad = (id, val) => {
        const n = parseInt(val) || 0;
        setSeleccionados(prev => prev.map(p => p.id !== id ? p : {
            ...p, cantidad: val, stockNuevo: (p.stockAnterior || 0) + n
        }));
    };

    const totales = useMemo(() => seleccionados.reduce((acc, p) => {
        const c = parseInt(p.cantidad) || 0;
        return { unidades: acc.unidades + c, valor: acc.valor + c * p.precio };
    }, { unidades: 0, valor: 0 }), [seleccionados]);

    const handleSubmit = async () => {
        const ok = await onSubmit(seleccionados);
        if (ok) onClose();
    };

    return (
        <Overlay onClose={onClose} wide>
            <div className={s.modalHeader}>
                <h3 className={s.modalTitle}>📥 Carga Masiva</h3>
                <CloseBtn onClick={onClose} />
            </div>
            <div className={`${s.modalBody} ${s.modalBodyScroll}`}>
                <div className={s.splitLayout}>
                    {/* Catálogo */}
                    <div className={s.splitPane}>
                        <h4 className={s.splitPaneTitle}>🔍 Buscar en catálogo</h4>
                        <div className={s.searchWrap}>
                            <span className={s.searchIconInner}>🔍</span>
                            <input className={s.searchInput} placeholder="Buscar..."
                                value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                        </div>
                        <div className={s.catalogList}>
                            {filtrado.slice(0, 60).map(item => (
                                <div key={item.id} className={s.catalogItem} onClick={() => agregar(item)}>
                                    <div className={s.catalogItemTop}>
                                        <strong>{item.nombre.replace(/_/g, " ")}</strong>
                                        <span className={item.tipo === "medicamento" ? s.badgeMed : s.badgeDesc}>
                                            {item.tipoLabel}
                                        </span>
                                    </div>
                                    <div className={s.catalogItemBot}>
                                        <span>{item.presentacion}</span>
                                        <span className={s.catalogItemPrice}>{formatCurrency(item.precio)}</span>
                                        <span>Stock: {item.stockActual}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Seleccionados */}
                    <div className={s.splitPane}>
                        <h4 className={s.splitPaneTitle}>📦 A cargar ({seleccionados.length})</h4>
                        {seleccionados.length === 0 ? (
                            <div className={s.emptyState}><span>📦</span><p>Seleccioná productos del catálogo</p></div>
                        ) : (
                            <div className={s.selectedList}>
                                {seleccionados.map(p => (
                                    <div key={p.id} className={s.selectedItem}>
                                        <div className={s.selectedItemTop}>
                                            <strong>{p.nombre.replace(/_/g, " ")}</strong>
                                            <button className={s.removeBtn} onClick={() => quitar(p.id)}>✕</button>
                                        </div>
                                        <div className={s.selectedItemMid}>
                                            <span className={s.stockFlow}>
                                                {p.stockAnterior} → <strong>{p.stockNuevo}</strong>
                                            </span>
                                        </div>
                                        <div className={s.selectedItemBot}>
                                            <label>Cantidad:</label>
                                            <input type="number" min="1" className={s.cantInput}
                                                value={p.cantidad} onChange={e => setCantidad(p.id, e.target.value)} />
                                            <span className={s.subTotal}>{formatCurrency((parseInt(p.cantidad) || 0) * p.precio)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className={s.modalFooter}>
                <div className={s.footerTotals}>
                    <span>{totales.unidades} unidades</span>
                    <strong>{formatCurrency(totales.valor)}</strong>
                </div>
                <div className={s.footerBtns}>
                    <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                    <button className={`${s.actionBtn} ${s.btn_secondary}`}
                        onClick={handleSubmit} disabled={seleccionados.length === 0}>
                        Procesar Ingreso ({seleccionados.length})
                    </button>
                </div>
            </div>
        </Overlay>
    );
}
"use client";
import { useState, useMemo } from "react";
import s from "../farmaciaDashboard.module.css";
import Icon from "./Icon";
import { formatCurrency, matchesAllTerms } from "../utils/farmacia";
import GestionarListasModal from "./modals/GestionarListasModal";
import ExportarPreciosModal from "./modals/ExportarPreciosModal";

export default function ListasPreciosTab({ items = [], listas = [], onGuardarLista, onEliminarLista, onExportarListas }) {
    const [busqueda, setBusqueda] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [listaActivaId, setListaActivaId] = useState(null);
    const [verTodas, setVerTodas] = useState(false);
    const [modal, setModal] = useState(null);

    const listasActivas = useMemo(
        () => [...listas].filter(l => l.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0)),
        [listas]
    );
    const listaActiva = listasActivas.find(l => l.id === listaActivaId) || listasActivas[0] || null;

    const filtrados = useMemo(() => items.filter(item => {
        if (item.activo === false) return false;
        const mB = matchesAllTerms(item.nombre, busqueda) || matchesAllTerms(item.presentacion, busqueda);
        const mT = filtroTipo === "todos"
            || (filtroTipo === "medicamentos" && item.tipo === "medicamento")
            || (filtroTipo === "descartables" && item.tipo === "descartable");
        return mB && mT;
    }), [items, busqueda, filtroTipo]);

    return (
        <div className={s.panel}>
            <div className={s.panelHeader}>
                <div>
                    <h3 className={s.panelTitle}><Icon name="tag" size={20} /> Listas de Precios</h3>
                    <p className={s.panelSub}>{filtrados.length} productos · costo × multiplicador</p>
                </div>
                <div className={s.panelActions}>
                    <button className={`${s.actionBtn} ${s.btn_secondary}`} onClick={() => setModal("exportar")} disabled={!listasActivas.length}>
                        <Icon name="download" size={18} /> <span className={s.actionBtnLabel}>Exportar</span>
                    </button>
                    <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={() => setModal("gestionar")}>
                        <Icon name="settings" size={18} /> <span className={s.actionBtnLabel}>Gestionar</span>
                    </button>
                </div>
            </div>

            <div className={s.filtersRow}>
                <div className={s.searchWrap}>
                    <span className={`${s.searchIconInner} ${s.svgIc}`}><Icon name="search" size={18} /></span>
                    <input className={s.searchInput} placeholder="Buscar producto..."
                        value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                </div>
                <select className={s.filterSelect} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="medicamentos">Medicamentos</option>
                    <option value="descartables">Descartables</option>
                </select>
            </div>

            {listasActivas.length === 0 ? (
                <div className={s.emptyState}>
                    <span className={s.svgIc}><Icon name="tag" size={40} /></span>
                    <p>Todavía no hay listas creadas</p>
                    <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={() => setModal("gestionar")}>
                        <Icon name="plus" size={18} /> Crear primera lista
                    </button>
                </div>
            ) : (
                <>
                    <div className={s.precioChips}>
                        <button className={`${s.precioChip} ${verTodas ? s.precioChipActive : ""}`} onClick={() => setVerTodas(true)}>
                            <Icon name="list" size={16} /> Ver todas
                        </button>
                        {listasActivas.map(l => (
                            <button key={l.id}
                                className={`${s.precioChip} ${!verTodas && listaActiva?.id === l.id ? s.precioChipActive : ""}`}
                                onClick={() => { setVerTodas(false); setListaActivaId(l.id); }}>
                                {l.nombre} <span className={s.precioChipMult}>×{l.multiplicador}</span>
                            </button>
                        ))}
                    </div>

                    {filtrados.length === 0 ? (
                        <div className={s.emptyState}><span className={s.svgIc}><Icon name="inbox" size={40} /></span><p>No se encontraron productos</p></div>
                    ) : verTodas ? (
                        <div className={s.tableWrap} style={{ display: "block" }}>
                            <table className={s.precioTable}>
                                <thead>
                                    <tr>
                                        <th className={s.thLeft}>Producto</th><th>Costo</th>
                                        {listasActivas.map(l => <th key={l.id}>{l.nombre}<br /><small>×{l.multiplicador}</small></th>)}
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtrados.map(item => {
                                        const c = Number(item.precioReferencia) || 0;
                                        return (
                                            <tr key={item.id || item.nombre}>
                                                <td className={s.tdLeft}>{String(item.nombre).replace(/_/g, " ")}</td>
                                                <td>{formatCurrency(c)}</td>
                                                {listasActivas.map(l => (
                                                    <td key={l.id} className={s.precioCell}>{formatCurrency(c * Number(l.multiplicador || 1))}</td>
                                                ))}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    ) : listaActiva ? (
                        <div className={s.precioCards}>
                            {filtrados.map(item => {
                                const c = Number(item.precioReferencia) || 0;
                                return (
                                    <div key={item.id || item.nombre} className={s.precioCard}>
                                        <span className={`${s.precioCardIcon} ${s.svgIc}`}>
                                            <Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={22} />
                                        </span>
                                        <div className={s.precioCardInfo}>
                                            <p className={s.precioCardName}>{String(item.nombre).replace(/_/g, " ")}</p>
                                            <p className={s.precioCardMeta}>{item.presentacion} · Costo {formatCurrency(c)}</p>
                                        </div>
                                        <div className={s.precioPriceBox}>
                                            <span className={s.precioPriceLabel}>{listaActiva.nombre}</span>
                                            <span className={s.precioPriceVal}>{formatCurrency(c * Number(listaActiva.multiplicador || 1))}</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                </>
            )}

            {modal === "gestionar" && (
                <GestionarListasModal listas={listas} onClose={() => setModal(null)} onGuardar={onGuardarLista} onEliminar={onEliminarLista} />
            )}
            {modal === "exportar" && (
                <ExportarPreciosModal listas={listas} onClose={() => setModal(null)} onExportar={onExportarListas} />
            )}
        </div>
    );
}
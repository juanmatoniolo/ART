"use client";
import { useState, useMemo } from "react";
import { formatCurrency, matchesAllTerms } from "../utils/farmacia";
import GestionarListasModal from "./modals/GestionarListasModal";
import s from "../farmaciaDashboard.module.css";

export default function ListasPreciosTab({ items = [], listas = [], onGuardarLista, onEliminarLista }) {
    const [busqueda, setBusqueda] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [listaActivaId, setListaActivaId] = useState(null);
    const [verTodas, setVerTodas] = useState(false);
    const [gestionar, setGestionar] = useState(false);

    const listasActivas = useMemo(
        () => [...listas].filter(l => l.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0)),
        [listas]
    );

    const listaActiva = listasActivas.find(l => l.id === listaActivaId) || listasActivas[0] || null;

    const filtrados = useMemo(() => items.filter(item => {
        if (item.activo === false) return false;
        const matchB = matchesAllTerms(item.nombre, busqueda) || matchesAllTerms(item.presentacion, busqueda);
        const matchT = filtroTipo === "todos"
            || (filtroTipo === "medicamentos" && item.tipo === "medicamento")
            || (filtroTipo === "descartables" && item.tipo === "descartable");
        return matchB && matchT;
    }), [items, busqueda, filtroTipo]);

    return (
        <div className={s.panel}>
            {/* Encabezado */}
            <div className={s.panelHeader}>
                <div>
                    <h3 className={s.panelTitle}>💲 Listas de Precios</h3>
                    <p className={s.panelSub}>
                        {filtrados.length} productos · costo × multiplicador de cada lista
                    </p>
                </div>
                <button className={`${s.actionBtn} ${s.btn_secondary}`} onClick={() => setGestionar(true)}>
                    ⚙️ Gestionar listas
                </button>
            </div>

            {/* Buscador + filtro tipo */}
            <div className={s.filtersRow}>
                <div className={s.searchWrap}>
                    <span className={`${s.searchIconInner} ${s.svgIc}`}>🔍</span>
                    <input
                        className={s.searchInput}
                        placeholder="Buscar producto..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <select className={s.filterSelect} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="medicamentos">💊 Medicamentos</option>
                    <option value="descartables">🧷 Descartables</option>
                </select>
            </div>

            {/* Selector de lista (chips) */}
            {listasActivas.length > 0 ? (
                <div className={s.precioChips}>
                    <button
                        className={`${s.precioChip} ${verTodas ? s.precioChipActive : ""}`}
                        onClick={() => setVerTodas(true)}
                    >
                        📊 Ver todas
                    </button>
                    {listasActivas.map(l => {
                        const sel = !verTodas && listaActiva?.id === l.id;
                        return (
                            <button
                                key={l.id}
                                className={`${s.precioChip} ${sel ? s.precioChipActive : ""}`}
                                onClick={() => { setVerTodas(false); setListaActivaId(l.id); }}
                            >
                                {l.nombre} <span className={s.precioChipMult}>×{l.multiplicador}</span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div className={s.emptyState}>
                    <span>📋</span>
                    <p>Todavía no hay listas creadas.</p>
                    <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={() => setGestionar(true)}>
                        ➕ Crear primera lista
                    </button>
                </div>
            )}

            {/* Resultados */}
            {filtrados.length === 0 ? (
                <div className={s.emptyState}>
                    <span>📭</span>
                    <p>No se encontraron productos</p>
                </div>
            ) : verTodas ? (
                <TablaTodas items={filtrados} listas={listasActivas} />
            ) : listaActiva ? (
                <ListaSimple items={filtrados} lista={listaActiva} />
            ) : null}

            {gestionar && (
                <GestionarListasModal
                    listas={listas}
                    onClose={() => setGestionar(false)}
                    onGuardar={onGuardarLista}
                    onEliminar={onEliminarLista}
                />
            )}
        </div>
    );
}

/* ── Vista de UNA lista: tarjetas (mobile-first) ───────────────────────── */
function ListaSimple({ items, lista }) {
    return (
        <div className={s.precioCards}>
            {items.map(item => {
                const costo = Number(item.precioCosto) || 0;
                const precio = costo * Number(lista.multiplicador || 1);
                return (
                    <div key={item.id || item.nombre} className={s.precioCard}>
                        <span className={s.precioCardIcon}>
                            {item.tipo === "medicamento" ? "💊" : "🧷"}
                        </span>
                        <div className={s.precioCardInfo}>
                            <p className={s.precioCardName}>
                                {String(item.nombre).replace(/_/g, " ")}
                            </p>
                            <p className={s.precioCardMeta}>
                                {item.presentacion} · Costo {formatCurrency(costo)}
                            </p>
                        </div>
                        <div className={s.precioPriceBox}>
                            <span className={s.precioPriceLabel}>{lista.nombre}</span>
                            <span className={s.precioPriceVal}>{formatCurrency(precio)}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ── Vista TODAS las listas: tabla comparativa (ideal para PC) ──────────── */
function TablaTodas({ items, listas }) {
    return (
        <div className={s.tableWrap} style={{ display: "block" }}>
            <table className={s.precioTable}>
                <thead>
                    <tr>
                        <th className={s.thLeft}>Producto</th>
                        <th>Costo</th>
                        {listas.map(l => (
                            <th key={l.id}>
                                {l.nombre}
                                <br />
                                <small>×{l.multiplicador}</small>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => {
                        const costo = Number(item.precioCosto) || 0;
                        return (
                            <tr key={item.id || item.nombre}>
                                <td className={s.tdLeft}>
                                    <span style={{ marginRight: 8 }}>
                                        {item.tipo === "medicamento" ? "💊" : "🧷"}
                                    </span>
                                    {String(item.nombre).replace(/_/g, " ")}
                                </td>
                                <td style={{ fontWeight: 600 }}>{formatCurrency(costo)}</td>
                                {listas.map(l => (
                                    <td key={l.id} className={s.precioCell}>
                                        {formatCurrency(costo * Number(l.multiplicador || 1))}
                                    </td>
                                ))}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
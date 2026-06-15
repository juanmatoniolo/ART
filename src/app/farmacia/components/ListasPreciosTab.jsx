"use client";
import { useState, useMemo } from "react";
import { formatCurrency, matchesAllTerms } from "../utils/farmacia";
import GestionarListasModal from "./modals/GestionarListasModal";

/**
 * Sección de Listas de Precios.
 * El costo es item.precioReferencia. Cada lista tiene un `multiplicador`
 * y el precio se calcula al vuelo: precioReferencia * multiplicador.
 *
 * Props:
 *  - items: array de productos (medicamentos + descartables)
 *  - listas: [{ id, nombre, multiplicador, activo, orden }]
 *  - onGuardarLista(lista): Promise<bool>   // crear o editar
 *  - onEliminarLista(id): Promise<bool>
 */
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
        <div style={S.wrap}>
            {/* Encabezado */}
            <div style={S.header}>
                <div>
                    <h2 style={S.title}>💲 Listas de Precios</h2>
                    <p style={S.subtitle}>
                        {filtrados.length} productos · costo × multiplicador de cada lista
                    </p>
                </div>
                <button style={S.btnManage} onClick={() => setGestionar(true)}>
                    ⚙️ Gestionar listas
                </button>
            </div>

            {/* Buscador + filtro tipo */}
            <div style={S.controls}>
                <div style={S.searchWrap}>
                    <span style={S.searchIcon}>🔍</span>
                    <input
                        style={S.search}
                        placeholder="Buscar producto..."
                        value={busqueda}
                        onChange={e => setBusqueda(e.target.value)}
                    />
                </div>
                <select style={S.select} value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                    <option value="todos">Todos</option>
                    <option value="medicamentos">💊 Medicamentos</option>
                    <option value="descartables">🧷 Descartables</option>
                </select>
            </div>

            {/* Selector de lista (chips grandes) */}
            {listasActivas.length > 0 ? (
                <div style={S.chipsRow}>
                    <button
                        style={{ ...S.chip, ...(verTodas ? S.chipActive : {}) }}
                        onClick={() => setVerTodas(true)}
                    >
                        📊 Ver todas
                    </button>
                    {listasActivas.map(l => {
                        const sel = !verTodas && listaActiva?.id === l.id;
                        return (
                            <button
                                key={l.id}
                                style={{ ...S.chip, ...(sel ? S.chipActive : {}) }}
                                onClick={() => { setVerTodas(false); setListaActivaId(l.id); }}
                            >
                                {l.nombre} <span style={S.chipMult}>×{l.multiplicador}</span>
                            </button>
                        );
                    })}
                </div>
            ) : (
                <div style={S.emptyLists}>
                    <p style={{ margin: 0, fontSize: 18 }}>Todavía no hay listas creadas.</p>
                    <button style={S.btnPrimary} onClick={() => setGestionar(true)}>➕ Crear primera lista</button>
                </div>
            )}

            {/* Resultados */}
            {filtrados.length === 0 ? (
                <div style={S.empty}><span style={{ fontSize: 40 }}>📭</span><p>No se encontraron productos</p></div>
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

/* ── Vista de UNA lista: tarjetas grandes (ideal mobile) ───────────────── */
function ListaSimple({ items, lista }) {
    return (
        <div style={S.cards}>
            {items.map(item => {
                const costo = Number(item.precioReferencia) || 0;
                const precio = costo * Number(lista.multiplicador || 1);
                return (
                    <div key={item.id || item.nombre} style={S.card}>
                        <div style={S.cardLeft}>
                            <span style={S.cardIcon}>{item.tipo === "medicamento" ? "💊" : "🧷"}</span>
                            <div>
                                <p style={S.cardName}>{String(item.nombre).replace(/_/g, " ")}</p>
                                <p style={S.cardMeta}>
                                    {item.presentacion} · Costo {formatCurrency(costo)}
                                </p>
                            </div>
                        </div>
                        <div style={S.cardPriceBox}>
                            <span style={S.cardPriceLabel}>{lista.nombre}</span>
                            <span style={S.cardPrice}>{formatCurrency(precio)}</span>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ── Vista TODAS las listas: tabla comparativa (ideal PC) ──────────────── */
function TablaTodas({ items, listas }) {
    return (
        <div style={{ overflowX: "auto" }}>
            <table style={S.table}>
                <thead>
                    <tr>
                        <th style={{ ...S.th, textAlign: "left" }}>Producto</th>
                        <th style={S.th}>Costo</th>
                        {listas.map(l => (
                            <th key={l.id} style={S.th}>{l.nombre}<br /><small style={{ opacity: .6 }}>×{l.multiplicador}</small></th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map(item => {
                        const costo = Number(item.precioReferencia) || 0;
                        return (
                            <tr key={item.id || item.nombre} style={S.tr}>
                                <td style={{ ...S.td, textAlign: "left" }}>
                                    <span style={{ marginRight: 8 }}>{item.tipo === "medicamento" ? "💊" : "🧷"}</span>
                                    {String(item.nombre).replace(/_/g, " ")}
                                </td>
                                <td style={{ ...S.td, fontWeight: 600 }}>{formatCurrency(costo)}</td>
                                {listas.map(l => (
                                    <td key={l.id} style={{ ...S.td, fontWeight: 700, color: "#047857" }}>
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

/* ── Estilos accesibles (texto grande, alto contraste, áreas táctiles) ── */
const S = {
    wrap: { display: "flex", flexDirection: "column", gap: 16, fontSize: 17, color: "#1f2937" },
    header: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 },
    title: { margin: 0, fontSize: 26, fontWeight: 800 },
    subtitle: { margin: "4px 0 0", fontSize: 16, color: "#6b7280" },
    btnManage: { fontSize: 17, fontWeight: 700, padding: "12px 18px", minHeight: 48, borderRadius: 12, border: "2px solid #d1d5db", background: "#fff", cursor: "pointer" },
    btnPrimary: { fontSize: 18, fontWeight: 700, padding: "14px 22px", minHeight: 52, borderRadius: 12, border: "none", background: "#2563eb", color: "#fff", cursor: "pointer" },
    controls: { display: "flex", gap: 12, flexWrap: "wrap" },
    searchWrap: { position: "relative", flex: 1, minWidth: 220 },
    searchIcon: { position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 20 },
    search: { width: "100%", boxSizing: "border-box", fontSize: 18, padding: "14px 14px 14px 46px", minHeight: 52, borderRadius: 12, border: "2px solid #d1d5db" },
    select: { fontSize: 18, padding: "0 14px", minHeight: 52, borderRadius: 12, border: "2px solid #d1d5db", background: "#fff", cursor: "pointer" },
    chipsRow: { display: "flex", gap: 10, flexWrap: "wrap" },
    chip: { fontSize: 17, fontWeight: 700, padding: "12px 18px", minHeight: 48, borderRadius: 999, border: "2px solid #d1d5db", background: "#fff", color: "#374151", cursor: "pointer" },
    chipActive: { background: "#2563eb", borderColor: "#2563eb", color: "#fff" },
    chipMult: { opacity: .7, fontWeight: 600, marginLeft: 4 },
    cards: { display: "flex", flexDirection: "column", gap: 10 },
    card: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, border: "2px solid #e5e7eb", background: "#fff" },
    cardLeft: { display: "flex", alignItems: "center", gap: 12, minWidth: 0 },
    cardIcon: { fontSize: 28 },
    cardName: { margin: 0, fontSize: 18, fontWeight: 700, lineHeight: 1.2 },
    cardMeta: { margin: "4px 0 0", fontSize: 15, color: "#6b7280" },
    cardPriceBox: { display: "flex", flexDirection: "column", alignItems: "flex-end", textAlign: "right", whiteSpace: "nowrap" },
    cardPriceLabel: { fontSize: 13, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: .3 },
    cardPrice: { fontSize: 24, fontWeight: 800, color: "#047857" },
    table: { width: "100%", borderCollapse: "collapse", fontSize: 16, background: "#fff", borderRadius: 12, overflow: "hidden" },
    th: { padding: "14px 12px", textAlign: "center", fontSize: 15, background: "#f3f4f6", borderBottom: "2px solid #e5e7eb", fontWeight: 700 },
    tr: { borderBottom: "1px solid #f1f1f1" },
    td: { padding: "14px 12px", textAlign: "center" },
    empty: { textAlign: "center", padding: 40, color: "#6b7280" },
    emptyLists: { display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: 28, border: "2px dashed #d1d5db", borderRadius: 14, background: "#fafafa" },
};
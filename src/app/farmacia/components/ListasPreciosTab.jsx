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

    // ─── Exportar CSV con separador ; y coma decimal ──────────────
    const descargarCSV = () => {
        const listasExport = verTodas ? listasActivas : (listaActiva ? [listaActiva] : []);
        if (listasExport.length === 0) {
            alert("No hay listas para exportar.");
            return;
        }

        // Cabeceras: Producto;Presentación;Tipo;PrecioLista1;PrecioLista2;...
        const cabeceras = ["Producto", "Presentación", "Tipo"];
        listasExport.forEach((l) => {
            cabeceras.push(listasExport.length === 1 ? "Precio ($)" : l.nombre);
        });

        // Filas: cada producto en una fila
        const filas = filtrados.map(item => {
            const costo = Number(item.precioCosto) || 0;
            const tipo = item.tipo === "medicamento" ? "Medicamento" : "Descartable";
            const presentacion = String(item.presentacion || "").replace(/_/g, " ").trim();
            const nombre = String(item.nombre).replace(/_/g, " ");

            // Valores entre comillas dobles, separador ; y decimal con ,
            const fila = [
                `"${nombre}"`,
                `"${presentacion}"`,
                `"${tipo}"`
            ];

            listasExport.forEach(l => {
                const precio = costo * Number(l.multiplicador || 1);
                // Reemplazar punto por coma para separador decimal
                fila.push(`"${precio.toFixed(2).replace(".", ",")}"`);
            });

            return fila.join(";"); // ¡separador punto y coma!
        });

        // Unir con saltos de línea
        const csvContent = [cabeceras.join(";"), ...filas].join("\n");

        // Descargar
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "listas_precios.csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    // ─── Imprimir ────────────────────────────────────────────────────
    const imprimir = () => {
        window.print();
    };

    return (
        <div className={s.panel} id="listas-precios-container">
            <div className={s.panelHeader}>
                <div>
                    <h3 className={s.panelTitle}>💲 Listas de Precios</h3>
                    <p className={s.panelSub}>
                        {filtrados.length} productos · costo × multiplicador de cada lista
                    </p>
                </div>
                <div className={s.panelActions}>
                    <button className={`${s.actionBtn} ${s.btn_secondary}`} onClick={descargarCSV} disabled={filtrados.length === 0}>
                        ⬇️ CSV
                    </button>
                    <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={imprimir} disabled={filtrados.length === 0}>
                        🖨️ Imprimir
                    </button>
                    <button className={`${s.actionBtn} ${s.btn_import}`} onClick={() => setGestionar(true)}>
                        ⚙️ Gestionar
                    </button>
                </div>
            </div>

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
        <div className={s.printContent}>
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
        </div>
    );
}

/* ── Vista TODAS las listas: tabla comparativa (ideal para PC) ──────────── */
function TablaTodas({ items, listas }) {
    return (
        <div className={s.printContent}>
            <div className={s.tableWrap} style={{ display: "block" }}>
                <table className={s.precioTable}>
                    <thead>
                        <tr>
                            <th className={s.thLeft}>Producto</th>
                            <th>Tipo</th>
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
                                        {String(item.nombre).replace(/_/g, " ")}
                                    </td>
                                    <td>
                                        {item.tipo === "medicamento" ? "Medicamento" : "Descartable"}
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
        </div>
    );
}
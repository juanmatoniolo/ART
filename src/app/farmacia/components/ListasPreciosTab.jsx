"use client";

import { useState, useMemo } from "react";
import { formatCurrency, matchesAllTerms } from "../utils/farmacia";
import GestionarListasModal from "./modals/GestionarListasModal";
import s from "../farmaciaDashboard.module.css";

export default function ListasPreciosTab({
    items = [],
    listas = [],
    onGuardarLista,
    onEliminarLista,
    onActualizarItem,
}) {
    // ─── Estados ────────────────────────────────────────────────
    const [busqueda, setBusqueda] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [listaActivaId, setListaActivaId] = useState(null);
    const [verTodas, setVerTodas] = useState(false);
    const [gestionar, setGestionar] = useState(false);
    const [listaEditar, setListaEditar] = useState(null);

    // Edición inline
    const [editando, setEditando] = useState(null);
    const [preciosEditados, setPreciosEditados] = useState({
        precioCosto: "",
        precioFacturacion: "",
        precioOtros: "",
    });
    const [guardando, setGuardando] = useState(false);

    // ─── Listas activas ─────────────────────────────────────────
    const listasActivas = useMemo(
        () => [...listas].filter(l => l.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0)),
        [listas]
    );

    const listaActiva = listasActivas.find(l => l.id === listaActivaId) || listasActivas[0] || null;

    // ─── Productos filtrados ────────────────────────────────────
    const filtrados = useMemo(() => {
        return items.filter(item => {
            if (item.activo === false) return false;
            const matchB = matchesAllTerms(item.nombre, busqueda) || matchesAllTerms(item.presentacion, busqueda);
            const matchT = filtroTipo === "todos"
                || (filtroTipo === "medicamentos" && item.tipo === "medicamento")
                || (filtroTipo === "descartables" && item.tipo === "descartable");
            return matchB && matchT;
        });
    }, [items, busqueda, filtroTipo]);

    // ─── Listas a mostrar en la tabla ──────────────────────────
    const listasMostrar = verTodas ? listasActivas : (listaActiva ? [listaActiva] : []);

    // ─── Edición de precios ─────────────────────────────────────
    const comenzarEdicion = (item) => {
        const id = item.id || item.nombre;
        setEditando(id);
        setPreciosEditados({
            precioCosto: item.precioCosto ?? item.precioReferencia ?? 0,
            precioFacturacion: item.precioFacturacion ?? 0,
            precioOtros: item.precioOtros ?? 0,
        });
    };

    const cancelarEdicion = () => {
        setEditando(null);
        setPreciosEditados({ precioCosto: "", precioFacturacion: "", precioOtros: "" });
        setGuardando(false);
    };

    const cambiarPrecio = (campo, valor) => {
        const limpio = valor.replace(/[^0-9.,]/g, "");
        setPreciosEditados(prev => ({ ...prev, [campo]: limpio }));
    };

    const manejarTeclado = (e, item) => {
        if (e.key === "Enter") {
            e.preventDefault();
            guardarPrecios(item);
        }
        if (e.key === "Escape") {
            cancelarEdicion();
        }
    };

    const guardarPrecios = async (item) => {
        if (!onActualizarItem) {
            alert("Función para guardar no configurada.");
            return;
        }

        const convertir = (valor) => {
            if (valor === "" || valor === null || valor === undefined) return 0;
            const numero = Number(String(valor).replace(/\./g, "").replace(",", "."));
            return Number.isFinite(numero) ? numero : 0;
        };

        const datos = {
            ...item,
            precioCosto: convertir(preciosEditados.precioCosto),
            precioFacturacion: convertir(preciosEditados.precioFacturacion),
            precioOtros: convertir(preciosEditados.precioOtros),
        };

        setGuardando(true);
        try {
            await onActualizarItem(item, datos);
            setEditando(null);
            setPreciosEditados({ precioCosto: "", precioFacturacion: "", precioOtros: "" });
            setGuardando(false);
        } catch (error) {
            console.error("Error guardando:", error);
            alert("No se pudieron guardar los cambios.");
            setGuardando(false);
        }
    };

    // ─── Exportar CSV ────────────────────────────────────────────
    const descargarCSV = (modo) => {
        let listasExport = [];
        if (modo === 'activa') {
            if (!listaActiva) { alert("No hay lista activa seleccionada."); return; }
            listasExport = [listaActiva];
        } else {
            listasExport = listasActivas;
        }

        if (listasExport.length === 0 || filtrados.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }

        const cabeceras = ["Producto", "Presentación", "Tipo", "Precio Costo", "Precio Facturación", "Otros Precios"];
        listasExport.forEach(l => cabeceras.push(l.nombre));

        const filas = filtrados.map(item => {
            const costo = Number(item.precioCosto ?? item.precioReferencia ?? 0);
            const facturacion = Number(item.precioFacturacion ?? 0);
            const otros = Number(item.precioOtros ?? 0);
            const tipo = item.tipo === "medicamento" ? "Medicamento" : "Descartable";
            const presentacion = String(item.presentacion || "").replace(/_/g, " ").trim();
            const nombre = String(item.nombre || "").replace(/_/g, " ");

            const fila = [
                `"${nombre}"`,
                `"${presentacion}"`,
                `"${tipo}"`,
                `"${costo.toFixed(2).replace(".", ",")}"`,
                `"${facturacion.toFixed(2).replace(".", ",")}"`,
                `"${otros.toFixed(2).replace(".", ",")}"`,
            ];

            listasExport.forEach(l => {
                const precio = costo * Number(l.multiplicador || 1);
                fila.push(`"${precio.toFixed(2).replace(".", ",")}"`);
            });

            return fila.join(";");
        });

        const csvContent = [cabeceras.join(";"), ...filas].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `precios_${modo}_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    // ─── Imprimir ────────────────────────────────────────────────
    const imprimir = (modo) => {
        if (typeof window !== 'undefined') {
            window.__imprimirModo = modo;
        }
        window.print();
    };

    // ─── Gestión de listas ──────────────────────────────────────
    const abrirEdicionLista = (lista) => {
        setListaEditar(lista);
        setGestionar(true);
    };

    const abrirNuevaLista = () => {
        setListaEditar(null);
        setGestionar(true);
    };

    // ─── Render ──────────────────────────────────────────────────
    return (
        <div className={s.panel} id="listas-precios-container">
            {/* HEADER */}
            <div className={s.panelHeader}>
                <div>
                    <h3 className={s.panelTitle}>💲 Listas de Precios</h3>
                    <p className={s.panelSub}>
                        {filtrados.length} productos · {listasActivas.length} listas activas
                    </p>
                </div>
                <div className={s.panelActions}>
                    <button
                        className={`${s.actionBtn} ${s.btn_secondary}`}
                        onClick={() => descargarCSV('activa')}
                        disabled={!listaActiva || filtrados.length === 0}
                    >
                        CSV (activa)
                    </button>
                    <button
                        className={`${s.actionBtn} ${s.btn_secondary}`}
                        onClick={() => descargarCSV('todas')}
                        disabled={listasActivas.length === 0 || filtrados.length === 0}
                    >
                        CSV (todas)
                    </button>
                    <button
                        className={`${s.actionBtn} ${s.btn_primary}`}
                        onClick={() => imprimir('activa')}
                        disabled={!listaActiva || filtrados.length === 0}
                    >
                        Imprimir activa
                    </button>
                    <button
                        className={`${s.actionBtn} ${s.btn_primary}`}
                        onClick={() => imprimir('todas')}
                        disabled={listasActivas.length === 0 || filtrados.length === 0}
                    >
                        Imprimir todas
                    </button>
                    <button className={`${s.actionBtn} ${s.btn_import}`} onClick={abrirNuevaLista}>
                        ⚙️ Gestionar
                    </button>
                </div>
            </div>

            {/* FILTROS */}
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

            {/* CHIPS DE LISTAS */}
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
                            <div key={l.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                                <button
                                    className={`${s.precioChip} ${sel ? s.precioChipActive : ""}`}
                                    onClick={() => { setVerTodas(false); setListaActivaId(l.id); }}
                                >
                                    {l.nombre} <span className={s.precioChipMult}>×{l.multiplicador}</span>
                                </button>
                                <button
                                    className={s.iconBtn}
                                    onClick={() => abrirEdicionLista(l)}
                                    title="Editar lista"
                                    style={{
                                        width: "34px",
                                        height: "34px",
                                        borderRadius: "50%",
                                        background: "var(--c-bg)",
                                        border: "1px solid var(--c-border)",
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "16px"
                                    }}
                                >
                                    ✏️
                                </button>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className={s.emptyState}>
                    <span>📋</span>
                    <p>Todavía no hay listas creadas.</p>
                    <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={abrirNuevaLista}>
                        ➕ Crear primera lista
                    </button>
                </div>
            )}

            {/* TABLA */}
            {filtrados.length === 0 ? (
                <div className={s.emptyState}>
                    <span>📭</span>
                    <p>No se encontraron productos</p>
                </div>
            ) : (
                <div className={s.printContent}>
                    <div className={s.tableWrap} style={{ display: "block", overflowX: "auto" }}>
                        <table className={s.precioTable} style={{ width: "100%", minWidth: "1100px", borderCollapse: "collapse" }}>
                            <thead>
                                <tr>
                                    <th className={s.thLeft} style={{ minWidth: "180px" }}>Producto</th>
                                    <th style={{ minWidth: "100px" }}>Presentación</th>
                                    <th style={{ minWidth: "100px" }}>Tipo</th>
                                    <th style={{ minWidth: "120px" }}>Precio costo</th>
                                    <th style={{ minWidth: "140px" }}>Precio facturación</th>
                                    <th style={{ minWidth: "120px" }}>Otros precios</th>
                                    {listasMostrar.map(l => (
                                        <th key={l.id} style={{ minWidth: "110px" }}>
                                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2px" }}>
                                                <strong>{l.nombre}</strong>
                                                <small style={{ opacity: 0.7 }}>×{l.multiplicador || 1}</small>
                                            </div>
                                        </th>
                                    ))}
                                    <th style={{ minWidth: "100px" }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtrados.map(item => {
                                    const id = item.id || item.nombre;
                                    const estaEditando = editando === id;
                                    const costo = Number(item.precioCosto ?? item.precioReferencia ?? 0);
                                    const facturacion = Number(item.precioFacturacion ?? 0);
                                    const otros = Number(item.precioOtros ?? 0);

                                    return (
                                        <tr key={id}>
                                            <td className={s.tdLeft}>
                                                <strong>{String(item.nombre).replace(/_/g, " ")}</strong>
                                            </td>
                                            <td>{String(item.presentacion || "").replace(/_/g, " ")}</td>
                                            <td>
                                                <span className={item.tipo === "medicamento" ? s.badgeMed : s.badgeDesc}>
                                                    {item.tipo === "medicamento" ? "Medicamento" : "Descartable"}
                                                </span>
                                            </td>

                                            {/* Precio Costo */}
                                            <td className={s.precioCell}>
                                                {estaEditando ? (
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={preciosEditados.precioCosto}
                                                        onChange={e => cambiarPrecio("precioCosto", e.target.value)}
                                                        onKeyDown={e => manejarTeclado(e, item)}
                                                        style={estilos.inputPrecio}
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => comenzarEdicion(item)}
                                                        style={estilos.precioClickable}
                                                        title="Doble clic o clic para editar"
                                                    >
                                                        {formatCurrency(costo)}
                                                    </button>
                                                )}
                                            </td>

                                            {/* Precio Facturación */}
                                            <td className={s.precioCell}>
                                                {estaEditando ? (
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={preciosEditados.precioFacturacion}
                                                        onChange={e => cambiarPrecio("precioFacturacion", e.target.value)}
                                                        onKeyDown={e => manejarTeclado(e, item)}
                                                        style={estilos.inputPrecio}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => comenzarEdicion(item)}
                                                        style={estilos.precioClickable}
                                                        title="Doble clic o clic para editar"
                                                    >
                                                        {formatCurrency(facturacion)}
                                                    </button>
                                                )}
                                            </td>

                                            {/* Otros Precios */}
                                            <td className={s.precioCell}>
                                                {estaEditando ? (
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={preciosEditados.precioOtros}
                                                        onChange={e => cambiarPrecio("precioOtros", e.target.value)}
                                                        onKeyDown={e => manejarTeclado(e, item)}
                                                        style={estilos.inputPrecio}
                                                    />
                                                ) : (
                                                    <button
                                                        onClick={() => comenzarEdicion(item)}
                                                        style={estilos.precioClickable}
                                                        title="Doble clic o clic para editar"
                                                    >
                                                        {formatCurrency(otros)}
                                                    </button>
                                                )}
                                            </td>

                                            {/* Columnas de listas */}
                                            {listasMostrar.map(l => {
                                                const precio = costo * Number(l.multiplicador || 1);
                                                return (
                                                    <td key={l.id} style={{ textAlign: "center", fontWeight: 600, color: "var(--c-primary, #2563eb)" }}>
                                                        {formatCurrency(precio)}
                                                    </td>
                                                );
                                            })}

                                            {/* Acciones */}
                                            <td>
                                                {estaEditando ? (
                                                    <div style={estilos.acciones}>
                                                        <button
                                                            onClick={() => guardarPrecios(item)}
                                                            disabled={guardando}
                                                            style={estilos.btnGuardar}
                                                            title="Guardar cambios"
                                                        >
                                                            {guardando ? "⏳" : "💾"}
                                                        </button>
                                                        <button
                                                            onClick={cancelarEdicion}
                                                            style={estilos.btnCancelar}
                                                            title="Cancelar edición"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => comenzarEdicion(item)}
                                                        style={estilos.btnEditar}
                                                    >
                                                        ✏️ Editar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* MODAL GESTIONAR LISTAS */}
            {gestionar && (
                <GestionarListasModal
                    listas={listas}
                    editarLista={listaEditar}
                    onClose={() => { setGestionar(false); setListaEditar(null); }}
                    onGuardar={onGuardarLista}
                    onEliminar={onEliminarLista}
                />
            )}
        </div>
    );
}

// ─── Estilos locales ────────────────────────────────────────────────
const estilos = {
    inputPrecio: {
        width: "110px",
        padding: "6px 8px",
        borderRadius: "6px",
        border: "2px solid var(--c-primary, #2563eb)",
        background: "var(--c-surface, #fff)",
        color: "inherit",
        fontSize: "14px",
        fontWeight: 600,
        outline: "none",
        textAlign: "right",
    },
    precioClickable: {
        background: "none",
        border: "none",
        cursor: "pointer",
        fontSize: "inherit",
        fontWeight: 600,
        padding: "4px 8px",
        borderRadius: "4px",
        transition: "background 0.2s",
        color: "var(--c-text)",
        width: "100%",
        textAlign: "right",
    },
    acciones: {
        display: "flex",
        gap: "4px",
        justifyContent: "center",
    },
    btnEditar: {
        border: "1px solid var(--c-border)",
        background: "var(--c-bg)",
        borderRadius: "6px",
        padding: "5px 10px",
        cursor: "pointer",
        fontSize: "12px",
        whiteSpace: "nowrap",
    },
    btnGuardar: {
        border: "1px solid #16a34a",
        background: "#16a34a",
        color: "#fff",
        borderRadius: "6px",
        padding: "5px 10px",
        cursor: "pointer",
        fontSize: "14px",
        minWidth: "36px",
    },
    btnCancelar: {
        border: "1px solid #dc2626",
        background: "#dc2626",
        color: "#fff",
        borderRadius: "6px",
        padding: "5px 10px",
        cursor: "pointer",
        fontSize: "14px",
        minWidth: "36px",
    },
};
"use client";
import { useState, useMemo } from "react";
import Icon from "./Icon";
import { formatCurrency } from "../utils/farmacia";
import s from "../farmaciaDashboard.module.css";

export default function MovimientosTab({ movimientos }) {
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaFin, setFechaFin] = useState("");
    const [busqueda, setBusqueda] = useState("");

    const movimientosFiltrados = useMemo(() => {
        return movimientos.filter(mov => {
            // Filtro por tipo
            if (filtroTipo === "ingresos" && mov.tipo !== "ingreso") return false;
            if (filtroTipo === "egresos" && mov.tipo !== "reparto") return false;

            // Filtro por rango de fechas (fechaFormatted o fechaRaw)
            const fechaMov = mov.fechaRaw || mov.fechaFormatted;
            if (fechaInicio && fechaMov < fechaInicio) return false;
            if (fechaFin && fechaMov > fechaFin) return false;

            // Filtro por búsqueda (producto, destino, responsable)
            if (busqueda.trim()) {
                const q = busqueda.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                const texto = [
                    mov.tipo,
                    mov.destino,
                    mov.responsable,
                    ...(mov.productos?.map(p => p.itemNombre) || [])
                ].join(" ").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                if (!texto.includes(q)) return false;
            }

            return true;
        });
    }, [movimientos, filtroTipo, fechaInicio, fechaFin, busqueda]);

    // Totales filtrados
    const totales = useMemo(() => {
        return movimientosFiltrados.reduce((acc, mov) => {
            acc.cantidad += 1;
            acc.unidades += mov.totalUnidades || 0;
            acc.valor += mov.valorTotal || 0;
            return acc;
        }, { cantidad: 0, unidades: 0, valor: 0 });
    }, [movimientosFiltrados]);

    return (
        <div className={s.panel}>
            <div className={s.panelHeader}>
                <div>
                    <h3 className={s.panelTitle}>
                        <Icon name="list" size={24} />
                        Historial de movimientos
                    </h3>
                    <p className={s.panelSub}>
                        {movimientosFiltrados.length} registros · {totales.unidades} unidades · {formatCurrency(totales.valor)}
                    </p>
                </div>
            </div>

            {/* Filtros */}
            <div className={s.filtersRow}>
                {/* Buscador */}
                <div className={s.searchWrap}>
                    <span className={`${s.searchIconInner} ${s.svgIc}`}>
                        <Icon name="search" size={18} />
                    </span>
                    <input
                        className={s.searchInput}
                        placeholder="Buscar por producto, destino o responsable..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                {/* Selector de tipo */}
                <select
                    className={s.filterSelect}
                    value={filtroTipo}
                    onChange={(e) => setFiltroTipo(e.target.value)}
                >
                    <option value="todos">Todos los movimientos</option>
                    <option value="ingresos">✅ Ingresos</option>
                    <option value="egresos">📤 Egresos (repartos)</option>
                </select>

                {/* Fecha inicio */}
                <input
                    type="date"
                    className={s.filterSelect}
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                    title="Fecha desde"
                />

                {/* Fecha fin */}
                <input
                    type="date"
                    className={s.filterSelect}
                    value={fechaFin}
                    onChange={(e) => setFechaFin(e.target.value)}
                    title="Fecha hasta"
                />

                {/* Botón limpiar filtros */}
                {(filtroTipo !== "todos" || fechaInicio || fechaFin || busqueda) && (
                    <button
                        className={`${s.actionBtn} ${s.btnCancel}`}
                        onClick={() => {
                            setFiltroTipo("todos");
                            setFechaInicio("");
                            setFechaFin("");
                            setBusqueda("");
                        }}
                    >
                        <Icon name="close" size={16} />
                        Limpiar
                    </button>
                )}
            </div>

            {movimientosFiltrados.length === 0 ? (
                <div className={s.emptyState}>
                    <Icon name="inbox" size={48} />
                    <p>No hay movimientos que coincidan con los filtros</p>
                </div>
            ) : (
                <div className={s.movimientosList}>
                    {movimientosFiltrados.map((mov) => (
                        <MovCard key={mov.id} mov={mov} />
                    ))}
                </div>
            )}
        </div>
    );
}

function MovCard({ mov }) {
    const isIn = mov.tipo === "ingreso";
    const total = mov.valorTotal || 0;

    return (
        <div className={`${s.movCard} ${isIn ? s.movCardIn : s.movCardOut}`}>
            {/* Cabecera */}
            <div className={s.movCardHead}>
                <span className={`${s.movBadge} ${isIn ? s.movBadgeIn : s.movBadgeOut}`}>
                    <Icon name={isIn ? "download" : "truck"} size={16} />
                    {isIn ? "Ingreso" : "Reparto"}
                </span>

                {!isIn && mov.destino && (
                    <span className={s.movChip}>
                        <Icon name="pin" size={14} />
                        {mov.destino}
                    </span>
                )}

                {!isIn && mov.responsable && (
                    <span className={s.movChip}>
                        <Icon name="user" size={14} />
                        {mov.responsable}
                    </span>
                )}

                <span className={s.movCardDate}>
                    <Icon name="calendar" size={14} style={{ marginRight: 4 }} />
                    {mov.fechaFormatted}
                </span>
            </div>

            {/* Resumen */}
            <div className={s.movCardStats}>
                <span>
                    <Icon name="box" size={16} style={{ marginRight: 4 }} />
                    <b>{mov.totalProductos || 0}</b> productos
                </span>
                <span>
                    <Icon name="list" size={16} style={{ marginRight: 4 }} />
                    <b>{mov.totalUnidades || 0}</b> unidades
                </span>
                <span className={isIn ? s.valIn : s.valOut}>
                    <Icon name="money" size={16} style={{ marginRight: 4 }} />
                    {formatCurrency(total)}
                </span>
            </div>

            {/* Tabla de productos */}
            <div className={s.movTableWrap}>
                <table className={s.movCardTable}>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Cant.</th>
                            <th>Antes</th>
                            <th>Después</th>
                            <th>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mov.productos?.map((p, idx) => (
                            <tr key={idx}>
                                <td>
                                    <span className={s.productName}>
                                        {p.itemNombre?.replace(/_/g, " ")}
                                    </span>
                                </td>
                                <td>
                                    <span className={isIn ? s.movQtyPos : s.movQtyNeg}>
                                        {isIn ? "+" : "−"}
                                        {p.cantidad}
                                    </span>
                                </td>
                                <td>{p.stockAnterior}</td>
                                <td>
                                    <strong className={s.stockAfter}>
                                        {p.stockNuevo}
                                    </strong>
                                </td>
                                <td>{formatCurrency(p.cantidad * p.precioUnitario)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
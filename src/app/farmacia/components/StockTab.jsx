"use client";

import { useState, useMemo, useEffect } from "react";
import s from "../styles/StockTab.module.css";
import Icon from "./Icon";
import {
    formatCurrency,
    getStockColor,
    getStockStatus,
    matchesAllTerms
} from "../utils/farmacia";
import EditarProductoModal from "./modals/EditarProductoModal";
import EliminarModal from "./modals/EliminarModal";

export default function StockTab({
    items,
    estadisticas,
    onAgregar,
    onCargaMasiva,
    onImportar,
    editarProducto,
    eliminarProducto,
    bajoStockFilter = false // 🆕 prop para activar filtro desde el padre
}) {
    const [busqueda, setBusqueda] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [filtroStock, setFiltroStock] = useState("todos"); // 🆕 "todos" | "bajo" | "sin_stock" | "con_stock"
    const [stockMin, setStockMin] = useState(""); // 🆕 rango mínimo
    const [stockMax, setStockMax] = useState(""); // 🆕 rango máximo
    const [editItem, setEditItem] = useState(null);
    const [deleteItem, setDeleteItem] = useState(null);

    // 🆕 Efecto para aplicar filtro desde el padre (bajoStockFilter)
    useEffect(() => {
        if (bajoStockFilter) {
            setFiltroStock("bajo");
            // Limpiar otros filtros para evitar confusiones
            setStockMin("");
            setStockMax("");
        }
    }, [bajoStockFilter]);

    // Función para limpiar todos los filtros
    const limpiarFiltros = () => {
        setBusqueda("");
        setFiltroTipo("todos");
        setFiltroStock("todos");
        setStockMin("");
        setStockMax("");
    };

    const filtrados = useMemo(() => {
        return items.filter((item) => {
            // Filtro por búsqueda
            const matchB =
                matchesAllTerms(item.nombre, busqueda) ||
                matchesAllTerms(item.presentacion, busqueda);

            // Filtro por tipo
            const matchT =
                filtroTipo === "todos" ||
                (filtroTipo === "medicamentos" && item.tipo === "medicamento") ||
                (filtroTipo === "descartables" && item.tipo === "descartable");

            // Filtro por estado de stock
            let matchStock = true;
            if (filtroStock === "bajo") {
                matchStock = item.stockActual > 0 && item.stockActual < item.stockMinimo;
            } else if (filtroStock === "sin_stock") {
                matchStock = item.stockActual === 0;
            } else if (filtroStock === "con_stock") {
                matchStock = item.stockActual > 0;
            }

            // Filtro por rango de stock (si se ingresaron valores)
            let matchRango = true;
            const min = parseInt(stockMin);
            const max = parseInt(stockMax);
            if (!isNaN(min)) {
                matchRango = matchRango && item.stockActual >= min;
            }
            if (!isNaN(max)) {
                matchRango = matchRango && item.stockActual <= max;
            }

            return matchB && matchT && matchStock && matchRango && item.activo;
        });
    }, [items, busqueda, filtroTipo, filtroStock, stockMin, stockMax]);

    return (
        <>
            <div className={s.panel}>
                {/* HEADER */}
             
                <div className={s.panelHeader}>
                    <div>
                        <h3 className={s.panelTitle}>
                            <Icon name="box" size={20} /> Control de Stock
                        </h3>
                        <p className={s.panelSub}>
                            {filtrados.length} productos · {formatCurrency(estadisticas.valorTotalStock)}
                        </p>
                    </div>
                    <div className={s.panelActions}>
                        <button className={`${s.actionBtn} ${s.btn_primary}`} onClick={onAgregar}>
                            <Icon name="plus" size={18} />
                            <span className={s.actionBtnLabel}>Nuevo producto</span>
                        </button>
                        <button className={`${s.actionBtn} ${s.btn_secondary}`} onClick={onCargaMasiva}>
                            <Icon name="download" size={18} />
                            <span className={s.actionBtnLabel}>Ingreso de mercadería</span>
                        </button>
                        <button className={`${s.actionBtn} ${s.btn_import}`} onClick={onImportar}>
                            <Icon name="file" size={18} />
                            <span className={s.actionBtnLabel}>CSV</span>
                        </button>
                        <button className={`${s.actionBtn} ${s.btn_reparto}`} onClick={() => window.location.href = '/farmacia/reparto'}>
                            <Icon name="truck" size={18} /> {/* O usa 🚚 si no tienes Icon */}
                            <span className={s.actionBtnLabel}>Repartir mercadería</span>
                        </button>
                    </div>
                </div>

                {/* FILTROS */}
                <div className={s.filtersRow}>
                    <div className={s.searchWrap}>
                        <span className={`${s.searchIconInner} ${s.svgIc}`}>
                            <Icon name="search" size={18} />
                        </span>
                        <input
                            className={s.searchInput}
                            placeholder="Buscar producto..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>

                    <select
                        className={s.filterSelect}
                        value={filtroTipo}
                        onChange={(e) => setFiltroTipo(e.target.value)}
                    >
                        <option value="todos">Todos</option>
                        <option value="medicamentos">Medicamentos</option>
                        <option value="descartables">Descartables</option>
                    </select>

                    {/* 🆕 Filtro por stock */}
                    <select
                        className={s.filterSelect}
                        value={filtroStock}
                        onChange={(e) => setFiltroStock(e.target.value)}
                    >
                        <option value="todos">Stock: Todos</option>
                        <option value="bajo">Stock Bajo</option>
                        <option value="sin_stock">Sin Stock</option>
                        <option value="con_stock">Con Stock</option>
                    </select>

                    {/* 🆕 Rango de stock */}
                    <input
                        type="number"
                        className={s.filterSelect}
                        placeholder="Min stock"
                        value={stockMin}
                        onChange={(e) => setStockMin(e.target.value)}
                        style={{ width: "100px" }}
                    />
                    <input
                        type="number"
                        className={s.filterSelect}
                        placeholder="Max stock"
                        value={stockMax}
                        onChange={(e) => setStockMax(e.target.value)}
                        style={{ width: "100px" }}
                    />

                    {/* Botón limpiar filtros */}
                    <button
                        className={`${s.actionBtn} ${s.btnCancel}`}
                        onClick={limpiarFiltros}
                        title="Limpiar todos los filtros"
                    >
                        <Icon name="close" size={16} />
                        <span className={s.actionBtnLabel}>Limpiar</span>
                    </button>
                </div>

                {/* MOBILE - CARDS */}
                <div className={s.stockCards}>
                    {filtrados.map((item) => {
                        const color = getStockColor(item.stockActual, item.stockMinimo);
                        const valorTotal = item.stockActual * (item.precioCosto || 0);
                        return (
                            <div key={item.id} className={s.stockCard}>
                                <div className={s.stockCardHeader}>
                                    <div className={s.stockCardInfo}>
                                        <span className={`${s.stockCardIcon} ${s.svgIc}`} style={{ color }}>
                                            <Icon
                                                name={item.tipo === "medicamento" ? "pills" : "box"}
                                                size={22}
                                            />
                                        </span>
                                        <div>
                                            <p className={s.stockCardName}>
                                                {item.nombre.replace(/_/g, " ")}
                                            </p>
                                            <p className={s.stockCardMeta}>
                                                {item.presentacion}
                                            </p>
                                        </div>
                                    </div>
                                    <div className={s.stockCardActions}>
                                        <button className={`${s.iconBtn} ${s.svgIc}`} onClick={() => setEditItem(item)} title="Editar">
                                            <Icon name="edit" size={18} />
                                        </button>
                                        <button className={`${s.iconBtn} ${s.iconBtnDanger} ${s.svgIc}`} onClick={() => setDeleteItem(item)} title="Eliminar">
                                            <Icon name="trash" size={18} />
                                        </button>
                                    </div>
                                </div>
                                <div className={s.stockCardPrecios}>
                                    <span className={s.precioCosto}>Costo: {formatCurrency(item.precioCosto)}</span>
                                    <span className={s.precioFact}>Fact.: {formatCurrency(item.precioFacturacion)}</span>
                                    <span className={s.precioOtros}>Otros: {formatCurrency(item.precioOtros)}</span>
                                </div>
                                <div className={s.stockCardFooter}>
                                    <div className={s.stockCardBar}>
                                        <div
                                            className={s.stockCardBarFill}
                                            style={{
                                                width: `${Math.min(100, (item.stockActual / item.stockMinimo) * 100)}%`,
                                                background: color
                                            }}
                                        />
                                    </div>
                                    <div className={s.stockCardNums}>
                                        <span style={{ color, fontWeight: 700 }}>{item.stockActual}</span>
                                        <span className={s.stockCardMin}>/{item.stockMinimo}</span>
                                        <span className={s.statusChip} style={{ background: color + "22", color }}>
                                            {getStockStatus(item.stockActual, item.stockMinimo)}
                                        </span>
                                    </div>
                                </div>
                                <div className={s.stockCardValor}>
                                    Valor: {formatCurrency(valorTotal)}
                                </div>
                            </div>
                        );
                    })}
                    {filtrados.length === 0 && (
                        <div className={s.emptyState}>
                            <span className={s.svgIc}><Icon name="inbox" size={40} /></span>
                            <p>No se encontraron productos</p>
                        </div>
                    )}
                </div>

                {/* DESKTOP - TABLA */}
                <div className={s.tableWrap}>
                    <table className={s.stockTable}>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Tipo</th>
                                <th>Presentación</th>
                                <th className={s.thCenter}>Stock</th>
                                <th className={s.thCenter}>Mínimo</th>
                                <th>Estado</th>
                                <th className={s.thCenter}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.map((item) => {
                                const color = getStockColor(item.stockActual, item.stockMinimo);
                                return (
                                    <tr key={item.id} className={s.stockRow}>
                                        <td>
                                            <div className={s.productCell}>
                                                <span className={`${s.productCellIcon} ${s.svgIc}`} style={{ color }}>
                                                    <Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={20} />
                                                </span>
                                                <div>
                                                    <p className={s.productCellName}>
                                                        {item.nombre.replace(/_/g, " ")}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={item.tipo === "medicamento" ? s.badgeMed : s.badgeDesc}>
                                                {item.tipo === "medicamento" ? "Medicamento" : "Descartable"}
                                            </span>
                                        </td>
                                        <td>
                                            <span className={s.badgePres}>{item.presentacion}</span>
                                        </td>
                                        <td className={s.thCenter}>
                                            <span className={s.stockNum} style={{ color }}>
                                                {item.stockActual}
                                            </span>
                                        </td>
                                        <td className={s.thCenter}>{item.stockMinimo}</td>
                                        <td>
                                            <span className={s.statusChip} style={{ background: color + "22", color }}>
                                                {getStockStatus(item.stockActual, item.stockMinimo)}
                                            </span>
                                        </td>
                                        <td className={s.thCenter}>
                                            <div className={s.tableActions}>
                                                <button className={`${s.iconBtn} ${s.svgIc}`} onClick={() => setEditItem(item)} title="Editar">
                                                    <Icon name="edit" size={18} />
                                                </button>
                                                <button className={`${s.iconBtn} ${s.iconBtnDanger} ${s.svgIc}`} onClick={() => setDeleteItem(item)} title="Eliminar">
                                                    <Icon name="trash" size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {filtrados.length === 0 && (
                        <div className={s.emptyState}>
                            <span className={s.svgIc}><Icon name="inbox" size={40} /></span>
                            <p>No se encontraron productos</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODALES */}
      {editItem && (
  <EditarProductoModal
    item={editItem}
    onClose={() => setEditItem(null)}
    onSubmit={(data) => editarProducto(editItem.id, data)} // 👈 clave
  />
)}
            {deleteItem && (
                <EliminarModal
                    item={deleteItem}
                    onClose={() => setDeleteItem(null)}
                    onSubmit={eliminarProducto}
                />
            )}
        </>
    );
}
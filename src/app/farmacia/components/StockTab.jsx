"use client";

import { useState, useMemo } from "react";
import s from "../farmaciaDashboard.module.css";
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
    eliminarProducto
}) {
    const [busqueda, setBusqueda] = useState("");
    const [filtroTipo, setFiltroTipo] = useState("todos");
    const [editItem, setEditItem] = useState(null);
    const [deleteItem, setDeleteItem] = useState(null);

    const filtrados = useMemo(
        () =>
            items.filter((item) => {
                const matchB =
                    matchesAllTerms(item.nombre, busqueda) ||
                    matchesAllTerms(item.presentacion, busqueda);

                const matchT =
                    filtroTipo === "todos" ||
                    (filtroTipo === "medicamentos" &&
                        item.tipo === "medicamento") ||
                    (filtroTipo === "descartables" &&
                        item.tipo === "descartable");

                return matchB && matchT && item.activo;
            }),
        [items, busqueda, filtroTipo]
    );

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
                            {filtrados.length} productos ·{" "}
                            {formatCurrency(estadisticas.valorTotalStock)}
                        </p>
                    </div>

                    <div className={s.panelActions}>

                        <button
                            className={`${s.actionBtn} ${s.btn_primary}`}
                            onClick={onAgregar}
                        >
                            <Icon name="plus" size={18} />
                            <span className={s.actionBtnLabel}>
                                Producto
                            </span>
                        </button>

                        <button
                            className={`${s.actionBtn} ${s.btn_secondary}`}
                            onClick={onCargaMasiva}
                        >
                            <Icon name="download" size={18} />
                            <span className={s.actionBtnLabel}>
                                Masiva
                            </span>
                        </button>

                        <button
                            className={`${s.actionBtn} ${s.btn_import}`}
                            onClick={onImportar}
                        >
                            <Icon name="file" size={18} />
                            <span className={s.actionBtnLabel}>
                                CSV
                            </span>
                        </button>

                    </div>
                </div>

                {/* FILTROS */}
                <div className={s.filtersRow}>

                    <div className={s.searchWrap}>
                        <span
                            className={`${s.searchIconInner} ${s.svgIc}`}
                        >
                            <Icon name="search" size={18} />
                        </span>

                        <input
                            className={s.searchInput}
                            placeholder="Buscar producto..."
                            value={busqueda}
                            onChange={(e) =>
                                setBusqueda(e.target.value)
                            }
                        />
                    </div>

                    <select
                        className={s.filterSelect}
                        value={filtroTipo}
                        onChange={(e) =>
                            setFiltroTipo(e.target.value)
                        }
                    >
                        <option value="todos">Todos</option>
                        <option value="medicamentos">
                            Medicamentos
                        </option>
                        <option value="descartables">
                            Descartables
                        </option>
                    </select>

                </div>

                {/* ========================================= */}
                {/* MOBILE - CARDS */}
                {/* ========================================= */}

                <div className={s.stockCards}>

                    {filtrados.map((item) => {

                        const color = getStockColor(
                            item.stockActual,
                            item.stockMinimo
                        );

                        const valorTotal =
                            item.stockActual *
                            (item.precioCosto || 0);

                        return (
                            <div
                                key={item.id}
                                className={s.stockCard}
                            >

                                <div className={s.stockCardHeader}>

                                    <div className={s.stockCardInfo}>

                                        <span
                                            className={`${s.stockCardIcon} ${s.svgIc}`}
                                            style={{ color }}
                                        >
                                            <Icon
                                                name={
                                                    item.tipo ===
                                                        "medicamento"
                                                        ? "pills"
                                                        : "box"
                                                }
                                                size={22}
                                            />
                                        </span>

                                        <div>

                                            <p
                                                className={
                                                    s.stockCardName
                                                }
                                            >
                                                {item.nombre.replace(
                                                    /_/g,
                                                    " "
                                                )}
                                            </p>

                                            <p
                                                className={
                                                    s.stockCardMeta
                                                }
                                            >
                                                {item.presentacion}
                                            </p>

                                        </div>

                                    </div>

                                    <div
                                        className={
                                            s.stockCardActions
                                        }
                                    >

                                        <button
                                            className={`${s.iconBtn} ${s.svgIc}`}
                                            onClick={() =>
                                                setEditItem(item)
                                            }
                                            title="Editar"
                                        >
                                            <Icon
                                                name="edit"
                                                size={18}
                                            />
                                        </button>

                                        <button
                                            className={`${s.iconBtn} ${s.iconBtnDanger} ${s.svgIc}`}
                                            onClick={() =>
                                                setDeleteItem(item)
                                            }
                                            title="Eliminar"
                                        >
                                            <Icon
                                                name="trash"
                                                size={18}
                                            />
                                        </button>

                                    </div>

                                </div>

                                <div className={s.stockCardPrecios}>

                                    <span
                                        className={
                                            s.precioCosto
                                        }
                                    >
                                        Costo:{" "}
                                        {formatCurrency(
                                            item.precioCosto
                                        )}
                                    </span>

                                    <span
                                        className={
                                            s.precioFact
                                        }
                                    >
                                        Fact.:{" "}
                                        {formatCurrency(
                                            item.precioFacturacion
                                        )}
                                    </span>

                                    <span
                                        className={
                                            s.precioOtros
                                        }
                                    >
                                        Otros:{" "}
                                        {formatCurrency(
                                            item.precioOtros
                                        )}
                                    </span>

                                </div>

                                <div
                                    className={
                                        s.stockCardFooter
                                    }
                                >

                                    <div
                                        className={
                                            s.stockCardBar
                                        }
                                    >
                                        <div
                                            className={
                                                s.stockCardBarFill
                                            }
                                            style={{
                                                width: `${Math.min(
                                                    100,
                                                    (item.stockActual /
                                                        item.stockMinimo) *
                                                    100
                                                )}%`,
                                                background: color
                                            }}
                                        />
                                    </div>

                                    <div
                                        className={
                                            s.stockCardNums
                                        }
                                    >

                                        <span
                                            style={{
                                                color,
                                                fontWeight: 700
                                            }}
                                        >
                                            {item.stockActual}
                                        </span>

                                        <span
                                            className={
                                                s.stockCardMin
                                            }
                                        >
                                            /{item.stockMinimo}
                                        </span>

                                        <span
                                            className={
                                                s.statusChip
                                            }
                                            style={{
                                                background:
                                                    color + "22",
                                                color
                                            }}
                                        >
                                            {getStockStatus(
                                                item.stockActual,
                                                item.stockMinimo
                                            )}
                                        </span>

                                    </div>

                                </div>

                                <div
                                    className={
                                        s.stockCardValor
                                    }
                                >
                                    Valor:{" "}
                                    {formatCurrency(
                                        valorTotal
                                    )}
                                </div>

                            </div>
                        );
                    })}

                    {filtrados.length === 0 && (
                        <div className={s.emptyState}>
                            <span className={s.svgIc}>
                                <Icon
                                    name="inbox"
                                    size={40}
                                />
                            </span>

                            <p>
                                No se encontraron productos
                            </p>
                        </div>
                    )}

                </div>

                {/* ========================================= */}
                {/* DESKTOP - TABLA */}
                {/* ========================================= */}

                <div className={s.tableWrap}>

                    <table className={s.stockTable}>

                        <thead>

                            <tr>

                                <th>
                                    Producto
                                </th>

                                <th>
                                    Tipo
                                </th>

                                <th>
                                    Presentación
                                </th>

                                <th
                                    className={s.thCenter}
                                >
                                    Stock
                                </th>

                                <th
                                    className={s.thCenter}
                                >
                                    Mínimo
                                </th>

                                <th>
                                    Estado
                                </th>

                                <th
                                    className={s.thCenter}
                                >
                                    Acciones
                                </th>

                            </tr>

                        </thead>

                        <tbody>

                            {filtrados.map((item) => {

                                const color = getStockColor(
                                    item.stockActual,
                                    item.stockMinimo
                                );

                                return (
                                    <tr
                                        key={item.id}
                                        className={
                                            s.stockRow
                                        }
                                    >

                                        {/* PRODUCTO */}
                                        <td>

                                            <div
                                                className={
                                                    s.productCell
                                                }
                                            >

                                                <span
                                                    className={`${s.productCellIcon} ${s.svgIc}`}
                                                    style={{
                                                        color
                                                    }}
                                                >
                                                    <Icon
                                                        name={
                                                            item.tipo ===
                                                                "medicamento"
                                                                ? "pills"
                                                                : "box"
                                                        }
                                                        size={20}
                                                    />
                                                </span>

                                                <div>

                                                    <p
                                                        className={
                                                            s.productCellName
                                                        }
                                                    >
                                                        {item.nombre.replace(
                                                            /_/g,
                                                            " "
                                                        )}
                                                    </p>

                                                </div>

                                            </div>

                                        </td>

                                        {/* TIPO */}
                                        <td>

                                            <span
                                                className={
                                                    item.tipo ===
                                                        "medicamento"
                                                        ? s.badgeMed
                                                        : s.badgeDesc
                                                }
                                            >
                                                {item.tipo ===
                                                    "medicamento"
                                                    ? "Medicamento"
                                                    : "Descartable"}
                                            </span>

                                        </td>

                                        {/* PRESENTACIÓN */}
                                        <td>

                                            <span
                                                className={
                                                    s.badgePres
                                                }
                                            >
                                                {
                                                    item.presentacion
                                                }
                                            </span>

                                        </td>

                                        {/* STOCK */}
                                        <td
                                            className={
                                                s.thCenter
                                            }
                                        >

                                            <span
                                                className={
                                                    s.stockNum
                                                }
                                                style={{
                                                    color
                                                }}
                                            >
                                                {
                                                    item.stockActual
                                                }
                                            </span>

                                        </td>

                                        {/* MÍNIMO */}
                                        <td
                                            className={
                                                s.thCenter
                                            }
                                        >
                                            {
                                                item.stockMinimo
                                            }
                                        </td>

                                        {/* ESTADO */}
                                        <td>

                                            <span
                                                className={
                                                    s.statusChip
                                                }
                                                style={{
                                                    background:
                                                        color +
                                                        "22",
                                                    color
                                                }}
                                            >
                                                {getStockStatus(
                                                    item.stockActual,
                                                    item.stockMinimo
                                                )}
                                            </span>

                                        </td>

                                        {/* ACCIONES */}
                                        <td
                                            className={
                                                s.thCenter
                                            }
                                        >

                                            <div
                                                className={
                                                    s.tableActions
                                                }
                                            >

                                                <button
                                                    className={`${s.iconBtn} ${s.svgIc}`}
                                                    onClick={() =>
                                                        setEditItem(
                                                            item
                                                        )
                                                    }
                                                    title="Editar"
                                                >
                                                    <Icon
                                                        name="edit"
                                                        size={18}
                                                    />
                                                </button>

                                                <button
                                                    className={`${s.iconBtn} ${s.iconBtnDanger} ${s.svgIc}`}
                                                    onClick={() =>
                                                        setDeleteItem(
                                                            item
                                                        )
                                                    }
                                                    title="Eliminar"
                                                >
                                                    <Icon
                                                        name="trash"
                                                        size={18}
                                                    />
                                                </button>

                                            </div>

                                        </td>

                                    </tr>
                                );
                            })}

                        </tbody>

                    </table>

                    {filtrados.length === 0 && (
                        <div
                            className={
                                s.emptyState
                            }
                        >
                            <span
                                className={
                                    s.svgIc
                                }
                            >
                                <Icon
                                    name="inbox"
                                    size={40}
                                />
                            </span>

                            <p>
                                No se encontraron
                                productos
                            </p>

                        </div>
                    )}

                </div>

            </div>

            {/* MODAL EDITAR */}
            {editItem && (
                <EditarProductoModal
                    item={editItem}
                    onClose={() =>
                        setEditItem(null)
                    }
                    onSubmit={editarProducto}
                />
            )}

            {/* MODAL ELIMINAR */}
            {deleteItem && (
                <EliminarModal
                    item={deleteItem}
                    onClose={() =>
                        setDeleteItem(null)
                    }
                    onSubmit={eliminarProducto}
                />
            )}

        </>
    );
}
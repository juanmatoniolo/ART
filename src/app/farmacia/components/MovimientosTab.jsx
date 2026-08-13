"use client";
import { useState, useMemo } from "react";
import Icon from "./Icon";
import { formatCurrency } from "../utils/farmacia";
import s from "../farmaciaDashboard.module.css";

export default function MovimientosTab({
  movimientos,
  userRole,
  onEliminarMovimiento,
}) {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [busqueda, setBusqueda] = useState("");

  // ✅ Permisos: solo Farmacia o ADM pueden eliminar
  const puedeEliminar = userRole === "Farmacia" || userRole === "ADM";

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((mov) => {
      if (filtroTipo === "ingresos" && mov.tipo !== "ingreso") return false;
      if (filtroTipo === "egresos" && mov.tipo !== "reparto") return false;

      const fechaMov = mov.fechaRaw || mov.fechaFormatted;
      if (fechaInicio && fechaMov < fechaInicio) return false;
      if (fechaFin && fechaMov > fechaFin) return false;

      if (busqueda.trim()) {
        const q = busqueda
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        const texto = [
          mov.tipo,
          mov.destino,
          mov.responsable,
          mov.usuario,
          ...(mov.productos?.map((p) => p.itemNombre) || []),
        ]
          .join(" ")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (!texto.includes(q)) return false;
      }

      return true;
    });
  }, [movimientos, filtroTipo, fechaInicio, fechaFin, busqueda]);

  const totales = useMemo(() => {
    return movimientosFiltrados.reduce(
      (acc, mov) => {
        acc.cantidad += 1;
        acc.unidades += mov.totalUnidades || 0;
        acc.valor += mov.valorTotal || 0;
        return acc;
      },
      { cantidad: 0, unidades: 0, valor: 0 }
    );
  }, [movimientosFiltrados]);

  const descargarCSV = () => {
    if (movimientosFiltrados.length === 0) {
      alert("No hay movimientos para exportar con los filtros actuales.");
      return;
    }

    const cabeceras = [
      "ID Movimiento",
      "Tipo",
      "Fecha",
      "Destino",
      "Responsable",
      "Usuario",
      "Total Productos",
      "Total Unidades",
      "Valor Total",
      "Producto",
      "Cantidad",
      "Stock Anterior",
      "Stock Nuevo",
      "Precio Unitario",
      "Subtotal Producto",
    ];

    const filas = [];

    movimientosFiltrados.forEach((mov) => {
      const tipo = mov.tipo === "ingreso" ? "Ingreso" : "Reparto";
      const fecha = mov.fechaFormatted || mov.fechaRaw || "";
      const destino = mov.destino || "";
      const responsable = mov.responsable || "";
      const usuario = mov.usuario || "";

      if (mov.productos && mov.productos.length > 0) {
        mov.productos.forEach((p) => {
          const subtotal = Number(p.cantidad * p.precioUnitario)
            .toFixed(2)
            .replace(".", ",");
          filas.push(
            [
              `"${mov.id}"`,
              `"${tipo}"`,
              `"${fecha}"`,
              `"${destino}"`,
              `"${responsable}"`,
              `"${usuario}"`,
              mov.totalProductos || 0,
              mov.totalUnidades || 0,
              `"${Number(mov.valorTotal || 0)
                .toFixed(2)
                .replace(".", ",")}"`,
              `"${String(p.itemNombre || "").replace(/_/g, " ")}"`,
              p.cantidad,
              p.stockAnterior,
              p.stockNuevo,
              `"${Number(p.precioUnitario).toFixed(2).replace(".", ",")}"`,
              `"${subtotal}"`,
            ].join(";")
          );
        });
      } else {
        filas.push(
          [
            `"${mov.id}"`,
            `"${tipo}"`,
            `"${fecha}"`,
            `"${destino}"`,
            `"${responsable}"`,
            `"${usuario}"`,
            mov.totalProductos || 0,
            mov.totalUnidades || 0,
            `"${Number(mov.valorTotal || 0)
              .toFixed(2)
              .replace(".", ",")}"`,
            "",
            "",
            "",
            "",
            "",
            "",
          ].join(";")
        );
      }
    });

    const csvContent = [cabeceras.join(";"), ...filas].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `historial_movimientos_${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const confirmarEliminar = async (mov) => {
    if (!puedeEliminar) return;
    const ok = window.confirm(
      `¿Eliminar el movimiento ${
        mov.tipo === "ingreso" ? "de ingreso" : "de reparto"
      } del ${mov.fechaFormatted}?`
    );
    if (!ok) return;

    try {
      await onEliminarMovimiento(mov.id);
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("No se pudo eliminar el movimiento.");
    }
  };

  return (
    <div className={s.panel}>
      <div className={s.panelHeader}>
        <div>
          <h3 className={s.panelTitle}>
            <Icon name="list" size={24} />
            Historial de movimientos
          </h3>
          <p className={s.panelSub}>
            {movimientosFiltrados.length} registros · {totales.unidades}{" "}
            unidades · {formatCurrency(totales.valor)}
          </p>
        </div>
        <div className={s.panelActions}>
          <button
            className={`${s.actionBtn} ${s.btn_secondary}`}
            onClick={descargarCSV}
            disabled={movimientosFiltrados.length === 0}
          >
            ⬇️ Descargar CSV
          </button>
        </div>
      </div>

      <div className={s.filtersRow}>
        <div className={s.searchWrap}>
          <span className={`${s.searchIconInner} ${s.svgIc}`}>
            <Icon name="search" size={18} />
          </span>
          <input
            className={s.searchInput}
            placeholder="Buscar por producto, destino, responsable o usuario..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>

        <select
          className={s.filterSelect}
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
        >
          <option value="todos">Todos los movimientos</option>
          <option value="ingresos">✅ Ingresos</option>
          <option value="egresos">📤 Egresos (repartos)</option>
        </select>

        <input
          type="date"
          className={s.filterSelect}
          value={fechaInicio}
          onChange={(e) => setFechaInicio(e.target.value)}
          title="Fecha desde"
        />

        <input
          type="date"
          className={s.filterSelect}
          value={fechaFin}
          onChange={(e) => setFechaFin(e.target.value)}
          title="Fecha hasta"
        />

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
            <MovCard
              key={mov.id}
              mov={mov}
              puedeEliminar={puedeEliminar}
              onEliminar={() => confirmarEliminar(mov)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MovCard({ mov, puedeEliminar, onEliminar }) {
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

        {/* 👤 Usuario que realizó el movimiento */}
        {mov.usuario && (
          <span
            className={s.movChip}
            style={{
              background: "#e3f2fd",
              color: "#0d47a1",
              fontWeight: 600,
            }}
          >
            <Icon name="user" size={14} />
            {mov.usuario}
          </span>
        )}

        <span className={s.movCardDate}>
          <Icon name="calendar" size={14} style={{ marginRight: 4 }} />
          {mov.fechaFormatted}
        </span>

        {puedeEliminar && (
          <button
            className={s.movDeleteBtn}
            onClick={onEliminar}
            title="Eliminar movimiento"
          >
            <Icon name="trash" size={16} />
          </button>
        )}
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
                  <strong className={s.stockAfter}>{p.stockNuevo}</strong>
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
"use client";
import { useState, useMemo } from "react";
import Icon from "./Icon";
import { formatCurrency } from "../utils/farmacia";
import s from "../farmaciaDashboard.module.css";

export default function MovimientosTab({
  movimientos,
  userRole,
  onEliminarMovimiento,
  onEditarMovimiento,
}) {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [editMov, setEditMov] = useState(null);

  // Permisos: solo Farmacia, ADM o ADM Farmacia pueden eliminar/editar
  const puedeEliminar =
    userRole === "Farmacia" || userRole === "ADM" || userRole === "ADM Farmacia";
  const puedeEditar = puedeEliminar;

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((mov) => {
      if (filtroTipo === "ingresos" && mov.tipo !== "ingreso") return false;
      if (filtroTipo === "egresos" && mov.tipo !== "reparto") return false;
      if (filtroTipo === "ajustes" && mov.tipo !== "ajuste") return false;

      const fechaMov = mov._ts || 0;
      if (fechaInicio) {
        const inicio = new Date(fechaInicio + "T00:00:00").getTime();
        if (fechaMov < inicio) return false;
      }
      if (fechaFin) {
        const fin = new Date(fechaFin + "T23:59:59").getTime();
        if (fechaMov > fin) return false;
      }

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
      const tipo =
        mov.tipo === "ingreso" ? "Ingreso" : mov.tipo === "reparto" ? "Reparto" : "Ajuste";
      const fecha = mov.fechaFormatted || "";
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
              `"${Number(mov.valorTotal || 0).toFixed(2).replace(".", ",")}"`,
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
            `"${Number(mov.valorTotal || 0).toFixed(2).replace(".", ",")}"`,
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
    link.download = `historial_movimientos_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  const confirmarEliminar = async (mov) => {
    if (!puedeEliminar) return;
    if (mov.tipo === "ajuste") {
      alert("Los ajustes no se pueden eliminar.");
      return;
    }
    let mensaje = "";
    if (mov.tipo === "ingreso")
      mensaje = `¿Eliminar el ingreso del ${mov.fechaFormatted}? Se revertirá el stock.`;
    else if (mov.tipo === "reparto")
      mensaje = `¿Eliminar el reparto del ${mov.fechaFormatted}? Se revertirá el stock.`;

    const ok = window.confirm(mensaje);
    if (!ok) return;

    try {
      await onEliminarMovimiento(mov.id);
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("No se pudo eliminar el movimiento.");
    }
  };

  const abrirEditar = (mov) => setEditMov(mov);
  const cerrarEditar = () => setEditMov(null);
  const guardarEdicion = async (datosEditados) => {
    try {
      await onEditarMovimiento(editMov.id, datosEditados);
      cerrarEditar();
    } catch (error) {
      alert("No se pudo editar el movimiento.");
    }
  };

  // Función de impresión profesional
  const imprimirMovimiento = (mov) => {
    const printWindow = window.open("", "_blank", "width=900,height=650");
    if (!printWindow) {
      alert("Permite las ventanas emergentes para imprimir.");
      return;
    }

    const logoUrl = window.location.origin + "/logo.png";
    const tipo =
      mov.tipo === "ingreso" ? "INGRESO" : mov.tipo === "reparto" ? "REPARTO" : "AJUSTE";
    const fecha = mov.fechaFormatted || "";
    const destino = mov.destino || "—";
    const responsable = mov.responsable || "—";
    const usuario = mov.usuario || "—";
    const totalUnidades = mov.totalUnidades || 0;
    const valorTotal = mov.valorTotal || 0;

    const lineasProductos = (mov.productos || [])
      .map(
        (p) => `
          <tr>
            <td>${String(p.itemNombre || "").replace(/_/g, " ")}</td>
            <td style="text-align:center">${p.cantidad}</td>
            <td style="text-align:center">${p.stockAnterior}</td>
            <td style="text-align:center">${p.stockNuevo}</td>
            <td style="text-align:right">${formatCurrency(p.cantidad * p.precioUnitario)}</td>
          </tr>
        `
      )
      .join("");

    const contenido = `
      <html>
        <head>
          <title>Comprobante de ${tipo}</title>
          <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body {
              font-family: 'Segoe UI', Roboto, Arial, sans-serif;
              color: #1e293b;
              padding: 2rem;
              background: #fff;
            }
            .header {
              display: flex;
              align-items: center;
              border-bottom: 2px solid #0f172a;
              padding-bottom: 1rem;
              margin-bottom: 1.5rem;
            }
            .logo {
              width: 80px;
              height: 80px;
              object-fit: contain;
              margin-right: 1.5rem;
            }
            .clinic-info h1 {
              font-size: 1.6rem;
              font-weight: 700;
              color: #0f172a;
              letter-spacing: 0.5px;
            }
            .clinic-info p {
              font-size: 0.9rem;
              color: #475569;
              margin-top: 0.25rem;
            }
            .title {
              text-align: center;
              font-size: 1.4rem;
              font-weight: 700;
              margin-bottom: 1.5rem;
              text-transform: uppercase;
              color: #0f172a;
            }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 0.5rem 2rem;
              margin-bottom: 1.5rem;
            }
            .info-item {
              display: flex;
              flex-direction: column;
            }
            .info-item .label {
              font-size: 0.75rem;
              font-weight: 600;
              text-transform: uppercase;
              color: #64748b;
              letter-spacing: 0.5px;
            }
            .info-item .value {
              font-size: 1rem;
              color: #0f172a;
              font-weight: 500;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 1.5rem;
            }
            th, td {
              border: 1px solid #cbd5e1;
              padding: 0.6rem 0.8rem;
              font-size: 0.9rem;
            }
            th {
              background: #f1f5f9;
              font-weight: 600;
              text-align: left;
            }
            td {
              text-align: left;
            }
            .totals {
              display: flex;
              justify-content: flex-end;
              gap: 2rem;
              margin-bottom: 2rem;
            }
            .total-item {
              text-align: right;
            }
            .total-item .label {
              font-size: 0.8rem;
              color: #64748b;
              text-transform: uppercase;
            }
            .total-item .value {
              font-size: 1.2rem;
              font-weight: 700;
              color: #0f172a;
            }
            .firmas {
              display: flex;
              justify-content: space-between;
              margin-top: 3rem;
              gap: 2rem;
            }
            .firma {
              flex: 1;
              text-align: center;
            }
            .firma .linea {
              border-top: 1px solid #0f172a;
              margin-top: 3rem;
              padding-top: 0.5rem;
              font-size: 0.9rem;
              color: #475569;
            }
            .footer {
              margin-top: 2rem;
              text-align: center;
              font-size: 0.8rem;
              color: #64748b;
              border-top: 1px solid #e2e8f0;
              padding-top: 1rem;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <img src="${logoUrl}" class="logo" alt="Logo" />
            <div class="clinic-info">
              <h1>Clínica de la Unión S.A.</h1>
              <p>Sistema de Farmacia</p>
            </div>
          </div>
          <div class="title">Comprobante de ${tipo}</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="label">Fecha</span>
              <span class="value">${fecha}</span>
            </div>
            ${
              mov.tipo === "reparto"
                ? `<div class="info-item"><span class="label">Destino</span><span class="value">${destino}</span></div>`
                : ""
            }
            ${
              mov.tipo === "reparto"
                ? `<div class="info-item"><span class="label">Responsable de recepción</span><span class="value">${responsable}</span></div>`
                : ""
            }
            <div class="info-item">
              <span class="label">Usuario que registró</span>
              <span class="value">${usuario}</span>
            </div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th style="text-align:center">Cant.</th>
                <th style="text-align:center">Stock anterior</th>
                <th style="text-align:center">Stock nuevo</th>
                <th style="text-align:right">Valor</th>
              </tr>
            </thead>
            <tbody>
              ${lineasProductos}
            </tbody>
          </table>
          <div class="totals">
            <div class="total-item">
              <span class="label">Total unidades</span>
              <div class="value">${totalUnidades}</div>
            </div>
            ${
              mov.tipo !== "ajuste"
                ? `<div class="total-item"><span class="label">Valor total</span><div class="value">${formatCurrency(valorTotal)}</div></div>`
                : ""
            }
          </div>
          <div class="firmas">
            <div class="firma">
              <div class="linea">Firma del responsable</div>
            </div>
            <div class="firma">
              <div class="linea">Firma de quien entrega</div>
            </div>
          </div>
          <div class="footer">
            Documento generado por sistema de farmacia - Clínica de la Unión S.A.
          </div>
          <script>
            window.onload = function() { window.print(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(contenido);
    printWindow.document.close();
  };

  return (
    <div className={s.panel}>
      {/* Encabezado */}
      <div className={s.panelHeader}>
        <div>
          <h3 className={s.panelTitle}>
            <Icon name="list" size={24} />
            Historial de movimientos
          </h3>
          <p className={s.panelSub}>
            {movimientosFiltrados.length} registros · {totales.unidades} unidades ·{" "}
            {formatCurrency(totales.valor)}
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

      {/* Filtros */}
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
          <option value="ajustes">🔧 Ajustes manuales</option>
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

      {/* Lista de movimientos */}
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
              puedeEliminar={puedeEliminar && mov.tipo !== "ajuste"}
              puedeEditar={puedeEditar}
              onEliminar={() => confirmarEliminar(mov)}
              onEditar={() => abrirEditar(mov)}
              onImprimir={() => imprimirMovimiento(mov)}
            />
          ))}
        </div>
      )}

      {/* Modal de edición */}
      {editMov && (
        <ModalEditarMovimiento
          mov={editMov}
          onClose={cerrarEditar}
          onSave={guardarEdicion}
        />
      )}
    </div>
  );
}

function MovCard({
  mov,
  puedeEliminar,
  puedeEditar,
  onEliminar,
  onEditar,
  onImprimir,
}) {
  const isIn = mov.tipo === "ingreso";
  const isOut = mov.tipo === "reparto";
  const isAdjust = mov.tipo === "ajuste";
  const total = mov.valorTotal || 0;

  return (
    <div
      className={`${s.movCard} ${
        isIn ? s.movCardIn : isOut ? s.movCardOut : s.movCardAdjust
      }`}
    >
      <div className={s.movCardHead}>
        <span
          className={`${s.movBadge} ${
            isIn ? s.movBadgeIn : isOut ? s.movBadgeOut : s.movBadgeAdjust
          }`}
        >
          <Icon
            name={isIn ? "download" : isOut ? "truck" : "wrench"}
            size={16}
          />
          {isIn ? "Ingreso" : isOut ? "Reparto" : "Ajuste"}
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

        {mov.usuario && (
          <span
            className={s.movChip}
            style={{ background: "#e3f2fd", color: "#0d47a1", fontWeight: 600 }}
          >
            <Icon name="user" size={14} />
            {mov.usuario}
          </span>
        )}

        <span className={s.movCardDate}>
          <Icon name="calendar" size={14} style={{ marginRight: 4 }} />
          {mov.fechaFormatted}
        </span>

        <div className={s.movCardActions}>
          {puedeEditar && (
            <button
              className={s.movEditBtn}
              onClick={onEditar}
              title="Editar movimiento"
            >
              <Icon name="edit" size={16} />
            </button>
          )}
          {puedeEliminar && !isAdjust && (
            <button
              className={s.movDeleteBtn}
              onClick={onEliminar}
              title="Eliminar movimiento"
            >
              <Icon name="trash" size={16} />
            </button>
          )}
      <button
  className={s.movPrintBtn}
  onClick={onImprimir}
  title="Imprimir comprobante"
>
  <span style={{ fontSize: "16px", color: "#000" }}>🖨️</span>
</button>
        </div>
      </div>

      <div className={s.movCardStats}>
        <span>
          <Icon name="box" size={16} style={{ marginRight: 4 }} />
          <b>{mov.totalProductos || 0}</b> productos
        </span>
        <span>
          <Icon name="list" size={16} style={{ marginRight: 4 }} />
          <b>{mov.totalUnidades || 0}</b> unidades
        </span>
        {!isAdjust && (
          <span className={isIn ? s.valIn : s.valOut}>
            <Icon name="money" size={16} style={{ marginRight: 4 }} />
            {formatCurrency(total)}
          </span>
        )}
      </div>

      <div className={s.movTableWrap}>
        <table className={s.movCardTable}>
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Antes</th>
              <th>Después</th>
              {!isAdjust && <th>Valor</th>}
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
                  <span
                    className={
                      isIn ? s.movQtyPos : isOut ? s.movQtyNeg : s.movQtyAdj
                    }
                  >
                    {isIn ? "+" : isOut ? "−" : "±"}
                    {p.cantidad}
                  </span>
                </td>
                <td>{p.stockAnterior}</td>
                <td>
                  <strong className={s.stockAfter}>{p.stockNuevo}</strong>
                </td>
                {!isAdjust && (
                  <td>{formatCurrency(p.cantidad * p.precioUnitario)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModalEditarMovimiento({ mov, onClose, onSave }) {
  const [form, setForm] = useState({
    tipo: mov.tipo,
    destino: mov.destino || "",
    responsable: mov.responsable || "",
    nota: mov.nota || "",
    stockNuevo:
      mov.tipo === "ajuste" ? (mov.productos?.[0]?.stockNuevo ?? 0) : "",
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const datos = { ...form };
    if (form.tipo !== "ajuste") {
      delete datos.stockNuevo;
    } else {
      datos.stockNuevo = parseInt(datos.stockNuevo, 10);
      if (isNaN(datos.stockNuevo) || datos.stockNuevo < 0) {
        alert("Stock nuevo debe ser un número mayor o igual a 0.");
        return;
      }
    }
    onSave(datos);
  };

  return (
    <div className={s.modalOverlay}>
      <div className={s.modalContent}>
        <h3>Editar movimiento</h3>
        <form onSubmit={handleSubmit}>
          <label>Tipo</label>
          <select value={form.tipo} disabled>
            <option value="ingreso">Ingreso</option>
            <option value="reparto">Reparto</option>
            <option value="ajuste">Ajuste</option>
          </select>

          {form.tipo === "reparto" && (
            <>
              <label>Destino</label>
              <input
                value={form.destino}
                onChange={(e) => setForm({ ...form, destino: e.target.value })}
              />
              <label>Responsable</label>
              <input
                value={form.responsable}
                onChange={(e) =>
                  setForm({ ...form, responsable: e.target.value })
                }
              />
            </>
          )}

          {form.tipo === "ajuste" && (
            <>
              <label>Nuevo stock</label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.stockNuevo}
                onChange={(e) =>
                  setForm({ ...form, stockNuevo: e.target.value })
                }
              />
            </>
          )}

          <label>Nota</label>
          <textarea
            value={form.nota}
            onChange={(e) => setForm({ ...form, nota: e.target.value })}
          />

          <div className={s.modalActions}>
            <button type="button" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit">Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Icon from "../components/Icon";
import { normalizeText, formatCurrency } from "../utils/farmacia";
import s from "./repartoPage.module.css";
import { useFarmaciaContext } from "../context/FarmaciaContext"; // ✅ Cambio aquí

const DESTINOS = [
  "Guardia", "Primer Piso", "Segundo Piso", "Quirófano", "UTI",
  "Pediatría", "Maternidad", "Administración", "Depósito", "Otro"
];

const getStockColor = (stock, min = 10) => {
  if (stock === 0) return "#d32f2f";
  if (stock < min) return "#f57c00";
  if (stock < min * 3) return "#fbc02d";
  return "#2e7d32";
};

export default function RepartoPage() {
  const router = useRouter();
  const { items, procesarReparto, usuarioActual } = useFarmaciaContext(); // ✅ usuarioActual disponible

  const [destino, setDestino] = useState("Guardia");
  const [responsable, setResponsable] = useState("");
  const [nota, setNota] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Solo productos activos y sin duplicados
  const itemsActivos = useMemo(() => {
    const map = new Map();
    (items || []).forEach(item => {
      if (item.activo === false) return;
      const key = item.id || item.nombre;
      if (!map.has(key)) {
        map.set(key, {
          ...item,
          stock: item.stockActual ?? item.stock ?? 0,
          precio: item.precioCosto ?? item.precio ?? 0,
          nombreLimpio: (item.nombre || "").replace(/_/g, " "),
          tipo: item.tipo || "medicamento",
        });
      }
    });
    return Array.from(map.values());
  }, [items]);

  const disponibles = useMemo(() => {
    const idsSeleccionados = new Set(seleccionados.map(p => p.id));
    let filtrados = itemsActivos.filter(i => i.stock > 0 && !idsSeleccionados.has(i.id));

    if (busqueda.trim()) {
      const q = normalizeText(busqueda);
      filtrados = filtrados.filter(i => normalizeText(i.nombreLimpio).includes(q));
      filtrados.sort((a, b) => {
        const aStarts = normalizeText(a.nombreLimpio).startsWith(q);
        const bStarts = normalizeText(b.nombreLimpio).startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return b.stock - a.stock;
      });
    } else {
      filtrados.sort((a, b) => b.stock - a.stock);
    }
    return filtrados;
  }, [itemsActivos, seleccionados, busqueda]);

  const agregarProducto = (item) => {
    if (seleccionados.some(p => p.id === item.id)) return;
    setSeleccionados(prev => [...prev, {
      ...item,
      cantidad: 1,
      stockAnterior: item.stock,
      stockNuevo: item.stock - 1,
      subtotal: item.precio,
    }]);
  };

  const cambiarCantidad = (id, nuevaCantidad) => {
    setSeleccionados(prev => prev.map(p => {
      if (p.id !== id) return p;
      const cant = Math.max(1, Math.min(nuevaCantidad, p.stockAnterior));
      return {
        ...p,
        cantidad: cant,
        stockNuevo: p.stockAnterior - cant,
        subtotal: cant * p.precio,
      };
    }));
  };

  const quitarProducto = (id) => {
    setSeleccionados(prev => prev.filter(p => p.id !== id));
  };

  const totales = useMemo(() => {
    return seleccionados.reduce((acc, p) => ({
      unidades: acc.unidades + p.cantidad,
      valor: acc.valor + p.subtotal,
    }), { unidades: 0, valor: 0 });
  }, [seleccionados]);

  const handleSubmit = async () => {
    if (seleccionados.length === 0) {
      setError("Agregá al menos un producto.");
      return;
    }
    if (!destino.trim()) {
      setError("El destino es obligatorio.");
      return;
    }
    setError("");
    setLoading(true);

    const productos = seleccionados.map(p => ({
      id: p.id,
      cantidad: p.cantidad,
      stockAnterior: p.stockAnterior,
      stockNuevo: p.stockNuevo,
      nombre: p.nombre,
      tipo: p.tipo,
      precioCosto: p.precioCosto ?? p.precio,
      precio: p.precio,
      presentacion: p.presentacion,
    }));

    // ✅ El usuario se tomará automáticamente dentro del hook
    const ok = await procesarReparto(productos, { destino, responsable, nota });
    setLoading(false);
    if (ok) router.push("/farmacia");
  };

  return (
    <div className={s.pageContainer}>
      <header className={s.dashboardHeader}>
        <div className={s.headerTop}>
          <div className={s.titleGroup}>
            <span className={s.titleIcon}>🚚</span>
            <div>
              <h1 className={s.dashboardTitle}>Reparto a sector</h1>
              <p className={s.dashboardSubtitle}>Seleccioná productos y asigná destino</p>
            </div>
          </div>
          <div className={s.headerActions}>
            {/* Mostrar usuario actual */}
            {usuarioActual && (
              <span className={s.usuarioBadge}>
                👤 {usuarioActual.nombre} ({usuarioActual.user})
              </span>
            )}
            <Link href="/farmacia" className={`${s.actionBtn} ${s.btnCancel}`} title="Volver al inicio">
              <span>←</span> Volver
            </Link>
          </div>
        </div>
      </header>

      <div className={s.panel}>
        <div className={s.repartoForm}>
          <div className={s.repartoCampos}>
            <div className={s.fieldGroup}>
              <label>Destino *</label>
              <div className={s.destinoGrid}>
                {DESTINOS.map(d => (
                  <button
                    key={d}
                    type="button"
                    className={`${s.destinoChip} ${destino === d ? s.destinoChipActive : ""}`}
                    onClick={() => setDestino(d)}
                    title={`Seleccionar ${d}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.fieldGroup}>
              <label>Responsable (quién recibe)</label>
              <input
                className={s.formInput}
                value={responsable}
                onChange={e => setResponsable(e.target.value)}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className={s.fieldGroup}>
              <label>Observaciones</label>
              <textarea
                className={s.formTextarea}
                rows={2}
                value={nota}
                onChange={e => setNota(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          {error && <div className={s.errorMsg}>{error}</div>}

          <div className={s.repartoGrid}>
            {/* Columna izquierda: productos disponibles */}
            <div className={s.repartoDisponibles}>
              <div className={s.searchWrap}>
                <span className={s.searchIconInner}><Icon name="search" size={18} /></span>
                <input
                  className={s.searchInput}
                  placeholder="Buscar por nombre..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  autoFocus
                />
                {busqueda && (
                  <button
                    type="button"
                    className={s.searchClear}
                    onClick={() => setBusqueda("")}
                    title="Limpiar búsqueda"
                  >
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>
              <div className={s.listaDisponibles}>
                {disponibles.length === 0 ? (
                  <p className={s.emptyText}>
                    {busqueda
                      ? "No se encontraron productos con stock"
                      : "No hay productos disponibles para repartir"}
                  </p>
                ) : (
                  <ul className={s.listaProductos}>
                    {disponibles.map(item => (
                      <li
                        key={item.id}
                        className={s.productoDisponible}
                        onClick={() => agregarProducto(item)}
                        title={`Agregar ${item.nombreLimpio}`}
                      >
                        <div className={s.productoInfo}>
                          <span className={s.productoNombre}>
                            {item.nombreLimpio}
                            {item.presentacion && (
                              <span className={s.productoPresentacion}>
                                {" "}({item.presentacion})
                              </span>
                            )}
                          </span>
                          <span className={s.productoStock}>
                            <span
                              className={s.stockIndicator}
                              style={{ backgroundColor: getStockColor(item.stock, item.stockMinimo || 10) }}
                            />
                            Stock: {item.stock}
                          </span>
                          <span className={s.productoPrecio}>
                            {formatCurrency(item.precio)}
                          </span>
                        </div>
                        <button
                          type="button"
                          className={s.btnAgregar}
                          onClick={(e) => {
                            e.stopPropagation();
                            agregarProducto(item);
                          }}
                          title="Agregar al reparto"
                        >
                          <Icon name="plus" size={16} /> Agregar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Columna derecha: carrito */}
            <div className={s.repartoSeleccionados}>
              <div className={s.resumenSeleccion}>
                <span><Icon name="list" size={16} /> {seleccionados.length} productos</span>
                <span><Icon name="package" size={16} /> {totales.unidades} unidades</span>
                <span className={s.valorTotal}>
                  <Icon name="money" size={16} /> {formatCurrency(totales.valor)}
                </span>
              </div>

              {seleccionados.length === 0 ? (
                <p className={s.emptyText}>Hacé clic en un producto para agregarlo.</p>
              ) : (
                <ul className={s.listaSeleccionados}>
                  {seleccionados.map(p => {
                    const isMed = p.tipo === "medicamento";
                    return (
                      <li
                        key={p.id}
                        className={`${s.itemSeleccionado} ${isMed ? s.itemMedicamento : s.itemDescartable}`}
                      >
                        <span className={s.nombreProducto}>{p.nombreLimpio}</span>
                        <div className={s.controlesCantidad}>
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(p.id, p.cantidad - 1)}
                            disabled={p.cantidad <= 1}
                            title="Disminuir cantidad"
                          >
                            <Icon name="minus" size={14} />
                          </button>
                          <input
                            type="number"
                            min="1"
                            max={p.stockAnterior}
                            value={p.cantidad}
                            onChange={(e) => cambiarCantidad(p.id, parseInt(e.target.value) || 1)}
                            title="Cantidad"
                          />
                          <button
                            type="button"
                            onClick={() => cambiarCantidad(p.id, p.cantidad + 1)}
                            disabled={p.cantidad >= p.stockAnterior}
                            title="Aumentar cantidad"
                          >
                            <Icon name="plus" size={14} />
                          </button>
                        </div>
                        <span className={s.stockInfo}>
                          <Icon name="box" size={12} style={{ marginRight: '2px' }} />
                          {p.stockNuevo} / {p.stockAnterior}
                        </span>
                        <span className={s.subtotal}>{formatCurrency(p.subtotal)}</span>
                        <button
                          type="button"
                          className={s.btnEliminar}
                          onClick={() => quitarProducto(p.id)}
                          title="Quitar del reparto"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className={s.repartoActions}>
                <Link href="/farmacia" className={`${s.actionBtn} ${s.btnCancel}`}>
                  Cancelar
                </Link>
                <button
                  type="button"
                  className={`${s.actionBtn} ${s.btnPrimary}`}
                  onClick={handleSubmit}
                  disabled={seleccionados.length === 0 || loading}
                  title="Confirmar reparto"
                >
                  {loading ? (
                    <>
                      <span className={s.spinner} /> Procesando...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={18} /> Confirmar Reparto
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
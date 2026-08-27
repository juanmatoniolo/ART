"use client";

import { useState, useMemo, useEffect } from "react";
import Icon from "../Icon";
import { normalizeText, formatCurrency } from "../../utils/farmacia";
import s from "../../farmaciaDashboard.module.css";

// Destinos predefinidos (puedes modificar)
const DESTINOS = [
  "Guardia",
  "Primer Piso",
  "Segundo Piso",
  "Quirófano",
  "UTI",
  "Pediatría",
  "Maternidad",
  "Administración",
  "Depósito",
  "Otro",
];

// Color según stock (para el indicador)
const getStockColor = (stock, min = 10) => {
  if (stock === 0) return "#d32f2f";
  if (stock < min) return "#f57c00";
  if (stock < min * 3) return "#fbc02d";
  return "#2e7d32";
};

export default function RepartoModal({ onClose, onSubmit, items }) {
  // Estado principal
  const [destino, setDestino] = useState("Guardia");
  const [responsable, setResponsable] = useState("");
  const [nota, setNota] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [seleccionados, setSeleccionados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Normalizar los items para trabajar con nombres de campo consistentes
  // Adapta según tu estructura real: stock, stockActual, precioUnitario, precioCosto...
  const itemsNormalizados = useMemo(() => {
    return (items || []).map((item) => ({
      ...item,
      stock: item.stockActual ?? item.stock ?? 0,
      precio: item.precioUnitario ?? item.precioCosto ?? item.precioReferencia ?? 0,
      nombreLimpio: (item.nombre || "").replace(/_/g, " "),
    }));
  }, [items]);

  // Actualizar sugerencias al cambiar búsqueda
  useEffect(() => {
    if (!busqueda.trim()) {
      // Sugerir productos con mayor stock
      const top = itemsNormalizados
        .filter((i) => i.stock > 0)
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 8);
      setSugerencias(top);
      return;
    }

    const q = normalizeText(busqueda);
    const filtrados = itemsNormalizados
      .filter(
        (i) =>
          i.stock > 0 &&
          normalizeText(i.nombreLimpio).includes(q)
      )
      .sort((a, b) => {
        const aName = normalizeText(a.nombreLimpio);
        const bName = normalizeText(b.nombreLimpio);
        const aStarts = aName.startsWith(q);
        const bStarts = bName.startsWith(q);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return b.stock - a.stock;
      })
      .slice(0, 8);
    setSugerencias(filtrados);
  }, [busqueda, itemsNormalizados]);

  // Agregar producto al carrito
  const agregarProducto = (item) => {
    if (seleccionados.some((p) => p.id === item.id)) return;
    setSeleccionados((prev) => [
      ...prev,
      {
        ...item,
        cantidad: 1,
        stockAnterior: item.stock,
        stockNuevo: item.stock - 1,
        subtotal: item.precio,
      },
    ]);
    setBusqueda("");
    setSugerencias([]);
  };

  // Cambiar cantidad
  const cambiarCantidad = (id, nuevaCantidad) => {
    setSeleccionados((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const cant = Math.max(1, Math.min(nuevaCantidad, p.stockAnterior));
        return {
          ...p,
          cantidad: cant,
          stockNuevo: p.stockAnterior - cant,
          subtotal: cant * p.precio,
        };
      })
    );
  };

  // Eliminar del carrito
  const quitarProducto = (id) => {
    setSeleccionados((prev) => prev.filter((p) => p.id !== id));
  };

  // Totales
  const totales = useMemo(() => {
    return seleccionados.reduce(
      (acc, p) => ({
        unidades: acc.unidades + p.cantidad,
        valor: acc.valor + p.subtotal,
      }),
      { unidades: 0, valor: 0 }
    );
  }, [seleccionados]);

  // Envío
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

    const productos = seleccionados.map((p) => ({
      id: p.id,
      cantidad: p.cantidad,
      stockAnterior: p.stockAnterior,
      stockNuevo: p.stockNuevo,
    }));

    const datos = {
      destino: destino.trim(),
      responsable: responsable.trim() || "Sin responsable",
      nota: nota.trim(),
    };

    const ok = await onSubmit(productos, datos);
    setLoading(false);
    if (ok) onClose();
  };

  return (
    <div className={s.modalOverlay} onClick={onClose}>
      <div className={`${s.modal} ${s.repartoModal}`} onClick={(e) => e.stopPropagation()}>
        {/* Cabecera */}
        <div className={s.modalHeader}>
          <h3>
            <Icon name="truck" size={24} />
            Realizar Reparto
          </h3>
          <button className={s.modalCloseBtn} onClick={onClose}>
            <Icon name="close" size={24} />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className={s.repartoForm}
        >
          {/* Campos superiores: destino, responsable, nota */}
          <div className={s.repartoCampos}>
            <div className={s.fieldGroup}>
              <label>Destino *</label>
              <div className={s.destinoGrid}>
                {DESTINOS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    className={`${s.destinoChip} ${destino === d ? s.destinoChipActive : ""}`}
                    onClick={() => setDestino(d)}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div className={s.fieldGroup}>
              <label>Responsable (quién recibe)</label>
              <input
                type="text"
                className={s.formInput}
                value={responsable}
                onChange={(e) => setResponsable(e.target.value)}
                placeholder="Nombre y apellido"
              />
            </div>
            <div className={s.fieldGroup}>
              <label>Observaciones (opcional)</label>
              <textarea
                className={s.formTextarea}
                rows={2}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Notas adicionales..."
              />
            </div>
          </div>

          {error && <div className={s.errorMsg}>{error}</div>}

          {/* Contenido principal: dos columnas */}
          <div className={s.repartoGrid}>
            {/* Columna izquierda: buscador + sugerencias */}
            <div className={s.repartoDisponibles}>
              <div className={s.searchWrap}>
                <span className={s.searchIconInner}>
                  <Icon name="search" size={18} />
                </span>
                <input
                  className={s.searchInput}
                  placeholder="Buscar por nombre..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  autoFocus
                />
                {busqueda && (
                  <button
                    type="button"
                    className={s.searchClear}
                    onClick={() => {
                      setBusqueda("");
                      setSugerencias([]);
                    }}
                  >
                    <Icon name="close" size={18} />
                  </button>
                )}
              </div>

              <div className={s.listaDisponibles}>
                {sugerencias.length === 0 ? (
                  <p className={s.emptyText}>
                    {busqueda
                      ? "No se encontraron productos con stock"
                      : "Escribí para buscar productos"}
                  </p>
                ) : (
                  <ul>
                    {sugerencias.map((item) => (
                      <li key={item.id} onClick={() => agregarProducto(item)}>
                        <div className={s.productoInfo}>
                          <span className={s.productoNombre}>
                            {item.nombreLimpio}
                            {item.presentacion && (
                              <span className={s.productoPresentacion}>
                                {" "}
                                ({item.presentacion})
                              </span>
                            )}
                          </span>
                          <span className={s.productoStock}>
                            <span
                              className={s.stockIndicator}
                              style={{
                                backgroundColor: getStockColor(item.stock, item.stockMinimo || 10),
                              }}
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
                        >
                          <Icon name="plus" size={16} /> Agregar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Columna derecha: carrito de selección */}
            <div className={s.repartoSeleccionados}>
              <div className={s.resumenSeleccion}>
                <span>
                  <Icon name="list" size={16} /> {seleccionados.length} productos
                </span>
                <span>
                  <Icon name="package" size={16} /> {totales.unidades} unidades
                </span>
                <span className={s.valorTotal}>
                  <Icon name="money" size={16} /> {formatCurrency(totales.valor)}
                </span>
              </div>

              {seleccionados.length === 0 ? (
                <p className={s.emptyText}>
                  Haz clic en un producto de la izquierda para agregarlo.
                </p>
              ) : (
                <ul className={s.listaSeleccionados}>
                  {seleccionados.map((p) => (
                    <li key={p.id} className={s.itemSeleccionado}>
                      <span className={s.nombreProducto}>{p.nombreLimpio}</span>
                      <div className={s.controlesCantidad}>
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(p.id, p.cantidad - 1)}
                          disabled={p.cantidad <= 1}
                        >
                          <Icon name="minus" size={14} />
                        </button>
                        <input
                          type="number"
                          min="1"
                          max={p.stockAnterior}
                          value={p.cantidad}
                          onChange={(e) =>
                            cambiarCantidad(p.id, parseInt(e.target.value) || 1)
                          }
                        />
                        <button
                          type="button"
                          onClick={() => cambiarCantidad(p.id, p.cantidad + 1)}
                          disabled={p.cantidad >= p.stockAnterior}
                        >
                          <Icon name="plus" size={14} />
                        </button>
                      </div>
                      <span className={s.stockInfo}>
                        {p.stockNuevo} / {p.stockAnterior}
                      </span>
                      <span className={s.subtotal}>
                        {formatCurrency(p.subtotal)}
                      </span>
                      <button
                        type="button"
                        className={s.btnEliminar}
                        onClick={() => quitarProducto(p.id)}
                      >
                        <Icon name="trash" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className={s.repartoActions}>
                <button
                  type="button"
                  className={`${s.actionBtn} ${s.btnCancel}`}
                  onClick={onClose}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={`${s.actionBtn} ${s.btnPrimary}`}
                  disabled={seleccionados.length === 0 || loading}
                >
                  <Icon name="check" size={18} />
                  {loading ? "Procesando..." : "Confirmar Reparto"}
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
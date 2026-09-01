"use client";
import { useState, useEffect, useMemo } from "react";
import s from "../../farmaciaDashboard.module.css";
import { Overlay, CloseBtn } from "./AgregarModal";
import { formatCurrency } from "../../utils/farmacia";
import Fuse from "fuse.js"; // Asegúrate de instalarlo: npm install fuse.js

export default function CargaMasivaModal({ onClose, onSubmit, cargarCatalogo }) {
  const [catalogo, setCatalogo] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [seleccionados, setSeleccionados] = useState([]);

  useEffect(() => {
    cargarCatalogo().then(setCatalogo);
  }, []);

  // Lista de productos a mostrar (limitada a 5)
  const catalogoParaMostrar = useMemo(() => {
    if (!catalogo.length) return [];

    // Excluir seleccionados para evitar duplicados en la lista
    const idsSeleccionados = new Set(seleccionados.map(p => p.id));
    const itemsDisponibles = catalogo.filter(item => !idsSeleccionados.has(item.id));

    if (busqueda.trim()) {
      const fuse = new Fuse(itemsDisponibles, {
        keys: ['nombre', 'presentacion'],
        threshold: 0.3,
        includeScore: true,
      });
      const resultados = fuse.search(busqueda.trim());
      return resultados.slice(0, 5).map(r => r.item);
    } else {
      // Sin búsqueda: ordenar por stock descendente y tomar los primeros 5
      return [...itemsDisponibles]
        .sort((a, b) => (b.stockActual || 0) - (a.stockActual || 0))
        .slice(0, 5);
    }
  }, [catalogo, seleccionados, busqueda]);

  const agregar = (item) => {
    if (seleccionados.find(p => p.id === item.id)) return;
    setSeleccionados(prev => [...prev, {
      ...item, cantidad: "1",
      stockAnterior: item.stockActual || 0,
      stockNuevo: (item.stockActual || 0) + 1
    }]);
  };

  const quitar = (id) => setSeleccionados(prev => prev.filter(p => p.id !== id));

  const setCantidad = (id, val) => {
    const n = parseInt(val) || 0;
    setSeleccionados(prev => prev.map(p => p.id !== id ? p : {
      ...p, cantidad: val, stockNuevo: (p.stockAnterior || 0) + n
    }));
  };

  const totales = useMemo(() => seleccionados.reduce((acc, p) => {
    const c = parseInt(p.cantidad) || 0;
    return { unidades: acc.unidades + c, valor: acc.valor + c * (p.precioCosto || 0) };
  }, { unidades: 0, valor: 0 }), [seleccionados]);

  const handleSubmit = async () => {
    const ok = await onSubmit(seleccionados);
    if (ok) onClose();
  };

  return (
    <Overlay onClose={onClose} wide>
      <div className={s.modalHeader}>
        <h3 className={s.modalTitle}>📥 Carga Masiva</h3>
        <CloseBtn onClick={onClose} />
      </div>
      <div className={`${s.modalBody} ${s.modalBodyScroll}`}>
        <div className={s.splitLayout}>
          {/* Catálogo */}
          <div className={s.splitPane}>
            <h4 className={s.splitPaneTitle}>🔍 Buscar en catálogo</h4>
            <div className={s.searchWrap}>
              <span className={s.searchIconInner}>🔍</span>
              <input
                className={s.searchInput}
                placeholder="Buscar..."
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>
            <p className={s.infoLimitada}>
              {busqueda
                ? "Mostrando los 5 mejores resultados."
                : "Mostrando 5 productos con mayor stock. Usá el buscador para otros."}
            </p>
            <div className={s.catalogList}>
              {catalogoParaMostrar.length === 0 ? (
                <div className={s.emptyState}><span>🔍</span><p>No se encontraron productos</p></div>
              ) : (
                catalogoParaMostrar.map(item => (
                  <div key={item.id} className={s.catalogItem} onClick={() => agregar(item)}>
                    <div className={s.catalogItemTop}>
                      <strong>{item.nombre.replace(/_/g, " ")}</strong>
                      <span className={item.tipo === "medicamento" ? s.badgeMed : s.badgeDesc}>
                        {item.tipoLabel}
                      </span>
                    </div>
                    <div className={s.catalogItemBot}>
                      <span>{item.presentacion}</span>
                      <span className={s.catalogItemPrice}>{formatCurrency(item.precioCosto)}</span>
                      <span>Stock: {item.stockActual}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Seleccionados */}
          <div className={s.splitPane}>
            <h4 className={s.splitPaneTitle}>📦 A cargar ({seleccionados.length})</h4>
            {seleccionados.length === 0 ? (
              <div className={s.emptyState}><span>📦</span><p>Seleccioná productos del catálogo</p></div>
            ) : (
              <div className={s.selectedList}>
                {seleccionados.map(p => (
                  <div key={p.id} className={s.selectedItem}>
                    <div className={s.selectedItemTop}>
                      <strong>{p.nombre.replace(/_/g, " ")}</strong>
                      <button className={s.removeBtn} onClick={() => quitar(p.id)}>✕</button>
                    </div>
                    <div className={s.selectedItemMid}>
                      <span className={s.stockFlow}>
                        {p.stockAnterior} → <strong>{p.stockNuevo}</strong>
                      </span>
                    </div>
                    <div className={s.selectedItemBot}>
                      <label>Cantidad:</label>
                      <input
                        type="number"
                        min="1"
                        className={s.cantInput}
                        value={p.cantidad}
                        onChange={e => setCantidad(p.id, e.target.value)}
                      />
                      <span className={s.subTotal}>
                        {formatCurrency((parseInt(p.cantidad) || 0) * (p.precioCosto || 0))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={s.modalFooter}>
        <div className={s.footerTotals}>
          <span>{totales.unidades} unidades</span>
          <strong>{formatCurrency(totales.valor)}</strong>
        </div>
        <div className={s.footerBtns}>
          <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
          <button
            className={`${s.actionBtn} ${s.btn_secondary}`}
            onClick={handleSubmit}
            disabled={seleccionados.length === 0}
          >
            Procesar Ingreso ({seleccionados.length})
          </button>
        </div>
      </div>
    </Overlay>
  );
}
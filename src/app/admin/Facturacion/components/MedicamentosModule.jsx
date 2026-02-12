'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money } from '../utils/calculos';
import styles from './medicamentos.module.css';

function normalizeText(input) {
  return String(input ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesAllTerms(texto, busqueda) {
  const t = normalizeText(texto);
  const q = normalizeText(busqueda);
  if (!q) return true;
  const terms = q.split(' ').filter(Boolean);
  return terms.every((term) => t.includes(term));
}

// IDs únicos para items agregados (evita colisiones)
let medicamentoCounter = 0;
let descartableCounter = 0;

export default function MedicamentosModule({
  medicamentosAgregados,
  descartablesAgregados,
  agregarMedicamento,
  agregarDescartable,
  onAtras,
  onSiguiente
}) {
  const [busqueda, setBusqueda] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Feedback UI
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [recentKey, setRecentKey] = useState(null);
  const toastTimer = useRef(null);

  const medsDataRef = useRef(null);
  const descDataRef = useRef(null);

  const showToast = useCallback((msg, key) => {
    clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastOpen(true);
    setRecentKey(key);

    toastTimer.current = setTimeout(() => setToastOpen(false), 2200);
    // limpiamos el highlight un poco antes / similar al toast
    setTimeout(() => setRecentKey(null), 1200);
  }, []);

  const buildList = useCallback(() => {
    const arr = [];

    const medsData = medsDataRef.current;
    const descData = descDataRef.current;

    if (medsData) {
      for (const [key, itemData] of Object.entries(medsData)) {
        arr.push({
          sourceId: key,
          tipo: 'Medicacion',
          tipoFormatted: '💊 Medicación',
          nombre: itemData?.nombre || key,
          presentacion: itemData?.presentacion || 'ampolla',
          precio: Number(itemData?.precioReferencia ?? itemData?.precio ?? 0) || 0
        });
      }
    }

    if (descData) {
      for (const [key, itemData] of Object.entries(descData)) {
        arr.push({
          sourceId: key,
          tipo: 'Descartable',
          tipoFormatted: '🧷 Descartable',
          nombre: itemData?.nombre || key,
          presentacion: itemData?.presentacion || 'unidad',
          precio: Number(itemData?.precioReferencia ?? itemData?.precio ?? 0) || 0
        });
      }
    }

    arr.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));
    setItems(arr);
  }, []);

  useEffect(() => {
    const refMeds = ref(db, 'medydescartables/medicamentos');
    const refDesc = ref(db, 'medydescartables/descartables');

    const unsubMeds = onValue(
      refMeds,
      (snap) => {
        medsDataRef.current = snap.exists() ? snap.val() : {};
        buildList();
      },
      (err) => {
        console.error('Error leyendo medicamentos:', err);
        medsDataRef.current = {};
        buildList();
      }
    );

    const unsubDesc = onValue(
      refDesc,
      (snap) => {
        descDataRef.current = snap.exists() ? snap.val() : {};
        buildList();
        setLoading(false);
      },
      (err) => {
        console.error('Error leyendo descartables:', err);
        descDataRef.current = {};
        buildList();
        setLoading(false);
      }
    );

    return () => {
      unsubMeds();
      unsubDesc();
      clearTimeout(toastTimer.current);
    };
  }, [buildList]);

  const filtrados = useMemo(() => {
    return items.filter(
      (it) =>
        matchesAllTerms(it.nombre, busqueda) ||
        matchesAllTerms(it.presentacion, busqueda) ||
        matchesAllTerms(it.tipoFormatted, busqueda)
    );
  }, [items, busqueda]);

  const handleAgregar = useCallback(
    (item) => {
      const key = `${item.tipo}-${item.sourceId}`;
      const displayName = String(item.nombre || '').replace(/_/g, ' ').slice(0, 38);

      if (item.tipo === 'Medicacion') {
        const nuevoId = `med-${Date.now()}-${++medicamentoCounter}-${Math.random().toString(36).slice(2, 6)}`;
        agregarMedicamento({
          id: nuevoId,
          tipo: 'medicamento',
          nombre: item.nombre,
          presentacion: item.presentacion,
          precio: item.precio,
          cantidad: 1,
          valorUnitario: item.precio,
          total: item.precio
        });
        showToast(`✓ Agregado: ${displayName}`, key);
        return;
      }

      const nuevoId = `desc-${Date.now()}-${++descartableCounter}-${Math.random().toString(36).slice(2, 6)}`;
      agregarDescartable({
        id: nuevoId,
        tipo: 'descartable',
        nombre: item.nombre,
        presentacion: item.presentacion,
        precio: item.precio,
        cantidad: 1,
        valorUnitario: item.precio,
        total: item.precio
      });
      showToast(`✓ Agregado: ${displayName}`, key);
    },
    [agregarMedicamento, agregarDescartable, showToast]
  );

  const medCount = medicamentosAgregados?.length ?? 0;
  const descCount = descartablesAgregados?.length ?? 0;

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>💊 Medicación y 🧷 Descartables</h2>

      {toastOpen && (
        <div className={styles.toast}>
          <div className={styles.toastInner}>
            <span className={styles.toastIcon}>✓</span>
            <span className={styles.toastText}>{toastMsg}</span>
          </div>
        </div>
      )}

      <div className={styles.metaRow}>
        <span className={styles.metaChip}>💊 {medCount} en factura</span>
        <span className={styles.metaChip}>🧷 {descCount} en factura</span>
      </div>

      <div className={styles.controls}>
        <input
          type="text"
          className={styles.search}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder='Buscar (ej: "suero dextrosa 10", "ampolla", "descartable")'
          autoComplete="off"
        />
        <div className={styles.resultsInfo}>
          {loading ? 'Cargando…' : `${filtrados.length} resultados`}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando medicamentos…</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thProducto}>Producto</th>
                <th className={styles.thPres}>Presentación</th>
                <th className={styles.thTipo}>Tipo</th>
                <th className={styles.thPrecio}>Precio</th>
                <th className={styles.thAccion}>Agregar</th>
              </tr>
            </thead>

            <tbody>
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className={styles.empty}>
                    No hay coincidencias.
                  </td>
                </tr>
              ) : (
                filtrados.map((item) => {
                  const rowKey = `${item.tipo}-${item.sourceId}`;
                  const esMedicacion = item.tipo === 'Medicacion';
                  const isRecent = rowKey === recentKey;

                  return (
                    <tr key={rowKey} className={isRecent ? styles.rowRecent : ''}>
                      <td className={styles.tdProducto}>{String(item.nombre).replace(/_/g, ' ')}</td>

                      <td>
                        <span className={styles.presentacion}>
                          {item.presentacion.charAt(0).toUpperCase() + item.presentacion.slice(1)}
                        </span>
                      </td>

                      <td>
                        {esMedicacion ? (
                          <span className={styles.medicacion}>{item.tipoFormatted}</span>
                        ) : (
                          <span className={styles.descartable}>{item.tipoFormatted}</span>
                        )}
                      </td>

                      <td className={styles.tdPrecio}>$ {money(item.precio)}</td>

                      <td className={styles.tdAccion}>
                        <button
                          className={`${styles.btnAdd} ${isRecent ? styles.btnAddRecent : ''}`}
                          onClick={() => handleAgregar(item)}
                          title="Agregar a la factura"
                        >
                          {isRecent ? '✓' : '➕'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.botonesNavegacion}>
        <button className={styles.btnAtras} onClick={onAtras}>
          ← Atrás
        </button>
        <button className={styles.btnSiguiente} onClick={onSiguiente}>
          Siguiente → Resumen
        </button>
      </div>
    </div>
  );
}

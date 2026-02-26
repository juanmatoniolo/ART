'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money } from '../utils/calculos';
import styles from './medicamentos.module.css';

/**
 * ========= Helpers =========
 */
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

/**
 * Número locale AR:
 * - "0,4" => 0.4
 * - "1.234,56" => 1234.56
 * - "1,234.56" => 1234.56 (si viene mezclado)
 * - "2.5" => 2.5
 */
const parseLocaleNumber = (val) => {
  if (val == null || val === '') return NaN;
  let s = String(val).trim();

  // limpiar espacios
  s = s.replace(/\s+/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    // decidir cuál es decimal por la última aparición
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      // coma decimal, puntos miles
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // punto decimal, comas miles
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    // coma decimal
    s = s.replace(',', '.');
  }

  // sacar cualquier cosa rara
  s = s.replace(/[^\d.-]/g, '');

  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const clampQty = (v, min = 0.01) => {
  const n = parseLocaleNumber(v);
  if (!Number.isFinite(n)) return 1;
  return Math.max(min, n);
};

const formatQtyAR = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '1';
  return String(n).replace('.', ',');
};

const stepFor = (qty) => (qty < 1 ? 0.1 : 1);

const MAX_RESULTS = 10;

export default function MedicamentosModule({
  medicamentosAgregados,
  descartablesAgregados,
  agregarMedicamento,
  agregarDescartable,
  actualizarItem,
  onAtras,
  onSiguiente
}) {
  /**
   * ========= Estado catálogo =========
   */
  const [busqueda, setBusqueda] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const medsDataRef = useRef(null);
  const descDataRef = useRef(null);

  /**
   * ========= Cantidades por ítem (para la vista de búsqueda) =========
   * key: `${tipoKey}:${sourceId}`
   */
  const [itemQuantities, setItemQuantities] = useState({});

  /**
   * ========= Cantidades por combo =========
   * key: comboId
   */
  const [comboQuantities, setComboQuantities] = useState({});

  /**
   * ========= Combos (RTDB) =========
   */
  const [combos, setCombos] = useState({});
  const [combosLoading, setCombosLoading] = useState(true);

  /**
   * ========= UX =========
   */
  const [modo, setModo] = useState('buscar');
  const searchRef = useRef(null);

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [recentKey, setRecentKey] = useState(null);
  const toastTimer = useRef(null);
  const recentTimer = useRef(null);

  const showToast = useCallback((msg, key) => {
    clearTimeout(toastTimer.current);
    clearTimeout(recentTimer.current);

    setToastMsg(msg);
    setToastOpen(true);
    setRecentKey(key);

    toastTimer.current = setTimeout(() => setToastOpen(false), 2200);
    recentTimer.current = setTimeout(() => setRecentKey(null), 1200);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(toastTimer.current);
      clearTimeout(recentTimer.current);
    };
  }, []);

  /**
   * ========= Modal builder =========
   */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [comboNombre, setComboNombre] = useState('');
  const [comboTags, setComboTags] = useState('');
  const [comboSearch, setComboSearch] = useState('');
  const [comboSelected, setComboSelected] = useState([]);

  const resetModal = () => {
    setEditingId(null);
    setComboNombre('');
    setComboTags('');
    setComboSearch('');
    setComboSelected([]);
  };

  const openCreateModal = () => {
    resetModal();
    setModalOpen(true);
  };

  const openEditModal = (comboId, combo) => {
    setEditingId(comboId);
    setComboNombre(combo?.nombre ?? '');
    setComboTags((combo?.tags ?? []).join(', '));
    setComboSearch('');
    setComboSelected(
      (combo?.items ?? []).map((x) => ({
        tipo: x.tipo,
        itemId: x.itemId,
        cantidad: clampQty(x.cantidad)
      }))
    );
    setModalOpen(true);
  };

  /**
   * ========= RTDB: catálogo meds/desc =========
   */
  const buildList = useCallback(() => {
    const arr = [];
    const medsData = medsDataRef.current || {};
    const descData = descDataRef.current || {};

    for (const [key, itemData] of Object.entries(medsData)) {
      if (itemData?.activo === false) continue;
      arr.push({
        sourceId: key,
        tipoKey: 'medicamento',
        tipoFormatted: '💊 Medicación',
        nombre: itemData?.nombre || key,
        presentacion: itemData?.presentacion || 'ampolla',
        precio: Number(itemData?.precioReferencia ?? itemData?.precio ?? 0) || 0
      });
    }

    for (const [key, itemData] of Object.entries(descData)) {
      if (itemData?.activo === false) continue;
      arr.push({
        sourceId: key,
        tipoKey: 'descartable',
        tipoFormatted: '🧷 Descartable',
        nombre: itemData?.nombre || key,
        presentacion: itemData?.presentacion || 'unidad',
        precio: Number(itemData?.precioReferencia ?? itemData?.precio ?? 0) || 0
      });
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
    };
  }, [buildList]);

  /**
   * ========= RTDB: combos =========
   */
  useEffect(() => {
    const combosRef = ref(db, 'medydescartables/combos');

    const unsub = onValue(
      combosRef,
      (snap) => {
        setCombos(snap.exists() ? snap.val() : {});
        setCombosLoading(false);
      },
      (err) => {
        console.error('Error leyendo combos:', err);
        setCombos({});
        setCombosLoading(false);
      }
    );

    return () => unsub();
  }, []);

  /**
   * ========= Index catálogo =========
   */
  const catalogIndex = useMemo(() => {
    const map = new Map();
    for (const it of items) map.set(`${it.tipoKey}:${it.sourceId}`, it);
    return map;
  }, [items]);

  /**
   * ========= Buscar =========
   */
  const filtrados = useMemo(() => {
    const q = busqueda.trim();
    const base = items.filter(
      (it) =>
        matchesAllTerms(it.nombre, q) ||
        matchesAllTerms(it.presentacion, q) ||
        matchesAllTerms(it.tipoFormatted, q)
    );
    return base.slice(0, MAX_RESULTS);
  }, [items, busqueda]);

  /**
   * ========= Función de agregar/actualizar item =========
   */
  const agregarOActualizarItem = useCallback(
    (item, cantidadAgregar) => {
      const qty = clampQty(cantidadAgregar);
      const key = `${item.tipoKey}:${item.sourceId}`;
      const displayName = String(item.nombre || '').replace(/_/g, ' ').slice(0, 42);

      const lista = item.tipoKey === 'medicamento' ? medicamentosAgregados : descartablesAgregados;
      const existente = lista.find((i) => i.tipo === item.tipoKey && i.sourceId === item.sourceId);

      if (existente) {
        const nuevaCantidad = clampQty(existente.cantidad + qty);
        const nuevoTotal = item.precio * nuevaCantidad;
        actualizarItem(existente.id, {
          cantidad: nuevaCantidad,
          total: nuevoTotal
        });
        showToast(`✓ ${displayName} x${formatQtyAR(nuevaCantidad)} (actualizado)`, key);
      } else {
        const id = `${item.tipoKey === 'medicamento' ? 'med' : 'desc'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const nuevoItem = {
          id,
          tipo: item.tipoKey,
          sourceId: item.sourceId,
          nombre: item.nombre,
          presentacion: item.presentacion,
          precio: item.precio,
          cantidad: qty,
          valorUnitario: item.precio,
          total: item.precio * qty
        };
        if (item.tipoKey === 'medicamento') {
          agregarMedicamento(nuevoItem);
        } else {
          agregarDescartable(nuevoItem);
        }
        showToast(`✓ ${displayName} x${formatQtyAR(qty)}`, key);
      }
    },
    [medicamentosAgregados, descartablesAgregados, agregarMedicamento, agregarDescartable, actualizarItem, showToast]
  );

  /**
   * ========= Agregar combo con cantidad =========
   */
  const handleAgregarCombo = useCallback(
    (comboId, combo, veces = 1) => {
      const comboItems = combo?.items ?? [];
      if (comboItems.length === 0) {
        showToast('⚠️ El combo no tiene items', `combo:${comboId}`);
        return;
      }

      let added = 0;
      let missing = 0;

      for (const ci of comboItems) {
        const tipo = ci?.tipo;
        const itemId = ci?.itemId;
        const cantidadBase = clampQty(ci?.cantidad);
        const cantidadTotal = clampQty(cantidadBase * veces);

        if (!tipo || !itemId) {
          missing++;
          continue;
        }

        const found = catalogIndex.get(`${tipo}:${itemId}`);
        if (!found) {
          missing++;
          continue;
        }

        agregarOActualizarItem(found, cantidadTotal);
        added++;
      }

      const name = combo?.nombre || 'Combo';
      if (added > 0) {
        showToast(`✓ Combo "${name}" x${formatQtyAR(veces)} agregado (${added}${missing ? `, faltan ${missing}` : ''})`, `combo:${comboId}`);
      } else {
        showToast(`⚠️ No se pudo agregar el combo: ${name}`, `combo:${comboId}`);
      }
    },
    [catalogIndex, agregarOActualizarItem, showToast]
  );

  /**
   * ========= Guardar combo =========
   */
  const saveCombo = useCallback(async () => {
    const nombre = comboNombre.trim();
    if (nombre.length < 3) {
      showToast('⚠️ Nombre muy corto (mín 3)', 'combo:validate');
      return;
    }
    if (comboSelected.length === 0) {
      showToast('⚠️ Agregá al menos 1 item', 'combo:validate');
      return;
    }

    const tags = comboTags
      .split(',')
      .map((t) => normalizeText(t))
      .filter(Boolean);

    const payload = {
      nombre,
      activo: true,
      tags,
      items: comboSelected.map((x) => ({
        tipo: x.tipo,
        itemId: x.itemId,
        cantidad: clampQty(x.cantidad)
      })),
      updatedAt: Date.now()
    };

    try {
      if (editingId) {
        await update(ref(db, `medydescartables/combos/${editingId}`), payload);
        showToast('✓ Combo actualizado', `combo:update:${editingId}`);
      } else {
        const r = push(ref(db, 'medydescartables/combos'));
        await set(r, { ...payload, createdAt: Date.now() });
        showToast('✓ Combo creado', `combo:create:${r.key}`);
      }
      setModalOpen(false);
      resetModal();
    } catch (e) {
      console.error(e);
      showToast('❌ Error guardando combo', 'combo:error');
    }
  }, [comboNombre, comboTags, comboSelected, editingId, showToast]);

  const deleteCombo = useCallback(
    async (comboId) => {
      if (!window.confirm('¿Eliminar este combo?')) return;
      try {
        await remove(ref(db, `medydescartables/combos/${comboId}`));
        showToast('🗑️ Combo eliminado', `combo:del:${comboId}`);
      } catch (e) {
        console.error(e);
        showToast('❌ Error eliminando combo', `combo:del:error`);
      }
    },
    [showToast]
  );

  /**
   * ========= Builder =========
   */
  const builderResults = useMemo(() => {
    const q = comboSearch.trim();
    const base = items.filter(
      (it) =>
        matchesAllTerms(it.nombre, q) ||
        matchesAllTerms(it.presentacion, q) ||
        matchesAllTerms(it.tipoFormatted, q)
    );
    return base.slice(0, 20);
  }, [items, comboSearch]);

  const isAlreadySelected = (tipo, itemId) =>
    comboSelected.some((x) => x.tipo === tipo && x.itemId === itemId);

  const addToCombo = (it) => {
    const entry = { tipo: it.tipoKey, itemId: it.sourceId, cantidad: 1 };
    if (isAlreadySelected(entry.tipo, entry.itemId)) return;
    setComboSelected((prev) => [...prev, entry]);
  };

  const removeFromCombo = (tipo, itemId) => {
    setComboSelected((prev) => prev.filter((x) => !(x.tipo === tipo && x.itemId === itemId)));
  };

  const setComboQty = (tipo, itemId, cantidad) => {
    setComboSelected((prev) =>
      prev.map((x) => (x.tipo === tipo && x.itemId === itemId ? { ...x, cantidad: clampQty(cantidad) } : x))
    );
  };

  const onSearchKeyDown = (e) => {
    if (modo !== 'buscar') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = filtrados[0];
      if (first) {
        const qty = itemQuantities[`${first.tipoKey}:${first.sourceId}`] || 1;
        agregarOActualizarItem(first, qty);
      }
    }
  };

  useEffect(() => {
    if (modo === 'buscar') setTimeout(() => searchRef.current?.focus(), 0);
  }, [modo]);

  const medCount = medicamentosAgregados?.length ?? 0;
  const descCount = descartablesAgregados?.length ?? 0;

  const combosList = useMemo(() => {
    const arr = Object.entries(combos || {}).map(([id, data]) => ({ id, ...data }));
    arr.sort((a, b) => {
      const aa = a.activo === false ? 1 : 0;
      const bb = b.activo === false ? 1 : 0;
      if (aa !== bb) return aa - bb;
      return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es');
    });
    return arr;
  }, [combos]);

  /**
   * Componente local para input de cantidad con estado local
   */
  const CantidadInput = ({ value, onChange, step, min = 0.01 }) => {
    const [localValue, setLocalValue] = useState(formatQtyAR(value));

    useEffect(() => {
      setLocalValue(formatQtyAR(value));
    }, [value]);

    const handleBlur = () => {
      const parsed = clampQty(localValue);
      onChange(parsed);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        e.currentTarget.blur();
      }
    };

    return (
      <input
        className={styles.qtyInput}
        type="text"
        inputMode="decimal"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder={formatQtyAR(min)}
      />
    );
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>💊 Medicación y 🧷 Descartables</h2>
        <div className={styles.metaRow}>
          <span className={styles.metaChip}>💊 {medCount} en factura</span>
          <span className={styles.metaChip}>🧷 {descCount} en factura</span>
        </div>
      </div>

      {toastOpen && (
        <div className={styles.toast}>
          <div className={styles.toastInner}>
            <span className={styles.toastIcon}>✓</span>
            <span className={styles.toastText}>{toastMsg}</span>
          </div>
        </div>
      )}

      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${modo === 'buscar' ? styles.tabActive : ''}`}
          onClick={() => setModo('buscar')}
        >
          🔎 Buscar
        </button>
        <button
          className={`${styles.tabBtn} ${modo === 'combos' ? styles.tabActive : ''}`}
          onClick={() => setModo('combos')}
        >
          🧰 Combos
        </button>

        <div className={styles.tabsRight}>
          <button className={styles.btnPrimary} onClick={openCreateModal} disabled={combosLoading}>
            ➕ Nuevo combo
          </button>
        </div>
      </div>

      {modo === 'buscar' && (
        <div className={styles.searchPanel}>
          <div className={styles.controls}>
            <input
              ref={searchRef}
              type="text"
              className={styles.search}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder='Buscar (ej: "suero dextrosa 10", "ampolla", "descartable")'
              autoComplete="off"
            />
            <div className={styles.resultsInfo}>
              {loading ? 'Cargando…' : `${filtrados.length} resultados (máx ${MAX_RESULTS})`}
            </div>
          </div>

          {loading ? (
            <div className={styles.loading}>Cargando medicamentos…</div>
          ) : (
            <div className={styles.quickList}>
              {filtrados.length === 0 ? (
                <div className={styles.empty}>No hay coincidencias.</div>
              ) : (
                filtrados.map((item) => {
                  const rowKey = `${item.tipoKey}:${item.sourceId}`;
                  const isRecent = rowKey === recentKey;
                  const qty = itemQuantities[rowKey] || 1;

                  return (
                    <div key={rowKey} className={`${styles.quickRow} ${isRecent ? styles.rowRecent : ''}`}>
                      <div className={styles.quickMain}>
                        <div className={styles.quickTitle}>{String(item.nombre).replace(/_/g, ' ')}</div>
                        <div className={styles.quickMeta}>
                          <span className={item.tipoKey === 'medicamento' ? styles.medicacion : styles.descartable}>
                            {item.tipoFormatted}
                          </span>
                          <span className={styles.quickSep}>•</span>
                          <span className={styles.quickPres}>{item.presentacion}</span>
                        </div>
                      </div>

                      <div className={styles.quickRight}>
                        <div className={styles.quickPrice}>$ {money(item.precio)}</div>

                        <div className={styles.qtyBox}>
                          <button
                            className={styles.qtyBtn}
                            onClick={() => {
                              const newVal = Math.max(0.01, qty - stepFor(qty));
                              setItemQuantities(prev => ({ ...prev, [rowKey]: newVal }));
                            }}
                            title="Disminuir"
                            tabIndex={-1}
                          >
                            −
                          </button>
                          <CantidadInput
                            value={qty}
                            onChange={(newVal) => setItemQuantities(prev => ({ ...prev, [rowKey]: newVal }))}
                            step={stepFor(qty)}
                          />
                          <button
                            className={styles.qtyBtn}
                            onClick={() => {
                              const newVal = qty + stepFor(qty);
                              setItemQuantities(prev => ({ ...prev, [rowKey]: newVal }));
                            }}
                            title="Aumentar"
                            tabIndex={-1}
                          >
                            +
                          </button>
                        </div>

                        <button
                          className={`${styles.btnAdd} ${isRecent ? styles.btnAddRecent : ''}`}
                          onClick={() => agregarOActualizarItem(item, qty)}
                          title="Agregar a la factura"
                        >
                          {isRecent ? '✓' : '➕'}
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              <div className={styles.hintLine}>
                Tip: presioná <b>Enter</b> para agregar el primer resultado con la cantidad seleccionada.
              </div>
            </div>
          )}
        </div>
      )}

      {modo === 'combos' && (
        <div className={styles.combosPanel}>
          {combosLoading ? (
            <div className={styles.loading}>Cargando combos…</div>
          ) : combosList.length === 0 ? (
            <div className={styles.empty}>
              No hay combos aún. Creá uno con <b>“Nuevo combo”</b>.
            </div>
          ) : (
            <div className={styles.combosGrid}>
              {combosList.map((c) => {
                const comboId = c.id;
                const nombre = c.nombre || 'Combo';
                const activo = c.activo !== false;
                const countItems = (c.items || []).length;
                const comboQty = comboQuantities[comboId] || 1;

                return (
                  <div key={comboId} className={`${styles.comboCard} ${!activo ? styles.comboDisabled : ''}`}>
                    <div className={styles.comboTop}>
                      <div className={styles.comboTitle}>{nombre}</div>
                      <div className={styles.comboMeta}>
                        <span>{countItems} ítems</span>
                        {Array.isArray(c.tags) && c.tags.length > 0 && (
                          <span className={styles.comboTags}>
                            {c.tags.slice(0, 3).map((t) => (
                              <span key={t} className={styles.tagPill}>{t}</span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.comboQtySelector}>
                      <span className={styles.comboQtyLabel}>Cantidad:</span>
                      <div className={styles.qtyBox}>
                        <button
                          className={styles.qtyBtn}
                          onClick={() => {
                            const newVal = Math.max(1, comboQty - 1);
                            setComboQuantities(prev => ({ ...prev, [comboId]: newVal }));
                          }}
                          title="Disminuir"
                          tabIndex={-1}
                        >
                          −
                        </button>
                        <CantidadInput
                          value={comboQty}
                          onChange={(newVal) => setComboQuantities(prev => ({ ...prev, [comboId]: newVal }))}
                          step={1}
                          min={1}
                        />
                        <button
                          className={styles.qtyBtn}
                          onClick={() => {
                            const newVal = comboQty + 1;
                            setComboQuantities(prev => ({ ...prev, [comboId]: newVal }));
                          }}
                          title="Aumentar"
                          tabIndex={-1}
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className={styles.comboActions}>
                      <button
                        className={styles.btnAddCombo}
                        onClick={() => handleAgregarCombo(comboId, c, comboQty)}
                        disabled={!activo}
                      >
                        ➕ Agregar combo x{formatQtyAR(comboQty)}
                      </button>

                      <div className={styles.comboActionsRow2}>
                        <button
                          className={styles.btnGhost}
                          onClick={() => openEditModal(comboId, c)}
                          title="Editar"
                        >
                          ✏️ Editar
                        </button>

                        <button
                          className={styles.btnDanger}
                          onClick={() => deleteCombo(comboId)}
                          title="Eliminar"
                        >
                          🗑️ Borrar
                        </button>
                      </div>
                    </div>

                    {/* Acordeón para los ítems del combo */}
                    <details className={styles.comboDetails}>
                      <summary className={styles.comboSummary}>
                        Contenido <span>({c.items?.length || 0} ítems)</span>
                      </summary>
                      <div className={styles.comboItems}>
                        {(c.items || []).map((it) => {
                          const resolved = catalogIndex.get(`${it.tipo}:${it.itemId}`);
                          const label = resolved ? String(resolved.nombre).replace(/_/g, ' ') : `${it.tipo}:${it.itemId}`;
                          return (
                            <div key={`${it.tipo}:${it.itemId}`} className={styles.comboPreviewRow}>
                              <span className={styles.comboQty}>×{formatQtyAR(clampQty(it.cantidad))}</span>
                              <span className={styles.comboItem}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </details>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className={styles.botonesNavegacion}>
        <button className={styles.btnAtras} onClick={onAtras}>← Atrás</button>
        <button className={styles.btnSiguiente} onClick={onSiguiente}>Siguiente → Resumen</button>
      </div>

      {modalOpen && (
        <div className={styles.modalOverlay} role="dialog" aria-modal="true">
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>{editingId ? '✏️ Editar combo' : '➕ Nuevo combo'}</div>
              <button
                className={styles.modalClose}
                onClick={() => { setModalOpen(false); resetModal(); }}
                title="Cerrar"
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalFormRow}>
                <label className={styles.modalLabel}>Nombre</label>
                <input
                  className={styles.modalInput}
                  value={comboNombre}
                  onChange={(e) => setComboNombre(e.target.value)}
                  placeholder="Ej: Cura plana"
                  autoComplete="off"
                />
              </div>

              <div className={styles.modalFormRow}>
                <label className={styles.modalLabel}>Tags (opcionales)</label>
                <input
                  className={styles.modalInput}
                  value={comboTags}
                  onChange={(e) => setComboTags(e.target.value)}
                  placeholder="Ej: curacion, enfermeria, guardia"
                  autoComplete="off"
                />
              </div>

              <div className={styles.modalGrid}>
                <div className={styles.modalCol}>
                  <div className={styles.modalColTitle}>🔎 Buscar ítems</div>
                  <input
                    className={styles.modalInput}
                    value={comboSearch}
                    onChange={(e) => setComboSearch(e.target.value)}
                    placeholder="Buscar medicamento/descartable…"
                    autoComplete="off"
                  />

                  <div className={styles.modalList}>
                    {builderResults.length === 0 ? (
                      <div className={styles.modalEmpty}>Sin resultados.</div>
                    ) : (
                      builderResults.map((it) => {
                        const key = `${it.tipoKey}:${it.sourceId}`;
                        const disabled = isAlreadySelected(it.tipoKey, it.sourceId);

                        return (
                          <div key={key} className={styles.modalListRow}>
                            <div className={styles.modalListMain}>
                              <div className={styles.modalItemTitle}>{String(it.nombre).replace(/_/g, ' ')}</div>
                              <div className={styles.modalItemMeta}>
                                <span className={it.tipoKey === 'medicamento' ? styles.medicacion : styles.descartable}>
                                  {it.tipoFormatted}
                                </span>
                                <span className={styles.quickSep}>•</span>
                                <span>{it.presentacion}</span>
                                <span className={styles.quickSep}>•</span>
                                <span>$ {money(it.precio)}</span>
                              </div>
                            </div>

                            <button
                              className={styles.btnAddSmall}
                              onClick={() => addToCombo(it)}
                              disabled={disabled}
                              title={disabled ? 'Ya está en el combo' : 'Agregar al combo'}
                            >
                              {disabled ? '✓' : '➕'}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className={styles.modalCol}>
                  <div className={styles.modalColTitle}>🧰 Seleccionados</div>

                  <div className={styles.modalSelectedList}>
                    {comboSelected.length === 0 ? (
                      <div className={styles.modalEmpty}>Agregá ítems desde la izquierda.</div>
                    ) : (
                      comboSelected.map((x) => {
                        const resolved = catalogIndex.get(`${x.tipo}:${x.itemId}`);
                        const label = resolved ? String(resolved.nombre).replace(/_/g, ' ') : `${x.tipo}:${x.itemId}`;
                        const qtyNum = clampQty(x.cantidad);
                        const step = stepFor(qtyNum);

                        return (
                          <div key={`${x.tipo}:${x.itemId}`} className={styles.selectedRow}>
                            <div className={styles.selectedMain}>
                              <div className={styles.selectedTitle}>{label}</div>
                              <div className={styles.selectedMeta}>
                                <span className={x.tipo === 'medicamento' ? styles.medicacion : styles.descartable}>
                                  {x.tipo === 'medicamento' ? '💊 Medicación' : '🧷 Descartable'}
                                </span>
                                {resolved?.presentacion && (
                                  <>
                                    <span className={styles.quickSep}>•</span>
                                    <span>{resolved.presentacion}</span>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className={styles.selectedRight}>
                              <div className={styles.qtyBox}>
                                <button
                                  className={styles.qtyBtn}
                                  onClick={() => {
                                    const newVal = Math.max(0.01, qtyNum - step);
                                    setComboQty(x.tipo, x.itemId, newVal);
                                  }}
                                  title="Disminuir"
                                  tabIndex={-1}
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  −
                                </button>

                                <CantidadInput
                                  value={qtyNum}
                                  onChange={(newVal) => setComboQty(x.tipo, x.itemId, newVal)}
                                  step={step}
                                />

                                <button
                                  className={styles.qtyBtn}
                                  onClick={() => {
                                    const newVal = qtyNum + step;
                                    setComboQty(x.tipo, x.itemId, newVal);
                                  }}
                                  title="Aumentar"
                                  tabIndex={-1}
                                  onMouseDown={(e) => e.preventDefault()}
                                >
                                  +
                                </button>
                              </div>

                              <button
                                className={styles.btnDangerSmall}
                                onClick={() => removeFromCombo(x.tipo, x.itemId)}
                                title="Quitar"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className={styles.modalHint}>
                    Guardás referencias (tipo + itemId + cantidad). Si cambia el precio en la base, el combo se actualiza solo.
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnGhost} onClick={() => { setModalOpen(false); resetModal(); }}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={saveCombo}>
                {editingId ? 'Guardar cambios' : 'Crear combo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
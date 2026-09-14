// LaboratoriosModule.jsx
'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useConvenio } from './ConvenioContext';
import { calcularLaboratorio, money, normalize } from '../utils/calculos';
import styles from './laboratorio.module.css';

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

const parseLocaleNumber = (val) => {
  if (val == null || val === '') return NaN;
  let s = String(val).trim();
  s = s.replace(/\s+/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma) {
    s = s.replace(',', '.');
  }

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

const MAX_RESULTS = 50;

/**
 * FIX: lee UNIDAD NBU de valoresConvenio con múltiples fallbacks.
 * El contexto expone:
 *   - valoresConvenio.unidadNBU
 *   - valoresConvenio.UNIDAD_NBU (clave normalizada)
 *   - valoresConvenio['UNIDAD NBU'] (clave cruda si vino tal cual)
 *   - aranceles.unidadNBU
 *   - getter valorUB (vía hook useConvenio)
 */
const leerValorUB = (valoresConvenio, aranceles, valorUBGetter) => {
  if (Number.isFinite(valorUBGetter) && valorUBGetter > 0) return valorUBGetter;
  if (!valoresConvenio && !aranceles) return 0;

  const tryKeys = [
    'unidadNBU',
    'UNIDAD_NBU',
    'UNIDAD NBU',
    'Laboratorios_NBU',
    'LABORATORIOS_NBU',
    'valorUB',
    'Valor_UB',
    'VALOR_UB',
  ];

  const candidates = [valoresConvenio, aranceles].filter(Boolean);
  for (const src of candidates) {
    for (const k of tryKeys) {
      const v = src[k];
      if (v != null && v !== '') {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  }
  return 0;
};

export default function LaboratoriosModule({
  laboratoriosAgregados,
  agregarLaboratorio,
  onAtras,
  onSiguiente,
}) {
  const { valoresConvenio, aranceles, valorUB: valorUBGetter } = useConvenio();

  // ========= Estado catálogo laboratorios =========
  const [busqueda, setBusqueda] = useState('');
  const [nomenclador, setNomenclador] = useState([]);
  const [loading, setLoading] = useState(true);

  // ========= Combos (RTDB) =========
  const [combos, setCombos] = useState({});
  const [combosLoading, setCombosLoading] = useState(true);

  // ========= UX =========
  const [modo, setModo] = useState('buscar'); // 'buscar' | 'combos'
  const [lastAddedId, setLastAddedId] = useState(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const toastTimer = useRef(null);
  const recentTimer = useRef(null);
  const searchRef = useRef(null);

  // FIX: valor UB robusto
  const valorUB = useMemo(
    () => leerValorUB(valoresConvenio, aranceles, valorUBGetter),
    [valoresConvenio, aranceles, valorUBGetter]
  );

  // ========= Modal builder =========
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [comboNombre, setComboNombre] = useState('');
  const [comboTags, setComboTags] = useState('');
  const [comboSearch, setComboSearch] = useState('');
  const [comboSelected, setComboSelected] = useState([]);

  // ========= Toast unificado =========
  const showToastMessage = useCallback((msg, key) => {
    clearTimeout(toastTimer.current);
    clearTimeout(recentTimer.current);

    setToastMsg(msg);
    setShowToast(true);
    setLastAddedId(key);

    toastTimer.current = setTimeout(() => setShowToast(false), 2200);
    recentTimer.current = setTimeout(() => setLastAddedId(null), 1200);
  }, []);

  useEffect(() => {
    return () => {
      clearTimeout(toastTimer.current);
      clearTimeout(recentTimer.current);
    };
  }, []);

  // ========= Cargar nomenclador bioquímica =========
  useEffect(() => {
    let mounted = true;

    fetch('/archivos/NomecladorBioquimica.json')
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;

        const practicas =
          json.practicas?.map((p) => ({
            tipo: 'laboratorio',
            codigo: String(p.codigo ?? '').trim(),
            descripcion: (p.practica_bioquimica || p.descripcion || '').trim(),
            unidadBioquimica: Number(p.unidad_bioquimica) || 0,
          })) || [];

        setNomenclador(practicas);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando laboratorios:', err);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  // ========= Cargar combos desde Firebase =========
  useEffect(() => {
    const combosRef = ref(db, 'laboratorios/combos');

    const unsub = onValue(
      combosRef,
      (snap) => {
        setCombos(snap.exists() ? snap.val() : {});
        setCombosLoading(false);
      },
      (err) => {
        console.error('Error leyendo combos de laboratorio:', err);
        setCombos({});
        setCombosLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // ========= Index del catálogo =========
  const catalogIndex = useMemo(() => {
    const map = new Map();
    for (const lab of nomenclador) {
      map.set(`laboratorio:${lab.codigo}`, lab);
    }
    return map;
  }, [nomenclador]);

  // ========= Filtrado de laboratorios =========
  const laboratoriosFiltrados = useMemo(() => {
    if (!busqueda) return nomenclador.slice(0, MAX_RESULTS);

    const q = normalize(busqueda);
    return nomenclador
      .filter(
        (l) =>
          normalize(l.codigo).includes(q) ||
          normalize(l.descripcion).includes(q)
      )
      .slice(0, MAX_RESULTS);
  }, [nomenclador, busqueda]);

  // ========= Agregar item individual =========
  // FIX: usamos valoresConvenio + un override con valorUB para que
  // calcularLaboratorio lo tome aunque el contexto no traiga la clave exacta.
  const valoresParaCalculo = useMemo(
    () => ({
      ...(valoresConvenio || {}),
      // alias que calcularLaboratorio puede buscar
      valorUB: valorUB,
      unidadNBU: valorUB,
      UNIDAD_NBU: valorUB,
      UNIDAD_NBU_: valorUB,
      Laboratorios_NBU: valorUB,
    }),
    [valoresConvenio, valorUB]
  );

  const handleAgregar = useCallback(
    (laboratorio, cantidad = 1) => {
      const qty = clampQty(cantidad);
      const valores = calcularLaboratorio(laboratorio, valoresParaCalculo);

      const nuevoLaboratorio = {
        id: `lab-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        ...laboratorio,
        ...valores,
        cantidad: qty,
        total: valores.total * qty,
      };

      agregarLaboratorio(nuevoLaboratorio);
      const key = `laboratorio:${laboratorio.codigo}`;
      showToastMessage(`✓ "${laboratorio.descripcion?.slice(0, 42)}..." agregado`, key);
    },
    [agregarLaboratorio, valoresParaCalculo, showToastMessage]
  );

  // ========= Agregar combo =========
  const handleAgregarCombo = useCallback(
    (comboId, combo) => {
      const comboItems = combo?.items ?? [];
      if (comboItems.length === 0) {
        showToastMessage('⚠️ El combo no tiene items', `combo:${comboId}`);
        return;
      }

      let added = 0;
      let missing = 0;

      for (const ci of comboItems) {
        const itemId = ci?.itemId;
        const cantidad = clampQty(ci?.cantidad);

        if (!itemId) {
          missing++;
          continue;
        }

        const found = catalogIndex.get(`laboratorio:${itemId}`);
        if (!found) {
          missing++;
          continue;
        }

        handleAgregar(found, cantidad);
        added++;
      }

      const name = combo?.nombre || 'Combo';
      if (added > 0) {
        showToastMessage(
          `✓ Combo agregado: ${name} (${added}${missing ? `, faltan ${missing}` : ''})`,
          `combo:${comboId}`
        );
      } else {
        showToastMessage(`⚠️ No se pudo agregar el combo: ${name}`, `combo:${comboId}`);
      }
    },
    [catalogIndex, handleAgregar, showToastMessage]
  );

  // ========= Guardar combo =========
  const saveCombo = useCallback(async () => {
    const nombre = comboNombre.trim();
    if (nombre.length < 3) {
      showToastMessage('⚠️ Nombre muy corto (mín 3)', 'combo:validate');
      return;
    }
    if (comboSelected.length === 0) {
      showToastMessage('⚠️ Agregá al menos 1 item', 'combo:validate');
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
        tipo: 'laboratorio',
        itemId: x.itemId,
        cantidad: clampQty(x.cantidad),
      })),
      updatedAt: Date.now(),
    };

    try {
      if (editingId) {
        await update(ref(db, `laboratorios/combos/${editingId}`), payload);
        showToastMessage('✓ Combo actualizado', `combo:update:${editingId}`);
      } else {
        const r = push(ref(db, 'laboratorios/combos'));
        await set(r, { ...payload, createdAt: Date.now() });
        showToastMessage('✓ Combo creado', `combo:create:${r.key}`);
      }
      setModalOpen(false);
      resetModal();
    } catch (e) {
      console.error(e);
      showToastMessage('❌ Error guardando combo', 'combo:error');
    }
  }, [comboNombre, comboTags, comboSelected, editingId, showToastMessage]);

  const deleteCombo = useCallback(
    async (comboId) => {
      if (!window.confirm('¿Eliminar este combo?')) return;
      try {
        await remove(ref(db, `laboratorios/combos/${comboId}`));
        showToastMessage('🗑️ Combo eliminado', `combo:del:${comboId}`);
      } catch (e) {
        console.error(e);
        showToastMessage('❌ Error eliminando combo', `combo:del:error`);
      }
    },
    [showToastMessage]
  );

  // ========= Funciones del builder =========
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
        tipo: 'laboratorio',
        itemId: x.itemId,
        cantidad: clampQty(x.cantidad),
      }))
    );
    setModalOpen(true);
  };

  const builderResults = useMemo(() => {
    const q = comboSearch.trim();
    if (!q) return nomenclador.slice(0, 30);
    return nomenclador
      .filter(
        (l) =>
          matchesAllTerms(l.codigo, q) ||
          matchesAllTerms(l.descripcion, q)
      )
      .slice(0, 30);
  }, [nomenclador, comboSearch]);

  const isAlreadySelected = (itemId) =>
    comboSelected.some((x) => x.itemId === itemId);

  const addToCombo = (lab) => {
    const itemId = lab.codigo;
    if (isAlreadySelected(itemId)) return;
    setComboSelected((prev) => [...prev, { tipo: 'laboratorio', itemId, cantidad: 1 }]);
  };

  const removeFromCombo = (itemId) => {
    setComboSelected((prev) => prev.filter((x) => x.itemId !== itemId));
  };

  const setComboQty = (itemId, cantidad) => {
    setComboSelected((prev) =>
      prev.map((x) => (x.itemId === itemId ? { ...x, cantidad: clampQty(cantidad) } : x))
    );
  };

  const onSearchKeyDown = (e) => {
    if (modo !== 'buscar') return;
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = laboratoriosFiltrados[0];
      if (first) handleAgregar(first, 1);
    }
  };

  useEffect(() => {
    if (modo === 'buscar') setTimeout(() => searchRef.current?.focus(), 0);
  }, [modo]);

  // FIX: preview ahora usa el valorUB robusto
  const getPreview = useCallback(
    (laboratorio) => {
      const ub = laboratorio?.unidadBioquimica ?? 0;
      const total = (ub || 0) * (valorUB || 0);
      return { ub, total, formula: `${money(ub)} × ${money(valorUB)}` };
    },
    [valorUB]
  );

  const countAgregados = laboratoriosAgregados?.length ?? 0;

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

  if (loading && modo === 'buscar') {
    return (
      <div className={styles.tabContent}>
        <h2>🧪 Estudios de Laboratorio</h2>
        <div className={styles.loading}>Cargando laboratorios...</div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <h2>🧪 Estudios de Laboratorio</h2>

      {showToast && (
        <div className={styles.toast}>
          <div className={styles.toastInner}>
            <span className={styles.toastIcon}>✓</span>
            {toastMsg}
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
        <>
          <div className={styles.labHeader}>
            <div className={styles.labHeaderTop}>
              <div className={styles.labHeaderText}>
                <p className={styles.labHelp}>
                  Los valores se calculan automáticamente: <b>UB × Valor UB</b>
                </p>

                <div className={styles.labChips}>
                  <span className={`${styles.chip} ${styles.chipUb}`}>
                    <b>Valor UB</b> <span className={styles.chipValue}>{money(valorUB)}</span>
                  </span>
                  <span className={`${styles.chip} ${styles.chipInfo}`}>
                    <b>Agregados</b> <span className={styles.chipValue}>{countAgregados}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className={styles.labSearchRow}>
              <input
                ref={searchRef}
                type="text"
                placeholder="Buscar por código o descripción…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={onSearchKeyDown}
                className={styles.labInput}
                autoComplete="off"
              />
              <div className={styles.labSearchInfo}>
                {laboratoriosFiltrados.length} estudios encontrados
              </div>
            </div>
          </div>

          <div className={styles.labMobileList}>
            {laboratoriosFiltrados.length === 0 ? (
              <div className={styles.noResults}>No hay resultados para “{busqueda}”.</div>
            ) : (
              laboratoriosFiltrados.map((l) => {
                const { ub, total, formula } = getPreview(l);
                const cardKey = `lab:${l.codigo}`;
                const isRecent = lastAddedId === cardKey;

                return (
                  <article
                    key={cardKey}
                    className={`${styles.labCard} ${isRecent ? styles.labCardRecent : ''}`}
                  >
                    <div className={styles.labCardTop}>
                      <div className={styles.labCode}>{l.codigo}</div>
                      <span className={styles.labUbBadge}>UB: {money(ub)}</span>
                    </div>
                    <div className={styles.labDesc}>{l.descripcion}</div>
                    <div className={styles.labCostGrid}>
                      <div className={styles.labCostBox}>
                        <span className={styles.labCostLabel}>Fórmula</span>
                        <span className={styles.labBaseLine}>{formula}</span>
                      </div>
                      <div className={styles.labCostBox}>
                        <span className={styles.labCostLabel}>Total</span>
                        <span className={styles.labValueBig}>$ {money(total)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAgregar(l, 1)}
                      className={styles.labAddBtn}
                      title="Agregar a factura"
                    >
                      ➕ Agregar
                    </button>
                  </article>
                );
              })
            )}
          </div>

          <div className={styles.labTableWrapper}>
            <table className={styles.labTable}>
              <thead>
                <tr>
                  <th className={styles.labThCode}>Código</th>
                  <th className={styles.labThDesc}>Práctica Bioquímica</th>
                  <th className={styles.labThNum}>U.B.</th>
                  <th className={styles.labThNum}>Total</th>
                  <th className={styles.labThAction}>Agregar</th>
                </tr>
              </thead>
              <tbody>
                {laboratoriosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.noResultsCell}>
                      No hay resultados para “{busqueda}”.
                    </td>
                  </tr>
                ) : (
                  laboratoriosFiltrados.map((l) => {
                    const { ub, total, formula } = getPreview(l);
                    const rowKey = `lab:${l.codigo}`;
                    const isRecent = lastAddedId === rowKey;

                    return (
                      <tr key={rowKey} className={isRecent ? styles.labRowRecent : ''}>
                        <td className={styles.labCodeCell}>{l.codigo}</td>
                        <td className={styles.labDescCell}>{l.descripcion}</td>
                        <td className={styles.labNumCell}>
                          <div className={styles.labBaseLine}>UB</div>
                          <div className={styles.labValueBig}>{money(ub)}</div>
                        </td>
                        <td className={styles.labNumCell}>
                          <div className={styles.labBaseLine}>{formula}</div>
                          <div className={styles.labValueBig}>$ {money(total)}</div>
                        </td>
                        <td className={styles.labActionCell}>
                          <button
                            onClick={() => handleAgregar(l, 1)}
                            className={styles.labAddRound}
                            title="Agregar a factura"
                          >
                            +
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={styles.hintLine}>
            Tip: presioná <b>Enter</b> para agregar el primer resultado.
          </div>
        </>
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

                    <div className={styles.comboActions}>
                      <button
                        className={styles.btnAddCombo}
                        onClick={() => handleAgregarCombo(comboId, c)}
                        disabled={!activo}
                      >
                        ➕ Agregar combo
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

                    <div className={styles.comboPreview}>
                      {(c.items || []).slice(0, 5).map((it) => {
                        const resolved = catalogIndex.get(`laboratorio:${it.itemId}`);
                        const label = resolved ? resolved.descripcion : `${it.itemId}`;
                        return (
                          <div key={it.itemId} className={styles.comboPreviewRow}>
                            <span className={styles.comboQty}>×{formatQtyAR(clampQty(it.cantidad))}</span>
                            <span className={styles.comboItem}>{label.slice(0, 40)}…</span>
                          </div>
                        );
                      })}
                      {(c.items || []).length > 5 && (
                        <div className={styles.comboMore}>+ {(c.items || []).length - 5} más…</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className={styles.botonesNavegacion}>
        <button className={styles.btnAtras} onClick={onAtras}>
          ← Atrás
        </button>
        <button className={styles.btnSiguiente} onClick={onSiguiente}>
          Siguiente → Medicamentos
        </button>
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
                  placeholder="Ej: Hepatograma"
                  autoComplete="off"
                />
              </div>

              <div className={styles.modalFormRow}>
                <label className={styles.modalLabel}>Tags (opcionales)</label>
                <input
                  className={styles.modalInput}
                  value={comboTags}
                  onChange={(e) => setComboTags(e.target.value)}
                  placeholder="Ej: hepatico, quimica"
                  autoComplete="off"
                />
              </div>

              <div className={styles.modalGrid}>
                <div className={styles.modalCol}>
                  <div className={styles.modalColTitle}>🔎 Buscar estudios</div>
                  <input
                    className={styles.modalInput}
                    value={comboSearch}
                    onChange={(e) => setComboSearch(e.target.value)}
                    placeholder="Buscar por código o descripción…"
                    autoComplete="off"
                  />

                  <div className={styles.modalList}>
                    {builderResults.length === 0 ? (
                      <div className={styles.modalEmpty}>Sin resultados.</div>
                    ) : (
                      builderResults.map((lab) => {
                        const key = lab.codigo;
                        const disabled = isAlreadySelected(key);

                        return (
                          <div key={key} className={styles.modalListRow}>
                            <div className={styles.modalListMain}>
                              <div className={styles.modalItemTitle}>
                                {lab.codigo} – {lab.descripcion}
                              </div>
                              <div className={styles.modalItemMeta}>
                                <span>UB: {money(lab.unidadBioquimica)}</span>
                              </div>
                            </div>

                            <button
                              className={styles.btnAddSmall}
                              onClick={() => addToCombo(lab)}
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
                      <div className={styles.modalEmpty}>Agregá estudios desde la izquierda.</div>
                    ) : (
                      comboSelected.map((x) => {
                        const resolved = catalogIndex.get(`laboratorio:${x.itemId}`);
                        const label = resolved ? `${resolved.codigo} – ${resolved.descripcion}` : x.itemId;
                        const qtyNum = clampQty(x.cantidad);
                        const step = stepFor(qtyNum);

                        return (
                          <div key={x.itemId} className={styles.selectedRow}>
                            <div className={styles.selectedMain}>
                              <div className={styles.selectedTitle}>{label.slice(0, 50)}…</div>
                              <div className={styles.selectedMeta}>
                                <span>UB: {resolved ? money(resolved.unidadBioquimica) : '?'}</span>
                              </div>
                            </div>

                            <div className={styles.selectedRight}>
                              <div className={styles.qtyBox}>
                                <button
                                  className={styles.qtyBtn}
                                  onClick={() => setComboQty(x.itemId, Math.max(0.01, qtyNum - step))}
                                  title="Disminuir"
                                >
                                  −
                                </button>
                                <input
                                  className={styles.qtyInput}
                                  type="text"
                                  inputMode="decimal"
                                  value={formatQtyAR(qtyNum)}
                                  onChange={(e) => setComboQty(x.itemId, e.target.value)}
                                  placeholder="1"
                                />
                                <button
                                  className={styles.qtyBtn}
                                  onClick={() => setComboQty(x.itemId, qtyNum + step)}
                                  title="Aumentar"
                                >
                                  +
                                </button>
                              </div>

                              <button
                                className={styles.btnDangerSmall}
                                onClick={() => removeFromCombo(x.itemId)}
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
                    Guardás referencias por código. Si cambia el valor UB, el precio se actualiza al agregar.
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
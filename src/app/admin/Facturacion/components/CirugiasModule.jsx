'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { useConvenio } from './ConvenioContext';
import { useDebounce } from '@/hooks/useDebounce';
import {
  money,
  normalize,
  highlight,
  obtenerHonorariosAoter,
  calcularPractica
} from '../utils/calculos';
import styles from './cirugias.module.css';

function flattenAoterData(aoterJson) {
  if (!aoterJson?.practicas) return [];
  const flat = [];
  aoterJson.practicas.forEach(item => {
    const region = item.region_nombre || aoterJson.regiones?.[item.region] || 'SIN REGIÓN';
    const complejidad = item.complejidad || 0;
    (item.practicas || []).forEach(p => {
      flat.push({
        codigo: p.codigo,
        descripcion: p.descripcion,
        region,
        complejidad,
        uniqueId: `${p.codigo}-${region}-${complejidad}-${flat.length}`,
      });
    });
  });
  return flat;
}

export default function CirugiasModule({
  cirugiasAgregadas,
  practicasAgregadas,
  agregarCirugia,
  agregarPractica,
  onAtras,
  onSiguiente
}) {
  const { valoresConvenio } = useConvenio();

  const [aoterData, setAoterData] = useState([]);
  const [nacionalData, setNacionalData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [regionQueries, setRegionQueries] = useState({});

  const [itemSelections, setItemSelections] = useState({}); // para AOTER
  const [artroscopiaSelections, setArtroscopiaSelections] = useState({}); // para nacional código 120902

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [lastAddedId, setLastAddedId] = useState(null);
  const tooltipTimeoutRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Cargar ambos nomencladores
  useEffect(() => {
    let mounted = true;
    setLoading(true);

    Promise.all([
      fetch('/archivos/Nomeclador_AOTER.json').then(res => res.json()),
      fetch('/archivos/NomecladorNacional.json').then(res => res.json())
    ])
      .then(([aoterJson, nacionalJson]) => {
        if (!mounted) return;

        const aoterFlat = flattenAoterData(aoterJson);
        setAoterData(aoterFlat);

        const initialSelections = {};
        aoterFlat.forEach(item => {
          initialSelections[item.uniqueId] = { conAyudante: false, numAyudantes: 1 };
        });
        setItemSelections(initialSelections);

        const counts = new Map();
        const nacionalFlat = nacionalJson.flatMap((c) =>
          (c.practicas || []).map((p) => {
            const cap = String(c.capitulo ?? '').trim();
            const cod = String(p.codigo ?? '').trim();
            const base = `${cap}|${cod}`;
            const n = (counts.get(base) ?? 0) + 1;
            counts.set(base, n);
            return {
              ...p,
              capitulo: c.capitulo,
              capituloNombre: c.descripcion,
              __key: `${base}#${n}`,
              type: 'nacional'
            };
          })
        );
        setNacionalData(nacionalFlat);

        setLoading(false);
      })
      .catch(err => {
        console.error('Error cargando datos:', err);
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const combinedData = useMemo(() => {
    const aoterWithType = aoterData.map(item => ({ ...item, type: 'aoter' }));
    const nacionalWithType = nacionalData.map(item => ({ ...item, type: 'nacional' }));
    return [...aoterWithType, ...nacionalWithType];
  }, [aoterData, nacionalData]);

  const fuse = useMemo(() => {
    if (!combinedData.length) return null;
    return new Fuse(combinedData, {
      keys: [
        { name: 'codigo', weight: 2 },
        { name: 'descripcion', weight: 1 },
        { name: 'region', weight: 1 },
        { name: 'capituloNombre', weight: 1 }
      ],
      threshold: 0.25,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [combinedData]);

  const resultados = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return [];
    if (!fuse) return [];
    return fuse.search(q).map(r => r.item);
  }, [debouncedQuery, fuse]);

  const showTooltipMessage = useCallback((msg, id) => {
    clearTimeout(tooltipTimeoutRef.current);
    if (isMounted.current) {
      setTooltipMessage(msg);
      setLastAddedId(id);
      setShowTooltip(true);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      if (isMounted.current) setShowTooltip(false);
    }, 3000);
  }, []);

  useEffect(() => () => clearTimeout(tooltipTimeoutRef.current), []);

  const handleAgregar = useCallback((item) => {
    if (!valoresConvenio) {
      showTooltipMessage('No hay valores de convenio disponibles', 'error');
      return;
    }

    if (item.type === 'aoter') {
      // Lógica para AOTER (igual)
      const { cirujano, ayudante1, ayudante2 } = obtenerHonorariosAoter(item.complejidad, valoresConvenio);
      if (cirujano === 0) {
        showTooltipMessage('El convenio no tiene valores para este nivel', 'error');
        return;
      }

      const selection = itemSelections[item.uniqueId] || { conAyudante: false, numAyudantes: 1 };

      const groupId = `cx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const baseId = `cx-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const baseCommon = {
        ...item,
        cantidad: 1,
        groupId,
        esCirugia: true,
      };

      const agregados = [];

      agregados.push({
        id: `${baseId}-cirujano`,
        ...baseCommon,
        prestadorTipo: 'Dr',
        prestadorNombre: 'Cirujano',
        honorarioMedico: cirujano,
        gastoSanatorial: 0,
        total: cirujano,
      });

      if (selection.conAyudante) {
        if (selection.numAyudantes === 1 && ayudante1 > 0) {
          agregados.push({
            id: `${baseId}-ayud1`,
            ...baseCommon,
            prestadorTipo: 'Dr',
            prestadorNombre: 'Ayudante 1',
            honorarioMedico: ayudante1,
            gastoSanatorial: 0,
            total: ayudante1,
          });
        } else if (selection.numAyudantes === 2 && ayudante2 > 0) {
          agregados.push({
            id: `${baseId}-ayud2a`,
            ...baseCommon,
            prestadorTipo: 'Dr',
            prestadorNombre: 'Ayudante 2 (1)',
            honorarioMedico: ayudante2,
            gastoSanatorial: 0,
            total: ayudante2,
          });
          agregados.push({
            id: `${baseId}-ayud2b`,
            ...baseCommon,
            prestadorTipo: 'Dr',
            prestadorNombre: 'Ayudante 2 (2)',
            honorarioMedico: ayudante2,
            gastoSanatorial: 0,
            total: ayudante2,
          });
        }
      }

      agregados.forEach(cx => agregarCirugia(cx));
      showTooltipMessage(`✓ ${item.codigo} - ${item.descripcion.slice(0, 40)}... agregada`, groupId);
    } else if (item.type === 'nacional') {
      // Para prácticas nacionales: solo gasto sanatorial
      let gasto = 0;

      // Caso especial: artroscopia (código 120902)
      if (item.codigo === '120902') {
        const tipo = artroscopiaSelections[item.__key] || 'simple';
        const gastoKey = tipo === 'compleja' ? 'Artroscopia_Hombro' : 'Artroscopia_Simple_Gastos_Sanatoriales';
        gasto = Number(valoresConvenio[gastoKey]) || 0;
      } else {
        const calculo = calcularPractica(item, valoresConvenio);
        gasto = calculo.gastoSanatorial;
      }

      if (gasto === 0) {
        showTooltipMessage(`⚠️ ${item.codigo} no tiene gasto sanatorial`, 'warn');
        return;
      }

      const groupId = `prac-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const baseId = `prac-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const baseCommon = {
        ...item,
        cantidad: 1,
        groupId,
        esCirugia: false,
      };

      const gastoClinica = {
        id: `${baseId}-clin`,
        ...baseCommon,
        prestadorTipo: 'Clinica',
        prestadorNombre: 'Clínica de la Unión',
        honorarioMedico: 0,
        gastoSanatorial: gasto,
        total: gasto,
      };

      agregarPractica(gastoClinica);
      const tipoMsg = item.codigo === '120902' ? ` (${artroscopiaSelections[item.__key] || 'simple'})` : '';
      showTooltipMessage(`✓ ${item.codigo} - ${item.descripcion.slice(0, 40)}...${tipoMsg} (solo gasto)`, groupId);
    }
  }, [valoresConvenio, itemSelections, artroscopiaSelections, agregarCirugia, agregarPractica, showTooltipMessage]);

  const esAoter = (item) => item.type === 'aoter';

  // Manejadores para ayudantes (AOTER)
  const handleConAyudanteChange = (uniqueId, checked) => {
    setItemSelections(prev => ({
      ...prev,
      [uniqueId]: { ...prev[uniqueId], conAyudante: checked }
    }));
  };

  const handleNumAyudantesChange = (uniqueId, num) => {
    setItemSelections(prev => ({
      ...prev,
      [uniqueId]: { ...prev[uniqueId], numAyudantes: num }
    }));
  };

  // Manejador para artroscopia (nacional)
  const handleArtroscopiaChange = (key, tipo) => {
    setArtroscopiaSelections(prev => ({ ...prev, [key]: tipo }));
  };

  const puedeTenerDosAyudantes = (complejidad) => Number(complejidad) >= 5;

  // Renderizado condicional según tipo (versión móvil)
  const renderCard = (item, q = '') => {
    if (esAoter(item)) {
      // ... (código AOTER sin cambios)
      const { cirujano, ayudante1, ayudante2 } = obtenerHonorariosAoter(item.complejidad, valoresConvenio);
      const isRecent = lastAddedId && item.groupId === lastAddedId;
      const permiteDos = puedeTenerDosAyudantes(item.complejidad);
      const selection = itemSelections[item.uniqueId] || { conAyudante: false, numAyudantes: 1 };

      return (
        <article key={item.uniqueId} className={`${styles.card} ${isRecent ? styles.recentCard : ''}`}>
          <div className={styles.cardHeader}>
            <span className={styles.codigo}>{highlight(item.codigo, q)}</span>
            <span className={styles.region}>{item.region}</span>
          </div>
          <div className={styles.descripcion}>{highlight(item.descripcion, q)}</div>
          <div className={styles.meta}>
            <span className={styles.complejidad}>Comp. {item.complejidad}</span>
          </div>

          <div className={styles.prices}>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Cirujano</span>
              <span className={styles.priceValue}>{money(cirujano)}</span>
            </div>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Ayud. 1</span>
              <span className={styles.priceValue}>{money(ayudante1)}</span>
            </div>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Ayud. 2</span>
              <span className={styles.priceValue}>{money(ayudante2)}</span>
            </div>
          </div>

          <div className={styles.ayudanteSelector}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={selection.conAyudante}
                onChange={(e) => handleConAyudanteChange(item.uniqueId, e.target.checked)}
              />
              ¿Lleva ayudante?
            </label>

            {selection.conAyudante && (
              <div className={styles.radioGroup}>
                <label>
                  <input
                    type="radio"
                    checked={selection.numAyudantes === 1}
                    onChange={() => handleNumAyudantesChange(item.uniqueId, 1)}
                  />
                  1 ayudante (${money(ayudante1)})
                </label>
                <label>
                  <input
                    type="radio"
                    checked={selection.numAyudantes === 2}
                    onChange={() => handleNumAyudantesChange(item.uniqueId, 2)}
                    disabled={!permiteDos}
                  />
                  2 ayudantes (c/u ${money(ayudante2)}) {!permiteDos && '(solo ≥5)'}
                </label>
              </div>
            )}
          </div>

          <button className={styles.btnAgregar} onClick={() => handleAgregar(item)}>
            ➕ Agregar
          </button>
        </article>
      );
    } else {
      // Render para prácticas nacionales
      const calculo = valoresConvenio ? calcularPractica(item, valoresConvenio) : { honorarioMedico: 0, gastoSanatorial: 0 };
      const isRecent = lastAddedId && item.groupId === lastAddedId;
      const esArtroscopia = item.codigo === '120902';

      // Determinar gasto a mostrar (puede variar según selección si es artroscopia)
      let gastoMostrado = calculo.gastoSanatorial;
      if (esArtroscopia) {
        const tipo = artroscopiaSelections[item.__key] || 'simple';
        const gastoKey = tipo === 'compleja' ? 'Artroscopia_Hombro' : 'Artroscopia_Simple_Gastos_Sanatoriales';
        gastoMostrado = Number(valoresConvenio?.[gastoKey]) || 0;
      }

      return (
        <article key={item.__key} className={`${styles.card} ${styles.nacionalCard} ${isRecent ? styles.recentCard : ''}`}>
          <div className={styles.cardHeader}>
            <span className={styles.codigo}>{highlight(item.codigo, q)}</span>
            <span className={styles.region}>{item.capitulo} – {item.capituloNombre}</span>
          </div>
          <div className={styles.descripcion}>{highlight(item.descripcion, q)}</div>

          <div className={styles.prices}>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Honorario</span>
              <span className={styles.priceValue}>{money(calculo.honorarioMedico)}</span>
            </div>
            <div className={styles.priceItem}>
              <span className={styles.priceLabel}>Gasto</span>
              <span className={styles.priceValue}>{money(gastoMostrado)}</span>
            </div>
          </div>

          {/* Selector para artroscopia */}
          {esArtroscopia && (
            <div className={styles.artroscopiaSelector}>
              <label>
                <input
                  type="radio"
                  name={`artro-${item.__key}`}
                  checked={artroscopiaSelections[item.__key] === 'simple' || !artroscopiaSelections[item.__key]}
                  onChange={() => handleArtroscopiaChange(item.__key, 'simple')}
                />
                Simple (${money(Number(valoresConvenio?.['Artroscopia_Simple_Gastos_Sanatoriales']) || 0)})
              </label>
              <label>
                <input
                  type="radio"
                  name={`artro-${item.__key}`}
                  checked={artroscopiaSelections[item.__key] === 'compleja'}
                  onChange={() => handleArtroscopiaChange(item.__key, 'compleja')}
                />
                Compleja (Hombro) (${money(Number(valoresConvenio?.['Artroscopia_Hombro']) || 0)})
              </label>
            </div>
          )}

          <div className={styles.ayudanteSelector}>
            {!esArtroscopia && <span className={styles.nacionalHint}>Solo se agregará el gasto sanatorial</span>}
          </div>

          <button className={styles.btnAgregar} onClick={() => handleAgregar(item)}>
            ➕ Agregar {esArtroscopia ? '(gasto según tipo)' : '(solo gasto)'}
          </button>
        </article>
      );
    }
  };

  // Renderizado condicional según tipo (versión tabla) - similar, adaptado
  const renderTableRow = (item, q = '') => {
    if (esAoter(item)) {
      // ... (código AOTER tabla sin cambios)
      const { cirujano, ayudante1, ayudante2 } = obtenerHonorariosAoter(item.complejidad, valoresConvenio);
      const isRecent = lastAddedId && item.groupId === lastAddedId;
      const permiteDos = puedeTenerDosAyudantes(item.complejidad);
      const selection = itemSelections[item.uniqueId] || { conAyudante: false, numAyudantes: 1 };

      return (
        <tr key={item.uniqueId} className={isRecent ? styles.recentRow : ''}>
          <td className={styles.tdCodigo}>{highlight(item.codigo, q)}</td>
          <td className={styles.tdDescripcion}>
            {highlight(item.descripcion, q)}
            <div className={styles.tdMeta}>{item.region} / Comp. {item.complejidad}</div>
          </td>
          <td className={styles.tdHonorarios}>
            <div>Cir: {money(cirujano)}</div>
            <div>Ay1: {money(ayudante1)}</div>
            <div>Ay2: {money(ayudante2)}</div>
          </td>
          <td className={styles.tdAccion}>
            <div className={styles.tableAyudanteSelector}>
              <label>
                <input
                  type="checkbox"
                  checked={selection.conAyudante}
                  onChange={(e) => handleConAyudanteChange(item.uniqueId, e.target.checked)}
                />
                Ayud.
              </label>
              {selection.conAyudante && (
                <>
                  <label>
                    <input
                      type="radio"
                      name={`ayud-${item.uniqueId}`}
                      checked={selection.numAyudantes === 1}
                      onChange={() => handleNumAyudantesChange(item.uniqueId, 1)}
                    />
                    1
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`ayud-${item.uniqueId}`}
                      checked={selection.numAyudantes === 2}
                      onChange={() => handleNumAyudantesChange(item.uniqueId, 2)}
                      disabled={!permiteDos}
                    />
                    2
                  </label>
                </>
              )}
            </div>
            <button className={styles.btnAgregarTabla} onClick={() => handleAgregar(item)} title="Agregar">
              +
            </button>
          </td>
        </tr>
      );
    } else {
      const calculo = valoresConvenio ? calcularPractica(item, valoresConvenio) : { honorarioMedico: 0, gastoSanatorial: 0 };
      const isRecent = lastAddedId && item.groupId === lastAddedId;
      const esArtroscopia = item.codigo === '120902';

      let gastoMostrado = calculo.gastoSanatorial;
      if (esArtroscopia) {
        const tipo = artroscopiaSelections[item.__key] || 'simple';
        const gastoKey = tipo === 'compleja' ? 'Artroscopia_Hombro' : 'Artroscopia_Simple_Gastos_Sanatoriales';
        gastoMostrado = Number(valoresConvenio?.[gastoKey]) || 0;
      }

      return (
        <tr key={item.__key} className={isRecent ? styles.recentRow : ''}>
          <td className={styles.tdCodigo}>{highlight(item.codigo, q)}</td>
          <td className={styles.tdDescripcion}>
            {highlight(item.descripcion, q)}
            <div className={styles.tdMeta}>{item.capitulo} – {item.capituloNombre}</div>
            {esArtroscopia && (
              <div className={styles.tableArtroscopiaSelector}>
                <label>
                  <input
                    type="radio"
                    name={`artro-tab-${item.__key}`}
                    checked={artroscopiaSelections[item.__key] === 'simple' || !artroscopiaSelections[item.__key]}
                    onChange={() => handleArtroscopiaChange(item.__key, 'simple')}
                  />
                  Simple
                </label>
                <label>
                  <input
                    type="radio"
                    name={`artro-tab-${item.__key}`}
                    checked={artroscopiaSelections[item.__key] === 'compleja'}
                    onChange={() => handleArtroscopiaChange(item.__key, 'compleja')}
                  />
                  Compleja
                </label>
              </div>
            )}
          </td>
          <td className={styles.tdHonorarios}>
            <div>Hon: {money(calculo.honorarioMedico)}</div>
            <div>Gas: {money(gastoMostrado)}</div>
          </td>
          <td className={styles.tdAccion}>
            <button className={styles.btnAgregarTabla} onClick={() => handleAgregar(item)} title="Agregar (solo gasto)">
              +
            </button>
          </td>
        </tr>
      );
    }
  };

  const totalCirugias = cirugiasAgregadas?.length || 0;
  const totalPracticas = practicasAgregadas?.length || 0;
  const totalCombinado = totalCirugias + totalPracticas;

  return (
    <div className={styles.tabContent}>
      <h2>🩺 Cirugías + Prácticas</h2>

      {showTooltip && (
        <div className={styles.toast}>
          <div className={styles.toastInner}><span className={styles.toastIcon}>✓</span>{tooltipMessage}</div>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button className={styles.switchButton} onClick={() => setModoBusqueda(p => !p)}>
            {modoBusqueda ? '📂 Ver por regiones' : '🔍 Modo búsqueda global'}
          </button>
          <span className={styles.counterBadge}>
            {totalCombinado} ítems agregados ({totalCirugias} cirugías, {totalPracticas} prácticas)
          </span>
        </div>
        <p className={styles.helpText}>
          Buscá códigos AOTER o del nomenclador nacional. Para AOTER podés elegir ayudantes; para nacional solo se agrega el gasto sanatorial (a la lista de prácticas). 
          {valoresConvenio?.['Artroscopia_Hombro'] && ' Artroscopia: seleccioná simple o compleja.'}
        </p>
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando nomencladores...</div>
      ) : modoBusqueda ? (
        <>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar código o descripción..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            <span className={styles.resultCount}>{resultados.length} resultados</span>
          </div>

          <div className={styles.mobileList}>
            {resultados.length === 0 ? (
              <div className={styles.noResults}>No se encontraron resultados.</div>
            ) : (
              resultados.map(item => renderCard(item, query))
            )}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr><th>Código</th><th>Descripción</th><th>Honorarios/Gasto</th><th></th></tr>
              </thead>
              <tbody>
                {resultados.length === 0 ? (
                  <tr><td colSpan={4} className={styles.noResultsCell}>No se encontraron resultados.</td></tr>
                ) : (
                  resultados.map(item => renderTableRow(item, query))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        // Modo regiones: solo AOTER
        <div className={styles.regionList}>
          {Array.from(new Set(aoterData.map(d => d.region))).sort().map(region => {
            const practicasRegion = aoterData.filter(d => d.region === region);
            const qLocal = regionQueries[region] || '';
            const filtradas = qLocal
              ? practicasRegion.filter(p => normalize(p.codigo + ' ' + p.descripcion).includes(normalize(qLocal)))
              : practicasRegion;

            return (
              <details key={region} className={styles.regionAccordion}>
                <summary className={styles.regionHeader}>
                  {region} <span className={styles.regionCount}>({filtradas.length})</span>
                </summary>
                <div className={styles.regionBody}>
                  <input
                    type="text"
                    className={styles.regionSearch}
                    placeholder="Buscar en esta región..."
                    value={qLocal}
                    onChange={(e) => setRegionQueries(prev => ({ ...prev, [region]: e.target.value }))}
                  />
                  <div className={styles.mobileList}>
                    {filtradas.map(item => renderCard(item, qLocal))}
                  </div>
                  <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                      <thead><tr><th>Código</th><th>Descripción</th><th>Honorarios</th><th></th></tr></thead>
                      <tbody>
                        {filtradas.map(item => renderTableRow(item, qLocal))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}

      <div className={styles.botonesNavegacion}>
        <button className={styles.btnAtras} onClick={onAtras}>← Atrás</button>
        <button className={styles.btnSiguiente} onClick={onSiguiente}>Siguiente → Laboratorios</button>
      </div>
    </div>
  );
}
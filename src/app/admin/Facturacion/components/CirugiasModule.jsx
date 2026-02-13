'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { useConvenio } from './ConvenioContext';
import { useDebounce } from '@/hooks/useDebounce';
import { money, normalize, highlight, obtenerHonorariosAoter } from '../utils/calculos';
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

export default function CirugiasModule({ cirugiasAgregadas, agregarCirugia, onAtras, onSiguiente }) {
  const { valoresConvenio } = useConvenio();

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [regionQueries, setRegionQueries] = useState({});

  // Estado para las selecciones de cada ítem (por uniqueId)
  const [itemSelections, setItemSelections] = useState({});

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [lastAddedId, setLastAddedId] = useState(null);
  const tooltipTimeoutRef = useRef(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch('/archivos/Nomeclador_AOTER.json')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return;
        const flat = flattenAoterData(json);
        setData(flat);
        // Inicializar selecciones por defecto: sin ayudante
        const initialSelections = {};
        flat.forEach(item => {
          initialSelections[item.uniqueId] = { conAyudante: false, numAyudantes: 1 };
        });
        setItemSelections(initialSelections);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error cargando AOTER:', err);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const fuse = useMemo(() => {
    if (!data.length) return null;
    return new Fuse(data, {
      keys: ['codigo', 'descripcion', 'region'],
      threshold: 0.25,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [data]);

  const resultados = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return [];
    if (fuse) return fuse.search(q).map(r => r.item);
    return [];
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

    // Siempre agregar cirujano
    agregados.push({
      id: `${baseId}-cirujano`,
      ...baseCommon,
      prestadorTipo: 'Dr',
      prestadorNombre: 'Cirujano',
      honorarioMedico: cirujano,
      gastoSanatorial: 0,
      total: cirujano,
    });

    // Agregar ayudantes según selección
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
        // Dos ayudantes: ambos con el valor de Ayudante 2
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
  }, [valoresConvenio, itemSelections, agregarCirugia, showTooltipMessage]);

  // Determinar si se permiten 2 ayudantes según complejidad (>=5)
  const puedeTenerDosAyudantes = (complejidad) => Number(complejidad) >= 5;

  // Manejadores para actualizar la selección de un ítem
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

  const renderCard = (item, q = '') => {
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

        {/* Selector de ayudantes por ítem */}
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
  };

  const renderTableRow = (item, q = '') => {
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
  };

  const countAgregadas = cirugiasAgregadas?.length || 0;

  return (
    <div className={styles.tabContent}>
      <h2>🩺 Cirugías (AOTER)</h2>

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
            {countAgregadas} {countAgregadas === 1 ? 'cirugía' : 'cirugías'} agregada{countAgregadas !== 1 ? 's' : ''}
          </span>
        </div>
        <p className={styles.helpText}>
          Seleccioná por cada práctica si lleva ayudante(s). Para complejidad ≥5 podés elegir 2 ayudantes.
        </p>
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando nomenclador AOTER...</div>
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
                <tr><th>Código</th><th>Descripción</th><th>Honorarios</th><th></th></tr>
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
        <div className={styles.regionList}>
          {Array.from(new Set(data.map(d => d.region))).sort().map(region => {
            const practicasRegion = data.filter(d => d.region === region);
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
'use client';

import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import { useConvenio } from './ConvenioContext';
import {
  normalize,
  money,
  parseNumber,
  isRadiografia,
  isSubsiguiente,
  vincularSubsiguientes,
  highlight,
  calcularPractica
} from '../utils/calculos';
import styles from './practicas.module.css';

export default function PracticasModule({ practicasAgregadas, agregarPractica, onAtras, onSiguiente }) {
  const { valoresConvenio } = useConvenio();
  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [filtroCapitulo, setFiltroCapitulo] = useState('');
  const [capituloQueries, setCapituloQueries] = useState({});
  const [loading, setLoading] = useState(true);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [lastAddedItem, setLastAddedItem] = useState(null);
  const tooltipTimeoutRef = useRef(null);

  // Cargar JSON del nomenclador
  useEffect(() => {
    let mounted = true;
    fetch('/archivos/NomecladorNacional.json')
      .then(res => res.json())
      .then(json => {
        if (!mounted) return;
        setCapitulos(json);
        const counts = new Map();
        const flat = json.flatMap(c =>
          (c.practicas || []).map(p => {
            const cap = String(c.capitulo ?? '').trim();
            const cod = String(p.codigo ?? '').trim();
            const base = `${cap}|${cod}`;
            const n = (counts.get(base) ?? 0) + 1;
            counts.set(base, n);
            return {
              ...p,
              capitulo: c.capitulo,
              capituloNombre: c.descripcion,
              __key: `${base}#${n}`
            };
          })
        );
        setData(flat);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  // Instancia de Fuse para búsqueda difusa
  const fuseGlobal = useMemo(() => {
    if (!data.length) return null;
    return new Fuse(data, {
      keys: ['descripcion', 'codigo', 'capitulo', 'capituloNombre'],
      threshold: 0.18,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
  }, [data]);

  // Resultados de búsqueda global (con manejo seguro de vincularSubsiguientes)
  const resultadosGlobales = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    // Búsqueda exacta por código o descripción
    const exact = data.filter(it =>
      String(it.codigo).toLowerCase() === q.toLowerCase() ||
      normalize(it.descripcion).includes(normalize(q))
    );

    let results = [];

    if (exact.length > 0) {
      // Si hay coincidencias exactas, aplicamos vinculación
      exact.forEach(it => {
        const vinculados = vincularSubsiguientes(it, data);
        results.push(...vinculados);
      });
    } else if (fuseGlobal) {
      // Si no, búsqueda difusa
      const fuzzy = fuseGlobal.search(q).map(r => r.item);
      fuzzy.forEach(it => {
        const vinculados = vincularSubsiguientes(it, data);
        results.push(...vinculados);
      });
    }

    // Eliminar duplicados usando __key o código+capítulo
    const unique = Array.from(
      new Map(results.map(it => [it.__key || `${it.capitulo}|${it.codigo}`, it])).values()
    );

    // Ordenar: primero radiografías
    return unique.sort((a, b) => (isRadiografia(a) ? 0 : 1) - (isRadiografia(b) ? 0 : 1));
  }, [query, data, fuseGlobal]);

  // Tooltip
  const showTooltipMessage = useCallback((message, item) => {
    clearTimeout(tooltipTimeoutRef.current);
    setTooltipMessage(message);
    setLastAddedItem(item);
    setShowTooltip(true);
    tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(false), 3000);
  }, []);

  useEffect(() => () => clearTimeout(tooltipTimeoutRef.current), []);

  // Agregar práctica
  const handleAgregar = useCallback((practica) => {
    if (!valoresConvenio) return alert('No hay valores de convenio disponibles');
    const calculo = calcularPractica(practica, valoresConvenio);
    const nuevaPractica = {
      id: `pract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...practica,
      ...calculo,
      cantidad: 1,
      esRX: isRadiografia(practica),
      esSubsiguiente: isSubsiguiente(practica)
    };
    agregarPractica(nuevaPractica);
    showTooltipMessage(`✓ "${practica.descripcion.substring(0, 50)}..." agregada`, practica);
  }, [valoresConvenio, agregarPractica, showTooltipMessage]);

  // Renderizado de un item (mobile/desktop)
  const renderItem = (item, isMobile = false, queryLocal = '') => {
    const key = item.__key || `${item.capitulo}|${item.codigo}`;
    const esRX = isRadiografia(item);
    const esSubs = isSubsiguiente(item);
    const isRecentlyAdded = lastAddedItem?.__key === key;
    const calculo = valoresConvenio
      ? calcularPractica(item, valoresConvenio)
      : { honorarioMedico: 0, gastoSanatorial: 0, total: 0 };
    const q = queryLocal || query;

    if (isMobile) {
      return (
        <article
          key={key}
          className={`${styles.card} ${esRX ? styles.rxCard : ''} ${esSubs ? styles.subsiguienteCard : ''} ${
            isRecentlyAdded ? styles.recentlyAdded : ''
          }`}
        >
          <div className={styles.cardTop}>
            <div className={styles.code}>{highlight(item.codigo, q)}</div>
            <span className={styles.capBadge}>
              {item.capitulo} – {item.capituloNombre}
            </span>
          </div>
          <div className={styles.desc}>{highlight(item.descripcion, q)}</div>
          <div className={styles.costGrid}>
            <div className={styles.costBox}>
              <span className={styles.costLabel}>Honorario</span>
              <span className={styles.costValue}>{money(calculo.honorarioMedico)}</span>
            </div>
            <div className={styles.costBox}>
              <span className={styles.costLabel}>Gasto</span>
              <span className={styles.costValue}>{money(calculo.gastoSanatorial)}</span>
            </div>
          </div>
          <div className={styles.cardActions}>
            <button
              onClick={() => handleAgregar(item)}
              className={`${styles.btnAgregar} ${isRecentlyAdded ? styles.btnAgregado : ''}`}
              title="Agregar a factura"
            >
              {isRecentlyAdded ? '✓ Agregado' : '➕ Agregar'}
            </button>
          </div>
        </article>
      );
    }

    // Desktop: fila de tabla
    return (
      <tr
        key={key}
        className={`${esRX ? styles.rxRow : ''} ${esSubs ? styles.subsiguienteRow : ''} ${
          isRecentlyAdded ? styles.recentlyAddedRow : ''
        }`}
      >
        <td>{highlight(item.codigo, q)}</td>
        <td className={styles.descCell}>{highlight(item.descripcion, q)}</td>
        <td>
          <span className={styles.capBadge}>
            {item.capitulo} – {item.capituloNombre}
          </span>
        </td>
        <td className={styles.numeric}>{money(calculo.honorarioMedico)}</td>
        <td className={styles.numeric}>{money(calculo.gastoSanatorial)}</td>
        <td>
          <button
            onClick={() => handleAgregar(item)}
            className={`${styles.btnAgregarTabla} ${isRecentlyAdded ? styles.btnAgregadoTabla : ''}`}
            title="Agregar a factura"
          >
            {isRecentlyAdded ? '✓' : '+'}
          </button>
        </td>
      </tr>
    );
  };

  const practicasCount = practicasAgregadas.length;

  return (
    <div className={styles.tabContent}>
      <h2>🏥 Prácticas Médicas</h2>

      {showTooltip && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipContent}>
            <span className={styles.tooltipIcon}>✓</span>
            {tooltipMessage}
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button className={styles.switchButton} onClick={() => setModoBusqueda((p) => !p)}>
            {modoBusqueda ? '📂 Ver por capítulos' : '🔍 Modo búsqueda global'}
          </button>
          <div className={styles.practicasCounter}>
            <span className={styles.counterBadge}>
              {practicasCount} {practicasCount === 1 ? 'práctica' : 'prácticas'} agregada{practicasCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {valoresConvenio && (
          <div className={styles.badges}>
            <span className={`${styles.badge} ${styles.badgeGreen}`}>Gasto Rx: {money(valoresConvenio.gastoRx)}</span>
            <span className={`${styles.badge} ${styles.badgeBlue}`}>Galeno Rx: {money(valoresConvenio.galenoRx)}</span>
            <span className={`${styles.badge} ${styles.badgePurple}`}>Gasto Op: {money(valoresConvenio.gastoOperatorio)}</span>
            <span className={`${styles.badge} ${styles.badgeOrange}`}>Galeno Quir: {money(valoresConvenio.galenoQuir)}</span>
          </div>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando prácticas...</div>
      ) : modoBusqueda ? (
        <>
          <div className={styles.searchContainer}>
            <input
              type="text"
              className={styles.input}
              placeholder="Buscar código o descripción…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
            />
            {practicasCount > 0 && (
              <div className={styles.agregadasInfo}>
                <span className={styles.agregadasIcon}>📋</span>
                Tienes {practicasCount} práctica{practicasCount !== 1 ? 's' : ''} en la factura
              </div>
            )}
          </div>

          <div className={styles.buscadorInfo}>
            {resultadosGlobales.length} prácticas encontradas {query && `para "${query}"`}
          </div>

          {/* Vista mobile */}
          <div className={styles.mobileList}>
            {resultadosGlobales.length === 0 ? (
              <div className={styles.noResults}>
                {query ? `No hay resultados para "${query}"` : 'Ingrese un término de búsqueda'}
              </div>
            ) : (
              resultadosGlobales.map((item) => renderItem(item, true))
            )}
          </div>

          {/* Vista desktop (tabla) */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Capítulo</th>
                  <th className={styles.numeric}>Honorario</th>
                  <th className={styles.numeric}>Gasto</th>
                  <th>Agregar</th>
                </tr>
              </thead>
              <tbody>
                {resultadosGlobales.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.noResultsCell}>
                      {query ? `No hay resultados para "${query}"` : 'Ingrese un término de búsqueda'}
                    </td>
                  </tr>
                ) : (
                  resultadosGlobales.map((item) => renderItem(item, false))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        /* Modo capítulos (simplificado, funcionalidad similar) */
        <>
          <input
            type="text"
            className={styles.input}
            placeholder="Buscar capítulo…"
            value={filtroCapitulo}
            onChange={(e) => setFiltroCapitulo(e.target.value)}
            autoComplete="off"
          />
          {capitulos
            .filter((c) => {
              if (!filtroCapitulo) return true;
              const q = filtroCapitulo.toLowerCase();
              return (
                String(c.descripcion ?? '').toLowerCase().includes(q) ||
                String(c.capitulo ?? '').includes(filtroCapitulo)
              );
            })
            .map((c) => {
              const practicasDelCapitulo = data.filter((p) => p.capitulo === c.capitulo);
              const qLocal = capituloQueries[c.capitulo] || '';
              const qLocalNorm = normalize(qLocal);
              const filtradas =
                qLocal.trim().length === 0
                  ? practicasDelCapitulo
                  : practicasDelCapitulo.filter((p) =>
                      normalize(`${p.codigo} ${p.descripcion}`).includes(qLocalNorm)
                    );

              return (
                <details key={String(c.capitulo)} className={styles.accordion}>
                  <summary className={styles.accordionHeader}>
                    {c.capitulo} — {c.descripcion} ({filtradas.length})
                  </summary>
                  <div className={styles.accordionBody}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder={`Buscar en ${c.descripcion}…`}
                      value={qLocal}
                      onChange={(e) =>
                        setCapituloQueries((prev) => ({
                          ...prev,
                          [c.capitulo]: e.target.value
                        }))
                      }
                    />
                    <div className={styles.mobileList}>
                      {filtradas.length === 0 ? (
                        <div className={styles.noResults}>Sin resultados en este capítulo.</div>
                      ) : (
                        filtradas.map((item, j) => {
                          const key = `${String(c.capitulo).trim()}|${String(item.codigo).trim()}#${j + 1}`;
                          const itemWithKey = { ...item, __key: key };
                          return renderItem(itemWithKey, true, qLocal);
                        })
                      )}
                    </div>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th className={styles.numeric}>Honorario</th>
                            <th className={styles.numeric}>Gasto</th>
                            <th>Agregar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtradas.length === 0 ? (
                            <tr>
                              <td colSpan={5} className={styles.noResultsCell}>
                                Sin resultados en este capítulo.
                              </td>
                            </tr>
                          ) : (
                            filtradas.map((item, j) => {
                              const key = `${String(c.capitulo).trim()}|${String(item.codigo).trim()}#${j + 1}`;
                              const itemWithKey = { ...item, __key: key };
                              return renderItem(itemWithKey, false, qLocal);
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>
              );
            })}
        </>
      )}

      <div className={styles.botonesNavegacion}>
        <button className={styles.btnAtras} onClick={onAtras}>
          ← Atrás
        </button>
        <button className={styles.btnSiguiente} onClick={onSiguiente}>
          Siguiente → Laboratorios
        </button>
      </div>
    </div>
  );
}
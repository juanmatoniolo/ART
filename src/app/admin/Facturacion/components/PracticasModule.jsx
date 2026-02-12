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

  // ✅ Nuevo: selector de desglose al agregar
  const [addHon, setAddHon] = useState(true); // Dr
  const [addGas, setAddGas] = useState(true); // Clínica

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [lastAddedGroupId, setLastAddedGroupId] = useState(null);
  const tooltipTimeoutRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    fetch('/archivos/NomecladorNacional.json')
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;

        setCapitulos(json);

        const counts = new Map();
        const flat = json.flatMap((c) =>
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
              __key: `${base}#${n}`
            };
          })
        );

        setData(flat);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const fuseGlobal = useMemo(() => {
    if (!data.length) return null;
    return new Fuse(data, {
      keys: ['descripcion', 'codigo', 'capitulo', 'capituloNombre'],
      threshold: 0.18,
      ignoreLocation: true,
      minMatchCharLength: 2
    });
  }, [data]);

  const resultadosGlobales = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    const exact = data.filter(
      (it) =>
        String(it.codigo).toLowerCase() === q.toLowerCase() ||
        normalize(it.descripcion).includes(normalize(q))
    );

    let results = [];
    if (exact.length > 0) {
      exact.forEach((it) => results.push(...vincularSubsiguientes(it, data)));
    } else if (fuseGlobal) {
      fuseGlobal.search(q).forEach((r) => results.push(...vincularSubsiguientes(r.item, data)));
    }

    const unique = Array.from(
      new Map(results.map((it) => [it.__key || `${it.capitulo}|${it.codigo}`, it])).values()
    );

    return unique.sort((a, b) => (isRadiografia(a) ? 0 : 1) - (isRadiografia(b) ? 0 : 1));
  }, [query, data, fuseGlobal]);

  const showTooltipMessage = useCallback((message, groupId) => {
    clearTimeout(tooltipTimeoutRef.current);
    setTooltipMessage(message);
    setLastAddedGroupId(groupId);
    setShowTooltip(true);
    tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(false), 3000);
  }, []);

  useEffect(() => () => clearTimeout(tooltipTimeoutRef.current), []);

  // Valores base (QGal / GTO) para mostrar arriba del precio
  const getBaseRates = useCallback(
    (practica) => {
      const qgal = parseNumber(practica.qgal || practica.q_gal || 0);
      const gto = parseNumber(practica.gto || 0);
      return { qgal, gto };
    },
    []
  );

  // ✅ Agregar práctica desglosada (Dr / Clínica) según checkboxes
  const handleAgregar = useCallback(
    (practica) => {
      if (!valoresConvenio) return alert('No hay valores de convenio disponibles');

      if (!addHon && !addGas) {
        alert('Seleccioná al menos Honorario (Dr) o Gasto (Clínica).');
        return;
      }

      const calculo = calcularPractica(practica, valoresConvenio);

      const groupId = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const baseId = `pract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      const baseCommon = {
        ...practica,
        ...calculo,
        cantidad: 1,
        esRX: isRadiografia(practica),
        esSubsiguiente: isSubsiguiente(practica),
        groupId
      };

      // Dr = honorario (si corresponde)
      if (addHon) {
        const hon = Number(calculo.honorarioMedico || 0);
        const itemDr = {
          id: `${baseId}-dr`,
          ...baseCommon,
          destinoTipo: 'Dr',
          destinoNombre: '', // editable luego
          honorarioMedico: hon,
          gastoSanatorial: 0,
          total: hon
        };
        agregarPractica(itemDr);
      }

      // Clínica = gasto (si corresponde)
      if (addGas) {
        const gas = Number(calculo.gastoSanatorial || 0);
        const itemClin = {
          id: `${baseId}-clin`,
          ...baseCommon,
          destinoTipo: 'Clinica',
          destinoNombre: '', // editable luego
          honorarioMedico: 0,
          gastoSanatorial: gas,
          total: gas
        };
        agregarPractica(itemClin);
      }

      showTooltipMessage(`✓ "${String(practica.descripcion).slice(0, 50)}..." agregada`, groupId);
    },
    [valoresConvenio, addHon, addGas, agregarPractica, showTooltipMessage]
  );

  const renderItem = (item, isMobile = false, queryLocal = '') => {
    const key = item.__key || `${item.capitulo}|${item.codigo}`;
    const esRX = isRadiografia(item);
    const esSubs = isSubsiguiente(item);

    const calculo = valoresConvenio
      ? calcularPractica(item, valoresConvenio)
      : { honorarioMedico: 0, gastoSanatorial: 0, total: 0 };

    const base = getBaseRates(item);
    const q = queryLocal || query;

    // “reciente” por groupId
    const isRecent = lastAddedGroupId && item.groupId === lastAddedGroupId;

    if (isMobile) {
      return (
        <article
          key={key}
          className={`${styles.card} ${esRX ? styles.rxCard : ''} ${esSubs ? styles.subsiguienteCard : ''} ${isRecent ? styles.recentlyAdded : ''
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
              <div className={styles.baseLine}>{money(base.qgal)}</div>
              <span className={styles.costValue}>{money(calculo.honorarioMedico)}</span>
            </div>

            <div className={styles.costBox}>
              <span className={styles.costLabel}>Gasto</span>
              <div className={styles.baseLine}>{money(base.gto)}</div>
              <span className={styles.costValue}>{money(calculo.gastoSanatorial)}</span>
            </div>
          </div>

          <div className={styles.cardActions}>
            <button
              onClick={() => handleAgregar(item)}
              className={styles.btnAgregar}
              title="Agregar a factura"
            >
              ➕ Agregar
            </button>
          </div>
        </article>
      );
    }

    return (
      <tr key={key} className={`${esRX ? styles.rxRow : ''} ${esSubs ? styles.subsiguienteRow : ''} ${isRecent ? styles.recentlyAddedRow : ''}`}>
        <td className={styles.codeCell}>{highlight(item.codigo, q)}</td>
        <td className={styles.descCell}>{highlight(item.descripcion, q)}</td>
        <td className={styles.capCell}>
          <span className={styles.capBadge}>
            {item.capitulo} – {item.capituloNombre}
          </span>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.baseLine}>{money(base.qgal)}</div>
          <div className={styles.valueBig}>{money(calculo.honorarioMedico)}</div>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.baseLine}>{money(base.gto)}</div>
          <div className={styles.valueBig}>{money(calculo.gastoSanatorial)}</div>
        </td>

        <td className={styles.actionCell}>
          <button onClick={() => handleAgregar(item)} className={styles.btnAgregarTabla} title="Agregar a factura">
            +
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

          <span className={styles.counterBadge}>
            {practicasCount} {practicasCount === 1 ? 'práctica' : 'prácticas'} agregada{practicasCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* ✅ Nuevo: selector Dr/Clínica al agregar */}
        <div className={styles.addSplitRow}>
          <span className={styles.addSplitLabel}>Al agregar:</span>

          <label className={styles.chk}>
            <input type="checkbox" checked={addHon} onChange={(e) => setAddHon(e.target.checked)} />
            Honorario (Dr)
          </label>

          <label className={styles.chk}>
            <input type="checkbox" checked={addGas} onChange={(e) => setAddGas(e.target.checked)} />
            Gasto (Clínica)
          </label>

          <span className={styles.addSplitHint}>
            (Por defecto agrega 2 ítems: Dr + Clínica)
          </span>
        </div>
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
          </div>

          <div className={styles.buscadorInfo}>
            {resultadosGlobales.length} prácticas encontradas {query && `para "${query}"`}
          </div>

          <div className={styles.mobileList}>
            {resultadosGlobales.length === 0 ? (
              <div className={styles.noResults}>
                {query ? `No hay resultados para "${query}"` : 'Ingrese un término de búsqueda'}
              </div>
            ) : (
              resultadosGlobales.map((item) => renderItem(item, true))
            )}
          </div>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.thCode}>Código</th>
                  <th className={styles.thDesc}>Descripción</th>
                  <th className={styles.thCap}>Capítulo</th>
                  <th className={styles.thNum}>Honorario</th>
                  <th className={styles.thNum}>Gasto</th>
                  <th className={styles.thAction}>Agregar</th>
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
              return String(c.descripcion ?? '').toLowerCase().includes(q) || String(c.capitulo ?? '').includes(filtroCapitulo);
            })
            .map((c) => {
              const practicasDelCapitulo = data.filter((p) => p.capitulo === c.capitulo);
              const qLocal = capituloQueries[c.capitulo] || '';
              const qLocalNorm = normalize(qLocal);

              const filtradas =
                qLocal.trim().length === 0
                  ? practicasDelCapitulo
                  : practicasDelCapitulo.filter((p) => normalize(`${p.codigo} ${p.descripcion}`).includes(qLocalNorm));

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
                      onChange={(e) => setCapituloQueries((prev) => ({ ...prev, [c.capitulo]: e.target.value }))}
                    />

                    <div className={styles.mobileList}>
                      {filtradas.length === 0 ? (
                        <div className={styles.noResults}>Sin resultados en este capítulo.</div>
                      ) : (
                        filtradas.map((item, j) => {
                          const k = `${String(c.capitulo).trim()}|${String(item.codigo).trim()}#${j + 1}`;
                          return renderItem({ ...item, __key: k }, true, qLocal);
                        })
                      )}
                    </div>

                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th className={styles.thCode}>Código</th>
                            <th className={styles.thDesc}>Descripción</th>
                            <th className={styles.thNum}>Honorario</th>
                            <th className={styles.thNum}>Gasto</th>
                            <th className={styles.thAction}>Agregar</th>
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
                              const k = `${String(c.capitulo).trim()}|${String(item.codigo).trim()}#${j + 1}`;
                              return renderItem({ ...item, __key: k }, false, qLocal);
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
        <button className={styles.btnAtras} onClick={onAtras}>← Atrás</button>
        <button className={styles.btnSiguiente} onClick={onSiguiente}>Siguiente → Laboratorios</button>
      </div>
    </div>
  );
}

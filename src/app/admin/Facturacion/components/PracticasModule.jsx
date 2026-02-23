'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { useConvenio } from './ConvenioContext';
import { useDebounce } from '@/hooks/useDebounce';
import {
  normalize,
  money,
  isRadiografia,
  isSubsiguiente,
  vincularSubsiguientes,
  highlight,
  calcularPractica
} from '../utils/calculos';
import styles from './practicas.module.css';

const DEFAULT_CODES = [
  '42.01.01',
  '43.02.01',
  '34.02.13',
  '13.01.10',
  '34.02.013',
  '43.01.01',
  '43.10.01',
  '43.11.01',
];

const normCode = (c) => String(c ?? '').replace(/\D/g, '');

// Función auxiliar para calcular items personalizados (especiales)
const calcularItemPersonalizado = (item, valoresConvenio) => {
  if (!valoresConvenio || item.meta?.kind !== 'especial') {
    return { honorarioMedico: 0, gastoSanatorial: 0, soloHonorario: false, soloGasto: false };
  }
  const baseKey = item.meta.baseKey;
  const valorBase = Number(valoresConvenio[baseKey]) || 0;
  return {
    honorarioMedico: valorBase,
    gastoSanatorial: 0,
    soloHonorario: true,
    soloGasto: false
  };
};

export default function PracticasModule({ practicasAgregadas, agregarPractica, onAtras, onSiguiente }) {
  const { valoresConvenio } = useConvenio();

  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const [modoBusqueda, setModoBusqueda] = useState(true);

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [lastAddedGroupId, setLastAddedGroupId] = useState(null);
  const tooltipTimeoutRef = useRef(null);

  // Cargar nomenclador nacional
  useEffect(() => {
    let mounted = true;
    fetch('/archivos/NomecladorNacional.json')
      .then(res => res.json())
      .then(json => {
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
      .catch(err => {
        console.error('Error cargando nomenclador nacional:', err);
        setLoading(false);
      });

    return () => { mounted = false; };
  }, []);

  const fuse = useMemo(() => {
    if (!data.length) return null;
    return new Fuse(data, {
      keys: ['descripcion', 'codigo', 'capituloNombre'],
      threshold: 0.25,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [data]);

  const showTooltipMessage = useCallback((msg, groupId) => {
    clearTimeout(tooltipTimeoutRef.current);
    setTooltipMessage(msg);
    setLastAddedGroupId(groupId);
    setShowTooltip(true);
    tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(false), 2500);
  }, []);

  useEffect(() => () => clearTimeout(tooltipTimeoutRef.current), []);

  const handleAgregar = useCallback((practica) => {
    if (!valoresConvenio) return alert('No hay valores de convenio disponibles');

    // Determinar si es personalizado
    const esPersonalizado = practica.meta?.kind === 'especial';
    let calculo;
    if (esPersonalizado) {
      const valorBase = Number(valoresConvenio[practica.meta.baseKey]) || 0;
      calculo = {
        honorarioMedico: valorBase,
        gastoSanatorial: 0,
        soloHonorario: true,
        soloGasto: false
      };
    } else {
      calculo = calcularPractica(practica, valoresConvenio);
    }

    const groupId = `pract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const baseId = `pract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const baseCommon = {
      ...practica,
      ...calculo,
      cantidad: 1,
      esRX: isRadiografia(practica),
      esSubsiguiente: isSubsiguiente(practica),
      groupId
    };

    const agregados = [];

    if (!calculo.soloGasto) {
      agregados.push({
        id: `${baseId}-dr`,
        ...baseCommon,
        prestadorTipo: 'Dr',
        prestadorNombre: '',
        honorarioMedico: calculo.honorarioMedico,
        gastoSanatorial: 0,
        total: calculo.honorarioMedico
      });
    }

    if (!calculo.soloHonorario) {
      agregados.push({
        id: `${baseId}-clin`,
        ...baseCommon,
        prestadorTipo: 'Clinica',
        prestadorNombre: 'Clínica de la Unión',
        honorarioMedico: 0,
        gastoSanatorial: calculo.gastoSanatorial,
        total: calculo.gastoSanatorial
      });
    }

    agregados.forEach(item => agregarPractica(item));
    showTooltipMessage(`✓ "${String(practica.descripcion).slice(0, 50)}..." agregada`, groupId);
  }, [valoresConvenio, agregarPractica, showTooltipMessage]);

  // Resultados rápidos (cuando query vacío)
  const defaultResultados = useMemo(() => {
    if (!data.length) return [];

    // 1. Items del nomenclador según DEFAULT_CODES
    const wanted = DEFAULT_CODES.map(normCode);
    const picked = [];

    for (const w of wanted) {
      const found = data.find((it) => normCode(it.codigo) === w);
      if (!found) continue;
      picked.push(...vincularSubsiguientes(found, data));
    }

    // 2. Items personalizados (ECG y Ecografía) si el convenio tiene los valores
    if (valoresConvenio) {
      // ECG
      if (valoresConvenio['ECG_Y_EX_EN_CV']) {
        picked.push({
          codigo: '17.01.01',
          descripcion: 'ECG',
          capitulo: '17',
          capituloNombre: 'Cardiología',
          q_gal: 0,
          gto: 0,
          meta: {
            kind: 'especial',
            baseKey: 'ECG_Y_EX_EN_CV'
          },
          __key: 'custom-ecg'
        });
      }
      // Ecografía partes blandas
      if (valoresConvenio['Ecografia_partes_blandas_no_moduladas']) {
        picked.push({
          codigo: '18.06.01',
          descripcion: 'Ecografía partes blandas',
          capitulo: '18',
          capituloNombre: 'Ecografías',
          q_gal: 0,
          gto: 0,
          meta: {
            kind: 'especial',
            baseKey: 'Ecografia_partes_blandas_no_moduladas'
          },
          __key: 'custom-eco'
        });
      }
    }

    // Eliminar duplicados por __key
    const seen = new Map();
    picked.forEach((it) => {
      const key = it.__key || `${it.capitulo}|${it.codigo}`;
      if (!seen.has(key)) seen.set(key, it);
    });

    return Array.from(seen.values());
  }, [data, valoresConvenio]);

  /**
   * Resultados normales de búsqueda
   */
  const resultadosBusqueda = useMemo(() => {
    const q = debouncedQuery.trim();
    if (!q) return [];

    const exact = data.filter(
      it =>
        String(it.codigo).toLowerCase() === q.toLowerCase() ||
        normalize(it.descripcion).includes(normalize(q))
    );

    let results = [];
    if (exact.length > 0) {
      exact.forEach(it => {
        results.push(...vincularSubsiguientes(it, data));
      });
    } else if (fuse) {
      fuse.search(q).forEach(r => {
        results.push(...vincularSubsiguientes(r.item, data));
      });
    }

    const seen = new Map();
    results.forEach(it => {
      const key = it.__key || `${it.capitulo}|${it.codigo}`;
      if (!seen.has(key)) seen.set(key, it);
    });

    return Array.from(seen.values());
  }, [debouncedQuery, data, fuse]);

  // ✅ si query vacío => usar defaultResultados, si no => resultadosBusqueda
  const resultados = useMemo(() => {
    return debouncedQuery.trim() === '' ? defaultResultados : resultadosBusqueda;
  }, [debouncedQuery, defaultResultados, resultadosBusqueda]);

  const renderItem = (item, isMobile = false, qLocal = '') => {
    const key = item.__key || `${item.capitulo}|${item.codigo}`;
    const esRX = isRadiografia(item);
    const esSubs = isSubsiguiente(item);

    // Calcular según tipo
    let calculo;
    if (item.meta?.kind === 'especial') {
      const valorBase = Number(valoresConvenio?.[item.meta.baseKey]) || 0;
      calculo = {
        honorarioMedico: valorBase,
        gastoSanatorial: 0
      };
    } else {
      calculo = valoresConvenio
        ? calcularPractica(item, valoresConvenio)
        : { honorarioMedico: 0, gastoSanatorial: 0 };
    }

    const isRecent = lastAddedGroupId && item.groupId === lastAddedGroupId;
    const q = qLocal || query;

    if (isMobile) {
      return (
        <article
          key={key}
          className={`${styles.card} ${esRX ? styles.rxCard : ''} ${esSubs ? styles.subsiguienteCard : ''} ${isRecent ? styles.recentlyAdded : ''}`}
        >
          <div className={styles.cardTop}>
            <div className={styles.code}>{highlight(item.codigo, q)}</div>
            <span className={styles.capBadge}>{item.capitulo} – {item.capituloNombre}</span>
          </div>

          <div className={styles.desc}>{highlight(item.descripcion, q)}</div>

          <div className={styles.costGrid}>
            <div className={styles.costBox}>
              <span className={styles.costLabel}>Honorario</span>
              <div className={styles.baseLine}>{money(item.q_gal || 0)}</div>
              <span className={styles.costValue}>{money(calculo.honorarioMedico)}</span>
            </div>

            <div className={styles.costBox}>
              <span className={styles.costLabel}>Gasto</span>
              <div className={styles.baseLine}>{money(item.gto || 0)}</div>
              <span className={styles.costValue}>{money(calculo.gastoSanatorial)}</span>
            </div>
          </div>

          <div className={styles.cardActions}>
            <button onClick={() => handleAgregar(item)} className={styles.btnAgregar}>➕ Agregar</button>
          </div>
        </article>
      );
    }

    return (
      <tr
        key={key}
        className={`${esRX ? styles.rxRow : ''} ${esSubs ? styles.subsiguienteRow : ''} ${isRecent ? styles.recentlyAddedRow : ''}`}
      >
        <td className={styles.codeCell}>{highlight(item.codigo, q)}</td>
        <td className={styles.descCell}>{highlight(item.descripcion, q)}</td>
        <td className={styles.capCell}>
          <span className={styles.capBadge}>{item.capitulo} – {item.capituloNombre}</span>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.baseLine}>
            <span className={styles.miniLabel}>Gal:</span> {money(item.q_gal || 0)}
          </div>
          <div className={styles.valueBig}>{money(calculo.honorarioMedico)}</div>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.baseLine}>{money(item.gto || 0)}</div>
          <div className={styles.valueBig}>{money(calculo.gastoSanatorial)}</div>
        </td>

        <td className={styles.actionCell}>
          <button onClick={() => handleAgregar(item)} className={styles.btnAgregarTabla}>+</button>
        </td>
      </tr>
    );
  };

  const practicasCount = practicasAgregadas.length;
  const qTrim = debouncedQuery.trim();

  return (
    <div className={styles.tabContent}>
      <h2>🏥 Prácticas Médicas</h2>

      {showTooltip && (
        <div className={styles.tooltip}>
          <div className={styles.tooltipContent}>
            <span className={styles.tooltipIcon}>✓</span>{tooltipMessage}
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button className={styles.switchButton} onClick={() => setModoBusqueda(p => !p)}>
            {modoBusqueda ? '📂 Ver por capítulos' : '🔍 Modo búsqueda global'}
          </button>

          <span className={styles.counterBadge}>
            {practicasCount} {practicasCount === 1 ? 'práctica' : 'prácticas'} agregada{practicasCount !== 1 ? 's' : ''}
          </span>
        </div>

        <div className={styles.addSplitRow}>
          <span className={styles.addSplitLabel}>Al agregar se generan:</span>
          <span className={styles.addSplitHint}>
            👨‍⚕️ Honorario (Dr) + 🏥 Gasto (Clínica de la Unión) <small>(según corresponda)</small>
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
            {qTrim === ''
              ? `${resultados.length} accesos rápidos`
              : `${resultados.length} prácticas encontradas para "${qTrim}"`
            }
          </div>

          <div className={styles.mobileList}>
            {resultados.length === 0 ? (
              <div className={styles.noResults}>
                {qTrim === '' ? 'No se encontraron accesos rápidos.' : `No hay resultados para "${qTrim}"`}
              </div>
            ) : (
              resultados.map(item => renderItem(item, true))
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
                {resultados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.noResultsCell}>
                      {qTrim === '' ? 'No se encontraron accesos rápidos.' : `No hay resultados para "${qTrim}"`}
                    </td>
                  </tr>
                ) : (
                  resultados.map(item => renderItem(item, false))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div>Modo capítulos (implementar según código previo)</div>
      )}

      <div className={styles.botonesNavegacion}>
        <button className={styles.btnAtras} onClick={onAtras}>← Atrás</button>
        <button className={styles.btnSiguiente} onClick={onSiguiente}>Siguiente → Cirugías</button>
      </div>
    </div>
  );
}
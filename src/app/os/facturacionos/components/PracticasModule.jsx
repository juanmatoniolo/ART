'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import Fuse from 'fuse.js';
import { useConvenio } from './ConvenioContext';
import { useDebounce } from '@/hooks/useDebounce';
import {
  normalize, money, isRadiografia, isSubsiguiente,
  vincularSubsiguientes, highlight, calcularPractica
} from '../utils/calculos';
import styles from './practicas.module.css';

const normCode = (c) => String(c ?? '').replace(/\D/g, '');

const normalizeKey = (k) =>
  String(k ?? '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-\.]+/g, '_')
    .replace(/[^\w]/g, '');

const isEcografia = (practica) => {
  if (practica?.meta?.kind === 'especial') return false;
  return String(practica?.capitulo ?? '') === '18';
};

export default function PracticasModule({ practicasAgregadas, agregarPractica, onAtras, onSiguiente }) {
  const {
    valoresConvenio,
    convenioData,
    practicasIncluidas,
  } = useConvenio();

  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const [modoBusqueda, setModoBusqueda] = useState(true);

  const [artroscopiaSelections, setArtroscopiaSelections] = useState({});
  const [ecgSelections, setEcgSelections] = useState({});

  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipMessage, setTooltipMessage] = useState('');
  const [lastAddedGroupId, setLastAddedGroupId] = useState(null);
  const tooltipTimeoutRef = useRef(null);

  /* ---------- Lectura flexible de valoresConvenio ---------- */
  const getVal = useCallback((...keys) => {
    if (!valoresConvenio) return 0;
    for (const k of keys) {
      if (k == null) continue;
      if (valoresConvenio[k] != null && valoresConvenio[k] !== '') {
        const n = Number(valoresConvenio[k]);
        if (Number.isFinite(n)) return n;
      }
      const norm = normalizeKey(k);
      if (valoresConvenio[norm] != null && valoresConvenio[norm] !== '') {
        const n = Number(valoresConvenio[norm]);
        if (Number.isFinite(n)) return n;
      }
    }
    return 0;
  }, [valoresConvenio]);

  /* ============================================================
   *  Carga del nomenclador
   * ============================================================ */
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
        console.error('Error cargando nomenclador:', err);
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

  /* ============================================================
   *  Prácticas incluidas (vienen del contexto, ya normalizadas)
   * ============================================================ */
  const incluidas = useMemo(
    () => (Array.isArray(practicasIncluidas) ? practicasIncluidas : []),
    [practicasIncluidas]
  );

  const incluidasMap = useMemo(() => {
    const m = new Map();
    for (const it of incluidas) m.set(normCode(it.codigo), it);
    return m;
  }, [incluidas]);

  /* ============================================================
   *  Tooltip
   * ============================================================ */
  const showTooltipMessage = useCallback((msg, groupId) => {
    clearTimeout(tooltipTimeoutRef.current);
    setTooltipMessage(msg);
    setLastAddedGroupId(groupId);
    setShowTooltip(true);
    tooltipTimeoutRef.current = setTimeout(() => setShowTooltip(false), 2500);
  }, []);

  useEffect(() => () => clearTimeout(tooltipTimeoutRef.current), []);

  const handleArtroscopiaChange = (key, tipo) =>
    setArtroscopiaSelections(prev => ({ ...prev, [key]: tipo }));
  const handleEcgChange = (key, tipo) =>
    setEcgSelections(prev => ({ ...prev, [key]: tipo }));

  /* ============================================================
   *  CÁLCULO
   * ============================================================ */
  const getCalculo = useCallback((practica) => {
    // (1)(2)(3) — Práctica incluida con valor propio o por código
    if (practica?.__incluida) {
      const inc = practica.__incluida;

      let gasto = Number(inc.gastos) || 0;
      if (gasto === 0) {
        // FIX: probamos el código tal cual, el código normalizado y con
        // prefijo "incluida-" por si el convenio guarda la clave así.
        gasto = getVal(inc.codigo, normCode(inc.codigo));
      }

      const hono = Number(inc.honorarios) || 0;

      if (gasto > 0 || hono > 0) {
        return {
          honorarioMedico: hono,
          gastoSanatorial: gasto,
          soloHonorario: gasto === 0 && hono > 0,
          soloGasto:     hono === 0 && gasto > 0,
        };
      }
    }

    if (!valoresConvenio) {
      return { honorarioMedico: 0, gastoSanatorial: 0, soloHonorario: false, soloGasto: false };
    }

    // FKT
    if (practica.codigo === 'FKT') {
      const v = getVal('FKT');
      return { honorarioMedico: v, gastoSanatorial: 0, soloHonorario: true, soloGasto: false };
    }
    if (practica.codigo === 'FKT_+_MGT') {
      const v = getVal('FKT_+_MGT', 'FKT + MGT');
      return { honorarioMedico: v, gastoSanatorial: 0, soloHonorario: true, soloGasto: false };
    }

    // ECG
    if (practica.codigo === '17.01.01') {
      const v = getVal('ECG_Y_EX_EN_CV', 'ECG Y EX EN CV', 'ecg');
      const tipo = ecgSelections[practica.__key] || 'profesional';
      if (tipo === 'profesional') {
        return { honorarioMedico: v, gastoSanatorial: 0, soloHonorario: true, soloGasto: false };
      }
      return { honorarioMedico: 0, gastoSanatorial: v, soloHonorario: false, soloGasto: true };
    }

    // DIA PISO / INTERNACIÓN
    if (practica.codigo === '43.01.01' || practica.codigo === '43.10.01' || practica.codigo === '43.11.01') {
      const v = getVal(
        'DIA_DE_PENSION-INTERNACION_PISO', 'DIA_DE_PENSION_INTERNACION_PISO',
        'UNIDAD DE PENSION', 'Pension', 'Unidad_Pension', 'unidadPension'
      );
      return { honorarioMedico: 0, gastoSanatorial: v, soloHonorario: false, soloGasto: true };
    }

    // DIA UTI
    if (practica.codigo === '400101') {
      const v = getVal('DIA_UTI_(_G+H)', 'DIA_UTI', 'DIA UTI (G + H)');
      return { honorarioMedico: 0, gastoSanatorial: v, soloHonorario: false, soloGasto: true };
    }

    // MOD 02 (oxígeno)
    if (practica.codigo === '431107' || practica.codigo === 'MOD 02' || practica.codigo === 'MOD02') {
      const v = getVal('MODULO_OXIGENO', 'MODULO OXIGENO', 'Modulo_Oxigeno');
      return { honorarioMedico: 0, gastoSanatorial: v, soloHonorario: false, soloGasto: true };
    }

    // MOD8
    if (practica.codigo === 'MOD8') {
      const v = getVal(
        'GASTOS_ARTROSCOPIA_COMPLEJA_COMPLEJIDAD_8',
        'GASTOS ARTROSCOPIA COMPLEJA COMPLEJIDAD 8',
        'Gastos_Artroscopia_Compleja'
      );
      return { honorarioMedico: 0, gastoSanatorial: v, soloHonorario: false, soloGasto: true };
    }

    // Artroscopía 120902
    if (practica.codigo === '120902') {
      const tipo = artroscopiaSelections[practica.__key] || 'simple';
      let keys;
      if (tipo === 'simple') keys = ['Artroscopia_Simple_Gastos_Sanatoriales', 'artroscopiaSimple'];
      else if (tipo === 'ligamento') keys = ['Lig_Cruzado_Gastos_Sanatoriales', 'ligCruzado'];
      else keys = ['Artroscopia_Hombro', 'artroscopiaHombro'];
      const v = getVal(...keys);
      return { honorarioMedico: 0, gastoSanatorial: v, soloHonorario: false, soloGasto: true };
    }

    // Capítulo 12 — cirugía general
    if (String(practica.capitulo) === '12') {
      const gastoOp = getVal('Gasto_Operatorio', 'GASTO QUIRURGICO', 'Gasto_Quirurgico', 'gastoQuirurgico');
      const galenoQ = getVal('Galeno_Quir', 'GALENO QUIR', 'unidadesHonorarioPractica');
      const honorario = galenoQ * (practica.q_gal || 0);
      const gasto = gastoOp * (practica.gto || 0);
      return { honorarioMedico: honorario, gastoSanatorial: gasto, soloHonorario: false, soloGasto: false };
    }

    // Radiografías (cap 34)
    if (
      String(practica.capitulo) === '34' ||
      (practica.capituloNombre || '').toLowerCase().includes('radiolog')
    ) {
      const galenoRx = getVal('Galeno_Rx_Practica', 'GALENO RX PRACTICA', 'unidadesHonorarioBioq');
      const gastoRx = getVal('Gasto_Rx', 'GASTOS RX', 'GASTO RX', 'Gastos_Rx', 'Gasto Rx', 'gastosRx');
      const honorario = (galenoRx * (practica.q_gal || 0)) + ((gastoRx * (practica.gto || 0)) / 2);
      const gasto = ((gastoRx * (practica.gto || 0)) / 2);
      return { honorarioMedico: honorario, gastoSanatorial: gasto, soloHonorario: false, soloGasto: false };
    }

    // Ecografías
    if (isEcografia(practica)) {
      const galenoRx = getVal('Galeno_Rx_Practica', 'GALENO RX PRACTICA', 'unidadesHonorarioBioq');
      const gastoRx = getVal('Gasto_Rx', 'GASTOS RX', 'GASTO RX', 'Gastos_Rx', 'Gasto Rx', 'gastosRx');
      return {
        honorarioMedico: galenoRx * (practica.q_gal || 0),
        gastoSanatorial: gastoRx * (practica.gto || 0),
        soloHonorario: false,
        soloGasto: false,
      };
    }

    // meta especial
    if (practica.meta?.kind === 'especial') {
      const v = getVal(practica.meta.baseKey);
      return { honorarioMedico: v, gastoSanatorial: 0, soloHonorario: true, soloGasto: false };
    }

    return calcularPractica(practica, valoresConvenio);
  }, [valoresConvenio, getVal, artroscopiaSelections, ecgSelections]);

  /* ============================================================
   *  AGREGAR
   * ============================================================ */
  const handleAgregar = useCallback((practica) => {
    if (!valoresConvenio) return alert('No hay valores de convenio disponibles');

    const calculo = getCalculo(practica);
    const esEco = isEcografia(practica);

    let tipoArtroscopia = null;
    if (practica.codigo === '120902') {
      tipoArtroscopia = artroscopiaSelections[practica.__key] || 'simple';
    }

    const groupId = `pract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const baseId  = `pract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const baseCommon = {
      ...practica,
      ...calculo,
      cantidad: 1,
      esRX: isRadiografia(practica),
      esSubsiguiente: isSubsiguiente(practica),
      groupId,
    };

    const agregados = [];

    if (esEco) {
      const totalMedico = calculo.honorarioMedico + calculo.gastoSanatorial;
      agregados.push({
        id: `${baseId}-med`,
        ...baseCommon,
        prestadorTipo: 'Médico',
        prestadorNombre: '',
        honorarioMedico: totalMedico,
        gastoSanatorial: 0,
        total: totalMedico,
        detalle: `Ecografía: ${money(calculo.honorarioMedico)} (Galeno) + ${money(calculo.gastoSanatorial)} (Gasto)`
      });
    } else {
      if (calculo.honorarioMedico > 0) {
        agregados.push({
          id: `${baseId}-dr`,
          ...baseCommon,
          prestadorTipo: 'Dr',
          prestadorNombre: '',
          honorarioMedico: calculo.honorarioMedico,
          gastoSanatorial: 0,
          total: calculo.honorarioMedico,
        });
      }
      if (calculo.gastoSanatorial > 0) {
        agregados.push({
          id: `${baseId}-clin`,
          ...baseCommon,
          prestadorTipo: 'Clinica',
          prestadorNombre: 'Clínica de la Unión',
          honorarioMedico: 0,
          gastoSanatorial: calculo.gastoSanatorial,
          total: calculo.gastoSanatorial,
        });
      }
    }

    agregados.forEach(item => agregarPractica(item));

    let tipoMsg = '';
    if (practica.codigo === '120902') {
      tipoMsg = tipoArtroscopia === 'simple' ? ' (Simple)'
              : tipoArtroscopia === 'ligamento' ? ' (Ligamento cruzado)'
              : ' (Hombro)';
    } else if (practica.codigo === '17.01.01') {
      tipoMsg = ` (${ecgSelections[practica.__key] || 'profesional'})`;
    } else if (practica.codigo === 'FKT') {
      tipoMsg = ` (Kinesiología)`;
    } else if (practica.codigo === 'FKT_+_MGT') {
      tipoMsg = ` (Kinesiología + MGT)`;
    } else if (esEco) {
      tipoMsg = ` (Ecografía - todo al médico)`;
    }
    showTooltipMessage(`✓ "${String(practica.descripcion).slice(0, 50)}..."${tipoMsg} agregada`, groupId);
  }, [valoresConvenio, artroscopiaSelections, ecgSelections, agregarPractica, showTooltipMessage, getCalculo]);

  /* ============================================================
   *  RESULTADOS POR DEFECTO = PRÁCTICAS INCLUIDAS
   * ============================================================ */
  const defaultResultados = useMemo(() => {
    if (!incluidas.length) return [];

    const picked = [];

    for (const inc of incluidas) {
      const codeNorm = normCode(inc.codigo);

      const found = data.find((it) => normCode(it.codigo) === codeNorm);

      if (found) {
        const merged = {
          ...found,
          descripcion: found.descripcion || inc.descripcion,
          __incluida: inc,
          __key: `incluida-${inc.codigo}-${found.__key || ''}`,
        };
        picked.push(...vincularSubsiguientes(merged, data));
      } else {
        picked.push({
          codigo: inc.codigo,
          descripcion: inc.descripcion || inc.codigo,
          capitulo: '',
          capituloNombre: 'Práctica incluida',
          q_gal: 0,
          gto: 0,
          __key: `incluida-virtual-${inc.codigo}`,
          __incluida: inc,
        });
      }
    }

    const seen = new Map();
    picked.forEach((it) => {
      const key = it.__key || `${it.capitulo}|${it.codigo}`;
      if (!seen.has(key)) seen.set(key, it);
    });
    return Array.from(seen.values());
  }, [data, incluidas]);

  /* ============================================================
   *  BÚSQUEDA
   * ============================================================ */
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
      exact.forEach(it => results.push(...vincularSubsiguientes(it, data)));
    } else if (fuse) {
      fuse.search(q).forEach(r => results.push(...vincularSubsiguientes(r.item, data)));
    }

    results = results.map((it) => {
      const inc = incluidasMap.get(normCode(it.codigo));
      return inc ? { ...it, __incluida: inc } : it;
    });

    const seen = new Map();
    results.forEach(it => {
      const key = it.__key || `${it.capitulo}|${it.codigo}`;
      if (!seen.has(key)) seen.set(key, it);
    });
    return Array.from(seen.values());
  }, [debouncedQuery, data, fuse, incluidasMap]);

  const resultados = useMemo(
    () => (debouncedQuery.trim() === '' ? defaultResultados : resultadosBusqueda),
    [debouncedQuery, defaultResultados, resultadosBusqueda]
  );

  /* ============================================================
   *  RENDER
   * ============================================================ */
  const renderItem = (item, isMobile = false, qLocal = '') => {
    const key = item.__key || `${item.capitulo}|${item.codigo}`;
    const esRX = isRadiografia(item);
    const esSubs = isSubsiguiente(item);
    const esArtroscopia = item.codigo === '120902';
    const esECG = item.codigo === '17.01.01';
    const es400101 = item.codigo === '400101';
    const esEco18 = isEcografia(item);
    const esCapitulo12 = String(item.capitulo) === '12';
    const esIncluida = !!item.__incluida;

    const calculo = getCalculo(item);
    const isRecent = lastAddedGroupId && item.groupId === lastAddedGroupId;
    const q = qLocal || query;

    const gastoSimple    = getVal('Artroscopia_Simple_Gastos_Sanatoriales', 'artroscopiaSimple');
    const gastoLigamento = getVal('Lig_Cruzado_Gastos_Sanatoriales', 'ligCruzado');
    const gastoHombro    = getVal('Artroscopia_Hombro', 'artroscopiaHombro');

    const total = calculo.honorarioMedico + calculo.gastoSanatorial;

    if (isMobile) {
      return (
        <article
          key={key}
          className={`${styles.card} ${esRX ? styles.rxCard : ''} ${esSubs ? styles.subsiguienteCard : ''} ${isRecent ? styles.recentlyAdded : ''}`}
        >
          <div className={styles.cardTop}>
            <div className={styles.code}>{highlight(item.codigo, q)}</div>
            <span className={styles.capBadge}>
              {item.capitulo ? `${item.capitulo} – ` : ''}{item.capituloNombre}
            </span>
          </div>

          <div className={styles.desc}>{highlight(item.descripcion, q)}</div>

          {esEco18 && (
            <div className={styles.ecoBadge}>
              🩺 Todo al médico: Galeno Rx × {item.q_gal || 0} + Gasto Rx × {item.gto || 0}
            </div>
          )}

          {esCapitulo12 && !esArtroscopia && (
            <div className={styles.cap12Badge}>
              ⚙️ Cirugía: Gasto Operatorio × {item.gto || 0} = {money(calculo.gastoSanatorial)}
            </div>
          )}

          {esArtroscopia && (
            <div className={styles.artroscopiaSelector}>
              <label className={styles.radioLabel}>
                <input type="radio" name={`artro-${key}`}
                  checked={artroscopiaSelections[key] === 'simple' || !artroscopiaSelections[key]}
                  onChange={() => handleArtroscopiaChange(key, 'simple')} />
                <span className={styles.radioCustom}></span>Simple ({money(gastoSimple)})
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name={`artro-${key}`}
                  checked={artroscopiaSelections[key] === 'ligamento'}
                  onChange={() => handleArtroscopiaChange(key, 'ligamento')} />
                <span className={styles.radioCustom}></span>Ligamento ({money(gastoLigamento)})
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name={`artro-${key}`}
                  checked={artroscopiaSelections[key] === 'hombro'}
                  onChange={() => handleArtroscopiaChange(key, 'hombro')} />
                <span className={styles.radioCustom}></span>Hombro ({money(gastoHombro)})
              </label>
            </div>
          )}

          {esECG && (
            <div className={styles.ecgSelector}>
              <label className={styles.radioLabel}>
                <input type="radio" name={`ecg-${key}`}
                  checked={ecgSelections[key] === 'profesional' || !ecgSelections[key]}
                  onChange={() => handleEcgChange(key, 'profesional')} />
                <span className={styles.radioCustom}></span>
                Profesional (Dr) ({money(getVal('ECG_Y_EX_EN_CV', 'ECG Y EX EN CV', 'ecg'))})
              </label>
              <label className={styles.radioLabel}>
                <input type="radio" name={`ecg-${key}`}
                  checked={ecgSelections[key] === 'clinica'}
                  onChange={() => handleEcgChange(key, 'clinica')} />
                <span className={styles.radioCustom}></span>
                Clínica ({money(getVal('ECG_Y_EX_EN_CV', 'ECG Y EX EN CV', 'ecg'))})
              </label>
            </div>
          )}

          <div className={styles.costGrid}>
            <div className={styles.costBox}>
              <span className={styles.costLabel}>Honorario</span>
              <span className={styles.costValue}>{money(calculo.honorarioMedico)}</span>
            </div>
            <div className={styles.costBox}>
              <span className={styles.costLabel}>Gasto</span>
              <span className={styles.costValue}>{money(calculo.gastoSanatorial)}</span>
            </div>
            <div className={styles.costBox}>
              <span className={styles.costLabel}>Total</span>
              <span className={styles.costValue}>{money(total)}</span>
            </div>
          </div>

          <div className={styles.cardActions}>
            <button onClick={() => handleAgregar(item)} className={styles.btnAgregar}>
              ➕ Agregar
            </button>
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
        <td className={styles.descCell}>
          {highlight(item.descripcion, q)}
          {esArtroscopia && (
            <div className={styles.tableArtroscopiaSelector}>
              <label className={styles.radioLabelInline}>
                <input type="radio" name={`artro-tab-${key}`}
                  checked={artroscopiaSelections[key] === 'simple' || !artroscopiaSelections[key]}
                  onChange={() => handleArtroscopiaChange(key, 'simple')} />
                <span>Simple ({money(gastoSimple)})</span>
              </label>
              <label className={styles.radioLabelInline}>
                <input type="radio" name={`artro-tab-${key}`}
                  checked={artroscopiaSelections[key] === 'ligamento'}
                  onChange={() => handleArtroscopiaChange(key, 'ligamento')} />
                <span>Ligamento ({money(gastoLigamento)})</span>
              </label>
              <label className={styles.radioLabelInline}>
                <input type="radio" name={`artro-tab-${key}`}
                  checked={artroscopiaSelections[key] === 'hombro'}
                  onChange={() => handleArtroscopiaChange(key, 'hombro')} />
                <span>Hombro ({money(gastoHombro)})</span>
              </label>
            </div>
          )}
          {esECG && (
            <div className={styles.tableEcgSelector}>
              <label className={styles.radioLabelInline}>
                <input type="radio" name={`ecg-tab-${key}`}
                  checked={ecgSelections[key] === 'profesional' || !ecgSelections[key]}
                  onChange={() => handleEcgChange(key, 'profesional')} />
                <span>Profesional</span>
              </label>
              <label className={styles.radioLabelInline}>
                <input type="radio" name={`ecg-tab-${key}`}
                  checked={ecgSelections[key] === 'clinica'}
                  onChange={() => handleEcgChange(key, 'clinica')} />
                <span>Clínica</span>
              </label>
            </div>
          )}
          {esCapitulo12 && !esArtroscopia && (
            <div className={styles.cap12Note}>
              ⚙️ Gasto = G. Oper. × {item.gto || 0} = {money(calculo.gastoSanatorial)}
            </div>
          )}
        </td>
        <td className={styles.capCell}>
          <span className={styles.capBadge}>
            {item.capitulo ? `${item.capitulo} – ` : ''}{item.capituloNombre}
          </span>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.baseLine}>
            {esIncluida
              ? <span className={styles.miniLabel}>Incluida</span>
              : es400101
                ? <><span className={styles.miniLabel}>Gal:</span> {money(item.q_gal || 0)}</>
                : esCapitulo12 ? `Gal. Quir × ${item.q_gal || 0}`
                : esEco18 ? `Galeno × ${item.q_gal || 0}`
                : `Gal: ${money(item.q_gal || 0)}`}
          </div>
          <div className={styles.valueBig}>{money(calculo.honorarioMedico)}</div>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.baseLine}>
            {esIncluida
              ? <span className={styles.miniLabel}>Valor incluido</span>
              : es400101
                ? <><span className={styles.miniLabel}>Gto:</span> {money(item.gto || 0)}</>
                : esCapitulo12 ? `G. Oper. × ${item.gto || 0}`
                : esEco18 ? `Gasto Rx × ${item.gto || 0}`
                : money(item.gto || 0)}
          </div>
          <div className={styles.valueBig}>{money(calculo.gastoSanatorial)}</div>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.valueBig}>{money(total)}</div>
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
              ? `${resultados.length} prácticas incluidas`
              : `${resultados.length} prácticas encontradas para "${qTrim}"`}
          </div>

          <div className={styles.mobileList}>
            {resultados.length === 0 ? (
              <div className={styles.noResults}>
                {qTrim === ''
                  ? (incluidas.length === 0
                      ? 'Este convenio no tiene prácticas incluidas cargadas.'
                      : 'No hay prácticas incluidas cargadas en este convenio.')
                  : `No hay resultados para "${qTrim}"`}
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
                  <th className={styles.thNum}>Total</th>
                  <th className={styles.thAction}>Agregar</th>
                </tr>
              </thead>
              <tbody>
                {resultados.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={styles.noResultsCell}>
                      {qTrim === ''
                        ? (incluidas.length === 0
                            ? 'Este convenio no tiene prácticas incluidas cargadas.'
                            : 'No hay prácticas incluidas cargadas en este convenio.')
                        : `No hay resultados para "${qTrim}"`}
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
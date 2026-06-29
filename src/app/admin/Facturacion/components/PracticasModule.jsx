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
  '400101',      // código especial: se unifica todo en clínica
];

const normCode = (c) => String(c ?? '').replace(/\D/g, '');

// Detecta si una práctica es ecografía (capítulo 18), EXCEPTO las que tienen meta especial
const isEcografia = (practica) => {
  if (practica?.meta?.kind === 'especial') return false; // ecografías con valor propio no entran aquí
  return String(practica?.capitulo ?? '') === '18';
};

export default function PracticasModule({ practicasAgregadas, agregarPractica, onAtras, onSiguiente }) {
  const { valoresConvenio } = useConvenio();

  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const [modoBusqueda, setModoBusqueda] = useState(true);

  // Estado para la selección de artroscopia (simple / ligamento / hombro)
  const [artroscopiaSelections, setArtroscopiaSelections] = useState({});
  // Estado para la selección de ECG (profesional/clínica)
  const [ecgSelections, setEcgSelections] = useState({});

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

  // Manejadores para cambios de selección
  const handleArtroscopiaChange = (key, tipo) => {
    setArtroscopiaSelections(prev => ({ ...prev, [key]: tipo }));
  };

  const handleEcgChange = (key, tipo) => {
    setEcgSelections(prev => ({ ...prev, [key]: tipo }));
  };

  // ============================================================
  //  FUNCIÓN DE CÁLCULO (incluye FKT y FKT+MGT)
  // ============================================================
  const getCalculo = useCallback((practica) => {
    if (!valoresConvenio) return { honorarioMedico: 0, gastoSanatorial: 0, soloHonorario: false, soloGasto: false };

    // --- NUEVAS PRÁCTICAS COMUNES: FKT y FKT+MGT ---
    if (practica.codigo === 'FKT') {
      const valor = Number(valoresConvenio['FKT']) || 0;
      return { honorarioMedico: valor, gastoSanatorial: 0, soloHonorario: true, soloGasto: false };
    }
    if (practica.codigo === 'FKT_+_MGT') {
      const valor = Number(valoresConvenio['FKT_+_MGT']) || 0;
      return { honorarioMedico: valor, gastoSanatorial: 0, soloHonorario: true, soloGasto: false };
    }

    // --- ECG con selector profesional/clínica ---
    if (practica.codigo === '17.01.01') {
      const valorBase = Number(valoresConvenio['ECG_Y_EX_EN_CV']) || 0;
      const tipo = ecgSelections[practica.__key] || 'profesional';
      if (tipo === 'profesional') {
        return {
          honorarioMedico: valorBase,
          gastoSanatorial: 0,
          soloHonorario: true,
          soloGasto: false,
        };
      } else {
        return {
          honorarioMedico: 0,
          gastoSanatorial: valorBase,
          soloHonorario: false,
          soloGasto: true,
        };
      }
    }

    // Caso especial: código 400101 → honorario y gasto por separado, pero con bandera de unificación
if (practica.codigo === '400101') {
  const gal = parseFloat(practica.q_gal) || 0;   // 39.75
  const gto = parseFloat(practica.gto) || 0;     // 196
  const pension = parseFloat(valoresConvenio['Pension']) || 0;
  const galenoRx = parseFloat(valoresConvenio['Galeno_Rx_Practica']) || 0;

  const totalGasto = (gto * pension) + (gal * galenoRx) + (10 * pension);

  return {
    honorarioMedico: 0,
    gastoSanatorial: totalGasto,
    soloHonorario: false,
    soloGasto: true,
    // ya no necesitamos unificar, porque es solo gasto
  };
}
    // Caso especial: código 431107 (Oxígeno en terapia) – gasto fijo, sin honorario
    if (practica.codigo === '431107') {
      return {
        honorarioMedico: 0,
        gastoSanatorial: 85000,
        soloHonorario: false,
        soloGasto: true,
      };
    }

    // --- ARTROSCOPIA (código 120902) con tres opciones ---
    if (practica.codigo === '120902') {
      const tipo = artroscopiaSelections[practica.__key] || 'simple';
      let gastoKey;
      if (tipo === 'simple') {
        gastoKey = 'Artroscopia_Simple_Gastos_Sanatoriales';
      } else if (tipo === 'ligamento') {
        gastoKey = 'Lig_Cruzado_Gastos_Sanatoriales';
      } else { // hombro
        gastoKey = 'Artroscopia_Hombro';
      }
      const gasto = Number(valoresConvenio[gastoKey]) || 0;
      return {
        honorarioMedico: 0,
        gastoSanatorial: gasto,
        soloHonorario: false,
        soloGasto: true,
      };
    }

    // --- Radiografías (Capítulo 34) ---
    if (practica.capitulo === '34' || (practica.capituloNombre && practica.capituloNombre.toLowerCase().includes('radiolog'))) {
      const galenoRx = Number(valoresConvenio['Galeno_Rx_Practica']) || 0;
      const gastoRx = Number(valoresConvenio['Gasto_Rx']) || 0;

      const honorario = (galenoRx * (practica.q_gal || 0)) + ((gastoRx * (practica.gto || 0)) / 2);
      const gasto = ((gastoRx * (practica.gto || 0)) / 2);

      return {
        honorarioMedico: honorario,
        gastoSanatorial: gasto,
        soloHonorario: false,
        soloGasto: false,
      };
    }

    // --- Ecografías (Capítulo 18) sin meta especial ---
    // Todo va al médico: galeno_rx × q_gal + gasto_rx × gto (honorario completo, sin gasto sanatorial)
    if (isEcografia(practica)) {
      const galenoRx = Number(valoresConvenio['Galeno_Rx_Practica']) || 0;
      const gastoRx = Number(valoresConvenio['Gasto_Rx']) || 0;

      const totalMedico = (galenoRx * (practica.q_gal || 0)) + (gastoRx * (practica.gto || 0));

      return {
        honorarioMedico: totalMedico,
        gastoSanatorial: 0,
        soloHonorario: true,
        soloGasto: false,
      };
    }

    // Prácticas con meta especial (Ecografía partes blandas, etc.)
    if (practica.meta?.kind === 'especial') {
      const valorBase = Number(valoresConvenio[practica.meta.baseKey]) || 0;
      return {
        honorarioMedico: valorBase,
        gastoSanatorial: 0,
        soloHonorario: true,
        soloGasto: false,
      };
    }

    // Resto: usar calcularPractica de utils
    return calcularPractica(practica, valoresConvenio);
  }, [valoresConvenio, artroscopiaSelections, ecgSelections]);

  const handleAgregar = useCallback((practica) => {
    if (!valoresConvenio) return alert('No hay valores de convenio disponibles');

    const calculo = getCalculo(practica);

    // Capturar tipo de artroscopia si corresponde
    let tipoArtroscopia = null;
    if (practica.codigo === '120902') {
      tipoArtroscopia = artroscopiaSelections[practica.__key] || 'simple';
    }

    const groupId = `pract-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const baseId = `pract-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const baseCommon = {
      ...practica,
      ...calculo,
      cantidad: 1,
      esRX: isRadiografia(practica),
      esSubsiguiente: isSubsiguiente(practica),
      groupId,
    };

    const agregados = [];

    // Caso especial 400101 (unificar en clínica)
    if (calculo.unificarEnClinica) {
      const total = (calculo.honorarioMedico || 0) + (calculo.gastoSanatorial || 0);
      const descripcionPersonalizada = `Día de pensión UTI (Hon + Gastos)`;
      agregados.push({
        id: `${baseId}-clin-unificado`,
        ...baseCommon,
        descripcion: descripcionPersonalizada,
        prestadorTipo: 'Clinica',
        prestadorNombre: 'Clínica de la Unión',
        honorarioMedico: 0,
        gastoSanatorial: total,
        total: total,
      });
    } else {
      // Comportamiento normal
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
        const itemClinica = {
          id: `${baseId}-clin`,
          ...baseCommon,
          prestadorTipo: 'Clinica',
          prestadorNombre: 'Clínica de la Unión',
          honorarioMedico: 0,
          gastoSanatorial: calculo.gastoSanatorial,
          total: calculo.gastoSanatorial,
        };
        if (tipoArtroscopia) {
          itemClinica.tipoArtroscopia = tipoArtroscopia;
        }
        agregados.push(itemClinica);
      }
    }

    agregados.forEach(item => agregarPractica(item));

    let tipoMsg = '';
    if (practica.codigo === '120902') {
      if (tipoArtroscopia === 'simple') tipoMsg = ' (Simple)';
      else if (tipoArtroscopia === 'ligamento') tipoMsg = ' (Ligamento cruzado)';
      else tipoMsg = ' (Hombro)';
    } else if (practica.codigo === '17.01.01') {
      tipoMsg = ` (${ecgSelections[practica.__key] || 'profesional'})`;
    } else if (practica.codigo === 'FKT') {
      tipoMsg = ` (Kinesiología)`;
    } else if (practica.codigo === 'FKT_+_MGT') {
      tipoMsg = ` (Kinesiología + MGT)`;
    }
    showTooltipMessage(`✓ "${String(practica.descripcion).slice(0, 50)}..."${tipoMsg} agregada`, groupId);
  }, [valoresConvenio, artroscopiaSelections, ecgSelections, agregarPractica, showTooltipMessage, getCalculo]);

  // ============================================================
  //  RESULTADOS RÁPIDOS (incluye FKT y FKT+MGT si existen)
  // ============================================================
  const defaultResultados = useMemo(() => {
    if (!data.length) return [];

    const wanted = DEFAULT_CODES.map(normCode);
    const picked = [];

    for (const w of wanted) {
      const found = data.find((it) => normCode(it.codigo) === w);
      if (!found) continue;
      picked.push(...vincularSubsiguientes(found, data));
    }

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
          meta: { kind: 'especial', baseKey: 'Ecografia_partes_blandas_no_moduladas' },
          __key: 'custom-eco'
        });
      }
      // Artroscopia
      if (valoresConvenio['Artroscopia_Simple_Gastos_Sanatoriales'] ||
          valoresConvenio['Lig_Cruzado_Gastos_Sanatoriales'] ||
          valoresConvenio['Artroscopia_Hombro']) {
        picked.push({
          codigo: '120902',
          descripcion: 'Artroscopia',
          capitulo: '12',
          capituloNombre: 'Procedimientos',
          q_gal: 0,
          gto: 0,
          __key: 'custom-artroscopia'
        });
      }
      // Oxígeno en terapia
      picked.push({
        codigo: '431107',
        descripcion: 'Oxígeno en terapia',
        capitulo: '43',
        capituloNombre: 'Terapias',
        q_gal: 0,
        gto: 85000,
        __key: 'custom-oxigeno'
      });

      // ================== NUEVAS PRÁCTICAS ==================
      // FKT (Kinesiología)
      if (valoresConvenio['FKT'] && Number(valoresConvenio['FKT']) > 0) {
        picked.push({
          codigo: 'FKT',
          descripcion: 'FKT',
          capitulo: '00',
          capituloNombre: 'Kinesiología',
          q_gal: 0,
          gto: 0,
          __key: 'custom-fkt'
        });
      }
      // FKT + MGT
      if (valoresConvenio['FKT_+_MGT'] && Number(valoresConvenio['FKT_+_MGT']) > 0) {
        picked.push({
          codigo: 'FKT_+_MGT',
          descripcion: 'FKT + MGT',
          capitulo: '00',
          capituloNombre: 'Kinesiología',
          q_gal: 0,
          gto: 0,
          __key: 'custom-fktmgt'
        });
      }
    }

    // Eliminar duplicados
    const seen = new Map();
    picked.forEach((it) => {
      const key = it.__key || `${it.capitulo}|${it.codigo}`;
      if (!seen.has(key)) seen.set(key, it);
    });

    return Array.from(seen.values());
  }, [data, valoresConvenio]);

  // ============================================================
  //  RESULTADOS DE BÚSQUEDA (sin cambios)
  // ============================================================
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

  const resultados = useMemo(() => {
    return debouncedQuery.trim() === '' ? defaultResultados : resultadosBusqueda;
  }, [debouncedQuery, defaultResultados, resultadosBusqueda]);

  // ============================================================
  //  RENDERIZADO (sin cambios, ya maneja las nuevas prácticas)
  // ============================================================
  const renderItem = (item, isMobile = false, qLocal = '') => {
    const key = item.__key || `${item.capitulo}|${item.codigo}`;
    const esRX = isRadiografia(item);
    const esSubs = isSubsiguiente(item);
    const esArtroscopia = item.codigo === '120902';
    const esECG = item.codigo === '17.01.01';
    const es400101 = item.codigo === '400101';
    const esEco18 = isEcografia(item);
    // Detectamos si es FKT o FKT+MGT
    const esFKT = item.codigo === 'FKT' || item.codigo === 'FKT_+_MGT';

    const calculo = getCalculo(item);
    const isRecent = lastAddedGroupId && item.groupId === lastAddedGroupId;
    const q = qLocal || query;

    const gastoSimple = Number(valoresConvenio?.['Artroscopia_Simple_Gastos_Sanatoriales']) || 0;
    const gastoLigamento = Number(valoresConvenio?.['Lig_Cruzado_Gastos_Sanatoriales']) || 0;
    const gastoHombro = Number(valoresConvenio?.['Artroscopia_Hombro']) || 0;

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

          {esEco18 && (
            <div className={styles.ecoBadge}>
              🩺 Honorario completo al médico (Galeno Rx × UVR + Gasto Rx × Gto)
            </div>
          )}

          {esArtroscopia && (
            <div className={styles.artroscopiaSelector}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`artro-${key}`}
                  checked={artroscopiaSelections[key] === 'simple' || !artroscopiaSelections[key]}
                  onChange={() => handleArtroscopiaChange(key, 'simple')}
                />
                <span className={styles.radioCustom}></span>
                Simple ({money(gastoSimple)})
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`artro-${key}`}
                  checked={artroscopiaSelections[key] === 'ligamento'}
                  onChange={() => handleArtroscopiaChange(key, 'ligamento')}
                />
                <span className={styles.radioCustom}></span>
                Ligamento cruzado ({money(gastoLigamento)})
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`artro-${key}`}
                  checked={artroscopiaSelections[key] === 'hombro'}
                  onChange={() => handleArtroscopiaChange(key, 'hombro')}
                />
                <span className={styles.radioCustom}></span>
                Hombro ({money(gastoHombro)})
              </label>
            </div>
          )}

          {esECG && (
            <div className={styles.ecgSelector}>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`ecg-${key}`}
                  checked={ecgSelections[key] === 'profesional' || !ecgSelections[key]}
                  onChange={() => handleEcgChange(key, 'profesional')}
                />
                <span className={styles.radioCustom}></span>
                Profesional (Dr) ({money(Number(valoresConvenio?.['ECG_Y_EX_EN_CV']) || 0)})
              </label>
              <label className={styles.radioLabel}>
                <input
                  type="radio"
                  name={`ecg-${key}`}
                  checked={ecgSelections[key] === 'clinica'}
                  onChange={() => handleEcgChange(key, 'clinica')}
                />
                <span className={styles.radioCustom}></span>
                Clínica ({money(Number(valoresConvenio?.['ECG_Y_EX_EN_CV']) || 0)})
              </label>
            </div>
          )}

          <div className={styles.costGrid}>
            <div className={styles.costBox}>
              <span className={styles.costLabel}>Honorario</span>
              {es400101 && <div className={styles.baseLine}>Gal: {money(item.q_gal || 0)}</div>}
              {esEco18 && <div className={styles.baseLine}>UVR: {item.q_gal || 0} / Gto: {item.gto || 0}</div>}
              <span className={styles.costValue}>{money(calculo.honorarioMedico)}</span>
            </div>

            <div className={styles.costBox}>
              <span className={styles.costLabel}>Gasto</span>
              {es400101 && <div className={styles.baseLine}>Gto: {money(item.gto || 0)}</div>}
              <span className={styles.costValue}>{esEco18 || esFKT ? '—' : money(calculo.gastoSanatorial)}</span>
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
          {esEco18 && (
            <div className={styles.ecoNote}>
              🩺 Todo al médico: Galeno Rx × {item.q_gal || 0} UVR + Gasto Rx × {item.gto || 0}
            </div>
          )}
          {esArtroscopia && (
            <div className={styles.tableArtroscopiaSelector}>
              <label className={styles.radioLabelInline}>
                <input
                  type="radio"
                  name={`artro-tab-${key}`}
                  checked={artroscopiaSelections[key] === 'simple' || !artroscopiaSelections[key]}
                  onChange={() => handleArtroscopiaChange(key, 'simple')}
                />
                <span>Simple ({money(gastoSimple)})</span>
              </label>
              <label className={styles.radioLabelInline}>
                <input
                  type="radio"
                  name={`artro-tab-${key}`}
                  checked={artroscopiaSelections[key] === 'ligamento'}
                  onChange={() => handleArtroscopiaChange(key, 'ligamento')}
                />
                <span>Ligamento ({money(gastoLigamento)})</span>
              </label>
              <label className={styles.radioLabelInline}>
                <input
                  type="radio"
                  name={`artro-tab-${key}`}
                  checked={artroscopiaSelections[key] === 'hombro'}
                  onChange={() => handleArtroscopiaChange(key, 'hombro')}
                />
                <span>Hombro ({money(gastoHombro)})</span>
              </label>
            </div>
          )}
          {esECG && (
            <div className={styles.tableEcgSelector}>
              <label className={styles.radioLabelInline}>
                <input
                  type="radio"
                  name={`ecg-tab-${key}`}
                  checked={ecgSelections[key] === 'profesional' || !ecgSelections[key]}
                  onChange={() => handleEcgChange(key, 'profesional')}
                />
                <span>Profesional</span>
              </label>
              <label className={styles.radioLabelInline}>
                <input
                  type="radio"
                  name={`ecg-tab-${key}`}
                  checked={ecgSelections[key] === 'clinica'}
                  onChange={() => handleEcgChange(key, 'clinica')}
                />
                <span>Clínica</span>
              </label>
            </div>
          )}
        </td>
        <td className={styles.capCell}>
          <span className={styles.capBadge}>{item.capitulo} – {item.capituloNombre}</span>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.baseLine}>
            {es400101
              ? <><span className={styles.miniLabel}>Gal:</span> {money(item.q_gal || 0)}</>
              : `Gal: ${money(item.q_gal || 0)}`
            }
          </div>
          <div className={styles.valueBig}>{money(calculo.honorarioMedico)}</div>
        </td>

        <td className={styles.numericCell}>
          <div className={styles.baseLine}>
            {es400101
              ? <><span className={styles.miniLabel}>Gto:</span> {money(item.gto || 0)}</>
              : money(item.gto || 0)
            }
          </div>
          <div className={styles.valueBig}>{esEco18 || esFKT ? '—' : money(calculo.gastoSanatorial)}</div>
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
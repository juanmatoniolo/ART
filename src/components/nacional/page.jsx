'use client';

import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import Fuse from 'fuse.js';
import styles from './page.module.css';
import {
  normalize,
  money,
  isRadiografia,
  isSubsiguiente,
  vincularSubsiguientes,
  highlight,
  parseNumber,
  calcularPractica,
} from '../../app/admin/Facturacion/utils/calculos';

const formatConvenioLabel = (s) =>
  String(s ?? '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const DEFAULT_CODES = [
  '42.01.01',
  '43.02.01',
  '34.02.13',
  '13.01.10',
  '34.02.013',
  '43.01.01',
  '43.10.01',
  '43.11.01',
  '400101',
];

const normCode = (c) => String(c ?? '').replace(/\D/g, '');

const formatearCodigo = (codigo) => {
  const s = String(codigo).replace(/\D/g, '');
  if (s.length === 6) return `${s.slice(0,2)}.${s.slice(2,4)}.${s.slice(4,6)}`;
  return s;
};

const normalizarValores = (vg) => {
  if (!vg) return {};
  const buscar = (claves, defecto = 0) => {
    for (const c of claves) {
      if (vg[c] != null && vg[c] !== '') return parseNumber(vg[c]);
    }
    return defecto;
  };
  return {
    galenoRx: buscar(['Galeno_Rx_Practica', 'Galeno_Rx_y_Practica', 'Galeno_Rx', 'galeno_rx']),
    gastoRx: buscar(['Gasto_Rx', 'Gastos_Rx', 'Gasto Rx', 'gasto_rx']),
    galenoQuir: buscar(['Galeno_Quir', 'Galeno Quir', 'Galeno_Quirurgico', 'galeno_quir']),
    gastoOperatorio: buscar(['Gasto_Operatorio', 'Gasto Operatorio', 'gasto_operatorio']),
    pension: buscar(['Pension', 'pension', 'Dia_Pension', 'Día_Pensión']),
    otrosGastos: buscar(['Otros_Gastos', 'Otros gastos', 'Otros_Gastos_Medicos']),
    consulta: buscar(['Consulta', 'consulta', 'CONSULTA']),
    Curaciones_R: buscar(['Curaciones_R', 'CURACIONES_R', 'Curaciones']),
    ...vg,
  };
};

export default function NomencladorNacional() {
  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [filtroCapitulo, setFiltroCapitulo] = useState('');
  const [capituloQueries, setCapituloQueries] = useState({});
  const [convenios, setConvenios] = useState({});
  const [convenioSel, setConvenioSel] = useState('');
  const [valoresConvenio, setValoresConvenio] = useState({});
  const [alerta, setAlerta] = useState('');
  const [subcapitulos, setSubcapitulos] = useState({});

  useEffect(() => {
    fetch('/archivos/subcapitulos.json')
      .then((res) => res.json())
      .then((json) => setSubcapitulos(json))
      .catch(() => console.warn('No se pudo cargar subcapitulos.json'));
  }, []);

  useEffect(() => {
    fetch('/archivos/NomecladorNacional.json')
      .then((res) => res.json())
      .then((json) => {
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
              __key: `${base}#${n}`,
            };
          })
        );
        setData(flat);
      })
      .catch((err) => {
        console.error('Error cargando JSON:', err);
        setAlerta('No se pudo cargar el Nomenclador Nacional.');
      });
  }, []);

  useEffect(() => {
    const conveniosRef = ref(db, 'convenios');
    const off = onValue(conveniosRef, (snap) => {
      const val = snap.exists() ? snap.val() : {};
      const normalizado = Object.keys(val).reduce((acc, key) => {
        acc[key.trim()] = val[key];
        return acc;
      }, {});
      setConvenios(normalizado);
      const stored = localStorage.getItem('convenioActivo');
      const elegir = stored && normalizado[stored] ? stored : Object.keys(normalizado)[0] || '';
      setConvenioSel(elegir);
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!convenioSel || !convenios[convenioSel]) {
      setValoresConvenio({});
      return;
    }
    const vg = convenios[convenioSel]?.valores_generales || {};
    setValoresConvenio(normalizarValores(vg));
    localStorage.setItem('convenioActivo', convenioSel);
  }, [convenioSel, convenios]);

  const fuseGlobal = useMemo(() => {
    if (!data.length) return null;
    return new Fuse(data, {
      keys: [
        { name: 'codigo', weight: 3 },
        { name: 'capitulo', weight: 2 },
        { name: 'descripcion', weight: 1 },
      ],
      includeScore: true,
      threshold: 0.25,
      ignoreLocation: true,
      minMatchCharLength: 1,
    });
  }, [data]);

  const defaultResultados = useMemo(() => {
    if (!data.length) return [];
    const wanted = DEFAULT_CODES.map(normCode);
    const picked = [];
    for (const w of wanted) {
      const found = data.find((it) => normCode(it.codigo) === w);
      if (!found) continue;
      picked.push(...vincularSubsiguientes(found, data));
    }
    const seen = new Map();
    picked.forEach((it) => {
      const key = it.__key || `${it.capitulo}|${it.codigo}`;
      if (!seen.has(key)) seen.set(key, it);
    });
    return Array.from(seen.values());
  }, [data]);

  const getResultadosBusqueda = (q) => {
    const trimmed = q.trim();
    if (!trimmed) return [];
    const codigoLimpio = normCode(trimmed);
    let exactos = data.filter((it) => normCode(it.codigo) === codigoLimpio);
    const esNumeroCapitulo = /^\d{1,2}$/.test(trimmed);
    let porCapitulo = [];
    if (esNumeroCapitulo) {
      const capNum = trimmed.padStart(2, '0');
      porCapitulo = data.filter((it) => it.capitulo === capNum);
    }
    const esSubcapitulo = /^\d{1,2}\.\d{1,2}$/.test(trimmed);
    let porSubcapitulo = [];
    if (esSubcapitulo) {
      const [cap, sub] = trimmed.split('.');
      const capPadded = cap.padStart(2, '0');
      const subPadded = sub.padStart(2, '0');
      const key = `${capPadded}.${subPadded}`;
      porSubcapitulo = data.filter((it) => {
        const itKey = it.codigo.slice(0,2) + '.' + it.codigo.slice(2,4);
        return itKey === key;
      });
    }
    let fuseResults = [];
    if (fuseGlobal) {
      const found = fuseGlobal.search(trimmed).map((r) => r.item);
      fuseResults = found;
    }
    const combined = [...exactos, ...porCapitulo, ...porSubcapitulo, ...fuseResults];
    const unique = Array.from(
      new Map(combined.map((it) => [it.__key || `${it.capitulo}|${it.codigo}`, it])).values()
    );
    let final = [];
    for (const it of unique) {
      final.push(...vincularSubsiguientes(it, data));
    }
    const finalUnique = Array.from(
      new Map(final.map((it) => [it.__key || `${it.capitulo}|${it.codigo}`, it])).values()
    );
    return finalUnique;
  };

  const resultadosGlobales = useMemo(() => {
    if (query.trim() === '') return defaultResultados;
    return getResultadosBusqueda(query);
  }, [query, data, defaultResultados]);

  const getCalculo = (practica) => {
    const q_gal = practica.q_gal || 0;
    const gto = practica.gto || 0;
    if (!valoresConvenio || Object.keys(valoresConvenio).length === 0) {
      return { honorarioMedico: 0, gastoSanatorial: 0, total: 0, q_gal, gto };
    }
    const calculado = calcularPractica(practica, valoresConvenio);
    return { ...calculado, q_gal, gto };
  };

  const getSubcapitulo = (codigo) => {
    if (!codigo || codigo.length < 4) return '';
    const key = codigo.substring(0, 2) + '.' + codigo.substring(2, 4);
    return subcapitulos[key] || '';
  };

  const capLabel = (it) => `${it.capitulo} – ${it.capituloNombre}`;

  const gastoRx = valoresConvenio?.gastoRx ?? 0;
  const galenoRxPractica = valoresConvenio?.galenoRx ?? 0;
  const gastoOperatorio = valoresConvenio?.gastoOperatorio ?? 0;
  const galenoQuir = valoresConvenio?.galenoQuir ?? 0;
  const diaPension = valoresConvenio?.pension ?? 0;
  const otrosGastos = valoresConvenio?.otrosGastos ?? 0;
  const galenoComun = parseNumber(valoresConvenio?.['Galeno_Comun'] ?? 0);

  // Componente de tarjeta móvil reutilizable para evitar duplicación
  const MobileCard = ({ practica, qLocal = '' }) => {
    const calc = getCalculo(practica);
    const subNombre = getSubcapitulo(practica.codigo);
    return (
      <article className={`${styles.card} ${isRadiografia(practica) ? styles.rxCard : ''} ${isSubsiguiente(practica) ? styles.subsiguienteCard : ''}`}>
        <div className={styles.cardTop}>
          <div className={styles.code}>{formatearCodigo(practica.codigo)}</div>
          <div className={styles.capCell}>
            <span className={styles.capMain}>{capLabel(practica)}</span>
            {subNombre && (
              <span className={styles.capSub}>
                {practica.codigo.slice(0,2)}.{practica.codigo.slice(2,4)} – {subNombre}
              </span>
            )}
          </div>
        </div>
        <div className={styles.desc}>{highlight(practica.descripcion, qLocal || query)}</div>
        <div className={styles.costGrid}>
          <div className={styles.costBox}>
            <span className={styles.costLabel}>Honorario</span>
            <span className={styles.costValue}>{money(calc.honorarioMedico)}</span>
            <span className={styles.baseLine}>Gal: {money(calc.q_gal)}</span>
          </div>
          <div className={styles.costBox}>
            <span className={styles.costLabel}>Gasto</span>
            <span className={styles.costValue}>{money(calc.gastoSanatorial)}</span>
            <span className={styles.baseLine}>Gto: {money(calc.gto)}</span>
          </div>
          <div className={styles.costBox}>
            <span className={styles.costLabel}>Total</span>
            <span className={styles.costValue}>{money(calc.total)}</span>
          </div>
        </div>
      </article>
    );
  };

  // Componente de fila de tabla reutilizable
  const TableRow = ({ practica, qLocal = '' }) => {
    const calc = getCalculo(practica);
    const subNombre = getSubcapitulo(practica.codigo);
    return (
      <tr className={`${isRadiografia(practica) ? styles.rxRow : ''} ${isSubsiguiente(practica) ? styles.subsiguienteRow : ''}`}>
        <td className={styles.codeCell}>{formatearCodigo(practica.codigo)}</td>
        <td className={styles.descCell}>{highlight(practica.descripcion, qLocal || query)}</td>
        <td>
          <div className={styles.capCell}>
            <span className={styles.capMain}>{capLabel(practica)}</span>
            {subNombre && (
              <span className={styles.capSub}>
                {practica.codigo.slice(0,2)}.{practica.codigo.slice(2,4)} – {subNombre}
              </span>
            )}
          </div>
        </td>
        <td className={styles.tdNumeric}>
          <div className={styles.valueWithBase}>
            <span className={styles.valueBig}>{money(calc.honorarioMedico)}</span>
            <span className={styles.baseLine}>Gal: {money(calc.q_gal)}</span>
          </div>
        </td>
        <td className={styles.tdNumeric}>
          <div className={styles.valueWithBase}>
            <span className={styles.valueBig}>{money(calc.gastoSanatorial)}</span>
            <span className={styles.baseLine}>Gto: {money(calc.gto)}</span>
          </div>
        </td>
        <td className={styles.tdNumeric}>
          <span className={styles.valueBig}>{money(calc.total)}</span>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.heading}>
            <h2 className={styles.title}>📘 Nomenclador Nacional</h2>
            <p className={styles.subtitle}>
              Consultá prácticas y costos según convenio. Podés buscar global o por capítulos.
            </p>
          </div>
        </div>

        <div className={styles.chips}>
          <span className={`${styles.chip} ${styles.chipGastoRx}`}>
            <b>Gasto Rx</b> <span className={styles.chipValue}>{money(gastoRx)}</span>
          </span>
          <span className={`${styles.chip} ${styles.chipGalenoRx}`}>
            <b>Galeno Rx</b> <span className={styles.chipValue}>{money(galenoRxPractica)}</span>
          </span>
          <span className={`${styles.chip} ${styles.chipGtoOperatorio}`}>
            <b>G. Oper.</b> <span className={styles.chipValue}>{money(gastoOperatorio)}</span>
          </span>
          <span className={`${styles.chip} ${styles.chipGalenoQuir}`}>
            <b>Gal. Quir.</b> <span className={styles.chipValue}>{money(galenoQuir)}</span>
          </span>
          <span className={`${styles.chip} ${styles.chipPension}`}>
            <b>Pensión</b> <span className={styles.chipValue}>{money(diaPension)}</span>
          </span>
          <span className={`${styles.chip} ${styles.chipOtros}`}>
            <b>Otros</b> <span className={styles.chipValue}>{money(otrosGastos)}</span>
          </span>
          <span className={`${styles.chip} ${styles.chipGalenoComun}`}>
            <b>Galeno Común</b> <span className={styles.chipValue}>{money(galenoComun)}</span>
          </span>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.controlBlock}>
            <label className={styles.label}>Convenio</label>
            <select className={styles.select} value={convenioSel} onChange={(e) => setConvenioSel(e.target.value)}>
              {Object.keys(convenios).sort().map((k) => (
                <option key={k} value={k}>{formatConvenioLabel(k)}</option>
              ))}
            </select>
          </div>
          <button className={styles.switchButton} onClick={() => setModoBusqueda((p) => !p)} type="button">
            {modoBusqueda ? '📂 Ver por capítulos' : '🔍 Modo búsqueda global'}
          </button>
        </div>

        {alerta && <div className={styles.alert}>{alerta}</div>}
      </div>

      {modoBusqueda ? (
        <>
          <div className={styles.searchBar} role="search">
            <span className={styles.searchIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path fill="currentColor" d="M10 4a6 6 0 104.472 10.03l3.749 3.75a1 1 0 001.414-1.415l-3.75-3.75A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z"/>
              </svg>
            </span>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar por código, capítulo o descripción…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              inputMode="search"
            />
            {query.trim() && (
              <button type="button" className={styles.clearBtn} onClick={() => setQuery('')}>
                Limpiar
              </button>
            )}
          </div>

          {/* Mobile cards */}
          <div className={styles.mobileList}>
            {resultadosGlobales.length === 0 ? (
              <div className={styles.noResults}>Sin resultados.</div>
            ) : (
              resultadosGlobales.map((it) => (
                <MobileCard key={it.__key || `${it.capitulo}|${it.codigo}`} practica={it} />
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Capítulo</th>
                  <th className={styles.thNumeric}>Honorario</th>
                  <th className={styles.thNumeric}>Gasto</th>
                  <th className={styles.thNumeric}>Total</th>
                </tr>
              </thead>
              <tbody>
                {resultadosGlobales.length === 0 ? (
                  <tr><td colSpan={6} className={styles.noResultsCell}>Sin resultados.</td></tr>
                ) : (
                  resultadosGlobales.map((it) => (
                    <TableRow key={it.__key || `${it.capitulo}|${it.codigo}`} practica={it} />
                  ))
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
              const practicas = c.practicas || [];
              const qLocal = capituloQueries[c.capitulo] || '';
              const qLocalNorm = normalize(qLocal);
              const practicasFiltradas =
                qLocal.trim().length === 0
                  ? practicas
                  : practicas.filter((p) => normalize(`${p.codigo} ${p.descripcion}`).includes(qLocalNorm));

              return (
                <details key={String(c.capitulo)} className={styles.accordion}>
                  <summary className={styles.accordionHeader}>
                    {c.capitulo} — {c.descripcion}
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
                          [c.capitulo]: e.target.value,
                        }))
                      }
                    />
                    <div className={styles.mobileList}>
                      {practicasFiltradas.length === 0 ? (
                        <div className={styles.noResults}>Sin resultados.</div>
                      ) : (
                        practicasFiltradas.map((it, j) => {
                          const itFull = { ...it, capitulo: c.capitulo, capituloNombre: c.descripcion };
                          const key = `${String(c.capitulo).trim()}|${String(it.codigo).trim()}#${j + 1}`;
                          return <MobileCard key={key} practica={itFull} qLocal={qLocal} />;
                        })
                      )}
                    </div>
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Honorario</th>
                            <th>Gasto</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {practicasFiltradas.length === 0 ? (
                            <tr><td colSpan={5} className={styles.noResultsCell}>Sin resultados.</td></tr>
                          ) : (
                            practicasFiltradas.map((it, j) => {
                              const itFull = { ...it, capitulo: c.capitulo, capituloNombre: c.descripcion };
                              const key = `${String(c.capitulo).trim()}|${String(it.codigo).trim()}#${j + 1}`;
                              return <TableRow key={key} practica={itFull} qLocal={qLocal} />;
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
    </div>
  );
}
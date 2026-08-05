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

} from '../../app/admin/Facturacion/utils/calculos';   // ✅ usamos las mismas utilidades que facturación


const formatConvenioLabel = (s) =>
  String(s ?? '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// ----- CÓDIGOS DE PRÁCTICAS COMUNES (accesos rápidos) -----
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

/**
 * Normaliza el objeto valores_generales del convenio a las claves
 * que espera la función calcularPractica (igual que en facturación).
 */
const normalizarValores = (vg) => {
  if (!vg) return {};

  // Función para buscar un valor con múltiples nombres de clave posibles
  const buscar = (claves, defecto = 0) => {
    for (const c of claves) {
      if (vg[c] != null && vg[c] !== '') return parseNumber(vg[c]);
    }
    return defecto;
  };

  return {
    // Campos que usa calcularPractica
    galenoRx: buscar(['Galeno_Rx_Practica', 'Galeno_Rx_y_Practica', 'Galeno_Rx', 'galeno_rx']),
    gastoRx: buscar(['Gasto_Rx', 'Gastos_Rx', 'Gasto Rx', 'gasto_rx']),
    galenoQuir: buscar(['Galeno_Quir', 'Galeno Quir', 'Galeno_Quirurgico', 'galeno_quir']),
    gastoOperatorio: buscar(['Gasto_Operatorio', 'Gasto Operatorio', 'gasto_operatorio']),
    pension: buscar(['Pension', 'pension', 'Dia_Pension', 'Día_Pensión']),
    otrosGastos: buscar(['Otros_Gastos', 'Otros gastos', 'Otros_Gastos_Medicos']),
    consulta: buscar(['Consulta', 'consulta', 'CONSULTA']),
    Curaciones_R: buscar(['Curaciones_R', 'CURACIONES_R', 'Curaciones']),
    // También exponemos el objeto completo por si se necesita en otro lado
    ...vg, // spread para mantener compatibilidad con búsquedas flexibles internas de calcularPractica
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
  const [valoresConvenio, setValoresConvenio] = useState({}); // ahora es el objeto normalizado
  const [alerta, setAlerta] = useState('');

  // Cargar JSON del nomenclador
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

  // Cargar convenios desde Firebase
  useEffect(() => {
    const conveniosRef = ref(db, 'convenios');
    const off = onValue(conveniosRef, (snap) => {
      const val = snap.exists() ? snap.val() : {};
      const normalizado = Object.keys(val).reduce((acc, key) => {
        const cleanKey = key.trim();
        acc[cleanKey] = val[key];
        return acc;
      }, {});
      setConvenios(normalizado);

      const stored = localStorage.getItem('convenioActivo');
      const elegir = stored && normalizado[stored] ? stored : Object.keys(normalizado)[0] || '';
      setConvenioSel(elegir);
    });

    return () => off();
  }, []);

  // Cuando cambia el convenio seleccionado, normalizamos sus valores
  useEffect(() => {
    if (!convenioSel || !convenios[convenioSel]) {
      setValoresConvenio({});
      return;
    }
    const vg = convenios[convenioSel]?.valores_generales || {};
    setValoresConvenio(normalizarValores(vg));
    localStorage.setItem('convenioActivo', convenioSel);
  }, [convenioSel, convenios]);

  // Fuse para búsqueda global
  const fuseGlobal = useMemo(() => {
    if (!data.length) return null;
    return new Fuse(data, {
      keys: ['descripcion', 'codigo', 'capitulo', 'capituloNombre'],
      includeScore: true,
      threshold: 0.18,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [data]);

  // --- Prácticas predefinidas (accesos rápidos) ---
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

  // --- Resultados de búsqueda ---
  const resultadosBusqueda = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    const qNorm = normalize(q);

    const exact = data.filter(
      (it) =>
        String(it.codigo ?? '').toLowerCase() === q.toLowerCase() ||
        normalize(it.descripcion).includes(qNorm)
    );

    let results = [];

    if (exact.length) {
      for (const it of exact) results.push(...vincularSubsiguientes(it, data));
    } else if (fuseGlobal) {
      const found = fuseGlobal.search(q).map((r) => r.item);
      for (const it of found) results.push(...vincularSubsiguientes(it, data));
    }

    const unique = Array.from(
      new Map(results.map((it) => [it.__key ?? `${it.capitulo}|${it.codigo}`, it])).values()
    );

    return unique.sort((a, b) => (isRadiografia(a) ? 0 : 1) - (isRadiografia(b) ? 0 : 1));
  }, [query, data, fuseGlobal]);

  // Combina: si no hay query → defaultResultados, sino → resultadosBusqueda
  const resultadosGlobales = query.trim() === '' ? defaultResultados : resultadosBusqueda;

  // Función que calcula honorario/gasto usando la misma lógica de facturación
  const getCalculo = (practica) => {
    if (!valoresConvenio || Object.keys(valoresConvenio).length === 0)
      return { honorarioMedico: 0, gastoSanatorial: 0, total: 0 };
    return calcularPractica(practica, valoresConvenio);
  };

  const capLabel = (it) => `${it.capitulo} – ${it.capituloNombre}`;

  // Valores para los chips (tomados del objeto normalizado)
  const gastoRx = valoresConvenio?.gastoRx ?? 0;
  const galenoRxPractica = valoresConvenio?.galenoRx ?? 0;
  const gastoOperatorio = valoresConvenio?.gastoOperatorio ?? 0;
  const galenoQuir = valoresConvenio?.galenoQuir ?? 0;
  const diaPension = valoresConvenio?.pension ?? 0;
  const otrosGastos = valoresConvenio?.otrosGastos ?? 0;
  const galenoComun = parseNumber(valoresConvenio?.['Galeno_Comun'] ?? 0);

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
        {/* Chips de valores */}
        <div className={styles.chips} aria-label="Valores del convenio">
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
              {Object.keys(convenios)
                .sort()
                .map((k) => (
                  <option key={k} value={k}>
                    {formatConvenioLabel(k)}
                  </option>
                ))}
            </select>
          </div>

          <button
            className={styles.switchButton}
            onClick={() => setModoBusqueda((p) => !p)}
            type="button"
          >
            {modoBusqueda ? '📂 Ver por capítulos' : '🔍 Modo búsqueda global'}
          </button>
        </div>

        {alerta && <div className={styles.alert}>{alerta}</div>}
      </div>

      {modoBusqueda ? (
        <>
          <div className={styles.searchBar} role="search" aria-label="Buscar práctica">
            <span className={styles.searchIcon} aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18">
                <path
                  fill="currentColor"
                  d="M10 4a6 6 0 104.472 10.03l3.749 3.75a1 1 0 001.414-1.415l-3.75-3.75A6 6 0 0010 4zm0 2a4 4 0 110 8 4 4 0 010-8z"
                />
              </svg>
            </span>

            <input
              type="text"
              className={styles.searchInput}
              placeholder="Buscar por código o descripción…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              inputMode="search"
            />

            {query.trim() && (
              <button
                type="button"
                className={styles.clearBtn}
                onClick={() => setQuery('')}
                aria-label="Limpiar búsqueda"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* ------ VISTA MOBILE (tarjetas) ------ */}
          <div className={styles.mobileList}>
            {resultadosGlobales.length === 0 ? (
              <div className={styles.noResults}>Sin resultados.</div>
            ) : (
              resultadosGlobales.map((it) => {
                const calc = getCalculo(it);
                const key = it.__key ?? `${it.capitulo}|${it.codigo}`;

                return (
                  <article
                    key={key}
                    className={`${styles.card} ${isRadiografia(it) ? styles.rxCard : ''} ${
                      isSubsiguiente(it) ? styles.subsiguienteCard : ''
                    }`}
                  >
                    <div className={styles.cardTop}>
                      <div className={styles.code}>{highlight(it.codigo, query)}</div>
                      <span className={styles.capBadge}>{capLabel(it)}</span>
                    </div>

                    <div className={styles.desc}>{highlight(it.descripcion, query)}</div>

                    <div className={styles.costGrid}>
                      <div className={styles.costBox}>
                        <span className={styles.costLabel}>Honorario</span>
                        <span className={styles.costValue}>{money(calc.honorarioMedico)}</span>
                      </div>

                      <div className={styles.costBox}>
                        <span className={styles.costLabel}>Gasto</span>
                        <span className={styles.costValue}>{money(calc.gastoSanatorial)}</span>
                      </div>

                      <div className={styles.costBox}>
                        <span className={styles.costLabel}>Total</span>
                        <span className={styles.costValue}>{money(calc.total)}</span>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {/* ------ VISTA ESCRITORIO (tabla) ------ */}
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
                  <tr>
                    <td colSpan={6} className={styles.noResultsCell}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  resultadosGlobales.map((it) => {
                    const calc = getCalculo(it);
                    const key = it.__key ?? `${it.capitulo}|${it.codigo}`;

                    return (
                      <tr
                        key={key}
                        className={`${isRadiografia(it) ? styles.rxRow : ''} ${
                          isSubsiguiente(it) ? styles.subsiguienteRow : ''
                        }`}
                      >
                        <td className={styles.codeCell}>{highlight(it.codigo, query)}</td>
                        <td className={styles.descCell}>{highlight(it.descripcion, query)}</td>
                        <td>
                          <span className={styles.capBadge}>{capLabel(it)}</span>
                        </td>

                        <td className={styles.tdNumeric}>
                          <span className={styles.valueBig}>{money(calc.honorarioMedico)}</span>
                        </td>

                        <td className={styles.tdNumeric}>
                          <span className={styles.valueBig}>{money(calc.gastoSanatorial)}</span>
                        </td>

                        <td className={styles.tdNumeric}>
                          <span className={styles.valueBig}>{money(calc.total)}</span>
                        </td>
                      </tr>
                    );
                  })
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
            spellCheck={false}
            inputMode="search"
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
                      autoComplete="off"
                      spellCheck={false}
                      inputMode="search"
                    />

                    <div className={styles.mobileList}>
                      {practicasFiltradas.length === 0 ? (
                        <div className={styles.noResults}>Sin resultados.</div>
                      ) : (
                        practicasFiltradas.map((it, j) => {
                          const itFull = { ...it, capitulo: c.capitulo, capituloNombre: c.descripcion };
                          const calc = getCalculo(itFull);
                          const key = `${String(c.capitulo).trim()}|${String(it.codigo).trim()}#${j + 1}`;

                          return (
                            <article
                              key={key}
                              className={`${styles.card} ${isRadiografia(itFull) ? styles.rxCard : ''} ${
                                isSubsiguiente(itFull) ? styles.subsiguienteCard : ''
                              }`}
                            >
                              <div className={styles.cardTop}>
                                <div className={styles.code}>{highlight(itFull.codigo, qLocal)}</div>
                                <span className={styles.capBadge}>
                                  {c.capitulo} – {c.descripcion}
                                </span>
                              </div>

                              <div className={styles.desc}>{highlight(itFull.descripcion, qLocal)}</div>

                              <div className={styles.costGrid}>
                                <div className={styles.costBox}>
                                  <span className={styles.costLabel}>Honorario</span>
                                  <span className={styles.costValue}>{money(calc.honorarioMedico)}</span>
                                </div>

                                <div className={styles.costBox}>
                                  <span className={styles.costLabel}>Gasto</span>
                                  <span className={styles.costValue}>{money(calc.gastoSanatorial)}</span>
                                </div>

                                <div className={styles.costBox}>
                                  <span className={styles.costLabel}>Total</span>
                                  <span className={styles.costValue}>{money(calc.total)}</span>
                                </div>
                              </div>
                            </article>
                          );
                        })
                      )}
                    </div>

                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th className={styles.thNumeric}>Honorario</th>
                            <th className={styles.thNumeric}>Gasto</th>
                            <th className={styles.thNumeric}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {practicasFiltradas.length === 0 ? (
                            <tr>
                              <td colSpan={5} className={styles.noResultsCell}>
                                Sin resultados.
                              </td>
                            </tr>
                          ) : (
                            practicasFiltradas.map((it, j) => {
                              const itFull = { ...it, capitulo: c.capitulo, capituloNombre: c.descripcion };
                              const calc = getCalculo(itFull);
                              const key = `${String(c.capitulo).trim()}|${String(it.codigo).trim()}#${j + 1}`;

                              return (
                                <tr
                                  key={key}
                                  className={`${isRadiografia(itFull) ? styles.rxRow : ''} ${
                                    isSubsiguiente(itFull) ? styles.subsiguienteRow : ''
                                  }`}
                                >
                                  <td className={styles.codeCell}>{highlight(itFull.codigo, qLocal)}</td>
                                  <td className={styles.descCell}>{highlight(itFull.descripcion, qLocal)}</td>

                                  <td className={styles.tdNumeric}>
                                    <span className={styles.valueBig}>{money(calc.honorarioMedico)}</span>
                                  </td>

                                  <td className={styles.tdNumeric}>
                                    <span className={styles.valueBig}>{money(calc.gastoSanatorial)}</span>
                                  </td>

                                  <td className={styles.tdNumeric}>
                                    <span className={styles.valueBig}>{money(calc.total)}</span>
                                  </td>
                                </tr>
                              );
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
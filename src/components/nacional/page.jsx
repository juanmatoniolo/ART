'use client';

import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import Fuse from 'fuse.js';
import styles from './page.module.css';

/* ================= Utils ================= */
const normalize = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function highlight(text, q) {
  if (!text || !q) return text;
  const safe = escapeRegExp(q);
  const regex = new RegExp(`(${safe})`, 'gi');
  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    part.toLowerCase() === String(q).toLowerCase() ? (
      <mark key={i} className={styles.highlight}>
        {part}
      </mark>
    ) : (
      part
    )
  );
}

const parseNumber = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;

  let s = String(val).trim();
  s = s.replace(/[^\d.,-]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma) {
    s = s.replace(/\./g, '').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  if (hasDot) {
    const dotCount = (s.match(/\./g) || []).length;

    if (dotCount === 1 && /^\-?\d+(\.\d{1,2})$/.test(s)) {
      const n = parseFloat(s);
      return Number.isFinite(n) ? n : 0;
    }

    s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const money = (n) => {
  if (typeof n !== 'number' || !Number.isFinite(n)) return '—';
  return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const isRadiografia = (item) => {
  const d = normalize(item?.descripcion);
  return d.includes('radiograf') || d.includes('rx');
};

const isSubsiguiente = (item) => {
  const d = normalize(item?.descripcion);
  return d.includes('por exposicion subsiguiente') || d.includes('por exposición subsiguiente');
};

const vincularSubsiguientes = (item, data) => {
  const idx = data.findIndex((d) => (item.__key ? d.__key === item.__key : d.codigo === item.codigo));
  if (idx === -1) return [item];

  const prev = data[idx - 1];
  const next = data[idx + 1];

  if (isSubsiguiente(item) && prev) return [prev, item];
  if (next && isSubsiguiente(next)) return [item, next];
  return [item];
};

// ✅ Solo para mostrar (no cambia el value real)
const formatConvenioLabel = (s) =>
  String(s ?? '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function NomencladorNacional() {
  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);

  const [filtroCapitulo, setFiltroCapitulo] = useState('');
  const [capituloQueries, setCapituloQueries] = useState({});

  const [convenios, setConvenios] = useState({});
  const [convenioSel, setConvenioSel] = useState('');
  const [alerta, setAlerta] = useState('');

  // Valores del convenio
  const [gastoRx, setGastoRx] = useState(0);
  const [galenoRxPractica, setGalenoRxPractica] = useState(0);
  const [gastoOperatorio, setGastoOperatorio] = useState(0);
  const [galenoQuir, setGalenoQuir] = useState(0);
  const [diaPension, setDiaPension] = useState(0);
  const [otrosGastos, setOtrosGastos] = useState(0);

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

  useEffect(() => {
    if (!convenioSel || !convenios[convenioSel]) return;
    const vg = convenios[convenioSel]?.valores_generales || {};

    const pick = (keys) => {
      for (const k of keys) {
        if (vg[k] != null && vg[k] !== '') return vg[k];
      }
      return null;
    };

    const gastoRaw = pick(['Gasto_Rx', 'Gastos_Rx', 'Gasto Rx', 'Gastos Rx']);
    const galenoRaw = pick([
      'Galeno_Rx_Practica',
      'Galeno_Rx_y_Practica',
      'Galeno Rx Practica',
      'Galeno Rx y Practica',
    ]);
    const gastoOpRaw = pick(['Gasto_Operatorio', 'Gasto Operatorio', 'Gastos Operatorios']);
    const galenoQuirRaw = pick(['Galeno_Quir', 'Galeno Quir', 'Galeno Quirúrgico', 'Galeno Quirurgico']);
    const pensionRaw = pick(['Pension', 'pension', 'Dia_Pension', 'Día_Pensión', 'Dia Pension', 'Día Pension']);
    const otrosGastosRaw = pick(['Otros_Gastos', 'Otros gastos', 'Otros_Gastos_Medicos', 'Otros Gastos Medicos']);

    setGastoRx(parseNumber(gastoRaw));
    setGalenoRxPractica(parseNumber(galenoRaw));
    setGastoOperatorio(parseNumber(gastoOpRaw));
    setGalenoQuir(parseNumber(galenoQuirRaw));
    setDiaPension(parseNumber(pensionRaw));
    setOtrosGastos(parseNumber(otrosGastosRaw));

    localStorage.setItem('convenioActivo', convenioSel);
  }, [convenioSel, convenios]);

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

  const resultadosGlobales = useMemo(() => {
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

  const computeExtras = (it) => {
    const gto = parseNumber(it.gto);
    const gal = parseNumber(it.q_gal);

    const capituloNum = Number(String(it.capitulo ?? '').replace(/\D/g, '')) || 0;
    const capituloNombre = it.capituloNombre ?? '';

    const esCapitulo34 =
      normalize(capituloNombre).includes('radiologia') ||
      normalize(capituloNombre).includes('diagnostico por imagenes') ||
      normalize(capituloNombre).includes('diagnóstico por imagenes');

    const esCap12o13 = capituloNum === 12 || capituloNum === 13;

    let extraGal = null;
    let extraGto = null;

    if (esCapitulo34) {
      const gastoOp = (gastoRx * gto) / 2;
      const honorario = galenoRxPractica * gal + gastoOp;
      extraGal = honorario;
      extraGto = gastoOp;
    }

    if (esCap12o13) {
      extraGal = galenoQuir * gal;
      extraGto = gastoOperatorio * gto;
    }

    return { gal, gto, extraGal, extraGto };
  };

  const capLabel = (it) => `${it.capitulo} – ${it.capituloNombre}`;

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
        </div>
        {/* ✅ toolbar ahora aguanta sidebar expandido */}
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
          {/* ✅ Buscador prolijo, barra */}
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

          {/* Mobile cards */}
          <div className={styles.mobileList}>
            {resultadosGlobales.length === 0 ? (
              <div className={styles.noResults}>Sin resultados.</div>
            ) : (
              resultadosGlobales.map((it) => {
                const { gal, gto, extraGal, extraGto } = computeExtras(it);
                const key = it.__key ?? `${it.capitulo}|${it.codigo}`;

                return (
                  <article
                    key={key}
                    className={`${styles.card} ${isRadiografia(it) ? styles.rxCard : ''} ${isSubsiguiente(it) ? styles.subsiguienteCard : ''
                      }`}
                  >
                    <div className={styles.cardTop}>
                      <div className={styles.code}>{highlight(it.codigo, query)}</div>
                      <span className={styles.capBadge}>{capLabel(it)}</span>
                    </div>

                    <div className={styles.desc}>{highlight(it.descripcion, query)}</div>

                    <div className={styles.costGrid}>
                      <div className={styles.costBox}>
                        <span className={styles.costLabel}>GAL</span>
                        <span className={styles.costValue}>{money(gal)}</span>
                        {extraGal != null && <span className={styles.subValue}>${money(extraGal)}</span>}
                      </div>

                      <div className={styles.costBox}>
                        <span className={styles.costLabel}>GTO</span>
                        <span className={styles.costValue}>{money(gto)}</span>
                        {extraGto != null && <span className={styles.subValue}>${money(extraGto)}</span>}
                      </div>
                    </div>
                  </article>
                );
              })
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
                  <th className={styles.thNumeric}>GAL</th>
                  <th className={styles.thNumeric}>GTO</th>
                </tr>
              </thead>
              <tbody>
                {resultadosGlobales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.noResultsCell}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  resultadosGlobales.map((it) => {
                    const { gal, gto, extraGal, extraGto } = computeExtras(it);
                    const key = it.__key ?? `${it.capitulo}|${it.codigo}`;

                    return (
                      <tr
                        key={key}
                        className={`${isRadiografia(it) ? styles.rxRow : ''} ${isSubsiguiente(it) ? styles.subsiguienteRow : ''
                          }`}
                      >
                        <td className={styles.codeCell}>{highlight(it.codigo, query)}</td>
                        <td className={styles.descCell}>{highlight(it.descripcion, query)}</td>
                        <td>
                          <span className={styles.capBadge}>{capLabel(it)}</span>
                        </td>

                        <td className={styles.tdNumeric}>
                          <span className={styles.mainValue}>{money(gal)}</span>
                          {extraGal != null && (
                            <div className={styles.extraWrapper}>
                              <span className={styles.subValue}>${money(extraGal)}</span>
                            </div>
                          )}
                        </td>

                        <td className={styles.tdNumeric}>
                          <span className={styles.mainValue}>{money(gto)}</span>
                          {extraGto != null && (
                            <div className={styles.extraWrapper}>
                              <span className={styles.subValue}>${money(extraGto)}</span>
                            </div>
                          )}
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
          {/* (tu modo capítulos queda igual) */}
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

                    {/* resto igual */}
                    <div className={styles.mobileList}>
                      {practicasFiltradas.length === 0 ? (
                        <div className={styles.noResults}>Sin resultados.</div>
                      ) : (
                        practicasFiltradas.map((it, j) => {
                          const itFull = { ...it, capitulo: c.capitulo, capituloNombre: c.descripcion };
                          const { gal, gto, extraGal, extraGto } = computeExtras(itFull);
                          const key = `${String(c.capitulo).trim()}|${String(it.codigo).trim()}#${j + 1}`;

                          return (
                            <article
                              key={key}
                              className={`${styles.card} ${isRadiografia(itFull) ? styles.rxCard : ''} ${isSubsiguiente(itFull) ? styles.subsiguienteCard : ''
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
                                  <span className={styles.costLabel}>GAL</span>
                                  <span className={styles.costValue}>{money(gal)}</span>
                                  {extraGal != null && <span className={styles.subValue}>${money(extraGal)}</span>}
                                </div>

                                <div className={styles.costBox}>
                                  <span className={styles.costLabel}>GTO</span>
                                  <span className={styles.costValue}>{money(gto)}</span>
                                  {extraGto != null && <span className={styles.subValue}>${money(extraGto)}</span>}
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
                            <th className={styles.thNumeric}>GAL</th>
                            <th className={styles.thNumeric}>GTO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {practicasFiltradas.length === 0 ? (
                            <tr>
                              <td colSpan={4} className={styles.noResultsCell}>
                                Sin resultados.
                              </td>
                            </tr>
                          ) : (
                            practicasFiltradas.map((it, j) => {
                              const itFull = { ...it, capitulo: c.capitulo, capituloNombre: c.descripcion };
                              const { gal, gto, extraGal, extraGto } = computeExtras(itFull);
                              const key = `${String(c.capitulo).trim()}|${String(it.codigo).trim()}#${j + 1}`;

                              return (
                                <tr
                                  key={key}
                                  className={`${isRadiografia(itFull) ? styles.rxRow : ''} ${isSubsiguiente(itFull) ? styles.subsiguienteRow : ''
                                    }`}
                                >
                                  <td className={styles.codeCell}>{highlight(itFull.codigo, qLocal)}</td>
                                  <td className={styles.descCell}>{highlight(itFull.descripcion, qLocal)}</td>

                                  <td className={styles.tdNumeric}>
                                    <span className={styles.mainValue}>{money(gal)}</span>
                                    {extraGal != null && (
                                      <div className={styles.extraWrapper}>
                                        <span className={styles.subValue}>${money(extraGal)}</span>
                                      </div>
                                    )}
                                  </td>

                                  <td className={styles.tdNumeric}>
                                    <span className={styles.mainValue}>{money(gto)}</span>
                                    {extraGto != null && (
                                      <div className={styles.extraWrapper}>
                                        <span className={styles.subValue}>${money(extraGto)}</span>
                                      </div>
                                    )}
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

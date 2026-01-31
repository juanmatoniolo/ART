'use client';

import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import Fuse from 'fuse.js';
import styles from './facturacion.module.css';

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

/* ================= Componente Principal ================= */
export default function PracticasModule({ 
  practicasAgregadas, 
  agregarPractica, 
  onAtras, 
  onSiguiente 
}) {
  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [filtroCapitulo, setFiltroCapitulo] = useState('');
  const [capituloQueries, setCapituloQueries] = useState({});
  const [loading, setLoading] = useState(true);

  // Firebase
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

  /* === CARGA JSON BASE (con __key único) === */
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
              __key: `${base}#${n}`, // ✅ key única
            };
          })
        );

        setData(flat);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error cargando JSON:', err);
        setAlerta('No se pudo cargar el Nomenclador Nacional.');
        setLoading(false);
      });
  }, []);

  /* === CONVENIOS FIREBASE === */
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

  /* === FACTORES SEGÚN CONVENIO === */
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

  /* === FUSE (global) === */
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

  /* === BUSCADOR GLOBAL === */
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

    const unique = Array.from(new Map(results.map((it) => [it.__key ?? `${it.capitulo}|${it.codigo}`, it])).values());

    // RX arriba
    return unique.sort((a, b) => (isRadiografia(a) ? 0 : 1) - (isRadiografia(b) ? 0 : 1));
  }, [query, data, fuseGlobal]);

  /* === COSTOS + EXTRAS (Cap 34 y Cap 12/13) === */
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

  /* === AGREGAR PRÁCTICA === */
  const handleAgregar = (practica) => {
    const { gal, gto, extraGal, extraGto } = computeExtras(practica);
    
    // NO calculamos ningún valor total, solo pasamos los datos
    const nuevaPractica = {
      id: `pract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...practica,
      // Solo pasamos los valores calculados para referencia
      valoresCalculados: {
        gal: gal,
        gto: gto,
        extraGal: extraGal,
        extraGto: extraGto,
        esRadiografia: isRadiografia(practica),
        esSubsiguiente: isSubsiguiente(practica),
        esCap34: normalize(practica.capituloNombre ?? '').includes('radiologia') ||
                normalize(practica.capituloNombre ?? '').includes('diagnostico por imagenes'),
        esCap12o13: Number(String(practica.capitulo ?? '').replace(/\D/g, '')) === 12 ||
                   Number(String(practica.capitulo ?? '').replace(/\D/g, '')) === 13
      },
      // Valores del convenio para referencia futura
      convenio: convenioSel,
      valoresConvenio: {
        gastoRx,
        galenoRxPractica,
        gastoOperatorio,
        galenoQuir,
        diaPension,
        otrosGastos
      }
    };
    
    agregarPractica(nuevaPractica);
  };

  const capLabel = (it) => `${it.capitulo} – ${it.capituloNombre}`;

  /* === RENDER ITEM === */
  const renderItem = (item, isMobile = false, queryLocal = '') => {
    const { gal, gto, extraGal, extraGto } = computeExtras(item);
    const key = item.__key ?? `${item.capitulo}|${item.codigo}`;
    const esRX = isRadiografia(item);
    const esSubs = isSubsiguiente(item);

    if (isMobile) {
      return (
        <article
          key={key}
          className={`${styles.card} ${esRX ? styles.rxCard : ''} ${esSubs ? styles.subsiguienteCard : ''}`}
        >
          <div className={styles.cardTop}>
            <div className={styles.code}>{highlight(item.codigo, queryLocal || query)}</div>
            <span className={styles.capBadge}>{capLabel(item)}</span>
          </div>

          <div className={styles.desc}>{highlight(item.descripcion, queryLocal || query)}</div>

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

    // Desktop table row
    return (
      <tr
        key={key}
        className={`${esRX ? styles.rxRow : ''} ${esSubs ? styles.subsiguienteRow : ''}`}
      >
        <td>{highlight(item.codigo, queryLocal || query)}</td>
        <td className={styles.descCell}>{highlight(item.descripcion, queryLocal || query)}</td>
        <td>
          <span className={styles.capBadge}>{capLabel(item)}</span>
        </td>
        <td className={styles.numeric}>
          {money(gal)}
          {extraGal != null && <div className={styles.subValue}>${money(extraGal)}</div>}
        </td>
        <td className={styles.numeric}>
          {money(gto)}
          {extraGto != null && <div className={styles.subValue}>${money(extraGto)}</div>}
        </td>
        <td>
          <button
            onClick={() => handleAgregar(item)}
            className={styles.btnAgregarTabla}
            title="Agregar a factura"
          >
            ➕
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.tabContent}>
      <h2>🏥 Prácticas Médicas</h2>

      {/* Header similar al original */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <button className={styles.switchButton} onClick={() => setModoBusqueda((p) => !p)}>
            {modoBusqueda ? '📂 Ver por capítulos' : '🔍 Modo búsqueda global'}
          </button>
        </div>

        <div className={styles.filters}>
          <div className={styles.controlBlock}>
            <label className={styles.label}>Convenio</label>
            <select
              className={styles.select}
              value={convenioSel}
              onChange={(e) => setConvenioSel(e.target.value)}
            >
              {Object.keys(convenios)
                .sort()
                .map((k) => (
                  <option key={k} value={k}>
                    {k}
                  </option>
                ))}
            </select>
          </div>

          <div className={styles.badges}>
            <span className={`${styles.badge} ${styles.badgeGreen}`}>Gasto Rx: {money(gastoRx)}</span>
            <span className={`${styles.badge} ${styles.badgeBlue}`}>Galeno Rx: {money(galenoRxPractica)}</span>
            <span className={`${styles.badge} ${styles.badgePurple}`}>Gasto Op: {money(gastoOperatorio)}</span>
            <span className={`${styles.badge} ${styles.badgeOrange}`}>Galeno Quir: {money(galenoQuir)}</span>
            <span className={`${styles.badge} ${styles.badgeTeal}`}>Pensión: {money(diaPension)}</span>
            <span className={`${styles.badge} ${styles.badgeGray}`}>Otros gastos: {money(otrosGastos)}</span>
          </div>
        </div>

        {alerta && <div className={styles.alert}>{alerta}</div>}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <p>Cargando prácticas...</p>
        </div>
      ) : modoBusqueda ? (
        <>
          <input
            type="text"
            className={styles.input}
            placeholder="Buscar código o descripción…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            inputMode="search"
          />

          <div className={styles.buscadorInfo}>
            {resultadosGlobales.length} prácticas encontradas
            {query && ` para "${query}"`}
          </div>

          {/* Mobile cards */}
          <div className={styles.mobileList}>
            {resultadosGlobales.length === 0 ? (
              <div className={styles.noResults}>
                {query ? `No hay resultados para "${query}"` : 'Ingrese un término de búsqueda'}
              </div>
            ) : (
              resultadosGlobales.map((item) => renderItem(item, true))
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
                  <th className={styles.numeric}>GAL</th>
                  <th className={styles.numeric}>GTO</th>
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
              const practicas = data.filter(p => p.capitulo === c.capitulo);
              const qLocal = capituloQueries[c.capitulo] || '';
              const qLocalNorm = normalize(qLocal);

              const practicasFiltradas =
                qLocal.trim().length === 0
                  ? practicas
                  : practicas.filter((p) => normalize(`${p.codigo} ${p.descripcion}`).includes(qLocalNorm));

              return (
                <details key={String(c.capitulo)} className={styles.accordion}>
                  <summary className={styles.accordionHeader}>
                    {c.capitulo} — {c.descripcion} ({practicasFiltradas.length})
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

                    {/* Mobile cards */}
                    <div className={styles.mobileList}>
                      {practicasFiltradas.length === 0 ? (
                        <div className={styles.noResults}>Sin resultados en este capítulo.</div>
                      ) : (
                        practicasFiltradas.map((item, j) => {
                          const key = `${String(c.capitulo).trim()}|${String(item.codigo).trim()}#${j + 1}`;
                          const itemWithKey = { ...item, __key: key };
                          return renderItem(itemWithKey, true, qLocal);
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
                            <th className={styles.numeric}>GAL</th>
                            <th className={styles.numeric}>GTO</th>
                            <th>Agregar</th>
                          </tr>
                        </thead>
                        <tbody>
                          {practicasFiltradas.length === 0 ? (
                            <tr>
                              <td colSpan={5} className={styles.noResultsCell}>
                                Sin resultados en este capítulo.
                              </td>
                            </tr>
                          ) : (
                            practicasFiltradas.map((item, j) => {
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

      {/* Navegación */}
      <div className={styles.botonesNavegacion}>
        <button 
          className={styles.btnAtras}
          onClick={onAtras}
        >
          ← Atrás
        </button>
        <button 
          className={styles.btnSiguiente}
          onClick={onSiguiente}
        >
          Siguiente → Laboratorios
        </button>
      </div>
    </div>
  );
}
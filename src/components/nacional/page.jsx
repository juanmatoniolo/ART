'use client';
import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import Fuse from 'fuse.js';
import styles from './page.module.css';

const normalize = (s) =>
  (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const money = (n) =>
  typeof n === 'number'
    ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : n || '—';

const isRadiografia = (item) => {
  const d = normalize(item?.descripcion);
  return d.includes('radiograf') || d.includes('rx');
};

const isSubsiguiente = (item) =>
  normalize(item?.descripcion).includes('por exposicion subsiguiente') ||
  normalize(item?.descripcion).includes('por exposición subsiguiente');

// 🔹 Vincula práctica con su compañera (subsiguiente o principal)
const vincularSubsiguientes = (item, data) => {
  const idx = data.findIndex((d) => d.codigo === item.codigo);
  if (idx === -1) return [item];

  const prev = data[idx - 1];
  const next = data[idx + 1];

  if (isSubsiguiente(item) && prev) return [prev, item];
  if (next && isSubsiguiente(next)) return [item, next];

  return [item];
};

function highlight(text, q) {
  if (!q) return text;
  const t = text?.toString() ?? '';
  const qN = normalize(q);
  const tN = normalize(t);
  const idx = tN.indexOf(qN);
  if (idx === -1) return t;
  const before = t.slice(0, idx);
  const match = t.slice(idx, idx + q.length);
  const after = t.slice(idx + q.length);
  return (
    <>
      {before}
      <mark className={styles.highlight}>{match}</mark>
      {after}
    </>
  );
}

export default function NomencladorNacional() {
  const [data, setData] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [filtroCapitulo, setFiltroCapitulo] = useState('');
  const [capituloQueries, setCapituloQueries] = useState({});
  const [convenios, setConvenios] = useState({});
  const [convenioSel, setConvenioSel] = useState('');
  const [gastoRx, setGastoRx] = useState(0);
  const [galenoRxPractica, setGalenoRxPractica] = useState(0);
  const [alerta, setAlerta] = useState('');

  // === CARGA JSON BASE ===
  useEffect(() => {
    fetch('/archivos/NomecladorNacional.json')
      .then((res) => res.json())
      .then((json) => {
        setCapitulos(json);
        const flat = json.flatMap((c) =>
          (c.practicas || []).map((p) => ({
            ...p,
            capitulo: c.capitulo,
            capituloNombre: c.descripcion,
          }))
        );
        setData(flat);
      })
      .catch((err) => console.error('Error cargando JSON:', err));
  }, []);

  // === ESCUCHA DE CONVENIOS FIREBASE ===
  useEffect(() => {
    const conveniosRef = ref(db, 'convenios');
    const off = onValue(conveniosRef, (snap) => {
      const val = snap.exists() ? snap.val() : {};

      // Limpia claves con espacios accidentales
      const normalizado = Object.keys(val).reduce((acc, key) => {
        const cleanKey = key.trim();
        acc[cleanKey] = val[key];
        return acc;
      }, {});

      setConvenios(normalizado);

      const stored = localStorage.getItem('convenioActivo');
      const elegir =
        stored && normalizado[stored] ? stored : Object.keys(normalizado)[0] || '';
      setConvenioSel(elegir);
    });

    return () => off();
  }, []);

  // === ACTUALIZA FACTORES SEGÚN CONVENIO ===
  useEffect(() => {
    if (!convenioSel || !convenios[convenioSel]) return;

    const vg = convenios[convenioSel]?.valores_generales || {};
    const gastoRaw = vg['Gasto Rx'] ?? vg['Gastos Rx'];
    const galenoRaw = vg['Galeno Rx Practica'] ?? vg['Galeno Rx y Practica'];

    let updated = false;

    if (gastoRaw != null && !isNaN(gastoRaw)) {
      setGastoRx(Number(gastoRaw));
      updated = true;
    }

    if (galenoRaw != null && !isNaN(galenoRaw)) {
      setGalenoRxPractica(Number(galenoRaw));
      updated = true;
    }

    if (!updated) {
      setAlerta(`⚠️ El convenio "${convenioSel}" no tiene valores definidos de Rx.`);
      setTimeout(() => setAlerta(''), 5000);
    }

    localStorage.setItem('convenioActivo', convenioSel);
  }, [convenioSel, convenios]);

  // === BUSCADOR GLOBAL ===
  const resultadosGlobales = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    const exact = data.filter(
      (it) =>
        it.codigo?.toString().toLowerCase() === q.toLowerCase() ||
        normalize(it.descripcion).includes(normalize(q))
    );

    let results = [];

    if (exact.length > 0) {
      for (const it of exact) results.push(...vincularSubsiguientes(it, data));
    } else {
      const fuse = new Fuse(data, {
        keys: ['descripcion', 'codigo', 'capitulo', 'capituloNombre'],
        includeScore: true,
        threshold: 0.1,
        ignoreLocation: true,
      });

      const found = fuse.search(q).map((r) => r.item);
      for (const it of found) results.push(...vincularSubsiguientes(it, data));
    }

    const unique = Array.from(new Map(results.map((it) => [it.codigo, it])).values());

    return unique.sort((a, b) => {
      const ar = isRadiografia(a) ? 0 : 1;
      const br = isRadiografia(b) ? 0 : 1;
      return ar - br;
    });
  }, [query, data]);

  // === COSTOS (solo aplica cálculo especial en capítulo 34) ===
  const renderCosts = (it) => {
    const gto = Number(it.gto) || 0;
    const gal = Number(it.q_gal) || 0;

    const esCapitulo34 =
      normalize(it.capituloNombre).includes('radiologia') ||
      normalize(it.capituloNombre).includes('diagnostico por imagenes');

    let totalGal = null;
    let totalGto = null;

    if (esCapitulo34) {
      totalGal = gal * (galenoRxPractica || 0) + (gto * (gastoRx || 0)) / 2;
      totalGto = (gto * (gastoRx || 0)) / 2;
    }

    return (
      <>
        <td className={styles.numeric}>
          {money(gal)}
          {esCapitulo34 && (
            <div className={styles.subValue}>${money(totalGal)}</div>
          )}
        </td>
        <td className={styles.numeric}>
          {money(gto)}
          {esCapitulo34 && (
            <div className={styles.subValue}>${money(totalGto)}</div>
          )}
        </td>
      </>
    );
  };

  // === FILTRAR POR CAPÍTULO ===
  const filtrarCapitulo = (cap, practicas) => {
    const term = capituloQueries[cap]?.trim();
    if (!term) return practicas;

    const fuse = new Fuse(practicas, {
      keys: ['descripcion', 'codigo'],
      includeScore: true,
      threshold: 0.1,
    });

    const found = fuse.search(term).map((r) => r.item);
    let results = [];

    for (const it of found) results.push(...vincularSubsiguientes(it, practicas));

    return Array.from(new Map(results.map((it) => [it.codigo, it])).values());
  };

  // === RENDER ===
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Nomenclador Nacional</h2>

        <div className={styles.filters}>
          <label>Convenio:</label>
          <select
            className={styles.select}
            value={convenioSel}
            onChange={(e) => setConvenioSel(e.target.value)}
          >
            {Object.keys(convenios)
              .sort()
              .map((k) => (
                <option key={k}>{k}</option>
              ))}
          </select>
          <span className={styles.badgeGreen}>Gasto Rx: {gastoRx || '—'}</span>
          <span className={styles.badgeBlue}>Galeno Rx: {galenoRxPractica || '—'}</span>
        </div>

        {alerta && <div className={styles.alert}>{alerta}</div>}

        <button className={styles.switchButton} onClick={() => setModoBusqueda((p) => !p)}>
          {modoBusqueda ? '📂 Ver por capítulos' : '🔍 Modo búsqueda global'}
        </button>
      </div>

      {modoBusqueda ? (
        <>
          <input
            type="text"
            className={styles.input}
            placeholder="Buscar código o descripción..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Capítulo</th>
                  <th>GAL</th>
                  <th>GTO</th>
                </tr>
              </thead>
              <tbody>
                {resultadosGlobales.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.noResults}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  resultadosGlobales.map((it, i) => (
                    <tr
                      key={i}
                      className={`${isRadiografia(it) ? styles.rxRow : ''} ${
                        isSubsiguiente(it) ? styles.subsiguiente : ''
                      }`}
                    >
                      <td>{highlight(it.codigo, query)}</td>
                      <td>{highlight(it.descripcion, query)}</td>
                      <td>
                        <span className={styles.capBadge}>
                          {it.capitulo} – {it.capituloNombre}
                        </span>
                      </td>
                      {renderCosts(it)}
                    </tr>
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
            placeholder="Buscar capítulo..."
            value={filtroCapitulo}
            onChange={(e) => setFiltroCapitulo(e.target.value)}
          />

          {capitulos
            .filter(
              (c) =>
                !filtroCapitulo ||
                c.descripcion.toLowerCase().includes(filtroCapitulo.toLowerCase()) ||
                c.capitulo.includes(filtroCapitulo)
            )
            .map((c, i) => {
              const visibles = filtrarCapitulo(c.capitulo, c.practicas);
              return (
                <details key={i} className={styles.accordion}>
                  <summary className={styles.accordionHeader}>
                    {c.capitulo} — {c.descripcion}
                  </summary>
                  <div className={styles.accordionBody}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder={`Buscar en ${c.descripcion}...`}
                      value={capituloQueries[c.capitulo] || ''}
                      onChange={(e) =>
                        setCapituloQueries((prev) => ({
                          ...prev,
                          [c.capitulo]: e.target.value,
                        }))
                      }
                    />
                    <div className={styles.tableWrapper}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>GAL</th>
                            <th>GTO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibles.length === 0 ? (
                            <tr>
                              <td colSpan={4} className={styles.noResults}>
                                Sin resultados.
                              </td>
                            </tr>
                          ) : (
                            visibles.map((it, j) => (
                              <tr
                                key={j}
                                className={`${isRadiografia(it) ? styles.rxRow : ''} ${
                                  isSubsiguiente(it) ? styles.subsiguiente : ''
                                }`}
                              >
                                <td>{it.codigo}</td>
                                <td>{it.descripcion}</td>
                                {renderCosts(it)}
                              </tr>
                            ))
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

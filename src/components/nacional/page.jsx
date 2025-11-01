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

  useEffect(() => {
    const conveniosRef = ref(db, 'convenios');
    const off = onValue(conveniosRef, (snap) => {
      const val = snap.exists() ? snap.val() : {};
      setConvenios(val);
      const stored = localStorage.getItem('convenioActivo');
      const elegir = stored && val[stored] ? stored : Object.keys(val)[0] || '';
      setConvenioSel(elegir);
    });
    return () => off();
  }, []);

  useEffect(() => {
    if (!convenioSel || !convenios[convenioSel]) {
      setGastoRx(0);
      setGalenoRxPractica(0);
      return;
    }
    const vg = convenios[convenioSel]?.valores_generales || {};
    const gasto = Number(vg['Gasto Rx'] ?? vg['Gastos Rx'] ?? 0);
    const gal = Number(vg['Galeno Rx Practica'] ?? vg['Galeno Rx y Practica'] ?? 0);
    setGastoRx(isFinite(gasto) ? gasto : 0);
    setGalenoRxPractica(isFinite(gal) ? gal : 0);
    localStorage.setItem('convenioActivo', convenioSel);
  }, [convenioSel, convenios]);

  const resultadosGlobales = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const fuse = new Fuse(data, {
      keys: ['descripcion', 'codigo', 'capitulo', 'capituloNombre'],
      includeScore: true,
      threshold: 0.3,
      ignoreLocation: true,
    });
    let results = fuse.search(q).map((r) => r.item);
    const seen = new Set();
    const enriched = [];
    for (const it of results) {
      enriched.push(it);
      seen.add(it.codigo);
      const idx = data.findIndex((d) => d.codigo === it.codigo);
      const next = data[idx + 1];
      const prev = data[idx - 1];
      if (next && isSubsiguiente(next) && !seen.has(next.codigo)) enriched.push(next);
      if (isSubsiguiente(it) && prev && !seen.has(prev.codigo)) enriched.push(prev);
    }
    return enriched.sort((a, b) => {
      const ar = isRadiografia(a) ? 0 : 1;
      const br = isRadiografia(b) ? 0 : 1;
      return ar - br;
    });
  }, [query, data]);

  const renderCosts = (it) => {
    const rx = isRadiografia(it);
    const gto = Number(it.gto) || 0;
    const gal = Number(it.q_gal) || 0;
    return (
      <>
        {/* Primero GAL */}
        <td className={styles.numeric}>
          {money(gal)}
          {rx && (galenoRxPractica || gastoRx) ? (
            <div className={styles.subValue}>
              ${money(gal * galenoRxPractica + (gto * gastoRx) / 2)}
            </div>
          ) : null}
        </td>
        {/* Luego GTO */}
        <td className={styles.numeric}>
          {money(gto)}
          {rx && gastoRx ? (
            <div className={styles.subValue}>${money((gto * gastoRx) / 2)}</div>
          ) : null}
        </td>
      </>
    );
  };

  const filtrarCapitulo = (cap, practicas) => {
    const term = capituloQueries[cap]?.trim();
    if (!term) return practicas;
    const fuse = new Fuse(practicas, {
      keys: ['descripcion', 'codigo'],
      includeScore: true,
      threshold: 0.3,
    });
    const res = fuse.search(term).map((r) => r.item);
    const seen = new Set(res.map((r) => r.codigo));
    const plus = [];
    for (const it of res) {
      const idx = practicas.findIndex((d) => d.codigo === it.codigo);
      const next = practicas[idx + 1];
      const prev = practicas[idx - 1];
      if (next && isSubsiguiente(next) && !seen.has(next.codigo)) plus.push(next);
      if (isSubsiguiente(it) && prev && !seen.has(prev.codigo)) plus.push(prev);
    }
    return [...res, ...plus];
  };

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
            {Object.keys(convenios).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <span className={styles.badgeGreen}>Gasto Rx: {gastoRx || '—'}</span>
          <span className={styles.badgeBlue}>Galeno Rx: {galenoRxPractica || '—'}</span>
        </div>

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
                  <th>Gto</th>
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
                    <tr key={i} className={isRadiografia(it) ? styles.rxRow : ''}>
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
                            <th>Gto</th>
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
                              <tr key={j} className={isRadiografia(it) ? styles.rxRow : ''}>
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

'use client';

import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '@/lib/firebase';
import Fuse from 'fuse.js';
import styles from './page.module.css';

/* ===== Utils ===== */
const normalize = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

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
      <mark style={{ backgroundColor: '#28a74555', borderRadius: '4px' }}>{match}</mark>
      {after}
    </>
  );
}

/* ===== Componente principal ===== */
export default function NomencladorNacional() {
  const [data, setData] = useState([]); // todas las prácticas aplanadas
  const [capitulos, setCapitulos] = useState([]); // estructura agrupada
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [filtroCapitulo, setFiltroCapitulo] = useState('');
  const [capituloQueries, setCapituloQueries] = useState({});

  // Convenios
  const [convenios, setConvenios] = useState({});
  const [convenioSel, setConvenioSel] = useState('');
  const [gastoRx, setGastoRx] = useState(0);
  const [galenoRxPractica, setGalenoRxPractica] = useState(0);

  /* === 1️⃣ Cargar JSON corregido === */
  useEffect(() => {
    fetch('/archivos/NomecladorNacional.json')
      .then((res) => res.json())
      .then((json) => {
        setCapitulos(json);
        // aplanar prácticas
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

  /* === 2️⃣ Cargar convenios desde Firebase === */
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

  /* === 3️⃣ Búsqueda global === */
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

    // Enriquecer con subsiguientes
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

    // Ordenar RX primero
    return enriched.sort((a, b) => {
      const ar = isRadiografia(a) ? 0 : 1;
      const br = isRadiografia(b) ? 0 : 1;
      return ar - br;
    });
  }, [query, data]);

  /* === 4️⃣ Calcular costos (solo RX) === */
  const renderCosts = (it) => {
    const rx = isRadiografia(it);
    const gto = Number(it.gto) || 0;
    const gal = Number(it.q_gal) || 0;
    return (
      <>
        <td className="text-end">
          {money(gto)}
          {rx && gastoRx ? (
            <div className="small opacity-75">${money((gto * gastoRx) / 2)}</div>
          ) : null}
        </td>
        <td className="text-end">
          {money(gal)}
          {rx && (galenoRxPractica || gastoRx) ? (
            <div className="small opacity-75">
              ${money(gal * galenoRxPractica + (gto * gastoRx) / 2)}
            </div>
          ) : null}
        </td>
      </>
    );
  };

  /* === 5️⃣ Filtrar dentro de capítulos === */
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

  /* === 6️⃣ Render === */
  return (
    <div className={styles.wrapper}>
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
        <h2 className={styles.title}>Nomenclador Nacional</h2>

        {/* Selector convenio */}
        <div className="d-flex align-items-center gap-2">
          <span className="text-light">Convenio:</span>
          <select
            className={`form-select ${styles.inputDark}`}
            style={{ minWidth: 280 }}
            value={convenioSel}
            onChange={(e) => setConvenioSel(e.target.value)}
          >
            {Object.keys(convenios).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
          <div className="small text-light ms-2">
            <span className="badge bg-success me-2">Gasto Rx: {gastoRx || '—'}</span>
            <span className="badge bg-info">Galeno Rx: {galenoRxPractica || '—'}</span>
          </div>
        </div>

        <button className={styles.btnSuccess} onClick={() => setModoBusqueda((p) => !p)}>
          {modoBusqueda ? '📂 Ver por capítulos' : '🔍 Modo búsqueda global'}
        </button>
      </div>

      {/* 🔍 Modo global */}
      {modoBusqueda ? (
        <>
          <input
            type="text"
            className={`form-control mb-4 ${styles.inputDark}`}
            placeholder="Buscar código o descripción..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query ? (
            <div className="table-responsive shadow-sm">
              <table className={`table table-dark table-striped ${styles.table}`}>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Capítulo</th>
                    <th className="text-end">Gto</th>
                    <th className="text-end">GAL</th>
                  </tr>
                </thead>
                <tbody>
                  {resultadosGlobales.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-4">
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
          ) : (
            <p className="text-center text-muted">Escribí para buscar...</p>
          )}
        </>
      ) : (
        /* 📂 Modo capítulos */
        <>
          <input
            type="text"
            className={`form-control mb-4 ${styles.inputDark}`}
            placeholder="Buscar capítulo..."
            value={filtroCapitulo}
            onChange={(e) => setFiltroCapitulo(e.target.value)}
          />
          <div className="accordion" id="accordionCapitulos">
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
                  <div className="accordion-item bg-dark text-light border-0 mb-2" key={i}>
                    <h2 className="accordion-header">
                      <button
                        className="accordion-button collapsed bg-dark text-light fw-bold"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapse-${i}`}
                      >
                        {c.capitulo} — {c.descripcion}
                      </button>
                    </h2>
                    <div id={`collapse-${i}`} className="accordion-collapse collapse">
                      <div className="accordion-body bg-dark text-light">
                        <input
                          type="text"
                          className={`form-control mb-3 ${styles.inputDark}`}
                          placeholder={`Buscar en ${c.descripcion}...`}
                          value={capituloQueries[c.capitulo] || ''}
                          onChange={(e) =>
                            setCapituloQueries((prev) => ({
                              ...prev,
                              [c.capitulo]: e.target.value,
                            }))
                          }
                        />
                        <div className="table-responsive">
                          <table className={`table table-dark table-striped ${styles.table}`}>
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th className="text-end">Gto</th>
                                <th className="text-end">GAL</th>
                              </tr>
                            </thead>
                            <tbody>
                              {visibles.length === 0 ? (
                                <tr>
                                  <td colSpan={4} className="text-center py-3">
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
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}

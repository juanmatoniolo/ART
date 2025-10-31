'use client';

import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import styles from './nomencladorGlobal.module.css';

const ART_FILES = {
  'PrestadoresART-Junio-Septiembre': '/archivos/PrestadoresART-Junio-Septiembre.json',
  'PrestadoresART-Octubre': '/archivos/PrestadoresART-Octubre.json',
};

const FILES = {
  nacional: '/archivos/NomecladorNacional.json',
  aoter: '/archivos/Nomeclador_AOTER.json',
  bioq: '/archivos/NomecladorBioquimica.json',
};

/* ========================
   Utils
======================== */
const normalize = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const safeReplaceAll = (str, find, rep) =>
  (str ?? '').toString().replaceAll ? str.replaceAll(find, rep) : (str ?? '').toString().split(find).join(rep);

function pickARTNumbers(valoresGenerales = {}) {
  const entries = Object.entries(valoresGenerales);
  const by = (cands) => {
    for (const [k, v] of entries) {
      const lk = k.toLowerCase();
      if (cands.some((c) => lk === c.toLowerCase())) return v;
    }
    for (const [k, v] of entries) {
      const lk = k.toLowerCase();
      if (cands.some((c) => lk.includes(c.toLowerCase()))) return v;
    }
    return null;
  };
  const ub = by(['laboratorios_nbu', 'laboratorios_nbu_t', 'nbu', 'ub', 'unidad_bioquimica']);
  const gal = by(['galeno_rx_practica', 'galeno_rx_y_practica', 'galeno', 'galenorx']);
  const gas = by(['gasto_rx', 'gastos_rx', 'gastorx', 'gasto']);
  return {
    ub: typeof ub === 'number' ? ub : null,
    galeno: typeof gal === 'number' ? gal : null,
    gasto: typeof gas === 'number' ? gas : null,
  };
}

// Detecta Radiología/Diagnóstico por Imágenes en Nacional
const isRadiologia = (item) => {
  const cap = normalize(item.capitulo || '');
  const desc = normalize(item.descripcion || '');
  if (cap.includes('imagen') || cap.includes('radiolog') || cap.includes('diagnostico')) return true;
  const kw = ['radiografia', 'ecografia', 'tomografia', 'resonancia', 'rx', 'radioterapia', 'gammagraf', 'fluorosc'];
  return kw.some((k) => desc.includes(k));
};

const money = (n, opts = {}) =>
  typeof n === 'number'
    ? n.toLocaleString('es-AR', { minimumFractionDigits: 2, ...opts })
    : null;

/* === Highlight exacto (case/acentos-insensible) === */
function highlightExact(text, query, markClass) {
  const raw = (text ?? '').toString();
  const q = (query ?? '').trim();
  if (!q) return raw;

  const tNorm = normalize(raw);
  const qNorm = normalize(q);
  if (!qNorm) return raw;

  // mapa índice-normalizado -> índice-original
  const normToOrig = [];
  let normPos = 0;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    const n = normalize(ch);
    if (n.length > 0) {
      for (let k = 0; k < n.length; k++) normToOrig[normPos++] = i;
    }
  }

  // localizar todas las apariciones exactas en el string normalizado
  const ranges = [];
  let from = 0;
  while (true) {
    const idx = tNorm.indexOf(qNorm, from);
    if (idx === -1) break;
    const start = normToOrig[idx] ?? 0;
    const end = (normToOrig[idx + qNorm.length - 1] ?? raw.length - 1) + 1; // slice end-exclusive
    ranges.push([start, end]);
    from = idx + qNorm.length;
  }
  if (ranges.length === 0) return raw;

  // construir fragment con <mark>
  const parts = [];
  let cursor = 0;
  ranges.forEach(([a, b], i) => {
    if (a > cursor) parts.push(<span key={`t-${i}-${cursor}`}>{raw.slice(cursor, a)}</span>);
    parts.push(
      <mark className={markClass} key={`m-${i}-${a}-${b}`}>
        {raw.slice(a, b)}
      </mark>
    );
    cursor = b;
  });
  if (cursor < raw.length) parts.push(<span key={`t-end-${cursor}`}>{raw.slice(cursor)}</span>);
  return <>{parts}</>;
}

/* ========================
   Componente
======================== */
export default function NomencladorGlobal() {
  const [periodoART, setPeriodoART] = useState('PrestadoresART-Octubre');

  // Valores del período ART activo
  const [galenoRx, setGalenoRx] = useState(0);
  const [gastoRx, setGastoRx] = useState(0);
  const [ubPeriodo, setUbPeriodo] = useState(0);
  const [nivelesHonor, setNivelesHonor] = useState({}); // {nivel: cirujano}

  // Data base (Nacional + AOTER + Bioquímica) y ART del período
  const [dataBase, setDataBase] = useState([]);
  const [dataART, setDataART] = useState([]);

  const [filtro, setFiltro] = useState('');
  const [soloUrgencia, setSoloUrgencia] = useState(false);

  // Paginación
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [loading, setLoading] = useState(true);
  const [loadingART, setLoadingART] = useState(true);
  const [error, setError] = useState(null);

  /* ---- Cargar NACIONAL + AOTER + BIOQ ---- */
  useEffect(() => {
    const loadAll = async () => {
      try {
        if (typeof window === 'undefined') return;
        const base = window.location.origin;

        // Nacional
        const resNac = await fetch(`${base}${FILES.nacional}`);
        if (!resNac.ok) throw new Error('Nacional no disponible');
        const nacional = await resNac.json();
        const rowsNac = (Array.isArray(nacional) ? nacional : []).map((it) => ({
          origen: 'Nacional',
          codigo: it.codigo?.toString() ?? '',
          descripcion: it.descripcion ?? '',
          capitulo: it.capitulo ?? '',
          urgencia: null,
          q_gal: typeof it.q_gal === 'number' ? it.q_gal : null,
          gto: typeof it.gto === 'number' ? it.gto : null,
          ub_units: null,
          complejidad: null,
        }));

        // AOTER
        const resAoter = await fetch(`${base}${FILES.aoter}`);
        if (!resAoter.ok) throw new Error('AOTER no disponible');
        const aoter = await resAoter.json();
        const rowsAoter = [];
        for (const bloque of aoter.practicas || []) {
          const nivel = Number(bloque.complejidad) || null;
          for (const p of bloque.practicas || []) {
            rowsAoter.push({
              origen: 'AOTER',
              codigo: p.codigo?.toString() ?? '',
              descripcion: p.descripcion ?? '',
              capitulo: '',
              urgencia: null,
              q_gal: null,
              gto: null,
              ub_units: null,
              complejidad: nivel,
            });
          }
        }

        // Bioquímica
        const resBioq = await fetch(`${base}${FILES.bioq}`);
        if (!resBioq.ok) throw new Error('Bioquímica no disponible');
        const bioq = await resBioq.json();
        const rowsBioq = (bioq.practicas || []).map((p) => ({
          origen: 'Bioquímica',
          codigo: p.codigo?.toString() ?? '',
          descripcion: p.practica_bioquimica ?? '',
          capitulo: '',
          urgencia:
            p.urgencia === true || p.urgencia === 'U'
              ? true
              : p.urgencia === false
              ? false
              : null,
          q_gal: null,
          gto: null,
          ub_units: typeof p.unidad_bioquimica === 'number' ? p.unidad_bioquimica : null,
          complejidad: null,
        }));

        setDataBase([...rowsNac, ...rowsAoter, ...rowsBioq]);
        setError(null);
      } catch (err) {
        console.error(err);
        setError('No se pudieron cargar todos los nomencladores.');
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, []);

  /* ---- Cargar convenio ART (período) ---- */
  const loadART = async (periodKey) => {
    try {
      if (typeof window === 'undefined') return;
      const base = window.location.origin;
      const res = await fetch(`${base}${ART_FILES[periodKey]}`);
      if (!res.ok) throw new Error('Convenio ART no disponible');
      const art = await res.json();

      const { ub, galeno, gasto } = pickARTNumbers(art.valores_generales || {});
      setUbPeriodo(ub || 0);
      setGalenoRx(galeno || 0);
      setGastoRx(gasto || 0);

      // niveles → honorario cirujano (para AOTER)
      const niveles = {};
      for (const nv of art.honorarios_medicos?.niveles || []) {
        const nivel = Number(nv.nivel);
        const cir = typeof nv.cirujano === 'number' ? nv.cirujano : null;
        if (nivel && cir) niveles[nivel] = cir;
      }
      setNivelesHonor(niveles);

      // Filas ART (valores directos) excluyendo UB/Galeno/Gasto
      const skip = [
        'laboratorios_nbu',
        'laboratorios_nbu_t',
        'nbu',
        'ub',
        'unidad_bioquimica',
        'galeno_rx_practica',
        'galeno_rx_y_practica',
        'galeno',
        'galenorx',
        'gasto_rx',
        'gastos_rx',
        'gastorx',
        'gasto',
      ];

      const rows = Object.entries(art.valores_generales || {})
        .filter(([k, v]) => typeof v === 'number')
        .filter(([k]) => !skip.some((s) => k.toLowerCase().includes(s)))
        .map(([k, v]) => ({
          origen: 'ART',
          codigo: k,
          descripcion: safeReplaceAll(k, '_', ' '),
          capitulo: '',
          urgencia: null,
          q_gal: null,
          gto: null,
          ub_units: null,
          complejidad: null,
          _artValor: v,
        }));

      setDataART(rows);
      setLoadingART(false);
    } catch (err) {
      console.error(err);
      setUbPeriodo(0);
      setGalenoRx(0);
      setGastoRx(0);
      setNivelesHonor({});
      setDataART([]);
      setLoadingART(false);
    }
  };

  useEffect(() => {
    setLoadingART(true);
    loadART(periodoART);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodoART]);

  /* ---- Filtros → reset de página ---- */
  useEffect(() => {
    setPage(1);
  }, [filtro, soloUrgencia, periodoART, pageSize]);

  /* ---- Data visible (base + ART) ---- */
  const dataVisible = useMemo(() => [...dataBase, ...dataART], [dataBase, dataART]);

  /* ---- Fuzzy Search con ranking ---- */
  const filtrados = useMemo(() => {
    const q = normalize(filtro.trim());
    const base = !soloUrgencia ? dataVisible : dataVisible.filter((d) => d.urgencia === true);

    if (!q) return base;

    const fuse = new Fuse(
      base.map((d) => ({
        ...d,
        _codigo_norm: normalize(d.codigo),
        _desc_norm: normalize(d.descripcion),
      })),
      {
        includeScore: true,
        shouldSort: true,
        threshold: 0.3,
        distance: 200,
        ignoreLocation: true,
        keys: [
          { name: '_codigo_norm', weight: 0.65 },
          { name: '_desc_norm', weight: 0.35 },
        ],
      }
    );

    let res = fuse.search(q);

    // Boost extra si el código empieza/igual a la query (mejor ranking)
    res = res.map((r) => {
      const starts = r.item._codigo_norm.startsWith(q);
      const exact = r.item._codigo_norm === q;
      let bonus = 0;
      if (starts) bonus += 0.15;
      if (exact) bonus += 0.25;
      return { ...r, score: Math.max(0, (r.score ?? 0) - bonus) };
    });

    res.sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
    return res.map((r) => r.item);
  }, [dataVisible, filtro, soloUrgencia]);

  /* ---- Valor por fila (según reglas) ---- */
  const calcularValor = (it) => {
    // ART: valor directo del convenio
    if (it.origen === 'ART' && typeof it._artValor === 'number') {
      return `$${it._artValor.toLocaleString('es-AR')}`;
    }
    // AOTER: complejidad -> honorario cirujano del período
    if (it.origen === 'AOTER' && it.complejidad && nivelesHonor[it.complejidad]) {
      return `$${nivelesHonor[it.complejidad].toLocaleString('es-AR')}`;
    }
    // Bioquímica: U.B. × UB(período)
    if (it.origen === 'Bioquímica' && typeof it.ub_units === 'number' && ubPeriodo) {
      const val = it.ub_units * ubPeriodo;
      return `$${val.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    }
    // Nacional: solo Radiología/Imágenes
    if (
      it.origen === 'Nacional' &&
      isRadiologia(it) &&
      (typeof it.q_gal === 'number' || typeof it.gto === 'number')
    ) {
      const q = typeof it.q_gal === 'number' ? it.q_gal : 0;
      const g = typeof it.gto === 'number' ? it.gto : 0;
      const total = q * galenoRx + (g * gastoRx) / 2;
      if (total > 0) return `$${total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}`;
    }
    return '—';
  };

  /* ---- Loading / Error ---- */
  if (loading) {
    return (
      <div className={`${styles.wrapper} text-center`}>
        <div className="spinner-border text-light" role="status" />
        <p className="mt-3 ">Cargando nomencladores...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.wrapper} text-center`}>
        <p className="text-danger">{error}</p>
      </div>
    );
  }

  /* ---- Paginación ---- */
  const total = filtrados.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageSafe = Math.min(page, totalPages);
  const sliceStart = (pageSafe - 1) * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const pagina = filtrados.slice(sliceStart, sliceEnd);

  return (
    <div className={styles.wrapper}>
      {/* Encabezado + período */}
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-3">
        <h1 className="fw-bold text-white m-0">🔎 Buscador Global</h1>

        {/* Período ART */}
        <div className="d-flex flex-wrap align-items-center gap-2">
          <label className="form-label text-light fw-semibold m-0">Período ART</label>
          <select
            className={`form-select ${styles.darkInput}`}
            value={periodoART}
            onChange={(e) => setPeriodoART(e.target.value)}
            style={{ minWidth: 280 }}
          >
            <option value="PrestadoresART-Octubre">PrestadoresART-Octubre</option>
            <option value="PrestadoresART-Junio-Septiembre">PrestadoresART-Junio-Septiembre</option>
          </select>

          {/* Resumen del período activo */}
          <div className="d-flex flex-wrap gap-3 text-light small">
            <span><strong>UB:</strong> {ubPeriodo ? ubPeriodo.toLocaleString('es-AR') : '—'}</span>
            <span><strong>Galeno Rx Práctica:</strong> {galenoRx ? galenoRx.toLocaleString('es-AR') : '—'}</span>
            <span><strong>Gasto Rx:</strong> {gastoRx ? gastoRx.toLocaleString('es-AR') : '—'}</span>
            {loadingART && <span className="">Cargando convenio…</span>}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <label className="form-label text-light fw-semibold m-0">Tamaño página</label>
          <select
            className={`form-select ${styles.darkInput}`}
            style={{ width: 120 }}
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {[10, 25, 50, 100, 200].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filtros */}
      <div className="card bg-dark border-0 shadow-sm mb-4">
        <div className="card-body row gy-3 gx-4">
          <div className="col-md-8">
            <label className="form-label text-light fw-semibold">Buscar</label>
            <div className="input-group">
              <input
                type="text"
                className={`form-control ${styles.darkInput}`}
                placeholder="Código o descripción… (fuzzy ranking + resaltado exacto)"
                value={filtro}
                onChange={(e) => setFiltro(e.target.value)}
              />
              <button
                className="btn btn-outline-light"
                onClick={() => {
                  setFiltro('');
                  setSoloUrgencia(false);
                  setPage(1);
                }}
              >
                Limpiar
              </button>
            </div>
            <div className="form-check mt-2">
              <input
                id="chkUrg"
                className="form-check-input"
                type="checkbox"
                checked={soloUrgencia}
                onChange={(e) => setSoloUrgencia(e.target.checked)}
              />
              <label className="form-check-label text-light" htmlFor="chkUrg">
                Solo urgencias (Bioquímica)
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Resumen + paginación */}
      <div className="d-flex justify-content-between align-items-center mb-2">
        <span className="">{total.toLocaleString('es-AR')} resultado(s)</span>
        <div className="btn-group">
          <button className="btn btn-outline-light" disabled={pageSafe <= 1} onClick={() => setPage(1)}>«</button>
          <button className="btn btn-outline-light" disabled={pageSafe <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
          <span className="btn btn-outline-light disabled">{pageSafe} / {totalPages}</span>
          <button className="btn btn-outline-light" disabled={pageSafe >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>›</button>
          <button className="btn btn-outline-light" disabled={pageSafe >= totalPages} onClick={() => setPage(totalPages)}>»</button>
        </div>
      </div>

      {/* Tabla */}
      <div className="table-responsive shadow-sm">
        <table className="table table-dark table-striped table-hover align-middle">
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Código</th>
              <th>Descripción</th>
              <th style={{ width: '12%' }} className="text-end">q_gal</th>
              <th style={{ width: '12%' }} className="text-end">gto</th>
              <th style={{ width: '18%' }} className="text-end">Valor</th>
            </tr>
          </thead>
          <tbody>
            {pagina.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center  py-4">No se encontraron resultados.</td>
              </tr>
            ) : (
              pagina.map((it, idx) => {
                const valor = calcularValor(it);
                const showSub = it.origen === 'Nacional' && isRadiologia(it);
                const subQGal =
                  showSub && typeof it.q_gal === 'number'
                    ? it.q_gal * galenoRx + ((it.gto || 0) * gastoRx) / 2
                    : null;
                const subGto =
                  showSub && typeof it.gto === 'number'
                    ? (it.gto * gastoRx) / 2
                    : null;

                return (
                  <tr key={`${it.origen}-${it.codigo}-${idx}`}>
                    <td className="fw-bold text-white">
                      {highlightExact(it.codigo, filtro, styles.markExact)}
                    </td>
                    <td>
                      {highlightExact(it.descripcion, filtro, styles.markExact)}
                    </td>

                    <td className="text-end">
                      {typeof it.q_gal === 'number' ? (
                        <>
                          <span className="text-white fw-bold">{money(it.q_gal)}</span>
                          {subQGal !== null && (
                            <div className=" small">${money(subQGal)}</div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="text-end">
                      {typeof it.gto === 'number' ? (
                        <>
                          <span className="text-white fw-bold">{money(it.gto)}</span>
                          {subGto !== null && (
                            <div className=" small">${money(subGto)}</div>
                          )}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="text-end fw-bold text-white">{valor}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className=" small mt-3">
        <strong className="text-white">Radiología/Imágenes (Nacional)</strong>: Valor = <code>q_gal × Galeno Rx Práctica + (gto × Gasto Rx)/2</code> (según período).<br />
        <strong className="text-white">AOTER (Operaciones)</strong>: Valor = honorario de Cirujano según complejidad (convenio activo).<br />
        <strong className="text-white">Bioquímica</strong>: Valor = <code>U.B. × UB(período)</code>.<br />
        <strong className="text-white">Convenio ART</strong>: valores directos (Curaciones, Pensión, etc.).
      </p>
    </div>
  );
}

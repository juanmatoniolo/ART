'use client';

import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from './page.module.css';

/* ================= Utils ================= */
const parseNumber = (val) =>
  typeof val === 'number'
    ? val
    : parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;

const money = (n) =>
  typeof n === 'number' && !Number.isNaN(n)
    ? `$${n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
    : '—';

const normalize = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const normalizeCode = (s) => normalize(s).replace(/[^a-z0-9]/g, '');

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlight = (text, q) => {
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
};

// ✅ Solo para mostrar (no cambia el value real)
const formatConvenioLabel = (s) =>
  String(s ?? '')
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/* ================= Page ================= */
export default function AOTER() {
  const [data, setData] = useState([]);
  const [convenios, setConvenios] = useState({});
  const [convenioSel, setConvenioSel] = useState('');
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [mostrarTodas, setMostrarTodas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* === 1) Cargar nomenclador === */
  useEffect(() => {
    const loadJSON = async () => {
      try {
        const res = await fetch('/archivos/Nomeclador_AOTER.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json?.practicas) throw new Error('Formato no válido');

        const regionesMap = {};

        json.practicas.forEach((p) => {
          const region = p.region_nombre || p.region || 'SIN REGIÓN';
          if (!regionesMap[region]) {
            regionesMap[region] = {
              region: p.region,
              region_nombre: region,
              complejidades: {},
            };
          }

          const compKey = String(p.complejidad ?? '').trim() || '—';
          if (!regionesMap[region].complejidades[compKey]) {
            regionesMap[region].complejidades[compKey] = {
              complejidad: compKey,
              practicas: [],
            };
          }

          p.practicas?.forEach((pr) => {
            regionesMap[region].complejidades[compKey].practicas.push({
              codigo: pr.codigo,
              descripcion: pr.descripcion,
            });
          });
        });

        const parsed = Object.values(regionesMap).map((region) => ({
          ...region,
          complejidades: Object.values(region.complejidades),
        }));

        // opcional: ordenar regiones y complejidades
        parsed.sort((a, b) => String(a.region_nombre).localeCompare(String(b.region_nombre)));
        parsed.forEach((r) => {
          r.complejidades.sort((a, b) => Number(a.complejidad) - Number(b.complejidad));
        });

        setData(parsed);
      } catch (err) {
        console.error('❌ Error cargando JSON AOTER:', err);
        setError('No se pudo cargar el nomenclador AOTER.');
      } finally {
        setLoading(false);
      }
    };
    loadJSON();
  }, []);

  /* === 2) Cargar convenios desde Firebase === */
  useEffect(() => {
    const conveniosRef = ref(db, 'convenios');
    const unsub = onValue(conveniosRef, (snap) => {
      const val = snap.exists() ? snap.val() : {};

      // normaliza keys con trim
      const normalizado = Object.keys(val).reduce((acc, k) => {
        const clean = k.trim();
        acc[clean] = val[k];
        return acc;
      }, {});

      setConvenios(normalizado);

      const stored = localStorage.getItem('convenioActivo');
      const elegir = stored && normalizado[stored] ? stored : Object.keys(normalizado)[0] || '';
      setConvenioSel(elegir);
    });

    return () => unsub();
  }, []);

  /* === 3) Honorarios === */
  const honorariosPorNivel = useMemo(() => {
    const conv = convenios[convenioSel];
    const niveles = conv?.honorarios_medicos;
    const m = new Map();

    if (Array.isArray(niveles)) {
      niveles.forEach((n, i) => {
        m.set(i + 1, {
          cirujano: parseNumber(n.Cirujano),
          ayudante1: parseNumber(n.Ayudante_1 || n['Ayudante 1']),
          ayudante2: parseNumber(n.Ayudante_2 || n['Ayudante 2']),
        });
      });
    }
    return m;
  }, [convenios, convenioSel]);

  const getHonorarios = (complejidad) => {
    const nivel = Number(String(complejidad).trim());
    return honorariosPorNivel.get(nivel) || { cirujano: null, ayudante1: null, ayudante2: null };
  };

  /* === 4) Lista plana === */
  const allPractices = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.flatMap((region) =>
      region.complejidades.flatMap((bloque) =>
        (bloque.practicas || []).map((p) => ({
          ...p,
          codigoNormalizado: normalizeCode(p.codigo),
          descripcionNormalizada: normalize(p.descripcion),
          region_nombre: region.region_nombre,
          region_nombre_norm: normalize(region.region_nombre),
          complejidad: bloque.complejidad,
        }))
      )
    );
  }, [data]);

  /* === 4.1) Fuse === */
  const fuse = useMemo(() => {
    if (!allPractices.length) return null;
    return new Fuse(allPractices, {
      keys: [
        { name: 'codigoNormalizado', weight: 0.65 },
        { name: 'descripcionNormalizada', weight: 0.3 },
        { name: 'region_nombre_norm', weight: 0.05 },
      ],
      threshold: 0.28,
      distance: 120,
      ignoreLocation: true,
      minMatchCharLength: 2,
    });
  }, [allPractices]);

  /* === 5) Resultados: buscar o mostrar todo === */
  const resultados = useMemo(() => {
    const qTrim = query.trim();
    const showAll = mostrarTodas && !qTrim;

    if (!qTrim && !showAll) return [];

    if (showAll) {
      return [...allPractices].sort((a, b) => {
        const r = a.region_nombre.localeCompare(b.region_nombre);
        if (r !== 0) return r;
        const c = Number(a.complejidad) - Number(b.complejidad);
        if (c !== 0) return c;
        return String(a.codigo).localeCompare(String(b.codigo));
      });
    }

    const qCode = normalizeCode(qTrim);
    const qText = normalize(qTrim);

    const exact = allPractices
      .filter((p) => {
        return (
          (qCode && (p.codigoNormalizado.startsWith(qCode) || p.codigoNormalizado.includes(qCode))) ||
          (qText && (p.descripcionNormalizada.includes(qText) || p.region_nombre_norm.includes(qText)))
        );
      })
      .sort((a, b) => {
        const aExact = qCode && a.codigoNormalizado === qCode ? 0 : 1;
        const bExact = qCode && b.codigoNormalizado === qCode ? 0 : 1;
        if (aExact !== bExact) return aExact - bExact;

        const aStarts = qCode && a.codigoNormalizado.startsWith(qCode) ? 0 : 1;
        const bStarts = qCode && b.codigoNormalizado.startsWith(qCode) ? 0 : 1;
        if (aStarts !== bStarts) return aStarts - bStarts;

        return 0;
      });

    const fuzzyText = fuse ? fuse.search(qText).map((r) => r.item) : [];
    const fuzzyCode = fuse && qCode ? fuse.search(qCode).map((r) => r.item) : [];

    const seen = new Set();
    return [...exact, ...fuzzyText, ...fuzzyCode].filter((p) => {
      const key = `${p.region_nombre}|${p.complejidad}|${p.codigo}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [query, mostrarTodas, allPractices, fuse]);

  /* === Render === */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.stateBox}>Cargando nomenclador AOTER…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.stateBoxError}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.heading}>
            <h2 className={styles.title}>🦴 Nomenclador AOTER</h2>
            <p className={styles.subtitle}>
              Buscá por código o descripción. También podés navegar por regiones y complejidad.
            </p>
          </div>


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
            className={styles.modeBtn}
            onClick={() => setModoBusqueda((p) => !p)}
            aria-label={modoBusqueda ? 'Cambiar a ver por regiones' : 'Cambiar a modo búsqueda global'}
            type="button"
          >
            {modoBusqueda ? '📂 Ver por regiones' : '🔍 Modo búsqueda global'}
          </button>
        </div>
      </div>

      {/* ===== MODO BUSQUEDA ===== */}
      {modoBusqueda ? (
        <>
          <div className={styles.searchRow}>
            <input
              type="text"
              className={styles.search}
              placeholder="Buscar código o descripción…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              inputMode="search"
            />
            <button className={styles.clearBtn} type="button" onClick={() => setQuery('')} disabled={!query}>
              Limpiar
            </button>
          </div>

          {resultados.length === 0 ? (
            <div className={styles.empty}>{mostrarTodas ? 'No hay prácticas para mostrar.' : 'Sin resultados.'}</div>
          ) : (
            <div className={styles.results}>
              {resultados.map((p) => {
                const rowKey = `${p.region_nombre}|${p.complejidad}|${p.codigo}`;
                const isExact = normalizeCode(p.codigo) === normalizeCode(query);
                const { cirujano, ayudante1, ayudante2 } = getHonorarios(p.complejidad);

                return (
                  <article key={rowKey} className={`${styles.card} ${isExact ? styles.exactMatch : ''}`}>
                    <div className={styles.cardTop}>
                      <div className={styles.region}>{p.region_nombre}</div>
                      <div className={styles.code} title={p.codigo}>
                        {highlight(p.codigo, query)}
                      </div>
                    </div>

                    <div className={styles.desc}>{highlight(p.descripcion, query)}</div>

                    <div className={styles.metaRow}>
                      <span className={styles.badge}>Comp. {p.complejidad}</span>
                      {isExact && <span className={styles.badgeOk}>✅ Exacta</span>}
                    </div>

                    <div className={styles.prices}>
                      <div className={styles.priceItem}>
                        <span className={styles.priceLabel}>Cirujano</span>
                        <span className={styles.priceValue}>{money(cirujano)}</span>
                      </div>
                      <div className={styles.priceItem}>
                        <span className={styles.priceLabel}>Ayud. 1</span>
                        <span className={styles.priceValue}>{money(ayudante1)}</span>
                      </div>
                      <div className={styles.priceItem}>
                        <span className={styles.priceLabel}>Ayud. 2</span>
                        <span className={styles.priceValue}>{money(ayudante2)}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      ) : (
        /* ===== MODO REGIONES ===== */
        <div className={styles.accordion}>
          {data.map((region) => (
            <details key={region.region_nombre} className={styles.accordionItem}>
              <summary className={styles.accordionHeader}>{region.region_nombre}</summary>

              {region.complejidades.map((bloque) => {
                const key = `${region.region_nombre}|${bloque.complejidad}`;
                const { cirujano, ayudante1, ayudante2 } = getHonorarios(bloque.complejidad);

                return (
                  <div key={key} className={styles.accordionBody}>
                    <div className={styles.complexHeader}>
                      <div className={styles.complexTitle}>Complejidad {bloque.complejidad}</div>
                      <div className={styles.complexPrices}>
                        {money(cirujano)} <span className={styles.sep}>/</span> {money(ayudante1)}{' '}
                        <span className={styles.sep}>/</span> {money(ayudante2)}
                      </div>
                    </div>

                    <div className={styles.simpleList}>
                      {bloque.practicas.map((p) => (
                        <div
                          key={`${region.region_nombre}|${bloque.complejidad}|${p.codigo}`}
                          className={styles.simpleItem}
                        >
                          <div className={styles.simpleCode} title={p.codigo}>
                            {p.codigo}
                          </div>
                          <div className={styles.simpleDesc}>{p.descripcion}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from './page.module.css';

/* === Utils === */
const parseNumber = (val) =>
  typeof val === 'number'
    ? val
    : parseFloat(String(val).replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;

const money = (n) =>
  isNaN(n)
    ? '—'
    : `$${n.toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`;

const normalize = (s) =>
  (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* 🚀 Nueva función para eliminar puntos, guiones, espacios, etc. */
const normalizeCode = (s) =>
  normalize(s)
    .replace(/[\s\-.]/g, '') // borra espacios, puntos y guiones
    .trim();

const highlight = (text, q) => {
  if (!text) return '';
  if (!q) return text;

  const query = normalizeCode(q);
  const target = normalizeCode(text);

  const idx = target.indexOf(query);
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);

  return (
    <>
      {before}
      <mark className={styles.highlight}>{match}</mark>
      {after}
    </>
  );
};

/* === Componente principal === */
export default function AOTER() {
  const [data, setData] = useState([]);
  const [convenios, setConvenios] = useState({});
  const [convenioSel, setConvenioSel] = useState('');
  const [query, setQuery] = useState('');
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /* === 1️⃣ Cargar nomenclador === */
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

          if (!regionesMap[region].complejidades[p.complejidad]) {
            regionesMap[region].complejidades[p.complejidad] = {
              complejidad: p.complejidad,
              practicas: [],
            };
          }

          p.practicas?.forEach((pr) => {
            regionesMap[region].complejidades[p.complejidad].practicas.push({
              codigo: pr.codigo,
              descripcion: pr.descripcion,
            });
          });
        });

        const parsed = Object.values(regionesMap).map((region) => ({
          ...region,
          complejidades: Object.values(region.complejidades),
        }));

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

  /* === 2️⃣ Cargar convenios === */
  useEffect(() => {
    const conveniosRef = ref(db, 'convenios');
    const unsub = onValue(conveniosRef, (snap) => {
      const val = snap.exists() ? snap.val() : {};
      setConvenios(val);
      const stored = localStorage.getItem('convenioActivo');
      const elegir = stored && val[stored] ? stored : Object.keys(val)[0] || '';
      setConvenioSel(elegir);
    });
    return () => unsub();
  }, []);

  /* === 3️⃣ Procesar honorarios === */
  const honorariosConvenio = useMemo(() => {
    const conv = convenios[convenioSel];
    const niveles = conv?.honorarios_medicos;

    if (Array.isArray(niveles)) {
      return niveles
        .map((n, i) => ({
          nivel: i,
          cirujano: parseNumber(n.Cirujano),
          ayudante1: parseNumber(n['Ayudante 1']),
          ayudante2: parseNumber(n['Ayudante 2']),
        }))
        .filter(Boolean);
    }
    return [];
  }, [convenios, convenioSel]);

  const getHonorarios = (complejidad) => {
    const reg = honorariosConvenio.find((n) => n.nivel === Number(complejidad));
    return reg || { cirujano: null, ayudante1: null, ayudante2: null };
  };

  /* === 4️⃣ Crear lista plana para búsqueda === */
  const allPractices = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.flatMap((region) =>
      region.complejidades.flatMap((bloque) =>
        bloque.practicas.map((p) => ({
          ...p,
          codigoNormalizado: normalizeCode(p.codigo),
          descripcionNormalizada: normalize(p.descripcion),
          region: region.region,
          region_nombre: region.region_nombre,
          complejidad: bloque.complejidad,
        }))
      )
    );
  }, [data]);

  /* === 5️⃣ Buscador compatible con “ms0201” === */
  const resultados = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    const qNorm = normalizeCode(q);

    // 🔹 Exact match sin puntos
    const exact = allPractices.filter(
      (p) =>
        p.codigoNormalizado.includes(qNorm) ||
        p.descripcionNormalizada.includes(normalize(q)) ||
        normalize(p.region_nombre).includes(normalize(q))
    );

    // 🔹 Fuzzy match (difuso)
    const fuse = new Fuse(allPractices, {
      keys: ['codigoNormalizado', 'descripcionNormalizada', 'region_nombre'],
      threshold: 0.3,
      ignoreLocation: true,
    });

    const fuzzy = fuse.search(qNorm).map((r) => r.item);

    // Eliminar duplicados
    const seen = new Set();
    return [...exact, ...fuzzy].filter((p) => {
      if (seen.has(p.codigo)) return false;
      seen.add(p.codigo);
      return true;
    });
  }, [query, allPractices]);

  if (loading)
    return (
      <div className={styles.wrapper}>
        <p className={styles.info}>Cargando nomenclador AOTER...</p>
      </div>
    );

  if (error)
    return (
      <div className={styles.wrapper}>
        <p className={styles.error}>{error}</p>
      </div>
    );

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>🦴 Nomenclador AOTER</h2>

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
        </div>

        <button className={styles.switchButton} onClick={() => setModoBusqueda((p) => !p)}>
          {modoBusqueda ? '📂 Ver por regiones' : '🔍 Modo búsqueda global'}
        </button>
      </div>

      {modoBusqueda ? (
        <>
          <input
            type="text"
            className={styles.input}
            placeholder="Buscar código o descripción (ej: MS0201)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Región</th>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Comp.</th>
                  <th>Cirujano</th>
                  <th>Ayud. 1</th>
                  <th>Ayud. 2</th>
                </tr>
              </thead>
              <tbody>
                {resultados.length === 0 ? (
                  <tr>
                    <td colSpan="7" className={styles.noResults}>
                      Sin resultados.
                    </td>
                  </tr>
                ) : (
                  resultados.map((p, i) => {
                    const { cirujano, ayudante1, ayudante2 } = getHonorarios(p.complejidad);
                    return (
                      <tr key={i}>
                        <td>{p.region_nombre}</td>
                        <td>{highlight(p.codigo, query)}</td>
                        <td>{highlight(p.descripcion, query)}</td>
                        <td>{p.complejidad}</td>
                        <td className={styles.numeric}>{money(cirujano)}</td>
                        <td className={styles.numeric}>{money(ayudante1)}</td>
                        <td className={styles.numeric}>{money(ayudante2)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className={styles.accordion}>
          {data.map((region, rIndex) => (
            <details key={rIndex} className={styles.accordionItem}>
              <summary className={styles.accordionHeader}>{region.region_nombre}</summary>
              {region.complejidades.map((bloque, bIndex) => {
                const { cirujano, ayudante1, ayudante2 } = getHonorarios(bloque.complejidad);
                return (
                  <div key={bIndex} className={styles.accordionBody}>
                    <h6 className={styles.complexTitle}>
                      Complejidad {bloque.complejidad}{' '}
                      <small>
                        ({money(cirujano)} / {money(ayudante1)} / {money(ayudante2)})
                      </small>
                    </h6>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bloque.practicas.map((p, i) => (
                          <tr key={i}>
                            <td>{p.codigo}</td>
                            <td>{p.descripcion}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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

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
  typeof n === 'number' && !isNaN(n)
    ? `$${n.toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })}`
    : '—';

const normalize = (s) =>
  (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

/* 👇 No eliminamos símbolos, solo espacios */
const normalizeCode = (s) => normalize(s).replace(/\s+/g, '').trim();

/* 🔍 Resalta TODAS las coincidencias en el texto */
const highlight = (text, q) => {
  if (!text || !q) return text;

  const regex = new RegExp(`(${q})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, i) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={i} className={styles.highlight}>
        {part}
      </mark>
    ) : (
      part
    )
  );
};

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

  /* === 2️⃣ Cargar convenios desde Firebase === */
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

  /* === 3️⃣ Procesar honorarios con campos con "_" === */
  const honorariosConvenio = useMemo(() => {
    const conv = convenios[convenioSel];
    const niveles = conv?.honorarios_medicos;

    if (Array.isArray(niveles)) {
      return niveles.map((n, i) => ({
        nivel: i,
        cirujano: parseNumber(n.Cirujano),
        ayudante1: parseNumber(n.Ayudante_1 || n['Ayudante 1']),
        ayudante2: parseNumber(n.Ayudante_2 || n['Ayudante 2']),
      }));
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

  /* === 5️⃣ Buscador mejorado con orden de relevancia === */
  const resultados = useMemo(() => {
    const q = query.trim();
    if (!q) return [];

    const qNorm = normalizeCode(q);
    const qNormLower = normalize(q);

    const exact = allPractices
      .filter((p) => {
        const codigoNorm = normalizeCode(p.codigo);
        const descNorm = normalize(p.descripcion);
        const regionNorm = normalize(p.region_nombre);

        return (
          codigoNorm.startsWith(qNorm) ||
          codigoNorm.includes(qNorm) ||
          descNorm.includes(qNormLower) ||
          regionNorm.includes(qNormLower)
        );
      })
      // 🔹 Ordenar: primero los que empiezan con el código, luego los demás
      .sort((a, b) => {
        const aStarts = normalizeCode(a.codigo).startsWith(qNorm) ? 0 : 1;
        const bStarts = normalizeCode(b.codigo).startsWith(qNorm) ? 0 : 1;
        return aStarts - bStarts;
      });

    const fuse = new Fuse(allPractices, {
      keys: [
        { name: 'codigoNormalizado', weight: 0.6 },
        { name: 'descripcionNormalizada', weight: 0.35 },
        { name: 'region_nombre', weight: 0.05 },
      ],
      threshold: 0.2,
      distance: 80,
      ignoreLocation: true,
    });

    const fuzzy = fuse.search(qNorm).map((r) => r.item);

    const seen = new Set();
    return [...exact, ...fuzzy].filter((p) => {
      if (seen.has(p.codigo)) return false;
      seen.add(p.codigo);
      return true;
    });
  }, [query, allPractices]);

  /* === Render === */
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
            placeholder="Buscar código o descripción (ej: R0, MS0201, artroscopia...)"
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

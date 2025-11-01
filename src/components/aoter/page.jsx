'use client';

import { useEffect, useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from './page.module.css';

/* === Helpers === */
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

const highlight = (text, q) => {
  if (!text) return '';
  if (!q) return text;

  const query = normalize(q).replace(/\./g, '');
  const target = normalize(text).replace(/\./g, '');

  const idx = target.indexOf(query);
  if (idx === -1) return text;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + q.length);
  const after = text.slice(idx + q.length);
  return (
    <>
      {before}
      <mark style={{ backgroundColor: '#28a74555', borderRadius: '3px' }}>{match}</mark>
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

  /* === 3️⃣ Procesar honorarios del convenio activo === */
  const honorariosConvenio = useMemo(() => {
    const conv = convenios[convenioSel];
    const niveles = conv?.honorarios_medicos;

    if (Array.isArray(niveles)) {
      return niveles
        .map((n, i) => {
          if (!n) return null;
          return {
            nivel: i,
            cirujano: parseNumber(n.Cirujano),
            ayudante1: parseNumber(n['Ayudante 1']),
            ayudante2: parseNumber(n['Ayudante 2']),
          };
        })
        .filter(Boolean);
    }
    return [];
  }, [convenios, convenioSel]);

  const getHonorarios = (complejidad) => {
    const reg = honorariosConvenio.find((n) => n.nivel === Number(complejidad));
    if (!reg) return { cirujano: null, ayudante1: null, ayudante2: null };
    return reg;
  };

  /* === 4️⃣ Crear lista plana para búsqueda === */
  const allPractices = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.flatMap((region) =>
      region.complejidades.flatMap((bloque) =>
        bloque.practicas.map((p) => ({
          ...p,
          region: region.region,
          region_nombre: region.region_nombre,
          complejidad: bloque.complejidad,
        }))
      )
    );
  }, [data]);

  /* === 5️⃣ Buscador === */
  const resultados = useMemo(() => {
    if (!query.trim()) return [];
    const q = normalize(query).replace(/\./g, '');

    // Búsqueda exacta
    const exact = allPractices.filter(
      (p) =>
        normalize(p.codigo).replace(/\./g, '') === q ||
        normalize(p.descripcion) === normalize(query)
    );

    // Búsqueda por similitud (Fuse)
    const fuse = new Fuse(allPractices, {
      keys: ['codigo', 'descripcion', 'region_nombre'],
      includeScore: true,
      threshold: 0.3,
      ignoreLocation: true,
    });
    const fuzzy = fuse.search(query).map((r) => r.item);

    const seen = new Set(exact.map((p) => p.codigo));
    return [...exact, ...fuzzy.filter((p) => !seen.has(p.codigo))];
  }, [query, allPractices]);

  /* === 🧭 Render === */
  if (loading)
    return (
      <div className={`${styles.wrapper} text-center text-muted`}>
        <div className="spinner-border text-light mb-3" role="status" />
        <p>Cargando nomenclador AOTER...</p>
      </div>
    );

  if (error)
    return (
      <div className={`${styles.wrapper} text-center text-danger`}>
        <h5>{error}</h5>
        <p className="text-muted">Verificá que el archivo esté en /public/archivos/</p>
      </div>
    );

  return (
    <div className={styles.wrapper}>
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center mb-3 gap-3">
        <h2 className={styles.title}>🦴 Nomenclador AOTER</h2>

        {/* Selector de convenio */}
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
        </div>

        <button className={styles.btnSuccess} onClick={() => setModoBusqueda((p) => !p)}>
          {modoBusqueda ? '📂 Ver por regiones' : '🔍 Modo búsqueda global'}
        </button>
      </div>

      {/* === 🔍 Modo búsqueda global === */}
      {modoBusqueda ? (
        <>
          <input
            type="text"
            className={`form-control mb-4 ${styles.inputDark}`}
            placeholder="Buscar código o descripción..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {resultados.length > 0 ? (
            <div className="table-responsive shadow-sm">
              <table className={`table table-dark table-striped ${styles.table}`}>
                <thead>
                  <tr>
                    <th>Región</th>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Comp.</th>
                    <th className="text-end">Cirujano</th>
                    <th className="text-end">Ayud. 1</th>
                    <th className="text-end">Ayud. 2</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.map((p, i) => {
                    const { cirujano, ayudante1, ayudante2 } = getHonorarios(p.complejidad);
                    return (
                      <tr key={i}>
                        <td>{p.region_nombre}</td>
                        <td>{highlight(p.codigo, query)}</td>
                        <td>{highlight(p.descripcion, query)}</td>
                        <td>{p.complejidad}</td>
                        <td className="text-end">{money(cirujano)}</td>
                        <td className="text-end">{money(ayudante1)}</td>
                        <td className="text-end">{money(ayudante2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            query && <p className="text-center text-muted">Sin resultados.</p>
          )}
        </>
      ) : (
        /* === 📚 Modo regiones === */
        <div className="accordion" id="accordionAOTER">
          {data.map((region, rIndex) => (
            <div className="accordion-item bg-dark text-light border-0 mb-2" key={rIndex}>
              <h2 className="accordion-header">
                <button
                  className="accordion-button collapsed bg-dark text-light fw-bold"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target={`#collapse-${rIndex}`}
                >
                  {region.region_nombre}
                </button>
              </h2>
              <div id={`collapse-${rIndex}`} className="accordion-collapse collapse">
                <div className="accordion-body bg-dark text-light">
                  {region.complejidades.map((bloque, bIndex) => {
                    const { cirujano, ayudante1, ayudante2 } = getHonorarios(bloque.complejidad);
                    return (
                      <div key={bIndex} className="mb-4 border rounded p-3">
                        <h6 className="fw-bold text-info mb-3">
                          Complejidad {bloque.complejidad}{' '}
                          <small className="text-muted">
                            ({money(cirujano)} — {money(ayudante1)} — {money(ayudante2)})
                          </small>
                        </h6>

                        <table className="table table-dark table-striped">
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
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

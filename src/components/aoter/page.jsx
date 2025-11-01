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
  n
    ? `$${n.toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`
    : '—';

const normalize = (s) =>
  (s || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const highlight = (text, q) => {
  if (!text) return ''; // ✅ evita errores
  if (!q) return text;

  try {
    const regex = new RegExp(`(${q})`, 'ig');
    return String(text)
      .split(regex)
      .map((part, i) =>
        regex.test(part) ? (
          <mark key={i} style={{ backgroundColor: '#28a74555', borderRadius: '3px' }}>
            {part}
          </mark>
        ) : (
          part
        )
      );
  } catch (err) {
    console.error('❌ Error en highlight:', err);
    return text;
  }
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

  useEffect(() => {
    const loadJSON = async () => {
      try {
        const res = await fetch('/archivos/Nomeclador_AOTER.json');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();

        let dataParsed = [];

        // ✅ Caso 1: el JSON ya viene como array
        if (Array.isArray(json)) {
          dataParsed = json;
        }
        // ✅ Caso 2: formato actual (objeto con "practicas")
        else if (json?.practicas && Array.isArray(json.practicas)) {
          // Agrupar por región
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

            // Agregar todas las prácticas
            p.practicas?.forEach((pr) => {
              regionesMap[region].complejidades[p.complejidad].practicas.push({
                codigo: pr.codigo,
                descripcion: pr.descripcion,
              });
            });
          });

          // Convertir a array
          dataParsed = Object.values(regionesMap).map((region) => ({
            ...region,
            complejidades: Object.values(region.complejidades),
          }));
        } else {
          throw new Error('Formato no reconocido');
        }

        setData(dataParsed);
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
    const unsub = onValue(
      conveniosRef,
      (snap) => {
        const val = snap.exists() ? snap.val() : {};
        setConvenios(val);
        const stored = localStorage.getItem('convenioActivo');
        const elegir = stored && val[stored] ? stored : Object.keys(val)[0] || '';
        setConvenioSel(elegir);
      },
      (err) => console.error('Error al leer convenios:', err)
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (convenioSel) localStorage.setItem('convenioActivo', convenioSel);
  }, [convenioSel]);

  /* === 3️⃣ Determinar honorarios base según convenio === */
  const honorariosConvenio = useMemo(() => {
    const conv = convenios[convenioSel];
    const niveles = conv?.honorarios_medicos?.niveles;
    if (Array.isArray(niveles) && niveles.length > 0) {
      return niveles.map((n) => ({
        nivel: parseInt(n.nivel),
        cirujano: parseNumber(n.cirujano ?? n.Cirujano),
        ayudante1: parseNumber(n.ayudante_1 ?? n['Ayudante 1']),
        ayudante2: parseNumber(n.ayudante_2 ?? n['Ayudante 2']),
      }));
    }

    // Fallback valores fijos
    return [
      { nivel: 1, cirujano: 108900, ayudante1: 32670 },
      { nivel: 2, cirujano: 136400, ayudante1: 40700 },
      { nivel: 3, cirujano: 341000, ayudante1: 102800 },
      { nivel: 4, cirujano: 544500, ayudante1: 163350 },
      { nivel: 5, cirujano: 829400, ayudante1: 248820, ayudante2: 165880 },
      { nivel: 6, cirujano: 1232000, ayudante1: 369600, ayudante2: 246400 },
      { nivel: 7, cirujano: 1361250, ayudante1: 408375, ayudante2: 272250 },
      { nivel: 8, cirujano: 1906300, ayudante1: 571890, ayudante2: 381260 },
      { nivel: 9, cirujano: 2450250, ayudante1: 735075, ayudante2: 490050 },
    ];
  }, [convenios, convenioSel]);

  /* === 4️⃣ Generar lista plana === */
  const allPractices = useMemo(() => {
    if (!Array.isArray(data)) return [];
    return data.flatMap((region) =>
      region.complejidades?.flatMap((bloque) =>
        bloque.practicas.map((p) => ({
          ...p,
          region: region.region,
          region_nombre: region.region_nombre,
          complejidad: bloque.complejidad,
        }))
      )
    );
  }, [data]);

  /* === 5️⃣ Búsqueda === */
  const resultados = useMemo(() => {
    if (!query.trim()) return [];
    const q = normalize(query).replace(/\./g, '');

    // Exactos
    const exact = allPractices.filter(
      (p) =>
        normalize(p.codigo).replace(/\./g, '') === q ||
        normalize(p.descripcion) === normalize(query)
    );

    // Similares con Fuse.js
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

  /* === 6️⃣ Obtener honorarios por complejidad === */
  const getHonorarios = (complejidad) => {
    const reg = honorariosConvenio.find((n) => n.nivel === Number(complejidad));
    if (!reg) return { cirujano: null, ayudante1: null, ayudante2: null };
    return reg;
  };

  /* === Render principal === */
  if (loading) {
    return (
      <div className={`${styles.wrapper} text-center text-muted`}>
        <div className="spinner-border text-light mb-3" role="status" />
        <p>Cargando nomenclador AOTER...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${styles.wrapper} text-center text-danger`}>
        <h5>{error}</h5>
        <p className="text-muted">Verificá que el archivo esté en /public/archivos/</p>
      </div>
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div className={`${styles.wrapper} text-center text-warning`}>
        <p>No hay datos disponibles para mostrar.</p>
      </div>
    );
  }

  /* === UI === */
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
            {Object.keys(convenios).length > 0 ? (
              Object.keys(convenios).map((k) => <option key={k}>{k}</option>)
            ) : (
              <option disabled>Cargando...</option>
            )}
          </select>
        </div>

        <button
          className={styles.btnSuccess}
          onClick={() => setModoBusqueda((p) => !p)}
        >
          {modoBusqueda ? '📂 Ver por regiones' : '🔍 Modo búsqueda global'}
        </button>
      </div>

      {/* === 🔍 Modo Global === */}
      {modoBusqueda ? (
        <>
          <input
            type="text"
            className={`form-control mb-4 ${styles.inputDark}`}
            placeholder="Buscar código o descripción (ej: MS0702 o 'canal estrecho')..."
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
        /* === 📚 Modo por Regiones === */
        <div className="accordion" id="accordionAOTER">
          {data.map((region, rIndex) => (
            <div
              className="accordion-item bg-dark text-light border-0 mb-2"
              key={rIndex}
            >
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

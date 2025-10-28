'use client';

import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import styles from './page.module.css';

export default function NomecladorNacional() {
  const [data, setData] = useState([]);
  const [query, setQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [capituloQueries, setCapituloQueries] = useState({});

  // Cargar JSON
  useEffect(() => {
    fetch('/archivos/NomecladorNacional.json')
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Error cargando JSON:', err));
  }, []);

  // --- 🔍 Búsqueda global (exacta) ---
  useEffect(() => {
    if (!query.trim()) {
      setFilteredResults([]);
      return;
    }

    const fuse = new Fuse(data, {
      keys: ['descripcion', 'codigo', 'capitulo'],
      includeMatches: true,
      threshold: 0.0, // coincidencia exacta
      useExtendedSearch: true,
    });

    // Palabra exacta
    const results = fuse.search(`'${query.trim()}`);
    setFilteredResults(results);
  }, [query, data]);

  // --- 🪄 Resaltado de coincidencias ---
  const highlightMatch = (text, matchData) => {
    if (!matchData || !matchData.indices) return text;

    const matches = matchData.indices;
    let parts = [];
    let lastIndex = 0;

    matches.forEach(([start, end]) => {
      parts.push(text.slice(lastIndex, start));
      parts.push(<mark key={start}>{text.slice(start, end + 1)}</mark>);
      lastIndex = end + 1;
    });

    parts.push(text.slice(lastIndex));
    return parts;
  };

  // --- 📚 Agrupar por capítulo ---
  const agrupadosPorCapitulo = data.reduce((acc, item) => {
    if (!acc[item.capitulo]) acc[item.capitulo] = [];
    acc[item.capitulo].push(item);
    return acc;
  }, {});

  // --- 🔍 Filtro dentro de cada capítulo ---
  const filtrarCapitulo = (capitulo, items) => {
    const term = capituloQueries[capitulo]?.trim();
    if (!term) return items;

    const fuse = new Fuse(items, {
      keys: ['descripcion', 'codigo'],
      includeMatches: true,
      threshold: 0.0,
      useExtendedSearch: true,
    });

    return fuse.search(`'${term}`);
  };

  // --- 🧭 Mapa de capítulos oficiales ---
  const capitulosInfo = {
    '01': { nombre: 'Sistema Nervioso', rango: '01.06.54 – 01.06.91' },
    '02': { nombre: 'Aparato de la Visión', rango: '02.01.06 – 02.02.08' },
    '03': { nombre: 'Aparato del Oído, Nariz y Garganta', rango: '03.07.01 – 03.13.06' },
    '04': { nombre: 'Sistema Endocrinológico (Tiroides y Paratiroides)', rango: '04.01.06 – 04.01.07' },
    '05': { nombre: 'Operaciones en el Tórax', rango: '05.04.03 – 05.05.01' },
    '06': { nombre: 'Operaciones en la Mama', rango: '06.01.08 – 06.01.11' },
    '07': { nombre: 'Sistema Cardiovascular', rango: '07.06.09 – 07.06.17' },
    '08': { nombre: 'Aparato Digestivo y Abdomen', rango: '08.05.26 – 08.07.60' },
    '09': { nombre: 'Vasos y Ganglios Linfáticos', rango: '09.01.07 – 09.01.08' },
    '10': { nombre: 'Aparato Urinario y Genital Masculino', rango: '10.01.09 – 10.07.11' },
    '11': { nombre: 'Aparato Genital Femenino y Obstetricia', rango: '11.02.15 – 11.06.01' },
    '12': { nombre: 'Sistema Músculo Esquelético', rango: '12.03.01 – 12.19.37' },
    '13': { nombre: 'Piel y Tejido Celular Subcutáneo', rango: '13.01.03 – 13.03.01' },
    '14': { nombre: 'Alergia', rango: '14.01.01 – 14.01.51' },
    '15': { nombre: 'Anatomía Patológica', rango: '15.01.51 – 15.01.58' },
    '16': { nombre: 'Anestesiología', rango: '16.01.01 – 16.01.60' },
    '17': { nombre: 'Cardiología', rango: '17.01.09 – 17.02.11' },
    '18': { nombre: 'Ecografía y Ecodoppler', rango: '18.01.09 – 18.01.51' },
    '19': { nombre: 'Gastroenterología', rango: '20.01.65 – 20.02.50' },
    '21': { nombre: 'Genética Humana', rango: '21.01.60 – 21.01.61' },
    '22': { nombre: 'Discapacidad', rango: '22.01.01 – 22.02.02' },
    '23': { nombre: 'Plan Especial Oncológico (POE01)', rango: '23.03.01 – 23.03.05' },
    '24': { nombre: 'Terapia del Dolor', rango: '24.01.50 – 24.01.60' },
    '25': { nombre: 'Rehabilitación (Kinesiología, RPG, etc.)', rango: '25.01.82 – 25.02.01' },
    '26': { nombre: 'Medicina Nuclear', rango: '26.01.08 – 26.06.01' },
    '27': { nombre: 'Diálisis y Trasplante Renal', rango: '27.01.01 – 27.01.04' },
    '28': { nombre: 'Neumonología', rango: '28.01.51 – 28.01.77' },
    '29': { nombre: 'Neurología', rango: '29.01.04 – 29.01.05' },
    '30': { nombre: 'Oftalmología', rango: '30.01.51 – 30.01.65' },
    '31': { nombre: 'Ginecología – Programa Materno Infantil', rango: '31.01.23 – 31.01.61' },
    '32': { nombre: 'Oncología', rango: '32.01.04' },
    '33': { nombre: 'Hemoterapia', rango: '33.01.01 – 33.01.05' },
    '34': { nombre: 'Radiología / Diagnóstico por Imágenes', rango: '34.02.01 – 34.08.53' },
    '35': { nombre: 'Plan Especial Oncológico (Procedimientos POE01)', rango: '35.01.60 – 35.01.65' },
    '40': { nombre: 'Terapia Intensiva', rango: '40.01.01 – 40.01.05' },
    '41': { nombre: 'Terapia Intermedia', rango: '41.01.01' },
    '42': { nombre: 'Consultas Médicas', rango: '42.03.01 – 42.03.03' },
    '43': { nombre: 'Salud Mental / Psiquiatría', rango: '43.01.01 – 43.34.02' },
  };

  return (
    <div className={styles.wrapper}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className={styles.title}>Nomeclador Nacional</h2>
        <button
          className="btn btn-outline-primary"
          onClick={() => setModoBusqueda(prev => !prev)}
        >
          {modoBusqueda ? 'Ver por capítulos' : 'Modo búsqueda global'}
        </button>
      </div>

      {/* 🌍 Modo búsqueda global */}
      {modoBusqueda ? (
        <>
          <input
            type="text"
            className="form-control mb-4"
            placeholder="Buscar por código, descripción o capítulo (palabra exacta)..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />

          {filteredResults.length > 0 ? (
            (() => {
              const agrupados = filteredResults.reduce((acc, res) => {
                const capKey = res.item.capitulo?.toString().padStart(2, '0') || 'SinCap';
                if (!acc[capKey]) acc[capKey] = [];
                acc[capKey].push(res);
                return acc;
              }, {});

              return Object.entries(agrupados).map(([capKey, resultados]) => {
                const info = capitulosInfo[capKey] || { nombre: 'Capítulo desconocido', rango: '' };
                return (
                  <div key={capKey} className="mb-5">
                    <div className="d-flex align-items-center justify-content-between bg-light p-2 rounded border mb-2">
                      <h5 className="fw-bold m-0">
                        <span className="text-primary">*{capKey}*</span> — {info.nombre}
                      </h5>
                      {info.rango && (
                        <span className="text-muted small">{info.rango}</span>
                      )}
                    </div>

                    <div className="table-responsive">
                      <table className="table table-striped">
                        <thead>
                          <tr className="table-success">
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Q GAL</th>
                            <th>Gto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultados.map((res, index) => (
                            <tr key={index}>
                              <td>{highlightMatch(res.item.codigo.toString(), res.matches?.find(m => m.key === 'codigo'))}</td>
                              <td>{highlightMatch(res.item.descripcion, res.matches?.find(m => m.key === 'descripcion'))}</td>
                              <td>{res.item.q_gal}</td>
                              <td>{res.item.gto}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              });
            })()
          ) : (
            query.trim() && (
              <p className="text-center text-muted mt-3">No se encontraron coincidencias exactas.</p>
            )
          )}
        </>
      ) : (
        // 📂 Modo capítulos con búsqueda local
        <div className="accordion" id="accordionNomenclador">
          {Object.entries(agrupadosPorCapitulo).map(([capitulo, items], index) => {
            const filtrados = filtrarCapitulo(capitulo, items);
            return (
              <div className="accordion-item" key={index}>
                <h2 className="accordion-header" id={`heading-${index}`}>
                  <button
                    className="accordion-button collapsed"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target={`#collapse-${index}`}
                    aria-expanded="false"
                    aria-controls={`collapse-${index}`}
                  >
                    {capitulo} ({items.length})
                  </button>
                </h2>
                <div
                  id={`collapse-${index}`}
                  className="accordion-collapse collapse"
                  aria-labelledby={`heading-${index}`}
                  data-bs-parent="#accordionNomenclador"
                >
                  <div className="accordion-body">
                    <input
                      type="text"
                      className="form-control mb-3"
                      placeholder={`Buscar práctica exacta en ${capitulo}...`}
                      value={capituloQueries[capitulo] || ''}
                      onChange={e =>
                        setCapituloQueries(prev => ({
                          ...prev,
                          [capitulo]: e.target.value,
                        }))
                      }
                    />

                    <div className="table-responsive">
                      <table className="table table-striped mb-0">
                        <thead>
                          <tr>
                            <th>Código</th>
                            <th>Descripción</th>
                            <th>Q GAL</th>
                            <th>Gto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {capituloQueries[capitulo]?.trim()
                            ? filtrados.length > 0
                              ? filtrados.map((res, i) => (
                                  <tr key={i}>
                                    <td>{highlightMatch(res.item.codigo.toString(), res.matches?.find(m => m.key === 'codigo'))}</td>
                                    <td>{highlightMatch(res.item.descripcion, res.matches?.find(m => m.key === 'descripcion'))}</td>
                                    <td>{res.item.q_gal}</td>
                                    <td>{res.item.gto}</td>
                                  </tr>
                                ))
                              : (
                                <tr>
                                  <td colSpan="4" className="text-center text-muted">
                                    No se encontraron coincidencias exactas.
                                  </td>
                                </tr>
                              )
                            : items.map((item, i) => (
                                <tr key={i}>
                                  <td>{item.codigo}</td>
                                  <td>{item.descripcion}</td>
                                  <td>{item.q_gal}</td>
                                  <td>{item.gto}</td>
                                </tr>
                              ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

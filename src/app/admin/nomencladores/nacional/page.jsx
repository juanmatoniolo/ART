'use client';

import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import styles from './page.module.css';

export default function NomencladorNacional() {
  const [data, setData] = useState([]);
  const [query, setQuery] = useState('');
  const [filteredResults, setFilteredResults] = useState([]);
  const [modoBusqueda, setModoBusqueda] = useState(true);
  const [capituloQueries, setCapituloQueries] = useState({});
  const [filtroCapitulo, setFiltroCapitulo] = useState('');

  // --- 📂 Cargar JSON ---
  useEffect(() => {
    fetch('/archivos/NomecladorNacional.json')
      .then(res => res.json())
      .then(setData)
      .catch(err => console.error('Error cargando JSON:', err));
  }, []);

  // --- 🔍 Búsqueda global ---
  useEffect(() => {
    if (!query.trim()) {
      setFilteredResults([]);
      return;
    }

    const fuse = new Fuse(data, {
      keys: ['descripcion', 'codigo', 'capitulo'],
      includeMatches: true,
      threshold: 0.0,
      useExtendedSearch: true,
      ignoreLocation: true,
    });

    const results = fuse.search(`'${query.trim()}`);
    const enrichedResults = [];

    // 👇 Incluir códigos subsiguientes
    results.forEach(res => {
      enrichedResults.push(res);
      const currentIndex = data.findIndex(
        d => d.codigo === res.item.codigo && d.capitulo === res.item.capitulo
      );
      const nextItem = data[currentIndex + 1];
      if (
        nextItem &&
        nextItem.descripcion?.toLowerCase().includes('por exposición subsiguiente')
      ) {
        enrichedResults.push({ item: nextItem, matches: [] });
      }
    });

    setFilteredResults(enrichedResults);
  }, [query, data]);

  // --- ✨ Resaltado de coincidencias ---
  const highlightMatch = (text, matchData) => {
    if (!matchData || !matchData.indices) return text;
    let parts = [];
    let lastIndex = 0;
    matchData.indices.forEach(([start, end], i) => {
      parts.push(<span key={`pre-${i}`}>{text.slice(lastIndex, start)}</span>);
      parts.push(
        <mark key={`mark-${i}`} style={{ backgroundColor: '#19875455', borderRadius: '4px' }}>
          {text.slice(start, end + 1)}
        </mark>
      );
      lastIndex = end + 1;
    });
    parts.push(<span key="last">{text.slice(lastIndex)}</span>);
    return parts;
  };

  // --- 📘 Agrupar por capítulo ---
  const agrupadosPorCapitulo = data.reduce((acc, item) => {
    const key = item.capitulo?.toString().padStart(2, '0') || '00';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  // --- 🧭 Map oficial de capítulos ---
  const capitulosInfo = {
    '01': { nombre: 'Sistema Nervioso' },
    '02': { nombre: 'Aparato de la Visión' },
    '03': { nombre: 'Aparato del Oído, Nariz y Garganta' },
    '04': { nombre: 'Sistema Endocrinológico' },
    '05': { nombre: 'Operaciones en el Tórax' },
    '06': { nombre: 'Operaciones en la Mama' },
    '07': { nombre: 'Sistema Cardiovascular' },
    '08': { nombre: 'Aparato Digestivo y Abdomen' },
    '09': { nombre: 'Vasos y Ganglios Linfáticos' },
    '10': { nombre: 'Aparato Urinario y Genital Masculino' },
    '11': { nombre: 'Aparato Genital Femenino y Obstetricia' },
    '12': { nombre: 'Sistema Músculo Esquelético' },
    '13': { nombre: 'Piel y Tejido Celular Subcutáneo' },
    '14': { nombre: 'Alergia' },
    '15': { nombre: 'Anatomía Patológica' },
    '16': { nombre: 'Anestesiología' },
    '17': { nombre: 'Cardiología' },
    '18': { nombre: 'Ecografía y Ecodoppler' },
    '19': { nombre: 'Gastroenterología' },
    '20': { nombre: 'Genética Humana' },
    '21': { nombre: 'Discapacidad' },
    '22': { nombre: 'Plan Especial Oncológico (POE01)' },
    '23': { nombre: 'Terapia del Dolor' },
    '24': { nombre: 'Rehabilitación (Kinesiología, RPG, etc.)' },
    '25': { nombre: 'Medicina Nuclear' },
    '26': { nombre: 'Diálisis y Trasplante Renal' },
    '27': { nombre: 'Neumonología' },
    '28': { nombre: 'Neurología' },
    '29': { nombre: 'Oftalmología' },
    '30': { nombre: 'Ginecología – Programa Materno Infantil' },
    '31': { nombre: 'Oncología' },
    '32': { nombre: 'Hemoterapia' },
    '33': { nombre: 'Radiología / Diagnóstico por Imágenes' },
    '34': { nombre: 'Terapia Intensiva' },
    '35': { nombre: 'Terapia Intermedia' },
    '36': { nombre: 'Consultas Médicas' },
    '37': { nombre: 'Salud Mental / Psiquiatría' },
  };

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

  return (
    <div className={styles.wrapper}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h2 className={styles.title}>Nomenclador Nacional</h2>
        <button
          className={styles.btnSuccess}
          onClick={() => setModoBusqueda((prev) => !prev)}
        >
          {modoBusqueda ? '📂 Ver por capítulos' : '🔍 Modo búsqueda global'}
        </button>
      </div>

      {/* 🌍 Modo búsqueda global */}
      {modoBusqueda ? (
        <>
          <input
            type="text"
            className={`form-control mb-4 ${styles.inputDark}`}
            placeholder="Buscar por código, descripción o capítulo..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {filteredResults.length > 0 ? (
            <div className={styles.results}>
              <table className={`table table-dark table-hover table-striped ${styles.table}`}>
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th>Capítulo</th>
                    <th>Q GAL</th>
                    <th>Gto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((res, i) => {
                    const capKey = res.item.capitulo?.toString().padStart(2, '0');
                    const capInfo = capitulosInfo[capKey] || { nombre: 'Sin asignar' };
                    return (
                      <tr key={i}>
                        <td>{res.item.codigo}</td>
                        <td>
                          {highlightMatch(
                            res.item.descripcion,
                            res.matches?.find((m) => m.key === 'descripcion')
                          )}
                        </td>
                        <td>
                          <span className={styles.capBadge}>{capInfo.nombre}</span>
                        </td>
                        <td>{res.item.q_gal}</td>
                        <td>{res.item.gto}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            query.trim() && <p className="text-center text-muted">Sin resultados exactos.</p>
          )}
        </>
      ) : (
        // 📚 Modo capítulos con buscador
        <>
          <input
            type="text"
            className={`form-control mb-4 ${styles.inputDark}`}
            placeholder="🔎 Buscar capítulo..."
            value={filtroCapitulo}
            onChange={(e) => setFiltroCapitulo(e.target.value)}
          />
          <div className="accordion" id="accordionNomenclador">
            {Object.entries(agrupadosPorCapitulo)
              .filter(([key]) => {
                const info = capitulosInfo[key];
                return (
                  !filtroCapitulo ||
                  info?.nombre.toLowerCase().includes(filtroCapitulo.toLowerCase()) ||
                  key.includes(filtroCapitulo)
                );
              })
              .map(([capitulo, items], i) => {
                const info = capitulosInfo[capitulo] || { nombre: `Capítulo ${capitulo}` };
                const filtrados = filtrarCapitulo(capitulo, items);

                return (
                  <div className="accordion-item bg-dark text-light border-0 mb-2" key={i}>
                    <h2 className="accordion-header">
                      <button
                        className="accordion-button collapsed bg-dark text-light fw-bold"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target={`#collapse-${i}`}
                      >
                        {capitulo} — {info.nombre}
                      </button>
                    </h2>
                    <div id={`collapse-${i}`} className="accordion-collapse collapse">
                      <div className="accordion-body bg-dark text-light">
                        <input
                          type="text"
                          className={`form-control mb-3 ${styles.inputDark}`}
                          placeholder={`Buscar en ${info.nombre}...`}
                          value={capituloQueries[capitulo] || ''}
                          onChange={(e) =>
                            setCapituloQueries((prev) => ({
                              ...prev,
                              [capitulo]: e.target.value,
                            }))
                          }
                        />
                        <div className="table-responsive">
                          <table
                            className={`table table-dark table-hover table-striped ${styles.table}`}
                          >
                            <thead>
                              <tr>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Q GAL</th>
                                <th>Gto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(capituloQueries[capitulo]?.trim()
                                ? filtrados.map((r) => r.item)
                                : items
                              ).map((item, j) => (
                                <tr key={j}>
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
        </>
      )}
    </div>
  );
}

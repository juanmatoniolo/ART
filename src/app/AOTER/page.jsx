'use client';

import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import styles from './page.module.css';

export default function AOTER() {
    const [data, setData] = useState([]);
    const [query, setQuery] = useState('');
    const [filteredResults, setFilteredResults] = useState([]);
    const [modoBusqueda, setModoBusqueda] = useState(true);
    const [regionQueries, setRegionQueries] = useState({});

    // Cargar el archivo JSON
    useEffect(() => {
        fetch('/archivos/Nomeclador_AOTER.json')
            .then(res => res.json())
            .then(json => setData(json.practicas || []))
            .catch(err => console.error('Error cargando JSON AOTER:', err));
    }, []);

    // --- 🔍 Búsqueda global exacta ---
    useEffect(() => {
        if (!query.trim()) {
            setFilteredResults([]);
            return;
        }

        const allPractices = data.flatMap(region =>
            region.practicas.map(p => ({
                ...p,
                region: region.region,
                region_nombre: region.region_nombre,
                complejidad: region.complejidad,
            }))
        );

        const fuse = new Fuse(allPractices, {
            keys: ['descripcion', 'codigo', 'region_nombre'],
            includeMatches: true,
            threshold: 0.0,
            useExtendedSearch: true,
            ignoreLocation: true,
            isCaseSensitive: false,
        });

        const results = fuse.search(`'${query.trim()}`);
        setFilteredResults(results);
    }, [query, data]);

    // --- ✨ Resaltado de coincidencias (mejorado) ---
    const highlightMatch = (text, matchData) => {
        if (!matchData || !matchData.indices) return text;

        let parts = [];
        let lastIndex = 0;

        matchData.indices.forEach(([start, end], i) => {
            // Expande hasta límites de palabra
            while (start > 0 && /\w/.test(text[start - 1])) start--;
            while (end + 1 < text.length && /\w/.test(text[end + 1])) end++;

            parts.push(<span key={`pre-${i}`}>{text.slice(lastIndex, start)}</span>);
            parts.push(
                <mark key={`mark-${i}`} style={{ backgroundColor: '#fff3b0' }}>
                    {text.slice(start, end + 1)}
                </mark>
            );
            lastIndex = end + 1;
        });

        parts.push(<span key="last">{text.slice(lastIndex)}</span>);
        return parts;
    };


    // --- 📚 Agrupar por región ---
    const agrupadosPorRegion = data.reduce((acc, item) => {
        if (!acc[item.region_nombre]) acc[item.region_nombre] = [];
        acc[item.region_nombre].push(item);
        return acc;
    }, {});

    // --- 🔍 Filtro local por región ---
    const filtrarPracticas = (practicas, regionKey) => {
        const term = regionQueries[regionKey]?.trim();
        if (!term) return practicas;

        const fuse = new Fuse(practicas, {
            keys: ['descripcion', 'codigo'],
            includeMatches: true,
            threshold: 0.0,
            useExtendedSearch: true,
            ignoreLocation: true,
            isCaseSensitive: false,
        });

        return fuse.search(`'${term}`);
    };

    return (
        <div className={styles.wrapper}>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className={styles.title}>Nomenclador AOTER</h2>
                <button
                    className="btn btn-outline-primary"
                    onClick={() => setModoBusqueda(prev => !prev)}
                >
                    {modoBusqueda ? 'Ver por regiones' : 'Modo búsqueda global'}
                </button>
            </div>

            {/* 🌍 --- Modo búsqueda global --- */}
            {modoBusqueda ? (
                <>
                    <input
                        type="text"
                        className="form-control mb-4"
                        placeholder="Buscar práctica por código o descripción (palabra completa)..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />

                    {filteredResults.length > 0 ? (
                        (() => {
                            const agrupados = filteredResults.reduce((acc, res) => {
                                const region = res.item.region_nombre;
                                const comp = res.item.complejidad;
                                const key = `${region}#${comp}`;
                                if (!acc[key]) acc[key] = [];
                                acc[key].push(res);
                                return acc;
                            }, {});

                            return Object.entries(agrupados).map(([key, resultados]) => {
                                const [region, complejidad] = key.split('#');
                                return (
                                    <div key={key} className="mb-5">
                                        <div className="d-flex align-items-center justify-content-between bg-light p-2 rounded border mb-2">
                                            <h5 className="fw-bold m-0">
                                                🦴 {region} — Complejidad {complejidad} ({resultados.length} resultado
                                                {resultados.length !== 1 && 's'})
                                            </h5>
                                        </div>
                                        <div className="table-responsive">
                                            <table className="table table-striped">
                                                <thead>
                                                    <tr className="table-success">
                                                        <th>Código</th>
                                                        <th>Descripción</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {resultados.map((res, i) => (
                                                        <tr key={i}>
                                                            <td>{highlightMatch(res.item.codigo, res.matches?.find(m => m.key === 'codigo'))}</td>
                                                            <td>{highlightMatch(res.item.descripcion, res.matches?.find(m => m.key === 'descripcion'))}</td>
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
                // 📂 --- Modo por regiones ---
                <div className="accordion" id="accordionAOTER">
                    {Object.entries(agrupadosPorRegion).map(([region, bloques], rIndex) => (
                        <div className="accordion-item" key={rIndex}>
                            <h2 className="accordion-header" id={`heading-${rIndex}`}>
                                <button
                                    className="accordion-button collapsed"
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target={`#collapse-${rIndex}`}
                                    aria-expanded="false"
                                    aria-controls={`collapse-${rIndex}`}
                                >
                                    {region}
                                </button>
                            </h2>
                            <div
                                id={`collapse-${rIndex}`}
                                className="accordion-collapse collapse"
                                aria-labelledby={`heading-${rIndex}`}
                                data-bs-parent="#accordionAOTER"
                            >
                                <div className="accordion-body">
                                    {bloques.map((bloque, bIndex) => {
                                        const regionKey = `${region}-C${bloque.complejidad}`;
                                        const resultados = filtrarPracticas(bloque.practicas, regionKey);

                                        return (
                                            <div key={bIndex} className="mb-4 border rounded p-3">
                                                <h6 className="fw-bold mb-2 text-primary">
                                                    Complejidad {bloque.complejidad}
                                                </h6>
                                                <input
                                                    type="text"
                                                    className="form-control mb-2"
                                                    placeholder={`Buscar en ${region} (Complejidad ${bloque.complejidad})...`}
                                                    value={regionQueries[regionKey] || ''}
                                                    onChange={e =>
                                                        setRegionQueries(prev => ({
                                                            ...prev,
                                                            [regionKey]: e.target.value,
                                                        }))
                                                    }
                                                />

                                                <div className="table-responsive">
                                                    <table className="table table-striped mb-0">
                                                        <thead>
                                                            <tr>
                                                                <th>Código</th>
                                                                <th>Descripción</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {regionQueries[regionKey]?.trim()
                                                                ? resultados.length > 0
                                                                    ? resultados.map((res, i) => (
                                                                        <tr key={i}>
                                                                            <td>{highlightMatch(res.item.codigo, res.matches?.find(m => m.key === 'codigo'))}</td>
                                                                            <td>{highlightMatch(res.item.descripcion, res.matches?.find(m => m.key === 'descripcion'))}</td>
                                                                        </tr>
                                                                    ))
                                                                    : (
                                                                        <tr>
                                                                            <td colSpan="2" className="text-center text-muted">
                                                                                No se encontraron coincidencias exactas.
                                                                            </td>
                                                                        </tr>
                                                                    )
                                                                : bloque.practicas.map((p, i) => (
                                                                    <tr key={i}>
                                                                        <td>{p.codigo}</td>
                                                                        <td>{p.descripcion}</td>
                                                                    </tr>
                                                                ))}
                                                        </tbody>
                                                    </table>
                                                </div>
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

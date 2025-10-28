'use client';

import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import styles from './page.module.css';

export default function NomecladorBioquimica() {
    const [data, setData] = useState([]);
    const [query, setQuery] = useState('');
    const [filteredResults, setFilteredResults] = useState([]);
    const [modoBusqueda, setModoBusqueda] = useState(true);
    const [unidadBioquimica, setUnidadBioquimica] = useState(1224.11); // 💰 editable
    const [editingUB, setEditingUB] = useState(false);

    // 🔄 Cargar JSON
    useEffect(() => {
        fetch('/archivos/NomecladorBioquimica.json')
            .then(res => res.json())
            .then(json => {
                setData(json.nomenclador || []);
                if (json.unidad_bioquimica_valor && !isNaN(json.unidad_bioquimica_valor))
                    setUnidadBioquimica(parseFloat(json.unidad_bioquimica_valor));
            })
            .catch(err => console.error('Error cargando JSON:', err));
    }, []);

    // 🔍 Búsqueda con Fuse (exacta)
    useEffect(() => {
        if (!query.trim()) {
            setFilteredResults([]);
            return;
        }

        const fuse = new Fuse(data, {
            keys: ['codigo', 'practica_bioquimica'],
            includeMatches: true,
            threshold: 0.0,
            useExtendedSearch: true,
        });

        const results = fuse.search(`'${query.trim()}`);
        setFilteredResults(results);
    }, [query, data]);

    // ✨ Resaltado de coincidencias
    const highlightMatch = (text, matchData) => {
        if (!matchData || !matchData.indices) return text;

        const matches = matchData.indices;
        let parts = [];
        let lastIndex = 0;

        matches.forEach(([start, end], idx) => {
            parts.push(<span key={`pre-${idx}`}>{text.slice(lastIndex, start)}</span>);
            parts.push(<mark key={`mark-${idx}`}>{text.slice(start, end + 1)}</mark>);
            lastIndex = end + 1;
        });

        parts.push(<span key="final">{text.slice(lastIndex)}</span>);
        return parts;
    };

    // 📊 Recalcular valor dinámico
    const calcularValor = (unidad) => {
        if (!unidad || isNaN(unidad)) return '-';
        return (unidad * unidadBioquimica).toFixed(2);
    };

    // 💬 Placeholder dinámico
    const placeholderUB = editingUB
        ? `Unidad Bioquímica actual: ${unidadBioquimica} (editable)`
        : `Buscar código o práctica — UB: ${unidadBioquimica}`;

    return (
        <div className={styles.wrapper}>
            <div className="d-flex justify-content-between align-items-center mb-3">
                <h2 className={styles.title}>Nomeclador de Bioquímica</h2>
                <button
                    className="btn btn-outline-primary"
                    onClick={() => setModoBusqueda(prev => !prev)}
                >
                    {modoBusqueda ? 'Ver todas las prácticas' : 'Modo búsqueda'}
                </button>
            </div>

            {modoBusqueda ? (
                <>
                    <div className="d-flex gap-2 align-items-center mb-3">
                        <input
                            type="number"
                            step="0.01"
                            className="form-control w-auto"
                            value={unidadBioquimica}
                            onFocus={() => setEditingUB(true)}
                            onBlur={() => setEditingUB(false)}
                            onChange={e => setUnidadBioquimica(parseFloat(e.target.value) || 0)}
                            title="Modificar valor de la Unidad Bioquímica"
                        />
                        <span className="text-muted small">
                            Valor base UB (editable)
                        </span>
                    </div>

                    <input
                        type="text"
                        className="form-control mb-4"
                        placeholder={placeholderUB}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />

                    {filteredResults.length > 0 ? (
                        <div className="table-responsive">
                            <table className="table table-striped table-hover">
                                <thead className="table-success">
                                    <tr>
                                        <th>Código</th>
                                        <th>Práctica Bioquímica</th>
                                        <th>Urgencia</th>
                                        <th>N/I</th>
                                        <th>U.B.</th>
                                        <th>Valor Calculado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredResults.map((res, i) => (
                                        <tr key={i}>
                                            <td>{highlightMatch(res.item.codigo, res.matches?.find(m => m.key === 'codigo'))}</td>
                                            <td>{highlightMatch(res.item.practica_bioquimica, res.matches?.find(m => m.key === 'practica_bioquimica'))}</td>
                                            <td>{res.item.urgencia ? '✅' : ''}</td>
                                            <td>{res.item["N/I"] || '-'}</td>
                                            <td>{res.item.unidad_bioquimica ?? '-'}</td>
                                            <td>
                                                {res.item.unidad_bioquimica
                                                    ? calcularValor(res.item.unidad_bioquimica)
                                                    : '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        query.trim() && (
                            <p className="text-center text-muted mt-3">No se encontraron coincidencias exactas.</p>
                        )
                    )}
                </>
            ) : (
                <div className="table-responsive mt-4">
                    <table className="table table-striped table-hover">
                        <thead className="table-success">
                            <tr>
                                <th>Código</th>
                                <th>Práctica Bioquímica</th>
                                <th>Urgencia</th>
                                <th>N/I</th>
                                <th>U.B.</th>
                                <th>Valor Calculado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((item, i) => (
                                <tr key={i}>
                                    <td>{item.codigo}</td>
                                    <td>{item.practica_bioquimica}</td>
                                    <td>{item.urgencia ? '✅' : ''}</td>
                                    <td>{item["N/I"] || '-'}</td>
                                    <td>{item.unidad_bioquimica ?? '-'}</td>
                                    <td>
                                        {item.unidad_bioquimica
                                            ? calcularValor(item.unidad_bioquimica)
                                            : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

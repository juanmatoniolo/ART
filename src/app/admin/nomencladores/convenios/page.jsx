'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

export default function PrestadoresART() {
    const archivos = {
        junio: '/archivos/PrestadoresART-Junio-Septiembre.json',
        octubre: '/archivos/PrestadoresART-Octubre.json',
    };

    const periodos = Object.keys(archivos);
    const ultimoPeriodo = periodos[periodos.length - 1];

    const [periodo, setPeriodo] = useState(ultimoPeriodo);
    const [data, setData] = useState(null);
    const [filteredData, setFilteredData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');

    useEffect(() => {
        setLoading(true);
        fetch(archivos[periodo])
            .then((res) => {
                if (!res.ok) throw new Error('Error al cargar el archivo JSON');
                return res.json();
            })
            .then((json) => {
                setData(json);
                setFilteredData(json);
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [periodo]);

    useEffect(() => {
        if (!data) return;
        if (!query.trim()) {
            setFilteredData(data);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const valoresFiltrados = Object.entries(data.valores_generales).filter(
            ([key, value]) =>
                key.toLowerCase().includes(lowerQuery) ||
                value?.toString().toLowerCase().includes(lowerQuery)
        );

        setFilteredData({
            ...data,
            valores_generales: Object.fromEntries(valoresFiltrados),
        });
    }, [query, data]);

    const calcularValor = (base, expresion) => {
        if (typeof base !== 'number') return expresion;
        if (typeof expresion === 'number') return `$${expresion.toLocaleString('es-AR')}`;

        if (typeof expresion === 'string') {
            const match = expresion.match(/(\d+)%/);
            if (match) {
                const porcentaje = parseFloat(match[1]);
                const valor = (base * porcentaje) / 100;
                return `$${valor.toLocaleString('es-AR')} (${porcentaje}%)`;
            }

            if (expresion.includes('20%')) {
                const valor = (base * 0.2).toFixed(0);
                return `$${parseInt(valor).toLocaleString('es-AR')} (20% c/u)`;
            }
        }

        return expresion;
    };

    if (loading)
        return (
            <div className={styles.wrapper}>
                <p className="text-muted">Cargando datos...</p>
            </div>
        );

    if (!data)
        return (
            <div className={styles.wrapper}>
                <p className="text-danger">No se encontraron datos para este período.</p>
            </div>
        );

    return (
        <div className={styles.wrapper}>
            {/* === ENCABEZADO === */}
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
                <h2 className={styles.title}>{data.titulo}</h2>

                <select
                    className={styles.select}
                    value={periodo}
                    onChange={(e) => setPeriodo(e.target.value)}
                >
                    {periodos.map((p) => (
                        <option key={p} value={p}>
                            {p === 'junio' ? '🗓️ Junio – Septiembre 2025' : '🆕 Octubre 2025'}
                        </option>
                    ))}
                </select>
            </div>

            <p className={styles.subtitle}>Vigencia: {data.vigencia}</p>

            {/* === BUSCADOR === */}
            <div className={styles.searchContainer}>
                <input
                    type="text"
                    className={styles.search}
                    placeholder="🔍 Buscar concepto o valor..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />
            </div>

            {/* === TABLA PRINCIPAL === */}
            <div className="table-responsive">
                <table className={`table table-dark table-striped ${styles.table}`}>
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th className="text-end">Valor ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(filteredData.valores_generales).length > 0 ? (
                            Object.entries(filteredData.valores_generales).map(([key, value]) => (
                                <tr key={key}>
                                    <td>{key.replaceAll('_', ' ')}</td>
                                    <td className="text-end">
                                        {value ? value.toLocaleString('es-AR') : '-'}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="2" className="text-center text-muted">
                                    No se encontraron coincidencias.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* === HONORARIOS MÉDICOS === */}
            <h5 className={styles.sectionTitle}>👨‍⚕️ Honorarios Médicos</h5>
            <div className="table-responsive">
                <table className={`table table-dark table-striped ${styles.table}`}>
                    <thead>
                        <tr>
                            <th>Nivel</th>
                            <th>Cirujano</th>
                            <th>Ayudante 1</th>
                            <th>Ayudante 2</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.honorarios_medicos?.niveles?.map((nivel, i) => (
                            <tr key={i}>
                                <td>{nivel.nivel}</td>
                                <td>
                                    {typeof nivel.cirujano === 'number'
                                        ? `$${nivel.cirujano.toLocaleString('es-AR')}`
                                        : nivel.cirujano}
                                </td>
                                <td>{calcularValor(nivel.cirujano, nivel.ayudante_1)}</td>
                                <td>{calcularValor(nivel.cirujano, nivel.ayudante_2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* === CONDICIONES === */}
            <h5 className={styles.sectionTitle}>📋 Condiciones del Convenio</h5>
            <ul className={styles.condiciones}>
                {Object.entries(data.condiciones || {}).map(([key, value]) => (
                    <li key={key}>
                        <strong>{key.charAt(0).toUpperCase() + key.slice(1)}:</strong> {value}
                    </li>
                ))}
            </ul>

            {/* === FIRMA === */}
            <footer className={styles.footer}>
                <p>
                    <span className="fw-semibold text-light">
                        {data.firma?.entidad || 'Clínica de la Unión'}
                    </span>{' '}
                    — CUIT: {data.firma?.CUIT || '30-70754530-1'}
                </p>
            </footer>
        </div>
    );
}

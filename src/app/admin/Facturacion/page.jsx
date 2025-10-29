'use client';

import { useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';

export default function FacturacionPage() {
    const [dataJunio, setDataJunio] = useState(null);
    const [dataOctubre, setDataOctubre] = useState(null);
    const [mes, setMes] = useState('junio');
    const [dataActual, setDataActual] = useState(null);
    const [error, setError] = useState(null);

    // 🔍 Buscador
    const [filtro, setFiltro] = useState('');

    useEffect(() => {
        const cargarDatos = async () => {
            try {
                const [junioRes, octubreRes] = await Promise.all([
                    fetch('/archivos/PrestadoresART-Junio-Septiembre.json'),
                    fetch('/archivos/PrestadoresART-Octubre.json'),
                ]);

                if (!junioRes.ok || !octubreRes.ok) throw new Error('Error al cargar archivos');

                const junioData = await junioRes.json();
                const octubreData = await octubreRes.json();

                setDataJunio(junioData);
                setDataOctubre(octubreData);
                setDataActual(junioData);
            } catch (err) {
                console.error('❌ Error al cargar datos:', err);
                setError('No se pudieron cargar los archivos de facturación.');
            }
        };

        cargarDatos();
    }, []);

    useEffect(() => {
        if (mes === 'junio') setDataActual(dataJunio);
        else setDataActual(dataOctubre);
    }, [mes, dataJunio, dataOctubre]);

    if (error)
        return (
            <div className="container py-5 text-center text-danger">
                <h5>{error}</h5>
                <p className="text-muted">Verificá que los archivos estén en /public/archivos/</p>
            </div>
        );

    if (!dataActual)
        return (
            <div className="container py-5 text-center">
                <div className="spinner-border text-success" role="status"></div>
                <p className="mt-3 text-muted">Cargando datos de facturación...</p>
            </div>
        );

    const valores = dataActual.valores_generales || {};
    const honorarios = dataActual.honorarios_medicos?.niveles || [];

    // 🧠 Filtrar valores por el buscador
    const filtrarTexto = (texto) => texto.toLowerCase().includes(filtro.toLowerCase());

    const valoresFiltrados = Object.entries(valores).filter(([key, val]) => {
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            return Object.entries(val).some(([subKey]) => filtrarTexto(subKey) || filtrarTexto(key));
        }
        return filtrarTexto(key);
    });

    const honorariosFiltrados = honorarios.filter(
        (h) =>
            filtrarTexto(h.nivel.toString()) ||
            filtrarTexto(h.cirujano.toString()) ||
            filtrarTexto(h.ayudante_1?.toString() || '') ||
            filtrarTexto(h.ayudante_2?.toString() || '')
    );

    return (
        <div className="container py-4">
            <h1 className="text-center text-success mb-4 fw-bold">
                📋 Facturación ART — {dataActual.titulo}
            </h1>

            {/* 🔹 Selector de Mes */}
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-center mb-4">
                <div>
                    <select
                        className="form-select"
                        style={{ width: '250px' }}
                        value={mes}
                        onChange={(e) => setMes(e.target.value)}
                    >
                        <option value="junio">Junio – Septiembre 2025</option>
                        <option value="octubre">Octubre 2025</option>
                    </select>
                </div>

                {/* 🔍 Buscador */}
                <div className="input-group mt-3 mt-md-0" style={{ maxWidth: '400px' }}>
                    <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar concepto, nivel o valor..."
                        value={filtro}
                        onChange={(e) => setFiltro(e.target.value)}
                    />
                    <button className="btn btn-outline-secondary" onClick={() => setFiltro('')}>
                        Limpiar
                    </button>
                </div>
            </div>

            {/* 🔹 Vigencia */}
            <p className="text-center text-muted mb-4">
                <strong>Vigencia:</strong> {dataActual.vigencia}
            </p>

            {/* 🔹 Tabla de Valores Generales */}
            <div className="card shadow-sm mb-4 border-0">
                <div className="card-header bg-success text-white fw-semibold">
                    Valores Generales
                </div>
                <div className="card-body table-responsive">
                    <table className="table table-hover align-middle">
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th className="text-end">Valor ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {valoresFiltrados.length > 0 ? (
                                valoresFiltrados.map(([key, val]) => {
                                    if (val && typeof val === 'object' && !Array.isArray(val)) {
                                        return Object.entries(val)
                                            .filter(([subKey]) => filtrarTexto(subKey) || filtrarTexto(key))
                                            .map(([subKey, subVal]) => (
                                                <tr key={`${key}-${subKey}`}>
                                                    <td>{`${key.replaceAll('_', ' ')} - ${subKey}`}</td>
                                                    <td className="text-end">
                                                        {Number(subVal).toLocaleString('es-AR', {
                                                            minimumFractionDigits: 2,
                                                        })}
                                                    </td>
                                                </tr>
                                            ));
                                    }

                                    return (
                                        <tr key={key}>
                                            <td>{key.replaceAll('_', ' ')}</td>
                                            <td className="text-end">
                                                {val
                                                    ? Number(val).toLocaleString('es-AR', {
                                                        minimumFractionDigits: 2,
                                                    })
                                                    : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan="2" className="text-center text-muted py-4">
                                        No se encontraron resultados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 🔹 Tabla Honorarios Médicos */}
            <div className="card shadow-sm border-0">
                <div className="card-header bg-primary text-white fw-semibold">
                    Honorarios Médicos por Nivel de Complejidad
                </div>
                <div className="card-body table-responsive">
                    <table className="table table-striped align-middle">
                        <thead>
                            <tr>
                                <th>Nivel</th>
                                <th>Cirujano ($)</th>
                                <th>Ayudante 1</th>
                                <th>Ayudante 2</th>
                            </tr>
                        </thead>
                        <tbody>
                            {honorariosFiltrados.length > 0 ? (
                                honorariosFiltrados.map((h, i) => (
                                    <tr key={i}>
                                        <td className="fw-semibold">{h.nivel}</td>
                                        <td>{Number(h.cirujano).toLocaleString('es-AR')}</td>
                                        <td>{h.ayudante_1 || '-'}</td>
                                        <td>{h.ayudante_2 || '-'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="4" className="text-center text-muted py-4">
                                        No se encontraron resultados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 🔹 Condiciones */}
            {dataActual.condiciones && (
                <div className="mt-4 p-3 bg-light border rounded-3">
                    <h5 className="fw-bold text-success mb-3">📝 Condiciones</h5>
                    <ul className="list-unstyled">
                        {Object.entries(dataActual.condiciones).map(([key, texto]) => (
                            <li key={key}>📌 {texto}</li>
                        ))}
                    </ul>
                </div>
            )}

            <p className="text-muted small mt-4 text-center">
                {dataActual.firma?.entidad} — CUIT {dataActual.firma?.CUIT}
            </p>
        </div>
    );
}

'use client';

import { useEffect, useState } from 'react';
import Fuse from 'fuse.js';
import Link from 'next/link';

export default function Home() {
    const [pacientes, setPacientes] = useState([]);
    const [query, setQuery] = useState('');
    const [resultados, setResultados] = useState([]);

    // 🔹 Obtener pacientes desde Firebase
    useEffect(() => {
        const fetchPacientes = async () => {
            try {
                const res = await fetch('https://datos-clini-default-rtdb.firebaseio.com/pacientes.json');
                const data = await res.json();
                if (!data) return;
                const lista = Object.entries(data).map(([id, valores]) => ({ id, ...valores }));
                setPacientes(lista);
            } catch (error) {
                console.error('Error al obtener pacientes:', error);
            }
        };

        fetchPacientes();
    }, []);

    // 🔹 Buscar pacientes en ambas listas
    useEffect(() => {
        if (!query.trim()) {
            setResultados([]);
            return;
        }

        const fuse = new Fuse(pacientes, {
            keys: ['Nombre', 'Apellido', 'dni', 'Empleador', 'estado'],
            includeMatches: true,
            threshold: 0.3,
        });

        setResultados(fuse.search(query));
    }, [query, pacientes]);

    // 🔹 Función para resaltar coincidencias
    const highlight = (text, match) => {
        if (!match || !text) return text;
        const indices = match.indices;
        let result = '';
        let lastIndex = 0;
        indices.forEach(([start, end]) => {
            result += text.slice(lastIndex, start);
            result += `<mark>${text.slice(start, end + 1)}</mark>`;
            lastIndex = end + 1;
        });
        result += text.slice(lastIndex);
        return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    // 🔹 Filtrar listas
    const listaFinal = query.trim()
        ? resultados.map(r => ({ ...r.item, matches: r.matches }))
        : pacientes;

    const pacientesActivos = listaFinal.filter(p => p.estado !== 'Alta médica');
    const pacientesAlta = listaFinal.filter(p => p.estado === 'Alta médica');

    return (
        <div className="container py-4">
            <h1 className="display-5 text-center mb-3">Bienvenido al sistema de gestión</h1>
            <p className="lead text-center">Seleccione una opción del menú para comenzar.</p>

            {/* 🔍 Buscador */}
            <div className="my-4">
                <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar paciente por nombre, apellido, DNI, empleador o estado..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                />
            </div>

            {/* 🩺 Pacientes en tratamiento */}
            <h2 className="mb-3 text-success">Pacientes en tratamiento</h2>
            {pacientesActivos.length === 0 ? (
                <p className="text-muted">No se encontraron pacientes en tratamiento.</p>
            ) : (
                <ul className="list-group mb-5 shadow-sm rounded-3">
                    {pacientesActivos.map((paciente, i) => (
                        <li
                            key={i}
                            className="list-group-item d-flex justify-content-between align-items-center"
                        >
                            <div>
                                <strong>
                                    {highlight(paciente.Nombre, paciente.matches?.find(m => m.key === 'Nombre'))}{' '}
                                    {highlight(paciente.Apellido, paciente.matches?.find(m => m.key === 'Apellido'))}
                                </strong>{' '}
                                - DNI: {highlight(paciente.dni, paciente.matches?.find(m => m.key === 'dni'))}
                                <br />
                                <small className="text-muted">
                                    {paciente.Empleador && <>Empleador: {paciente.Empleador}</>}
                                </small>
                            </div>
                            <Link href={`/admin/pacientes/${paciente.id}`} className="btn btn-sm btn-primary">
                                Ver ficha
                            </Link>
                        </li>
                    ))}
                </ul>
            )}

            {/* 🏥 Pacientes con alta médica */}
            <h2 className="mb-3 text-danger">Pacientes con Alta Médica</h2>
            {pacientesAlta.length === 0 ? (
                <p className="text-muted">No hay pacientes con alta médica.</p>
            ) : (
                <ul className="list-group shadow-sm rounded-3">
                    {pacientesAlta.map((paciente, i) => (
                        <li
                            key={i}
                            className="list-group-item d-flex justify-content-between align-items-center bg-light"
                        >
                            <div>
                                <strong>
                                    {highlight(paciente.Nombre, paciente.matches?.find(m => m.key === 'Nombre'))}{' '}
                                    {highlight(paciente.Apellido, paciente.matches?.find(m => m.key === 'Apellido'))}
                                </strong>{' '}
                                - DNI: {highlight(paciente.dni, paciente.matches?.find(m => m.key === 'dni'))}
                                <br />
                                <span className="badge bg-danger">Alta médica</span>
                            </div>
                            <Link href={`/admin/pacientes/${paciente.id}`} className="btn btn-sm btn-outline-danger">
                                Ver ficha
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

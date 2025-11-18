'use client';

import { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import Fuse from 'fuse.js';
import styles from './page.module.css';

/* === Utils === */
const normalize = (s) =>
    (s ?? '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

function highlight(text, query) {
    if (!query) return text;
    const normalizedText = normalize(text);
    const normalizedQuery = normalize(query);
    const idx = normalizedText.indexOf(normalizedQuery);
    if (idx === -1) return text;

    const before = text.slice(0, idx);
    const match = text.slice(idx, idx + query.length);
    const after = text.slice(idx + query.length);

    return (
        <>
            {before}
            <mark className={styles.highlight}>{match}</mark>
            {after}
        </>
    );
}

const money = (n) => {
    if (n == null || n === '' || n === '-') return '-';
    const num = parseFloat(n.toString().replace(',', '.'));
    if (isNaN(num)) return n;
    return num.toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
};

// 🔹 Normaliza las claves para eliminar espacios y guiones bajos de forma legible
const formatKey = (key) =>
    key
        .replaceAll('_', ' ')
        .replace(/\b([a-z])/g, (c) => c.toUpperCase()) // Primera letra mayúscula
        .trim();

export default function PrestadoresART() {
    const [convenios, setConvenios] = useState({});
    const [convenioSel, setConvenioSel] = useState('');
    const [data, setData] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // === LECTURA DE CONVENIOS ===
    useEffect(() => {
        const conveniosRef = ref(db, 'convenios');
        const unsubscribe = onValue(conveniosRef, (snapshot) => {
            const val = snapshot.exists() ? snapshot.val() : {};

            // 🔸 Limpieza de claves
            const normalizado = Object.keys(val).reduce((acc, k) => {
                const clean = k.trim();
                acc[clean] = val[k];
                return acc;
            }, {});

            setConvenios(normalizado);

            const stored = localStorage.getItem('convenioActivo');
            const elegir = stored && normalizado[stored] ? stored : Object.keys(normalizado)[0] || '';
            setConvenioSel(elegir);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // === CARGA DEL CONVENIO SELECCIONADO ===
    useEffect(() => {
        if (!convenioSel || !convenios[convenioSel]) {
            setData(null);
            return;
        }
        const convenio = convenios[convenioSel];
        setData(convenio);
        localStorage.setItem('convenioActivo', convenioSel);
    }, [convenioSel, convenios]);

    // === CÁLCULOS DE VALORES ===
    const calcularValor = (base, expresion) => {
        if (typeof base !== 'number') return expresion;
        if (typeof expresion === 'number') return `$${money(expresion)}`;

        if (typeof expresion === 'string') {
            const match = expresion.match(/(\d+)%/);
            if (match) {
                const porcentaje = parseFloat(match[1]);
                const valor = (base * porcentaje) / 100;
                return `$${money(valor)} (${porcentaje}%)`;
            }
            if (expresion.includes('20%')) {
                const valor = (base * 0.2).toFixed(0);
                return `$${money(valor)} (20% c/u)`;
            }
        }
        return expresion;
    };

    // === FILTRO Y BÚSQUEDA ===
    const resultados = useMemo(() => {
        if (!data?.valores_generales) return [];
        const valores = Object.entries(data.valores_generales);
        const q = query.trim();

        if (!q) return valores.map(([key, val]) => ({ key, val, exact: false }));

        const exactMatches = valores
            .filter(
                ([key, value]) =>
                    normalize(key).includes(normalize(q)) ||
                    normalize(value?.toString() || '').includes(normalize(q))
            )
            .map(([key, val]) => ({ key, val, exact: true }));

        const fuse = new Fuse(valores.map(([key, val]) => ({ key, val })), {
            keys: ['key', 'val'],
            threshold: 0.3,
            ignoreLocation: true,
        });

        const fuzzyResults = fuse.search(q).map((r) => ({
            key: r.item.key,
            val: r.item.val,
            exact: false,
        }));

        const seen = new Set();
        return [...exactMatches, ...fuzzyResults].filter((item) => {
            if (seen.has(item.key)) return false;
            seen.add(item.key);
            return true;
        });
    }, [query, data]);

    if (loading)
        return (
            <div className={styles.wrapper}>
                <p className={styles.info}>Cargando convenios...</p>
            </div>
        );

    if (!data)
        return (
            <div className={styles.wrapper}>
                <p className={styles.error}>No se encontraron convenios.</p>
            </div>
        );

    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h2 className={styles.title}>🩺 Convenios ART</h2>
                <select
                    className={styles.select}
                    value={convenioSel}
                    onChange={(e) => setConvenioSel(e.target.value)}
                >
                    {Object.keys(convenios).map((k) => (
                        <option key={k} value={k}>
                            {k}
                        </option>
                    ))}
                </select>
            </div>

            <input
                type="text"
                className={styles.search}
                placeholder="🔍 Buscar concepto o valor..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
            />

            {/* === Tabla de valores generales === */}
            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Concepto</th>
                            <th>Valor ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {resultados.length > 0 ? (
                            resultados.map(({ key, val, exact }, i) => (
                                <tr key={i} className={exact ? styles.exactRow : ''}>
                                    <td>{highlight(formatKey(key), query)}</td>
                                    <td className={styles.numeric}>
                                        {highlight(money(val?.toString() || '-'), query)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="2" className={styles.noResults}>
                                    No se encontraron coincidencias.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* === Honorarios Médicos === */}
            {data.honorarios_medicos && (
                <>
                    <h5 className={styles.sectionTitle}>👨‍⚕️ Honorarios Médicos</h5>
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Nivel</th>
                                    <th>Cirujano</th>
                                    <th>Ayudante 1</th>
                                    <th>Ayudante 2</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(data.honorarios_medicos).map(([nivel, h], i) => {
                                    const nivelNumerico = parseInt(nivel.replace(/\D/g, ""), 10);
                                    const nivelReal = isNaN(nivelNumerico) ? formatKey(nivel) : `Nivel ${nivelNumerico + 1}`;

                                    return (
                                        <tr key={i}>
                                            <td>{nivelReal}</td>
                                            <td>{money(h.Cirujano)}</td>
                                            <td>{calcularValor(h.Cirujano, h['Ayudante_1'] || h['Ayudante 1'])}</td>
                                            <td>{calcularValor(h.Cirujano, h['Ayudante_2'] || h['Ayudante 2'])}</td>
                                        </tr>
                                    );
                                })}

                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {/* === Condiciones === */}
            {data.condiciones && (
                <>
                    <h5 className={styles.sectionTitle}>📋 Condiciones del Convenio</h5>
                    <ul className={styles.condiciones}>
                        {Object.entries(data.condiciones).map(([key, value]) => (
                            <li key={key}>
                                <strong>{formatKey(key)}:</strong> {value}
                            </li>
                        ))}
                    </ul>
                </>
            )}

            <footer className={styles.footer}>
                <p>
                    <span className={styles.firma}>{data.firma?.entidad || 'Clínica de la Unión'}</span> — CUIT:{' '}
                    {data.firma?.CUIT || '30-70754530-1'}
                </p>
            </footer>
        </div>
    );
}

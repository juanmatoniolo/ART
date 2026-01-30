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

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function highlight(text, query) {
    if (!text || !query) return text;
    const safe = escapeRegExp(query);
    const regex = new RegExp(`(${safe})`, 'gi');
    const parts = String(text).split(regex);

    return parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
            <mark key={i} className={styles.highlight}>
                {part}
            </mark>
        ) : (
            part
        )
    );
}

const money = (n) => {
    if (n == null || n === '' || n === '-') return '-';
    
    // Si ya es un número, formatearlo directamente
    if (typeof n === 'number') {
        return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    
    // Si es string, intentar convertirlo manteniendo las comas como decimales
    const str = String(n).trim();
    
    // Remover puntos de separación de miles
    const sinPuntosMiles = str.replace(/\.(?=\d{3})/g, '');
    
    // Reemplazar coma decimal por punto
    const conPuntoDecimal = sinPuntosMiles.replace(',', '.');
    
    const num = parseFloat(conPuntoDecimal);
    
    if (Number.isNaN(num)) return str;
    
    return num.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};
const formatKey = (key) =>
    String(key)
        .replaceAll('_', ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b([a-z])/g, (c) => c.toUpperCase())
        .trim();

export default function PrestadoresART() {
    const [convenios, setConvenios] = useState({});
    const [convenioSel, setConvenioSel] = useState('');
    const [data, setData] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(true);

    // ✅ nuevo: mostrar todo sin buscar
    const [mostrarTodo, setMostrarTodo] = useState(false);

    // === LECTURA DE CONVENIOS ===
    useEffect(() => {
        const conveniosRef = ref(db, 'convenios');
        const unsubscribe = onValue(conveniosRef, (snapshot) => {
            const val = snapshot.exists() ? snapshot.val() : {};

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

    // === CÁLCULOS DE VALORES (ayudantes como % del cirujano) ===
    const calcularValor = (base, expresion) => {
        const baseNum = typeof base === 'number' ? base : parseFloat(String(base).replace('.', '').replace(',', '.'));

        if (!Number.isFinite(baseNum)) return String(expresion ?? '-');
        if (typeof expresion === 'number') return `$${money(expresion)}`;

        if (typeof expresion === 'string') {
            const match = expresion.match(/(\d+)\s*%/);
            if (match) {
                const porcentaje = parseFloat(match[1]);
                const valor = (baseNum * porcentaje) / 100;
                return `$${money(valor)} (${porcentaje}%)`;
            }
            if (expresion.includes('20%')) {
                const valor = baseNum * 0.2;
                return `$${money(valor)} (20% c/u)`;
            }
        }
        return String(expresion ?? '-');
    };

    // === Valores generales: fuente de datos ===
    const valoresGenerales = useMemo(() => {
        if (!data?.valores_generales) return [];
        return Object.entries(data.valores_generales).map(([key, val]) => ({ key, val }));
    }, [data]);

    // Fuse (una vez por convenio)
    const fuseVG = useMemo(() => {
        if (!valoresGenerales.length) return null;
        return new Fuse(valoresGenerales, {
            keys: ['key', 'val'],
            threshold: 0.3,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });
    }, [valoresGenerales]);

    // === FILTRO Y BÚSQUEDA (valores generales) ===
    const resultadosVG = useMemo(() => {
        if (!valoresGenerales.length) return [];

        const qTrim = query.trim();
        const showAll = mostrarTodo && !qTrim;

        if (showAll) {
            // orden por key
            return [...valoresGenerales]
                .sort((a, b) => String(a.key).localeCompare(String(b.key)))
                .map((x) => ({ ...x, exact: false }));
        }

        if (!qTrim) {
            return valoresGenerales.map((x) => ({ ...x, exact: false }));
        }

        const qNorm = normalize(qTrim);

        const exactMatches = valoresGenerales
            .filter(
                ({ key, val }) =>
                    normalize(key).includes(qNorm) || normalize(val?.toString() || '').includes(qNorm)
            )
            .map((x) => ({ ...x, exact: true }));

        const fuzzy = fuseVG ? fuseVG.search(qTrim).map((r) => ({ ...r.item, exact: false })) : [];

        const seen = new Set();
        return [...exactMatches, ...fuzzy].filter((item) => {
            // ✅ dedupe estable
            const k = String(item.key);
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [query, mostrarTodo, valoresGenerales, fuseVG]);

    // === Honorarios Médicos (normalizamos array u objeto) ===
    const honorarios = useMemo(() => {
        const h = data?.honorarios_medicos;
        if (!h) return [];

        // si es array: [{Cirujano,...}, ...]
        if (Array.isArray(h)) {
            return h.map((row, idx) => ({
                nivelLabel: `Nivel ${idx + 1}`,
                row,
                key: `nivel-${idx + 1}`,
            }));
        }

        // si es objeto: {"0": {...}} o {"Nivel_0": {...}}
        return Object.entries(h).map(([nivel, row]) => {
            const n = parseInt(String(nivel).replace(/\D/g, ''), 10);
            const nivelLabel = Number.isFinite(n) ? `Nivel ${n + 1}` : formatKey(nivel);
            return { nivelLabel, row, key: `nivel-${nivel}` };
        });
    }, [data]);

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
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <h2 className={styles.title}>🩺 Convenios ART</h2>

                    <button
                        type="button"
                        className={`${styles.toggle} ${mostrarTodo ? styles.toggleOn : ''}`}
                        onClick={() => setMostrarTodo((v) => !v)}
                        aria-pressed={mostrarTodo}
                    >
                        <span className={styles.toggleKnob} />
                        <span className={styles.toggleText}>Mostrar todo</span>
                    </button>
                </div>

                <div className={styles.topControls}>
                    <div className={styles.controlBlock}>
                        <label className={styles.label}>Convenio</label>
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

                    <div className={styles.controlBlock}>
                        <label className={styles.label}>Buscar</label>
                        <input
                            type="text"
                            className={styles.search}
                            placeholder="Buscar concepto o valor…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            autoComplete="off"
                            spellCheck={false}
                            inputMode="search"
                        />
                    </div>
                </div>
            </div>

            {/* ===== Valores generales ===== */}
            <section className={styles.section}>
                <h5 className={styles.sectionTitle}>📌 Valores generales</h5>

                {/* Mobile cards */}
                <div className={styles.mobileList}>
                    {resultadosVG.length ? (
                        resultadosVG.map(({ key, val, exact }) => (
                            <article key={`vg-${key}`} className={`${styles.card} ${exact ? styles.exactCard : ''}`}>
                                <div className={styles.cardTop}>
                                    <div className={styles.cardKey}>{highlight(formatKey(key), query)}</div>
                                    {exact ? <span className={styles.badgeOk}>✅</span> : <span className={styles.badgeGhost}>•</span>}
                                </div>
                                <div className={styles.cardVal}>{highlight(money(val?.toString() || '-'), query)}</div>
                            </article>
                        ))
                    ) : (
                        <div className={styles.noResults}>No se encontraron coincidencias.</div>
                    )}
                </div>

                {/* Desktop table */}
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Concepto</th>
                                <th className={styles.numeric}>Valor ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {resultadosVG.length ? (
                                resultadosVG.map(({ key, val, exact }) => (
                                    <tr key={`vg-row-${key}`} className={exact ? styles.exactRow : ''}>
                                        <td className={styles.conceptCell}>{highlight(formatKey(key), query)}</td>
                                        <td className={styles.numeric}>{highlight(money(val?.toString() || '-'), query)}</td>
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
            </section>

            {/* ===== Honorarios ===== */}
            {!!honorarios.length && (
                <section className={styles.section}>
                    <h5 className={styles.sectionTitle}>👨‍⚕️ Honorarios médicos</h5>

                    {/* Mobile cards */}
                    <div className={styles.mobileList}>
                        {honorarios.map(({ key, nivelLabel, row }) => (
                            <article key={key} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <div className={styles.cardKey}>{nivelLabel}</div>
                                </div>

                                <div className={styles.grid3}>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>Cirujano</span>
                                        <span className={styles.metaValue}>{money(row.Cirujano)}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>Ayud. 1</span>
                                        <span className={styles.metaValue}>
                                            {calcularValor(row.Cirujano, row['Ayudante_1'] || row['Ayudante 1'])}
                                        </span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>Ayud. 2</span>
                                        <span className={styles.metaValue}>
                                            {calcularValor(row.Cirujano, row['Ayudante_2'] || row['Ayudante 2'])}
                                        </span>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className={styles.tableWrapper}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Nivel</th>
                                    <th className={styles.numeric}>Cirujano</th>
                                    <th className={styles.numeric}>Ayudante 1</th>
                                    <th className={styles.numeric}>Ayudante 2</th>
                                </tr>
                            </thead>
                            <tbody>
                                {honorarios.map(({ key, nivelLabel, row }) => (
                                    <tr key={`h-${key}`}>
                                        <td>{nivelLabel}</td>
                                        <td className={styles.numeric}>{money(row.Cirujano)}</td>
                                        <td className={styles.numeric}>
                                            {calcularValor(row.Cirujano, row['Ayudante_1'] || row['Ayudante 1'])}
                                        </td>
                                        <td className={styles.numeric}>
                                            {calcularValor(row.Cirujano, row['Ayudante_2'] || row['Ayudante 2'])}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* ===== Condiciones ===== */}
            {!!data?.condiciones && (
                <section className={styles.section}>
                    <h5 className={styles.sectionTitle}>📋 Condiciones del convenio</h5>

                    <ul className={styles.condiciones}>
                        {Object.entries(data.condiciones).map(([key, value]) => (
                            <li key={key} className={styles.condItem}>
                                <strong>{formatKey(key)}:</strong> {String(value)}
                            </li>
                        ))}
                    </ul>
                </section>
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

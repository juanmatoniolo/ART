'use client';

import { useEffect, useMemo, useState } from 'react';
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

/** Escapa RegExp para evitar bugs con ., +, (, etc. */
const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Highlight seguro (no rompe input, ni regex) */
const highlight = (text, query) => {
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
};

// CORRECCIÓN PRINCIPAL: Función money mejorada
const money = (n) => {
    if (n == null || n === '' || n === '-') return '-';
    
    // Si ya es número, formatearlo directamente
    if (typeof n === 'number') {
        return n.toLocaleString('es-AR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    }
    
    const str = String(n).trim();
    
    // Detectar si es un número con formato argentino (puntos como separadores de miles, coma decimal)
    // Ejemplo: "1.234,56" o "1.234" o "1234,56"
    
    // Si tiene punto y coma, es formato argentino completo
    if (str.includes('.') && str.includes(',')) {
        // Eliminar puntos de miles (solo los que tienen 3 dígitos después)
        const sinPuntosMiles = str.replace(/\.(?=\d{3})/g, '');
        // Reemplazar coma decimal por punto
        const conPuntoDecimal = sinPuntosMiles.replace(',', '.');
        const num = parseFloat(conPuntoDecimal);
        return Number.isNaN(num) ? str : num.toLocaleString('es-AR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    }
    
    // Si solo tiene coma (puede ser decimal o separador de miles)
    if (str.includes(',')) {
        // Verificar si la coma es decimal (1-2 dígitos después de la coma)
        const partes = str.split(',');
        if (partes.length === 2) {
            const despuesComa = partes[1];
            // Si tiene 1-2 dígitos después de la coma, es decimal
            if (despuesComa.length <= 2) {
                const num = parseFloat(str.replace(',', '.'));
                return Number.isNaN(num) ? str : num.toLocaleString('es-AR', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                });
            }
        }
        // Si no, eliminar comas y tratar como número entero
        const sinComas = str.replace(/,/g, '');
        const num = parseFloat(sinComas);
        return Number.isNaN(num) ? str : num.toLocaleString('es-AR', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        });
    }
    
    // Si solo tiene puntos, eliminar puntos (son separadores de miles)
    if (str.includes('.')) {
        const sinPuntos = str.replace(/\./g, '');
        const num = parseFloat(sinPuntos);
        return Number.isNaN(num) ? str : num.toLocaleString('es-AR', { 
            minimumFractionDigits: 0, 
            maximumFractionDigits: 0 
        });
    }
    
    // Si no tiene puntos ni comas, parsear directamente
    const num = parseFloat(str);
    return Number.isNaN(num) ? str : num.toLocaleString('es-AR', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
    });
};

export default function NomencladorBioquimica() {
    const [data, setData] = useState(null);
    const [filtro, setFiltro] = useState('');
    const [soloUrgencia, setSoloUrgencia] = useState(false);
    const [valorUB, setValorUB] = useState(0);
    const [convenios, setConvenios] = useState({});
    const [convenioSel, setConvenioSel] = useState('');
    const [error, setError] = useState(null);

    /* === Cargar JSON local (Nomenclador) === */
    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await fetch('/archivos/NomecladorBioquimica.json');
                if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
                const json = await res.json();
                setData(json);
            } catch (err) {
                console.error('❌ Error cargando JSON:', err);
                setError('No se pudo cargar el nomenclador de Bioquímica.');
            }
        };
        loadData();
    }, []);

    /* === Leer convenios desde Firebase === */
    useEffect(() => {
        const conveniosRef = ref(db, 'convenios');
        const unsub = onValue(conveniosRef, (snap) => {
            const val = snap.exists() ? snap.val() : {};

            const normalizado = Object.keys(val).reduce((acc, key) => {
                const cleanKey = key.trim();
                acc[cleanKey] = val[key];
                return acc;
            }, {});

            setConvenios(normalizado);

            const stored = localStorage.getItem('convenioActivo');
            const elegir = stored && normalizado[stored] ? stored : Object.keys(normalizado)[0] || '';
            setConvenioSel(elegir);
        });
        return () => unsub();
    }, []);

    /* === Detectar valor UB del convenio activo === */
    useEffect(() => {
        if (!convenioSel || !convenios[convenioSel]) {
            setValorUB(0);
            return;
        }

        const vg = convenios[convenioSel]?.valores_generales || {};
        const keysPosibles = [
            'Laboratorios_NBU_T',
            'Laboratorios_NBU',
            'Laboratorios NBU T',
            'Laboratorios NBU',
            'UB',
            'Unidad_Bioquimica',
            'Unidad Bioquimica',
        ];

        let nbu = 0;
        for (const k of keysPosibles) {
            if (vg[k] != null && vg[k] !== '') {
                // Usar la misma lógica de parsing que en money()
                const str = String(vg[k]).trim();
                let valorNumerico = 0;
                
                if (str.includes('.') && str.includes(',')) {
                    // Formato: "1.234,56"
                    const sinPuntosMiles = str.replace(/\.(?=\d{3})/g, '');
                    const conPuntoDecimal = sinPuntosMiles.replace(',', '.');
                    valorNumerico = parseFloat(conPuntoDecimal) || 0;
                } else if (str.includes(',')) {
                    // Formato: "1234,56" o "1,234"
                    const partes = str.split(',');
                    if (partes.length === 2 && partes[1].length <= 2) {
                        // Es decimal
                        valorNumerico = parseFloat(str.replace(',', '.')) || 0;
                    } else {
                        // Eliminar comas y tratar como entero
                        valorNumerico = parseFloat(str.replace(/,/g, '')) || 0;
                    }
                } else if (str.includes('.')) {
                    // Eliminar puntos de miles
                    valorNumerico = parseFloat(str.replace(/\./g, '')) || 0;
                } else {
                    valorNumerico = parseFloat(str) || 0;
                }
                
                nbu = valorNumerico;
                break;
            }
        }

        setValorUB(nbu > 0 ? nbu : 0);
    }, [convenioSel, convenios]);

    const valorPorDefecto = data?.metadata?.unidad_bioquimica_valor_referencia || 1224.11;

    /* === Fuse preconstruido (performance) === */
    const fuse = useMemo(() => {
        const practicas = data?.practicas || [];
        if (!practicas.length) return null;

        return new Fuse(practicas, {
            keys: ['codigo', 'practica_bioquimica'],
            threshold: 0.3,
            ignoreLocation: true,
            minMatchCharLength: 2,
        });
    }, [data]);

    /* === Filtrado y búsqueda === */
    const practicasFiltradas = useMemo(() => {
        const practicas = data?.practicas || [];
        const q = filtro.trim();

        const filtroUrg = (p) => !soloUrgencia || p.urgencia === true || p.urgencia === 'U';

        if (!q) return practicas.filter(filtroUrg);

        const qNorm = normalize(q);

        const exact = practicas.filter((p) => {
            const hay = normalize(`${p.codigo} ${p.practica_bioquimica}`).includes(qNorm);
            return hay && filtroUrg(p);
        });

        const fuzzy = fuse
            ? fuse
                .search(q)
                .map((r) => r.item)
                .filter((p) => filtroUrg(p))
            : [];

        const seen = new Set();
        return [...exact, ...fuzzy].filter((p) => {
            const k = `${p.codigo}|${p.practica_bioquimica}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
        });
    }, [filtro, soloUrgencia, data, fuse]);

    if (error)
        return (
            <div className={styles.wrapper}>
                <p className={styles.error}>{error}</p>
            </div>
        );

    if (!data)
        return (
            <div className={styles.wrapper}>
                <p className={styles.info}>Cargando nomenclador bioquímico...</p>
            </div>
        );

    return (
        <div className={styles.wrapper}>
            {/* Header */}
            <div className={styles.header}>
                <h2 className={styles.title}>🧪 Nomenclador Bioquímico</h2>

                <div className={styles.filters}>
                    <div className={styles.filterBlock}>
                        <label className={styles.label}>Convenio</label>
                        <select
                            className={styles.select}
                            value={convenioSel}
                            onChange={(e) => setConvenioSel(e.target.value)}
                        >
                            {Object.keys(convenios).map((k) => (
                                <option key={k}>{k}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.ubBlock}>
                        <span className={styles.badgeGreen}>
                            UB: ${money(valorUB ? valorUB : valorPorDefecto)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className={styles.controls}>
                <input
                    type="text"
                    className={styles.input}
                    placeholder="Buscar código o práctica…"
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="search"
                />

                <label className={styles.checkbox}>
                    <input
                        type="checkbox"
                        checked={soloUrgencia}
                        onChange={(e) => setSoloUrgencia(e.target.checked)}
                    />
                    Solo urgencias
                </label>
            </div>

            {/* Mobile cards */}
            <div className={styles.mobileList} aria-label="Listado mobile">
                {practicasFiltradas.length === 0 ? (
                    <div className={styles.noResults}>No se encontraron resultados.</div>
                ) : (
                    practicasFiltradas.map((p) => {
                        const valorCalculado =
                            p.unidad_bioquimica && (valorUB || valorPorDefecto)
                                ? p.unidad_bioquimica * (valorUB || valorPorDefecto)
                                : null;

                        return (
                            <article key={`${p.codigo}|${p.practica_bioquimica}`} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <div className={styles.code}>{highlight(String(p.codigo), filtro)}</div>
                                    {p.urgencia ? <span className={styles.badgeRed}>U</span> : <span className={styles.badgeGhost}>—</span>}
                                </div>

                                <div className={styles.practice}>{highlight(p.practica_bioquimica, filtro)}</div>

                                <div className={styles.cardMeta}>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>N/I</span>
                                        <span className={styles.metaValue}>{p.nota_N_I || '—'}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>U.B.</span>
                                        <span className={styles.metaValue}>{money(p.unidad_bioquimica)}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>Valor</span>
                                        <span className={styles.metaValue}>
                                            {valorCalculado ? `$${money(valorCalculado)}` : '—'}
                                        </span>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>

            {/* Desktop table */}
            <div className={styles.tableWrapper} aria-label="Tabla desktop">
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Práctica Bioquímica</th>
                            <th>Urgencia</th>
                            <th>N/I</th>
                            <th>U.B.</th>
                            <th>Valor Estimado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {practicasFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan="6" className={styles.noResults}>
                                    No se encontraron resultados.
                                </td>
                            </tr>
                        ) : (
                            practicasFiltradas.map((p) => {
                                const valorCalculado =
                                    p.unidad_bioquimica && (valorUB || valorPorDefecto)
                                        ? p.unidad_bioquimica * (valorUB || valorPorDefecto)
                                        : null;

                                return (
                                    <tr key={`${p.codigo}|${p.practica_bioquimica}`}>
                                        <td className={styles.bold}>{highlight(String(p.codigo), filtro)}</td>
                                        <td className={styles.practiceCell}>{highlight(p.practica_bioquimica, filtro)}</td>
                                        <td className={styles.center}>
                                            {p.urgencia ? <span className={styles.badgeRed}>U</span> : ''}
                                        </td>
                                        <td>{p.nota_N_I || ''}</td>
                                        <td>{money(p.unidad_bioquimica)}</td>
                                        <td className={styles.numeric}>{valorCalculado ? `$${money(valorCalculado)}` : '-'}</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <p className={styles.footerNote}>
                * Valor calculado según la Unidad Bioquímica del convenio seleccionado:{' '}
                <strong>${money(valorUB || valorPorDefecto)}</strong>
            </p>
        </div>
    );
}
'use client';

import { useEffect, useMemo, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import Fuse from 'fuse.js';
import styles from './page.module.css';

/* ================= Utils ================= */
const normalize = (s) =>
    (s ?? '')
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const highlight = (text, query) => {
    if (!text || !query) return text;
    const safe = escapeRegExp(query);
    const regex = new RegExp(`(${safe})`, 'gi');
    const parts = String(text).split(regex);

    return parts.map((part, i) =>
        part.toLowerCase() === String(query).toLowerCase() ? (
            <mark key={i} className={styles.highlight}>
                {part}
            </mark>
        ) : (
            part
        )
    );
};

const parseNumber = (val) => {
    if (val == null || val === '') return 0;
    if (typeof val === 'number') return Number.isFinite(val) ? val : 0;

    let s = String(val).trim();
    if (!s) return 0;

    s = s.replace(/[^\d.,-]/g, '');

    const hasComma = s.includes(',');
    const hasDot = s.includes('.');

    if (hasComma && hasDot) {
        const lastComma = s.lastIndexOf(',');
        const lastDot = s.lastIndexOf('.');

        if (lastComma > lastDot) {
            s = s.replace(/\./g, '').replace(',', '.');
            const n = parseFloat(s);
            return Number.isFinite(n) ? n : 0;
        }

        s = s.replace(/,/g, '');
        const n = parseFloat(s);
        return Number.isFinite(n) ? n : 0;
    }

    if (hasComma) {
        const parts = s.split(',');
        if (parts.length === 2 && parts[1].length > 0 && parts[1].length <= 2) {
            const n = parseFloat(s.replace(',', '.'));
            return Number.isFinite(n) ? n : 0;
        }
        const n = parseFloat(s.replace(/,/g, ''));
        return Number.isFinite(n) ? n : 0;
    }

    if (hasDot) {
        const lastDot = s.lastIndexOf('.');
        const decimals = s.slice(lastDot + 1);

        if (decimals.length > 0 && decimals.length <= 2) {
            const n = parseFloat(s);
            return Number.isFinite(n) ? n : 0;
        }

        const n = parseFloat(s.replace(/\./g, ''));
        return Number.isFinite(n) ? n : 0;
    }

    const n = parseFloat(s);
    return Number.isFinite(n) ? n : 0;
};

const money = (n) => {
    if (n == null || n === '' || n === '-') return '—';
    const num = typeof n === 'number' ? n : parseNumber(n);
    if (!Number.isFinite(num)) return '—';
    return num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// ✅ solo visual (no cambia value)
const formatConvenioLabel = (s) =>
    String(s ?? '')
        .replace(/_+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

/* ================= Page ================= */
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

        let ub = 0;
        for (const k of keysPosibles) {
            if (vg[k] != null && vg[k] !== '') {
                ub = parseNumber(vg[k]);
                break;
            }
        }

        setValorUB(ub > 0 ? ub : 0);
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

        const fuzzy = fuse ? fuse.search(q).map((r) => r.item).filter((p) => filtroUrg(p)) : [];

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
            <div className={styles.page}>
                <div className={styles.stateBoxError}>{error}</div>
            </div>
        );

    if (!data)
        return (
            <div className={styles.page}>
                <div className={styles.stateBox}>Cargando nomenclador bioquímico...</div>
            </div>
        );

    const ubUsar = valorUB || valorPorDefecto;

    return (
        <div className={styles.page}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.heading}>
                        <h2 className={styles.title}>🧪 Nomenclador Bioquímico</h2>
                        <p className={styles.subtitle}>
                            Buscá por código o práctica. El valor se calcula usando la UB del convenio seleccionado.
                        </p>
                    </div>

                    <div className={styles.ubChip} title="Unidad Bioquímica vigente">
                        <span className={styles.ubChipLabel}>UB</span>
                        <span className={styles.ubChipValue}>${money(ubUsar)}</span>
                    </div>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.controlBlock}>
                        <label className={styles.label}>Convenio</label>
                        <select className={styles.select} value={convenioSel} onChange={(e) => setConvenioSel(e.target.value)}>
                            {Object.keys(convenios)
                                .sort()
                                .map((k) => (
                                    <option key={k} value={k}>
                                        {formatConvenioLabel(k)}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className={styles.controlBlock}>
                        <label className={styles.label}>Buscar</label>
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
                    </div>

                    <label className={styles.checkbox}>
                        <input
                            type="checkbox"
                            checked={soloUrgencia}
                            onChange={(e) => setSoloUrgencia(e.target.checked)}
                        />
                        Solo urgencias
                    </label>
                </div>
            </div>

            {/* Mobile cards */}
            <div className={styles.mobileList} aria-label="Listado mobile">
                {practicasFiltradas.length === 0 ? (
                    <div className={styles.noResults}>No se encontraron resultados.</div>
                ) : (
                    practicasFiltradas.map((p) => {
                        const ub = parseNumber(p.unidad_bioquimica);
                        const valorCalculado = ub ? ub * ubUsar : null;

                        return (
                            <article key={`${p.codigo}|${p.practica_bioquimica}`} className={styles.card}>
                                <div className={styles.cardTop}>
                                    <div className={styles.code}>{highlight(String(p.codigo), filtro)}</div>
                                    {p.urgencia ? <span className={styles.badgeUrg}>U</span> : <span className={styles.badgeGhost}>—</span>}
                                </div>

                                <div className={styles.practice}>{highlight(p.practica_bioquimica, filtro)}</div>

                                <div className={styles.cardMeta}>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>N/I</span>
                                        <span className={styles.metaValue}>{p.nota_N_I || '—'}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>U.B.</span>
                                        <span className={styles.metaValue}>{money(ub)}</span>
                                    </div>
                                    <div className={styles.metaItem}>
                                        <span className={styles.metaLabel}>Valor</span>
                                        <span className={styles.metaValue}>
                                            {valorCalculado != null ? (
                                                <span className={styles.valueChip}>${money(valorCalculado)}</span>
                                            ) : (
                                                '—'
                                            )}
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
                            <th className={styles.center}>Urg.</th>
                            <th>N/I</th>
                            <th className={styles.numeric}>U.B.</th>
                            <th className={styles.numeric}>Valor</th>
                        </tr>
                    </thead>
                    <tbody>
                        {practicasFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan="6" className={styles.noResultsCell}>
                                    No se encontraron resultados.
                                </td>
                            </tr>
                        ) : (
                            practicasFiltradas.map((p) => {
                                const ub = parseNumber(p.unidad_bioquimica);
                                const valorCalculado = ub ? ub * ubUsar : null;

                                return (
                                    <tr key={`${p.codigo}|${p.practica_bioquimica}`}>
                                        <td className={styles.codeCell}>{highlight(String(p.codigo), filtro)}</td>
                                        <td className={styles.practiceCell}>{highlight(p.practica_bioquimica, filtro)}</td>
                                        <td className={styles.center}>{p.urgencia ? <span className={styles.badgeUrg}>U</span> : ''}</td>
                                        <td className={styles.niCell}>{p.nota_N_I || ''}</td>
                                        <td className={styles.numeric}>{money(ub)}</td>
                                        <td className={styles.numeric}>
                                            {valorCalculado != null ? <span className={styles.valueChip}>${money(valorCalculado)}</span> : '—'}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <p className={styles.footerNote}>
                * Valor calculado según la Unidad Bioquímica del convenio seleccionado: <strong>${money(ubUsar)}</strong>
            </p>
        </div>
    );
}

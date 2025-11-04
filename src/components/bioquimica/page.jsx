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

const highlight = (text, query) => {
    if (!query) return text;
    const normText = normalize(text);
    const normQuery = normalize(query);
    const idx = normText.indexOf(normQuery);
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
};

const money = (n) => {
    if (n == null || n === '' || n === '-') return '-';
    const num = parseFloat(n.toString().replace(',', '.'));
    if (isNaN(num)) return n;
    return num.toLocaleString('es-AR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
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

            // 🔹 Limpia claves con espacios o caracteres extraños
            const normalizado = Object.keys(val).reduce((acc, key) => {
                const cleanKey = key.trim();
                acc[cleanKey] = val[key];
                return acc;
            }, {});

            setConvenios(normalizado);

            const stored = localStorage.getItem('convenioActivo');
            const elegir =
                stored && normalizado[stored] ? stored : Object.keys(normalizado)[0] || '';
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

        // 🔹 Acepta claves con guiones bajos o espacios
        const keysPosibles = [
            'Laboratorios_NBU_T',
            'Laboratorios_NBU',
            'Laboratorios NBU T',
            'Laboratorios NBU',
            'UB',
            'Unidad_Bioquimica',
            'Unidad Bioquimica'
        ];

        let nbu = 0;

        for (const k of keysPosibles) {
            if (vg[k]) {
                nbu = parseFloat(vg[k].toString().replace('.', '').replace(',', '.')) || 0;
                break;
            }
        }

        // ✅ Eliminado el escalado por 1000
        // Si el valor es decimal (ej. 1.22) no se multiplica automáticamente

        if (nbu > 0) setValorUB(nbu);
    }, [convenioSel, convenios]);

    /* === Filtrado y búsqueda === */
    const practicasFiltradas = useMemo(() => {
        if (!data?.practicas) return [];
        const practicas = data.practicas;
        const q = filtro.trim();

        if (!q && !soloUrgencia) return practicas;

        const filtroUrg = (p) => !soloUrgencia || p.urgencia === true || p.urgencia === 'U';

        const exact = practicas.filter(
            (p) =>
                normalize(`${p.codigo} ${p.practica_bioquimica}`).includes(normalize(q)) &&
                filtroUrg(p)
        );

        const fuse = new Fuse(practicas, {
            keys: ['codigo', 'practica_bioquimica'],
            threshold: 0.3,
            ignoreLocation: true,
        });

        const fuzzy = fuse
            .search(q)
            .map((r) => r.item)
            .filter((p) => filtroUrg(p) && !exact.includes(p));

        return [...exact, ...fuzzy];
    }, [filtro, soloUrgencia, data]);

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

    const valorPorDefecto = data.metadata?.unidad_bioquimica_valor_referencia || 1224.11;

    /* === Render === */
    return (
        <div className={styles.wrapper}>
            <div className={styles.header}>
                <h2 className={styles.title}>🧪 Nomenclador Bioquímico</h2>

                <div className={styles.filters}>
                    <label>Convenio:</label>
                    <select
                        className={styles.select}
                        value={convenioSel}
                        onChange={(e) => setConvenioSel(e.target.value)}
                    >
                        {Object.keys(convenios).map((k) => (
                            <option key={k}>{k}</option>
                        ))}
                    </select>
                    <span className={styles.badgeGreen}>
                        UB: ${valorUB ? money(valorUB) : money(valorPorDefecto)}
                    </span>
                </div>
            </div>

            <div className={styles.controls}>
                <input
                    type="text"
                    className={styles.input}
                    placeholder="Buscar código o práctica..."
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
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

            <div className={styles.tableWrapper}>
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
                                    p.unidad_bioquimica && valorUB ? p.unidad_bioquimica * valorUB : null;
                                return (
                                    <tr key={p.codigo}>
                                        <td className={styles.bold}>{highlight(p.codigo.toString(), filtro)}</td>
                                        <td>{highlight(p.practica_bioquimica, filtro)}</td>
                                        <td className="text-center">
                                            {p.urgencia ? <span className={styles.badgeRed}>U</span> : ''}
                                        </td>
                                        <td>{p.nota_N_I || ''}</td>
                                        <td>{money(p.unidad_bioquimica)}</td>
                                        <td className={styles.numeric}>
                                            {valorCalculado ? `$${money(valorCalculado)}` : '-'}
                                        </td>
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

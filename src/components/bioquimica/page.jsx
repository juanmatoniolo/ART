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
            <mark style={{ backgroundColor: '#19875466', borderRadius: '4px' }}>{match}</mark>
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

/* === COMPONENTE PRINCIPAL === */
export default function NomencladorBioquimica() {
    const [data, setData] = useState(null);
    const [filtro, setFiltro] = useState('');
    const [soloUrgencia, setSoloUrgencia] = useState(false);
    const [valorUB, setValorUB] = useState(0);
    const [convenios, setConvenios] = useState({});
    const [convenioSel, setConvenioSel] = useState('');
    const [error, setError] = useState(null);

    /* === 1️⃣ Cargar JSON local === */
    useEffect(() => {
        const loadData = async () => {
            try {
                if (typeof window === 'undefined') return;
                const baseUrl = window.location.origin;
                const res = await fetch(`${baseUrl}/archivos/NomecladorBioquimica.json`);
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

    /* === 2️⃣ Escuchar convenios desde Firebase === */
    useEffect(() => {
        const conveniosRef = ref(db, 'convenios');
        const unsub = onValue(conveniosRef, (snap) => {
            const val = snap.exists() ? snap.val() : {};
            setConvenios(val);

            const stored = localStorage.getItem('convenioActivo');
            const elegir = stored && val[stored] ? stored : Object.keys(val)[0] || '';
            setConvenioSel(elegir);
        });

        return () => unsub();
    }, []);

    /* === 3️⃣ Detectar el valor “Laboratorios NBU” o “Laboratorios NBU T” === */
    useEffect(() => {
        if (!convenioSel || !convenios[convenioSel]) {
            setValorUB(0);
            return;
        }

        const vg = convenios[convenioSel]?.valores_generales || {};
        const keysPosibles = ['Laboratorios NBU T', 'Laboratorios NBU', 'Laboratorios NBU_T'];
        let nbu = 0;

        for (const k of keysPosibles) {
            if (vg[k]) {
                nbu = parseFloat(vg[k].toString().replace('.', '').replace(',', '.')) || 0;
                break;
            }
        }

        // 🔹 Si el valor es miles mal interpretado (ej. 1.430 => 1430)
        if (nbu > 0 && nbu < 100) nbu *= 1000;

        if (nbu > 0) {
            setValorUB(nbu);
        }
    }, [convenioSel, convenios]);

    /* === 4️⃣ Búsqueda (exacta + Fuse.js) === */
    const practicasFiltradas = useMemo(() => {
        if (!data?.practicas) return [];
        const practicas = data.practicas;

        const q = filtro.trim();
        if (!q && !soloUrgencia) return practicas;

        // Exactas primero
        const exact = practicas.filter(
            (p) =>
                normalize(`${p.codigo} ${p.practica_bioquimica}`).includes(normalize(q)) &&
                (!soloUrgencia || p.urgencia === true || p.urgencia === 'U')
        );

        // Fuzzy con Fuse
        const fuse = new Fuse(practicas, {
            keys: ['codigo', 'practica_bioquimica'],
            threshold: 0.3,
            ignoreLocation: true,
        });
        const fuzzy = fuse
            .search(q)
            .map((r) => r.item)
            .filter(
                (p) => (!soloUrgencia || p.urgencia === true || p.urgencia === 'U') && !exact.includes(p)
            );

        return [...exact, ...fuzzy];
    }, [filtro, soloUrgencia, data]);

    /* === 5️⃣ Render === */
    if (error)
        return (
            <div className={`${styles.wrapper} text-center text-danger`}>
                <h5>{error}</h5>
                <p className="text-muted">Verificá que el archivo esté en /public/archivos/</p>
            </div>
        );

    if (!data)
        return (
            <div className={`${styles.wrapper} text-center`}>
                <div className="spinner-border text-light" role="status" />
                <p className="mt-3 text-muted">Cargando nomenclador bioquímico...</p>
            </div>
        );

    const valorPorDefecto = data.metadata?.unidad_bioquimica_valor_referencia || 1224.11;

    return (
        <div className={styles.wrapper}>
            <div className="mb-4 d-flex flex-wrap justify-content-between align-items-center gap-3">
                <h1 className="fw-bold text-white">🧪 Nomenclador Bioquímico</h1>

                {/* Selector de convenio */}
                <div className="d-flex align-items-center gap-2">
                    <span className="text-light">Convenio:</span>
                    <select
                        className={`form-select ${styles.darkInput}`}
                        style={{ minWidth: 280 }}
                        value={convenioSel}
                        onChange={(e) => setConvenioSel(e.target.value)}
                    >
                        {Object.keys(convenios).map((k) => (
                            <option key={k}>{k}</option>
                        ))}
                    </select>
                    <span className="badge bg-success ms-2">
                        UB: ${valorUB ? money(valorUB) : money(valorPorDefecto)}
                    </span>
                </div>
            </div>

            {/* Filtros */}
            <div className="card bg-dark border-0 shadow-sm mb-4">
                <div className="card-body row gy-3 gx-4">
                    {/* Valor UB */}
                    <div className="col-md-4">
                        <label className="form-label text-light fw-semibold">
                            Valor de la Unidad Bioquímica (UB)
                        </label>
                        <input
                            type="number"
                            className={`form-control ${styles.darkInput}`}
                            value={valorUB || valorPorDefecto}
                            onChange={(e) =>
                                setValorUB(parseFloat(e.target.value) || valorPorDefecto)
                            }
                        />
                        <small className="text-muted">
                            Ingresá o ajustá el valor actual de la Unidad Bioquímica
                        </small>
                    </div>

                    {/* Buscador */}
                    <div className="col-md-8">
                        <label className="form-label text-light fw-semibold">
                            Buscar práctica bioquímica
                        </label>
                        <div className="input-group">
                            <input
                                type="text"
                                className={`form-control ${styles.darkInput}`}
                                placeholder="Buscar por código o nombre..."
                                value={filtro}
                                onChange={(e) => setFiltro(e.target.value)}
                            />
                            <button
                                className="btn btn-outline-light"
                                onClick={() => {
                                    setFiltro('');
                                    setSoloUrgencia(false);
                                }}
                            >
                                Limpiar
                            </button>
                        </div>
                        <div className="form-check mt-2">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={soloUrgencia}
                                onChange={(e) => setSoloUrgencia(e.target.checked)}
                                id="checkUrgencia"
                            />
                            <label className="form-check-label text-light" htmlFor="checkUrgencia">
                                Solo urgencias
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla */}
            <div className="table-responsive shadow-sm">
                <table className="table table-dark table-striped table-hover align-middle">
                    <thead>
                        <tr>
                            <th style={{ width: '8%' }}>Código</th>
                            <th>Práctica Bioquímica</th>
                            <th style={{ width: '10%' }}>Urgencia</th>
                            <th style={{ width: '8%' }}>N/I</th>
                            <th style={{ width: '10%' }}>U.B.</th>
                            <th style={{ width: '15%' }} className="text-end">
                                Valor Estimado
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {practicasFiltradas.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="text-center text-muted py-4">
                                    No se encontraron resultados.
                                </td>
                            </tr>
                        ) : (
                            practicasFiltradas.map((p) => {
                                const valorCalculado =
                                    p.unidad_bioquimica && valorUB
                                        ? p.unidad_bioquimica * valorUB
                                        : null;

                                return (
                                    <tr key={p.codigo}>
                                        <td className="fw-bold text-white">
                                            {highlight(p.codigo.toString(), filtro)}
                                        </td>
                                        <td>{highlight(p.practica_bioquimica, filtro)}</td>
                                        <td className="text-center">
                                            {p.urgencia ? <span className="badge bg-danger">U</span> : ''}
                                        </td>
                                        <td className="text-center">{p.nota_N_I || ''}</td>
                                        <td className="text-center">{money(p.unidad_bioquimica)}</td>
                                        <td className="text-end fw-bold text-white">
                                            {valorCalculado ? `$${money(valorCalculado)}` : '-'}
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <p className="text-muted small mt-3">
                * Valor calculado según la Unidad Bioquímica del convenio seleccionado:{' '}
                <strong className="text-white">
                    ${money(valorUB || valorPorDefecto)}
                </strong>
            </p>
        </div>
    );
}

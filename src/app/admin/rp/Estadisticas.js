// app/admin/rp/Estadisticas.js
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './page.module.css';
import { fmtDate } from './helpers';

const money = (n) =>
    Number(n || 0).toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });

const fmtPct = (n, total) =>
    total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—';

// ---------- Selector múltiple con búsqueda ----------
function MedicoMultiSelect({ medicos, selected, onChange }) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const boxRef = useRef(null);

    useEffect(() => {
        const onClick = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const filtrados = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return medicos;
        return medicos.filter((m) => m.nombre.toLowerCase().includes(t));
    }, [q, medicos]);

    const toggle = (id) => {
        if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
        else onChange([...selected, id]);
    };

    const allIds = medicos.map((m) => m.id);
    const allSelected = selected.length === 0;

    const label = allSelected
        ? `Todos los médicos (${medicos.length})`
        : selected.length === 1
            ? medicos.find((m) => m.id === selected[0])?.nombre || '1 médico'
            : `${selected.length} médicos seleccionados`;

    return (
        <div className={styles.multiSelect} ref={boxRef}>
            <button
                className={styles.multiSelectBtn}
                onClick={() => setOpen((v) => !v)}
                type="button"
            >
                <span>🩺 {label}</span>
                <span className={styles.multiSelectArrow}>▾</span>
            </button>
            {open && (
                <div className={styles.multiSelectDropdown}>
                    <input
                        className={styles.input}
                        placeholder="Buscar médico…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        autoFocus
                    />
                    <div className={styles.multiSelectActions}>
                        <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={() => onChange(allIds)}
                        >
                            Todos
                        </button>
                        <button
                            type="button"
                            className={styles.btnGhost}
                            onClick={() => onChange([])}
                        >
                            Ninguno
                        </button>
                    </div>
                    <div className={styles.multiSelectList}>
                        {filtrados.length === 0 ? (
                            <p className={styles.emptyMsg}>Sin resultados</p>
                        ) : (
                            filtrados.map((m) => {
                                const checked = selected.includes(m.id);
                                return (
                                    <label key={m.id} className={styles.multiSelectItem}>
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggle(m.id)}
                                        />
                                        <span className={styles.multiSelectName}>{m.nombre}</span>
                                        <span className={styles.multiSelectMeta}>
                                            {m.cantidad} RP · ${money(m.monto)}
                                        </span>
                                    </label>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// =====================================================================
//  ESTADÍSTICAS
// =====================================================================
export default function Estadisticas({ historial }) {
    const [selectedMedicos, setSelectedMedicos] = useState([]);

    // Agrupar por médico
    const medicosList = useMemo(() => {
        const map = new Map();
        historial.forEach((r) => {
            const id = r.medico?.id || r.medico?.apellido || 'sin_medico';
            const nombre = r.medico?.apellido
                ? `${r.medico.apellido}, ${r.medico.nombre}`
                : 'Sin médico';
            if (!map.has(id)) {
                map.set(id, { id, nombre, cantidad: 0, monto: 0, rps: [] });
            }
            const m = map.get(id);
            m.cantidad += 1;
            m.monto += r.total || 0;
            m.rps.push(r);
        });
        return [...map.values()].sort((a, b) => b.monto - a.monto);
    }, [historial]);

    const totalGeneral = medicosList.reduce((a, m) => a + m.monto, 0);
    const totalRps = historial.length;

    // Filtrar RPs visibles
    const rpsVisibles = useMemo(() => {
        if (selectedMedicos.length === 0) return historial;
        return historial.filter((r) => {
            const id = r.medico?.id || r.medico?.apellido || 'sin_medico';
            return selectedMedicos.includes(id);
        });
    }, [selectedMedicos, historial]);

    // Ranking filtrado (solo los médicos visibles)
    const rankingVisible = useMemo(() => {
        if (selectedMedicos.length === 0) return medicosList;
        return medicosList.filter((m) => selectedMedicos.includes(m.id));
    }, [medicosList, selectedMedicos]);

    const montoVisible = rpsVisibles.reduce((a, r) => a + (r.total || 0), 0);
    const promedioVisible = rpsVisibles.length > 0 ? montoVisible / rpsVisibles.length : 0;

    // Códigos agregados
    const codigosList = useMemo(() => {
        const map = new Map();
        rpsVisibles.forEach((r) => {
            (r.practicas || []).forEach((p) => {
                const k = p.codigo || '—';
                const prev = map.get(k) || {
                    codigo: k, descripcion: p.descripcion, cantidad: 0,
                    origen: p.origen || '',
                };
                prev.cantidad += 1;
                map.set(k, prev);
            });
            (r.estudiosLab || []).forEach((l) => {
                const k = l.codigo || '—';
                const prev = map.get(k) || {
                    codigo: k, descripcion: l.descripcion, cantidad: 0,
                    origen: 'bioquimica',
                };
                prev.cantidad += 1;
                map.set(k, prev);
            });
        });
        return [...map.values()].sort((a, b) => b.cantidad - a.cantidad);
    }, [rpsVisibles]);

    const totalCodigos = codigosList.reduce((a, c) => a + c.cantidad, 0);

    if (historial.length === 0) {
        return (
            <section className={styles.stats}>
                <div className={styles.empty}>
                    Todavía no hay RPs guardadas para mostrar estadísticas.
                </div>
            </section>
        );
    }

    return (
        <section className={styles.stats}>
            {/* Filtro */}
            <div className={styles.statsFilter}>
                <MedicoMultiSelect
                    medicos={medicosList}
                    selected={selectedMedicos}
                    onChange={setSelectedMedicos}
                />
                {selectedMedicos.length > 0 && (
                    <button
                        className={styles.btnGhost}
                        onClick={() => setSelectedMedicos([])}
                    >
                        Limpiar filtro
                    </button>
                )}
            </div>

            {/* KPIs */}
            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Monto total</div>
                    <div className={styles.kpiValue}>$ {money(montoVisible)}</div>
                    <div className={styles.kpiSub}>
                        {selectedMedicos.length > 0
                            ? `${fmtPct(montoVisible, totalGeneral)} del total general`
                            : 'Suma de todas las RPs'}
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>RPs generadas</div>
                    <div className={styles.kpiValue}>{rpsVisibles.length}</div>
                    <div className={styles.kpiSub}>
                        {selectedMedicos.length > 0
                            ? `${fmtPct(rpsVisibles.length, totalRps)} del total`
                            : `${totalRps} en total`}
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Promedio por RP</div>
                    <div className={styles.kpiValue}>$ {money(promedioVisible)}</div>
                    <div className={styles.kpiSub}>Sobre {rpsVisibles.length} RP(s)</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Médicos visibles</div>
                    <div className={styles.kpiValue}>{rankingVisible.length}</div>
                    <div className={styles.kpiSub}>
                        {selectedMedicos.length === 0 ? 'Con al menos 1 RP' : 'Filtrados'}
                    </div>
                </div>
            </div>

            {/* Ranking de médicos */}
            {rankingVisible.length > 0 && (
                <div className={styles.tableBlock}>
                    <h3 className={styles.tableTitle}>🩺 Ranking de médicos por monto</h3>
                    <div className={styles.tableScroll}>
                        <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                            <colgroup>
                                <col style={{ width: '48px' }} />
                                <col />
                                <col style={{ width: '90px' }} />
                                <col style={{ width: '140px' }} />
                                <col style={{ width: '110px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Médico</th>
                                    <th className={styles.numCol}>RPs</th>
                                    <th className={styles.numCol}>Monto</th>
                                    <th className={styles.numCol}>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rankingVisible.map((m, i) => (
                                    <tr key={m.id}>
                                        <td className={styles.rankCell}>{i + 1}</td>
                                        <td className={styles.ellipsisCell}>{m.nombre}</td>
                                        <td className={styles.numCol}>{m.cantidad}</td>
                                        <td className={styles.numCol}>$ {money(m.monto)}</td>
                                        <td className={styles.numCol}>
                                            <span className={styles.pctBadge}>
                                                {fmtPct(m.monto, totalGeneral)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2}><b>Total</b></td>
                                    <td className={styles.numCol}><b>{totalRps}</b></td>
                                    <td className={styles.numCol}><b>$ {money(totalGeneral)}</b></td>
                                    <td className={styles.numCol}><b>100%</b></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Listado de RPs */}
            {rpsVisibles.length > 0 && (
                <div className={styles.tableBlock}>
                    <h3 className={styles.tableTitle}>
                        📋 RPs visibles ({rpsVisibles.length})
                        {selectedMedicos.length > 0
                            ? ' — filtradas por médico'
                            : ' — todas'}
                    </h3>
                    <div className={styles.tableScroll}>
                        <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                            <colgroup>
                                <col style={{ width: '100px' }} />
                                <col />
                                <col style={{ width: '90px' }} />
                                <col style={{ width: '150px' }} />
                                <col style={{ width: '80px' }} />
                                <col style={{ width: '110px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Paciente</th>
                                    <th>Médico</th>
                                    <th className={styles.numCol}>Prácticas</th>
                                    <th className={styles.numCol}>🧪 Lab</th>
                                    <th className={styles.numCol}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rpsVisibles
                                    .slice()
                                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                                    .map((r) => {
                                        const med = r.medico?.apellido
                                            ? `${r.medico.apellido}, ${r.medico.nombre}`
                                            : 'Sin médico';
                                        return (
                                            <tr key={r.id}>
                                                <td>{fmtDate(r.fecha)}</td>
                                                <td className={styles.ellipsisCell}>
                                                    {r.paciente?.nombreCompleto || '—'}
                                                </td>
                                                <td className={styles.ellipsisCell}>{med}</td>
                                                <td className={styles.numCol}>
                                                    {r.practicas?.length || 0}
                                                </td>
                                                <td className={styles.numCol}>
                                                    {(r.estudiosLab || []).length}
                                                </td>
                                                <td className={styles.numCol}>
                                                    $ {money(r.total || 0)}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5}><b>Total</b></td>
                                    <td className={styles.numCol}>
                                        <b>$ {money(montoVisible)}</b>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Códigos */}
            {codigosList.length > 0 && (
                <div className={styles.tableBlock}>
                    <h3 className={styles.tableTitle}>🔝 Códigos más solicitados</h3>
                    <div className={styles.tableScroll}>
                        <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                            <colgroup>
                                <col style={{ width: '48px' }} />
                                <col style={{ width: '140px' }} />
                                <col />
                                <col style={{ width: '90px' }} />
                                <col style={{ width: '90px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Código</th>
                                    <th>Descripción</th>
                                    <th className={styles.numCol}>Veces</th>
                                    <th className={styles.numCol}>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {codigosList.map((c, i) => (
                                    <tr key={c.codigo}>
                                        <td className={styles.rankCell}>{i + 1}</td>
                                        <td className={styles.codeCell}>{c.codigo}</td>
                                        <td className={styles.ellipsisCell}>{c.descripcion}</td>
                                        <td className={styles.numCol}>{c.cantidad}</td>
                                        <td className={styles.numCol}>
                                            <span className={styles.pctBadge}>
                                                {fmtPct(c.cantidad, totalCodigos)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}
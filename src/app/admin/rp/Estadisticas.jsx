// app/admin/rp/Estadisticas.jsx
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

const getMontos = (r) => {
    const practicas = Array.isArray(r.practicas) ? r.practicas : [];
    const hon =
        typeof r.totalHonorarios === 'number'
            ? r.totalHonorarios
            : practicas.reduce(
                  (a, p) => a + (Number(p.costo?.honorarioMedico) || 0),
                  0
              );
    const gto =
        typeof r.totalGastos === 'number'
            ? r.totalGastos
            : practicas.reduce(
                  (a, p) => a + (Number(p.costo?.gastoSanatorial) || 0),
                  0
              );
    return { hon, gto, total: hon + gto };
};

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
                                        <span className={styles.multiSelectName}>
                                            {m.nombre}
                                        </span>
                                        <span className={styles.multiSelectMeta}>
                                            {m.cantidad} RP · ${money(m.total)}
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

    // ---- Ranking por médico (con hon / gto / total separados) ----
    const medicosList = useMemo(() => {
        const map = new Map();
        historial.forEach((r) => {
            const id = r.medico?.id || r.medico?.apellido || 'sin_medico';
            const nombre = r.medico?.apellido
                ? `${r.medico.apellido}, ${r.medico.nombre}`
                : 'Sin médico';
            if (!map.has(id)) {
                map.set(id, { id, nombre, cantidad: 0, hon: 0, gto: 0, total: 0 });
            }
            const m = map.get(id);
            const { hon, gto, total } = getMontos(r);
            m.cantidad += 1;
            m.hon += hon;
            m.gto += gto;
            m.total += total;
        });
        return [...map.values()].sort((a, b) => b.total - a.total);
    }, [historial]);

    // ---- Totales generales ----
    const totales = useMemo(() => {
        let hon = 0, gto = 0, total = 0;
        historial.forEach((r) => {
            const m = getMontos(r);
            hon += m.hon;
            gto += m.gto;
            total += m.total;
        });
        return { hon, gto, total, rps: historial.length };
    }, [historial]);

    // ---- RPs visibles según filtro ----
    const rpsVisibles = useMemo(() => {
        if (selectedMedicos.length === 0) return historial;
        return historial.filter((r) => {
            const id = r.medico?.id || r.medico?.apellido || 'sin_medico';
            return selectedMedicos.includes(id);
        });
    }, [selectedMedicos, historial]);

    const rankingVisible = useMemo(() => {
        if (selectedMedicos.length === 0) return medicosList;
        return medicosList.filter((m) => selectedMedicos.includes(m.id));
    }, [medicosList, selectedMedicos]);

    // ---- KPIs sobre lo visible ----
    const visible = useMemo(() => {
        let hon = 0, gto = 0, total = 0;
        rpsVisibles.forEach((r) => {
            const m = getMontos(r);
            hon += m.hon;
            gto += m.gto;
            total += m.total;
        });
        const n = rpsVisibles.length;
        return {
            hon, gto, total,
            promedio: n > 0 ? total / n : 0,
            promedioHon: n > 0 ? hon / n : 0,
            promedioGto: n > 0 ? gto / n : 0,
        };
    }, [rpsVisibles]);

    // ---- Destacados ----
    const topPorTotal = useMemo(
        () => (rankingVisible.length ? [...rankingVisible].sort((a, b) => b.total - a.total)[0] : null),
        [rankingVisible]
    );
    const topPorHon = useMemo(
        () => (rankingVisible.length ? [...rankingVisible].sort((a, b) => b.hon - a.hon)[0] : null),
        [rankingVisible]
    );
    const topPorGto = useMemo(
        () => (rankingVisible.length ? [...rankingVisible].sort((a, b) => b.gto - a.gto)[0] : null),
        [rankingVisible]
    );
    const topPorCantidad = useMemo(
        () => (rankingVisible.length ? [...rankingVisible].sort((a, b) => b.cantidad - a.cantidad)[0] : null),
        [rankingVisible]
    );

    // ---- Códigos agregados ----
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
    const topCodigo = codigosList[0] || null;

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

            {/* KPIs económicos */}
            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>💰 Honorarios médicos</div>
                    <div className={styles.kpiValue}>$ {money(visible.hon)}</div>
                    <div className={styles.kpiSub}>
                        {fmtPct(visible.hon, visible.total)} del total
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>🏥 Gastos clínicos / sanatoriales</div>
                    <div className={styles.kpiValue}>$ {money(visible.gto)}</div>
                    <div className={styles.kpiSub}>
                        {fmtPct(visible.gto, visible.total)} del total
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>🧾 Total facturado</div>
                    <div className={styles.kpiValue}>$ {money(visible.total)}</div>
                    <div className={styles.kpiSub}>
                        {selectedMedicos.length > 0
                            ? `${fmtPct(visible.total, totales.total)} del total general`
                            : 'Suma de todas las RPs'}
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>📄 RPs generadas</div>
                    <div className={styles.kpiValue}>{rpsVisibles.length}</div>
                    <div className={styles.kpiSub}>
                        {selectedMedicos.length > 0
                            ? `${fmtPct(rpsVisibles.length, totales.rps)} del total`
                            : `${totales.rps} en total`}
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>📊 Prom. Hon / RP</div>
                    <div className={styles.kpiValue}>$ {money(visible.promedioHon)}</div>
                    <div className={styles.kpiSub}>Sobre {rpsVisibles.length} RP(s)</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>📊 Prom. Gasto / RP</div>
                    <div className={styles.kpiValue}>$ {money(visible.promedioGto)}</div>
                    <div className={styles.kpiSub}>Sobre {rpsVisibles.length} RP(s)</div>
                </div>
            </div>

            {/* Destacados */}
            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>🩺 Médico más recurrente</div>
                    <div className={styles.kpiValue} style={{ fontSize: '1rem' }}>
                        {topPorCantidad?.nombre || '—'}
                    </div>
                    <div className={styles.kpiSub}>
                        {topPorCantidad?.cantidad || 0} RP(s)
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>💰 Top honorarios</div>
                    <div className={styles.kpiValue} style={{ fontSize: '1rem' }}>
                        {topPorHon?.nombre || '—'}
                    </div>
                    <div className={styles.kpiSub}>
                        $ {money(topPorHon?.hon || 0)} en honorarios
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>🏥 Top gastos clínicos</div>
                    <div className={styles.kpiValue} style={{ fontSize: '1rem' }}>
                        {topPorGto?.nombre || '—'}
                    </div>
                    <div className={styles.kpiSub}>
                        $ {money(topPorGto?.gto || 0)} en gastos
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>🔝 Código más pedido</div>
                    <div className={styles.kpiValue} style={{ fontSize: '1rem' }}>
                        {topCodigo?.codigo || '—'}
                    </div>
                    <div className={styles.kpiSub}>
                        {topCodigo?.descripcion || '—'}
                        {topCodigo ? ` · ${topCodigo.cantidad} vez(ces)` : ''}
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>🏆 Top facturación total</div>
                    <div className={styles.kpiValue} style={{ fontSize: '1rem' }}>
                        {topPorTotal?.nombre || '—'}
                    </div>
                    <div className={styles.kpiSub}>
                        $ {money(topPorTotal?.total || 0)} ·{' '}
                        {topPorTotal?.cantidad || 0} RP(s)
                    </div>
                </div>
            </div>

            {/* Ranking de médicos */}
            {rankingVisible.length > 0 && (
                <div className={styles.tableBlock}>
                    <h3 className={styles.tableTitle}>
                        🩺 Ranking de médicos (Hon / Gasto / Total)
                    </h3>
                    <div className={styles.tableScroll}>
                        <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                            <colgroup>
                                <col style={{ width: '40px' }} />
                                <col style={{ width: '220px' }} />
                                <col />
                                <col style={{ width: '55px' }} />
                                <col style={{ width: '105px' }} />
                                <col style={{ width: '105px' }} />
                                <col style={{ width: '115px' }} />
                                <col style={{ width: '80px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Médico</th>
                                    <th></th>
                                    <th className={styles.numCol}>RPs</th>
                                    <th className={styles.numCol}>Honorarios</th>
                                    <th className={styles.numCol}>Gastos</th>
                                    <th className={styles.numCol}>Total</th>
                                    <th className={styles.numCol}>% del total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rankingVisible.map((m, i) => (
                                    <tr key={m.id}>
                                        <td className={styles.rankCell}>{i + 1}</td>
                                        <td className={styles.ellipsisCell}>{m.nombre}</td>
                                        <td></td>
                                        <td className={styles.numCol}>{m.cantidad}</td>
                                        <td className={styles.numCol}>$ {money(m.hon)}</td>
                                        <td className={styles.numCol}>$ {money(m.gto)}</td>
                                        <td className={styles.numCol}>
                                            <b>$ {money(m.total)}</b>
                                        </td>
                                        <td className={styles.numCol}>
                                            <span className={styles.pctBadge}>
                                                {fmtPct(m.total, totales.total)}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={2}><b>Total</b></td>
                                    <td></td>
                                    <td className={styles.numCol}><b>{totales.rps}</b></td>
                                    <td className={styles.numCol}><b>$ {money(totales.hon)}</b></td>
                                    <td className={styles.numCol}><b>$ {money(totales.gto)}</b></td>
                                    <td className={styles.numCol}><b>$ {money(totales.total)}</b></td>
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
                                <col style={{ width: '90px' }} />
                                <col style={{ width: '200px' }} />
                                <col />
                                <col style={{ width: '70px' }} />
                                <col style={{ width: '60px' }} />
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '100px' }} />
                                <col style={{ width: '110px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Paciente</th>
                                    <th>Médico</th>
                                    <th className={styles.numCol}>Prácticas</th>
                                    <th className={styles.numCol}>🧪 Lab</th>
                                    <th className={styles.numCol}>Honorarios</th>
                                    <th className={styles.numCol}>Gastos</th>
                                    <th className={styles.numCol}>Total</th>
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
                                        const { hon, gto, total } = getMontos(r);
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
                                                    $ {money(hon)}
                                                </td>
                                                <td className={styles.numCol}>
                                                    $ {money(gto)}
                                                </td>
                                                <td className={styles.numCol}>
                                                    <b>$ {money(total)}</b>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={5}><b>Total visible</b></td>
                                    <td className={styles.numCol}>
                                        <b>$ {money(visible.hon)}</b>
                                    </td>
                                    <td className={styles.numCol}>
                                        <b>$ {money(visible.gto)}</b>
                                    </td>
                                    <td className={styles.numCol}>
                                        <b>$ {money(visible.total)}</b>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {/* Códigos más solicitados */}
            {codigosList.length > 0 && (
                <div className={styles.tableBlock}>
                    <h3 className={styles.tableTitle}>🔝 Códigos más solicitados</h3>
                    <div className={styles.tableScroll}>
                        <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                            <colgroup>
                                <col style={{ width: '40px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '280px' }} />
                                <col />
                                <col style={{ width: '80px' }} />
                                <col style={{ width: '80px' }} />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>Código</th>
                                    <th>Descripción</th>
                                    <th></th>
                                    <th className={styles.numCol}>Veces</th>
                                    <th className={styles.numCol}>%</th>
                                </tr>
                            </thead>
                            <tbody>
                                {codigosList.map((c, i) => (
                                    <tr key={c.codigo}>
                                        <td className={styles.rankCell}>{i + 1}</td>
                                        <td className={styles.codeCell}>{c.codigo}</td>
                                        <td className={styles.ellipsisCell}>
                                            {c.descripcion}
                                        </td>
                                        <td></td>
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
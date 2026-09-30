// app/admin/rp/Estadisticas.jsx
'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
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

const toISO = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatMonthLabel = (key) => {
    const [y, m] = key.split('-');
    if (!y || !m) return key;
    const date = new Date(Number(y), Number(m) - 1, 1);
    const s = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
};

// =================== SELECTOR MÚLTIPLE DE MÉDICOS ===================
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
                        <button type="button" className={styles.btnGhost} onClick={() => onChange(allIds)}>
                            Todos
                        </button>
                        <button type="button" className={styles.btnGhost} onClick={() => onChange([])}>
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

// =================== FILTRO DE FECHAS ===================
function FechaFilter({ desde, hasta, onChange }) {
    const hoy = new Date();
    const aplicar = (rango) => {
        let d = '';
        let h = '';
        switch (rango) {
            case 'mes-actual':
                d = toISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
                h = toISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
                break;
            case 'mes-pasado':
                d = toISO(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1));
                h = toISO(new Date(hoy.getFullYear(), hoy.getMonth(), 0));
                break;
            case '30d': {
                const dd = new Date(hoy);
                dd.setDate(dd.getDate() - 29);
                d = toISO(dd);
                h = toISO(hoy);
                break;
            }
            case 'año':
                d = `${hoy.getFullYear()}-01-01`;
                h = `${hoy.getFullYear()}-12-31`;
                break;
            case 'todo':
            default:
                d = '';
                h = '';
        }
        onChange({ desde: d, hasta: h });
    };

    return (
        <div className={styles.dateFilterBlock}>
            <div className={styles.dateQuickRow}>
                <button className={styles.btnGhost} onClick={() => aplicar('todo')}>Todo</button>
                <button className={styles.btnGhost} onClick={() => aplicar('mes-actual')}>Este mes</button>
                <button className={styles.btnGhost} onClick={() => aplicar('mes-pasado')}>Mes pasado</button>
                <button className={styles.btnGhost} onClick={() => aplicar('30d')}>Últimos 30 días</button>
                <button className={styles.btnGhost} onClick={() => aplicar('año')}>Este año</button>
            </div>
            <div className={styles.dateInputsRow}>
                <label className={styles.dateInputLabel}>
                    Desde
                    <input
                        type="date"
                        className={styles.input}
                        value={desde}
                        onChange={(e) => onChange({ desde: e.target.value, hasta })}
                    />
                </label>
                <label className={styles.dateInputLabel}>
                    Hasta
                    <input
                        type="date"
                        className={styles.input}
                        value={hasta}
                        onChange={(e) => onChange({ desde, hasta: e.target.value })}
                    />
                </label>
                {(desde || hasta) && (
                    <button
                        className={styles.btnGhost}
                        onClick={() => onChange({ desde: '', hasta: '' })}
                        title="Limpiar rango"
                    >
                        ✕ Limpiar fechas
                    </button>
                )}
            </div>
        </div>
    );
}

// =================== DETALLE DE UN MES ===================
function MonthDetail({ rps }) {
    const ranking = useMemo(() => {
        const map = new Map();
        rps.forEach((r) => {
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
    }, [rps]);

    const codigos = useMemo(() => {
        const map = new Map();
        rps.forEach((r) => {
            (r.practicas || []).forEach((p) => {
                const k = p.codigo || '—';
                const prev = map.get(k) || {
                    codigo: k, descripcion: p.descripcion, cantidad: 0,
                };
                prev.cantidad += 1;
                map.set(k, prev);
            });
            (r.estudiosLab || []).forEach((l) => {
                const k = l.codigo || '—';
                const prev = map.get(k) || {
                    codigo: k, descripcion: l.descripcion, cantidad: 0,
                };
                prev.cantidad += 1;
                map.set(k, prev);
            });
        });
        return [...map.values()].sort((a, b) => b.cantidad - a.cantidad);
    }, [rps]);

    const totalMes = ranking.reduce((a, m) => a + m.total, 0);
    const totalCodigos = codigos.reduce((a, c) => a + c.cantidad, 0);

    return (
        <div className={styles.monthDetailGrid}>
            <div className={styles.detailSection}>
                <h4 className={styles.detailTitle}>🩺 Médicos del mes</h4>
                <div className={styles.tableScroll}>
                    <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                        <colgroup>
                            <col style={{ width: '32px' }} />
                            <col />
                            <col style={{ width: '55px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '70px' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Médico</th>
                                <th className={styles.numCol}>RPs</th>
                                <th className={styles.numCol}>Honorarios</th>
                                <th className={styles.numCol}>Gastos</th>
                                <th className={styles.numCol}>Total</th>
                                <th className={styles.numCol}>%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {ranking.map((m, i) => (
                                <tr key={m.id}>
                                    <td className={styles.rankCell}>{i + 1}</td>
                                    <td className={styles.ellipsisCell}>{m.nombre}</td>
                                    <td className={styles.numCol}>{m.cantidad}</td>
                                    <td className={styles.numCol}>$ {money(m.hon)}</td>
                                    <td className={styles.numCol}>$ {money(m.gto)}</td>
                                    <td className={styles.numCol}><b>$ {money(m.total)}</b></td>
                                    <td className={styles.numCol}>
                                        <span className={styles.pctBadge}>
                                            {fmtPct(m.total, totalMes)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {codigos.length > 0 && (
                <div className={styles.detailSection}>
                    <h4 className={styles.detailTitle}>🔝 Códigos del mes</h4>
                    <div className={styles.tableScroll}>
                        <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                            <colgroup>
                                <col style={{ width: '32px' }} />
                                <col style={{ width: '110px' }} />
                                <col />
                                <col style={{ width: '70px' }} />
                                <col style={{ width: '70px' }} />
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
                                {codigos.map((c, i) => (
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

            <div className={styles.detailSection}>
                <h4 className={styles.detailTitle}>
                    📋 RPs del mes ({rps.length})
                </h4>
                <div className={styles.tableScroll}>
                    <table className={`${styles.dataTable} ${styles.dataTableFixed}`}>
                        <colgroup>
                            <col style={{ width: '85px' }} />
                            <col />
                            <col style={{ width: '150px' }} />
                            <col style={{ width: '60px' }} />
                            <col style={{ width: '55px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '100px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '45px' }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Paciente</th>
                                <th>Médico</th>
                                <th className={styles.numCol}>Práct.</th>
                                <th className={styles.numCol}>🧪</th>
                                <th className={styles.numCol}>Honorarios</th>
                                <th className={styles.numCol}>Gastos</th>
                                <th className={styles.numCol}>Total</th>
                                <th className={styles.numCol}>🖨️</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rps
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
                                            <td className={styles.numCol}>$ {money(hon)}</td>
                                            <td className={styles.numCol}>$ {money(gto)}</td>
                                            <td className={styles.numCol}>
                                                <b>$ {money(total)}</b>
                                            </td>
                                            <td className={styles.numCol}>
                                                {r.impreso ? '✅' : '⬜'}
                                            </td>
                                        </tr>
                                    );
                                })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// =================== ESTADÍSTICAS ===================
export default function Estadisticas({ historial }) {
    const [selectedMedicos, setSelectedMedicos] = useState([]);
    const [fechaDesde, setFechaDesde] = useState('');
    const [fechaHasta, setFechaHasta] = useState('');
    const [expanded, setExpanded] = useState(null);

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

    const filtradas = useMemo(() => {
        let base = historial;
        if (selectedMedicos.length > 0) {
            base = base.filter((r) => {
                const id = r.medico?.id || r.medico?.apellido || 'sin_medico';
                return selectedMedicos.includes(id);
            });
        }
        if (fechaDesde) base = base.filter((r) => (r.fecha || '') >= fechaDesde);
        if (fechaHasta) base = base.filter((r) => (r.fecha || '') <= fechaHasta);
        return base;
    }, [historial, selectedMedicos, fechaDesde, fechaHasta]);

    const monthsData = useMemo(() => {
        const map = new Map();
        filtradas.forEach((r) => {
            const key = (r.fecha || '').slice(0, 7);
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, { key, rps: [], hon: 0, gto: 0, total: 0 });
            }
            const m = map.get(key);
            const { hon, gto, total } = getMontos(r);
            m.rps.push(r);
            m.hon += hon;
            m.gto += gto;
            m.total += total;
        });
        return [...map.values()].sort((a, b) => b.key.localeCompare(a.key));
    }, [filtradas]);

    const totalGeneral = useMemo(() => {
        let hon = 0, gto = 0, total = 0;
        filtradas.forEach((r) => {
            const m = getMontos(r);
            hon += m.hon;
            gto += m.gto;
            total += m.total;
        });
        return { hon, gto, total, rps: filtradas.length };
    }, [filtradas]);

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
            <div className={styles.statsFilter}>
                <MedicoMultiSelect
                    medicos={medicosList}
                    selected={selectedMedicos}
                    onChange={setSelectedMedicos}
                />
                {selectedMedicos.length > 0 && (
                    <button className={styles.btnGhost} onClick={() => setSelectedMedicos([])}>
                        Limpiar médicos
                    </button>
                )}
            </div>

            <FechaFilter
                desde={fechaDesde}
                hasta={fechaHasta}
                onChange={({ desde, hasta }) => {
                    setFechaDesde(desde);
                    setFechaHasta(hasta);
                }}
            />

            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>📄 RPs</div>
                    <div className={styles.kpiValue}>{totalGeneral.rps}</div>
                    <div className={styles.kpiSub}>En {monthsData.length} mes(es)</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>💰 Honorarios</div>
                    <div className={styles.kpiValue}>$ {money(totalGeneral.hon)}</div>
                    <div className={styles.kpiSub}>
                        {fmtPct(totalGeneral.hon, totalGeneral.total)} del total
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>🏥 Gastos clínicos</div>
                    <div className={styles.kpiValue}>$ {money(totalGeneral.gto)}</div>
                    <div className={styles.kpiSub}>
                        {fmtPct(totalGeneral.gto, totalGeneral.total)} del total
                    </div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>🧾 Total facturado</div>
                    <div className={styles.kpiValue}>$ {money(totalGeneral.total)}</div>
                    <div className={styles.kpiSub}>
                        {totalGeneral.rps > 0
                            ? `Prom. $ ${money(totalGeneral.total / totalGeneral.rps)} / RP`
                            : 'Sin datos'}
                    </div>
                </div>
            </div>

            {monthsData.length === 0 ? (
                <div className={styles.empty}>
                    No hay RPs que coincidan con los filtros.
                </div>
            ) : (
                <div className={styles.tableBlock}>
                    <h3 className={styles.tableTitle}>
                        📅 Totales por mes — clickeá una fila para ver el detalle
                    </h3>
                    <div className={styles.tableScroll}>
                        <table className={`${styles.dataTable} ${styles.dataTableFixed} ${styles.monthsTable}`}>
                            <colgroup>
                                <col style={{ width: '180px' }} />
                                <col style={{ width: '70px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '120px' }} />
                                <col style={{ width: '130px' }} />
                                <col style={{ width: '80px' }} />
                                <col />
                            </colgroup>
                            <thead>
                                <tr>
                                    <th>Mes</th>
                                    <th className={styles.numCol}>RPs</th>
                                    <th className={styles.numCol}>Honorarios</th>
                                    <th className={styles.numCol}>Gastos</th>
                                    <th className={styles.numCol}>Total</th>
                                    <th className={styles.numCol}>%</th>
                                    <th className={styles.expandCol}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {monthsData.map((m) => {
                                    const isOpen = expanded === m.key;
                                    return (
                                        <Fragment key={m.key}>
                                            <tr
                                                className={`${styles.monthRow} ${isOpen ? styles.monthRowOpen : ''}`}
                                                onClick={() => setExpanded(isOpen ? null : m.key)}
                                            >
                                                <td><b>{formatMonthLabel(m.key)}</b></td>
                                                <td className={styles.numCol}>{m.rps.length}</td>
                                                <td className={styles.numCol}>$ {money(m.hon)}</td>
                                                <td className={styles.numCol}>$ {money(m.gto)}</td>
                                                <td className={styles.numCol}>
                                                    <b>$ {money(m.total)}</b>
                                                </td>
                                                <td className={styles.numCol}>
                                                    <span className={styles.pctBadge}>
                                                        {fmtPct(m.total, totalGeneral.total)}
                                                    </span>
                                                </td>
                                                <td className={styles.expandCol}>
                                                    <span className={styles.expandBtn}>
                                                        {isOpen ? '▲ Ocultar' : '▼ Ver detalle'}
                                                    </span>
                                                </td>
                                            </tr>
                                            {isOpen && (
                                                <tr className={styles.monthDetailRow}>
                                                    <td colSpan={7}>
                                                        <MonthDetail rps={m.rps} />
                                                    </td>
                                                </tr>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td><b>Total</b></td>
                                    <td className={styles.numCol}><b>{totalGeneral.rps}</b></td>
                                    <td className={styles.numCol}><b>$ {money(totalGeneral.hon)}</b></td>
                                    <td className={styles.numCol}><b>$ {money(totalGeneral.gto)}</b></td>
                                    <td className={styles.numCol}><b>$ {money(totalGeneral.total)}</b></td>
                                    <td className={styles.numCol}><b>100%</b></td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </section>
    );
}
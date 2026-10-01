// app/admin/rp/Estadisticas.jsx
'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import styles from './Estadisticas.module.css';
import { fmtDate } from './helpers';
import { buildStatsPrintHtml } from './statsPrint';

// =====================================================================
//  HELPERS
// =====================================================================
const money = (n) =>
    Number(n || 0).toLocaleString('es-AR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    });
const peso = (n) => `$ ${money(n)}`;
const fmtPct = (n, total) => (total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—');
const toISO = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
const formatMonthLabel = (key) => {
    if (!/^\d{4}-\d{2}$/.test(key)) return 'Sin fecha';
    const [y, m] = key.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    const s = date.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
};
const toNum = (v) => {
    if (v === '' || v == null) return null;
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : null;
};
const medKey = (r) => r.medico?.id || r.medico?.apellido || 'sin_medico';
const medName = (r) =>
    r.medico?.apellido
        ? `${r.medico.apellido}, ${r.medico.nombre || ''}`.trim()
        : 'Sin médico';
const pacKey = (r) => r.paciente?.dni || r.paciente?.nombreCompleto || 'sin_paciente';
const pacName = (r) => r.paciente?.nombreCompleto || 'Sin paciente';
const convName = (r) => r.convenioNombre || r.convenio || 'Sin convenio';
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const FILTROS_INICIALES = {
    desde: '', hasta: '',
    medicos: [], pacientes: [], codigos: [],
    tipo: 'todos', impreso: 'todos', convenio: 'todos',
    honMin: '', honMax: '',
    gtoMin: '', gtoMax: '',
    totMin: '', totMax: '',
    soloFiltradas: true,
    topN: 20,
};

const LS_KEYS = {
    presets: 'rp_stats_presets_v1',
    theme: 'rp_stats_theme_v1',
    collapsed: 'rp_stats_filters_collapsed_v1',
};

const computeView = (r, codeSet, soloFiltradas) => {
    const practicasAll = Array.isArray(r.practicas) ? r.practicas : [];
    const labsAll = Array.isArray(r.estudiosLab) ? r.estudiosLab : [];
    const restrict = soloFiltradas && codeSet.size > 0;
    const practicas = restrict ? practicasAll.filter((p) => codeSet.has(String(p.codigo))) : practicasAll;
    const labs = restrict ? labsAll.filter((l) => codeSet.has(String(l.codigo))) : labsAll;
    const sum = (k) => practicas.reduce((a, p) => a + (Number(p.costo?.[k]) || 0), 0);
    const hon = !restrict && typeof r.totalHonorarios === 'number' ? r.totalHonorarios : sum('honorarioMedico');
    const gto = !restrict && typeof r.totalGastos === 'number' ? r.totalGastos : sum('gastoSanatorial');
    return { r, practicas, labs, hon, gto, total: hon + gto };
};

const groupBy = (rows, keyFn, nameFn) => {
    const map = new Map();
    rows.forEach((v) => {
        const key = keyFn(v);
        if (!map.has(key)) {
            map.set(key, { key, nombre: nameFn(v), cantidad: 0, hon: 0, gto: 0, total: 0, rps: [] });
        }
        const g = map.get(key);
        g.cantidad += 1;
        g.hon += v.hon;
        g.gto += v.gto;
        g.total += v.total;
        g.rps.push(v);
    });
    return [...map.values()];
};

// =====================================================================
//  MULTI SELECT
// =====================================================================
function MultiSelect({ icon, labelAll, items, selected, onChange, placeholder }) {
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
        return t ? items.filter((i) => i.label.toLowerCase().includes(t)) : items;
    }, [q, items]);
    const visibles = filtrados.slice(0, 150);

    const toggle = (id) =>
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

    const label =
        selected.length === 0
            ? `${labelAll} (${items.length})`
            : selected.length === 1
            ? items.find((i) => i.id === selected[0])?.label || '1 seleccionado'
            : `${selected.length} seleccionados`;

    return (
        <div className={styles.multiSelect} ref={boxRef}>
            <button type="button" className={styles.multiSelectBtn} onClick={() => setOpen((v) => !v)}>
                <span className={styles.multiSelectName}>{icon} {label}</span>
                <span className={`${styles.multiSelectArrow} ${open ? styles.multiSelectArrowOpen : ''}`}>▾</span>
            </button>
            {open && (
                <div className={styles.multiSelectDropdown}>
                    <input
                        className={styles.input}
                        placeholder={placeholder}
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        autoFocus
                    />
                    <div className={styles.multiSelectActions}>
                        <button type="button" className={styles.btnGhost} onClick={() => onChange(Array.from(new Set([...selected, ...visibles.map((i) => i.id)])))}>Marcar visibles</button>
                        <button type="button" className={styles.btnGhost} onClick={() => onChange([])}>Limpiar</button>
                    </div>
                    <div className={styles.multiSelectList}>
                        {visibles.length === 0 ? (
                            <p className={styles.emptyMsg}>Sin resultados</p>
                        ) : (
                            visibles.map((i) => (
                                <label key={i.id} className={styles.multiSelectItem}>
                                    <input type="checkbox" checked={selected.includes(i.id)} onChange={() => toggle(i.id)} />
                                    <span className={styles.multiSelectName} title={i.label}>{i.label}</span>
                                    <span className={styles.multiSelectMeta}>{i.meta}</span>
                                </label>
                            ))
                        )}
                        {filtrados.length > visibles.length && (
                            <p className={styles.emptyMsg}>+{filtrados.length - visibles.length} más — escribí para acotar</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// =====================================================================
//  FILTRO DE FECHAS
// =====================================================================
function FechaFilter({ desde, hasta, onChange }) {
    const hoy = new Date();
    const activo = (rango) => {
        const iso = (dt) => toISO(dt);
        switch (rango) {
            case 'hoy': return desde === iso(hoy) && hasta === iso(hoy);
            case 'ayer': { const a = new Date(hoy); a.setDate(a.getDate() - 1); return desde === iso(a) && hasta === iso(a); }
            case '7d': { const dd = new Date(hoy); dd.setDate(dd.getDate() - 6); return desde === iso(dd) && hasta === iso(hoy); }
            case '30d': { const dd = new Date(hoy); dd.setDate(dd.getDate() - 29); return desde === iso(dd) && hasta === iso(hoy); }
            case '90d': { const dd = new Date(hoy); dd.setDate(dd.getDate() - 89); return desde === iso(dd) && hasta === iso(hoy); }
            case 'mes-actual': return desde === iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)) && hasta === iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0));
            case 'mes-pasado': return desde === iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)) && hasta === iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0));
            default: return false;
        }
    };
    const aplicar = (rango) => {
        let d = '', h = '';
        const iso = (dt) => toISO(dt);
        switch (rango) {
            case 'hoy': d = h = iso(hoy); break;
            case 'ayer': { const a = new Date(hoy); a.setDate(a.getDate() - 1); d = h = iso(a); break; }
            case '7d': { const dd = new Date(hoy); dd.setDate(dd.getDate() - 6); d = iso(dd); h = iso(hoy); break; }
            case '30d': { const dd = new Date(hoy); dd.setDate(dd.getDate() - 29); d = iso(dd); h = iso(hoy); break; }
            case '90d': { const dd = new Date(hoy); dd.setDate(dd.getDate() - 89); d = iso(dd); h = iso(hoy); break; }
            case 'mes-actual': d = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); h = iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)); break;
            case 'mes-pasado': d = iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)); h = iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)); break;
            case 'trimestre': { const q = Math.floor(hoy.getMonth() / 3); d = iso(new Date(hoy.getFullYear(), q * 3, 1)); h = iso(new Date(hoy.getFullYear(), q * 3 + 3, 0)); break; }
            case 'año': d = `${hoy.getFullYear()}-01-01`; h = `${hoy.getFullYear()}-12-31`; break;
            default: break;
        }
        onChange({ desde: d, hasta: h });
    };

    const presets = [
        ['todo', 'Todo'], ['hoy', 'Hoy'], ['ayer', 'Ayer'],
        ['7d', '7 días'], ['30d', '30 días'], ['90d', '90 días'],
        ['mes-actual', 'Este mes'], ['mes-pasado', 'Mes pasado'],
        ['trimestre', 'Trimestre'], ['año', 'Este año'],
    ];

    return (
        <div className={styles.filterGroup}>
            <div className={styles.filterGroupTitle}>📅 Fecha</div>
            <div className={styles.dateQuickRow}>
                {presets.map(([id, label]) => (
                    <button
                        key={id}
                        className={`${styles.btnGhost} ${activo(id) ? styles.btnGhostActive : ''}`}
                        onClick={() => aplicar(id)}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <div className={styles.dateInputsRow}>
                <label className={styles.dateInputLabel}>
                    Desde
                    <input type="date" className={styles.input} value={desde} onChange={(e) => onChange({ desde: e.target.value, hasta })} />
                </label>
                <label className={styles.dateInputLabel}>
                    Hasta
                    <input type="date" className={styles.input} value={hasta} onChange={(e) => onChange({ desde, hasta: e.target.value })} />
                </label>
            </div>
        </div>
    );
}

function RangeInputs({ title, minVal, maxVal, onMin, onMax }) {
    return (
        <div className={styles.filterGroup}>
            <div className={styles.filterGroupTitle}>{title}</div>
            <div className={styles.rangeRow}>
                <input className={styles.input} inputMode="decimal" placeholder="Mín $" value={minVal} onChange={(e) => onMin(e.target.value)} />
                <span className={styles.rangeSep}>–</span>
                <input className={styles.input} inputMode="decimal" placeholder="Máx $" value={maxVal} onChange={(e) => onMax(e.target.value)} />
            </div>
        </div>
    );
}

// =====================================================================
//  TABLA GENÉRICA
// =====================================================================
function DataTable({ columns, rows, rowKey, footer, defaultSort, renderDetail, pageSize = 100, empty = 'Sin datos.', search }) {
    const [sort, setSort] = useState(defaultSort || null);
    const [open, setOpen] = useState(null);
    const [visible, setVisible] = useState(pageSize);

    useEffect(() => { setVisible(pageSize); }, [rows, pageSize]);

    const filtered = useMemo(() => {
        if (!search || !search.trim()) return rows;
        const t = search.trim().toLowerCase();
        return rows.filter((r) =>
            columns.some((c) => {
                const raw = c.sortValue ? c.sortValue(r) : r[c.key];
                return String(raw ?? '').toLowerCase().includes(t);
            })
        );
    }, [rows, search, columns]);

    const sorted = useMemo(() => {
        if (!sort) return filtered;
        const col = columns.find((c) => c.key === sort.key);
        if (!col) return filtered;
        const get = col.sortValue || ((r) => r[col.key]);
        const dir = sort.dir === 'asc' ? 1 : -1;
        return [...filtered].sort((a, b) => {
            const x = get(a);
            const y = get(b);
            if (typeof x === 'string' || typeof y === 'string') return String(x ?? '').localeCompare(String(y ?? ''), 'es') * dir;
            return ((x || 0) - (y || 0)) * dir;
        });
    }, [filtered, sort, columns]);

    const onSort = (key) =>
        setSort((prev) => (prev?.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

    if (!rows.length) return <p className={styles.emptyMsg}>{empty}</p>;

    const shown = sorted.slice(0, visible);

    return (
        <div className={styles.tableScrollX}>
            <table className={`${styles.dataTable} ${styles.dataTableAuto}`}>
                <thead>
                    <tr>
                        {columns.map((c) => (
                            <th key={c.key} className={`${c.num ? styles.numCol : ''} ${styles.thSortable}`} onClick={() => onSort(c.key)}>
                                {c.label}
                                {sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
                            </th>
                        ))}
                        {renderDetail && <th />}
                    </tr>
                </thead>
                <tbody>
                    {shown.map((row, i) => {
                        const id = rowKey(row);
                        const isOpen = open === id;
                        return (
                            <Fragment key={id}>
                                <tr
                                    className={`${renderDetail ? styles.monthRow : ''} ${isOpen ? styles.monthRowOpen : ''}`}
                                    onClick={renderDetail ? () => setOpen(isOpen ? null : id) : undefined}
                                >
                                    {columns.map((c) => (
                                        <td key={c.key} className={`${c.num ? styles.numCol : ''} ${c.wrap ? styles.cellWrap : ''}`}>
                                            {c.render ? c.render(row, i) : row[c.key]}
                                        </td>
                                    ))}
                                    {renderDetail && (
                                        <td className={styles.expandCol}>
                                            <span className={styles.expandBtn}>{isOpen ? '▲ Ocultar' : '▼ Detalle'}</span>
                                        </td>
                                    )}
                                </tr>
                                {renderDetail && isOpen && (
                                    <tr className={styles.monthDetailRow}>
                                        <td colSpan={columns.length + 1}>{renderDetail(row)}</td>
                                    </tr>
                                )}
                            </Fragment>
                        );
                    })}
                </tbody>
                {footer && (
                    <tfoot>
                        <tr>
                            {footer.map((c, i) => (
                                <td key={i} className={columns[i]?.num ? styles.numCol : ''}>{c}</td>
                            ))}
                            {renderDetail && <td />}
                        </tr>
                    </tfoot>
                )}
            </table>
            {sorted.length > visible && (
                <div className={styles.moreRow}>
                    <button className={styles.btnGhost} onClick={() => setVisible((v) => v + pageSize)}>
                        Ver más ({sorted.length - visible} restantes)
                    </button>
                    <button className={styles.btnGhost} onClick={() => setVisible(sorted.length)}>Ver todo</button>
                </div>
            )}
        </div>
    );
}

// =====================================================================
//  MINI BAR CHART
// =====================================================================
function MiniBarChart({ items, valueKey = 'total', labelKey = 'nombre', max = 5, color = '#44794d', formatValue }) {
    const top = useMemo(() => [...items].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0)).slice(0, max), [items, valueKey, max]);
    const maxVal = top.length ? Math.max(...top.map((i) => i[valueKey] || 0)) : 0;
    if (!top.length || maxVal === 0) return <p className={styles.emptyMsg}>Sin datos.</p>;
    const fmt = formatValue || ((v) => peso(v));
    return (
        <div className={styles.miniChart}>
            {top.map((it, i) => {
                const pct = ((it[valueKey] || 0) / maxVal) * 100;
                return (
                    <div key={it.key || i} className={styles.miniChartRow} style={{ animationDelay: `${i * 40}ms` }}>
                        <div className={styles.miniChartLabel} title={it[labelKey]}>{it[labelKey]}</div>
                        <div className={styles.miniChartTrack}>
                            <div className={styles.miniChartBar} style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className={styles.miniChartValue}>{fmt(it[valueKey] || 0)}</div>
                    </div>
                );
            })}
        </div>
    );
}

// =====================================================================
//  DONUT CHART
// =====================================================================
function DonutChart({ segments, size = 160, thickness = 24 }) {
    const total = segments.reduce((a, s) => a + s.value, 0);
    if (total === 0) return <p className={styles.emptyMsg}>Sin datos.</p>;

    const radius = (size - thickness) / 2;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;

    return (
        <div className={styles.donutWrap}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={styles.donutSvg}>
                <g transform={`translate(${size / 2}, ${size / 2}) rotate(-90)`}>
                    <circle r={radius} cx={0} cy={0} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth={thickness} />
                    {segments.map((s, i) => {
                        const len = (s.value / total) * circumference;
                        const el = (
                            <circle
                                key={i}
                                r={radius} cx={0} cy={0} fill="none"
                                stroke={s.color} strokeWidth={thickness}
                                strokeDasharray={`${len} ${circumference - len}`}
                                strokeDashoffset={-offset}
                                strokeLinecap="butt"
                                style={{ transition: 'stroke-dasharray 0.6s ease, stroke-dashoffset 0.6s ease' }}
                            />
                        );
                        offset += len;
                        return el;
                    })}
                </g>
                <text x={size / 2} y={size / 2 - 4} textAnchor="middle" className={styles.donutTotal}>{peso(total)}</text>
                <text x={size / 2} y={size / 2 + 14} textAnchor="middle" className={styles.donutTotalLabel}>Total</text>
            </svg>
            <div className={styles.donutLegend}>
                {segments.map((s, i) => (
                    <div key={i} className={styles.donutLegendRow}>
                        <span className={styles.donutLegendDot} style={{ background: s.color }} />
                        <span className={styles.donutLegendLabel}>{s.label}</span>
                        <span className={styles.donutLegendValue}>{peso(s.value)}</span>
                        <span className={styles.donutLegendPct}>{((s.value / total) * 100).toFixed(1)}%</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// =====================================================================
//  KPI CARD con tendencia
// =====================================================================
function KpiCard({ icon, label, value, sub, trend }) {
    const trendClass =
        trend == null ? '' :
        trend > 0 ? styles.kpiTrendUp :
        trend < 0 ? styles.kpiTrendDown :
        styles.kpiTrendFlat;
    const trendIcon = trend == null ? '' : trend > 0 ? '▲' : trend < 0 ? '▼' : '=';
    return (
        <div className={styles.kpiCard}>
            <div className={styles.kpiLabel}>{icon} {label}</div>
            <div className={styles.kpiValue}>{value}</div>
            <div className={styles.kpiBottom}>
                {sub && <div className={styles.kpiSub}>{sub}</div>}
                {trend != null && (
                    <span className={`${styles.kpiTrend} ${trendClass}`} title="Comparación con período anterior">
                        {trendIcon} {Math.abs(trend).toFixed(1)}%
                    </span>
                )}
            </div>
        </div>
    );
}

// =====================================================================
//  INSIGHTS
// =====================================================================
function Insights({ rows, totales, medicos, codigos, meses }) {
    const items = useMemo(() => {
        if (!rows.length) return [];
        const out = [];
        const top3 = [...medicos].sort((a, b) => b.total - a.total).slice(0, 3);
        const sumTop3 = top3.reduce((a, m) => a + m.total, 0);
        const pctTop3 = totales.total > 0 ? (sumTop3 / totales.total) * 100 : 0;
        if (pctTop3 > 0) out.push({ icon: '🎯', text: `Los 3 médicos top concentran el ${pctTop3.toFixed(1)}% de la facturación.` });
        const mejorMes = [...meses].sort((a, b) => b.total - a.total)[0];
        if (mejorMes) out.push({ icon: '📈', text: `El mes más fuerte fue ${mejorMes.nombre} con ${peso(mejorMes.total)} (${mejorMes.cantidad} RP).` });
        const topCod = [...codigos].sort((a, b) => b.cantidad - a.cantidad)[0];
        if (topCod) out.push({ icon: '🔝', text: `El código ${topCod.codigo} (${topCod.nombre}) se pidió ${topCod.cantidad} vez(ces).` });
        const prom = totales.rps ? totales.total / totales.rps : 0;
        if (prom > 0) out.push({ icon: '💵', text: `El ticket promedio por RP es ${peso(prom)}.` });
        if (totales.total > 0) {
            const pctHon = (totales.hon / totales.total) * 100;
            out.push({
                icon: pctHon > 50 ? '💰' : '🏥',
                text: pctHon > 50
                    ? `Los honorarios representan el ${pctHon.toFixed(1)}% del total facturado.`
                    : `Los gastos clínicos representan el ${(100 - pctHon).toFixed(1)}% del total facturado.`,
            });
        }
        return out;
    }, [rows, totales, medicos, codigos, meses]);

    if (!items.length) return null;

    return (
        <div className={styles.insightsBox}>
            <div className={styles.insightsTitle}>💡 Insights automáticos</div>
            <ul className={styles.insightsList}>
                {items.map((it, i) => (
                    <li key={i}>
                        <span className={styles.insightIcon}>{it.icon}</span>
                        <span>{it.text}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// =====================================================================
//  PRESETS DE FILTROS
// =====================================================================
function PresetFilters({ currentFilter, onApply }) {
    const [open, setOpen] = useState(false);
    const [presets, setPresets] = useState([]);
    const [name, setName] = useState('');
    const boxRef = useRef(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_KEYS.presets);
            if (raw) setPresets(JSON.parse(raw));
        } catch {}
    }, []);

    useEffect(() => {
        const onClick = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const persist = (list) => {
        setPresets(list);
        try { localStorage.setItem(LS_KEYS.presets, JSON.stringify(list)); } catch {}
    };

    const guardar = () => {
        const n = name.trim();
        if (!n) return;
        const nuevo = { id: Date.now().toString(), nombre: n, filtro: currentFilter };
        persist([...presets, nuevo]);
        setName('');
    };

    const eliminar = (id) => persist(presets.filter((p) => p.id !== id));

    return (
        <div className={styles.presetWrap} ref={boxRef}>
            <button className={styles.btnGhost} onClick={() => setOpen((v) => !v)} title="Presets de filtros">
                ⭐ Presets ({presets.length})
            </button>
            {open && (
                <div className={styles.presetDropdown}>
                    <div className={styles.presetHeader}>Guardar combinación actual</div>
                    <div className={styles.presetSaveRow}>
                        <input
                            className={styles.input}
                            placeholder="Nombre del preset…"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') guardar(); }}
                        />
                        <button className={styles.btnPrimary} onClick={guardar} disabled={!name.trim()}>💾</button>
                    </div>
                    {presets.length > 0 && (
                        <>
                            <div className={styles.presetHeader} style={{ marginTop: 8 }}>Guardados</div>
                            <div className={styles.presetList}>
                                {presets.map((p) => (
                                    <div key={p.id} className={styles.presetItem}>
                                        <button className={styles.presetItemMain} onClick={() => { onApply(p.filtro); setOpen(false); }}>
                                            {p.nombre}
                                        </button>
                                        <button className={styles.presetItemDelete} onClick={() => eliminar(p.id)} title="Eliminar">×</button>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// =====================================================================
//  SECCIONES IMPRIMIBLES
// =====================================================================
const PRINT_SECTIONS = [
    { id: 'resumen', label: 'Resumen ejecutivo + KPIs' },
    { id: 'meses', label: 'Totales por mes' },
    { id: 'medicos', label: 'Por médico' },
    { id: 'pacientes', label: 'Por paciente' },
    { id: 'convenios', label: 'Por convenio' },
    { id: 'practicas', label: 'Por práctica / código' },
    { id: 'detalle', label: 'Listado detallado de RPs' },
];

// =====================================================================
//  PRINCIPAL
// =====================================================================
export default function Estadisticas({ historial }) {
    const [f, setF] = useState(FILTROS_INICIALES);
    const patch = (p) => setF((prev) => ({ ...prev, ...p }));
    const [vista, setVista] = useState('meses');

    const [printOpen, setPrintOpen] = useState(false);
    const [printPreview, setPrintPreview] = useState(null);
    const [printObs, setPrintObs] = useState('');
    const [printOpts, setPrintOpts] = useState({
        resumen: true, meses: true, medicos: true,
        pacientes: false, convenios: false,
        practicas: true, detalle: false,
    });

    const [theme, setTheme] = useState('light');
    const [collapsed, setCollapsed] = useState(false);
    const [compare, setCompare] = useState(false);
    const [tableSearch, setTableSearch] = useState('');
    const [copied, setCopied] = useState(false);

    // Cargar preferencias
    useEffect(() => {
        try {
            const t = localStorage.getItem(LS_KEYS.theme);
            if (t) setTheme(t);
            const c = localStorage.getItem(LS_KEYS.collapsed);
            if (c === '1') setCollapsed(true);
        } catch {}
    }, []);

    useEffect(() => {
        try { localStorage.setItem(LS_KEYS.theme, theme); } catch {}
    }, [theme]);

    useEffect(() => {
        try { localStorage.setItem(LS_KEYS.collapsed, collapsed ? '1' : '0'); } catch {}
    }, [collapsed]);

    const codeSet = useMemo(() => new Set(f.codigos), [f.codigos]);

    // ---------- Opciones selectores ----------
    const opciones = useMemo(() => {
        const meds = new Map();
        const pacs = new Map();
        const cods = new Map();
        const convs = new Set();
        const bump = (map, id, label) => {
            if (!map.has(id)) map.set(id, { id, label, n: 0 });
            map.get(id).n += 1;
        };
        historial.forEach((r) => {
            bump(meds, medKey(r), medName(r));
            bump(pacs, pacKey(r), `${pacName(r)}${r.paciente?.dni ? ` · ${r.paciente.dni}` : ''}`);
            convs.add(convName(r));
            (r.practicas || []).forEach((p) => bump(cods, String(p.codigo), `${p.codigo} — ${p.descripcion || ''}`));
            (r.estudiosLab || []).forEach((l) => bump(cods, String(l.codigo), `${l.codigo} — ${l.descripcion || ''}`));
        });
        const toItems = (map) => [...map.values()].sort((a, b) => b.n - a.n).map((x) => ({ id: x.id, label: x.label, meta: `${x.n} RP` }));
        return {
            medicos: toItems(meds),
            pacientes: toItems(pacs),
            codigos: toItems(cods),
            convenios: [...convs].sort((a, b) => a.localeCompare(b, 'es')),
        };
    }, [historial]);

    // ---------- Filtrado principal ----------
    const applyFilter = useCallback((filter) => {
        const medSet = new Set(filter.medicos);
        const pacSet = new Set(filter.pacientes);
        const codes = new Set(filter.codigos);
        const hMin = toNum(filter.honMin), hMax = toNum(filter.honMax);
        const gMin = toNum(filter.gtoMin), gMax = toNum(filter.gtoMax);
        const tMin = toNum(filter.totMin), tMax = toNum(filter.totMax);

        return historial
            .map((r) => computeView(r, codes, filter.soloFiltradas))
            .filter((v) => {
                const r = v.r;
                if (filter.desde && (r.fecha || '') < filter.desde) return false;
                if (filter.hasta && (r.fecha || '') > filter.hasta) return false;
                if (medSet.size && !medSet.has(medKey(r))) return false;
                if (pacSet.size && !pacSet.has(pacKey(r))) return false;
                if (codes.size) {
                    const tiene =
                        (r.practicas || []).some((p) => codes.has(String(p.codigo))) ||
                        (r.estudiosLab || []).some((l) => codes.has(String(l.codigo)));
                    if (!tiene) return false;
                }
                if (filter.tipo === 'rp' && r.esLab) return false;
                if (filter.tipo === 'lab' && !r.esLab) return false;
                if (filter.impreso === 'si' && !r.impreso) return false;
                if (filter.impreso === 'no' && r.impreso) return false;
                if (filter.convenio !== 'todos' && convName(r) !== filter.convenio) return false;
                if (hMin != null && v.hon < hMin) return false;
                if (hMax != null && v.hon > hMax) return false;
                if (gMin != null && v.gto < gMin) return false;
                if (gMax != null && v.gto > gMax) return false;
                if (tMin != null && v.total < tMin) return false;
                if (tMax != null && v.total > tMax) return false;
                return true;
            });
    }, [historial]);

    const rows = useMemo(() => applyFilter(f), [applyFilter, f]);

    // ---------- Filtrado período anterior (comparación) ----------
    const prevRows = useMemo(() => {
        if (!compare || !f.desde || !f.hasta) return [];
        const d1 = new Date(f.desde + 'T00:00:00');
        const d2 = new Date(f.hasta + 'T00:00:00');
        const dias = Math.round((d2 - d1) / 86400000) + 1;
        const p2 = new Date(d1);
        p2.setDate(p2.getDate() - 1);
        const p1 = new Date(p2);
        p1.setDate(p1.getDate() - (dias - 1));
        const prevFilter = { ...f, desde: toISO(p1), hasta: toISO(p2) };
        return applyFilter(prevFilter);
    }, [compare, f, applyFilter]);

    const totalesPrev = useMemo(() => {
        let hon = 0, gto = 0;
        prevRows.forEach((v) => { hon += v.hon; gto += v.gto; });
        return { hon, gto, total: hon + gto, rps: prevRows.length };
    }, [prevRows]);

    const trend = (curr, prev) => {
        if (!compare || prev == null || prev === 0) return null;
        return ((curr - prev) / prev) * 100;
    };

    // ---------- Agregados ----------
    const totales = useMemo(() => {
        let hon = 0, gto = 0;
        rows.forEach((v) => { hon += v.hon; gto += v.gto; });
        return {
            hon, gto, total: hon + gto, rps: rows.length,
            pacientes: new Set(rows.map((v) => pacKey(v.r))).size,
            medicos: new Set(rows.map((v) => medKey(v.r))).size,
        };
    }, [rows]);

    const meses = useMemo(() => groupBy(rows, (v) => (v.r.fecha || '').slice(0, 7) || 'sin-fecha', (v) => formatMonthLabel((v.r.fecha || '').slice(0, 7))), [rows]);
    const medicos = useMemo(() => groupBy(rows, (v) => medKey(v.r), (v) => medName(v.r)), [rows]);
    const pacientes = useMemo(
        () => groupBy(rows, (v) => pacKey(v.r), (v) => pacName(v.r)).map((g) => ({ ...g, dni: g.rps[0]?.r.paciente?.dni || '' })),
        [rows]
    );
    const convenios = useMemo(() => groupBy(rows, (v) => convName(v.r), (v) => convName(v.r)), [rows]);

    const codigos = useMemo(() => {
        const map = new Map();
        const add = (p, origen) => {
            const k = String(p.codigo || '—');
            if (!map.has(k)) map.set(k, { key: k, codigo: k, nombre: p.descripcion || '', origen, cantidad: 0, hon: 0, gto: 0, total: 0 });
            const g = map.get(k);
            const h = Number(p.costo?.honorarioMedico) || 0;
            const gt = Number(p.costo?.gastoSanatorial) || 0;
            g.cantidad += 1; g.hon += h; g.gto += gt; g.total += h + gt;
        };
        rows.forEach((v) => {
            v.practicas.forEach((p) => add(p, p.origen || 'nacional'));
            v.labs.forEach((l) => add(l, 'laboratorio'));
        });
        return [...map.values()];
    }, [rows]);

    const totalVecesCodigos = codigos.reduce((a, c) => a + c.cantidad, 0);
    const topMedico = useMemo(() => [...medicos].sort((a, b) => b.total - a.total)[0] || null, [medicos]);
    const topCodigo = useMemo(() => [...codigos].sort((a, b) => b.cantidad - a.cantidad)[0] || null, [codigos]);

    // ---------- Chips de filtros ----------
    const activeFilters = useMemo(() => {
        const list = (ids, items) => {
            const names = ids.map((id) => items.find((i) => i.id === id)?.label || id);
            return names.length > 3 ? `${names.length} seleccionados` : names.join(' | ');
        };
        const rango = (min, max) => {
            const a = toNum(min), b = toNum(max);
            if (a != null && b != null) return `${peso(a)} – ${peso(b)}`;
            if (a != null) return `≥ ${peso(a)}`;
            if (b != null) return `≤ ${peso(b)}`;
            return null;
        };
        const a = [];
        if (f.desde || f.hasta)
            a.push({ id: 'fecha', label: 'Fecha', value: `${f.desde ? fmtDate(f.desde) : '…'} → ${f.hasta ? fmtDate(f.hasta) : '…'}`, clear: { desde: '', hasta: '' } });
        if (f.medicos.length) a.push({ id: 'med', label: 'Médicos', value: list(f.medicos, opciones.medicos), clear: { medicos: [] } });
        if (f.pacientes.length) a.push({ id: 'pac', label: 'Pacientes', value: list(f.pacientes, opciones.pacientes), clear: { pacientes: [] } });
        if (f.codigos.length)
            a.push({ id: 'cod', label: 'Prácticas', value: list(f.codigos, opciones.codigos) + (f.soloFiltradas ? ' (solo esas)' : ' (RP completa)'), clear: { codigos: [] } });
        if (f.tipo !== 'todos') a.push({ id: 'tipo', label: 'Tipo', value: f.tipo === 'lab' ? 'Solo laboratorio' : 'Solo prácticas', clear: { tipo: 'todos' } });
        if (f.impreso !== 'todos') a.push({ id: 'imp', label: 'Impresión', value: f.impreso === 'si' ? 'Impresas' : 'Sin imprimir', clear: { impreso: 'todos' } });
        if (f.convenio !== 'todos') a.push({ id: 'conv', label: 'Convenio', value: f.convenio, clear: { convenio: 'todos' } });
        const rh = rango(f.honMin, f.honMax); if (rh) a.push({ id: 'hon', label: 'Honorarios', value: rh, clear: { honMin: '', honMax: '' } });
        const rg = rango(f.gtoMin, f.gtoMax); if (rg) a.push({ id: 'gto', label: 'Gastos', value: rg, clear: { gtoMin: '', gtoMax: '' } });
        const rt = rango(f.totMin, f.totMax); if (rt) a.push({ id: 'tot', label: 'Total', value: rt, clear: { totMin: '', totMax: '' } });
        return a;
    }, [f, opciones]);

    // ---------- Columnas ----------
    const moneyCols = (base) => [
        { key: 'hon', label: 'Honorarios', num: true, render: (g) => peso(g.hon) },
        { key: 'gto', label: 'Gastos', num: true, render: (g) => peso(g.gto) },
        { key: 'total', label: 'Total', num: true, render: (g) => <b>{peso(g.total)}</b> },
        { key: 'pct', label: '%', num: true, sortValue: (g) => g.total, render: (g) => <span className={styles.pctBadge}>{fmtPct(g.total, base)}</span> },
    ];

    const rpColumns = [
        { key: 'fecha', label: 'Fecha', sortValue: (v) => v.r.fecha || '', render: (v) => fmtDate(v.r.fecha) },
        { key: 'paciente', label: 'Paciente', wrap: true, sortValue: (v) => pacName(v.r), render: (v) => (<span title={v.r.paciente?.dni || ''}>{pacName(v.r)}{v.r.esLab ? ' 🧪' : ''}</span>) },
        { key: 'medico', label: 'Médico', wrap: true, sortValue: (v) => medName(v.r), render: (v) => medName(v.r) },
        { key: 'np', label: 'Práct.', num: true, sortValue: (v) => v.practicas.length, render: (v) => v.practicas.length },
        { key: 'nl', label: '🧪', num: true, sortValue: (v) => v.labs.length, render: (v) => v.labs.length },
        { key: 'hon', label: 'Honorarios', num: true, sortValue: (v) => v.hon, render: (v) => peso(v.hon) },
        { key: 'gto', label: 'Gastos', num: true, sortValue: (v) => v.gto, render: (v) => peso(v.gto) },
        { key: 'total', label: 'Total', num: true, sortValue: (v) => v.total, render: (v) => <b>{peso(v.total)}</b> },
        { key: 'impreso', label: '🖨️', num: true, sortValue: (v) => (v.r.impreso ? 1 : 0), render: (v) => (v.r.impreso ? '✅' : '⬜') },
    ];

    const rpFooter = [
        <b key="t">Total ({totales.rps})</b>, '', '', '', '',
        <b key="h">{peso(totales.hon)}</b>,
        <b key="g">{peso(totales.gto)}</b>,
        <b key="tt">{peso(totales.total)}</b>, '',
    ];

    const groupFooter = (first) => [
        <b key="a">{first}</b>,
        <b key="b">{totales.rps}</b>,
        <b key="c">{peso(totales.hon)}</b>,
        <b key="d">{peso(totales.gto)}</b>,
        <b key="e">{peso(totales.total)}</b>,
        <b key="f">100%</b>,
    ];

    const groupCols = (label, extra) => [
        { key: 'nombre', label, wrap: true, sortValue: (g) => g.nombre, render: (g) => <b>{g.nombre}</b> },
        ...(extra ? [extra] : []),
        { key: 'cantidad', label: 'RPs', num: true, render: (g) => g.cantidad },
        ...moneyCols(totales.total),
    ];

    // ---------- Acciones ----------
    const abrirBlob = (html, type = 'text/html;charset=utf-8') => {
        const url = URL.createObjectURL(new Blob([html], { type }));
        const w = window.open(url, '_blank');
        if (!w) { URL.revokeObjectURL(url); alert('⚠️ Habilitá las ventanas emergentes para poder imprimir.'); return; }
        w.focus();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
    };

    const exportCsv = () => {
        const head = ['Fecha', 'Paciente', 'DNI', 'Médico', 'Convenio', 'Tipo', 'Prácticas', 'Labs', 'Honorarios', 'Gastos', 'Total', 'Impresa'];
        const lines = rows
            .slice()
            .sort((a, b) => (b.r.fecha || '').localeCompare(a.r.fecha || ''))
            .map((v) => [
                fmtDate(v.r.fecha), pacName(v.r), v.r.paciente?.dni || '', medName(v.r), convName(v.r),
                v.r.esLab ? 'Laboratorio' : 'Prácticas', v.practicas.length, v.labs.length,
                Math.round(v.hon), Math.round(v.gto), Math.round(v.total), v.r.impreso ? 'Sí' : 'No',
            ].map(csvCell).join(';'));
        const csv = '\uFEFF' + [head.map(csvCell).join(';'), ...lines].join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `estadisticas-rp-${toISO(new Date())}.csv`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };

    const copiarFiltros = async () => {
        const txt = activeFilters.map((a) => `${a.label}: ${a.value}`).join('\n') || 'Sin filtros';
        try {
            await navigator.clipboard.writeText(txt);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {}
    };

    // ---------- Informe ----------
    const buildPrintData = () => {
        const sections = [];
        const gCols = (first) => [
            { label: first, wrap: true }, { label: 'RPs', num: true },
            { label: 'Honorarios', num: true }, { label: 'Gastos', num: true },
            { label: 'Total', num: true }, { label: '%', num: true },
        ];
        const gRow = (g) => [g.nombre, String(g.cantidad), peso(g.hon), peso(g.gto), peso(g.total), fmtPct(g.total, totales.total)];
        const gFoot = (t) => [t, String(totales.rps), peso(totales.hon), peso(totales.gto), peso(totales.total), '100%'];

        if (printOpts.meses) sections.push({ title: 'Totales por mes', columns: gCols('Mes'), rows: [...meses].sort((a, b) => b.key.localeCompare(a.key)).map(gRow), footer: gFoot('Total') });
        if (printOpts.medicos) sections.push({ title: 'Por médico', columns: gCols('Médico'), rows: [...medicos].sort((a, b) => b.total - a.total).map(gRow), footer: gFoot('Total'), highlight: true });
        if (printOpts.pacientes) sections.push({
            title: 'Por paciente', columns: gCols('Paciente'),
            rows: [...pacientes].sort((a, b) => b.total - a.total).map((g) => { const r = gRow(g); r[0] = g.dni ? `${g.nombre} (${g.dni})` : g.nombre; return r; }),
            footer: gFoot('Total'),
        });
        if (printOpts.convenios) sections.push({ title: 'Por convenio', columns: gCols('Convenio'), rows: [...convenios].sort((a, b) => b.total - a.total).map(gRow), footer: gFoot('Total') });
        if (printOpts.practicas) sections.push({
            title: 'Por práctica / código',
            columns: [{ label: 'Código' }, { label: 'Descripción', wrap: true }, { label: 'Veces', num: true }, { label: 'Honorarios', num: true }, { label: 'Gastos', num: true }, { label: 'Total', num: true }, { label: '%', num: true }],
            rows: [...codigos].sort((a, b) => b.cantidad - a.cantidad).slice(0, f.topN).map((c) => [c.codigo, c.nombre, String(c.cantidad), peso(c.hon), peso(c.gto), peso(c.total), fmtPct(c.cantidad, totalVecesCodigos)]),
            subtitle: codigos.length > f.topN ? `Top ${f.topN} de ${codigos.length}` : undefined,
            footer: ['Total', '', String(totalVecesCodigos), peso(totales.hon), peso(totales.gto), peso(totales.total), '100%'],
        });
        if (printOpts.detalle) sections.push({
            title: `Listado de RPs (${rows.length})`,
            columns: [{ label: 'Fecha' }, { label: 'Paciente', wrap: true }, { label: 'Médico', wrap: true }, { label: 'Pr.', num: true }, { label: 'Lab', num: true }, { label: 'Honorarios', num: true }, { label: 'Gastos', num: true }, { label: 'Total', num: true }],
            rows: rows.slice().sort((a, b) => (b.r.fecha || '').localeCompare(a.r.fecha || '')).map((v) => [fmtDate(v.r.fecha), pacName(v.r), medName(v.r), String(v.practicas.length), String(v.labs.length), peso(v.hon), peso(v.gto), peso(v.total)]),
            footer: ['Total', '', '', '', '', peso(totales.hon), peso(totales.gto), peso(totales.total)],
        });

        const kpis = printOpts.resumen ? [
            { label: 'RPs', value: String(totales.rps), sub: `${totales.pacientes} paciente(s) · ${totales.medicos} médico(s)` },
            { label: 'Honorarios', value: peso(totales.hon), sub: `${fmtPct(totales.hon, totales.total)} del total`, accent: '#44794d' },
            { label: 'Gastos clínicos', value: peso(totales.gto), sub: `${fmtPct(totales.gto, totales.total)} del total`, accent: '#b45309' },
            { label: 'Total', value: peso(totales.total), sub: totales.rps ? `Prom. ${peso(totales.total / totales.rps)} / RP` : '', accent: '#0f172a' },
        ] : [];

        const resumen = {
            rps: totales.rps, pacientes: totales.pacientes, medicos: totales.medicos,
            practicas: totalVecesCodigos,
            promedio: totales.rps ? peso(totales.total / totales.rps) : '$ 0',
            rango: f.desde || f.hasta ? `${f.desde ? fmtDate(f.desde) : '…'} → ${f.hasta ? fmtDate(f.hasta) : '…'}` : 'Todo el historial',
        };

        return { sections, kpis, resumen };
    };

    const abrirPreview = () => {
        const data = buildPrintData();
        if (!data.sections.length && !data.kpis.length) { alert('Elegí al menos una sección para imprimir.'); return; }
        setPrintPreview(data);
    };

    const confirmarImpresion = () => {
        if (!printPreview) return;
        const { sections, kpis, resumen } = printPreview;
        abrirBlob(buildStatsPrintHtml({
            logoSrc: `${window.location.origin}/logo.png`,
            filtros: activeFilters.map((a) => ({ label: a.label, value: a.value })),
            kpis, resumen, sections,
            observaciones: printObs.trim(),
        }));
        setPrintPreview(null);
        setPrintOpen(false);
        setPrintObs('');
    };

    // ---------- Keyboard shortcuts ----------
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
                e.preventDefault();
                document.querySelector(`.${styles.tableSearchInput}`)?.focus();
            }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                setPrintOpen(true);
            }
            if (e.key === 'Escape') {
                if (printPreview) setPrintPreview(null);
                else if (printOpen) setPrintOpen(false);
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [printOpen, printPreview]);

    // ---------- Render ----------
    if (historial.length === 0) {
        return (
            <section className={styles.stats} data-theme={theme}>
                <div className={styles.empty}>
                    <div className={styles.emptyIcon}>📊</div>
                    <h3 className={styles.emptyTitle}>Todavía no hay RPs guardadas</h3>
                    <p className={styles.emptyText}>Guardá al menos una RP desde la pestaña <b>Nueva RP</b> para ver las estadísticas.</p>
                </div>
            </section>
        );
    }

    const VISTAS = [
        ['meses', `📅 Meses`, meses.length],
        ['medicos', `🩺 Médicos`, medicos.length],
        ['pacientes', `👤 Pacientes`, pacientes.length],
        ['practicas', `🔝 Prácticas`, codigos.length],
        ['detalle', `📋 RPs`, rows.length],
    ];

    const codigosTop = codigos.slice(0, f.topN);
    const medicosTop = medicos.slice(0, f.topN);
    const pacientesTop = pacientes.slice(0, f.topN);

    const donutSegments = [
        { label: 'Honorarios', value: totales.hon, color: '#44794d' },
        { label: 'Gastos clínicos', value: totales.gto, color: '#b45309' },
    ];

    return (
        <section className={styles.stats} data-theme={theme}>
            {/* ================= HEADER ================= */}
            <div className={styles.statsHeader}>
                <div className={styles.statsHeaderLeft}>
                    <h2 className={styles.statsTitle}>📊 Panel de estadísticas</h2>
                    <span className={styles.statsSubtitle}>{rows.length} de {historial.length} RPs analizadas</span>
                </div>
                <div className={styles.statsHeaderRight}>
                    <PresetFilters currentFilter={f} onApply={(p) => setF({ ...FILTROS_INICIALES, ...p })} />
                    <button className={styles.btnGhost} onClick={copiarFiltros} title="Copiar filtros activos">
                        {copied ? '✅ Copiado' : '📋 Copiar filtros'}
                    </button>
                    <button className={styles.btnGhost} onClick={() => setCompare((v) => !v)} title="Comparar con período anterior" style={compare ? { background: 'var(--c-primary-soft)', color: 'var(--c-primary-dark)', borderColor: 'var(--c-primary-light)' } : undefined}>
                        📈 Comparar {compare ? 'ON' : 'OFF'}
                    </button>
                    <button className={styles.btnGhost} onClick={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))} title="Cambiar tema">
                        {theme === 'light' ? '🌙' : '☀️'}
                    </button>
                </div>
            </div>

            {/* ================= FILTROS ================= */}
            <div className={`${styles.filtersPanel} ${collapsed ? styles.filtersPanelCollapsed : ''}`}>
                <div className={styles.filtersHeader}>
                    <button className={styles.filtersToggle} onClick={() => setCollapsed((v) => !v)} aria-label="Toggle filtros">
                        <span className={`${styles.filtersToggleArrow} ${collapsed ? styles.filtersToggleArrowCollapsed : ''}`}>▾</span>
                        <span className={styles.filtersToggleLabel}>🔎 Filtros</span>
                    </button>
                    <span className={styles.filtersCount}>{rows.length} de {historial.length} RPs</span>
                    {activeFilters.length > 0 && (
                        <button className={styles.btnGhost} onClick={() => setF(FILTROS_INICIALES)}>✕ Limpiar todo</button>
                    )}
                </div>

                {!collapsed && (
                    <>
                        <div className={styles.filterGrid}>
                            <FechaFilter desde={f.desde} hasta={f.hasta} onChange={({ desde, hasta }) => patch({ desde, hasta })} />
                            <div className={styles.filterGroup}>
                                <div className={styles.filterGroupTitle}>Quién / qué</div>
                                <MultiSelect icon="🩺" labelAll="Todos los médicos" placeholder="Buscar médico…" items={opciones.medicos} selected={f.medicos} onChange={(v) => patch({ medicos: v })} />
                                <MultiSelect icon="👤" labelAll="Todos los pacientes" placeholder="Buscar paciente o DNI…" items={opciones.pacientes} selected={f.pacientes} onChange={(v) => patch({ pacientes: v })} />
                                <MultiSelect icon="🔝" labelAll="Todas las prácticas" placeholder="Buscar código o descripción…" items={opciones.codigos} selected={f.codigos} onChange={(v) => patch({ codigos: v })} />
                                {f.codigos.length > 0 && (
                                    <label className={styles.checkInline}>
                                        <input type="checkbox" checked={f.soloFiltradas} onChange={(e) => patch({ soloFiltradas: e.target.checked })} />
                                        Sumar solo los montos de las prácticas filtradas
                                    </label>
                                )}
                            </div>
                            <div className={styles.filterGroup}>
                                <div className={styles.filterGroupTitle}>Tipo / estado</div>
                                <select className={styles.select} value={f.tipo} onChange={(e) => patch({ tipo: e.target.value })}>
                                    <option value="todos">Prácticas y laboratorio</option>
                                    <option value="rp">Solo prácticas</option>
                                    <option value="lab">Solo laboratorio</option>
                                </select>
                                <select className={styles.select} value={f.impreso} onChange={(e) => patch({ impreso: e.target.value })}>
                                    <option value="todos">Impresas y sin imprimir</option>
                                    <option value="si">Solo impresas</option>
                                    <option value="no">Solo sin imprimir</option>
                                </select>
                                <select className={styles.select} value={f.convenio} onChange={(e) => patch({ convenio: e.target.value })}>
                                    <option value="todos">Todos los convenios</option>
                                    {opciones.convenios.map((c) => (<option key={c} value={c}>{c}</option>))}
                                </select>
                            </div>
                            <RangeInputs title="💰 Honorarios por RP" minVal={f.honMin} maxVal={f.honMax} onMin={(v) => patch({ honMin: v })} onMax={(v) => patch({ honMax: v })} />
                            <RangeInputs title="🏥 Gastos por RP" minVal={f.gtoMin} maxVal={f.gtoMax} onMin={(v) => patch({ gtoMin: v })} onMax={(v) => patch({ gtoMax: v })} />
                            <RangeInputs title="🧾 Total por RP" minVal={f.totMin} maxVal={f.totMax} onMin={(v) => patch({ totMin: v })} onMax={(v) => patch({ totMax: v })} />
                        </div>

                        {activeFilters.length > 0 && (
                            <div className={styles.chipsRow}>
                                {activeFilters.map((a) => (
                                    <span key={a.id} className={styles.filterChip}>
                                        <b>{a.label}:</b> {a.value}
                                        <button type="button" onClick={() => patch(a.clear)} title="Quitar filtro">×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* ================= KPIs ================= */}
            <div className={styles.kpiGrid}>
                <KpiCard icon="📄" label="RPs" value={totales.rps} sub={`${totales.pacientes} paciente(s) · ${totales.medicos} médico(s)`} trend={trend(totales.rps, totalesPrev.rps)} />
                <KpiCard icon="💰" label="Honorarios" value={peso(totales.hon)} sub={`${fmtPct(totales.hon, totales.total)} del total`} trend={trend(totales.hon, totalesPrev.hon)} />
                <KpiCard icon="🏥" label="Gastos clínicos" value={peso(totales.gto)} sub={`${fmtPct(totales.gto, totales.total)} del total`} trend={trend(totales.gto, totalesPrev.gto)} />
                <KpiCard icon="🧾" label="Total facturado" value={peso(totales.total)} sub={totales.rps ? `Prom. ${peso(totales.total / totales.rps)} / RP` : 'Sin datos'} trend={trend(totales.total, totalesPrev.total)} />
                <KpiCard icon="🏆" label="Médico top" value={topMedico?.nombre || '—'} sub={topMedico ? `${peso(topMedico.total)} · ${topMedico.cantidad} RP` : '—'} />
                <KpiCard icon="🔝" label="Código más pedido" value={topCodigo?.codigo || '—'} sub={topCodigo ? `${topCodigo.nombre} · ${topCodigo.cantidad} vez(ces)` : '—'} />
            </div>

            {/* ================= INSIGHTS ================= */}
            <Insights rows={rows} totales={totales} medicos={medicos} codigos={codigos} meses={meses} />

            {/* ================= CHARTS ================= */}
            <div className={styles.chartsGrid}>
                <div className={styles.chartCard}>
                    <h4 className={styles.chartTitle}>🥧 Distribución Honorarios / Gastos</h4>
                    <DonutChart segments={donutSegments} />
                </div>
                <div className={styles.chartCard}>
                    <h4 className={styles.chartTitle}>🏆 Top médicos por facturación</h4>
                    <MiniBarChart items={medicos} valueKey="total" labelKey="nombre" max={5} color="#44794d" />
                </div>
                <div className={styles.chartCard}>
                    <h4 className={styles.chartTitle}>🔝 Top prácticas por veces pedidas</h4>
                    <MiniBarChart items={codigos} valueKey="cantidad" labelKey="codigo" max={5} color="#0f172a" formatValue={(v) => `${v}×`} />
                </div>
                <div className={styles.chartCard}>
                    <h4 className={styles.chartTitle}>👤 Top pacientes por facturación</h4>
                    <MiniBarChart items={pacientes} valueKey="total" labelKey="nombre" max={5} color="#0e7490" />
                </div>
            </div>

            {/* ================= STICKY ACTIONS ================= */}
            <div className={styles.stickyActions}>
                <div className={styles.statsActions}>
                    <label className={styles.inlineControl}>
                        Top N:
                        <select className={styles.select} value={f.topN} onChange={(e) => patch({ topN: Number(e.target.value) })}>
                            {[10, 20, 50, 100, 200].map((n) => (<option key={n} value={n}>{n}</option>))}
                        </select>
                    </label>
                    <div className={styles.tableSearchWrap}>
                        <span className={styles.tableSearchIcon}>🔍</span>
                        <input
                            className={`${styles.input} ${styles.tableSearchInput}`}
                            placeholder="Buscar en tablas… (Ctrl+F)"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                        />
                        {tableSearch && (
                            <button className={styles.tableSearchClear} onClick={() => setTableSearch('')} title="Limpiar">×</button>
                        )}
                    </div>
                    <button className={styles.btnPrimary} onClick={() => setPrintOpen(true)} disabled={rows.length === 0}>
                        🖨️ Imprimir informe
                    </button>
                    <button className={styles.btnGhost} onClick={exportCsv} disabled={rows.length === 0}>
                        📤 Exportar CSV
                    </button>
                </div>
            </div>

            {/* ================= TABS VISTAS ================= */}
            <div className={styles.tabs}>
                {VISTAS.map(([id, label, count]) => (
                    <button
                        key={id}
                        className={`${styles.tab} ${vista === id ? styles.tabActive : ''}`}
                        onClick={() => setVista(id)}
                    >
                        {label} <span className={styles.tabCount}>{count}</span>
                    </button>
                ))}
            </div>

            <div className={styles.tableBlock}>
                {rows.length === 0 ? (
                    <div className={styles.emptyStateSmall}>
                        <div className={styles.emptyIcon}>🔍</div>
                        <p className={styles.emptyMsg}>No hay RPs que coincidan con los filtros.</p>
                        <button className={styles.btnGhost} onClick={() => setF(FILTROS_INICIALES)}>✕ Limpiar filtros</button>
                    </div>
                ) : vista === 'meses' ? (
                    <DataTable
                        columns={groupCols('Mes')} rows={meses} rowKey={(g) => g.key}
                        defaultSort={{ key: 'nombre', dir: 'desc' }} footer={groupFooter('Total')}
                        search={tableSearch}
                        renderDetail={(g) => (<DataTable columns={rpColumns} rows={g.rps} rowKey={(v) => v.r.id} defaultSort={{ key: 'fecha', dir: 'desc' }} pageSize={50} />)}
                    />
                ) : vista === 'medicos' ? (
                    <DataTable
                        columns={groupCols('Médico')} rows={medicosTop} rowKey={(g) => g.key}
                        defaultSort={{ key: 'total', dir: 'desc' }} footer={groupFooter('Total')}
                        search={tableSearch}
                        renderDetail={(g) => (<DataTable columns={rpColumns} rows={g.rps} rowKey={(v) => v.r.id} defaultSort={{ key: 'fecha', dir: 'desc' }} pageSize={50} />)}
                    />
                ) : vista === 'pacientes' ? (
                    <DataTable
                        columns={groupCols('Paciente', { key: 'dni', label: 'DNI', sortValue: (g) => g.dni, render: (g) => g.dni || '—' })}
                        rows={pacientesTop} rowKey={(g) => g.key}
                        defaultSort={{ key: 'total', dir: 'desc' }}
                        footer={[<b key="a">Total</b>, '', <b key="b">{totales.rps}</b>, <b key="c">{peso(totales.hon)}</b>, <b key="d">{peso(totales.gto)}</b>, <b key="e">{peso(totales.total)}</b>, <b key="f">100%</b>]}
                        search={tableSearch}
                        renderDetail={(g) => (<DataTable columns={rpColumns} rows={g.rps} rowKey={(v) => v.r.id} defaultSort={{ key: 'fecha', dir: 'desc' }} pageSize={50} />)}
                    />
                ) : vista === 'practicas' ? (
                    <DataTable
                        columns={[
                            { key: 'codigo', label: 'Código', sortValue: (c) => c.codigo, render: (c) => <span className={styles.codeCell}>{c.codigo}</span> },
                            { key: 'nombre', label: 'Descripción', wrap: true, sortValue: (c) => c.nombre, render: (c) => c.nombre },
                            { key: 'origen', label: 'Origen', sortValue: (c) => c.origen, render: (c) => c.origen },
                            { key: 'cantidad', label: 'Veces', num: true, render: (c) => c.cantidad },
                            { key: 'hon', label: 'Honorarios', num: true, render: (c) => peso(c.hon) },
                            { key: 'gto', label: 'Gastos', num: true, render: (c) => peso(c.gto) },
                            { key: 'total', label: 'Total', num: true, render: (c) => <b>{peso(c.total)}</b> },
                            { key: 'pct', label: '% veces', num: true, sortValue: (c) => c.cantidad, render: (c) => (<span className={styles.pctBadge}>{fmtPct(c.cantidad, totalVecesCodigos)}</span>) },
                        ]}
                        rows={codigosTop} rowKey={(c) => c.key}
                        defaultSort={{ key: 'cantidad', dir: 'desc' }}
                        footer={['', <b key="a">Total</b>, '', <b key="b">{totalVecesCodigos}</b>, <b key="c">{peso(totales.hon)}</b>, <b key="d">{peso(totales.gto)}</b>, <b key="e">{peso(totales.total)}</b>, '']}
                        search={tableSearch}
                    />
                ) : (
                    <DataTable columns={rpColumns} rows={rows} rowKey={(v) => v.r.id} defaultSort={{ key: 'fecha', dir: 'desc' }} footer={rpFooter} search={tableSearch} />
                )}
            </div>

            {/* ================= MODAL CONFIG IMPRESIÓN ================= */}
            {printOpen && !printPreview && (
                <div className={styles.modalOverlay} onClick={() => setPrintOpen(false)}>
                    <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>🖨️ Configurar informe</h3>
                            <button className={styles.modalClose} onClick={() => setPrintOpen(false)}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            <p className={styles.modalHelp}>
                                Usa los filtros actuales ({activeFilters.length ? `${activeFilters.length} activo(s)` : 'sin filtros'}) y {rows.length} RP(s). Elegí qué secciones incluir:
                            </p>
                            <div className={styles.printOptions}>
                                {PRINT_SECTIONS.map((s) => (
                                    <label key={s.id} className={styles.checkInline}>
                                        <input type="checkbox" checked={!!printOpts[s.id]} onChange={(e) => setPrintOpts((p) => ({ ...p, [s.id]: e.target.checked }))} />
                                        {s.label}
                                    </label>
                                ))}
                            </div>
                            <label className={styles.label} style={{ marginTop: '3mm' }}>Observaciones (opcional)</label>
                            <textarea className={styles.textarea} rows={2} placeholder="Ej: Informe para presentar en reunión de dirección…" value={printObs} onChange={(e) => setPrintObs(e.target.value)} />
                            <div className={styles.modalSummary}>Total: <b>{peso(totales.total)}</b> · Honorarios <b>{peso(totales.hon)}</b> · Gastos <b>{peso(totales.gto)}</b></div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.btnGhost} onClick={() => setPrintOpen(false)}>Cancelar</button>
                            <button className={styles.btnPrimary} onClick={abrirPreview}>👁️ Previsualizar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================= MODAL PREVIEW ================= */}
            {printPreview && (
                <div className={styles.modalOverlay} onClick={() => setPrintPreview(null)}>
                    <div className={`${styles.modalCard} ${styles.modalCardWide}`} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h3 className={styles.modalTitle}>👁️ Previsualización del informe</h3>
                            <button className={styles.modalClose} onClick={() => setPrintPreview(null)}>✕</button>
                        </div>
                        <div className={styles.modalBody}>
                            <div className={styles.previewSummary}>
                                {printPreview.kpis.length > 0 && (
                                    <div className={styles.previewKpis}>
                                        {printPreview.kpis.map((k, i) => (
                                            <div key={i} className={styles.previewKpi}>
                                                <div className={styles.previewKpiLabel}>{k.label}</div>
                                                <div className={styles.previewKpiValue}>{k.value}</div>
                                                {k.sub && <div className={styles.previewKpiSub}>{k.sub}</div>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                <div className={styles.previewSections}>
                                    {printPreview.sections.map((s, i) => (
                                        <div key={i} className={styles.previewSection}>
                                            <b>{s.title}</b>
                                            <span>{s.rows.length} fila(s)</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className={styles.modalFooter}>
                            <button className={styles.btnGhost} onClick={() => setPrintPreview(null)}>← Volver</button>
                            <button className={styles.btnPrimary} onClick={confirmarImpresion}>🖨️ Generar e imprimir</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
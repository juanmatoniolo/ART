// app/admin/rp/CartSection.js
'use client';

import { useMemo, useState } from 'react';
import styles from './page.module.css';
import { fmtDate, getSubCodigoInfo, tipoCostoPorOrigen } from './helpers';
import { money } from '../Facturacion/utils/calculos';

const PRINT_OPTIONS = [
    { value: 'all',       label: 'Todos' },
    { value: 'printed',   label: 'Impresos' },
    { value: 'unprinted', label: 'Sin imprimir' },
];
const GROUP_OPTIONS = [
    { value: 'none',   label: 'Sin agrupar' },
    { value: 'month',  label: 'Por mes' },
    { value: 'medico', label: 'Por médico' },
];

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
    'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const fmtMonth = (yyyymm) => {
    const [y, m] = String(yyyymm).split('-');
    const idx = parseInt(m, 10) - 1;
    return idx >= 0 && idx < 12 ? `${MESES[idx]} ${y}` : yyyymm;
};

const rpTotal = (rp) =>
    (rp.practicas || []).reduce((a, p) => a + (Number(p.costo?.total) || 0), 0);

const parseCantidad = (v) => {
    const n = Number(String(v ?? '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
};

const truncarNombreInsumo = (nombre) => {
    const limpio = String(nombre ?? '').replace(/_/g, ' ');
    return limpio.length > 15 ? `${limpio.slice(0, 15)}…` : limpio;
};

/* =====================================================================
   CartSection — usado por CARRITO y por HISTORIAL
===================================================================== */
export function CartSection({
    rps = [],
    selectedIds,
    onToggleSelected,
    onSelectAll,          // (ids: string[]) => void
    onDeselectAll,        // (ids: string[]) => void
    onEdit,
    onDelete,
    onPrint,
    onDownload,
    onTogglePrinted,
    title = '🧺 Por guardar',
    emptyMessage = 'No hay RPs.',
    children,
}) {
    const [search, setSearch]           = useState('');
    const [printFilter, setPrintFilter] = useState('all');
    const [groupBy, setGroupBy]         = useState('none');
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [closedGroups, setClosedGroups] = useState(() => new Set());

    const toggleExpanded = (id) =>
        setExpandedIds((prev) => {
            const n = new Set(prev);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });

    const toggleGroup = (key) =>
        setClosedGroups((prev) => {
            const n = new Set(prev);
            n.has(key) ? n.delete(key) : n.add(key);
            return n;
        });

    /* ---------------- contadores ---------------- */
    const counts = useMemo(() => {
        let printed = 0, unprinted = 0;
        for (const rp of rps) rp.impreso ? printed++ : unprinted++;
        return { total: rps.length, printed, unprinted };
    }, [rps]);

    /* ---------------- filtros ---------------- */
    const filtered = useMemo(() => {
        const t = search.trim().toLowerCase();
        return rps.filter((rp) => {
            if (printFilter === 'printed'   && !rp.impreso) return false;
            if (printFilter === 'unprinted' &&  rp.impreso) return false;
            if (!t) return true;
            const pac = rp.paciente || {}, med = rp.medico || {};
            const hay = [
                pac.nombreCompleto, pac.dni, pac.artSeguro,
                med.apellido, med.nombre, med.matricula, rp.diagnostico,
                ...(rp.practicas || []).map((p) => `${p.codigo} ${p.descripcion}`),
                ...(rp.estudiosLab || []).map((l) => `${l.codigo} ${l.descripcion}`),
            ].join(' ').toLowerCase();
            return hay.includes(t);
        });
    }, [rps, search, printFilter]);

    /* ---------------- agrupación ---------------- */
    const groups = useMemo(() => {
        if (groupBy === 'none')
            return [{ key: 'all', label: 'Todas', items: filtered }];

        const map = new Map();
        for (const rp of filtered) {
            let key, label;
            if (groupBy === 'month') {
                key = (rp.fecha || 'sin-fecha').slice(0, 7);
                label = key === 'sin-fecha' ? 'Sin fecha' : fmtMonth(key);
            } else {
                const med = rp.medico || {};
                key = `${med.apellido || ''}|${med.nombre || ''}`.trim() || 'sin-medico';
                label = med.apellido
                    ? `Dr/a. ${med.apellido}${med.nombre ? `, ${med.nombre}` : ''}`
                    : 'Sin médico';
            }
            if (!map.has(key)) map.set(key, { key, label, items: [] });
            map.get(key).items.push(rp);
        }
        const arr = [...map.values()];
        if (groupBy === 'month') arr.sort((a, b) => b.key.localeCompare(a.key));
        else arr.sort((a, b) => a.label.localeCompare(b.label, 'es'));
        return arr;
    }, [filtered, groupBy]);

    /* ---------------- selección ---------------- */
    const filteredIds     = filtered.map((rp) => rp.id);
    const selectedInList  = filteredIds.filter((id) => selectedIds.has(id));
    const allSelected     = filteredIds.length > 0 && selectedInList.length === filteredIds.length;
    const someSelected    = selectedInList.length > 0 && !allSelected;
    const allExpanded     = filtered.length > 0 && filtered.every((rp) => expandedIds.has(rp.id));

    const toggleAllExpanded = () =>
        setExpandedIds(allExpanded ? new Set() : new Set(filteredIds));

    const handleSelectAllToggle = () => {
        if (allSelected) onDeselectAll(filteredIds);
        else onSelectAll(filteredIds);
    };

    return (
        <section className={styles.cart}>
            <h2 className={styles.sectionTitle}>
                {title} ({rps.length})
                {rps.length > 0 && (
                    <span style={{ fontSize: 14, color: '#9ca3af', marginLeft: 10, fontWeight: 400 }}>
                        Total: {money(rps.reduce((a, r) => a + rpTotal(r), 0))}
                    </span>
                )}
            </h2>

            {/* ---------- Filtros ---------- */}
            {rps.length > 0 && (
                <div className={styles.cartFilters}>
                    <div className={styles.cartSearchBlock}>
                        <input
                            className={styles.input}
                            placeholder="🔍 Buscar por paciente, DNI, médico, código…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <div className={styles.filterGroup}>
                        <span className={styles.filterGroupLabel}>Estado</span>
                        <div className={styles.segmented}>
                            {PRINT_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    className={`${styles.segmentedBtn} ${printFilter === o.value ? styles.segmentedBtnActive : ''}`}
                                    onClick={() => setPrintFilter(o.value)}
                                >
                                    {o.label}
                                    {o.value === 'printed'   && <span className={styles.segCount}>{counts.printed}</span>}
                                    {o.value === 'unprinted' && <span className={styles.segCount}>{counts.unprinted}</span>}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className={styles.filterGroup}>
                        <span className={styles.filterGroupLabel}>Agrupar</span>
                        <div className={styles.segmented}>
                            {GROUP_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    className={`${styles.segmentedBtn} ${groupBy === o.value ? styles.segmentedBtnActive : ''}`}
                                    onClick={() => setGroupBy(o.value)}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ---------- Toolbar de selección ---------- */}
            {rps.length > 0 && (
                <div className={styles.listToolbar}>
                    <label className={styles.toolbarLabel}>
                        <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => { if (el) el.indeterminate = someSelected; }}
                            onChange={handleSelectAllToggle}
                        />
                        Seleccionar {filtered.length !== rps.length ? 'visibles' : 'todo'}
                    </label>
                    <button className={styles.btnGhost} onClick={toggleAllExpanded}>
                        {allExpanded ? '▲ Colapsar todo' : '▼ Expandir todo'}
                    </button>
                    <span className={styles.toolbarCount}>
                        {selectedInList.length} de {filtered.length} seleccionada(s)
                        {filtered.length !== rps.length && ` · ${rps.length} total`}
                    </span>
                </div>
            )}

            {/* ---------- Listado ---------- */}
            {rps.length === 0 ? (
                <div className={styles.empty}>{emptyMessage}</div>
            ) : filtered.length === 0 ? (
                <p className={styles.emptyMsg}>Ninguna RP coincide con los filtros.</p>
            ) : (
                groups.map((g) => {
                    const isOpen = !closedGroups.has(g.key);
                    const totalGroup = g.items.reduce((a, r) => a + rpTotal(r), 0);
                    return (
                        <div key={g.key} className={styles.groupSection}>
                            {groupBy !== 'none' && (
                                <div
                                    className={styles.groupHeader}
                                    onClick={() => toggleGroup(g.key)}
                                >
                                    <span className={`${styles.groupHeaderToggle} ${isOpen ? styles.groupHeaderToggleOpen : ''}`}>▶</span>
                                    <span className={styles.groupTitle}>{g.label}</span>
                                    <span className={styles.groupMeta}>
                                        {g.items.length} RP{g.items.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className={styles.groupTotal}>{money(totalGroup)}</span>
                                </div>
                            )}
                            {isOpen && (
                                <div className={styles.cartGrid}>
                                    {g.items.map((rp) => (
                                        <RpCard
                                            key={rp.id}
                                            rp={rp}
                                            selected={selectedIds.has(rp.id)}
                                            expanded={expandedIds.has(rp.id)}
                                            onToggleSelected={() => onToggleSelected(rp.id)}
                                            onToggleExpanded={() => toggleExpanded(rp.id)}
                                            onEdit={onEdit}
                                            onDelete={onDelete}
                                            onPrint={onPrint}
                                            onDownload={onDownload}
                                            onTogglePrinted={onTogglePrinted}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })
            )}

            {rps.length > 0 && children && (
                <div className={styles.cartActions}>{children}</div>
            )}
        </section>
    );
}

/* =====================================================================
   Card compacta + expandible
===================================================================== */
function RpCard({
    rp, selected, expanded,
    onToggleSelected, onToggleExpanded,
    onEdit, onDelete, onPrint, onDownload, onTogglePrinted,
}) {
    const pac        = rp.paciente || {};
    const med        = rp.medico || {};
    const practicas  = rp.practicas || [];
    const labs       = rp.estudiosLab || [];
    const hayAoter   = practicas.some((p) => p.origen === 'aoter');
    const total      = practicas.reduce((a, p) => a + (Number(p.costo?.total) || 0), 0);
    const totalHon   = practicas.reduce((a, p) => a + (Number(p.costo?.honorarioMedico) || 0), 0);
    const totalGto   = practicas.reduce((a, p) => a + (Number(p.costo?.gastoSanatorial) || 0), 0);
    const itemsCount = practicas.length + labs.length;
    const insumosCount = practicas.reduce((a, p) => a + (p.insumos?.length || 0), 0);

    return (
        <div
            className={[
                styles.rpCard,
                selected   ? styles.rpCardSelected : '',
                rp.impreso ? styles.rpCardPrinted  : '',
            ].join(' ').trim()}
        >
            {/* --- Header compacto --- */}
            <div className={styles.rpCardCompactHeader}>
                <input
                    type="checkbox"
                    className={styles.rpCardCheckbox}
                    checked={!!selected}
                    onChange={onToggleSelected}
                    aria-label="Seleccionar RP"
                />

                <div className={styles.rpCardCompactMain}>
                    <div
                        className={styles.rpCardTitle}
                        title={`${rp.tipoDoc || 'RP'}${rp.esLab ? ' LAB' : ''} · ${pac.nombreCompleto || ''}`}
                    >
                        {rp.tipoDoc}{rp.esLab ? ' LAB' : ''} · {pac.nombreCompleto || 'Sin paciente'}
                    </div>
                    <div className={styles.rpCardMeta}>
                        <span>DNI <strong>{pac.dni || '—'}</strong></span>
                        {pac.artSeguro && <span>ART <strong>{pac.artSeguro}</strong></span>}
                        {med.apellido && (
                            <span>
                                🩺 <strong>{med.apellido}{med.nombre ? `, ${med.nombre}` : ''}</strong>
                            </span>
                        )}
                    </div>
                </div>

                <button
                    type="button"
                    className={`${styles.printIconBtn} ${rp.impreso ? styles.printIconOn : ''}`}
                    onClick={onTogglePrinted}
                    title={rp.impreso ? 'Impresa — click para desmarcar' : 'Sin imprimir — click para marcar'}
                    aria-label={rp.impreso ? 'Marcar como no impresa' : 'Marcar como impresa'}
                >
                    {rp.impreso ? '✓' : '🖨️'}
                </button>

                <span className={styles.badge}>{fmtDate(rp.fecha)}</span>
            </div>

            {/* --- Resumen --- */}
            <div className={styles.rpCardSummary}>
                <span className={styles.summaryChip}>
                    {rp.esLab ? '🧪' : '📋'} {itemsCount}{' '}
                    {rp.esLab ? 'estudio(s)' : 'práctica(s)'}
                </span>
                {insumosCount > 0 && (
                    <span className={styles.summaryChip}>💊 {insumosCount} insumo(s)</span>
                )}
                {!rp.esLab && total > 0 && (
                    <span className={styles.summaryChip} style={{ marginLeft: 'auto', color: '#a7f3d0', fontWeight: 700 }}>
                        {money(total)}
                    </span>
                )}
            </div>

            {/* --- Fila de acciones --- */}
            <div className={styles.rpCardExpandRow}>
                <button
                    className={styles.expandToggle}
                    onClick={onToggleExpanded}
                    aria-expanded={expanded}
                    title={expanded ? 'Ocultar detalles' : 'Ver detalles'}
                >
                    {expanded ? '▲' : '▼'}
                </button>
                <button
                    className={styles.btnGhost}
                    style={{ fontSize: 12, padding: '4px 10px' }}
                    onClick={onToggleExpanded}
                >
                    {expanded ? 'Ocultar detalles' : 'Ver detalles'}
                </button>

                <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {onPrint && (
                        <button className={styles.btnGhost} style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => onPrint(rp)} title="Imprimir">
                            🖨️
                        </button>
                    )}
                    {onDownload && (
                        <button className={styles.btnGhost} style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => onDownload(rp)} title="Descargar PDF">
                            📥
                        </button>
                    )}
                    {onEdit && (
                        <button className={styles.btnGhost} style={{ fontSize: 12, padding: '4px 10px' }}
                            onClick={() => onEdit(rp)} title="Editar">
                            ✏️
                        </button>
                    )}
                    {onDelete && (
                        <button className={styles.btnRemove}
                            onClick={() => onDelete(rp.id)} title="Eliminar">
                            ×
                        </button>
                    )}
                </div>
            </div>

            {/* --- Detalle expandido --- */}
            {expanded && (
                <div className={styles.rpCardExpanded}>
                    {rp.esLab ? (
                        labs.length > 0 ? (
                            <DetailSection title="Estudios de laboratorio">
                                {labs.map((l, i) => (
                                    <div key={l.id || i} className={styles.cartDetailPracticeRow}>
                                        <span className={styles.cartDetailPracticeCode}>{l.codigo || '—'}</span>
                                        <span className={styles.cartDetailPracticeDesc}>{l.descripcion || '—'}</span>
                                        {l.unidadBioquimica > 0 && (
                                            <span className={styles.cartDetailPracticeType}>UB {l.unidadBioquimica}</span>
                                        )}
                                    </div>
                                ))}
                            </DetailSection>
                        ) : <em className={styles.meta}>Sin estudios cargados.</em>
                    ) : practicas.length > 0 ? (
                        <DetailSection title="Prácticas">
                            {practicas.map((p, i) => {
                                const sub  = getSubCodigoInfo(p.codigo);
                                const tipo = tipoCostoPorOrigen(p.origen, hayAoter);
                                return (
                                    <div key={p.id || i} className={styles.cartDetailPracticeRow}>
                                        <span className={styles.cartDetailPracticeCode}>{p.codigo}</span>
                                        <div className={styles.cartDetailPracticeDesc}>
                                            <div>{p.descripcion}</div>
                                            {sub && <div className={styles.codeSub}>↳ {sub}</div>}
                                            {p.insumos?.length > 0 && (
                                                <div className={styles.insumosChipsRow} style={{ marginTop: 4 }}>
                                                    {p.insumos.map((ins, j) => {
                                                        const cant = parseCantidad(ins.cantidad);
                                                        const cantTxt = Number.isInteger(cant)
                                                            ? cant
                                                            : cant.toLocaleString('es-AR', { maximumFractionDigits: 3 });
                                                        return (
                                                            <span key={ins.id || j} className={styles.insumoChip}
                                                                title={`${ins.nombre} — ${money(ins.precioFacturacion)} c/u × ${cantTxt}`}>
                                                                <span>{truncarNombreInsumo(ins.nombre)}</span>
                                                                <span className={styles.insumoChipQty}>× {cantTxt}</span>
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                        <span className={styles.cartDetailPracticeType}>{tipo}</span>
                                    </div>
                                );
                            })}
                        </DetailSection>
                    ) : <em className={styles.meta}>Sin prácticas cargadas.</em>}

                    {!rp.esLab && total > 0 && (
                        <DetailSection title="Costos">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 }}>
                                <div><span className={styles.meta}>Honorarios: </span>{money(totalHon)}</div>
                                <div><span className={styles.meta}>Gastos: </span>{money(totalGto)}</div>
                                <div><span className={styles.meta}>Total: </span><strong style={{ color: '#6fa17b' }}>{money(total)}</strong></div>
                            </div>
                        </DetailSection>
                    )}

                    {rp.diagnostico && (
                        <DetailSection title="Diagnóstico (DG)">
                            <div style={{ fontSize: 13 }}>{rp.diagnostico}</div>
                        </DetailSection>
                    )}

                    {rp.solicitaManual?.trim() && (
                        <DetailSection title="Solicita (manual)">
                            <div style={{ fontSize: 13, fontStyle: 'italic', color: '#d1d5db' }}>
                                {rp.solicitaManual}
                            </div>
                        </DetailSection>
                    )}

                    <DetailSection title="Info">
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12 }}>
                            <div><span className={styles.meta}>Tipo: </span>{rp.tipoDoc || 'RP'}{rp.esLab ? ' · LAB' : ''}</div>
                            <div><span className={styles.meta}>Fecha: </span>{fmtDate(rp.fecha)}</div>
                            <div>
                                <span className={styles.meta}>Estado: </span>
                                {rp.impreso
                                    ? <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Impreso</span>
                                    : <span style={{ color: '#9ca3af' }}>Sin imprimir</span>}
                            </div>
                            {med.matricula && (
                                <div><span className={styles.meta}>Matrícula: </span>{med.matricula}</div>
                            )}
                            {pac.artSeguro && (
                                <div><span className={styles.meta}>ART: </span>{pac.artSeguro}</div>
                            )}
                            {pac.nroSiniestro && (
                                <div><span className={styles.meta}>Nro. siniestro: </span>{pac.nroSiniestro}</div>
                            )}
                        </div>
                    </DetailSection>
                </div>
            )}
        </div>
    );
}

function DetailSection({ title, children }) {
    return (
        <div className={styles.cartDetailSection}>
            <div className={styles.cartDetailSectionTitle}>{title}</div>
            {children}
        </div>
    );
}
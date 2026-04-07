'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, parseNumber } from '../../utils/calculos';
import styles from './facturadoss.module.css';
import { useReactToPrint } from 'react-to-print';

// ─────────────────────────────────────────────────────────────────────────────
//  Funciones auxiliares
// ─────────────────────────────────────────────────────────────────────────────
const fmtDate = (ms) => {
    if (!ms) return '—';
    try {
        return new Date(ms).toLocaleString('es-AR');
    } catch {
        return '—';
    }
};

const safeNum = (v) => {
    const n = typeof v === 'number' ? v : parseNumber(v);
    return Number.isFinite(n) ? n : 0;
};

function csvEscape(s) {
    const str = String(s ?? '');
    const needsQuotes = /[;"\n\r]/.test(str);
    const escaped = str.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
}

function buildCsv({ paciente, estado, item, honorRows, gastoRows }) {
    // Implementación real (copiar la tuya)
    return '';
}

function ShortText({ text, max = 30 }) {
    const [open, setOpen] = useState(false);
    const str = String(text ?? '');
    const isLong = str.length > max;

    if (!isLong) return <span>{str || '—'}</span>;

    return (
        <span className={styles.shortWrap}>
            <span className={styles.shortText}>{open ? str : `${str.slice(0, max)}…`}</span>
            <button type="button" className={styles.moreBtn} onClick={() => setOpen((v) => !v)}>
                {open ? 'ver menos' : 'ver más'}
            </button>
        </span>
    );
}

const truncate = (str, max = 40) => {
    if (!str) return '—';
    const s = String(str);
    return s.length > max ? s.slice(0, max) + '…' : s;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Vista en pantalla (ScreenView) – sin cambios relevantes
// ─────────────────────────────────────────────────────────────────────────────
function ScreenView({
    paciente,
    honorPracticas,
    honorCirugias,
    honorLaboratorios,
    gastoPracticas,
    gastoMedicamentos,
    gastoDescartables,
    totalHonor,
    totalGasto,
    totalFactura,
    id,
    estado,
    convenio,
    onPrint,
    onDownloadCsv,
    onPrintMedDescLab,
}) {
    const renderTable = (items, columns) => {
        if (items.length === 0) return <div className={styles.emptySmall}>Sin datos.</div>;
        return (
            <div className={styles.tableWrap}>
                <table className={styles.plainTable}>
                    <thead>
                        <tr>
                            {columns.map((col, idx) => (
                                <th key={idx} className={col.className || ''}>{col.label}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((item, idx) => (
                            <tr key={idx}>
                                {columns.map((col, colIdx) => {
                                    let content = item[col.field];
                                    if (col.field === 'desc') content = <ShortText text={content} max={45} />;
                                    else if (col.field === 'total' || col.field === 'unit') content = `$ ${money(item[col.field])}`;
                                    else if (col.field === 'unidades') content = item.unidades;
                                    return <td key={colIdx} className={col.className || ''}>{content || '—'}</td>;
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    const honorColumns = [
        { label: 'Código - Práctica', field: 'desc' },
        { label: 'Dr', field: 'origen' },
        { label: 'Cant.', field: 'unidades', className: styles.num },
        { label: 'Valor unit.', field: 'unit', className: styles.num },
        { label: 'Total', field: 'total', className: styles.numStrong }
    ];

    const gastoPracticasColumns = [
        { label: 'Código - Práctica', field: 'desc' },
        { label: 'CdU', field: 'origen' },
        { label: 'Cant.', field: 'unidades', className: styles.num },
        { label: 'Valor unit.', field: 'unit', className: styles.num },
        { label: 'Total', field: 'total', className: styles.numStrong }
    ];

    const medDescColumns = [
        { label: 'Descripción', field: 'desc' },
        { label: 'Cant.', field: 'unidades', className: styles.num },
        { label: 'Valor unit.', field: 'unit', className: styles.num },
        { label: 'Total', field: 'total', className: styles.numStrong }
    ];

    return (
        <>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>
                            {estado === 'cerrado' ? '✅ Factura cerrada' : '💾 Borrador'}
                        </h1>
                        <p className={styles.subtitle}>
                            ID: <b>{id}</b> • Convenio: <b>{convenio || '—'}</b>
                        </p>
                    </div>
                    <div className={styles.headerActions}>
                        <Link className={styles.btnGhost} href="/admin/Facturacion/Facturados">← Volver</Link>
                        <Link className={styles.btnPrimary} href={`/admin/Facturacion/Nuevo?draft=${id}`}>
                            ✏️ Editar
                        </Link>
                        <button className={styles.btn} onClick={onPrint}>🖨️ Imprimir todo</button>
                        <button className={styles.btn} onClick={onPrintMedDescLab}>📋 Med+Desc+Lab</button>
                    </div>
                </div>
            </header>

            <div className={styles.patientLine}>
                <span><b>Nombre completo:</b> {paciente?.nombreCompleto || paciente?.nombre || '—'}</span>
                <span><b>DNI:</b> {paciente?.dni || '—'}</span>
                <span><b>ART:</b> {paciente?.artSeguro || '—'}</span>
                <span><b>Siniestro:</b> {paciente?.nroSiniestro || '—'}</span>
            </div>

            {/* Honorarios Médicos */}
            <section className={styles.plainSection}>
                <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>HONORARIOS MÉDICOS</h3>
                    <div className={styles.sectionSubtotal}>Subtotal: $ {money(totalHonor)}</div>
                </div>
                {honorPracticas.length > 0 && (
                    <div className={styles.subsection}>
                        <h4 className={styles.subsectionTitle}>Prácticas</h4>
                        {renderTable(honorPracticas, honorColumns)}
                    </div>
                )}
                {honorCirugias.length > 0 && (
                    <div className={styles.subsection}>
                        <h4 className={styles.subsectionTitle}>CX</h4>
                        {renderTable(honorCirugias, honorColumns)}
                    </div>
                )}
                {honorLaboratorios.length > 0 && (
                    <div className={styles.subsection}>
                        <h4 className={styles.subsectionTitle}>Laboratorio</h4>
                        {renderTable(honorLaboratorios, honorColumns)}
                    </div>
                )}
                {honorPracticas.length === 0 && honorCirugias.length === 0 && honorLaboratorios.length === 0 && (
                    <div className={styles.emptySmall}>Sin honorarios médicos.</div>
                )}
            </section>

            {/* Gastos Clínicos */}
            <section className={styles.plainSection}>
                <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>GASTOS CLÍNICOS</h3>
                    <div className={styles.sectionSubtotal}>Subtotal: $ {money(totalGasto)}</div>
                </div>
                {gastoPracticas.length > 0 && (
                    <div className={styles.subsection}>
                        <h4 className={styles.subsectionTitle}>Prácticas</h4>
                        {renderTable(gastoPracticas, gastoPracticasColumns)}
                    </div>
                )}
                {gastoMedicamentos.length > 0 && (
                    <div className={styles.subsection}>
                        <h4 className={styles.subsectionTitle}>Medicación</h4>
                        {renderTable(gastoMedicamentos, medDescColumns)}
                    </div>
                )}
                {gastoDescartables.length > 0 && (
                    <div className={styles.subsection}>
                        <h4 className={styles.subsectionTitle}>Descartables</h4>
                        {renderTable(gastoDescartables, medDescColumns)}
                    </div>
                )}
                {gastoPracticas.length === 0 && gastoMedicamentos.length === 0 && gastoDescartables.length === 0 && (
                    <div className={styles.emptySmall}>Sin gastos clínicos.</div>
                )}
            </section>

            <div className={styles.totalBar}>
                <div className={styles.totalLabelBig}>TOTAL FACTURA</div>
                <div className={styles.totalValueBig}>$ {money(totalFactura)}</div>
            </div>
        </>
    );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Vista de impresión completa (PrintView) – CON DESGLOSE POR CATEGORÍA
// ─────────────────────────────────────────────────────────────────────────────
const PrintView = React.forwardRef(({
    paciente,
    honorPracticas,
    honorCirugias,
    honorLaboratorios,
    gastoPracticas,
    gastoMedicamentos,
    gastoDescartables,
    totalHonor,
    totalGasto,
    totalFactura,
    // Nuevos subtotales por categoría
    subtotalHonorPracticas,
    subtotalHonorCirugias,
    subtotalHonorLaboratorios,
    subtotalGastoPracticas,
    subtotalGastoMedicamentos,
    subtotalGastoDescartables,
}, ref) => {
    const renderCompactTable = (items, columns) => {
        if (items.length === 0) return null;
        return (
            <table className={styles.printTableCompact}>
                <thead>
                    <tr>
                        {columns.map((col, idx) => (
                            <th key={idx}>{col.label}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {items.map((item, idx) => (
                        <tr key={idx}>
                            {columns.map((col, colIdx) => {
                                let content = item[col.field];
                                if (col.field === 'desc') content = truncate(item.desc, 40);
                                else if (col.field === 'origen') content = truncate(item.origen, 30);
                                else if (col.field === 'total' || col.field === 'unit') content = `$ ${money(item[col.field])}`;
                                else content = item[col.field];
                                return <td key={colIdx} className={col.className || ''}>{content || '—'}</td>;
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    const honorColumns = [
        { label: 'Código - Práctica', field: 'desc' },
        { label: 'Dr', field: 'origen' },
        { label: 'Cant.', field: 'unidades', className: styles.printNumber },
        { label: 'Valor unit.', field: 'unit', className: styles.printNumber },
        { label: 'Total', field: 'total', className: styles.printNumber }
    ];

    const gastoPracticasColumns = [
        { label: 'Código - Práctica', field: 'desc' },
        { label: 'CdU', field: 'origen' },
        { label: 'Cant.', field: 'unidades', className: styles.printNumber },
        { label: 'Valor unit.', field: 'unit', className: styles.printNumber },
        { label: 'Total', field: 'total', className: styles.printNumber }
    ];

    const medDescColumns = [
        { label: 'Descripción', field: 'desc' },
        { label: 'Cant.', field: 'unidades', className: styles.printNumber },
        { label: 'Valor unit.', field: 'unit', className: styles.printNumber },
        { label: 'Total', field: 'total', className: styles.printNumber }
    ];

    return (
        <div ref={ref} className={styles.printRoot}>
            {/* Datos del paciente */}
            <div className={styles.printPacienteLine}>
                <span><strong>Nombre completo:</strong> {paciente?.nombreCompleto || paciente?.nombre || '—'}</span>
                <span><strong>DNI:</strong> {paciente?.dni || '—'}</span>
                <span><strong>ART:</strong> {paciente?.artSeguro || '—'}</span>
                <span><strong>Siniestro:</strong> {paciente?.nroSiniestro || '—'}</span>
            </div>

            {/* Honorarios Médicos con desglose */}
            <div className={styles.printSectionCompact}>
                <div className={styles.printSectionTitle}>
                    HONORARIOS MÉDICOS — Total: $ {money(totalHonor)}
                </div>
                {honorPracticas.length > 0 && (
                    <>
                        <div className={styles.printSubsectionTitle}>
                            Prácticas — $ {money(subtotalHonorPracticas)}
                        </div>
                        {renderCompactTable(honorPracticas, honorColumns)}
                    </>
                )}
                {honorCirugias.length > 0 && (
                    <>
                        <div className={styles.printSubsectionTitle}>
                            CX — $ {money(subtotalHonorCirugias)}
                        </div>
                        {renderCompactTable(honorCirugias, honorColumns)}
                    </>
                )}
                {honorLaboratorios.length > 0 && (
                    <>
                        <div className={styles.printSubsectionTitle}>
                            Laboratorio — $ {money(subtotalHonorLaboratorios)}
                        </div>
                        {renderCompactTable(honorLaboratorios, honorColumns)}
                    </>
                )}
            </div>

            {/* Gastos Clínicos con desglose */}
            <div className={styles.printSectionCompact}>
                <div className={styles.printSectionTitle}>
                    GASTOS CLÍNICOS — Total: $ {money(totalGasto)}
                </div>
                {gastoPracticas.length > 0 && (
                    <>
                        <div className={styles.printSubsectionTitle}>
                            Prácticas — $ {money(subtotalGastoPracticas)}
                        </div>
                        {renderCompactTable(gastoPracticas, gastoPracticasColumns)}
                    </>
                )}
                {gastoMedicamentos.length > 0 && (
                    <>
                        <div className={styles.printSubsectionTitle}>
                            Medicación — $ {money(subtotalGastoMedicamentos)}
                        </div>
                        {renderCompactTable(gastoMedicamentos, medDescColumns)}
                    </>
                )}
                {gastoDescartables.length > 0 && (
                    <>
                        <div className={styles.printSubsectionTitle}>
                            Descartables — $ {money(subtotalGastoDescartables)}
                        </div>
                        {renderCompactTable(gastoDescartables, medDescColumns)}
                    </>
                )}
            </div>

            {/* Totales finales */}
            <div className={styles.printTotalesCompact}>
                <hr style={{ margin: '8px 0', borderColor: '#ccc' }} />
                <div className={styles.printTotalLine}>
                    <span>Subtotal Honorarios:</span>
                    <span>$ {money(totalHonor)}</span>
                </div>
                <div className={styles.printTotalLine}>
                    <span>Subtotal Gastos:</span>
                    <span>$ {money(totalGasto)}</span>
                </div>
                <div className={styles.printTotalLineFinal}>
                    <span>TOTAL:</span>
                    <span>$ {money(totalFactura)}</span>
                </div>
            </div>
        </div>
    );
});

PrintView.displayName = 'PrintView';

// ─────────────────────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function FacturadoDetallePage() {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState(null);
    const printRef = useRef(null);

    useEffect(() => {
        let alive = true;
        async function load() {
            try {
                const snap = await get(ref(db, `Facturacion/${id}`));
                if (!alive) return;
                setItem(snap.exists() ? snap.val() : null);
            } catch (e) {
                console.error(e);
                if (alive) setItem(null);
            } finally {
                if (alive) setLoading(false);
            }
        }
        if (id) load();
        return () => { alive = false; };
    }, [id]);

    // Procesamiento de datos y cálculo de subtotales por categoría
    const {
        honorPracticas,
        honorCirugias,
        honorLaboratorios,
        gastoPracticas,
        gastoMedicamentos,
        gastoDescartables,
        totalHonor,
        totalGasto,
        totalFactura,
        subtotalHonorPracticas,
        subtotalHonorCirugias,
        subtotalHonorLaboratorios,
        subtotalGastoPracticas,
        subtotalGastoMedicamentos,
        subtotalGastoDescartables,
    } = useMemo(() => {
        if (!item) return {
            honorPracticas: [], honorCirugias: [], honorLaboratorios: [],
            gastoPracticas: [], gastoMedicamentos: [], gastoDescartables: [],
            totalHonor: 0, totalGasto: 0, totalFactura: 0,
            subtotalHonorPracticas: 0, subtotalHonorCirugias: 0, subtotalHonorLaboratorios: 0,
            subtotalGastoPracticas: 0, subtotalGastoMedicamentos: 0, subtotalGastoDescartables: 0,
        };

        const practicas = Array.isArray(item.practicas) ? item.practicas : [];
        const cirugias = Array.isArray(item.cirugias) ? item.cirugias : [];
        const laboratorios = Array.isArray(item.laboratorios) ? item.laboratorios : [];
        const medicamentos = Array.isArray(item.medicamentos) ? item.medicamentos : [];
        const descartables = Array.isArray(item.descartables) ? item.descartables : [];

        const pickName = (x) => x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '—';
        const pickCode = (x) => x?.codigo || x?.code || x?.cod || x?.codigoPractica || '';
        const pickDoctor = (x) => x?.doctorNombre || x?.doctor || x?.medico || x?.nombreDr || x?.profesional || x?.prestadorNombre || x?.prestador || '—';
        const pickQty = (x) => {
            const c = x?.cantidad ?? x?.unidades ?? 1;
            const n = safeNum(c);
            return n > 0 ? n : 1;
        };
        const pickUnit = (x) => {
            const unit = x?.valorUnitario ?? x?.unitario ?? x?.precio ?? null;
            if (unit != null && unit !== '') return safeNum(unit);
            const qty = pickQty(x);
            const tot = safeNum(x?.total);
            return qty > 0 ? tot / qty : 0;
        };
        const formatCodeName = (x) => {
            const code = String(pickCode(x) || '').trim();
            const name = String(pickName(x) || '').trim();
            return code ? `${code} - ${name}` : name;
        };

        const honorPracticasArr = [];
        const honorCirugiasArr = [];
        const honorLaboratoriosArr = [];
        const gastoPracticasArr = [];
        const gastoMedicamentosArr = [];
        const gastoDescartablesArr = [];

        practicas.forEach(p => {
            const honorario = safeNum(p?.honorarioMedico);
            const gasto = safeNum(p?.gastoSanatorial);
            const qty = pickQty(p);
            const unit = pickUnit(p);
            const desc = formatCodeName(p);
            const doctor = pickDoctor(p);
            if (honorario > 0) honorPracticasArr.push({ desc, origen: doctor, unidades: qty, unit, total: honorario });
            if (gasto > 0) gastoPracticasArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
        });

        cirugias.forEach(c => {
            const honorario = safeNum(c?.honorarioMedico);
            const gasto = safeNum(c?.gastoSanatorial);
            const qty = pickQty(c);
            const unit = pickUnit(c);
            const desc = formatCodeName(c);
            const doctor = pickDoctor(c);
            if (honorario > 0) honorCirugiasArr.push({ desc, origen: doctor, unidades: qty, unit, total: honorario });
            if (gasto > 0) gastoPracticasArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
        });

        laboratorios.forEach(l => {
            const honorario = safeNum(l?.honorarioMedico);
            const gasto = safeNum(l?.gastoSanatorial);
            const qty = pickQty(l);
            const unit = pickUnit(l);
            const desc = formatCodeName(l);
            const doctor = pickDoctor(l);
            if (honorario > 0) honorLaboratoriosArr.push({ desc, origen: doctor, unidades: qty, unit, total: honorario });
            if (gasto > 0) gastoPracticasArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
        });

        medicamentos.forEach(m => {
            const gasto = safeNum(m?.gastoSanatorial ?? m?.total);
            const qty = pickQty(m);
            const unit = pickUnit(m);
            const desc = m?.nombre || '—';
            if (gasto > 0) gastoMedicamentosArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
        });

        descartables.forEach(d => {
            const gasto = safeNum(d?.gastoSanatorial ?? d?.total);
            const qty = pickQty(d);
            const unit = pickUnit(d);
            const desc = d?.nombre || '—';
            if (gasto > 0) gastoDescartablesArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
        });

        const subtotalHonorPracticas = honorPracticasArr.reduce((a, r) => a + r.total, 0);
        const subtotalHonorCirugias = honorCirugiasArr.reduce((a, r) => a + r.total, 0);
        const subtotalHonorLaboratorios = honorLaboratoriosArr.reduce((a, r) => a + r.total, 0);
        const totalHonor = subtotalHonorPracticas + subtotalHonorCirugias + subtotalHonorLaboratorios;

        const subtotalGastoPracticas = gastoPracticasArr.reduce((a, r) => a + r.total, 0);
        const subtotalGastoMedicamentos = gastoMedicamentosArr.reduce((a, r) => a + r.total, 0);
        const subtotalGastoDescartables = gastoDescartablesArr.reduce((a, r) => a + r.total, 0);
        const totalGasto = subtotalGastoPracticas + subtotalGastoMedicamentos + subtotalGastoDescartables;

        return {
            honorPracticas: honorPracticasArr,
            honorCirugias: honorCirugiasArr,
            honorLaboratorios: honorLaboratoriosArr,
            gastoPracticas: gastoPracticasArr,
            gastoMedicamentos: gastoMedicamentosArr,
            gastoDescartables: gastoDescartablesArr,
            totalHonor,
            totalGasto,
            totalFactura: totalHonor + totalGasto,
            subtotalHonorPracticas,
            subtotalHonorCirugias,
            subtotalHonorLaboratorios,
            subtotalGastoPracticas,
            subtotalGastoMedicamentos,
            subtotalGastoDescartables,
        };
    }, [item]);

    // Impresión de Medicamentos + Descartables + Laboratorio (sin cambios, igual que antes)
    const printMedDescLab = () => {
        if (!item) return;

        const paciente = item.paciente || {};
        const nombre = paciente.nombreCompleto || paciente.nombre || '—';
        const dni = paciente.dni || '—';
        const siniestro = paciente.nroSiniestro || item.nroSiniestro || '—';
        const artNombre = item.artNombre || paciente.artSeguro || item.convenioNombre || 'SIN ART';

        const medicamentos = Array.isArray(item.medicamentos) ? item.medicamentos : [];
        const descartables = Array.isArray(item.descartables) ? item.descartables : [];
        const laboratorios = Array.isArray(item.laboratorios) ? item.laboratorios : [];

        const safeNumLocal = (v) => {
            const n = typeof v === 'number' ? v : Number(v);
            return Number.isFinite(n) ? n : 0;
        };
        const pickName = (x) => x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '—';
        const pickCode = (x) => x?.codigo || x?.code || x?.cod || x?.codigoPractica || '';
        const pickDoctor = (x) => x?.doctorNombre || x?.doctor || x?.medico || x?.nombreDr || x?.profesional || x?.prestadorNombre || x?.prestador || '—';
        const pickQty = (x) => {
            const c = x?.cantidad ?? x?.unidades ?? 1;
            const n = safeNumLocal(c);
            return n > 0 ? n : 1;
        };
        const pickUnit = (x) => {
            const unit = x?.valorUnitario ?? x?.unitario ?? x?.precio ?? null;
            if (unit != null && unit !== '') return safeNumLocal(unit);
            const qty = pickQty(x);
            const tot = safeNumLocal(x?.total);
            return qty > 0 ? tot / qty : 0;
        };
        const formatCodeName = (x) => {
            const code = String(pickCode(x) || '').trim();
            const name = String(pickName(x) || '').trim();
            return code ? `${code} — ${name}` : name;
        };

        const rowsMedDesc = (arr) =>
            arr.map((x) => {
                const qty = pickQty(x);
                const unit = pickUnit(x);
                const tot = safeNumLocal(x?.gastoSanatorial ?? x?.total);
                const desc = x?.nombre || x?.descripcion || '—';
                const pres = x?.presentacion ? ` (${x.presentacion})` : '';
                return `<tr>
                    <td>${desc}${pres}</td>
                    <td class="num">${qty}</td>
                    <td class="num">$ ${money(unit)}</td>
                    <td class="num">$ ${money(tot)}</td>
                </tr>`;
            }).join('');

        const rowsLab = laboratorios.map((l) => {
            const qty = pickQty(l);
            const ub = safeNumLocal(l?.unidadBioquimica ?? l?.ub ?? pickUnit(l));
            const total = safeNumLocal(l?.honorarioMedico ?? l?.total);
            const desc = formatCodeName(l);
            const doctor = pickDoctor(l);
            return `<tr>
                <td>${desc}</td>
                <td>${doctor !== '—' ? doctor : ''}</td>
                <td class="num">${qty}</td>
                <td class="num">${money(ub)}</td>
                <td class="num">$ ${money(total)}</td>
            </tr>`;
        }).join('');

        const totalMed = medicamentos.reduce((a, x) => a + safeNumLocal(x?.gastoSanatorial ?? x?.total), 0);
        const totalDesc = descartables.reduce((a, x) => a + safeNumLocal(x?.gastoSanatorial ?? x?.total), 0);
        const totalLab = laboratorios.reduce((a, x) => a + safeNumLocal(x?.honorarioMedico ?? x?.total), 0);
        const totalGen = totalMed + totalDesc + totalLab;

        const secMed = medicamentos.length === 0 ? '' : `
            <h2>Medicamentos $ ${money(totalMed)}</h2>
            <table>
                <thead><tr><th>Descripción</th><th>Cant.</th><th>Valor unit.</th><th>Total</th></tr></thead>
                <tbody>${rowsMedDesc(medicamentos)}</tbody>
            </table>
        `;
        const secDesc = descartables.length === 0 ? '' : `
            <h2>Descartables $ ${money(totalDesc)}</h2>
            <table>
                <thead>
                <tr>
                <th>Descripción</th>
                <th>Cant.</th><th>Valor unit.</th><th>Total</th></tr></thead>
                <tbody>${rowsMedDesc(descartables)}</tbody>
            </table>
        `;
       const secLab = laboratorios.length === 0 ? '' : `
            <h2>Estudios de Laboratorio $ ${money(totalLab)}</h2>
            <table>
                <thead>
                <tr>
                <th>Código — Estudio</th>
                <th>Bioquímico/a</th>
                <th>Cant.</th>
                <th>UB</th>
                <th>Total</th>
                </tr>
                </thead>
                <tbody>${rowsLab}</tbody>
            </table>
        `;

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Med + Desc + Lab — ${artNombre} — ${siniestro}</title>
  <style>
    @page { margin: 1cm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 0; color: #000; }
    .watermark {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      opacity: .12; z-index: -1; pointer-events: none;
    }
    .watermark img { width: 280px; height: auto; }
    h1 { font-size: 16pt; margin: 0 0 10px; }
    h2 { font-size: 13pt; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    .info-header {
      display: flex; flex-wrap: wrap; gap: 12px;
      background: #f4f4f4; padding: 8px 12px;
      border-radius: 4px; margin-bottom: 14px; font-size: 10pt;
    }
    .info-header p { margin: 0; }
    table {
      border-collapse: collapse; width: 100%;
      font-size: 10pt; margin-bottom: 4px;
      page-break-inside: avoid;
    }
    th {
      background: #e0e0e0; text-align: left;
      padding: 5px 6px; border: 1px solid #ccc;
    }
    td { padding: 4px 6px; border: 1px solid #ccc; }
    td.num { text-align: right; font-size: 9pt; }
    .totales {
      margin-top: 18px; border-top: 2px solid #333;
      padding-top: 10px; page-break-inside: avoid;
    }
    .totales p { margin: 2px 0; font-weight: bold; font-size: 11pt; }
    .total-general { font-size: 14pt; margin-top: 6px; }
    .footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 20px; border-top: 1px solid #aaa; padding-top: 14px;
      page-break-inside: avoid;
    }
    .firma { text-align: center; flex: 1; }
    .firma-linea { font-size: 13pt; letter-spacing: 2px; color: #444; margin-bottom: 2px; }
    .firma-label { font-size: 9pt; color: #666; }
    .clinica { text-align: center; flex: 1; }
    .clinica img { max-width: 70px; height: auto; margin-bottom: 4px; }
    .clinica-info { font-size: 8pt; color: #666; line-height: 1.3; }
    hr { margin: 10px 0; }
  </style>
</head>
<body>
  <div class="watermark"><img src="/logo.png" alt=""></div>
  <h1>Medicamentos, Descartables y Laboratorio</h1>
  <div class="info-header">
    <p><strong>ART / Convenio:</strong> ${artNombre}</p>
    <p><strong>Paciente:</strong> ${nombre}</p>
    <p><strong>DNI:</strong> ${dni}</p>
    <p><strong>N° Siniestro:</strong> ${siniestro}</p>
  </div>
  ${secMed}
  ${secDesc}
  ${secLab}
  <div class="totales">
    <hr>
    <p class="total-general">TOTAL GENERAL: $ ${money(totalGen)}</p>
  </div>
  <div class="footer">
    <div class="firma">
      <div class="firma-linea">_________________________</div>
      <div class="firma-label">Firma y sello del responsable</div>
    </div>
    <div class="clinica">
      <img src="/logo.jpg" alt="Clínica de la Unión">
      <div class="clinica-info">
        Clínica de la Unión S.A.<br>
        Chajarí, Entre Ríos — Av. Siburu 1085
      </div>
    </div>
  </div>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(html);
        win.document.close();
        win.focus();
        win.print();
    };

    const onDownloadCsv = () => {
        alert('Función CSV no implementada aún.');
    };

    const onPrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Factura_${id}_${item?.paciente?.dni || 'sin_dni'}`,
    });

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Cargando…</h1>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>No encontrado</h1>
                    <p className={styles.subtitle}>No existe el registro /Facturacion/{id}</p>
                    <Link className={styles.btnGhost} href="/admin/Facturacion/Facturados">← Volver</Link>
                </div>
            </div>
        );
    }

    const paciente = item.paciente || {};
    const estado = item.estado || (item.cerradoAt ? 'cerrado' : 'borrador');

    return (
        <div className={styles.container}>
            <div className={styles.screenView}>
                <ScreenView
                    paciente={paciente}
                    honorPracticas={honorPracticas}
                    honorCirugias={honorCirugias}
                    honorLaboratorios={honorLaboratorios}
                    gastoPracticas={gastoPracticas}
                    gastoMedicamentos={gastoMedicamentos}
                    gastoDescartables={gastoDescartables}
                    totalHonor={totalHonor}
                    totalGasto={totalGasto}
                    totalFactura={totalFactura}
                    id={id}
                    estado={estado}
                    convenio={item.convenioNombre || item.convenio}
                    onPrint={onPrint}
                    onDownloadCsv={onDownloadCsv}
                    onPrintMedDescLab={printMedDescLab}
                />
            </div>
            <PrintView
                ref={printRef}
                paciente={paciente}
                honorPracticas={honorPracticas}
                honorCirugias={honorCirugias}
                honorLaboratorios={honorLaboratorios}
                gastoPracticas={gastoPracticas}
                gastoMedicamentos={gastoMedicamentos}
                gastoDescartables={gastoDescartables}
                totalHonor={totalHonor}
                totalGasto={totalGasto}
                totalFactura={totalFactura}
                subtotalHonorPracticas={subtotalHonorPracticas}
                subtotalHonorCirugias={subtotalHonorCirugias}
                subtotalHonorLaboratorios={subtotalHonorLaboratorios}
                subtotalGastoPracticas={subtotalGastoPracticas}
                subtotalGastoMedicamentos={subtotalGastoMedicamentos}
                subtotalGastoDescartables={subtotalGastoDescartables}
            />
        </div>
    );
}
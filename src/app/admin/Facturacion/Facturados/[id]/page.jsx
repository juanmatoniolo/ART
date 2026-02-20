'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, parseNumber, isRadiografia } from '../../utils/calculos';
import styles from './facturadoss.module.css';

import { useReactToPrint } from 'react-to-print';

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
    const lines = [];

    lines.push(
        [
            `Paciente: ${paciente?.nombreCompleto || paciente?.nombre || '—'}`,
            `DNI: ${paciente?.dni || '—'}`,
            `ART: ${paciente?.artSeguro || '—'}`,
            `Siniestro N°: ${paciente?.nroSiniestro || '—'}`,
        ]
            .map(csvEscape)
            .join(';')
    );

    lines.push('');

    const addTable = (title, rows) => {
        lines.push(csvEscape(title));
        lines.push(['Código - Detalle', 'Origen', 'Unidades', 'Valor unit.', 'Total'].map(csvEscape).join(';'));

        rows.forEach((r) => {
            lines.push([r.desc, r.origen, r.unidades, money(r.unit), money(r.total)].map(csvEscape).join(';'));
        });

        lines.push('');
    };

    addTable('HONORARIOS MÉDICOS', honorRows);
    addTable('GASTOS CLÍNICOS', gastoRows);

    const totHonor = honorRows.reduce((a, r) => a + safeNum(r.total), 0);
    const totGasto = gastoRows.reduce((a, r) => a + safeNum(r.total), 0);

    lines.push([csvEscape('TOTAL HONORARIOS'), '', '', '', csvEscape(money(totHonor))].join(';'));
    lines.push([csvEscape('TOTAL GASTOS CLÍNICOS'), '', '', '', csvEscape(money(totGasto))].join(';'));
    lines.push([csvEscape('TOTAL FACTURA'), '', '', '', csvEscape(money(totHonor + totGasto))].join(';'));

    return lines.join('\n');
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

export default function FacturadoDetallePage() {
    const { id } = useParams();

    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState(null);

    const printRef = useRef(null);

    useEffect(() => {
        let alive = true;

        async function run() {
            try {
                const snap = await get(ref(db, `Facturacion/${id}`));
                if (!alive) return;
                setItem(snap.exists() ? snap.val() : null);
            } catch (e) {
                console.error(e);
                if (!alive) return;
                setItem(null);
            } finally {
                if (alive) setLoading(false);
            }
        }

        if (id) run();
        return () => {
            alive = false;
        };
    }, [id]);

    const paciente = item?.paciente || {};
    const estado = item?.estado || (item?.cerradoAt ? 'cerrado' : 'borrador');

    const { honorRows, gastoRows, totHonor, totGasto, totalFactura } = useMemo(() => {
        const practicas = Array.isArray(item?.practicas) ? item.practicas : [];
        const cirugias = Array.isArray(item?.cirugias) ? item.cirugias : [];
        const labs = Array.isArray(item?.laboratorios) ? item.laboratorios : [];
        const meds = Array.isArray(item?.medicamentos) ? item.medicamentos : [];
        const desc = Array.isArray(item?.descartables) ? item.descartables : [];

        const pickName = (x) =>
            x?.descripcion ||
            x?.nombre ||
            x?.practica ||
            x?.detalle ||
            x?.producto ||
            '—';

        const pickCode = (x) =>
            x?.codigo ||
            x?.code ||
            x?.cod ||
            x?.codigoPractica ||
            '';

        const pickDoctor = (x) =>
            x?.doctorNombre ||
            x?.doctor ||
            x?.medico ||
            x?.nombreDr ||
            x?.profesional ||
            x?.prestadorNombre ||
            x?.prestador ||
            '—';

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

        const honor = [];
        const gasto = [];

        const pushHonorIf = (x) => {
            const honorario = safeNum(x?.honorarioMedico);
            if (honorario > 0) {
                const qty = pickQty(x);

                honor.push({
                    desc: formatCodeName(x),
                    origen: pickDoctor(x),
                    unidades: qty,
                    unit: pickUnit(x),
                    total: honorario,
                });
            }
        };

        const pushGastoIf = (x) => {
            const g = safeNum(x?.gastoSanatorial);

            if (g > 0) {
                const qty = pickQty(x);

                gasto.push({
                    desc: formatCodeName(x),
                    origen: 'Clínica de la Unión',
                    unidades: qty,
                    unit: pickUnit(x),
                    total: g,
                });
            }
        };

        [...practicas, ...cirugias, ...labs].forEach((x) => {
            pushHonorIf(x);
            pushGastoIf(x);
        });

        [...meds, ...desc].forEach((x) => {
            const qty = pickQty(x);
            const unit = pickUnit(x);
            const total = safeNum(x?.gastoSanatorial ?? x?.total ?? unit * qty);

            if (total > 0) {
                gasto.push({
                    desc: formatCodeName(x),
                    origen: 'Clínica de la Unión',
                    unidades: qty,
                    unit,
                    total,
                });
            }
        });

        const totHonor2 = honor.reduce((a, r) => a + safeNum(r.total), 0);
        const totGasto2 = gasto.reduce((a, r) => a + safeNum(r.total), 0);

        return {
            honorRows: honor,
            gastoRows: gasto,
            totHonor: totHonor2,
            totGasto: totGasto2,
            totalFactura: totHonor2 + totGasto2,
        };
    }, [item]);

    const onDownloadCsv = () => {
        const csv = buildCsv({ paciente, estado, item, honorRows, gastoRows });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `Factura_${id}_${paciente?.dni || 'sin_dni'}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    const onPrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Factura_${id}_${paciente?.dni || 'sin_dni'}`,
    });

    if (loading) {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>Cargando…</h1>
                    </div>
                </header>
            </div>
        );
    }

    if (!item) {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>No encontrado</h1>
                        <p className={styles.subtitle}>No existe el registro /Facturacion/{id}</p>
                    </div>

                    <div className={styles.headerActions}>
                        <Link className={styles.btnGhost} href="/admin/Facturacion/Facturados">
                            ← Volver
                        </Link>
                    </div>
                </header>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>{estado === 'cerrado' ? '✅ Factura cerrada' : '💾 Borrador'}</h1>
                        <p className={styles.subtitle}>
                            ID: <b>{id}</b> • Convenio: <b>{item?.convenioNombre || item?.convenio || '—'}</b>
                        </p>
                    </div>

                    <div className={styles.headerActions}>
                        <Link className={styles.btnGhost} href="/admin/Facturacion/Facturados">
                            ← Volver
                        </Link>

                        {estado !== 'cerrado' && (
                            <Link className={styles.btnPrimary} href={`/admin/Facturacion/Nuevo?draft=${id}`}>
                                ✏️ Retomar borrador
                            </Link>
                        )}

                        {/* ✅ Imprimir */}
                        <button className={styles.btn} onClick={onPrint} type="button">
                            🖨️ Imprimir
                        </button>

                        {/* ✅ Descargar */}
                        <button className={styles.btn} onClick={onDownloadCsv} type="button">
                            ⬇️ Descargar CSV
                        </button>
                    </div>
                </div>
            </header>

            <main className={styles.content} ref={printRef}>
                <div className={styles.printHeaderCompact}>
                    <span>
                        <b>Nombre completo:</b> {paciente?.nombreCompleto || paciente?.nombre || '—'}
                    </span>

                    <span>
                        <b>DNI:</b> {paciente?.dni || '—'}
                    </span>

                    <span>
                        <b>ART:</b> {paciente?.artSeguro || '—'}
                    </span>

                    <span>
                        <b>Siniestro:</b> {paciente?.nroSiniestro || '—'}
                    </span>
                </div>

                {/* ... todo lo demás igual ... */}
                {/* (tu JSX de tablas / totales / meta ya está abajo tal cual) */}

                {/* HONORARIOS */}
                <section className={styles.plainSection}>
                    <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>HONORARIOS MÉDICOS</h3>
                        <div className={styles.sectionSubtotal}>Subtotal: $ {money(totHonor)}</div>
                    </div>

                    {honorRows.length === 0 ? (
                        <div className={styles.emptySmall}>Sin honorarios médicos.</div>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.plainTable}>
                                <thead>
                                    <tr>
                                        <th>Código - Práctica</th>
                                        <th>Dr</th>
                                        <th className={styles.num}>Unidades</th>
                                        <th className={styles.num}>Valor unit.</th>
                                        <th className={styles.num}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {honorRows.map((r, idx) => (
                                        <tr key={`h-${idx}`}>
                                            <td className={styles.cellText}>
                                                <ShortText text={r.desc} max={45} />
                                            </td>
                                            <td className={styles.cellText}>{r.origen}</td>
                                            <td className={styles.num}>{r.unidades}</td>
                                            <td className={styles.num}>$ {money(r.unit)}</td>
                                            <td className={styles.numStrong}>$ {money(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                {/* GASTOS */}
                <section className={styles.plainSection}>
                    <div className={styles.sectionHeader}>
                        <h3 className={styles.sectionTitle}>GASTOS CLÍNICOS</h3>
                        <div className={styles.sectionSubtotal}>Subtotal: $ {money(totGasto)}</div>
                    </div>

                    {gastoRows.length === 0 ? (
                        <div className={styles.emptySmall}>Sin gastos clínicos.</div>
                    ) : (
                        <div className={styles.tableWrap}>
                            <table className={styles.plainTable}>
                                <thead>
                                    <tr>
                                        <th>Detalle</th>
                                        <th>Origen</th>
                                        <th className={styles.num}>Unidades</th>
                                        <th className={styles.num}>Valor unit.</th>
                                        <th className={styles.num}>Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {gastoRows.map((r, idx) => (
                                        <tr key={`g-${idx}`}>
                                            <td className={styles.cellText}>
                                                <ShortText text={r.desc} max={20} />
                                            </td>
                                            <td className={styles.cellText}>{r.origen}</td>
                                            <td className={styles.num}>{r.unidades}</td>
                                            <td className={styles.num}>$ {money(r.unit)}</td>
                                            <td className={styles.numStrong}>$ {money(r.total)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <div className={styles.totalBar}>
                    <div className={styles.totalLabelBig}>TOTAL FACTURA</div>
                    <div className={styles.totalValueBig}>$ {money(totalFactura)}</div>
                </div>

            </main>
        </div>
    );
}
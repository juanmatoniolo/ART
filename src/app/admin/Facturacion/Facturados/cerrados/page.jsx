'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, parseNumber } from '../../utils/calculos';
import styles from '../facturados.module.css';
import * as XLSX from 'xlsx';

const normalizeKey = (s) =>
    String(s ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

const norm = (s) =>
    String(s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

const safeNum = (v) => {
    const n = typeof v === 'number' ? v : parseNumber(v);
    return Number.isFinite(n) ? n : 0;
};

export default function CerradosPage() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);

    const [q, setQ] = useState('');
    const [art, setArt] = useState('');

    // Selección múltiple
    const [selectedIds, setSelectedIds] = useState(new Set());

    useEffect(() => {
        const r = ref(db, 'Facturacion');
        return onValue(
            r,
            (snap) => {
                setData(snap.exists() ? snap.val() : {});
                setLoading(false);
            },
            (err) => {
                console.error(err);
                setData({});
                setLoading(false);
            }
        );
    }, []);

    const items = useMemo(() => {
        const obj = data || {};
        const arr = Object.entries(obj).map(([id, v]) => {
            const pacienteNombre =
                v?.paciente?.nombreCompleto || v?.pacienteNombre || v?.paciente?.nombre || v?.nombrePaciente || '';
            const dni = v?.paciente?.dni || v?.dni || '';
            const nroSiniestro = v?.paciente?.nroSiniestro || v?.nroSiniestro || '';
            const artNombre = v?.paciente?.artSeguro || v?.artNombre || v?.artSeguro || 'SIN ART';
            const artKey = v?.artKey || normalizeKey(artNombre);

            const estado = v?.estado || (v?.cerradoAt ? 'cerrado' : 'borrador');
            const closedAt = v?.cerradoAt || v?.closedAt || 0;

            const total =
                v?.totales?.total ??
                v?.total ??
                (Number(v?.totales?.honorarios || 0) + Number(v?.totales?.gastos || 0)) ??
                0;

            return { id, pacienteNombre, dni, nroSiniestro, artNombre, artKey, estado, closedAt, total };
        });

        return arr
            .filter((it) => it.estado === 'cerrado')
            .sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
    }, [data]);

    const arts = useMemo(() => {
        const map = new Map();
        items.forEach((it) => {
            const key = it.artKey || normalizeKey(it.artNombre || '');
            const name = it.artNombre || it.artKey || 'SIN ART';
            if (!map.has(key)) map.set(key, name);
        });
        return Array.from(map.entries())
            .map(([key, name]) => ({ key, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [items]);

    const filtered = useMemo(() => {
        const qq = norm(q);
        return items.filter((it) => {
            if (art && (it.artKey || '') !== art) return false;
            if (!qq) return true;
            const blob = norm(`${it.pacienteNombre || ''} ${it.dni || ''} ${it.nroSiniestro || ''} ${it.artNombre || ''}`);
            return blob.includes(qq);
        });
    }, [items, q, art]);

    // Handlers de selección
    const toggleSelect = (id) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) newSelected.delete(id);
        else newSelected.add(id);
        setSelectedIds(newSelected);
    };

    const toggleSelectAll = () => {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(it => it.id)));
        }
    };

    const isAllSelected = selectedIds.size === filtered.length && filtered.length > 0;

    // Exportar a Excel con el formato solicitado
    const exportToExcel = () => {
        const selected = Array.from(selectedIds);
        if (selected.length === 0) {
            alert('Seleccione al menos un siniestro.');
            return;
        }

        // Encabezados: incluimos las columnas M, N, O para los subtotales
        const headers = [
            'CdU', 'Nombre completo', 'DNI', 'N° Siniestro',
            'Tipo', 'Categoría', 'Código', 'Descripción',
            'Cantidad', 'Valor unitario', 'Total línea', 'Origen',
            'Subtotal Honorarios', 'Subtotal Gastos', 'Total Siniestro'
        ];
        const rows = [headers];

        let globalCdU = 1; // Contador global de filas de detalle (excluye encabezados y filas en blanco)

        // Procesar cada siniestro seleccionado
        selected.forEach((id, index) => {
            const item = data[id];
            if (!item) return;

            const paciente = item.paciente || {};
            const nombre = paciente.nombreCompleto || paciente.nombre || '';
            const dni = paciente.dni || '';
            const nroSiniestro = paciente.nroSiniestro || '';

            // Recolectar todas las líneas de honorarios y gastos
            const honorRows = [];
            const gastoRows = [];

            // Función para procesar cada ítem
            const processItem = (x, categoria) => {
                const honorario = safeNum(x?.honorarioMedico);
                const gasto = safeNum(x?.gastoSanatorial);
                const cantidad = safeNum(x?.cantidad ?? x?.unidades ?? 1) || 1;
                const totalItem = safeNum(x?.total);
                const unit = cantidad > 0 ? totalItem / cantidad : 0;

                const desc = x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '';
                const codigo = x?.codigo || x?.code || x?.cod || '';
                let origen = x?.doctorNombre || x?.doctor || x?.medico || x?.prestadorNombre || x?.prestador || '';

                // Para honorarios, si no hay origen, dejamos vacío
                if (honorario > 0) {
                    honorRows.push({
                        tipo: 'HONORARIO',
                        categoria,
                        codigo,
                        desc,
                        cantidad,
                        unit,
                        total: honorario,
                        origen: origen || ''
                    });
                }
                if (gasto > 0) {
                    gastoRows.push({
                        tipo: 'GASTO',
                        categoria,
                        codigo,
                        desc,
                        cantidad,
                        unit,
                        total: gasto,
                        origen: 'Clínica de la Unión'
                    });
                }
            };

            // Prácticas
            (item.practicas || []).forEach(p => processItem(p, 'Práctica'));
            // Cirugías
            (item.cirugias || []).forEach(c => processItem(c, 'Cirugía'));
            // Laboratorios
            (item.laboratorios || []).forEach(l => processItem(l, 'Laboratorio'));
            // Medicamentos (solo gasto)
            (item.medicamentos || []).forEach(m => {
                const gasto = safeNum(m?.gastoSanatorial ?? m?.total);
                if (gasto > 0) {
                    const cantidad = safeNum(m?.cantidad ?? m?.unidades ?? 1) || 1;
                    const unit = cantidad > 0 ? gasto / cantidad : 0;
                    gastoRows.push({
                        tipo: 'GASTO',
                        categoria: 'Medicación',
                        codigo: '',
                        desc: m?.nombre || '',
                        cantidad,
                        unit,
                        total: gasto,
                        origen: 'Clínica de la Unión'
                    });
                }
            });
            // Descartables (solo gasto)
            (item.descartables || []).forEach(d => {
                const gasto = safeNum(d?.gastoSanatorial ?? d?.total);
                if (gasto > 0) {
                    const cantidad = safeNum(d?.cantidad ?? d?.unidades ?? 1) || 1;
                    const unit = cantidad > 0 ? gasto / cantidad : 0;
                    gastoRows.push({
                        tipo: 'GASTO',
                        categoria: 'Descartable',
                        codigo: '',
                        desc: d?.nombre || '',
                        cantidad,
                        unit,
                        total: gasto,
                        origen: 'Clínica de la Unión'
                    });
                }
            });

            // Calcular subtotales del siniestro
            const totalHonor = honorRows.reduce((acc, r) => acc + r.total, 0);
            const totalGasto = gastoRows.reduce((acc, r) => acc + r.total, 0);
            const totalSiniestro = totalHonor + totalGasto;

            // Ordenar: primero todos los honorarios, luego todos los gastos
            const allRows = [...honorRows, ...gastoRows];

            // Si no hay filas, saltamos (no debería ocurrir en cerrados)
            if (allRows.length === 0) return;

            // Generar filas de detalle
            allRows.forEach((row, idx) => {
                // Los datos del paciente solo en la primera fila del siniestro
                const rowData = [
                    globalCdU,                     // CdU
                    idx === 0 ? nombre : '',       // Nombre completo
                    idx === 0 ? dni : '',          // DNI
                    idx === 0 ? nroSiniestro : '', // N° Siniestro
                    row.tipo,
                    row.categoria,
                    row.codigo,
                    row.desc,
                    row.cantidad,
                    row.unit,
                    row.total,
                    row.origen,
                    // En la primera fila ponemos los subtotales, en las demás vacío
                    idx === 0 ? totalHonor : '',
                    idx === 0 ? totalGasto : '',
                    idx === 0 ? totalSiniestro : ''
                ];
                rows.push(rowData);
                globalCdU++;
            });

            // Fila en blanco después de cada siniestro, excepto el último
            if (index < selected.length - 1) {
                rows.push(Array(headers.length).fill('')); // Fila vacía
                // No incrementamos CdU
            }
        });

        // Agregar fila de totales generales al final
        // Calculamos sumas totales sobre todos los siniestros
        let totalHonorGeneral = 0;
        let totalGastoGeneral = 0;
        let totalGeneral = 0;

        selected.forEach(id => {
            const item = data[id];
            if (!item) return;
            // Podríamos recalcular, pero para simplificar usamos los totales ya guardados en item si existen
            // O podemos volver a calcular como antes:
            let honor = 0, gasto = 0;
            // Función simple para sumar
            const sumItems = (arr, field) => {
                if (!arr) return 0;
                return arr.reduce((acc, x) => acc + safeNum(x[field]), 0);
            };
            honor += sumItems(item.practicas, 'honorarioMedico');
            honor += sumItems(item.cirugias, 'honorarioMedico');
            honor += sumItems(item.laboratorios, 'honorarioMedico');
            gasto += sumItems(item.practicas, 'gastoSanatorial');
            gasto += sumItems(item.cirugias, 'gastoSanatorial');
            gasto += sumItems(item.laboratorios, 'gastoSanatorial');
            gasto += sumItems(item.medicamentos, 'gastoSanatorial');
            gasto += sumItems(item.medicamentos, 'total'); // por si acaso
            gasto += sumItems(item.descartables, 'gastoSanatorial');
            gasto += sumItems(item.descartables, 'total');

            totalHonorGeneral += honor;
            totalGastoGeneral += gasto;
            totalGeneral += honor + gasto;
        });

        // Fila de totales generales (sin CdU)
        const totalRow = [
            '', '', '', '', // vacío hasta Tipo
            'TOTALES GENERALES', '', '', '', '', '', '', '',
            totalHonorGeneral, totalGastoGeneral, totalGeneral
        ];
        rows.push(totalRow);

        // Crear libro de Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet(rows);

        // Ajustar ancho de columnas opcionalmente (opcional)
        const colWidths = [
            { wch: 6 },  // CdU
            { wch: 25 }, // Nombre completo
            { wch: 12 }, // DNI
            { wch: 15 }, // N° Siniestro
            { wch: 10 }, // Tipo
            { wch: 15 }, // Categoría
            { wch: 12 }, // Código
            { wch: 50 }, // Descripción
            { wch: 8 },  // Cantidad
            { wch: 12 }, // Valor unitario
            { wch: 12 }, // Total línea
            { wch: 25 }, // Origen
            { wch: 15 }, // Subtotal Honorarios
            { wch: 15 }, // Subtotal Gastos
            { wch: 15 }  // Total Siniestro
        ];
        ws['!cols'] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, 'Siniestros');
        XLSX.writeFile(wb, 'siniestros_seleccionados.xlsx');
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>✅ Cerrados</h1>
                        <p className={styles.subtitle}>Seleccione y exporte a Excel.</p>
                    </div>

                    <div className={styles.headerActions}>
                        <Link href="/admin/Facturacion" className={styles.btnGhost}>
                            ← Volver
                        </Link>
                        <button
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={exportToExcel}
                            disabled={selectedIds.size === 0}
                        >
                            ⬇️ Exportar seleccionados a Excel
                        </button>
                    </div>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.filters}>
                        <select className={styles.select} value={art} onChange={(e) => setArt(e.target.value)}>
                            <option value="">Todas las ART</option>
                            {arts.map((a) => (
                                <option key={a.key} value={a.key}>
                                    {a.name}
                                </option>
                            ))}
                        </select>

                        <input
                            className={styles.input}
                            placeholder="Buscar por paciente / DNI / siniestro…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />

                        <label className={styles.checkboxAll}>
                            <input
                                type="checkbox"
                                checked={isAllSelected}
                                onChange={toggleSelectAll}
                            />
                            <span>Seleccionar todos</span>
                        </label>
                    </div>
                </div>
            </header>

            <main className={styles.content}>
                {loading ? (
                    <div className={styles.empty}>Cargando…</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>No hay cerrados.</div>
                ) : (
                    <div className={styles.list}>
                        {filtered.map((it) => (
                            <div key={it.id} className={styles.rowCard}>
                                <div className={styles.rowTop}>
                                    <div className={styles.checkbox}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.has(it.id)}
                                            onChange={() => toggleSelect(it.id)}
                                        />
                                    </div>
                                    <div className={styles.rowTitle}>{it.pacienteNombre || 'Sin nombre'}</div>
                                    <div className={styles.meta}>
                                        <span className={styles.pill}>DNI: {it.dni || '—'}</span>
                                        <span className={styles.pill}>Siniestro: {it.nroSiniestro || '—'}</span>
                                        <span className={styles.pill}>{it.artNombre || 'SIN ART'}</span>
                                        <span className={styles.pill}>Total: $ {money(it.total || 0)}</span>
                                    </div>
                                </div>

                                <div className={styles.actions}>
                                    <Link className={`${styles.btn} ${styles.btnInfo}`} href={`/admin/Facturacion/Facturados/${it.id}`}>
                                        👁 Ver detalle
                                    </Link>
                                    <button className={`${styles.btn} ${styles.btnGhostSmall}`} disabled title="Próximo paso: PDF/Excel">
                                        ⬇️ Descargar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
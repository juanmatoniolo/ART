'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, parseNumber } from '../../utils/calculos';
import styles from './page.module.css';
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

const fmtDate = (ms) => {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString('es-AR');
  } catch {
    return '—';
  }
};

export default function CerradosPage() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [art, setArt] = useState('');
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
        v?.paciente?.nombreCompleto ||
        v?.pacienteNombre ||
        v?.paciente?.nombre ||
        v?.nombrePaciente ||
        '';
      const dni = v?.paciente?.dni || v?.dni || '';
      const nroSiniestro = v?.paciente?.nroSiniestro || v?.nroSiniestro || '';
      const artNombre = v?.paciente?.artSeguro || v?.artNombre || v?.artSeguro || 'SIN ART';
      const artKey = v?.artKey || normalizeKey(artNombre);

      const cerradoAt = v?.cerradoAt || v?.closedAt || 0;
      const estado = v?.estado || (cerradoAt ? 'cerrado' : 'borrador');

      const total =
        v?.totales?.total ??
        v?.total ??
        (Number(v?.totales?.honorarios || 0) + Number(v?.totales?.gastos || 0)) ??
        0;

      return {
        id,
        pacienteNombre,
        dni,
        nroSiniestro,
        artNombre,
        artKey,
        estado,
        closedAt: cerradoAt,
        total,
      };
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

  const exportToExcel = () => {
    const selected = Array.from(selectedIds);
    if (selected.length === 0) {
      alert('Seleccione al menos un siniestro.');
      return;
    }

    const headers = [
      'CdU', 'Nombre completo', 'DNI', 'N° Siniestro',
      'Tipo', 'Categoría', 'Código', 'Descripción',
      'Cantidad', 'Valor unitario', 'Total línea', 'Origen',
      'Subtotal Honorarios', 'Subtotal Gastos', 'Total Siniestro'
    ];
    const rows = [headers];

    let globalCdU = 1;

    selected.forEach((id, index) => {
      const item = data[id];
      if (!item) return;

      const paciente = item.paciente || {};
      const nombre = paciente.nombreCompleto || paciente.nombre || '';
      const dni = paciente.dni || '';
      const nroSiniestro = paciente.nroSiniestro || '';

      const honorRows = [];
      const gastoRows = [];

      const processItem = (x, categoria) => {
        const honorario = safeNum(x?.honorarioMedico);
        const gasto = safeNum(x?.gastoSanatorial);
        const cantidad = safeNum(x?.cantidad ?? x?.unidades ?? 1) || 1;
        const totalItem = safeNum(x?.total);
        const unit = cantidad > 0 ? totalItem / cantidad : 0;

        const desc = x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '';
        const codigo = x?.codigo || x?.code || x?.cod || '';
        let origen = x?.doctorNombre || x?.doctor || x?.medico || x?.prestadorNombre || x?.prestador || '';

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

      (item.practicas || []).forEach(p => processItem(p, 'Práctica'));
      (item.cirugias || []).forEach(c => processItem(c, 'Cirugía'));
      (item.laboratorios || []).forEach(l => processItem(l, 'Laboratorio'));

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

      const totalHonor = honorRows.reduce((acc, r) => acc + r.total, 0);
      const totalGasto = gastoRows.reduce((acc, r) => acc + r.total, 0);
      const totalSiniestro = totalHonor + totalGasto;

      const allRows = [...honorRows, ...gastoRows];
      if (allRows.length === 0) return;

      allRows.forEach((row, idx) => {
        const rowData = [
          globalCdU,
          idx === 0 ? nombre : '',
          idx === 0 ? dni : '',
          idx === 0 ? nroSiniestro : '',
          row.tipo,
          row.categoria,
          row.codigo,
          row.desc,
          row.cantidad,
          row.unit,
          row.total,
          row.origen,
          idx === 0 ? totalHonor : '',
          idx === 0 ? totalGasto : '',
          idx === 0 ? totalSiniestro : ''
        ];
        rows.push(rowData);
        globalCdU++;
      });

      if (index < selected.length - 1) {
        rows.push(Array(headers.length).fill(''));
      }
    });

    let totalHonorGeneral = 0;
    let totalGastoGeneral = 0;
    let totalGeneral = 0;

    selected.forEach(id => {
      const item = data[id];
      if (!item) return;
      let honor = 0, gasto = 0;
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
      gasto += sumItems(item.medicamentos, 'total');
      gasto += sumItems(item.descartables, 'gastoSanatorial');
      gasto += sumItems(item.descartables, 'total');

      totalHonorGeneral += honor;
      totalGastoGeneral += gasto;
      totalGeneral += honor + gasto;
    });

    const totalRow = [
      '', '', '', '',
      'TOTALES GENERALES', '', '', '', '', '', '', '',
      totalHonorGeneral, totalGastoGeneral, totalGeneral
    ];
    rows.push(totalRow);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

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

  // Función para imprimir reporte ART (laboratorios, medicamentos, descartables)
 // Función para imprimir reporte ART (laboratorios, medicamentos, descartables) optimizada para una página
const printART = (id) => {
  const item = data[id];
  if (!item) return;

  const paciente = item.paciente || {};
  const nombre = paciente.nombreCompleto || paciente.nombre || '';
  const dni = paciente.dni || '';
  const nroSiniestro = paciente.nroSiniestro || '';
  const artNombre = item.artNombre || paciente.artSeguro || 'SIN ART';

  // Función para generar filas de tabla
  const generarFilas = (items, campos) => {
    return items.map(it => {
      return `<tr>${campos.map(c => {
        let valor = it[c.field];
        if (c.format === 'money') valor = `$ ${money(valor)}`;
        else if (c.format === 'number') valor = valor || 0;
        else valor = valor || '—';
        return `<td>${valor}</td>`;
      }).join('')}</tr>`;
    }).join('');
  };

  // Calcular totales por categoría
  const totalLab = (item.laboratorios || []).reduce((acc, it) => acc + safeNum(it.total), 0);
  const totalMed = (item.medicamentos || []).reduce((acc, it) => acc + safeNum(it.total), 0);
  const totalDesc = (item.descartables || []).reduce((acc, it) => acc + safeNum(it.total), 0);
  const totalGeneral = totalLab + totalMed + totalDesc;

  // Definir campos para cada tipo
  const camposLab = [
    { label: 'Código', field: 'codigo' },
    { label: 'Descripción', field: 'descripcion' },
    { label: 'Cantidad', field: 'cantidad', format: 'number' },
    { label: 'V. Unitario', field: 'valorUnitario', format: 'money' }, // Abreviado
    { label: 'Total', field: 'total', format: 'money' },
    { label: 'Bioquímico', field: 'prestadorNombre' }
  ];

  const camposMedDesc = [
    { label: 'Descripción', field: 'nombre' },
    { label: 'Presentación', field: 'presentacion' },
    { label: 'Cantidad', field: 'cantidad', format: 'number' },
    { label: 'V. Unitario', field: 'valorUnitario', format: 'money' }, // Abreviado
    { label: 'Total', field: 'total', format: 'money' }
  ];

  // Construir HTML con estilos optimizados para impresión
  let html = `
    <html>
      <head>
        <title>ART - ${artNombre} - ${nroSiniestro}</title>
        <style>
          /* Reset y estilos base */
          * {
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            font-size: 11px; /* Reducido para ahorrar espacio */
            line-height: 1.3;
            margin: 10px; /* Márgenes más pequeños */
            padding: 0;
            position: relative;
            min-height: auto;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-25deg);
            opacity: 0.08; /* Un poco más tenue */
            z-index: -1;
            pointer-events: none;
          }
          .watermark img {
            width: 350px; /* Ligeramente más pequeño */
            height: auto;
          }
          h1 {
            color: #333;
            font-size: 18px; /* Reducido */
            margin: 0 0 8px 0;
            font-weight: bold;
          }
          .header-info {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            background: #f5f5f5;
            padding: 6px 10px;
            border-radius: 6px;
            margin-bottom: 12px;
            font-size: 11px;
          }
          .header-info p {
            margin: 0;
          }
          h2 {
            color: #555;
            font-size: 14px;
            margin: 12px 0 6px 0;
            padding-bottom: 2px;
            border-bottom: 1px solid #ccc;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 8px;
            font-size: 10px; /* Tabla más compacta */
          }
          th {
            background: #e0e0e0;
            text-align: left;
            padding: 4px 6px;
            border: 1px solid #ccc;
            font-weight: 600;
          }
          td {
            padding: 3px 6px;
            border: 1px solid #ccc;
          }
          .subtotal {
            font-weight: bold;
            text-align: right;
            margin: 2px 0 8px 0;
            padding-right: 6px;
            font-size: 11px;
          }
          .totales {
            margin-top: 16px;
            border-top: 1.5px solid #333;
            padding-top: 8px;
          }
          .totals-summary p {
            margin: 3px 0;
            font-weight: bold;
            font-size: 11px;
            text-align: right;
          }
          .total-general {
            font-size: 13px;
            color: #000;
            margin-top: 5px;
          }
          .footer-section {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
            border-top: 1px solid #aaa;
            padding-top: 12px;
          }
          .signature-area {
            text-align: center;
            flex: 1;
          }
          .signature-line {
            font-size: 16px;
            letter-spacing: 2px;
            margin-bottom: 2px;
            color: #333;
          }
          .signature-label {
            font-size: 9px;
            color: #555;
          }
          .clinic-logo {
            text-align: center;
            flex: 1;
          }
          .clinic-logo img {
            max-width: 70px; /* Logo más pequeño */
            height: auto;
            margin-bottom: 2px;
          }
          .clinic-info {
            font-size: 8px;
            color: #666;
            line-height: 1.2;
          }
          /* Evitar saltos de página dentro de tablas y elementos importantes */
          @media print {
            body { margin: 0.2in; }
            h2, table, .subtotal, .totales, .footer-section {
              page-break-inside: avoid;
            }
            .watermark img {
              opacity: 0.07;
            }
          }
        </style>
      </head>
      <body>
        <div class="watermark">
          <img src="/logo.jpg" alt="Clínica de la Unión">
        </div>
        <h1>Reporte para ART</h1>
        <div class="header-info">
          <p><strong>ART:</strong> ${artNombre}</p>
          <p><strong>Paciente:</strong> ${nombre}</p>
          <p><strong>DNI:</strong> ${dni}</p>
          <p><strong>N° Siniestro:</strong> ${nroSiniestro}</p>
        </div>
  `;

  // Laboratorios
  if (item.laboratorios && item.laboratorios.length > 0) {
    html += `<h2>Laboratorios</h2>`;
    html += `<table><thead><tr>${camposLab.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
    html += `<tbody>${generarFilas(item.laboratorios, camposLab)}</tbody>`;
    html += `</table>`;
    html += `<div class="subtotal">Subtotal Laboratorios: $ ${money(totalLab)}</div>`;
  }

  // Medicamentos
  if (item.medicamentos && item.medicamentos.length > 0) {
    html += `<h2>Medicamentos</h2>`;
    html += `<table><thead><tr>${camposMedDesc.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
    html += `<tbody>${generarFilas(item.medicamentos, camposMedDesc)}</tbody>`;
    html += `</table>`;
    html += `<div class="subtotal">Subtotal Medicamentos: $ ${money(totalMed)}</div>`;
  }

  // Descartables
  if (item.descartables && item.descartables.length > 0) {
    html += `<h2>Descartables</h2>`;
    html += `<table><thead><tr>${camposMedDesc.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
    html += `<tbody>${generarFilas(item.descartables, camposMedDesc)}</tbody>`;
    html += `</table>`;
    html += `<div class="subtotal">Subtotal Descartables: $ ${money(totalDesc)}</div>`;
  }

  // Totales y pie de página
  html += `
      <div class="totales">
        <div class="totals-summary">
          <p>Total Laboratorios: $ ${money(totalLab)}</p>
          <p>Total Medicamentos: $ ${money(totalMed)}</p>
          <p>Total Descartables: $ ${money(totalDesc)}</p>
          <p class="total-general"><strong>TOTAL GENERAL: $ ${money(totalGeneral)}</strong></p>
        </div>

        <div class="footer-section">
          <div class="signature-area">
            <div class="signature-line">_________________________</div>
            <div class="signature-label">Firma y sello del responsable</div>
          </div>
          <div class="clinic-logo">
            <img src="/logo.jpg" alt="Clínica de la Unión">
            <div class="clinic-info">
              Clínica de la Unión S.A.<br>
              Chajarí, Entre Ríos - Av. Siburu 1085
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Cerrados</h1>
            <p className={styles.subtitle}>Seleccione y exporte a Excel.</p>
          </div>

          <div className={styles.headerActions}>
            <Link href="/admin/Facturacion/Facturados" className={styles.btnGhost}>
              ← Volver
            </Link>
            <button
              className={styles.btnPrimary}
              onClick={exportToExcel}
              disabled={selectedIds.size === 0}
            >
              ⬇️ Exportar seleccionados
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
              placeholder="Buscar paciente, DNI, siniestro..."
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
          <div className={styles.grid}>
            {filtered.map((it) => (
              <article key={it.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.checkboxInline}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(it.id)}
                      onChange={() => toggleSelect(it.id)}
                    />
                  </div>
                  <div className={styles.state}>
                    <span className={`${styles.badge} ${styles.badgeOk}`}>CERRADO</span>
                    <span className={styles.date}>📅 {fmtDate(it.closedAt)}</span>
                  </div>
                  <div className={styles.total}>
                    <span className={styles.totalLabel}>TOTAL</span>
                    <span className={styles.totalValue}>$ {money(it.total || 0)}</span>
                  </div>
                </div>

                <div className={styles.mainInfo}>
                  <div className={styles.name}>{it.pacienteNombre || 'Sin nombre'}</div>

                  <div className={styles.metaRow}>
                    <span className={styles.pill}>DNI: {it.dni || '—'}</span>
                    <span className={styles.pill}>Siniestro: {it.nroSiniestro || '—'}</span>
                    <span className={styles.pill}>{it.artNombre || 'SIN ART'}</span>
                  </div>

                  <div className={styles.actions}>
                    <Link className={`${styles.btn} ${styles.btnInfo}`} href={`/admin/Facturacion/Facturados/${it.id}`}>
                      👁 Ver
                    </Link>
                    <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/admin/Facturacion/Nuevo?draft=${it.id}`}>
                      ✏️ Editar
                    </Link>
                    <button className={`${styles.btn} ${styles.btnArt}`} onClick={() => printART(it.id)}>
                      🖨️ ART
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
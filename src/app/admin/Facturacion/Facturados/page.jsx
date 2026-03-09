'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ref, onValue, remove, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, parseNumber } from '../utils/calculos';
import styles from './facturados.module.css';
import * as XLSX from 'xlsx';

// Funciones auxiliares
const normalizeKey = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const prettyLabel = (s) =>
  String(s ?? '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

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

export default function FacturadosPage() {
  const sp = useSearchParams();
  const router = useRouter();

  const [raw, setRaw] = useState({});
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('todos');
  const [art, setArt] = useState('');
  const [orden, setOrden] = useState('fecha_desc');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [deleting, setDeleting] = useState(false);

  // Sincronizar estado desde URL
  useEffect(() => {
    const e = sp.get('estado');
    if (e === 'cerrado' || e === 'borrador' || e === 'todos') {
      setEstado(e);
    }
  }, [sp]);

  // Cargar datos desde Firebase
  useEffect(() => {
    const r = ref(db, 'Facturacion');
    return onValue(
      r,
      (snap) => {
        setRaw(snap.exists() ? snap.val() : {});
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setRaw({});
        setLoading(false);
      }
    );
  }, []);

  // Procesar items
  const items = useMemo(() => {
    const obj = raw || {};
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

      const estadoVal = v?.estado || (v?.cerradoAt ? 'cerrado' : 'borrador');
      const createdAt = v?.createdAt || 0;
      const closedAt = v?.cerradoAt || v?.closedAt || 0;
      const updatedAt = v?.updatedAt || 0;

      const total =
        v?.totales?.total ??
        v?.total ??
        (Number(v?.totales?.honorarios || 0) + Number(v?.totales?.gastos || 0)) ??
        0;

      const convenioNombre = v?.convenioNombre || v?.convenio || '—';
      const facturaNro = v?.facturaNro || '';

      return {
        id,
        estado: estadoVal,
        createdAt,
        closedAt,
        updatedAt,
        pacienteNombre,
        dni,
        nroSiniestro,
        artNombre,
        artKey,
        convenioNombre,
        facturaNro,
        total,
        fecha: estadoVal === 'cerrado' ? (closedAt || createdAt) : (updatedAt || createdAt),
      };
    });

    // Ordenar
    arr.sort((a, b) => {
      let aVal, bVal;
      switch (orden) {
        case 'fecha_asc':
          return (a.fecha || 0) - (b.fecha || 0);
        case 'nombre_asc':
          return (a.pacienteNombre || '').localeCompare(b.pacienteNombre || '');
        case 'nombre_desc':
          return (b.pacienteNombre || '').localeCompare(a.pacienteNombre || '');
        case 'total_asc':
          return (a.total || 0) - (b.total || 0);
        case 'total_desc':
          return (b.total || 0) - (a.total || 0);
        case 'estado_cerrado':
          if (a.estado !== b.estado) {
            return a.estado === 'cerrado' ? -1 : 1;
          }
          return (b.fecha || 0) - (a.fecha || 0);
        case 'estado_borrador':
          if (a.estado !== b.estado) {
            return a.estado === 'borrador' ? -1 : 1;
          }
          return (b.fecha || 0) - (a.fecha || 0);
        case 'fecha_desc':
        default:
          return (b.fecha || 0) - (a.fecha || 0);
      }
    });

    return arr;
  }, [raw, orden]);

  // Contadores
  const counts = useMemo(() => {
    let cerrados = 0, borradores = 0;
    items.forEach((it) => {
      if (it.estado === 'cerrado') cerrados++;
      else borradores++;
    });
    return { cerrados, borradores, total: items.length };
  }, [items]);

  // Lista de ART para filtro
  const arts = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = it.artKey || normalizeKey(it.artNombre || '');
      const name = it.artNombre || 'SIN ART';
      if (!map.has(key)) map.set(key, name);
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => prettyLabel(a.name).localeCompare(prettyLabel(b.name)));
  }, [items]);

  // Filtrado
  const filtered = useMemo(() => {
    const qq = norm(q);
    return items.filter((it) => {
      if (estado !== 'todos' && it.estado !== estado) return false;
      if (art && (it.artKey || '') !== art) return false;
      if (!qq) return true;

      const blob = norm(
        `${it.pacienteNombre || ''} ${it.dni || ''} ${it.nroSiniestro || ''} ${it.artNombre || ''} ${it.convenioNombre || ''} ${it.facturaNro || ''}`
      );
      return blob.includes(qq);
    });
  }, [items, q, estado, art]);

  // Handlers de selección
  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(it => it.id)));
    }
  };

  const setEstadoQuery = (next) => {
    const params = new URLSearchParams(sp.toString());
    if (!next || next === 'todos') params.delete('estado');
    else params.set('estado', next);
    router.push(`/admin/Facturacion/Facturados?${params.toString()}`);
    setEstado(next || 'todos');
  };

  // Exportar Excel completo (para los seleccionados)
  const exportToExcel = () => {
    const selected = Array.from(selectedIds);
    if (selected.length === 0) {
      alert('Seleccione al menos un siniestro.');
      return;
    }

    const headers = [
      'CdU', 'Estado', 'Nombre completo', 'DNI', 'N° Siniestro',
      'Tipo', 'Categoría', 'Código', 'Descripción',
      'Cantidad', 'Valor unitario', 'Total línea', 'Origen',
      'Subtotal Honorarios', 'Subtotal Gastos', 'Total Siniestro'
    ];
    const rows = [headers];

    let globalCdU = 1;

    selected.forEach((id, index) => {
      const item = raw[id];
      if (!item) return;

      const paciente = item.paciente || {};
      const nombre = paciente.nombreCompleto || paciente.nombre || '';
      const dni = paciente.dni || '';
      const nroSiniestro = paciente.nroSiniestro || '';
      const estadoItem = item.estado || (item.cerradoAt ? 'cerrado' : 'borrador');

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

      // Prácticas
      (item.practicas || []).forEach(p => processItem(p, 'Práctica'));
      // Cirugías
      (item.cirugias || []).forEach(c => processItem(c, 'Cirugía'));
      // Laboratorios
      (item.laboratorios || []).forEach(l => processItem(l, 'Laboratorio'));
      // Medicamentos
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
      // Descartables
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
          idx === 0 ? estadoItem : '',
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

    // Totales generales
    let totalHonorGeneral = 0, totalGastoGeneral = 0, totalGeneral = 0;
    selected.forEach(id => {
      const item = raw[id];
      if (!item) return;
      const sumItems = (arr, field) => {
        if (!arr) return 0;
        return arr.reduce((acc, x) => acc + safeNum(x[field]), 0);
      };
      let honor = 0, gasto = 0;
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

    const totalRow = Array(headers.length).fill('');
    totalRow[1] = 'TOTALES GENERALES';
    totalRow[13] = totalHonorGeneral;
    totalRow[14] = totalGastoGeneral;
    totalRow[15] = totalGeneral;
    rows.push(totalRow);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);

    const colWidths = [
      { wch: 6 },  // CdU
      { wch: 10 }, // Estado
      { wch: 25 }, // Nombre
      { wch: 12 }, // DNI
      { wch: 15 }, // N° Siniestro
      { wch: 10 }, // Tipo
      { wch: 15 }, // Categoría
      { wch: 12 }, // Código
      { wch: 50 }, // Descripción
      { wch: 8 },  // Cantidad
      { wch: 12 }, // Valor unit.
      { wch: 12 }, // Total línea
      { wch: 25 }, // Origen
      { wch: 15 }, // Subtotal Honorarios
      { wch: 15 }, // Subtotal Gastos
      { wch: 15 }  // Total Siniestro
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Siniestros');
    XLSX.writeFile(wb, `facturados_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ================= NUEVA FUNCIÓN PARA IMPRIMIR ART =================
// ================= FUNCIÓN PARA IMPRIMIR ART (OPTIMIZADA PARA UNA SOLA PÁGINA) =================
const printART = (id) => {
  const item = raw[id];
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
    { label: 'Cant.', field: 'cantidad', format: 'number' },
    { label: 'V. Unit.', field: 'valorUnitario', format: 'money' },
    { label: 'Total', field: 'total', format: 'money' },
    { label: 'Bioq.', field: 'prestadorNombre' }
  ];

  const camposMedDesc = [
    { label: 'Descripción', field: 'nombre' },
    { label: 'Presentación', field: 'presentacion' },
    { label: 'Cant.', field: 'cantidad', format: 'number' },
    { label: 'V. Unit.', field: 'valorUnitario', format: 'money' },
    { label: 'Total', field: 'total', format: 'money' }
  ];

  // Construir HTML con estilos compactos
  let html = `
    <html>
      <head>
        <title>ART - ${artNombre} - ${nroSiniestro}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 10mm;
            position: relative;
            min-height: auto;
            font-size: 11px;
            line-height: 1.3;
          }
          .watermark {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%) rotate(-25deg);
            opacity: 0.3;
            z-index: -1;
            pointer-events: none;
          }
          .watermark img {
            width: 300px;
            height: auto;
          }
          h1 {
            color: #333;
            font-size: 18px;
            margin: 0 0 8px 0;
            padding: 0;
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
            padding: 0;
            border-bottom: 1px solid #ccc;
          }
          table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 8px;
            font-size: 10px;
            page-break-inside: avoid;
          }
          th {
            background: #e0e0e0;
            text-align: left;
            padding: 4px;
            border: 1px solid #ccc;
            font-weight: bold;
          }
          td {
            padding: 3px 4px;
            border: 1px solid #ccc;
          }
          .subtotal {
            font-weight: bold;
            text-align: right;
            margin: 2px 0 6px 0;
            padding-right: 4px;
            font-size: 11px;
          }
          .totales {
            margin-top: 15px;
            border-top: 1px solid #333;
            padding-top: 8px;
            page-break-inside: avoid;
          }
          .totals-summary p {
            margin: 3px 0;
            font-weight: bold;
            font-size: 11px;
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
            margin-top: 15px;
            border-top: 1px solid #aaa;
            padding-top: 10px;
            page-break-inside: avoid;
          }
          .signature-area {
            text-align: center;
            flex: 1;
          }
          .signature-line {
            font-size: 14px;
            letter-spacing: 1px;
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
            max-width: 70px;
            height: auto;
            margin-bottom: 2px;
          }
          .clinic-info {
            font-size: 8px;
            color: #666;
            line-height: 1.2;
          }
          /* Evitar saltos de página dentro de elementos importantes */
          h2, table, .subtotal, .totales, .footer-section {
            page-break-inside: avoid;
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
    html += `<div class="subtotal">Subtotal Lab: $ ${money(totalLab)}</div>`;
  }

  // Medicamentos
  if (item.medicamentos && item.medicamentos.length > 0) {
    html += `<h2>Medicamentos</h2>`;
    html += `<table><thead><tr>${camposMedDesc.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
    html += `<tbody>${generarFilas(item.medicamentos, camposMedDesc)}</tbody>`;
    html += `</table>`;
    html += `<div class="subtotal">Subtotal Med: $ ${money(totalMed)}</div>`;
  }

  // Descartables
  if (item.descartables && item.descartables.length > 0) {
    html += `<h2>Descartables</h2>`;
    html += `<table><thead><tr>${camposMedDesc.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
    html += `<tbody>${generarFilas(item.descartables, camposMedDesc)}</tbody>`;
    html += `</table>`;
    html += `<div class="subtotal">Subtotal Desc: $ ${money(totalDesc)}</div>`;
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

  // Abrir ventana de impresión
  const printWindow = window.open('', '_blank');
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
};
  // ================= FIN DE LA NUEVA FUNCIÓN =================

  // Eliminar múltiples siniestros
  const deleteSelected = async () => {
    if (selectedIds.size === 0) {
      alert('Seleccione al menos un siniestro.');
      return;
    }
    const total = selectedIds.size;
    const confirmMsg = `¿Está seguro de eliminar ${total} siniestro(s)? Esta acción no se puede deshacer.`;
    if (!window.confirm(confirmMsg)) return;

    setDeleting(true);
    let successCount = 0;
    let errorCount = 0;

    try {
      const deletePromises = Array.from(selectedIds).map(async (id) => {
        try {
          const snap = await get(ref(db, `Facturacion/${id}`));
          if (snap.exists()) {
            const item = snap.val();
            if (item?.siniestroKey) {
              await remove(ref(db, `Facturacion/siniestros/${item.siniestroKey}`));
            }
            await remove(ref(db, `Facturacion/${id}`));
            successCount++;
          } else {
            errorCount++;
          }
        } catch (err) {
          console.error(`Error eliminando ${id}:`, err);
          errorCount++;
        }
      });

      await Promise.all(deletePromises);

      alert(`Eliminación completada: ${successCount} exitosos, ${errorCount} fallidos.`);
      setSelectedIds(new Set()); // Limpiar selección
    } catch (error) {
      console.error(error);
      alert('Error en la eliminación: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>📋 Siniestros</h1>
            <p className={styles.subtitle}>Seleccioná, editá o exportá plantillas para ART</p>
          </div>

          <div className={styles.headerActions}>
            <Link href="/admin/Facturacion" className={styles.btnGhost}>← Volver</Link>
            <Link href="/admin/Facturacion/Nuevo" className={styles.btnPrimary}>➕ Nueva factura</Link>
            <button
              className={styles.btnPrimary}
              onClick={exportToExcel}
              disabled={selectedIds.size === 0}
            >
              ⬇️ Exportar seleccionados
            </button>
            <button
              className={styles.btnDanger}
              onClick={deleteSelected}
              disabled={selectedIds.size === 0 || deleting}
            >
              {deleting ? 'Eliminando...' : '🗑️ Eliminar seleccionados'}
            </button>
          </div>
        </div>

        <div className={styles.quickSwitch}>
          <button
            className={`${styles.switchBtn} ${estado === 'borrador' ? styles.switchBtnActive : ''}`}
            onClick={() => setEstadoQuery('borrador')}
          >📝 Borradores ({counts.borradores})</button>
          <button
            className={`${styles.switchBtn} ${estado === 'cerrado' ? styles.switchBtnActive : ''}`}
            onClick={() => setEstadoQuery('cerrado')}
          >✅ Facturados ({counts.cerrados})</button>
          <button
            className={`${styles.switchBtn} ${estado === 'todos' ? styles.switchBtnActive : ''}`}
            onClick={() => setEstadoQuery('todos')}
          >📄 Todos ({counts.total})</button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.searchBlock}>
            <input
              className={styles.search}
              placeholder="Buscar paciente, DNI, siniestro, ART..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <select className={styles.select} value={estado} onChange={(e) => setEstadoQuery(e.target.value)}>
              <option value="todos">Todos</option>
              <option value="cerrado">Cerrados</option>
              <option value="borrador">Borradores</option>
            </select>

            <select className={styles.select} value={art} onChange={(e) => setArt(e.target.value)}>
              <option value="">Todas las ART</option>
              {arts.map(a => (
                <option key={a.key} value={a.key}>{prettyLabel(a.name)}</option>
              ))}
            </select>

            <select className={styles.select} value={orden} onChange={(e) => setOrden(e.target.value)}>
              <option value="fecha_desc">Fecha ↓ (reciente)</option>
              <option value="fecha_asc">Fecha ↑ (antiguo)</option>
              <option value="nombre_asc">Nombre ↑ (A-Z)</option>
              <option value="nombre_desc">Nombre ↓ (Z-A)</option>
              <option value="total_desc">Total ↓ (mayor)</option>
              <option value="total_asc">Total ↑ (menor)</option>
              <option value="estado_cerrado">Primero cerrados</option>
              <option value="estado_borrador">Primero borradores</option>
            </select>

            <label className={styles.checkboxAll}>
              <input
                type="checkbox"
                checked={selectedIds.size === filtered.length && filtered.length > 0}
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
          <div className={styles.empty}>No hay resultados con esos filtros.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map(it => {
              const isClosed = it.estado === 'cerrado';
              return (
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
                      <span className={`${styles.badge} ${isClosed ? styles.badgeOk : styles.badgeDraft}`}>
                        {isClosed ? 'CERRADO' : 'BORRADOR'}
                      </span>
                      <div className={styles.date}>📅 {fmtDate(it.fecha)}</div>
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
                      <span className={styles.pill}>{prettyLabel(it.artNombre || 'SIN ART')}</span>
                    </div>

                    {isClosed ? (
                      <div className={styles.facturaLine}>🧾 Factura: {it.facturaNro || '—'}</div>
                    ) : (
                      <div className={styles.facturaLineMuted}>📝 Pendiente de cierre</div>
                    )}

                    <div className={styles.actions}>
                      <Link className={styles.btn} href={`/admin/Facturacion/Facturados/${it.id}`}>
                        👁 Ver
                      </Link>
                      <Link className={styles.btn} href={`/admin/Facturacion/Nuevo?draft=${it.id}`}>
                        ✏️ Editar
                      </Link>
                      <button className={styles.btnArt} onClick={() => printART(it.id)}>
                        🖨️ ART
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
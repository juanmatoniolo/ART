// src/app/admin/Facturacion/Facturados/hooks/useFacturados.js

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { ref, onValue, remove, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import * as XLSX from 'xlsx';
import {
  money,
  parseNumber,
  normalizeKey,
  prettyLabel,
  norm,
  fmtDate,
  safeNum
} from '../../utils/calculos';

export default function useFacturados() {
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

  // 👇 NUEVOS ESTADOS PARA FILTRO DE FECHAS
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

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

  // Procesar items (mapeo y ordenamiento)
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

    // Convertir fechas a timestamps (si están definidas)
    const desdeTs = fechaDesde ? new Date(fechaDesde).setHours(0, 0, 0, 0) : null;
    const hastaTs = fechaHasta ? new Date(fechaHasta).setHours(23, 59, 59, 999) : null;

    return items.filter((it) => {
      if (estado !== 'todos' && it.estado !== estado) return false;
      if (art && (it.artKey || '') !== art) return false;
      if (qq) {
        const blob = norm(
          `${it.pacienteNombre || ''} ${it.dni || ''} ${it.nroSiniestro || ''} ${it.artNombre || ''} ${it.convenioNombre || ''} ${it.facturaNro || ''}`
        );
        if (!blob.includes(qq)) return false;
      }

      // 👇 NUEVO FILTRO POR RANGO DE FECHAS
      const fechaItem = it.fecha; // timestamp
      if (desdeTs !== null && fechaItem < desdeTs) return false;
      if (hastaTs !== null && fechaItem > hastaTs) return false;

      return true;
    });
  }, [items, q, estado, art, fechaDesde, fechaHasta]);

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
      setSelectedIds(new Set());
    } catch (error) {
      console.error(error);
      alert('Error en la eliminación: ' + error.message);
    } finally {
      setDeleting(false);
    }
  };

  // Exportar Excel completo
  const exportCompleto = () => {
    const selected = Array.from(selectedIds);
    if (selected.length === 0) {
      alert('Seleccione al menos un siniestro.');
      return;
    }

    const wb = XLSX.utils.book_new();

    // --- HOJA 1: CARÁTULA (resumen) ---
    const caratulaHeaders = ['PRESTADOR', 'PACIENTE', 'DNI', 'STRO', 'GASTOS', 'HONORARIOS', 'TOTAL'];
    const caratulaRows = [caratulaHeaders];

    selected.forEach(id => {
      const item = raw[id];
      if (!item) return;

      const paciente = item.paciente || {};
      const nombre = paciente.nombreCompleto || paciente.nombre || '';
      const dni = paciente.dni || '';
      const nroSiniestro = paciente.nroSiniestro || '';

      // Calcular gastos y honorarios
      const sumItems = (arr, field) => {
        if (!arr) return 0;
        return arr.reduce((acc, x) => acc + safeNum(x[field]), 0);
      };

      let gastos = 0;
      let honorarios = 0;

      gastos += sumItems(item.practicas, 'gastoSanatorial');
      honorarios += sumItems(item.practicas, 'honorarioMedico');
      gastos += sumItems(item.cirugias, 'gastoSanatorial');
      honorarios += sumItems(item.cirugias, 'honorarioMedico');
      gastos += sumItems(item.laboratorios, 'gastoSanatorial');
      honorarios += sumItems(item.laboratorios, 'honorarioMedico');

      if (item.medicamentos) {
        item.medicamentos.forEach(m => {
          gastos += safeNum(m.gastoSanatorial || m.total);
        });
      }
      if (item.descartables) {
        item.descartables.forEach(d => {
          gastos += safeNum(d.gastoSanatorial || d.total);
        });
      }

      const total = gastos + honorarios;

      caratulaRows.push([
        'Clínica de la Unión',
        nombre,
        dni,
        nroSiniestro || '—',
        gastos,
        honorarios,
        total
      ]);
    });

    const lastDataRow = caratulaRows.length;
    const totalRow = [
      'TOTALES',
      '',
      '',
      '',
      { t: 'n', f: `=SUM(E3:E${lastDataRow})` },
      { t: 'n', f: `=SUM(F3:F${lastDataRow})` },
      { t: 'n', f: `=SUM(G3:G${lastDataRow})` }
    ];
    caratulaRows.push(totalRow);

    const wsCaratula = XLSX.utils.aoa_to_sheet(caratulaRows);
    wsCaratula['!cols'] = [
      { wch: 20 }, { wch: 30 }, { wch: 15 }, { wch: 15 },
      { wch: 12 }, { wch: 12 }, { wch: 12 }
    ];
    XLSX.utils.book_append_sheet(wb, wsCaratula, 'Carátula');

    // --- HOJA 2: DETALLE ---
    const detalleHeaders = [
      'CdU', 'Nombre completo', 'DNI', 'N° Stro', 'TOTAL STRO',
      'Tipo', 'Categoría', 'Código', 'Descripción',
      'Cant.', 'Val. U', 'Total', 'Origen',
      'Subtotal Honorarios', 'Subtotal Gastos', 'Total Siniestro'
    ];
    const detalleRows = [detalleHeaders];
    let globalCdU = 1;

    selected.forEach((id, index) => {
      const item = raw[id];
      if (!item) return;

      const paciente = item.paciente || {};
      const nombre = paciente.nombreCompleto || paciente.nombre || '';
      const dni = paciente.dni || '';
      const nroSiniestro = paciente.nroSiniestro || '';
      const estadoItem = item.estado || (item.cerradoAt ? 'cerrado' : 'borrador');

      const lineRows = [];

      const processItem = (x, categoria, tipoBase) => {
        const honorario = safeNum(x?.honorarioMedico);
        const gasto = safeNum(x?.gastoSanatorial);
        const cantidad = safeNum(x?.cantidad ?? x?.unidades ?? 1) || 1;
        const totalItem = safeNum(x?.total);
        const unit = cantidad > 0 ? totalItem / cantidad : 0;

        const desc = x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '';
        const codigo = x?.codigo || x?.code || x?.cod || '';
        let origen = x?.doctorNombre || x?.doctor || x?.medico || x?.prestadorNombre || x?.prestador || '';

        if (honorario > 0) {
          lineRows.push({
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
          lineRows.push({
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

      (item.practicas || []).forEach(p => processItem(p, 'Práctica', ''));
      (item.cirugias || []).forEach(c => processItem(c, 'Cirugía', ''));
      (item.laboratorios || []).forEach(l => processItem(l, 'Laboratorio', ''));
      if (item.medicamentos) {
        item.medicamentos.forEach(m => {
          const gasto = safeNum(m?.gastoSanatorial ?? m?.total);
          if (gasto > 0) {
            const cantidad = safeNum(m?.cantidad ?? m?.unidades ?? 1) || 1;
            const unit = cantidad > 0 ? gasto / cantidad : 0;
            lineRows.push({
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
      }
      if (item.descartables) {
        item.descartables.forEach(d => {
          const gasto = safeNum(d?.gastoSanatorial ?? d?.total);
          if (gasto > 0) {
            const cantidad = safeNum(d?.cantidad ?? d?.unidades ?? 1) || 1;
            const unit = cantidad > 0 ? gasto / cantidad : 0;
            lineRows.push({
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
      }

      const totalHonor = lineRows.filter(r => r.tipo === 'HONORARIO').reduce((acc, r) => acc + r.total, 0);
      const totalGasto = lineRows.filter(r => r.tipo === 'GASTO').reduce((acc, r) => acc + r.total, 0);
      const totalSiniestro = totalHonor + totalGasto;

      if (lineRows.length === 0) return;

      const startRow = detalleRows.length + 1;

      const headerRow = [
        globalCdU,
        nombre,
        dni,
        nroSiniestro,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        totalHonor,
        totalGasto,
        { t: 'n', f: `=N${startRow}+O${startRow}` }
      ];
      detalleRows.push(headerRow);
      globalCdU++;

      lineRows.forEach(row => {
        const detailRow = [
          globalCdU,
          '',
          '',
          '',
          '',
          row.tipo,
          row.categoria,
          row.codigo,
          row.desc,
          row.cantidad,
          row.unit,
          row.total,
          row.origen,
          '',
          '',
          ''
        ];
        detalleRows.push(detailRow);
        globalCdU++;
      });

      if (index < selected.length - 1) {
        const blankRow = Array(detalleHeaders.length).fill('');
        detalleRows.push(blankRow);
      }
    });

    const lastRow = detalleRows.length;
    const totalDetalleRow = [
      '',
      'TOTALES GENERALES',
      '', '', '', '', '', '', '', '', '', '', '',
      { t: 'n', f: `=SUM(N2:N${lastRow})` },
      { t: 'n', f: `=SUM(O2:O${lastRow})` },
      { t: 'n', f: `=SUM(P2:P${lastRow})` }
    ];
    detalleRows.push(totalDetalleRow);

    const wsDetalle = XLSX.utils.aoa_to_sheet(detalleRows);
    wsDetalle['!cols'] = [
      { wch: 6 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 12 },
      { wch: 10 }, { wch: 15 }, { wch: 12 }, { wch: 50 }, { wch: 8 },
      { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 15 },
      { wch: 15 }
    ];
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle');

    XLSX.writeFile(wb, `siniestros_completo_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Imprimir reporte ART
  const printART = (id) => {
    const item = raw[id];
    if (!item) return;

    const paciente = item.paciente || {};
    const nombre = paciente.nombreCompleto || paciente.nombre || '';
    const dni = paciente.dni || '';
    const nroSiniestro = paciente.nroSiniestro || '';
    const artNombre = item.artNombre || paciente.artSeguro || 'SIN ART';

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

    const totalLab = (item.laboratorios || []).reduce((acc, it) => acc + safeNum(it.total), 0);
    const totalMed = (item.medicamentos || []).reduce((acc, it) => acc + safeNum(it.total), 0);
    const totalDesc = (item.descartables || []).reduce((acc, it) => acc + safeNum(it.total), 0);
    const totalGeneral = totalLab + totalMed + totalDesc;

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
              transform: translate(-50%, -50%) ;
              opacity: 0.2;
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
            h2, table, .subtotal, .totales, .footer-section {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <div class="watermark">
            <img src="/logo.png" alt="Clínica de la Unión">
          </div>
          <h1>Reporte para ART</h1>
          <div class="header-info">
            <p><strong>ART:</strong> ${artNombre}</p>
            <p><strong>Paciente:</strong> ${nombre}</p>
            <p><strong>DNI:</strong> ${dni}</p>
            <p><strong>N° Siniestro:</strong> ${nroSiniestro}</p>
          </div>
    `;

    if (item.laboratorios && item.laboratorios.length > 0) {
      html += `<h2>Laboratorios</h2>`;
      html += `<table><thead><tr>${camposLab.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
      html += `<tbody>${generarFilas(item.laboratorios, camposLab)}</tbody>`;
      html += `</table>`;
      html += `<div class="subtotal">Subtotal Lab: $ ${money(totalLab)}</div>`;
    }

    if (item.medicamentos && item.medicamentos.length > 0) {
      html += `<h2>Medicamentos</h2>`;
      html += `<table><thead><tr>${camposMedDesc.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
      html += `<tbody>${generarFilas(item.medicamentos, camposMedDesc)}</tbody>`;
      html += `</table>`;
      html += `<div class="subtotal">Subtotal Med: $ ${money(totalMed)}</div>`;
    }

    if (item.descartables && item.descartables.length > 0) {
      html += `<h2>Descartables</h2>`;
      html += `<table><thead><tr>${camposMedDesc.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
      html += `<tbody>${generarFilas(item.descartables, camposMedDesc)}</tbody>`;
      html += `</table>`;
      html += `<div class="subtotal">Subtotal Desc: $ ${money(totalDesc)}</div>`;
    }

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

  return {
    raw,
    loading,
    q,
    setQ,
    estado,
    setEstadoQuery,
    art,
    setArt,
    orden,
    setOrden,
    fechaDesde,        // 👈 NUEVO
    setFechaDesde,     // 👈 NUEVO
    fechaHasta,        // 👈 NUEVO
    setFechaHasta,     // 👈 NUEVO
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    deleting,
    deleteSelected,
    exportCompleto,
    printART,
    items,
    counts,
    arts,
    filtered,
  };
}
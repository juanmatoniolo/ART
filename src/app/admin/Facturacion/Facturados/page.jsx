// src/app/admin/Facturacion/Facturados/page.jsx
'use client';

import { ref, get, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import useFacturados from './Hook/useFacturados';
import Header from './components/Header';
import QuickSwitch from './components/QuickSwitch';
import Toolbar from './components/Toolbar';
import ItemCard from './components/ItemCard';
import styles from './facturados.module.css';
import { money } from '../utils/calculos';
import { useState, useCallback, useEffect } from 'react';

// ── Toast system ─────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onRemove }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div
          key={t.id}
          style={{
            pointerEvents: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 16px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 600,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            cursor: 'pointer',
            animation: 'toastIn 0.22s ease',
            ...(t.type === 'success' ? {
              background: 'rgba(22, 163, 74, 0.92)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              color: '#fff',
            } : t.type === 'error' ? {
              background: 'rgba(185, 28, 28, 0.92)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#fff',
            } : {
              background: 'rgba(30, 41, 59, 0.96)',
              border: '1px solid #334155',
              color: '#f1f5f9',
            }),
          }}
          onClick={() => onRemove(t.id)}
        >
          {t.type === 'success' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {t.type === 'error' && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          )}
          {t.message}
        </div>
      ))}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(12px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const add = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => remove(id), duration);
  }, [remove]);

  const success = useCallback((msg, dur) => add(msg, 'success', dur), [add]);
  const error   = useCallback((msg, dur) => add(msg, 'error',   dur), [add]);
  const info    = useCallback((msg, dur) => add(msg, 'info',    dur), [add]);

  return { toasts, remove, success, error, info };
}

// ── Helpers internos ─────────────────────────────────────────────────────────

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pickName = (x) =>
  x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '—';

const pickCode = (x) =>
  x?.codigo || x?.code || x?.cod || x?.codigoPractica || '';

const pickDoctor = (x) =>
  x?.doctorNombre || x?.doctor || x?.medico || x?.nombreDr ||
  x?.profesional || x?.prestadorNombre || x?.prestador || '—';

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
  return code ? `${code} — ${name}` : name;
};

// ── Firebase helpers ──────────────────────────────────────────────────────────

async function fetchFullItem(id) {
  const snap = await get(ref(db, `Facturacion/${id}`));
  if (!snap.exists()) return null;
  return snap.val();
}

// ── Impresión: Factura ART completa ──────────────────────────────────────────

// ── Impresión: Factura ART completa (sin watermark, con TH/TD correctos) ──

async function printFacturaCompleta(id) {
  const item = await fetchFullItem(id);
  if (!item) {
    alert('No se encontraron datos para este siniestro.');
    return;
  }

  const paciente = item.paciente || {};
  const nombre = paciente.nombreCompleto || paciente.nombre || '—';
  const dni = paciente.dni || '—';
  const siniestro = paciente.nroSiniestro || item.nroSiniestro || '—';
  const artNombre = item.artNombre || paciente.artSeguro || item.convenioNombre || 'SIN ART';

  const practicas = Array.isArray(item.practicas) ? item.practicas : [];
  const cirugias = Array.isArray(item.cirugias) ? item.cirugias : [];
  const laboratorios = Array.isArray(item.laboratorios) ? item.laboratorios : [];
  const medicamentos = Array.isArray(item.medicamentos) ? item.medicamentos : [];
  const descartables = Array.isArray(item.descartables) ? item.descartables : [];

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
  const totalFactura = totalHonor + totalGasto;

  const truncate = (str, max = 40) => {
    if (!str) return '—';
    const s = String(str);
    return s.length > max ? s.slice(0, max) + '…' : s;
  };

  const renderCompactTable = (items, columns) => {
    if (items.length === 0) return '';
    return `
      <table style="border-collapse:collapse;width:100%;font-size:10pt;margin-bottom:12px;">
        <thead>
          <tr>${columns.map(col => `<th style="background:#e0e0e0;text-align:left;padding:6px 8px;border:1px solid #999;">${col.label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${items.map(item => `
            <tr>${columns.map(col => {
              let content = item[col.field];
              if (col.field === 'desc') content = truncate(item.desc, 40);
              else if (col.field === 'origen') content = truncate(item.origen, 30);
              else if (col.field === 'total' || col.field === 'unit') content = `$ ${money(item[col.field])}`;
              const isNum = col.className === 'num';
              return `<td style="padding:5px 8px;border:1px solid #999;${isNum ? 'text-align:right;' : ''}">${content || '—'}</td>`;
            }).join('')}</tr>
          `).join('')}
        </tbody>
      </table>
    `;
  };

  const honorColumns = [
    { label: 'Código - Práctica', field: 'desc' },
    { label: 'Dr', field: 'origen' },
    { label: 'Cant.', field: 'unidades', className: 'num' },
    { label: 'Valor unit.', field: 'unit', className: 'num' },
    { label: 'Total', field: 'total', className: 'num' },
  ];
  const gastoPracticasColumns = [
    { label: 'Código - Práctica', field: 'desc' },
    { label: 'CdU', field: 'origen' },
    { label: 'Cant.', field: 'unidades', className: 'num' },
    { label: 'Valor unit.', field: 'unit', className: 'num' },
    { label: 'Total', field: 'total', className: 'num' },
  ];
  const medDescColumns = [
    { label: 'Descripción', field: 'desc' },
    { label: 'Cant.', field: 'unidades', className: 'num' },
    { label: 'Valor unit.', field: 'unit', className: 'num' },
    { label: 'Total', field: 'total', className: 'num' },
  ];

  const secHonorPracticas = honorPracticasArr.length ? `<div style="font-weight:bold;margin:12px 0 5px 0;">Prácticas — $ ${money(subtotalHonorPracticas)}</div>${renderCompactTable(honorPracticasArr, honorColumns)}` : '';
  const secHonorCirugias = honorCirugiasArr.length ? `<div style="font-weight:bold;margin:12px 0 5px 0;">CX — $ ${money(subtotalHonorCirugias)}</div>${renderCompactTable(honorCirugiasArr, honorColumns)}` : '';
  const secHonorLaboratorios = honorLaboratoriosArr.length ? `<div style="font-weight:bold;margin:12px 0 5px 0;">Laboratorio — $ ${money(subtotalHonorLaboratorios)}</div>${renderCompactTable(honorLaboratoriosArr, honorColumns)}` : '';
  const secGastoPracticas = gastoPracticasArr.length ? `<div style="font-weight:bold;margin:12px 0 5px 0;">Prácticas — $ ${money(subtotalGastoPracticas)}</div>${renderCompactTable(gastoPracticasArr, gastoPracticasColumns)}` : '';
  const secGastoMedicamentos = gastoMedicamentosArr.length ? `<div style="font-weight:bold;margin:12px 0 5px 0;">Medicación — $ ${money(subtotalGastoMedicamentos)}</div>${renderCompactTable(gastoMedicamentosArr, medDescColumns)}` : '';
  const secGastoDescartables = gastoDescartablesArr.length ? `<div style="font-weight:bold;margin:12px 0 5px 0;">Descartables — $ ${money(subtotalGastoDescartables)}</div>${renderCompactTable(gastoDescartablesArr, medDescColumns)}` : '';

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Factura — ${artNombre} — ${siniestro}</title>
  <style>
    @page { margin: 1.2cm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 0; color: #000; }
    h1 { font-size: 16pt; margin: 0 0 10px; }
    h2 { font-size: 14pt; margin: 20px 0 8px; border-bottom: 1px solid #aaa; padding-bottom: 4px; }
    .info-header {
      display: flex; flex-wrap: wrap; gap: 16px;
      background: #f4f4f4; padding: 8px 12px;
      border-radius: 4px; margin-bottom: 16px; font-size: 10pt;
    }
    .info-header p { margin: 0; }
    .totales { margin-top: 20px; border-top: 2px solid #333; padding-top: 12px; }
    .total-general { font-size: 14pt; font-weight: bold; margin-top: 8px; }
    .footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 28px; border-top: 1px solid #aaa; padding-top: 16px;
      page-break-inside: avoid;
    }
    .firma { text-align: center; flex: 1; }
    .firma-linea { font-size: 13pt; letter-spacing: 2px; color: #444; margin-bottom: 4px; }
    .firma-label { font-size: 9pt; color: #666; }
    .clinica { text-align: center; flex: 1; }
    .clinica img { max-width: 70px; height: auto; margin-bottom: 4px; }
    .clinica-info { font-size: 8pt; color: #666; line-height: 1.3; }
    hr { margin: 12px 0; }
  </style>
</head>
<body>
  <h1>Factura — ART / Convenio</h1>
  <div class="info-header">
    <p><strong>ART / Convenio:</strong> ${artNombre}</p>
    <p><strong>Paciente:</strong> ${nombre}</p>
    <p><strong>DNI:</strong> ${dni}</p>
    <p><strong>N° Siniestro:</strong> ${siniestro}</p>
  </div>

  <h2>HONORARIOS MÉDICOS — Total: $ ${money(totalHonor)}</h2>
  ${secHonorPracticas}${secHonorCirugias}${secHonorLaboratorios}

  <h2>GASTOS CLÍNICOS — Total: $ ${money(totalGasto)}</h2>
  ${secGastoPracticas}${secGastoMedicamentos}${secGastoDescartables}

  <div class="totales">
    <div style="margin: 6px 0;"><strong>Subtotal Honorarios:</strong> $ ${money(totalHonor)}</div>
    <div style="margin: 6px 0;"><strong>Subtotal Gastos:</strong> $ ${money(totalGasto)}</div>
    <div class="total-general">TOTAL: $ ${money(totalFactura)}</div>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ── Impresión: Med + Desc + Lab ───────────────────────────────────────────────

async function printMedDescLab(id) {
  const item = await fetchFullItem(id);
  if (!item) { alert('No se encontraron datos para este siniestro.'); return; }

  const paciente   = item.paciente || {};
  const nombre     = paciente.nombreCompleto || paciente.nombre || '—';
  const dni        = paciente.dni || '—';
  const siniestro  = paciente.nroSiniestro || item.nroSiniestro || '—';
  const artNombre  = item.artNombre || paciente.artSeguro || item.convenioNombre || 'SIN ART';

  const medicamentos = Array.isArray(item.medicamentos) ? item.medicamentos : [];
  const descartables = Array.isArray(item.descartables) ? item.descartables : [];
  const laboratorios = Array.isArray(item.laboratorios) ? item.laboratorios : [];

  const rowsMedDesc = (arr) =>
    arr.map((x) => {
      const qty  = pickQty(x); const unit = pickUnit(x);
      const tot  = safeNum(x?.gastoSanatorial ?? x?.total);
      const desc = x?.nombre || x?.descripcion || '—';
      const pres = x?.presentacion ? ` (${x.presentacion})` : '';
      return `<tr><td>${desc}${pres}</td><td class="num">${qty}</td><td class="num">$ ${money(unit)}</td><td class="num">$ ${money(tot)}</td></tr>`;
    }).join('');

  const rowsLab = laboratorios.map((l) => {
    const qty    = pickQty(l);
    const ub     = safeNum(l?.unidadBioquimica ?? l?.ub ?? pickUnit(l));
    const total  = safeNum(l?.honorarioMedico ?? l?.total);
    const desc   = formatCodeName(l);
    const doctor = pickDoctor(l);
    return `<tr><td>${desc}</td><td>${doctor !== '—' ? doctor : ''}</td><td class="num">${qty}</td><td class="num">${money(ub)}</td><td class="num">$ ${money(total)}</td></tr>`;
  }).join('');

  const totalMed  = medicamentos.reduce((a, x) => a + safeNum(x?.gastoSanatorial ?? x?.total), 0);
  const totalDesc = descartables.reduce((a, x) => a + safeNum(x?.gastoSanatorial ?? x?.total), 0);
  const totalLab  = laboratorios.reduce((a, x) => a + safeNum(x?.honorarioMedico ?? x?.total), 0);
  const totalGen  = totalMed + totalDesc + totalLab;

  const secMed  = medicamentos.length === 0 ? '' : `<h2>Medicamentos $ ${money(totalMed)}</h2><table><thead><tr><th>Descripción</th><th>Cant.</th><th>Valor unit.</th><th>Total</th></tr></thead><tbody>${rowsMedDesc(medicamentos)}</tbody></table>`;
  const secDesc = descartables.length === 0 ? '' : `<h2>Descartables $ ${money(totalDesc)}</h2><table><thead><tr><th>Descripción</th><th>Cant.</th><th>Valor unit.</th><th>Total</th></tr></thead><tbody>${rowsMedDesc(descartables)}</tbody></table>`;
  const secLab  = laboratorios.length === 0 ? '' : `<h2>Estudios de Laboratorio $ ${money(totalLab)}</h2><table><thead><tr><th>Código — Estudio</th><th>Bioquímico/a</th><th>Cant.</th><th>UB</th><th>Total</th></tr></thead><tbody>${rowsLab}</tbody></table>`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Med + Desc + Lab — ${artNombre} — ${siniestro}</title>
  <style>
    @page { margin:1cm; }
    body { font-family:Arial,sans-serif;font-size:11pt;margin:0;color:#000; }
    .watermark { position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);opacity:.12;z-index:-1;pointer-events:none; }
    .watermark img { width:280px;height:auto; }
    h1 { font-size:16pt;margin:0 0 10px; }
    h2 { font-size:13pt;margin:18px 0 6px;border-bottom:1px solid #ccc;padding-bottom:3px; }
    .info-header { display:flex;flex-wrap:wrap;gap:12px;background:#f4f4f4;padding:8px 12px;border-radius:4px;margin-bottom:14px;font-size:10pt; }
    .info-header p { margin:0; }
    table { border-collapse:collapse;width:100%;font-size:10pt;margin-bottom:4px;page-break-inside:avoid; }
    th { background:#e0e0e0;text-align:left;padding:5px 6px;border:1px solid #ccc; }
    td { padding:4px 6px;border:1px solid #ccc; }
    td.num { text-align:right;font-size:9pt; }
    .totales { margin-top:18px;padding-top:10px;page-break-inside:avoid; }
    .total-general { font-size:14pt;margin-top:6px;font-weight:bold; }
    .footer { display:flex;justify-content:space-between;align-items:center;margin-top:20px;border-top:1px solid #aaa;padding-top:14px;page-break-inside:avoid; }
    .firma { text-align:center;flex:1; }
    .firma-linea { font-size:13pt;letter-spacing:2px;color:#444;margin-bottom:2px; }
    .firma-label { font-size:9pt;color:#666; }
    .clinica { text-align:center;flex:1; }
    .clinica img { max-width:70px;height:auto;margin-bottom:4px; }
    .clinica-info { font-size:8pt;color:#666;line-height:1.3; }
    hr { margin:10px 0; }
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
  ${secMed}${secDesc}${secLab}
  <div class="totales"><hr><p class="total-general">TOTAL GENERAL: $ ${money(totalGen)}</p></div>
  <div class="footer">
    <div class="firma">
      <div class="firma-linea">_________________________</div>
      <div class="firma-label">Firma y sello del responsable</div>
    </div>
    <div class="clinica">
      <img src="/logo.jpg" alt="Clínica de la Unión">
      <div class="clinica-info">Clínica de la Unión S.A.<br>Chajarí, Entre Ríos — Av. Siburu 1085</div>
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
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function FacturadosPage() {
  const {
    loading,
    q,
    setQ,
    estado,
    setEstadoQuery,
    art,
    setArt,
    orden,
    setOrden,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    deleting,
    deleteSelected,
    exportCompleto,
    counts,
    arts,
    filtered,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
    refresh,
  } = useFacturados();

  const [moving, setMoving] = useState(false);
  const toast = useToast();

  // ── Mover borradores a facturados ────────────────────────────────────────

const handleMoveToFacturados = async () => {
  if (selectedIds.size === 0) {
    toast.info('Seleccioná al menos un siniestro');
    return;
  }

  const facturaNro = window.prompt('Número de factura (opcional)');
  if (facturaNro === null) return; // cancelado

  const cantidad = selectedIds.size;
  const confirmar = window.confirm(
    `¿Pasás ${cantidad} siniestro${cantidad !== 1 ? 's' : ''} a Facturados?`
  );
  if (!confirmar) return;

  setMoving(true);

  const updates = {};
  selectedIds.forEach((id) => {
    updates[`Facturacion/${id}/estado`] = 'cerrado';
    if (facturaNro.trim() !== '') {
      updates[`Facturacion/${id}/facturaNro`] = facturaNro.trim();
    }
  });

  try {
    await update(ref(db), updates);
    toast.success(`${cantidad} siniestro${cantidad !== 1 ? 's' : ''} movido${cantidad !== 1 ? 's' : ''} a Facturados ✓`);

    if (typeof toggleSelectAll === 'function') {
      toggleSelectAll(false);
    }

    if (typeof refresh === 'function') {
      refresh();
    } else {
      setEstadoQuery('cerrado');
    }
  } catch (err) {
    console.error('Error al mover a facturados:', err);
    toast.error('Ocurrió un error al actualizar.');
  } finally {
    setMoving(false);
  }
};
  // ── Wrapper de deleteSelected con toast ──────────────────────────────────

  const handleDelete = async () => {
    if (selectedIds.size === 0) {
      toast.info('Seleccioná al menos un siniestro para eliminar');
      return;
    }
    try {
      await deleteSelected();
      toast.success(`Siniestro${selectedIds.size !== 1 ? 's' : ''} eliminado${selectedIds.size !== 1 ? 's' : ''} correctamente`);
    } catch {
      toast.error('Error al eliminar. Intentá de nuevo.');
    }
  };

  return (
    <>
      <div className={styles.container}>
        <header className={styles.header}>
          <Header
            selectedCount={selectedIds.size}
            onExport={exportCompleto}
            onDelete={handleDelete}
            deleting={deleting}
            onMoveToFacturados={handleMoveToFacturados}
            moving={moving}
            showMoveButton={estado === 'borrador'}
            estado={estado}
            counts={counts}
            onSwitch={setEstadoQuery}
          />
          <QuickSwitch estado={estado} counts={counts} onSwitch={setEstadoQuery} />
          <Toolbar
            q={q}
            onSearchChange={setQ}
            estado={estado}
            onEstadoChange={setEstadoQuery}
            art={art}
            onArtChange={setArt}
            arts={arts}
            orden={orden}
            onOrdenChange={setOrden}
            selectedCount={selectedIds.size}
            totalFiltered={filtered.length}
            onToggleSelectAll={toggleSelectAll}
            fechaDesde={fechaDesde}
            onFechaDesdeChange={setFechaDesde}
            fechaHasta={fechaHasta}
            onFechaHastaChange={setFechaHasta}
          />
        </header>

        <main className={styles.content}>
          {loading ? (
            <div className={styles.empty}>Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className={styles.empty}>No hay resultados con esos filtros.</div>
          ) : (
            <div className={styles.grid}>
              {filtered.map(it => (
                <ItemCard
                  key={it.id}
                  item={it}
                  isSelected={selectedIds.has(it.id)}
                  onToggleSelect={toggleSelect}
                  onPrintART={() => printFacturaCompleta(it.id)}
                  onPrintMedDescLab={() => printMedDescLab(it.id)}
                />
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Toast notifications — fuera del contenedor para overlay correcto */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.remove} />
    </>
  );
}
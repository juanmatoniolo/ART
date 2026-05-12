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



// ── Helper para obtener la imagen de la ART (evita duplicación) ──
const getArtImage = (artName) => {
  if (!artName || artName === 'SIN ART') return '/img-art/default.webp';
  const normalizeForMap = (str) => str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, '')
    .trim();
  const key = normalizeForMap(artName);
  const artFiles = {
    "asociart": "Asociart.webp",
    "comfye": "COMFYE.webp",
    "federacion patronal ap": "Federacion patronal AP.webp",
    "federacion patronal art": "Federacion patronal ART.webp",
    "iaps art": "IAPS ART.webp",
    "iaps": "IAPS.webp",
    "la segunda ap": "LA SEGUNDA AP.webp",
    "la segunda art": "la segunda art.webp",
    "medicar work": "medicar work.webp",
    "victoria art": "vicotria art.webp",
    "vicotria art": "vicotria art.webp"
  };
  const fileName = artFiles[key];
  return fileName ? `/img-art/${fileName}` : '/img-art/default.webp';
};

// ── Impresión: Factura ART completa (compacta, con watermark y firma) ──
async function printFacturaCompleta(id) {
  const item = await fetchFullItem(id);
  if (!item) {
    alert('No se encontraron datos para este siniestro.');
    return;
  }

  const paciente = item.paciente || {};
  const apellido = paciente.apellido || '';
  const nombrePaciente = paciente.nombre || paciente.nombreCompleto || '';
  const nombreCompleto = apellido && nombrePaciente 
    ? `${apellido}, ${nombrePaciente}` 
    : (paciente.nombreCompleto || '—');
  const dni = paciente.dni || '—';
  const siniestro = paciente.nroSiniestro || item.nroSiniestro || '—';
  const artNombre = item.artNombre || paciente.artSeguro || item.convenioNombre || 'SIN ART';
  const artImageUrl = getArtImage(artNombre);

  const practicas = Array.isArray(item.practicas) ? item.practicas : [];
  const cirugias = Array.isArray(item.cirugias) ? item.cirugias : [];
  const laboratorios = Array.isArray(item.laboratorios) ? item.laboratorios : [];
  const medicamentos = Array.isArray(item.medicamentos) ? item.medicamentos : [];
  const descartables = Array.isArray(item.descartables) ? item.descartables : [];

  const honorariosRows = [];
  const gastosRows = [];

  practicas.forEach(p => {
    const honorario = safeNum(p?.honorarioMedico);
    const gasto = safeNum(p?.gastoSanatorial);
    const qty = pickQty(p);
    const unit = pickUnit(p);
    const desc = formatCodeName(p);
    const doctor = pickDoctor(p);
    if (honorario > 0) honorariosRows.push({ desc, doctor, qty, unit, total: honorario });
    if (gasto > 0) gastosRows.push({ desc, origen: 'Clínica de la Unión', qty, unit, total: gasto });
  });

  cirugias.forEach(c => {
    const honorario = safeNum(c?.honorarioMedico);
    const gasto = safeNum(c?.gastoSanatorial);
    const qty = pickQty(c);
    const unit = pickUnit(c);
    const desc = formatCodeName(c);
    const doctor = pickDoctor(c);
    if (honorario > 0) honorariosRows.push({ desc, doctor, qty, unit, total: honorario });
    if (gasto > 0) gastosRows.push({ desc, origen: 'Clínica de la Unión', qty, unit, total: gasto });
  });

  laboratorios.forEach(l => {
    const honorario = safeNum(l?.honorarioMedico);
    const gasto = safeNum(l?.gastoSanatorial);
    const qty = pickQty(l);
    const unit = pickUnit(l);
    const desc = formatCodeName(l);
    const doctor = pickDoctor(l);
    if (honorario > 0) honorariosRows.push({ desc, doctor, qty, unit, total: honorario });
    if (gasto > 0) gastosRows.push({ desc, origen: 'Clínica de la Unión', qty, unit, total: gasto });
  });

  medicamentos.forEach(m => {
    const gasto = safeNum(m?.gastoSanatorial ?? m?.total);
    const qty = pickQty(m);
    const unit = pickUnit(m);
    const desc = m?.nombre || '—';
    if (gasto > 0) gastosRows.push({ desc, origen: 'Clínica de la Unión', qty, unit, total: gasto });
  });

  descartables.forEach(d => {
    const gasto = safeNum(d?.gastoSanatorial ?? d?.total);
    const qty = pickQty(d);
    const unit = pickUnit(d);
    const desc = d?.nombre || '—';
    if (gasto > 0) gastosRows.push({ desc, origen: 'Clínica de la Unión', qty, unit, total: gasto });
  });

  const totalHonor = honorariosRows.reduce((sum, r) => sum + r.total, 0);
  const totalGasto = gastosRows.reduce((sum, r) => sum + r.total, 0);
  const totalFactura = totalHonor + totalGasto;

  const renderTable = (rows, title, isHonorario) => {
    if (!rows.length) return '';
    const columns = isHonorario 
      ? ['Código - Práctica', 'Profesional', 'Cant.', 'Valor unit.', 'Total']
      : ['Descripción', 'Centro', 'Cant.', 'Valor unit.', 'Total'];
    const fields = isHonorario ? ['desc', 'doctor', 'qty', 'unit', 'total'] : ['desc', 'origen', 'qty', 'unit', 'total'];
    const titleClass = isHonorario ? 'honorario-title' : 'gasto-title';
    return `
      <div class="section">
        <div class="section-title ${titleClass}">${title} $ ${money(isHonorario ? totalHonor : totalGasto)}</div>
        <table class="compact-table">
          <thead>
            <tr>${columns.map(col => `<th>${col}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                ${fields.map(field => {
                  let val = row[field];
                  if (field === 'total' || field === 'unit') val = `$ ${money(val)}`;
                  else if (field === 'qty') val = val || 1;
                  else if (!val) val = '—';
                  return `<td>${val}</td>`;
                }).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  };

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Factura ART ${siniestro}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 8.5pt;
      margin: 0.8cm;
      color: #1e293b;
      background: white;
      position: relative;
    }
    /* Watermark (logo de clínica de fondo) */
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.08;
      z-index: -1;
      pointer-events: none;
    }
    .watermark img {
      width: 280px;
      height: auto;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #aaa;
    }
    .patient-info { text-align: left; }
    .patient-name { font-size: 12pt; font-weight: bold; }
    .patient-dni { font-size: 9pt; color: #2c3e66; }
    .art-logo { text-align: right; }
    .art-logo img { max-height: 50px; max-width: 140px; object-fit: contain; }
    .siniestro-nro { font-size: 10pt; font-weight: bold; margin-top: 5px; text-align: right; }
    .section { margin-top: 12px; page-break-inside: avoid; }
    .section-title {
      font-size: 10pt;
      font-weight: bold;
      padding: 5px 8px;
      margin-bottom: 6px;
      border-radius: 4px;
    }
    .honorario-title { background: #e6f0fa; color: #0c4e6e; }
    .gasto-title { background: #f0f0f0; color: #2d3e50; }
    .compact-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .compact-table th {
      background: #e2e8f0;
      text-align: left;
      padding: 4px 5px;
      border: 1px solid #cbd5e1;
      font-weight: 600;
    }
    .compact-table td {
      padding: 3px 5px;
      border: 1px solid #ddd;
    }
    .total-row {
      margin-top: 12px;
      text-align: right;
      font-size: 10pt;
      font-weight: bold;
      border-top: 1px solid #ccc;
      padding-top: 6px;
    }
    .footer {
      margin-top: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid #aaa;
      padding-top: 12px;
      page-break-inside: avoid;
    }
    .firma {
      text-align: center;
      flex: 1;
    }
    .firma-linea {
      width: 180px;
      border-top: 1px solid #000;
      margin: 0 auto 4px auto;
    }
    .firma-label {
      font-size: 8pt;
      color: #555;
    }
    .clinica-pie {
      text-align: center;
      flex: 1;
    }
    .clinica-pie img {
      max-width: 60px;
      height: auto;
      margin-bottom: 4px;
    }
    .clinica-info {
      font-size: 7pt;
      color: #5b6e8c;
      line-height: 1.3;
    }
    @media print {
      body { margin: 0.5cm; }
      .watermark { opacity: 0.1; }
    }
  </style>
</head>
<body>
  <div class="watermark"><img src="/logo.png" alt=""></div>
  <div class="header-row">
    <div class="patient-info">
      <div class="patient-name">${nombreCompleto}</div>
      <div class="patient-dni">DNI ${dni}</div>
    </div>
    <div class="art-logo">
      <img src="${artImageUrl}" alt="${artNombre}" onerror="this.src='/img-art/default.webp'">
      <div class="siniestro-nro">N° Siniestro: ${siniestro}</div>
    </div>
  </div>

  ${renderTable(honorariosRows, 'HONORARIOS MÉDICOS', true)}
  ${renderTable(gastosRows, 'GASTOS CLÍNICOS', false)}

  <div class="total-row">
    TOTAL FACTURA: $ ${money(totalFactura)}
  </div>

  <div class="footer">
    <div class="firma">
      <div class="firma-linea"></div>
      <div class="firma-label">Firma y sello del prestador</div>
    </div>
    <div class="clinica-pie">
      <img src="/logo.jpg" alt="Clínica de la Unión">
      <div class="clinica-info">Clínica de la Unión S.A.<br>Av. Siburu 1085 - Chajarí, ER</div>
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

// ── Impresión: Medicamentos + Descartables + Laboratorio (con misma estética) ──
async function printMedDescLab(id) {
  const item = await fetchFullItem(id);
  if (!item) { alert('No se encontraron datos para este siniestro.'); return; }

  const paciente = item.paciente || {};
  const apellido = paciente.apellido || '';
  const nombrePaciente = paciente.nombre || paciente.nombreCompleto || '';
  const nombreCompleto = apellido && nombrePaciente ? `${apellido}, ${nombrePaciente}` : (paciente.nombreCompleto || '—');
  const dni = paciente.dni || '—';
  const siniestro = paciente.nroSiniestro || item.nroSiniestro || '—';
  const artNombre = item.artNombre || paciente.artSeguro || item.convenioNombre || 'SIN ART';
  const artImageUrl = getArtImage(artNombre);

  const medicamentos = Array.isArray(item.medicamentos) ? item.medicamentos : [];
  const descartables = Array.isArray(item.descartables) ? item.descartables : [];
  const laboratorios = Array.isArray(item.laboratorios) ? item.laboratorios : [];

  // Usar las funciones globales pickQty, pickUnit, pickDoctor, formatCodeName, safeNum

  const rowsMedDesc = (arr) =>
    arr.map((x) => {
      const qty = pickQty(x);
      const unit = pickUnit(x);
      const tot = safeNum(x?.gastoSanatorial ?? x?.total);
      const desc = x?.nombre || x?.descripcion || '—';
      const pres = x?.presentacion ? ` (${x.presentacion})` : '';
      return `
        <tr>
          <td>${desc}${pres}</td>
          <td class="num">${qty}</td>
          <td class="num">$ ${money(unit)}</td>
          <td class="num">$ ${money(tot)}</td>
        </tr>
      `;
    }).join('');

  const rowsLab = laboratorios.map((l) => {
    const qty = pickQty(l);
    const ub = safeNum(l?.unidadBioquimica ?? l?.ub ?? pickUnit(l));
    const total = safeNum(l?.honorarioMedico ?? l?.total);
    const desc = formatCodeName(l);
    const doctor = pickDoctor(l);
    return `
      <tr>
        <td>${desc}</td>
        <td>${doctor !== '—' ? doctor : ''}</td>
        <td class="num">${qty}</td>
        <td class="num">${money(ub)}</td>
        <td class="num">$ ${money(total)}</td>
      </tr>
    `;
  }).join('');

  const totalMed = medicamentos.reduce((a, x) => a + safeNum(x?.gastoSanatorial ?? x?.total), 0);
  const totalDesc = descartables.reduce((a, x) => a + safeNum(x?.gastoSanatorial ?? x?.total), 0);
  const totalLab = laboratorios.reduce((a, x) => a + safeNum(x?.honorarioMedico ?? x?.total), 0);
  const totalGen = totalMed + totalDesc + totalLab;

  const secMed = medicamentos.length === 0 ? '' : `
    <div class="section">
      <div class="section-title">MEDICAMENTOS — $ ${money(totalMed)}</div>
      <table class="compact-table">
        <thead><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead>
        <tbody>${rowsMedDesc(medicamentos)}</tbody>
      </table>
    </div>
  `;
  const secDesc = descartables.length === 0 ? '' : `
    <div class="section">
      <div class="section-title">DESCARTABLES — $ ${money(totalDesc)}</div>
      <table class="compact-table">
        <thead><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead>
        <tbody>${rowsMedDesc(descartables)}</tbody>
      </table>
    </div>
  `;
  const secLab = laboratorios.length === 0 ? '' : `
    <div class="section">
      <div class="section-title">LABORATORIO — $ ${money(totalLab)}</div>
      <table class="compact-table">
        <thead><tr><th>Código — Estudio</th><th>Bioquímico/a</th><th class="num">Cant.</th><th class="num">UB</th><th class="num">Total</th></tr></thead>
        <tbody>${rowsLab}</tbody>
      </table>
    </div>
  `;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Medicamentos, Descartables y Laboratorio — ${siniestro}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 8.5pt;
      margin: 0.8cm;
      color: #1e293b;
      background: white;
      position: relative;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.08;
      z-index: -1;
      pointer-events: none;
    }
    .watermark img { width: 280px; height: auto; }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #aaa;
    }
    .patient-info { text-align: left; }
    .patient-name { font-size: 12pt; font-weight: bold; }
    .patient-dni { font-size: 9pt; color: #2c3e66; }
    .art-logo { text-align: right; }
    .art-logo img { max-height: 50px; max-width: 140px; object-fit: contain; }
    .siniestro-nro { font-size: 10pt; font-weight: bold; margin-top: 5px; text-align: right; }
    .section { margin-top: 12px; page-break-inside: avoid; }
    .section-title {
      font-size: 10pt;
      font-weight: bold;
      background: #eef2ff;
      padding: 5px 8px;
      margin-bottom: 6px;
      border-radius: 4px;
      color: #1e3a8a;
    }
    .compact-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8pt;
    }
    .compact-table th {
      background: #e2e8f0;
      text-align: left;
      padding: 4px 5px;
      border: 1px solid #cbd5e1;
      font-weight: 600;
    }
    .compact-table td {
      padding: 3px 5px;
      border: 1px solid #ddd;
    }
    .num { text-align: right; }
    .total-row {
      margin-top: 12px;
      text-align: right;
      font-size: 10pt;
      font-weight: bold;
      border-top: 1px solid #ccc;
      padding-top: 6px;
    }
    .footer {
      margin-top: 25px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-top: 1px solid #aaa;
      padding-top: 12px;
      page-break-inside: avoid;
    }
    .firma {
      text-align: center;
      flex: 1;
    }
    .firma-linea {
      width: 180px;
      border-top: 1px solid #000;
      margin: 0 auto 4px auto;
    }
    .firma-label {
      font-size: 8pt;
      color: #555;
    }
    .clinica-pie {
      text-align: center;
      flex: 1;
    }
    .clinica-pie img {
      max-width: 60px;
      height: auto;
      margin-bottom: 4px;
    }
    .clinica-info {
      font-size: 7pt;
      color: #5b6e8c;
      line-height: 1.3;
    }
    @media print {
      body { margin: 0.5cm; }
      .watermark { opacity: 0.1; }
    }
  </style>
</head>
<body>
  <div class="watermark"><img src="/logo.png" alt=""></div>
  <div class="header-row">
    <div class="patient-info">
      <div class="patient-name">${nombreCompleto}</div>
      <div class="patient-dni">DNI ${dni}</div>
    </div>
   
  </div>

  ${secMed}
  ${secDesc}
  ${secLab}

  <div class="total-row">
    TOTAL GENERAL: $ ${money(totalGen)}
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
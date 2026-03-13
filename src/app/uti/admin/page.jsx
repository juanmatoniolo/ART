'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, onValue, push, update } from 'firebase/database';
import { getSession, clearSession } from '@/utils/session';
import {
  Activity, User, Calendar, FileText, Printer, Copy, Check,
  MessageCircle, LogOut, Search, XCircle, Home, Truck,
  RefreshCw, FlaskConical, Stethoscope, UserCheck, BarChart2,
  Clock, TrendingUp, Users, Download, CheckSquare, Square,
  AlertTriangle,
} from 'lucide-react';
import Header from '@/components/Header/Header';
import styles from './page.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcDias(fechaIngreso) {
  if (!fechaIngreso) return 0;
  return Math.max(0, Math.floor((new Date() - new Date(fechaIngreso)) / 86400000));
}

function fmtFecha(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Parsea "DD/MM/YYYY HH:MM" o ISO → Date | null
 */
function parseFechaCarga(str) {
  if (!str) return null;
  const m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`);
  const d = new Date(str);
  return isNaN(d) ? null : d;
}

/**
 * Retorna true si la fecha de carga es un día distinto al de la evolución documentada.
 * fechaDoc: "YYYY-MM-DD"   |   cargaStr: "DD/MM/YYYY HH:MM"
 */
function esCargaTardia(fechaDoc, cargaStr) {
  if (!fechaDoc || !cargaStr) return false;
  const dDoc   = new Date(fechaDoc + 'T00:00:00');
  const dCarga = parseFechaCarga(cargaStr);
  if (!dCarga) return false;
  return (
    dDoc.getFullYear() !== dCarga.getFullYear() ||
    dDoc.getMonth()    !== dCarga.getMonth()    ||
    dDoc.getDate()     !== dCarga.getDate()
  );
}

function estadoPaciente(p) {
  if (p.fechaAlta)     return { label: 'Alta',      cls: 'alta'      };
  if (p.fechaTraslado) return { label: 'Traslado',  cls: 'traslado'  };
  if (!p.activo)       return { label: 'Inactivo',  cls: 'inactivo'  };
  return                      { label: 'Activo',    cls: 'activo'    };
}

function ultimaEvolucion(p) {
  const evs = p.evoluciones || [];
  if (!evs.length) return null;
  return [...evs].sort((a, b) => {
    const ka = parseFechaCarga(a.fechaReal || a.fechaCarga) || new Date(a.fechaDoc);
    const kb = parseFechaCarga(b.fechaReal || b.fechaCarga) || new Date(b.fechaDoc);
    return kb - ka;
  })[0];
}

// ─── CSS para impresión (compartido) ─────────────────────────────────────────
const PRINT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;padding:24px 32px;line-height:1.6}
  .ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a6b;padding-bottom:12px;margin-bottom:18px}
  .ph h1{font-size:16px;color:#1a3a6b;font-weight:700}.ph p{font-size:11px;color:#555;margin-top:2px}
  .pm{text-align:right;font-size:11px;color:#555}
  .sec{margin-bottom:18px;page-break-inside:avoid}
  .st{font-size:11px;font-weight:700;text-transform:uppercase;color:#1a3a6b;border-bottom:1px solid #dbeafe;padding-bottom:4px;margin-bottom:8px}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:6px 16px}
  .g1{display:grid;grid-template-columns:1fr;gap:6px}
  .f{padding:3px 0}.f label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:1px}
  .f span{font-size:12px;white-space:pre-wrap}
  .ei{border-left:3px solid #2563a8;padding:8px 10px;margin-bottom:10px;background:#f8fafc;border-radius:0 4px 4px 0}
  .ed{font-weight:700;color:#2563a8;font-size:11px;margin-bottom:4px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .edr{color:#5b21b6;background:#f5f3ff;padding:1px 8px;border-radius:20px;font-size:10px;font-weight:600}
  .ecarga-row{font-size:11px;margin-bottom:4px;display:flex;gap:12px;flex-wrap:wrap}
  .fecha-clinica{color:#1e40af;font-weight:600}
  .fecha-sistema{color:#475569}
  .late-tag{color:#92400e;background:#fef3c7;border:1px solid #fcd34d;padding:1px 7px;border-radius:20px;font-size:10px;font-weight:600}
  .et{font-size:12px;white-space:pre-wrap;margin-top:4px;color:#1e293b}
  .evo-legend{font-size:10px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;padding:6px 10px;border-radius:4px;margin-bottom:10px;line-height:1.6}
  .no-evs{color:#94a3b8;font-style:italic;font-size:12px}
  .pre-block{font-size:11px;white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;padding:8px 10px;border-radius:4px;font-family:monospace}
  .sep{border:none;border-top:2px dashed #cbd5e1;margin:24px 0}
  .cover{text-align:center;padding:32px 0 24px;border-bottom:2px solid #1a3a6b;margin-bottom:24px}
  .cover h1{font-size:18px;color:#1a3a6b;font-weight:700;margin-bottom:5px}
  .cover p{font-size:11px;color:#64748b}
  .footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;text-align:center}
  @media print{body{padding:0}@page{margin:16mm}}
`;

function buildHTMLPaciente(p) {
  const dias = calcDias(p.fechaIngreso);
  const evols = [...(p.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));
  const { label } = estadoPaciente(p);

  const field = (lbl, val) => val
    ? `<div class="f"><label>${lbl}</label><span>${String(val).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span></div>`
    : '';

  const evsHtml = evols.map((ev, i) => {
    const carga = ev.fechaReal || ev.fechaCarga;
    const tardia = esCargaTardia(ev.fechaDoc, carga);
    return `
      <div class="ei">
        <div class="ed">
          Evolución ${i + 1}
          <span class="edr">Dr. ${ev.medicoEvolucion || '—'}</span>
          ${tardia ? `<span class="late-tag">⚠ Carga tardía</span>` : ''}
        </div>
        <div class="ecarga-row">
          <span><strong class="fecha-clinica">Fecha clínica:</strong> ${ev.fechaDoc}</span>
          <span><strong class="fecha-sistema">Cargado en sistema:</strong> ${carga || '—'}</span>
        </div>
        <div class="et">${(ev.texto || '—').replace(/\n/g,'<br/>')}</div>
      </div>`;
  }).join('');

  return `
    <div class="sec">
      <div class="st">👤 Admisión</div>
      <div class="g2">
        ${field('Paciente', p.paciente)}
        ${field('Médico de ingreso', p.medicoIngreso ? `Dr. ${p.medicoIngreso}` : null)}
        ${field('Obra Social', p.obraSocial)}
        ${field('Fecha de ingreso', p.fechaIngreso)}
        ${field('Días internado', `${dias} día${dias !== 1 ? 's' : ''}`)}
        ${field('Estado', label)}
        ${field('Motivo de ingreso', p.motivoIngreso)}
      </div>
    </div>
    <div class="sec">
      <div class="st">🩺 Estado Clínico</div>
      <div class="g1">
        ${field('Diagnóstico actual', p.diagnosticoActual)}
        ${field('Antecedentes', p.antecedentes)}
        ${field('Tratamiento actual', p.tratamientoActual)}
        ${field('Pendientes', p.pendientes)}
      </div>
    </div>
    ${p.examenes ? `<div class="sec"><div class="st">🔬 Exámenes</div><pre class="pre-block">${p.examenes}</pre></div>` : ''}
    <div class="sec">
      <div class="st">📅 Evoluciones (${evols.length})</div>
      <div class="evo-legend">
        <strong>Fecha clínica</strong>: fecha documentada por el médico &nbsp;·&nbsp;
        <strong>Cargado en sistema</strong>: fecha/hora real del registro &nbsp;·&nbsp;
        <span class="late-tag">⚠ Carga tardía</span>: el registro se realizó en un día distinto al de la evolución
      </div>
      ${evols.length > 0 ? evsHtml : '<p class="no-evs">Sin evoluciones registradas.</p>'}
    </div>
    ${p.fechaAlta ? `<div class="sec"><div class="st">🏠 Alta</div><div class="g2">${field('Fecha de alta', fmtFecha(p.fechaAlta))}${field('Médico', p.medicoAlta ? `Dr. ${p.medicoAlta}` : null)}${field('Motivo', p.motivoAlta)}</div></div>` : ''}
    ${p.fechaTraslado ? `<div class="sec"><div class="st">🚑 Traslado</div><div class="g2">${field('Fecha de traslado', fmtFecha(p.fechaTraslado))}${field('Médico', p.medicoTraslado ? `Dr. ${p.medicoTraslado}` : null)}${field('Destino', p.destinoTraslado)}${field('Motivo', p.motivoTraslado)}</div></div>` : ''}
  `;
}

// ─── Exportar: PDF individual ─────────────────────────────────────────────────
function exportarPDF(p) {
  const dias = calcDias(p.fechaIngreso);
  const win = window.open('', '_blank', 'width=960,height=800');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>HC — ${p.paciente}</title>
    <style>${PRINT_CSS}</style>
  </head><body>
    <div class="ph">
      <div><h1>Historia Clínica — UTI</h1><p>Clínica de la Unión S.A.</p></div>
      <div class="pm">Impreso: ${new Date().toLocaleString('es-AR')}<br/>Cama ${p.cama} · ${dias} día${dias!==1?'s':''}</div>
    </div>
    ${buildHTMLPaciente(p)}
    <div class="footer">Clínica de la Unión S.A. — Documento generado automáticamente · ${new Date().toLocaleString('es-AR')}</div>
  </body></html>`);
  win.document.close(); win.focus();
  setTimeout(() => { win.print(); }, 500);
}

// ─── Exportar: PDF múltiple ───────────────────────────────────────────────────
function exportarPDFMultiple(pacientes) {
  const win = window.open('', '_blank', 'width=960,height=800');
  const bloques = pacientes.map((p, idx) => {
    const dias = calcDias(p.fechaIngreso);
    return `
      ${idx > 0 ? '<hr class="sep"/>' : ''}
      <div class="ph" style="${idx>0?'margin-top:18px;':''}">
        <div><h1>Historia Clínica — UTI</h1><p>Clínica de la Unión S.A.</p></div>
        <div class="pm">Cama ${p.cama} · ${dias} día${dias!==1?'s':''}</div>
      </div>
      ${buildHTMLPaciente(p)}
    `;
  }).join('');
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
    <title>UTI — Exportación ${pacientes.length} pacientes</title>
    <style>${PRINT_CSS}</style>
  </head><body>
    <div class="cover">
      <h1>Exportación UTI — ${pacientes.length} paciente${pacientes.length!==1?'s':''}</h1>
      <p>Clínica de la Unión S.A. · Generado: ${new Date().toLocaleString('es-AR')}</p>
    </div>
    ${bloques}
    <div class="footer">Clínica de la Unión S.A. — Exportación masiva · ${new Date().toLocaleString('es-AR')}</div>
  </body></html>`);
  win.document.close(); win.focus();
  setTimeout(() => { win.print(); }, 700);
}

// ─── Exportar: TXT individual ─────────────────────────────────────────────────
function exportarTXT(p) {
  const dias = calcDias(p.fechaIngreso);
  const evols = [...(p.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));
  const L = '─'.repeat(52);
  const lines = [
    '╔══════════════════════════════════════════════════════╗',
    '║        HISTORIA CLÍNICA — UTI                       ║',
    '║        Clínica de la Unión S.A.                     ║',
    '╚══════════════════════════════════════════════════════╝',
    `  Generado: ${new Date().toLocaleString('es-AR')}`,
    L, '',
    '👤 PACIENTE',
    `  Nombre         : ${p.paciente || '—'}`,
    `  Cama           : ${p.cama}`,
    `  Obra Social    : ${p.obraSocial || '—'}`,
    `  Médico ingreso : Dr. ${p.medicoIngreso || '—'}`,
    `  Fecha ingreso  : ${p.fechaIngreso || '—'}`,
    `  Días internado : ${dias}`,
    `  Motivo         : ${p.motivoIngreso || '—'}`,
    `  Estado         : ${estadoPaciente(p).label}`,
    '', L,
    '🩺 ESTADO CLÍNICO',
    `  Diagnóstico:\n    ${(p.diagnosticoActual || '—').replace(/\n/g,'\n    ')}`,
    `\n  Antecedentes:\n    ${(p.antecedentes || '—').replace(/\n/g,'\n    ')}`,
    `\n  Tratamiento:\n    ${(p.tratamientoActual || '—').replace(/\n/g,'\n    ')}`,
    `\n  Pendientes:\n    ${(p.pendientes || '—').replace(/\n/g,'\n    ')}`,
  ];
  if (p.examenes) { lines.push('', L, '🔬 EXÁMENES', `  ${p.examenes.replace(/\n/g,'\n  ')}`); }

  lines.push('', L, `📅 EVOLUCIONES (${evols.length})`);
  lines.push('  Leyenda:');
  lines.push('    Fecha clínica  = fecha documentada por el médico');
  lines.push('    Cargado        = fecha/hora real del registro en sistema');
  lines.push('    [!]            = carga tardía (distinto día)');

  evols.forEach((ev, i) => {
    const carga = ev.fechaReal || ev.fechaCarga;
    const tardia = esCargaTardia(ev.fechaDoc, carga);
    lines.push('');
    lines.push(`  ┌─ Evolución ${i + 1}${tardia ? '  [!] CARGA TARDÍA' : ''}`);
    lines.push(`  │  Fecha clínica  : ${ev.fechaDoc}`);
    lines.push(`  │  Cargado        : ${carga || '—'}`);
    lines.push(`  │  Médico         : Dr. ${ev.medicoEvolucion || '—'}`);
    lines.push(`  └─ Texto:`);
    (ev.texto || '—').split('\n').forEach(l => lines.push(`     ${l}`));
  });

  if (p.fechaAlta)     lines.push('', L, '🏠 ALTA',     `  Fecha: ${fmtFecha(p.fechaAlta)}  |  Dr. ${p.medicoAlta||'—'}  |  ${p.motivoAlta||''}`);
  if (p.fechaTraslado) lines.push('', L, '🚑 TRASLADO', `  Fecha: ${fmtFecha(p.fechaTraslado)}  |  Dr. ${p.medicoTraslado||'—'}  |  Destino: ${p.destinoTraslado||'—'}`);
  lines.push('', L, 'Fin de historia clínica · Clínica de la Unión S.A.');

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `HC_${(p.paciente||'paciente').replace(/[^\w\s]/g,'_')}_${new Date().toISOString().split('T')[0]}.txt`,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

// ─── Exportar: TXT múltiple ───────────────────────────────────────────────────
function exportarTXTMultiple(pacientes) {
  const SEP = '\n' + '═'.repeat(60) + '\n';
  const L = '─'.repeat(52);
  const encabezado = [
    '╔══════════════════════════════════════════════════════════╗',
    '║   EXPORTACIÓN MASIVA — UTI · Clínica de la Unión S.A.  ║',
    '╚══════════════════════════════════════════════════════════╝',
    `  Generado: ${new Date().toLocaleString('es-AR')}`,
    `  Pacientes exportados: ${pacientes.length}`,
    '  [!] = evolución cargada en sistema en fecha distinta a la clínica',
    '',
  ].join('\n');

  const partes = pacientes.map(p => {
    const dias = calcDias(p.fechaIngreso);
    const evols = [...(p.evoluciones||[])].sort((a,b)=>new Date(a.fechaDoc)-new Date(b.fechaDoc));
    const lines = [
      `PACIENTE : ${p.paciente || '—'}`,
      `Cama     : ${p.cama}   Ingreso: ${p.fechaIngreso}   Días: ${dias}   OS: ${p.obraSocial||'—'}`,
      `Médico   : Dr. ${p.medicoIngreso||'—'}   Estado: ${estadoPaciente(p).label}`,
      `Motivo   : ${p.motivoIngreso||'—'}`,
      '',
      `Diagnóstico : ${p.diagnosticoActual||'—'}`,
      `Tratamiento : ${p.tratamientoActual||'—'}`,
      `Pendientes  : ${p.pendientes||'—'}`,
      '', L, `EVOLUCIONES (${evols.length})`,
    ];
    evols.forEach((ev,i)=>{
      const carga=ev.fechaReal||ev.fechaCarga;
      const t=esCargaTardia(ev.fechaDoc,carga);
      lines.push(`  [${i+1}] Fecha clínica: ${ev.fechaDoc}  |  Cargado: ${carga||'—'}${t?'  [!]':''}  |  Dr. ${ev.medicoEvolucion||'—'}`);
      lines.push(`      ${(ev.texto||'—').replace(/\n/g,'\n      ')}`);
    });
    if (p.fechaAlta)     lines.push('',`ALTA     : ${fmtFecha(p.fechaAlta)}  |  Dr. ${p.medicoAlta||'—'}  |  ${p.motivoAlta||''}`);
    if (p.fechaTraslado) lines.push('',`TRASLADO : ${fmtFecha(p.fechaTraslado)}  |  Dr. ${p.medicoTraslado||'—'}  |  Destino: ${p.destinoTraslado||'—'}`);
    return lines.join('\n');
  });

  const blob = new Blob([encabezado + partes.join(SEP)], { type: 'text/plain;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `UTI_Exportacion_${new Date().toISOString().split('T')[0]}.txt`,
  });
  a.click(); URL.revokeObjectURL(a.href);
}

// ─── Componente: doble fecha de evolución ─────────────────────────────────────
function FechasEvolucion({ ev, compact = false }) {
  const carga  = ev.fechaReal || ev.fechaCarga;
  const tardia = esCargaTardia(ev.fechaDoc, carga);

  if (compact) {
    return (
      <div className={styles.fechasCompact}>
        <span className={styles.fechaDocTag} title="Fecha clínica documentada">
          <Calendar size={9} /> {ev.fechaDoc}
        </span>
        {carga && (
          <span
            className={[styles.fechaCargaTag, tardia ? styles.fechaTardiaTag : ''].join(' ')}
            title={`Cargado en sistema: ${carga}${tardia ? ' · Carga tardía' : ''}`}
          >
            <Clock size={9} /> {carga}
            {tardia && <AlertTriangle size={9} />}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={styles.fechasBlock}>
      <div className={styles.fechaBlockRow}>
        <span className={styles.fechaBlockKey}><Calendar size={11} /> Fecha clínica</span>
        <span className={styles.fechaBlockDocVal}>{ev.fechaDoc}</span>
      </div>
      <div className={styles.fechaBlockRow}>
        <span className={styles.fechaBlockKey}><Clock size={11} /> Cargado en sistema</span>
        <span className={[styles.fechaBlockSysVal, tardia ? styles.fechaBlockTardia : ''].join(' ')}>
          {carga || '—'}
          {tardia && (
            <span className={styles.tardiaChip}>
              <AlertTriangle size={10} /> Carga tardía
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

// ─── Modal Historia Clínica ───────────────────────────────────────────────────
function HistoriaModal({ paciente, onClose, onReingresar, sessionUser }) {
  const [copiedWA, setCopiedWA] = useState(false);
  const [copiedTxt, setCopiedTxt] = useState(false);
  const [reingresando, setReingresando] = useState(false);

  const evoluciones = [...(paciente?.evoluciones || [])].sort(
    (a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc)
  );

  const handleCopyWA = async () => {
    const evs = [...(paciente.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));
    const lines = [
      `*${paciente.paciente}* — Cama ${paciente.cama}`,
      `Ingreso: ${paciente.fechaIngreso} (${calcDias(paciente.fechaIngreso)} días)`,
      `Dr. ingreso: ${paciente.medicoIngreso || '—'}`,
      '', '*📅 Evoluciones:*',
    ];
    evs.forEach(ev => {
      const carga = ev.fechaReal || ev.fechaCarga;
      const tardia = esCargaTardia(ev.fechaDoc, carga);
      lines.push('');
      lines.push(`*Fecha clínica: ${ev.fechaDoc}* — _Dr. ${ev.medicoEvolucion || '—'}_`);
      lines.push(`_Cargado en sistema: ${carga || '—'}${tardia ? ' ⚠ carga tardía' : ''}_`);
      lines.push(ev.texto || '—');
    });
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedWA(true); setTimeout(() => setCopiedWA(false), 2500);
  };

  const handleCopyTxt = async () => {
    const txt = evoluciones.map((ev, i) => {
      const carga = ev.fechaReal || ev.fechaCarga;
      return `[${i+1}] Clínica: ${ev.fechaDoc} | Sistema: ${carga||'—'}${esCargaTardia(ev.fechaDoc,carga)?'  [!]':''} | Dr. ${ev.medicoEvolucion||'—'}\n${ev.texto||'—'}`;
    }).join('\n\n');
    await navigator.clipboard.writeText(txt);
    setCopiedTxt(true); setTimeout(() => setCopiedTxt(false), 2500);
  };

  if (!paciente) return null;
  const dias = calcDias(paciente.fechaIngreso);
  const { label, cls } = estadoPaciente(paciente);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <FileText size={18} />
            <div>
              <div className={styles.modalPatientName}>{paciente.paciente}</div>
              <div className={styles.modalPatientSub}>
                Cama {paciente.cama}&nbsp;·&nbsp;{dias} día{dias!==1?'s':''}
                {paciente.obraSocial && <>&nbsp;·&nbsp;{paciente.obraSocial}</>}
                <span className={[styles.estadoBadge, styles[`estado${cls[0].toUpperCase()+cls.slice(1)}`]].join(' ')} style={{marginLeft:6}}>{label}</span>
              </div>
            </div>
          </div>
          <div className={styles.modalHeaderRight}>
            <button className={[styles.mBtn, styles.mBtnWA].join(' ')} onClick={handleCopyWA}>
              {copiedWA ? <Check size={12}/> : <MessageCircle size={12}/>} {copiedWA ? '¡Copiado!' : 'WA'}
            </button>
            <button className={[styles.mBtn, styles.mBtnCopy].join(' ')} onClick={handleCopyTxt}>
              {copiedTxt ? <Check size={12}/> : <Copy size={12}/>} {copiedTxt ? '¡Copiado!' : 'Copiar'}
            </button>
            <button className={[styles.mBtn, styles.mBtnPDF].join(' ')} onClick={() => exportarPDF(paciente)}>
              <Printer size={12}/> PDF
            </button>
            <button className={[styles.mBtn, styles.mBtnTXT].join(' ')} onClick={() => exportarTXT(paciente)}>
              <Download size={12}/> .txt
            </button>
            {sessionUser?.TipoEmpleado === 'ADM' && (
              <button className={[styles.mBtn, styles.mBtnReingresar].join(' ')} onClick={async()=>{setReingresando(true);await onReingresar(paciente);setReingresando(false);}} disabled={reingresando}>
                <RefreshCw size={12}/> {reingresando?'...':'Reingresar'}
              </button>
            )}
            <button className={styles.modalCloseBtn} onClick={onClose}><XCircle size={16}/></button>
          </div>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {/* Admisión */}
          <div className={styles.resumenSection}>
            <div className={styles.resumenSectionTitle}><UserCheck size={13}/> Admisión</div>
            <div className={styles.resumenGrid}>
              {[['Médico de ingreso', paciente.medicoIngreso?`Dr. ${paciente.medicoIngreso}`:null],['Fecha de ingreso',paciente.fechaIngreso],['Motivo de ingreso',paciente.motivoIngreso],['Obra Social',paciente.obraSocial]].map(([l,v])=>v?(
                <div key={l} className={styles.resumenField}>
                  <span className={styles.resumenFieldLabel}>{l}</span>
                  <span className={styles.resumenFieldValue}>{v}</span>
                </div>
              ):null)}
            </div>
          </div>

          {/* Clínico */}
          <div className={styles.resumenSection}>
            <div className={styles.resumenSectionTitle}><Stethoscope size={13}/> Estado Clínico</div>
            <div className={styles.resumenGrid}>
              {[['Diagnóstico actual',paciente.diagnosticoActual],['Antecedentes',paciente.antecedentes],['Tratamiento actual',paciente.tratamientoActual],['Pendientes',paciente.pendientes]].map(([l,v])=>v?(
                <div key={l} className={styles.resumenField}>
                  <span className={styles.resumenFieldLabel}>{l}</span>
                  <span className={styles.resumenFieldValue}>{v}</span>
                </div>
              ):null)}
            </div>
          </div>

          {/* Exámenes */}
          {paciente.examenes && (
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}><FlaskConical size={13}/> Exámenes</div>
              <p className={styles.resumenPre}>{paciente.examenes}</p>
            </div>
          )}

          {/* Evoluciones con doble fecha */}
          <div className={styles.resumenSection}>
            <div className={styles.resumenSectionTitle}><Activity size={13}/> Evoluciones ({evoluciones.length})</div>
            <div className={styles.evoLeyenda}>
              <span><Calendar size={10}/> <strong>Fecha clínica</strong>: documentada por el médico</span>
              <span className={styles.leyendaSep}>|</span>
              <span><Clock size={10}/> <strong>Cargado en sistema</strong>: registro real</span>
              <span className={styles.leyendaSep}>|</span>
              <span className={styles.tardiaChipSmall}><AlertTriangle size={9}/> Carga tardía</span>
            </div>
            {evoluciones.length === 0 ? (
              <p className={styles.resumenEmpty}>Sin evoluciones registradas.</p>
            ) : (
              <div className={styles.evoTimeline}>
                {evoluciones.map((ev, i) => (
                  <div key={i} className={styles.evoTimelineItem}>
                    <div className={styles.evoTimelineDot}/>
                    <div style={{flex:1}}>
                      <div className={styles.evoTimelineHeader}>
                        <FechasEvolucion ev={ev}/>
                        {ev.medicoEvolucion && <span className={styles.evoTimelineDoctor}>Dr. {ev.medicoEvolucion}</span>}
                      </div>
                      <p className={styles.evoTimelineText}>{ev.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alta / Traslado */}
          {paciente.fechaAlta && (
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}><Home size={13}/> Alta</div>
              <div className={styles.resumenGrid}>
                <div className={styles.resumenField}><span className={styles.resumenFieldLabel}>Fecha alta</span><span className={styles.resumenFieldValue}>{fmtFecha(paciente.fechaAlta)}</span></div>
                {paciente.medicoAlta&&<div className={styles.resumenField}><span className={styles.resumenFieldLabel}>Médico</span><span className={styles.resumenFieldValue}>Dr. {paciente.medicoAlta}</span></div>}
                {paciente.motivoAlta&&<div className={styles.resumenField} style={{gridColumn:'span 2'}}><span className={styles.resumenFieldLabel}>Motivo</span><span className={styles.resumenFieldValue}>{paciente.motivoAlta}</span></div>}
              </div>
            </div>
          )}
          {paciente.fechaTraslado && (
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}><Truck size={13}/> Traslado</div>
              <div className={styles.resumenGrid}>
                <div className={styles.resumenField}><span className={styles.resumenFieldLabel}>Fecha traslado</span><span className={styles.resumenFieldValue}>{fmtFecha(paciente.fechaTraslado)}</span></div>
                {paciente.medicoTraslado&&<div className={styles.resumenField}><span className={styles.resumenFieldLabel}>Médico</span><span className={styles.resumenFieldValue}>Dr. {paciente.medicoTraslado}</span></div>}
                {paciente.destinoTraslado&&<div className={styles.resumenField}><span className={styles.resumenFieldLabel}>Destino</span><span className={styles.resumenFieldValue}>{paciente.destinoTraslado}</span></div>}
                {paciente.motivoTraslado&&<div className={styles.resumenField} style={{gridColumn:'span 2'}}><span className={styles.resumenFieldLabel}>Motivo</span><span className={styles.resumenFieldValue}>{paciente.motivoTraslado}</span></div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Gráfico barras ───────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  const COLORS = ['#185FA5','#1D9E75','#7F77DD','#D85A30','#BA7517'];
  return (
    <div className={styles.barChartWrap}>
      {data.map((d,i) => (
        <div key={d.label} className={styles.barChartRow}>
          <span className={styles.barChartLabel}>{d.label}</span>
          <div className={styles.barChartTrack}>
            <div className={styles.barChartFill} style={{width:`${(d.value/max)*100}%`,background:COLORS[i%COLORS.length]}}/>
          </div>
          <span className={styles.barChartVal}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Timeline item ────────────────────────────────────────────────────────────
function TimelineItem({ tipo, fecha, paciente, medico, texto, cama, ev }) {
  const dotCls = {evol:styles.tlDotEvol,alta:styles.tlDotAlta,traslado:styles.tlDotTraslado,ingreso:styles.tlDotIngreso}[tipo]||styles.tlDotEvol;
  const tipoLabel = {evol:'Evolución',alta:'Alta médica',traslado:'Traslado',ingreso:'Ingreso'};
  return (
    <div className={styles.tlItem}>
      <div className={[styles.tlDot,dotCls].join(' ')}/>
      <div className={styles.tlContent}>
        <div className={styles.tlMeta}><strong>{paciente}</strong>&nbsp;·&nbsp;Cama {cama}&nbsp;·&nbsp;{fecha}</div>
        {ev && tipo==='evol' && <FechasEvolucion ev={ev} compact/>}
        {texto && <div className={styles.tlBody}>{texto}</div>}
        <div className={styles.tlTags}>
          <span className={styles.tlTag}>{tipoLabel[tipo]}</span>
          {medico && <span className={styles.tlTag}>Dr. {medico}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AdminUtiPage() {
  const router = useRouter();
  const [sessionUser,   setSessionUser]   = useState(null);
  const [sessionLoading,setSessionLoading]= useState(true);
  const [pacientes,     setPacientes]     = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [filtro,        setFiltro]        = useState('todos');
  const [busqueda,      setBusqueda]      = useState('');
  const [pacienteModal, setPacienteModal] = useState(null);
  const [vista,         setVista]         = useState('tabla');
  const [seleccionados, setSeleccionados] = useState(new Set());

  useEffect(() => {
    const s = getSession();
    if (!s || (s.TipoEmpleado!=='ADM' && s.TipoEmpleado!=='UTI')) router.push('/login');
    else { setSessionUser(s); setSessionLoading(false); }
  }, [router]);

  useEffect(() => {
    const utiRef = ref(db,'UTI');
    return onValue(utiRef, snap => {
      const d = snap.val();
      setPacientes(d ? Object.entries(d).map(([id,v])=>({id,...v})) : []);
      setLoading(false);
    });
  }, []);

  const handleReingresar = useCallback(async (po) => {
    try {
      const ocupadas = pacientes.filter(p=>p.activo&&!p.fechaAlta&&!p.fechaTraslado).map(p=>p.cama);
      let libre=null; for(let i=1;i<=5;i++) if(!ocupadas.includes(i)){libre=i;break;}
      if(!libre){alert('No hay camas disponibles.');return;}
      await update(push(ref(db,'UTI')),{
        paciente:po.paciente, obraSocial:po.obraSocial||'',
        medicoIngreso:sessionUser.nombre||sessionUser.user,
        fechaIngreso:new Date().toISOString().split('T')[0],
        motivoIngreso:'',diagnosticoActual:'',
        antecedentes:po.antecedentes||'',
        tratamientoActual:'',examenes:'',pendientes:'',
        evoluciones:[],cama:libre,activo:true,
        ultimaActualizacion:new Date().toISOString(),
      });
      setPacienteModal(null); router.push('/uti');
    } catch(e){console.error(e);alert('Error al reingresar');}
  },[pacientes,sessionUser,router]);

  const pacientesFiltrados = pacientes.filter(p => {
    if (filtro==='activos' && (!p.activo||p.fechaAlta||p.fechaTraslado)) return false;
    if (filtro==='altas'   && !p.fechaAlta)     return false;
    if (filtro==='traslados' && !p.fechaTraslado) return false;
    if (busqueda.trim()) {
      const q=busqueda.toLowerCase();
      return (p.paciente||'').toLowerCase().includes(q) ||
        (p.medicoIngreso||'').toLowerCase().includes(q) ||
        (p.obraSocial||'').toLowerCase().includes(q) ||
        (p.evoluciones||[]).some(ev=>(ev.medicoEvolucion||'').toLowerCase().includes(q)||(ev.texto||'').toLowerCase().includes(q));
    }
    return true;
  });

  const toggleSel = id => setSeleccionados(prev=>{const n=new Set(prev);n.has(id)?n.delete(id):n.add(id);return n;});
  const toggleTodos = () => setSeleccionados(seleccionados.size===pacientesFiltrados.length?new Set():new Set(pacientesFiltrados.map(p=>p.id)));
  const selArr = pacientesFiltrados.filter(p=>seleccionados.has(p.id));

  const stats = {
    total:     pacientes.length,
    activos:   pacientes.filter(p=>p.activo&&!p.fechaAlta&&!p.fechaTraslado).length,
    altas:     pacientes.filter(p=>p.fechaAlta).length,
    traslados: pacientes.filter(p=>p.fechaTraslado).length,
    totalEvos: pacientes.reduce((a,p)=>a+(p.evoluciones||[]).length,0),
    tardias:   pacientes.reduce((a,p)=>a+(p.evoluciones||[]).filter(ev=>esCargaTardia(ev.fechaDoc,ev.fechaReal||ev.fechaCarga)).length,0),
  };

  const evosPorMedico = {};
  pacientes.forEach(p=>(p.evoluciones||[]).forEach(ev=>{const k=ev.medicoEvolucion||'(s/n)';evosPorMedico[k]=(evosPorMedico[k]||0)+1;}));
  const medicosList = Object.entries(evosPorMedico).sort((a,b)=>b[1]-a[1]).map(([label,value])=>({label,value}));
  const camasList   = [1,2,3,4,5].map(c=>({label:`Cama ${c}`,value:pacientes.filter(p=>p.cama===c).length}));

  const todosEventos = [];
  pacientes.forEach(p=>{
    (p.evoluciones||[]).forEach(ev=>{
      const carga=ev.fechaReal||ev.fechaCarga;
      todosEventos.push({tipo:'evol',fecha:carga||ev.fechaDoc,paciente:p.paciente,medico:ev.medicoEvolucion,texto:ev.texto,cama:p.cama,ev,_sk:parseFechaCarga(carga)||new Date(ev.fechaDoc)});
    });
    if(p.fechaIngreso)  todosEventos.push({tipo:'ingreso',  fecha:p.fechaIngreso,            paciente:p.paciente,medico:p.medicoIngreso,  texto:p.motivoIngreso||'',       cama:p.cama,_sk:new Date(p.fechaIngreso)});
    if(p.fechaAlta)     todosEventos.push({tipo:'alta',     fecha:fmtFecha(p.fechaAlta),     paciente:p.paciente,medico:p.medicoAlta,     texto:p.motivoAlta||'',          cama:p.cama,_sk:new Date(p.fechaAlta)});
    if(p.fechaTraslado) todosEventos.push({tipo:'traslado', fecha:fmtFecha(p.fechaTraslado), paciente:p.paciente,medico:p.medicoTraslado, texto:`Destino: ${p.destinoTraslado||'—'}`,cama:p.cama,_sk:new Date(p.fechaTraslado)});
  });
  todosEventos.sort((a,b)=>(b._sk||0)-(a._sk||0));

  if (sessionLoading) return (<><Header/><div className={styles.loadingWrapper}><div className={styles.spinner}/><span>Cargando...</span></div></>);
  if (!sessionUser) return null;

  return (
    <>
      <Header/>
      <div className={styles.wrapper}>

        {/* Header */}
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <BarChart2 size={22} className={styles.headerIcon}/>
            <div>
              <h1 className={styles.pageTitle}>Dashboard UTI</h1>
              <p className={styles.pageSubtitle}>Historial completo · Clínica de la Unión S.A.</p>
            </div>
          </div>
          <div className={styles.pageHeaderRight}>
            <span className={styles.userInfo}><User size={14}/> {sessionUser.nombre||sessionUser.user}</span>
            <button className={styles.logoutBtn} onClick={()=>{clearSession();router.push('/login');}}><LogOut size={14}/> Salir</button>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsBar}>
          {[
            {label:'Activos en UTI',     value:stats.activos,   icon:<Activity size={14}/>,      cls:styles.statValueRed},
            {label:'Total ingresos',     value:stats.total,     icon:<Users size={14}/>,          cls:styles.statValueBlue},
            {label:'Altas otorgadas',    value:stats.altas,     icon:<Home size={14}/>,           cls:styles.statValueGreen},
            {label:'Traslados',          value:stats.traslados, icon:<Truck size={14}/>,          cls:styles.statValueAmber},
            {label:'Total evoluciones',  value:stats.totalEvos, icon:<FileText size={14}/>,       cls:styles.statValueBlue},
            {label:'Cargas tardías',     value:stats.tardias,   icon:<AlertTriangle size={14}/>,  cls:styles.statValueAmber},
          ].map(s=>(
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statIcon}>{s.icon}</div>
              <div className={[styles.statValue,s.cls].join(' ')}>{s.value}</div>
              <div className={styles.statLabel}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className={styles.chartsRow}>
          <div className={styles.chartCard}>
            <div className={styles.chartCardTitle}><TrendingUp size={13}/> Evoluciones por médico</div>
            {medicosList.length>0?<BarChart data={medicosList}/>:<p className={styles.noData}>Sin datos</p>}
          </div>
          <div className={styles.chartCard}>
            <div className={styles.chartCardTitle}><BarChart2 size={13}/> Ingresos por cama</div>
            <BarChart data={camasList}/>
          </div>
        </div>

        {/* View tabs */}
        <div className={styles.viewTabs}>
          <button className={[styles.viewTab,vista==='tabla'?styles.viewTabActive:''].join(' ')} onClick={()=>setVista('tabla')}><FileText size={13}/> Historial</button>
          <button className={[styles.viewTab,vista==='timeline'?styles.viewTabActive:''].join(' ')} onClick={()=>setVista('timeline')}><Activity size={13}/> Timeline</button>
        </div>

        {/* ── TABLA ── */}
        {vista==='tabla' && (
          <div className={styles.tableSection}>
            <div className={styles.filtersBar}>
              <div className={styles.searchBox}>
                <Search size={14} className={styles.searchIcon}/>
                <input type="text" placeholder="Buscar paciente, médico, obra social..." value={busqueda} onChange={e=>setBusqueda(e.target.value)} className={styles.searchInput}/>
                {busqueda&&<button className={styles.searchClear} onClick={()=>setBusqueda('')}><XCircle size={13}/></button>}
              </div>
              <div className={styles.filterTabs}>
                {[{id:'todos',label:'Todos'},{id:'activos',label:'Activos'},{id:'altas',label:'Altas'},{id:'traslados',label:'Traslados'}].map(f=>(
                  <button key={f.id} className={[styles.filterTab,filtro===f.id?styles.filterTabActive:''].join(' ')} onClick={()=>setFiltro(f.id)}>{f.label}</button>
                ))}
              </div>
            </div>

            {/* Barra exportación masiva */}
            <div className={styles.exportBar}>
              <span className={styles.tableCount}>
                {pacientesFiltrados.length} registro{pacientesFiltrados.length!==1?'s':''}
                {seleccionados.size>0&&` · ${seleccionados.size} seleccionado${seleccionados.size!==1?'s':''}`}
              </span>
              <div className={styles.exportActions}>
                {seleccionados.size>0 && (
                  <>
                    <button className={[styles.exportBtn,styles.exportBtnPDF].join(' ')} onClick={()=>exportarPDFMultiple(selArr)}>
                      <Printer size={12}/> PDF ({seleccionados.size})
                    </button>
                    <button className={[styles.exportBtn,styles.exportBtnTXT].join(' ')} onClick={()=>exportarTXTMultiple(selArr)}>
                      <Download size={12}/> .txt ({seleccionados.size})
                    </button>
                    <button className={styles.exportBtnClear} onClick={()=>setSeleccionados(new Set())}>
                      <XCircle size={11}/> Limpiar
                    </button>
                  </>
                )}
              </div>
            </div>

            {loading ? (
              <div className={styles.loadingWrapper}><div className={styles.spinner}/><span>Cargando...</span></div>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>
                        <button className={styles.checkBtn} onClick={toggleTodos}>
                          {seleccionados.size===pacientesFiltrados.length&&pacientesFiltrados.length>0?<CheckSquare size={13}/>:<Square size={13}/>}
                        </button>
                      </th>
                      <th>Paciente</th>
                      <th>Cama</th>
                      <th>Ingreso</th>
                      <th>Médico ingreso</th>
                      <th>Días</th>
                      <th>Evols.</th>
                      <th>Último médico evo.</th>
                      <th>Fecha clínica ult. evo.</th>
                      <th>Cargado en sistema</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pacientesFiltrados.length===0 ? (
                      <tr><td colSpan="12" className={styles.noData}>No se encontraron pacientes</td></tr>
                    ) : pacientesFiltrados.map(p=>{
                      const dias=calcDias(p.fechaIngreso);
                      const {label,cls}=estadoPaciente(p);
                      const ultEv=ultimaEvolucion(p);
                      const cargaStr=ultEv?(ultEv.fechaReal||ultEv.fechaCarga):null;
                      const tardia=ultEv?esCargaTardia(ultEv.fechaDoc,cargaStr):false;
                      const isSel=seleccionados.has(p.id);
                      return (
                        <tr key={p.id} className={isSel?styles.rowSelected:''}>
                          <td><button className={styles.checkBtn} onClick={()=>toggleSel(p.id)}>{isSel?<CheckSquare size={13}/>:<Square size={13}/>}</button></td>
                          <td className={styles.pacienteCell}>{p.paciente||'—'}</td>
                          <td>{p.cama||'—'}</td>
                          <td>{p.fechaIngreso||'—'}</td>
                          <td>{p.medicoIngreso?`Dr. ${p.medicoIngreso}`:'—'}</td>
                          <td>{dias}</td>
                          <td className={styles.evoCount}>{(p.evoluciones||[]).length}</td>
                          <td className={styles.medicoCell}>{ultEv?`Dr. ${ultEv.medicoEvolucion}`:'—'}</td>
                          <td className={styles.fechaDocCell}>{ultEv?ultEv.fechaDoc:'—'}</td>
                          <td>
                            {cargaStr?(
                              <span className={[styles.cargaCell,tardia?styles.cargaTardia:''].join(' ')}>
                                {cargaStr}
                                {tardia&&<AlertTriangle size={11} className={styles.alertIconTable} title="Cargado en día distinto a la evolución"/>}
                              </span>
                            ):'—'}
                          </td>
                          <td><span className={[styles.estadoBadge,styles[`estado${cls[0].toUpperCase()+cls.slice(1)}`]].join(' ')}>{label}</span></td>
                          <td>
                            <div className={styles.rowActions}>
                              <button className={styles.actionBtn} onClick={()=>setPacienteModal(p)} title="Ver historia"><FileText size={12}/></button>
                              <button className={styles.actionBtn} onClick={()=>exportarPDF(p)} title="PDF"><Printer size={12}/></button>
                              <button className={styles.actionBtn} onClick={()=>exportarTXT(p)} title=".txt"><Download size={12}/></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TIMELINE ── */}
        {vista==='timeline' && (
          <div className={styles.timelineSection}>
            <div className={styles.timelineHeader}>
              <span className={styles.timelineTitle}><Clock size={13}/> Actividad — {todosEventos.length} eventos</span>
            </div>
            {todosEventos.length===0?<p className={styles.noData}>Sin actividad.</p>:(
              <div className={styles.timelineList}>
                {todosEventos.map((ev,i)=><TimelineItem key={i} {...ev}/>)}
              </div>
            )}
          </div>
        )}
      </div>

      {pacienteModal&&(
        <HistoriaModal
          paciente={pacienteModal}
          onClose={()=>setPacienteModal(null)}
          onReingresar={handleReingresar}
          sessionUser={sessionUser}
        />
      )}
    </>
  );
}
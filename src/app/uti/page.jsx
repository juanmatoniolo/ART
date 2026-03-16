'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, onValue, push, update } from 'firebase/database';
import { useOfflineQueue } from './useOfflineQueue';
import {
  Activity, User, Calendar, FileText, Printer,
  Copy, Check, LogOut, Search, XCircle, Home,
  Truck, FlaskConical, Stethoscope,
  UserCheck, BarChart2, Clock, TrendingUp, Users,
  AlertTriangle, AlertCircle, ChevronDown, ChevronUp,
  ArrowLeft, PlusCircle, Edit3, Save, RotateCcw,
  MessageCircle, Wifi, WifiOff, RefreshCw, MapPin,
} from 'lucide-react';
import Header from '@/components/Header/Header';
import styles from './page.module.css';

// ─── Constantes ───────────────────────────────────────────────────────────────
const TOTAL_CAMAS = 5;
const CAMAS = [1, 2, 3, 4, 5];

const TABS_FORM = [
  { id: 'datos', label: 'Datos', Icon: User },
  { id: 'clinico', label: 'Clínico', Icon: Stethoscope },
  { id: 'evolucion', label: 'Evolución', Icon: Activity },
  { id: 'examenes', label: 'Exámenes', Icon: FlaskConical },
];

const FORM_DEFAULTS = {
  paciente: '', medicoIngreso: '', obraSocial: '', dni: '',
  fechaIngreso: new Date().toISOString().split('T')[0],
  motivoIngreso: '', diagnosticoActual: '', antecedentes: '',
  tratamientoActual: '', examenes: '', pendientes: '',
  evolucionFechaDoc: new Date().toISOString().split('T')[0],
  evolucionTexto: '', medicoEvolucion: '',
};

// ─── Helpers de fecha (unificados) ────────────────────────────────────────────
function parseFechaFlexible(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const str = String(value).trim();
  if (!str) return null;

  // dd/mm/yyyy hh:mm
  let m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  // dd/mm/yyyy
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  // yyyy-mm-dd
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const date = typeof dateString === 'string' ? parseFechaFlexible(dateString) : dateString;
  if (!date) return String(dateString);

  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  const horas = String(date.getHours()).padStart(2, '0');
  const minutos = String(date.getMinutes()).padStart(2, '0');

  if (date.getHours() !== 0 || date.getMinutes() !== 0) {
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  }
  return `${dia}/${mes}/${anio}`;
}

function fmtFecha(value) {
  return formatDate(value);
}

function calcDias(fechaIngreso) {
  if (!fechaIngreso) return 0;
  return Math.max(0, Math.floor((new Date().getTime() - new Date(fechaIngreso).getTime()) / 86400000));
}

function esCargaTardia(fechaDoc, fechaCarga) {
  if (!fechaDoc || !fechaCarga) return false;
  const dDoc = parseFechaFlexible(fechaDoc);
  const dCarga = parseFechaFlexible(fechaCarga);
  if (!dDoc || !dCarga) return false;
  return (
    dDoc.getFullYear() !== dCarga.getFullYear() ||
    dDoc.getMonth() !== dCarga.getMonth() ||
    dDoc.getDate() !== dCarga.getDate()
  );
}

function toDateOnly(value) {
  const parsed = parseFechaFlexible(value);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function nowFormatted() {
  return formatDate(new Date());
}

// ─── Estado del paciente ──────────────────────────────────────────────────────
function estadoPaciente(p) {
  if (p.fechaAlta) return { label: 'Alta', cls: 'alta' };
  if (p.fechaTraslado) return { label: 'Traslado', cls: 'traslado' };
  if (p.activo === false) return { label: 'Inactivo', cls: 'inactivo' };
  return { label: 'Activo', cls: 'activo' };
}

function ultimaEvolucion(p) {
  const evs = p.evoluciones || [];
  if (!evs.length) return null;
  return [...evs].sort((a, b) => {
    const ka = parseFechaFlexible(a.fechaReal || a.fechaCarga) || parseFechaFlexible(a.fechaDoc);
    const kb = parseFechaFlexible(b.fechaReal || b.fechaCarga) || parseFechaFlexible(b.fechaDoc);
    return (kb?.getTime() || 0) - (ka?.getTime() || 0);
  })[0];
}

function agruparIngresos(todos, nombre) {
  return todos
    .filter(p => p.paciente === nombre)
    .sort((a, b) => new Date(a.fechaIngreso || 0).getTime() - new Date(b.fechaIngreso || 0).getTime())
    .map((p, i) => ({ ...p, nroIngreso: i + 1 }));
}

// ─── Generadores de texto para copiar ─────────────────────────────────────────
function generarTextoPlano(paciente) {
  if (!paciente) return '';
  const dias = calcDias(paciente.fechaIngreso);
  const sep = '─'.repeat(40);
  const evols = [...(paciente.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc).getTime() - new Date(b.fechaDoc).getTime());
  const lines = [
    '🏥 HISTORIA CLÍNICA — UTI',
    'Clínica de la Unión S.A.',
    `Fecha: ${formatDate(new Date())}`,
    sep, '',
    `Paciente : ${paciente.paciente || '—'}`,
    `DNI      : ${paciente.dni || '—'}`,
    `Médico   : Dr. ${paciente.medicoIngreso || '—'}`,
    `Obra Soc.: ${paciente.obraSocial || '—'}`,
    `Cama     : ${paciente.cama}`,
    `Ingreso  : ${formatDate(paciente.fechaIngreso) || '—'} (${dias} días)`,
    `Motivo   : ${paciente.motivoIngreso || '—'}`,
    sep,
    `Diagnóstico:\n${paciente.diagnosticoActual || '—'}`, '',
    `Antecedentes:\n${paciente.antecedentes || '—'}`, '',
    `Tratamiento:\n${paciente.tratamientoActual || '—'}`, '',
    `Pendientes:\n${paciente.pendientes || '—'}`,
  ];
  if (paciente.examenes) lines.push('', sep, '🔬 EXÁMENES', paciente.examenes);
  if (evols.length) {
    lines.push('', sep, `📅 EVOLUCIONES (${evols.length})`);
    evols.forEach((ev, i) => lines.push(
      '', `[${i + 1}] ${formatDate(ev.fechaDoc)} — Dr. ${ev.medicoEvolucion || '—'}`,
      `Cargado: ${formatDate(ev.fechaReal) || '—'}`, ev.texto || '—'
    ));
  }
  lines.push('', sep, 'Fin de historia clínica.');
  return lines.join('\n');
}

function generarTextoWA(paciente) {
  const evols = [...(paciente.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc).getTime() - new Date(b.fechaDoc).getTime());
  const dias = calcDias(paciente.fechaIngreso);
  const lines = [
    `*${paciente.paciente}* — Cama ${paciente.cama}`,
    `Ingreso: ${formatDate(paciente.fechaIngreso)} (${dias} días)`,
    `Dr. ingreso: ${paciente.medicoIngreso || '—'}`,
    '', '*📅 Evoluciones:*',
  ];
  evols.forEach(ev => lines.push(
    '', `*${formatDate(ev.fechaDoc)}* — _Dr. ${ev.medicoEvolucion || '—'}_`,
    `_(cargado: ${formatDate(ev.fechaReal) || '—'})_`, ev.texto || '—'
  ));
  return lines.join('\n');
}

// ─── Impresión de historia completa ───────────────────────────────────────────
const PRINT_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#111;padding:20px 28px;line-height:1.6}
  h1{font-size:15px;color:#0f2a56;font-weight:700}.sub{font-size:11px;color:#555;margin-top:2px}
  .ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a3a6b;padding-bottom:10px;margin-bottom:16px}
  .pm{text-align:right;font-size:10px;color:#555}
  .bloque{margin-bottom:18px;page-break-inside:avoid;border:1px solid #dbeafe;border-radius:8px;overflow:hidden}
  .bh{background:#1a3a6b;color:#fff;padding:8px 12px;font-size:11px;font-weight:700;display:flex;justify-content:space-between}
  .bh .badge{background:rgba(255,255,255,.2);padding:1px 10px;border-radius:20px;font-size:10px}
  .sec{padding:9px 12px;border-bottom:1px solid #e2e8f0}.sec:last-child{border-bottom:none}
  .st{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#1a3a6b;margin-bottom:6px}
  .g2{display:grid;grid-template-columns:1fr 1fr;gap:5px 14px}
  .f label{font-size:9.5px;font-weight:700;color:#64748b;text-transform:uppercase;display:block;margin-bottom:1px}
  .f span{font-size:11px;white-space:pre-wrap}
  .ei{border-left:3px solid #2563a8;padding:6px 10px;margin-bottom:7px;background:#f8fafc;border-radius:0 4px 4px 0}
  .ei:last-child{margin-bottom:0}
  .ed{font-size:10px;font-weight:700;color:#2563a8;margin-bottom:2px;display:flex;flex-wrap:wrap;gap:6px;align-items:center}
  .edr{color:#5b21b6;background:#f5f3ff;padding:1px 8px;border-radius:20px;font-size:9.5px}
  .late{color:#92400e;background:#fef3c7;border:1px solid #fcd34d;padding:1px 7px;border-radius:20px;font-size:9.5px}
  .efecrow{font-size:10px;margin-bottom:2px;display:flex;gap:10px;flex-wrap:wrap}
  .fc{color:#1e40af;font-weight:600}.fs{color:#475569}
  .et{font-size:11px;white-space:pre-wrap;color:#1e293b}
  .no-evs{color:#94a3b8;font-style:italic;font-size:11px}
  .footer{margin-top:20px;border-top:1px solid #e2e8f0;padding-top:8px;font-size:9.5px;color:#94a3b8;text-align:center}
  @media print{body{padding:0}@page{margin:14mm}}
`;

function buildHTMLIngreso(p, nro, total) {
  const dias = calcDias(p.fechaIngreso);
  const evols = [...(p.evoluciones || [])].sort((a, b) => {
    const da = parseFechaFlexible(a.fechaDoc) || new Date(0);
    const db = parseFechaFlexible(b.fechaDoc) || new Date(0);
    return da.getTime() - db.getTime();
  });
  const { label } = estadoPaciente(p);

  const field = (lbl, val) =>
    val
      ? `<div class="f"><label>${lbl}</label><span>${String(val).replace(/</g, '&lt;')}</span></div>`
      : '';

  const evsHtml = evols.map((ev, i) => {
    const carga = ev.fechaReal || ev.fechaCarga;
    const t = esCargaTardia(ev.fechaDoc, carga);

    return `
      <div class="ei">
        <div class="ed">
          Evolución ${i + 1}
          <span class="edr">Dr. ${ev.medicoEvolucion || '—'}</span>
          ${t ? `<span class="late">⚠ Carga tardía</span>` : ''}
        </div>
        <div class="efecrow">
          <span><span class="fc">Fecha clínica:</span> ${fmtFecha(ev.fechaDoc)}</span>
          <span><span class="fs">Cargado:</span> ${fmtFecha(carga)}</span>
        </div>
        <div class="et">${(ev.texto || '—').replace(/\n/g, '<br/>')}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="bloque">
      <div class="bh">
        <span>Ingreso ${nro} de ${total}</span>
        <span class="badge">${fmtFecha(p.fechaIngreso)} · Cama ${p.cama} · ${label}</span>
      </div>

      <div class="sec">
        <div class="st">Admisión</div>
        <div class="g2">
          ${field('Médico', p.medicoIngreso ? `Dr. ${p.medicoIngreso}` : null)}
          ${field('Fecha', fmtFecha(p.fechaIngreso))}
          ${field('Días', `${dias}d`)}
          ${field('Obra Social', p.obraSocial)}
          ${field('DNI', p.dni)}
          ${field('Motivo', p.motivoIngreso)}
          ${p.reingresoMedico ? field('Reingreso ADM', p.reingresoMedico) : ''}
        </div>
      </div>

      ${(p.diagnosticoActual || p.antecedentes || p.tratamientoActual || p.pendientes)
      ? `
          <div class="sec">
            <div class="st">Estado Clínico</div>
            <div class="g2">
              ${field('Diagnóstico', p.diagnosticoActual)}
              ${field('Antecedentes', p.antecedentes)}
              ${field('Tratamiento', p.tratamientoActual)}
              ${field('Pendientes', p.pendientes)}
            </div>
          </div>
        `
      : ''}

      ${p.examenes
      ? `
          <div class="sec">
            <div class="st">Exámenes</div>
            <div class="g2">
              ${field('Detalle', p.examenes)}
            </div>
          </div>
        `
      : ''}

      <div class="sec">
        <div class="st">Evoluciones (${evols.length})</div>
        ${evols.length ? evsHtml : '<p class="no-evs">Sin evoluciones.</p>'}
      </div>

      ${p.fechaAlta
      ? `
          <div class="sec">
            <div class="st">Alta</div>
            <div class="g2">
              ${field('Fecha', fmtFecha(p.fechaAlta))}
              ${field('Médico', p.medicoAlta ? `Dr. ${p.medicoAlta}` : null)}
              ${field('Motivo', p.motivoAlta)}
            </div>
          </div>
        `
      : ''}

      ${p.fechaTraslado
      ? `
          <div class="sec">
            <div class="st">Traslado</div>
            <div class="g2">
              ${field('Fecha', fmtFecha(p.fechaTraslado))}
              ${field('Médico', p.medicoTraslado ? `Dr. ${p.medicoTraslado}` : null)}
              ${field('Destino', p.destinoTraslado)}
              ${field('Motivo', p.motivoTraslado)}
            </div>
          </div>
        `
      : ''}
    </div>
  `;
}

function imprimirHistoriaCompleta(ingresos) {
  if (!ingresos.length) return;

  const win = window.open('', '_blank', 'width=960,height=800');
  if (!win) return;

  win.document.write(`
    <!DOCTYPE html>
    <html lang="es">
      <head>
        <meta charset="UTF-8"/>
        <title>HC — ${ingresos[0].paciente}</title>
        <style>${PRINT_CSS}</style>
      </head>
      <body>
        <div class="ph">
          <div>
            <h1>Historia Clínica — UTI</h1>
            <p class="sub">Clínica de la Unión S.A. · ${ingresos[0].paciente}</p>
            <p class="sub">${ingresos.length} ingreso${ingresos.length !== 1 ? 's' : ''}</p>
          </div>
          <div class="pm">Impreso: ${fmtFecha(new Date())}</div>
        </div>

        ${ingresos.map((p, i) => buildHTMLIngreso(p, i + 1, ingresos.length)).join('\n')}

        <div class="footer">Clínica de la Unión S.A. — ${fmtFecha(new Date())}</div>
      </body>
    </html>
  `);

  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ─── Gráfico de barras ────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className={styles.barChart}>
      {data.map(d => (
        <div key={d.label} className={styles.barRow}>
          <span className={styles.barLabel}>{d.label}</span>
          <div className={styles.barTrack}>
            <div className={styles.barFill} style={{ width: `${(d.value / max) * 100}%` }} />
          </div>
          <span className={styles.barVal}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Componentes modales y auxiliares ─────────────────────────────────────────

// Banner offline
function OfflineBanner({ online, pending, syncing, onSync }) {
  if (online && pending === 0) return null;
  return (
    <div className={[styles.offlineBanner, online ? styles.offlineBannerSync : styles.offlineBannerOffline].join(' ')}>
      <div className={styles.offlineBannerLeft}>
        {online ? <Wifi size={16} /> : <WifiOff size={16} />}
        <span>
          {!online && 'Sin conexión — los cambios se guardan en este dispositivo.'}
          {online && pending > 0 && `Conexión restaurada — ${pending} cambio${pending > 1 ? 's' : ''} pendiente${pending > 1 ? 's' : ''} de sincronizar.`}
        </span>
      </div>
      {online && pending > 0 && (
        <button className={styles.offlineSyncBtn} onClick={onSync} disabled={syncing}>
          <RefreshCw size={14} className={syncing ? styles.spinning : ''} />
          {syncing ? 'Sincronizando…' : 'Sincronizar'}
        </button>
      )}
    </div>
  );
}

// Modal de reingreso (con datos clínicos anteriores)
function ReingresarModal({ paciente, camasLibres, usuarioNombre, onConfirm, onCancel, saving }) {
  const [cama, setCama] = useState(camasLibres[0] || '');
  const [error, setError] = useState('');

  const handleOk = () => {
    if (!cama) {
      setError('Seleccioná una cama.');
      return;
    }
    onConfirm({ cama: Number(cama), medico: usuarioNombre });
  };

  return (
    <div className={styles.solidOverlay}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <PlusCircle size={20} />
          <span>Reingresar paciente</span>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.pacienteInfo}>
            <div className={styles.pacienteInfoIcon}><User size={18} /></div>
            <div>
              <p className={styles.pacienteInfoNombre}>{paciente.paciente}</p>
              <p className={styles.pacienteInfoSub}>
                Último ingreso: {fmtFecha(paciente.fechaIngreso)} · {paciente.obraSocial || 'Sin obra social'}
              </p>
            </div>
          </div>

          {/* Datos clínicos anteriores */}
          <div className={styles.datosPrevios}>
            <h4>Datos del ingreso anterior:</h4>
            <div className={styles.gridPrevios}>
              {paciente.diagnosticoActual && <div><label>Diagnóstico:</label> {paciente.diagnosticoActual}</div>}
              {paciente.antecedentes && <div><label>Antecedentes:</label> {paciente.antecedentes}</div>}
              {paciente.tratamientoActual && <div><label>Tratamiento:</label> {paciente.tratamientoActual}</div>}
              {paciente.examenes && <div><label>Exámenes:</label> {paciente.examenes}</div>}
              {paciente.pendientes && <div><label>Pendientes:</label> {paciente.pendientes}</div>}
            </div>
          </div>

          <div className={styles.adminNote}>
            <UserCheck size={14} />
            <span>Reingreso registrado a nombre de <strong>{usuarioNombre}</strong></span>
          </div>

          {camasLibres.length === 0 ? (
            <div className={styles.errorBanner}><AlertTriangle size={14} /> No hay camas disponibles.</div>
          ) : (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Seleccioná la cama destino *</label>
              <div className={styles.camaSelector}>
                {camasLibres.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={[styles.camaBtn, String(cama) === String(c) ? styles.camaBtnActive : ''].join(' ')}
                    onClick={() => setCama(c)}
                  >
                    Cama {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <div className={styles.errorBanner}><AlertTriangle size={13} /> {error}</div>}

          <p className={styles.reingresarNote}>
            Los datos clínicos se copian al nuevo ingreso. Las evoluciones anteriores quedan en el historial.
          </p>

          <div className={styles.modalActions}>
            <button type="button" className={[styles.btn, styles.btnGhost].join(' ')} onClick={onCancel}>
              <XCircle size={15} /> Cancelar
            </button>
            {camasLibres.length > 0 && (
              <button type="button" className={[styles.btn, styles.btnBlue].join(' ')} onClick={handleOk} disabled={saving}>
                <PlusCircle size={15} /> {saving ? 'Reingresando…' : 'Confirmar reingreso'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal de evolución
function EvolucionarModal({ paciente, usuarioNombre, onConfirm, onCancel, saving }) {
  const hoy = new Date().toISOString().split('T')[0];
  const [texto, setTexto] = useState('');
  const [fechaDoc, setFechaDoc] = useState(hoy);
  const [error, setError] = useState('');
  const distinta = fechaDoc !== hoy;

  const handleOk = () => {
    if (!texto.trim()) {
      setError('Escribí el texto de la evolución.');
      return;
    }
    onConfirm({
      texto: texto.trim(),
      fechaDoc,
      medicoEvolucion: usuarioNombre,
      fechaReal: nowFormatted(),
    });
  };

  return (
    <div className={styles.solidOverlay}>
      <div className={styles.modalBox}>
        <div className={styles.modalHeader}>
          <Edit3 size={20} />
          <span>Cargar evolución</span>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.pacienteInfo}>
            <div className={styles.pacienteInfoIcon}><Activity size={18} /></div>
            <div>
              <p className={styles.pacienteInfoNombre}>{paciente.paciente}</p>
              <p className={styles.pacienteInfoSub}>Cama {paciente.cama} · {fmtFecha(paciente.fechaIngreso)}</p>
            </div>
          </div>

          <div className={styles.adminNote}>
            <UserCheck size={14} />
            <span>Evolución registrada a nombre de <strong>{usuarioNombre}</strong></span>
          </div>

          <div className={styles.fieldsRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Fecha de la evolución</label>
              <input type="date" className={styles.fieldInput} value={fechaDoc} max={hoy} onChange={e => setFechaDoc(e.target.value)} />
              {distinta && (
                <div className={styles.alertNote}>
                  <AlertTriangle size={12} /> Se cargará hoy con fecha {fmtFecha(fechaDoc)}.
                </div>
              )}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Texto de la evolución *</label>
            <textarea className={[styles.fieldInput, styles.fieldTextarea].join(' ')} rows={5} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribir la evolución…" autoFocus />
          </div>

          {error && <div className={styles.errorBanner}><AlertTriangle size={13} /> {error}</div>}

          <div className={styles.modalActions}>
            <button type="button" className={[styles.btn, styles.btnGhost].join(' ')} onClick={onCancel}>
              <XCircle size={15} /> Cancelar
            </button>
            <button type="button" className={[styles.btn, styles.btnGreen].join(' ')} onClick={handleOk} disabled={saving}>
              <Save size={15} /> {saving ? 'Guardando…' : 'Guardar evolución'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal de confirmación de Alta/Traslado (con zoom)
function ConfirmModal({ tipo, onConfirm, onCancel }) {
  const esAlta = tipo === 'alta';
  const [medico, setMedico] = useState('');
  const [motivo, setMotivo] = useState('');
  const [destino, setDestino] = useState('');
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState(100);

  const handleZoomIn = () => setFontSize(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setFontSize(prev => Math.max(prev - 10, 70));

  const handleOk = () => {
    if (!medico.trim()) { setError('El médico es obligatorio.'); return; }
    if (esAlta && !motivo.trim()) { setError('El motivo de alta es obligatorio.'); return; }
    if (!esAlta && !destino.trim()) { setError('El destino es obligatorio.'); return; }
    onConfirm({ medico: medico.trim(), motivo: motivo.trim(), destino: destino.trim() });
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContainer} style={{ fontSize: `${fontSize}%` }}>
        <div className={[styles.modalHeader, esAlta ? styles.modalHeaderAlta : styles.modalHeaderTraslado].join(' ')}>
          <div className={styles.modalHeaderLeft}>
            {esAlta ? <LogOut size={24} /> : <MapPin size={24} />}
            <span>{esAlta ? 'Confirmar alta médica' : 'Confirmar traslado'}</span>
          </div>
          <div className={styles.modalHeaderZoom}>
            <button onClick={handleZoomOut} className={styles.zoomBtn} aria-label="Disminuir fuente">A–</button>
            <button onClick={handleZoomIn} className={styles.zoomBtn} aria-label="Aumentar fuente">A+</button>
          </div>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalDescription}>
            {esAlta
              ? 'Esta acción dará el alta al paciente y liberará la cama. Completá los datos obligatorios.'
              : 'Esta acción trasladará al paciente a otro sector y liberará la cama. Completá los datos obligatorios.'}
          </p>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Médico que {esAlta ? 'da el alta' : 'indica el traslado'} <span className={styles.required}>*</span></label>
            <input className={styles.fieldInput} value={medico} onChange={e => setMedico(e.target.value)} placeholder="Ej: González" autoFocus />
          </div>
          {esAlta ? (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Motivo / evolución de alta <span className={styles.required}>*</span></label>
              <textarea className={[styles.fieldInput, styles.fieldTextarea].join(' ')} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Describa el motivo clínico del alta..." rows={3} />
            </div>
          ) : (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Destino del traslado <span className={styles.required}>*</span></label>
                <input className={styles.fieldInput} value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ej: Sala de cirugía / Hospital general" />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Motivo del traslado (opcional)</label>
                <textarea className={[styles.fieldInput, styles.fieldTextarea].join(' ')} value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Describa el motivo clínico..." rows={3} />
              </div>
            </>
          )}
          {error && <div className={styles.errorMessage}><AlertCircle size={18} /><span>{error}</span></div>}
          <div className={styles.modalActions}>
            <button className={styles.btnSecondary} onClick={onCancel}><XCircle size={18} /> Cancelar</button>
            <button className={[styles.btnPrimary, esAlta ? styles.btnAlta : styles.btnTraslado].join(' ')} onClick={handleOk}>
              {esAlta ? <LogOut size={18} /> : <MapPin size={18} />}
              {esAlta ? 'Confirmar alta' : 'Confirmar traslado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Tarjeta de cama
function BedCard({ cama, paciente, selected, pendingOffline, onClick, onResumen }) {
  const ocupado = !!paciente;
  const dias = ocupado ? calcDias(paciente.fechaIngreso) : 0;

  return (
    <div
      className={[styles.bedCard, ocupado ? styles.bedOccupied : styles.bedFree, selected ? styles.bedSelected : ''].join(' ')}
      onClick={onClick}
      role="button"
      aria-label={`Cama ${cama} — ${ocupado ? paciente.paciente : 'Libre'}`}
    >
      {pendingOffline && <div className={styles.bedOfflineDot} title="Datos pendientes de sincronizar" />}
      <div className={styles.bedNum}>
        <span className={styles.bedNumLabel}>CAMA</span>
        <span className={styles.bedNumValue}>{cama}</span>
      </div>
      <div className={styles.bedBody}>
        {ocupado ? (
          <>
            <p className={styles.bedName}>{paciente.paciente}</p>
            {paciente.medicoIngreso && <p className={styles.bedMedico}>Dr. {paciente.medicoIngreso}</p>}
            <div className={styles.bedMeta}>
              <span className={styles.bedDaysBadge}><Activity size={10} /> {dias}d</span>
              {paciente.obraSocial && <span className={styles.bedObraBadge}>{paciente.obraSocial}</span>}
            </div>
          </>
        ) : (
          <p className={styles.bedFreeLabel}>Disponible</p>
        )}
      </div>
      <div className={styles.bedFooter}>
        <span className={[styles.bedStatusBadge, ocupado ? styles.badgeRed : styles.badgeGreen].join(' ')}>
          {ocupado ? 'Ocupada' : 'Libre'}
        </span>
        {ocupado && (
          <button className={styles.bedResumenBtn} onClick={e => { e.stopPropagation(); onResumen(paciente); }} aria-label="Ver resumen">
            <FileText size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// Vista Resumen (rápida)
function ResumenFullscreen({ paciente, onClose }) {
  const [copiedKey, setCopiedKey] = useState('');
  const evoluciones = [...(paciente?.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc).getTime() - new Date(b.fechaDoc).getTime());
  const dias = calcDias(paciente.fechaIngreso);

  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const handlePrint = () => {
    const content = document.getElementById('printArea')?.innerHTML || '';
    const win = window.open('', '_blank', 'width=900,height=700');
    win?.document.write(`
      <!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
      <title>HC — ${paciente.paciente}</title><style>
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111;padding:24px 32px;line-height:1.6}
      .ph{display:flex;justify-content:space-between;border-bottom:2px solid #1a3a6b;padding-bottom:12px;margin-bottom:18px}
      .ph h1{font-size:16px;color:#1a3a6b}.ph p{font-size:11px;color:#555}
      .pm{text-align:right;font-size:11px;color:#555}
      .sec{margin-bottom:16px;page-break-inside:avoid;border:1px solid #e2e8f0;border-radius:6px;overflow:hidden}
      .st{font-size:11px;font-weight:700;text-transform:uppercase;color:#1a3a6b;background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:6px 12px;margin:0}
      .g2{display:grid;grid-template-columns:1fr 1fr;gap:0}
      .f{padding:6px 12px;border-right:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9}
      .f label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;display:block}
      .f span{font-size:12px;white-space:pre-wrap}
      .pre{padding:8px 12px;font-size:12px;white-space:pre-wrap;line-height:1.6}
      .ei{border-left:3px solid #2563a8;padding-left:10px;margin:6px 12px 6px;padding-bottom:6px;border-bottom:1px solid #f1f5f9}
      .ei:last-child{border-bottom:none}
      .ed{font-weight:700;color:#2563a8;font-size:11px}
      .footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;text-align:center}
      @media print{body{padding:0}}
    </style></head><body>
      <div class="ph"><div><h1>Historia Clínica — UTI</h1><p>Clínica de la Unión S.A.</p></div><div class="pm">Impreso: ${formatDate(new Date())}<br/>Cama ${paciente.cama} · ${dias} días</div></div>
      ${content}
      <div class="footer">Clínica de la Unión S.A. — Documento generado automáticamente</div>
    </body></html>
    `);
    win?.document.close();
    win?.focus();
    setTimeout(() => { win?.print(); win?.close(); }, 400);
  };

  if (!paciente) return null;

  return (
    <div className={styles.resumenPage}>
      <div className={styles.resumenTopbar}>
        <button className={styles.resumenBackBtn} onClick={onClose}><ArrowLeft size={18} /><span>Volver</span></button>
        <div className={styles.resumenTopbarCenter}>
          <p className={styles.resumenTopbarName}>{paciente.paciente}</p>
          <p className={styles.resumenTopbarMeta}>
            Cama {paciente.cama} · {dias} día{dias !== 1 ? 's' : ''}{paciente.obraSocial && ` · ${paciente.obraSocial}`}
          </p>
        </div>
        <div className={styles.resumenTopbarActions}>
          <button className={[styles.actionBtn, styles.actionWA, copiedKey === 'wa' ? styles.actionDone : ''].join(' ')} onClick={() => copy(generarTextoWA(paciente), 'wa')}>
            {copiedKey === 'wa' ? <Check size={15} /> : <MessageCircle size={15} />}
            <span className={styles.actionBtnLabel}>{copiedKey === 'wa' ? '¡Copiado!' : 'WhatsApp'}</span>
          </button>
          <button className={[styles.actionBtn, styles.actionCopy, copiedKey === 'txt' ? styles.actionDone : ''].join(' ')} onClick={() => copy(generarTextoPlano(paciente), 'txt')}>
            {copiedKey === 'txt' ? <Check size={15} /> : <Copy size={15} />}
            <span className={styles.actionBtnLabel}>{copiedKey === 'txt' ? '¡Copiado!' : 'Copiar todo'}</span>
          </button>
          <button className={[styles.actionBtn, styles.actionPrint].join(' ')} onClick={handlePrint}>
            <Printer size={15} /><span className={styles.actionBtnLabel}>Imprimir</span>
          </button>
        </div>
      </div>

      <div className={styles.resumenContent}>
        <div className={styles.resumenInner} id="printArea">
          <section className={styles.resSection}>
            <h2 className={styles.resSectionTitle}><UserCheck size={14} /> Admisión</h2>
            <div className={styles.resGrid}>
              {[
                ['Médico de ingreso', paciente.medicoIngreso ? `Dr. ${paciente.medicoIngreso}` : null],
                ['Fecha de ingreso', formatDate(paciente.fechaIngreso)],
                ['Motivo de ingreso', paciente.motivoIngreso],
                ['Obra Social', paciente.obraSocial],
                ['DNI', paciente.dni],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className={[styles.resField, l === 'Motivo de ingreso' ? styles.resFieldFull : ''].join(' ')}>
                  <span className={styles.resFieldLabel}>{l}</span>
                  <span className={styles.resFieldValue}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          <section className={styles.resSection}>
            <h2 className={styles.resSectionTitle}><Stethoscope size={14} /> Estado Clínico</h2>
            <div className={styles.resGrid}>
              {[
                ['Diagnóstico actual', paciente.diagnosticoActual],
                ['Antecedentes', paciente.antecedentes],
                ['Tratamiento actual', paciente.tratamientoActual],
                ['Pendientes', paciente.pendientes],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div key={l} className={[styles.resField, styles.resFieldFull].join(' ')}>
                  <span className={styles.resFieldLabel}>{l}</span>
                  <span className={styles.resFieldValue}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          {paciente.examenes && (
            <section className={styles.resSection}>
              <h2 className={styles.resSectionTitle}><FlaskConical size={14} /> Exámenes</h2>
              <p className={styles.resPre}>{paciente.examenes}</p>
            </section>
          )}

          <section className={styles.resSection}>
            <h2 className={styles.resSectionTitle}><Activity size={14} /> Evoluciones <span className={styles.resBadge}>{evoluciones.length}</span></h2>
            {evoluciones.length === 0 ? (
              <p className={styles.resEmpty}>Sin evoluciones registradas.</p>
            ) : (
              <div className={styles.timeline}>
                {evoluciones.map((ev, i) => (
                  <div key={i} className={styles.timelineItem}>
                    <div className={styles.timelineDot} />
                    <div className={styles.timelineContent}>
                      <div className={styles.timelineMeta}>
                        <span className={styles.timelineDate}><Calendar size={11} /> {formatDate(ev.fechaDoc)}</span>
                        {ev.medicoEvolucion && <span className={styles.timelineDoc}>Dr. {ev.medicoEvolucion}</span>}
                        {ev.fechaReal && <span className={styles.timelineCarga}>cargado {formatDate(ev.fechaReal)}</span>}
                      </div>
                      <p className={styles.timelineText}>{ev.texto}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

// Expediente completo (todos los ingresos del paciente)
function ExpedienteFullscreen({ ingresos, camasOcupadas, usuarioNombre, onClose, onReingresarDone }) {
  const [expandidos, setExpandidos] = useState(new Set([ingresos.length - 1]));
  const [copied, setCopied] = useState(false);
  const [reingresarP, setReingresarP] = useState(null);
  const [evolucionarP, setEvolucionarP] = useState(null);
  const [savingReingreso, setSavingReingreso] = useState(false);
  const [savingEvol, setSavingEvol] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const camasLibres = Array.from({ length: TOTAL_CAMAS }, (_, i) => i + 1).filter(c => !camasOcupadas.includes(c));

  const toast = (msg) => { setToastMsg(msg); setTimeout(() => setToastMsg(''), 3500); };

  const toggle = (i) => {
    setExpandidos(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i); else s.add(i);
      return s;
    });
  };

  const copiarResumen = async () => {
    try {
      const lines = ingresos.map((p, i) => {
        const evols = [...(p.evoluciones || [])].sort((a, b) => (parseFechaFlexible(a.fechaDoc)?.getTime() || 0) - (parseFechaFlexible(b.fechaDoc)?.getTime() || 0));
        const evsText = evols.map((ev, j) => {
          const carga = ev.fechaReal || ev.fechaCarga;
          return `  [${j + 1}] ${fmtFecha(ev.fechaDoc)} | Cargado: ${fmtFecha(carga)} | Dr. ${ev.medicoEvolucion || '—'}\n  ${ev.texto || '—'}`;
        }).join('\n\n');
        return `=== INGRESO ${i + 1} — ${fmtFecha(p.fechaIngreso)} · Cama ${p.cama} ===\nMédico: Dr. ${p.medicoIngreso || '—'} | OS: ${p.obraSocial || '—'}\n\n${evsText || '  (sin evoluciones)'}`;
      }).join('\n\n' + '─'.repeat(48) + '\n\n');
      await navigator.clipboard.writeText(`HISTORIA CLÍNICA — ${ingresos[0]?.paciente}\nClínica de la Unión S.A.\n\n${lines}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.error(error);
      toast('No se pudo copiar el resumen.');
    }
  };

  const handleReingresarConfirm = async ({ cama, medico }) => {
    const p = reingresarP;
    if (!p) return;
    setSavingReingreso(true);
    try {
      await update(push(ref(db, 'UTI')), {
        paciente: p.paciente,
        dni: p.dni,
        obraSocial: p.obraSocial || '',
        medicoIngreso: medico,
        fechaIngreso: new Date().toISOString().split('T')[0],
        motivoIngreso: '',
        diagnosticoActual: p.diagnosticoActual || '',
        antecedentes: p.antecedentes || '',
        tratamientoActual: p.tratamientoActual || '',
        examenes: p.examenes || '',
        pendientes: p.pendientes || '',
        evoluciones: [],
        cama,
        activo: true,
        reingresoMedico: medico,
        reingresoFecha: new Date().toISOString(),
        ultimaActualizacion: new Date().toISOString(),
      });
      setReingresarP(null);
      toast('✓ Paciente reingresado correctamente.');
      onReingresarDone();
    } catch (e) {
      console.error(e);
      alert('Error al reingresar');
    } finally {
      setSavingReingreso(false);
    }
  };

  const handleEvolucionarConfirm = async (evData) => {
    const p = evolucionarP;
    if (!p?.id) return;
    setSavingEvol(true);
    try {
      const nuevasEvols = [...(p.evoluciones || []), evData];
      await update(ref(db, `UTI/${p.id}`), { evoluciones: nuevasEvols, ultimaActualizacion: new Date().toISOString() });
      setEvolucionarP(null);
      toast('✓ Evolución guardada correctamente.');
      onReingresarDone();
    } catch (e) {
      console.error(e);
      alert('Error al guardar evolución');
    } finally {
      setSavingEvol(false);
    }
  };

  if (!ingresos.length) return null;
  const nombre = ingresos[0].paciente;

  return (
    <div className={styles.expedientePage}>
      <div className={styles.expedienteTopbar}>
        <button type="button" className={styles.backBtn} onClick={onClose}><ArrowLeft size={18} /> Volver</button>
        <div className={styles.expedienteTopbarCenter}>
          <p className={styles.expedienteNombre}>{nombre}</p>
          <p className={styles.expedienteMeta}>{ingresos.length} ingreso{ingresos.length !== 1 ? 's' : ''} · Historia clínica completa</p>
        </div>
        <div className={styles.expedienteTopbarActions}>
          <button type="button" className={[styles.actionBtn, styles.actionCopy, copied ? styles.actionDone : ''].join(' ')} onClick={copiarResumen}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span className={styles.actionLabel}>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>
          <button type="button" className={[styles.actionBtn, styles.actionPrint].join(' ')} onClick={() => imprimirHistoriaCompleta(ingresos)}>
            <Printer size={15} /><span className={styles.actionLabel}>Imprimir</span>
          </button>
        </div>
      </div>

      {toastMsg && <div className={styles.toast}>{toastMsg}</div>}

      <div className={styles.expedienteScroll}>
        <div className={styles.expedienteInner}>
          {ingresos.map((p, idx) => {
            const open = expandidos.has(idx);
            const { label, cls } = estadoPaciente(p);
            const evols = [...(p.evoluciones || [])].sort((a, b) => (parseFechaFlexible(a.fechaDoc)?.getTime() || 0) - (parseFechaFlexible(b.fechaDoc)?.getTime() || 0));
            const dias = calcDias(p.fechaIngreso);
            const esActivo = p.activo && !p.fechaAlta && !p.fechaTraslado;
            const puedeReingresar = !!(p.fechaAlta || p.fechaTraslado || !p.activo);

            return (
              <div key={p.id} className={[styles.ingresoCard, esActivo ? styles.ingresoActivo : ''].join(' ')}>
                <div className={styles.ingresoCardHeader}>
                  <button type="button" className={styles.ingresoToggle} onClick={() => toggle(idx)} aria-expanded={open}>
                    <div className={styles.ingresoNumBadge}>{idx + 1}</div>
                    <div className={styles.ingresoToggleInfo}>
                      <span className={styles.ingresoFecha}>
                        Ingreso del {fmtFecha(p.fechaIngreso)}
                        {esActivo && <span className={styles.badgeActivo}>En curso</span>}
                        {p.reingresoMedico && <span className={styles.badgeReingreso}>Reingreso</span>}
                      </span>
                      <span className={styles.ingresoMeta}>
                        Cama {p.cama} · {dias}d · Dr. {p.medicoIngreso || '—'} ·{' '}
                        <span className={[styles.estadoBadge, styles[`estado${cls[0].toUpperCase() + cls.slice(1)}`]].join(' ')}>{label}</span>
                      </span>
                    </div>
                    <div className={styles.ingresoToggleRight}>
                      <span className={styles.evoCountChip}><Activity size={11} /> {evols.length}</span>
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>
                  <div className={styles.ingresoAcciones}>
                    {esActivo && (
                      <button type="button" className={[styles.ingresoBtn, styles.ingresoBtnEvolucionar].join(' ')} onClick={() => setEvolucionarP(p)}>
                        <Edit3 size={13} /> Evolucionar
                      </button>
                    )}
                    {puedeReingresar && (
                      <button type="button" className={[styles.ingresoBtn, styles.ingresoBtnReingresar].join(' ')} onClick={() => setReingresarP(p)}>
                        <PlusCircle size={13} /> Reingresar
                      </button>
                    )}
                  </div>
                </div>

                {open && (
                  <div className={styles.ingresoBody}>
                    {/* Admisión */}
                    <div className={styles.seccion}>
                      <h3 className={styles.seccionTitulo}><UserCheck size={13} /> Admisión</h3>
                      <div className={styles.seccionGrid}>
                        {[
                          ['Médico de ingreso', p.medicoIngreso ? `Dr. ${p.medicoIngreso}` : null],
                          ['Fecha de ingreso', fmtFecha(p.fechaIngreso)],
                          ['Obra Social', p.obraSocial],
                          ['DNI', p.dni],
                          ['Motivo de ingreso', p.motivoIngreso],
                          p.reingresoMedico ? ['Reingreso indicado por', `ADM — ${p.reingresoMedico}`] : null,
                        ].filter(Boolean).filter(([, v]) => v).map(([l, v]) => (
                          <div key={l} className={styles.campo}><span className={styles.campoLabel}>{l}</span><span className={styles.campoValor}>{v}</span></div>
                        ))}
                      </div>
                    </div>

                    {/* Estado Clínico */}
                    {(p.diagnosticoActual || p.antecedentes || p.tratamientoActual || p.pendientes) && (
                      <div className={styles.seccion}>
                        <h3 className={styles.seccionTitulo}><Stethoscope size={13} /> Estado Clínico</h3>
                        <div className={styles.seccionGrid}>
                          {[
                            ['Diagnóstico', p.diagnosticoActual],
                            ['Antecedentes', p.antecedentes],
                            ['Tratamiento', p.tratamientoActual],
                            ['Pendientes', p.pendientes],
                          ].filter(([, v]) => v).map(([l, v]) => (
                            <div key={l} className={styles.campo}><span className={styles.campoLabel}>{l}</span><span className={styles.campoValor}>{v}</span></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.examenes && (
                      <div className={styles.seccion}>
                        <h3 className={styles.seccionTitulo}><FlaskConical size={13} /> Exámenes</h3>
                        <p className={styles.campoPre}>{p.examenes}</p>
                      </div>
                    )}

                    {/* Evoluciones */}
                    <div className={styles.seccion}>
                      <h3 className={styles.seccionTitulo}><Activity size={13} /> Evoluciones <span className={styles.countBadge}>{evols.length}</span></h3>
                      {evols.length === 0 ? (
                        <p className={styles.sinDatos}>Sin evoluciones registradas.</p>
                      ) : (
                        <div className={styles.evoTimeline}>
                          {evols.map((ev, i) => {
                            const carga = ev.fechaReal || ev.fechaCarga;
                            const tardia = esCargaTardia(ev.fechaDoc, carga);
                            return (
                              <div key={i} className={styles.evoItem}>
                                <div className={styles.evoDot} />
                                <div className={styles.evoContent}>
                                  <div className={styles.evoMeta}>
                                    <span className={styles.evoFechaClinica}><Calendar size={11} /> {fmtFecha(ev.fechaDoc)}</span>
                                    {ev.medicoEvolucion && <span className={styles.evoMedico}>Dr. {ev.medicoEvolucion}</span>}
                                    {carga && (
                                      <span className={[styles.evoCarga, tardia ? styles.evoCargaTardia : ''].join(' ')}>
                                        <Clock size={10} /> {fmtFecha(carga)}{tardia && <><AlertTriangle size={10} /> tardía</>}
                                      </span>
                                    )}
                                  </div>
                                  <p className={styles.evoTexto}>{ev.texto}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {p.fechaAlta && (
                      <div className={[styles.seccion, styles.seccionAlta].join(' ')}>
                        <h3 className={styles.seccionTitulo}><Home size={13} /> Alta</h3>
                        <div className={styles.seccionGrid}>
                          {[
                            ['Fecha', fmtFecha(p.fechaAlta)],
                            ['Médico', p.medicoAlta ? `Dr. ${p.medicoAlta}` : null],
                            ['Motivo', p.motivoAlta],
                          ].filter(([, v]) => v).map(([l, v]) => (
                            <div key={l} className={styles.campo}><span className={styles.campoLabel}>{l}</span><span className={styles.campoValor}>{v}</span></div>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.fechaTraslado && (
                      <div className={[styles.seccion, styles.seccionTraslado].join(' ')}>
                        <h3 className={styles.seccionTitulo}><Truck size={13} /> Traslado</h3>
                        <div className={styles.seccionGrid}>
                          {[
                            ['Fecha', fmtFecha(p.fechaTraslado)],
                            ['Médico', p.medicoTraslado ? `Dr. ${p.medicoTraslado}` : null],
                            ['Destino', p.destinoTraslado],
                            ['Motivo', p.motivoTraslado],
                          ].filter(([, v]) => v).map(([l, v]) => (
                            <div key={l} className={styles.campo}><span className={styles.campoLabel}>{l}</span><span className={styles.campoValor}>{v}</span></div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {reingresarP && (
        <ReingresarModal
          paciente={reingresarP}
          camasLibres={camasLibres}
          usuarioNombre={usuarioNombre}
          onConfirm={handleReingresarConfirm}
          onCancel={() => setReingresarP(null)}
          saving={savingReingreso}
        />
      )}
      {evolucionarP && (
        <EvolucionarModal
          paciente={evolucionarP}
          usuarioNombre={usuarioNombre}
          onConfirm={handleEvolucionarConfirm}
          onCancel={() => setEvolucionarP(null)}
          saving={savingEvol}
        />
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UtiPage() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estados para la vista de camas (formulario)
  const [camaSeleccionada, setCamaSeleccionada] = useState(null);
  const [formData, setFormData] = useState(FORM_DEFAULTS);
  const [editId, setEditId] = useState(null);
  const [activeTab, setActiveTab] = useState('datos');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [pacienteResumen, setPacienteResumen] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [offlineCamas, setOfflineCamas] = useState(new Set());

  // Estados para la vista de historial/timeline
  const [vista, setVista] = useState('camas');
  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [expediente, setExpediente] = useState(null);
  const [filtroStatsActivo, setFiltroStatsActivo] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busquedaTimeline, setBusquedaTimeline] = useState('');

  const { online, pending, syncing, save, syncQueue } = useOfflineQueue();

  // Carga de datos desde Firebase
  useEffect(() => {
    const utiRef = ref(db, 'UTI');
    return onValue(utiRef, snap => {
      const data = snap.val();
      setPacientes(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : []);
      setLoading(false);
    });
  }, []);

  const usuarioNombre = 'Usuario'; // Nombre genérico para acciones

  // Pacientes activos (para camas)
  const pacientesActivos = useMemo(() => (
    pacientes.filter(p => p.activo && !p.fechaAlta && !p.fechaTraslado)
  ), [pacientes]);

  const pacienteEnCama = useCallback((cama) => pacientesActivos.find(p => p.cama === cama), [pacientesActivos]);

  const camasOcupadas = useMemo(() => pacientesActivos.map(p => p.cama), [pacientesActivos]);

  // Estadísticas
  const stats = useMemo(() => ({
    total: pacientes.length,
    activos: pacientesActivos.length,
    altas: pacientes.filter(p => p.fechaAlta).length,
    traslados: pacientes.filter(p => p.fechaTraslado).length,
    totalEvos: pacientes.reduce((a, p) => a + (p.evoluciones || []).length, 0),
    tardias: pacientes.reduce((a, p) => a + (p.evoluciones || []).filter(ev => esCargaTardia(ev.fechaDoc, ev.fechaReal || ev.fechaCarga)).length, 0),
  }), [pacientes, pacientesActivos]);

  // Listas para gráficos
  const medicosList = useMemo(() => {
    const evosPorMedico = {};
    pacientes.forEach(p => {
      (p.evoluciones || []).forEach(ev => {
        const k = ev.medicoEvolucion || '(sin nombre)';
        evosPorMedico[k] = (evosPorMedico[k] || 0) + 1;
      });
    });
    return Object.entries(evosPorMedico).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));
  }, [pacientes]);

  const camasList = useMemo(() => (
    Array.from({ length: TOTAL_CAMAS }, (_, i) => i + 1).map(c => ({
      label: `Cama ${c}`,
      value: pacientes.filter(p => p.cama === c).length,
    }))
  ), [pacientes]);

  // Filtros para tabla
  const pacientesFiltrados = useMemo(() => {
    return pacientes.filter(p => {
      if (filtro === 'activos' && (!p.activo || p.fechaAlta || p.fechaTraslado)) return false;
      if (filtro === 'altas' && !p.fechaAlta) return false;
      if (filtro === 'traslados' && !p.fechaTraslado) return false;
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase();
        return (
          (p.paciente || '').toLowerCase().includes(q) ||
          (p.medicoIngreso || '').toLowerCase().includes(q) ||
          (p.obraSocial || '').toLowerCase().includes(q) ||
          (p.evoluciones || []).some(ev => (ev.medicoEvolucion || '').toLowerCase().includes(q) || (ev.texto || '').toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [pacientes, filtro, busqueda]);

  // Timeline de eventos
  const todosEventos = useMemo(() => {
    const eventos = [];
    pacientes.forEach(p => {
      (p.evoluciones || []).forEach(ev => {
        const carga = ev.fechaReal || ev.fechaCarga;
        const fechaBase = carga || ev.fechaDoc;
        eventos.push({
          tipo: 'evol',
          fecha: fmtFecha(fechaBase),
          fechaDoc: fmtFecha(ev.fechaDoc),
          paciente: p.paciente,
          medico: ev.medicoEvolucion,
          texto: ev.texto,
          cama: p.cama,
          ev,
          _sk: parseFechaFlexible(carga) || parseFechaFlexible(ev.fechaDoc),
          _dateOnly: toDateOnly(fechaBase) || toDateOnly(ev.fechaDoc),
        });
      });
      if (p.fechaIngreso) {
        eventos.push({
          tipo: 'ingreso',
          fecha: fmtFecha(p.fechaIngreso),
          paciente: p.paciente,
          medico: p.medicoIngreso,
          texto: p.motivoIngreso || '',
          cama: p.cama,
          _sk: parseFechaFlexible(p.fechaIngreso),
          _dateOnly: toDateOnly(p.fechaIngreso),
        });
      }
      if (p.fechaAlta) {
        eventos.push({
          tipo: 'alta',
          fecha: fmtFecha(p.fechaAlta),
          paciente: p.paciente,
          medico: p.medicoAlta,
          texto: p.motivoAlta || '',
          cama: p.cama,
          _sk: parseFechaFlexible(p.fechaAlta),
          _dateOnly: toDateOnly(p.fechaAlta),
        });
      }
      if (p.fechaTraslado) {
        eventos.push({
          tipo: 'traslado',
          fecha: fmtFecha(p.fechaTraslado),
          paciente: p.paciente,
          medico: p.medicoTraslado,
          texto: `Destino: ${p.destinoTraslado || '—'}`,
          cama: p.cama,
          _sk: parseFechaFlexible(p.fechaTraslado),
          _dateOnly: toDateOnly(p.fechaTraslado),
        });
      }
    });
    eventos.sort((a, b) => (b._sk?.getTime() || 0) - (a._sk?.getTime() || 0));
    return eventos;
  }, [pacientes]);

  const timelineFiltrado = useMemo(() => {
    return todosEventos.filter(ev => {
      if (filtroStatsActivo === 'tardias') {
        if (!(ev.tipo === 'evol' && ev.ev && esCargaTardia(ev.ev.fechaDoc, ev.ev.fechaReal || ev.ev.fechaCarga))) return false;
      }
      if (busquedaTimeline.trim()) {
        const q = busquedaTimeline.toLowerCase();
        if (!(ev.paciente || '').toLowerCase().includes(q)) return false;
      }
      const desde = fechaDesde ? toDateOnly(fechaDesde) : null;
      const hasta = fechaHasta ? toDateOnly(fechaHasta) : null;
      const fechaEvento = ev._dateOnly;
      if (desde && fechaEvento && fechaEvento < desde) return false;
      if (hasta && fechaEvento && fechaEvento > hasta) return false;
      return true;
    });
  }, [todosEventos, filtroStatsActivo, busquedaTimeline, fechaDesde, fechaHasta]);

  // Handlers del formulario de camas
  const handleCamaClick = (cama) => {
    if (camaSeleccionada === cama) { setCamaSeleccionada(null); return; }
    const ex = pacienteEnCama(cama);
    if (ex) {
      setEditId(ex.id);
      setFormData({
        paciente: ex.paciente || '',
        medicoIngreso: ex.medicoIngreso || '',
        obraSocial: ex.obraSocial || '',
        dni: ex.dni || '',
        fechaIngreso: ex.fechaIngreso || '',
        motivoIngreso: ex.motivoIngreso || '',
        diagnosticoActual: ex.diagnosticoActual || '',
        antecedentes: ex.antecedentes || '',
        tratamientoActual: ex.tratamientoActual || '',
        examenes: ex.examenes || '',
        pendientes: ex.pendientes || '',
        evolucionFechaDoc: new Date().toISOString().split('T')[0],
        evolucionTexto: '',
        medicoEvolucion: '',
      });
    } else {
      setEditId(null);
      setFormData({ ...FORM_DEFAULTS, fechaIngreso: new Date().toISOString().split('T')[0] });
    }
    setActiveTab('datos');
    setCamaSeleccionada(cama);
  };

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!camaSeleccionada) return;
    if (formData.evolucionTexto.trim() && !formData.medicoEvolucion.trim()) {
      alert('Completá el médico que evoluciona.');
      setActiveTab('evolucion');
      return;
    }
    setSaving(true);

    let nuevasEvoluciones = editId ? (pacienteEnCama(camaSeleccionada)?.evoluciones || []) : [];
    if (formData.evolucionTexto.trim()) {
      nuevasEvoluciones = [...nuevasEvoluciones, {
        fechaDoc: formData.evolucionFechaDoc,
        fechaReal: nowFormatted(),
        texto: formData.evolucionTexto.trim(),
        medicoEvolucion: formData.medicoEvolucion.trim(),
      }];
    }

    const data = {
      paciente: formData.paciente,
      medicoIngreso: formData.medicoIngreso,
      obraSocial: formData.obraSocial,
      dni: formData.dni,
      fechaIngreso: formData.fechaIngreso,
      motivoIngreso: formData.motivoIngreso,
      diagnosticoActual: formData.diagnosticoActual,
      antecedentes: formData.antecedentes,
      tratamientoActual: formData.tratamientoActual,
      examenes: formData.examenes,
      pendientes: formData.pendientes,
      evoluciones: nuevasEvoluciones,
      cama: camaSeleccionada,
      activo: true,
      ultimaActualizacion: new Date().toISOString(),
    };

    try {
      const result = await save({ editId, data });
      if (result.offline) {
        setSavedMsg('⚠️ Sin conexión — guardado en este dispositivo. Se sincronizará al volver internet.');
        setOfflineCamas(prev => new Set([...prev, camaSeleccionada]));
      } else {
        setSavedMsg('✓ Guardado correctamente.');
        setOfflineCamas(prev => { const s = new Set(prev); s.delete(camaSeleccionada); return s; });
      }
      setTimeout(() => setSavedMsg(''), 5000);
      setCamaSeleccionada(null);
      setEditId(null);
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAltaConfirm = async ({ medico, motivo }) => {
    if (!editId) return;
    await save({ editId, data: { activo: false, fechaAlta: new Date().toISOString(), medicoAlta: medico, motivoAlta: motivo } });
    setConfirmModal(null);
    setCamaSeleccionada(null);
    setEditId(null);
  };

  const handleTrasladoConfirm = async ({ medico, motivo, destino }) => {
    if (!editId) return;
    await save({ editId, data: { activo: false, fechaTraslado: new Date().toISOString(), medicoTraslado: medico, motivoTraslado: motivo, destinoTraslado: destino } });
    setConfirmModal(null);
    setCamaSeleccionada(null);
    setEditId(null);
  };

  const abrirExpediente = useCallback((nombrePaciente) => {
    setExpediente(agruparIngresos(pacientes, nombrePaciente));
  }, [pacientes]);

  if (loading) {
    return (
      <>
        <Header />
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} />
        </div>
      </>
    );
  }

  if (expediente) {
    return (
      <>
        <Header />
        <ExpedienteFullscreen
          ingresos={expediente}
          camasOcupadas={camasOcupadas}
          usuarioNombre={usuarioNombre}
          onClose={() => setExpediente(null)}
          onReingresarDone={() => setExpediente(null)}
        />
      </>
    );
  }

  if (pacienteResumen) {
    return (
      <>
        <Header />
        <ResumenFullscreen paciente={pacienteResumen} onClose={() => setPacienteResumen(null)} />
      </>
    );
  }

  const ocupadas = pacientesActivos.length;
  const libres = TOTAL_CAMAS - ocupadas;
  const ocupacion = Math.round((ocupadas / TOTAL_CAMAS) * 100);
  const evolucionFechaEsDistinta = formData.evolucionFechaDoc !== new Date().toISOString().split('T')[0];

  return (
    <>
      <Header />
      <main className={styles.page}>
        <OfflineBanner online={online} pending={pending} syncing={syncing} onSync={syncQueue} />

        {savedMsg && (
          <div className={[styles.savedToast, savedMsg.startsWith('✓') ? styles.savedToastOk : styles.savedToastWarn].join(' ')}>
            {savedMsg}
          </div>
        )}

        {/* Topbar sin usuario y logout */}
        <nav className={styles.adminTopbar}>
          <div className={styles.adminTopbarLeft}>
            <div className={styles.adminTopbarIcon}><BarChart2 size={17} /></div>
            <span className={styles.adminTopbarTitle}>UTI · Clínica de la Unión</span>
          </div>
          <div className={styles.adminTopbarCenter}>
            {[
              { id: 'camas', label: 'Camas', icon: <Activity size={14} /> },
              { id: 'tabla', label: 'Historial', icon: <FileText size={14} /> },
              { id: 'timeline', label: 'Timeline', icon: <Clock size={14} /> },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                className={[styles.adminNavBtn, vista === t.id ? styles.adminNavBtnActive : ''].join(' ')}
                onClick={() => setVista(t.id)}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
          <div className={styles.adminTopbarRight}>
            {/* Sin usuario ni logout */}
          </div>
        </nav>

        {/* Stats cards (filtrables) */}
        <div className={styles.statsGrid}>
          {[
            { id: 'activos', label: 'Activos en UTI', value: stats.activos, icon: <Activity size={15} />, mod: styles.sRed, vista: 'tabla', filtroTabla: 'activos', filtroStats: 'activos' },
            { id: 'todos', label: 'Total ingresos', value: stats.total, icon: <Users size={15} />, mod: styles.sBlue, vista: 'tabla', filtroTabla: 'todos', filtroStats: 'todos' },
            { id: 'altas', label: 'Altas', value: stats.altas, icon: <Home size={15} />, mod: styles.sGreen, vista: 'tabla', filtroTabla: 'altas', filtroStats: 'altas' },
            { id: 'traslados', label: 'Traslados', value: stats.traslados, icon: <Truck size={15} />, mod: styles.sAmber, vista: 'tabla', filtroTabla: 'traslados', filtroStats: 'traslados' },
            { id: 'evoluciones', label: 'Evoluciones', value: stats.totalEvos, icon: <FileText size={15} />, mod: styles.sBlue, vista: 'timeline', filtroTabla: 'todos', filtroStats: 'todos' },
            { id: 'tardias', label: 'Cargas tardías', value: stats.tardias, icon: <AlertTriangle size={15} />, mod: styles.sAmber, vista: 'timeline', filtroTabla: 'todos', filtroStats: 'tardias' },
          ].map(s => {
            const active = (vista === 'tabla' && s.vista === 'tabla' && filtroStatsActivo === s.filtroStats) ||
              (vista === 'timeline' && s.vista === 'timeline' && filtroStatsActivo === s.filtroStats);
            return (
              <button key={s.id} type="button" className={styles.statCardButton} onClick={() => {
                setVista(s.vista);
                setFiltroStatsActivo(s.filtroStats);
                if (s.vista === 'tabla') setFiltro(s.filtroTabla);
                if (s.vista === 'timeline' && s.filtroStats !== 'tardias') {
                  setFechaDesde(''); setFechaHasta(''); setBusquedaTimeline('');
                }
              }}>
                <div className={[styles.statCard, styles.statCardInteractive, active ? styles.statCardActive : ''].join(' ')}>
                  <div className={styles.statCardIcon}>{s.icon}</div>
                  <p className={[styles.statCardValue, s.mod].join(' ')}>{s.value}</p>
                  <p className={styles.statCardLabel}>{s.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Gráficos */}
        <div className={styles.chartsRow}>
          <div className={styles.chartCard}>
            <p className={styles.chartTitle}><TrendingUp size={13} /> Evoluciones por médico</p>
            {medicosList.length > 0 ? <BarChart data={medicosList} /> : <p className={styles.noData}>Sin datos</p>}
          </div>
          <div className={styles.chartCard}>
            <p className={styles.chartTitle}><BarChart2 size={13} /> Ingresos por cama</p>
            <BarChart data={camasList} />
          </div>
        </div>

        {/* Contenido principal según la vista */}
        <div className={styles.contentPanel}>
          {vista === 'camas' && (
            <>
              {/* Stats rápidas de camas */}
              <div className={styles.statsRow}>
                {[
                  { label: 'Ocupadas', value: ocupadas, mod: styles.statRed },
                  { label: 'Disponibles', value: libres, mod: styles.statGreen },
                  { label: 'Ocupación', value: `${ocupacion}%`, mod: styles.statBlue },
                  { label: 'Total camas', value: TOTAL_CAMAS, mod: styles.statBlue },
                ].map(s => (
                  <div key={s.label} className={styles.statCard}>
                    <p className={styles.statLabel}>{s.label}</p>
                    <p className={[styles.statValue, s.mod].join(' ')}>{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Camas */}
              <div className={styles.bedsGrid}>
                {CAMAS.map(cama => (
                  <BedCard
                    key={cama}
                    cama={cama}
                    paciente={pacienteEnCama(cama)}
                    selected={camaSeleccionada === cama}
                    pendingOffline={offlineCamas.has(cama)}
                    onClick={() => handleCamaClick(cama)}
                    onResumen={setPacienteResumen}
                  />
                ))}
              </div>

              {/* Formulario de ingreso/edición */}
              {camaSeleccionada && (
                <div className={styles.formPanel}>
                  <div className={styles.formPanelHeader}>
                    <div className={styles.formPanelTitle}>
                      {editId ? <Activity size={16} /> : <User size={16} />}
                      <span>{editId ? 'Editar paciente' : 'Nuevo ingreso'}</span>
                      <span className={styles.formPanelBed}>Cama {camaSeleccionada}</span>
                    </div>
                    <button className={styles.formPanelClose} onClick={() => setCamaSeleccionada(null)} aria-label="Cerrar">
                      <XCircle size={18} />
                    </button>
                  </div>

                  <div className={styles.tabBar} role="tablist">
                    {TABS_FORM.map(({ id, label, Icon }) => (
                      <button key={id} role="tab" aria-selected={activeTab === id}
                        className={[styles.tab, activeTab === id ? styles.tabActive : ''].join(' ')}
                        onClick={() => setActiveTab(id)}>
                        <Icon size={15} /><span>{label}</span>
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className={styles.formBody}>
                    {activeTab === 'datos' && (
                      <div className={styles.fieldsGrid}>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Nombre del paciente *</label>
                          <input className={styles.fieldInput} value={formData.paciente} onChange={e => handleChange('paciente', e.target.value)} required placeholder="Apellido, Nombre" />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>DNI</label>
                          <input className={styles.fieldInput} value={formData.dni} onChange={e => handleChange('dni', e.target.value)} placeholder="Número de documento" />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Médico de ingreso *</label>
                          <input className={styles.fieldInput} value={formData.medicoIngreso} onChange={e => handleChange('medicoIngreso', e.target.value)} required placeholder="Apellido del médico" />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Obra Social</label>
                          <input className={styles.fieldInput} value={formData.obraSocial} onChange={e => handleChange('obraSocial', e.target.value)} />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Fecha de ingreso *</label>
                          <input type="date" className={styles.fieldInput} value={formData.fechaIngreso} onChange={e => handleChange('fechaIngreso', e.target.value)} required />
                        </div>
                        <div className={[styles.fieldGroup, styles.fieldFull].join(' ')}>
                          <label className={styles.fieldLabel}>Motivo de ingreso</label>
                          <input className={styles.fieldInput} value={formData.motivoIngreso} onChange={e => handleChange('motivoIngreso', e.target.value)} />
                        </div>
                      </div>
                    )}

                    {activeTab === 'clinico' && (
                      <div className={styles.fieldsGrid}>
                        {[
                          ['diagnosticoActual', 'Diagnóstico actual'],
                          ['antecedentes', 'Antecedentes'],
                          ['tratamientoActual', 'Tratamiento actual'],
                          ['pendientes', 'Pendientes'],
                        ].map(([field, label]) => (
                          <div key={field} className={[styles.fieldGroup, styles.fieldFull].join(' ')}>
                            <label className={styles.fieldLabel}>{label}</label>
                            <textarea className={[styles.fieldInput, styles.fieldTextarea].join(' ')} value={formData[field]} onChange={e => handleChange(field, e.target.value)} rows={3} />
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'evolucion' && (
                      <div className={styles.fieldsGrid}>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Médico que evoluciona *</label>
                          <input className={styles.fieldInput} value={formData.medicoEvolucion} onChange={e => handleChange('medicoEvolucion', e.target.value)} placeholder="Apellido del médico" />
                        </div>
                        <div className={styles.fieldGroup}>
                          <label className={styles.fieldLabel}>Fecha de la evolución</label>
                          <input type="date" className={styles.fieldInput} value={formData.evolucionFechaDoc} onChange={e => handleChange('evolucionFechaDoc', e.target.value)} max={new Date().toISOString().split('T')[0]} />
                          {evolucionFechaEsDistinta && (
                            <div className={styles.alertNote}>
                              <AlertCircle size={13} /> Se registrará hoy con fecha {formatDate(formData.evolucionFechaDoc)}.
                            </div>
                          )}
                        </div>
                        <div className={[styles.fieldGroup, styles.fieldFull].join(' ')}>
                          <label className={styles.fieldLabel}>Texto de la evolución</label>
                          <textarea className={[styles.fieldInput, styles.fieldTextarea, styles.fieldTextareaLg].join(' ')} value={formData.evolucionTexto} onChange={e => handleChange('evolucionTexto', e.target.value)} placeholder="Escribir la evolución del turno…" rows={6} />
                        </div>
                        {editId && (pacienteEnCama(camaSeleccionada)?.evoluciones || []).length > 0 && (
                          <div className={[styles.fieldGroup, styles.fieldFull].join(' ')}>
                            <label className={styles.fieldLabel}>Evoluciones anteriores</label>
                            <div className={styles.evoHistList}>
                              {[...(pacienteEnCama(camaSeleccionada)?.evoluciones || [])].sort((a, b) => new Date(b.fechaDoc).getTime() - new Date(a.fechaDoc).getTime()).map((ev, i) => (
                                <div key={i} className={styles.evoHistItem}>
                                  <div className={styles.evoHistMeta}>
                                    <span className={styles.evoHistDate}><Calendar size={11} /> {formatDate(ev.fechaDoc)}</span>
                                    {ev.medicoEvolucion && <span className={styles.evoHistDoc}>Dr. {ev.medicoEvolucion}</span>}
                                    {ev.fechaReal && <span className={styles.evoHistCarga}>cargado {formatDate(ev.fechaReal)}</span>}
                                  </div>
                                  <p className={styles.evoHistText}>{ev.texto}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeTab === 'examenes' && (
                      <div className={styles.fieldsGrid}>
                        <div className={[styles.fieldGroup, styles.fieldFull].join(' ')}>
                          <label className={styles.fieldLabel}>Exámenes / Estudios</label>
                          <textarea className={[styles.fieldInput, styles.fieldTextarea, styles.fieldTextareaLg].join(' ')} value={formData.examenes} onChange={e => handleChange('examenes', e.target.value)} placeholder="Laboratorio, imágenes, etc." rows={7} />
                        </div>
                      </div>
                    )}

                    <div className={styles.formActions}>
                      <div className={styles.formActionsLeft}>
                        <button type="submit" className={[styles.btn, styles.btnPrimary].join(' ')} disabled={saving}>
                          <Save size={16} />{saving ? 'Guardando…' : 'Guardar'}
                        </button>
                        <button type="button" className={[styles.btn, styles.btnGhost].join(' ')} onClick={() => setCamaSeleccionada(null)}>
                          Cancelar
                        </button>
                      </div>
                      {editId && (
                        <div className={styles.formActionsRight}>
                          <button type="button" className={[styles.btn, styles.btnGreen].join(' ')} onClick={() => setConfirmModal('alta')}>
                            <Home size={15} /> Alta
                          </button>
                          <button type="button" className={[styles.btn, styles.btnAmber].join(' ')} onClick={() => setConfirmModal('traslado')}>
                            <Truck size={15} /> Traslado
                          </button>
                        </div>
                      )}
                    </div>
                  </form>
                </div>
              )}
            </>
          )}

          {vista === 'tabla' && (
            <>
              <div className={styles.filtersBar}>
                <div className={styles.searchBox}>
                  <Search size={14} className={styles.searchIcon} />
                  <input type="text" placeholder="Buscar paciente, médico, obra social…" value={busqueda} onChange={e => setBusqueda(e.target.value)} className={styles.searchInput} />
                  {busqueda && <button type="button" className={styles.searchClear} onClick={() => setBusqueda('')}><XCircle size={13} /></button>}
                </div>
                <div className={styles.filterTabs}>
                  {[
                    { id: 'todos', l: 'Todos' },
                    { id: 'activos', l: 'Activos' },
                    { id: 'altas', l: 'Altas' },
                    { id: 'traslados', l: 'Traslados' },
                  ].map(f => (
                    <button key={f.id} type="button" className={[styles.filterTab, filtro === f.id ? styles.filterTabActive : ''].join(' ')} onClick={() => { setFiltro(f.id); setFiltroStatsActivo(f.id); }}>{f.l}</button>
                  ))}
                </div>
              </div>

              <div className={styles.tableCount}>{pacientesFiltrados.length} registro{pacientesFiltrados.length !== 1 ? 's' : ''}</div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Paciente</th><th>Cama</th><th>Ingreso</th><th>Médico</th><th>Días</th><th>Evol.</th><th>Última evolución</th><th>Estado</th><th>Acciones</th></tr>
                  </thead>
                  <tbody>
                    {pacientesFiltrados.length === 0 ? (
                      <tr><td colSpan={9} className={styles.noData}>No se encontraron pacientes</td></tr>
                    ) : (
                      pacientesFiltrados.map(p => {
                        const dias = calcDias(p.fechaIngreso);
                        const { label, cls } = estadoPaciente(p);
                        const ultEv = ultimaEvolucion(p);
                        const cargaStr = ultEv ? (ultEv.fechaReal || ultEv.fechaCarga) : null;
                        const tardia = ultEv ? esCargaTardia(ultEv.fechaDoc, cargaStr) : false;
                        return (
                          <tr key={p.id}>
                            <td className={styles.tdPaciente}>{p.paciente || '—'}</td>
                            <td>{p.cama || '—'}</td>
                            <td className={styles.tdFecha}>{fmtFecha(p.fechaIngreso)}</td>
                            <td>{p.medicoIngreso ? `Dr. ${p.medicoIngreso}` : '—'}</td>
                            <td>{dias}</td>
                            <td className={styles.tdEvos}>{(p.evoluciones || []).length}</td>
                            <td>
                              {ultEv ? (
                                <div className={styles.ultEvoCell}>
                                  <span className={styles.ultEvoFecha}>{fmtFecha(ultEv.fechaDoc)}</span>
                                  {cargaStr && <span className={[styles.ultEvoCarga, tardia ? styles.ultEvoCargaTardia : ''].join(' ')}>{fmtFecha(cargaStr)}{tardia && <AlertTriangle size={10} />}</span>}
                                </div>
                              ) : '—'}
                            </td>
                            <td><span className={[styles.estadoBadge, styles[`estado${cls[0].toUpperCase() + cls.slice(1)}`]].join(' ')}>{label}</span></td>
                            <td>
                              <div className={styles.rowActions}>
                                <button type="button" className={styles.rowBtn} onClick={() => abrirExpediente(p.paciente)} title="Ver expediente"><FileText size={13} /></button>
                                <button type="button" className={styles.rowBtn} onClick={() => imprimirHistoriaCompleta(agruparIngresos(pacientes, p.paciente))} title="Imprimir"><Printer size={13} /></button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {vista === 'timeline' && (
            <>
              <div className={styles.timelineFilters}>
                <div className={styles.timelineFilterGroup}>
                  <label className={styles.timelineFilterLabel}>Paciente</label>
                  <input type="text" className={styles.timelineFilterInput} placeholder="Buscar por nombre..." value={busquedaTimeline} onChange={e => setBusquedaTimeline(e.target.value)} />
                </div>
                <div className={styles.timelineFilterGroup}>
                  <label className={styles.timelineFilterLabel}>Desde</label>
                  <input type="date" className={styles.timelineFilterInput} value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
                </div>
                <div className={styles.timelineFilterGroup}>
                  <label className={styles.timelineFilterLabel}>Hasta</label>
                  <input type="date" className={styles.timelineFilterInput} value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
                </div>
                <div className={styles.timelineActions}>
                  <button type="button" className={styles.timelineResetBtn} onClick={() => { setFechaDesde(''); setFechaHasta(''); setBusquedaTimeline(''); setFiltroStatsActivo('todos'); }}>
                    <RotateCcw size={14} /> Limpiar filtros
                  </button>
                </div>
              </div>

              <div className={styles.timelineCount}><Clock size={13} /> {timelineFiltrado.length} eventos registrados</div>

              {timelineFiltrado.length === 0 ? (
                <p className={styles.noData}>Sin actividad registrada con esos filtros.</p>
              ) : (
                <div className={styles.timelineList}>
                  {timelineFiltrado.map((ev, i) => {
                    const dotCls = {
                      evol: styles.tlDotEvol,
                      alta: styles.tlDotAlta,
                      traslado: styles.tlDotTraslado,
                      ingreso: styles.tlDotIngreso,
                    }[ev.tipo] || styles.tlDotEvol;

                    const tipoLabel = {
                      evol: 'Evolución',
                      alta: 'Alta',
                      traslado: 'Traslado',
                      ingreso: 'Ingreso',
                    }[ev.tipo];

                    const carga = ev.ev ? (ev.ev.fechaReal || ev.ev.fechaCarga) : null;
                    const tardia = ev.ev ? esCargaTardia(ev.ev?.fechaDoc, carga) : false;

                    return (
                      <div key={i} className={styles.tlItem}>
                        <div className={[styles.tlDot, dotCls].join(' ')} />
                        <div className={styles.tlContent}>
                          <div className={styles.tlMeta}><strong>{ev.paciente}</strong> · Cama {ev.cama} · {ev.fecha}</div>
                          {ev.ev && ev.tipo === 'evol' && (
                            <div className={styles.tlFechas}>
                              <span className={styles.tlFechaClinica}><Calendar size={9} /> {fmtFecha(ev.ev.fechaDoc)}</span>
                              {carga && <span className={[styles.tlFechaCarga, tardia ? styles.tlFechaTardia : ''].join(' ')}><Clock size={9} /> {fmtFecha(carga)}{tardia && <AlertTriangle size={9} />}</span>}
                            </div>
                          )}
                          {ev.texto && <p className={styles.tlTexto}>{ev.texto}</p>}
                          <div className={styles.tlTags}>
                            <span className={styles.tlTag}>{tipoLabel}</span>
                            {ev.medico && <span className={styles.tlTag}>Dr. {ev.medico}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {confirmModal && (
        <ConfirmModal
          tipo={confirmModal}
          onConfirm={confirmModal === 'alta' ? handleAltaConfirm : handleTrasladoConfirm}
          onCancel={() => setConfirmModal(null)}
        />
      )}
    </>
  );
}
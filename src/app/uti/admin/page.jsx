'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { ref, onValue, push, update } from 'firebase/database';
import { getSession, clearSession } from '@/utils/session';
import {
  Activity, User, Calendar, FileText, Printer,
  Copy, Check, LogOut, Search, XCircle, Home,
  Truck, FlaskConical, Stethoscope,
  UserCheck, BarChart2, Clock, TrendingUp, Users,
  AlertTriangle, ChevronDown, ChevronUp, ArrowLeft,
  PlusCircle, Edit3, Save, RotateCcw,
} from 'lucide-react';
import Header from '@/components/Header/Header';
import styles from './page.module.css';

const TOTAL_CAMAS = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcDias(fechaIngreso) {
  if (!fechaIngreso) return 0;
  return Math.max(0, Math.floor((new Date() - new Date(fechaIngreso)) / 86400000));
}

function parseFechaFlexible(value) {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value) ? null : value;

  const str = String(value).trim();
  if (!str) return null;

  // dd/mm/yyyy hh:mm
  let m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00`);
    return isNaN(d) ? null : d;
  }

  // dd/mm/yyyy
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) {
    const d = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00`);
    return isNaN(d) ? null : d;
  }

  // yyyy-mm-dd
  m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
    return isNaN(d) ? null : d;
  }

  const d = new Date(str);
  return isNaN(d) ? null : d;
}

function fechaTieneHora(value) {
  if (!value) return false;
  const str = String(value).trim();

  if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/.test(str)) return true;
  if (/T\d{2}:\d{2}/.test(str)) return true;
  if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) return true;

  const d = parseFechaFlexible(str);
  if (!d) return false;

  return d.getHours() !== 0 || d.getMinutes() !== 0 || d.getSeconds() !== 0;
}

function fmtFecha(value) {
  if (!value) return '—';

  const parsed = parseFechaFlexible(value);
  if (!parsed) return String(value);

  const base = parsed.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  if (fechaTieneHora(value)) {
    const hora = parsed.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return `${base}, ${hora}`;
  }

  return base;
}

function parseFechaCarga(str) {
  return parseFechaFlexible(str);
}

function esCargaTardia(fechaDoc, cargaStr) {
  if (!fechaDoc || !cargaStr) return false;

  const dDoc = parseFechaFlexible(fechaDoc);
  const dCarga = parseFechaFlexible(cargaStr);
  if (!dDoc || !dCarga) return false;

  return (
    dDoc.getFullYear() !== dCarga.getFullYear() ||
    dDoc.getMonth() !== dCarga.getMonth() ||
    dDoc.getDate() !== dCarga.getDate()
  );
}

function estadoPaciente(p) {
  if (p.fechaAlta) return { label: 'Alta', cls: 'alta' };
  if (p.fechaTraslado) return { label: 'Traslado', cls: 'traslado' };
  if (!p.activo) return { label: 'Inactivo', cls: 'inactivo' };
  return { label: 'Activo', cls: 'activo' };
}

function ultimaEvolucion(p) {
  const evs = p.evoluciones || [];
  if (!evs.length) return null;

  return [...evs].sort((a, b) => {
    const ka = parseFechaCarga(a.fechaReal || a.fechaCarga) || parseFechaFlexible(a.fechaDoc);
    const kb = parseFechaCarga(b.fechaReal || b.fechaCarga) || parseFechaFlexible(b.fechaDoc);
    return kb - ka;
  })[0];
}

function agruparIngresos(todos, nombre) {
  return todos
    .filter(p => p.paciente === nombre)
    .sort((a, b) => new Date(a.fechaIngreso || 0) - new Date(b.fechaIngreso || 0))
    .map((p, i) => ({ ...p, nroIngreso: i + 1 }));
}

function nowFormatted() {
  const d = new Date();
  return (
    [String(d.getDate()).padStart(2, '0'), String(d.getMonth() + 1).padStart(2, '0'), d.getFullYear()].join('/')
    + ' ' +
    [String(d.getHours()).padStart(2, '0'), String(d.getMinutes()).padStart(2, '0')].join(':')
  );
}

function toDateOnly(value) {
  const parsed = parseFechaFlexible(value);
  if (!parsed) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

// ─── CSS impresión ────────────────────────────────────────────────────────────
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
    return da - db;
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

// ─── Gráfico ──────────────────────────────────────────────────────────────────
function BarChart({ data }) {
  const max = Math.max(...data.map(d => d.value), 1);

  return (
    <div className={styles.barChart}>
      {data.map((d) => (
        <div key={d.label} className={styles.barRow}>
          <span className={styles.barLabel}>{d.label}</span>
          <div className={styles.barTrack}>
            <div
              className={styles.barFill}
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
          <span className={styles.barVal}>{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Modal Reingresar ─────────────────────────────────────────────────────────
function ReingresarModal({ paciente, camasLibres, adminNombre, onConfirm, onCancel, saving }) {
  const [cama, setCama] = useState(camasLibres[0] || '');
  const [error, setError] = useState('');

  const handleOk = () => {
    if (!cama) {
      setError('Seleccioná una cama.');
      return;
    }

    onConfirm({ cama: Number(cama), medico: adminNombre });
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
            <div className={styles.pacienteInfoIcon}>
              <User size={18} />
            </div>
            <div>
              <p className={styles.pacienteInfoNombre}>{paciente.paciente}</p>
              <p className={styles.pacienteInfoSub}>
                Último ingreso: {fmtFecha(paciente.fechaIngreso)} · {paciente.obraSocial || 'Sin obra social'}
              </p>
            </div>
          </div>

          <div className={styles.adminNote}>
            <UserCheck size={14} />
            <span>
              Reingreso registrado a nombre de <strong>{adminNombre}</strong>
            </span>
          </div>

          {camasLibres.length === 0 ? (
            <div className={styles.errorBanner}>
              <AlertTriangle size={14} />
              No hay camas disponibles.
            </div>
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

          {error && (
            <div className={styles.errorBanner}>
              <AlertTriangle size={13} />
              {error}
            </div>
          )}

          <p className={styles.reingresarNote}>
            Los antecedentes se copian al nuevo ingreso. Las evoluciones anteriores quedan en el historial.
          </p>

          <div className={styles.modalActions}>
            <button type="button" className={[styles.btn, styles.btnGhost].join(' ')} onClick={onCancel}>
              <XCircle size={15} />
              Cancelar
            </button>

            {camasLibres.length > 0 && (
              <button
                type="button"
                className={[styles.btn, styles.btnBlue].join(' ')}
                onClick={handleOk}
                disabled={saving}
              >
                <PlusCircle size={15} />
                {saving ? 'Reingresando…' : 'Confirmar reingreso'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal Evolucionar (admin) ────────────────────────────────────────────────
function EvolucionarModal({ paciente, adminNombre, onConfirm, onCancel, saving }) {
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
      medicoEvolucion: adminNombre,
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
            <div className={styles.pacienteInfoIcon}>
              <Activity size={18} />
            </div>
            <div>
              <p className={styles.pacienteInfoNombre}>{paciente.paciente}</p>
              <p className={styles.pacienteInfoSub}>
                Cama {paciente.cama} · {fmtFecha(paciente.fechaIngreso)}
              </p>
            </div>
          </div>

          <div className={styles.adminNote}>
            <UserCheck size={14} />
            <span>
              Evolución registrada a nombre de <strong>{adminNombre}</strong>
            </span>
          </div>

          <div className={styles.fieldsRow}>
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>Fecha de la evolución</label>
              <input
                type="date"
                className={styles.fieldInput}
                value={fechaDoc}
                max={hoy}
                onChange={e => setFechaDoc(e.target.value)}
              />
              {distinta && (
                <div className={styles.alertNote}>
                  <AlertTriangle size={12} />
                  Se cargará hoy con fecha {fmtFecha(fechaDoc)}.
                </div>
              )}
            </div>
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Texto de la evolución *</label>
            <textarea
              className={[styles.fieldInput, styles.fieldTextarea].join(' ')}
              rows={5}
              value={texto}
              onChange={e => setTexto(e.target.value)}
              placeholder="Escribir la evolución…"
              autoFocus
            />
          </div>

          {error && (
            <div className={styles.errorBanner}>
              <AlertTriangle size={13} />
              {error}
            </div>
          )}

          <div className={styles.modalActions}>
            <button type="button" className={[styles.btn, styles.btnGhost].join(' ')} onClick={onCancel}>
              <XCircle size={15} />
              Cancelar
            </button>
            <button
              type="button"
              className={[styles.btn, styles.btnGreen].join(' ')}
              onClick={handleOk}
              disabled={saving}
            >
              <Save size={15} />
              {saving ? 'Guardando…' : 'Guardar evolución'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Expediente del paciente — pantalla completa ──────────────────────────────
function ExpedienteFullscreen({
  ingresos,
  camasOcupadas,
  adminNombre,
  onClose,
  onReingresarDone,
}) {
  const [expandidos, setExpandidos] = useState(new Set([ingresos.length - 1]));
  const [copied, setCopied] = useState(false);
  const [reingresarP, setReingresarP] = useState(null);
  const [evolucionarP, setEvolucionarP] = useState(null);
  const [savingReingreso, setSavingReingreso] = useState(false);
  const [savingEvol, setSavingEvol] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const camasLibres = Array.from({ length: TOTAL_CAMAS }, (_, i) => i + 1)
    .filter(c => !camasOcupadas.includes(c));

  const toast = msg => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3500);
  };

  const toggle = i => {
    setExpandidos(prev => {
      const s = new Set(prev);
      if (s.has(i)) s.delete(i);
      else s.add(i);
      return s;
    });
  };

  const copiarResumen = async () => {
    try {
      const lines = ingresos.map((p, i) => {
        const evols = [...(p.evoluciones || [])].sort((a, b) => {
          const da = parseFechaFlexible(a.fechaDoc) || new Date(0);
          const db = parseFechaFlexible(b.fechaDoc) || new Date(0);
          return da - db;
        });

        const evsText = evols.map((ev, j) => {
          const carga = ev.fechaReal || ev.fechaCarga;
          return `  [${j + 1}] ${fmtFecha(ev.fechaDoc)} | Cargado: ${fmtFecha(carga)} | Dr. ${ev.medicoEvolucion || '—'}\n  ${ev.texto || '—'}`;
        }).join('\n\n');

        return `=== INGRESO ${i + 1} — ${fmtFecha(p.fechaIngreso)} · Cama ${p.cama} ===\nMédico: Dr. ${p.medicoIngreso || '—'} | OS: ${p.obraSocial || '—'}\n\n${evsText || '  (sin evoluciones)'}`;
      }).join('\n\n' + '─'.repeat(48) + '\n\n');

      await navigator.clipboard.writeText(
        `HISTORIA CLÍNICA — ${ingresos[0]?.paciente}\nClínica de la Unión S.A.\n\n${lines}`
      );

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
        obraSocial: p.obraSocial || '',
        medicoIngreso: medico,
        fechaIngreso: new Date().toISOString().split('T')[0],
        motivoIngreso: '',
        diagnosticoActual: '',
        antecedentes: p.antecedentes || '',
        tratamientoActual: '',
        examenes: '',
        pendientes: '',
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

      await update(ref(db, `UTI/${p.id}`), {
        evoluciones: nuevasEvols,
        ultimaActualizacion: new Date().toISOString(),
      });

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
        <button type="button" className={styles.backBtn} onClick={onClose}>
          <ArrowLeft size={18} />
          Volver
        </button>

        <div className={styles.expedienteTopbarCenter}>
          <p className={styles.expedienteNombre}>{nombre}</p>
          <p className={styles.expedienteMeta}>
            {ingresos.length} ingreso{ingresos.length !== 1 ? 's' : ''} · Historia clínica completa
          </p>
        </div>

        <div className={styles.expedienteTopbarActions}>
          <button
            type="button"
            className={[styles.actionBtn, styles.actionCopy, copied ? styles.actionDone : ''].join(' ')}
            onClick={copiarResumen}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            <span className={styles.actionLabel}>{copied ? '¡Copiado!' : 'Copiar'}</span>
          </button>

          <button
            type="button"
            className={[styles.actionBtn, styles.actionPrint].join(' ')}
            onClick={() => imprimirHistoriaCompleta(ingresos)}
          >
            <Printer size={15} />
            <span className={styles.actionLabel}>Imprimir</span>
          </button>
        </div>
      </div>

      {toastMsg && <div className={styles.toast}>{toastMsg}</div>}

      <div className={styles.expedienteScroll}>
        <div className={styles.expedienteInner}>
          {ingresos.map((p, idx) => {
            const open = expandidos.has(idx);
            const { label, cls } = estadoPaciente(p);
            const evols = [...(p.evoluciones || [])].sort((a, b) => {
              const da = parseFechaFlexible(a.fechaDoc) || new Date(0);
              const db = parseFechaFlexible(b.fechaDoc) || new Date(0);
              return da - db;
            });
            const dias = calcDias(p.fechaIngreso);
            const esActivo = p.activo && !p.fechaAlta && !p.fechaTraslado;
            const puedeReingresar = !!(p.fechaAlta || p.fechaTraslado || !p.activo);

            return (
              <div key={p.id} className={[styles.ingresoCard, esActivo ? styles.ingresoActivo : ''].join(' ')}>
                <div className={styles.ingresoCardHeader}>
                  <button
                    type="button"
                    className={styles.ingresoToggle}
                    onClick={() => toggle(idx)}
                    aria-expanded={open}
                  >
                    <div className={styles.ingresoNumBadge}>{idx + 1}</div>

                    <div className={styles.ingresoToggleInfo}>
                      <span className={styles.ingresoFecha}>
                        Ingreso del {fmtFecha(p.fechaIngreso)}
                        {esActivo && <span className={styles.badgeActivo}>En curso</span>}
                        {p.reingresoMedico && <span className={styles.badgeReingreso}>Reingreso</span>}
                      </span>

                      <span className={styles.ingresoMeta}>
                        Cama {p.cama} · {dias}d · Dr. {p.medicoIngreso || '—'} ·{' '}
                        <span
                          className={[
                            styles.estadoBadge,
                            styles[`estado${cls[0].toUpperCase() + cls.slice(1)}`],
                          ].join(' ')}
                        >
                          {label}
                        </span>
                      </span>
                    </div>

                    <div className={styles.ingresoToggleRight}>
                      <span className={styles.evoCountChip}>
                        <Activity size={11} /> {evols.length}
                      </span>
                      {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </button>

                  <div className={styles.ingresoAcciones}>
                    {esActivo && (
                      <button
                        type="button"
                        className={[styles.ingresoBtn, styles.ingresoBtnEvolucionar].join(' ')}
                        onClick={() => setEvolucionarP(p)}
                      >
                        <Edit3 size={13} />
                        Evolucionar
                      </button>
                    )}

                    {puedeReingresar && (
                      <button
                        type="button"
                        className={[styles.ingresoBtn, styles.ingresoBtnReingresar].join(' ')}
                        onClick={() => setReingresarP(p)}
                      >
                        <PlusCircle size={13} />
                        Reingresar
                      </button>
                    )}
                  </div>
                </div>

                {open && (
                  <div className={styles.ingresoBody}>
                    <div className={styles.seccion}>
                      <h3 className={styles.seccionTitulo}>
                        <UserCheck size={13} />
                        Admisión
                      </h3>

                      <div className={styles.seccionGrid}>
                        {[
                          ['Médico de ingreso', p.medicoIngreso ? `Dr. ${p.medicoIngreso}` : null],
                          ['Fecha de ingreso', fmtFecha(p.fechaIngreso)],
                          ['Obra Social', p.obraSocial],
                          ['Motivo de ingreso', p.motivoIngreso],
                          p.reingresoMedico ? ['Reingreso indicado por', `ADM — ${p.reingresoMedico}`] : null,
                        ]
                          .filter(Boolean)
                          .filter(([, v]) => v)
                          .map(([l, v]) => (
                            <div key={l} className={styles.campo}>
                              <span className={styles.campoLabel}>{l}</span>
                              <span className={styles.campoValor}>{v}</span>
                            </div>
                          ))}
                      </div>
                    </div>

                    {(p.diagnosticoActual || p.antecedentes || p.tratamientoActual || p.pendientes) && (
                      <div className={styles.seccion}>
                        <h3 className={styles.seccionTitulo}>
                          <Stethoscope size={13} />
                          Estado Clínico
                        </h3>

                        <div className={styles.seccionGrid}>
                          {[
                            ['Diagnóstico', p.diagnosticoActual],
                            ['Antecedentes', p.antecedentes],
                            ['Tratamiento', p.tratamientoActual],
                            ['Pendientes', p.pendientes],
                          ]
                            .filter(([, v]) => v)
                            .map(([l, v]) => (
                              <div key={l} className={styles.campo}>
                                <span className={styles.campoLabel}>{l}</span>
                                <span className={styles.campoValor}>{v}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {p.examenes && (
                      <div className={styles.seccion}>
                        <h3 className={styles.seccionTitulo}>
                          <FlaskConical size={13} />
                          Exámenes
                        </h3>
                        <p className={styles.campoPre}>{p.examenes}</p>
                      </div>
                    )}

                    <div className={styles.seccion}>
                      <h3 className={styles.seccionTitulo}>
                        <Activity size={13} />
                        Evoluciones
                        <span className={styles.countBadge}>{evols.length}</span>
                      </h3>

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
                                    <span className={styles.evoFechaClinica}>
                                      <Calendar size={11} /> {fmtFecha(ev.fechaDoc)}
                                    </span>

                                    {ev.medicoEvolucion && (
                                      <span className={styles.evoMedico}>
                                        Dr. {ev.medicoEvolucion}
                                      </span>
                                    )}

                                    {carga && (
                                      <span
                                        className={[
                                          styles.evoCarga,
                                          tardia ? styles.evoCargaTardia : '',
                                        ].join(' ')}
                                      >
                                        <Clock size={10} /> {fmtFecha(carga)}
                                        {tardia && (
                                          <>
                                            <AlertTriangle size={10} /> tardía
                                          </>
                                        )}
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
                        <h3 className={styles.seccionTitulo}>
                          <Home size={13} />
                          Alta
                        </h3>

                        <div className={styles.seccionGrid}>
                          {[
                            ['Fecha', fmtFecha(p.fechaAlta)],
                            ['Médico', p.medicoAlta ? `Dr. ${p.medicoAlta}` : null],
                            ['Motivo', p.motivoAlta],
                          ]
                            .filter(([, v]) => v)
                            .map(([l, v]) => (
                              <div key={l} className={styles.campo}>
                                <span className={styles.campoLabel}>{l}</span>
                                <span className={styles.campoValor}>{v}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                    {p.fechaTraslado && (
                      <div className={[styles.seccion, styles.seccionTraslado].join(' ')}>
                        <h3 className={styles.seccionTitulo}>
                          <Truck size={13} />
                          Traslado
                        </h3>

                        <div className={styles.seccionGrid}>
                          {[
                            ['Fecha', fmtFecha(p.fechaTraslado)],
                            ['Médico', p.medicoTraslado ? `Dr. ${p.medicoTraslado}` : null],
                            ['Destino', p.destinoTraslado],
                            ['Motivo', p.motivoTraslado],
                          ]
                            .filter(([, v]) => v)
                            .map(([l, v]) => (
                              <div key={l} className={styles.campo}>
                                <span className={styles.campoLabel}>{l}</span>
                                <span className={styles.campoValor}>{v}</span>
                              </div>
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
          adminNombre={adminNombre}
          onConfirm={handleReingresarConfirm}
          onCancel={() => setReingresarP(null)}
          saving={savingReingreso}
        />
      )}

      {evolucionarP && (
        <EvolucionarModal
          paciente={evolucionarP}
          adminNombre={adminNombre}
          onConfirm={handleEvolucionarConfirm}
          onCancel={() => setEvolucionarP(null)}
          saving={savingEvol}
        />
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function AdminUtiPage() {
  const router = useRouter();

  const [sessionUser, setSessionUser] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filtro, setFiltro] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [expediente, setExpediente] = useState(null);
  const [vista, setVista] = useState('tabla');

  const [filtroStatsActivo, setFiltroStatsActivo] = useState('todos');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [busquedaTimeline, setBusquedaTimeline] = useState('');

  useEffect(() => {
    const s = getSession();

    if (!s || (s.TipoEmpleado !== 'ADM' && s.TipoEmpleado !== 'UTI')) {
      router.push('/login');
      return;
    }

    setSessionUser(s);
    setSessionLoading(false);
  }, [router]);

  useEffect(() => {
    const utiRef = ref(db, 'UTI');

    return onValue(utiRef, snap => {
      const d = snap.val();
      setPacientes(d ? Object.entries(d).map(([id, v]) => ({ id, ...v })) : []);
      setLoading(false);
    });
  }, []);

  const adminNombre = sessionUser?.nombre || sessionUser?.user || 'Administrador';

  const camasOcupadas = useMemo(() => (
    pacientes
      .filter(p => p.activo && !p.fechaAlta && !p.fechaTraslado)
      .map(p => p.cama)
  ), [pacientes]);

  const abrirExpediente = useCallback((nombrePaciente) => {
    setExpediente(agruparIngresos(pacientes, nombrePaciente));
  }, [pacientes]);

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
          (p.evoluciones || []).some(ev =>
            (ev.medicoEvolucion || '').toLowerCase().includes(q) ||
            (ev.texto || '').toLowerCase().includes(q)
          )
        );
      }

      return true;
    });
  }, [pacientes, filtro, busqueda]);

  const stats = useMemo(() => ({
    total: pacientes.length,
    activos: pacientes.filter(p => p.activo && !p.fechaAlta && !p.fechaTraslado).length,
    altas: pacientes.filter(p => p.fechaAlta).length,
    traslados: pacientes.filter(p => p.fechaTraslado).length,
    totalEvos: pacientes.reduce((a, p) => a + (p.evoluciones || []).length, 0),
    tardias: pacientes.reduce(
      (a, p) => a + (p.evoluciones || []).filter(ev => esCargaTardia(ev.fechaDoc, ev.fechaReal || ev.fechaCarga)).length,
      0
    ),
  }), [pacientes]);

  const medicosList = useMemo(() => {
    const evosPorMedico = {};
    pacientes.forEach(p => {
      (p.evoluciones || []).forEach(ev => {
        const k = ev.medicoEvolucion || '(sin nombre)';
        evosPorMedico[k] = (evosPorMedico[k] || 0) + 1;
      });
    });

    return Object.entries(evosPorMedico)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, value]) => ({ label, value }));
  }, [pacientes]);

  const camasList = useMemo(() => (
    Array.from({ length: TOTAL_CAMAS }, (_, i) => i + 1).map(c => ({
      label: `Cama ${c}`,
      value: pacientes.filter(p => p.cama === c).length,
    }))
  ), [pacientes]);

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
          _sk: parseFechaCarga(carga) || parseFechaFlexible(ev.fechaDoc),
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

    eventos.sort((a, b) => (b._sk || 0) - (a._sk || 0));
    return eventos;
  }, [pacientes]);

  const timelineFiltrado = useMemo(() => {
    return todosEventos.filter(ev => {
      if (filtroStatsActivo === 'tardias') {
        if (!(ev.tipo === 'evol' && ev.ev && esCargaTardia(ev.ev.fechaDoc, ev.ev.fechaReal || ev.ev.fechaCarga))) {
          return false;
        }
      }

      if (busquedaTimeline.trim()) {
        const q = busquedaTimeline.toLowerCase();
        const matchPaciente = (ev.paciente || '').toLowerCase().includes(q);
        if (!matchPaciente) return false;
      }

      const desde = fechaDesde ? toDateOnly(fechaDesde) : null;
      const hasta = fechaHasta ? toDateOnly(fechaHasta) : null;
      const fechaEvento = ev._dateOnly;

      if (desde && fechaEvento && fechaEvento < desde) return false;
      if (hasta && fechaEvento && fechaEvento > hasta) return false;

      return true;
    });
  }, [todosEventos, filtroStatsActivo, busquedaTimeline, fechaDesde, fechaHasta]);

  if (sessionLoading) {
    return (
      <>
        <Header />
        <div className={styles.loadingScreen}>
          <div className={styles.spinner} />
        </div>
      </>
    );
  }

  if (!sessionUser) return null;

  if (expediente) {
    return (
      <>
        <Header />
        <ExpedienteFullscreen
          ingresos={expediente}
          camasOcupadas={camasOcupadas}
          adminNombre={adminNombre}
          onClose={() => setExpediente(null)}
          onReingresarDone={() => setExpediente(null)}
        />
      </>
    );
  }

  return (
    <>
      <Header />

      <main className={styles.page}>
        <nav className={styles.adminTopbar}>
          <div className={styles.adminTopbarLeft}>
            <div className={styles.adminTopbarIcon}>
              <BarChart2 size={17} />
            </div>
            <span className={styles.adminTopbarTitle}>Dashboard UTI</span>
          </div>

          <div className={styles.adminTopbarCenter}>
            {[
              { id: 'tabla', label: 'Historial', icon: <FileText size={14} /> },
              { id: 'timeline', label: 'Timeline', icon: <Activity size={14} /> },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                className={[styles.adminNavBtn, vista === t.id ? styles.adminNavBtnActive : ''].join(' ')}
                onClick={() => {
                  setVista(t.id);
                  setFiltroStatsActivo('todos');
                }}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          <div className={styles.adminTopbarRight}>
            <span className={styles.adminUserBadge}>
              <User size={13} /> {adminNombre}
            </span>
            <button
              type="button"
              className={styles.adminLogoutBtn}
              onClick={() => {
                clearSession();
                router.push('/login');
              }}
            >
              <LogOut size={14} />
            </button>
          </div>
        </nav>

        <div className={styles.statsGrid}>
          {[
            {
              id: 'activos',
              label: 'Activos en UTI',
              value: stats.activos,
              icon: <Activity size={15} />,
              mod: styles.sRed,
              vista: 'tabla',
              filtroTabla: 'activos',
              filtroStats: 'activos',
            },
            {
              id: 'todos',
              label: 'Total ingresos',
              value: stats.total,
              icon: <Users size={15} />,
              mod: styles.sBlue,
              vista: 'tabla',
              filtroTabla: 'todos',
              filtroStats: 'todos',
            },
            {
              id: 'altas',
              label: 'Altas',
              value: stats.altas,
              icon: <Home size={15} />,
              mod: styles.sGreen,
              vista: 'tabla',
              filtroTabla: 'altas',
              filtroStats: 'altas',
            },
            {
              id: 'traslados',
              label: 'Traslados',
              value: stats.traslados,
              icon: <Truck size={15} />,
              mod: styles.sAmber,
              vista: 'tabla',
              filtroTabla: 'traslados',
              filtroStats: 'traslados',
            },
            {
              id: 'evoluciones',
              label: 'Evoluciones',
              value: stats.totalEvos,
              icon: <FileText size={15} />,
              mod: styles.sBlue,
              vista: 'timeline',
              filtroTabla: 'todos',
              filtroStats: 'todos',
            },
            {
              id: 'tardias',
              label: 'Cargas tardías',
              value: stats.tardias,
              icon: <AlertTriangle size={15} />,
              mod: styles.sAmber,
              vista: 'timeline',
              filtroTabla: 'todos',
              filtroStats: 'tardias',
            },
          ].map(s => {
            const active =
              (vista === 'tabla' && s.vista === 'tabla' && filtroStatsActivo === s.filtroStats) ||
              (vista === 'timeline' && s.vista === 'timeline' && filtroStatsActivo === s.filtroStats);

            return (
              <button
                key={s.id}
                type="button"
                className={styles.statCardButton}
                onClick={() => {
                  setVista(s.vista);
                  setFiltroStatsActivo(s.filtroStats);

                  if (s.vista === 'tabla') {
                    setFiltro(s.filtroTabla);
                  }

                  if (s.vista === 'timeline' && s.filtroStats !== 'tardias') {
                    setFechaDesde('');
                    setFechaHasta('');
                    setBusquedaTimeline('');
                  }
                }}
              >
                <div
                  className={[
                    styles.statCard,
                    styles.statCardInteractive,
                    active ? styles.statCardActive : '',
                  ].join(' ')}
                >
                  <div className={styles.statCardIcon}>{s.icon}</div>
                  <p className={[styles.statCardValue, s.mod].join(' ')}>{s.value}</p>
                  <p className={styles.statCardLabel}>{s.label}</p>
                </div>
              </button>
            );
          })}
        </div>

        <div className={styles.chartsRow}>
          <div className={styles.chartCard}>
            <p className={styles.chartTitle}>
              <TrendingUp size={13} /> Evoluciones por médico
            </p>
            {medicosList.length > 0 ? <BarChart data={medicosList} /> : <p className={styles.noData}>Sin datos</p>}
          </div>

          <div className={styles.chartCard}>
            <p className={styles.chartTitle}>
              <BarChart2 size={13} /> Ingresos por cama
            </p>
            <BarChart data={camasList} />
          </div>
        </div>

        <div className={styles.contentPanel}>
          {vista === 'tabla' && (
            <>
              <div className={styles.filtersBar}>
                <div className={styles.searchBox}>
                  <Search size={14} className={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Buscar paciente, médico, obra social…"
                    value={busqueda}
                    onChange={e => setBusqueda(e.target.value)}
                    className={styles.searchInput}
                  />
                  {busqueda && (
                    <button type="button" className={styles.searchClear} onClick={() => setBusqueda('')}>
                      <XCircle size={13} />
                    </button>
                  )}
                </div>

                <div className={styles.filterTabs}>
                  {[
                    { id: 'todos', l: 'Todos' },
                    { id: 'activos', l: 'Activos' },
                    { id: 'altas', l: 'Altas' },
                    { id: 'traslados', l: 'Traslados' },
                  ].map(f => (
                    <button
                      key={f.id}
                      type="button"
                      className={[styles.filterTab, filtro === f.id ? styles.filterTabActive : ''].join(' ')}
                      onClick={() => {
                        setFiltro(f.id);
                        setFiltroStatsActivo(f.id);
                      }}
                    >
                      {f.l}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.tableCount}>
                {pacientesFiltrados.length} registro{pacientesFiltrados.length !== 1 ? 's' : ''}
              </div>

              {loading ? (
                <div className={styles.loadingScreen}>
                  <div className={styles.spinner} />
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Paciente</th>
                        <th>Cama</th>
                        <th>Ingreso</th>
                        <th>Médico</th>
                        <th>Días</th>
                        <th>Evol.</th>
                        <th>Última evolución</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>

                    <tbody>
                      {pacientesFiltrados.length === 0 ? (
                        <tr>
                          <td colSpan="9" className={styles.noData}>
                            No se encontraron pacientes
                          </td>
                        </tr>
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
                                    {cargaStr && (
                                      <span
                                        className={[
                                          styles.ultEvoCarga,
                                          tardia ? styles.ultEvoCargaTardia : '',
                                        ].join(' ')}
                                      >
                                        {fmtFecha(cargaStr)}
                                        {tardia && <AlertTriangle size={10} />}
                                      </span>
                                    )}
                                  </div>
                                ) : '—'}
                              </td>
                              <td>
                                <span
                                  className={[
                                    styles.estadoBadge,
                                    styles[`estado${cls[0].toUpperCase() + cls.slice(1)}`],
                                  ].join(' ')}
                                >
                                  {label}
                                </span>
                              </td>
                              <td>
                                <div className={styles.rowActions}>
                                  <button
                                    type="button"
                                    className={styles.rowBtn}
                                    onClick={() => abrirExpediente(p.paciente)}
                                    title="Ver expediente"
                                  >
                                    <FileText size={13} />
                                  </button>

                                  <button
                                    type="button"
                                    className={styles.rowBtn}
                                    onClick={() => imprimirHistoriaCompleta(agruparIngresos(pacientes, p.paciente))}
                                    title="Imprimir"
                                  >
                                    <Printer size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {vista === 'timeline' && (
            <>
              <div className={styles.timelineFilters}>
                <div className={styles.timelineFilterGroup}>
                  <label className={styles.timelineFilterLabel}>Paciente</label>
                  <input
                    type="text"
                    className={styles.timelineFilterInput}
                    placeholder="Buscar por nombre..."
                    value={busquedaTimeline}
                    onChange={(e) => setBusquedaTimeline(e.target.value)}
                  />
                </div>

                <div className={styles.timelineFilterGroup}>
                  <label className={styles.timelineFilterLabel}>Desde</label>
                  <input
                    type="date"
                    className={styles.timelineFilterInput}
                    value={fechaDesde}
                    onChange={(e) => setFechaDesde(e.target.value)}
                  />
                </div>

                <div className={styles.timelineFilterGroup}>
                  <label className={styles.timelineFilterLabel}>Hasta</label>
                  <input
                    type="date"
                    className={styles.timelineFilterInput}
                    value={fechaHasta}
                    onChange={(e) => setFechaHasta(e.target.value)}
                  />
                </div>

                <div className={styles.timelineActions}>
                  <button
                    type="button"
                    className={styles.timelineResetBtn}
                    onClick={() => {
                      setFechaDesde('');
                      setFechaHasta('');
                      setBusquedaTimeline('');
                      setFiltroStatsActivo('todos');
                    }}
                  >
                    <RotateCcw size={14} />
                    Limpiar filtros
                  </button>
                </div>
              </div>

              <div className={styles.timelineCount}>
                <Clock size={13} /> {timelineFiltrado.length} eventos registrados
              </div>

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
                          <div className={styles.tlMeta}>
                            <strong>{ev.paciente}</strong> · Cama {ev.cama} · {ev.fecha}
                          </div>

                          {ev.ev && ev.tipo === 'evol' && (
                            <div className={styles.tlFechas}>
                              <span className={styles.tlFechaClinica}>
                                <Calendar size={9} /> {fmtFecha(ev.ev.fechaDoc)}
                              </span>
                              {carga && (
                                <span
                                  className={[
                                    styles.tlFechaCarga,
                                    tardia ? styles.tlFechaTardia : '',
                                  ].join(' ')}
                                >
                                  <Clock size={9} /> {fmtFecha(carga)}
                                  {tardia && <AlertTriangle size={9} />}
                                </span>
                              )}
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
    </>
  );
}
'use client';

import { useState, useEffect, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue } from 'firebase/database';
import {
  Activity, User, Save, XCircle, Truck, Home,
  Stethoscope, FlaskConical, AlertCircle, Calendar,
  FileText, UserCheck, Printer, Copy, Check,
  MessageCircle, LogOut, MapPin, Wifi, WifiOff,
  RefreshCw, ArrowLeft,
} from 'lucide-react';
import Header from '@/components/Header/Header';
import { useOfflineQueue } from './useOfflineQueue';
import styles from './page.module.css';

// ─── Constantes ───────────────────────────────────────────────────────────────
const CAMAS = [1, 2, 3, 4, 5];

const TABS = [
  { id: 'datos', label: 'Datos', Icon: User },
  { id: 'clinico', label: 'Clínico', Icon: Stethoscope },
  { id: 'evolucion', label: 'Evolución', Icon: Activity },
  { id: 'examenes', label: 'Exámenes', Icon: FlaskConical },
];

const FORM_DEFAULTS = {
  paciente: '', medicoIngreso: '', obraSocial: '',
  fechaIngreso: new Date().toISOString().split('T')[0],
  motivoIngreso: '', diagnosticoActual: '', antecedentes: '',
  tratamientoActual: '', examenes: '', pendientes: '',
  evolucionFechaDoc: new Date().toISOString().split('T')[0],
  evolucionTexto: '', medicoEvolucion: '',
};

// ─── Helpers de formato de fecha ──────────────────────────────────────────────
function formatDate(dateString) {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString; // si no es fecha válida, devolver original

  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  const horas = String(date.getHours()).padStart(2, '0');
  const minutos = String(date.getMinutes()).padStart(2, '0');

  // Si la fecha tiene horas distintas de 0 o minutos, asumimos que tiene hora significativa
  if (date.getHours() !== 0 || date.getMinutes() !== 0) {
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  }
  return `${dia}/${mes}/${anio}`;
}

function calcDias(fechaIngreso) {
  if (!fechaIngreso) return 0;
  return Math.max(0, Math.floor((new Date() - new Date(fechaIngreso)) / 86400000));
}

function generarTextoPlano(paciente) {
  if (!paciente) return '';
  const dias = calcDias(paciente.fechaIngreso);
  const sep = '─'.repeat(40);
  const evols = [...(paciente.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));
  const lines = [
    '🏥 HISTORIA CLÍNICA — UTI',
    'Clínica de la Unión S.A.',
    `Fecha: ${formatDate(new Date().toISOString())}`,
    sep, '',
    `Paciente : ${paciente.paciente || '—'}`,
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
  const evols = [...(paciente.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));
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

function nowFormatted() {
  return formatDate(new Date().toISOString());
}

// ─── Banner offline ───────────────────────────────────────────────────────────
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

// ─── Modal confirmación Alta / Traslado con control de zoom ──────────────────
function ConfirmModal({ tipo, onConfirm, onCancel }) {
  const esAlta = tipo === 'alta';
  const [medico, setMedico] = useState('');
  const [motivo, setMotivo] = useState('');
  const [destino, setDestino] = useState('');
  const [error, setError] = useState('');
  const [fontSize, setFontSize] = useState(100); // porcentaje base

  const handleZoomIn = () => setFontSize(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setFontSize(prev => Math.max(prev - 10, 70));

  const handleOk = () => {
    if (!medico.trim()) {
      setError('El médico es obligatorio.');
      return;
    }
    if (esAlta && !motivo.trim()) {
      setError('El motivo de alta es obligatorio.');
      return;
    }
    if (!esAlta && !destino.trim()) {
      setError('El destino es obligatorio.');
      return;
    }
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
            <label className={styles.fieldLabel}>
              Médico que {esAlta ? 'da el alta' : 'indica el traslado'} <span className={styles.required}>*</span>
            </label>
            <input
              className={styles.fieldInput}
              value={medico}
              onChange={e => setMedico(e.target.value)}
              placeholder="Ej: González"
              autoFocus
            />
          </div>

          {esAlta ? (
            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>
                Motivo / evolución de alta <span className={styles.required}>*</span>
              </label>
              <textarea
                className={[styles.fieldInput, styles.fieldTextarea].join(' ')}
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                placeholder="Describa el motivo clínico del alta..."
                rows={3}
              />
            </div>
          ) : (
            <>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>
                  Destino del traslado <span className={styles.required}>*</span>
                </label>
                <input
                  className={styles.fieldInput}
                  value={destino}
                  onChange={e => setDestino(e.target.value)}
                  placeholder="Ej: Sala de cirugía / Hospital general"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Motivo del traslado (opcional)</label>
                <textarea
                  className={[styles.fieldInput, styles.fieldTextarea].join(' ')}
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Describa el motivo clínico..."
                  rows={3}
                />
              </div>
            </>
          )}

          {error && (
            <div className={styles.errorMessage}>
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          <div className={styles.modalActions}>
            <button className={styles.btnSecondary} onClick={onCancel}>
              <XCircle size={18} />
              Cancelar
            </button>
            <button
              className={[styles.btnPrimary, esAlta ? styles.btnAlta : styles.btnTraslado].join(' ')}
              onClick={handleOk}
            >
              {esAlta ? <LogOut size={18} /> : <MapPin size={18} />}
              {esAlta ? 'Confirmar alta' : 'Confirmar traslado'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de cama ──────────────────────────────────────────────────────────
function BedCard({ cama, paciente, selected, pendingOffline, onClick, onResumen }) {
  const ocupado = !!paciente;
  const dias = ocupado ? calcDias(paciente.fechaIngreso) : 0;

  return (
    <div
      className={[
        styles.bedCard,
        ocupado ? styles.bedOccupied : styles.bedFree,
        selected ? styles.bedSelected : '',
      ].join(' ')}
      onClick={onClick}
      role="button"
      aria-label={`Cama ${cama} — ${ocupado ? paciente.paciente : 'Libre'}`}
    >
      {pendingOffline && (
        <div className={styles.bedOfflineDot} title="Datos pendientes de sincronizar" />
      )}

      <div className={styles.bedNum}>
        <span className={styles.bedNumLabel}>CAMA</span>
        <span className={styles.bedNumValue}>{cama}</span>
      </div>

      <div className={styles.bedBody}>
        {ocupado ? (
          <>
            <p className={styles.bedName}>{paciente.paciente}</p>
            {paciente.medicoIngreso && (
              <p className={styles.bedMedico}>Dr. {paciente.medicoIngreso}</p>
            )}
            <div className={styles.bedMeta}>
              <span className={styles.bedDaysBadge}><Activity size={10} /> {dias}d</span>
              {paciente.obraSocial && (
                <span className={styles.bedObraBadge}>{paciente.obraSocial}</span>
              )}
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
          <button
            className={styles.bedResumenBtn}
            onClick={e => { e.stopPropagation(); onResumen(paciente); }}
            aria-label="Ver resumen"
          >
            <FileText size={13} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Vista Resumen — pantalla completa (MEJORADA) ─────────────────────────────
function ResumenFullscreen({ paciente, onClose }) {
  const [copiedKey, setCopiedKey] = useState('');
  const evoluciones = [...(paciente?.evoluciones || [])]
    .sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));
  const dias = calcDias(paciente.fechaIngreso);

  const copy = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2500);
  };

  const handlePrint = () => {
    const content = document.getElementById('printArea')?.innerHTML || '';
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/>
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
      <div class="ph">
        <div><h1>Historia Clínica — UTI</h1><p>Clínica de la Unión S.A.</p></div>
        <div class="pm">Impreso: ${formatDate(new Date().toISOString())}<br/>Cama ${paciente.cama} · ${dias} días</div>
      </div>
      ${content}
      <div class="footer">Clínica de la Unión S.A. — Documento generado automáticamente</div>
    </body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  if (!paciente) return null;

  return (
    <div className={styles.resumenPage}>
      {/* Topbar fija */}
      <div className={styles.resumenTopbar}>
        <button className={styles.resumenBackBtn} onClick={onClose}>
          <ArrowLeft size={18} />
          <span>Volver</span>
        </button>
        <div className={styles.resumenTopbarCenter}>
          <p className={styles.resumenTopbarName}>{paciente.paciente}</p>
          <p className={styles.resumenTopbarMeta}>
            Cama {paciente.cama} · {dias} día{dias !== 1 ? 's' : ''}
            {paciente.obraSocial && ` · ${paciente.obraSocial}`}
          </p>
        </div>
        <div className={styles.resumenTopbarActions}>
          <button
            className={[styles.actionBtn, styles.actionWA, copiedKey === 'wa' ? styles.actionDone : ''].join(' ')}
            onClick={() => copy(generarTextoWA(paciente), 'wa')}
          >
            {copiedKey === 'wa' ? <Check size={15} /> : <MessageCircle size={15} />}
            <span className={styles.actionBtnLabel}>{copiedKey === 'wa' ? '¡Copiado!' : 'WhatsApp'}</span>
          </button>
          <button
            className={[styles.actionBtn, styles.actionCopy, copiedKey === 'txt' ? styles.actionDone : ''].join(' ')}
            onClick={() => copy(generarTextoPlano(paciente), 'txt')}
          >
            {copiedKey === 'txt' ? <Check size={15} /> : <Copy size={15} />}
            <span className={styles.actionBtnLabel}>{copiedKey === 'txt' ? '¡Copiado!' : 'Copiar todo'}</span>
          </button>
          <button className={[styles.actionBtn, styles.actionPrint].join(' ')} onClick={handlePrint}>
            <Printer size={15} />
            <span className={styles.actionBtnLabel}>Imprimir</span>
          </button>
        </div>
      </div>

      {/* Cuerpo scrolleable */}
      <div className={styles.resumenContent}>
        <div className={styles.resumenInner} id="printArea">

          {/* SECCIÓN ADMISIÓN */}
          <section className={styles.resSection}>
            <h2 className={styles.resSectionTitle}><UserCheck size={14} /> Admisión</h2>
            <div className={styles.resGrid}>
              {[
                ['Médico de ingreso', paciente.medicoIngreso ? `Dr. ${paciente.medicoIngreso}` : null],
                ['Fecha de ingreso', formatDate(paciente.fechaIngreso)],
                ['Motivo de ingreso', paciente.motivoIngreso],
                ['Obra Social', paciente.obraSocial],
              ].filter(([, v]) => v).map(([l, v]) => (
                <div
                  key={l}
                  className={[
                    styles.resField,
                    l === 'Motivo de ingreso' ? styles.resFieldFull : ''
                  ].join(' ')}
                >
                  <span className={styles.resFieldLabel}>{l}</span>
                  <span className={styles.resFieldValue}>{v}</span>
                </div>
              ))}
            </div>
          </section>

          {/* SECCIÓN ESTADO CLÍNICO */}
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

          {/* SECCIÓN EXÁMENES (opcional) */}
          {paciente.examenes && (
            <section className={styles.resSection}>
              <h2 className={styles.resSectionTitle}><FlaskConical size={14} /> Exámenes</h2>
              <p className={styles.resPre}>{paciente.examenes}</p>
            </section>
          )}

          {/* SECCIÓN EVOLUCIONES */}
          <section className={styles.resSection}>
            <h2 className={styles.resSectionTitle}>
              <Activity size={14} /> Evoluciones
              <span className={styles.resBadge}>{evoluciones.length}</span>
            </h2>
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

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UtiPage() {
  const [pacientes, setPacientes] = useState([]);
  const [camaSeleccionada, setCamaSeleccionada] = useState(null);
  const [formData, setFormData] = useState(FORM_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState(null);
  const [activeTab, setActiveTab] = useState('datos');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [pacienteResumen, setPacienteResumen] = useState(null);
  const [confirmModal, setConfirmModal] = useState(null);
  const [offlineCamas, setOfflineCamas] = useState(new Set());

  const { online, pending, syncing, save, syncQueue } = useOfflineQueue();

  useEffect(() => {
    const utiRef = ref(db, 'UTI');
    return onValue(utiRef, snapshot => {
      const data = snapshot.val();
      setPacientes(data
        ? Object.entries(data)
          .map(([id, v]) => ({ id, ...v }))
          .filter(p => p.activo !== false && !p.fechaAlta && !p.fechaTraslado)
        : []
      );
      setLoading(false);
    });
  }, []);

  const pacienteEnCama = useCallback(
    cama => pacientes.find(p => p.cama === cama),
    [pacientes]
  );

  const handleCamaClick = cama => {
    if (camaSeleccionada === cama) { setCamaSeleccionada(null); return; }
    const ex = pacienteEnCama(cama);
    if (ex) {
      setEditId(ex.id);
      setFormData({
        paciente: ex.paciente || '', medicoIngreso: ex.medicoIngreso || '',
        obraSocial: ex.obraSocial || '', fechaIngreso: ex.fechaIngreso || '',
        motivoIngreso: ex.motivoIngreso || '', diagnosticoActual: ex.diagnosticoActual || '',
        antecedentes: ex.antecedentes || '', tratamientoActual: ex.tratamientoActual || '',
        examenes: ex.examenes || '', pendientes: ex.pendientes || '',
        evolucionFechaDoc: new Date().toISOString().split('T')[0],
        evolucionTexto: '', medicoEvolucion: '',
      });
    } else {
      setEditId(null);
      setFormData({ ...FORM_DEFAULTS, fechaIngreso: new Date().toISOString().split('T')[0] });
    }
    setActiveTab('datos');
    setCamaSeleccionada(cama);
  };

  const handleChange = (field, value) =>
    setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!camaSeleccionada) return;
    if (formData.evolucionTexto.trim() && !formData.medicoEvolucion.trim()) {
      alert('Completá el médico que evoluciona.');
      setActiveTab('evolucion'); return;
    }
    setSaving(true);

    let nuevasEvoluciones = editId
      ? (pacienteEnCama(camaSeleccionada)?.evoluciones || [])
      : [];

    if (formData.evolucionTexto.trim()) {
      nuevasEvoluciones = [...nuevasEvoluciones, {
        fechaDoc: formData.evolucionFechaDoc,
        fechaReal: nowFormatted(),
        texto: formData.evolucionTexto.trim(),
        medicoEvolucion: formData.medicoEvolucion.trim(),
      }];
    }

    const data = {
      paciente: formData.paciente, medicoIngreso: formData.medicoIngreso,
      obraSocial: formData.obraSocial, fechaIngreso: formData.fechaIngreso,
      motivoIngreso: formData.motivoIngreso, diagnosticoActual: formData.diagnosticoActual,
      antecedentes: formData.antecedentes, tratamientoActual: formData.tratamientoActual,
      examenes: formData.examenes, pendientes: formData.pendientes,
      evoluciones: nuevasEvoluciones, cama: camaSeleccionada,
      activo: true, ultimaActualizacion: new Date().toISOString(),
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
      console.error(err); alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAltaConfirm = async ({ medico, motivo }) => {
    if (!editId) return;
    await save({
      editId, data: {
        activo: false, fechaAlta: new Date().toISOString(),
        medicoAlta: medico, motivoAlta: motivo,
      }
    });
    setConfirmModal(null); setCamaSeleccionada(null); setEditId(null);
  };

  const handleTrasladoConfirm = async ({ medico, motivo, destino }) => {
    if (!editId) return;
    await save({
      editId, data: {
        activo: false, fechaTraslado: new Date().toISOString(),
        medicoTraslado: medico, motivoTraslado: motivo, destinoTraslado: destino,
      }
    });
    setConfirmModal(null); setCamaSeleccionada(null); setEditId(null);
  };

  const ocupadas = pacientes.length;
  const libres = CAMAS.length - ocupadas;
  const ocupacion = Math.round((ocupadas / CAMAS.length) * 100);
  const evolucionFechaEsDistinta =
    formData.evolucionFechaDoc !== new Date().toISOString().split('T')[0];

  // ── Resumen ocupa pantalla completa ───────────────────────────────────────
  if (pacienteResumen) {
    return (
      <>
        <Header />
        <ResumenFullscreen paciente={pacienteResumen} onClose={() => setPacienteResumen(null)} />
      </>
    );
  }

  if (loading) return (
    <>
      <Header />
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <p>Cargando UTI…</p>
      </div>
    </>
  );

  return (
    <>
      <Header />
      <main className={styles.page}>

        <OfflineBanner online={online} pending={pending} syncing={syncing} onSync={syncQueue} />

        {savedMsg && (
          <div className={[
            styles.savedToast,
            savedMsg.startsWith('✓') ? styles.savedToastOk : styles.savedToastWarn,
          ].join(' ')}>
            {savedMsg}
          </div>
        )}

        {/* Page header */}
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <div className={styles.pageHeaderIcon}><Activity size={20} /></div>
            <div>
              <h1 className={styles.pageTitle}>Unidad de Terapia Intensiva</h1>
              <p className={styles.pageSubtitle}>Clínica de la Unión · {CAMAS.length} camas</p>
            </div>
          </div>
          <div className={styles.pageHeaderRight}>
            {online
              ? <span className={styles.onlinePill}><Wifi size={12} /> En línea</span>
              : <span className={styles.offlinePill}><WifiOff size={12} /> Sin conexión</span>
            }
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsRow}>
          {[
            { label: 'Ocupadas', value: ocupadas, mod: styles.statRed },
            { label: 'Disponibles', value: libres, mod: styles.statGreen },
            { label: 'Ocupación', value: `${ocupacion}%`, mod: styles.statBlue },
            { label: 'Total camas', value: CAMAS.length, mod: styles.statBlue },
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
              key={cama} cama={cama}
              paciente={pacienteEnCama(cama)}
              selected={camaSeleccionada === cama}
              pendingOffline={offlineCamas.has(cama)}
              onClick={() => handleCamaClick(cama)}
              onResumen={p => setPacienteResumen(p)}
            />
          ))}
        </div>

        {/* Formulario */}
        {camaSeleccionada && (
          <div className={styles.formPanel}>
            <div className={styles.formPanelHeader}>
              <div className={styles.formPanelTitle}>
                {editId ? <Activity size={16} /> : <User size={16} />}
                <span>{editId ? 'Editar paciente' : 'Nuevo ingreso'}</span>
                <span className={styles.formPanelBed}>Cama {camaSeleccionada}</span>
              </div>
              <button className={styles.formPanelClose}
                onClick={() => setCamaSeleccionada(null)} aria-label="Cerrar">
                <XCircle size={18} />
              </button>
            </div>

            <div className={styles.tabBar} role="tablist">
              {TABS.map(({ id, label, Icon }) => (
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
                    <input className={styles.fieldInput} value={formData.paciente}
                      onChange={e => handleChange('paciente', e.target.value)}
                      required placeholder="Apellido, Nombre" />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Médico de ingreso *</label>
                    <input className={styles.fieldInput} value={formData.medicoIngreso}
                      onChange={e => handleChange('medicoIngreso', e.target.value)}
                      required placeholder="Apellido del médico" />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Obra Social</label>
                    <input className={styles.fieldInput} value={formData.obraSocial}
                      onChange={e => handleChange('obraSocial', e.target.value)} />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Fecha de ingreso *</label>
                    <input type="date" className={styles.fieldInput} value={formData.fechaIngreso}
                      onChange={e => handleChange('fechaIngreso', e.target.value)} required />
                  </div>
                  <div className={[styles.fieldGroup, styles.fieldFull].join(' ')}>
                    <label className={styles.fieldLabel}>Motivo de ingreso</label>
                    <input className={styles.fieldInput} value={formData.motivoIngreso}
                      onChange={e => handleChange('motivoIngreso', e.target.value)} />
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
                      <textarea className={[styles.fieldInput, styles.fieldTextarea].join(' ')}
                        value={formData[field]}
                        onChange={e => handleChange(field, e.target.value)} rows={3} />
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'evolucion' && (
                <div className={styles.fieldsGrid}>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>Médico que evoluciona *</label>
                    <input className={styles.fieldInput} value={formData.medicoEvolucion}
                      onChange={e => handleChange('medicoEvolucion', e.target.value)}
                      placeholder="Apellido del médico" />
                  </div>
                  <div className={styles.fieldGroup}>
                    <label className={styles.fieldLabel}>
                      Fecha de la evolución
                    </label>
                    <input type="date" className={styles.fieldInput}
                      value={formData.evolucionFechaDoc}
                      onChange={e => handleChange('evolucionFechaDoc', e.target.value)}
                      max={new Date().toISOString().split('T')[0]} />
                    {evolucionFechaEsDistinta && (
                      <div className={styles.alertNote}>
                        <AlertCircle size={13} />
                        Se registrará hoy con fecha {formatDate(formData.evolucionFechaDoc)}.
                      </div>
                    )}
                  </div>
                  <div className={[styles.fieldGroup, styles.fieldFull].join(' ')}>
                    <label className={styles.fieldLabel}>Texto de la evolución</label>
                    <textarea
                      className={[styles.fieldInput, styles.fieldTextarea, styles.fieldTextareaLg].join(' ')}
                      value={formData.evolucionTexto}
                      onChange={e => handleChange('evolucionTexto', e.target.value)}
                      placeholder="Escribir la evolución del turno…" rows={6} />
                  </div>
                  {editId && (pacienteEnCama(camaSeleccionada)?.evoluciones || []).length > 0 && (
                    <div className={[styles.fieldGroup, styles.fieldFull].join(' ')}>
                      <label className={styles.fieldLabel}>Evoluciones anteriores</label>
                      <div className={styles.evoHistList}>
                        {[...(pacienteEnCama(camaSeleccionada)?.evoluciones || [])]
                          .sort((a, b) => new Date(b.fechaDoc) - new Date(a.fechaDoc))
                          .map((ev, i) => (
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
                    <textarea
                      className={[styles.fieldInput, styles.fieldTextarea, styles.fieldTextareaLg].join(' ')}
                      value={formData.examenes}
                      onChange={e => handleChange('examenes', e.target.value)}
                      placeholder="Laboratorio, imágenes, etc." rows={7} />
                  </div>
                </div>
              )}

              <div className={styles.formActions}>
                <div className={styles.formActionsLeft}>
                  <button type="submit" className={[styles.btn, styles.btnPrimary].join(' ')} disabled={saving}>
                    <Save size={16} />{saving ? 'Guardando…' : 'Guardar'}
                  </button>
                  <button type="button" className={[styles.btn, styles.btnGhost].join(' ')}
                    onClick={() => setCamaSeleccionada(null)}>
                    Cancelar
                  </button>
                </div>
                {editId && (
                  <div className={styles.formActionsRight}>
                    <button type="button" className={[styles.btn, styles.btnGreen].join(' ')}
                      onClick={() => setConfirmModal('alta')}>
                      <Home size={15} /> Alta
                    </button>
                    <button type="button" className={[styles.btn, styles.btnAmber].join(' ')}
                      onClick={() => setConfirmModal('traslado')}>
                      <Truck size={15} /> Traslado
                    </button>
                  </div>
                )}
              </div>
            </form>
          </div>
        )}

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
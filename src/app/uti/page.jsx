'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, update } from 'firebase/database';
import {
  Activity, User, Save, XCircle, Truck, Home,
  Stethoscope, FlaskConical, AlertCircle, Calendar,
  FileText, UserCheck, Printer, Copy, Check,
  MessageCircle, LogOut, MapPin,
} from 'lucide-react';
import Header from '@/components/Header/Header';
import styles from './page.module.css';

// ─── Constantes ───────────────────────────────────────────────────────────────
const CAMAS = [1, 2, 3, 4, 5];

const TABS = [
  { id: 'datos',     label: 'Datos',     icon: <User size={13} /> },
  { id: 'clinico',   label: 'Clínico',   icon: <Stethoscope size={13} /> },
  { id: 'evolucion', label: 'Evolución', icon: <Activity size={13} /> },
  { id: 'examenes',  label: 'Exámenes',  icon: <FlaskConical size={13} /> },
];

const FORM_DEFAULTS = {
  paciente: '', medicoIngreso: '', obraSocial: '',
  fechaIngreso: new Date().toISOString().split('T')[0],
  motivoIngreso: '', diagnosticoActual: '', antecedentes: '',
  tratamientoActual: '', examenes: '', pendientes: '',
  evolucionFechaDoc: new Date().toISOString().split('T')[0],
  evolucionTexto: '', medicoEvolucion: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcDias(fechaIngreso) {
  if (!fechaIngreso) return 0;
  return Math.max(0, Math.floor((new Date() - new Date(fechaIngreso)) / 86400000));
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-AR');
}

function generarTextoHistoria(paciente) {
  if (!paciente) return '';
  const dias = calcDias(paciente.fechaIngreso);
  const linea = '─'.repeat(40);
  const evols = [...(paciente.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));
  const bloques = [
    '🏥 HISTORIA CLÍNICA UTI', '📋 Clínica de la Unión S.A.',
    `Fecha: ${new Date().toLocaleString('es-AR')}`, linea, '',
    '👤 PACIENTE',
    `Nombre: ${paciente.paciente || '—'}`,
    `Médico de ingreso: Dr. ${paciente.medicoIngreso || '—'}`,
    `Obra Social: ${paciente.obraSocial || '—'}`,
    `Cama: ${paciente.cama}`,
    `Fecha de ingreso: ${paciente.fechaIngreso || '—'}`,
    `Días: ${dias}`,
    `Motivo: ${paciente.motivoIngreso || '—'}`,
    '', linea, '🩺 ESTADO CLÍNICO',
    `Diagnóstico:\n${paciente.diagnosticoActual || '—'}`, '',
    `Antecedentes:\n${paciente.antecedentes || '—'}`, '',
    `Tratamiento:\n${paciente.tratamientoActual || '—'}`, '',
    `Pendientes:\n${paciente.pendientes || '—'}`,
  ];
  if (paciente.examenes) bloques.push('', linea, '🔬 EXÁMENES', paciente.examenes);
  if (evols.length > 0) {
    bloques.push('', linea, `📅 EVOLUCIONES (${evols.length})`);
    evols.forEach((ev, i) => bloques.push(
      '',
      `[${i + 1}] ${ev.fechaDoc} — Dr. ${ev.medicoEvolucion || '—'}`,
      `(Cargado: ${ev.fechaReal || '—'})`,
      ev.texto || '—'
    ));
  }
  bloques.push('', linea, 'Fin de historia clínica');
  return bloques.join('\n');
}

// ─── Modal de confirmación Alta / Traslado ────────────────────────────────────
function ConfirmModal({ tipo, onConfirm, onCancel }) {
  const esAlta = tipo === 'alta';
  const [medico,  setMedico]  = useState('');
  const [motivo,  setMotivo]  = useState('');
  const [destino, setDestino] = useState('');
  const [error,   setError]   = useState('');

  const handleOk = () => {
    if (!medico.trim()) { setError('El médico es obligatorio.'); return; }
    if (esAlta && !motivo.trim()) { setError('El motivo de alta es obligatorio.'); return; }
    if (!esAlta && !destino.trim()) { setError('El destino de traslado es obligatorio.'); return; }
    onConfirm({ medico: medico.trim(), motivo: motivo.trim(), destino: destino.trim() });
  };

  return (
    <div className={styles.confirmOverlay} onClick={onCancel}>
      <div className={styles.confirmBox} onClick={e => e.stopPropagation()}>
        <div className={[styles.confirmHeader, esAlta ? styles.confirmHeaderAlta : styles.confirmHeaderTraslado].join(' ')}>
          {esAlta ? <LogOut size={18} /> : <MapPin size={18} />}
          <span>{esAlta ? 'Confirmar Alta' : 'Confirmar Traslado'}</span>
        </div>
        <div className={styles.confirmBody}>
          <p className={styles.confirmWarning}>
            {esAlta
              ? '¿Estás seguro de dar el alta? Esta acción liberará la cama.'
              : '¿Estás seguro de trasladar al paciente? Esta acción liberará la cama.'}
          </p>

          <div className={styles.confirmField}>
            <label className={styles.confirmLabel}>Médico que {esAlta ? 'da el alta' : 'indica el traslado'} *</label>
            <input className={styles.confirmInput} value={medico}
              onChange={e => setMedico(e.target.value)} placeholder="Apellido del médico"
              autoFocus />
          </div>

          {esAlta ? (
            <div className={styles.confirmField}>
              <label className={styles.confirmLabel}>Motivo / evolución de alta *</label>
              <textarea className={[styles.confirmInput, styles.confirmTextarea].join(' ')}
                value={motivo} onChange={e => setMotivo(e.target.value)}
                placeholder="Describir el motivo que justifica el alta..." rows={4} />
            </div>
          ) : (
            <>
              <div className={styles.confirmField}>
                <label className={styles.confirmLabel}>Destino del traslado *</label>
                <input className={styles.confirmInput} value={destino}
                  onChange={e => setDestino(e.target.value)} placeholder="Hospital / Servicio de destino" />
              </div>
              <div className={styles.confirmField}>
                <label className={styles.confirmLabel}>Motivo del traslado</label>
                <textarea className={[styles.confirmInput, styles.confirmTextarea].join(' ')}
                  value={motivo} onChange={e => setMotivo(e.target.value)}
                  placeholder="Motivo clínico del traslado..." rows={3} />
              </div>
            </>
          )}

          {error && (
            <div className={styles.confirmError}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div className={styles.confirmActions}>
            <button className={[styles.btn, styles.btnSecondary].join(' ')} onClick={onCancel}>
              <XCircle size={14} /> Cancelar
            </button>
            <button className={[styles.btn, esAlta ? styles.btnSuccess : styles.btnWarning].join(' ')} onClick={handleOk}>
              {esAlta
                ? <><LogOut size={14} /> Confirmar Alta</>
                : <><MapPin size={14} /> Confirmar Traslado</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tarjeta de cama ──────────────────────────────────────────────────────────
function BedCard({ cama, paciente, selected, onClick, onResumen }) {
  const ocupado = !!paciente;
  const dias    = ocupado ? calcDias(paciente.fechaIngreso) : 0;
  return (
    <div
      className={[
        styles.bedCard,
        ocupado  ? styles.bedCardOccupied : styles.bedCardFree,
        selected ? styles.bedCardSelected : '',
      ].join(' ')}
      onClick={onClick}
    >
      <p className={styles.bedNumber}>Cama {cama}</p>
      <div className={styles.bedIcon}>
        {ocupado ? <Activity size={28} color="#e74c3c" /> : <User size={28} color="#27ae60" />}
      </div>
      {ocupado ? (
        <>
          <p className={styles.bedPatientName}>{paciente.paciente}</p>
          {paciente.medicoIngreso && <p className={styles.bedDoctor}>Dr. {paciente.medicoIngreso}</p>}
          <p className={styles.bedDays}>{dias} día{dias !== 1 ? 's' : ''} internado</p>
          <div className={styles.bedActions}>
            <span className={[styles.bedStatus, styles.bedStatusOccupied].join(' ')}>Ocupada</span>
            <button
              className={styles.bedResumenBtn}
              onClick={e => { e.stopPropagation(); onResumen(paciente); }}
            >
              <FileText size={13} /> Resumen
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={styles.bedPatientName}>Libre</p>
          <span className={[styles.bedStatus, styles.bedStatusFree].join(' ')}>Disponible</span>
        </>
      )}
    </div>
  );
}

// ─── Modal Resumen ────────────────────────────────────────────────────────────
function ResumenModal({ paciente, onClose }) {
  const [copied,   setCopied]   = useState(false);
  const [copiedWA, setCopiedWA] = useState(false);
  const printAreaRef = useRef(null);

  const evoluciones = [...(paciente?.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));

  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') { e.preventDefault(); handlePrint(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
      .sec{margin-bottom:16px;page-break-inside:avoid}
      .st{font-size:11px;font-weight:700;text-transform:uppercase;color:#1a3a6b;border-bottom:1px solid #dbeafe;padding-bottom:4px;margin-bottom:8px}
      .g2{display:grid;grid-template-columns:1fr 1fr;gap:8px 16px}
      .f label{font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;display:block}
      .f span{font-size:12px;white-space:pre-wrap}
      .ei{border-left:3px solid #2563a8;padding-left:10px;margin-bottom:10px}
      .ed{font-weight:700;color:#2563a8;font-size:11px}
      .edr{color:#5b21b6;background:#f5f3ff;padding:1px 6px;border-radius:8px;margin-left:6px;font-size:10px}
      .et{font-size:12px;white-space:pre-wrap;margin-top:3px}
      .footer{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;font-size:10px;color:#94a3b8;text-align:center}
      @media print{body{padding:0}}
    </style></head><body>
      <div class="ph">
        <div><h1>Historia Clínica — UTI</h1><p>Clínica de la Unión S.A.</p></div>
        <div class="pm">Impreso: ${new Date().toLocaleString('es-AR')}<br/>Cama ${paciente.cama} · ${calcDias(paciente.fechaIngreso)} días</div>
      </div>
      ${content}
      <div class="footer">Clínica de la Unión S.A. — Documento generado automáticamente</div>
    </body></html>`);
    win.document.close(); win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generarTextoHistoria(paciente));
    setCopied(true); setTimeout(() => setCopied(false), 2500);
  };

  const handleCopyWA = async () => {
    const evs = [...(paciente.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));
    const dias = calcDias(paciente.fechaIngreso);
    const lines = [
      `*${paciente.paciente}* — Cama ${paciente.cama}`,
      `Ingreso: ${paciente.fechaIngreso} (${dias} días)`,
      `Dr. ingreso: ${paciente.medicoIngreso || '—'}`,
      '', '*📅 Evoluciones:*',
    ];
    evs.forEach(ev => lines.push(
      '',
      `*${ev.fechaDoc}* — _Dr. ${ev.medicoEvolucion || '—'}_`,
      `_(cargado: ${ev.fechaReal || '—'})_`,
      ev.texto || '—'
    ));
    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedWA(true); setTimeout(() => setCopiedWA(false), 2500);
  };

  if (!paciente) return null;
  const dias = calcDias(paciente.fechaIngreso);

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <FileText size={18} />
            <div>
              <div className={styles.modalPatientName}>{paciente.paciente}</div>
              <div className={styles.modalPatientSub}>
                Cama {paciente.cama} &nbsp;·&nbsp; {dias} día{dias !== 1 ? 's' : ''}
                {paciente.obraSocial && <>&nbsp;·&nbsp; {paciente.obraSocial}</>}
              </div>
            </div>
          </div>
          <div className={styles.modalHeaderRight}>
            <button className={[styles.modalActionBtn, styles.modalActionWA].join(' ')} onClick={handleCopyWA}>
              {copiedWA ? <Check size={13} /> : <MessageCircle size={13} />}
              {copiedWA ? '¡Copiado!' : 'WhatsApp'}
            </button>
            <button className={[styles.modalActionBtn, styles.modalActionCopy].join(' ')} onClick={handleCopy}>
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '¡Copiado!' : 'Copiar'}
            </button>
            <button className={[styles.modalActionBtn, styles.modalActionPrint].join(' ')} onClick={handlePrint}>
              <Printer size={13} /> Imprimir
            </button>
            <button className={styles.modalCloseBtn} onClick={onClose}>
              <XCircle size={16} />
            </button>
          </div>
        </div>

        <div className={styles.modalBody}>
          <div id="printArea">
            {/* Admisión */}
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}><UserCheck size={14} /> Admisión</div>
              <div className={styles.resumenGrid}>
                {[['Médico de ingreso', paciente.medicoIngreso], ['Fecha de ingreso', paciente.fechaIngreso], ['Motivo de ingreso', paciente.motivoIngreso], ['Obra Social', paciente.obraSocial]].map(([l, v]) => v ? (
                  <div key={l} className={styles.resumenField}>
                    <span className={styles.resumenFieldLabel}>{l}</span>
                    <span className={styles.resumenFieldValue}>{v}</span>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Clínico */}
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}><Stethoscope size={14} /> Estado Clínico</div>
              <div className={styles.resumenGrid}>
                {[['Diagnóstico actual', paciente.diagnosticoActual], ['Antecedentes', paciente.antecedentes], ['Tratamiento actual', paciente.tratamientoActual], ['Pendientes', paciente.pendientes]].map(([l, v]) => v ? (
                  <div key={l} className={styles.resumenField}>
                    <span className={styles.resumenFieldLabel}>{l}</span>
                    <span className={styles.resumenFieldValue}>{v}</span>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Exámenes */}
            {paciente.examenes && (
              <div className={styles.resumenSection}>
                <div className={styles.resumenSectionTitle}><FlaskConical size={14} /> Exámenes</div>
                <p className={styles.resumenPre}>{paciente.examenes}</p>
              </div>
            )}

            {/* Evoluciones */}
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}><Activity size={14} /> Evoluciones ({evoluciones.length})</div>
              {evoluciones.length === 0
                ? <p className={styles.resumenEmpty}>Sin evoluciones registradas.</p>
                : (
                  <div className={styles.evoTimeline}>
                    {evoluciones.map((ev, i) => (
                      <div key={i} className={styles.evoTimelineItem}>
                        <div className={styles.evoTimelineDot} />
                        <div style={{ flex: 1 }}>
                          <div className={styles.evoTimelineHeader}>
                            <span className={styles.evoTimelineDate}>
                              <Calendar size={11} /> {ev.fechaDoc}
                              {ev.fechaReal && (
                                <span className={styles.evoTimelineCarga} title="Fecha de carga en sistema">
                                  (cargado {ev.fechaReal})
                                </span>
                              )}
                            </span>
                            {ev.medicoEvolucion && <span className={styles.evoTimelineDoctor}>Dr. {ev.medicoEvolucion}</span>}
                          </div>
                          <p className={styles.evoTimelineText}>{ev.texto}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function UtiPage() {
  const [pacientes,        setPacientes]        = useState([]);
  const [camaSeleccionada, setCamaSeleccionada] = useState(null);
  const [formData,         setFormData]         = useState(FORM_DEFAULTS);
  const [loading,          setLoading]          = useState(true);
  const [editId,           setEditId]           = useState(null);
  const [activeTab,        setActiveTab]        = useState('datos');
  const [saving,           setSaving]           = useState(false);
  const [pacienteResumen,  setPacienteResumen]  = useState(null);
  const [confirmModal,     setConfirmModal]     = useState(null); // 'alta' | 'traslado'

  useEffect(() => {
    const utiRef = ref(db, 'UTI');
    return onValue(utiRef, snapshot => {
      const data = snapshot.val();
      setPacientes(data
        ? Object.entries(data).map(([id, v]) => ({ id, ...v })).filter(p => p.activo !== false && !p.fechaAlta && !p.fechaTraslado)
        : []
      );
      setLoading(false);
    });
  }, []);

  const pacienteEnCama = useCallback(cama => pacientes.find(p => p.cama === cama), [pacientes]);

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

  const handleChange = (field, value) => setFormData(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!camaSeleccionada) return;
    if (formData.evolucionTexto.trim() && !formData.medicoEvolucion.trim()) {
      alert('Completá el médico que evoluciona.');
      setActiveTab('evolucion'); return;
    }
    setSaving(true);
    const ahora = new Date().toISOString();
    let nuevasEvoluciones = editId ? (pacienteEnCama(camaSeleccionada)?.evoluciones || []) : [];

    if (formData.evolucionTexto.trim()) {
      // Formatear fecha actual como DD/MM/AAAA HH:MM
      const ahoraDate = new Date();
      const dia = String(ahoraDate.getDate()).padStart(2, '0');
      const mes = String(ahoraDate.getMonth() + 1).padStart(2, '0');
      const año = ahoraDate.getFullYear();
      const hora = String(ahoraDate.getHours()).padStart(2, '0');
      const min = String(ahoraDate.getMinutes()).padStart(2, '0');
      const fechaRealFormateada = `${dia}/${mes}/${año} ${hora}:${min}`;

      nuevasEvoluciones = [...nuevasEvoluciones, {
        fechaDoc: formData.evolucionFechaDoc,
        fechaReal: fechaRealFormateada,
        texto: formData.evolucionTexto.trim(),
        medicoEvolucion: formData.medicoEvolucion.trim(),
      }];
    }

    const dataToSave = {
      paciente: formData.paciente, medicoIngreso: formData.medicoIngreso,
      obraSocial: formData.obraSocial, fechaIngreso: formData.fechaIngreso,
      motivoIngreso: formData.motivoIngreso, diagnosticoActual: formData.diagnosticoActual,
      antecedentes: formData.antecedentes, tratamientoActual: formData.tratamientoActual,
      examenes: formData.examenes, pendientes: formData.pendientes,
      evoluciones: nuevasEvoluciones, cama: camaSeleccionada,
      activo: true, ultimaActualizacion: ahora,
    };

    try {
      if (editId) await update(ref(db, `UTI/${editId}`), dataToSave);
      else        await update(push(ref(db, 'UTI')), dataToSave);
      setCamaSeleccionada(null); setEditId(null);
    } catch (err) { console.error(err); alert('Error al guardar'); }
    finally { setSaving(false); }
  };

  const handleAltaConfirm = async ({ medico, motivo }) => {
    if (!editId) return;
    const ahora = new Date().toISOString();
    await update(ref(db, `UTI/${editId}`), { activo: false, fechaAlta: ahora, medicoAlta: medico, motivoAlta: motivo });
    setConfirmModal(null); setCamaSeleccionada(null); setEditId(null);
  };

  const handleTrasladoConfirm = async ({ medico, motivo, destino }) => {
    if (!editId) return;
    const ahora = new Date().toISOString();
    await update(ref(db, `UTI/${editId}`), { activo: false, fechaTraslado: ahora, medicoTraslado: medico, motivoTraslado: motivo, destinoTraslado: destino });
    setConfirmModal(null); setCamaSeleccionada(null); setEditId(null);
  };

  const ocupadas  = pacientes.length;
  const libres    = CAMAS.length - ocupadas;
  const ocupacion = Math.round((ocupadas / CAMAS.length) * 100);
  const evolucionFechaEsDistinta = formData.evolucionFechaDoc !== new Date().toISOString().split('T')[0];

  if (loading) return (
    <><Header />
      <div className={styles.loadingWrapper}><div className={styles.spinner} /><span>Cargando UTI...</span></div>
    </>
  );

  return (
    <>
      <Header />

      <div className={styles.wrapper}>

        {/* Título de sección */}
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <Activity size={22} className={styles.headerIcon} />
            <div>
              <h1 className={styles.pageTitle}>Unidad de Terapia Intensiva</h1>
              <p className={styles.pageSubtitle}>{CAMAS.length} camas · Clínica de la Unión S.A.</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className={styles.statsBar}>
          {[
            { label: 'Ocupadas',    value: ocupadas,        cls: styles.statValueRed },
            { label: 'Disponibles', value: libres,          cls: styles.statValueGreen },
            { label: 'Ocupación',   value: `${ocupacion}%`, cls: styles.statValueBlue },
            { label: 'Total camas', value: CAMAS.length,    cls: styles.statValueBlue },
          ].map(s => (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={[styles.statValue, s.cls].join(' ')}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Grilla de camas */}
        <div className={styles.bedsGrid}>
          {CAMAS.map(cama => (
            <BedCard
              key={cama}
              cama={cama}
              paciente={pacienteEnCama(cama)}
              selected={camaSeleccionada === cama}
              onClick={() => handleCamaClick(cama)}
              onResumen={p => setPacienteResumen(p)}
            />
          ))}
        </div>

        {/* Formulario inline */}
        {camaSeleccionada && (
          <div className={styles.formPanel}>
            <div className={styles.formHeader}>
              <div className={styles.formHeaderTitle}>
                {editId ? <Activity size={15} /> : <User size={15} />}
                {editId ? 'Editar paciente' : 'Nuevo ingreso'}
                <span className={styles.formHeaderBed}>Cama {camaSeleccionada}</span>
              </div>
              <button className={styles.formCloseBtn} onClick={() => setCamaSeleccionada(null)}>
                <XCircle size={14} /> Cerrar
              </button>
            </div>

            <div className={styles.formBody}>
              <div className={styles.formTabs}>
                {TABS.map(tab => (
                  <button key={tab.id} type="button"
                    className={[styles.formTab, activeTab === tab.id ? styles.formTabActive : ''].join(' ')}
                    onClick={() => setActiveTab(tab.id)}>
                    {tab.icon} {tab.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSubmit}>

                {/* Tab: Datos */}
                {activeTab === 'datos' && (
                  <div className={styles.fieldsGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Paciente *</label>
                      <input className={styles.formControl} value={formData.paciente}
                        onChange={e => handleChange('paciente', e.target.value)} required placeholder="Apellido, Nombre" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Médico de ingreso * <span className={styles.requiredDot}>●</span></label>
                      <input className={styles.formControl} value={formData.medicoIngreso}
                        onChange={e => handleChange('medicoIngreso', e.target.value)} required placeholder="Apellido del médico" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Obra Social</label>
                      <input className={styles.formControl} value={formData.obraSocial}
                        onChange={e => handleChange('obraSocial', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Fecha Ingreso *</label>
                      <input type="date" className={styles.formControl} value={formData.fechaIngreso}
                        onChange={e => handleChange('fechaIngreso', e.target.value)} required />
                    </div>
                    <div className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                      <label className={styles.formLabel}>Motivo de Ingreso</label>
                      <input className={styles.formControl} value={formData.motivoIngreso}
                        onChange={e => handleChange('motivoIngreso', e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Tab: Clínico */}
                {activeTab === 'clinico' && (
                  <div className={styles.fieldsGrid}>
                    {[['diagnosticoActual','Diagnóstico Actual'],['antecedentes','Antecedentes'],['tratamientoActual','Tratamiento Actual'],['pendientes','Pendientes']].map(([field, label]) => (
                      <div key={field} className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                        <label className={styles.formLabel}>{label}</label>
                        <textarea className={[styles.formControl, styles.formControlTextarea].join(' ')}
                          value={formData[field]} onChange={e => handleChange(field, e.target.value)} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Evolución */}
                {activeTab === 'evolucion' && (
                  <div className={styles.fieldsGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Médico que evoluciona * <span className={styles.requiredDot}>●</span></label>
                      <input className={styles.formControl} value={formData.medicoEvolucion}
                        onChange={e => handleChange('medicoEvolucion', e.target.value)} placeholder="Apellido del médico" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Fecha de la evolución
                        <span className={styles.dateNote}> (puede ser anterior)</span>
                      </label>
                      <input type="date" className={styles.formControl} value={formData.evolucionFechaDoc}
                        onChange={e => handleChange('evolucionFechaDoc', e.target.value)}
                        max={new Date().toISOString().split('T')[0]} />
                      {evolucionFechaEsDistinta && (
                        <div className={styles.dateDiffWarning}>
                          <AlertCircle size={13} />
                          Se registrará cargado hoy con fecha {formData.evolucionFechaDoc}.
                        </div>
                      )}
                    </div>
                    <div className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                      <label className={styles.formLabel}>Evolución del turno</label>
                      <textarea className={[styles.formControl, styles.formControlTextarea].join(' ')}
                        rows={5} value={formData.evolucionTexto}
                        onChange={e => handleChange('evolucionTexto', e.target.value)}
                        placeholder="Escribir la evolución del día..." />
                    </div>

                    {/* Historial previo de evoluciones */}
                    {editId && (pacienteEnCama(camaSeleccionada)?.evoluciones || []).length > 0 && (
                      <div className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                        <label className={styles.formLabel}>Evoluciones anteriores</label>
                        <div className={styles.evoHistList}>
                          {[...(pacienteEnCama(camaSeleccionada)?.evoluciones || [])]
                            .sort((a, b) => new Date(b.fechaDoc) - new Date(a.fechaDoc))
                            .map((ev, i) => (
                              <div key={i} className={styles.evoHistItem}>
                                <div className={styles.evoHistHeader}>
                                  <span className={styles.evoHistDate}>
                                    <Calendar size={11} /> {ev.fechaDoc}
                                    {ev.fechaReal && (
                                      <span className={styles.evoHistCarga}> (cargado {ev.fechaReal})</span>
                                    )}
                                  </span>
                                  {ev.medicoEvolucion && <span className={styles.evoHistDoc}>Dr. {ev.medicoEvolucion}</span>}
                                </div>
                                <p className={styles.evoHistText}>{ev.texto}</p>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Exámenes */}
                {activeTab === 'examenes' && (
                  <div className={styles.fieldsGrid}>
                    <div className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                      <label className={styles.formLabel}>Exámenes / Estudios</label>
                      <textarea className={[styles.formControl, styles.formControlTextarea].join(' ')}
                        rows={5} value={formData.examenes}
                        onChange={e => handleChange('examenes', e.target.value)}
                        placeholder="Laboratorio, imágenes, etc." />
                    </div>
                  </div>
                )}

                {/* Acciones */}
                <div className={styles.formActions}>
                  <div className={styles.actionsLeft}>
                    <button type="submit" className={[styles.btn, styles.btnPrimary].join(' ')} disabled={saving}>
                      <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button type="button" className={[styles.btn, styles.btnSecondary].join(' ')} onClick={() => setCamaSeleccionada(null)}>
                      Cancelar
                    </button>
                  </div>
                  {editId && (
                    <div className={styles.actionsRight}>
                      <button type="button" className={[styles.btn, styles.btnSuccess].join(' ')} onClick={() => setConfirmModal('alta')}>
                        <Home size={14} /> Dar Alta
                      </button>
                      <button type="button" className={[styles.btn, styles.btnWarning].join(' ')} onClick={() => setConfirmModal('traslado')}>
                        <Truck size={14} /> Traslado
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* Modal Resumen */}
      {pacienteResumen && <ResumenModal paciente={pacienteResumen} onClose={() => setPacienteResumen(null)} />}

      {/* Modal Alta */}
      {confirmModal === 'alta' && (
        <ConfirmModal tipo="alta" onConfirm={handleAltaConfirm} onCancel={() => setConfirmModal(null)} />
      )}

      {/* Modal Traslado */}
      {confirmModal === 'traslado' && (
        <ConfirmModal tipo="traslado" onConfirm={handleTrasladoConfirm} onCancel={() => setConfirmModal(null)} />
      )}
    </>
  );
}
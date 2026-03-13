'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { db } from '@/lib/firebase';
import { ref, onValue, push, update } from 'firebase/database';
import {
  Activity, User, Save, XCircle, Truck, Home,
  Shield, Eye, ClipboardList, Stethoscope,
  FlaskConical, AlertCircle, Calendar, FileText,
  UserCheck, Printer, Copy, Check, MessageCircle,
} from 'lucide-react';
import Header from '@/components/Header/Header';
import styles from './page.module.css';

const CAMAS = [1, 2, 3, 4, 5];
const ADMIN_PASSWORD = 'admin123';

const TABS = [
  { id: 'datos',     label: 'Datos',     icon: <User size={13} /> },
  { id: 'clinico',   label: 'Clínico',   icon: <Stethoscope size={13} /> },
  { id: 'evolucion', label: 'Evolución', icon: <Activity size={13} /> },
  { id: 'examenes',  label: 'Exámenes',  icon: <FlaskConical size={13} /> },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function calcDias(fechaIngreso) {
  if (!fechaIngreso) return 0;
  return Math.max(0, Math.floor((new Date() - new Date(fechaIngreso)) / 86400000));
}

/**
 * Genera el texto plano de la historia clínica completa
 * ordenado cronológicamente — listo para imprimir o copiar a WhatsApp.
 */
function generarTextoHistoria(paciente) {
  if (!paciente) return '';
  const dias = calcDias(paciente.fechaIngreso);
  const linea = '─'.repeat(40);
  const evoluciones = [...(paciente.evoluciones || [])]
    .sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));

  const bloques = [
    `🏥 HISTORIA CLÍNICA UTI`,
    `📋 Clínica de la Unión S.A.`,
    `Fecha de impresión: ${new Date().toLocaleString('es-AR')}`,
    linea,
    ``,
    `👤 PACIENTE`,
    `Nombre: ${paciente.paciente || '—'}`,
    `Médico de ingreso: Dr. ${paciente.medicoIngreso || '—'}`,
    `Obra Social: ${paciente.obraSocial || '—'}`,
    `Cama: ${paciente.cama}`,
    `Fecha de ingreso: ${paciente.fechaIngreso || '—'}`,
    `Días internado: ${dias}`,
    `Motivo de ingreso: ${paciente.motivoIngreso || '—'}`,
    ``,
    linea,
    `🩺 ESTADO CLÍNICO`,
    `Diagnóstico actual:\n${paciente.diagnosticoActual || '—'}`,
    ``,
    `Antecedentes:\n${paciente.antecedentes || '—'}`,
    ``,
    `Tratamiento actual:\n${paciente.tratamientoActual || '—'}`,
    ``,
    `Pendientes:\n${paciente.pendientes || '—'}`,
  ];

  if (paciente.examenes) {
    bloques.push('', linea, `🔬 EXÁMENES`, paciente.examenes);
  }

  if (evoluciones.length > 0) {
    bloques.push('', linea, `📅 EVOLUCIONES (${evoluciones.length})`);
    evoluciones.forEach((ev, i) => {
      bloques.push(
        ``,
        `[${i + 1}] ${ev.fechaDoc} — Dr. ${ev.medicoEvolucion || '—'}`,
        ev.texto || '—',
      );
    });
  }

  bloques.push('', linea, `Fin de historia clínica`);
  return bloques.join('\n');
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
        {ocupado
          ? <Activity size={28} color="#e74c3c" />
          : <User     size={28} color="#27ae60" />}
      </div>
      {ocupado ? (
        <>
          <p className={styles.bedPatientName}>{paciente.paciente}</p>
          {paciente.medicoIngreso && (
            <p className={styles.bedDoctor}>Dr. {paciente.medicoIngreso}</p>
          )}
          <p className={styles.bedDays}>{dias} día{dias !== 1 ? 's' : ''} internado</p>
          <div className={styles.bedActions}>
            <span className={[styles.bedStatus, styles.bedStatusOccupied].join(' ')}>Ocupada</span>
            <button
              className={styles.bedResumenBtn}
              onClick={e => { e.stopPropagation(); onResumen(paciente); }}
              title="Ver resumen completo"
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

// ─── Modal de resumen / impresión / WhatsApp ──────────────────────────────────
function ResumenModal({ paciente, onClose }) {
  const [copied,     setCopied]     = useState(false);
  const [copiedWA,   setCopiedWA]   = useState(false);
  const printAreaRef = useRef(null);

  const evoluciones = useMemo(() =>
    [...(paciente?.evoluciones || [])].sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc)),
    [paciente]
  );

  // Ctrl+P / Cmd+P → imprimir solo el modal
  useEffect(() => {
    const handler = e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [paciente]);

  const handlePrint = useCallback(() => {
    if (!paciente) return;
    const content = printAreaRef.current?.innerHTML || '';
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8" />
        <title>Historia Clínica — ${paciente.paciente}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            font-size: 12px;
            color: #111;
            padding: 24px 32px;
            line-height: 1.6;
          }
          .print-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 2px solid #1a3a6b;
            padding-bottom: 12px;
            margin-bottom: 18px;
          }
          .print-header h1 { font-size: 16px; color: #1a3a6b; }
          .print-header p  { font-size: 11px; color: #555; margin-top: 3px; }
          .print-meta      { text-align: right; font-size: 11px; color: #555; }
          .section         { margin-bottom: 16px; page-break-inside: avoid; }
          .section-title   {
            font-size: 11px; font-weight: 700; text-transform: uppercase;
            letter-spacing: .06em; color: #1a3a6b;
            border-bottom: 1px solid #dbeafe; padding-bottom: 4px; margin-bottom: 8px;
          }
          .grid2           { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
          .field label     { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; }
          .field span      { font-size: 12px; color: #111; white-space: pre-wrap; }
          .evo-item        { border-left: 3px solid #2563a8; padding-left: 10px; margin-bottom: 12px; }
          .evo-header      { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
          .evo-date        { font-weight: 700; font-size: 11px; color: #2563a8; }
          .evo-doctor      { font-size: 11px; color: #5b21b6; background: #f5f3ff; padding: 1px 6px; border-radius: 8px; }
          .evo-text        { font-size: 12px; white-space: pre-wrap; }
          .footer          { margin-top: 24px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 10px; color: #94a3b8; text-align: center; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="print-header">
          <div>
            <h1>Historia Clínica — UTI</h1>
            <p>Clínica de la Unión S.A.</p>
          </div>
          <div class="print-meta">
            Impreso: ${new Date().toLocaleString('es-AR')}<br/>
            Cama ${paciente.cama} — ${calcDias(paciente.fechaIngreso)} días internado
          </div>
        </div>
        ${content}
        <div class="footer">Clínica de la Unión S.A. — Documento generado automáticamente</div>
      </body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 400);
  }, [paciente]);

  // Copiar texto plano al portapapeles (historia completa)
  const handleCopy = useCallback(async () => {
    const texto = generarTextoHistoria(paciente);
    await navigator.clipboard.writeText(texto);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [paciente]);

  // Copiar SOLO evoluciones ordenadas por fecha para WhatsApp
  const handleCopyWA = useCallback(async () => {
    if (!paciente) return;
    const evs = [...(paciente.evoluciones || [])]
      .sort((a, b) => new Date(a.fechaDoc) - new Date(b.fechaDoc));

    if (evs.length === 0) {
      await navigator.clipboard.writeText('Sin evoluciones registradas.');
      setCopiedWA(true);
      setTimeout(() => setCopiedWA(false), 2500);
      return;
    }

    const dias = calcDias(paciente.fechaIngreso);
    const lines = [
      `*${paciente.paciente}* — Cama ${paciente.cama}`,
      `Ingreso: ${paciente.fechaIngreso} (${dias} días)`,
      `Dr. ingreso: ${paciente.medicoIngreso || '—'}`,
      ``,
      `*📅 Evoluciones:*`,
    ];

    evs.forEach(ev => {
      lines.push(
        ``,
        `*${ev.fechaDoc}* — _Dr. ${ev.medicoEvolucion || '—'}_`,
        ev.texto || '—',
      );
    });

    await navigator.clipboard.writeText(lines.join('\n'));
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2500);
  }, [paciente]);

  if (!paciente) return null;
  const dias = calcDias(paciente.fechaIngreso);

  const Field = ({ label, value }) =>
    value ? (
      <div className="field" style={{ marginBottom: 6 }}>
        <label style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em', display: 'block' }}>{label}</label>
        <span style={{ fontSize: 12, whiteSpace: 'pre-wrap' }}>{value}</span>
      </div>
    ) : null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalBox} onClick={e => e.stopPropagation()}>

        {/* ── Header del modal ── */}
        <div className={styles.modalHeader}>
          <div className={styles.modalHeaderLeft}>
            <FileText size={18} />
            <div>
              <div className={styles.modalPatientName}>{paciente.paciente}</div>
              <div className={styles.modalPatientSub}>
                Cama {paciente.cama} &nbsp;·&nbsp; {dias} día{dias !== 1 ? 's' : ''} internado
                {paciente.obraSocial && <>&nbsp;·&nbsp; {paciente.obraSocial}</>}
              </div>
            </div>
          </div>
          <div className={styles.modalHeaderRight}>
            {/* Copiar WhatsApp */}
            <button
              className={[styles.modalActionBtn, styles.modalActionWA].join(' ')}
              onClick={handleCopyWA}
              title="Copiar evoluciones para WhatsApp"
            >
              {copiedWA ? <Check size={13} /> : <MessageCircle size={13} />}
              {copiedWA ? '¡Copiado!' : 'WhatsApp'}
            </button>
            {/* Copiar historia completa */}
            <button
              className={[styles.modalActionBtn, styles.modalActionCopy].join(' ')}
              onClick={handleCopy}
              title="Copiar historia completa"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? '¡Copiado!' : 'Copiar todo'}
            </button>
            {/* Imprimir */}
            <button
              className={[styles.modalActionBtn, styles.modalActionPrint].join(' ')}
              onClick={handlePrint}
              title="Imprimir historia clínica (Ctrl+P)"
            >
              <Printer size={13} /> Imprimir
            </button>
            <button className={styles.formCloseBtn} onClick={onClose}>
              <XCircle size={14} /> Cerrar
            </button>
          </div>
        </div>

        {/* ── Cuerpo imprimible ── */}
        <div className={styles.modalBody}>
          <div ref={printAreaRef}>

            {/* Admisión */}
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}>
                <UserCheck size={14} /> Admisión
              </div>
              <div className={styles.resumenGrid}>
                {[
                  ['Médico de ingreso', paciente.medicoIngreso],
                  ['Fecha de ingreso',  paciente.fechaIngreso],
                  ['Motivo de ingreso', paciente.motivoIngreso],
                  ['Obra Social',       paciente.obraSocial],
                ].map(([lbl, val]) => val ? (
                  <div key={lbl} className={styles.resumenField}>
                    <span className={styles.resumenFieldLabel}>{lbl}</span>
                    <span className={styles.resumenFieldValue}>{val}</span>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Estado Clínico */}
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}>
                <Stethoscope size={14} /> Estado Clínico
              </div>
              <div className={styles.resumenGrid}>
                {[
                  ['Diagnóstico actual',  paciente.diagnosticoActual],
                  ['Antecedentes',        paciente.antecedentes],
                  ['Tratamiento actual',  paciente.tratamientoActual],
                  ['Pendientes',          paciente.pendientes],
                ].map(([lbl, val]) => val ? (
                  <div key={lbl} className={styles.resumenField}>
                    <span className={styles.resumenFieldLabel}>{lbl}</span>
                    <span className={styles.resumenFieldValue}>{val}</span>
                  </div>
                ) : null)}
              </div>
            </div>

            {/* Exámenes */}
            {paciente.examenes && (
              <div className={styles.resumenSection}>
                <div className={styles.resumenSectionTitle}>
                  <FlaskConical size={14} /> Exámenes
                </div>
                <p className={styles.resumenPre}>{paciente.examenes}</p>
              </div>
            )}

            {/* Evoluciones — cronológicas */}
            <div className={styles.resumenSection}>
              <div className={styles.resumenSectionTitle}>
                <Activity size={14} /> Evoluciones ({evoluciones.length})
              </div>
              {evoluciones.length === 0 ? (
                <p className={styles.resumenEmpty}>Sin evoluciones registradas.</p>
              ) : (
                <div className={styles.evoTimeline}>
                  {evoluciones.map((ev, i) => (
                    <div key={i} className="evo-item" style={{ display: 'flex', gap: '0.85rem', paddingBottom: '1.1rem', position: 'relative' }}>
                      <div className={styles.evoTimelineDot} />
                      <div style={{ flex: 1 }}>
                        <div className={styles.evoTimelineHeader}>
                          <span className={styles.evoTimelineDate}>
                            <Calendar size={11} /> {ev.fechaDoc}
                          </span>
                          {ev.medicoEvolucion && (
                            <span className={styles.evoTimelineDoctor}>
                              Dr. {ev.medicoEvolucion}
                            </span>
                          )}
                        </div>
                        <p className={styles.evoTimelineText}>{ev.texto}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>{/* /printAreaRef */}
        </div>
      </div>
    </div>
  );
}

// ─── Panel Admin ──────────────────────────────────────────────────────────────
function AdminPanel({ pacientes, onClose }) {
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroCama,   setFiltroCama]   = useState('');
  const [fechaDesde,   setFechaDesde]   = useState('');
  const [fechaHasta,   setFechaHasta]   = useState('');

  const todasEvoluciones = useMemo(() => {
    const evs = [];
    pacientes.forEach(p => {
      (p.evoluciones || []).forEach(ev => {
        evs.push({ ...ev, pacienteNombre: p.paciente, cama: p.cama });
      });
    });
    return evs.sort((a, b) => new Date(b.fechaReal) - new Date(a.fechaReal));
  }, [pacientes]);

  const filtradas = useMemo(() => todasEvoluciones.filter(ev => {
    const matchNombre = !filtroNombre || ev.pacienteNombre?.toLowerCase().includes(filtroNombre.toLowerCase());
    const matchCama   = !filtroCama  || String(ev.cama) === filtroCama;
    const matchDesde  = !fechaDesde  || ev.fechaDoc >= fechaDesde;
    const matchHasta  = !fechaHasta  || ev.fechaDoc <= fechaHasta;
    return matchNombre && matchCama && matchDesde && matchHasta;
  }), [todasEvoluciones, filtroNombre, filtroCama, fechaDesde, fechaHasta]);

  return (
    <div className={styles.adminPanel}>
      <div className={styles.adminHeader}>
        <div className={styles.adminHeaderTitle}>
          <Shield size={16} /> Panel Administrador — Historial de Evoluciones
        </div>
        <button className={styles.formCloseBtn} onClick={onClose}>
          <XCircle size={14} /> Cerrar
        </button>
      </div>
      <div className={styles.adminBody}>
        <div className={styles.adminFilter}>
          <div className={styles.adminFilterGroup}>
            <span className={styles.adminFilterLabel}>Paciente</span>
            <input className={styles.adminFilterControl} placeholder="Buscar nombre..."
              value={filtroNombre} onChange={e => setFiltroNombre(e.target.value)} />
          </div>
          <div className={styles.adminFilterGroup}>
            <span className={styles.adminFilterLabel}>Cama</span>
            <select className={styles.adminFilterControl} value={filtroCama} onChange={e => setFiltroCama(e.target.value)}>
              <option value="">Todas</option>
              {CAMAS.map(c => <option key={c} value={c}>Cama {c}</option>)}
            </select>
          </div>
          <div className={styles.adminFilterGroup}>
            <span className={styles.adminFilterLabel}>Fecha Doc. Desde</span>
            <input type="date" className={styles.adminFilterControl}
              value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          </div>
          <div className={styles.adminFilterGroup}>
            <span className={styles.adminFilterLabel}>Hasta</span>
            <input type="date" className={styles.adminFilterControl}
              value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          </div>
        </div>

        {filtradas.length === 0 ? (
          <div className={styles.emptyState}>
            <ClipboardList size={40} />
            <p>No hay evoluciones con esos filtros.</p>
          </div>
        ) : (
          <table className={styles.evoTable}>
            <thead>
              <tr>
                <th>Cama</th>
                <th>Paciente</th>
                <th>Médico</th>
                <th>Fecha Dr.</th>
                <th>Fecha real carga</th>
                <th>Evolución</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((ev, i) => {
                const fechaDiferente = ev.fechaDoc !== ev.fechaReal?.split('T')[0];
                return (
                  <tr key={i}>
                    <td>{ev.cama}</td>
                    <td style={{ fontWeight: 600 }}>{ev.pacienteNombre}</td>
                    <td style={{ fontSize: '0.82rem', color: '#1a3a6b', fontWeight: 600 }}>
                      {ev.medicoEvolucion ? `Dr. ${ev.medicoEvolucion}` : '—'}
                    </td>
                    <td>
                      <span className={[styles.evoDateBadge, styles.evoDateDoc].join(' ')}>
                        <Calendar size={11} /> {ev.fechaDoc}
                      </span>
                      {fechaDiferente && (
                        <div style={{ marginTop: 3 }}>
                          <span className={[styles.evoDateBadge, styles.evoDateReal].join(' ')}>
                            ⚠ Cargado: {ev.fechaReal ? new Date(ev.fechaReal).toLocaleString('es-AR') : '—'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.78rem', color: '#64748b' }}>
                      {ev.fechaReal ? new Date(ev.fechaReal).toLocaleString('es-AR') : '—'}
                    </td>
                    <td><div className={styles.evoText}>{ev.texto}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─── Form defaults ────────────────────────────────────────────────────────────
const FORM_DEFAULTS = {
  paciente:          '',
  medicoIngreso:     '',
  obraSocial:        '',
  fechaIngreso:      new Date().toISOString().split('T')[0],
  motivoIngreso:     '',
  diagnosticoActual: '',
  antecedentes:      '',
  tratamientoActual: '',
  examenes:          '',
  pendientes:        '',
  evolucionFechaDoc: new Date().toISOString().split('T')[0],
  evolucionTexto:    '',
  medicoEvolucion:   '',
};

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
  // Admin
  const [showAdminInput,   setShowAdminInput]   = useState(false);
  const [adminPass,        setAdminPass]        = useState('');
  const [adminUnlocked,    setAdminUnlocked]    = useState(false);
  const [showAdminPanel,   setShowAdminPanel]   = useState(false);

  // Firebase
  useEffect(() => {
    const utiRef = ref(db, 'UTI');
    const unsub = onValue(utiRef, snapshot => {
      const data = snapshot.val();
      setPacientes(
        data
          ? Object.entries(data).map(([id, v]) => ({ id, ...v })).filter(p => p.activo !== false)
          : []
      );
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const pacienteEnCama = useCallback(cama => pacientes.find(p => p.cama === cama), [pacientes]);

  const handleCamaClick = cama => {
    if (camaSeleccionada === cama) { setCamaSeleccionada(null); return; }
    const ex = pacienteEnCama(cama);
    if (ex) {
      setEditId(ex.id);
      setFormData({
        paciente:          ex.paciente          || '',
        medicoIngreso:     ex.medicoIngreso      || '',
        obraSocial:        ex.obraSocial        || '',
        fechaIngreso:      ex.fechaIngreso       || '',
        motivoIngreso:     ex.motivoIngreso      || '',
        diagnosticoActual: ex.diagnosticoActual  || '',
        antecedentes:      ex.antecedentes       || '',
        tratamientoActual: ex.tratamientoActual  || '',
        examenes:          ex.examenes           || '',
        pendientes:        ex.pendientes         || '',
        evolucionFechaDoc: new Date().toISOString().split('T')[0],
        evolucionTexto:    '',
        medicoEvolucion:   '',
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
      alert('El campo "Médico que evoluciona" es obligatorio cuando se registra una evolución.');
      setActiveTab('evolucion');
      return;
    }

    setSaving(true);
    const ahora = new Date().toISOString();

    let nuevasEvoluciones = editId ? (pacienteEnCama(camaSeleccionada)?.evoluciones || []) : [];
    if (formData.evolucionTexto.trim()) {
      nuevasEvoluciones = [
        ...nuevasEvoluciones,
        {
          fechaDoc:        formData.evolucionFechaDoc,
          fechaReal:       ahora,
          texto:           formData.evolucionTexto.trim(),
          medicoEvolucion: formData.medicoEvolucion.trim(),
        },
      ];
    }

    const dataToSave = {
      paciente:          formData.paciente,
      medicoIngreso:     formData.medicoIngreso,
      obraSocial:        formData.obraSocial,
      fechaIngreso:      formData.fechaIngreso,
      motivoIngreso:     formData.motivoIngreso,
      diagnosticoActual: formData.diagnosticoActual,
      antecedentes:      formData.antecedentes,
      tratamientoActual: formData.tratamientoActual,
      examenes:          formData.examenes,
      pendientes:        formData.pendientes,
      evoluciones:       nuevasEvoluciones,
      cama:              camaSeleccionada,
      activo:            true,
      ultimaActualizacion: ahora,
    };

    try {
      if (editId) {
        await update(ref(db, `UTI/${editId}`), dataToSave);
      } else {
        await update(push(ref(db, 'UTI')), dataToSave);
      }
      setCamaSeleccionada(null);
      setEditId(null);
    } catch (err) {
      console.error(err);
      alert('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleAlta = async () => {
    if (!editId) return;
    await update(ref(db, `UTI/${editId}`), { activo: false, fechaAlta: new Date().toISOString() });
    setCamaSeleccionada(null); setEditId(null);
  };

  const handleTraslado = async () => {
    if (!editId) return;
    await update(ref(db, `UTI/${editId}`), { activo: false, fechaTraslado: new Date().toISOString() });
    setCamaSeleccionada(null); setEditId(null);
  };

  const handleAdminLogin = () => {
    if (adminPass === ADMIN_PASSWORD) {
      setAdminUnlocked(true); setShowAdminPanel(true);
      setShowAdminInput(false); setAdminPass('');
    } else {
      alert('Contraseña incorrecta');
    }
  };

  const ocupadas  = pacientes.filter(p => CAMAS.includes(p.cama)).length;
  const libres    = CAMAS.length - ocupadas;
  const ocupacion = Math.round((ocupadas / CAMAS.length) * 100);
  const evolucionFechaEsDistinta = formData.evolucionFechaDoc !== new Date().toISOString().split('T')[0];

  if (loading) {
    return (
      <>
        <Header />
        <div className={styles.loadingWrapper}>
          <div className={styles.spinner} />
          <span>Cargando UTI...</span>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Header global de la clínica ── */}
      <Header />

      <div className={styles.wrapper}>

        {/* ── Barra de título de sección ── */}
        <div className={styles.pageHeader}>
          <div className={styles.pageHeaderLeft}>
            <Activity size={22} className={styles.headerIcon} />
            <div>
              <h1 className={styles.pageTitle}>Unidad de Terapia Intensiva</h1>
              <p className={styles.pageSubtitle}>{CAMAS.length} camas · Clínica de la Unión S.A.</p>
            </div>
          </div>
          {/* Botón Admin */}
          <div className={styles.pageHeaderRight}>
            {!adminUnlocked ? (
              <button
                className={[styles.adminBadge, showAdminInput ? styles.adminBadgeActive : ''].join(' ')}
                onClick={() => setShowAdminInput(v => !v)}
              >
                <Shield size={13} /> Administrador
              </button>
            ) : (
              <button
                className={[styles.adminBadge, styles.adminBadgeActive].join(' ')}
                onClick={() => setShowAdminPanel(v => !v)}
              >
                <Eye size={13} /> {showAdminPanel ? 'Ocultar Panel' : 'Ver Panel'}
              </button>
            )}
            {showAdminInput && !adminUnlocked && (
              <div className={styles.adminLoginRow}>
                <input
                  type="password"
                  className={styles.adminFilterControl}
                  placeholder="Contraseña..."
                  value={adminPass}
                  onChange={e => setAdminPass(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAdminLogin()}
                />
                <button className={[styles.btn, styles.btnPrimary].join(' ')} onClick={handleAdminLogin}>
                  Acceder
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className={styles.statsBar}>
          {[
            { label: 'Ocupadas',    value: ocupadas,  cls: styles.statValueRed },
            { label: 'Disponibles', value: libres,    cls: styles.statValueGreen },
            { label: 'Ocupación',   value: `${ocupacion}%`, cls: styles.statValueBlue },
            { label: 'Total camas', value: CAMAS.length,    cls: styles.statValueBlue },
          ].map(s => (
            <div key={s.label} className={styles.statCard}>
              <div className={styles.statLabel}>{s.label}</div>
              <div className={[styles.statValue, s.cls].join(' ')}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Grilla de camas ── */}
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

        {/* ── Formulario inline ── */}
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
                  <button
                    key={tab.id}
                    type="button"
                    className={[styles.formTab, activeTab === tab.id ? styles.formTabActive : ''].join(' ')}
                    onClick={() => setActiveTab(tab.id)}
                  >
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
                      <input className={styles.formControl}
                        value={formData.paciente}
                        onChange={e => handleChange('paciente', e.target.value)}
                        required placeholder="Apellido, Nombre" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Médico de ingreso *
                        <span className={styles.requiredDot}> ●</span>
                      </label>
                      <input className={styles.formControl}
                        value={formData.medicoIngreso}
                        onChange={e => handleChange('medicoIngreso', e.target.value)}
                        required placeholder="Apellido del médico" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Obra Social</label>
                      <input className={styles.formControl}
                        value={formData.obraSocial}
                        onChange={e => handleChange('obraSocial', e.target.value)} />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>Fecha Ingreso *</label>
                      <input type="date" className={styles.formControl}
                        value={formData.fechaIngreso}
                        onChange={e => handleChange('fechaIngreso', e.target.value)}
                        required />
                    </div>
                    <div className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                      <label className={styles.formLabel}>Motivo de Ingreso</label>
                      <input className={styles.formControl}
                        value={formData.motivoIngreso}
                        onChange={e => handleChange('motivoIngreso', e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Tab: Clínico */}
                {activeTab === 'clinico' && (
                  <div className={styles.fieldsGrid}>
                    {[
                      ['diagnosticoActual', 'Diagnóstico Actual'],
                      ['antecedentes',      'Antecedentes'],
                      ['tratamientoActual', 'Tratamiento Actual'],
                      ['pendientes',        'Pendientes'],
                    ].map(([field, label]) => (
                      <div key={field} className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                        <label className={styles.formLabel}>{label}</label>
                        <textarea
                          className={[styles.formControl, styles.formControlTextarea].join(' ')}
                          value={formData[field]}
                          onChange={e => handleChange(field, e.target.value)} />
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab: Evolución */}
                {activeTab === 'evolucion' && (
                  <div className={styles.fieldsGrid}>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Médico que evoluciona *
                        <span className={styles.requiredDot}> ●</span>
                      </label>
                      <input className={styles.formControl}
                        value={formData.medicoEvolucion}
                        onChange={e => handleChange('medicoEvolucion', e.target.value)}
                        placeholder="Apellido del médico" />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.formLabel}>
                        Fecha de la evolución
                        <span className={styles.dateNote} style={{ marginLeft: 6 }}>(puede ser anterior)</span>
                      </label>
                      <input type="date" className={styles.formControl}
                        value={formData.evolucionFechaDoc}
                        onChange={e => handleChange('evolucionFechaDoc', e.target.value)}
                        max={new Date().toISOString().split('T')[0]} />
                      {evolucionFechaEsDistinta && (
                        <div className={styles.dateDiffWarning}>
                          <AlertCircle size={13} />
                          Se cargará hoy con fecha indicada {formData.evolucionFechaDoc}. Solo el administrador verá la diferencia.
                        </div>
                      )}
                    </div>
                    <div className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                      <label className={styles.formLabel}>Evolución del turno</label>
                      <textarea
                        className={[styles.formControl, styles.formControlTextarea].join(' ')}
                        rows={5}
                        value={formData.evolucionTexto}
                        onChange={e => handleChange('evolucionTexto', e.target.value)}
                        placeholder="Escribir la evolución del día..." />
                    </div>

                    {/* Historial previo */}
                    {editId && (pacienteEnCama(camaSeleccionada)?.evoluciones || []).length > 0 && (
                      <div className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                        <label className={styles.formLabel}>Evoluciones anteriores</label>
                        {[...(pacienteEnCama(camaSeleccionada)?.evoluciones || [])]
                          .sort((a, b) => new Date(b.fechaDoc) - new Date(a.fechaDoc))
                          .map((ev, i) => (
                            <div key={i} className={styles.evoHistItem}>
                              <div className={styles.evoHistHeader}>
                                <span className={styles.evoHistDate}><Calendar size={11} /> {ev.fechaDoc}</span>
                                {ev.medicoEvolucion && (
                                  <span className={styles.evoHistDoc}>Dr. {ev.medicoEvolucion}</span>
                                )}
                              </div>
                              <p className={styles.evoHistText}>{ev.texto}</p>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab: Exámenes */}
                {activeTab === 'examenes' && (
                  <div className={styles.fieldsGrid}>
                    <div className={[styles.formGroup, styles.fieldsFull].join(' ')}>
                      <label className={styles.formLabel}>Exámenes / Estudios</label>
                      <textarea
                        className={[styles.formControl, styles.formControlTextarea].join(' ')}
                        rows={5}
                        value={formData.examenes}
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
                    <button type="button" className={[styles.btn, styles.btnSecondary].join(' ')}
                      onClick={() => setCamaSeleccionada(null)}>
                      Cancelar
                    </button>
                  </div>
                  {editId && (
                    <div className={styles.actionsRight}>
                      <button type="button" className={[styles.btn, styles.btnSuccess].join(' ')} onClick={handleAlta}>
                        <Home size={14} /> Dar Alta
                      </button>
                      <button type="button" className={[styles.btn, styles.btnWarning].join(' ')} onClick={handleTraslado}>
                        <Truck size={14} /> Traslado
                      </button>
                    </div>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Panel Admin */}
        {adminUnlocked && showAdminPanel && (
          <AdminPanel pacientes={pacientes} onClose={() => setShowAdminPanel(false)} />
        )}

      </div>{/* /wrapper */}

      {/* Modal Resumen */}
      {pacienteResumen && (
        <ResumenModal paciente={pacienteResumen} onClose={() => setPacienteResumen(null)} />
      )}
    </>
  );
}
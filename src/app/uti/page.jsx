"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, push, update, set } from "firebase/database";
import s from "./page.module.css";

// ── Constantes ────────────────────────────────────────────────────────────────
const TOTAL_CAMAS = 5;

const TIPOS_EXAMEN = [
  { valor: "Laboratorio", icono: "🧪" },
  { valor: "Rx", icono: "🫁" },
  { valor: "Tomografía", icono: "🖥️" },
  { valor: "Ecografía", icono: "📡" },
  { valor: "ECG", icono: "💓" },
  { valor: "RMN", icono: "🧲" },
  { valor: "Endoscopía", icono: "🔬" },
  { valor: "Otro", icono: "📋" },
];

const FORM_VACIO = {
  paciente: "", dni: "", obraSocial: "", cama: "",
  fechaIngreso: new Date().toISOString().split("T")[0],
  medicoIngreso: "", motivoIngreso: "", diagnosticoActual: "",
  antecedentes: "", tratamientoActual: "",
};
const EVO_VACIA = { fechaDoc: new Date().toISOString().split("T")[0], medicoEvolucion: "", texto: "" };
const EXAMEN_VACIO = { tipo: "", fechaExamen: new Date().toISOString().split("T")[0], medico: "", informe: "", linkEstudio: "" };
const PEND_VACIO = { descripcion: "", tipo: "examen" };

// ── Helpers ───────────────────────────────────────────────────────────────────
function nowStr() {
  const d = new Date();
  return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
}
function diasDesde(fechaStr) {
  if (!fechaStr) return 0;
  const inicio = new Date(fechaStr + "T00:00:00");
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((hoy - inicio) / 86400000));
}
function fmtCorta(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}/${y}`;
}
function fmtTs(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ts; }
}

// ── Ícono SVG inline ──────────────────────────────────────────────────────────
function Ic({ d, size = 16, style: st2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ flexShrink: 0, ...st2 }}>
      <path d={d} />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════════
export default function UTIPage() {
  // ── TODOS LOS HOOKS AL NIVEL SUPERIOR (sin condiciones) ──────────────────────
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vista, setVista] = useState("camas");
  const [camaSelec, setCamaSelec] = useState(null);
  const [verExpId, setVerExpId] = useState(null);
  const [expTab, setExpTab] = useState("evoluciones"); // top-level, nunca condicional
  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState("datos");
  const [form, setForm] = useState(FORM_VACIO);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [evoForm, setEvoForm] = useState(EVO_VACIA);
  const [examenForm, setExamenForm] = useState(EXAMEN_VACIO);
  const [pendienteForm, setPendienteForm] = useState(PEND_VACIO);
  const [evoluciones, setEvoluciones] = useState([]);
  const [examenes, setExamenes] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [altaModal, setAltaModal] = useState(null);
  const [altaForm, setAltaForm] = useState({ medico: "", motivo: "" });
  const [altaError, setAltaError] = useState("");
  const [altaLoading, setAltaLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroPTipo, setFiltroPTipo] = useState("todos");
  const [copyToast, setCopyToast] = useState(false);

  const formPanelRef = useRef(null);

  // ── Cargar datos de Firebase ──────────────────────────────────────────────────
  useEffect(() => {
    const r = ref(db, "UTI");
    const unsub = onValue(r, snap => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, d]) => ({
        id, ...d,
        evoluciones: Array.isArray(d.evoluciones) ? d.evoluciones : [],
        examenesList: Array.isArray(d.examenesList) ? d.examenesList : [],
        pendientesList: Array.isArray(d.pendientesList) ? d.pendientesList : [],
      }));
      setRegistros(arr);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // ── Mapa de camas ─────────────────────────────────────────────────────────────
  const estadoCamas = useCallback(() => {
    const mapa = {};
    for (let i = 1; i <= TOTAL_CAMAS; i++) mapa[i] = null;
    registros.filter(r => r.activo).forEach(r => { mapa[r.cama] = r; });
    return mapa;
  }, [registros]);

  // ── Stats ─────────────────────────────────────────────────────────────────────
  const stats = useCallback(() => {
    const activos = registros.filter(r => r.activo).length;
    const libres = TOTAL_CAMAS - activos;
    const totalEvos = registros.reduce((a, r) => a + (r.evoluciones?.length || 0), 0);
    const totalExam = registros.reduce((a, r) => a + (r.examenesList?.length || 0), 0);
    const pendAct = registros.reduce((a, r) => a + (r.pendientesList?.filter(p => !p.resuelto).length || 0), 0);
    return { activos, libres, totalEvos, totalExam, pendAct };
  }, [registros]);

  // ── Helpers de acciones ───────────────────────────────────────────────────────
  const showToast = (msg) => { setSavedMsg(msg); setTimeout(() => setSavedMsg(""), 3000); };

  const scrollToForm = () =>
    setTimeout(() => formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);

  const abrirNuevo = (numCama) => {
    setEditId(null);
    setForm({ ...FORM_VACIO, cama: numCama });
    setEvoluciones([]); setExamenes([]); setPendientes([]);
    setEvoForm(EVO_VACIA); setExamenForm(EXAMEN_VACIO); setPendienteForm(PEND_VACIO);
    setFormTab("datos"); setShowForm(true); setCamaSelec(numCama);
    scrollToForm();
  };

  const abrirEditar = (registro) => {
    setEditId(registro.id);
    setForm({
      paciente: registro.paciente || "",
      dni: registro.dni || "",
      obraSocial: registro.obraSocial || "",
      cama: registro.cama || "",
      fechaIngreso: registro.fechaIngreso || new Date().toISOString().split("T")[0],
      medicoIngreso: registro.medicoIngreso || "",
      motivoIngreso: registro.motivoIngreso || "",
      diagnosticoActual: registro.diagnosticoActual || "",
      antecedentes: registro.antecedentes || "",
      tratamientoActual: registro.tratamientoActual || "",
    });
    setEvoluciones([...(registro.evoluciones || [])].reverse());
    setExamenes([...(registro.examenesList || [])].reverse());
    setPendientes(registro.pendientesList || []);
    setEvoForm(EVO_VACIA); setExamenForm(EXAMEN_VACIO); setPendienteForm(PEND_VACIO);
    setFormTab("datos"); setShowForm(true); setCamaSelec(registro.cama);
    scrollToForm();
  };

  const guardarDatos = async () => {
    if (!form.paciente.trim()) { showToast("⚠ Falta nombre del paciente"); return; }
    if (!form.cama) { showToast("⚠ Falta número de cama"); return; }
    setSaving(true);
    try {
      const data = { ...form, cama: Number(form.cama), activo: true, ultimaActualizacion: new Date().toISOString() };
      if (editId) {
        await update(ref(db, `UTI/${editId}`), data);
      } else {
        const nr = push(ref(db, "UTI"));
        await set(nr, { ...data, evoluciones: [], examenesList: [], pendientesList: [] });
        setEditId(nr.key);
      }
      showToast("✓ Datos guardados");
    } catch { showToast("⚠ Error al guardar"); }
    setSaving(false);
  };

  const agregarEvolucion = async () => {
    if (!evoForm.texto.trim() || !editId) return;
    const nueva = { ...evoForm, fechaReal: nowStr() };
    const lista = [...(registros.find(r => r.id === editId)?.evoluciones || []), nueva];
    setSaving(true);
    try {
      await update(ref(db, `UTI/${editId}`), { evoluciones: lista, ultimaActualizacion: new Date().toISOString() });
      setEvoluciones([nueva, ...evoluciones]);
      setEvoForm(EVO_VACIA);
      showToast("✓ Evolución guardada");
    } catch { showToast("⚠ Error al guardar"); }
    setSaving(false);
  };

  const agregarExamen = async () => {
    if (!examenForm.tipo || !examenForm.informe.trim() || !editId) return;
    const nuevo = { ...examenForm, fechaCarga: new Date().toISOString() };
    const listaAct = registros.find(r => r.id === editId)?.examenesList || [];
    const lista = [...listaAct, nuevo];
    setSaving(true);
    try {
      await update(ref(db, `UTI/${editId}`), { examenesList: lista, ultimaActualizacion: new Date().toISOString() });
      setExamenes([nuevo, ...examenes]);
      setExamenForm(EXAMEN_VACIO);
      showToast("✓ Examen guardado");
    } catch { showToast("⚠ Error al guardar"); }
    setSaving(false);
  };

  const agregarPendiente = async () => {
    if (!pendienteForm.descripcion.trim() || !editId) return;
    const nuevo = {
      ...pendienteForm, resuelto: false,
      fechaCreacion: new Date().toISOString(), fechaResolucion: "",
      nombrePaciente: form.paciente, dniPaciente: form.dni, cama: form.cama,
    };
    const listaAct = registros.find(r => r.id === editId)?.pendientesList || [];
    const lista = [...listaAct, nuevo];
    setSaving(true);
    try {
      await update(ref(db, `UTI/${editId}`), { pendientesList: lista, ultimaActualizacion: new Date().toISOString() });
      setPendientes(lista);
      setPendienteForm(PEND_VACIO);
      showToast("✓ Pendiente agregado");
    } catch { showToast("⚠ Error al guardar"); }
    setSaving(false);
  };

  const togglePendiente = async (idx, regId, listaActual) => {
    const lista = listaActual.map((p, i) =>
      i === idx ? { ...p, resuelto: !p.resuelto, fechaResolucion: !p.resuelto ? new Date().toISOString() : "" } : p
    );
    try {
      await update(ref(db, `UTI/${regId}`), { pendientesList: lista, ultimaActualizacion: new Date().toISOString() });
      if (editId === regId) setPendientes(lista);
    } catch { showToast("⚠ Error al actualizar"); }
  };

  const confirmarAlta = async () => {
    if (!altaForm.medico.trim() || !altaForm.motivo.trim()) { setAltaError("Completá médico y motivo."); return; }
    setAltaLoading(true); setAltaError("");
    try {
      await update(ref(db, `UTI/${altaModal.id}`), {
        activo: false, fechaAlta: new Date().toISOString(),
        medicoAlta: altaForm.medico, motivoAlta: altaForm.motivo,
        tipoAlta: altaModal.tipo, ultimaActualizacion: new Date().toISOString(),
      });
      setAltaModal(null); setAltaForm({ medico: "", motivo: "" });
      if (editId === altaModal.id) { setShowForm(false); setCamaSelec(null); }
    } catch { setAltaError("Error al guardar."); }
    setAltaLoading(false);
  };

  const generarResumen = (reg) => {
    const dias = diasDesde(reg.fechaIngreso);
    const evos = reg.evoluciones || [];
    const exams = reg.examenesList || [];
    const pends = reg.pendientesList || [];
    let txt = `🏥 HISTORIA CLÍNICA — UTI\nClínica de la Unión S.A.\nFecha: ${nowStr()}\n${"─".repeat(40)}\n\n`;
    txt += `Paciente : ${reg.paciente}${reg.dni ? `\nDNI      : ${reg.dni}` : ""}\n`;
    txt += `Médico   : Dr. ${reg.medicoIngreso}\nObra Soc.: ${reg.obraSocial}\nCama     : ${reg.cama}\n`;
    txt += `Ingreso  : ${fmtCorta(reg.fechaIngreso)} (${dias} día${dias !== 1 ? "s" : ""})\nMotivo   : ${reg.motivoIngreso || "—"}\n`;
    txt += `${"─".repeat(40)}\nDiagnóstico:\n${reg.diagnosticoActual || "—"}\n\nAntecedentes:\n${reg.antecedentes || "—"}\n\nTratamiento:\n${reg.tratamientoActual || "—"}\n\n`;
    const pa = pends.filter(p => !p.resuelto);
    if (pa.length) { txt += `${"─".repeat(40)}\n⏳ PENDIENTES (${pa.length})\n\n`; pa.forEach((p, i) => { txt += `[${i + 1}] [${p.tipo}] ${p.descripcion}\n`; }); txt += "\n"; }
    if (exams.length) { txt += `${"─".repeat(40)}\n🔬 EXÁMENES (${exams.length})\n\n`;[...exams].reverse().forEach((ex, i) => { txt += `[${i + 1}] ${ex.tipo} — ${fmtCorta(ex.fechaExamen)}\n${ex.informe}\n${ex.linkEstudio ? `Link: ${ex.linkEstudio}\n` : ""}\n`; }); }
    if (evos.length) { txt += `${"─".repeat(40)}\n📅 EVOLUCIONES (${evos.length})\n\n`;[...evos].reverse().forEach((e, i) => { txt += `[${i + 1}] ${fmtCorta(e.fechaDoc)} — Dr. ${e.medicoEvolucion}\nCargado: ${e.fechaReal}\n${e.texto}\n\n`; }); }
    txt += `${"─".repeat(40)}\nFin de historia clínica.`;
    return txt;
  };

  // ── Early returns (solo después de todos los hooks) ───────────────────────────
  if (loading) {
    return (
      <div className={s.page}>
        <div className={s.loadingScreen}>
          <div className={s.spinner} />
          <span>Cargando UTI...</span>
        </div>
      </div>
    );
  }

  const camas = estadoCamas();
  const st = stats();

  // Registro para el expediente (calculado después del loading check)
  const regExp = verExpId ? registros.find(r => r.id === verExpId) : null;

  // ════════════════════════════════════════════════════════════════════════════
  // EXPEDIENTE FULLSCREEN
  // ════════════════════════════════════════════════════════════════════════════
  if (verExpId && regExp) {
    const evos = [...(regExp.evoluciones || [])].reverse();
    const exams = [...(regExp.examenesList || [])].reverse();
    const pends = regExp.pendientesList || [];
    const pendAct = pends.filter(p => !p.resuelto);

    return (
      <div className={s.expedientePage}>
        {copyToast && <div className={s.toast}>✓ Copiado al portapapeles</div>}

        {/* Topbar del expediente */}
        <div className={s.expedienteTopbar}>
          <button className={s.backBtn} onClick={() => { setVerExpId(null); setExpTab("evoluciones"); }}>
            <Ic d="M19 12H5M12 5l-7 7 7 7" /> Volver
          </button>
          <div className={s.expedienteTopbarCenter}>
            <h1 className={s.expedienteNombre}>{regExp.paciente}</h1>
            {regExp.dni && <p className={s.expedienteDni}>DNI {regExp.dni}</p>}
            <p className={s.expedienteMeta}>
              Cama {regExp.cama} · {regExp.obraSocial} · {fmtCorta(regExp.fechaIngreso)} ({diasDesde(regExp.fechaIngreso)} días)
              {regExp.activo ? " · ACTIVO" : " · ALTA"}
            </p>
          </div>
          <div className={s.expedienteTopbarActions}>
            {regExp.activo && (
              <button className={`${s.actionBtn} ${s.actionDone}`}
                onClick={() => { setAltaModal({ id: regExp.id, tipo: "alta", paciente: regExp.paciente }); setVerExpId(null); }}>
                <Ic d="M9 11l3 3L22 4" size={14} /><span className={s.actionLabel}>Dar Alta</span>
              </button>
            )}
            <button className={`${s.actionBtn} ${s.actionCopy}`} onClick={() => {
              navigator.clipboard.writeText(generarResumen(regExp));
              setCopyToast(true); setTimeout(() => setCopyToast(false), 2500);
            }}>
              <Ic d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M16 8h2a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-2" size={14} />
              <span className={s.actionLabel}>Copiar</span>
            </button>
            <button className={`${s.actionBtn} ${s.actionPrint}`} onClick={() => window.print()}>
              <Ic d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z" size={14} />
              <span className={s.actionLabel}>Imprimir</span>
            </button>
          </div>
        </div>

        <div className={s.expedienteScroll}>
          <div className={s.expedienteInner}>

            {/* Datos del paciente */}
            <div className={s.seccion}>
              <h3 className={s.seccionTitulo}>
                <Ic d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" size={13} />
                Datos del paciente
              </h3>
              <div className={s.seccionGrid}>
                <div className={s.campo}><span className={s.campoLabel}>Paciente</span><span className={s.campoValor}>{regExp.paciente}</span></div>
                {regExp.dni && <div className={s.campo}><span className={s.campoLabel}>DNI</span><span className={s.campoValor}>{regExp.dni}</span></div>}
                <div className={s.campo}><span className={s.campoLabel}>Obra Social</span><span className={s.campoValor}>{regExp.obraSocial || "—"}</span></div>
                <div className={s.campo}><span className={s.campoLabel}>Cama</span><span className={s.campoValor}>{regExp.cama}</span></div>
                <div className={s.campo}><span className={s.campoLabel}>Ingreso</span><span className={s.campoValor}>{fmtCorta(regExp.fechaIngreso)}</span></div>
                <div className={s.campo}><span className={s.campoLabel}>Médico</span><span className={s.campoValor}>{regExp.medicoIngreso || "—"}</span></div>
                <div className={s.campo} style={{ gridColumn: "1/-1" }}><span className={s.campoLabel}>Motivo</span><span className={s.campoValor}>{regExp.motivoIngreso || "—"}</span></div>
                <div className={s.campo} style={{ gridColumn: "1/-1" }}><span className={s.campoLabel}>Diagnóstico</span><span className={s.campoValor}>{regExp.diagnosticoActual || "—"}</span></div>
                <div className={s.campo} style={{ gridColumn: "1/-1" }}><span className={s.campoLabel}>Antecedentes</span><span className={s.campoValor}>{regExp.antecedentes || "—"}</span></div>
                <div className={s.campo} style={{ gridColumn: "1/-1" }}><span className={s.campoLabel}>Tratamiento actual</span><span className={s.campoValor}>{regExp.tratamientoActual || "—"}</span></div>
                {!regExp.activo && (
                  <div className={s.campo} style={{ gridColumn: "1/-1" }}>
                    <span className={s.campoLabel}>Alta ({regExp.tipoAlta || "alta"})</span>
                    <span className={s.campoValor}>{fmtTs(regExp.fechaAlta)} · Dr. {regExp.medicoAlta} · {regExp.motivoAlta}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Tabs del expediente */}
            <div className={s.expedienteTabBar}>
              {[
                { id: "evoluciones", label: "Evoluciones", count: evos.length, badge: "", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8" },
                { id: "examenes", label: "Exámenes", count: exams.length, badge: "blue", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM12 18v-6M9 15h6" },
                { id: "pendientes", label: "Pendientes", count: pendAct.length, badge: "amber", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
              ].map(t => (
                <button key={t.id}
                  className={`${s.expedienteTab} ${expTab === t.id ? s.expedienteTabActive : ""}`}
                  onClick={() => setExpTab(t.id)}>
                  <Ic d={t.icon} size={13} />
                  {t.label}
                  <span className={`${s.tabBadge} ${t.badge === "blue" && t.count > 0 ? s.tabBadgeBlue : ""} ${t.badge === "amber" && t.count > 0 ? s.tabBadgeAmber : ""}`}>
                    {t.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Contenido según tab activo */}
            {expTab === "evoluciones" && (
              <div className={s.seccion}>
                <h3 className={s.seccionTitulo}>
                  <Ic d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" size={13} />
                  Evoluciones <span className={s.countBadge}>{evos.length}</span>
                </h3>
                {evos.length === 0 ? <p className={s.sinDatos}>Sin evoluciones registradas.</p> : (
                  <div className={s.evoTimeline}>
                    {evos.map((e, i) => (
                      <div key={i} className={s.evoItem}>
                        <div className={s.evoDot} />
                        <div className={s.evoContent}>
                          <div className={s.evoMeta}>
                            <span className={s.evoFechaClinica}>
                              <Ic d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z" size={11} />
                              {fmtCorta(e.fechaDoc)}
                            </span>
                            <span className={s.evoMedico}>Dr. {e.medicoEvolucion}</span>
                            <span className={s.evoCarga}>Cargado: {e.fechaReal}</span>
                          </div>
                          <p className={s.evoTexto}>{e.texto}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {expTab === "examenes" && (
              <div className={s.seccion}>
                <h3 className={s.seccionTitulo}>
                  <Ic d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM12 18v-6M9 15h6" size={13} />
                  Exámenes <span className={s.countBadge}>{exams.length}</span>
                </h3>
                {exams.length === 0 ? <p className={s.sinDatos}>Sin exámenes registrados.</p> : (
                  <div className={s.evoTimeline}>
                    {exams.map((ex, i) => (
                      <div key={i} className={s.evoItem}>
                        <div className={`${s.evoDot} ${s.evoDotExamen}`} />
                        <div className={`${s.evoContent} ${s.evoContentExamen}`}>
                          <div className={s.evoMeta}>
                            <span className={s.examenTipoBadge}>{TIPOS_EXAMEN.find(t => t.valor === ex.tipo)?.icono || "📋"} {ex.tipo}</span>
                            <span className={s.evoFechaClinica}>{fmtCorta(ex.fechaExamen)}</span>
                            {ex.medico && <span className={s.evoMedico}>{ex.medico}</span>}
                            <span className={s.evoCarga}>Cargado: {fmtTs(ex.fechaCarga)}</span>
                          </div>
                          <p className={s.evoTexto}>{ex.informe}</p>
                          {ex.linkEstudio && (
                            <a href={ex.linkEstudio} target="_blank" rel="noopener noreferrer" className={s.evoExamenLink}>
                              <Ic d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={12} />
                              Ver estudio / imágenes
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {expTab === "pendientes" && (
              <div className={s.seccion}>
                <h3 className={s.seccionTitulo}>
                  <Ic d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" size={13} />
                  Pendientes
                  {pendAct.length > 0 && (
                    <span className={s.countBadge} style={{ background: "var(--amber-100)", color: "var(--amber-700)" }}>
                      {pendAct.length} activos
                    </span>
                  )}
                </h3>
                {pends.length === 0 ? <p className={s.sinDatos}>Sin pendientes cargados.</p> : (
                  <div className={s.pendientesContainer}>
                    {pends.map((p, i) => (
                      <div key={i} className={s.pendienteItem}>
                        <div
                          className={`${s.pendienteCheckbox} ${p.resuelto ? s.pendienteCheckboxResuelto : ""}`}
                          style={{ cursor: "pointer" }}
                          onClick={() => togglePendiente(i, regExp.id, pends)}>
                          {p.resuelto && <Ic d="M20 6L9 17l-5-5" size={11} st2={{ color: "#fff" }} />}
                        </div>
                        <div className={s.pendienteContent}>
                          <div className={s.pendienteHeader}>
                            <span className={`${s.pendienteTipoBadge} ${p.tipo === "examen" ? s.pendienteBadgeExamen : p.tipo === "evolucion" ? s.pendienteBadgeEvol : s.pendienteBadgeAlerta}`}>
                              {p.tipo}
                            </span>
                          </div>
                          <p className={`${s.pendienteDescripcion} ${p.resuelto ? s.pendienteResueltoText : ""}`}>{p.descripcion}</p>
                          <div className={s.pendienteMeta}>
                            <span className={s.pendienteFecha}>{fmtTs(p.fechaCreacion)}</span>
                            {p.resuelto && <span className={s.pendienteFecha} style={{ color: "var(--green-600)" }}>✓ Resuelto {fmtTs(p.fechaResolucion)}</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Datos filtrados para lista y pendientes ───────────────────────────────────
  const registrosFiltrados = registros.filter(r => {
    const q = search.toLowerCase();
    const ok = !q || r.paciente?.toLowerCase().includes(q) || r.dni?.includes(q) || r.medicoIngreso?.toLowerCase().includes(q) || String(r.cama).includes(q);
    const est = filtroEstado === "todos" ? true : filtroEstado === "activos" ? r.activo : !r.activo;
    return ok && est;
  }).sort((a, b) => a.activo !== b.activo ? (a.activo ? -1 : 1) : (a.cama || 99) - (b.cama || 99));

  const todosPendientes = registros.flatMap(r =>
    (r.pendientesList || []).filter(p => !p.resuelto)
      .map(p => ({ ...p, _regId: r.id, _regPends: r.pendientesList || [] }))
  ).filter(p => {
    const q = search.toLowerCase();
    if (filtroPTipo !== "todos" && p.tipo !== filtroPTipo) return false;
    if (q) return p.descripcion?.toLowerCase().includes(q) || p.nombrePaciente?.toLowerCase().includes(q) || p.dniPaciente?.includes(q);
    return true;
  });

  // ════════════════════════════════════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div className={s.page}>

      {/* ── Topbar ── */}
      <div className={s.adminTopbar}>
        <div className={s.adminTopbarLeft}>
          <div className={s.adminTopbarIcon}><Ic d="M22 12h-4l-3 9L9 3l-3 9H2" size={18} /></div>
          <span className={s.adminTopbarTitle}>UTI — Clínica de la Unión</span>
        </div>
        <div className={s.adminTopbarCenter}>
          {[
            { v: "camas", label: "Camas", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
            { v: "lista", label: "Pacientes", icon: "M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" },
            { v: "timeline", label: "Timeline", icon: "M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
            { v: "pendientes", label: "Pendientes", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
          ].map(({ v, label, icon }) => (
            <button key={v}
              className={`${s.adminNavBtn} ${vista === v ? s.adminNavBtnActive : ""}`}
              onClick={() => { setVista(v); setShowForm(false); setSearch(""); }}>
              <Ic d={icon} size={13} />{label}
              {v === "pendientes" && st.pendAct > 0 && (
                <span style={{ background: "var(--amber-100)", color: "var(--amber-700)", borderRadius: 999, fontSize: ".65rem", fontWeight: 800, padding: "0 .4rem" }}>
                  {st.pendAct}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className={s.adminTopbarRight}>
          <span className={s.adminUserBadge}><Ic d="M22 12h-4l-3 9L9 3l-3 9H2" size={12} />UTI</span>
        </div>
      </div>

      {/* Toast */}
      {savedMsg && (
        <div className={`${s.savedToast} ${savedMsg.startsWith("✓") ? s.savedToastOk : s.savedToastWarn}`}>{savedMsg}</div>
      )}

      {/* ── Stats ── */}
      <div className={s.statsGrid}>
        {[
          { label: "Camas ocupadas", val: st.activos, cls: s.sRed, icon: "M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
          { label: "Camas libres", val: st.libres, cls: s.sGreen, icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" },
          { label: "Evoluciones", val: st.totalEvos, cls: s.sBlue, icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" },
          { label: "Exámenes", val: st.totalExam, cls: s.sTeal, icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM12 18v-6M9 15h6" },
          { label: "Pendientes activos", val: st.pendAct, cls: s.sAmber, icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
          { label: "Total registros", val: registros.length, cls: s.sPurple, icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
        ].map(({ label, val, cls, icon }) => (
          <div key={label} className={s.statCard}>
            <div className={s.statCardIcon}><Ic d={icon} size={18} /></div>
            <div className={`${s.statCardValue} ${cls}`}>{val}</div>
            <div className={s.statCardLabel}>{label}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════════════════
          VISTA: CAMAS
      ══════════════════════════════════════════════ */}
      {vista === "camas" && (
        <>
          {/* Formulario PRIMERO → aparece arriba de las camas */}
          {showForm && (
            <div className={s.formPanel} ref={formPanelRef}>
              <div className={s.formPanelHeader}>
                <div className={s.formPanelTitle}>
                  <Ic d={editId ? "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" : "M12 5v14m-7-7h14"} size={15} />
                  {editId ? `Editando — Cama ${form.cama}` : `Nuevo ingreso — Cama ${camaSelec}`}
                </div>
                {form.paciente && <span className={s.formPanelBed}>{form.paciente}</span>}
                <button className={s.formPanelClose} onClick={() => { setShowForm(false); setCamaSelec(null); }}>
                  <Ic d="M18 6L6 18M6 6l12 12" size={16} />
                </button>
              </div>

              {/* Tabs */}
              <div className={s.tabBar}>
                {[
                  { id: "datos", label: "Datos", icon: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
                  { id: "evolucion", label: "Evolución", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" },
                  { id: "examenes", label: "Exámenes", icon: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM12 18v-6M9 15h6" },
                  { id: "pendientes", label: "Pendientes", icon: "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" },
                ].map(t => (
                  <button key={t.id} className={`${s.tab} ${formTab === t.id ? s.tabActive : ""}`} onClick={() => setFormTab(t.id)}>
                    <Ic d={t.icon} size={13} />{t.label}
                    {t.id === "evolucion" && evoluciones.length > 0 && <span className={`${s.tabBadge} ${s.tabBadgeBlue}`}>{evoluciones.length}</span>}
                    {t.id === "examenes" && examenes.length > 0 && <span className={`${s.tabBadge} ${s.tabBadgeBlue}`}>{examenes.length}</span>}
                    {t.id === "pendientes" && pendientes.filter(p => !p.resuelto).length > 0 && <span className={`${s.tabBadge} ${s.tabBadgeAmber}`}>{pendientes.filter(p => !p.resuelto).length}</span>}
                  </button>
                ))}
              </div>

              {/* ── Tab DATOS ── */}
              {formTab === "datos" && (
                <div className={s.formBody}>
                  <div className={s.fieldsGrid}>
                    <div className={`${s.fieldGroup} ${s.fieldFull}`}>
                      <label className={s.fieldLabel}><Ic d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" size={12} />Nombre del paciente *</label>
                      <input className={s.fieldInput} value={form.paciente} onChange={e => setForm(f => ({ ...f, paciente: e.target.value.toUpperCase() }))} placeholder="APELLIDO, Nombre" />
                    </div>
                    <div className={s.fieldGroup}>
                      <label className={s.fieldLabel}>DNI</label>
                      <input className={s.fieldInput} value={form.dni} onChange={e => setForm(f => ({ ...f, dni: e.target.value }))} placeholder="Ej: 28.345.678" maxLength={12} />
                    </div>
                    <div className={s.fieldGroup}>
                      <label className={s.fieldLabel}>Obra Social</label>
                      <input className={s.fieldInput} value={form.obraSocial} onChange={e => setForm(f => ({ ...f, obraSocial: e.target.value }))} placeholder="PAMI, OSDE..." />
                    </div>

                    <div className={s.fieldGroup}>
                      <label className={s.fieldLabel}>Fecha de ingreso</label>
                      <input type="date" className={s.fieldInput} value={form.fechaIngreso} onChange={e => setForm(f => ({ ...f, fechaIngreso: e.target.value }))} />
                    </div>
                    <div className={s.fieldGroup}>
                      <label className={s.fieldLabel}>Médico de ingreso</label>
                      <input className={s.fieldInput} value={form.medicoIngreso} onChange={e => setForm(f => ({ ...f, medicoIngreso: e.target.value }))} placeholder="Dr. ..." />
                    </div>
                    <div className={`${s.fieldGroup} ${s.fieldFull}`}>
                      <label className={s.fieldLabel}>Motivo de ingreso</label>
                      <textarea className={`${s.fieldInput} ${s.fieldTextarea}`} value={form.motivoIngreso} onChange={e => setForm(f => ({ ...f, motivoIngreso: e.target.value }))} placeholder="Descripción del motivo..." />
                    </div>
                    <div className={`${s.fieldGroup} ${s.fieldFull}`}>
                      <label className={s.fieldLabel}>Diagnóstico actual</label>
                      <textarea className={`${s.fieldInput} ${s.fieldTextarea}`} value={form.diagnosticoActual} onChange={e => setForm(f => ({ ...f, diagnosticoActual: e.target.value }))} placeholder="Diagnóstico principal y secundarios..." />
                    </div>
                    <div className={`${s.fieldGroup} ${s.fieldFull}`}>
                      <label className={s.fieldLabel}>Antecedentes</label>
                      <textarea className={`${s.fieldInput} ${s.fieldTextarea}`} value={form.antecedentes} onChange={e => setForm(f => ({ ...f, antecedentes: e.target.value }))} placeholder="Antecedentes patológicos relevantes..." />
                    </div>
                    <div className={`${s.fieldGroup} ${s.fieldFull}`}>
                      <label className={s.fieldLabel}>Tratamiento actual</label>
                      <textarea className={`${s.fieldInput} ${s.fieldTextarea} ${s.fieldTextareaLg}`} value={form.tratamientoActual} onChange={e => setForm(f => ({ ...f, tratamientoActual: e.target.value }))} placeholder="Medicación e indicaciones..." />
                    </div>
                  </div>
                  <div className={s.formActions}>
                    <div className={s.formActionsLeft}>
                      {editId && (<>
                        <button className={`${s.btn} ${s.btnGreen}`} onClick={() => setAltaModal({ id: editId, tipo: "alta", paciente: form.paciente })}><Ic d="M9 11l3 3L22 4" size={14} />Dar Alta</button>
                        <button className={`${s.btn} ${s.btnAmber}`} onClick={() => setAltaModal({ id: editId, tipo: "traslado", paciente: form.paciente })}><Ic d="M5 12h14m-7-7 7 7-7 7" size={14} />Traslado</button>
                      </>)}
                    </div>
                    <div className={s.formActionsRight}>
                      <button className={`${s.btn} ${s.btnGhost}`} onClick={() => { setShowForm(false); setCamaSelec(null); }}>Cancelar</button>
                      <button className={`${s.btn} ${s.btnPrimary}`} onClick={guardarDatos} disabled={saving}>
                        <Ic d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8" size={14} />
                        {saving ? "Guardando..." : "Guardar"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ── Tab EVOLUCIÓN ── */}
              {formTab === "evolucion" && (
                <div className={s.formBody}>
                  {!editId
                    ? <div className={s.alertNote}><Ic d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={14} />Guardá primero los datos básicos.</div>
                    : (<>
                      <div className={s.fieldsGrid}>
                        <div className={s.fieldGroup}>
                          <label className={s.fieldLabel}>Fecha clínica</label>
                          <input type="date" className={s.fieldInput} value={evoForm.fechaDoc} onChange={e => setEvoForm(f => ({ ...f, fechaDoc: e.target.value }))} />
                        </div>
                        <div className={s.fieldGroup}>
                          <label className={s.fieldLabel}>Médico</label>
                          <input className={s.fieldInput} value={evoForm.medicoEvolucion} onChange={e => setEvoForm(f => ({ ...f, medicoEvolucion: e.target.value }))} placeholder="Dr. ..." />
                        </div>
                        <div className={`${s.fieldGroup} ${s.fieldFull}`}>
                          <label className={s.fieldLabel}>Texto de la evolución <span className={s.labelNote}>se guarda con fecha/hora automática</span></label>
                          <textarea className={`${s.fieldInput} ${s.fieldTextarea} ${s.fieldTextareaLg}`} value={evoForm.texto} onChange={e => setEvoForm(f => ({ ...f, texto: e.target.value }))} placeholder="Escribir evolución clínica..." />
                        </div>
                      </div>
                      <div className={s.formActions}>
                        <div />
                        <div className={s.formActionsRight}>
                          <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setEvoForm(EVO_VACIA)}>Limpiar</button>
                          <button className={`${s.btn} ${s.btnPrimary}`} onClick={agregarEvolucion} disabled={saving || !evoForm.texto.trim()}>
                            <Ic d="M12 5v14m-7-7h14" size={14} />{saving ? "Guardando..." : "Agregar evolución"}
                          </button>
                        </div>
                      </div>
                      {evoluciones.length > 0 && (<>
                        <div className={s.fieldLabel} style={{ marginTop: ".5rem" }}>Evoluciones anteriores ({evoluciones.length})</div>
                        <div className={s.evoHistList}>
                          {evoluciones.map((e, i) => (
                            <div key={i} className={s.evoHistItem}>
                              <div className={s.evoHistMeta}>
                                <span className={s.evoHistDate}>{fmtCorta(e.fechaDoc)}</span>
                                <span className={s.evoHistDoc}>Dr. {e.medicoEvolucion}</span>
                                {/* <span className={s.evoHistCarga}>{e.fechaReal}</span> */}
                              </div>
                              <p className={s.evoHistText}>{e.texto}</p>
                            </div>
                          ))}
                        </div>
                      </>)}
                    </>)
                  }
                </div>
              )}

              {/* ── Tab EXÁMENES ── */}
              {formTab === "examenes" && (
                <div className={s.formBody}>
                  {!editId
                    ? <div className={s.alertNote}><Ic d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={14} />Guardá primero los datos básicos.</div>
                    : (<>
                      <div className={s.examenForm}>
                        <h4 className={s.examenFormTitle}><Ic d="M12 5v14m-7-7h14" size={13} />Cargar nuevo examen</h4>
                        <div className={s.fieldGroup}>
                          <span className={s.fieldLabel}>Tipo de estudio *</span>
                          <div className={s.tipoExamenGrid}>
                            {TIPOS_EXAMEN.map(t => (
                              <button key={t.valor} type="button"
                                className={`${s.tipoExamenBtn} ${examenForm.tipo === t.valor ? s.tipoExamenBtnActive : ""}`}
                                onClick={() => setExamenForm(f => ({ ...f, tipo: t.valor }))}>
                                <span className={s.tipoExamenIcon}>{t.icono}</span>{t.valor}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={s.fieldsGrid}>
                          <div className={s.fieldGroup}>
                            <label className={s.fieldLabel}>Fecha del estudio</label>
                            <input type="date" className={s.fieldInput} value={examenForm.fechaExamen} onChange={e => setExamenForm(f => ({ ...f, fechaExamen: e.target.value }))} />
                          </div>
                          <div className={s.fieldGroup}>
                            <label className={s.fieldLabel}>Médico solicitante </label>
                            <input className={s.fieldInput} value={examenForm.medico} onChange={e => setExamenForm(f => ({ ...f, medico: e.target.value }))} placeholder="Dr. ..." />
                          </div>
                          <div className={`${s.fieldGroup} ${s.fieldFull}`}>
                            <label className={s.fieldLabel}>Informe / Resultado *</label>
                            <textarea className={`${s.fieldInput} ${s.fieldTextarea} ${s.fieldTextareaLg}`} value={examenForm.informe} onChange={e => setExamenForm(f => ({ ...f, informe: e.target.value }))} placeholder="Transcribir o resumir el informe..." />
                          </div>
                          <div className={`${s.fieldGroup} ${s.fieldFull}`}>
                            <label className={s.fieldLabel}>Link del estudio <span className={s.labelNote}>opcional</span></label>
                            <div className={s.examenLinkInput}>
                              <span className={s.examenLinkIcon}><Ic d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" size={14} /></span>
                              <input className={s.examenLinkField} value={examenForm.linkEstudio} onChange={e => setExamenForm(f => ({ ...f, linkEstudio: e.target.value }))} placeholder="https://..." />
                              {examenForm.linkEstudio && (
                                <button type="button" className={s.examenLinkOpenBtn} onClick={() => window.open(examenForm.linkEstudio, "_blank")}>
                                  <Ic d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={12} />Abrir
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className={s.formActions} style={{ paddingTop: ".75rem" }}>
                          <div />
                          <div className={s.formActionsRight}>
                            <button className={`${s.btn} ${s.btnGhost}`} onClick={() => setExamenForm(EXAMEN_VACIO)}>Limpiar</button>
                            <button className={`${s.btn} ${s.btnTeal}`} onClick={agregarExamen} disabled={saving || !examenForm.tipo || !examenForm.informe.trim()}>
                              <Ic d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8" size={14} />
                              {saving ? "Guardando..." : "Guardar examen"}
                            </button>
                          </div>
                        </div>
                      </div>
                      {examenes.length > 0 && (<>
                        <div className={s.fieldLabel} style={{ marginTop: ".5rem" }}>Exámenes cargados ({examenes.length})</div>
                        <div className={s.examenHistList}>
                          {examenes.map((ex, i) => (
                            <div key={i} className={s.examenHistItem}>
                              <div className={s.examenHistHeader}>
                                <span className={s.examenTipoBadge}>{TIPOS_EXAMEN.find(t => t.valor === ex.tipo)?.icono || "📋"} {ex.tipo}</span>
                                <span className={s.examenHistDate}>{fmtCorta(ex.fechaExamen)}</span>
                                {ex.medico && <span className={s.examenHistDoc}>{ex.medico}</span>}
                              </div>
                              <p className={s.examenHistText}>{ex.informe}</p>
                              {ex.linkEstudio && (
                                <a href={ex.linkEstudio} target="_blank" rel="noopener noreferrer" className={s.examenHistLink}>
                                  <Ic d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={12} />Ver imágenes
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </>)}
                    </>)
                  }
                </div>
              )}

              {/* ── Tab PENDIENTES ── */}
              {formTab === "pendientes" && (
                <div className={s.formBody} style={{ padding: 0 }}>
                  {!editId
                    ? <div className={s.alertNote} style={{ margin: "1rem" }}><Ic d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={14} />Guardá primero los datos básicos.</div>
                    : (<>
                      <div className={s.pendientesContainer}>
                        <div className={s.pendientesSectionHeader}>
                          <p className={s.pendientesSectionTitle}>Pendientes activos</p>
                          {pendientes.filter(p => !p.resuelto).length > 0 && <span className={s.pendientesCount}>{pendientes.filter(p => !p.resuelto).length}</span>}
                        </div>
                        {pendientes.filter(p => !p.resuelto).length === 0
                          ? (<div className={s.pendientesEmpty}>
                            <div className={s.pendientesEmptyIcon}>✓</div>
                            <p className={s.pendientesEmptyTitle}>Sin pendientes</p>
                            <p className={s.pendientesEmptyDesc}>No hay tareas pendientes.</p>
                          </div>)
                          : pendientes.filter(p => !p.resuelto).map((p) => {
                            const idx = pendientes.indexOf(p);
                            return (
                              <div key={idx} className={s.pendienteItem}>
                                <div className={s.pendienteCheckbox} style={{ cursor: "pointer" }} onClick={() => togglePendiente(idx, editId, pendientes)} />
                                <div className={s.pendienteContent}>
                                  <div className={s.pendienteHeader}>
                                    <span className={`${s.pendienteTipoBadge} ${p.tipo === "examen" ? s.pendienteBadgeExamen : p.tipo === "evolucion" ? s.pendienteBadgeEvol : s.pendienteBadgeAlerta}`}>{p.tipo}</span>
                                  </div>
                                  <p className={s.pendienteDescripcion}>{p.descripcion}</p>
                                  <div className={s.pendienteMeta}><span className={s.pendienteFecha}>{fmtTs(p.fechaCreacion)}</span></div>
                                </div>
                              </div>
                            );
                          })
                        }
                        {pendientes.filter(p => p.resuelto).length > 0 && (<>
                          <div className={s.pendientesSectionHeader}>
                            <p className={s.pendientesSectionTitle}>Resueltos</p>
                            <span style={{ fontSize: ".7rem", color: "var(--slate-400)" }}>{pendientes.filter(p => p.resuelto).length}</span>
                          </div>
                          {pendientes.filter(p => p.resuelto).map((p) => {
                            const idx = pendientes.indexOf(p);
                            return (
                              <div key={idx} className={s.pendienteItem} style={{ opacity: .6 }}>
                                <div className={`${s.pendienteCheckbox} ${s.pendienteCheckboxResuelto}`} style={{ cursor: "pointer" }} onClick={() => togglePendiente(idx, editId, pendientes)}>
                                  <Ic d="M20 6L9 17l-5-5" size={11} st2={{ color: "#fff" }} />
                                </div>
                                <div className={s.pendienteContent}>
                                  <p className={`${s.pendienteDescripcion} ${s.pendienteResueltoText}`}>{p.descripcion}</p>
                                  <div className={s.pendienteMeta}><span className={s.pendienteFecha} style={{ color: "var(--green-600)" }}>✓ {fmtTs(p.fechaResolucion)}</span></div>
                                </div>
                              </div>
                            );
                          })}
                        </>)}
                      </div>
                      <div className={s.pendienteNuevoForm}>
                        <select className={s.fieldInput} value={pendienteForm.tipo} onChange={e => setPendienteForm(f => ({ ...f, tipo: e.target.value }))} style={{ minWidth: 110, maxWidth: 140, flex: "none" }}>
                          <option value="examen">Examen</option>
                          <option value="evolucion">Evolución</option>
                          <option value="alerta">Alerta</option>
                          <option value="otro">Otro</option>
                        </select>
                        <input className={s.pendienteNuevoInput} value={pendienteForm.descripcion}
                          onChange={e => setPendienteForm(f => ({ ...f, descripcion: e.target.value }))}
                          onKeyDown={e => e.key === "Enter" && agregarPendiente()}
                          placeholder="Ej: Esperar resultado de TAC de tórax..." />
                        <button className={s.pendienteAddBtn} onClick={agregarPendiente} disabled={!pendienteForm.descripcion.trim() || saving}>
                          <Ic d="M12 5v14m-7-7h14" size={14} />Agregar
                        </button>
                      </div>
                    </>)
                  }
                </div>
              )}
            </div>
          )}

          {/* Mapa de camas — DESPUÉS del formulario */}
          <div className={s.contentPanel}>
            <div style={{ padding: ".75rem 1rem", borderBottom: "1.5px solid var(--slate-200)" }}>
              <span className={s.tableCount} style={{ padding: 0, border: "none", background: "none" }}>
                Mapa de camas — {st.activos}/{TOTAL_CAMAS} ocupadas
              </span>
            </div>
            <div style={{ padding: "1rem" }}>
              <div className={s.bedsGrid}>
                {Array.from({ length: TOTAL_CAMAS }, (_, i) => i + 1).map(num => {
                  const reg = camas[num];
                  const ocu = !!reg;
                  const sel = camaSelec === num && showForm;
                  const dias = ocu ? diasDesde(reg.fechaIngreso) : 0;
                  const pendActCama = ocu ? (reg.pendientesList || []).filter(p => !p.resuelto).length : 0;
                  return (
                    <div key={num}
                      className={`${s.bedCard} ${ocu ? s.bedOccupied : s.bedFree} ${sel ? s.bedSelected : ""}`}
                      onClick={() => ocu ? abrirEditar(reg) : abrirNuevo(num)}>
                      <div className={s.bedNum}>
                        <span className={s.bedNumLabel}>Cama</span>
                        <span className={s.bedNumValue}>{num}</span>
                      </div>
                      {ocu ? (
                        <div className={s.bedBody}>
                          <p className={s.bedName}>{reg.paciente}</p>
                          {reg.dni && <p className={s.bedDni}>DNI {reg.dni}</p>}
                          {reg.medicoIngreso && <p className={s.bedMedico}>Dr. {reg.medicoIngreso}</p>}
                          <div className={s.bedMeta}>
                            <span className={s.bedDaysBadge}><Ic d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={10} />{dias}d</span>
                            {reg.obraSocial && <span className={s.bedObraBadge}>{reg.obraSocial}</span>}
                            {pendActCama > 0 && <span className={s.bedPendientesBadge}>⏳ {pendActCama}</span>}
                          </div>
                        </div>
                      ) : (
                        <div className={s.bedBody}><p className={s.bedFreeLabel}>Disponible</p></div>
                      )}
                      <div className={s.bedFooter}>
                        <span className={`${s.bedStatusBadge} ${ocu ? s.badgeRed : s.badgeGreen}`}>{ocu ? "Ocupada" : "Libre"}</span>
                        {ocu && (
                          <button className={s.bedResumenBtn}
                            onClick={e => { e.stopPropagation(); setVerExpId(reg.id); setExpTab("evoluciones"); }}
                            title="Ver expediente">
                            <Ic d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ══════════════════ VISTA: LISTA ══════════════════ */}
      {vista === "lista" && (
        <div className={s.contentPanel}>
          <div className={s.filtersBar}>
            <div className={s.searchBox}>
              <Ic d="M21 21l-4.35-4.35m0 0A7 7 0 1 0 5.5 5.5a7 7 0 0 0 9.8 9.8z" size={15} st2={{ color: "var(--slate-400)" }} />
              <input className={s.searchInput} placeholder="Buscar por nombre, DNI, médico o cama..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className={s.searchClear} onClick={() => setSearch("")}><Ic d="M18 6L6 18M6 6l12 12" size={14} /></button>}
            </div>
            <div className={s.filterTabs}>
              {[["todos", "Todos"], ["activos", "Activos"], ["alta", "Con Alta"]].map(([v, l]) => (
                <button key={v} className={`${s.filterTab} ${filtroEstado === v ? s.filterTabActive : ""}`} onClick={() => setFiltroEstado(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className={s.tableCount}>{registrosFiltrados.length} paciente{registrosFiltrados.length !== 1 ? "s" : ""}</div>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Paciente / DNI</th><th>Cama</th><th>Ingreso</th><th>Días</th>
                  <th>Médico</th><th>Obra Social</th><th>Estado</th>
                  <th>Evol.</th><th>Exám.</th><th>Pend.</th><th></th>
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.length === 0 && <tr><td colSpan={11} className={s.noData}>No se encontraron pacientes.</td></tr>}
                {registrosFiltrados.map(r => {
                  const pA = (r.pendientesList || []).filter(p => !p.resuelto).length;
                  return (
                    <tr key={r.id}>
                      <td><div className={s.tdPaciente}>{r.paciente}</div>{r.dni && <div className={s.tdDni}>DNI {r.dni}</div>}</td>
                      <td><span style={{ fontWeight: 800, color: "var(--blue-600)" }}>{r.cama}</span></td>
                      <td className={s.tdFecha}>{fmtCorta(r.fechaIngreso)}</td>
                      <td>{diasDesde(r.fechaIngreso)}d</td>
                      <td>{r.medicoIngreso || "—"}</td>
                      <td>{r.obraSocial || "—"}</td>
                      <td><span className={`${s.estadoBadge} ${r.activo ? s.estadoActivo : s.estadoAlta}`}>{r.activo ? "Activo" : r.tipoAlta === "traslado" ? "Traslado" : "Alta"}</span></td>
                      <td className={s.tdEvos}>{r.evoluciones?.length || 0}</td>
                      <td className={s.tdEvos} style={{ color: "var(--teal-600)" }}>{r.examenesList?.length || 0}</td>
                      <td className={s.tdEvos} style={{ color: pA > 0 ? "var(--amber-600)" : "var(--slate-400)" }}>{pA}</td>
                      <td>
                        <div className={s.rowActions}>
                          {r.activo && <button className={s.rowBtn} onClick={() => { setVista("camas"); abrirEditar(r); }} title="Editar"><Ic d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" size={14} /></button>}
                          <button className={s.rowBtn} onClick={() => { setVerExpId(r.id); setExpTab("evoluciones"); }} title="Ver expediente"><Ic d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2" size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══════════════════ VISTA: TIMELINE ══════════════════ */}
      {vista === "timeline" && (
        <div className={s.contentPanel}>
          <div className={s.filtersBar}>
            <div className={s.searchBox}>
              <Ic d="M21 21l-4.35-4.35m0 0A7 7 0 1 0 5.5 5.5a7 7 0 0 0 9.8 9.8z" size={15} st2={{ color: "var(--slate-400)" }} />
              <input className={s.searchInput} placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className={s.searchClear} onClick={() => setSearch("")}><Ic d="M18 6L6 18M6 6l12 12" size={14} /></button>}
            </div>
          </div>
          {(() => {
            const q = search.toLowerCase();
            const items = [];
            registros.forEach(r => {
              if (q && !r.paciente?.toLowerCase().includes(q) && !r.dni?.includes(q)) return;
              (r.evoluciones || []).forEach(e => items.push({ tipo: "evol", fecha: e.fechaDoc, fechaReal: e.fechaReal, paciente: r.paciente, dni: r.dni, cama: r.cama, medico: e.medicoEvolucion, texto: e.texto }));
              (r.examenesList || []).forEach(ex => items.push({ tipo: "examen", fecha: ex.fechaExamen, fechaReal: ex.fechaCarga, paciente: r.paciente, dni: r.dni, cama: r.cama, medico: ex.medico, texto: ex.informe, tipoExamen: ex.tipo, link: ex.linkEstudio }));
            });
            items.sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
            return (<>
              <div className={s.timelineCount}><Ic d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={14} />{items.length} registro{items.length !== 1 ? "s" : ""}</div>
              <div className={s.timelineList}>
                {items.length === 0 && <p className={s.noData}>Sin registros.</p>}
                {items.map((it, i) => (
                  <div key={i} className={s.tlItem}>
                    <div className={`${s.tlDot} ${it.tipo === "examen" ? s.tlDotExamen : s.tlDotEvol}`} />
                    <div className={s.tlContent}>
                      <div className={s.tlMeta}><strong>{it.paciente}</strong>{it.dni ? ` — DNI ${it.dni}` : ""} · Cama {it.cama}</div>
                      <div className={s.tlFechas}>
                        <span className={s.tlFechaClinica}>{fmtCorta(it.fecha)}</span>
                        {it.tipo === "examen" && <span className={s.examenTipoBadge} style={{ fontSize: ".68rem" }}>{TIPOS_EXAMEN.find(t => t.valor === it.tipoExamen)?.icono || "📋"}</span>}

                      </div>
                      {it.medico && <div className={s.tlMeta}>Dr. {it.medico}</div>}
                      <p className={s.tlTexto}>{it.texto}</p>
                      {it.link && <a href={it.link} target="_blank" rel="noopener noreferrer" className={s.examenHistLink} style={{ marginTop: ".3rem" }}><Ic d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" size={11} />Ver estudio</a>}
                    </div>
                  </div>
                ))}
              </div>
            </>);
          })()}
        </div>
      )}

      {/* ══════════════════ VISTA: PENDIENTES GLOBALES ══════════════════ */}
      {vista === "pendientes" && (
        <div className={s.contentPanel}>
          <div className={s.filtersBar}>
            <div className={s.searchBox}>
              <Ic d="M21 21l-4.35-4.35m0 0A7 7 0 1 0 5.5 5.5a7 7 0 0 0 9.8 9.8z" size={15} st2={{ color: "var(--slate-400)" }} />
              <input className={s.searchInput} placeholder="Buscar por paciente o descripción..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button className={s.searchClear} onClick={() => setSearch("")}><Ic d="M18 6L6 18M6 6l12 12" size={14} /></button>}
            </div>
            <div className={s.filterTabs}>
              {[["todos", "Todos"], ["examen", "Exámenes"], ["evolucion", "Evoluciones"], ["alerta", "Alertas"], ["otro", "Otros"]].map(([v, l]) => (
                <button key={v} className={`${s.filterTab} ${filtroPTipo === v ? s.filterTabActive : ""}`} onClick={() => setFiltroPTipo(v)}>{l}</button>
              ))}
            </div>
          </div>
          <div className={s.timelineCount}>
            <Ic d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" size={14} />
            {todosPendientes.length} pendiente{todosPendientes.length !== 1 ? "s" : ""} activo{todosPendientes.length !== 1 ? "s" : ""}
          </div>
          {todosPendientes.length === 0
            ? (<div className={s.pendientesEmpty}>
              <div className={s.pendientesEmptyIcon}>✓</div>
              <p className={s.pendientesEmptyTitle}>Sin pendientes activos</p>
              <p className={s.pendientesEmptyDesc}>Todos los estudios y tareas están al día.</p>
            </div>)
            : (<div className={s.pendientesContainer}>
              {todosPendientes.map((p, i) => (
                <div key={i} className={s.pendienteItem}>
                  <div className={s.pendienteCheckbox} style={{ cursor: "pointer" }}
                    onClick={() => {
                      const idx = p._regPends.findIndex(x => x.descripcion === p.descripcion && x.fechaCreacion === p.fechaCreacion);
                      if (idx !== -1) togglePendiente(idx, p._regId, p._regPends);
                    }} />
                  <div className={s.pendienteContent}>
                    <div className={s.pendienteHeader}>
                      <span className={s.pendientePaciente}>{p.nombrePaciente}</span>
                      {p.dniPaciente && <span className={s.pendienteDni}>DNI {p.dniPaciente}</span>}
                      <span className={`${s.pendienteTipoBadge} ${p.tipo === "examen" ? s.pendienteBadgeExamen : p.tipo === "evolucion" ? s.pendienteBadgeEvol : s.pendienteBadgeAlerta}`}>{p.tipo}</span>
                      <span className={s.pendienteCama}>Cama {p.cama}</span>
                    </div>
                    <p className={s.pendienteDescripcion}>{p.descripcion}</p>
                    <div className={s.pendienteMeta}><span className={s.pendienteFecha}>{fmtTs(p.fechaCreacion)}</span></div>
                  </div>
                </div>
              ))}
            </div>)
          }
        </div>
      )}

      {/* ══════════════════ MODAL ALTA / TRASLADO ══════════════════ */}
      {altaModal && (
        <div className={s.modalOverlay}>
          <div className={s.modalContainer}>
            <div className={`${s.modalHeader} ${altaModal.tipo === "alta" ? s.modalHeaderAlta : s.modalHeaderTraslado}`}>
              <div className={s.modalHeaderLeft}>
                <Ic d={altaModal.tipo === "alta" ? "M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" : "M5 12h14m-7-7 7 7-7 7"} size={20} />
                {altaModal.tipo === "alta" ? "Dar Alta Médica" : "Registrar Traslado"}
              </div>
            </div>
            <div className={s.modalBody}>
              <div className={s.pacienteInfo}>
                <div className={s.pacienteInfoIcon}><Ic d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" size={20} /></div>
                <div>
                  <p className={s.pacienteInfoNombre}>{altaModal.paciente}</p>
                  <p className={s.pacienteInfoSub}>{altaModal.tipo === "alta" ? "Se dará el alta médica." : "Se registrará un traslado."}</p>
                </div>
              </div>
              {altaError && <div className={s.errorMessage}><Ic d="M12 8v4m0 4h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" size={16} />{altaError}</div>}
              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>Médico que da el alta *</label>
                <input className={s.fieldInput} value={altaForm.medico} onChange={e => setAltaForm(f => ({ ...f, medico: e.target.value }))} placeholder="Dr. ..." />
              </div>
              <div className={s.fieldGroup}>
                <label className={s.fieldLabel}>{altaModal.tipo === "alta" ? "Motivo del alta *" : "Destino del traslado *"}</label>
                <textarea className={`${s.fieldInput} ${s.fieldTextarea}`} value={altaForm.motivo} onChange={e => setAltaForm(f => ({ ...f, motivo: e.target.value }))} placeholder={altaModal.tipo === "alta" ? "Alta médica / mejoría..." : "Hospital destino..."} />
              </div>
            </div>
            <div style={{ padding: "1rem 1.5rem", borderTop: "1.5px solid var(--slate-200)", display: "flex", justifyContent: "flex-end", gap: ".75rem", flexWrap: "wrap" }}>
              <button className={s.btnSecondary} onClick={() => { setAltaModal(null); setAltaForm({ medico: "", motivo: "" }); setAltaError(""); }}>Cancelar</button>
              <button className={`${s.btnPrimary} ${altaModal.tipo === "alta" ? s.btnAlta : s.btnTraslado}`} onClick={confirmarAlta} disabled={altaLoading}>
                {altaLoading ? "Guardando..." : altaModal.tipo === "alta" ? "Confirmar Alta" : "Confirmar Traslado"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
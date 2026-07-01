"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, push, onValue, off, update, remove } from "firebase/database";
import styles from "./medicos.module.css"; // Asegurate de tener el CSS con tema oscuro y estilos de tarjetas

// ═══════════════════════════════════════════════════════════
//  HELPERS (importados del original MedicosAdminPage)
// ═══════════════════════════════════════════════════════════
const cleanValue = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

const splitProfessionalName = (value, fallbackTitle = "Dr.") => {
  const fullName = cleanValue(value);
  const match = fullName.match(/^(Dr\.?|Dra\.?)\s*(.*)$/i);
  if (!match) {
    return {
      titulo: fallbackTitle,
      nombre: fullName,
      completo: fullName ? `${fallbackTitle} ${fullName}`.trim() : "",
    };
  }
  const titulo = match[1].toLowerCase().startsWith("dra") ? "Dra." : "Dr.";
  const nombre = cleanValue(match[2]);
  return {
    titulo,
    nombre,
    completo: nombre ? `${titulo} ${nombre}` : titulo,
  };
};

const joinProfessionalName = (titulo, nombre) => {
  const cleanName = cleanValue(nombre).replace(/^(Dr\.?|Dra\.?)\s*/i, "");
  return cleanName ? `${titulo || "Dr."} ${cleanName}`.trim() : "";
};

const parseCx = (cx) => {
  const emptyResult = { preoperatorio: "", posoperatorio: "", procedimientoqx: "", hallazgos: "" };
  if (typeof cx !== "string" || !cx.trim()) return emptyResult;
  const normalizedCx = cx.replace(/\r\n?/g, "\n").trim();
  // … (misma lógica de parseo que tenías, la incluyo resumida)
  const labeledSections = [
    ["preoperatorio", /(?:^|\n)\s*(?:1[.)-]?\s*)?Diagn[oó]stico\s+Preoperatorio\s*:?\s*/i],
    ["posoperatorio", /(?:^|\n)\s*(?:2[.)-]?\s*)?Diagn[oó]stico\s+Posoperatorio\s*:?\s*/i],
    ["procedimientoqx", /(?:^|\n)\s*(?:3[.)-]?\s*)?Procedimiento\s+Quir[uú]rgico\s*:?\s*/i],
    ["hallazgos", /(?:^|\n)\s*(?:4[.)-]?\s*)?(?:Operaci[oó]n\s+y\s+)?Hallazgos\s*:?\s*/i],
  ];
  const labeledMatches = labeledSections
    .map(([key, regex]) => { const match = regex.exec(normalizedCx); return match ? { key, index: match.index, contentStart: match.index + match[0].length } : null; })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
  if (labeledMatches.length > 0) {
    const result = { ...emptyResult };
    labeledMatches.forEach((match, index) => {
      const next = labeledMatches[index + 1];
      result[match.key] = normalizedCx.slice(match.contentStart, next ? next.index : normalizedCx.length).trim();
    });
    return result;
  }
  // fallback
  return { ...emptyResult, procedimientoqx: normalizedCx };
};

const normalizeRegistro = (raw = {}, id = raw.id, dbPath = raw._dbPath || `fojaqx/${id}`) => {
  const paciente = raw.paciente || {};
  const equipo = raw.equipo || {};
  const fecha = raw.fecha || {};
  const horario = raw.horario || {};
  const descripcion = raw.descripcion || raw.templateData || {};
  const cxFields = parseCx(raw.cx);
  const professional = splitProfessionalName(
    equipo.cirujano || raw.cirujano,
    raw.cirujanoTitulo || equipo.cirujanoTitulo || "Dr."
  );
  return {
    ...raw,
    id,
    _dbPath: dbPath,
    _type: "record",
    apelidoynombre: cleanValue(raw.apelidoynombre || paciente.apelidoynombre),
    edad: cleanValue(raw.edad || paciente.edad),
    cirujanoTitulo: raw.cirujanoTitulo || equipo.cirujanoTitulo || professional.titulo,
    cirujanoNombre: cleanValue(raw.cirujanoNombre || professional.nombre),
    cirujano: professional.completo,
    primerayudante: cleanValue(raw.primerayudante || equipo.primerayudante),
    segundoayudante: cleanValue(raw.segundoayudante || equipo.segundoayudante),
    anestesista: cleanValue(raw.anestesista || equipo.anestesista),
    dia: cleanValue(raw.dia || fecha.dia),
    mes: cleanValue(raw.mes || fecha.mes),
    anio: cleanValue(raw.anio || fecha.anio),
    inichsinicio: cleanValue(raw.inichsinicio || horario.inicio),
    hsfin: cleanValue(raw.hsfin || horario.fin),
    preoperatorio: cleanValue(raw.preoperatorio || descripcion.preoperatorio || cxFields.preoperatorio),
    posoperatorio: cleanValue(raw.posoperatorio || descripcion.posoperatorio || cxFields.posoperatorio),
    procedimientoqx: cleanValue(raw.procedimientoqx || descripcion.procedimientoqx || cxFields.procedimientoqx),
    hallazgos: cleanValue(raw.hallazgos || descripcion.hallazgos || cxFields.hallazgos),
    timestamp: raw.timestamp || raw.createdAt || raw.updatedAt || 0,
  };
};

const normalizeTemplate = (raw = {}, id = raw.id, dbPath = raw._dbPath || `fojaqx/plantillas/${id}`) => {
  const source = raw.templateData || raw.formData || raw || {};
  const professional = splitProfessionalName(source.cirujano || raw.cirujano, source.cirujanoTitulo || raw.cirujanoTitulo || "Dr.");
  return {
    ...raw,
    ...source,
    id,
    _dbPath: dbPath,
    _type: "template",
    templateName: cleanValue(raw.name || raw.nombre || source.name || "Plantilla sin nombre"),
    cirujanoTitulo: professional.titulo,
    cirujanoNombre: professional.nombre,
    cirujano: professional.completo,
    preoperatorio: cleanValue(source.preoperatorio || raw.preoperatorio),
    posoperatorio: cleanValue(source.posoperatorio || raw.posoperatorio),
    procedimientoqx: cleanValue(source.procedimientoqx || raw.procedimientoqx),
    hallazgos: cleanValue(source.hallazgos || raw.hallazgos),
    timestamp: raw.timestamp || raw.createdAt || raw.updatedAt || 0,
  };
};

const formatDate = (dia, mes, anio) => dia && mes && anio ? `${dia} ${mes} ${anio}` : "Sin fecha";
const formatTime = (inicio, fin) => (!inicio && !fin ? null : [inicio, fin].filter(Boolean).join(" – "));

const buildCx = (reg) => {
  const n = normalizeRegistro(reg);
  return [
    `1. Diagnóstico Preoperatorio: ${n.preoperatorio}`,
    `2. Diagnóstico Posoperatorio: ${n.posoperatorio}`,
    `3. Procedimiento Quirúrgico: ${n.procedimientoqx}`,
    `4. Operación y Hallazgos: ${n.hallazgos}`,
  ].join("\n\n");
};

const buildPdfPayload = (reg) => {
  const n = normalizeRegistro(reg);
  return {
    paciente: { apelidoynombre: n.apelidoynombre, edad: n.edad },
    equipo: {
      cirujano: n.cirujano,
      primerayudante: n.primerayudante,
      segundoayudante: n.segundoayudante,
      anestesista: n.anestesista,
    },
    fecha: { dia: n.dia, mes: n.mes, anio: n.anio },
    horario: { inicio: n.inichsinicio, fin: n.hsfin },
    descripcion: {
      preoperatorio: n.preoperatorio,
      posoperatorio: n.posoperatorio,
      procedimientoqx: n.procedimientoqx,
      hallazgos: n.hallazgos,
    },
    cx: buildCx(n),
  };
};

const buildFileName = (reg) => {
  const n = normalizeRegistro(reg);
  const apellido = n.apelidoynombre ? n.apelidoynombre.split(",")[0].trim().replace(/\s+/g, "_") : "foja";
  const fecha = [n.dia, n.mes, n.anio].filter(Boolean).join("-");
  return `FojaQX_${apellido}${fecha ? `_${fecha}` : ""}.pdf`;
};

// ═══════════════════════════════════════════════════════════
//  ICONOS SVG
// ═══════════════════════════════════════════════════════════
const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);
const EditIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);
const EyeIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);
const TrashIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);
const ChevronIcon = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.22s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const TemplateIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

// ═══════════════════════════════════════════════════════════
//  COMPONENTES DE TARJETA Y MODALES (adaptados del original)
// ═══════════════════════════════════════════════════════════
function RegistroCard({ reg, onEdit, onDelete, onToast }) {
  const registro = normalizeRegistro(reg);
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [viewing, setViewing] = useState(false);

  const requestPdf = async () => {
    const payload = buildPdfPayload(reg);
    const fileName = buildFileName(reg);
    const res = await fetch("/api/fojaqx/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, fileName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return { blob: await res.blob(), fileName };
  };

  const handleView = async () => {
    const previewWindow = window.open("", "_blank");
    if (!previewWindow) { onToast?.("✕ Permití las ventanas emergentes para ver el PDF"); return; }
    previewWindow.document.title = "Generando vista previa…";
    previewWindow.document.body.innerHTML = `<div style="font-family:system-ui,sans-serif;padding:32px;text-align:center;color:#44534d">Generando vista previa del PDF…</div>`;
    setViewing(true);
    try {
      const { blob } = await requestPdf();
      const url = URL.createObjectURL(blob);
      previewWindow.location.replace(url);
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      previewWindow.close();
      onToast?.("✕ No se pudo abrir la vista previa");
    } finally { setViewing(false); }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const { blob, fileName } = await requestPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onToast?.("✓ Foja descargada");
    } catch (err) { onToast?.("✕ No se pudo generar el PDF"); }
    finally { setDownloading(false); }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardStripe} />
      <div className={styles.cardInner}>
        <div className={styles.cardTop}>
          <div>
            <h3 className={styles.patientName}>{registro.apelidoynombre}</h3>
            <p className={styles.cardDate}>{formatDate(registro.dia, registro.mes, registro.anio)}</p>
          </div>
          {registro.edad && <span className={styles.ageTag}>{registro.edad} años</span>}
        </div>
        <div className={styles.cardPills}>
          {registro.cirujano && <span className={styles.pill}><span className={styles.pillDot} />{registro.cirujano}</span>}
          {registro.anestesista && <span className={styles.pill}><span className={`${styles.pillDot} ${styles.pillDotGold}`} />{registro.anestesista}</span>}
          {formatTime(registro.inichsinicio, registro.hsfin) && <span className={styles.pill}>🕐 {formatTime(registro.inichsinicio, registro.hsfin)}</span>}
        </div>
        {!expanded && registro.procedimientoqx && <p className={styles.cardCollapsed}>{registro.procedimientoqx}</p>}
        {expanded && (
          <div className={styles.expandedRow}>
            {registro.preoperatorio && <div className={styles.expandedField}><span className={styles.expandedLabel}>Preoperatorio</span><span className={styles.expandedValue}>{registro.preoperatorio}</span></div>}
            {registro.posoperatorio && <div className={styles.expandedField}><span className={styles.expandedLabel}>Posoperatorio</span><span className={styles.expandedValue}>{registro.posoperatorio}</span></div>}
            {registro.procedimientoqx && <div className={`${styles.expandedField} ${styles.expandedFieldFull}`}><span className={styles.expandedLabel}>Procedimiento quirúrgico</span><span className={styles.expandedValue}>{registro.procedimientoqx}</span></div>}
            {registro.hallazgos && <div className={`${styles.expandedField} ${styles.expandedFieldFull}`}><span className={styles.expandedLabel}>Hallazgos</span><span className={styles.expandedValue}>{registro.hallazgos}</span></div>}
            {(registro.primerayudante || registro.segundoayudante) && <div className={styles.expandedField}><span className={styles.expandedLabel}>Ayudantes</span><span className={styles.expandedValue}>{[registro.primerayudante, registro.segundoayudante].filter(Boolean).join(", ")}</span></div>}
          </div>
        )}
        <div className={styles.cardFooter}>
          <button className={styles.btnToggle} onClick={() => setExpanded(v => !v)}>
            {expanded ? "Ver menos" : "Ver más"} <ChevronIcon open={expanded} />
          </button>
          <div className={styles.cardActions}>
            <button className={styles.btnDownload} onClick={handleView} disabled={viewing || downloading}>
              {viewing ? <><span className={styles.btnSpinnerDark} /> Abriendo…</> : <><EyeIcon /> Ver</>}
            </button>
            <button className={styles.btnDownload} onClick={handleDownload} disabled={downloading}>
              {downloading ? <><span className={styles.btnSpinnerDark} /> Generando…</> : <><DownloadIcon /> Foja</>}
            </button>
            <button className={styles.btnEdit} onClick={() => onEdit(reg)}>
              <EditIcon /> Editar
            </button>
            <button className={styles.btnEdit} style={{ background: "#b91c1c" }} onClick={() => onDelete(reg)}>
              <TrashIcon />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TemplateCard({ template, onEdit, onDelete, onLoad }) {
  const [expanded, setExpanded] = useState(false);
  const hasDescription = Boolean(template.preoperatorio || template.posoperatorio || template.procedimientoqx || template.hallazgos);
  return (
    <article className={`${styles.card} ${styles.templateCard}`}>
      <div className={styles.templateStripe} />
      <div className={styles.cardInner}>
        <div className={styles.templateTop}>
          <div className={styles.templateIcon} aria-hidden="true"><TemplateIcon /></div>
          <div className={styles.templateHeading}>
            <span className={styles.templateBadge}>Plantilla quirúrgica</span>
            <h3 className={styles.templateName}>{template.templateName}</h3>
            <p className={styles.templateSubtitle}>Datos reutilizables para completar una nueva foja</p>
          </div>
        </div>
        <div className={styles.cardPills}>
          {template.cirujano && <span className={styles.pill}><span className={styles.pillDot} />{template.cirujano}</span>}
          <span className={`${styles.pill} ${styles.templatePill}`}>Sin datos de paciente</span>
        </div>
        {!expanded && (
          <div className={styles.templateSummary}>
            <span className={styles.templateSummaryLabel}>Procedimiento</span>
            <p className={styles.cardCollapsed}>{template.procedimientoqx || template.preoperatorio || "Esta plantilla todavía no tiene una descripción cargada."}</p>
          </div>
        )}
        {expanded && (
          <div className={styles.expandedRow}>
            {template.preoperatorio && <div className={styles.expandedField}><span className={styles.expandedLabel}>Preoperatorio</span><span className={styles.expandedValue}>{template.preoperatorio}</span></div>}
            {template.posoperatorio && <div className={styles.expandedField}><span className={styles.expandedLabel}>Posoperatorio</span><span className={styles.expandedValue}>{template.posoperatorio}</span></div>}
            {template.procedimientoqx && <div className={`${styles.expandedField} ${styles.expandedFieldFull}`}><span className={styles.expandedLabel}>Procedimiento quirúrgico</span><span className={styles.expandedValue}>{template.procedimientoqx}</span></div>}
            {template.hallazgos && <div className={`${styles.expandedField} ${styles.expandedFieldFull}`}><span className={styles.expandedLabel}>Hallazgos</span><span className={styles.expandedValue}>{template.hallazgos}</span></div>}
            {!hasDescription && <div className={styles.templateEmptyState}>No hay datos de descripción quirúrgica en esta plantilla.</div>}
          </div>
        )}
        <div className={styles.cardFooter}>
          <button className={styles.btnToggle} onClick={() => setExpanded(v => !v)}>
            {expanded ? "Ocultar datos" : "Ver contenido"} <ChevronIcon open={expanded} />
          </button>
          <div className={styles.cardActions}>
            <button className={styles.btnSecondary} onClick={() => onLoad(template)}>Usar en nueva foja</button>
            <button className={styles.btnEdit} onClick={() => onEdit(template)}><EditIcon /></button>
            <button className={styles.btnEdit} style={{ background: "#b91c1c" }} onClick={() => onDelete(template)}><TrashIcon /></button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ConfirmDeleteModal({ registro, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
        <div className={styles.confirmIcon}><TrashIcon /></div>
        <h3 className={styles.confirmTitle}>{registro._type === "template" ? "Eliminar plantilla" : "Eliminar foja"}</h3>
        <p className={styles.confirmText}>¿Seguro que querés eliminar <strong>{registro._type === "template" ? `la plantilla "${registro.templateName}"` : `la foja de ${registro.apelidoynombre || "este paciente"}`}</strong>? Esta acción no se puede deshacer.</p>
        <div className={styles.confirmActions}>
          <button className={styles.btnCancel} onClick={onClose} disabled={deleting}>Cancelar</button>
          <button className={styles.btnDangerSolid} onClick={async () => { setDeleting(true); await onConfirm(); }} disabled={deleting}>
            {deleting ? <><span className={styles.btnSpinner} /> Eliminando…</> : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// Modal de edición de foja (similar al original, simplificado para adaptarse)
function EditFojaModal({ registro, onClose, onSaved }) {
  const initial = normalizeRegistro(registro);
  const [form, setForm] = useState({ ...initial, cirujano: initial.cirujanoNombre });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleChange = (e) => { const { name, value } = e.target; setForm(prev => ({ ...prev, [name]: value })); };

  const handleSave = async () => {
    setSaving(true); setErrorMsg("");
    try {
      const refPath = registro._dbPath || `fojaqx/${registro.id}`;
      const registroRef = ref(db, refPath);
      const { id, timestamp, cirujanoNombre, ...rest } = form;
      const cirujanoCompleto = joinProfessionalName(form.cirujanoTitulo, form.cirujano);
      const datosActualizados = { ...rest, cirujano: cirujanoCompleto, cirujanoTitulo: form.cirujanoTitulo || "Dr." };
      await update(registroRef, {
        ...datosActualizados,
        equipo: {
          cirujano: cirujanoCompleto,
          cirujanoTitulo: form.cirujanoTitulo || "Dr.",
          anestesista: form.anestesista || "",
          primerayudante: form.primerayudante || "",
          segundoayudante: form.segundoayudante || "",
        },
        descripcion: {
          preoperatorio: form.preoperatorio || "",
          posoperatorio: form.posoperatorio || "",
          procedimientoqx: form.procedimientoqx || "",
          hallazgos: form.hallazgos || "",
        },
        cx: buildCx(datosActualizados),
        updatedAt: new Date().toISOString(),
      });
      onSaved();
      onClose();
    } catch (err) { setErrorMsg("Error al actualizar: " + err.message); }
    finally { setSaving(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHandle}><div className={styles.modalHandleBar} /></div>
        <div className={styles.modalHeader}>
          <div className={styles.modalAccent} />
          <h2 className={styles.modalTitle}>Editar Foja Quirúrgica</h2>
          <p className={styles.modalSubtitle}>{form.apelidoynombre || "Paciente"}</p>
        </div>
        <div className={styles.modalBody}>
          {errorMsg && <div className={styles.modalError}>⚠ {errorMsg}</div>}
          {/* Paciente */}
          <div className={styles.modalSection}>
            <p className={styles.modalSectionTitle}>Paciente</p>
            <div className={styles.modalGrid2}>
              <div className={styles.modalFieldFull}><label className={styles.modalLabel}>Apellido y Nombre</label><input name="apelidoynombre" value={form.apelidoynombre || ""} onChange={handleChange} className={styles.modalInput} /></div>
              <div className={styles.modalField}><label className={styles.modalLabel}>Edad</label><input name="edad" type="number" value={form.edad || ""} onChange={handleChange} className={styles.modalInput} /></div>
            </div>
          </div>
          {/* Equipo */}
          <div className={styles.modalSection}>
            <p className={styles.modalSectionTitle}>Equipo Quirúrgico</p>
            <div className={styles.modalGrid2}>
              <div className={styles.modalField}><label className={styles.modalLabel}>Tratamiento</label><select name="cirujanoTitulo" value={form.cirujanoTitulo || "Dr."} onChange={handleChange} className={styles.modalSelect}><option value="Dr.">Dr.</option><option value="Dra.">Dra.</option></select></div>
              <div className={styles.modalField}><label className={styles.modalLabel}>Cirujano</label><input name="cirujano" value={form.cirujano || ""} onChange={handleChange} className={styles.modalInput} placeholder="Apellido y nombre" /></div>
              <div className={styles.modalField}><label className={styles.modalLabel}>Anestesista</label><input name="anestesista" value={form.anestesista || ""} onChange={handleChange} className={styles.modalInput} /></div>
              <div className={styles.modalField}><label className={styles.modalLabel}>1er Ayudante</label><input name="primerayudante" value={form.primerayudante || ""} onChange={handleChange} className={styles.modalInput} /></div>
              <div className={styles.modalField}><label className={styles.modalLabel}>2do Ayudante</label><input name="segundoayudante" value={form.segundoayudante || ""} onChange={handleChange} className={styles.modalInput} /></div>
            </div>
          </div>
          {/* Fecha y Horario */}
          <div className={styles.modalSection}>
            <p className={styles.modalSectionTitle}>Fecha y Horarios</p>
            <div className={styles.modalGrid3}>
              <div className={styles.modalField}><label className={styles.modalLabel}>Día</label><input name="dia" type="number" min="1" max="31" value={form.dia || ""} onChange={handleChange} className={styles.modalInput} /></div>
              <div className={styles.modalField}><label className={styles.modalLabel}>Mes</label><input name="mes" value={form.mes || ""} onChange={handleChange} className={styles.modalInput} /></div>
              <div className={styles.modalField}><label className={styles.modalLabel}>Año</label><input name="anio" type="number" value={form.anio || ""} onChange={handleChange} className={styles.modalInput} /></div>
            </div>
            <div className={styles.modalGrid2}>
              <div className={styles.modalField}><label className={styles.modalLabel}>Hora inicio</label><input name="inichsinicio" type="time" value={form.inichsinicio || ""} onChange={handleChange} className={styles.modalInput} /></div>
              <div className={styles.modalField}><label className={styles.modalLabel}>Hora fin</label><input name="hsfin" type="time" value={form.hsfin || ""} onChange={handleChange} className={styles.modalInput} /></div>
            </div>
          </div>
          {/* Descripción */}
          <div className={styles.modalSection}>
            <p className={styles.modalSectionTitle}>Descripción Quirúrgica</p>
            <div className={styles.modalFieldFull}><label className={styles.modalLabel}>Diagnóstico Preoperatorio</label><textarea name="preoperatorio" rows="2" value={form.preoperatorio || ""} onChange={handleChange} className={styles.modalTextarea} /></div>
            <div className={styles.modalField}><label className={styles.modalLabel}>Diagnóstico Posoperatorio</label><textarea name="posoperatorio" rows="2" value={form.posoperatorio || ""} onChange={handleChange} className={styles.modalTextarea} /></div>
            <div className={styles.modalField}><label className={styles.modalLabel}>Procedimiento Quirúrgico</label><textarea name="procedimientoqx" rows="3" value={form.procedimientoqx || ""} onChange={handleChange} className={styles.modalTextarea} /></div>
            <div className={styles.modalField}><label className={styles.modalLabel}>Hallazgos</label><textarea name="hallazgos" rows="2" value={form.hallazgos || ""} onChange={handleChange} className={styles.modalTextarea} /></div>
          </div>
        </div>
        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnSave} onClick={handleSave} disabled={saving}>{saving ? <><span className={styles.btnSpinner} /> Guardando…</> : "✓ Guardar cambios"}</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PESTAÑAS DE GESTIÓN (se usan dentro del componente principal)
// ═══════════════════════════════════════════════════════════

function FojasGuardadasTab({ fojas, onEdit, onDelete, onToast, searchTerm, setSearchTerm }) {
  const filtered = fojas.filter(foja => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return [foja.apelidoynombre, foja.cirujano, foja.procedimientoqx].some(val => val && val.toLowerCase().includes(term));
  });

  return (
    <div>
      <div className={styles.searchWrapper} style={{ marginBottom: "1rem" }}>
        <span className={styles.searchIcon}><SearchIcon /></span>
        <input type="search" placeholder="Buscar en fojas..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.searchInput} />
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📂</div>
          <p className={styles.emptyText}>No se encontraron fojas</p>
          <p className={styles.emptyHint}>Probá con otros términos o creá una nueva.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((foja, i) => (
            <div key={foja.id} style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}>
              <RegistroCard reg={foja} onEdit={onEdit} onDelete={onDelete} onToast={onToast} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlantillasTab({ plantillas, onEdit, onDelete, onLoad, searchTerm, setSearchTerm }) {
  const filtered = plantillas.filter(p => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return [p.templateName, p.cirujano, p.procedimientoqx].some(val => val && val.toLowerCase().includes(term));
  });

  return (
    <div>
      <div className={styles.searchWrapper} style={{ marginBottom: "1rem" }}>
        <span className={styles.searchIcon}><SearchIcon /></span>
        <input type="search" placeholder="Buscar plantilla..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className={styles.searchInput} />
      </div>
      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <p className={styles.emptyText}>No se encontraron plantillas</p>
          <p className={styles.emptyHint}>{searchTerm ? "Probá con otros términos." : "Podés guardar una foja como plantilla desde la pestaña Nueva Foja."}</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((p, i) => (
            <div key={p.id} style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}>
              <TemplateCard template={p} onEdit={onEdit} onDelete={onDelete} onLoad={onLoad} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function FojaAdminPage() {
  const router = useRouter();
  const [view, setView] = useState("nueva"); // "nueva" | "guardadas" | "plantillas"
  const [form, setForm] = useState({
    apelidoynombre: "", edad: "",
    cirujanoTitulo: "Dr.", cirujano: "",
    primerayudante: "", segundoayudante: "",
    anestesista: "",
    dia: "", mes: "", anio: "",
    inichsinicio: "", hsfin: "",
    preoperatorio: "", posoperatorio: "",
    procedimientoqx: "", hallazgos: "",
  });
  const [saveStatus, setSaveStatus] = useState("idle");
  const [pdfStatus, setPdfStatus] = useState("idle");
  const [savedKey, setSavedKey] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const pdfUrlRef = useRef(null);

  // Datos desde Firebase
  const [fojas, setFojas] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [toast, setToast] = useState("");

  // Estados de gestión (editar, eliminar)
  const [editingRegistro, setEditingRegistro] = useState(null);
  const [deletingRegistro, setDeletingRegistro] = useState(null);

  // Búsqueda independiente por pestaña
  const [searchFojas, setSearchFojas] = useState("");
  const [searchPlantillas, setSearchPlantillas] = useState("");

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  // ── Carga inicial de datos ──
  useEffect(() => {
    const fojaRef = ref(db, "fojaqx");
    const unsubscribe = onValue(fojaRef, (snapshot) => {
      const data = snapshot.val();
      const fojasList = [];
      const plantillasList = [];
      if (data) {
        // Procesar fojas
        Object.entries(data).forEach(([key, value]) => {
          if (!value || typeof value !== "object") return;
          if (key === "plantilla" || key === "plantillas") {
            // si hay nodo plantilla o plantillas los tratamos como templates
            if (key === "plantilla" || key === "plantillas") {
              const templates = value;
              if (templates && typeof templates === "object") {
                Object.entries(templates).forEach(([id, t]) => {
                  plantillasList.push(normalizeTemplate(t, id, `fojaqx/${key}/${id}`));
                });
              }
            }
          } else if (value.paciente || value.apelidoynombre || value.cx || value.descripcion || value.equipo) {
            // es una foja
            fojasList.push(normalizeRegistro(value, key, `fojaqx/${key}`));
          } else if (value.name || value.templateData) {
            // posible plantilla en nodo raíz
            plantillasList.push(normalizeTemplate(value, key, `fojaqx/${key}`));
          }
        });
        // Si existe nodo registros, agregar sus fojas
        if (data.registros) {
          Object.entries(data.registros).forEach(([id, value]) => {
            fojasList.push(normalizeRegistro(value, id, `fojaqx/registros/${id}`));
          });
        }
      }
      setFojas(fojasList.sort((a, b) => (b.timestamp - a.timestamp)));
      setPlantillas(plantillasList.sort((a, b) => (b.timestamp - a.timestamp)));
      setLoadingData(false);
    }, (err) => { setErrorMsg("Error al cargar datos."); setLoadingData(false); });
    return () => off(fojaRef);
  }, []);

  // ── Funciones de gestión ──
  const handleDelete = async () => {
    if (!deletingRegistro) return;
    try {
      await remove(ref(db, deletingRegistro._dbPath));
      showToast(deletingRegistro._type === "template" ? "✓ Plantilla eliminada" : "✓ Foja eliminada");
    } catch { showToast("✕ No se pudo eliminar"); }
    finally { setDeletingRegistro(null); }
  };

  const handleLoadTemplate = (template) => {
    // Cargar datos de plantilla en el formulario de nueva foja
    setForm(prev => ({
      ...prev,
      cirujanoTitulo: template.cirujanoTitulo || "Dr.",
      cirujano: template.cirujanoNombre || "",
      preoperatorio: template.preoperatorio || "",
      posoperatorio: template.posoperatorio || "",
      procedimientoqx: template.procedimientoqx || "",
      hallazgos: template.hallazgos || "",
    }));
    setView("nueva");
    showToast("✓ Plantilla cargada en el formulario");
  };

  const handleEditTemplate = (template) => {
    // Editar plantilla: abrimos modal de edición (reutilizamos EditFojaModal pero con _type template)
    // Para simplificar, usamos el mismo modal de foja pero con lógica adaptada.
    // En una implementación real, conviene un modal específico, pero podemos reusar el existente.
    setEditingRegistro(template);
  };

  // ── Lógica de creación de foja (similar a la anterior) ──
  const resetPdfState = useCallback(() => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    setPdfUrl(null);
    setPdfFileName(null);
    setPdfStatus("idle");
    pdfUrlRef.current = null;
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (saveStatus === "saved") { setSaveStatus("idle"); setSavedKey(null); resetPdfState(); }
  };

  const buildCxForm = () => {
    const secciones = [
      { etiqueta: "1. Diagnóstico Preoperatorio", valor: form.preoperatorio },
      { etiqueta: "2. Diagnóstico Posoperatorio", valor: form.posoperatorio },
      { etiqueta: "3. Procedimiento Quirúrgico", valor: form.procedimientoqx },
      { etiqueta: "4. Operación y Hallazgos", valor: form.hallazgos },
    ];
    return secciones.filter(s => s.valor.trim()).map(s => `${s.etiqueta}: ${s.valor.trim()}`).join("\n\n");
  };

  const generarPDF = useCallback(async () => {
    setPdfStatus("loading");
    setErrorMsg("");
    try {
      const payload = buildPdfPayload(form);
      const fileName = buildFileName(form);
      const res = await fetch("/api/fojaqx/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, fileName }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url); setPdfFileName(fileName); pdfUrlRef.current = url; setPdfStatus("done");
    } catch (err) { setPdfStatus("error"); setErrorMsg(err.message || "Error al generar el PDF."); }
  }, [form]);

  const handleGuardar = async (e) => {
    e.preventDefault();
    const required = ["apelidoynombre", "edad", "cirujano", "anestesista", "dia", "mes", "anio", "inichsinicio", "hsfin", "preoperatorio", "procedimientoqx"];
    for (const field of required) {
      if (!form[field]) { setErrorMsg(`Completá ${field}`); setSaveStatus("error"); return; }
    }
    setSaveStatus("saving"); setErrorMsg(""); resetPdfState();
    try {
      const cirujanoCompleto = joinProfessionalName(form.cirujanoTitulo, form.cirujano);
      const fojaRef = ref(db, "fojaqx");
      const snap = await push(fojaRef, {
        ...buildPdfPayload({ ...form, cirujano: cirujanoCompleto }),
        timestamp: new Date().toISOString(),
      });
      setSavedKey(snap.key); setSaveStatus("saved");
      await generarPDF();
    } catch (err) { setSaveStatus("error"); setErrorMsg(err.message || "Error al guardar."); }
  };

  const handleLimpiar = () => {
    setForm({
      apelidoynombre: "", edad: "",
      cirujanoTitulo: "Dr.", cirujano: "",
      primerayudante: "", segundoayudante: "", anestesista: "",
      dia: "", mes: "", anio: "", inichsinicio: "", hsfin: "",
      preoperatorio: "", posoperatorio: "", procedimientoqx: "", hallazgos: "",
    });
    setSaveStatus("idle"); setPdfStatus("idle"); setSavedKey(null); setErrorMsg(""); resetPdfState();
  };

  const saveTemplate = async () => {
    const name = prompt("Nombre de la plantilla:");
    if (!name) return;
    const hasDescription = [form.preoperatorio, form.posoperatorio, form.procedimientoqx, form.hallazgos].some(v => v.trim());
    if (!form.cirujano.trim() || !hasDescription) { setErrorMsg("Completá el cirujano y al menos un campo de descripción."); return; }
    try {
      const templateData = {
        name,
        templateData: {
          cirujanoTitulo: form.cirujanoTitulo,
          cirujano: form.cirujano.trim(),
          preoperatorio: form.preoperatorio.trim(),
          posoperatorio: form.posoperatorio.trim(),
          procedimientoqx: form.procedimientoqx.trim(),
          hallazgos: form.hallazgos.trim(),
        },
        timestamp: Date.now(),
      };
      await push(ref(db, "fojaqx/plantillas"), templateData);
      showToast("✓ Plantilla guardada");
    } catch (err) { setErrorMsg("Error al guardar plantilla."); }
  };

  return (
    <div className={styles.page}>
      <button onClick={() => router.push("/admin/cx")} className={styles.volverBtn}>← Volver a CX</button>

      <div className={styles.viewTabs}>
        <button className={`${styles.tab} ${view === "nueva" ? styles.tabActive : ""}`} onClick={() => setView("nueva")}>📝 Nueva Foja</button>
        <button className={`${styles.tab} ${view === "guardadas" ? styles.tabActive : ""}`} onClick={() => setView("guardadas")}>📂 Fojas Guardadas ({fojas.length})</button>
        <button className={`${styles.tab} ${view === "plantillas" ? styles.tabActive : ""}`} onClick={() => setView("plantillas")}>📋 Plantillas CX base ({plantillas.length})</button>
      </div>

      {/* ── VISTA: NUEVA FOJA ── */}
      {view === "nueva" && (
        <div className={styles.layout}>
          <main className={styles.mainContent}>
            <header className={styles.header}>
              <div className={styles.headerAccent} />
              <div className={styles.headerContent}>
                <span className={styles.headerTag}>Clínica de la Unión S.A.</span>
                <h1 className={styles.title}>Foja Quirúrgica QX</h1>
                <p className={styles.subtitle}>Completá el registro, guardalo y descargá el PDF.</p>
              </div>
            </header>

            <form onSubmit={handleGuardar} className={styles.form} autoComplete="on" noValidate>
              {/* Secciones del formulario (paciente, equipo, fecha, descripción) igual que antes */}
              <section className={styles.section}>
                <div className={styles.sectionHeader}><span className={styles.sectionNumber}>01</span><h2 className={styles.sectionTitle}>Datos del Paciente</h2></div>
                <div className={styles.grid2}>
                  <div className={styles.field}><label className={styles.label}>Apellido y Nombre *</label><input name="apelidoynombre" className={styles.input} placeholder="Apellido, Nombre" value={form.apelidoynombre} onChange={handleChange} required /></div>
                  <div className={styles.field}><label className={styles.label}>Edad *</label><input name="edad" type="number" className={styles.input} placeholder="Años" value={form.edad} onChange={handleChange} required /></div>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}><span className={styles.sectionNumber}>02</span><h2 className={styles.sectionTitle}>Equipo Quirúrgico</h2></div>
                <div className={styles.grid2}>
                  <div className={styles.field}>
                    <label className={styles.label}>Cirujano *</label>
                    <div className={styles.doctorField}>
                      <select name="cirujanoTitulo" className={styles.doctorTitle} value={form.cirujanoTitulo} onChange={handleChange}><option value="Dr.">Dr.</option><option value="Dra.">Dra.</option></select>
                      <input name="cirujano" className={styles.input} placeholder="Apellido y nombre" value={form.cirujano} onChange={handleChange} required />
                    </div>
                  </div>
                  <div className={styles.field}><label className={styles.label}>1er Ayudante</label><input name="primerayudante" className={styles.input} placeholder="Dr./Dra." value={form.primerayudante} onChange={handleChange} /></div>
                  <div className={styles.field}><label className={styles.label}>2do Ayudante</label><input name="segundoayudante" className={styles.input} placeholder="Dr./Dra." value={form.segundoayudante} onChange={handleChange} /></div>
                  <div className={styles.field}><label className={styles.label}>Anestesista *</label><input name="anestesista" className={styles.input} placeholder="Dr./Dra." value={form.anestesista} onChange={handleChange} required /></div>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}><span className={styles.sectionNumber}>03</span><h2 className={styles.sectionTitle}>Fecha y Horarios</h2></div>
                <div className={styles.grid3}>
                  <div className={styles.field}><label className={styles.label}>Día *</label><input name="dia" type="number" min="1" max="31" className={styles.input} placeholder="DD" value={form.dia} onChange={handleChange} required /></div>
                  <div className={styles.field}><label className={styles.label}>Mes *</label><input name="mes" className={styles.input} placeholder="Mes" value={form.mes} onChange={handleChange} required /></div>
                  <div className={styles.field}><label className={styles.label}>Año *</label><input name="anio" type="number" className={styles.input} placeholder="AAAA" value={form.anio} onChange={handleChange} required /></div>
                </div>
                <div className={styles.grid2} style={{ marginTop: "1rem" }}>
                  <div className={styles.field}><label className={styles.label}>Hora Inicio *</label><input name="inichsinicio" type="time" className={styles.input} value={form.inichsinicio} onChange={handleChange} required /></div>
                  <div className={styles.field}><label className={styles.label}>Hora Fin *</label><input name="hsfin" type="time" className={styles.input} value={form.hsfin} onChange={handleChange} required /></div>
                </div>
              </section>

              <section className={styles.section}>
                <div className={styles.sectionHeader}><span className={styles.sectionNumber}>04</span><h2 className={styles.sectionTitle}>Descripción Quirúrgica</h2></div>
                <p className={styles.sectionNote}>Solo los campos completados aparecerán en el PDF.</p>
                <div className={styles.fieldFull}><label className={styles.label}>1. Diagnóstico Preoperatorio *</label><textarea name="preoperatorio" className={styles.textarea} rows={3} value={form.preoperatorio} onChange={handleChange} required /></div>
                <div className={styles.fieldFull}><label className={styles.label}>2. Diagnóstico Posoperatorio</label><textarea name="posoperatorio" className={styles.textarea} rows={3} value={form.posoperatorio} onChange={handleChange} /></div>
                <div className={styles.fieldFull}><label className={styles.label}>3. Procedimiento Quirúrgico *</label><textarea name="procedimientoqx" className={styles.textarea} rows={5} value={form.procedimientoqx} onChange={handleChange} required /></div>
                <div className={styles.fieldFull}><label className={styles.label}>4. Operación y Hallazgos</label><textarea name="hallazgos" className={styles.textarea} rows={4} value={form.hallazgos} onChange={handleChange} /></div>
              </section>

              <div className={styles.actions}>
                <button type="button" onClick={handleLimpiar} className={styles.btnSecondary} disabled={saveStatus === "saving"}>Limpiar</button>
                <button type="submit" className={styles.btnPrimary} disabled={saveStatus === "saving" || saveStatus === "saved"}>
                  {saveStatus === "saving" ? <><span className={styles.spinner} /> Guardando...</> : saveStatus === "saved" ? "✓ Guardado" : "Generar Foja"}
                </button>
              </div>

              <hr className={styles.divider} />
              <section className={`${styles.section} ${styles.templateSaveSection}`}>
                <div className={styles.sectionHeader}><span className={styles.sectionNumber}>💾</span><h2 className={styles.sectionTitle}>Guardar como plantilla</h2></div>
                <button type="button" className={styles.btnPrimary} onClick={saveTemplate}>Guardar plantilla actual</button>
              </section>

              {errorMsg && <div className={styles.alertError}><span className={styles.alertIcon}>✕</span> {errorMsg}</div>}
              {saveStatus === "saved" && pdfStatus === "done" && pdfUrl && (
                <div className={styles.successPanel}>
                  <div className={styles.successInfo}><span className={styles.successIcon}>✓</span><div><p className={styles.successTitle}>Registro guardado y PDF listo</p>{savedKey && <p className={styles.successKey}>ID: {savedKey}</p>}</div></div>
                  <div className={styles.buttonGroup}>
                    <button type="button" className={styles.btnSecondary} onClick={() => window.open(pdfUrl, "_blank")}>📄 Abrir</button>
                    <button type="button" className={styles.btnDownload} onClick={() => { const a = document.createElement("a"); a.href = pdfUrl; a.download = pdfFileName; a.click(); }}><DownloadIcon /> Descargar</button>
                  </div>
                </div>
              )}
            </form>
          </main>
        </div>
      )}

      {/* ── VISTA: FOJAS GUARDADAS ── */}
      {view === "guardadas" && (
        <FojasGuardadasTab
          fojas={fojas}
          onEdit={setEditingRegistro}
          onDelete={setDeletingRegistro}
          onToast={showToast}
          searchTerm={searchFojas}
          setSearchTerm={setSearchFojas}
        />
      )}

      {/* ── VISTA: PLANTILLAS ── */}
      {view === "plantillas" && (
        <PlantillasTab
          plantillas={plantillas}
          onEdit={handleEditTemplate}
          onDelete={setDeletingRegistro}
          onLoad={handleLoadTemplate}
          searchTerm={searchPlantillas}
          setSearchTerm={setSearchPlantillas}
        />
      )}

      {/* MODALES */}
      {editingRegistro && (
        <EditFojaModal
          registro={editingRegistro}
          onClose={() => setEditingRegistro(null)}
          onSaved={() => showToast("✓ Registro actualizado")}
        />
      )}
      {deletingRegistro && (
        <ConfirmDeleteModal
          registro={deletingRegistro}
          onClose={() => setDeletingRegistro(null)}
          onConfirm={handleDelete}
        />
      )}
      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
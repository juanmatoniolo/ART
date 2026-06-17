"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, onValue, off, update, remove } from "firebase/database";
import { getSession, isAuthenticated } from "@/utils/session";
import Header from "@/components/Header/Header";
import styles from "./medicos.module.css";
import PlantillasProcedimientoModal from "./PlantillasProcedimientoModal";

// ─── Helpers ────────────────────────────────────────────────
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
  const emptyResult = {
    preoperatorio: "",
    posoperatorio: "",
    procedimientoqx: "",
    hallazgos: "",
  };

  if (typeof cx !== "string" || !cx.trim()) return emptyResult;

  const normalizedCx = cx.replace(/\r\n?/g, "\n").trim();

  const labeledSections = [
    ["preoperatorio", /(?:^|\n)\s*(?:1[.)-]?\s*)?Diagn[oó]stico\s+Preoperatorio\s*:?\s*/i],
    ["posoperatorio", /(?:^|\n)\s*(?:2[.)-]?\s*)?Diagn[oó]stico\s+Posoperatorio\s*:?\s*/i],
    ["procedimientoqx", /(?:^|\n)\s*(?:3[.)-]?\s*)?Procedimiento\s+Quir[uú]rgico\s*:?\s*/i],
    ["hallazgos", /(?:^|\n)\s*(?:4[.)-]?\s*)?(?:Operaci[oó]n\s+y\s+)?Hallazgos\s*:?\s*/i],
  ];

  const labeledMatches = labeledSections
    .map(([key, regex]) => {
      const match = regex.exec(normalizedCx);

      return match
        ? {
          key,
          index: match.index,
          contentStart: match.index + match[0].length,
        }
        : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);

  if (labeledMatches.length > 0) {
    const result = { ...emptyResult };

    labeledMatches.forEach((match, index) => {
      const next = labeledMatches[index + 1];

      result[match.key] = normalizedCx
        .slice(match.contentStart, next ? next.index : normalizedCx.length)
        .trim();
    });

    return result;
  }

  const numberedRegex = /(?:^|\n)\s*([1-4])\s*[.)-]\s*/g;
  const numberedMatches = [];
  let match;

  while ((match = numberedRegex.exec(normalizedCx)) !== null) {
    numberedMatches.push({
      number: Number(match[1]),
      index: match.index,
      contentStart: numberedRegex.lastIndex,
    });
  }

  if (numberedMatches.length > 0) {
    const result = { ...emptyResult };
    const keyByNumber = {
      1: "preoperatorio",
      2: "posoperatorio",
      3: "procedimientoqx",
      4: "hallazgos",
    };

    numberedMatches.forEach((item, index) => {
      const next = numberedMatches[index + 1];
      const key = keyByNumber[item.number];

      result[key] = normalizedCx
        .slice(item.contentStart, next ? next.index : normalizedCx.length)
        .trim();
    });

    return result;
  }

  return {
    ...emptyResult,
    procedimientoqx: normalizedCx,
  };
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
    raw.cirujanoTitulo || equipo.cirujanoTitulo || "Dr.",
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
    preoperatorio: cleanValue(
      raw.preoperatorio || descripcion.preoperatorio || cxFields.preoperatorio,
    ),
    posoperatorio: cleanValue(
      raw.posoperatorio || descripcion.posoperatorio || cxFields.posoperatorio,
    ),
    procedimientoqx: cleanValue(
      raw.procedimientoqx || descripcion.procedimientoqx || cxFields.procedimientoqx,
    ),
    hallazgos: cleanValue(
      raw.hallazgos || descripcion.hallazgos || cxFields.hallazgos,
    ),
  };
};

const normalizeTemplate = (
  raw = {},
  id = raw.id,
  dbPath = raw._dbPath || `fojaqx/plantillas/${id}`,
) => {
  const source = raw.templateData || raw.formData || raw || {};
  const professional = splitProfessionalName(
    source.cirujano || raw.cirujano,
    source.cirujanoTitulo || raw.cirujanoTitulo || "Dr.",
  );

  return {
    ...raw,
    ...source,
    id,
    _dbPath: dbPath,
    _type: "template",
    templateName: cleanValue(raw.name || raw.nombre || source.name || "Plantilla sin nombre"),
    apelidoynombre: "",
    edad: "",
    cirujanoTitulo: professional.titulo,
    cirujanoNombre: professional.nombre,
    cirujano: professional.completo,
    primerayudante: "",
    segundoayudante: "",
    anestesista: "",
    dia: "",
    mes: "",
    anio: "",
    inichsinicio: "",
    hsfin: "",
    preoperatorio: cleanValue(source.preoperatorio || raw.preoperatorio),
    posoperatorio: cleanValue(source.posoperatorio || raw.posoperatorio),
    procedimientoqx: cleanValue(
      source.procedimientoqx || raw.procedimientoqx,
    ),
    hallazgos: cleanValue(source.hallazgos || raw.hallazgos),
    timestamp: raw.timestamp || raw.createdAt || raw.updatedAt || 0,
  };
};

const formatDate = (dia, mes, anio) =>
  dia && mes && anio ? `${dia} ${mes} ${anio}` : "Sin fecha";

const formatTime = (inicio, fin) => {
  if (!inicio && !fin) return null;
  return [inicio, fin].filter(Boolean).join(" – ");
};

const buildCx = (reg) => {
  const normalized = normalizeRegistro(reg);
  return [
    `1. Diagnóstico Preoperatorio: ${normalized.preoperatorio}`,
    `2. Diagnóstico Posoperatorio: ${normalized.posoperatorio}`,
    `3. Procedimiento Quirúrgico: ${normalized.procedimientoqx}`,
    `4. Operación y Hallazgos: ${normalized.hallazgos}`,
  ].join("\n\n");
};

const buildPdfPayload = (reg) => {
  const normalized = normalizeRegistro(reg);

  return {
    paciente: {
      apelidoynombre: normalized.apelidoynombre,
      edad: normalized.edad,
    },
    equipo: {
      cirujano: normalized.cirujano,
      primerayudante: normalized.primerayudante,
      segundoayudante: normalized.segundoayudante,
      anestesista: normalized.anestesista,
    },
    fecha: {
      dia: normalized.dia,
      mes: normalized.mes,
      anio: normalized.anio,
    },
    horario: {
      inicio: normalized.inichsinicio,
      fin: normalized.hsfin,
    },
    descripcion: {
      preoperatorio: normalized.preoperatorio,
      posoperatorio: normalized.posoperatorio,
      procedimientoqx: normalized.procedimientoqx,
      hallazgos: normalized.hallazgos,
    },
    cx: buildCx(normalized),
  };
};

const buildFileName = (reg) => {
  const normalized = normalizeRegistro(reg);
  const apellido = normalized.apelidoynombre
    ? normalized.apelidoynombre.split(",")[0].trim().replace(/\s+/g, "_")
    : "foja";

  const fecha = [normalized.dia, normalized.mes, normalized.anio]
    .filter(Boolean)
    .join("-");

  return `FojaQX_${apellido}${fecha ? `_${fecha}` : ""}.pdf`;
};

// ─── Iconos SVG ─────────────────────────────────────────────
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
  <svg
    width="14" height="14"
    viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ transition: "transform 0.22s ease", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
  >
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

// ─── Subcomponentes ──────────────────────────────────────────
function StatChip({ num, label }) {
  return (
    <div className={styles.statChip}>
      <span className={styles.statNum}>{num}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}

function FilterTag({ label, onRemove }) {
  return (
    <button className={styles.filterTag} onClick={onRemove} title={`Quitar filtro: ${label}`}>
      {label} <CloseIcon />
    </button>
  );
}

function TemplateCard({ template, onDelete }) {
  const [expanded, setExpanded] = useState(false);

  const hasDescription = Boolean(
    template.preoperatorio ||
    template.posoperatorio ||
    template.procedimientoqx ||
    template.hallazgos
  );

  return (
    <article className={`${styles.card} ${styles.templateCard}`}>
      <div className={styles.templateStripe} />
      <div className={styles.cardInner}>
        <div className={styles.templateTop}>
          <div className={styles.templateIcon} aria-hidden="true">📋</div>
          <div className={styles.templateHeading}>
            <span className={styles.templateBadge}>Plantilla quirúrgica</span>
            <h3 className={styles.templateName}>{template.templateName}</h3>
            <p className={styles.templateSubtitle}>
              Datos reutilizables para completar una nueva foja
            </p>
          </div>
        </div>

        <div className={styles.cardPills}>
          {template.cirujano && (
            <span className={styles.pill}>
              <span className={styles.pillDot} />
              {template.cirujano}
            </span>
          )}
          <span className={`${styles.pill} ${styles.templatePill}`}>
            Sin datos de paciente
          </span>
        </div>

        {!expanded && (
          <div className={styles.templateSummary}>
            <span className={styles.templateSummaryLabel}>Procedimiento</span>
            <p className={styles.cardCollapsed}>
              {template.procedimientoqx ||
                template.preoperatorio ||
                "Esta plantilla todavía no tiene una descripción cargada."}
            </p>
          </div>
        )}

        {expanded && (
          <div className={styles.expandedRow}>
            {template.preoperatorio && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Preoperatorio</span>
                <span className={styles.expandedValue}>{template.preoperatorio}</span>
              </div>
            )}
            {template.posoperatorio && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Posoperatorio</span>
                <span className={styles.expandedValue}>{template.posoperatorio}</span>
              </div>
            )}
            {template.procedimientoqx && (
              <div className={`${styles.expandedField} ${styles.expandedFieldFull}`}>
                <span className={styles.expandedLabel}>Procedimiento quirúrgico</span>
                <span className={styles.expandedValue}>{template.procedimientoqx}</span>
              </div>
            )}
            {template.hallazgos && (
              <div className={`${styles.expandedField} ${styles.expandedFieldFull}`}>
                <span className={styles.expandedLabel}>Hallazgos</span>
                <span className={styles.expandedValue}>{template.hallazgos}</span>
              </div>
            )}
            {!hasDescription && (
              <div className={styles.templateEmptyState}>
                No hay datos de descripción quirúrgica en esta plantilla.
              </div>
            )}
          </div>
        )}

        <div className={styles.cardFooter}>
          <button
            type="button"
            className={styles.btnToggle}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Ocultar datos" : "Ver contenido"}
            <ChevronIcon open={expanded} />
          </button>


        </div>
      </div>
    </article>
  );
}

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
    // Se abre inmediatamente para evitar que el navegador bloquee la pestaña.
    const previewWindow = window.open("", "_blank");

    if (!previewWindow) {
      onToast?.("✕ Permití las ventanas emergentes para ver el PDF");
      return;
    }

    previewWindow.document.title = "Generando vista previa…";
    previewWindow.document.body.innerHTML = `
      <div style="font-family:system-ui,sans-serif;padding:32px;text-align:center;color:#44534d">
        Generando vista previa del PDF…
      </div>
    `;

    setViewing(true);

    try {
      const { blob } = await requestPdf();
      const url = URL.createObjectURL(blob);

      previewWindow.location.replace(url);

      // El visor ya cargó el recurso; se libera más tarde para evitar fugas.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      previewWindow.close();
      onToast?.("✕ No se pudo abrir la vista previa");
    } finally {
      setViewing(false);
    }
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
    } catch (err) {
      onToast?.("✕ No se pudo generar el PDF");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.cardStripe} />
      <div className={styles.cardInner}>
        {/* Top */}
        <div className={styles.cardTop}>
          <div>
            <h3 className={styles.patientName}>{registro.apelidoynombre}</h3>
            <p className={styles.cardDate}>{formatDate(registro.dia, registro.mes, registro.anio)}</p>
          </div>
          {registro.edad && <span className={styles.ageTag}>{registro.edad} años</span>}
        </div>

        {/* Pills */}
        <div className={styles.cardPills}>
          {registro.cirujano && (
            <span className={styles.pill}>
              <span className={styles.pillDot} />
              {registro.cirujano}
            </span>
          )}
          {registro.anestesista && (
            <span className={styles.pill}>
              <span className={`${styles.pillDot} ${styles.pillDotGold}`} />
              {registro.anestesista}
            </span>
          )}
          {formatTime(registro.inichsinicio, registro.hsfin) && (
            <span className={styles.pill}>
              🕐 {formatTime(registro.inichsinicio, registro.hsfin)}
            </span>
          )}
        </div>

        {/* Procedimiento (resumen) */}
        {!expanded && registro.procedimientoqx && (
          <p className={styles.cardCollapsed}>{registro.procedimientoqx}</p>
        )}

        {/* Descripción quirúrgica completa */}
        {expanded && (
          <div className={styles.expandedRow}>
            {registro.preoperatorio && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Preoperatorio</span>
                <span className={styles.expandedValue}>{registro.preoperatorio}</span>
              </div>
            )}
            {registro.posoperatorio && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Posoperatorio</span>
                <span className={styles.expandedValue}>{registro.posoperatorio}</span>
              </div>
            )}
            {registro.procedimientoqx && (
              <div className={`${styles.expandedField} ${styles.expandedFieldFull}`}>
                <span className={styles.expandedLabel}>Procedimiento quirúrgico</span>
                <span className={styles.expandedValue}>{registro.procedimientoqx}</span>
              </div>
            )}
            {registro.hallazgos && (
              <div className={`${styles.expandedField} ${styles.expandedFieldFull}`}>
                <span className={styles.expandedLabel}>Hallazgos</span>
                <span className={styles.expandedValue}>{registro.hallazgos}</span>
              </div>
            )}
            {(registro.primerayudante || registro.segundoayudante) && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Ayudantes</span>
                <span className={styles.expandedValue}>
                  {[registro.primerayudante, registro.segundoayudante].filter(Boolean).join(", ")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className={styles.cardFooter}>
          <button className={styles.btnToggle} onClick={() => setExpanded(v => !v)}>
            {expanded ? "Ver menos" : "Ver más"}
            <ChevronIcon open={expanded} />
          </button>
          <div className={styles.cardActions}>
            <button
              className={styles.btnDownload}
              onClick={handleView}
              disabled={viewing || downloading}
              aria-label={`Ver foja de ${registro.apelidoynombre || "paciente"}`}
            >
              {viewing
                ? <><span className={styles.btnSpinnerDark} /> Abriendo…</>
                : <><EyeIcon /> Ver</>}
            </button>
            <button className={styles.btnDownload} onClick={handleDownload} disabled={downloading}>
              {downloading
                ? <><span className={styles.btnSpinnerDark} /> Generando…</>
                : <><DownloadIcon /> Foja</>}
            </button>
            <button className={styles.btnEdit} onClick={() => onEdit(reg)}>
              <EditIcon /> Editar
            </button>

          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de confirmación de borrado ────────────────────────
function ConfirmDeleteModal({ registro, onClose, onConfirm }) {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    await onConfirm();
    // El componente se desmonta al cerrarse; no hace falta resetear.
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.confirmModal} onClick={e => e.stopPropagation()}>
        <div className={styles.confirmIcon}>
          <TrashIcon />
        </div>
        <h3 className={styles.confirmTitle}>
          {registro._type === "template" ? "Eliminar plantilla" : "Eliminar foja"}
        </h3>
        <p className={styles.confirmText}>
          ¿Seguro que querés eliminar{" "}
          <strong>
            {registro._type === "template"
              ? `la plantilla "${registro.templateName}"`
              : `la foja de ${registro.apelidoynombre || "este paciente"}`}
          </strong>?
          Esta acción no se puede deshacer.
        </p>
        <div className={styles.confirmActions}>
          <button className={styles.btnCancel} onClick={onClose} disabled={deleting}>
            Cancelar
          </button>
          <button className={styles.btnDangerSolid} onClick={handleConfirm} disabled={deleting}>
            {deleting
              ? <><span className={styles.btnSpinner} /> Eliminando…</>
              : "Sí, eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal de edición ────────────────────────────────────────
function EditModal({ registro, onClose, onSaved }) {
  const initialRegistro = normalizeRegistro(registro);
  const [form, setForm] = useState({
    ...initialRegistro,
    cirujano: initialRegistro.cirujanoNombre,
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [showPlantillas, setShowPlantillas] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // Aplica una plantilla de procedimiento (fusiona sus campos al formulario)
  const aplicarPlantilla = (campos) => setForm(prev => ({ ...prev, ...campos }));

  const handleSave = async () => {
    setSaving(true);
    setErrorMsg("");
    try {
      const registroRef = ref(db, registro._dbPath || `fojaqx/${registro.id}`);
      const { id, timestamp, cirujanoNombre, ...rest } = form;
      const cirujanoCompleto = joinProfessionalName(
        form.cirujanoTitulo,
        form.cirujano,
      );

      const datosActualizados = {
        ...rest,
        cirujano: cirujanoCompleto,
        cirujanoTitulo: form.cirujanoTitulo || "Dr.",
      };

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
    } catch (err) {
      setErrorMsg("Error al actualizar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Handle para mobile */}
        <div className={styles.modalHandle}>
          <div className={styles.modalHandleBar} />
        </div>

        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalAccent} />
          <h2 className={styles.modalTitle}>Editar Foja Quirúrgica</h2>
          <p className={styles.modalSubtitle}>{form.apelidoynombre || "Paciente"}</p>
        </div>

        {/* Body */}
        <div className={styles.modalBody}>
          {errorMsg && <div className={styles.modalError}>⚠ {errorMsg}</div>}

          {/* Paciente */}
          <div className={styles.modalSection}>
            <p className={styles.modalSectionTitle}>Paciente</p>
            <div className={styles.modalGrid2}>
              <div className={styles.modalFieldFull}>
                <label className={styles.modalLabel}>Apellido y Nombre</label>
                <input name="apelidoynombre" value={form.apelidoynombre || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Edad</label>
                <input name="edad" type="number" value={form.edad || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
            </div>
          </div>

          {/* Equipo */}
          <div className={styles.modalSection}>
            <p className={styles.modalSectionTitle}>Equipo Quirúrgico</p>
            <div className={styles.modalGrid2}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Tratamiento</label>
                <select
                  name="cirujanoTitulo"
                  value={form.cirujanoTitulo || "Dr."}
                  onChange={handleChange}
                  className={styles.modalSelect}
                >
                  <option value="Dr.">Dr.</option>
                  <option value="Dra.">Dra.</option>
                </select>
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Cirujano</label>
                <input
                  name="cirujano"
                  value={form.cirujano || ""}
                  onChange={handleChange}
                  className={styles.modalInput}
                  autoComplete="name"
                  placeholder="Apellido y nombre"
                />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Anestesista</label>
                <input name="anestesista" value={form.anestesista || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>1er Ayudante</label>
                <input name="primerayudante" value={form.primerayudante || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>2do Ayudante</label>
                <input name="segundoayudante" value={form.segundoayudante || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
            </div>
          </div>

          {/* Fecha y horario */}
          <div className={styles.modalSection}>
            <p className={styles.modalSectionTitle}>Fecha y Horarios</p>
            <div className={styles.modalGrid3}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Día</label>
                <input name="dia" type="number" min="1" max="31" value={form.dia || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Mes</label>
                <input name="mes" value={form.mes || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Año</label>
                <input name="anio" type="number" value={form.anio || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
            </div>
            <div className={styles.modalGrid2}>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Hora inicio</label>
                <input name="inichsinicio" type="time" value={form.inichsinicio || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
              <div className={styles.modalField}>
                <label className={styles.modalLabel}>Hora fin</label>
                <input name="hsfin" type="time" value={form.hsfin || ""} onChange={handleChange} className={styles.modalInput} />
              </div>
            </div>
          </div>

          {/* Descripción */}
          <div className={styles.modalSection}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".75rem", flexWrap: "wrap", marginBottom: ".5rem" }}>
              <p className={styles.modalSectionTitle} style={{ margin: 0 }}>Descripción Quirúrgica</p>
              <button
                type="button"
                onClick={() => setShowPlantillas(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: ".4rem",
                  fontSize: ".8rem", fontWeight: 600, padding: ".5rem .9rem",
                  borderRadius: 40, border: "1.5px solid #2c7a5e", background: "#f0f7f4",
                  color: "#2c7a5e", cursor: "pointer",
                }}
              >
                <TemplateIcon /> Plantillas
              </button>
            </div>
            <div className={styles.modalField} style={{ gridColumn: "1/-1" }}>
              <label className={styles.modalLabel}>Diagnóstico Preoperatorio</label>
              <textarea name="preoperatorio" rows="2" value={form.preoperatorio || ""} onChange={handleChange} className={styles.modalTextarea} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Diagnóstico Posoperatorio</label>
              <textarea name="posoperatorio" rows="2" value={form.posoperatorio || ""} onChange={handleChange} className={styles.modalTextarea} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Procedimiento Quirúrgico</label>
              <textarea name="procedimientoqx" rows="3" value={form.procedimientoqx || ""} onChange={handleChange} className={styles.modalTextarea} />
            </div>
            <div className={styles.modalField}>
              <label className={styles.modalLabel}>Hallazgos</label>
              <textarea name="hallazgos" rows="2" value={form.hallazgos || ""} onChange={handleChange} className={styles.modalTextarea} />
            </div>
          </div>
        </div>

        {/* Footer sticky */}
        <div className={styles.modalFooter}>
          <button className={styles.btnCancel} onClick={onClose} disabled={saving}>Cancelar</button>
          <button className={styles.btnSave} onClick={handleSave} disabled={saving}>
            {saving ? <><span className={styles.btnSpinner} /> Guardando…</> : "✓ Guardar cambios"}
          </button>
        </div>
      </div>

      {/* Plantillas de procedimiento */}
      {showPlantillas && (
        <PlantillasProcedimientoModal
          form={form}
          onAplicar={aplicarPlantilla}
          onClose={() => setShowPlantillas(false)}
        />
      )}
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────
export default function MedicosPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState([]);
  const [filteredRegistros, setFilteredRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCirujano, setFilterCirujano] = useState("");
  const [filterAnestesista, setFilterAnestesista] = useState("");
  const [editingRegistro, setEditingRegistro] = useState(null);
  const [deletingRegistro, setDeletingRegistro] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [userRole, setUserRole] = useState(null);
  const [toast, setToast] = useState("");

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  // Auth
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authed = await isAuthenticated();
        if (!authed) { router.push("/login"); return; }
        const session = getSession();
        if (session?.TipoEmpleado !== "MEDICO") {
          setErrorMsg("Acceso denegado. Solo médicos pueden ver esta página.");
          setTimeout(() => router.push("/"), 2000);
          return;
        }
        setUserRole(session.TipoEmpleado);
      } catch (error) {
        setErrorMsg("Error al verificar autenticación");
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  // Firebase
  useEffect(() => {
    if (userRole !== "MEDICO") return;
    const fojaRef = ref(db, "fojaqx");
    const unsubscribe = onValue(fojaRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const reservedNodes = new Set(["plantilla", "plantillas", "registros"]);

        const legacyRecords = Object.entries(data)
          .filter(([id, value]) => {
            if (reservedNodes.has(id)) return false;
            if (!value || typeof value !== "object") return false;

            return Boolean(
              value.paciente ||
              value.apelidoynombre ||
              value.cx ||
              value.descripcion ||
              value.equipo
            );
          })
          .map(([id, value]) =>
            normalizeRegistro(value, id, `fojaqx/${id}`),
          );

        const nestedRecords =
          data.registros && typeof data.registros === "object"
            ? Object.entries(data.registros).map(([id, value]) =>
              normalizeRegistro(value, id, `fojaqx/registros/${id}`),
            )
            : [];

        const oldTemplates =
          data.plantilla && typeof data.plantilla === "object"
            ? Object.entries(data.plantilla).map(([id, value]) =>
              normalizeTemplate(value, id, `fojaqx/plantilla/${id}`),
            )
            : [];

        const templates =
          data.plantillas && typeof data.plantillas === "object"
            ? Object.entries(data.plantillas).map(([id, value]) =>
              normalizeTemplate(value, id, `fojaqx/plantillas/${id}`),
            )
            : [];

        const lista = [
          ...legacyRecords,
          ...nestedRecords,
          ...oldTemplates,
          ...templates,
        ].sort((a, b) => {
          const dateA = new Date(
            a.updatedAt || a.timestamp || a.createdAt || 0,
          ).getTime();
          const dateB = new Date(
            b.updatedAt || b.timestamp || b.createdAt || 0,
          ).getTime();

          return dateB - dateA;
        });

        setRegistros(lista);
        setFilteredRegistros(lista);
      } else {
        setRegistros([]);
        setFilteredRegistros([]);
      }
      setLoading(false);
    }, (error) => {
      setErrorMsg("Error al cargar los registros.");
      setLoading(false);
    });
    return () => off(fojaRef);
  }, [userRole]);

  // Filtros
  useEffect(() => {
    let results = [...registros];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      results = results.filter((r) =>
        [r.apelidoynombre, r.templateName, r.cirujano, r.procedimientoqx]
          .filter(Boolean)
          .some((value) => value.toLowerCase().includes(term)),
      );
    }
    if (filterCirujano) results = results.filter(r => r.cirujano === filterCirujano);
    if (filterAnestesista) results = results.filter(r => r.anestesista === filterAnestesista);
    setFilteredRegistros(results);
  }, [searchTerm, filterCirujano, filterAnestesista, registros]);

  // Eliminar registro
  const handleDelete = async () => {
    if (!deletingRegistro) return;
    try {
      await remove(ref(db, deletingRegistro._dbPath || `fojaqx/${deletingRegistro.id}`));
      showToast(
        deletingRegistro._type === "template"
          ? "✓ Plantilla eliminada"
          : "✓ Foja eliminada",
      );
    } catch (err) {
      showToast(
        deletingRegistro._type === "template"
          ? "✕ No se pudo eliminar la plantilla"
          : "✕ No se pudo eliminar la foja",
      );
    } finally {
      setDeletingRegistro(null);
    }
  };

  const fojas = registros.filter((item) => item._type !== "template");
  const plantillas = registros.filter((item) => item._type === "template");
  const cirujanosUnicos = [...new Set(fojas.map(r => r.cirujano).filter(Boolean))];
  const anestesistasUnicos = [...new Set(fojas.map(r => r.anestesista).filter(Boolean))];

  const hasActiveFilters = filterCirujano || filterAnestesista;

  // Estados de carga / error
  if (loading) return (
    <>
      <Header />
      <div className={styles.page}>
        <div className={styles.loadingWrap}>
          <div className={styles.loadingSpinner} />
          <span>Cargando historias clínicas…</span>
        </div>
      </div>
    </>
  );

  if (errorMsg && !registros.length) return (
    <>
      <Header />
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.errorWrap}>⚠ {errorMsg}</div>
        </div>
      </div>
    </>
  );

  return (
    <>
      <Header />
      <div className={styles.page}>
        <div className={styles.container}>

          {/* Header */}
          <header className={styles.header}>
            <div className={styles.headerAccent} />
            <span className={styles.headerTag}>Clínica de la Unión S.A.</span>
            <h1 className={styles.headerTitle}>Fojas Quirúrgicas</h1>
            <p className={styles.headerSub}>Panel de gestión para médicos · {registros.length} registros totales</p>
          </header>

          {/* Stats */}
          <div className={styles.statsBar}>
            <StatChip num={fojas.length} label="Fojas" />
            <StatChip num={plantillas.length} label="Plantillas" />
            <StatChip num={filteredRegistros.length} label="Visibles" />
            <StatChip num={cirujanosUnicos.length} label="Cirujanos" />
          </div>

          {/* Filtros */}
          <div className={styles.filters}>
            <div className={styles.searchWrapper}>
              <span className={styles.searchIcon}><SearchIcon /></span>
              <input
                type="search"
                name="buscarFoja"
                autoComplete="off"
                placeholder="Buscar paciente, plantilla, cirujano o procedimiento…"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            <div className={styles.filterRow}>
              <select
                value={filterCirujano}
                onChange={e => setFilterCirujano(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">Todos los cirujanos</option>
                {cirujanosUnicos.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select
                value={filterAnestesista}
                onChange={e => setFilterAnestesista(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="">Todos los anestesistas</option>
                {anestesistasUnicos.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>

            {/* Tags activos */}
            {hasActiveFilters && (
              <div className={styles.activeFilters}>
                {filterCirujano && (
                  <FilterTag label={filterCirujano} onRemove={() => setFilterCirujano("")} />
                )}
                {filterAnestesista && (
                  <FilterTag label={filterAnestesista} onRemove={() => setFilterAnestesista("")} />
                )}
              </div>
            )}
          </div>

          {/* Lista */}
          {filteredRegistros.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔍</div>
              <p className={styles.emptyText}>Sin resultados</p>
              <p className={styles.emptyHint}>
                {searchTerm || hasActiveFilters
                  ? "Probá con otros términos o quitá los filtros."
                  : "No hay fojas cargadas aún."}
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {filteredRegistros.map((reg, i) => (
                <div key={`${reg._type}-${reg.id}`} style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}>
                  {reg._type === "template" ? (
                    <TemplateCard
                      template={reg}
                      onDelete={setDeletingRegistro}
                    />
                  ) : (
                    <RegistroCard
                      reg={reg}
                      onEdit={setEditingRegistro}
                      onDelete={setDeletingRegistro}
                      onToast={showToast}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de edición */}
      {editingRegistro && (
        <EditModal
          registro={editingRegistro}
          onClose={() => setEditingRegistro(null)}
          onSaved={() => showToast("✓ Registro actualizado correctamente")}
        />
      )}

      {/* Modal de confirmación de borrado */}
      {deletingRegistro && (
        <ConfirmDeleteModal
          registro={deletingRegistro}
          onClose={() => setDeletingRegistro(null)}
          onConfirm={handleDelete}
        />
      )}

      {/* Toast */}
      {toast && <div className={styles.toast}>{toast}</div>}
    </>
  );
}
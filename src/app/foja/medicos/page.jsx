"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, onValue, off, update, remove } from "firebase/database";
import { getSession, isAuthenticated } from "@/utils/session";
import Header from "@/components/Header/Header";
import styles from "./medicos.module.css";
import PlantillasProcedimientoModal from "./PlantillasProcedimientoModal";

// ─── Helpers ────────────────────────────────────────────────
const formatDate = (dia, mes, anio) =>
  dia && mes && anio ? `${dia} ${mes} ${anio}` : "Sin fecha";

const formatTime = (inicio, fin) => {
  if (!inicio && !fin) return null;
  return [inicio, fin].filter(Boolean).join(" – ");
};

// Reconstruye el texto unificado de la descripción quirúrgica.
// Si el registro ya trae `cx` (nuevo formato), lo usa tal cual.
// Si no, lo arma desde los 4 campos sueltos (registros viejos).
const buildCx = (reg) => {
  if (typeof reg.cx === "string" && reg.cx.trim() !== "") return reg.cx;
  const campos = [reg.preoperatorio, reg.posoperatorio, reg.procedimientoqx, reg.hallazgos];
  return campos.map((c, i) => `${i + 1}- ${(c || "").trim()}`).join("\n");
};

// Arma el payload que espera /api/fojaqx/pdf (mismo formato que el alta).
const buildPdfPayload = (reg) => ({
  paciente: { apelidoynombre: reg.apelidoynombre, edad: reg.edad },
  equipo: {
    cirujano: reg.cirujano,
    primerayudante: reg.primerayudante,
    segundoayudante: reg.segundoayudante,
    anestesista: reg.anestesista,
  },
  fecha: { dia: reg.dia, mes: reg.mes, anio: reg.anio },
  horario: { inicio: reg.inichsinicio, fin: reg.hsfin },
  cx: buildCx(reg),
});

const buildFileName = (reg) => {
  const apellido = reg.apelidoynombre
    ? reg.apelidoynombre.split(",")[0].trim().replace(/\s+/g, "_")
    : "foja";
  return `FojaQX_${apellido}_${reg.dia}-${reg.mes}-${reg.anio}.pdf`;
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

function RegistroCard({ reg, onEdit, onDelete, onToast }) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
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

      const blob = await res.blob();
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
            <h3 className={styles.patientName}>{reg.apelidoynombre}</h3>
            <p className={styles.cardDate}>{formatDate(reg.dia, reg.mes, reg.anio)}</p>
          </div>
          {reg.edad && <span className={styles.ageTag}>{reg.edad} años</span>}
        </div>

        {/* Pills */}
        <div className={styles.cardPills}>
          {reg.cirujano && (
            <span className={styles.pill}>
              <span className={styles.pillDot} />
              {reg.cirujano}
            </span>
          )}
          {reg.anestesista && (
            <span className={styles.pill}>
              <span className={`${styles.pillDot} ${styles.pillDotGold}`} />
              {reg.anestesista}
            </span>
          )}
          {formatTime(reg.inichsinicio, reg.hsfin) && (
            <span className={styles.pill}>
              🕐 {formatTime(reg.inichsinicio, reg.hsfin)}
            </span>
          )}
        </div>

        {/* Procedimiento (resumen) */}
        {reg.procedimientoqx && (
          <p className={expanded ? undefined : styles.cardCollapsed}
            style={expanded ? { fontSize: "0.83rem", color: "#3d4f4a", lineHeight: 1.6, marginBottom: "0.85rem" } : undefined}>
            {reg.procedimientoqx}
          </p>
        )}

        {/* Detalles expandidos */}
        {expanded && (
          <div className={styles.expandedRow}>
            {reg.preoperatorio && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Preoperatorio</span>
                <span className={styles.expandedValue}>{reg.preoperatorio}</span>
              </div>
            )}
            {reg.posoperatorio && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Posoperatorio</span>
                <span className={styles.expandedValue}>{reg.posoperatorio}</span>
              </div>
            )}
            {reg.hallazgos && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Hallazgos</span>
                <span className={styles.expandedValue}>{reg.hallazgos}</span>
              </div>
            )}
            {(reg.primerayudante || reg.segundoayudante) && (
              <div className={styles.expandedField}>
                <span className={styles.expandedLabel}>Ayudantes</span>
                <span className={styles.expandedValue}>
                  {[reg.primerayudante, reg.segundoayudante].filter(Boolean).join(", ")}
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
            <button className={styles.btnDownload} onClick={handleDownload} disabled={downloading}>
              {downloading
                ? <><span className={styles.btnSpinnerDark} /> Generando…</>
                : <><DownloadIcon /> Foja</>}
            </button>
            <button className={styles.btnEdit} onClick={() => onEdit(reg)}>
              <EditIcon /> Editar
            </button>
            <button className={styles.btnDelete} onClick={() => onDelete(reg)}>
              <TrashIcon /> Eliminar
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
        <h3 className={styles.confirmTitle}>Eliminar foja</h3>
        <p className={styles.confirmText}>
          ¿Seguro que querés eliminar la foja de{" "}
          <strong>{registro.apelidoynombre || "este paciente"}</strong>?
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
  const [form, setForm] = useState({ ...registro });
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
      const registroRef = ref(db, `fojaqx/${registro.id}`);
      const { id, timestamp, ...datosActualizados } = form;
      // Mantenemos `cx` sincronizado con los campos editados.
      const cx = buildCx(datosActualizados);
      await update(registroRef, {
        ...datosActualizados,
        cx,
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
                <label className={styles.modalLabel}>Cirujano</label>
                <input name="cirujano" value={form.cirujano || ""} onChange={handleChange} className={styles.modalInput} />
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
        const lista = Object.entries(data)
          .map(([id, value]) => ({ id, ...value }))
          .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
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
      results = results.filter(r => r.apelidoynombre?.toLowerCase().includes(term));
    }
    if (filterCirujano) results = results.filter(r => r.cirujano === filterCirujano);
    if (filterAnestesista) results = results.filter(r => r.anestesista === filterAnestesista);
    setFilteredRegistros(results);
  }, [searchTerm, filterCirujano, filterAnestesista, registros]);

  // Eliminar registro
  const handleDelete = async () => {
    if (!deletingRegistro) return;
    try {
      await remove(ref(db, `fojaqx/${deletingRegistro.id}`));
      showToast("✓ Foja eliminada");
    } catch (err) {
      showToast("✕ No se pudo eliminar la foja");
    } finally {
      setDeletingRegistro(null);
    }
  };

  const cirujanosUnicos = [...new Set(registros.map(r => r.cirujano).filter(Boolean))];
  const anestesistasUnicos = [...new Set(registros.map(r => r.anestesista).filter(Boolean))];

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
            <StatChip num={registros.length} label="Total" />
            <StatChip num={filteredRegistros.length} label="Filtrados" />
            <StatChip num={cirujanosUnicos.length} label="Cirujanos" />
            <StatChip num={anestesistasUnicos.length} label="Anestesistas" />
          </div>

          {/* Filtros */}
          <div className={styles.filters}>
            <div className={styles.searchWrapper}>
              <span className={styles.searchIcon}><SearchIcon /></span>
              <input
                type="search"
                placeholder="Buscar paciente…"
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
                <div key={reg.id} style={{ animationDelay: `${Math.min(i * 40, 300)}ms` }}>
                  <RegistroCard
                    reg={reg}
                    onEdit={setEditingRegistro}
                    onDelete={setDeletingRegistro}
                    onToast={showToast}
                  />
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
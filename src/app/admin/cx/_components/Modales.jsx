import { useState } from "react";
import styles from "../cx-common.module.css";
import {
  DOCTORES,
  formatNumberWithThousands,
  fmtDate,
  fmtDateTime,
  daysUntil,
  getDoctor,
  preopStatus,
  generateSafeFilename,
  downloadCxPdf,
} from "../_utils/helpers";

// ── ModalEstudio ──
export function ModalEstudio({ cx, estudio, onSave, onCancel }) {
  const [profesional, setProfesional] = useState(
    estudio === "ecg" ? cx.ecgProfesional || "" : cx.labProfesional || ""
  );
  const [fecha, setFecha] = useState(
    estudio === "ecg" ? (cx.ecgFecha || "") : (cx.labFecha || "")
  );
  const opciones =
    estudio === "ecg"
      ? ["Percara Gonzalo", "Capovila Braulio"]
      : ["Marmol Carlos", "Confalonieri Maria"];
  const titulo = estudio === "ecg" ? "ECG Preoperatorio" : "Laboratorio";
  const emoji = estudio === "ecg" ? "🫀" : "🧪";

  const handleSave = () => {
    if (!profesional && !fecha) {
      onCancel();
      return;
    }
    onSave(profesional, fecha);
  };

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.sectionIcon}>{emoji}</span>
          <h2>{titulo}</h2>
          <button className={styles.closeBtn} onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <label className={styles.formGroup}>
            Profesional
            <select
              className={styles.input}
              value={profesional}
              onChange={(e) => setProfesional(e.target.value)}
            >
              <option value="">— Seleccionar —</option>
              {opciones.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.formGroup}>
            Fecha
            <input
              type="date"
              className={styles.input}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
        </div>
        <div className={styles.actionsModal}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancelar
          </button>
          <button className={styles.saveBtn} onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ModalRealizacion ──
export function ModalRealizacion({ cx, onConfirm, onCancel }) {
  const hoy = new Date().toISOString().slice(0, 16);
  const [fechaRealizacion, setFechaRealizacion] = useState(hoy);

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.sectionIcon}>✅</span>
          <h2>Confirmar cirugía realizada</h2>
          <button className={styles.closeBtn} onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.detailRow}>
            <strong>
              {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
            </strong>
          </p>
          <p className={styles.detailRow}>{cx.formulario?.cx || "—"}</p>
          <label className={styles.formGroup}>
            Fecha y hora de realización
            <input
              type="datetime-local"
              value={fechaRealizacion}
              onChange={(e) => setFechaRealizacion(e.target.value)}
              className={styles.input}
            />
          </label>
        </div>
        <div className={styles.actionsModal}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancelar
          </button>
          <button className={styles.saveBtn} onClick={() => onConfirm(fechaRealizacion)}>
            Confirmar como realizada
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ModalEdicion ──
export function ModalEdicion({ cx, onSave, onCancel }) {
  const [form, setForm] = useState({
    fechaEstimada: cx.fechaEstimada || "",
    tipoCirugia: cx.formulario?.cx || cx.tipoCirugia || "",
    doctor: getDoctor(cx) || "",
    ecgProfesional: cx.ecgProfesional || "",
    ecgFecha: cx.ecgFecha || "",
    labProfesional: cx.labProfesional || "",
    labFecha: cx.labFecha || "",
  });

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div
        className={styles.modal}
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <span className={styles.sectionIcon}>✏️</span>
          <h2>Editar cirugía</h2>
          <button className={styles.closeBtn} onClick={onCancel}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.detailRow}>
            <strong>
              {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
            </strong>
            {cx.pacienteDatos?.dni && (
              <span> DNI {formatNumberWithThousands(cx.pacienteDatos.dni)}</span>
            )}
          </p>

          <div style={{ display: "grid", gap: 16 }}>
            <label className={styles.formGroup}>
              Fecha estimada
              <input
                type="date"
                className={styles.input}
                value={form.fechaEstimada}
                onChange={(e) => set("fechaEstimada", e.target.value)}
              />
            </label>
            <label className={styles.formGroup}>
              Tipo de cirugía
              <input
                type="text"
                className={styles.input}
                value={form.tipoCirugia}
                onChange={(e) => set("tipoCirugia", e.target.value)}
                placeholder="Ej: Colecistectomía laparoscópica"
              />
            </label>
            <label className={styles.formGroup}>
              Médico cirujano
              <select
                className={styles.input}
                value={form.doctor}
                onChange={(e) => set("doctor", e.target.value)}
              >
                <option value="">— Seleccionar —</option>
                {DOCTORES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, marginBottom: 8 }}>
                🫀 ECG Preoperatorio
              </p>
              <label className={styles.formGroup}>
                Profesional
                <select
                  className={styles.input}
                  value={form.ecgProfesional}
                  onChange={(e) => set("ecgProfesional", e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  <option value="Percara Gonzalo">Percara Gonzalo</option>
                  <option value="Capovila Braulio">Capovila Braulio</option>
                </select>
              </label>
              <label className={styles.formGroup}>
                Fecha
                <input
                  type="date"
                  className={styles.input}
                  value={form.ecgFecha}
                  onChange={(e) => set("ecgFecha", e.target.value)}
                />
              </label>
            </div>

            <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 12 }}>
              <p style={{ margin: 0, fontWeight: 600, marginBottom: 8 }}>
                🧪 Laboratorio
              </p>
              <label className={styles.formGroup}>
                Profesional
                <select
                  className={styles.input}
                  value={form.labProfesional}
                  onChange={(e) => set("labProfesional", e.target.value)}
                >
                  <option value="">— Seleccionar —</option>
                  <option value="Marmol Carlos">Marmol Carlos</option>
                  <option value="Confalonieri Maria">Confalonieri Maria</option>
                </select>
              </label>
              <label className={styles.formGroup}>
                Fecha
                <input
                  type="date"
                  className={styles.input}
                  value={form.labFecha}
                  onChange={(e) => set("labFecha", e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
        <div className={styles.actionsModal}>
          <button className={styles.cancelBtn} onClick={onCancel}>
            Cancelar
          </button>
          <button className={styles.saveBtn} onClick={() => onSave(form)}>
            Guardar cambios
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ModalFicha ──
export function ModalFicha({ cx, mapping, canonical, onClose }) {
  const dr = getDoctor(cx);
  const preop = preopStatus(cx);
  const dias = daysUntil(cx.fechaEstimada);

  const handleDownload = (type) => {
    downloadCxPdf(cx, type, mapping, canonical);
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.fichaModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.fichaHeader}>
          <div>
            <h2 className={styles.fichaTitle}>FICHA QUIRÚRGICA</h2>
            <p className={styles.fichaSubtitle}>Programación preoperatoria</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.fichaBody}>
          <div className={styles.fichaSection}>
            <h3>Paciente</h3>
            <div className={styles.fichaRow}>
              <span className={styles.fichaKey}>Nombre completo</span>
              <span className={styles.fichaVal}>
                {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
              </span>
            </div>
            {cx.pacienteDatos?.dni && (
              <div className={styles.fichaRow}>
                <span className={styles.fichaKey}>DNI</span>
                <span className={styles.fichaVal}>
                  {formatNumberWithThousands(cx.pacienteDatos.dni)}
                </span>
              </div>
            )}
            {cx.pacienteDatos?.edad && (
              <div className={styles.fichaRow}>
                <span className={styles.fichaKey}>Edad</span>
                <span className={styles.fichaVal}>{cx.pacienteDatos.edad} años</span>
              </div>
            )}
          </div>
          <div className={styles.fichaSection}>
            <h3>Cirugía</h3>
            <div className={styles.fichaRow}>
              <span className={styles.fichaKey}>Procedimiento</span>
              <span className={styles.fichaVal}>{cx.formulario?.cx || "—"}</span>
            </div>
            <div className={styles.fichaRow}>
              <span className={styles.fichaKey}>Cirujano</span>
              <span className={styles.fichaVal}>{dr ? `Dr. ${dr}` : "—"}</span>
            </div>
            <div className={styles.fichaRow}>
              <span className={styles.fichaKey}>Fecha estimada</span>
              <span className={styles.fichaVal}>
                {fmtDate(cx.fechaEstimada)}
                {dias !== null && dias >= 0 && dias <= 7 && (
                  <span className={styles.diasBadge}>
                    {dias === 0
                      ? "HOY"
                      : `en ${dias} día${dias > 1 ? "s" : ""}`}
                  </span>
                )}
              </span>
            </div>
          </div>
          <div className={styles.fichaSection}>
            <h3>Preoperatorio</h3>
            <div className={styles.fichaRow}>
              <span className={styles.fichaKey}>🫀 ECG</span>
              <span className={styles.fichaVal}>
                {cx.ecgProfesional ? (
                  <>
                    {cx.ecgProfesional} — {fmtDate(cx.ecgFecha)}
                  </>
                ) : (
                  <span className={styles.faltante}>PENDIENTE</span>
                )}
              </span>
            </div>
            <div className={styles.fichaRow}>
              <span className={styles.fichaKey}>🧪 Lab</span>
              <span className={styles.fichaVal}>
                {cx.labProfesional ? (
                  <>
                    {cx.labProfesional} — {fmtDate(cx.labFecha)}
                  </>
                ) : (
                  <span className={styles.faltante}>PENDIENTE</span>
                )}
              </span>
            </div>
            <div className={`${styles.fichaRow} ${styles.fichaStatus}`}>
              <span className={styles.fichaKey}>Estado preop</span>
              <span
                className={preop.completo ? styles.statusOk : styles.statusWarn}
              >
                {preop.completo ? "✅ COMPLETO" : "⚠️ INCOMPLETO"}
              </span>
            </div>
          </div>
          <div className={styles.fichaPdfButtons}>
            <button
              className={styles.btnPdfFrente}
              onClick={() => handleDownload("Frente")}
            >
              ↓ PDF Frente
            </button>
            <button
              className={styles.btnPdfDorso}
              onClick={() => handleDownload("Dorso")}
            >
              ↓ PDF Dorso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ModalListaDia ──
export function ModalListaDia({ cirugias, onClose }) {
  const hoy = new Date().toISOString().slice(0, 10);
  const [fecha, setFecha] = useState(hoy);
  const lista = cirugias.filter(
    (cx) => !cx.realizada && cx.fechaEstimada?.slice(0, 10) === fecha
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${styles.fichaModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.fichaHeader}>
          <div>
            <h2 className={styles.fichaTitle}>LISTA QUIRÚRGICA</h2>
            <p className={styles.fichaSubtitle}>Programación del día</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.fichaBody}>
          <label className={styles.formGroup}>
            Fecha
            <input
              type="date"
              className={styles.input}
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </label>
          {lista.length === 0 ? (
            <div className={styles.listaVacia}>
              No hay cirugías programadas para este día.
            </div>
          ) : (
            <div className={styles.listaTable}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Paciente</th>
                    <th>Cirugía</th>
                    <th>Cirujano</th>
                    <th>Preop</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((cx, i) => (
                    <tr key={cx.id}>
                      <td>{i + 1}</td>
                      <td>
                        <strong>
                          {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
                        </strong>
                        {cx.pacienteDatos?.dni && (
                          <div className={styles.dniSmall}>
                            DNI {formatNumberWithThousands(cx.pacienteDatos.dni)}
                          </div>
                        )}
                      </td>
                      <td>{cx.formulario?.cx || "—"}</td>
                      <td>{getDoctor(cx) || "—"}</td>
                      <td>{preopStatus(cx).completo ? "✅" : "⚠️"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
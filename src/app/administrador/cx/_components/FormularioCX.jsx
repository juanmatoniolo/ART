import styles from "../cx-common.module.css";
import AutoInput from "./AutoInput";
import PacienteSelector from "./PacienteSelector";
import {
  isLikelyCheckbox,
  humanizeKey,
  normalizeName,        // ← AGREGAR ESTA LÍNEA
  formatNumberWithThousands,
  parseFormattedNumber,
} from "../_utils/helpers";

export default function FormularioCX({
  form,
  setValue,
  suggestions,
  commitSuggestion,
  canonical,
  mapping,
  mode,
  setMode,
  selectedPaciente,
  setSelectedPaciente,
  canonCX,
  canonDoctor,
  canonApellido,
  canonNombre,
  canonDNI,
  canonEdad,
  canonEdadPaciente,
  canonDia,
  canonMes,
  canonAnio,
  canonLocalidad,
  canonProvincia,
  canonDomicilioPaciente,
  canonNacimientoPaciente,
  canonHCPaciente,
  canonART,
  canonTelefono,
  canonNombres,
  canonServicio,
  canonKeys,
  hasSexo,
  hasLocation,
  orderedResto,
  fechaEstimada,
  setFechaEstimada,
  guardarCXYEliminarSolicitud,
  saving,
  edadCalculada,
  canonicalObj, // canonical object itself
}) {
  function getCanonFieldType(canonName) {
    const internals = canonicalObj?.canonicalToInternal?.[canonName] || [];
    return mapping?.[internals?.[0]]?.[0]?.field_type;
  }

  function getAutoCompleteAttrWrapper(canonName) {
    const n = normalizeName(canonName);
    if (n === "provincia") return "address-level1";
    if (n === "localidad") return "address-level2";
    if (n.includes("domicilio") || n.includes("direccion")) return "street-address";
    if (n.includes("telefono") || n.includes("celular")) return "tel";
    if (n.includes("dni") || n.includes("hc") || n.includes("historia-clinica")) return "off";
    if (n.includes("nacimiento") || n.includes("nacmiento")) return "address-level2";
    return "on";
  }

  return (
    <>
      <div className={styles.modeSelector}>
        <button
          className={`${styles.modeBtn} ${mode === "manual" ? styles.active : ""}`}
          onClick={() => setMode("manual")}
        >
          Cargar manualmente
        </button>
        <button
          className={`${styles.modeBtn} ${mode === "paciente" ? styles.active : ""}`}
          onClick={() => setMode("paciente")}
        >
          Desde paciente existente
        </button>
      </div>

      {mode === "paciente" && (
        <div className={styles.pacienteSection}>
          <h3>Seleccionar paciente</h3>
          <PacienteSelector
            onSelect={setSelectedPaciente}
            selectedPacienteId={selectedPaciente?.id}
          />
          {selectedPaciente && (
            <div className={styles.selectedPacienteInfo}>
              <strong>Paciente seleccionado:</strong> {selectedPaciente.nombreCompleto}{" "}
              (DNI: {selectedPaciente.dni || "—"})
            </div>
          )}
        </div>
      )}

      {/* Datos de la Cirugía */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>🏥</span>
          <h2 className={styles.sectionTitle}>Datos de la Cirugía</h2>
        </div>
        <div className={`${styles.sectionBody} ${styles.cols3}`}>
          {canonCX && (
            <div className={`${styles.field} ${styles.fieldSpan2}`}>
              <label className={styles.fieldLabel}>Cirugía a realizar</label>
              <AutoInput
                canonName={canonCX}
                value={form?.[canonCX]}
                onChange={(e) => setValue(canonCX, e.target.value)}
                onBlur={(e) => commitSuggestion(canonCX, e.target.value)}
                suggestions={suggestions}
                placeholder="Describir la cirugía…"
              />
            </div>
          )}
          {canonDoctor && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Médico cirujano</label>
              <AutoInput
                canonName={canonDoctor}
                value={form?.[canonDoctor]}
                onChange={(e) => setValue(canonDoctor, e.target.value)}
                onBlur={(e) => commitSuggestion(canonDoctor, e.target.value)}
                suggestions={suggestions}
                placeholder="Nombre del profesional…"
              />
            </div>
          )}
          {canonART && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>ART / Obra Social</label>
              <AutoInput
                canonName={canonART}
                value={form?.[canonART]}
                onChange={(e) => setValue(canonART, e.target.value)}
                onBlur={(e) => commitSuggestion(canonART, e.target.value)}
                suggestions={suggestions}
                placeholder="ART u obra social…"
              />
            </div>
          )}
        </div>
      </section>

      {/* Identificación del Paciente */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>👤</span>
          <h2 className={styles.sectionTitle}>Identificación del Paciente</h2>
        </div>
        <div className={`${styles.sectionBody} ${styles.cols4}`}>
          {canonApellido && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Apellido</label>
              <AutoInput
                canonName={canonApellido}
                value={form?.[canonApellido]}
                onChange={(e) => setValue(canonApellido, e.target.value)}
                onBlur={(e) => commitSuggestion(canonApellido, e.target.value)}
                suggestions={suggestions}
                placeholder="Apellido…"
                autoComplete="family-name"
              />
            </div>
          )}
          {canonNombre && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nombre</label>
              <AutoInput
                canonName={canonNombre}
                value={form?.[canonNombre]}
                onChange={(e) => setValue(canonNombre, e.target.value)}
                onBlur={(e) => commitSuggestion(canonNombre, e.target.value)}
                suggestions={suggestions}
                placeholder="Nombre…"
                autoComplete="given-name"
              />
            </div>
          )}
          {canonHCPaciente && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>N° Historia Clínica</label>
              <input
                className={styles.input}
                name={canonHCPaciente}
                autoComplete="off"
                inputMode="numeric"
                value={formatNumberWithThousands(form?.[canonHCPaciente] ?? "")}
                onChange={(e) => setValue(canonHCPaciente, parseFormattedNumber(e.target.value))}
                placeholder="Ej: 12.345.678"
              />
            </div>
          )}
          {hasSexo && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Sexo</label>
              <div className={styles.sexRowInline}>
                <button
                  type="button"
                  className={`${styles.chip} ${form.sexo === "M" ? styles.chipActive : ""}`}
                  onClick={() => setValue("sexo", form.sexo === "M" ? "" : "M")}
                >
                  Masculino
                </button>
                <button
                  type="button"
                  className={`${styles.chip} ${form.sexo === "F" ? styles.chipActive : ""}`}
                  onClick={() => setValue("sexo", form.sexo === "F" ? "" : "F")}
                >
                  Femenino
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Datos Adicionales */}
      {orderedResto.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📋</span>
            <h2 className={styles.sectionTitle}>Datos Adicionales</h2>
          </div>
          <div className={`${styles.sectionBody} ${styles.cols3}`}>
            {orderedResto.map((canonName) => {
              const internals = canonicalObj?.canonicalToInternal[canonName] || [];
              const isBtn = isLikelyCheckbox(getCanonFieldType(canonName));
              return (
                <div className={styles.field} key={canonName}>
                  <label className={styles.fieldLabel}>{humanizeKey(canonName)}</label>
                  {isBtn ? (
                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={!!form[canonName]}
                        onChange={(e) => setValue(canonName, e.target.checked)}
                      />
                      <span>Marcar</span>
                    </label>
                  ) : (
                    <AutoInput
                      canonName={canonName}
                      value={form?.[canonName]}
                      onChange={(e) => setValue(canonName, e.target.value)}
                      onBlur={(e) => commitSuggestion(canonName, e.target.value)}
                      suggestions={suggestions}
                      autoComplete={getAutoCompleteAttrWrapper(canonName)}
                    />
                  )}
                  <div className={styles.hint}>
                    <code className={styles.code}>
                      {internals.slice(0, 2).join(", ")}
                    </code>
                    {internals.length > 2 && <span>+{internals.length - 2}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Fecha de Nacimiento */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>🎂</span>
          <h2 className={styles.sectionTitle}>Fecha de Nacimiento</h2>
          <span className={styles.sectionHint}>La edad se calcula automáticamente</span>
        </div>
        <div className={`${styles.sectionBody} ${styles.cols4}`}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Día</label>
            <input
              className={styles.input}
              autoComplete="off"
              inputMode="numeric"
              value={canonDia ? (form?.[canonDia] ?? "") : ""}
              onChange={(e) => canonDia && setValue(canonDia, e.target.value)}
              placeholder="DD"
              disabled={!canonDia}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Mes</label>
            <input
              className={styles.input}
              autoComplete="off"
              inputMode="numeric"
              value={canonMes ? (form?.[canonMes] ?? "") : ""}
              onChange={(e) => canonMes && setValue(canonMes, e.target.value)}
              placeholder="MM"
              disabled={!canonMes}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Año</label>
            <input
              className={styles.input}
              autoComplete="off"
              inputMode="numeric"
              value={canonAnio ? (form?.[canonAnio] ?? "") : ""}
              onChange={(e) => canonAnio && setValue(canonAnio, e.target.value)}
              placeholder="AAAA"
              disabled={!canonAnio}
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>
              Edad <span className={styles.badge}>auto</span>
            </label>
            <input
              className={`${styles.input} ${styles.inputReadonly}`}
              value={edadCalculada ? `${edadCalculada} años` : "—"}
              readOnly
              disabled
            />
          </div>
        </div>
      </section>

      {/* Domicilio y Procedencia */}
      {hasLocation && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📍</span>
            <h2 className={styles.sectionTitle}>Domicilio y Procedencia</h2>
          </div>
          <div className={`${styles.sectionBody} ${styles.cols3}`}>
            {canonDomicilioPaciente && (
              <div className={`${styles.field} ${styles.fieldSpan2}`}>
                <label className={styles.fieldLabel}>Domicilio</label>
                <AutoInput
                  canonName={canonDomicilioPaciente}
                  value={form?.[canonDomicilioPaciente]}
                  onChange={(e) => setValue(canonDomicilioPaciente, e.target.value)}
                  onBlur={(e) => commitSuggestion(canonDomicilioPaciente, e.target.value)}
                  suggestions={suggestions}
                  placeholder="Dirección completa…"
                  autoComplete="street-address"
                />
              </div>
            )}
            {canonLocalidad && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Localidad</label>
                <AutoInput
                  canonName={canonLocalidad}
                  value={form?.[canonLocalidad]}
                  onChange={(e) => setValue(canonLocalidad, e.target.value)}
                  onBlur={(e) => commitSuggestion(canonLocalidad, e.target.value)}
                  suggestions={suggestions}
                  placeholder="Localidad…"
                  autoComplete="address-level2"
                />
              </div>
            )}
            {canonProvincia && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Provincia</label>
                <AutoInput
                  canonName={canonProvincia}
                  value={form?.[canonProvincia]}
                  onChange={(e) => setValue(canonProvincia, e.target.value)}
                  onBlur={(e) => commitSuggestion(canonProvincia, e.target.value)}
                  suggestions={suggestions}
                  placeholder="Provincia…"
                  autoComplete="address-level1"
                />
              </div>
            )}
            {canonNacimientoPaciente && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Lugar de Nacimiento</label>
                <AutoInput
                  canonName={canonNacimientoPaciente}
                  value={form?.[canonNacimientoPaciente]}
                  onChange={(e) => setValue(canonNacimientoPaciente, e.target.value)}
                  onBlur={(e) => commitSuggestion(canonNacimientoPaciente, e.target.value)}
                  suggestions={suggestions}
                  placeholder="Ciudad, Provincia…"
                />
              </div>
            )}
          </div>
        </section>
      )}

      <div className={styles.fechaSection}>
        <label className={styles.fieldLabel}>Fecha estimativa de Cirugía</label>
        <input
          type="date"
          value={fechaEstimada}
          onChange={(e) => setFechaEstimada(e.target.value)}
          className={styles.input}
        />
      </div>
      <div className={styles.actions}>
        <button
          className={styles.primaryBtn}
          onClick={guardarCXYEliminarSolicitud}
          disabled={saving}
        >
          {saving ? "Guardando..." : "Guardar Cirugía"}
        </button>
      </div>
    </>
  );
}
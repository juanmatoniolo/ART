import { useState, useEffect, useRef } from "react";
import styles from "../cx-common.module.css";
import AutoInput from "./AutoInput";
import PacienteSelector from "./PacienteSelector";
import {
  isLikelyCheckbox,
  humanizeKey,
  normalizeName,
  formatNumberWithThousands,
  parseFormattedNumber,
  formatAfiliado,
  ART_LIST,
} from "../_utils/helpers";

export default function FormularioCX({
  form,
  setValue,
  suggestions,
  commitSuggestion,
  canonicalObj,
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
  hasSexo,
  hasLocation,
  orderedResto,
  fechaEstimada,
  setFechaEstimada,
  guardarCXYEliminarSolicitud,
  saving,
  edadCalculada,
  hcLookup,
  onDNIBlur,
  onForceLookupDni,
  onAplicarHC,
  onCrearHC,
  creatingHc,
}) {
  function getCanonFieldType(canonName) {
    const internals = canonicalObj?.canonicalToInternal?.[canonName] || [];
    return mapping?.[internals?.[0]]?.[0]?.field_type;
  }

  function getAutoCompleteAttrWrapper(canonName) {
    const n = normalizeName(canonName);
    if (n === "provincia") return "address-level1";
    if (n === "localidad") return "address-level2";
    if (n.includes("domicilio") || n.includes("direccion"))
      return "street-address";
    if (n.includes("telefono") || n.includes("celular")) return "tel";
    if (n.includes("dni") || n.includes("hc") || n.includes("historia-clinica"))
      return "off";
    if (n.includes("nacimiento") || n.includes("nacmiento"))
      return "address-level2";
    return "on";
  }

  /* ==========================================================
     ✅ FECHA DE CIRUGÍA — estado local (arregla el bug de "no deja escribir")
     ========================================================== */
  const [fechaParts, setFechaParts] = useState(() => {
    if (!fechaEstimada) return { dia: "", mes: "", anio: "" };
    const [y, m, d] = fechaEstimada.split("-");
    return { dia: d || "", mes: m || "", anio: y || "" };
  });

  // Marca si la última actualización de fechaEstimada la hicimos nosotros
  const iAmPushingRef = useRef(false);

  // Sincronizar SOLO cuando fechaEstimada cambia desde afuera
  // (ej: al guardar la cirugía, el padre la resetea a "")
  useEffect(() => {
    if (iAmPushingRef.current) {
      iAmPushingRef.current = false;
      return;
    }
    if (!fechaEstimada) {
      setFechaParts({ dia: "", mes: "", anio: "" });
      return;
    }
    const [y, m, d] = fechaEstimada.split("-");
    setFechaParts({ dia: d || "", mes: m || "", anio: y || "" });
  }, [fechaEstimada]);

  const updateFechaPart = (part, rawValue) => {
    const clean = String(rawValue || "").replace(/\D/g, "");
    const next = { ...fechaParts, [part]: clean };
    setFechaParts(next);

    const d = Number(next.dia);
    const m = Number(next.mes);
    const y = Number(next.anio);
    const dOk = next.dia.length >= 1 && next.dia.length <= 2 && d >= 1 && d <= 31;
    const mOk = next.mes.length >= 1 && next.mes.length <= 2 && m >= 1 && m <= 12;
    const yOk = next.anio.length === 4 && y >= 1900 && y <= 2100;

    const iso =
      dOk && mOk && yOk
        ? `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        : "";

    if (iso !== (fechaEstimada || "")) {
      iAmPushingRef.current = true;
      setFechaEstimada(iso);
    }
  };

  const handlePartBlur = (part) => {
    const v = fechaParts[part];
    if (!v) return;
    const n = Number(v);
    if (part === "dia") {
      const clamped = Math.min(31, Math.max(1, n));
      updateFechaPart("dia", String(clamped).padStart(2, "0"));
    } else if (part === "mes") {
      const clamped = Math.min(12, Math.max(1, n));
      updateFechaPart("mes", String(clamped).padStart(2, "0"));
    } else if (part === "anio") {
      if (v.length === 4) updateFechaPart("anio", v);
    }
  };

  /* ========================================================== */

  // ART select
  const artValue = canonART ? form?.[canonART] || "" : "";
  const artSelectValue = ART_LIST.includes(artValue)
    ? artValue
    : artValue
      ? "OTRA"
      : "";

  // DNI formateado como afiliado
  const handleDNIChange = (e) => {
    if (!canonDNI) return;
    const formatted = formatAfiliado(e.target.value);
    setValue(canonDNI, formatted);
  };

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
              <strong>Paciente seleccionado:</strong>{" "}
              {selectedPaciente.nombreCompleto} (DNI:{" "}
              {selectedPaciente.dni || "—"})
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
              <label className={styles.fieldLabel}>ART</label>
              <select
                className={styles.input}
                value={artSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setValue(canonART, v);
                  if (v !== "OTRA") setValue("__artOtra", "");
                }}
              >
                <option value="">— Seleccionar ART —</option>
                {ART_LIST.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {artSelectValue === "OTRA" && (
                <input
                  className={styles.input}
                  style={{ marginTop: 6 }}
                  value={
                    artValue && artValue !== "OTRA"
                      ? artValue
                      : form.__artOtra || ""
                  }
                  onChange={(e) => {
                    setValue("__artOtra", e.target.value);
                    setValue(canonART, e.target.value);
                  }}
                  placeholder="Especificar ART…"
                />
              )}
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
          {canonDNI && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>
                DNI / N° de afiliado
              </label>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  className={styles.input}
                  inputMode="numeric"
                  autoComplete="off"
                  value={form?.[canonDNI] || ""}
                  onChange={handleDNIChange}
                  onBlur={(e) => onDNIBlur && onDNIBlur(e.target.value)}
                  placeholder="Ej: 20.123.456"
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className={styles.iconBtn}
                  title="Buscar historia clínica por DNI"
                  onClick={onForceLookupDni}
                  disabled={hcLookup?.loading}
                  style={{
                    whiteSpace: "nowrap",
                    padding: "0 14px",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    cursor: "pointer",
                  }}
                >
                  {hcLookup?.loading ? "⏳" : "🔎 HC"}
                </button>
              </div>
              <div className={styles.hint}>
                El N° se usa como DNI y como N° de afiliado.
              </div>
            </div>
          )}
          {(canonHCPaciente || true) && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>N° Historia Clínica</label>
              <input
                className={styles.input}
                inputMode="numeric"
                autoComplete="off"
                value={formatNumberWithThousands(
                  canonHCPaciente
                    ? form?.[canonHCPaciente] ?? form?.__hcExtra ?? ""
                    : form?.__hcExtra ?? "",
                )}
                onChange={(e) => {
                  const parsed = parseFormattedNumber(e.target.value);
                  if (canonHCPaciente) setValue(canonHCPaciente, parsed);
                  setValue("__hcExtra", parsed);
                }}
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

        {hcLookup?.loading && (
          <div
            style={{
              margin: "12px 20px 0",
              padding: "10px 14px",
              background: "rgba(59,130,246,0.1)",
              border: "1px solid rgba(59,130,246,0.35)",
              borderRadius: 10,
              fontSize: 13,
            }}
          >
            ⏳ Buscando DNI <b>{hcLookup.dni}</b> en Historias Clínicas PISO…
          </div>
        )}

        {!hcLookup?.loading && hcLookup?.searched && (
          <div style={{ margin: "12px 20px 0" }}>
            {hcLookup.match ? (
              <div
                style={{
                  background: "rgba(16,185,129,0.1)",
                  border: "1px solid rgba(16,185,129,0.35)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                  🟢 <b>HC PISO #{hcLookup.match.historia_clinica}</b> —
                  Paciente: <b>{hcLookup.match.nombre_apellido}</b>
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    DNI coincidente: {hcLookup.match.dni}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  style={{ padding: "6px 16px", fontSize: 13 }}
                  onClick={() => onAplicarHC(hcLookup.match)}
                >
                  Aplicar HC
                </button>
              </div>
            ) : (
              <div
                style={{
                  background: "rgba(245,158,11,0.1)",
                  border: "1px solid rgba(245,158,11,0.35)",
                  borderRadius: 10,
                  padding: "12px 14px",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>
                  ⚠️ Sin HC <b>PISO</b> para este DNI.
                  <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                    {hcLookup.loadingNext ? (
                      <>⏳ Calculando el próximo N°…</>
                    ) : hcLookup.nextNumber ? (
                      <>
                        Se creará con el N° <b>{hcLookup.nextNumber}</b>.
                      </>
                    ) : (
                      <>Podés crear una nueva (opcional).</>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.primaryBtn}
                  style={{ padding: "6px 16px", fontSize: 13 }}
                  onClick={onCrearHC}
                  disabled={creatingHc || hcLookup.loadingNext}
                >
                  {creatingHc
                    ? "⏳ Creando…"
                    : hcLookup.nextNumber
                      ? `+ Crear HC #${hcLookup.nextNumber}`
                      : "+ Crear HC"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Fecha de Nacimiento */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>🎂</span>
          <h2 className={styles.sectionTitle}>Fecha de Nacimiento</h2>
          <span className={styles.sectionHint}>
            La edad se calcula automáticamente
          </span>
        </div>
        <div className={`${styles.sectionBody} ${styles.cols4}`}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Día</label>
            <input
              className={styles.input}
              autoComplete="off"
              inputMode="numeric"
              value={canonDia ? form?.[canonDia] ?? "" : ""}
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
              value={canonMes ? form?.[canonMes] ?? "" : ""}
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
              value={canonAnio ? form?.[canonAnio] ?? "" : ""}
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

      {/* ✅ Fecha de Cirugía — inputs de texto editables */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>📅</span>
          <h2 className={styles.sectionTitle}>Fecha de Cirugía</h2>
          <span className={styles.sectionHint}>
            Opcional — formato DD / MM / AAAA
          </span>
        </div>
        <div className={`${styles.sectionBody} ${styles.cols4}`}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Día</label>
            <input
              type="text"
              className={styles.input}
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              value={fechaParts.dia}
              onChange={(e) => updateFechaPart("dia", e.target.value)}
              onBlur={() => handlePartBlur("dia")}
              placeholder="DD"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Mes</label>
            <input
              type="text"
              className={styles.input}
              inputMode="numeric"
              autoComplete="off"
              maxLength={2}
              value={fechaParts.mes}
              onChange={(e) => updateFechaPart("mes", e.target.value)}
              onBlur={() => handlePartBlur("mes")}
              placeholder="MM"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Año</label>
            <input
              type="text"
              className={styles.input}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={fechaParts.anio}
              onChange={(e) => updateFechaPart("anio", e.target.value)}
              onBlur={() => handlePartBlur("anio")}
              placeholder="AAAA"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Fecha completa</label>
            <input
              className={`${styles.input} ${styles.inputReadonly}`}
              value={
                fechaEstimada
                  ? (() => {
                      const [y, m, d] = fechaEstimada.split("-");
                      return `${d}/${m}/${y}`;
                    })()
                  : "Sin fecha programada"
              }
              readOnly
              disabled
            />
          </div>
        </div>
      </section>

      {/* Familiar responsable */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>👨‍👩‍👧</span>
          <h2 className={styles.sectionTitle}>Familiar responsable</h2>
          <span className={styles.sectionHint}>Contacto en caso de urgencia</span>
        </div>
        <div className={`${styles.sectionBody} ${styles.cols3}`}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Nombre completo</label>
            <input
              className={styles.input}
              autoComplete="name"
              value={form?.__familiarNombre || ""}
              onChange={(e) => setValue("__familiarNombre", e.target.value)}
              placeholder="Apellido y nombre…"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Parentezco</label>
            <input
              className={styles.input}
              autoComplete="off"
              value={form?.__familiarParentezco || ""}
              onChange={(e) => setValue("__familiarParentezco", e.target.value)}
              placeholder="Ej: Cónyuge, Hijo/a, Madre…"
            />
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Teléfono</label>
            <input
              className={styles.input}
              autoComplete="tel"
              inputMode="tel"
              value={form?.__familiarTelefono || ""}
              onChange={(e) => setValue("__familiarTelefono", e.target.value)}
              placeholder="Ej: 3456 123456"
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
                  onChange={(e) =>
                    setValue(canonDomicilioPaciente, e.target.value)
                  }
                  onBlur={(e) =>
                    commitSuggestion(canonDomicilioPaciente, e.target.value)
                  }
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
                  onBlur={(e) =>
                    commitSuggestion(canonLocalidad, e.target.value)
                  }
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
                  onBlur={(e) =>
                    commitSuggestion(canonProvincia, e.target.value)
                  }
                  suggestions={suggestions}
                  placeholder="Provincia…"
                  autoComplete="address-level1"
                />
              </div>
            )}
            {canonTelefono && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Teléfono paciente</label>
                <input
                  className={styles.input}
                  autoComplete="tel"
                  inputMode="tel"
                  value={form?.[canonTelefono] || ""}
                  onChange={(e) => setValue(canonTelefono, e.target.value)}
                  placeholder="Teléfono del paciente…"
                />
              </div>
            )}
            {canonNacimientoPaciente && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Lugar de Nacimiento</label>
                <AutoInput
                  canonName={canonNacimientoPaciente}
                  value={form?.[canonNacimientoPaciente]}
                  onChange={(e) =>
                    setValue(canonNacimientoPaciente, e.target.value)
                  }
                  onBlur={(e) =>
                    commitSuggestion(canonNacimientoPaciente, e.target.value)
                  }
                  suggestions={suggestions}
                  placeholder="Ciudad, Provincia…"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {/* Datos adicionales del PDF */}
      {orderedResto.length > 0 && (
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📋</span>
            <h2 className={styles.sectionTitle}>
              Datos adicionales del formulario
            </h2>
          </div>
          <div className={`${styles.sectionBody} ${styles.cols3}`}>
            {orderedResto.map((canonName) => {
              const internals =
                canonicalObj?.canonicalToInternal[canonName] || [];
              const isBtn = isLikelyCheckbox(getCanonFieldType(canonName));
              return (
                <div className={styles.field} key={canonName}>
                  <label className={styles.fieldLabel}>
                    {humanizeKey(canonName)}
                  </label>
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
                      onBlur={(e) =>
                        commitSuggestion(canonName, e.target.value)
                      }
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
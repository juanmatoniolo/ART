import { useState, useEffect, useRef } from "react";
import styles from "../cx-common.module.css";
import AutoInput from "./AutoInput";
import PacienteSelector from "./PacienteSelector";
import {
  isLikelyCheckbox, humanizeKey, normalizeName, formatNumberWithThousands,
  parseFormattedNumber, formatAfiliado, ART_LIST,
} from "../_utils/helpers";

export default function FormularioCX({
  form, setValue, suggestions, commitSuggestion, canonicalObj, mapping,
  mode, setMode, selectedPaciente, setSelectedPaciente,
  canonCX, canonDoctor, canonApellido, canonNombre, canonDNI,
  canonEdad, canonEdadPaciente, canonDia, canonMes, canonAnio,
  canonLocalidad, canonProvincia, canonDomicilioPaciente,
  canonNacimientoPaciente, canonHCPaciente, canonART, canonTelefono,
  canonNombres, canonServicio, hasSexo, hasLocation, orderedResto,
  fechaEstimada, setFechaEstimada, guardarCXYEliminarSolicitud,
  saving, edadCalculada, hcLookup, onDNIBlur, onForceLookupDni,
  onAplicarHC, onCrearHC, creatingHc, downloadPdf,
  resetForm,
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

  /* ✅ FECHA DE CIRUGÍA — estado local */
  const [fechaParts, setFechaParts] = useState(() => {
    if (!fechaEstimada) return { dia: "", mes: "", anio: "" };
    const [y, m, d] = fechaEstimada.split("-");
    return { dia: d || "", mes: m || "", anio: y || "" };
  });

  const iAmPushingRef = useRef(false);

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

    const iso = dOk && mOk && yOk ? `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` : "";

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

  /* ART select */
  const artValue = canonART ? form?.[canonART] || "" : "";
  const artSelectValue = ART_LIST.includes(artValue) ? artValue : artValue ? "OTRA" : "";
  const isOtraArt = artSelectValue === "OTRA" || artValue?.toUpperCase().includes("PAMI");

  const handleDNIChange = (e) => {
    if (!canonDNI) return;
    const formatted = formatAfiliado(e.target.value);
    setValue(canonDNI, formatted);
  };

  return (
    <>
      <div className={styles.modeSelector}>
        <button className={`${styles.modeBtn} ${mode === "manual" ? styles.active : ""}`} onClick={() => setMode("manual")}>
          Cargar manualmente
        </button>
        <button className={`${styles.modeBtn} ${mode === "paciente" ? styles.active : ""}`} onClick={() => setMode("paciente")}>
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
              {selectedPaciente.nombreCompleto} (DNI: {selectedPaciente.dni || "—"})
            </div>
          )}
        </div>
      )}

      {/* 1. DATOS DE LA CIRUGÍA */}
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
              <label className={styles.fieldLabel}>ART / O.S. / Cobertura</label>
              <select
                className={styles.input}
                value={artSelectValue}
                onChange={(e) => {
                  const v = e.target.value;
                  setValue(canonART, v);
                  if (v !== "OTRA") setValue("__artOtra", "");
                }}
              >
                <option value="">— Seleccionar —</option>
                {ART_LIST.map((a) => <option key={a} value={a}>{a}</option>)}
                <option value="PAMI">PAMI</option>
              </select>
              {artSelectValue === "OTRA" && (
                <input
                  className={styles.input}
                  style={{ marginTop: 6 }}
                  value={artValue && artValue !== "OTRA" ? artValue : form.__artOtra || ""}
                  onChange={(e) => {
                    setValue("__artOtra", e.target.value);
                    setValue(canonART, e.target.value);
                  }}
                  placeholder="Especificar ART…"
                />
              )}
            </div>
          )}

          {/* CAMPO DE AFILIADO PAMI/OTRA */}
          {isOtraArt && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>N° de Afiliado</label>
              <input
                className={styles.input}
                value={form.__afiliadoPaciente || ""}
                onChange={(e) => setValue("__afiliadoPaciente", e.target.value)}
                placeholder="Ej: 150235285903/00"
              />
            </div>
          )}
        </div>
      </section>

      {/* 2. IDENTIFICACIÓN, CONTACTO Y NACIMIENTO */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionIcon}>👤</span>
          <h2 className={styles.sectionTitle}>Identificación del Paciente</h2>
        </div>

        {/* FILA 1: Datos Principales */}
        <div className={`${styles.sectionBody} ${styles.cols4}`}>
          {canonApellido && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Apellido</label>
              <AutoInput canonName={canonApellido} value={form?.[canonApellido]} onChange={(e) => setValue(canonApellido, e.target.value)} onBlur={(e) => commitSuggestion(canonApellido, e.target.value)} suggestions={suggestions} placeholder="Apellido…" />
            </div>
          )}
          {canonNombre && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Nombre</label>
              <AutoInput canonName={canonNombre} value={form?.[canonNombre]} onChange={(e) => setValue(canonNombre, e.target.value)} onBlur={(e) => commitSuggestion(canonNombre, e.target.value)} suggestions={suggestions} placeholder="Nombre…" />
            </div>
          )}
          {canonDNI && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>DNI</label>
              <div style={{ display: "flex", gap: 6 }}>
                <input className={styles.input} inputMode="numeric" autoComplete="off" value={form?.[canonDNI] || ""} onChange={handleDNIChange} onBlur={(e) => onDNIBlur && onDNIBlur(e.target.value)} placeholder="Ej: 20.123.456" style={{ flex: 1 }} />
                <button type="button" className={styles.iconBtn} title="Buscar HC" onClick={onForceLookupDni} disabled={hcLookup?.loading} style={{ padding: "0 12px" }}>
                  {hcLookup?.loading ? "⏳" : "🔎 HC"}
                </button>
              </div>
            </div>
          )}
          <div className={styles.field}>
            <label className={styles.fieldLabel}>N° Historia Clínica</label>
            <input className={styles.input} inputMode="numeric" autoComplete="off" value={formatNumberWithThousands(canonHCPaciente ? form?.[canonHCPaciente] ?? form?.__hcExtra ?? "" : form?.__hcExtra ?? "")} onChange={(e) => { const parsed = parseFormattedNumber(e.target.value); if (canonHCPaciente) setValue(canonHCPaciente, parsed); setValue("__hcExtra", parsed); }} placeholder="Ej: 12.345.678" />
          </div>
        </div>

        {/* FILA 2: Nacimiento, Edad y Sexo */}
        <div className={`${styles.sectionBody} ${styles.cols4}`} style={{ paddingTop: 0 }}>
          <div className={styles.field} style={{ gridColumn: "span 2" }}>
            <label className={styles.fieldLabel}>Fecha de Nacimiento</label>
            <div style={{ display: "flex", gap: "6px" }}>
              <input className={styles.input} style={{ width: "70px", textAlign: "center" }} placeholder="DD" maxLength={2} value={canonDia ? form?.[canonDia] ?? "" : ""} onChange={(e) => canonDia && setValue(canonDia, e.target.value)} />
              <input className={styles.input} style={{ width: "70px", textAlign: "center" }} placeholder="MM" maxLength={2} value={canonMes ? form?.[canonMes] ?? "" : ""} onChange={(e) => canonMes && setValue(canonMes, e.target.value)} />
              <input className={styles.input} style={{ width: "90px", textAlign: "center" }} placeholder="AAAA" maxLength={4} value={canonAnio ? form?.[canonAnio] ?? "" : ""} onChange={(e) => canonAnio && setValue(canonAnio, e.target.value)} />
            </div>
          </div>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Edad</label>
            <input className={`${styles.input} ${styles.inputReadonly}`} value={edadCalculada ? `${edadCalculada} años` : "—"} readOnly disabled />
          </div>
          {hasSexo && (
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Sexo</label>
              <div className={styles.sexRowInline}>
                <button type="button" className={`${styles.chip} ${form.sexo === "M" ? styles.chipActive : ""}`} onClick={() => setValue("sexo", form.sexo === "M" ? "" : "M")}>M</button>
                <button type="button" className={`${styles.chip} ${form.sexo === "F" ? styles.chipActive : ""}`} onClick={() => setValue("sexo", form.sexo === "F" ? "" : "F")}>F</button>
              </div>
            </div>
          )}
        </div>

        {/* FILA 3: Contacto y Domicilio */}
        {hasLocation && (
          <div className={`${styles.sectionBody} ${styles.cols4}`} style={{ paddingTop: 0 }}>
            {canonTelefono && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Teléfono Paciente</label>
                <input className={styles.input} autoComplete="tel" inputMode="tel" value={form?.[canonTelefono] || ""} onChange={(e) => setValue(canonTelefono, e.target.value)} placeholder="Teléfono" />
              </div>
            )}
            {canonDomicilioPaciente && (
              <div className={styles.field} style={{ gridColumn: "span 2" }}>
                <label className={styles.fieldLabel}>Domicilio</label>
                <AutoInput canonName={canonDomicilioPaciente} value={form?.[canonDomicilioPaciente]} onChange={(e) => setValue(canonDomicilioPaciente, e.target.value)} onBlur={(e) => commitSuggestion(canonDomicilioPaciente, e.target.value)} suggestions={suggestions} placeholder="Calle y Número…" />
              </div>
            )}
            {canonLocalidad && (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Localidad</label>
                <AutoInput canonName={canonLocalidad} value={form?.[canonLocalidad]} onChange={(e) => setValue(canonLocalidad, e.target.value)} onBlur={(e) => commitSuggestion(canonLocalidad, e.target.value)} suggestions={suggestions} placeholder="Localidad…" />
              </div>
            )}
          </div>
        )}

        {/* FILA 4: Provincia y Lugar de Nacimiento */}
        {hasLocation && (
          <div className={`${styles.sectionBody} ${styles.cols4}`} style={{ paddingTop: 0 }}>
            {canonProvincia && (
              <div className={styles.field} style={{ gridColumn: "span 2" }}>
                <label className={styles.fieldLabel}>Provincia</label>
                <AutoInput canonName={canonProvincia} value={form?.[canonProvincia]} onChange={(e) => setValue(canonProvincia, e.target.value)} onBlur={(e) => commitSuggestion(canonProvincia, e.target.value)} suggestions={suggestions} placeholder="Provincia…" />
              </div>
            )}
            {canonNacimientoPaciente && (
              <div className={styles.field} style={{ gridColumn: "span 2" }}>
                <label className={styles.fieldLabel}>Lugar de Nacimiento</label>
                <AutoInput canonName={canonNacimientoPaciente} value={form?.[canonNacimientoPaciente]} onChange={(e) => setValue(canonNacimientoPaciente, e.target.value)} onBlur={(e) => commitSuggestion(canonNacimientoPaciente, e.target.value)} suggestions={suggestions} placeholder="Ciudad, Provincia…" />
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. FECHA DE CIRUGÍA Y FAMILIAR (FUSIONADOS EN UNA FILA PARA AHORRAR ESPACIO) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", alignItems: "start" }}>
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>📅</span>
            <h2 className={styles.sectionTitle}>Fecha de Cirugía</h2>
            <span className={styles.sectionHint}>Opcional</span>
          </div>
          <div className={`${styles.sectionBody} ${styles.cols4}`}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Día</label>
              <input type="text" className={styles.input} inputMode="numeric" autoComplete="off" maxLength={2} value={fechaParts.dia} onChange={(e) => updateFechaPart("dia", e.target.value)} onBlur={() => handlePartBlur("dia")} placeholder="DD" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Mes</label>
              <input type="text" className={styles.input} inputMode="numeric" autoComplete="off" maxLength={2} value={fechaParts.mes} onChange={(e) => updateFechaPart("mes", e.target.value)} onBlur={() => handlePartBlur("mes")} placeholder="MM" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Año</label>
              <input type="text" className={styles.input} inputMode="numeric" autoComplete="off" maxLength={4} value={fechaParts.anio} onChange={(e) => updateFechaPart("anio", e.target.value)} onBlur={() => handlePartBlur("anio")} placeholder="AAAA" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Completa</label>
              <input className={`${styles.input} ${styles.inputReadonly}`} value={fechaEstimada ? (() => { const [y, m, d] = fechaEstimada.split("-"); return `${d}/${m}/${y}`; })() : "—"} readOnly disabled />
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionIcon}>👨‍👩‍👧</span>
            <h2 className={styles.sectionTitle}>Familiar responsable</h2>
          </div>
          <div className={`${styles.sectionBody} ${styles.cols3}`}>
            <div className={styles.field} style={{ gridColumn: "span 2" }}>
              <label className={styles.fieldLabel}>Nombre completo</label>
              <input className={styles.input} autoComplete="name" value={form?.__familiarNombre || ""} onChange={(e) => setValue("__familiarNombre", e.target.value)} placeholder="Apellido y nombre…" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Parentezco</label>
              <input className={styles.input} autoComplete="off" value={form?.__familiarParentezco || ""} onChange={(e) => setValue("__familiarParentezco", e.target.value)} placeholder="Ej: Cónyuge" />
            </div>
            <div className={styles.field} style={{ gridColumn: "span 3" }}>
              <label className={styles.fieldLabel}>Teléfono Familiar</label>
              <input className={styles.input} autoComplete="tel" inputMode="tel" value={form?.__familiarTelefono || ""} onChange={(e) => setValue("__familiarTelefono", e.target.value)} placeholder="Ej: 3456 123456" />
            </div>
          </div>
        </section>
      </div>



      {/* ACCIONES FINALES */}
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginTop: "2rem", paddingBottom: "2rem", borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "1.5rem" }}>
        {/* Botón Limpiar a la izquierda */}
        <button
          type="button"
          onClick={resetForm}
          style={{
            background: "transparent",
            border: "1px solid #e5534b",
            color: "#e5534b",
            padding: "0.6rem 1.2rem",
            borderRadius: "8px",
            cursor: "pointer",
            fontWeight: "600",
            fontSize: "0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s"
          }}
        >
          🗑️ Limpiar Formulario
        </button>

        {/* Botones de acción a la derecha */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => downloadPdf("Frente")}
            style={{
              background: "#1a2335",
              color: "#cbd5e1",
              border: "1px solid #2d3a4f",
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
          >
            ⬇️ Frente
          </button>

          <button
            type="button"
            onClick={() => downloadPdf("Dorso")}
            style={{
              background: "#1a2335",
              color: "#cbd5e1",
              border: "1px solid #2d3a4f",
              padding: "0.6rem 1.2rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "0.9rem",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s"
            }}
          >
            ⬇️ Dorso
          </button>
        </div>
      </div>
    </>
  );
}
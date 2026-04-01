"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./PacienteForm.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

const ART_OPTIONS = [
  "Asociart", "COMFYE", "Federacion patronal AP", "Federacion patronal ART",
  "IAPS AP", "IAPS ART", "La segunda ART", "La segunda personas",
  "Medicar work", "Victoria seguros",
];

const today = new Date();
const defaultDay   = String(today.getDate()).padStart(2, "0");
const defaultMonth = String(today.getMonth() + 1).padStart(2, "0");
const defaultYear  = String(today.getFullYear());

function calcularEdad(nacimiento) {
  if (!nacimiento) return "";
  const [y, m, d] = nacimiento.split("-").map(Number);
  if (!y || !m || !d) return "";
  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
  return edad >= 0 ? String(edad) : "";
}

function onlyDigits(s) { return (s ?? "").toString().replace(/\D/g, ""); }

function formatCuitIf11(value) {
  const d = onlyDigits(value);
  if (d.length !== 11) return value;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export const emptyFormData = () => ({
  ART:         { nombre: "", nroSiniestro: "" },
  empleador:   { nombre: "", cuit: "" },
  trabajador:  {
    apellido: "", nombre: "", dni: "", nacimiento: "", edad: "",
    sexo: "", calle: "", numero: "", piso: "", depto: "",
    localidad: "", provincia: "", cp: "", telefono: "",
  },
  consulta:    { tipo: "" },
  fechaIngreso:  { dia: defaultDay, mes: defaultMonth, anio: defaultYear, iso: "" },
  fechaDenuncia: { dia: defaultDay, mes: defaultMonth, anio: defaultYear, iso: "" },
  prestador:   {},
});

// ─── Sub-componentes ──────────────────────────────────────────────────────────
function Field({ label, children, error, full }) {
  return (
    <div className={`${styles.field} ${full ? styles.fieldFull : ""}`}>
      <label className={styles.label}>{label}</label>
      {children}
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h3 className={styles.sectionTitle}>{title}</h3>
        {subtitle && <p className={styles.sectionHint}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function DatePartInput({ label, value, onChange, placeholder, maxLength, error }) {
  return (
    <div className={styles.datePart}>
      <label className={styles.label}>{label}</label>
      <input
        className={`${styles.input} ${error ? styles.inputError : ""}`}
        value={value}
        onChange={onChange}
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {error && <span className={styles.errorText}>{error}</span>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
/**
 * Props:
 *  - mode: "nuevo" | "editar"
 *  - initialData: objeto paciente completo (solo en modo editar)
 *  - pacienteId: string (solo en modo editar)
 */
export default function PacienteForm({ mode = "nuevo", initialData = null, pacienteId = null }) {
  const router = useRouter();
  const isEdit = mode === "editar";

  const [formData, setFormData]   = useState(initialData || emptyFormData());
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving]       = useState(false);
  const submittingRef             = useRef(false);

  // ── Handlers ──
  const setField = (section, field, value) => {
    setFormData((prev) =>
      section
        ? { ...prev, [section]: { ...prev[section], [field]: value } }
        : { ...prev, [field]: value }
    );
  };

  const handleTrabajador = (field, value) => {
    setFormData((prev) => {
      const t = { ...prev.trabajador, [field]: value };
      if (field === "nacimiento") t.edad = calcularEdad(value);
      return { ...prev, trabajador: t };
    });
  };

  // ── Validación ──
  const validate = () => {
    const e = {};
    const dni = onlyDigits(formData.trabajador.dni);
    if (dni && (dni.length < 7 || dni.length > 9)) e.trabajadorDni = "DNI inválido (7–9 dígitos)";
    const tel = onlyDigits(formData.trabajador.telefono);
    if (tel && tel.length < 8) e.trabajadorTelefono = "Teléfono inválido";
    const vf = (dia, mes, anio, p) => {
      const d = Number(dia), m = Number(mes), a = Number(anio);
      if (dia && (d < 1 || d > 31)) e[`${p}Dia`] = "Día inválido";
      if (mes && (m < 1 || m > 12)) e[`${p}Mes`] = "Mes inválido";
      if (anio && (a < 1900 || a > 2100)) e[`${p}Anio`] = "Año inválido";
    };
    vf(formData.fechaIngreso.dia,  formData.fechaIngreso.mes,  formData.fechaIngreso.anio,  "ingreso");
    vf(formData.fechaDenuncia.dia, formData.fechaDenuncia.mes, formData.fechaDenuncia.anio, "denuncia");
    return e;
  };

  // ── Submit ──
  const handleSave = async (e) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSaving(true);

    const errors = validate();
    if (Object.keys(errors).length) {
      setFormErrors(errors);
      submittingRef.current = false;
      setSaving(false);
      return;
    }

    try {
      const isoIngreso  = `${formData.fechaIngreso.anio}-${formData.fechaIngreso.mes.padStart(2,"0")}-${formData.fechaIngreso.dia.padStart(2,"0")}`;
      const isoDenuncia = `${formData.fechaDenuncia.anio}-${formData.fechaDenuncia.mes.padStart(2,"0")}-${formData.fechaDenuncia.dia.padStart(2,"0")}`;

      const now = Date.now();

      // En modo EDITAR: PUT al ID existente, preservando createdAt y estado original
      // En modo NUEVO: POST para crear, con createdAt = now y estado = "activo"
      const payload = {
        ...formData,
        fechaIngreso:  { ...formData.fechaIngreso,  iso: isoIngreso  },
        fechaDenuncia: { ...formData.fechaDenuncia, iso: isoDenuncia },
        updatedAt: now,
        ...(isEdit
          ? {
              // Preservar createdAt y estado del registro original
              createdAt: initialData?.createdAt || now,
              estado:    initialData?.estado    || "activo",
            }
          : {
              createdAt: now,
              estado: "activo",   // Todo siniestro nuevo arranca activo
            }
        ),
      };

      const url    = isEdit
        ? `${FIREBASE_URL}/pacientes/${pacienteId}.json`
        : `${FIREBASE_URL}/pacientes.json`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Error al guardar");

      router.push("/admin/pacientes");
    } catch (err) {
      console.error(err);
      alert("Error al guardar el paciente. Intentá de nuevo.");
    } finally {
      submittingRef.current = false;
      setSaving(false);
    }
  };

  // ── Render ──
  return (
    <div className={styles.container}>
      {/* Breadcrumb */}
      <div className={styles.breadcrumb}>
        <button className={styles.backLink} onClick={() => router.push("/admin/pacientes")}>
          ← Pacientes
        </button>
        <span className={styles.breadcrumbSep}>/</span>
        <span className={styles.breadcrumbCurrent}>
          {isEdit ? "Editar Paciente" : "Nuevo Paciente"}
        </span>
      </div>

      {/* Título */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>
            {isEdit ? "Editar Paciente" : "Nuevo Paciente"}
          </h1>
          {isEdit && initialData?.trabajador && (
            <p className={styles.pageSubtitle}>
              {initialData.trabajador.apellido} {initialData.trabajador.nombre}
              {initialData.createdAt && (
                <span className={styles.ingresoChip}>
                  Ingresado: {new Date(initialData.createdAt).toLocaleDateString("es-AR")}
                </span>
              )}
              <span className={`${styles.estadoChip} ${styles[`estado_${initialData.estado || "activo"}`]}`}>
                {initialData.estado || "activo"}
              </span>
            </p>
          )}
        </div>
      </div>

      {/* Formulario */}
      <form onSubmit={handleSave} className={styles.form} noValidate>

        {/* ── ART + Motivo ── */}
        <Section title="ART + Motivo" subtitle="Todos los campos son opcionales">
          <div className={styles.grid}>
            <Field label="ART">
              <select
                className={styles.input}
                value={formData.ART.nombre}
                onChange={(e) => setField("ART", "nombre", e.target.value)}
              >
                <option value="">Seleccione una ART</option>
                {ART_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </Field>

            <Field label="N° Siniestro">
              <input
                type="text"
                className={styles.input}
                value={formData.ART.nroSiniestro}
                onChange={(e) => setField("ART", "nroSiniestro", e.target.value)}
                placeholder="Opcional"
              />
            </Field>

            <Field label="Motivo de consulta" full>
              <div className={styles.chips}>
                {[["AT","Accidente de trabajo"],["AIT","Acc. In Itinere"],["EP","Enf. Profesional"],["INT","Intercurrencia"]].map(([val, label]) => (
                  <label key={val} className={`${styles.chip} ${formData.consulta.tipo === val ? styles.chipActive : ""}`}>
                    <input type="radio" name="motivo" value={val}
                      checked={formData.consulta.tipo === val}
                      onChange={(e) => setField("consulta", "tipo", e.target.value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Section>

        {/* ── Fechas ── */}
        <Section title="Fechas" subtitle="Fecha de ingreso y fecha de denuncia">
          <div className={styles.fechasWrapper}>
            <div className={styles.fechaGroup}>
              <div className={styles.fechaGroupLabel}>Fecha de ingreso</div>
              <div className={styles.fechaRow}>
                <DatePartInput label="Día"  value={formData.fechaIngreso.dia}  onChange={(e) => setField("fechaIngreso","dia",e.target.value)}  placeholder="DD"   maxLength={2} error={formErrors.ingresoDia}  />
                <DatePartInput label="Mes"  value={formData.fechaIngreso.mes}  onChange={(e) => setField("fechaIngreso","mes",e.target.value)}  placeholder="MM"   maxLength={2} error={formErrors.ingresoMes}  />
                <DatePartInput label="Año"  value={formData.fechaIngreso.anio} onChange={(e) => setField("fechaIngreso","anio",e.target.value)} placeholder="AAAA" maxLength={4} error={formErrors.ingresoAnio} />
              </div>
            </div>
            <div className={styles.fechaGroup}>
              <div className={styles.fechaGroupLabel}>Fecha de denuncia</div>
              <div className={styles.fechaRow}>
                <DatePartInput label="Día"  value={formData.fechaDenuncia.dia}  onChange={(e) => setField("fechaDenuncia","dia",e.target.value)}  placeholder="DD"   maxLength={2} error={formErrors.denunciaDia}  />
                <DatePartInput label="Mes"  value={formData.fechaDenuncia.mes}  onChange={(e) => setField("fechaDenuncia","mes",e.target.value)}  placeholder="MM"   maxLength={2} error={formErrors.denunciaMes}  />
                <DatePartInput label="Año"  value={formData.fechaDenuncia.anio} onChange={(e) => setField("fechaDenuncia","anio",e.target.value)} placeholder="AAAA" maxLength={4} error={formErrors.denunciaAnio} />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Empleador ── */}
        <Section title="Empleador" subtitle="Todos los campos son opcionales">
          <div className={styles.grid}>
            <Field label="Nombre empresa">
              <input type="text" className={styles.input} value={formData.empleador.nombre}
                onChange={(e) => setField("empleador","nombre",e.target.value)} placeholder="Razón social" />
            </Field>
            <Field label="CUIT / DNI">
              <input type="text" className={styles.input} value={formData.empleador.cuit}
                onChange={(e) => setField("empleador","cuit",e.target.value)}
                onBlur={(e) => setField("empleador","cuit",formatCuitIf11(e.target.value))}
                placeholder="Solo números" />
            </Field>
          </div>
        </Section>

        {/* ── Trabajador ── */}
        <Section title="Trabajador" subtitle="Todos los campos son opcionales">
          <div className={styles.grid}>
            <Field label="Apellido">
              <input type="text" className={styles.input} value={formData.trabajador.apellido}
                onChange={(e) => handleTrabajador("apellido", e.target.value)} placeholder="Apellido" />
            </Field>
            <Field label="Nombre">
              <input type="text" className={styles.input} value={formData.trabajador.nombre}
                onChange={(e) => handleTrabajador("nombre", e.target.value)} placeholder="Nombre" />
            </Field>
            <Field label="DNI" error={formErrors.trabajadorDni}>
              <input type="text"
                className={`${styles.input} ${formErrors.trabajadorDni ? styles.inputError : ""}`}
                value={formData.trabajador.dni}
                onChange={(e) => handleTrabajador("dni", e.target.value)} placeholder="DNI" />
            </Field>
            <Field label="Fecha de nacimiento">
              <input type="date" className={styles.input} value={formData.trabajador.nacimiento}
                onChange={(e) => handleTrabajador("nacimiento", e.target.value)} />
            </Field>
            <Field label="Edad (calculada)">
              <input type="text" className={`${styles.input} ${styles.inputReadonly}`}
                value={formData.trabajador.edad ? `${formData.trabajador.edad} años` : ""}
                readOnly placeholder="Se calcula automáticamente" />
            </Field>
            <Field label="Sexo">
              <div className={styles.chips}>
                {["M","F"].map((val) => (
                  <label key={val} className={`${styles.chip} ${formData.trabajador.sexo === val ? styles.chipActive : ""}`}>
                    <input type="radio" name="sexo" value={val}
                      checked={formData.trabajador.sexo === val}
                      onChange={(e) => handleTrabajador("sexo", e.target.value)} />
                    {val === "M" ? "Masculino" : "Femenino"}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Teléfono" error={formErrors.trabajadorTelefono}>
              <input type="tel"
                className={`${styles.input} ${formErrors.trabajadorTelefono ? styles.inputError : ""}`}
                value={formData.trabajador.telefono}
                onChange={(e) => handleTrabajador("telefono", e.target.value)} placeholder="Teléfono" />
            </Field>
            <Field label="Calle">
              <input type="text" className={styles.input} value={formData.trabajador.calle}
                onChange={(e) => handleTrabajador("calle", e.target.value)} placeholder="Calle" />
            </Field>
            <Field label="Número">
              <input type="text" className={styles.input} value={formData.trabajador.numero}
                onChange={(e) => handleTrabajador("numero", e.target.value)} placeholder="N°" />
            </Field>
            <Field label="Piso">
              <input type="text" className={styles.input} value={formData.trabajador.piso}
                onChange={(e) => handleTrabajador("piso", e.target.value)} placeholder="Piso" />
            </Field>
            <Field label="Depto">
              <input type="text" className={styles.input} value={formData.trabajador.depto}
                onChange={(e) => handleTrabajador("depto", e.target.value)} placeholder="Depto" />
            </Field>
            <Field label="Localidad">
              <input type="text" className={styles.input} value={formData.trabajador.localidad}
                onChange={(e) => handleTrabajador("localidad", e.target.value)} placeholder="Localidad" />
            </Field>
            <Field label="Provincia">
              <input type="text" className={styles.input} value={formData.trabajador.provincia}
                onChange={(e) => handleTrabajador("provincia", e.target.value)} placeholder="Provincia" />
            </Field>
            <Field label="Código Postal">
              <input type="text" className={styles.input} value={formData.trabajador.cp}
                onChange={(e) => handleTrabajador("cp", e.target.value)} placeholder="CP" />
            </Field>
          </div>
        </Section>

        {/* ── Acciones ── */}
        <div className={styles.formActions}>
          <button type="button" className={styles.cancelBtn} onClick={() => router.push("/admin/pacientes")}>
            Cancelar
          </button>
          <button type="submit" className={styles.saveBtn} disabled={saving}>
            {saving
              ? (isEdit ? "Guardando cambios..." : "Guardando...")
              : (isEdit ? "Guardar cambios" : "Crear paciente")
            }
          </button>
        </div>

      </form>
    </div>
  );
}
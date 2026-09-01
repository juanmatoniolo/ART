"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { push, ref, set, get, child, update } from "firebase/database";
import styles from "./PacienteForm.module.css";

const STORAGE_KEY = "paciente_form_v2";
const THEME_KEY = "paciente_theme";

const PRESTADOR_CONST = {
  nombre: "CLINICA DE LA UNION S.A",
  cuit: "30-70754530-1",
  calle: "Av. Siburu",
  nro: "1085",
  piso: "-",
  depto: "-",
  localidad: "Chajari",
  provincia: "Entre Rios",
  cp: "3228",
  celular: "3456-441580",
  mail: "clinicadelaunionart@gmail.com",
};

const ART_OPTIONS = [
  "Asociart",
  "COMFYE",
  "Federacion patronal AP",
  "Federacion patronal ART",
  "IAPS AP",
  "IAPS ART",
  "La segunda ART",
  "La segunda personas",
  "Medicar work",
  "Victoria seguros",
  "Reconquista ART",
];

const today = new Date();
const defaultDay = String(today.getDate()).padStart(2, "0");
const defaultMonth = String(today.getMonth() + 1).padStart(2, "0");
const defaultYear = String(today.getFullYear());

function calcularEdad(nacimiento) {
  if (!nacimiento) return "";
  const [y, m, d] = nacimiento.split("-").map(Number);
  if (!y || !m || !d) return "";
  const hoy = new Date();
  let edad = hoy.getFullYear() - y;
  const mesActual = hoy.getMonth() + 1;
  const diaActual = hoy.getDate();
  if (mesActual < m || (mesActual === m && diaActual < d)) edad--;
  return edad >= 0 ? String(edad) : "";
}

function onlyDigits(s) {
  return (s ?? "").toString().replace(/\D/g, "");
}

function formatCuil(digits) {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}.${digits.slice(4, 7)}.${digits.slice(7, 10)}-${digits.slice(10)}`;
}

function formatDni(digits) {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatIdField(value) {
  const d = onlyDigits(value);
  if (!d) return value;
  if (d.length === 11) return formatCuil(d);
  return formatDni(d);
}

export const emptyFormData = () => ({
  ART: "",
  nroSiniestro: "",
  empleadorNombre: "",
  empleadorCuitDni: "",
  trabajadorApellido: "",
  trabajadorNombre: "",
  trabajadorDni: "",
  trabajadorNacimiento: "",
  trabajadorSexo: "",
  trabajadorCalle: "",
  trabajadorNumero: "",
  trabajadorPiso: "",
  trabajadorDepto: "",
  trabajadorLocalidad: "",
  trabajadorProvincia: "",
  trabajadorCP: "",
  trabajadorTelefono: "",
  diaIngreso: defaultDay,
  mesIngreso: defaultMonth,
  anioIngreso: defaultYear,
  diaDenuncia: defaultDay,
  mesDenuncia: defaultMonth,
  anioDenuncia: defaultYear,
  trabajadorEdad: "",
  estado: "abierto",
});

function validate(f) {
  const e = {};
  const empId = onlyDigits(f.empleadorCuitDni);
  if (empId && empId.length < 8 && empId.length > 0) {
    e.empleadorCuitDni = "Debe tener al menos 8 números si se completa";
  }

  const dni = onlyDigits(f.trabajadorDni);
  if (dni && !((dni.length >= 7 && dni.length <= 9) || dni.length === 11)) {
    e.trabajadorDni = "Documento inválido (7-9 dígitos para DNI o 11 para CUIL)";
  }

  const tel = onlyDigits(f.trabajadorTelefono);
  if (tel && tel.length < 8) {
    e.trabajadorTelefono = "Teléfono inválido";
  }

  const validarFecha = (dia, mes, anio, prefix) => {
    if (!dia && !mes && !anio) return;
    const d = Number(dia), m = Number(mes), a = Number(anio);
    if (dia && (d < 1 || d > 31)) e[`${prefix}Dia`] = "Día inválido";
    if (mes && (m < 1 || m > 12)) e[`${prefix}Mes`] = "Mes inválido";
    if (anio && (a < 1900 || a > 2100)) e[`${prefix}Anio`] = "Año inválido";
  };
  validarFecha(f.diaIngreso, f.mesIngreso, f.anioIngreso, "ingreso");
  validarFecha(f.diaDenuncia, f.mesDenuncia, f.anioDenuncia, "denuncia");
  return e;
}

function cx(...cls) {
  return cls.filter(Boolean).join(" ");
}

// Subcomponentes
function Field({ label, children, error, full }) {
  return (
    <div className={cx(styles.field, full && styles.fieldFull)}>
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

function DatePartInput({ label, value, onChange, placeholder, maxLength, error, className }) {
  return (
    <div className={cx(styles.datePart, className)}>
      <label className={styles.label}>{label}</label>
      <input
        className={cx(styles.input, error && styles.inputError)}
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

// Componente principal
export default function PacienteForm({ mode = "nuevo", initialData = null, pacienteId = null }) {
  const router = useRouter();
  const isEdit = mode === "editar";

  const [activeTab, setActiveTab] = useState(isEdit ? "nuevo" : "nuevo");
  const [form, setForm] = useState(() => {
    if (isEdit && initialData) {
      const t = initialData.trabajador || {};
      const emp = initialData.empleador || {};
      const art = initialData.ART || {};
      const fi = initialData.fechaIngreso || {};
      const fd = initialData.fechaDenuncia || {};
      return {
        ART: art.nombre || "",
        nroSiniestro: art.nroSiniestro || "",
        empleadorNombre: emp.nombre || "",
        empleadorCuitDni: emp.cuit || "",
        trabajadorApellido: t.apellido || "",
        trabajadorNombre: t.nombre || "",
        trabajadorDni: t.dni || "",
        trabajadorNacimiento: t.nacimiento || "",
        trabajadorSexo: t.sexo || "",
        trabajadorCalle: t.calle || "",
        trabajadorNumero: t.numero || "",
        trabajadorPiso: t.piso || "",
        trabajadorDepto: t.depto || "",
        trabajadorLocalidad: t.localidad || "",
        trabajadorProvincia: t.provincia || "",
        trabajadorCP: t.cp || "",
        trabajadorTelefono: t.telefono || "",
        diaIngreso: fi.dia || defaultDay,
        mesIngreso: fi.mes || defaultMonth,
        anioIngreso: fi.anio || defaultYear,
        diaDenuncia: fd.dia || defaultDay,
        mesDenuncia: fd.mes || defaultMonth,
        anioDenuncia: fd.anio || defaultYear,
        trabajadorEdad: t.edad || "",
        estado: initialData.estado || "abierto",
      };
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { ...emptyFormData(), ...JSON.parse(raw) };
    } catch { }
    return emptyFormData();
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [theme, setTheme] = useState("dark");
  const [shouldFocusError, setShouldFocusError] = useState(false);

  const [pacientes, setPacientes] = useState([]);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingId, setEditingId] = useState(isEdit ? pacienteId : null);

  const submittingRef = useRef(false);

  // Tema
  useEffect(() => {
    const savedTheme = localStorage.getItem(THEME_KEY) || "dark";
    setTheme(savedTheme);
    document.body.classList.toggle("light-mode", savedTheme === "light");
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    document.body.classList.toggle("light-mode", newTheme === "light");
  };

  // Persistencia local
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      } catch { }
    }, 250);
    return () => clearTimeout(timer);
  }, [form]);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      trabajadorEdad: calcularEdad(prev.trabajadorNacimiento),
    }));
  }, [form.trabajadorNacimiento]);

  useEffect(() => {
    if (shouldFocusError && Object.keys(errors).length > 0) {
      const timer = setTimeout(() => {
        const errorField = document.querySelector(`.${styles.inputError}`);
        if (errorField) {
          errorField.focus();
          errorField.scrollIntoView({ behavior: "smooth", block: "center" });
        }
        setShouldFocusError(false);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [shouldFocusError, errors]);

  useEffect(() => {
    if (activeTab === "buscar") {
      fetchAllPacientes();
    }
  }, [activeTab]);

  const fetchAllPacientes = async () => {
    setLoadingPacientes(true);
    try {
      const snapshot = await get(child(ref(db), "pacientes"));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const arr = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPacientes(arr);
      } else {
        setPacientes([]);
      }
    } catch (error) {
      console.error("Error cargando pacientes:", error);
    } finally {
      setLoadingPacientes(false);
    }
  };

  const canSubmit = useMemo(() => !saving, [saving]);

  const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const onBlurCuitDni = () => {
    setForm((p) => ({ ...p, empleadorCuitDni: formatIdField(p.empleadorCuitDni) }));
  };

  const onBlurTrabajadorDni = () => {
    setForm((p) => ({ ...p, trabajadorDni: formatIdField(p.trabajadorDni) }));
  };

  const handleEditPaciente = (paciente) => {
    const t = paciente.trabajador || {};
    const emp = paciente.empleador || {};
    const art = paciente.ART || {};
    const fi = paciente.fechaIngreso || {};
    const fd = paciente.fechaDenuncia || {};

    setForm({
      ART: art.nombre || "",
      nroSiniestro: art.nroSiniestro || "",
      empleadorNombre: emp.nombre || "",
      empleadorCuitDni: emp.cuit || "",
      trabajadorApellido: t.apellido || "",
      trabajadorNombre: t.nombre || "",
      trabajadorDni: t.dni || "",
      trabajadorNacimiento: t.nacimiento || "",
      trabajadorSexo: t.sexo || "",
      trabajadorCalle: t.calle || "",
      trabajadorNumero: t.numero || "",
      trabajadorPiso: t.piso || "",
      trabajadorDepto: t.depto || "",
      trabajadorLocalidad: t.localidad || "",
      trabajadorProvincia: t.provincia || "",
      trabajadorCP: t.cp || "",
      trabajadorTelefono: t.telefono || "",
      diaIngreso: fi.dia || defaultDay,
      mesIngreso: fi.mes || defaultMonth,
      anioIngreso: fi.anio || defaultYear,
      diaDenuncia: fd.dia || defaultDay,
      mesDenuncia: fd.mes || defaultMonth,
      anioDenuncia: fd.anio || defaultYear,
      trabajadorEdad: t.edad || "",
      estado: paciente.estado || "abierto",
    });
    setEditingId(paciente.id);
    setActiveTab("nuevo");
    setCreatedId(null);
    setPdfError(null);
    setPdfUrl(null);
    setPdfFileName(null);
  };

  const handlePrintPaciente = async (paciente) => {
    try {
      const payload = {
        ...paciente,
        prestador: paciente.prestador || PRESTADOR_CONST,
      };
      const apellido = payload.trabajador?.apellido || "SIN_APELLIDO";
      const dni = onlyDigits(payload.trabajador?.dni) || "SIN_DNI";
      const nroSiniestro = payload.ART?.nroSiniestro || "SINIESTRO";
      const fileName = `ART_${apellido}_${dni}_${nroSiniestro}.pdf`;

      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, fileName }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error al generar PDF: ${res.status} ${errorText}`);
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
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el PDF.");
    }
  };

  function openPdf() {
    if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
  }

  function downloadPdf() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = pdfFileName || "FORMULARIO_ART.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;

    setCreatedId(null);
    setPdfError(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setPdfFileName(null);

    const v = validate(form);
    setErrors(v);
    if (Object.keys(v).length) {
      setShouldFocusError(true);
      submittingRef.current = false;
      return;
    }

    setSaving(true);
    try {
      const empleadorCuitFormatted = formatIdField(form.empleadorCuitDni);
      const trabajadorDniFormatted = formatIdField(form.trabajadorDni);

      const payload = {
        ART: {
          nombre: form.ART.trim() || "",
          nroSiniestro: form.nroSiniestro.trim() || "",
        },
        empleador: {
          nombre: form.empleadorNombre.trim() || "",
          cuit: empleadorCuitFormatted || "",
        },
        trabajador: {
          apellido: form.trabajadorApellido.trim() || "",
          nombre: form.trabajadorNombre.trim() || "",
          dni: trabajadorDniFormatted || "",
          nacimiento: form.trabajadorNacimiento || "",
          edad: form.trabajadorEdad,
          sexo: form.trabajadorSexo || "",
          calle: form.trabajadorCalle.trim() || "",
          numero: form.trabajadorNumero.trim() || "",
          piso: form.trabajadorPiso.trim() || "",
          depto: form.trabajadorDepto.trim() || "",
          localidad: form.trabajadorLocalidad.trim() || "",
          provincia: form.trabajadorProvincia.trim() || "",
          cp: onlyDigits(form.trabajadorCP) || "",
          telefono: onlyDigits(form.trabajadorTelefono) || "",
        },
        fechaIngreso: {
          dia: form.diaIngreso,
          mes: form.mesIngreso,
          anio: form.anioIngreso,
          iso: form.anioIngreso && form.mesIngreso && form.diaIngreso
            ? `${form.anioIngreso}-${form.mesIngreso.padStart(2, "0")}-${form.diaIngreso.padStart(2, "0")}`
            : "",
        },
        fechaDenuncia: {
          dia: form.diaDenuncia,
          mes: form.mesDenuncia,
          anio: form.anioDenuncia,
          iso: form.anioDenuncia && form.mesDenuncia && form.diaDenuncia
            ? `${form.anioDenuncia}-${form.mesDenuncia.padStart(2, "0")}-${form.diaDenuncia.padStart(2, "0")}`
            : "",
        },
        prestador: PRESTADOR_CONST,
        estado: form.estado || "abierto",
        updatedAt: Date.now(),
      };

      let savedId;
      if (editingId) {
        await update(ref(db, `pacientes/${editingId}`), payload);
        savedId = editingId;
      } else {
        payload.createdAt = Date.now();
        const newRef = push(ref(db, "pacientes"));
        await set(newRef, payload);
        savedId = newRef.key;
      }
      setCreatedId(savedId);

      const fileName = `ART_${payload.trabajador.apellido || "SIN_APELLIDO"}_${onlyDigits(payload.trabajador.dni) || "SIN_DNI"}_${payload.ART.nroSiniestro || "SINIESTRO"}.pdf`;

      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, fileName }),
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/pdf")) {
        const detail = ct.includes("application/json")
          ? JSON.stringify(await res.json().catch(() => ({})), null, 2)
          : await res.text().catch(() => "");
        console.error("PDF FAIL:", { status: res.status, ct, detail });
        setPdfError(`Falló la generación del PDF (${res.status}). Revisá consola.`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfFileName(fileName);

      setEditingId(null);
      if (activeTab === "buscar") fetchAllPacientes();
    } catch (err) {
      console.error(err);
      setPdfError("Error guardando o generando PDF. Revisá consola.");
    } finally {
      setSaving(false);
      submittingRef.current = false;
    }
  }

  const filteredPacientes = pacientes.filter((p) => {
    const t = p.trabajador || {};
    const fullName = `${t.apellido || ""} ${t.nombre || ""}`.toLowerCase();
    const dni = t.dni || "";
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || dni.includes(term);
  });

  return (
    <div className={cx(styles.page, theme === "light" && styles.lightMode)}>
      <div className={styles.container}>
        {/* Breadcrumb */}
        <div className={styles.breadcrumb}>
          <button className={styles.backLink} onClick={() => router.push("/admin/pacientes")}>
            ← Pacientes
          </button>
          <span className={styles.breadcrumbSep}>/</span>
          <span className={styles.breadcrumbCurrent}>
            {activeTab === "nuevo"
              ? editingId
                ? "Editar Paciente"
                : "Nuevo Paciente"
              : "Buscar Pacientes"}
          </span>
        </div>

        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>
              {activeTab === "nuevo"
                ? editingId
                  ? "Editar Paciente"
                  : "Nuevo Paciente"
                : "Buscar Pacientes"}
            </h1>
            {activeTab === "nuevo" && editingId && (
              <p className={styles.pageSubtitle}>
                {form.trabajadorApellido} {form.trabajadorNombre}
              </p>
            )}
          </div>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={styles.ghostBtn}
              onClick={toggleTheme}
              title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
            >
              {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {activeTab === "nuevo" && (
              <button
                type="button"
                className={styles.ghostBtn}
                disabled={saving}
                onClick={() => {
                  setForm(emptyFormData());
                  setErrors({});
                  setCreatedId(null);
                  setPdfError(null);
                  if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                  setPdfUrl(null);
                  setPdfFileName(null);
                  setEditingId(null);
                  localStorage.removeItem(STORAGE_KEY);
                }}
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className={styles.tabsContainer}>
          <button
            className={cx(styles.tab, activeTab === "nuevo" && styles.tabActive)}
            onClick={() => setActiveTab("nuevo")}
          >
            📝 Nuevo / Editar
          </button>
          <button
            className={cx(styles.tab, activeTab === "buscar" && styles.tabActive)}
            onClick={() => {
              setActiveTab("buscar");
              fetchAllPacientes();
            }}
          >
            🔍 Buscar Pacientes
          </button>
        </div>

        {activeTab === "nuevo" ? (
          <>
            {saving && <div className={styles.toastInfo}>⏳ Guardando datos y generando PDF...</div>}

            <form onSubmit={onSubmit} className={styles.form} noValidate>
              <Section title="ART + Siniestro" subtitle="Todos los campos son opcionales">
                <div className={styles.grid}>
                  <Field label="ART">
                    <select
                      className={cx(styles.input, errors.ART && styles.inputError)}
                      value={form.ART}
                      onChange={onChange("ART")}
                    >
                      <option value="">Seleccione una ART</option>
                      {ART_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {errors.ART && <span className={styles.errorText}>{errors.ART}</span>}
                  </Field>
                  <Field label="N° Siniestro">
                    <input
                      className={styles.input}
                      value={form.nroSiniestro}
                      onChange={onChange("nroSiniestro")}
                      inputMode="numeric"
                      placeholder="Opcional"
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Fechas" subtitle="Fecha de ingreso y fecha de denuncia (vacías para completar a mano)">
                <div className={styles.fechasWrapper}>
                  <div className={styles.fechaGroup}>
                    <div className={styles.fechaGroupLabel}>Fecha de ingreso</div>
                    <div className={styles.fechaRow}>
                      <DatePartInput
                        label="Día"
                        value={form.diaIngreso}
                        onChange={onChange("diaIngreso")}
                        placeholder="DD"
                        maxLength={2}
                        error={errors.ingresoDia}
                      />
                      <DatePartInput
                        label="Mes"
                        value={form.mesIngreso}
                        onChange={onChange("mesIngreso")}
                        placeholder="MM"
                        maxLength={2}
                        error={errors.ingresoMes}
                      />
                      <DatePartInput
                        label="Año"
                        value={form.anioIngreso}
                        onChange={onChange("anioIngreso")}
                        placeholder="AAAA"
                        maxLength={4}
                        error={errors.ingresoAnio}
                        className={styles.datePartWide}
                      />
                    </div>
                  </div>
                  <div className={styles.fechaGroup}>
                    <div className={styles.fechaGroupLabel}>Fecha de denuncia</div>
                    <div className={styles.fechaRow}>
                      <DatePartInput
                        label="Día"
                        value={form.diaDenuncia}
                        onChange={onChange("diaDenuncia")}
                        placeholder="DD"
                        maxLength={2}
                        error={errors.denunciaDia}
                      />
                      <DatePartInput
                        label="Mes"
                        value={form.mesDenuncia}
                        onChange={onChange("mesDenuncia")}
                        placeholder="MM"
                        maxLength={2}
                        error={errors.denunciaMes}
                      />
                      <DatePartInput
                        label="Año"
                        value={form.anioDenuncia}
                        onChange={onChange("anioDenuncia")}
                        placeholder="AAAA"
                        maxLength={4}
                        error={errors.denunciaAnio}
                        className={styles.datePartWide}
                      />
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Empleador" subtitle="Todos los campos son opcionales">
                <div className={styles.grid}>
                  <Field label="Nombre empresa">
                    <input
                      className={cx(styles.input, errors.empleadorNombre && styles.inputError)}
                      value={form.empleadorNombre}
                      onChange={onChange("empleadorNombre")}
                      placeholder="Razón social (opcional)"
                    />
                  </Field>
                  <Field label="CUIT / DNI" error={errors.empleadorCuitDni}>
                    <input
                      className={cx(styles.input, errors.empleadorCuitDni && styles.inputError)}
                      value={form.empleadorCuitDni}
                      onChange={onChange("empleadorCuitDni")}
                      onBlur={onBlurCuitDni}
                      inputMode="numeric"
                      placeholder="Opcional (solo números)"
                    />
                  </Field>
                </div>
              </Section>

              <Section title="Trabajador" subtitle="Todos los campos son opcionales">
                <div className={styles.grid}>
                  <Field label="Apellido">
                    <input
                      className={styles.input}
                      value={form.trabajadorApellido}
                      onChange={onChange("trabajadorApellido")}
                      placeholder="Apellido"
                    />
                  </Field>
                  <Field label="Nombre">
                    <input
                      className={styles.input}
                      value={form.trabajadorNombre}
                      onChange={onChange("trabajadorNombre")}
                      placeholder="Nombre"
                    />
                  </Field>
                  <Field label="DNI / CUIL" error={errors.trabajadorDni}>
                    <input
                      className={cx(styles.input, errors.trabajadorDni && styles.inputError)}
                      value={form.trabajadorDni}
                      onChange={onChange("trabajadorDni")}
                      onBlur={onBlurTrabajadorDni}
                      inputMode="numeric"
                      placeholder="DNI o CUIL"
                    />
                  </Field>
                  <Field label="Fecha de nacimiento">
                    <input
                      type="date"
                      className={styles.input}
                      value={form.trabajadorNacimiento}
                      onChange={onChange("trabajadorNacimiento")}
                    />
                  </Field>
                  <Field label="Edad (calculada)">
                    <input
                      className={cx(styles.input, styles.inputReadonly)}
                      value={form.trabajadorEdad ? `${form.trabajadorEdad} años` : ""}
                      readOnly
                      tabIndex={-1}
                      placeholder="Se calcula automáticamente"
                    />
                  </Field>
                  <Field label="Sexo">
                    <div className={styles.chips}>
                      {["M", "F"].map((val) => (
                        <label
                          key={val}
                          className={cx(styles.chip, form.trabajadorSexo === val && styles.chipActive)}
                        >
                          <input
                            type="radio"
                            name="sexo"
                            value={val}
                            checked={form.trabajadorSexo === val}
                            onChange={onChange("trabajadorSexo")}
                          />
                          {val === "M" ? "Masculino" : "Femenino"}
                        </label>
                      ))}
                    </div>
                  </Field>
                  <Field label="Teléfono" error={errors.trabajadorTelefono}>
                    <input
                      className={cx(styles.input, errors.trabajadorTelefono && styles.inputError)}
                      value={form.trabajadorTelefono}
                      onChange={onChange("trabajadorTelefono")}
                      inputMode="numeric"
                      placeholder="Teléfono"
                    />
                  </Field>
                  <Field label="Calle">
                    <input
                      className={styles.input}
                      value={form.trabajadorCalle}
                      onChange={onChange("trabajadorCalle")}
                      placeholder="Calle"
                    />
                  </Field>
                  <Field label="Número">
                    <input
                      className={styles.input}
                      value={form.trabajadorNumero}
                      onChange={onChange("trabajadorNumero")}
                      inputMode="numeric"
                      placeholder="N°"
                    />
                  </Field>
                  <Field label="Piso">
                    <input
                      className={styles.input}
                      value={form.trabajadorPiso}
                      onChange={onChange("trabajadorPiso")}
                      placeholder="Piso"
                    />
                  </Field>
                  <Field label="Depto">
                    <input
                      className={styles.input}
                      value={form.trabajadorDepto}
                      onChange={onChange("trabajadorDepto")}
                      placeholder="Depto"
                    />
                  </Field>
                  <Field label="Localidad">
                    <input
                      className={styles.input}
                      value={form.trabajadorLocalidad}
                      onChange={onChange("trabajadorLocalidad")}
                      placeholder="Localidad"
                    />
                  </Field>
                  <Field label="Provincia">
                    <input
                      className={styles.input}
                      value={form.trabajadorProvincia}
                      onChange={onChange("trabajadorProvincia")}
                      placeholder="Provincia"
                    />
                  </Field>
                  <Field label="Código Postal">
                    <input
                      className={styles.input}
                      value={form.trabajadorCP}
                      onChange={onChange("trabajadorCP")}
                      inputMode="numeric"
                      placeholder="CP"
                    />
                  </Field>
                </div>
              </Section>

              {/* Estado */}
              <Section title="Estado del paciente" subtitle="Abierto (en tratamiento) o Cerrado (alta laboral)">
                <div className={styles.chips}>
                  {["abierto", "cerrado"].map((val) => (
                    <label
                      key={val}
                      className={cx(styles.chip, form.estado === val && styles.chipActive)}
                    >
                      <input
                        type="radio"
                        name="estado"
                        value={val}
                        checked={form.estado === val}
                        onChange={onChange("estado")}
                      />
                      {val === "abierto" ? "🟢 Abierto" : "🔴 Cerrado"}
                    </label>
                  ))}
                </div>
              </Section>

              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => router.push("/admin/pacientes")}>
                  Cancelar
                </button>
                <button type="submit" className={styles.saveBtn} disabled={!canSubmit}>
                  {saving
                    ? "Guardando y generando..."
                    : editingId
                      ? "Actualizar y generar PDF"
                      : "Guardar y generar PDF"}
                </button>
              </div>

              <div className={styles.pdfRow}>
                {createdId && (
                  <div className={styles.toastSuccess}>
                    ✅ {editingId ? "Actualizado" : "Guardado"}. ID: <b>{createdId}</b>
                  </div>
                )}
                {pdfError && <div className={styles.toastDanger}>❌ {pdfError}</div>}
                {pdfUrl && (
                  <div className={styles.toastSuccess}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
                      <div>
                        📄 PDF generado: <b style={{ wordBreak: "break-word" }}>{pdfFileName}</b>
                      </div>
                      <div className={styles.pdfActions}>
                        <button type="button" className={styles.secondaryBtn} onClick={openPdf}>
                          Abrir
                        </button>
                        <button type="button" className={styles.primaryBtn} style={{ height: 40, width: "auto" }} onClick={downloadPdf}>
                          Descargar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </>
        ) : (
          <div className={styles.searchTab}>
            <div className={styles.searchHeader}>
              <input
                type="text"
                className={styles.input}
                placeholder="Buscar por nombre, apellido o DNI..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <button
                className={styles.ghostBtn}
                onClick={fetchAllPacientes}
                disabled={loadingPacientes}
              >
                🔄 Actualizar
              </button>
            </div>

            {loadingPacientes ? (
              <div className={styles.loading}>Cargando pacientes...</div>
            ) : filteredPacientes.length === 0 ? (
              <div className={styles.empty}>No se encontraron pacientes.</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Paciente</th>
                      <th>DNI</th>
                      <th>ART</th>
                      <th>N° Siniestro</th>
                      <th>Fecha Ingreso</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPacientes.map((p) => {
                      const t = p.trabajador || {};
                      const art = p.ART || {};
                      const fi = p.fechaIngreso || {};
                      const estado = p.estado || "abierto";
                      return (
                        <tr key={p.id}>
                          <td data-label="Paciente">
                            {t.apellido} {t.nombre}
                          </td>
                          <td data-label="DNI">{t.dni || "—"}</td>
                          <td data-label="ART">{art.nombre || "—"}</td>
                          <td data-label="N° Siniestro">{art.nroSiniestro || "—"}</td>
                          <td data-label="Ingreso">
                            {fi.dia && fi.mes && fi.anio
                              ? `${fi.dia}/${fi.mes}/${fi.anio}`
                              : "—"}
                          </td>
                          <td data-label="Estado">
                            <span className={estado === "abierto" ? styles.bolitaVerde : styles.bolitaRoja} title={estado === "abierto" ? "Abierto" : "Cerrado"} />
                          </td>
                          <td data-label="Acciones" className={styles.actionsCell}>
                            <button
                              className={styles.iconBtn}
                              title="Editar"
                              onClick={() => handleEditPaciente(p)}
                            >
                              ✏️
                            </button>
                            <button
                              className={styles.iconBtn}
                              title="Imprimir PDF"
                              onClick={() => handlePrintPaciente(p)}
                            >
                              🖨️
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
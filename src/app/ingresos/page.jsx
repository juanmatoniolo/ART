"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { push, ref, set, get, child, update } from "firebase/database";
import styles from "./ingresos.module.css";
import Header from "@/components/Header/Header";

const STORAGE_KEY = "ingreso_paciente_form_v1";
const THEME_KEY = "siniestro_theme";
const PDF_TEMPLATE = "INT-UIT-FOJA";
const DB_NODE = "ingresos-pacientes";

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

const today = new Date();
const defaultDay = String(today.getDate()).padStart(2, "0");
const defaultMonth = String(today.getMonth() + 1).padStart(2, "0");
const defaultYearShort = String(today.getFullYear()).slice(-2);

const initialForm = {
  // 1) Datos del ingreso
  OS: "",
  afiliadoPaciente: "",
  tipoIngreso: "PISO",
  diaIngreso: defaultDay,
  mesIngreso: defaultMonth,
  anioIngreso: defaultYearShort,

  // 2) Paciente
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
  trabajadorEdad: "",

  // Familiar
  familiarNombre: "",
  familiarParentezco: "",
  familiarTelefono: "",

  // 3) Internación
  camaNumero: "",
  camaLetra: "",
};

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

function buildHabitacionCama(form) {
  const num = (form.camaNumero || "").toString().trim();
  const letra = (form.camaLetra || "").toString().trim().toUpperCase();
  if (!num) return "";
  if (form.tipoIngreso === "UTI") return num;
  return letra ? `${num}${letra}` : num;
}

function getPdfPages(tipoIngreso) {
  if (tipoIngreso === "UTI") return [1, 9, 10, 11, 12];
  return [1, 2, 3, 4, 5, 6, 7, 8];
}

function validate(f) {
  const e = {};

  if (!f.tipoIngreso || !["PISO", "UTI"].includes(f.tipoIngreso)) {
    e.tipoIngreso = "Debe seleccionar PISO o UTI";
  }

  if (!onlyDigits(f.camaNumero)) {
    e.camaNumero = "El número de cama es obligatorio";
  }

  const dni = onlyDigits(f.trabajadorDni);
  if (dni && !((dni.length >= 7 && dni.length <= 9) || dni.length === 11)) {
    e.trabajadorDni = "Documento inválido (7-9 dígitos para DNI u 11 para CUIL)";
  }

  const tel = onlyDigits(f.trabajadorTelefono);
  if (!tel) {
    e.trabajadorTelefono = "El teléfono es obligatorio";
  } else if (tel.length < 8) {
    e.trabajadorTelefono = "Teléfono inválido (mínimo 8 dígitos)";
  }

  if (!f.trabajadorSexo) {
    e.trabajadorSexo = "El sexo es obligatorio";
  } else if (!["M", "F"].includes(f.trabajadorSexo)) {
    e.trabajadorSexo = "Sexo inválido";
  }

  const d = onlyDigits(f.diaIngreso);
  const m = onlyDigits(f.mesIngreso);
  const a = onlyDigits(f.anioIngreso);
  if (d && (Number(d) < 1 || Number(d) > 31)) e.diaIngreso = "Día inválido (01-31)";
  if (m && (Number(m) < 1 || Number(m) > 12)) e.mesIngreso = "Mes inválido (01-12)";
  if (a && a.length !== 2) e.anioIngreso = "Año debe ser 2 dígitos";

  return e;
}

function cx(...cls) {
  return cls.filter(Boolean).join(" ");
}

function Section({ title, subtitle, children }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <div>
          <h3 className={styles.sectionTitle}>{title}</h3>
          {subtitle && <div className={styles.sectionHint}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

function DatePartInput({ label, value, onChange, placeholder, maxLength, error, className }) {
  return (
    <div className={cx(styles.datePartField, className)}>
      <label className={styles.label}>{label}</label>
      <input
        className={cx(styles.input, error && styles.inputError)}
        value={value}
        onChange={onChange}
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  );
}

export default function SiniestroPage() {
  const [activeTab, setActiveTab] = useState("nuevo");
  const [form, setForm] = useState(initialForm);
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
  const [editingId, setEditingId] = useState(null);
  const [currentEstado, setCurrentEstado] = useState(null);

  const submittingRef = useRef(false);

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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setForm({ ...initialForm, ...JSON.parse(raw) });
    } catch {}
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      } catch {}
    }, 250);
    return () => clearTimeout(t);
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
    if (form.tipoIngreso === "UTI" && form.camaLetra) {
      setForm((p) => ({ ...p, camaLetra: "" }));
    }
  }, [form.tipoIngreso]);

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
      const snapshot = await get(child(ref(db), DB_NODE));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const arr = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPacientes(arr);
      } else {
        setPacientes([]);
      }
    } catch (error) {
      console.error("Error cargando ingresos:", error);
    } finally {
      setLoadingPacientes(false);
    }
  };

  const canSubmit = useMemo(() => !saving, [saving]);

  const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const onBlurTrabajadorDni = () => {
    setForm((p) => ({ ...p, trabajadorDni: formatIdField(p.trabajadorDni) }));
  };

  const handleEditPaciente = (paciente) => {
    const t = paciente.trabajador || {};
    const fi = paciente.fechaIngreso || {};
    const int = paciente.internacion || {};
    const fam = paciente.familiar || {};

    setForm({
      OS: paciente.OS || "",
      afiliadoPaciente: paciente.afiliadoPaciente || "",
      tipoIngreso: paciente.tipoIngreso || "PISO",
      diaIngreso: fi.dia || defaultDay,
      mesIngreso: fi.mes || defaultMonth,
      anioIngreso: fi.anio || defaultYearShort,

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
      trabajadorEdad: t.edad || "",

      familiarNombre: fam.nombre || "",
      familiarParentezco: fam.parentezco || "",
      familiarTelefono: fam.telefono || "",

      camaNumero: int.camaNumero || "",
      camaLetra: int.camaLetra || "",
    });
    setEditingId(paciente.id);
    setCurrentEstado(paciente.estado || "abierto");
    setActiveTab("nuevo");
    setCreatedId(null);
    setPdfError(null);
    setPdfUrl(null);
    setPdfFileName(null);
  };

  const handlePrintPaciente = async (paciente) => {
    try {
      const tipoIngreso = paciente.tipoIngreso || "PISO";
      const payload = {
        ...paciente,
        prestador: paciente.prestador || PRESTADOR_CONST,
      };
      const apellido = payload.trabajador?.apellido || "SIN_APELLIDO";
      const dni = onlyDigits(payload.trabajador?.dni) || "SIN_DNI";
      const os = (payload.OS || "OS").replace(/\s+/g, "_");
      const fileName = `INT_${apellido}_${dni}_${os}.pdf`;

      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          fileName,
          template: PDF_TEMPLATE,
          pages: getPdfPages(tipoIngreso),
          pdfType: "ingreso", // 👈 clave para usar buildIngresoFields
        }),
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
    a.download = pdfFileName || "FORMULARIO_INGRESO.pdf";
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
      const trabajadorDniFormatted = formatIdField(form.trabajadorDni);
      const habitacionCama = buildHabitacionCama(form);

      const payload = {
        OS: (form.OS || "").trim().toUpperCase(),
        afiliadoPaciente: (form.afiliadoPaciente || "").trim().toUpperCase(),
        tipoIngreso: form.tipoIngreso,
        fechaIngreso: {
          dia: onlyDigits(form.diaIngreso),
          mes: onlyDigits(form.mesIngreso),
          anio: onlyDigits(form.anioIngreso),
        },
        trabajador: {
          apellido: form.trabajadorApellido.trim().toUpperCase() || "",
          nombre: form.trabajadorNombre.trim().toUpperCase() || "",
          dni: trabajadorDniFormatted || "",
          nacimiento: form.trabajadorNacimiento || "",
          edad: form.trabajadorEdad,
          sexo: form.trabajadorSexo,
          calle: form.trabajadorCalle.trim().toUpperCase() || "",
          numero: form.trabajadorNumero.trim().toUpperCase() || "",
          piso: form.trabajadorPiso.trim().toUpperCase() || "",
          depto: form.trabajadorDepto.trim().toUpperCase() || "",
          localidad: form.trabajadorLocalidad.trim().toUpperCase() || "",
          provincia: form.trabajadorProvincia.trim().toUpperCase() || "",
          cp: onlyDigits(form.trabajadorCP) || "",
          telefono: onlyDigits(form.trabajadorTelefono),
        },
        familiar: {
          nombre: (form.familiarNombre || "").trim().toUpperCase(),
          parentezco: (form.familiarParentezco || "").trim().toUpperCase(),
          telefono: onlyDigits(form.familiarTelefono),
        },
        internacion: {
          camaNumero: onlyDigits(form.camaNumero),
          camaLetra:
            form.tipoIngreso === "UTI"
              ? ""
              : (form.camaLetra || "").trim().toUpperCase(),
          habitacionCama,
        },
        prestador: PRESTADOR_CONST,
        updatedAt: Date.now(),
      };

      let savedId;
      if (editingId) {
        payload.estado = currentEstado;
        await update(ref(db, `${DB_NODE}/${editingId}`), payload);
        savedId = editingId;
      } else {
        payload.estado = "abierto";
        payload.createdAt = Date.now();
        const newRef = push(ref(db, DB_NODE));
        await set(newRef, payload);
        savedId = newRef.key;
      }
      setCreatedId(savedId);

      const fileName = `INT_${payload.trabajador.apellido || "SIN_APELLIDO"}_${onlyDigits(payload.trabajador.dni) || "SIN_DNI"}_${(payload.OS || "OS").replace(/\s+/g, "_")}.pdf`;

      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          fileName,
          template: PDF_TEMPLATE,
          pages: getPdfPages(form.tipoIngreso),
          pdfType: "ingreso", // 👈 clave
        }),
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
      setCurrentEstado(null);
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
    const afiliado = p.afiliadoPaciente || "";
    const term = searchTerm.toLowerCase();
    return (
      fullName.includes(term) ||
      dni.includes(term) ||
      afiliado.toLowerCase().includes(term)
    );
  });

  const esUTI = form.tipoIngreso === "UTI";

  return (
    <>
      <Header />
      <div className={cx(styles.page, theme === "light" && styles.lightMode)}>
        <div className={styles.shell}>
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Ingreso de Pacientes</h1>
              <p className={styles.subtitle}>
                {activeTab === "nuevo"
                  ? editingId
                    ? "Editando ingreso existente"
                    : "Nuevo registro de ingreso"
                  : "Buscar y gestionar ingresos"}
              </p>
              {editingId && currentEstado && (
                <span
                  style={{
                    display: "inline-block",
                    marginTop: "0.5rem",
                    padding: "0.25rem 0.75rem",
                    borderRadius: "999px",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    background: currentEstado === "abierto" ? "#dcfce7" : "#fee2e2",
                    color: currentEstado === "abierto" ? "#166534" : "#991b1b",
                  }}
                >
                  {currentEstado === "abierto" ? "🟢 Abierto" : "🔴 Cerrado"}
                </span>
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
                    setForm(initialForm);
                    setErrors({});
                    setCreatedId(null);
                    setPdfError(null);
                    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                    setPdfUrl(null);
                    setPdfFileName(null);
                    setEditingId(null);
                    setCurrentEstado(null);
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

              <form onSubmit={onSubmit} autoComplete="on">
                <div className={styles.card}>
                  <Section
                    title="1) Datos del ingreso"
                    subtitle="Obra social, número de afiliado, fecha y tipo de ingreso"
                  >
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>O.S</label>
                        <input
                          className={cx(styles.input, errors.OS && styles.inputError)}
                          value={form.OS}
                          onChange={onChange("OS")}
                          placeholder="Ej: OSDE, Swiss Medical, IAPOS..."
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>N° de afiliado</label>
                        <input
                          className={styles.input}
                          value={form.afiliadoPaciente}
                          onChange={onChange("afiliadoPaciente")}
                          placeholder="Ej: 1234567890 / ABC123"
                        />
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <div className={styles.fieldFull}>
                        <label className={styles.label}>Tipo de ingreso</label>
                        <div className={styles.chips}>
                          {[
                            ["PISO", "PISO"],
                            ["UTI", "UTI (Terapia)"],
                          ].map(([val, label]) => (
                            <label
                              key={val}
                              className={cx(
                                styles.chip,
                                form.tipoIngreso === val && styles.chipActive,
                                errors.tipoIngreso && styles.inputError
                              )}
                            >
                              <input
                                type="radio"
                                name="tipoIngreso"
                                value={val}
                                checked={form.tipoIngreso === val}
                                onChange={onChange("tipoIngreso")}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        {errors.tipoIngreso && (
                          <div className={styles.errorText} style={{ marginTop: 6 }}>
                            {errors.tipoIngreso}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={styles.fechasWrapper} style={{ marginTop: 14 }}>
                      <div className={styles.fechaGroup}>
                        <div className={styles.fechaGroupLabel}>Fecha de ingreso</div>
                        <div className={styles.fechaRow}>
                          <DatePartInput
                            label="Día"
                            value={form.diaIngreso}
                            onChange={onChange("diaIngreso")}
                            placeholder="DD"
                            maxLength={2}
                            error={errors.diaIngreso}
                          />
                          <DatePartInput
                            label="Mes"
                            value={form.mesIngreso}
                            onChange={onChange("mesIngreso")}
                            placeholder="MM"
                            maxLength={2}
                            error={errors.mesIngreso}
                          />
                          <DatePartInput
                            label="Año"
                            value={form.anioIngreso}
                            onChange={onChange("anioIngreso")}
                            placeholder="AA"
                            maxLength={2}
                            error={errors.anioIngreso}
                          />
                        </div>
                      </div>
                    </div>
                  </Section>

                  <Section title="2) Paciente" subtitle="Datos del paciente y contacto familiar">
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>Apellido</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorApellido}
                          onChange={onChange("trabajadorApellido")}
                          placeholder="Apellido"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Nombre</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorNombre}
                          onChange={onChange("trabajadorNombre")}
                          placeholder="Nombre"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>DNI / CUIL</label>
                        <input
                          className={cx(styles.input, errors.trabajadorDni && styles.inputError)}
                          value={form.trabajadorDni}
                          onChange={onChange("trabajadorDni")}
                          onBlur={onBlurTrabajadorDni}
                          inputMode="numeric"
                          placeholder="DNI o CUIL"
                        />
                        {errors.trabajadorDni && <div className={styles.errorText}>{errors.trabajadorDni}</div>}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Fecha de nacimiento</label>
                        <input
                          type="date"
                          className={styles.input}
                          value={form.trabajadorNacimiento}
                          onChange={onChange("trabajadorNacimiento")}
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Edad (calculada)</label>
                        <input
                          className={cx(styles.input, styles.inputReadonly)}
                          value={form.trabajadorEdad ? `${form.trabajadorEdad} años` : ""}
                          readOnly
                          tabIndex={-1}
                          placeholder="Se calcula automáticamente"
                        />
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          Sexo <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <div className={styles.chips}>
                          {["M", "F"].map((val) => (
                            <label
                              key={val}
                              className={cx(
                                styles.chip,
                                form.trabajadorSexo === val && styles.chipActive,
                                errors.trabajadorSexo && styles.inputError
                              )}
                            >
                              <input
                                type="radio"
                                name="sexo"
                                value={val}
                                checked={form.trabajadorSexo === val}
                                onChange={onChange("trabajadorSexo")}
                              />
                              {val}
                            </label>
                          ))}
                        </div>
                        {errors.trabajadorSexo && <div className={styles.errorText}>{errors.trabajadorSexo}</div>}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          Teléfono <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          className={cx(styles.input, errors.trabajadorTelefono && styles.inputError)}
                          value={form.trabajadorTelefono}
                          onChange={onChange("trabajadorTelefono")}
                          inputMode="numeric"
                          placeholder="Ej: 11 1234 5678"
                        />
                        {errors.trabajadorTelefono && <div className={styles.errorText}>{errors.trabajadorTelefono}</div>}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Calle</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorCalle}
                          onChange={onChange("trabajadorCalle")}
                          placeholder="Calle"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Número</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorNumero}
                          onChange={onChange("trabajadorNumero")}
                          inputMode="numeric"
                          placeholder="N°"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Piso</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorPiso}
                          onChange={onChange("trabajadorPiso")}
                          placeholder="Piso"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Depto</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorDepto}
                          onChange={onChange("trabajadorDepto")}
                          placeholder="Depto"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Localidad</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorLocalidad}
                          onChange={onChange("trabajadorLocalidad")}
                          placeholder="Localidad"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Provincia</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorProvincia}
                          onChange={onChange("trabajadorProvincia")}
                          placeholder="Provincia"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>CP</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorCP}
                          onChange={onChange("trabajadorCP")}
                          inputMode="numeric"
                          placeholder="CP"
                        />
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 22,
                        paddingTop: 18,
                        borderTop: "1px dashed var(--border-color)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          marginBottom: 12,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        👨‍👩‍👧 Datos del familiar responsable
                      </div>
                      <div className={styles.grid}>
                        <div className={styles.field}>
                          <label className={styles.label}>Nombre completo</label>
                          <input
                            className={styles.input}
                            value={form.familiarNombre}
                            onChange={onChange("familiarNombre")}
                            placeholder="Apellido y nombre del familiar"
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Parentezco</label>
                          <input
                            className={styles.input}
                            value={form.familiarParentezco}
                            onChange={onChange("familiarParentezco")}
                            placeholder="Ej: Cónyuge, Hijo/a, Madre, Padre..."
                          />
                        </div>
                        <div className={styles.field}>
                          <label className={styles.label}>Teléfono</label>
                          <input
                            className={styles.input}
                            value={form.familiarTelefono}
                            onChange={onChange("familiarTelefono")}
                            inputMode="numeric"
                            placeholder="Ej: 3456 123456"
                          />
                        </div>
                      </div>
                    </div>
                  </Section>

                  <Section
                    title="3) Internación"
                    subtitle={`Ubicación del paciente en ${form.tipoIngreso === "UTI" ? "UTI (Terapia)" : "PISO"}`}
                  >
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>
                          Cama {form.tipoIngreso === "PISO" ? "(N° + letra opcional)" : "(sólo N°)"}
                        </label>
                        <div className={styles.fechaRow}>
                          <DatePartInput
                            label="N° Cama"
                            value={form.camaNumero}
                            onChange={onChange("camaNumero")}
                            placeholder="Ej: 12"
                            maxLength={4}
                            error={errors.camaNumero}
                          />
                          {!esUTI && (
                            <DatePartInput
                              label="Letra (opcional)"
                              value={form.camaLetra}
                              onChange={onChange("camaLetra")}
                              placeholder="A"
                              maxLength={2}
                            />
                          )}
                        </div>
                        <div className={styles.sectionHint} style={{ marginTop: 6 }}>
                          Se guardará como: <b>{buildHabitacionCama(form) || "—"}</b>
                        </div>
                      </div>
                    </div>
                  </Section>

                  <div className={styles.footer}>
                    <button type="submit" className={styles.primaryBtn} disabled={!canSubmit}>
                      {saving
                        ? "Guardando y generando..."
                        : editingId
                          ? "Actualizar y generar PDF"
                          : "Guardar y generar PDF"}
                    </button>

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
                  </div>
                </div>
              </form>
            </>
          ) : (
            <div className={styles.searchTab}>
              <div className={styles.searchHeader}>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Buscar por nombre, apellido, DNI o N° afiliado..."
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
                <div className={styles.loading}>Cargando ingresos...</div>
              ) : filteredPacientes.length === 0 ? (
                <div className={styles.empty}>No se encontraron ingresos.</div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Paciente</th>
                        <th>DNI</th>
                        <th>O.S</th>
                        <th>N° Afiliado</th>
                        <th>Tipo</th>
                        <th>Fecha Ingreso</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPacientes.map((p) => {
                        const t = p.trabajador || {};
                        const fi = p.fechaIngreso || {};
                        const estado = p.estado || "abierto";
                        return (
                          <tr key={p.id}>
                            <td>
                              {t.apellido} {t.nombre}
                            </td>
                            <td>{t.dni || "—"}</td>
                            <td>{p.OS || "—"}</td>
                            <td>{p.afiliadoPaciente || "—"}</td>
                            <td>{p.tipoIngreso || "—"}</td>
                            <td>
                              {fi.dia && fi.mes && fi.anio
                                ? `${fi.dia}/${fi.mes}/${fi.anio}`
                                : "—"}
                            </td>
                            <td>
                              <span
                                className={styles.estadoIndicador}
                                data-estado={estado}
                                title={estado === "abierto" ? "Abierto" : "Cerrado"}
                              />
                            </td>
                            <td className={styles.actionsCell}>
                              <button
                                className={styles.iconBtn}
                                title="Editar"
                                onClick={() => handleEditPaciente(p)}
                              >
                                ✏️
                              </button>
                              <button
                                className={styles.iconBtn}
                                title={`Imprimir PDF (${p.tipoIngreso || "PISO"})`}
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
    </>
  );
}
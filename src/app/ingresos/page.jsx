"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  push,
  ref,
  set,
  get,
  child,
  update,
  runTransaction,
} from "firebase/database";
import { getSession } from "@/utils/session";
import Header from "@/components/Header/Header";
import styles from "./ingresos.module.css";

const STORAGE_KEY = "ingreso_paciente_form_v1";
const THEME_KEY = "siniestro_theme";
const DB_NODE = "ingresos-pacientes";
const HC_PATH = "historias-clinicas";
const HC_UTI_PATH = "historias-clinica-uti";
const COUNTER_GENERAL_PATH = "counters/historias-clinicas/lastNumber";
const COUNTER_UTI_PATH = "counters/historias-clinica-uti/lastNumber";

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

const MESES_ES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const initialForm = {
  tipoIngreso: "PISO",

  trabajadorApellido: "",
  trabajadorNombre: "",
  trabajadorDni: "",
  trabajadorNacimiento: "",
  trabajadorNacimientoDia: "",
  trabajadorNacimientoMes: "",
  trabajadorNacimientoAnio: "",
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

  diaIngreso: defaultDay,
  mesIngreso: defaultMonth,
  anioIngreso: defaultYearShort,

  OS: "",
  afiliadoPaciente: "",
  historiaClinica: "",

  familiarNombre: "",
  familiarParentezco: "",
  familiarTelefono: "",

  camaNumero: "",
  camaLetra: "",

  medicoSolicitante: "",
  diagnostico: "",
};

/* ================= Helpers ================= */
function onlyDigits(s) {
  return (s ?? "").toString().replace(/\D/g, "");
}

function normalizeYear2(v) {
  const d = onlyDigits(v);
  if (!d) return "";
  if (d.length >= 4) return d.slice(-2);
  return d.padStart(2, "0").slice(-2);
}

function formatCuil(digits) {
  if (digits.length !== 11) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}.${digits.slice(
    4,
    7
  )}.${digits.slice(7, 10)}-${digits.slice(10)}`;
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

function nombreMes(m) {
  const n = Number(onlyDigits(m));
  if (!n || n < 1 || n > 12) return "";
  return MESES_ES[n - 1];
}

function buildNacimientoISO(form) {
  const d = onlyDigits(form.trabajadorNacimientoDia);
  const m = onlyDigits(form.trabajadorNacimientoMes);
  const a = onlyDigits(form.trabajadorNacimientoAnio);
  if (!d || !m || a.length !== 4) return "";
  const dd = Number(d);
  const mm = Number(m);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return "";
  return `${a}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
}

function splitNacimientoISO(iso) {
  const s = (iso || "").trim();
  if (!s) return { dia: "", mes: "", anio: "" };
  const [y, m, d] = s.split("-");
  return { dia: d || "", mes: m || "", anio: y || "" };
}

function buildHabitacionCama(form) {
  const num = (form.camaNumero || "").toString().trim();
  const letra = (form.camaLetra || "").toString().trim().toUpperCase();
  if (!num) return "";
  if (form.tipoIngreso === "UTI") return num;
  return letra ? `${num}${letra}` : num;
}

function buildHabitacionCamaTexto(form) {
  if (form.tipoIngreso === "UTI") {
    const num = (form.camaNumero || "").toString().trim();
    return num ? `CAMA: ${num}` : "";
  }
  const hab = buildHabitacionCama(form);
  return hab ? `HAB.: ${hab}` : "";
}

function getPdfPages(tipoIngreso) {
  if (tipoIngreso === "UTI") return [1, 9, 10, 11, 12];
  return [1, 2, 3, 4, 5, 6, 7, 8];
}

function splitNombreCompleto(full) {
  const s = (full || "").trim();
  if (!s) return { apellido: "", nombre: "" };

  if (s.includes(",")) {
    const [a, ...rest] = s.split(",");
    return { apellido: a.trim(), nombre: rest.join(",").trim() };
  }

  const parts = s.split(/\s+/);
  if (parts.length === 1) return { apellido: parts[0], nombre: "" };

  if (parts.length >= 4) {
    return {
      apellido: parts.slice(0, 2).join(" "),
      nombre: parts.slice(2).join(" "),
    };
  }
  return { apellido: parts[0], nombre: parts.slice(1).join(" ") };
}

function parseHCNumber(item) {
  const raw =
    item?.historia_clinica ??
    item?.historia_clinica_1 ??
    item?.historiaClinica ??
    item?.hc ??
    "";
  const digits = String(raw).replace(/\D/g, "");
  return digits ? Number(digits) : null;
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
  if (d && (Number(d) < 1 || Number(d) > 31))
    e.diaIngreso = "Día inválido (01-31)";
  if (m && (Number(m) < 1 || Number(m) > 12))
    e.mesIngreso = "Mes inválido (01-12)";
  if (a && a.length !== 2 && a.length !== 4)
    e.anioIngreso = "Año debe ser 2 o 4 dígitos";

  // Validación fecha de nacimiento (sólo si hay algo cargado)
  const nd = onlyDigits(f.trabajadorNacimientoDia);
  const nm = onlyDigits(f.trabajadorNacimientoMes);
  const na = onlyDigits(f.trabajadorNacimientoAnio);
  if (nd && (Number(nd) < 1 || Number(nd) > 31))
    e.trabajadorNacimientoDia = "Día inválido";
  if (nm && (Number(nm) < 1 || Number(nm) > 12))
    e.trabajadorNacimientoMes = "Mes inválido";
  if (na && na.length !== 4)
    e.trabajadorNacimientoAnio = "Usá 4 dígitos (ej: 1995)";

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

function DatePartInput({
  label,
  value,
  onChange,
  onBlur,
  placeholder,
  maxLength,
  error,
  className,
}) {
  return (
    <div className={cx(styles.datePartField, className)}>
      <label className={styles.label}>{label}</label>
      <input
        className={cx(styles.input, error && styles.inputError)}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        inputMode="numeric"
        placeholder={placeholder}
        maxLength={maxLength}
      />
      {error && <div className={styles.errorText}>{error}</div>}
    </div>
  );
}

export default function IngresosPage() {
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

  const [printingId, setPrintingId] = useState(null);

  /* Lookup DNI en HC — solo del tipo activo */
  const [hcLookup, setHcLookup] = useState({
    loading: false,
    searched: false,
    dni: "",
    tipo: "PISO",
    match: null,
    nextNumber: null,
    loadingNext: false,
  });
  const lastLookupDniRef = useRef("");

  const [creatingHc, setCreatingHc] = useState(null); // "PISO" | "UTI" | null

  const submittingRef = useRef(false);

  /* ---------- Tema ---------- */
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

  /* ---------- Hidratar form desde localStorage (compat) ---------- */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const merged = { ...initialForm, ...JSON.parse(raw) };

      // Compatibilidad con versión anterior (fecha única tipo "1995-10-12")
      const tienePartes =
        merged.trabajadorNacimientoDia ||
        merged.trabajadorNacimientoMes ||
        merged.trabajadorNacimientoAnio;
      if (merged.trabajadorNacimiento && !tienePartes) {
        const { dia, mes, anio } = splitNacimientoISO(
          merged.trabajadorNacimiento
        );
        merged.trabajadorNacimientoDia = dia;
        merged.trabajadorNacimientoMes = mes;
        merged.trabajadorNacimientoAnio = anio;
      }

      setForm(merged);
    } catch { }
  }, []);

  /* ---------- Persistir form ---------- */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
      } catch { }
    }, 250);
    return () => clearTimeout(t);
  }, [form]);

  /* ---------- Revocar PDF URL ---------- */
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  /* ---------- Calcular edad al cambiar fecha nacimiento ---------- */
  useEffect(() => {
    setForm((prev) => {
      const edad = calcularEdad(prev.trabajadorNacimiento);
      if (prev.trabajadorEdad === edad) return prev;
      return { ...prev, trabajadorEdad: edad };
    });
  }, [form.trabajadorNacimiento]);

  /* ---------- Si cambia a UTI, limpiar letra cama ---------- */
  useEffect(() => {
    if (form.tipoIngreso === "UTI" && form.camaLetra) {
      setForm((p) => ({ ...p, camaLetra: "" }));
    }
  }, [form.tipoIngreso]);

  /* ---------- Re-buscar DNI en HC al cambiar tipo ---------- */
  useEffect(() => {
    const digits = onlyDigits(form.trabajadorDni);
    if (
      digits.length >= 7 &&
      hcLookup.searched &&
      hcLookup.tipo !== form.tipoIngreso
    ) {
      lastLookupDniRef.current = "";
      lookupDniInHC(digits, form.tipoIngreso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.tipoIngreso]);

  /* ---------- Foco en primer error ---------- */
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

  /* ---------- Cargar pacientes al abrir tab buscar ---------- */
  useEffect(() => {
    if (activeTab === "buscar") {
      fetchAllPacientes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchAllPacientes = async () => {
    setLoadingPacientes(true);
    try {
      const snapshot = await get(child(ref(db), DB_NODE));
      if (snapshot.exists()) {
        const data = snapshot.val();
        const arr = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
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

  /* ---------- Handlers genéricos ---------- */
  const onChange = (k) => (e) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const onChangeAnioIngreso = (e) => {
    const raw = e.target.value;
    setForm((p) => ({ ...p, anioIngreso: raw }));
  };

  const onBlurAnioIngreso = () => {
    setForm((p) => ({
      ...p,
      anioIngreso: normalizeYear2(p.anioIngreso),
    }));
  };

  /* ---------- Handler fecha de nacimiento (3 partes) ---------- */
  const onChangeNacimiento = (part) => (e) => {
    const raw = onlyDigits(e.target.value);
    setForm((p) => {
      const next = { ...p, [`trabajadorNacimiento${part}`]: raw };
      next.trabajadorNacimiento = buildNacimientoISO(next);
      return next;
    });
  };

  /* =========================================================
     Próximo N° HC
     ========================================================= */
  const calcularProximoNumeroHC = async (tipo) => {
    const isUti = tipo === "UTI";
    const hcPath = isUti ? HC_UTI_PATH : HC_PATH;
    const counterPath = isUti ? COUNTER_UTI_PATH : COUNTER_GENERAL_PATH;

    const [snapHC, snapCounter] = await Promise.all([
      get(child(ref(db), hcPath)),
      get(child(ref(db), counterPath)),
    ]);

    let maxReal = 0;
    if (snapHC.exists()) {
      const data = snapHC.val();
      for (const item of Object.values(data)) {
        const n = parseHCNumber(item);
        if (Number.isFinite(n) && n > maxReal) maxReal = n;
      }
    }

    const counterVal = snapCounter.exists() ? Number(snapCounter.val() || 0) : 0;

    const next = Math.max(maxReal, counterVal) + 1;
    return next;
  };

  /* =========================================================
     LOOKUP DNI
     ========================================================= */
  const lookupDniInHC = async (dniDigits, tipo) => {
    if (!dniDigits || dniDigits.length < 7) return;

    const tipoNorm = tipo === "UTI" ? "UTI" : "PISO";
    const cacheKey = `${tipoNorm}::${dniDigits}`;
    if (lastLookupDniRef.current === cacheKey) return;
    lastLookupDniRef.current = cacheKey;

    setHcLookup({
      loading: true,
      searched: false,
      dni: dniDigits,
      tipo: tipoNorm,
      match: null,
      nextNumber: null,
      loadingNext: false,
    });

    try {
      const hcPath = tipoNorm === "UTI" ? HC_UTI_PATH : HC_PATH;
      const snap = await get(child(ref(db), hcPath));

      const matchesDni = (itemDniRaw) => {
        const itemDni = onlyDigits(itemDniRaw);
        if (!itemDni) return false;
        if (itemDni === dniDigits) return true;
        if (dniDigits.length === 11 && itemDni === dniDigits.slice(2, 10))
          return true;
        if (itemDni.length === 11 && dniDigits === itemDni.slice(2, 10))
          return true;
        return false;
      };

      let match = null;
      if (snap.exists()) {
        const data = snap.val();
        for (const [id, v] of Object.entries(data)) {
          if (matchesDni(v.dni || v.documento)) {
            match = {
              id,
              tipo: tipoNorm,
              nombre_apellido: v.nombre_apellido || v.nombre || "",
              dni: v.dni || v.documento || "",
              historia_clinica:
                v.historia_clinica || v.historia_clinica_1 || "",
            };
            break;
          }
        }
      }

      setHcLookup({
        loading: false,
        searched: true,
        dni: dniDigits,
        tipo: tipoNorm,
        match,
        nextNumber: null,
        loadingNext: !match,
      });

      if (!match) {
        try {
          const next = await calcularProximoNumeroHC(tipoNorm);
          setHcLookup((prev) => ({
            ...prev,
            nextNumber: next,
            loadingNext: false,
          }));
        } catch (err) {
          console.error("Error calculando próximo HC:", err);
          setHcLookup((prev) => ({ ...prev, loadingNext: false }));
        }
      }
    } catch (err) {
      console.error("Error buscando DNI en HC:", err);
      setHcLookup({
        loading: false,
        searched: true,
        dni: dniDigits,
        tipo: tipoNorm,
        match: null,
        nextNumber: null,
        loadingNext: false,
      });
    }
  };

  const onBlurTrabajadorDni = () => {
    const formatted = formatIdField(form.trabajadorDni);
    setForm((p) => ({ ...p, trabajadorDni: formatted }));
    const digits = onlyDigits(formatted);
    if (digits.length >= 7) {
      lookupDniInHC(digits, form.tipoIngreso);
    }
  };

  const forceLookupDni = () => {
    const digits = onlyDigits(form.trabajadorDni);
    if (digits.length < 7) {
      alert("Ingresá al menos 7 dígitos del DNI/CUIL");
      return;
    }
    lastLookupDniRef.current = "";
    lookupDniInHC(digits, form.tipoIngreso);
  };

  const aplicarHistoriaClinica = (hc) => {
    if (!hc) return;
    const { apellido, nombre } = splitNombreCompleto(hc.nombre_apellido || "");
    setForm((p) => ({
      ...p,
      trabajadorApellido: apellido || p.trabajadorApellido,
      trabajadorNombre: nombre || p.trabajadorNombre,
      trabajadorDni: hc.dni ? formatIdField(hc.dni) : p.trabajadorDni,
      historiaClinica: String(hc.historia_clinica || ""),
    }));
  };

  /* =========================================================
     CREAR HC NUEVA
     ========================================================= */
  const crearHistoriaClinica = async () => {
    const tipo = form.tipoIngreso === "UTI" ? "UTI" : "PISO";
    const isUti = tipo === "UTI";

    const dniDigits = onlyDigits(form.trabajadorDni);
    if (dniDigits.length < 7) {
      alert("Ingresá al menos 7 dígitos del DNI/CUIL");
      return;
    }
    if (!form.trabajadorApellido.trim() || !form.trabajadorNombre.trim()) {
      alert("Completá apellido y nombre del paciente antes de crear la HC");
      return;
    }

    const numeroPreview = hcLookup.nextNumber
      ? ` (se asignará el N° ${hcLookup.nextNumber})`
      : "";

    const ok = window.confirm(
      `¿Crear una nueva historia clínica ${tipo} para "${form.trabajadorApellido} ${form.trabajadorNombre}" (DNI ${dniDigits})${numeroPreview}?\n\nSe reservará automáticamente el próximo número.`
    );
    if (!ok) return;

    setCreatingHc(tipo);

    try {
      const counterPath = isUti ? COUNTER_UTI_PATH : COUNTER_GENERAL_PATH;
      const hcPath = isUti ? HC_UTI_PATH : HC_PATH;

      const snapshot = await get(child(ref(db), hcPath));
      let maxReal = 0;
      if (snapshot.exists()) {
        const data = snapshot.val();
        for (const item of Object.values(data)) {
          const n = parseHCNumber(item);
          if (Number.isFinite(n) && n > maxReal) maxReal = n;
        }
      }

      const counterRef = ref(db, counterPath);
      const tx = await runTransaction(counterRef, (currentValue) => {
        const currentNumber = Number(currentValue || 0);
        return currentNumber + 1;
      });
      if (!tx.committed) throw new Error("No se pudo reservar el número");
      const reservedNumber = Number(tx.snapshot.val() || 0);

      let finalNumber;
      if (reservedNumber > maxReal) {
        finalNumber = reservedNumber;
      } else {
        finalNumber = maxReal + 1;
        await set(counterRef, finalNumber);
      }

      const newNumber = String(finalNumber);

      const session = (typeof getSession === "function" && getSession()) || {};
      const userName =
        session.user || session.usuario || session.nombre || "sistema";
      const userKey = session.id || session.key || "";
      const now = Date.now();

      const newRef = push(ref(db, hcPath));
      const nombreCompleto =
        `${form.trabajadorApellido.trim()} ${form.trabajadorNombre.trim()}`
          .trim()
          .toUpperCase();

      if (isUti) {
        await set(newRef, {
          nombre: nombreCompleto,
          documento: dniDigits,
          historia_clinica_1: newNumber,
          alertas: [],
          createdBy: userName,
          createdByUserKey: userKey,
          createdAt: now,
          modifiedBy: userName,
          modifiedByUserKey: userKey,
          modifiedAt: now,
        });
      } else {
        await set(newRef, {
          nombre_apellido: nombreCompleto,
          dni: dniDigits,
          historia_clinica: newNumber,
          alertas: [],
          createdBy: userName,
          createdByUserKey: userKey,
          createdAt: now,
          modifiedBy: userName,
          modifiedByUserKey: userKey,
          modifiedAt: now,
        });
      }

      setForm((p) => ({
        ...p,
        historiaClinica: newNumber,
      }));

      lastLookupDniRef.current = "";
      await lookupDniInHC(dniDigits, tipo);

      alert(`✅ HC ${tipo} #${newNumber} creada correctamente`);
    } catch (err) {
      console.error("Error creando HC:", err);
      alert("No se pudo crear la historia clínica. Revisá la consola.");
    } finally {
      setCreatingHc(null);
    }
  };

  /* =========================================================
     RESET / EDIT / PRINT
     ========================================================= */
  const resetForm = () => {
    setForm(initialForm);
    setErrors({});
    setCreatedId(null);
    setPdfError(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    setPdfFileName(null);
    setEditingId(null);
    setCurrentEstado(null);
    lastLookupDniRef.current = "";
    setHcLookup({
      loading: false,
      searched: false,
      dni: "",
      tipo: "PISO",
      match: null,
      nextNumber: null,
      loadingNext: false,
    });
    setCreatingHc(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const handleEditPaciente = (paciente) => {
    const t = paciente.trabajador || {};
    const fi = paciente.fechaIngreso || {};
    const int = paciente.internacion || {};
    const fam = paciente.familiar || {};
    const nac = splitNacimientoISO(t.nacimiento);

    setForm({
      tipoIngreso: paciente.tipoIngreso || "PISO",

      trabajadorApellido: t.apellido || "",
      trabajadorNombre: t.nombre || "",
      trabajadorDni: t.dni || "",
      trabajadorNacimiento: t.nacimiento || "",
      trabajadorNacimientoDia: nac.dia,
      trabajadorNacimientoMes: nac.mes,
      trabajadorNacimientoAnio: nac.anio,
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

      diaIngreso: fi.dia || defaultDay,
      mesIngreso: fi.mes || defaultMonth,
      anioIngreso: normalizeYear2(fi.anio) || defaultYearShort,

      OS: paciente.OS || "",
      afiliadoPaciente: paciente.afiliadoPaciente || "",
      historiaClinica: paciente.historiaClinica || "",

      familiarNombre: fam.nombre || "",
      familiarParentezco: fam.parentezco || "",
      familiarTelefono: fam.telefono || "",

      camaNumero: int.camaNumero || "",
      camaLetra: int.camaLetra || "",

      medicoSolicitante: paciente.medicoSolicitante || "",
      diagnostico: paciente.diagnostico || "",
    });
    setEditingId(paciente.id);
    setCurrentEstado(paciente.estado || "abierto");
    setActiveTab("nuevo");
    setCreatedId(null);
    setPdfError(null);
    setPdfUrl(null);
    setPdfFileName(null);
    lastLookupDniRef.current = "";
    setHcLookup({
      loading: false,
      searched: false,
      dni: "",
      tipo: "PISO",
      match: null,
      nextNumber: null,
      loadingNext: false,
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrintPaciente = async (paciente) => {
    setPrintingId(paciente.id);
    const newTab = window.open("", "_blank");

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

      const res = await fetch("/api/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          fileName,
          pages: getPdfPages(tipoIngreso),
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error al generar PDF: ${res.status} ${errorText}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      if (newTab) {
        newTab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener,noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (err) {
      console.error(err);
      if (newTab) newTab.close();
      alert("No se pudo generar el PDF.");
    } finally {
      setPrintingId(null);
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

  /* =========================================================
     SUBMIT
     ========================================================= */
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
      const habitacionCamaTexto = buildHabitacionCamaTexto(form);
      const anioIngreso2 = normalizeYear2(form.anioIngreso);

      const payload = {
        OS: (form.OS || "").trim().toUpperCase(),
        afiliadoPaciente: (form.afiliadoPaciente || "").trim().toUpperCase(),
        historiaClinica: (form.historiaClinica || "").trim().toUpperCase(),
        tipoIngreso: form.tipoIngreso,
        fechaIngreso: {
          dia: onlyDigits(form.diaIngreso).slice(-2),
          mes: onlyDigits(form.mesIngreso).slice(-2),
          anio: anioIngreso2,
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
          habitacionCamaTexto,
        },
        medicoSolicitante: (form.medicoSolicitante || "").trim().toUpperCase(),
        diagnostico: (form.diagnostico || "").trim().toUpperCase(),
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

      const fileName = `INT_${payload.trabajador.apellido || "SIN_APELLIDO"}_${onlyDigits(payload.trabajador.dni) || "SIN_DNI"
        }_${(payload.OS || "OS").replace(/\s+/g, "_")}.pdf`;

      const res = await fetch("/api/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          fileName,
          pages: getPdfPages(form.tipoIngreso),
        }),
      });

      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/pdf")) {
        const detail = ct.includes("application/json")
          ? JSON.stringify(await res.json().catch(() => ({})), null, 2)
          : await res.text().catch(() => "");
        console.error("PDF FAIL:", { status: res.status, ct, detail });
        setPdfError(
          `Falló la generación del PDF (${res.status}). Revisá consola.`
        );
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

  /* ---------- Búsqueda ---------- */
  const filteredPacientes = pacientes.filter((p) => {
    const t = p.trabajador || {};
    const fullName = `${t.apellido || ""} ${t.nombre || ""}`.toLowerCase();
    const dni = t.dni || "";
    const afiliado = p.afiliadoPaciente || "";
    const hc = p.historiaClinica || "";
    const term = searchTerm.toLowerCase();
    return (
      fullName.includes(term) ||
      dni.includes(term) ||
      afiliado.toLowerCase().includes(term) ||
      hc.toLowerCase().includes(term)
    );
  });

  const esUTI = form.tipoIngreso === "UTI";

  const hcNombre = (hc) => (hc?.nombre_apellido ? hc.nombre_apellido : "—");
  const hcNumber = (hc) =>
    hc?.historia_clinica ? `#${hc.historia_clinica}` : "sin N°";

  const mesPreview = nombreMes(form.trabajadorNacimientoMes);

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
                    background:
                      currentEstado === "abierto" ? "#dcfce7" : "#fee2e2",
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
              >
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              {activeTab === "nuevo" && (
                <button
                  type="button"
                  className={styles.ghostBtn}
                  disabled={saving}
                  onClick={resetForm}
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className={styles.tabsContainer}>
            <button
              className={cx(
                styles.tab,
                activeTab === "nuevo" && styles.tabActive
              )}
              onClick={() => setActiveTab("nuevo")}
            >
              📝 Nuevo / Editar
            </button>
            <button
              className={cx(
                styles.tab,
                activeTab === "buscar" && styles.tabActive
              )}
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
              {saving && (
                <div className={styles.toastInfo}>
                  ⏳ Guardando datos y generando PDF...
                </div>
              )}

              <form onSubmit={onSubmit} autoComplete="on">
                <div className={styles.card}>
                  <Section
                    title="1) Tipo de ingreso y paciente"
                    subtitle="Elegí PISO o UTI, cargá el DNI y el sistema buscará si ya tiene historia clínica del tipo elegido"
                  >
                    <div style={{ marginBottom: 14 }}>
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
                          <div
                            className={styles.errorText}
                            style={{ marginTop: 6 }}
                          >
                            {errors.tipoIngreso}
                          </div>
                        )}
                      </div>
                    </div>

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
                        <label className={styles.label}>
                          DNI <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <div className={styles.dniRow}>
                          <input
                            className={cx(
                              styles.input,
                              errors.trabajadorDni && styles.inputError
                            )}
                            value={form.trabajadorDni}
                            onChange={onChange("trabajadorDni")}
                            onBlur={onBlurTrabajadorDni}
                            inputMode="numeric"
                            placeholder="DNI"
                          />
                          <button
                            type="button"
                            className={styles.dniSearchBtn}
                            onClick={forceLookupDni}
                            disabled={hcLookup.loading}
                            title="Buscar DNI en historias clínicas del tipo elegido"
                          >
                            {hcLookup.loading ? "⏳ Buscando" : "🔎 Buscar HC"}
                          </button>
                        </div>
                        {errors.trabajadorDni && (
                          <div className={styles.errorText}>
                            {errors.trabajadorDni}
                          </div>
                        )}
                      </div>
                    </div>

                    {hcLookup.loading && (
                      <div className={cx(styles.hcBanner, styles.hcBannerInfo)}>
                        ⏳ Buscando DNI <b>{hcLookup.dni}</b> en HC{" "}
                        <b>{hcLookup.tipo}</b>...
                      </div>
                    )}

                    {!hcLookup.loading && hcLookup.searched && (
                      <div className={styles.hcBannerGroup}>
                        {hcLookup.match ? (
                          <div
                            className={cx(
                              styles.hcBanner,
                              styles.hcBannerSuccess
                            )}
                          >
                            <div className={styles.hcBannerContent}>
                              <div>
                                🟢{" "}
                                <b>
                                  HC {hcLookup.tipo} {hcNumber(hcLookup.match)}
                                </b>{" "}
                                — Paciente: <b>{hcNombre(hcLookup.match)}</b>
                                <div className={styles.hcBannerHint}>
                                  DNI coincidente: {hcLookup.match.dni}
                                </div>
                              </div>
                              <button
                                type="button"
                                className={styles.hcApplyBtn}
                                onClick={() =>
                                  aplicarHistoriaClinica(hcLookup.match)
                                }
                              >
                                Aplicar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={cx(
                              styles.hcBanner,
                              styles.hcBannerWarn
                            )}
                          >
                            <div className={styles.hcBannerContent}>
                              <div>
                                ⚠️ Sin HC <b>{hcLookup.tipo}</b> para este DNI.
                                <div className={styles.hcBannerHint}>
                                  {hcLookup.loadingNext ? (
                                    <>⏳ Calculando el próximo N°...</>
                                  ) : hcLookup.nextNumber ? (
                                    <>
                                      Se creará con el N°{" "}
                                      <b>{hcLookup.nextNumber}</b>. Podés crear
                                      una nueva (opcional) o cargar el N°
                                      manualmente.
                                    </>
                                  ) : (
                                    <>
                                      Podés crear una nueva (opcional) o
                                      cargar el N° manualmente.
                                    </>
                                  )}
                                </div>
                              </div>
                              <button
                                type="button"
                                className={styles.hcCreateBtn}
                                onClick={crearHistoriaClinica}
                                disabled={
                                  creatingHc !== null || hcLookup.loadingNext
                                }
                              >
                                {creatingHc
                                  ? "⏳ Creando..."
                                  : hcLookup.loadingNext
                                    ? "⏳ Calculando..."
                                    : hcLookup.nextNumber
                                      ? `+ Crear HC ${hcLookup.tipo} #${hcLookup.nextNumber}`
                                      : `+ Crear HC ${hcLookup.tipo}`}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.grid} style={{ marginTop: 14 }}>
                      {/* ============ FECHA DE NACIMIENTO (3 partes) ============ */}
                      <div className={styles.field}>
                        <label className={styles.label}>
                          Fecha de nacimiento
                        </label>
                        <div className={styles.nacimientoRow}>
                          <input
                            className={cx(
                              styles.input,
                              styles.nacimientoInput,
                              errors.trabajadorNacimientoDia &&
                              styles.inputError
                            )}
                            value={form.trabajadorNacimientoDia}
                            onChange={onChangeNacimiento("Dia")}
                            inputMode="numeric"
                            placeholder="DD"
                            maxLength={2}
                            aria-label="Día de nacimiento"
                          />
                          <div className={styles.nacimientoMesWrapper}>
                            <input
                              className={cx(
                                styles.input,
                                styles.nacimientoInput,
                                errors.trabajadorNacimientoMes &&
                                styles.inputError
                              )}
                              value={form.trabajadorNacimientoMes}
                              onChange={onChangeNacimiento("Mes")}
                              inputMode="numeric"
                              placeholder="MM"
                              maxLength={2}
                              aria-label="Mes de nacimiento"
                            />
                            <div className={styles.mesHint}>
                              {mesPreview || "\u00A0"}
                            </div>
                          </div>
                          <input
                            className={cx(
                              styles.input,
                              styles.nacimientoInput,
                              errors.trabajadorNacimientoAnio &&
                              styles.inputError
                            )}
                            value={form.trabajadorNacimientoAnio}
                            onChange={onChangeNacimiento("Anio")}
                            inputMode="numeric"
                            placeholder="AAAA"
                            maxLength={4}
                            aria-label="Año de nacimiento"
                          />
                        </div>
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>Edad (calculada)</label>
                        <input
                          className={cx(styles.input, styles.inputReadonly)}
                          value={
                            form.trabajadorEdad
                              ? `${form.trabajadorEdad} años`
                              : ""
                          }
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
                                form.trabajadorSexo === val &&
                                styles.chipActive,
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
                        {errors.trabajadorSexo && (
                          <div className={styles.errorText}>
                            {errors.trabajadorSexo}
                          </div>
                        )}
                      </div>

                      <div className={styles.field}>
                        <label className={styles.label}>
                          Teléfono <span style={{ color: "#ef4444" }}>*</span>
                        </label>
                        <input
                          className={cx(
                            styles.input,
                            errors.trabajadorTelefono && styles.inputError
                          )}
                          value={form.trabajadorTelefono}
                          onChange={onChange("trabajadorTelefono")}
                          inputMode="numeric"
                          placeholder="Ej: 11 1234 5678"
                        />
                        {errors.trabajadorTelefono && (
                          <div className={styles.errorText}>
                            {errors.trabajadorTelefono}
                          </div>
                        )}
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
                  </Section>

                  <Section
                    title="2) Datos del ingreso"
                    subtitle="Fecha actual de ingreso, obra social e historia clínica"
                  >
                    <div className={styles.fechasWrapper}>
                      <div className={styles.fechaGroup}>
                        <div className={styles.fechaGroupLabel}>
                          Fecha de ingreso
                        </div>
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
                            onChange={onChangeAnioIngreso}
                            onBlur={onBlurAnioIngreso}
                            placeholder="AA o AAAA"
                            maxLength={4}
                            error={errors.anioIngreso}
                          />
                        </div>
                      </div>
                    </div>

                    <div className={styles.grid} style={{ marginTop: 14 }}>
                      <div className={styles.field}>
                        <label className={styles.label}>O.S</label>
                        <input
                          className={cx(
                            styles.input,
                            errors.OS && styles.inputError
                          )}
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
                      <div className={styles.field}>
                        <label className={styles.label}>
                          HC (Historia Clínica)
                        </label>
                        <input
                          className={styles.input}
                          value={form.historiaClinica}
                          onChange={onChange("historiaClinica")}
                          placeholder="Se completa al aplicar/crear una HC"
                        />
                      </div>
                    </div>
                  </Section>

                  <Section
                    title="3) Familiar responsable"
                    subtitle="Contacto del familiar o allegado"
                  >
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
                  </Section>

                  <Section
                    title="4) Internación"
                    subtitle={`Ubicación del paciente en ${form.tipoIngreso === "UTI" ? "UTI (Terapia)" : "PISO"
                      }`}
                  >
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>
                          Cama{" "}
                          {form.tipoIngreso === "PISO"
                            ? "(N° + letra opcional)"
                            : "(sólo N°)"}
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
                        <div
                          className={styles.sectionHint}
                          style={{ marginTop: 6 }}
                        >
                          Se guardará como:{" "}
                          <b>{buildHabitacionCamaTexto(form) || "—"}</b>
                        </div>
                      </div>
                    </div>
                  </Section>

                  <Section
                    title="5) Médico solicitante y diagnóstico"
                    subtitle="Médico que pide la internación y diagnóstico de ingreso"
                  >
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>
                          Médico solicitante
                        </label>
                        <input
                          className={styles.input}
                          value={form.medicoSolicitante}
                          onChange={onChange("medicoSolicitante")}
                          placeholder="Ej: Dr. Juan Pérez"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>
                          Diagnóstico de ingreso
                        </label>
                        <input
                          className={styles.input}
                          value={form.diagnostico}
                          onChange={onChange("diagnostico")}
                          placeholder="Ej: Neumonía, Post-operatorio..."
                        />
                      </div>
                    </div>
                  </Section>

                  <div className={styles.footer}>
                    <button
                      type="submit"
                      className={styles.primaryBtn}
                      disabled={!canSubmit}
                    >
                      {saving
                        ? "Guardando y generando..."
                        : editingId
                          ? "Actualizar y generar PDF"
                          : "Guardar y generar PDF"}
                    </button>

                    <div className={styles.pdfRow}>
                      {createdId && (
                        <div className={styles.toastSuccess}>
                          ✅ {editingId ? "Actualizado" : "Guardado"}. ID:{" "}
                          <b>{createdId}</b>
                        </div>
                      )}
                      {pdfError && (
                        <div className={styles.toastDanger}>❌ {pdfError}</div>
                      )}
                      {pdfUrl && (
                        <div className={styles.toastSuccess}>
                          <div
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                              justifyContent: "space-between",
                              flexWrap: "wrap",
                            }}
                          >
                            <div>
                              📄 PDF generado:{" "}
                              <b style={{ wordBreak: "break-word" }}>
                                {pdfFileName}
                              </b>
                            </div>
                            <div className={styles.pdfActions}>
                              <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={openPdf}
                              >
                                Abrir
                              </button>
                              <button
                                type="button"
                                className={styles.primaryBtn}
                                style={{ height: 40, width: "auto" }}
                                onClick={downloadPdf}
                              >
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
                  placeholder="Buscar por nombre, apellido, DNI, HC o N° afiliado..."
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
                        <th>HC</th>
                        <th>O.S</th>
                        <th>N° Afiliado</th>
                        <th>Tipo</th>
                        <th>Fecha Ingreso</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPacientes.map((p) => {
                        const t = p.trabajador || {};
                        const fi = p.fechaIngreso || {};
                        const estaImprimiendo = printingId === p.id;

                        return (
                          <tr key={p.id}>
                            <td>
                              {t.apellido} {t.nombre}
                            </td>
                            <td>{t.dni || "—"}</td>
                            <td>{p.historiaClinica || "—"}</td>
                            <td>{p.OS || "—"}</td>
                            <td>{p.afiliadoPaciente || "—"}</td>
                            <td>{p.tipoIngreso || "—"}</td>
                            <td>
                              {fi.dia && fi.mes && fi.anio
                                ? `${fi.dia}/${fi.mes}/${fi.anio}`
                                : "—"}
                            </td>
                            <td className={styles.actionsCell}>
                              <button
                                className={styles.iconBtn}
                                title="Editar"
                                onClick={() => handleEditPaciente(p)}
                                disabled={estaImprimiendo}
                              >
                                ✏️
                              </button>
                              <button
                                className={styles.iconBtn}
                                title={`Reimprimir PDF en nueva pestaña (${p.tipoIngreso || "PISO"
                                  })`}
                                onClick={() => handlePrintPaciente(p)}
                                disabled={estaImprimiendo}
                              >
                                {estaImprimiendo ? "⏳" : "🖨️"}
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
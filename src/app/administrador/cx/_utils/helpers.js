// _utils/helpers.js

// ── Constantes ──
export const DOCTORES = [
  "BRARDA AGUSTIN",
  "CANAGLIA GUSTAVO",
  "CIANCIOSI SEBASTIAN",
  "DEL PUERTO RODRIGO",
  "GIMENEZ MARTIN",
  "PERTUS DIEGO",
].sort();

/* ✅ ART actualizada */
export const ART_LIST = [
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
  "OTRA",
];

export const SUGGESTIONS_MAX = 20;
export const LS_KEY = "cx_form_suggestions_v1";

// ── Normalización ──
export function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[()]/g, "")
    .replace(/__\d+$/g, "")
    .replace(/-\d+$/g, "");
}

export function humanizeKey(k) {
  const s = (k || "").replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function isLikelyCheckbox(fieldType) {
  return fieldType === "/Btn";
}

// ── Canon detectores ──
export const isCanonDia = (c) =>
  normalizeName(c) === "dia" || normalizeName(c) === "día";
export const isCanonMes = (c) => normalizeName(c) === "mes";
export const isCanonAnio = (c) => {
  const n = normalizeName(c);
  return n === "anio" || n === "año" || n === "ano";
};
export const isCanonCX = (c) => normalizeName(c) === "cx";
export const isCanonApellido = (c) => {
  const n = normalizeName(c);
  return n === "apellido-paciente" || n === "apellido";
};
export const isCanonNombre = (c) => {
  const n = normalizeName(c);
  return n === "nombre-paciente" || n === "nombre";
};
export const isCanonNombresPaciente = (c) =>
  normalizeName(c) === "nombres-paciente";
export const isCanonServicio = (c) => normalizeName(c) === "servicio";
export const isCanonEdad = (c) => normalizeName(c) === "edad";
export const isCanonEdadPaciente = (c) => normalizeName(c) === "edad-paciente";
export const isCanonEdadPacienteUI = (c) => {
  const n = normalizeName(c);
  return (
    n === "edad-paciente" ||
    n.includes("edad-paciente") ||
    n.includes("edad_paciente")
  );
};
export const isCanonART = (c) => {
  const n = normalizeName(c);
  return n === "art" || n.includes("art-") || n.includes("-art");
};
export const isCanonDoctor = (c) => {
  const n = normalizeName(c);
  return (
    n === "nombre-dr" ||
    n.includes("nombre-dr") ||
    n.includes("doctor") ||
    n.includes("dr") ||
    n.includes("medico") ||
    n.includes("cirujano")
  );
};
export const isCanonLocalidad = (c) => {
  const n = normalizeName(c);
  return n === "localidad" || n === "localidad-paciente";
};
export const isCanonProvincia = (c) => {
  const n = normalizeName(c);
  return n === "provincia" || n === "provincia-paciente";
};
export const isCanonNacimientoPaciente = (c) => {
  const n = normalizeName(c);
  return (
    n === "nacimiento-paciente" ||
    n === "nacmiento-paciente" ||
    n.includes("nacimiento") ||
    n.includes("nacmiento")
  );
};
export const isCanonDomicilioPaciente = (c) => {
  const n = normalizeName(c);
  return n === "domicilio-paciente" || n.includes("domicilio");
};
export const isCanonHCPaciente = (c) => {
  const n = normalizeName(c);
  return (
    n === "hc-paciente" || n.includes("hc") || n.includes("historia-clinica")
  );
};
export const isCanonDNI = (c) => {
  const n = normalizeName(c);
  return n === "dni-paciente" || n === "dni";
};
export const isCanonSexo = (c) => {
  const n = normalizeName(c);
  return n === "sexo" || n === "sexo-paciente";
};
export const isCanonTelefono = (c) => {
  const n = normalizeName(c);
  return (
    n === "telefono-paciente" ||
    n.includes("telefono") ||
    n.includes("teléfono")
  );
};

// ── Fechas -int ──
export const isCanonDiaInt = (c) => {
  const n = normalizeName(c);
  return (
    n === "dia-int" ||
    n === "día-int" ||
    n === "dia-internacion" ||
    n === "dia-internación"
  );
};
export const isCanonMesInt = (c) => {
  const n = normalizeName(c);
  return n === "mes-int" || n === "mes-internacion";
};
export const isCanonAnioInt = (c) => {
  const n = normalizeName(c);
  return (
    n === "anio-int" ||
    n === "año-int" ||
    n === "anio-internacion" ||
    n === "año-internacion"
  );
};

// ── Familiar ──
export const isCanonFamiliarNombre = (c) => {
  const n = normalizeName(c);
  return (
    n === "familiar-nombre" ||
    n === "nombre-familiar" ||
    n === "familiar-apellido-nombre" ||
    (n.includes("familiar") && (n.includes("nombre") || n.includes("apellido")))
  );
};
export const isCanonFamiliarParentezco = (c) => {
  const n = normalizeName(c);
  return (
    n === "parentezco" ||
    n === "parentesco" ||
    n === "familiar-parentezco" ||
    n === "familiar-parentesco" ||
    n.includes("parentezco") ||
    n.includes("parentesco")
  );
};
export const isCanonFamiliarTelefono = (c) => {
  const n = normalizeName(c);
  return (
    n === "telefono-familiar" ||
    n === "tel-familiar" ||
    n === "familiar-telefono" ||
    n === "familiar-tel" ||
    (n.includes("familiar") &&
      (n.includes("telefono") || n.includes("teléfono") || n.includes("tel")))
  );
};

// ── ✅ NUEVOS ──
export const isCanonDocumento = (c) => {
  const n = normalizeName(c);
  return n === "documento" || n === "lc" || n === "lc-paciente";
};
export const isCanonHabitacionCama = (c) => {
  const n = normalizeName(c);
  return (
    n === "habitacion-cama" ||
    n === "habitación-cama" ||
    n === "cama" ||
    n === "habitacion" ||
    n.includes("habitacion-cama") ||
    n.includes("cama")
  );
};

// ── Cálculos ──
export function computeAgeYears(d, m, y) {
  const dd = Number(d),
    mm = Number(m),
    yy = Number(y);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy))
    return "";
  if (yy < 1900 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  const today = new Date();
  const birth = new Date(yy, mm - 1, dd);
  if (Number.isNaN(birth.getTime())) return "";
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age < 0 ? "" : String(age);
}

export function safeUpper(v) {
  return v === null || v === undefined ? "" : String(v).toUpperCase();
}

export function onlyDigits(s) {
  return (s ?? "").toString().replace(/\D/g, "");
}

export function parseHCNumber(item) {
  const raw =
    item?.historia_clinica ??
    item?.historia_clinica_1 ??
    item?.historiaClinica ??
    item?.hc ??
    "";
  const digits = String(raw).replace(/\D/g, "");
  return digits ? Number(digits) : null;
}

export function formatNumberWithThousands(value) {
  if (!value && value !== 0) return "";
  const n = String(value).replace(/[^\d]/g, "");
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
}

export function parseFormattedNumber(v) {
  return v ? String(v).replace(/\./g, "") : "";
}

export function formatAfiliado(raw) {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length > 8) {
    const p = d.padStart(11, "0").slice(-11);
    return `${p.slice(0, 2)}-${p.slice(2, 4)}.${p.slice(4, 7)}.${p.slice(7, 10)}-${p.slice(10)}`;
  }
  if (d.length === 7) return `${d.slice(0, 1)}.${d.slice(1, 4)}.${d.slice(4, 7)}`;
  if (d.length === 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}`;
  return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const parts = iso.split("-");
  if (parts.length === 3) {
    const [year, month, day] = parts;
    return new Date(year, month - 1, day).toLocaleDateString("es-AR");
  }
  return new Date(iso).toLocaleDateString("es-AR");
}

export function fmtDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function daysUntil(iso) {
  if (!iso) return null;
  const parts = iso.split("-");
  if (parts.length !== 3) return null;
  const [year, month, day] = parts;
  const fecha = new Date(year, month - 1, day);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  fecha.setHours(0, 0, 0, 0);
  return Math.round((fecha - hoy) / 86400000);
}

export function getDoctor(cx) {
  if (cx.doctor) return cx.doctor;
  if (cx.formulario) {
    const k = Object.keys(cx.formulario).find(
      (k) =>
        k.toLowerCase().includes("doctor") ||
        k.toLowerCase().includes("dr") ||
        k === "nombre-dr",
    );
    return k ? cx.formulario[k] : "";
  }
  return "";
}

export function preopStatus(cx) {
  const ecg = !!(cx.ecgProfesional && cx.ecgFecha);
  const lab = !!(cx.labProfesional && cx.labFecha);
  return { ecg, lab, completo: ecg && lab };
}

export function generateSafeFilename(str) {
  return (str || "Paciente")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim()
    .toUpperCase();
}

// ── Sugerencias ──
export function loadSuggestions() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSuggestions(next) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {}
}

export function addSuggestion(sug, canonName, valueRaw) {
  const v = (valueRaw ?? "").toString().trim();
  if (!v) return sug;
  const val = v.toUpperCase();
  const prev = Array.isArray(sug?.[canonName]) ? sug[canonName] : [];
  const without = prev.filter((x) => (x ?? "").toString().toUpperCase() !== val);
  return { ...sug, [canonName]: [val, ...without].slice(0, SUGGESTIONS_MAX) };
}

// ── ✅ PDF por API ──
export async function downloadCxPdf(cx, type = "Frente") {
  try {
    const pd = cx.pacienteDatos || {};
    const payload = {
      pacienteDatos: {
        apellido: pd.apellido || "",
        nombre: pd.nombre || "",
        dni: pd.dni || "",
        edad: pd.edad || "",
        sexo: pd.sexo || "",
        fechaNacimiento: pd.fechaNacimiento || "",
        localidad: pd.localidad || "",
        provincia: pd.provincia || "",
        domicilio: pd.domicilio || "",
        telefono: pd.telefono || "",
        historiaClinica: pd.historiaClinica || "",
      },
      familiar: pd.familiar || {},
      formulario: cx.formulario || {},
      fechaEstimada: cx.fechaEstimada || "",
      fechaCirugia: cx.fechaCirugia || null,
      servicio: "PISO",
      habitacionCama: pd.habitacionCama || "",
      lugarNacimiento: pd.lugarNacimiento || "",
    };

    const baseName =
      `${pd.apellido || ""} ${pd.nombre || ""}`.trim() || "Paciente";
    const fileName = `${generateSafeFilename(baseName)}-${type}.pdf`;

    const res = await fetch("/api/cx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, type, fileName }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Error ${res.status}: ${detail}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  } catch (err) {
    console.error(err);
    alert("Error al generar el PDF: " + err.message);
  }
}
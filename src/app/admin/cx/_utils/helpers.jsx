import { PDFDocument } from "pdf-lib";

// ── Constantes ──
export const DOCTORES = [
  "BRARDA AGUSTIN",
  "CANAGLIA GUSTAVO",
  "CIANCIOSI SEBASTIAN",
  "DEL PUERTO RODRIGO",
  "GIMENEZ MARTIN",
  "PERTUS DIEGO",
].sort();

export const SUGGESTIONS_MAX = 20;
export const LS_KEY = "cx_form_suggestions_v1";

// ── Normalización y detección ──
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

export const isCanonDia = (c) => normalizeName(c) === "dia" || normalizeName(c) === "día";
export const isCanonMes = (c) => normalizeName(c) === "mes";
export const isCanonAnio = (c) => normalizeName(c) === "anio" || normalizeName(c) === "año" || normalizeName(c) === "ano";
export const isCanonCX = (c) => normalizeName(c) === "cx";
export const isCanonApellido = (c) => normalizeName(c) === "apellido-paciente" || normalizeName(c) === "apellido";
export const isCanonNombre = (c) => normalizeName(c) === "nombre-paciente" || normalizeName(c) === "nombre";
export const isCanonNombresPaciente = (c) => normalizeName(c) === "nombres-paciente";
export const isCanonServicio = (c) => normalizeName(c) === "servicio";
export const isCanonEdad = (c) => normalizeName(c) === "edad";
export const isCanonEdadPaciente = (c) => normalizeName(c) === "edad-paciente";
export const isCanonEdadPacienteUI = (c) => normalizeName(c) === "edad-paciente" || normalizeName(c).includes("edad-paciente") || normalizeName(c).includes("edad_paciente");
export const isCanonART = (c) => normalizeName(c) === "art" || normalizeName(c).includes("art-") || normalizeName(c).includes("-art");
export const isCanonDoctor = (c) => normalizeName(c) === "nombre-dr" || normalizeName(c).includes("nombre-dr") || normalizeName(c).includes("doctor") || normalizeName(c).includes("dr") || normalizeName(c).includes("medico") || normalizeName(c).includes("cirujano");
export const isCanonLocalidad = (c) => normalizeName(c) === "localidad" || normalizeName(c) === "localidad-paciente";
export const isCanonProvincia = (c) => normalizeName(c) === "provincia" || normalizeName(c) === "provincia-paciente";
export const isCanonNacimientoPaciente = (c) => normalizeName(c) === "nacimiento-paciente" || normalizeName(c) === "nacmiento-paciente" || normalizeName(c).includes("nacimiento") || normalizeName(c).includes("nacmiento");
export const isCanonDomicilioPaciente = (c) => normalizeName(c) === "domicilio-paciente" || normalizeName(c).includes("domicilio");
export const isCanonHCPaciente = (c) => normalizeName(c) === "hc-paciente" || normalizeName(c).includes("hc") || normalizeName(c).includes("historia-clinica");
export const isCanonDNI = (c) => normalizeName(c) === "dni-paciente" || normalizeName(c) === "dni";
export const isCanonSexo = (c) => normalizeName(c) === "sexo" || normalizeName(c) === "sexo-paciente";
export const isCanonTelefono = (c) => normalizeName(c) === "telefono-paciente" || normalizeName(c).includes("telefono") || normalizeName(c).includes("teléfono");

// ── Cálculos ──
export function computeAgeYears(d, m, y) {
  const dd = Number(d), mm = Number(m), yy = Number(y);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return "";
  if (yy < 1900 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return "";
  const today = new Date();
  const birth = new Date(yy, mm - 1, dd);
  if (Number.isNaN(birth.getTime())) return "";
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday = today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age < 0 ? "" : String(age);
}

export function safeUpper(v) {
  return v === null || v === undefined ? "" : String(v).toUpperCase();
}

export function formatNumberWithThousands(value) {
  if (!value && value !== 0) return "";
  const n = String(value).replace(/[^\d]/g, "");
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
}

export function parseFormattedNumber(v) {
  return v ? String(v).replace(/\./g, "") : "";
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
  return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
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

// ── PDF ──
export async function buildPdfFromCX(cx, templateUrl, mapping, canonical) {
  if (!mapping || !canonical) throw new Error("Mapping no cargado");
  const templateBytes = await fetch(templateUrl, { cache: "no-store" }).then((r) => {
    if (!r.ok) throw new Error(`Error cargando template (${r.status})`);
    return r.arrayBuffer();
  });
  const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const pdfForm = pdfDoc.getForm();

  const trySetText = (fieldName, value) => {
    const v = safeUpper((value ?? "").toString()).trim();
    if (!v) return;
    try { pdfForm.getTextField(fieldName).setText(v); } catch {}
  };
  const tryCheck = (fieldName, shouldCheck) => {
    if (!shouldCheck) return;
    try { pdfForm.getCheckBox(fieldName).check(); } catch {}
  };

  const ap = cx.pacienteDatos?.apellido || "";
  const nom = cx.pacienteDatos?.nombre || "";
  const nombresPaciente = [ap, nom].filter(Boolean).join(" ").trim();
  const edadValue = cx.pacienteDatos?.edad ? `${cx.pacienteDatos.edad} años` : "";
  const doctorRaw = getDoctor(cx);
  const doctorPrint = doctorRaw && !/^dr\.?\s/i.test(doctorRaw) ? `Dr. ${doctorRaw}` : doctorRaw;

  trySetText("apellido-paciente", ap);
  trySetText("nombre-paciente", nom);
  trySetText("nombres-paciente", nombresPaciente);
  trySetText("edad", edadValue);
  trySetText("edad-paciente", edadValue);
  trySetText("servicio", "PISO");
  trySetText("nombre-dr", doctorPrint);
  tryCheck("masculino-paciente", cx.pacienteDatos?.sexo === "M");
  tryCheck("femenino-paciente", cx.pacienteDatos?.sexo === "F");

  const form = cx.formulario || {};
  for (const [canonName, value] of Object.entries(form)) {
    const internals = canonical.canonicalToInternal[canonName] || [];
    const isBtn = mapping[internals[0]]?.[0]?.field_type === "/Btn";
    for (const internal of internals) {
      if (isBtn) tryCheck(internal, !!value);
      else trySetText(internal, value);
    }
    if (isBtn) tryCheck(canonName, !!value);
    else trySetText(canonName, value);
  }

  pdfForm.flatten();
  return await pdfDoc.save();
}

export async function downloadCxPdf(cx, type, mapping, canonical) {
  if (!mapping || !canonical) {
    alert("Los datos de mapeo aún no están listos.");
    return;
  }
  const url = type === "Frente" ? "/templates/FRENTE-CX.pdf" : "/templates/DORSO-CX.pdf";
  try {
    const bytes = await buildPdfFromCX(cx, url, mapping, canonical);
    const blob = new Blob([bytes], { type: "application/pdf" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const name = generateSafeFilename(`${cx.pacienteDatos?.apellido || ""} ${cx.pacienteDatos?.nombre || ""}`.trim());
    a.href = href;
    a.download = `${name}-${type}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1200);
  } catch (err) {
    console.error(err);
    alert("Error al generar el PDF");
  }
}
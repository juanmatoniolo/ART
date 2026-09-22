"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import {
  push, ref, set, get, child, update, runTransaction,
} from "firebase/database";
import { getSession } from "@/utils/session";
import styles from "./ingresos.module.css";
import DocumentosModal from "./DocumentosModal";
import DocumentacionSection from "./DocumentacionSection";
import { generarDorsoPDFBlob, openPDFBlob } from "./documentosHelpers";
import { generarDocumentosPDFBlob } from "./generarDocumentosPDF";
import {
  PRESTADOR_CONST,
  initialForm,
  onlyDigits,
  normalizeYear2,
  formatIdField,
  calcularEdad,
  nombreMes,
  buildNacimientoISO,
  splitNacimientoISO,
  buildHabitacionCama,
  buildHabitacionCamaTexto,
  getPdfPages,
  splitNombreCompleto,
  parseHCNumber,
  validate,
  cx,
  Section,
  DatePartInput,
  defaultDay,
  defaultMonth,
  defaultYearShort,
} from "./helpers";
import Header from "@/components/Header/Header";

const STORAGE_KEY = "ingreso_paciente_form_v1";
const THEME_KEY = "siniestro_theme";
const DB_NODE = "ingresos-pacientes";
const HC_PATH = "historias-clinicas";
const HC_UTI_PATH = "historias-clinica-uti";
const COUNTER_GENERAL_PATH = "counters/historias-clinicas/lastNumber";
const COUNTER_UTI_PATH = "counters/historias-clinica-uti/lastNumber";

/* ============================================================
   HTML helpers para la pestaña "Imprimir"
   ============================================================ */
function buildLoadingHtml(pacienteNombre) {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Generando PDF…</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; height: 100%; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: #0f121f; color: #eef2ff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  }
  .wrap { display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 24px; text-align: center; }
  .spinner {
    width: 56px; height: 56px; border-radius: 50%;
    border: 4px solid rgba(148, 163, 184, 0.25);
    border-top-color: #5b8c5a;
    animation: spin 0.9s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
  .title { font-size: 16px; font-weight: 700; color: #e2e8f0; }
  .sub { font-size: 13px; color: #94a3b8; max-width: 340px; line-height: 1.45; }
  .name { font-size: 12.5px; color: #cbd5e1; margin-top: 4px; font-weight: 600; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="spinner" aria-hidden="true"></div>
    <div class="title">📄 Generando PDF…</div>
    <div class="sub">Estamos preparando el formulario de ingreso. Esto puede demorar unos segundos.</div>
    ${pacienteNombre ? `<div class="name">${pacienteNombre}</div>` : ""}
  </div>
</body>
</html>`;
}

function buildViewerHtml(pdfUrl, fileName, hasDocs) {
  const safeName = fileName.replace(/"/g, "&quot;");
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${fileName}</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  html, body { margin: 0; height: 100%; background: #0f121f; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  .bar {
    display: flex; align-items: center; gap: 12px;
    padding: 10px 16px;
    background: #1e2436;
    border-bottom: 1px solid #2d3748;
    color: #eef2ff;
  }
  .name {
    flex: 1; min-width: 0;
    font-size: 13px; font-weight: 600; color: #cbd5e1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .name b { color: #e2e8f0; }
  .badge {
    font-size: 10.5px; font-weight: 700; padding: 3px 8px;
    border-radius: 999px; background: rgba(59, 130, 246, 0.18);
    color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.35);
  }
  .actions { display: flex; gap: 8px; flex-shrink: 0; }
  .btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: #5b8c5a; color: #fff;
    border: none; padding: 9px 14px; border-radius: 8px;
    font-size: 13.5px; font-weight: 700; cursor: pointer;
    text-decoration: none;
    transition: background 0.15s;
  }
  .btn:hover { background: #477a46; }
  .btn.secondary {
    background: transparent; color: #cbd5e1;
    border: 1px solid rgba(148, 163, 184, 0.35);
  }
  .btn.secondary:hover { background: rgba(148, 163, 184, 0.1); }
  iframe {
    width: 100%;
    height: calc(100% - 57px);
    border: none; display: block; background: #fff;
  }
  @media (max-width: 480px) {
    .bar { padding: 8px 10px; gap: 8px; }
    .name { font-size: 12px; }
    .btn { padding: 8px 10px; font-size: 12.5px; }
    .badge { display: none; }
  }
</style>
</head>
<body>
  <div class="bar">
    <div class="name">📄 <b>${safeName}</b></div>
    ${hasDocs ? '<span class="badge">+ Documentación</span>' : ""}
    <div class="actions">
      <a class="btn secondary" href="${pdfUrl}" target="_blank" rel="noopener noreferrer">🔍 Abrir</a>
      <a class="btn" href="${pdfUrl}" download="${safeName}">⬇️ Descargar PDF</a>
    </div>
  </div>
  <iframe src="${pdfUrl}#toolbar=0&navpanes=0" title="Vista previa del PDF"></iframe>
</body>
</html>`;
}

function buildErrorHtml(msg) {
  const safe = String(msg || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Error al generar PDF</title>
<style>
  html, body { margin: 0; height: 100%; }
  body {
    display: flex; align-items: center; justify-content: center;
    background: #0f121f; color: #eef2ff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
    text-align: center; padding: 24px;
  }
  .wrap { max-width: 420px; display: flex; flex-direction: column; gap: 12px; align-items: center; }
  .icon { font-size: 48px; }
  .title { font-size: 17px; font-weight: 800; color: #fca5a5; }
  .msg { font-size: 13.5px; color: #94a3b8; line-height: 1.5; word-break: break-word; }
  .btn {
    margin-top: 8px; background: #5b8c5a; color: #fff;
    border: none; padding: 10px 16px; border-radius: 8px;
    font-size: 14px; font-weight: 700; cursor: pointer; text-decoration: none;
  }
  .btn:hover { background: #477a46; }
</style>
</head>
<body>
  <div class="wrap">
    <div class="icon">❌</div>
    <div class="title">No se pudo generar el PDF</div>
    <div class="msg">${safe}</div>
    <a class="btn" href="javascript:window.close()">Cerrar</a>
  </div>
</body>
</html>`;
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
  const [printingDorsoId, setPrintingDorsoId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const [docs, setDocs] = useState([]);
  const [docsModalPaciente, setDocsModalPaciente] = useState(null);

  const [hcLookup, setHcLookup] = useState({
    loading: false, searched: false, dni: "", tipo: "PISO",
    match: null, nextNumber: null, loadingNext: false,
  });
  const lastLookupDniRef = useRef("");
  const [creatingHc, setCreatingHc] = useState(null);
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
      if (!raw) return;
      const merged = { ...initialForm, ...JSON.parse(raw) };
      const tienePartes = merged.trabajadorNacimientoDia || merged.trabajadorNacimientoMes || merged.trabajadorNacimientoAnio;
      if (merged.trabajadorNacimiento && !tienePartes) {
        const { dia, mes, anio } = splitNacimientoISO(merged.trabajadorNacimiento);
        merged.trabajadorNacimientoDia = dia;
        merged.trabajadorNacimientoMes = mes;
        merged.trabajadorNacimientoAnio = anio;
      }
      setForm(merged);
    } catch { }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); } catch { }
    }, 250);
    return () => clearTimeout(t);
  }, [form]);

  useEffect(() => {
    return () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); };
  }, [pdfUrl]);

  useEffect(() => {
    setForm((prev) => {
      const edad = calcularEdad(prev.trabajadorNacimiento);
      if (prev.trabajadorEdad === edad) return prev;
      return { ...prev, trabajadorEdad: edad };
    });
  }, [form.trabajadorNacimiento]);

  useEffect(() => {
    if (form.tipoIngreso === "UTI" && form.camaLetra) {
      setForm((p) => ({ ...p, camaLetra: "" }));
    }
  }, [form.tipoIngreso]);

  useEffect(() => {
    const digits = onlyDigits(form.trabajadorDni);
    if (digits.length >= 7 && hcLookup.searched && hcLookup.tipo !== form.tipoIngreso) {
      lastLookupDniRef.current = "";
      lookupDniInHC(digits, form.tipoIngreso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (activeTab === "buscar") fetchAllPacientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      } else setPacientes([]);
    } catch (error) {
      console.error("Error cargando ingresos:", error);
    } finally {
      setLoadingPacientes(false);
    }
  };

  const canSubmit = useMemo(() => !saving, [saving]);

  const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  const onChangeAnioIngreso = (e) => {
    const raw = e.target.value;
    setForm((p) => ({ ...p, anioIngreso: raw }));
  };

  const onBlurAnioIngreso = () => {
    setForm((p) => ({ ...p, anioIngreso: normalizeYear2(p.anioIngreso) }));
  };

  const onChangeNacimiento = (part) => (e) => {
    const raw = onlyDigits(e.target.value);
    setForm((p) => {
      const next = { ...p, [`trabajadorNacimiento${part}`]: raw };
      next.trabajadorNacimiento = buildNacimientoISO(next);
      return next;
    });
  };

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
      for (const item of Object.values(snapHC.val())) {
        const n = parseHCNumber(item);
        if (Number.isFinite(n) && n > maxReal) maxReal = n;
      }
    }
    const counterVal = snapCounter.exists() ? Number(snapCounter.val() || 0) : 0;
    return Math.max(maxReal, counterVal) + 1;
  };

  const lookupDniInHC = async (dniDigits, tipo) => {
    if (!dniDigits || dniDigits.length < 7) return;
    const tipoNorm = tipo === "UTI" ? "UTI" : "PISO";
    const cacheKey = `${tipoNorm}::${dniDigits}`;
    if (lastLookupDniRef.current === cacheKey) return;
    lastLookupDniRef.current = cacheKey;

    setHcLookup({ loading: true, searched: false, dni: dniDigits, tipo: tipoNorm, match: null, nextNumber: null, loadingNext: false });

    try {
      const hcPath = tipoNorm === "UTI" ? HC_UTI_PATH : HC_PATH;
      const snap = await get(child(ref(db), hcPath));

      const matchesDni = (itemDniRaw) => {
        const itemDni = onlyDigits(itemDniRaw);
        if (!itemDni) return false;
        if (itemDni === dniDigits) return true;
        if (dniDigits.length === 11 && itemDni === dniDigits.slice(2, 10)) return true;
        if (itemDni.length === 11 && dniDigits === itemDni.slice(2, 10)) return true;
        return false;
      };

      let match = null;
      if (snap.exists()) {
        for (const [id, v] of Object.entries(snap.val())) {
          if (matchesDni(v.dni || v.documento)) {
            match = {
              id, tipo: tipoNorm,
              nombre_apellido: v.nombre_apellido || v.nombre || "",
              dni: v.dni || v.documento || "",
              historia_clinica: v.historia_clinica || v.historia_clinica_1 || "",
            };
            break;
          }
        }
      }

      setHcLookup({ loading: false, searched: true, dni: dniDigits, tipo: tipoNorm, match, nextNumber: null, loadingNext: !match });

      if (!match) {
        try {
          const next = await calcularProximoNumeroHC(tipoNorm);
          setHcLookup((prev) => ({ ...prev, nextNumber: next, loadingNext: false }));
        } catch (err) {
          console.error("Error calculando próximo HC:", err);
          setHcLookup((prev) => ({ ...prev, loadingNext: false }));
        }
      }
    } catch (err) {
      console.error("Error buscando DNI en HC:", err);
      setHcLookup({ loading: false, searched: true, dni: dniDigits, tipo: tipoNorm, match: null, nextNumber: null, loadingNext: false });
    }
  };

  const onBlurTrabajadorDni = () => {
    const formatted = formatIdField(form.trabajadorDni);
    setForm((p) => ({ ...p, trabajadorDni: formatted }));
    const digits = onlyDigits(formatted);
    if (digits.length >= 7) lookupDniInHC(digits, form.tipoIngreso);
  };

  const forceLookupDni = () => {
    const digits = onlyDigits(form.trabajadorDni);
    if (digits.length < 7) { alert("Ingresá al menos 7 dígitos del DNI/CUIL"); return; }
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

  const crearHistoriaClinica = async () => {
    const tipo = form.tipoIngreso === "UTI" ? "UTI" : "PISO";
    const isUti = tipo === "UTI";
    const dniDigits = onlyDigits(form.trabajadorDni);
    if (dniDigits.length < 7) { alert("Ingresá al menos 7 dígitos del DNI/CUIL"); return; }
    if (!form.trabajadorApellido.trim() || !form.trabajadorNombre.trim()) {
      alert("Completá apellido y nombre del paciente antes de crear la HC"); return;
    }
    const numeroPreview = hcLookup.nextNumber ? ` (se asignará el N° ${hcLookup.nextNumber})` : "";
    const ok = window.confirm(`¿Crear una nueva historia clínica ${tipo} para "${form.trabajadorApellido} ${form.trabajadorNombre}" (DNI ${dniDigits})${numeroPreview}?`);
    if (!ok) return;
    setCreatingHc(tipo);

    try {
      const counterPath = isUti ? COUNTER_UTI_PATH : COUNTER_GENERAL_PATH;
      const hcPath = isUti ? HC_UTI_PATH : HC_PATH;

      const snapshot = await get(child(ref(db), hcPath));
      let maxReal = 0;
      if (snapshot.exists()) {
        for (const item of Object.values(snapshot.val())) {
          const n = parseHCNumber(item);
          if (Number.isFinite(n) && n > maxReal) maxReal = n;
        }
      }

      const counterRef = ref(db, counterPath);
      const tx = await runTransaction(counterRef, (currentValue) => Number(currentValue || 0) + 1);
      if (!tx.committed) throw new Error("No se pudo reservar el número");
      const reservedNumber = Number(tx.snapshot.val() || 0);

      let finalNumber = reservedNumber > maxReal ? reservedNumber : maxReal + 1;
      if (finalNumber !== reservedNumber) await set(counterRef, finalNumber);

      const newNumber = String(finalNumber);
      const session = (typeof getSession === "function" && getSession()) || {};
      const userName = session.user || session.usuario || session.nombre || "sistema";
      const userKey = session.id || session.key || "";
      const now = Date.now();
      const newRef = push(ref(db, hcPath));
      const nombreCompleto = `${form.trabajadorApellido.trim()} ${form.trabajadorNombre.trim()}`.trim().toUpperCase();

      if (isUti) {
        await set(newRef, {
          nombre: nombreCompleto, documento: dniDigits, historia_clinica_1: newNumber,
          alertas: [], createdBy: userName, createdByUserKey: userKey, createdAt: now,
          modifiedBy: userName, modifiedByUserKey: userKey, modifiedAt: now,
        });
      } else {
        await set(newRef, {
          nombre_apellido: nombreCompleto, dni: dniDigits, historia_clinica: newNumber,
          alertas: [], createdBy: userName, createdByUserKey: userKey, createdAt: now,
          modifiedBy: userName, modifiedByUserKey: userKey, modifiedAt: now,
        });
      }

      setForm((p) => ({ ...p, historiaClinica: newNumber }));
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
    setHcLookup({ loading: false, searched: false, dni: "", tipo: "PISO", match: null, nextNumber: null, loadingNext: false });
    setCreatingHc(null);
    setDocs([]);
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
      trabajadorLugarNacimiento:
        paciente["nacimiento-paciente"] ||
        paciente.nacimientoPaciente ||
        paciente.lugarNacimiento ||
        t.lugarNacimiento ||
        "",
      trabajadorSexo: t.sexo || "",
      trabajadorCalle: t.calle || "",
      trabajadorNumero: t.numero || "",
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

    const docsExistentes = Array.isArray(paciente.documentacion) ? paciente.documentacion : [];
    setDocs(docsExistentes);

    setEditingId(paciente.id);
    setCurrentEstado(paciente.estado || "abierto");
    setActiveTab("nuevo");
    setCreatedId(null);
    setPdfError(null);
    setPdfUrl(null);
    setPdfFileName(null);
    lastLookupDniRef.current = "";
    setHcLookup({ loading: false, searched: false, dni: "", tipo: "PISO", match: null, nextNumber: null, loadingNext: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  /* ------------------------------------------------------------------
     Helper: construir el blob final (ingreso + documentación)
     ------------------------------------------------------------------ */
  const buildPacientePdfBlob = async (paciente) => {
    const tipoIngreso = paciente.tipoIngreso || "PISO";
    const payload = { ...paciente, prestador: paciente.prestador || PRESTADOR_CONST };
    const apellido = payload.trabajador?.apellido || "SIN_APELLIDO";
    const dni = onlyDigits(payload.trabajador?.dni) || "SIN_DNI";
    const os = (payload.OS || "OS").replace(/\s+/g, "_");
    const formFileName = `INT_${apellido}_${dni}_${os}.pdf`;

    /* 1) Formulario */
    const res = await fetch("/api/ingresos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payload, fileName: formFileName, pages: getPdfPages(tipoIngreso) }),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Error al generar PDF: ${res.status} ${errorText}`);
    }
    const formBlob = await res.blob();

    /* 2) Documentación + fusión */
    const docsPaciente = Array.isArray(paciente.documentacion) ? paciente.documentacion : [];
    if (docsPaciente.length === 0) {
      return { blob: formBlob, fileName: formFileName, hasDocs: false };
    }

    const formLike = {
      trabajadorApellido: payload.trabajador?.apellido || "",
      trabajadorNombre: payload.trabajador?.nombre || "",
      trabajadorDni: payload.trabajador?.dni || "",
      OS: payload.OS || "",
      afiliadoPaciente: payload.afiliadoPaciente || "",
    };

    const docsBlob = await generarDocumentosPDFBlob({ docs: docsPaciente, form: formLike });
    if (!docsBlob) {
      return { blob: formBlob, fileName: formFileName, hasDocs: false };
    }

    const { PDFDocument } = await import("pdf-lib");
    const formBytes = await formBlob.arrayBuffer();
    const docsBytes = await docsBlob.arrayBuffer();

    const formPdf = await PDFDocument.load(formBytes);
    const docsPdf = await PDFDocument.load(docsBytes);
    const merged = await PDFDocument.create();

    const formPages = await merged.copyPages(formPdf, formPdf.getPageIndices());
    formPages.forEach((pg) => merged.addPage(pg));

    const docPages = await merged.copyPages(docsPdf, docsPdf.getPageIndices());
    docPages.forEach((pg) => merged.addPage(pg));

    const mergedBytes = await merged.save();
    const mergedBlob = new Blob([mergedBytes], { type: "application/pdf" });
    const mergedName = formFileName.replace(/\.pdf$/i, "_CON_DOCS.pdf");
    return { blob: mergedBlob, fileName: mergedName, hasDocs: true };
  };

  /* ------------------------------------------------------------------
     Imprimir: abre pestaña con spinner, luego visor + botón Descargar
     ------------------------------------------------------------------ */
  const handlePrintPaciente = async (paciente) => {
    setPrintingId(paciente.id);
    const t = paciente.trabajador || {};
    const pacienteNombre = `${t.apellido || ""} ${t.nombre || ""}`.trim();

    const newTab = window.open("", "_blank");
    if (newTab) {
      try {
        newTab.document.open();
        newTab.document.write(buildLoadingHtml(pacienteNombre));
        newTab.document.close();
      } catch { /* noop */ }
    }

    try {
      const { blob, fileName, hasDocs } = await buildPacientePdfBlob(paciente);
      const url = URL.createObjectURL(blob);

      if (newTab && !newTab.closed) {
        try {
          newTab.document.open();
          newTab.document.write(buildViewerHtml(url, fileName, hasDocs));
          newTab.document.close();
          try { newTab.document.title = fileName; } catch { /* noop */ }
          const checkClosed = setInterval(() => {
            if (newTab.closed) {
              clearInterval(checkClosed);
              URL.revokeObjectURL(url);
            }
          }, 3000);
          return;
        } catch (writeErr) {
          console.warn("No se pudo reescribir la pestaña:", writeErr);
          newTab.location.href = url;
          return;
        }
      }

      /* Si no pudimos abrir pestaña: descarga directa */
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error(err);
      if (newTab && !newTab.closed) {
        try {
          newTab.document.open();
          newTab.document.write(buildErrorHtml(err.message));
          newTab.document.close();
        } catch { newTab.close(); }
      } else {
        alert("No se pudo generar el PDF: " + err.message);
      }
    } finally {
      setPrintingId(null);
    }
  };

  /* ------------------------------------------------------------------
     Descargar: sin pestaña, dispara el download del blob
     ------------------------------------------------------------------ */
  const handleDownloadPaciente = async (paciente) => {
    setDownloadingId(paciente.id);
    try {
      const { blob, fileName } = await buildPacientePdfBlob(paciente);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error(err);
      alert("No se pudo descargar el PDF: " + err.message);
    } finally {
      setDownloadingId(null);
    }
  };

  const handlePrintDorsoPaciente = async (paciente) => {
    setPrintingDorsoId(paciente.id);
    try {
      const apellido = (paciente.trabajador?.apellido || "").trim().toUpperCase();
      const nombre = (paciente.trabajador?.nombre || "").trim().toUpperCase();
      const pacienteNombre = `${apellido} ${nombre}`.trim();

      const blob = await generarDorsoPDFBlob({ pacienteNombre });
      openPDFBlob(
        blob,
        `DORSO_${pacienteNombre.replace(/\s+/g, "_") || "PACIENTE"}.pdf`
      );
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el Dorso: " + err.message);
    } finally {
      setPrintingDorsoId(null);
    }
  };

  function openPdf() { if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer"); }
  function downloadPdf() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = pdfFileName || "FORMULARIO_INGRESO.pdf";
    document.body.appendChild(a); a.click(); a.remove();
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
      const habitacionCamaTexto = buildHabitacionCamaTexto(form);
      const anioIngreso2 = normalizeYear2(form.anioIngreso);
      const lugarNac = (form.trabajadorLugarNacimiento || "").trim().toUpperCase();

      const payload = {
        OS: (form.OS || "").trim().toUpperCase(),
        afiliadoPaciente: (form.afiliadoPaciente || "").trim().toUpperCase(),
        historiaClinica: (form.historiaClinica || "").trim().toUpperCase(),
        tipoIngreso: form.tipoIngreso,

        /* ⬇️ Lugar de nacimiento en 3 formatos para cubrir cualquier plantilla del PDF */
        "nacimiento-paciente": lugarNac,
        nacimientoPaciente: lugarNac,
        lugarNacimiento: lugarNac,

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
          /* ⬇️ También dentro de trabajador por si la plantilla lo lee anidado */
          lugarNacimiento: lugarNac,
          edad: form.trabajadorEdad,
          sexo: form.trabajadorSexo,
          calle: form.trabajadorCalle.trim().toUpperCase() || "",
          numero: form.trabajadorNumero.trim().toUpperCase() || "",
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
          camaLetra: form.tipoIngreso === "UTI" ? "" : (form.camaLetra || "").trim().toUpperCase(),
          habitacionCama,
          habitacionCamaTexto,
        },
        medicoSolicitante: (form.medicoSolicitante || "").trim().toUpperCase(),
        diagnostico: (form.diagnostico || "").trim().toUpperCase(),
        documentacion: docs,
        prestador: PRESTADOR_CONST,
        updatedAt: Date.now(),
      };

      /* Log temporal para verificar en consola qué se está enviando */
      console.log("PAYLOAD lugar de nacimiento:", {
        "nacimiento-paciente": payload["nacimiento-paciente"],
        nacimientoPaciente: payload.nacimientoPaciente,
        lugarNacimiento: payload.lugarNacimiento,
        "trabajador.lugarNacimiento": payload.trabajador.lugarNacimiento,
      });

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

      const res = await fetch("/api/ingresos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, fileName, pages: getPdfPages(form.tipoIngreso) }),
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

      const formBlob = await res.blob();

      let finalBlob = formBlob;
      let finalFileName = fileName;

      if (Array.isArray(docs) && docs.length > 0) {
        try {
          const docsBlob = await generarDocumentosPDFBlob({ docs, form });
          if (docsBlob) {
            const { PDFDocument } = await import("pdf-lib");
            const formBytes = await formBlob.arrayBuffer();
            const docsBytes = await docsBlob.arrayBuffer();

            const formPdf = await PDFDocument.load(formBytes);
            const docsPdf = await PDFDocument.load(docsBytes);
            const merged = await PDFDocument.create();

            const formPages = await merged.copyPages(formPdf, formPdf.getPageIndices());
            formPages.forEach((pg) => merged.addPage(pg));

            const docsPages = await merged.copyPages(docsPdf, docsPdf.getPageIndices());
            docsPages.forEach((pg) => merged.addPage(pg));

            const mergedBytes = await merged.save();
            finalBlob = new Blob([mergedBytes], { type: "application/pdf" });
            finalFileName = fileName.replace(/\.pdf$/i, "_CON_DOCS.pdf");
          }
        } catch (err) {
          console.error("No se pudo fusionar el PDF de documentación:", err);
        }
      }

      const url = URL.createObjectURL(finalBlob);
      setPdfUrl(url);
      setPdfFileName(finalFileName);
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
    const hc = p.historiaClinica || "";
    const term = searchTerm.toLowerCase();
    return fullName.includes(term) || dni.includes(term) || afiliado.toLowerCase().includes(term) || hc.toLowerCase().includes(term);
  });

  const esUTI = form.tipoIngreso === "UTI";
  const hcNombre = (hc) => (hc?.nombre_apellido ? hc.nombre_apellido : "—");
  const hcNumber = (hc) => (hc?.historia_clinica ? `#${hc.historia_clinica}` : "sin N°");
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
                  ? editingId ? "Editando ingreso existente" : "Nuevo registro de ingreso"
                  : "Buscar y gestionar ingresos"}
              </p>
              {editingId && currentEstado && (
                <span style={{
                  display: "inline-block", marginTop: "0.5rem", padding: "0.25rem 0.75rem",
                  borderRadius: "999px", fontSize: "0.85rem", fontWeight: 500,
                  background: currentEstado === "abierto" ? "#dcfce7" : "#fee2e2",
                  color: currentEstado === "abierto" ? "#166534" : "#991b1b",
                }}>
                  {currentEstado === "abierto" ? "🟢 Abierto" : "🔴 Cerrado"}
                </span>
              )}
            </div>
            <div className={styles.headerActions}>
              <button type="button" className={styles.ghostBtn} onClick={toggleTheme}>
                {theme === "dark" ? "☀️" : "🌙"}
              </button>
              {activeTab === "nuevo" && (
                <button type="button" className={styles.ghostBtn} disabled={saving} onClick={resetForm}>
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
              onClick={() => { setActiveTab("buscar"); fetchAllPacientes(); }}
            >
              🔍 Buscar Pacientes
            </button>
            <button
              className={styles.tab}
              onClick={() =>
                window.open("/historia-clinica", "noopener,noreferrer")
              }
              title="Abrir Historias Clínicas en una pestaña nueva"
            >
              📋 Historias Clínicas
            </button>
          </div>

          {activeTab === "nuevo" ? (
            <>
              {saving && <div className={styles.toastInfo}>⏳ Guardando datos y generando PDF...</div>}

              <form onSubmit={onSubmit} autoComplete="on">
                <div className={styles.card}>
                  <Section title="1) Tipo de ingreso y paciente"
                    subtitle="Elegí PISO o UTI, cargá el DNI y el sistema buscará si ya tiene historia clínica del tipo elegido">
                    <div style={{ marginBottom: 14 }}>
                      <div className={styles.fieldFull}>
                        <label className={styles.label}>Tipo de ingreso</label>
                        <div className={styles.chips}>
                          {[["PISO", "PISO"], ["UTI", "UTI (Terapia)"]].map(([val, label]) => (
                            <label key={val} className={cx(styles.chip, form.tipoIngreso === val && styles.chipActive, errors.tipoIngreso && styles.inputError)}>
                              <input type="radio" name="tipoIngreso" value={val} checked={form.tipoIngreso === val} onChange={onChange("tipoIngreso")} />
                              {label}
                            </label>
                          ))}
                        </div>
                        {errors.tipoIngreso && <div className={styles.errorText} style={{ marginTop: 6 }}>{errors.tipoIngreso}</div>}
                      </div>
                    </div>

                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>Apellido</label>
                        <input className={styles.input} value={form.trabajadorApellido} onChange={onChange("trabajadorApellido")} placeholder="Apellido" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Nombre</label>
                        <input className={styles.input} value={form.trabajadorNombre} onChange={onChange("trabajadorNombre")} placeholder="Nombre" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>DNI <span style={{ color: "#ef4444" }}>*</span></label>
                        <div className={styles.dniRow}>
                          <input className={cx(styles.input, errors.trabajadorDni && styles.inputError)}
                            value={form.trabajadorDni} onChange={onChange("trabajadorDni")}
                            onBlur={onBlurTrabajadorDni} inputMode="numeric" placeholder="DNI" />
                          <button type="button" className={styles.dniSearchBtn} onClick={forceLookupDni} disabled={hcLookup.loading}>
                            {hcLookup.loading ? "⏳ Buscando" : "🔎 Buscar HC"}
                          </button>
                        </div>
                        {errors.trabajadorDni && <div className={styles.errorText}>{errors.trabajadorDni}</div>}
                      </div>
                    </div>

                    {hcLookup.loading && (
                      <div className={cx(styles.hcBanner, styles.hcBannerInfo)}>
                        ⏳ Buscando DNI <b>{hcLookup.dni}</b> en HC <b>{hcLookup.tipo}</b>...
                      </div>
                    )}

                    {!hcLookup.loading && hcLookup.searched && (
                      <div className={styles.hcBannerGroup}>
                        {hcLookup.match ? (
                          <div className={cx(styles.hcBanner, styles.hcBannerSuccess)}>
                            <div className={styles.hcBannerContent}>
                              <div>
                                🟢 <b>HC {hcLookup.tipo} {hcNumber(hcLookup.match)}</b> — Paciente: <b>{hcNombre(hcLookup.match)}</b>
                                <div className={styles.hcBannerHint}>DNI coincidente: {hcLookup.match.dni}</div>
                              </div>
                              <button type="button" className={styles.hcApplyBtn} onClick={() => aplicarHistoriaClinica(hcLookup.match)}>Aplicar</button>
                            </div>
                          </div>
                        ) : (
                          <div className={cx(styles.hcBanner, styles.hcBannerWarn)}>
                            <div className={styles.hcBannerContent}>
                              <div>
                                ⚠️ Sin HC <b>{hcLookup.tipo}</b> para este DNI.
                                <div className={styles.hcBannerHint}>
                                  {hcLookup.loadingNext ? <>⏳ Calculando el próximo N°...</> : hcLookup.nextNumber ? (
                                    <>Se creará con el N° <b>{hcLookup.nextNumber}</b>.</>
                                  ) : (<>Podés crear una nueva (opcional).</>)}
                                </div>
                              </div>
                              <button type="button" className={styles.hcCreateBtn} onClick={crearHistoriaClinica}
                                disabled={creatingHc !== null || hcLookup.loadingNext}>
                                {creatingHc ? "⏳ Creando..." : hcLookup.loadingNext ? "⏳ Calculando..." : hcLookup.nextNumber ? `+ Crear HC ${hcLookup.tipo} #${hcLookup.nextNumber}` : `+ Crear HC ${hcLookup.tipo}`}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className={styles.grid} style={{ marginTop: 14 }}>
                      <div className={styles.field}>
                        <label className={styles.label}>Fecha de nacimiento</label>
                        <div className={styles.nacimientoRow}>
                          <input className={cx(styles.input, styles.nacimientoInput, errors.trabajadorNacimientoDia && styles.inputError)}
                            value={form.trabajadorNacimientoDia} onChange={onChangeNacimiento("Dia")}
                            inputMode="numeric" placeholder="DD" maxLength={2} />
                          <div className={styles.nacimientoMesWrapper}>
                            <input className={cx(styles.input, styles.nacimientoInput, errors.trabajadorNacimientoMes && styles.inputError)}
                              value={form.trabajadorNacimientoMes} onChange={onChangeNacimiento("Mes")}
                              inputMode="numeric" placeholder="MM" maxLength={2} />
                            <div className={styles.mesHint}>{mesPreview || "\u00A0"}</div>
                          </div>
                          <input className={cx(styles.input, styles.nacimientoInput, errors.trabajadorNacimientoAnio && styles.inputError)}
                            value={form.trabajadorNacimientoAnio} onChange={onChangeNacimiento("Anio")}
                            inputMode="numeric" placeholder="AAAA" maxLength={4} />
                        </div>
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Lugar de nacimiento (provincia)</label>
                        <input
                          className={styles.input}
                          value={form.trabajadorLugarNacimiento ?? ""}
                          onChange={onChange("trabajadorLugarNacimiento")}
                          placeholder="Ej: Santa Fe, Buenos Aires, Córdoba..."
                          autoComplete="address-level1"
                        />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Edad (calculada)</label>
                        <input className={cx(styles.input, styles.inputReadonly)} value={form.trabajadorEdad ? `${form.trabajadorEdad} años` : ""} readOnly tabIndex={-1} />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Sexo <span style={{ color: "#ef4444" }}>*</span></label>
                        <div className={styles.chips}>
                          {["M", "F"].map((val) => (
                            <label key={val} className={cx(styles.chip, form.trabajadorSexo === val && styles.chipActive, errors.trabajadorSexo && styles.inputError)}>
                              <input type="radio" name="sexo" value={val} checked={form.trabajadorSexo === val} onChange={onChange("trabajadorSexo")} />
                              {val}
                            </label>
                          ))}
                        </div>
                        {errors.trabajadorSexo && <div className={styles.errorText}>{errors.trabajadorSexo}</div>}
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Teléfono <span style={{ color: "#ef4444" }}>*</span></label>
                        <input className={cx(styles.input, errors.trabajadorTelefono && styles.inputError)}
                          value={form.trabajadorTelefono} onChange={onChange("trabajadorTelefono")}
                          inputMode="numeric" placeholder="Ej: 11 1234 5678" />
                        {errors.trabajadorTelefono && <div className={styles.errorText}>{errors.trabajadorTelefono}</div>}
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Calle</label>
                        <input className={styles.input} value={form.trabajadorCalle} onChange={onChange("trabajadorCalle")} placeholder="Calle" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Número</label>
                        <input className={styles.input} value={form.trabajadorNumero} onChange={onChange("trabajadorNumero")} inputMode="numeric" placeholder="N°" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Localidad</label>
                        <input className={styles.input} value={form.trabajadorLocalidad} onChange={onChange("trabajadorLocalidad")} placeholder="Localidad" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Provincia</label>
                        <input className={styles.input} value={form.trabajadorProvincia} onChange={onChange("trabajadorProvincia")} placeholder="Provincia" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>CP</label>
                        <input className={styles.input} value={form.trabajadorCP} onChange={onChange("trabajadorCP")} inputMode="numeric" placeholder="CP" />
                      </div>
                    </div>
                  </Section>

                  <Section title="2) Datos del ingreso" subtitle="Fecha actual de ingreso, obra social e historia clínica">
                    <div className={styles.fechasWrapper}>
                      <div className={styles.fechaGroup}>
                        <div className={styles.fechaGroupLabel}>Fecha de ingreso</div>
                        <div className={styles.fechaRow}>
                          <DatePartInput label="Día" value={form.diaIngreso} onChange={onChange("diaIngreso")} placeholder="DD" maxLength={2} error={errors.diaIngreso} />
                          <DatePartInput label="Mes" value={form.mesIngreso} onChange={onChange("mesIngreso")} placeholder="MM" maxLength={2} error={errors.mesIngreso} />
                          <DatePartInput label="Año" value={form.anioIngreso} onChange={onChangeAnioIngreso} onBlur={onBlurAnioIngreso} placeholder="AA o AAAA" maxLength={4} error={errors.anioIngreso} />
                        </div>
                      </div>
                    </div>
                    <div className={styles.grid} style={{ marginTop: 14 }}>
                      <div className={styles.field}>
                        <label className={styles.label}>O.S</label>
                        <input className={styles.input} value={form.OS} onChange={onChange("OS")} placeholder="Ej: OSDE, Swiss Medical, IAPOS..." />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>N° de afiliado</label>
                        <input className={styles.input} value={form.afiliadoPaciente} onChange={onChange("afiliadoPaciente")} placeholder="Ej: 1234567890 / ABC123" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>HC (Historia Clínica)</label>
                        <input className={styles.input} value={form.historiaClinica} onChange={onChange("historiaClinica")} placeholder="Se completa al aplicar/crear una HC" />
                      </div>
                    </div>
                  </Section>

                  <Section title="3) Familiar responsable" subtitle="Contacto del familiar o allegado">
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>Nombre completo</label>
                        <input className={styles.input} value={form.familiarNombre} onChange={onChange("familiarNombre")} placeholder="Apellido y nombre del familiar" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Parentezco</label>
                        <input className={styles.input} value={form.familiarParentezco} onChange={onChange("familiarParentezco")} placeholder="Ej: Cónyuge, Hijo/a, Madre, Padre..." />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Teléfono</label>
                        <input className={styles.input} value={form.familiarTelefono} onChange={onChange("familiarTelefono")} inputMode="numeric" placeholder="Ej: 3456 123456" />
                      </div>
                    </div>
                  </Section>

                  <Section title="4) Internación" subtitle={`Ubicación del paciente en ${form.tipoIngreso === "UTI" ? "UTI (Terapia)" : "PISO"}`}>
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>Cama {form.tipoIngreso === "PISO" ? "(N° + letra opcional)" : "(sólo N°)"}</label>
                        <div className={styles.fechaRow}>
                          <DatePartInput label="N° Cama" value={form.camaNumero} onChange={onChange("camaNumero")} placeholder="Ej: 12" maxLength={4} error={errors.camaNumero} />
                          {!esUTI && <DatePartInput label="Letra (opcional)" value={form.camaLetra} onChange={onChange("camaLetra")} placeholder="A" maxLength={2} />}
                        </div>
                        <div className={styles.sectionHint} style={{ marginTop: 6 }}>
                          Se guardará como: <b>{buildHabitacionCamaTexto(form) || "—"}</b>
                        </div>
                      </div>
                    </div>
                  </Section>

                  <Section title="5) Médico solicitante y diagnóstico" subtitle="Médico que pide la internación y diagnóstico de ingreso">
                    <div className={styles.grid}>
                      <div className={styles.field}>
                        <label className={styles.label}>Médico solicitante</label>
                        <input className={styles.input} value={form.medicoSolicitante} onChange={onChange("medicoSolicitante")} placeholder="Ej: Dr. Juan Pérez" />
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label}>Diagnóstico de ingreso</label>
                        <input className={styles.input} value={form.diagnostico} onChange={onChange("diagnostico")} placeholder="Ej: Neumonía, Post-operatorio..." />
                      </div>
                    </div>
                  </Section>

                  <DocumentacionSection
                    docs={docs}
                    setDocs={setDocs}
                    form={form}
                  />

                  <div className={styles.footer}>
                    <button type="submit" className={styles.primaryBtn} disabled={!canSubmit}>
                      {saving
                        ? "Guardando, fusionando y generando PDF..."
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
                            <div>📄 PDF generado: <b style={{ wordBreak: "break-word" }}>{pdfFileName}</b></div>
                            <div className={styles.pdfActions}>
                              <button type="button" className={styles.secondaryBtn} onClick={openPdf}>Abrir</button>
                              <button type="button" className={styles.primaryBtn} style={{ height: 40, width: "auto" }} onClick={downloadPdf}>Descargar</button>
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
                  aria-label="Buscar pacientes"
                />
                <button
                  type="button"
                  className={styles.ghostBtn}
                  onClick={fetchAllPacientes}
                  disabled={loadingPacientes}
                >
                  {loadingPacientes ? "⏳ Cargando…" : "🔄 Actualizar"}
                </button>
              </div>

              {loadingPacientes ? (
                <div className={styles.loading}>
                  <span className={styles.emptyIcon}>⏳</span>
                  <span>Cargando ingresos…</span>
                </div>
              ) : filteredPacientes.length === 0 ? (
                <div className={styles.empty}>
                  <span className={styles.emptyIcon}>🔍</span>
                  <span className={styles.emptyTitle}>
                    {searchTerm ? "Sin resultados" : "No hay ingresos cargados"}
                  </span>
                  <span className={styles.emptyHint}>
                    {searchTerm
                      ? "Probá con otro nombre, DNI, HC o N° de afiliado."
                      : "Cuando guardes un ingreso, aparecerá acá."}
                  </span>
                </div>
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
                        <th>Docs</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPacientes.map((p) => {
                        const t = p.trabajador || {};
                        const fi = p.fechaIngreso || {};
                        const estaImprimiendo = printingId === p.id;
                        const estaDescargando = downloadingId === p.id;
                        const estaImprimiendoDorso = printingDorsoId === p.id;
                        const bloqueado = estaImprimiendo || estaImprimiendoDorso || estaDescargando;
                        const docsPaciente = Array.isArray(p.documentacion) ? p.documentacion : [];

                        return (
                          <tr key={p.id}>
                            <td>{t.apellido} {t.nombre}</td>
                            <td>{t.dni || "—"}</td>
                            <td>{p.historiaClinica || "—"}</td>
                            <td>{p.OS || "—"}</td>
                            <td>{p.afiliadoPaciente || "—"}</td>
                            <td>{p.tipoIngreso || "—"}</td>
                            <td>{fi.dia && fi.mes && fi.anio ? `${fi.dia}/${fi.mes}/${fi.anio}` : "—"}</td>
                            <td style={{ textAlign: "center" }}>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title="Ver / gestionar documentación"
                                onClick={() => setDocsModalPaciente(p)}
                              >
                                📎 {docsPaciente.length || 0}
                              </button>
                            </td>
                            <td className={styles.actionsCell}>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title="Editar"
                                onClick={() => handleEditPaciente(p)}
                                disabled={bloqueado}
                              >
                                ✏️
                              </button>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title={`Imprimir ingreso${docsPaciente.length ? " + documentación" : ""} (${p.tipoIngreso || "PISO"})`}
                                onClick={() => handlePrintPaciente(p)}
                                disabled={bloqueado}
                              >
                                {estaImprimiendo ? "⏳" : "🖨️"}
                              </button>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title={`Descargar PDF${docsPaciente.length ? " (ingreso + documentación)" : ""}`}
                                onClick={() => handleDownloadPaciente(p)}
                                disabled={bloqueado}
                                style={{
                                  borderColor: "rgba(34, 197, 94, 0.5)",
                                  color: "#4ade80",
                                }}
                              >
                                {estaDescargando ? "⏳" : "⬇️"}
                              </button>
                              <button
                                type="button"
                                className={styles.iconBtn}
                                title="Imprimir Dorso"
                                onClick={() => handlePrintDorsoPaciente(p)}
                                disabled={bloqueado}
                                style={{
                                  borderColor: "rgba(139, 92, 246, 0.5)",
                                  color: "#a78bfa",
                                }}
                              >
                                {estaImprimiendoDorso ? "⏳" : "📄"}
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

      {docsModalPaciente && (
        <DocumentosModal
          paciente={docsModalPaciente}
          onClose={() => setDocsModalPaciente(null)}
          onUpdated={() => {
            fetchAllPacientes();
            setDocsModalPaciente((prev) => {
              if (!prev) return null;
              const fresh = pacientes.find((x) => x.id === prev.id);
              return fresh || prev;
            });
          }}
        />
      )}
    </>
  );
}
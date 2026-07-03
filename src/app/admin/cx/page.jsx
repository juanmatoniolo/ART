"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./cx-common.module.css";

// ── Componentes ──
import FormularioCX from "./_components/FormularioCX";
import SolicitudesTab from "./_components/SolicitudesTab";
import ProgramadasTab from "./_components/ProgramadasTab";
import {
  ModalEstudio,
  ModalRealizacion,
  ModalEdicion,
  ModalFicha,
  ModalListaDia,
} from "./_components/Modales";

// ── Helpers ──
import {
  isCanonCX,
  isCanonDoctor,
  isCanonApellido,
  isCanonNombre,
  isCanonDNI,
  isCanonEdad,
  isCanonEdadPaciente,
  isCanonDia,
  isCanonMes,
  isCanonAnio,
  isCanonLocalidad,
  isCanonProvincia,
  isCanonDomicilioPaciente,
  isCanonNacimientoPaciente,
  isCanonHCPaciente,
  isCanonART,
  isCanonTelefono,
  isCanonNombresPaciente,
  isCanonServicio,
  isCanonEdadPacienteUI,
  loadSuggestions,
  saveSuggestions,
  addSuggestion,
  computeAgeYears,
  formatNumberWithThousands,
  generateSafeFilename,
  safeUpper,
  parseFormattedNumber,
  isLikelyCheckbox,
} from "./_utils/helpers";
import { PDFDocument } from 'pdf-lib';
// ── Constantes ──
const MAPPING_URL = "/mappings/cd-campos_fields_rects.json";
const TEMPLATE_FRENTE_URL = "/templates/FRENTE-CX.pdf";
const TEMPLATE_DORSO_URL = "/templates/DORSO-CX.pdf";
const CIRUGIAS_DB_URL = "https://datos-clini-default-rtdb.firebaseio.com/cirugias";
const SOLICITUDES_DB_URL = "https://datos-clini-default-rtdb.firebaseio.com/solicitudes-cirugia";

export default function Page() {
  const router = useRouter();

  // ── Estados formulario ──
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [mode, setMode] = useState("manual");
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [saving, setSaving] = useState(false);

  // ── Estados generales ──
  const [activeTab, setActiveTab] = useState("form");
  const [solicitudes, setSolicitudes] = useState([]);
  const [loadingSolicitudes, setLoadingSolicitudes] = useState(false);
  const [pendingSolicitudId, setPendingSolicitudId] = useState(null);

  // ── Estados programadas ──
  const [cirugias, setCirugias] = useState([]);
  const [loadingCirugias, setLoadingCirugias] = useState(true);
  const [search, setSearch] = useState("");
  const [filterFechaDesde, setFilterFechaDesde] = useState("");
  const [filterFechaHasta, setFilterFechaHasta] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterSoloIncompleto, setFilterSoloIncompleto] = useState(false);

  const [modalRealizar, setModalRealizar] = useState(null);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalFicha, setModalFicha] = useState(null);
  const [modalListaDia, setModalListaDia] = useState(false);
  const [modalEstudio, setModalEstudio] = useState(null);

  // ── Carga de mapping ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(MAPPING_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!alive) return;
        setMapping(json);
      } catch (e) {
        if (alive) setError(e?.message || "Error cargando mapping");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Construir canonical
  const canonical = useMemo(() => {
    if (!mapping) return null;
    const canonicalToInternal = {};
    const internalToCanonical = {};
    for (const internalName of Object.keys(mapping)) {
      const canon = (internalName || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[()]/g, "")
        .replace(/__\d+$/g, "")
        .replace(/-\d+$/g, "");
      internalToCanonical[internalName] = canon;
      if (!canonicalToInternal[canon]) canonicalToInternal[canon] = [];
      canonicalToInternal[canon].push(internalName);
    }
    for (const k of Object.keys(canonicalToInternal)) {
      canonicalToInternal[k] = Array.from(new Set(canonicalToInternal[k])).sort();
    }
    return { canonicalToInternal, internalToCanonical };
  }, [mapping]);

  const canonKeys = useMemo(() => (canonical ? Object.keys(canonical.canonicalToInternal) : []), [canonical]);
  const canonCX = useMemo(() => canonKeys.find(isCanonCX), [canonKeys]);
  const canonDoctor = useMemo(() => canonKeys.find(isCanonDoctor), [canonKeys]);
  const canonApellido = useMemo(() => canonKeys.find(isCanonApellido), [canonKeys]);
  const canonNombre = useMemo(() => canonKeys.find(isCanonNombre), [canonKeys]);
  const canonDNI = useMemo(() => canonKeys.find(isCanonDNI), [canonKeys]);
  const canonEdad = useMemo(() => canonKeys.find(isCanonEdad), [canonKeys]);
  const canonEdadPaciente = useMemo(() => canonKeys.find(isCanonEdadPaciente), [canonKeys]);
  const canonDia = useMemo(() => canonKeys.find(isCanonDia), [canonKeys]);
  const canonMes = useMemo(() => canonKeys.find(isCanonMes), [canonKeys]);
  const canonAnio = useMemo(() => canonKeys.find(isCanonAnio), [canonKeys]);
  const canonLocalidad = useMemo(() => canonKeys.find(isCanonLocalidad), [canonKeys]);
  const canonProvincia = useMemo(() => canonKeys.find(isCanonProvincia), [canonKeys]);
  const canonDomicilioPaciente = useMemo(() => canonKeys.find(isCanonDomicilioPaciente), [canonKeys]);
  const canonNacimientoPaciente = useMemo(() => canonKeys.find(isCanonNacimientoPaciente), [canonKeys]);
  const canonHCPaciente = useMemo(() => canonKeys.find(isCanonHCPaciente), [canonKeys]);
  const canonNombres = useMemo(() => canonKeys.find(isCanonNombresPaciente), [canonKeys]);
  const canonServicio = useMemo(() => canonKeys.find(isCanonServicio), [canonKeys]);
  const canonART = useMemo(() => canonKeys.find(isCanonART), [canonKeys]);
  const canonTelefono = useMemo(() => canonKeys.find(isCanonTelefono), [canonKeys]);

  // Inicializar formulario
  useEffect(() => {
    if (!canonical || !mapping) return;
    const initial = {};
    for (const k of Object.keys(canonical.canonicalToInternal).sort((a, b) => a.localeCompare(b, "es"))) initial[k] = "";
    if (Object.keys(mapping).some((k) => k.includes("masculino-paciente") || k.includes("femenino-paciente"))) initial["sexo"] = "";
    if (Object.keys(canonical.canonicalToInternal).some(isCanonServicio)) initial["servicio"] = "PISO";
    setForm(initial);
  }, [canonical, mapping]);

  // Sugerencias iniciales
  useEffect(() => {
    if (!canonical) return;
    let seeded = loadSuggestions();
    if (canonLocalidad) seeded = addSuggestion(seeded, canonLocalidad, "CHAJARÍ");
    if (canonProvincia) seeded = addSuggestion(seeded, canonProvincia, "ENTRE RIOS");
    if (canonNacimientoPaciente) {
      seeded = addSuggestion(seeded, canonNacimientoPaciente, "CHAJARÍ, ENTRE RIOS");
      seeded = addSuggestion(seeded, canonNacimientoPaciente, "CONCORDIA, ENTRE RIOS");
      seeded = addSuggestion(seeded, canonNacimientoPaciente, "PARANÁ, ENTRE RIOS");
    }
    setSuggestions(seeded);
    saveSuggestions(seeded);
    setForm((prev) => {
      const out = { ...prev };
      let changed = false;
      if (canonLocalidad && !(out?.[canonLocalidad] ?? "").toString().trim()) {
        out[canonLocalidad] = "CHAJARÍ";
        changed = true;
      }
      if (canonProvincia && !(out?.[canonProvincia] ?? "").toString().trim()) {
        out[canonProvincia] = "ENTRE RIOS";
        changed = true;
      }
      return changed ? out : prev;
    });
  }, [canonical, canonLocalidad, canonProvincia, canonNacimientoPaciente]);

  // Sugerencias de médicos
  useEffect(() => {
    if (!canonDoctor) return;
    let seeded = loadSuggestions();
    const doctoresLista = [
      "BRARDA AGUSTIN",
      "CANAGLIA GUSTAVO",
      "CIANCIOSI SEBASTIAN",
      "DEL PUERTO RODRIGO",
      "GIMENEZ MARTIN",
      "PERTUS DIEGO",
    ];
    doctoresLista.forEach((dr) => { seeded = addSuggestion(seeded, canonDoctor, dr); });
    setSuggestions(seeded);
    saveSuggestions(seeded);
  }, [canonDoctor]);

  // Precargar datos del paciente seleccionado
  useEffect(() => {
    if (mode === "paciente" && selectedPaciente) {
      const t = selectedPaciente.trabajador || {};
      const art = selectedPaciente.ART || {};
      const newForm = { ...form };
      if (canonApellido) newForm[canonApellido] = t.apellido || "";
      if (canonNombre) newForm[canonNombre] = t.nombre || "";
      if (canonDNI) newForm[canonDNI] = t.dni || "";
      if (canonEdad) newForm[canonEdad] = t.edad ? `${t.edad} años` : "";
      if (canonEdadPaciente) newForm[canonEdadPaciente] = t.edad ? `${t.edad} años` : "";
      if (t.sexo) newForm.sexo = t.sexo;
      if (canonTelefono && t.telefono) newForm[canonTelefono] = t.telefono;
      if (canonDia && t.nacimiento) {
        const [y, m, d] = t.nacimiento.split("-");
        newForm[canonDia] = d || "";
        newForm[canonMes] = m || "";
        newForm[canonAnio] = y || "";
      }
      if (canonLocalidad && t.localidad) newForm[canonLocalidad] = t.localidad;
      if (canonProvincia && t.provincia) newForm[canonProvincia] = t.provincia;
      if (canonDomicilioPaciente) {
        const calleNumero = `${t.calle || ""} ${t.numero || ""}`.trim();
        newForm[canonDomicilioPaciente] = calleNumero;
      }
      if (canonART && art.nombre) newForm[canonART] = art.nombre;
      setForm(newForm);
    }
  }, [selectedPaciente, mode, canonical]);

  function setValue(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function commitSuggestion(canonName, value) {
    const nextSug = addSuggestion(suggestions, canonName, value);
    if (nextSug === suggestions) return;
    setSuggestions(nextSug);
    saveSuggestions(nextSug);
  }

  const edadCalculada = useMemo(() => {
    const d = canonDia ? form?.[canonDia] : "";
    const m = canonMes ? form?.[canonMes] : "";
    const y = canonAnio ? form?.[canonAnio] : "";
    return computeAgeYears(d, m, y);
  }, [form, canonDia, canonMes, canonAnio]);

  useEffect(() => {
    const next = edadCalculada ? `${edadCalculada} años` : "";
    if (!canonEdad && !canonEdadPaciente) return;
    setForm((prev) => {
      let changed = false;
      const out = { ...prev };
      if (canonEdad && (out?.[canonEdad] ?? "") !== next) {
        out[canonEdad] = next;
        changed = true;
      }
      if (canonEdadPaciente && (out?.[canonEdadPaciente] ?? "") !== next) {
        out[canonEdadPaciente] = next;
        changed = true;
      }
      return changed ? out : prev;
    });
  }, [edadCalculada, canonEdad, canonEdadPaciente]);

  const orderedResto = useMemo(() => {
    if (!canonical) return [];
    const all = Object.keys(canonical.canonicalToInternal);
    const knownSet = new Set([
      "masculino-paciente",
      "femenino-paciente",
      "sexo",
      canonNombres,
      canonServicio,
      canonEdad,
      canonEdadPaciente,
      canonART,
      canonCX,
      canonDoctor,
      canonApellido,
      canonNombre,
      canonDia,
      canonMes,
      canonAnio,
      canonLocalidad,
      canonProvincia,
      canonNacimientoPaciente,
      canonDomicilioPaciente,
      canonHCPaciente,
      canonTelefono,
    ].filter(Boolean));
    for (const k of all) {
      if (isCanonEdadPacienteUI(k)) knownSet.add(k);
    }
    return all.filter((k) => !knownSet.has(k)).sort((a, b) => a.localeCompare(b, "es"));
  }, [
    canonical,
    canonNombres,
    canonServicio,
    canonEdad,
    canonEdadPaciente,
    canonART,
    canonCX,
    canonDoctor,
    canonApellido,
    canonNombre,
    canonDia,
    canonMes,
    canonAnio,
    canonLocalidad,
    canonProvincia,
    canonNacimientoPaciente,
    canonDomicilioPaciente,
    canonHCPaciente,
    canonTelefono,
  ]);

  function getCanonFieldType(canonName) {
    const internals = canonical?.canonicalToInternal?.[canonName] || [];
    return mapping?.[internals?.[0]]?.[0]?.field_type;
  }

  function getAutoCompleteAttr(canonName) {
    const n = (canonName || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[()]/g, "");
    if (n === "provincia") return "address-level1";
    if (n === "localidad") return "address-level2";
    if (n.includes("domicilio") || n.includes("direccion")) return "street-address";
    if (n.includes("telefono") || n.includes("celular")) return "tel";
    if (n.includes("dni") || n.includes("hc") || n.includes("historia-clinica")) return "off";
    if (n.includes("nacimiento") || n.includes("nacmiento")) return "address-level2";
    return "on";
  }

  function generateFilename(type) {
    const apellido = canonApellido ? (form?.[canonApellido] ?? "").toString().trim() : "";
    const nombre = canonNombre ? (form?.[canonNombre] ?? "").toString().trim() : "";
    const baseName = apellido && nombre ? `${apellido} ${nombre}` : apellido || nombre || "Paciente";
    const safeName = generateSafeFilename(baseName);
    return !safeName || safeName.trim() === "" ? `Paciente-${type}-${Date.now()}` : `${safeName}-${type}`;
  }

  async function buildFilledPdfBytes(templateUrl) {
    if (!mapping || !canonical) throw new Error("Mapping no cargado");
    const templateBytes = await fetch(templateUrl, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(`No pude cargar template PDF (${r.status})`);
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

    const apellido = canonApellido ? (form?.[canonApellido] ?? "").toString().trim() : "";
    const nombre = canonNombre ? (form?.[canonNombre] ?? "").toString().trim() : "";
    const nombresPaciente = [apellido, nombre].filter(Boolean).join(" ").trim();
    const edadValuePrint = edadCalculada ? `${edadCalculada} años` : "";
    const doctorRaw = canonDoctor ? (form?.[canonDoctor] ?? "").toString().trim() : "";
    const doctorPrint = doctorRaw && !/^dr\.?\s/i.test(doctorRaw) ? `Dr. ${doctorRaw}` : doctorRaw;

    trySetText("apellido-paciente", apellido);
    trySetText("nombre-paciente", nombre);
    trySetText("nombres-paciente", nombresPaciente);
    trySetText("edad", edadValuePrint);
    trySetText("edad-paciente", edadValuePrint);
    trySetText("servicio", "PISO");
    const sexValue = form?.sexo;
    tryCheck("masculino-paciente", sexValue === "M");
    tryCheck("femenino-paciente", sexValue === "F");

    for (const canonName of Object.keys(canonical.canonicalToInternal)) {
      if (canonName === "sexo") continue;
      let canonValue = form?.[canonName];
      if (canonName === canonHCPaciente && canonValue) canonValue = parseFormattedNumber(canonValue);
      if (canonDoctor && canonName === canonDoctor) canonValue = doctorPrint;
      if (canonEdad && canonName === canonEdad) canonValue = edadValuePrint;
      if (canonEdadPaciente && canonName === canonEdadPaciente) canonValue = edadValuePrint;
      if (canonNombres && canonName === canonNombres) canonValue = nombresPaciente;
      if (canonServicio && canonName === canonServicio) canonValue = "PISO";
      const isBtn = isLikelyCheckbox(getCanonFieldType(canonName));
      for (const internal of canonical.canonicalToInternal[canonName] || []) {
        if (isBtn) tryCheck(internal, !!canonValue);
        else trySetText(internal, canonValue);
      }
      if (isBtn) tryCheck(canonName, !!canonValue);
      else trySetText(canonName, canonValue);
    }
    pdfForm.flatten();
    return await pdfDoc.save();
  }

  async function downloadPdf(templateUrl, type) {
    try {
      setError("");
      const bytes = await buildFilledPdfBytes(templateUrl);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${generateFilename(type)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    } catch (e) {
      setError(e?.message || "Error al generar descarga");
    }
  }

  async function guardarCX(optionalData = null) {
    let fecha = fechaEstimada;
    let formData = form;
    let pacienteId = mode === "paciente" ? selectedPaciente?.id : null;

    if (optionalData) {
      fecha = optionalData.fechaEstimada || fecha;
      formData = optionalData.formulario || formData;
      pacienteId = optionalData.pacienteId || pacienteId;
    }

    if (!fecha) {
      alert("Por favor ingrese una fecha estimativa para la cirugía");
      return false;
    }
    const apellido = canonApellido ? formData[canonApellido] : "";
    const nombre = canonNombre ? formData[canonNombre] : "";
    if (!apellido || !nombre) {
      alert("Por favor complete al menos apellido y nombre del paciente");
      return false;
    }

    setSaving(true);
    try {
      const data = {
        pacienteId,
        pacienteDatos: {
          apellido,
          nombre,
          dni: formData[canonDNI] || "",
          fechaNacimiento: formData[canonAnio] && formData[canonMes] && formData[canonDia]
            ? `${formData[canonAnio]}-${formData[canonMes]}-${formData[canonDia]}`
            : "",
          edad: edadCalculada,
          sexo: formData.sexo,
          localidad: formData[canonLocalidad] || "",
          provincia: formData[canonProvincia] || "",
          domicilio: formData[canonDomicilioPaciente] || "",
          telefono: formData[canonTelefono] || "",
        },
        fechaEstimada: fecha,
        formulario: formData,
        realizada: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const res = await fetch(`${CIRUGIAS_DB_URL}.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar");
      alert("Cirugía guardada correctamente.");
      setFechaEstimada("");
      setForm((prev) => {
        const reset = {};
        Object.keys(prev).forEach((k) => (reset[k] = ""));
        return reset;
      });
      return true;
    } catch (err) {
      console.error(err);
      alert("Error al guardar la cirugía");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ── Solicitudes ──
  const cargarSolicitudes = async () => {
    setLoadingSolicitudes(true);
    try {
      const res = await fetch(`${SOLICITUDES_DB_URL}.json`);
      const data = await res.json();
      if (data) {
        let lista = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        lista.sort((a, b) => (b.fechaSolicitud || 0) - (a.fechaSolicitud || 0));
        setSolicitudes(lista);
      } else {
        setSolicitudes([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSolicitudes(false);
    }
  };

  useEffect(() => {
    if (activeTab === "solicitudes") cargarSolicitudes();
  }, [activeTab]);

  const cargarSolicitudEnFormulario = (solicitud) => {
    const nuevoForm = { ...form };
    if (canonApellido) nuevoForm[canonApellido] = solicitud.apellido || "";
    if (canonNombre) nuevoForm[canonNombre] = solicitud.nombre || "";
    if (canonDNI) nuevoForm[canonDNI] = solicitud.dni || "";
    if (canonTelefono) nuevoForm[canonTelefono] = solicitud.telefono || "";
    if (canonLocalidad) nuevoForm[canonLocalidad] = solicitud.localidad || "";
    if (canonProvincia) nuevoForm[canonProvincia] = solicitud.provincia || "";
    if (canonDomicilioPaciente) nuevoForm[canonDomicilioPaciente] = solicitud.domicilio || "";
    if (canonNacimientoPaciente && solicitud.lugarNacimiento) nuevoForm[canonNacimientoPaciente] = solicitud.lugarNacimiento;
    if (solicitud.sexo) nuevoForm.sexo = solicitud.sexo === "M" ? "M" : "F";
    if (solicitud.nacimiento) {
      const [y, m, d] = solicitud.nacimiento.split("-");
      if (canonDia) nuevoForm[canonDia] = d || "";
      if (canonMes) nuevoForm[canonMes] = m || "";
      if (canonAnio) nuevoForm[canonAnio] = y || "";
    }
    setForm(nuevoForm);
    setActiveTab("form");
    setMode("manual");
    setSelectedPaciente(null);
    alert("Solicitud cargada. Complete los datos de cirugía y guarde.");
  };

  const guardarCXYEliminarSolicitud = async () => {
    const success = await guardarCX();
    if (success && pendingSolicitudId) {
      try {
        await fetch(`${SOLICITUDES_DB_URL}/${pendingSolicitudId}.json`, { method: "DELETE" });
        setPendingSolicitudId(null);
        cargarSolicitudes();
      } catch (err) {
        console.error(err);
      }
    }
  };

  // ── Programadas ──
  const fetchCirugias = async () => {
    try {
      setLoadingCirugias(true);
      const res = await fetch(`${CIRUGIAS_DB_URL}.json`);
      if (!res.ok) throw new Error("Error al cargar cirugías");
      const data = await res.json();
      setCirugias(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : []);
    } catch (err) {
      setError("No se pudieron cargar las cirugías.");
    } finally {
      setLoadingCirugias(false);
    }
  };

  useEffect(() => { fetchCirugias(); }, []);
  useEffect(() => {
    if (activeTab === "programadas") fetchCirugias();
  }, [activeTab]);

  const marcarRealizada = async (cx, fechaRealizacion) => {
    await fetch(`${CIRUGIAS_DB_URL}/${cx.id}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ realizada: true, fechaRealizacion }),
    });
    setModalRealizar(null);
    fetchCirugias();
  };

  const eliminarCirugia = async (id) => {
    if (!confirm("¿Eliminar permanentemente esta cirugía?")) return;
    await fetch(`${CIRUGIAS_DB_URL}/${id}.json`, { method: "DELETE" });
    fetchCirugias();
  };

  const guardarEdicion = async (cx, formEdit) => {
    const nuevoFormulario = { ...(cx.formulario || {}) };
    if (formEdit.tipoCirugia) nuevoFormulario.cx = formEdit.tipoCirugia;
    else delete nuevoFormulario.cx;
    let doctorKey = Object.keys(nuevoFormulario).find(
      (k) => k.toLowerCase().includes("doctor") || k.toLowerCase().includes("dr") || k === "nombre-dr"
    ) || "nombre-dr";
    nuevoFormulario[doctorKey] = formEdit.doctor;

    const updates = {
      fechaEstimada: formEdit.fechaEstimada,
      doctor: formEdit.doctor,
      ecgProfesional: formEdit.ecgProfesional,
      ecgFecha: formEdit.ecgFecha,
      labProfesional: formEdit.labProfesional,
      labFecha: formEdit.labFecha,
      formulario: nuevoFormulario,
      updatedAt: Date.now(),
    };
    await fetch(`${CIRUGIAS_DB_URL}/${cx.id}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setModalEditar(null);
    fetchCirugias();
  };

  const guardarEstudio = async (cx, tipo, profesional, fecha) => {
    const updates = {
      [`${tipo}Profesional`]: profesional,
      [`${tipo}Fecha`]: fecha,
      updatedAt: Date.now(),
    };
    await fetch(`${CIRUGIAS_DB_URL}/${cx.id}.json`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setModalEstudio(null);
    fetchCirugias();
  };

  // ── Navegación foja ──
  const goToNuevaFoja = () => router.push("/admin/cx/foja");
  const goToVerFojas = () => router.push("/admin/cx/foja/medicos");

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <p>Cargando campos del formulario…</p>
        </div>
      </main>
    );
  }

  if (!mapping || !canonical) {
    return (
      <main className={styles.page}>
        <div className={styles.bannerError}>
          <strong>Error:</strong> {error || "No se pudo cargar el mapping."}
        </div>
      </main>
    );
  }

  const hasSexo = form?.sexo !== undefined;
  const hasLocation = canonDomicilioPaciente || canonNacimientoPaciente || canonLocalidad || canonProvincia;

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.formColumn}>
          {error && <div className={styles.bannerError}>{error}</div>}

          {/* Botones Foja */}
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
            <button onClick={goToNuevaFoja} className={styles.primaryBtn} style={{ flex: 1 }}>
              📄 Crear Foja Quirúrgica
            </button>
            <button onClick={goToVerFojas} className={styles.primaryBtn}
              style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.2)" }}>
              📂 Ver Fojas Guardadas
            </button>
          </div>

          {/* Pestañas */}
          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tabButton} ${activeTab === "form" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("form")}
            >
              📋 Formulario
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === "solicitudes" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("solicitudes")}
            >
              📝 Solicitudes
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === "programadas" ? styles.activeTab : ""}`}
              onClick={() => setActiveTab("programadas")}
            >
              📅 Programadas
            </button>
          </div>

          {/* Contenido de pestañas */}
          {activeTab === "form" && (
            <FormularioCX
              form={form}
              setValue={setValue}
              suggestions={suggestions}
              commitSuggestion={commitSuggestion}
              canonicalObj={canonical}
              mapping={mapping}
              mode={mode}
              setMode={setMode}
              selectedPaciente={selectedPaciente}
              setSelectedPaciente={setSelectedPaciente}
              canonCX={canonCX}
              canonDoctor={canonDoctor}
              canonApellido={canonApellido}
              canonNombre={canonNombre}
              canonDNI={canonDNI}
              canonEdad={canonEdad}
              canonEdadPaciente={canonEdadPaciente}
              canonDia={canonDia}
              canonMes={canonMes}
              canonAnio={canonAnio}
              canonLocalidad={canonLocalidad}
              canonProvincia={canonProvincia}
              canonDomicilioPaciente={canonDomicilioPaciente}
              canonNacimientoPaciente={canonNacimientoPaciente}
              canonHCPaciente={canonHCPaciente}
              canonART={canonART}
              canonTelefono={canonTelefono}
              canonNombres={canonNombres}
              canonServicio={canonServicio}
              hasSexo={hasSexo}
              hasLocation={hasLocation}
              orderedResto={orderedResto}
              fechaEstimada={fechaEstimada}
              setFechaEstimada={setFechaEstimada}
              guardarCXYEliminarSolicitud={guardarCXYEliminarSolicitud}
              saving={saving}
              edadCalculada={edadCalculada}
            />
          )}
          {activeTab === "solicitudes" && (
            <SolicitudesTab
              solicitudes={solicitudes}
              loadingSolicitudes={loadingSolicitudes}
              cargarSolicitudEnFormulario={cargarSolicitudEnFormulario}
            />
          )}
          {activeTab === "programadas" && (
            <ProgramadasTab
              cirugias={cirugias}
              search={search}
              setSearch={setSearch}
              filterFechaDesde={filterFechaDesde}
              setFilterFechaDesde={setFilterFechaDesde}
              filterFechaHasta={filterFechaHasta}
              setFilterFechaHasta={setFilterFechaHasta}
              filterDoctor={filterDoctor}
              setFilterDoctor={setFilterDoctor}
              filterSoloIncompleto={filterSoloIncompleto}
              setFilterSoloIncompleto={setFilterSoloIncompleto}
              onRealizar={(c) => setModalRealizar(c)}
              onEditar={(c) => setModalEditar(c)}
              onEliminar={eliminarCirugia}
              onVerFicha={(c) => setModalFicha(c)}
              onEstudioClick={(c, tipo) => setModalEstudio({ cx: c, tipo })}
              mapping={mapping}
              canonical={canonical}
            />
          )}
        </div>

        {/* Sidebar solo en formulario */}
        {activeTab === "form" && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <div className={styles.patientPreview}>
                <div className={styles.patientAvatar}>
                  {form.sexo === "F" ? "👩" : form.sexo === "M" ? "👨" : "🧑"}
                </div>
                <div className={styles.patientInfo}>
                  <div className={styles.patientName}>
                    {[canonApellido && form?.[canonApellido], canonNombre && form?.[canonNombre]]
                      .filter(Boolean)
                      .join(" ") || <span className={styles.patientNameEmpty}>Sin nombre</span>}
                  </div>
                  {edadCalculada && <div className={styles.patientAge}>{edadCalculada} años</div>}
                  {canonHCPaciente && form?.[canonHCPaciente] && (
                    <div className={styles.patientHC}>
                      HC {formatNumberWithThousands(form[canonHCPaciente])}
                    </div>
                  )}
                </div>
              </div>
              {canonCX && form?.[canonCX] && (
                <div className={styles.cxPreview}>
                  <span className={styles.cxLabel}>CX</span>
                  <span className={styles.cxValue}>{form[canonCX]}</span>
                </div>
              )}
              <div className={styles.sidebarDivider} />
              <p className={styles.downloadTitle}>Descargar PDF</p>
              <button
                className={styles.downloadBtn}
                onClick={() => downloadPdf(TEMPLATE_FRENTE_URL, "Frente")}
              >
                <span className={styles.downloadIcon}>↓</span>
                <span className={styles.downloadBtnText}>
                  <strong>Frente</strong>
                  <small>{generateFilename("Frente")}.pdf</small>
                </span>
              </button>
              <button
                className={styles.downloadBtn}
                onClick={() => downloadPdf(TEMPLATE_DORSO_URL, "Dorso")}
              >
                <span className={styles.downloadIcon}>↓</span>
                <span className={styles.downloadBtnText}>
                  <strong>Dorso</strong>
                  <small>{generateFilename("Dorso")}.pdf</small>
                </span>
              </button>
              <p className={styles.sidebarNote}>
                Los PDFs se generan con los datos del formulario y se descargan listos para imprimir.
              </p>
            </div>
          </aside>
        )}
      </div>

      {/* Modales */}
      {modalRealizar && (
        <ModalRealizacion
          cx={modalRealizar}
          onConfirm={(fecha) => marcarRealizada(modalRealizar, fecha)}
          onCancel={() => setModalRealizar(null)}
        />
      )}
      {modalEditar && (
        <ModalEdicion
          cx={modalEditar}
          onSave={(form) => guardarEdicion(modalEditar, form)}
          onCancel={() => setModalEditar(null)}
        />
      )}
      {modalFicha && (
        <ModalFicha
          cx={modalFicha}
          mapping={mapping}
          canonical={canonical}
          onClose={() => setModalFicha(null)}
        />
      )}
      {modalListaDia && (
        <ModalListaDia cirugias={cirugias} onClose={() => setModalListaDia(false)} />
      )}
      {modalEstudio && (
        <ModalEstudio
          cx={modalEstudio.cx}
          estudio={modalEstudio.tipo}
          onSave={(prof, fecha) => guardarEstudio(modalEstudio.cx, modalEstudio.tipo, prof, fecha)}
          onCancel={() => setModalEstudio(null)}
        />
      )}
    </main>
  );
}
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { push, ref, set, get, child, runTransaction } from "firebase/database";
import { getSession } from "@/utils/session";
import styles from "./cx-common.module.css";

// ── Componentes ──
import FormularioCX from "./_components/FormularioCX";
import PacienteSelector from "./_components/PacienteSelector"; // <-- IMPORTAMOS EL BUSCADOR AQUÍ
import {
  ModalEstudio, ModalRealizacion, ModalEdicion, ModalFicha,
} from "./_components/Modales";

// ── Helpers ──
import {
  isCanonCX, isCanonDoctor, isCanonApellido, isCanonNombre, isCanonDNI,
  isCanonEdad, isCanonEdadPaciente, isCanonDia, isCanonMes, isCanonAnio,
  isCanonLocalidad, isCanonProvincia, isCanonDomicilioPaciente,
  isCanonNacimientoPaciente, isCanonHCPaciente, isCanonART, isCanonTelefono,
  isCanonNombresPaciente, isCanonServicio, isCanonEdadPacienteUI,
  isCanonDiaInt, isCanonMesInt, isCanonAnioInt, isCanonFamiliarNombre,
  isCanonFamiliarParentezco, isCanonFamiliarTelefono, isCanonDocumento,
  isCanonHabitacionCama, loadSuggestions, saveSuggestions, addSuggestion,
  computeAgeYears, formatNumberWithThousands, generateSafeFilename,
  onlyDigits, parseHCNumber,
} from "./_utils/helpers";

// ── Constantes ──
const MAPPING_URL = "/mappings/cd-campos_fields_rects.json";
const CIRUGIAS_DB_URL = "https://datos-clini-default-rtdb.firebaseio.com/cirugias";

const HC_PATH = "historias-clinicas";
const COUNTER_GENERAL_PATH = "counters/historias-clinicas/lastNumber";

export default function Page() {
  const router = useRouter();

  // ── Estados formulario ──
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({});
  const [suggestions, setSuggestions] = useState({});

  const [selectedPaciente, setSelectedPaciente] = useState(null);

  const [fechaEstimada, setFechaEstimada] = useState("");
  const [saving, setSaving] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  // ── HC lookup ──
  const [hcLookup, setHcLookup] = useState({
    loading: false, searched: false, dni: "", match: null, nextNumber: null, loadingNext: false,
  });
  const lastLookupDniRef = useRef("");
  const [creatingHc, setCreatingHc] = useState(false);

  // ── Estados generales ──
  const [activeTab, setActiveTab] = useState("form");

  // ── Estados programadas ──
  const [cirugias, setCirugias] = useState([]);
  const [loadingCirugias, setLoadingCirugias] = useState(true);

  const [modalRealizar, setModalRealizar] = useState(null);
  const [modalEditar, setModalEditar] = useState(null);
  const [modalFicha, setModalFicha] = useState(null);
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
        if (alive) setError(e?.message || "Error cargando datos");
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
        .toLowerCase().trim().replace(/\s+/g, "-").replace(/[()]/g, "")
        .replace(/__\d+$/g, "").replace(/-\d+$/g, "");
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
    if (Object.keys(mapping).some(k => k.includes("masculino-paciente") || k.includes("femenino-paciente"))) initial["sexo"] = "";
    if (Object.keys(canonical.canonicalToInternal).some(isCanonServicio)) initial["servicio"] = "PISO";

    // FORZAMOS PAMI POR DEFECTO
    if (canonART) initial[canonART] = "PAMI";

    initial.__familiarNombre = "";
    initial.__familiarParentezco = "";
    initial.__familiarTelefono = "";
    initial.__hcExtra = "";
    initial.__artOtra = "";
    initial.__habitacionCama = "";
    initial.__afiliadoPaciente = "";

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
      if (canonLocalidad && !(out?.[canonLocalidad] ?? "").toString().trim()) { out[canonLocalidad] = "CHAJARÍ"; changed = true; }
      if (canonProvincia && !(out?.[canonProvincia] ?? "").toString().trim()) { out[canonProvincia] = "ENTRE RIOS"; changed = true; }
      return changed ? out : prev;
    });
  }, [canonical, canonLocalidad, canonProvincia, canonNacimientoPaciente]);

  // Sugerencias de médicos
  useEffect(() => {
    if (!canonDoctor) return;
    let seeded = loadSuggestions();
    const doctoresLista = ["BRARDA AGUSTIN", "CANAGLIA GUSTAVO", "CIANCIOSI SEBASTIAN", "DEL PUERTO RODRIGO", "GIMENEZ MARTIN", "PERTUS DIEGO"];
    doctoresLista.forEach((dr) => { seeded = addSuggestion(seeded, canonDoctor, dr); });
    setSuggestions(seeded);
    saveSuggestions(seeded);
  }, [canonDoctor]);

  // Precargar datos del paciente seleccionado
  useEffect(() => {
    if (selectedPaciente) {
      const newForm = { ...form };
      if (canonApellido) newForm[canonApellido] = selectedPaciente.apellido || "";
      if (canonNombre) newForm[canonNombre] = selectedPaciente.nombre || "";
      if (canonDNI) newForm[canonDNI] = selectedPaciente.dni || "";
      if (canonTelefono && selectedPaciente.telefono) newForm[canonTelefono] = selectedPaciente.telefono;
      if (canonDomicilioPaciente && selectedPaciente.domicilio) newForm[canonDomicilioPaciente] = selectedPaciente.domicilio;
      if (canonLocalidad && selectedPaciente.localidad) newForm[canonLocalidad] = selectedPaciente.localidad;
      if (canonProvincia && selectedPaciente.provincia) newForm[canonProvincia] = selectedPaciente.provincia;
      if (selectedPaciente.sexo) newForm.sexo = selectedPaciente.sexo;

      if (selectedPaciente.fechaNacimiento) {
        const [y, m, d] = selectedPaciente.fechaNacimiento.split("-");
        if (canonDia) newForm[canonDia] = d || "";
        if (canonMes) newForm[canonMes] = m || "";
        if (canonAnio) newForm[canonAnio] = y || "";
      }

      if (selectedPaciente.afiliado) newForm.__afiliadoPaciente = selectedPaciente.afiliado;
      if (canonART) newForm[canonART] = "PAMI";

      if (selectedPaciente.familiar) {
        newForm.__familiarNombre = selectedPaciente.familiar.nombre || "";
        newForm.__familiarParentezco = selectedPaciente.familiar.parentezco || "";
        newForm.__familiarTelefono = selectedPaciente.familiar.telefono || "";
      }

      if (selectedPaciente.historiaClinica) newForm.__hcExtra = selectedPaciente.historiaClinica;

      setForm(newForm);
      if (selectedPaciente.dni) {
        lastLookupDniRef.current = "";
        lookupDniInHC(onlyDigits(selectedPaciente.dni));
      }
    }
  }, [selectedPaciente, canonical]);

  function setValue(name, value) { setForm((prev) => ({ ...prev, [name]: value })); }
  function commitSuggestion(canonName, value) {
    const nextSug = addSuggestion(suggestions, canonName, value);
    if (nextSug === suggestions) return;
    setSuggestions(nextSug); saveSuggestions(nextSug);
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
      if (canonEdad && (out?.[canonEdad] ?? "") !== next) { out[canonEdad] = next; changed = true; }
      if (canonEdadPaciente && (out?.[canonEdadPaciente] ?? "") !== next) { out[canonEdadPaciente] = next; changed = true; }
      return changed ? out : prev;
    });
  }, [edadCalculada, canonEdad, canonEdadPaciente]);

  function generateFilename(type) {
    const apellido = canonApellido ? (form?.[canonApellido] ?? "").toString().trim() : "";
    const nombre = canonNombre ? (form?.[canonNombre] ?? "").toString().trim() : "";
    const baseName = apellido && nombre ? `${apellido} ${nombre}` : apellido || nombre || "Paciente";
    const safeName = generateSafeFilename(baseName);
    return !safeName || safeName.trim() === "" ? `Paciente-${type}-${Date.now()}` : `${safeName}-${type}`;
  }

  // ══════════════════════════════════════════════════════════════
  // HC LOOKUP
  // ══════════════════════════════════════════════════════════════
  const calcularProximoNumeroHC = async () => {
    const [snapHC, snapCounter] = await Promise.all([get(child(ref(db), HC_PATH)), get(child(ref(db), COUNTER_GENERAL_PATH))]);
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

  const lookupDniInHC = async (dniDigits) => {
    if (!dniDigits || dniDigits.length < 7) return;
    if (lastLookupDniRef.current === dniDigits) return;
    lastLookupDniRef.current = dniDigits;

    setHcLookup({ loading: true, searched: false, dni: dniDigits, match: null, nextNumber: null, loadingNext: false });

    try {
      const snap = await get(child(ref(db), HC_PATH));
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
            match = { id, nombre_apellido: v.nombre_apellido || v.nombre || "", dni: v.dni || v.documento || "", historia_clinica: v.historia_clinica || v.historia_clinica_1 || "" };
            break;
          }
        }
      }

      setHcLookup({ loading: false, searched: true, dni: dniDigits, match, nextNumber: null, loadingNext: !match });

      if (!match) {
        try {
          const next = await calcularProximoNumeroHC();
          setHcLookup((prev) => ({ ...prev, nextNumber: next, loadingNext: false }));
        } catch (err) {
          setHcLookup((prev) => ({ ...prev, loadingNext: false }));
        }
      }
    } catch (err) {
      setHcLookup({ loading: false, searched: true, dni: dniDigits, match: null, nextNumber: null, loadingNext: false });
    }
  };

  const handleDNIBlur = (rawDni) => {
    const digits = onlyDigits(rawDni);
    if (digits.length >= 7) lookupDniInHC(digits);
  };

  const forceLookupDni = () => {
    const digits = onlyDigits(canonDNI ? form?.[canonDNI] : "");
    if (digits.length < 7) return alert("Ingresá al menos 7 dígitos del DNI/CUIL");
    lastLookupDniRef.current = "";
    lookupDniInHC(digits);
  };

  const aplicarHistoriaClinica = (hc) => {
    if (!hc) return;
    const numero = String(hc.historia_clinica || "");
    if (canonHCPaciente) setValue(canonHCPaciente, numero);
    setValue("__hcExtra", numero);

    const partes = (hc.nombre_apellido || "").split(",").map((s) => s.trim());
    if (partes[0] && canonApellido && !(form[canonApellido] || "").trim()) setValue(canonApellido, partes[0]);
    if (partes[1] && canonNombre && !(form[canonNombre] || "").trim()) setValue(canonNombre, partes[1]);

    setMensajeExito(`HC #${numero} aplicada al formulario.`);
    setTimeout(() => setMensajeExito(""), 3000);
  };

  const crearHistoriaClinica = async () => {
    const dniDigits = onlyDigits(canonDNI ? form?.[canonDNI] : "");
    if (dniDigits.length < 7) return alert("Ingresá al menos 7 dígitos del DNI/CUIL");
    const apellido = canonApellido ? form?.[canonApellido] : "";
    const nombre = canonNombre ? form?.[canonNombre] : "";
    if (!apellido || !nombre) return alert("Completá apellido y nombre antes de crear la HC");

    const numeroPreview = hcLookup.nextNumber ? ` (se asignará el N° ${hcLookup.nextNumber})` : "";
    const ok = window.confirm(`¿Crear una nueva historia clínica PISO para "${apellido} ${nombre}" (DNI ${dniDigits})${numeroPreview}?`);
    if (!ok) return;

    setCreatingHc(true);
    try {
      const snapshot = await get(child(ref(db), HC_PATH));
      let maxReal = 0;
      if (snapshot.exists()) {
        for (const item of Object.values(snapshot.val())) {
          const n = parseHCNumber(item);
          if (Number.isFinite(n) && n > maxReal) maxReal = n;
        }
      }

      const counterRef = ref(db, COUNTER_GENERAL_PATH);
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
      const newRefCorrect = push(ref(db, HC_PATH));
      const nombreCompleto = `${apellido} ${nombre}`.trim().toUpperCase();

      await set(newRefCorrect, {
        nombre_apellido: nombreCompleto,
        dni: dniDigits,
        historia_clinica: newNumber,
        alertas: [],
        createdBy: userName, createdByUserKey: userKey, createdAt: now,
        modifiedBy: userName, modifiedByUserKey: userKey, modifiedAt: now,
      });

      if (canonHCPaciente) setValue(canonHCPaciente, newNumber);
      setValue("__hcExtra", newNumber);
      lastLookupDniRef.current = "";
      await lookupDniInHC(dniDigits);
      setMensajeExito(`✅ HC PISO #${newNumber} creada correctamente`);
      setTimeout(() => setMensajeExito(""), 4000);
    } catch (err) {
      console.error("Error creando HC:", err);
      alert("No se pudo crear la historia clínica.");
    } finally {
      setCreatingHc(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // PDF vía API
  // ══════════════════════════════════════════════════════════════

  function buildPdfPayloadFromForm() {
    const formularioLimpio = {};
    Object.keys(form).forEach((k) => { if (!k.startsWith("__")) formularioLimpio[k] = form[k]; });

    const hcFromForm = form?.__hcExtra || (canonHCPaciente ? form?.[canonHCPaciente] || "" : "");
    const dniValue = canonDNI ? form?.[canonDNI] || "" : "";
    const lugarNacimientoValue = canonNacimientoPaciente ? form?.[canonNacimientoPaciente] || "" : "";

    return {
      pacienteDatos: {
        apellido: canonApellido ? form?.[canonApellido] || "" : "",
        nombre: canonNombre ? form?.[canonNombre] || "" : "",
        dni: dniValue,
        afiliadoPaciente: form?.__afiliadoPaciente || "",
        edad: edadCalculada || "",
        sexo: form?.sexo || "",
        fechaNacimiento: form?.[canonAnio] && form?.[canonMes] && form?.[canonDia] ? `${form[canonAnio]}-${String(form[canonMes]).padStart(2, "0")}-${String(form[canonDia]).padStart(2, "0")}` : "",
        localidad: canonLocalidad ? form?.[canonLocalidad] || "" : "",
        provincia: canonProvincia ? form?.[canonProvincia] || "" : "",
        domicilio: canonDomicilioPaciente ? form?.[canonDomicilioPaciente] || "" : "",
        telefono: canonTelefono ? form?.[canonTelefono] || "" : "",
        historiaClinica: hcFromForm,
        habitacionCama: form?.__habitacionCama || "",
        lugarNacimiento: lugarNacimientoValue,
      },
      familiar: {
        nombre: form?.__familiarNombre || "",
        parentezco: form?.__familiarParentezco || "",
        telefono: form?.__familiarTelefono || "",
      },
      formulario: formularioLimpio,
      fechaEstimada: fechaEstimada || "",
      fechaCirugia: (() => {
        if (!fechaEstimada) return null;
        const [y, m, d] = fechaEstimada.split("-");
        return { dia: d || "", mes: m || "", anio: y || "" };
      })(),
      servicio: "PISO",
      habitacionCama: form?.__habitacionCama || "",
      lugarNacimiento: lugarNacimientoValue,
    };
  }

  async function downloadPdf(type) {
    try {
      setError("");
      const payload = buildPdfPayloadFromForm();
      const fileName = `${generateFilename(type)}.pdf`;

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
      a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    } catch (e) {
      setError(e?.message || "Error al generar descarga");
      console.error(e);
    }
  }

  // ── Guardar cirugía ──
  async function guardarCX(optionalData = null) {
    let fecha = fechaEstimada;
    let formData = form;
    let pacienteId = selectedPaciente?.id || null;

    if (optionalData) {
      fecha = optionalData.fechaEstimada || fecha;
      formData = optionalData.formulario || formData;
      pacienteId = optionalData.pacienteId || pacienteId;
    }

    const apellido = canonApellido ? formData[canonApellido] : "";
    const nombre = canonNombre ? formData[canonNombre] : "";
    if (!apellido || !nombre) return alert("Por favor complete al menos apellido y nombre del paciente");

    setSaving(true);
    try {
      const formularioLimpio = {};
      Object.keys(formData).forEach((k) => { if (!k.startsWith("__")) formularioLimpio[k] = formData[k]; });

      const hcValue = formData.__hcExtra || (canonHCPaciente ? formData[canonHCPaciente] || "" : "");
      const dniValue = formData[canonDNI] || "";
      const lugarNacimientoValue = canonNacimientoPaciente ? formData[canonNacimientoPaciente] || "" : "";

      const fechaCirugia = (() => {
        if (!fecha) return { dia: "", mes: "", anio: "" };
        const [y, m, d] = fecha.split("-");
        return { dia: d || "", mes: m || "", anio: y || "" };
      })();

      const data = {
        pacienteId,
        pacienteDatos: {
          apellido, nombre,
          dni: dniValue,
          afiliado: dniValue,
          afiliadoPaciente: formData.__afiliadoPaciente || "",
          fechaNacimiento: formData[canonAnio] && formData[canonMes] && formData[canonDia] ? `${formData[canonAnio]}-${formData[canonMes]}-${formData[canonDia]}` : "",
          edad: edadCalculada,
          sexo: formData.sexo,
          localidad: formData[canonLocalidad] || "",
          provincia: formData[canonProvincia] || "",
          domicilio: formData[canonDomicilioPaciente] || "",
          telefono: formData[canonTelefono] || "",
          historiaClinica: hcValue,
          habitacionCama: formData.__habitacionCama || "",
          lugarNacimiento: lugarNacimientoValue,
          familiar: {
            nombre: formData.__familiarNombre || "",
            parentezco: formData.__familiarParentezco || "",
            telefono: formData.__familiarTelefono || "",
          },
        },
        fechaEstimada: fecha || "",
        fechaCirugia,
        formulario: formularioLimpio,
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

      setMensajeExito("Cirugía guardada correctamente.");
      setTimeout(() => setMensajeExito(""), 3000);
      setFechaEstimada("");
      setForm((prev) => {
        const reset = {};
        Object.keys(prev).forEach((k) => (reset[k] = ""));
        if (canonART) reset[canonART] = "PAMI";
        return reset;
      });
      setSelectedPaciente(null);
      lastLookupDniRef.current = "";
      setHcLookup({ loading: false, searched: false, dni: "", match: null, nextNumber: null, loadingNext: false });
      return true;
    } catch (err) {
      console.error(err); alert("Error al guardar la cirugía");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ── Limpiar Formulario ──
  const resetForm = () => {
    if (!confirm("¿Limpiar todo el formulario? Se perderán los datos no guardados.")) return;
    setForm((prev) => {
      const reset = {};
      Object.keys(prev).forEach((k) => (reset[k] = ""));
      if (canonART) reset[canonART] = "PAMI";
      return reset;
    });
    setFechaEstimada("");
    setSelectedPaciente(null);
    lastLookupDniRef.current = "";
    setHcLookup({ loading: false, searched: false, dni: "", match: null, nextNumber: null, loadingNext: false });
    setMensajeExito("Formulario limpiado.");
    setTimeout(() => setMensajeExito(""), 2000);
  };

  const goToIngresos = () => router.push("/administrador/ingresos");

  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <p>Cargando datos…</p>
        </div>
      </main>
    );
  }

  if (!mapping || !canonical) {
    return (
      <main className={styles.page}>
        <div className={styles.bannerError}><strong>Error:</strong> {error || "No se pudo cargar el mapping."}</div>
      </main>
    );
  }

  const hasSexo = form?.sexo !== undefined;
  const hasLocation = canonDomicilioPaciente || canonNacimientoPaciente || canonLocalidad || canonProvincia;

  return (
    <main className={styles.page}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "28px 24px 60px" }}>
        <div className={styles.formColumn}>
          {error && <div className={styles.bannerError}>{error}</div>}
          {mensajeExito && <div className={styles.bannerSuccess}>{mensajeExito}</div>}

          {/* TABS */}
          <div className={styles.tabsContainer} style={{ marginBottom: "1rem" }}>
            <button className={`${styles.tabButton} ${activeTab === "form" ? styles.activeTab : ""}`} onClick={() => setActiveTab("form")}>
              📋 Formulario
            </button>
            <button className={styles.tabButton} onClick={goToIngresos}>
              🏥 Ir a Ingresos
            </button>
          </div>

          {/* 🔍 BUSCADOR DE PACIENTE PAMI */}
          {/* 🔍 BUSCADOR DE PACIENTE PAMI */}
          <section className={styles.section} style={{ borderColor: "#6fa17b", marginBottom: "1.5rem", overflow: "visible" }}>
            <div className={styles.sectionHeader} style={{ background: "rgba(111, 161, 123, 0.1)" }}>
              <span className={styles.sectionIcon}>🔍</span>
              <h2 className={styles.sectionTitle} style={{ color: "#6fa17b" }}>Importar Paciente PAMI</h2>
            </div>
            <div className={styles.sectionBody} style={{ padding: "1.5rem" }}>
              {selectedPaciente ? (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#1a2335", padding: "1rem", borderRadius: "8px", border: "1px solid #6fa17b" }}>
                  <div>
                    <strong style={{ fontSize: "1.1rem", color: "#f1f5f9" }}>{selectedPaciente.nombreCompleto}</strong>
                    <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "4px" }}>
                      DNI: {selectedPaciente.dni} · Afiliado: {selectedPaciente.afiliado || "—"}
                    </div>
                  </div>
                  <button type="button" onClick={() => { setSelectedPaciente(null); resetForm(); }} className={styles.secondaryBtn} style={{ padding: "8px 16px", fontSize: "13px", display: "flex", gap: "6px", alignItems: "center" }}>
                    ✕ Quitar y limpiar formulario
                  </button>
                </div>
              ) : (
                <PacienteSelector onSelect={setSelectedPaciente} selectedPacienteId={null} />
              )}
            </div>
          </section>

          {activeTab === "form" && (
            <FormularioCX
              form={form} setValue={setValue} suggestions={suggestions} commitSuggestion={commitSuggestion}
              canonicalObj={canonical} mapping={mapping}
              selectedPaciente={selectedPaciente} setSelectedPaciente={setSelectedPaciente}
              canonCX={canonCX} canonDoctor={canonDoctor} canonApellido={canonApellido} canonNombre={canonNombre}
              canonDNI={canonDNI} canonEdad={canonEdad} canonEdadPaciente={canonEdadPaciente}
              canonDia={canonDia} canonMes={canonMes} canonAnio={canonAnio} canonLocalidad={canonLocalidad}
              canonProvincia={canonProvincia} canonDomicilioPaciente={canonDomicilioPaciente}
              canonNacimientoPaciente={canonNacimientoPaciente} canonHCPaciente={canonHCPaciente}
              canonART={canonART} canonTelefono={canonTelefono} canonNombres={canonNombres} canonServicio={canonServicio}
              hasSexo={hasSexo} hasLocation={hasLocation}
              fechaEstimada={fechaEstimada} setFechaEstimada={setFechaEstimada}
              guardarCX={guardarCX} saving={saving} edadCalculada={edadCalculada}
              hcLookup={hcLookup} onDNIBlur={handleDNIBlur} onForceLookupDni={forceLookupDni}
              onAplicarHC={aplicarHistoriaClinica} onCrearHC={crearHistoriaClinica} creatingHc={creatingHc}
              downloadPdf={downloadPdf}
              resetForm={resetForm}
            />
          )}
        </div>
      </div>

      {modalRealizar && <ModalRealizacion cx={modalRealizar} onConfirm={(fecha) => marcarRealizada(modalRealizar, fecha)} onCancel={() => setModalRealizar(null)} />}
      {modalEditar && <ModalEdicion cx={modalEditar} onSave={(form) => guardarEdicion(modalEditar, form)} onCancel={() => setModalEditar(null)} />}
      {modalFicha && <ModalFicha cx={modalFicha} mapping={mapping} canonical={canonical} onClose={() => setModalFicha(null)} />}
      {modalEstudio && <ModalEstudio cx={modalEstudio.cx} estudio={modalEstudio.tipo} onSave={(prof, fecha) => guardarEstudio(modalEstudio.cx, modalEstudio.tipo, prof, fecha)} onCancel={() => setModalEstudio(null)} />}
    </main>
  );
}
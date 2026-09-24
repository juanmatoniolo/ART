"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  push,
  ref,
  set,
  get,
  child,
  runTransaction,
} from "firebase/database";
import { getSession } from "@/utils/session";
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
  isCanonDiaInt,
  isCanonMesInt,
  isCanonAnioInt,
  isCanonFamiliarNombre,
  isCanonFamiliarParentezco,
  isCanonFamiliarTelefono,
  isCanonDocumento,
  isCanonHabitacionCama,
  loadSuggestions,
  saveSuggestions,
  addSuggestion,
  computeAgeYears,
  formatNumberWithThousands,
  generateSafeFilename,
  onlyDigits,
  parseHCNumber,
} from "./_utils/helpers";

// ── Constantes ──
const MAPPING_URL = "/mappings/cd-campos_fields_rects.json";
const CIRUGIAS_DB_URL =
  "https://datos-clini-default-rtdb.firebaseio.com/cirugias";
const SOLICITUDES_DB_URL =
  "https://datos-clini-default-rtdb.firebaseio.com/solicitudes-cirugia";

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
  const [mode, setMode] = useState("manual");
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [saving, setSaving] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  // ── HC lookup ──
  const [hcLookup, setHcLookup] = useState({
    loading: false,
    searched: false,
    dni: "",
    match: null,
    nextNumber: null,
    loadingNext: false,
  });
  const lastLookupDniRef = useRef("");
  const [creatingHc, setCreatingHc] = useState(false);

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
  const [modalSolicitudData, setModalSolicitudData] = useState(null);

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
    return () => {
      alive = false;
    };
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
      canonicalToInternal[k] = Array.from(
        new Set(canonicalToInternal[k]),
      ).sort();
    }
    return { canonicalToInternal, internalToCanonical };
  }, [mapping]);

  const canonKeys = useMemo(
    () => (canonical ? Object.keys(canonical.canonicalToInternal) : []),
    [canonical],
  );

  const canonCX = useMemo(() => canonKeys.find(isCanonCX), [canonKeys]);
  const canonDoctor = useMemo(() => canonKeys.find(isCanonDoctor), [canonKeys]);
  const canonApellido = useMemo(
    () => canonKeys.find(isCanonApellido),
    [canonKeys],
  );
  const canonNombre = useMemo(() => canonKeys.find(isCanonNombre), [canonKeys]);
  const canonDNI = useMemo(() => canonKeys.find(isCanonDNI), [canonKeys]);
  const canonEdad = useMemo(() => canonKeys.find(isCanonEdad), [canonKeys]);
  const canonEdadPaciente = useMemo(
    () => canonKeys.find(isCanonEdadPaciente),
    [canonKeys],
  );
  const canonDia = useMemo(() => canonKeys.find(isCanonDia), [canonKeys]);
  const canonMes = useMemo(() => canonKeys.find(isCanonMes), [canonKeys]);
  const canonAnio = useMemo(() => canonKeys.find(isCanonAnio), [canonKeys]);
  const canonLocalidad = useMemo(
    () => canonKeys.find(isCanonLocalidad),
    [canonKeys],
  );
  const canonProvincia = useMemo(
    () => canonKeys.find(isCanonProvincia),
    [canonKeys],
  );
  const canonDomicilioPaciente = useMemo(
    () => canonKeys.find(isCanonDomicilioPaciente),
    [canonKeys],
  );
  const canonNacimientoPaciente = useMemo(
    () => canonKeys.find(isCanonNacimientoPaciente),
    [canonKeys],
  );
  const canonHCPaciente = useMemo(
    () => canonKeys.find(isCanonHCPaciente),
    [canonKeys],
  );
  const canonNombres = useMemo(
    () => canonKeys.find(isCanonNombresPaciente),
    [canonKeys],
  );
  const canonServicio = useMemo(
    () => canonKeys.find(isCanonServicio),
    [canonKeys],
  );
  const canonART = useMemo(() => canonKeys.find(isCanonART), [canonKeys]);
  const canonTelefono = useMemo(
    () => canonKeys.find(isCanonTelefono),
    [canonKeys],
  );

  const canonDiaInt = useMemo(() => canonKeys.find(isCanonDiaInt), [canonKeys]);
  const canonMesInt = useMemo(() => canonKeys.find(isCanonMesInt), [canonKeys]);
  const canonAnioInt = useMemo(
    () => canonKeys.find(isCanonAnioInt),
    [canonKeys],
  );
  const canonFamiliarNombre = useMemo(
    () => canonKeys.find(isCanonFamiliarNombre),
    [canonKeys],
  );
  const canonFamiliarParentezco = useMemo(
    () => canonKeys.find(isCanonFamiliarParentezco),
    [canonKeys],
  );
  const canonFamiliarTelefono = useMemo(
    () => canonKeys.find(isCanonFamiliarTelefono),
    [canonKeys],
  );
  const canonDocumento = useMemo(
    () => canonKeys.find(isCanonDocumento),
    [canonKeys],
  );
  const canonHabitacionCama = useMemo(
    () => canonKeys.find(isCanonHabitacionCama),
    [canonKeys],
  );

  // Inicializar formulario
  useEffect(() => {
    if (!canonical || !mapping) return;
    const initial = {};
    for (const k of Object.keys(canonical.canonicalToInternal).sort((a, b) =>
      a.localeCompare(b, "es"),
    ))
      initial[k] = "";
    if (
      Object.keys(mapping).some(
        (k) =>
          k.includes("masculino-paciente") || k.includes("femenino-paciente"),
      )
    )
      initial["sexo"] = "";
    if (Object.keys(canonical.canonicalToInternal).some(isCanonServicio))
      initial["servicio"] = "PISO";

    initial.__familiarNombre = "";
    initial.__familiarParentezco = "";
    initial.__familiarTelefono = "";
    initial.__hcExtra = "";
    initial.__artOtra = "";
    initial.__habitacionCama = "";

    setForm(initial);
  }, [canonical, mapping]);

  // Sugerencias iniciales
  useEffect(() => {
    if (!canonical) return;
    let seeded = loadSuggestions();
    if (canonLocalidad) seeded = addSuggestion(seeded, canonLocalidad, "CHAJARÍ");
    if (canonProvincia)
      seeded = addSuggestion(seeded, canonProvincia, "ENTRE RIOS");
    if (canonNacimientoPaciente) {
      seeded = addSuggestion(
        seeded,
        canonNacimientoPaciente,
        "CHAJARÍ, ENTRE RIOS",
      );
      seeded = addSuggestion(
        seeded,
        canonNacimientoPaciente,
        "CONCORDIA, ENTRE RIOS",
      );
      seeded = addSuggestion(
        seeded,
        canonNacimientoPaciente,
        "PARANÁ, ENTRE RIOS",
      );
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
    doctoresLista.forEach((dr) => {
      seeded = addSuggestion(seeded, canonDoctor, dr);
    });
    setSuggestions(seeded);
    saveSuggestions(seeded);
  }, [canonDoctor]);

  // Precargar datos del paciente seleccionado
  useEffect(() => {
    if (mode === "paciente" && selectedPaciente) {
      const t = selectedPaciente.trabajador || {};
      const art = selectedPaciente.ART || {};
      const fam = selectedPaciente.familiar || {};
      const newForm = { ...form };
      if (canonApellido) newForm[canonApellido] = t.apellido || "";
      if (canonNombre) newForm[canonNombre] = t.nombre || "";
      if (canonDNI) newForm[canonDNI] = t.dni || "";
      if (canonEdad) newForm[canonEdad] = t.edad ? `${t.edad} años` : "";
      if (canonEdadPaciente)
        newForm[canonEdadPaciente] = t.edad ? `${t.edad} años` : "";
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

      if (fam.nombre) newForm.__familiarNombre = fam.nombre;
      if (fam.parentezco) newForm.__familiarParentezco = fam.parentezco;
      if (fam.telefono) newForm.__familiarTelefono = fam.telefono;
      if (selectedPaciente.historiaClinica)
        newForm.__hcExtra = selectedPaciente.historiaClinica;

      setForm(newForm);
      if (t.dni) {
        lastLookupDniRef.current = "";
        lookupDniInHC(onlyDigits(t.dni));
      }
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
    const knownSet = new Set(
      [
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
        canonDiaInt,
        canonMesInt,
        canonAnioInt,
        canonFamiliarNombre,
        canonFamiliarParentezco,
        canonFamiliarTelefono,
        canonDocumento,
        canonHabitacionCama,
      ].filter(Boolean),
    );
    for (const k of all) {
      if (isCanonEdadPacienteUI(k)) knownSet.add(k);
    }
    return all
      .filter((k) => !knownSet.has(k))
      .sort((a, b) => a.localeCompare(b, "es"));
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
    canonDiaInt,
    canonMesInt,
    canonAnioInt,
    canonFamiliarNombre,
    canonFamiliarParentezco,
    canonFamiliarTelefono,
    canonDocumento,
    canonHabitacionCama,
  ]);

  function generateFilename(type) {
    const apellido = canonApellido
      ? (form?.[canonApellido] ?? "").toString().trim()
      : "";
    const nombre = canonNombre
      ? (form?.[canonNombre] ?? "").toString().trim()
      : "";
    const baseName =
      apellido && nombre
        ? `${apellido} ${nombre}`
        : apellido || nombre || "Paciente";
    const safeName = generateSafeFilename(baseName);
    return !safeName || safeName.trim() === ""
      ? `Paciente-${type}-${Date.now()}`
      : `${safeName}-${type}`;
  }

  // ══════════════════════════════════════════════════════════════
  // HC LOOKUP
  // ══════════════════════════════════════════════════════════════
  const calcularProximoNumeroHC = async () => {
    const [snapHC, snapCounter] = await Promise.all([
      get(child(ref(db), HC_PATH)),
      get(child(ref(db), COUNTER_GENERAL_PATH)),
    ]);
    let maxReal = 0;
    if (snapHC.exists()) {
      for (const item of Object.values(snapHC.val())) {
        const n = parseHCNumber(item);
        if (Number.isFinite(n) && n > maxReal) maxReal = n;
      }
    }
    const counterVal = snapCounter.exists()
      ? Number(snapCounter.val() || 0)
      : 0;
    return Math.max(maxReal, counterVal) + 1;
  };

  const lookupDniInHC = async (dniDigits) => {
    if (!dniDigits || dniDigits.length < 7) return;
    if (lastLookupDniRef.current === dniDigits) return;
    lastLookupDniRef.current = dniDigits;

    setHcLookup({
      loading: true,
      searched: false,
      dni: dniDigits,
      match: null,
      nextNumber: null,
      loadingNext: false,
    });

    try {
      const snap = await get(child(ref(db), HC_PATH));
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
        for (const [id, v] of Object.entries(snap.val())) {
          if (matchesDni(v.dni || v.documento)) {
            match = {
              id,
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
        match,
        nextNumber: null,
        loadingNext: !match,
      });

      if (!match) {
        try {
          const next = await calcularProximoNumeroHC();
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
        match: null,
        nextNumber: null,
        loadingNext: false,
      });
    }
  };

  const handleDNIBlur = (rawDni) => {
    const digits = onlyDigits(rawDni);
    if (digits.length >= 7) lookupDniInHC(digits);
  };

  const forceLookupDni = () => {
    const digits = onlyDigits(canonDNI ? form?.[canonDNI] : "");
    if (digits.length < 7) {
      alert("Ingresá al menos 7 dígitos del DNI/CUIL");
      return;
    }
    lastLookupDniRef.current = "";
    lookupDniInHC(digits);
  };

  const aplicarHistoriaClinica = (hc) => {
    if (!hc) return;
    const numero = String(hc.historia_clinica || "");
    if (canonHCPaciente) setValue(canonHCPaciente, numero);
    setValue("__hcExtra", numero);

    const partes = (hc.nombre_apellido || "").split(",").map((s) => s.trim());
    if (partes[0] && canonApellido && !(form[canonApellido] || "").trim()) {
      setValue(canonApellido, partes[0]);
    }
    if (partes[1] && canonNombre && !(form[canonNombre] || "").trim()) {
      setValue(canonNombre, partes[1]);
    }
    setMensajeExito(`HC #${numero} aplicada al formulario.`);
    setTimeout(() => setMensajeExito(""), 3000);
  };

  const crearHistoriaClinica = async () => {
    const dniDigits = onlyDigits(canonDNI ? form?.[canonDNI] : "");
    if (dniDigits.length < 7) {
      alert("Ingresá al menos 7 dígitos del DNI/CUIL");
      return;
    }
    const apellido = canonApellido ? form?.[canonApellido] : "";
    const nombre = canonNombre ? form?.[canonNombre] : "";
    if (!apellido || !nombre) {
      alert("Completá apellido y nombre antes de crear la HC");
      return;
    }
    const numeroPreview = hcLookup.nextNumber
      ? ` (se asignará el N° ${hcLookup.nextNumber})`
      : "";
    const ok = window.confirm(
      `¿Crear una nueva historia clínica PISO para "${apellido} ${nombre}" (DNI ${dniDigits})${numeroPreview}?`,
    );
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
      const tx = await runTransaction(
        counterRef,
        (currentValue) => Number(currentValue || 0) + 1,
      );
      if (!tx.committed) throw new Error("No se pudo reservar el número");
      const reservedNumber = Number(tx.snapshot.val() || 0);

      let finalNumber = reservedNumber > maxReal ? reservedNumber : maxReal + 1;
      if (finalNumber !== reservedNumber) await set(counterRef, finalNumber);

      const newNumber = String(finalNumber);
      const session = (typeof getSession === "function" && getSession()) || {};
      const userName =
        session.user || session.usuario || session.nombre || "sistema";
      const userKey = session.id || session.key || "";
      const now = Date.now();
      const newRef = push(ref(db, HC_PATH));
      const nombreCompleto = `${apellido} ${nombre}`.trim().toUpperCase();

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
    Object.keys(form).forEach((k) => {
      if (!k.startsWith("__")) formularioLimpio[k] = form[k];
    });

    // ✅ HC: si está cargada la usamos; si no, fallback al DNI formateado (lo hace el API)
    const hcFromForm =
      form?.__hcExtra ||
      (canonHCPaciente ? form?.[canonHCPaciente] || "" : "");
    const dniValue = canonDNI ? form?.[canonDNI] || "" : "";

    // ✅ Lugar de nacimiento
    const lugarNacimientoValue = canonNacimientoPaciente
      ? form?.[canonNacimientoPaciente] || ""
      : "";

    return {
      pacienteDatos: {
        apellido: canonApellido ? form?.[canonApellido] || "" : "",
        nombre: canonNombre ? form?.[canonNombre] || "" : "",
        dni: dniValue,
        edad: edadCalculada || "",
        sexo: form?.sexo || "",
        fechaNacimiento:
          form?.[canonAnio] && form?.[canonMes] && form?.[canonDia]
            ? `${form[canonAnio]}-${String(form[canonMes]).padStart(2, "0")}-${String(form[canonDia]).padStart(2, "0")}`
            : "",
        localidad: canonLocalidad ? form?.[canonLocalidad] || "" : "",
        provincia: canonProvincia ? form?.[canonProvincia] || "" : "",
        domicilio: canonDomicilioPaciente
          ? form?.[canonDomicilioPaciente] || ""
          : "",
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
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
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
    let pacienteId = mode === "paciente" ? selectedPaciente?.id : null;

    if (optionalData) {
      fecha = optionalData.fechaEstimada || fecha;
      formData = optionalData.formulario || formData;
      pacienteId = optionalData.pacienteId || pacienteId;
    }

    const apellido = canonApellido ? formData[canonApellido] : "";
    const nombre = canonNombre ? formData[canonNombre] : "";
    if (!apellido || !nombre) {
      alert("Por favor complete al menos apellido y nombre del paciente");
      return false;
    }

    setSaving(true);
    try {
      const formularioLimpio = {};
      Object.keys(formData).forEach((k) => {
        if (!k.startsWith("__")) formularioLimpio[k] = formData[k];
      });

      const hcValue =
        formData.__hcExtra ||
        (canonHCPaciente ? formData[canonHCPaciente] || "" : "");
      const dniValue = formData[canonDNI] || "";
      const lugarNacimientoValue = canonNacimientoPaciente
        ? formData[canonNacimientoPaciente] || ""
        : "";

      const fechaCirugia = (() => {
        if (!fecha) return { dia: "", mes: "", anio: "" };
        const [y, m, d] = fecha.split("-");
        return { dia: d || "", mes: m || "", anio: y || "" };
      })();

      const data = {
        pacienteId,
        pacienteDatos: {
          apellido,
          nombre,
          dni: dniValue,
          afiliado: dniValue,
          fechaNacimiento:
            formData[canonAnio] && formData[canonMes] && formData[canonDia]
              ? `${formData[canonAnio]}-${formData[canonMes]}-${formData[canonDia]}`
              : "",
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
        return reset;
      });
      lastLookupDniRef.current = "";
      setHcLookup({
        loading: false,
        searched: false,
        dni: "",
        match: null,
        nextNumber: null,
        loadingNext: false,
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
        let lista = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
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

  const buildFormFromSolicitud = (solicitud) => {
    const nuevoForm = {};
    if (canonApellido) nuevoForm[canonApellido] = solicitud.apellido || "";
    if (canonNombre) nuevoForm[canonNombre] = solicitud.nombre || "";
    if (canonDNI) nuevoForm[canonDNI] = solicitud.dni || "";
    if (canonTelefono) nuevoForm[canonTelefono] = solicitud.telefono || "";
    if (canonLocalidad) nuevoForm[canonLocalidad] = solicitud.localidad || "";
    if (canonProvincia) nuevoForm[canonProvincia] = solicitud.provincia || "";
    if (canonDomicilioPaciente)
      nuevoForm[canonDomicilioPaciente] = solicitud.domicilio || "";
    if (canonNacimientoPaciente)
      nuevoForm[canonNacimientoPaciente] = solicitud.lugarNacimiento || "";
    if (solicitud.sexo) nuevoForm.sexo = solicitud.sexo === "M" ? "M" : "F";
    if (solicitud.nacimiento) {
      const [y, m, d] = solicitud.nacimiento.split("-");
      if (canonDia) nuevoForm[canonDia] = d || "";
      if (canonMes) nuevoForm[canonMes] = m || "";
      if (canonAnio) nuevoForm[canonAnio] = y || "";
    }
    if (solicitud.familiarNombre)
      nuevoForm.__familiarNombre = solicitud.familiarNombre;
    if (solicitud.familiarParentezco)
      nuevoForm.__familiarParentezco = solicitud.familiarParentezco;
    if (solicitud.familiarTelefono)
      nuevoForm.__familiarTelefono = solicitud.familiarTelefono;
    return nuevoForm;
  };

  const descargarPdfSolicitud = async (solicitud, type) => {
    try {
      const nuevoForm = buildFormFromSolicitud(solicitud);
      const lugarNacimientoValue = solicitud.lugarNacimiento || "";

      const payload = {
        pacienteDatos: {
          apellido: solicitud.apellido || "",
          nombre: solicitud.nombre || "",
          dni: solicitud.dni || "",
          edad: solicitud.edad ? String(solicitud.edad) : "",
          sexo: solicitud.sexo || "",
          fechaNacimiento: solicitud.nacimiento || "",
          localidad: solicitud.localidad || "",
          provincia: solicitud.provincia || "",
          domicilio: solicitud.domicilio || "",
          telefono: solicitud.telefono || "",
          historiaClinica: solicitud.historiaClinica || "",
          lugarNacimiento: lugarNacimientoValue,
        },
        familiar: {
          nombre: solicitud.familiarNombre || "",
          parentezco: solicitud.familiarParentezco || "",
          telefono: solicitud.familiarTelefono || "",
        },
        formulario: nuevoForm,
        fechaEstimada: "",
        servicio: "PISO",
        lugarNacimiento: lugarNacimientoValue,
      };

      const baseName =
        `${solicitud.apellido || ""} ${solicitud.nombre || ""}`.trim() ||
        "Paciente";
      const fileName = `${generateSafeFilename(baseName)}-${type}.pdf`;

      const res = await fetch("/api/cx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, type, fileName }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    } catch (e) {
      setError(e?.message || "Error al generar PDF");
      console.error(e);
    }
  };

  const descargarFrenteSolicitud = (s) => descargarPdfSolicitud(s, "Frente");
  const descargarDorsoSolicitud = (s) => descargarPdfSolicitud(s, "Dorso");

  const eliminarSolicitud = async (id) => {
    if (!confirm("¿Eliminar permanentemente esta solicitud?")) return;
    try {
      await fetch(`${SOLICITUDES_DB_URL}/${id}.json`, { method: "DELETE" });
      cargarSolicitudes();
      setMensajeExito("Solicitud eliminada.");
      setTimeout(() => setMensajeExito(""), 3000);
    } catch (e) {
      setError("Error al eliminar solicitud");
    }
  };

  const verDatosSolicitud = (solicitud) => {
    setModalSolicitudData(solicitud);
  };

  const cargarSolicitudEnFormulario = (solicitud) => {
    const nuevoForm = buildFormFromSolicitud(solicitud);
    setForm((prev) => ({ ...prev, ...nuevoForm }));
    setActiveTab("form");
    setMode("manual");
    setSelectedPaciente(null);
    setPendingSolicitudId(solicitud.id);
    setMensajeExito(
      "Solicitud cargada al formulario. Complete los datos de cirugía y guarde.",
    );
    setTimeout(() => setMensajeExito(""), 4000);
    if (solicitud.dni) {
      lastLookupDniRef.current = "";
      lookupDniInHC(onlyDigits(solicitud.dni));
    }
  };

  const guardarCXYEliminarSolicitud = async () => {
    const success = await guardarCX();
    if (success && pendingSolicitudId) {
      try {
        await fetch(`${SOLICITUDES_DB_URL}/${pendingSolicitudId}.json`, {
          method: "DELETE",
        });
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
      setCirugias(
        data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : [],
      );
    } catch (err) {
      setError("No se pudieron cargar las cirugías.");
    } finally {
      setLoadingCirugias(false);
    }
  };

  useEffect(() => {
    fetchCirugias();
  }, []);
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
    let doctorKey =
      Object.keys(nuevoFormulario).find(
        (k) =>
          k.toLowerCase().includes("doctor") ||
          k.toLowerCase().includes("dr") ||
          k === "nombre-dr",
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
  const hasLocation =
    canonDomicilioPaciente ||
    canonNacimientoPaciente ||
    canonLocalidad ||
    canonProvincia;

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.formColumn}>
          {error && <div className={styles.bannerError}>{error}</div>}
          {mensajeExito && (
            <div className={styles.bannerSuccess}>{mensajeExito}</div>
          )}

          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              marginBottom: "1.5rem",
              paddingBottom: "1rem",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <button
              onClick={goToNuevaFoja}
              className={styles.primaryBtn}
              style={{ flex: 1 }}
            >
              📄 Crear Foja Quirúrgica
            </button>
            <button
              onClick={goToVerFojas}
              className={styles.primaryBtn}
              style={{
                flex: 1,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              📂 Ver Fojas Guardadas
            </button>
          </div>

          <div className={styles.tabsContainer}>
            <button
              className={`${styles.tabButton} ${
                activeTab === "form" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("form")}
            >
              📋 Formulario
            </button>
            <button
              className={`${styles.tabButton} ${
                activeTab === "solicitudes" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("solicitudes")}
            >
              📝 Solicitudes
            </button>
            <button
              className={`${styles.tabButton} ${
                activeTab === "programadas" ? styles.activeTab : ""
              }`}
              onClick={() => setActiveTab("programadas")}
            >
              📅 Programadas
            </button>
          </div>

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
              hcLookup={hcLookup}
              onDNIBlur={handleDNIBlur}
              onForceLookupDni={forceLookupDni}
              onAplicarHC={aplicarHistoriaClinica}
              onCrearHC={crearHistoriaClinica}
              creatingHc={creatingHc}
            />
          )}
          {activeTab === "solicitudes" && (
            <SolicitudesTab
              solicitudes={solicitudes}
              loadingSolicitudes={loadingSolicitudes}
              cargarSolicitudEnFormulario={cargarSolicitudEnFormulario}
              onEliminar={eliminarSolicitud}
              onDescargarFrente={descargarFrenteSolicitud}
              onDescargarDorso={descargarDorsoSolicitud}
              onVerDatos={verDatosSolicitud}
              onRecargar={cargarSolicitudes}
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

        {activeTab === "form" && (
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <div className={styles.patientPreview}>
                <div className={styles.patientAvatar}>
                  {form.sexo === "F" ? "👩" : form.sexo === "M" ? "👨" : "🧑"}
                </div>
                <div className={styles.patientInfo}>
                  <div className={styles.patientName}>
                    {[
                      canonApellido && form?.[canonApellido],
                      canonNombre && form?.[canonNombre],
                    ]
                      .filter(Boolean)
                      .join(" ") || (
                      <span className={styles.patientNameEmpty}>
                        Sin nombre
                      </span>
                    )}
                  </div>
                  {edadCalculada && (
                    <div className={styles.patientAge}>
                      {edadCalculada} años
                    </div>
                  )}
                  {(form.__hcExtra ||
                    (canonHCPaciente && form?.[canonHCPaciente])) && (
                    <div className={styles.patientHC}>
                      HC{" "}
                      {formatNumberWithThousands(
                        form.__hcExtra || form[canonHCPaciente],
                      )}
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
                onClick={() => downloadPdf("Frente")}
              >
                <span className={styles.downloadIcon}>↓</span>
                <span className={styles.downloadBtnText}>
                  <strong>Frente</strong>
                  <small>{generateFilename("Frente")}.pdf</small>
                </span>
              </button>
              <button
                className={styles.downloadBtn}
                onClick={() => downloadPdf("Dorso")}
              >
                <span className={styles.downloadIcon}>↓</span>
                <span className={styles.downloadBtnText}>
                  <strong>Dorso</strong>
                  <small>{generateFilename("Dorso")}.pdf</small>
                </span>
              </button>
              <p className={styles.sidebarNote}>
                Los PDFs se generan con los datos del formulario y se descargan
                listos para imprimir.
              </p>
            </div>
          </aside>
        )}
      </div>

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
        <ModalListaDia
          cirugias={cirugias}
          onClose={() => setModalListaDia(false)}
        />
      )}
      {modalEstudio && (
        <ModalEstudio
          cx={modalEstudio.cx}
          estudio={modalEstudio.tipo}
          onSave={(prof, fecha) =>
            guardarEstudio(modalEstudio.cx, modalEstudio.tipo, prof, fecha)
          }
          onCancel={() => setModalEstudio(null)}
        />
      )}

      {modalSolicitudData && (
        <ModalSolicitud
          solicitud={modalSolicitudData}
          onClose={() => setModalSolicitudData(null)}
        />
      )}
    </main>
  );
}

// ── ModalSolicitud ──
function ModalSolicitud({ solicitud, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Detalles de la solicitud</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            ✕
          </button>
        </div>
        <div className={styles.modalBody}>
          <div className={styles.detailRow}>
            <strong>Apellido:</strong> {solicitud.apellido || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Nombre:</strong> {solicitud.nombre || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>DNI:</strong> {solicitud.dni || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Teléfono:</strong> {solicitud.telefono || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Sexo:</strong>{" "}
            {solicitud.sexo === "M"
              ? "Masculino"
              : solicitud.sexo === "F"
                ? "Femenino"
                : "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Fecha nacimiento:</strong> {solicitud.nacimiento || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Localidad:</strong> {solicitud.localidad || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Provincia:</strong> {solicitud.provincia || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Domicilio:</strong> {solicitud.domicilio || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Lugar de nacimiento:</strong>{" "}
            {solicitud.lugarNacimiento || "-"}
          </div>

          <div
            className={styles.detailRow}
            style={{
              marginTop: 12,
              borderTop: "1px solid rgba(255,255,255,0.1)",
              paddingTop: 12,
            }}
          >
            <strong style={{ color: "#6fa17b" }}>
              👨‍👩‍👧 Familiar responsable
            </strong>
          </div>
          <div className={styles.detailRow}>
            <strong>Nombre:</strong> {solicitud.familiarNombre || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Parentezco:</strong> {solicitud.familiarParentezco || "-"}
          </div>
          <div className={styles.detailRow}>
            <strong>Teléfono:</strong> {solicitud.familiarTelefono || "-"}
          </div>

          <div className={styles.detailRow} style={{ marginTop: 12 }}>
            <strong>Fecha de solicitud:</strong>{" "}
            {solicitud.fechaSolicitud
              ? new Date(solicitud.fechaSolicitud).toLocaleString()
              : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
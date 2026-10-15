"use client";
// Mismo directorio que el page.jsx actual (imports relativos intactos).

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { push, ref, set, get, child, runTransaction } from "firebase/database";
import { getSession } from "@/utils/session";
import { guardarPacientePami } from "@/lib/pami";
import styles from "./cx-common.module.css";
import FormularioCX from "./_components/FormularioCX";
import {
  DOCTORES,
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
  normalizeName,
  onlyDigits,
  parseHCNumber,
} from "./_utils/helpers";

const MAPPING_URL = "/mappings/cd-campos_fields_rects.json";
const HC_PATH = "historias-clinicas";
const COUNTER_GENERAL_PATH = "counters/historias-clinicas/lastNumber";

// Nombre de prop → detector (se resuelve contra las claves canónicas del mapping)
const DETECTORS = {
  canonCX: isCanonCX,
  canonDoctor: isCanonDoctor,
  canonApellido: isCanonApellido,
  canonNombre: isCanonNombre,
  canonDNI: isCanonDNI,
  canonEdad: isCanonEdad,
  canonEdadPaciente: isCanonEdadPaciente,
  canonDia: isCanonDia,
  canonMes: isCanonMes,
  canonAnio: isCanonAnio,
  canonLocalidad: isCanonLocalidad,
  canonProvincia: isCanonProvincia,
  canonDomicilioPaciente: isCanonDomicilioPaciente,
  canonNacimientoPaciente: isCanonNacimientoPaciente,
  canonHCPaciente: isCanonHCPaciente,
  canonART: isCanonART,
  canonTelefono: isCanonTelefono,
  canonNombres: isCanonNombresPaciente,
  canonServicio: isCanonServicio,
  canonDiaInt: isCanonDiaInt,
  canonMesInt: isCanonMesInt,
  canonAnioInt: isCanonAnioInt,
  canonFamiliarNombre: isCanonFamiliarNombre,
  canonFamiliarParentezco: isCanonFamiliarParentezco,
  canonFamiliarTelefono: isCanonFamiliarTelefono,
  canonDocumento: isCanonDocumento,
  canonHabitacionCama: isCanonHabitacionCama,
};

const EMPTY_HC = {
  loading: false,
  searched: false,
  dni: "",
  match: null,
  nextNumber: null,
  loadingNext: false,
};
const pad2 = (v) => String(v).padStart(2, "0");
const noop = () => { };

export default function IngresoPamiPage() {
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [saving, setSaving] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");
  const [hcLookup, setHcLookup] = useState(EMPTY_HC);
  const [creatingHc, setCreatingHc] = useState(false);
  const lastLookupDniRef = useRef("");

  // ── Mapping ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(MAPPING_URL, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (alive) setMapping(json);
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

  const canonical = useMemo(() => {
    if (!mapping) return null;
    const canonicalToInternal = {};
    const internalToCanonical = {};
    for (const internal of Object.keys(mapping)) {
      const canon = normalizeName(internal);
      internalToCanonical[internal] = canon;
      (canonicalToInternal[canon] ||= []).push(internal);
    }
    for (const k of Object.keys(canonicalToInternal))
      canonicalToInternal[k] = [...new Set(canonicalToInternal[k])].sort();
    return { canonicalToInternal, internalToCanonical };
  }, [mapping]);

  const canonKeys = useMemo(
    () => (canonical ? Object.keys(canonical.canonicalToInternal) : []),
    [canonical],
  );

  const canon = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(DETECTORS).map(([prop, fn]) => [
          prop,
          canonKeys.find(fn),
        ]),
      ),
    [canonKeys],
  );

  const {
    canonCX,
    canonDoctor,
    canonApellido,
    canonNombre,
    canonDNI,
    canonEdad,
    canonEdadPaciente,
    canonDia,
    canonMes,
    canonAnio,
    canonLocalidad,
    canonProvincia,
    canonDomicilioPaciente,
    canonNacimientoPaciente,
    canonHCPaciente,
    canonART,
    canonTelefono,
    canonServicio,
  } = canon;

  // ── Formulario inicial (con defaults) ──
  const initialForm = useMemo(() => {
    if (!canonical || !mapping) return null;
    const f = {};
    canonKeys.forEach((k) => (f[k] = ""));
    if (
      Object.keys(mapping).some(
        (k) =>
          k.includes("masculino-paciente") ||
          k.includes("femenino-paciente"),
      )
    )
      f.sexo = "";
    if (canonServicio) f[canonServicio] = "PISO";
    if (canonLocalidad) f[canonLocalidad] = "CHAJARÍ";
    if (canonProvincia) f[canonProvincia] = "ENTRE RIOS";
    return {
      ...f,
      __afiliado: "", // ← N° de afiliado PAMI, separado del DNI
      __familiarNombre: "",
      __familiarParentezco: "",
      __familiarTelefono: "",
      __hcExtra: "",
      __artOtra: "",
      __habitacionCama: "",
    };
  }, [canonical, mapping, canonKeys, canonServicio, canonLocalidad, canonProvincia]);

  useEffect(() => {
    if (initialForm) setForm(initialForm);
  }, [initialForm]);

  // ── Sugerencias ──
  useEffect(() => {
    if (!canonical) return;
    let s = loadSuggestions();
    if (canonLocalidad) s = addSuggestion(s, canonLocalidad, "CHAJARÍ");
    if (canonProvincia) s = addSuggestion(s, canonProvincia, "ENTRE RIOS");
    if (canonNacimientoPaciente)
      ["CHAJARÍ, ENTRE RIOS", "CONCORDIA, ENTRE RIOS", "PARANÁ, ENTRE RIOS"].forEach(
        (l) => (s = addSuggestion(s, canonNacimientoPaciente, l)),
      );
    if (canonDoctor)
      DOCTORES.forEach((d) => (s = addSuggestion(s, canonDoctor, d)));
    setSuggestions(s);
    saveSuggestions(s);
  }, [canonical, canonLocalidad, canonProvincia, canonNacimientoPaciente, canonDoctor]);

  function setValue(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function commitSuggestion(canonName, value) {
    const next = addSuggestion(suggestions, canonName, value);
    if (next === suggestions) return;
    setSuggestions(next);
    saveSuggestions(next);
  }

  // ── Edad ──
  const edadCalculada = useMemo(
    () =>
      computeAgeYears(
        canonDia ? form?.[canonDia] : "",
        canonMes ? form?.[canonMes] : "",
        canonAnio ? form?.[canonAnio] : "",
      ),
    [form, canonDia, canonMes, canonAnio],
  );

  useEffect(() => {
    if (!canonEdad && !canonEdadPaciente) return;
    const next = edadCalculada ? `${edadCalculada} años` : "";
    setForm((prev) => {
      const out = { ...prev };
      let changed = false;
      for (const c of [canonEdad, canonEdadPaciente]) {
        if (c && (out[c] ?? "") !== next) {
          out[c] = next;
          changed = true;
        }
      }
      return changed ? out : prev;
    });
  }, [edadCalculada, canonEdad, canonEdadPaciente]);

  // ── Campos "resto" (DNI ya no se repite aquí) ──
  const orderedResto = useMemo(() => {
    if (!canonical) return [];
    const known = new Set(
      ["masculino-paciente", "femenino-paciente", "sexo", ...Object.values(canon)].filter(Boolean),
    );
    return canonKeys
      .filter((k) => !known.has(k) && !isCanonEdadPacienteUI(k))
      .sort((a, b) => a.localeCompare(b, "es"));
  }, [canonical, canonKeys, canon]);

  // ══════════════════════════════════════════════════════════
  // HC LOOKUP (sin cambios funcionales)
  // ══════════════════════════════════════════════════════════
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
    const counterVal = snapCounter.exists() ? Number(snapCounter.val() || 0) : 0;
    return Math.max(maxReal, counterVal) + 1;
  };

  const lookupDniInHC = async (dniDigits) => {
    if (!dniDigits || dniDigits.length < 7) return;
    if (lastLookupDniRef.current === dniDigits) return;
    lastLookupDniRef.current = dniDigits;

    setHcLookup({ ...EMPTY_HC, loading: true, dni: dniDigits });

    try {
      const snap = await get(child(ref(db), HC_PATH));
      const matchesDni = (raw) => {
        const d = onlyDigits(raw);
        if (!d) return false;
        if (d === dniDigits) return true;
        if (dniDigits.length === 11 && d === dniDigits.slice(2, 10)) return true;
        if (d.length === 11 && dniDigits === d.slice(2, 10)) return true;
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
              historia_clinica: v.historia_clinica || v.historia_clinica_1 || "",
            };
            break;
          }
        }
      }

      setHcLookup({
        ...EMPTY_HC,
        searched: true,
        dni: dniDigits,
        match,
        loadingNext: !match,
      });

      if (!match) {
        try {
          const next = await calcularProximoNumeroHC();
          setHcLookup((p) => ({ ...p, nextNumber: next, loadingNext: false }));
        } catch (err) {
          console.error("Error calculando próximo HC:", err);
          setHcLookup((p) => ({ ...p, loadingNext: false }));
        }
      }
    } catch (err) {
      console.error("Error buscando DNI en HC:", err);
      setHcLookup({ ...EMPTY_HC, searched: true, dni: dniDigits });
    }
  };

  const handleDNIBlur = (raw) => {
    const digits = onlyDigits(raw);
    if (digits.length >= 7) lookupDniInHC(digits);
  };

  const forceLookupDni = () => {
    const digits = onlyDigits(canonDNI ? form?.[canonDNI] : "");
    if (digits.length < 7) return alert("Ingresá al menos 7 dígitos del DNI");
    lastLookupDniRef.current = "";
    lookupDniInHC(digits);
  };

  const flash = (msg, ms = 3000) => {
    setMensajeExito(msg);
    setTimeout(() => setMensajeExito(""), ms);
  };

  const aplicarHistoriaClinica = (hc) => {
    if (!hc) return;
    const numero = String(hc.historia_clinica || "");
    if (canonHCPaciente) setValue(canonHCPaciente, numero);
    setValue("__hcExtra", numero);
    const [ape, nom] = (hc.nombre_apellido || "").split(",").map((s) => s.trim());
    if (ape && canonApellido && !(form[canonApellido] || "").trim())
      setValue(canonApellido, ape);
    if (nom && canonNombre && !(form[canonNombre] || "").trim())
      setValue(canonNombre, nom);
    flash(`HC #${numero} aplicada al formulario.`);
  };

  const crearHistoriaClinica = async () => {
    const dniDigits = onlyDigits(canonDNI ? form?.[canonDNI] : "");
    if (dniDigits.length < 7) return alert("Ingresá al menos 7 dígitos del DNI");
    const apellido = canonApellido ? form?.[canonApellido] : "";
    const nombre = canonNombre ? form?.[canonNombre] : "";
    if (!apellido || !nombre)
      return alert("Completá apellido y nombre antes de crear la HC");

    const preview = hcLookup.nextNumber
      ? ` (se asignará el N° ${hcLookup.nextNumber})`
      : "";
    if (
      !window.confirm(
        `¿Crear una nueva historia clínica PISO para "${apellido} ${nombre}" (DNI ${dniDigits})${preview}?`,
      )
    )
      return;

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
      const tx = await runTransaction(counterRef, (v) => Number(v || 0) + 1);
      if (!tx.committed) throw new Error("No se pudo reservar el número");
      const reserved = Number(tx.snapshot.val() || 0);
      const finalNumber = reserved > maxReal ? reserved : maxReal + 1;
      if (finalNumber !== reserved) await set(counterRef, finalNumber);

      const newNumber = String(finalNumber);
      const session = (typeof getSession === "function" && getSession()) || {};
      const userName = session.user || session.usuario || session.nombre || "sistema";
      const userKey = session.id || session.key || "";
      const now = Date.now();

      await set(push(ref(db, HC_PATH)), {
        nombre_apellido: `${apellido} ${nombre}`.trim().toUpperCase(),
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
      flash(`✅ HC PISO #${newNumber} creada correctamente`, 4000);
    } catch (err) {
      console.error("Error creando HC:", err);
      alert("No se pudo crear la historia clínica.");
    } finally {
      setCreatingHc(false);
    }
  };

  // ══════════════════════════════════════════════════════════
  // Datos del paciente (única fuente para PDF y Firebase)
  // ══════════════════════════════════════════════════════════
  const v = (c) => (c ? form?.[c] || "" : "");

  const buildDatos = () => ({
    apellido: v(canonApellido),
    nombre: v(canonNombre),
    dni: v(canonDNI), // formateado; pami.js lo normaliza a dígitos
    afiliado: onlyDigits(form.__afiliado),
    sexo: form?.sexo || "",
    fechaNacimiento:
      form?.[canonAnio] && form?.[canonMes] && form?.[canonDia]
        ? `${form[canonAnio]}-${pad2(form[canonMes])}-${pad2(form[canonDia])}`
        : "",
    telefono: v(canonTelefono),
    domicilio: v(canonDomicilioPaciente),
    localidad: v(canonLocalidad),
    provincia: v(canonProvincia),
    lugarNacimiento: v(canonNacimientoPaciente),
    historiaClinica: form.__hcExtra || v(canonHCPaciente),
    habitacionCama: form.__habitacionCama || "",
    familiar: {
      nombre: form.__familiarNombre || "",
      parentezco: form.__familiarParentezco || "",
      telefono: form.__familiarTelefono || "",
    },
  });

  const formularioSinInternos = () =>
    Object.fromEntries(Object.entries(form).filter(([k]) => !k.startsWith("__")));

  const fechaCirugiaObj = () => {
    if (!fechaEstimada) return null;
    const [y, m, d] = fechaEstimada.split("-");
    return { dia: d || "", mes: m || "", anio: y || "" };
  };

  function generateFilename(type) {
    const base =
      `${v(canonApellido)} ${v(canonNombre)}`.trim() || "Paciente";
    return `${generateSafeFilename(base) || "PACIENTE"}-${type}`;
  }

  // ── PDF vía API ──
  async function downloadPdf(type) {
    try {
      setError("");
      const { familiar, ...pd } = buildDatos();
      const payload = {
        pacienteDatos: { ...pd, edad: edadCalculada || "" },
        familiar,
        formulario: formularioSinInternos(),
        fechaEstimada: fechaEstimada || "",
        fechaCirugia: fechaCirugiaObj(),
        servicio: "PISO",
        habitacionCama: pd.habitacionCama,
        lugarNacimiento: pd.lugarNacimiento,
      };
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

      const url = URL.createObjectURL(await res.blob());
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

  // ── Guardar en PAMI/pacientes/{dni} ──
  async function guardarPaciente() {
    const datos = buildDatos();
    if (!datos.apellido || !datos.nombre)
      return alert("Completá apellido y nombre del paciente");
    if (onlyDigits(datos.dni).length < 7)
      return alert("Ingresá un DNI válido (mínimo 7 dígitos)");
    if (!datos.afiliado) return alert("Ingresá el N° de afiliado PAMI");

    const session = (typeof getSession === "function" && getSession()) || {};
    const usuario = session.user || session.usuario || session.nombre || "sistema";

    const paciente = {
      ...datos,
      cirugia: {
        procedimiento: v(canonCX),
        doctor: v(canonDoctor),
        art: v(canonART),
        fechaEstimada: fechaEstimada || "",
        formulario: Object.fromEntries(
          Object.entries(formularioSinInternos()).filter(
            ([, val]) => val !== "" && val != null,
          ),
        ),
      },
    };

    setSaving(true);
    try {
      let r = await guardarPacientePami(paciente, { usuario });
      if (r.exists) {
        const ok = window.confirm(
          `Ya existe un paciente PAMI con DNI ${r.key}. ¿Actualizar sus datos?`,
        );
        if (!ok) return;
        r = await guardarPacientePami(paciente, { usuario, actualizar: true });
      }
      if (!r.success) throw new Error(r.error || "No se pudo guardar");

      flash(r.updated ? "Paciente PAMI actualizado." : "Paciente PAMI guardado.");
      setForm(initialForm);
      setFechaEstimada("");
      lastLookupDniRef.current = "";
      setHcLookup(EMPTY_HC);
    } catch (err) {
      console.error(err);
      alert("Error al guardar el paciente PAMI: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──
  if (loading)
    return (
      <main className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <p>Cargando campos del formulario…</p>
        </div>
      </main>
    );

  if (!mapping || !canonical)
    return (
      <main className={styles.page}>
        <div className={styles.bannerError}>
          <strong>Error:</strong> {error || "No se pudo cargar el mapping."}
        </div>
      </main>
    );

  const hasSexo = form?.sexo !== undefined;
  const hasLocation =
    canonDomicilioPaciente || canonNacimientoPaciente || canonLocalidad || canonProvincia;
  const hcPreview = form.__hcExtra || (canonHCPaciente && form?.[canonHCPaciente]);

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        <div className={styles.formColumn}>
          {error && <div className={styles.bannerError}>{error}</div>}
          {mensajeExito && <div className={styles.bannerSuccess}>{mensajeExito}</div>}

          <h1 className={styles.sectionTitle} style={{ marginBottom: "1rem" }}>
            Ingreso PAMI
          </h1>

          <FormularioCX
            {...canon}
            form={form}
            setValue={setValue}
            suggestions={suggestions}
            commitSuggestion={commitSuggestion}
            canonicalObj={canonical}
            mapping={mapping}
            mode="manual"
            setMode={noop}
            selectedPaciente={null}
            setSelectedPaciente={noop}
            hasSexo={hasSexo}
            hasLocation={hasLocation}
            orderedResto={orderedResto}
            fechaEstimada={fechaEstimada}
            setFechaEstimada={setFechaEstimada}
            guardarCXYEliminarSolicitud={guardarPaciente}
            saving={saving}
            edadCalculada={edadCalculada}
            hcLookup={hcLookup}
            onDNIBlur={handleDNIBlur}
            onForceLookupDni={forceLookupDni}
            onAplicarHC={aplicarHistoriaClinica}
            onCrearHC={crearHistoriaClinica}
            creatingHc={creatingHc}
          />
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
            <div className={styles.patientPreview}>
              <div className={styles.patientAvatar}>
                {form.sexo === "F" ? "👩" : form.sexo === "M" ? "👨" : "🧑"}
              </div>
              <div className={styles.patientInfo}>
                <div className={styles.patientName}>
                  {[v(canonApellido), v(canonNombre)].filter(Boolean).join(" ") || (
                    <span className={styles.patientNameEmpty}>Sin nombre</span>
                  )}
                </div>
                {edadCalculada && (
                  <div className={styles.patientAge}>{edadCalculada} años</div>
                )}
                {form.__afiliado && (
                  <div className={styles.patientHC}>Afiliado {form.__afiliado}</div>
                )}
                {hcPreview && (
                  <div className={styles.patientHC}>
                    HC {formatNumberWithThousands(hcPreview)}
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
            {["Frente", "Dorso"].map((t) => (
              <button
                key={t}
                className={styles.downloadBtn}
                onClick={() => downloadPdf(t)}
              >
                <span className={styles.downloadIcon}>↓</span>
                <span className={styles.downloadBtnText}>
                  <strong>{t}</strong>
                  <small>{generateFilename(t)}.pdf</small>
                </span>
              </button>
            ))}
            <p className={styles.sidebarNote}>
              Los PDFs se generan con los datos del formulario y se descargan
              listos para imprimir.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
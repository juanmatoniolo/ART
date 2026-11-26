"use client";
// CX para Obras sociales: formulario EN BLANCO solo para generar los PDF de
// frente y dorso de la cirugía. No lee ni guarda datos de pacientes: sin
// selector de pacientes, sin búsqueda de historias clínicas, sin solicitudes
// y sin guardar en la base. Reutiliza el formulario de admin/cx (sinDatos).
import { useEffect, useMemo, useState } from "react";
import FormularioCX from "@/app/admin/cx/_components/FormularioCX";
import styles from "@/app/admin/cx/cx-common.module.css";
import {
  isCanonCX, isCanonDoctor, isCanonApellido, isCanonNombre, isCanonDNI,
  isCanonEdad, isCanonEdadPaciente, isCanonDia, isCanonMes, isCanonAnio,
  isCanonLocalidad, isCanonProvincia, isCanonDomicilioPaciente,
  isCanonNacimientoPaciente, isCanonHCPaciente, isCanonART, isCanonTelefono,
  isCanonNombresPaciente, isCanonServicio,
  loadSuggestions, saveSuggestions, addSuggestion,
  computeAgeYears, generateSafeFilename,
} from "@/app/admin/cx/_utils/helpers";

const MAPPING_URL = "/mappings/cd-campos_fields_rects.json";
const DOCTORES = ["BRARDA AGUSTIN", "CANAGLIA GUSTAVO", "CIANCIOSI SEBASTIAN", "DEL PUERTO RODRIGO", "GIMENEZ MARTIN", "PERTUS DIEGO"];
const NOOP = () => {};

export default function OSCxPage() {
  const [mapping, setMapping] = useState(null);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [form, setForm] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [fechaEstimada, setFechaEstimada] = useState("");
  const [descargando, setDescargando] = useState(false);

  // Campos del PDF (plantilla pública de campos, no son datos de pacientes)
  useEffect(() => {
    let alive = true;
    fetch(MAPPING_URL, { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => alive && setMapping(json))
      .catch((e) => alive && setError(e?.message || "Error cargando el formulario"));
    return () => {
      alive = false;
    };
  }, []);

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
  const c = useMemo(
    () => ({
      CX: canonKeys.find(isCanonCX),
      Doctor: canonKeys.find(isCanonDoctor),
      Apellido: canonKeys.find(isCanonApellido),
      Nombre: canonKeys.find(isCanonNombre),
      DNI: canonKeys.find(isCanonDNI),
      Edad: canonKeys.find(isCanonEdad),
      EdadPaciente: canonKeys.find(isCanonEdadPaciente),
      Dia: canonKeys.find(isCanonDia),
      Mes: canonKeys.find(isCanonMes),
      Anio: canonKeys.find(isCanonAnio),
      Localidad: canonKeys.find(isCanonLocalidad),
      Provincia: canonKeys.find(isCanonProvincia),
      DomicilioPaciente: canonKeys.find(isCanonDomicilioPaciente),
      NacimientoPaciente: canonKeys.find(isCanonNacimientoPaciente),
      HCPaciente: canonKeys.find(isCanonHCPaciente),
      ART: canonKeys.find(isCanonART),
      Telefono: canonKeys.find(isCanonTelefono),
      Nombres: canonKeys.find(isCanonNombresPaciente),
      Servicio: canonKeys.find(isCanonServicio),
    }),
    [canonKeys]
  );

  const formularioInicial = useMemo(() => {
    if (!canonical || !mapping) return null;
    const initial = {};
    for (const k of Object.keys(canonical.canonicalToInternal)) initial[k] = "";
    if (Object.keys(mapping).some((k) => k.includes("masculino-paciente") || k.includes("femenino-paciente"))) initial.sexo = "";
    if (Object.keys(canonical.canonicalToInternal).some(isCanonServicio)) initial.servicio = "PISO";
    Object.assign(initial, {
      __familiarNombre: "", __familiarParentezco: "", __familiarTelefono: "",
      __hcExtra: "", __artOtra: "", __habitacionCama: "", __afiliadoPaciente: "",
    });
    if (c.Localidad) initial[c.Localidad] = "CHAJARÍ";
    if (c.Provincia) initial[c.Provincia] = "ENTRE RIOS";
    return initial;
  }, [canonical, mapping, c.Localidad, c.Provincia]);

  // Formulario vacío al cargar la plantilla
  useEffect(() => {
    if (formularioInicial) setForm(formularioInicial);
  }, [formularioInicial]);

  // Sugerencias (solo en este navegador, no salen de la PC)
  useEffect(() => {
    if (!canonical) return;
    let seeded = loadSuggestions();
    if (c.Localidad) seeded = addSuggestion(seeded, c.Localidad, "CHAJARÍ");
    if (c.Provincia) seeded = addSuggestion(seeded, c.Provincia, "ENTRE RIOS");
    if (c.NacimientoPaciente) {
      for (const lugar of ["CHAJARÍ, ENTRE RIOS", "CONCORDIA, ENTRE RIOS", "PARANÁ, ENTRE RIOS"]) {
        seeded = addSuggestion(seeded, c.NacimientoPaciente, lugar);
      }
    }
    if (c.Doctor) for (const dr of DOCTORES) seeded = addSuggestion(seeded, c.Doctor, dr);
    setSuggestions(seeded);
    saveSuggestions(seeded);
  }, [canonical, c.Localidad, c.Provincia, c.NacimientoPaciente, c.Doctor]);

  function setValue(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function commitSuggestion(canonName, value) {
    const next = addSuggestion(suggestions, canonName, value);
    if (next === suggestions) return;
    setSuggestions(next);
    saveSuggestions(next);
  }

  const edadCalculada = useMemo(
    () => computeAgeYears(c.Dia ? form?.[c.Dia] : "", c.Mes ? form?.[c.Mes] : "", c.Anio ? form?.[c.Anio] : ""),
    [form, c.Dia, c.Mes, c.Anio]
  );

  // La edad calculada también va a los campos de edad del PDF
  useEffect(() => {
    if (!c.Edad && !c.EdadPaciente) return;
    const next = edadCalculada ? `${edadCalculada} años` : "";
    setForm((prev) => {
      const out = { ...prev };
      let changed = false;
      for (const key of [c.Edad, c.EdadPaciente].filter(Boolean)) {
        if ((out[key] ?? "") !== next) {
          out[key] = next;
          changed = true;
        }
      }
      return changed ? out : prev;
    });
  }, [edadCalculada, c.Edad, c.EdadPaciente]);

  function buildPayload() {
    const formulario = {};
    for (const k of Object.keys(form)) if (!k.startsWith("__")) formulario[k] = form[k];
    const v = (key) => (key ? form?.[key] || "" : "");
    const lugarNacimiento = v(c.NacimientoPaciente);
    return {
      pacienteDatos: {
        apellido: v(c.Apellido),
        nombre: v(c.Nombre),
        dni: v(c.DNI),
        afiliadoPaciente: form?.__afiliadoPaciente || "",
        edad: edadCalculada || "",
        sexo: form?.sexo || "",
        fechaNacimiento:
          form?.[c.Anio] && form?.[c.Mes] && form?.[c.Dia]
            ? `${form[c.Anio]}-${String(form[c.Mes]).padStart(2, "0")}-${String(form[c.Dia]).padStart(2, "0")}`
            : "",
        localidad: v(c.Localidad),
        provincia: v(c.Provincia),
        domicilio: v(c.DomicilioPaciente),
        telefono: v(c.Telefono),
        historiaClinica: form?.__hcExtra || v(c.HCPaciente),
        habitacionCama: form?.__habitacionCama || "",
        lugarNacimiento,
      },
      familiar: {
        nombre: form?.__familiarNombre || "",
        parentezco: form?.__familiarParentezco || "",
        telefono: form?.__familiarTelefono || "",
      },
      formulario,
      fechaEstimada: fechaEstimada || "",
      fechaCirugia: fechaEstimada
        ? (() => {
            const [y, m, d] = fechaEstimada.split("-");
            return { dia: d || "", mes: m || "", anio: y || "" };
          })()
        : null,
      servicio: "PISO",
      habitacionCama: form?.__habitacionCama || "",
      lugarNacimiento,
    };
  }

  function fileNameFor(type) {
    const apellido = String(form?.[c.Apellido] ?? "").trim();
    const nombre = String(form?.[c.Nombre] ?? "").trim();
    const base = generateSafeFilename(apellido && nombre ? `${apellido} ${nombre}` : apellido || nombre || "Paciente");
    return `${base && base.trim() ? `${base}-${type}` : `Paciente-${type}-${Date.now()}`}.pdf`;
  }

  async function downloadPdf(type) {
    if (descargando) return;
    setDescargando(true);
    setError("");
    try {
      const fileName = fileNameFor(type);
      const res = await fetch("/api/cx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload: buildPayload(), type, fileName }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error || `Error ${res.status}`);
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
      setError(e?.message || "No se pudo generar el PDF.");
    } finally {
      setDescargando(false);
    }
  }

  function resetForm() {
    if (!confirm("¿Limpiar todo el formulario?")) return;
    if (formularioInicial) setForm(formularioInicial);
    setFechaEstimada("");
    setMensaje("Formulario limpiado.");
    setTimeout(() => setMensaje(""), 2000);
  }

  return (
    <main className={styles.page}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px 48px" }}>
        <div className={styles.formColumn}>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "1.4rem", fontWeight: 800 }}>CX</h1>
          <p style={{ margin: "0 0 1rem", opacity: 0.75 }}>
            Completá los datos y descargá el frente y el dorso para realizar la cirugía. No se guarda ningún dato.
          </p>

          {error && <div className={styles.bannerError}>{error}</div>}
          {mensaje && <div className={styles.bannerSuccess}>{mensaje}</div>}
          {!mapping && !error && <p>Cargando formulario…</p>}

          {mapping && (
            <FormularioCX
              sinDatos
              form={form}
              setValue={setValue}
              suggestions={suggestions}
              commitSuggestion={commitSuggestion}
              canonicalObj={canonical}
              mapping={mapping}
              mode="manual"
              setMode={NOOP}
              selectedPaciente={null}
              setSelectedPaciente={NOOP}
              canonCX={c.CX}
              canonDoctor={c.Doctor}
              canonApellido={c.Apellido}
              canonNombre={c.Nombre}
              canonDNI={c.DNI}
              canonEdad={c.Edad}
              canonEdadPaciente={c.EdadPaciente}
              canonDia={c.Dia}
              canonMes={c.Mes}
              canonAnio={c.Anio}
              canonLocalidad={c.Localidad}
              canonProvincia={c.Provincia}
              canonDomicilioPaciente={c.DomicilioPaciente}
              canonNacimientoPaciente={c.NacimientoPaciente}
              canonHCPaciente={c.HCPaciente}
              canonART={c.ART}
              canonTelefono={c.Telefono}
              canonNombres={c.Nombres}
              canonServicio={c.Servicio}
              hasSexo={form?.sexo !== undefined}
              hasLocation={Boolean(c.DomicilioPaciente || c.NacimientoPaciente || c.Localidad || c.Provincia)}
              orderedResto={[]}
              fechaEstimada={fechaEstimada}
              setFechaEstimada={setFechaEstimada}
              guardarCXYEliminarSolicitud={NOOP}
              saving={false}
              edadCalculada={edadCalculada}
              hcLookup={null}
              onDNIBlur={NOOP}
              onForceLookupDni={NOOP}
              onAplicarHC={NOOP}
              onCrearHC={NOOP}
              creatingHc={false}
              downloadPdf={downloadPdf}
              resetForm={resetForm}
            />
          )}
        </div>
      </div>
    </main>
  );
}

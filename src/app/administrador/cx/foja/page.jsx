"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, push, onValue } from "firebase/database";
import styles from "./foja.module.css";

// ── Constantes ──────────────────────────────
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const INITIAL_FORM = {
  apelidoynombre: "", edad: "",
  cirujanoTitulo: "Dr.", cirujano: "",
  primerayudante: "", segundoayudante: "",
  anestesista: "",
  dia: "", mes: "", anio: "",
  inichsinicio: "", hsfin: "",
  preoperatorio: "", posoperatorio: "",
  procedimientoqx: "", hallazgos: "",
};

// ── Helpers ────────────────────────────────
const getCirujanoCompleto = (form) => {
  const nombre = (form.cirujano || "").trim();
  const titulo = (form.cirujanoTitulo || "Dr.").trim();
  return nombre ? `${titulo} ${nombre}`.trim() : "";
};

const getTemplateData = (template) => {
  const source = template?.templateData || template?.formData || template || {};
  let cirujano = source.cirujano || template?.cirujano || "";
  let cirujanoTitulo = source.cirujanoTitulo || "Dr.";
  const match = cirujano.match(/^(Dr\.|Dra\.)\s*(.*)$/i);
  if (match) {
    cirujanoTitulo = match[1].toLowerCase().startsWith("dra") ? "Dra." : "Dr.";
    cirujano = match[2];
  }
  return {
    cirujanoTitulo,
    cirujano: cirujano.trim(),
    preoperatorio: source.preoperatorio || template?.preoperatorio || "",
    posoperatorio: source.posoperatorio || template?.posoperatorio || "",
    procedimientoqx: source.procedimientoqx || template?.procedimientoqx || "",
    hallazgos: source.hallazgos || template?.hallazgos || "",
  };
};

const buildCx = (form) => {
  const secciones = [
    { etiqueta: "1. Diagnóstico Preoperatorio", valor: form.preoperatorio },
    { etiqueta: "2. Diagnóstico Posoperatorio", valor: form.posoperatorio },
    { etiqueta: "3. Procedimiento Quirúrgico", valor: form.procedimientoqx },
    { etiqueta: "4. Operación y Hallazgos", valor: form.hallazgos },
  ];
  return secciones
    .filter((s) => (s.valor || "").trim() !== "")
    .map((s) => `${s.etiqueta}: ${s.valor.trim()}`)
    .join("\n\n");
};

const buildPayload = (form) => ({
  paciente: { apelidoynombre: form.apelidoynombre, edad: form.edad },
  equipo: {
    cirujano: getCirujanoCompleto(form),
    primerayudante: form.primerayudante,
    segundoayudante: form.segundoayudante,
    anestesista: form.anestesista,
  },
  fecha: { dia: form.dia, mes: form.mes, anio: form.anio },
  horario: { inicio: form.inichsinicio, fin: form.hsfin },
  descripcion: {
    preoperatorio: (form.preoperatorio || "").trim(),
    posoperatorio: (form.posoperatorio || "").trim(),
    procedimientoqx: (form.procedimientoqx || "").trim(),
    hallazgos: (form.hallazgos || "").trim(),
  },
  cx: buildCx(form),
});

const buildFileName = (form) => {
  const apellido = form.apelidoynombre
    ? form.apelidoynombre.split(",")[0].trim().replace(/\s+/g, "_")
    : "foja";
  return `FojaQX_${apellido}_${form.dia}-${form.mes}-${form.anio}.pdf`;
};

// ── Iconos ─────────────────────────────────
const IconDownload = () => (
  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
    <path d="M7.5 1v9M4 7.5l3.5 3L11 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1.5 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const IconShare = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <polyline points="16 6 12 2 8 6" />
    <line x1="12" y1="2" x2="12" y2="15" />
  </svg>
);
const IconSearch = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

// ── Componente principal ───────────────────
export default function FojaAdminPage() {
  const router = useRouter();
  const [view, setView] = useState("nueva"); // "nueva" | "guardadas" | "plantillas"
  const [form, setForm] = useState(INITIAL_FORM);
  const [saveStatus, setSaveStatus] = useState("idle");
  const [pdfStatus, setPdfStatus] = useState("idle");
  const [savedKey, setSavedKey] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const pdfUrlRef = useRef(null);

  const [templates, setTemplates] = useState([]);
  const [templateName, setTemplateName] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const plantillasRef = ref(db, "fojaqx/plantilla");

  const [fojasGuardadas, setFojasGuardadas] = useState([]);
  const [loadingFojas, setLoadingFojas] = useState(true);

  // Búsqueda en plantillas
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsubPlantillas = onValue(plantillasRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      if (data) {
        Object.keys(data).forEach((key) => list.push({ id: key, ...data[key] }));
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      }
      setTemplates(list);
      setLoadingTemplates(false);
    }, (error) => {
      console.error(error);
      setErrorMsg("No se pudieron cargar las plantillas.");
      setLoadingTemplates(false);
    });

    const fojaRef = ref(db, "fojaqx");
    const unsubFojas = onValue(fojaRef, (snapshot) => {
      const data = snapshot.val();
      const list = [];
      if (data) {
        Object.keys(data).forEach((key) => {
          if (key !== "plantilla") {
            list.push({ id: key, ...data[key] });
          }
        });
        list.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
      }
      setFojasGuardadas(list);
      setLoadingFojas(false);
    }, (error) => {
      console.error(error);
      setErrorMsg("No se pudieron cargar las fojas guardadas.");
      setLoadingFojas(false);
    });

    return () => {
      unsubPlantillas();
      unsubFojas();
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, []);

  const resetPdfState = useCallback(() => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    setPdfUrl(null);
    setPdfFileName(null);
    setPdfStatus("idle");
    pdfUrlRef.current = null;
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (saveStatus === "saved") {
      setSaveStatus("idle");
      setSavedKey(null);
      resetPdfState();
    }
  };

  const generarPDF = useCallback(async () => {
    setPdfStatus("loading");
    setErrorMsg("");
    try {
      const payload = buildPayload(form);
      const fileName = buildFileName(form);
      const res = await fetch("/api/fojaqx/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, fileName }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setPdfFileName(fileName);
      pdfUrlRef.current = url;
      setPdfStatus("done");
    } catch (err) {
      setPdfStatus("error");
      setErrorMsg(err.message || "Error al generar el PDF.");
    }
  }, [form]);

  const handleGuardar = async (e) => {
    e.preventDefault();
    const required = [
      "apelidoynombre", "edad", "cirujano", "anestesista",
      "dia", "mes", "anio", "inichsinicio", "hsfin",
      "preoperatorio", "procedimientoqx"
    ];
    for (const field of required) {
      if (!form[field]) {
        setErrorMsg(`Completá el campo ${field.replace(/([A-Z])/g, " $1").toLowerCase()}`);
        setSaveStatus("error");
        return;
      }
    }
    setSaveStatus("saving");
    setErrorMsg("");
    resetPdfState();
    try {
      const fojaRef = ref(db, "fojaqx");
      const snap = await push(fojaRef, {
        ...buildPayload(form),
        timestamp: new Date().toISOString(),
      });
      setSavedKey(snap.key);
      setSaveStatus("saved");
      await generarPDF();
    } catch (err) {
      setSaveStatus("error");
      setErrorMsg(err.message || "Error al guardar en Firebase.");
    }
  };

  const saveTemplate = async () => {
    const name = templateName.trim();
    const hasDescription = [
      form.preoperatorio,
      form.posoperatorio,
      form.procedimientoqx,
      form.hallazgos,
    ].some((value) => value.trim() !== "");
    if (!name) {
      setErrorMsg("Ingresá un nombre para identificar la plantilla.");
      return;
    }
    if (!form.cirujano.trim() || !hasDescription) {
      setErrorMsg("Completá el cirujano y al menos un campo de la descripción quirúrgica.");
      return;
    }
    setSavingTemplate(true);
    setErrorMsg("");
    const templateData = {
      cirujanoTitulo: form.cirujanoTitulo,
      cirujano: form.cirujano.trim(),
      preoperatorio: form.preoperatorio.trim(),
      posoperatorio: form.posoperatorio.trim(),
      procedimientoqx: form.procedimientoqx.trim(),
      hallazgos: form.hallazgos.trim(),
    };
    try {
      await push(plantillasRef, {
        name,
        templateData,
        cirujano: getCirujanoCompleto(form),
        ...templateData,
        timestamp: Date.now(),
      });
      setTemplateName("");
      setErrorMsg(`Plantilla "${name}" guardada correctamente.`);
      setTimeout(() => setErrorMsg(""), 3500);
    } catch (err) {
      setErrorMsg(`Error al guardar la plantilla: ${err.message}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  // Cargar plantilla desde la pestaña de plantillas (por ID)
  const handleSelectTemplate = (templateId) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) {
      setErrorMsg("La plantilla seleccionada ya no está disponible.");
      return;
    }
    const templateData = getTemplateData(template);
    setForm((current) => ({ ...current, ...templateData }));
    resetPdfState();
    setSaveStatus("idle");
    setSavedKey(null);
    setErrorMsg(`Plantilla "${template.name}" cargada.`);
    setTimeout(() => setErrorMsg(""), 3500);
    setView("nueva");
  };

  // Cargar foja guardada en el formulario
  const cargarFojaEnFormulario = (foja) => {
    let titulo = "Dr.";
    let nombreCirujano = "";
    const cirujanoCompleto = foja.equipo?.cirujano || "";
    const match = cirujanoCompleto.match(/^(Dr\.|Dra\.)\s*(.*)$/i);
    if (match) {
      titulo = match[1].toLowerCase().startsWith("dra") ? "Dra." : "Dr.";
      nombreCirujano = match[2];
    } else {
      nombreCirujano = cirujanoCompleto;
    }

    setForm({
      apelidoynombre: foja.paciente?.apelidoynombre || "",
      edad: foja.paciente?.edad || "",
      cirujanoTitulo: titulo,
      cirujano: nombreCirujano,
      primerayudante: foja.equipo?.primerayudante || "",
      segundoayudante: foja.equipo?.segundoayudante || "",
      anestesista: foja.equipo?.anestesista || "",
      dia: foja.fecha?.dia || "",
      mes: foja.fecha?.mes || "",
      anio: foja.fecha?.anio || "",
      inichsinicio: foja.horario?.inicio || "",
      hsfin: foja.horario?.fin || "",
      preoperatorio: foja.descripcion?.preoperatorio || "",
      posoperatorio: foja.descripcion?.posoperatorio || "",
      procedimientoqx: foja.descripcion?.procedimientoqx || "",
      hallazgos: foja.descripcion?.hallazgos || "",
    });

    resetPdfState();
    setSaveStatus("idle");
    setSavedKey(null);
    setErrorMsg("");
    setView("nueva");
  };

  const openPdf = () => { if (pdfUrl) window.open(pdfUrl, "_blank"); };
  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = pdfFileName || "foja_quirurgica.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  const handleSharePDF = async () => {
    if (!pdfUrl || !pdfFileName) {
      setErrorMsg("Aún no hay PDF para compartir.");
      return;
    }
    try {
      const blob = await fetch(pdfUrl).then(r => r.blob());
      const file = new File([blob], pdfFileName, { type: "application/pdf" });
      if (navigator.share) {
        await navigator.share({ title: "Foja Quirúrgica", text: "Adjunto PDF de la foja quirúrgica", files: [file] });
      } else {
        await navigator.clipboard.writeText(`Descargá el PDF aquí: ${pdfFileName}`);
        alert("Tu navegador no soporta compartir archivos. Se copió un mensaje al portapapeles.");
      }
    } catch (err) {
      if (err.name !== "AbortError") setErrorMsg("No se pudo compartir el archivo.");
    }
  };
  const handleLimpiar = () => {
    setForm(INITIAL_FORM);
    setSaveStatus("idle");
    setPdfStatus("idle");
    setSavedKey(null);
    setErrorMsg("");
    resetPdfState();
  };

  // Filtrado de plantillas por búsqueda
  const filteredTemplates = templates.filter((t) => {
    const term = searchTerm.toLowerCase();
    const name = (t.name || "").toLowerCase();
    const cirujano = (t.cirujano || "").toLowerCase();
    return name.includes(term) || cirujano.includes(term);
  });

  return (
    <div className={styles.page}>
      <button onClick={() => router.push("/admin/cx")} className={styles.volverBtn}>
        ← Volver a CX
      </button>

      <div className={styles.viewTabs}>
        <button className={`${styles.tab} ${view === "nueva" ? styles.tabActive : ""}`} onClick={() => setView("nueva")}>
          📝 Nueva Foja
        </button>
        <button className={`${styles.tab} ${view === "guardadas" ? styles.tabActive : ""}`} onClick={() => setView("guardadas")}>
          📂 Fojas Guardadas ({fojasGuardadas.length})
        </button>
        <button className={`${styles.tab} ${view === "plantillas" ? styles.tabActive : ""}`} onClick={() => setView("plantillas")}>
          📋 Plantillas CX base ({templates.length})
        </button>
      </div>

      {/* ── VISTA: NUEVA FOJA ── */}
      {view === "nueva" && (
        <div className={styles.layout}>
          <main className={styles.mainContent}>
            <header className={styles.header}>
              <div className={styles.headerAccent} />
              <div className={styles.headerContent}>
                <span className={styles.headerTag}>Clínica de la Unión S.A.</span>
                <h1 className={styles.title}>Foja Quirúrgica QX</h1>
                <p className={styles.subtitle}>Completá el registro, guardalo y descargá el PDF.</p>
              </div>
            </header>

            {/* Acceso rápido a plantillas */}
            <div className={styles.plantillaAccess}>
              <button type="button" className={styles.btnSecondary} onClick={() => setView("plantillas")}>
                📋 Cargar desde plantilla CX base
              </button>
            </div>

            <form onSubmit={handleGuardar} className={styles.form} autoComplete="on" noValidate>
              {/* Secciones del formulario (paciente, equipo, fecha, descripción) sin cambios */}
              <section className={styles.section}>
                <SectionHeader num="01" title="Datos del Paciente" />
                <div className={styles.grid2}>
                  <Field label="Apellido y Nombre *" htmlFor="apelidoynombre" value={form.apelidoynombre}>
                    <input id="apelidoynombre" name="apelidoynombre" type="text" className={styles.input} placeholder="Apellido, Nombre" value={form.apelidoynombre} onChange={handleChange} required />
                  </Field>
                  <Field label="Edad *" htmlFor="edad" value={form.edad}>
                    <input id="edad" name="edad" type="number" min="0" max="150" className={styles.input} placeholder="Años" value={form.edad} onChange={handleChange} required />
                  </Field>
                </div>
              </section>

              <section className={styles.section}>
                <SectionHeader num="02" title="Equipo Quirúrgico" />
                <div className={styles.grid2}>
                  <Field label="Cirujano *" htmlFor="cirujano" value={form.cirujano}>
                    <div className={styles.doctorField}>
                      <select id="cirujanoTitulo" name="cirujanoTitulo" className={styles.doctorTitle} value={form.cirujanoTitulo} onChange={handleChange}>
                        <option value="Dr.">Dr.</option>
                        <option value="Dra.">Dra.</option>
                      </select>
                      <input id="cirujano" name="cirujano" type="text" className={styles.input} placeholder="Apellido y nombre" value={form.cirujano} onChange={handleChange} list="cirujanos-sugeridos" required />
                      <datalist id="cirujanos-sugeridos">
                        {[...new Set(templates.map(t => getTemplateData(t).cirujano).filter(Boolean))].map(nombre => (
                          <option key={nombre} value={nombre} />
                        ))}
                      </datalist>
                    </div>
                  </Field>
                  <Field label="1er Ayudante" htmlFor="primerayudante" value={form.primerayudante}>
                    <input id="primerayudante" name="primerayudante" type="text" className={styles.input} placeholder="Dr./Dra." value={form.primerayudante} onChange={handleChange} />
                  </Field>
                  <Field label="2do Ayudante" htmlFor="segundoayudante" value={form.segundoayudante}>
                    <input id="segundoayudante" name="segundoayudante" type="text" className={styles.input} placeholder="Dr./Dra." value={form.segundoayudante} onChange={handleChange} />
                  </Field>
                  <Field label="Anestesista *" htmlFor="anestesista" value={form.anestesista}>
                    <input id="anestesista" name="anestesista" type="text" className={styles.input} placeholder="Dr./Dra." value={form.anestesista} onChange={handleChange} required />
                  </Field>
                </div>
              </section>

              <section className={styles.section}>
                <SectionHeader num="03" title="Fecha y Horarios" />
                <div className={styles.grid3}>
                  <Field label="Día *" htmlFor="dia" value={form.dia}>
                    <input id="dia" name="dia" type="number" min="1" max="31" className={styles.input} placeholder="DD" value={form.dia} onChange={handleChange} required />
                  </Field>
                  <Field label="Mes *" htmlFor="mes" value={form.mes}>
                    <select id="mes" name="mes" value={form.mes} onChange={handleChange} className={styles.select} required>
                      <option value="">— Mes —</option>
                      {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Año *" htmlFor="anio" value={form.anio}>
                    <input id="anio" name="anio" type="number" min="2000" max="2100" className={styles.input} placeholder="AAAA" value={form.anio} onChange={handleChange} required />
                  </Field>
                </div>
                <div className={styles.grid2} style={{ marginTop: "1.1rem" }}>
                  <Field label="Hora de Inicio *" htmlFor="inichsinicio" value={form.inichsinicio}>
                    <input id="inichsinicio" name="inichsinicio" type="time" className={styles.input} value={form.inichsinicio} onChange={handleChange} required />
                  </Field>
                  <Field label="Hora de Fin *" htmlFor="hsfin" value={form.hsfin}>
                    <input id="hsfin" name="hsfin" type="time" className={styles.input} value={form.hsfin} onChange={handleChange} required />
                  </Field>
                </div>
              </section>

              <section className={styles.section}>
                <SectionHeader num="04" title="Descripción Quirúrgica" />
                <p className={styles.sectionNote}>Solo los campos completados aparecerán en el PDF.</p>
                <Field label="1. Diagnóstico Preoperatorio *" htmlFor="preoperatorio" value={form.preoperatorio} full>
                  <textarea id="preoperatorio" name="preoperatorio" className={styles.textarea} rows={3} placeholder="Diagnóstico previo..." value={form.preoperatorio} onChange={handleChange} required />
                </Field>
                <Field label="2. Diagnóstico Posoperatorio" htmlFor="posoperatorio" value={form.posoperatorio} full>
                  <textarea id="posoperatorio" name="posoperatorio" className={styles.textarea} rows={3} placeholder="Diagnóstico posterior..." value={form.posoperatorio} onChange={handleChange} />
                </Field>
                <Field label="3. Procedimiento Quirúrgico *" htmlFor="procedimientoqx" value={form.procedimientoqx} full>
                  <textarea id="procedimientoqx" name="procedimientoqx" className={styles.textarea} rows={5} placeholder="Descripción del procedimiento..." value={form.procedimientoqx} onChange={handleChange} required />
                </Field>
                <Field label="4. Operación y Hallazgos" htmlFor="hallazgos" value={form.hallazgos} full>
                  <textarea id="hallazgos" name="hallazgos" className={styles.textarea} rows={4} placeholder="Hallazgos..." value={form.hallazgos} onChange={handleChange} />
                </Field>
              </section>

              <div className={styles.actions}>
                <button type="button" onClick={handleLimpiar} className={styles.btnSecondary} disabled={saveStatus === "saving"}>Limpiar</button>
                <button type="submit" className={styles.btnPrimary} disabled={saveStatus === "saving" || saveStatus === "saved"}>
                  {saveStatus === "saving" ? <><span className={styles.spinner} /> Guardando...</> : saveStatus === "saved" ? "✓ Guardado" : "Generar Foja"}
                </button>
              </div>

              <hr className={styles.divider} />
              <section className={`${styles.section} ${styles.templateSaveSection}`}>
                <SectionHeader num="💾" title="Guardar como plantilla (CX base)" />
                <p className={styles.sectionNote}>Se guardarán el cirujano y los cuatro campos de la descripción quirúrgica para reutilizar en futuras fojas.</p>
                <div className={styles.templateSaveGrid}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="templateName">Nombre de la plantilla</label>
                    <input id="templateName" name="templateName" type="text" className={styles.input} placeholder="Ej.: Apendicectomía convencional" value={templateName} onChange={(e) => setTemplateName(e.target.value)} maxLength={80} />
                  </div>
                  <button type="button" className={styles.btnPrimary} onClick={saveTemplate} disabled={savingTemplate}>
                    {savingTemplate ? <><span className={styles.spinner} /> Guardando...</> : "Guardar plantilla"}
                  </button>
                </div>
              </section>

              {(saveStatus === "error" || pdfStatus === "error" || errorMsg) && (
                <div className={styles.alertError}><span className={styles.alertIcon}>✕</span> {errorMsg}</div>
              )}

              {saveStatus === "saved" && pdfStatus === "done" && pdfUrl && (
                <div className={styles.successPanel}>
                  <div className={styles.successInfo}>
                    <span className={styles.successIcon}>✓</span>
                    <div>
                      <p className={styles.successTitle}>Registro guardado y PDF listo</p>
                      {savedKey && <p className={styles.successKey}>ID: {savedKey}</p>}
                    </div>
                  </div>
                  <div className={styles.buttonGroup}>
                    <button type="button" className={styles.btnSecondary} onClick={openPdf}>📄 Abrir</button>
                    <button type="button" className={styles.btnDownload} onClick={downloadPdf}><IconDownload /> Descargar</button>
                    <button type="button" className={styles.btnShare} onClick={handleSharePDF}><IconShare /> Compartir</button>
                  </div>
                </div>
              )}
            </form>
          </main>
        </div>
      )}

      {/* ── VISTA: FOJAS GUARDADAS ── */}
      {view === "guardadas" && (
        <div className={styles.guardadasContainer}>
          <h2 className={styles.guardadasTitle}>📂 Fojas Quirúrgicas Guardadas</h2>
          {loadingFojas ? (
            <p className={styles.loading}>Cargando fojas...</p>
          ) : fojasGuardadas.length === 0 ? (
            <div className={styles.emptyState}>
              <p>No hay fojas guardadas todavía.</p>
              <button className={styles.btnPrimary} onClick={() => setView("nueva")}>Crear primera foja</button>
            </div>
          ) : (
            <div className={styles.fojasGrid}>
              {fojasGuardadas.map((foja) => (
                <div key={foja.id} className={styles.fojaCard} onClick={() => cargarFojaEnFormulario(foja)}>
                  <div className={styles.fojaCardHeader}>
                    <span className={styles.fojaPaciente}>{foja.paciente?.apelidoynombre || "Sin nombre"}</span>
                    <span className={styles.fojaFecha}>
                      {foja.fecha?.dia}/{foja.fecha?.mes}/{foja.fecha?.anio}
                    </span>
                  </div>
                  <div className={styles.fojaDetalle}>
                    <p><strong>Cirujano:</strong> {foja.equipo?.cirujano || "—"}</p>
                    <p><strong>Procedimiento:</strong> {foja.descripcion?.procedimientoqx || "—"}</p>
                  </div>
                  <div className={styles.fojaId}>ID: {foja.id}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── VISTA: PLANTILLAS CX BASE ── */}
      {view === "plantillas" && (
        <div className={styles.plantillasContainer}>
          <div className={styles.plantillasHeader}>
            <h2 className={styles.guardadasTitle}>📋 Plantillas CX base</h2>
            <button className={styles.btnPrimary} onClick={() => setView("nueva")}>
              + Nueva plantilla
            </button>
          </div>

          {/* Buscador */}
          <div className={styles.searchWrapper}>
            <IconSearch />
            <input
              type="text"
              placeholder="Buscar por nombre de procedimiento o médico..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {loadingTemplates ? (
            <p className={styles.loading}>Cargando plantillas...</p>
          ) : filteredTemplates.length === 0 ? (
            <div className={styles.emptyState}>
              <p>{searchTerm ? "No se encontraron plantillas con ese criterio." : "No hay plantillas guardadas todavía."}</p>
              {!searchTerm && (
                <button className={styles.btnPrimary} onClick={() => setView("nueva")}>Crear primera plantilla</button>
              )}
            </div>
          ) : (
            <div className={styles.plantillasGrid}>
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={styles.plantillaCard}
                  onClick={() => handleSelectTemplate(template.id)}
                >
                  <div className={styles.plantillaCardTitle}>{template.name}</div>
                  <div className={styles.plantillaCardCirujano}>
                    {template.cirujano || "Sin cirujano asignado"}
                  </div>
                  <button
                    className={styles.btnSecondary}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectTemplate(template.id);
                    }}
                  >
                    Usar esta plantilla
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Subcomponentes (sin cambios) ──
function SectionHeader({ num, title }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.sectionNumber}>{num}</span>
      <h2 className={styles.sectionTitle}>{title}</h2>
    </div>
  );
}
function Field({ label, htmlFor, children, full, tooltip, value }) {
  const isValid = value && value.toString().trim() !== "";
  return (
    <div className={`${styles.field} ${full ? styles.fieldFull : ""}`}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={htmlFor}>{label}</label>
        {tooltip && <span className={styles.tooltip} data-tip={tooltip}>?</span>}
      </div>
      <div className={styles.inputWrapper}>
        {children}
        <span className={`${styles.statusIcon} ${isValid ? styles.valid : ""}`}>{isValid ? "✓" : "!"}</span>
      </div>
    </div>
  );
}
function TemplatePreview({ template }) {
  if (!template) return null;
  const data = getTemplateData(template);
  const surgeon = data.cirujano ? `${data.cirujanoTitulo} ${data.cirujano}`.trim() : "—";
  return (
    <div className={styles.templatePreview} aria-live="polite">
      <div className={styles.previewRow}><span>Cirujano:</span><p>{surgeon}</p></div>
      <div className={styles.previewRow}><span>Preoperatorio:</span><p>{data.preoperatorio || "—"}</p></div>
      <div className={styles.previewRow}><span>Posoperatorio:</span><p>{data.posoperatorio || "—"}</p></div>
      <div className={styles.previewRow}><span>Procedimiento:</span><p>{data.procedimientoqx || "—"}</p></div>
      <div className={styles.previewRow}><span>Hallazgos:</span><p>{data.hallazgos || "—"}</p></div>
    </div>
  );
}
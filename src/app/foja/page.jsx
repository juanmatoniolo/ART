"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, push, onValue } from "firebase/database";
import Header from "@/components/Header/Header";
import styles from "./fojaqx.module.css";

// ────────────────────────────────────────────── Constantes
const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const INITIAL_FORM = {
    apelidoynombre: "",
    edad: "",
    cirujanoTitulo: "Dr.",
    cirujano: "",
    primerayudante: "",
    segundoayudante: "",
    anestesista: "",
    dia: "",
    mes: "",
    anio: "",
    inichsinicio: "",
    hsfin: "",
    preoperatorio: "",
    posoperatorio: "",
    procedimientoqx: "",
    hallazgos: "",
};

// ────────────────────────────────────────────── Helpers
const getCirujanoCompleto = (form) => {
    const nombre = (form.cirujano || "").trim();
    const titulo = (form.cirujanoTitulo || "Dr.").trim();
    return nombre ? `${titulo} ${nombre}`.trim() : "";
};

const getTemplateData = (template) => {
    // Compatibilidad con plantillas anteriores que guardaban todo el formulario.
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

// Une los 4 campos de la descripción quirúrgica en un solo texto.
// Formato: "1- <preoperatorio>\n2- <posoperatorio>\n3- <procedimientoqx>\n4- <hallazgos>"
const buildCx = (form) => {
    const campos = [
        form.preoperatorio,
        form.posoperatorio,
        form.procedimientoqx,
        form.hallazgos,
    ];
    return campos
        .map((contenido, i) => `${i + 1}- ${(contenido || "").trim()}`)
        .join("\n");
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
    // Toda la descripción quirúrgica unificada en un único campo.
    cx: buildCx(form),
});

const buildFileName = (form) => {
    const apellido = form.apelidoynombre
        ? form.apelidoynombre.split(",")[0].trim().replace(/\s+/g, "_")
        : "foja";
    return `FojaQX_${apellido}_${form.dia}-${form.mes}-${form.anio}.pdf`;
};

// ────────────────────────────────────────────── Iconos (SVG)
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

// ────────────────────────────────────────────── Componente principal
export default function Foja() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [saveStatus, setSaveStatus] = useState("idle");
    const [pdfStatus, setPdfStatus] = useState("idle");
    const [savedKey, setSavedKey] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfFileName, setPdfFileName] = useState(null);
    const pdfUrlRef = useRef(null);

    // Estados para plantillas
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [templateName, setTemplateName] = useState("");
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(true);

    // Referencia a la base de datos para plantillas
    const plantillasRef = ref(db, "fojaqx/plantilla");

    // Scroll spy para progreso (opcional)
    const [activeSection, setActiveSection] = useState(null);
    const sectionRefs = useRef({});

    // Cargar plantillas desde Firebase al montar
    useEffect(() => {
        const unsubscribe = onValue(plantillasRef, (snapshot) => {
            const data = snapshot.val();
            const templatesList = [];
            if (data) {
                Object.keys(data).forEach((key) => {
                    templatesList.push({
                        id: key,
                        ...data[key],
                    });
                });
                templatesList.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            }
            setTemplates(templatesList);
            setLoadingTemplates(false);
        }, (error) => {
            console.error("Error cargando plantillas:", error);
            setErrorMsg("No se pudieron cargar las plantillas.");
            setLoadingTemplates(false);
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        return () => {
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
            // Se guarda la estructura del payload (con la descripción unificada en `cx`).
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

    // Guarda únicamente los datos reutilizables de una cirugía.
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
            console.error("[FOJA-QX] Error al guardar plantilla:", err);
            setErrorMsg(`Error al guardar la plantilla: ${err.message}`);
        } finally {
            setSavingTemplate(false);
        }
    };

    // Carga solo cirujano y descripción; conserva paciente, equipo, fecha y horarios.
    const loadTemplate = () => {
        if (!selectedTemplateId) {
            setErrorMsg("Seleccioná una plantilla para cargar.");
            return;
        }

        const template = templates.find((item) => item.id === selectedTemplateId);
        if (!template) {
            setErrorMsg("La plantilla seleccionada ya no está disponible.");
            return;
        }

        const templateData = getTemplateData(template);
        setForm((current) => ({
            ...current,
            ...templateData,
        }));

        resetPdfState();
        setSaveStatus("idle");
        setSavedKey(null);
        setErrorMsg(`Plantilla "${template.name}" cargada sin modificar los datos del paciente.`);
        setTimeout(() => setErrorMsg(""), 3500);
    };

    const openPdf = () => {
        if (pdfUrl) window.open(pdfUrl, "_blank");
    };

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
                await navigator.share({
                    title: "Foja Quirúrgica",
                    text: "Adjunto PDF de la foja quirúrgica",
                    files: [file],
                });
            } else {
                await navigator.clipboard.writeText(`Descargá el PDF aquí: ${pdfFileName}`);
                alert("Tu navegador no soporta compartir archivos. Se copió un mensaje al portapapeles.");
            }
        } catch (err) {
            if (err.name !== "AbortError") {
                setErrorMsg("No se pudo compartir el archivo.");
            }
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

    // Indicador de completitud por sección
    const isSectionComplete = (section) => {
        switch (section) {
            case "paciente":
                return form.apelidoynombre.trim() !== "" && form.edad !== "";
            case "equipo":
                return form.cirujano.trim() !== "" && form.anestesista.trim() !== "";
            case "fecha":
                return form.dia && form.mes && form.anio && form.inichsinicio && form.hsfin;
            case "descripcion":
                return form.preoperatorio.trim() !== "" && form.procedimientoqx.trim() !== "";
            default:
                return false;
        }
    };

    // Scroll al hacer clic en progreso (opcional)
    const scrollToSection = (sectionId) => {
        const el = sectionRefs.current[sectionId];
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <>
            <Header />
            <div className={styles.page}>
                <div className={styles.layout}>
                    {/* Barra lateral de progreso */}
                    <ProgressSidebar
                        sections={[
                            { id: "paciente", label: "Paciente" },
                            { id: "equipo", label: "Equipo" },
                            { id: "fecha", label: "Fecha y hora" },
                            { id: "descripcion", label: "Descripción" },
                        ]}
                        isComplete={isSectionComplete}
                        onNavigate={scrollToSection}
                    />

                    <main className={styles.mainContent}>
                        <header className={styles.header}>
                            <div className={styles.headerAccent} />
                            <div className={styles.headerContent}>
                                <span className={styles.headerTag}>Clínica de la Unión S.A.</span>
                                <h1 className={styles.title}>Foja Quirúrgica QX</h1>
                                <p className={styles.subtitle}>
                                    Completá el registro, guardalo en Firebase y descargá o compartí el PDF.
                                </p>
                            </div>
                        </header>

                        {/* Carga rápida de plantillas: permanece arriba del formulario. */}
                        <section className={`${styles.section} ${styles.templateLoader}`}>
                            <SectionHeader num="📋" title="Cargar plantilla quirúrgica" />
                            <p className={styles.sectionNote}>
                                La plantilla completa únicamente el cirujano y la descripción quirúrgica.
                                Los datos del paciente, fecha y horarios se conservan.
                            </p>

                            <div className={styles.templateLoadGrid}>
                                <div className={styles.field}>
                                    <label className={styles.label} htmlFor="templateSelect">
                                        Plantilla guardada
                                    </label>
                                    <select
                                        id="templateSelect"
                                        className={styles.select}
                                        value={selectedTemplateId}
                                        onChange={(event) => setSelectedTemplateId(event.target.value)}
                                        disabled={loadingTemplates}
                                    >
                                        <option value="">
                                            {loadingTemplates
                                                ? "Cargando plantillas..."
                                                : "-- Seleccionar plantilla --"}
                                        </option>
                                        {templates.map((template) => (
                                            <option key={template.id} value={template.id}>
                                                {template.name} ({template.cirujano || "Sin cirujano"})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <button
                                    type="button"
                                    className={styles.btnSecondary}
                                    onClick={loadTemplate}
                                    disabled={!selectedTemplateId || loadingTemplates}
                                >
                                    Cargar plantilla
                                </button>
                            </div>

                            {!loadingTemplates && templates.length === 0 && (
                                <small className={styles.hint}>
                                    Todavía no hay plantillas guardadas.
                                </small>
                            )}

                            {selectedTemplateId && (
                                <TemplatePreview
                                    template={templates.find(
                                        (template) => template.id === selectedTemplateId,
                                    )}
                                />
                            )}
                        </section>

                        <form onSubmit={handleGuardar} className={styles.form} autoComplete="on" noValidate>
                            {/* Sección 01 - Paciente */}
                            <section
                                className={styles.section}
                                ref={(el) => (sectionRefs.current.paciente = el)}
                            >
                                <SectionHeader num="01" title="Datos del Paciente" />
                                <div className={styles.grid2}>
                                    <Field
                                        label="Apellido y Nombre *"
                                        htmlFor="apelidoynombre"
                                        tooltip="Ingrese apellido y nombre completos del paciente"
                                        value={form.apelidoynombre}
                                        onChange={handleChange}
                                    >
                                        <input
                                            id="apelidoynombre"
                                            name="apelidoynombre"
                                            type="text"
                                            className={styles.input}
                                            placeholder="Apellido, Nombre completo"
                                            value={form.apelidoynombre}
                                            onChange={handleChange}
                                            autoComplete="name"
                                            required
                                        />
                                    </Field>
                                    <Field
                                        label="Edad *"
                                        htmlFor="edad"
                                        tooltip="Edad en años"
                                        value={form.edad}
                                        onChange={handleChange}
                                    >
                                        <input
                                            id="edad"
                                            name="edad"
                                            type="number"
                                            min="0"
                                            max="150"
                                            className={styles.input}
                                            placeholder="Años"
                                            value={form.edad}
                                            onChange={handleChange}
                                            autoComplete="on"
                                            inputMode="numeric"
                                            required
                                        />
                                    </Field>
                                </div>
                            </section>

                            {/* Sección 02 - Equipo */}
                            <section
                                className={styles.section}
                                ref={(el) => (sectionRefs.current.equipo = el)}
                            >
                                <SectionHeader num="02" title="Equipo Quirúrgico" />
                                <div className={styles.grid2}>
                                    <Field
                                        label="Cirujano *"
                                        htmlFor="cirujano"
                                        value={form.cirujano}
                                        onChange={handleChange}
                                    >
                                        <div className={styles.doctorField}>
                                            <select
                                                id="cirujanoTitulo"
                                                name="cirujanoTitulo"
                                                className={styles.doctorTitle}
                                                value={form.cirujanoTitulo}
                                                onChange={handleChange}
                                                aria-label="Tratamiento del cirujano"
                                            >
                                                <option value="Dr.">Dr.</option>
                                                <option value="Dra.">Dra.</option>
                                            </select>
                                            <input
                                                id="cirujano"
                                                name="cirujano"
                                                type="text"
                                                className={styles.input}
                                                placeholder="Apellido y nombre"
                                                value={form.cirujano}
                                                onChange={handleChange}
                                                autoComplete="on"
                                                list="cirujanos-sugeridos"
                                                required
                                            />
                                            <datalist id="cirujanos-sugeridos">
                                                {[...new Set(
                                                    templates
                                                        .map((template) => getTemplateData(template).cirujano)
                                                        .filter(Boolean),
                                                )].map((nombre) => (
                                                    <option key={nombre} value={nombre} />
                                                ))}
                                            </datalist>
                                        </div>
                                    </Field>
                                    <Field label="1er Ayudante" htmlFor="primerayudante" value={form.primerayudante} onChange={handleChange}>
                                        <input id="primerayudante" name="primerayudante" type="text" className={styles.input} placeholder="Dr./Dra." value={form.primerayudante} onChange={handleChange} autoComplete="on" />
                                    </Field>
                                    <Field label="2do Ayudante" htmlFor="segundoayudante" value={form.segundoayudante} onChange={handleChange}>
                                        <input id="segundoayudante" name="segundoayudante" type="text" className={styles.input} placeholder="Dr./Dra." value={form.segundoayudante} onChange={handleChange} autoComplete="on" />
                                    </Field>
                                    <Field label="Anestesista *" htmlFor="anestesista" value={form.anestesista} onChange={handleChange}>
                                        <input id="anestesista" name="anestesista" type="text" className={styles.input} placeholder="Dr./Dra." value={form.anestesista} onChange={handleChange} autoComplete="on" required />
                                    </Field>
                                </div>
                            </section>

                            {/* Sección 03 - Fecha y horarios */}
                            <section
                                className={styles.section}
                                ref={(el) => (sectionRefs.current.fecha = el)}
                            >
                                <SectionHeader num="03" title="Fecha y Horarios" />
                                <div className={styles.grid3}>
                                    <Field label="Día *" htmlFor="dia" value={form.dia} onChange={handleChange}>
                                        <input id="dia" name="dia" autoComplete="on" type="number" min="1" max="31" className={styles.input} placeholder="DD" value={form.dia} onChange={handleChange} required />
                                    </Field>
                                    <Field label="Mes *" htmlFor="mes" value={form.mes} onChange={handleChange}>
                                        <select id="mes" name="mes" autoComplete="on" value={form.mes} onChange={handleChange} className={styles.select} required>
                                            <option value="">— Mes —</option>
                                            {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </Field>
                                    <Field label="Año *" htmlFor="anio" value={form.anio} onChange={handleChange}>
                                        <input id="anio" name="anio" autoComplete="on" type="number" min="2000" max="2100" className={styles.input} placeholder="AAAA" value={form.anio} onChange={handleChange} required />
                                    </Field>
                                </div>
                                <div className={styles.grid2} style={{ marginTop: "1.1rem" }}>
                                    <Field label="Hora de Inicio *" htmlFor="inichsinicio" value={form.inichsinicio} onChange={handleChange}>
                                        <input id="inichsinicio" name="inichsinicio" autoComplete="on" type="time" className={styles.input} value={form.inichsinicio} onChange={handleChange} required />
                                    </Field>
                                    <Field label="Hora de Fin *" htmlFor="hsfin" value={form.hsfin} onChange={handleChange}>
                                        <input id="hsfin" name="hsfin" autoComplete="on" type="time" className={styles.input} value={form.hsfin} onChange={handleChange} required />
                                    </Field>
                                </div>
                            </section>

                            {/* Sección 04 - Descripción */}
                            <section
                                className={styles.section}
                                ref={(el) => (sectionRefs.current.descripcion = el)}
                            >
                                <SectionHeader num="04" title="Descripción Quirúrgica" />
                                <p className={styles.sectionNote}>
                                    Estos cuatro campos se combinan automáticamente en un único texto (numerado 1 a 4) al guardar.
                                </p>
                                <Field label="1. Diagnóstico Preoperatorio *" htmlFor="preoperatorio" value={form.preoperatorio} onChange={handleChange} full tooltip="Diagnóstico con el que el paciente ingresa a cirugía">
                                    <textarea id="preoperatorio" name="preoperatorio" autoComplete="on" value={form.preoperatorio} onChange={handleChange} className={styles.textarea} rows={3} placeholder="Diagnóstico previo a la cirugía..." required />
                                </Field>
                                <Field label="2. Diagnóstico Posoperatorio" htmlFor="posoperatorio" value={form.posoperatorio} onChange={handleChange} full tooltip="Diagnóstico confirmado después de la cirugía">
                                    <textarea id="posoperatorio" name="posoperatorio" autoComplete="on" value={form.posoperatorio} onChange={handleChange} className={styles.textarea} rows={3} placeholder="Diagnóstico posterior a la cirugía..." />
                                </Field>
                                <Field label="3. Procedimiento Quirúrgico *" htmlFor="procedimientoqx" value={form.procedimientoqx} onChange={handleChange} full tooltip="Describa detalladamente la técnica quirúrgica realizada">
                                    <textarea id="procedimientoqx" name="procedimientoqx" autoComplete="on" value={form.procedimientoqx} onChange={handleChange} className={styles.textarea} rows={5} placeholder="Descripción detallada del procedimiento..." required />
                                </Field>
                                <Field label="4. Operación y Hallazgos" htmlFor="hallazgos" value={form.hallazgos} onChange={handleChange} full tooltip="Hallazgos intraoperatorios relevantes">
                                    <textarea id="hallazgos" name="hallazgos" autoComplete="on" value={form.hallazgos} onChange={handleChange} className={styles.textarea} rows={4} placeholder="Hallazgos intraoperatorios..." />
                                </Field>
                            </section>

                            {/* Acciones principales */}
                            <div className={styles.actions}>
                                <button type="button" onClick={handleLimpiar} className={styles.btnSecondary} disabled={saveStatus === "saving"}>
                                    Limpiar
                                </button>
                                <button type="submit" className={styles.btnPrimary} disabled={saveStatus === "saving" || saveStatus === "saved"}>
                                    {saveStatus === "saving" ? (
                                        <><span className={styles.spinner} /> Guardando...</>
                                    ) : saveStatus === "saved" ? (
                                        "✓ Guardado"
                                    ) : (
                                        "Generar Foja"
                                    )}
                                </button>
                            </div>
                            <hr />
                            <section className={`${styles.section} ${styles.templateSaveSection}`}>
                                <SectionHeader num="💾" title="Guardar como plantilla" />
                                <p className={styles.sectionNote}>
                                    Se guardarán el cirujano y los cuatro campos de la descripción
                                    quirúrgica. No se guardan datos del paciente, ayudantes, anestesista,
                                    fecha ni horarios.
                                </p>

                                <div className={styles.templateSaveGrid}>
                                    <div className={styles.field}>
                                        <label className={styles.label} htmlFor="templateName">
                                            Nombre de la plantilla
                                        </label>
                                        <input
                                            id="templateName"
                                            name="templateName"
                                            type="text"
                                            autoComplete="on"
                                            className={styles.input}
                                            placeholder="Ej.: Apendicectomía convencional"
                                            value={templateName}
                                            onChange={(event) => setTemplateName(event.target.value)}
                                            maxLength={80}
                                        />
                                    </div>

                                    <button
                                        type="button"
                                        className={styles.btnPrimary}
                                        onClick={saveTemplate}
                                        disabled={savingTemplate}
                                    >
                                        {savingTemplate ? (
                                            <>
                                                <span className={styles.spinner} aria-hidden="true" />
                                                Guardando...
                                            </>
                                        ) : (
                                            "Guardar plantilla"
                                        )}
                                    </button>
                                </div>
                            </section>

                            {/* Alertas de error */}
                            {(saveStatus === "error" || pdfStatus === "error" || errorMsg) && (
                                <div className={styles.alertError}>
                                    <span className={styles.alertIcon}>✕</span>
                                    {errorMsg}
                                </div>
                            )}

                            {/* Panel de éxito con PDF listo */}
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
            </div>
        </>
    );
}

// ────────────────────────────────────────────── Subcomponentes nuevos/mejorados

function SectionHeader({ num, title }) {
    return (
        <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>{num}</span>
            <h2 className={styles.sectionTitle}>{title}</h2>
        </div>
    );
}

function Field({ label, htmlFor, children, full, tooltip, value, onChange }) {
    const isValid = value && value.toString().trim() !== "";
    return (
        <div className={`${styles.field} ${full ? styles.fieldFull : ""}`}>
            <div className={styles.labelRow}>
                <label className={styles.label} htmlFor={htmlFor}>
                    {label}
                </label>
                {tooltip && (
                    <span className={styles.tooltip} data-tip={tooltip}>
                        ?
                    </span>
                )}
            </div>
            <div className={styles.inputWrapper}>
                {children}
                <span className={`${styles.statusIcon} ${isValid ? styles.valid : ""}`}>
                    {isValid ? "✓" : "!"}
                </span>
            </div>
        </div>
    );
}

function ProgressSidebar({ sections, isComplete, onNavigate }) {
    const completedCount = sections.filter(s => isComplete(s.id)).length;
    const pct = Math.round((completedCount / sections.length) * 100);
    return (
        <aside className={styles.progressSidebar}>
            <div className={styles.progressHeader}>
                <span>Progreso</span>
                <span className={styles.progressCounter}>
                    {completedCount}/{sections.length}
                </span>
            </div>
            <div className={styles.progressBar}>
                <div className={styles.progressBarFill} style={{ width: `${pct}%` }} />
            </div>
            <div className={styles.progressList}>
                {sections.map((sec) => (
                    <button
                        key={sec.id}
                        className={`${styles.progressItem} ${isComplete(sec.id) ? styles.progressDone : ""}`}
                        onClick={() => onNavigate(sec.id)}
                        type="button"
                    >
                        <span className={styles.progressIcon}>
                            {isComplete(sec.id) ? "✅" : "⬜"}
                        </span>
                        <span>{sec.label}</span>
                    </button>
                ))}
            </div>
        </aside>
    );
}

function TemplatePreview({ template }) {
    if (!template) return null;

    const data = getTemplateData(template);
    const surgeon = data.cirujano
        ? `${data.cirujanoTitulo} ${data.cirujano}`.trim()
        : "—";

    return (
        <div className={styles.templatePreview} aria-live="polite">
            <div className={styles.previewRow}>
                <span>Cirujano:</span>
                <p>{surgeon}</p>
            </div>
            <div className={styles.previewRow}>
                <span>Preoperatorio:</span>
                <p>{data.preoperatorio || "—"}</p>
            </div>
            <div className={styles.previewRow}>
                <span>Posoperatorio:</span>
                <p>{data.posoperatorio || "—"}</p>
            </div>
            <div className={styles.previewRow}>
                <span>Procedimiento:</span>
                <p>{data.procedimientoqx || "—"}</p>
            </div>
            <div className={styles.previewRow}>
                <span>Hallazgos:</span>
                <p>{data.hallazgos || "—"}</p>
            </div>
        </div>
    );
}
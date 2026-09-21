"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, push, onValue } from "firebase/database";
import Header from "@/components/Header/Header";
import styles from "./fojaqx.module.css";

/* ───────────────────────────── Constantes ───────────────────────────── */
const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const THEME_KEY = "fojaqx_theme";

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
    anio: String(new Date().getFullYear()),
    inichsinicio: "",
    hsfin: "",
    preoperatorio: "",
    posoperatorio: "",
    procedimientoqx: "",
    hallazgos: "",
};

/* ───────────────────────────── Helpers ───────────────────────────── */
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

/* ───────────────────────────── Componente ───────────────────────────── */
export default function Foja() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [saveStatus, setSaveStatus] = useState("idle");
    const [pdfStatus, setPdfStatus] = useState("idle");
    const [savedKey, setSavedKey] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfFileName, setPdfFileName] = useState(null);
    const pdfUrlRef = useRef(null);

    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");
    const [templateName, setTemplateName] = useState("");
    const [savingTemplate, setSavingTemplate] = useState(false);
    const [loadingTemplates, setLoadingTemplates] = useState(true);
    const [showTemplateSaver, setShowTemplateSaver] = useState(false);

    /* Tema */
    const [theme, setTheme] = useState("dark");

    const plantillasRef = ref(db, "fojaqx/plantilla");

    /* ─── Aplicar tema al body (para que el fondo cubra toda la pantalla) ─── */
    const applyTheme = useCallback((t) => {
        const isLight = t === "light";
        document.body.classList.toggle("light-mode", isLight);
        document.body.style.backgroundColor = isLight ? "#f4f6f9" : "#121826";
        document.body.style.transition = "background-color 0.2s";
    }, []);

    useEffect(() => {
        const saved = localStorage.getItem(THEME_KEY) || "dark";
        setTheme(saved);
        applyTheme(saved);
        return () => {
            // Al salir, limpiamos el estilo del body
            document.body.style.backgroundColor = "";
            document.body.style.transition = "";
        };
    }, [applyTheme]);

    const toggleTheme = () => {
        const next = theme === "dark" ? "light" : "dark";
        setTheme(next);
        localStorage.setItem(THEME_KEY, next);
        applyTheme(next);
    };

    /* ─── Cargar plantillas ─── */
    useEffect(() => {
        const unsubscribe = onValue(
            plantillasRef,
            (snapshot) => {
                const data = snapshot.val();
                const list = [];
                if (data) {
                    Object.keys(data).forEach((key) => {
                        list.push({ id: key, ...data[key] });
                    });
                    list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                }
                setTemplates(list);
                setLoadingTemplates(false);
            },
            (error) => {
                console.error("Error cargando plantillas:", error);
                setErrorMsg("No se pudieron cargar las plantillas.");
                setLoadingTemplates(false);
            }
        );
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
            "preoperatorio", "procedimientoqx",
        ];
        const etiquetas = {
            apelidoynombre: "Apellido y nombre",
            edad: "Edad",
            cirujano: "Cirujano",
            anestesista: "Anestesista",
            dia: "Día",
            mes: "Mes",
            anio: "Año",
            inichsinicio: "Hora de inicio",
            hsfin: "Hora de fin",
            preoperatorio: "Diagnóstico preoperatorio",
            procedimientoqx: "Procedimiento quirúrgico",
        };

        for (const field of required) {
            if (!form[field]) {
                setErrorMsg(`Falta completar: ${etiquetas[field]}`);
                setSaveStatus("error");
                window.scrollTo({ top: 0, behavior: "smooth" });
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
        ].some((value) => (value || "").trim() !== "");

        if (!name) {
            setErrorMsg("Poné un nombre para la plantilla.");
            return;
        }
        if (!form.cirujano.trim() || !hasDescription) {
            setErrorMsg("Completá el cirujano y al menos un campo de descripción.");
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
            setShowTemplateSaver(false);
            setErrorMsg(`✅ Plantilla "${name}" guardada`);
            setTimeout(() => setErrorMsg(""), 3500);
        } catch (err) {
            setErrorMsg(`Error: ${err.message}`);
        } finally {
            setSavingTemplate(false);
        }
    };

    const toggleTemplate = (templateId) => {
        if (selectedTemplateId === templateId) {
            setSelectedTemplateId("");
            setErrorMsg("");
            return;
        }

        const template = templates.find((item) => item.id === templateId);
        if (!template) return;

        const data = getTemplateData(template);
        setForm((current) => ({ ...current, ...data }));
        setSelectedTemplateId(templateId);
        resetPdfState();
        setSaveStatus("idle");
        setSavedKey(null);
        setErrorMsg(`✅ Plantilla "${template.name}" aplicada`);
        setTimeout(() => setErrorMsg(""), 2500);
    };

    const openPdf = () => pdfUrl && window.open(pdfUrl, "_blank");

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
            const blob = await fetch(pdfUrl).then((r) => r.blob());
            const file = new File([blob], pdfFileName, { type: "application/pdf" });
            if (navigator.share) {
                await navigator.share({ title: "Foja Quirúrgica", files: [file] });
            } else {
                await navigator.clipboard.writeText(pdfFileName);
                alert("Tu navegador no permite compartir. Se copió el nombre del archivo.");
            }
        } catch (err) {
            if (err.name !== "AbortError") {
                setErrorMsg("No se pudo compartir el archivo.");
            }
        }
    };

    const handleLimpiar = () => {
        if (!window.confirm("¿Limpiar todo el formulario?")) return;
        setForm(INITIAL_FORM);
        setSaveStatus("idle");
        setPdfStatus("idle");
        setSavedKey(null);
        setErrorMsg("");
        setSelectedTemplateId("");
        resetPdfState();
    };

    const secciones = [
        {
            id: "paciente",
            label: "Paciente",
            ok: form.apelidoynombre.trim() !== "" && form.edad !== "",
        },
        {
            id: "equipo",
            label: "Equipo",
            ok: form.cirujano.trim() !== "" && form.anestesista.trim() !== "",
        },
        {
            id: "fecha",
            label: "Fecha y hora",
            ok: !!(form.dia && form.mes && form.anio && form.inichsinicio && form.hsfin),
        },
        {
            id: "descripcion",
            label: "Descripción",
            ok:
                form.preoperatorio.trim() !== "" &&
                form.procedimientoqx.trim() !== "",
        },
    ];
    const completadas = secciones.filter((s) => s.ok).length;
    const progreso = Math.round((completadas / secciones.length) * 100);

    return (
        <>
            <Header />

            <div className={`${styles.page} ${theme === "light" ? styles.lightMode : ""}`}>
                <div className={styles.shell}>
                    {/* Barra superior */}
                    <div className={styles.topBar}>
                        <div className={styles.topBarInfo}>
                            <h1 className={styles.topBarTitle}>Foja Quirúrgica</h1>
                            <p className={styles.topBarSub}>
                                {completadas} de {secciones.length} secciones listas
                            </p>
                        </div>
                        <div className={styles.topBarActions}>
                            <button
                                type="button"
                                className={styles.themeBtn}
                                onClick={toggleTheme}
                                title={theme === "dark" ? "Modo claro" : "Modo oscuro"}
                            >
                                {theme === "dark" ? "☀️" : "🌙"}
                            </button>
                            <div className={styles.progressRing}>
                                <svg viewBox="0 0 36 36" className={styles.progressSvg}>
                                    <path
                                        className={styles.progressBg}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                    <path
                                        className={styles.progressFg}
                                        strokeDasharray={`${progreso}, 100`}
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    />
                                </svg>
                                <span className={styles.progressPct}>{progreso}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Alerta global */}
                    {errorMsg && (
                        <div
                            className={
                                errorMsg.startsWith("✅") ? styles.alertOk : styles.alertError
                            }
                        >
                            {errorMsg}
                        </div>
                    )}

                    {/* Plantillas toggleables */}
                    {templates.length > 0 && (
                        <div className={styles.templateBar}>
                            <div className={styles.templateBarHeader}>
                                <span className={styles.templateBarLabel}>
                                    Plantillas rápidas
                                </span>
                                {selectedTemplateId && (
                                    <button
                                        type="button"
                                        className={styles.templateClearBtn}
                                        onClick={() => setSelectedTemplateId("")}
                                    >
                                        Deseleccionar
                                    </button>
                                )}
                            </div>
                            <div className={styles.templateChips}>
                                {templates.map((template) => {
                                    const active = selectedTemplateId === template.id;
                                    return (
                                        <button
                                            key={template.id}
                                            type="button"
                                            className={`${styles.templateChip} ${active ? styles.templateChipActive : ""
                                                }`}
                                            onClick={() => toggleTemplate(template.id)}
                                        >
                                            {active && <span className={styles.chipCheck}>✓</span>}
                                            <span className={styles.chipText}>{template.name}</span>
                                            {active && (
                                                <span className={styles.chipClose} aria-hidden="true">
                                                    ×
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedTemplateId && (
                                <p className={styles.templateBarHint}>
                                    Tocá la plantilla otra vez (o ×) para deseleccionar.
                                </p>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleGuardar} autoComplete="on" noValidate>
                        {/* 01 */}
                        <Section num="1" title="Paciente" done={secciones[0].ok}>
                            <Field
                                label="Apellido y nombre"
                                required
                                done={!!form.apelidoynombre.trim()}
                            >
                                <input
                                    name="apelidoynombre"
                                    type="text"
                                    className={styles.input}
                                    placeholder="Ej: Pérez, Juan"
                                    value={form.apelidoynombre}
                                    onChange={handleChange}
                                    autoComplete="name"
                                />
                            </Field>

                            <Field label="Edad" required done={!!form.edad}>
                                <input
                                    name="edad"
                                    type="number"
                                    inputMode="numeric"
                                    min="0"
                                    max="150"
                                    className={styles.input}
                                    placeholder="Años"
                                    value={form.edad}
                                    onChange={handleChange}
                                />
                            </Field>
                        </Section>

                        {/* 02 */}
                        <Section num="2" title="Equipo quirúrgico" done={secciones[1].ok}>
                            <Field label="Cirujano" required done={!!form.cirujano.trim()}>
                                <div className={styles.doctorRow}>
                                    <select
                                        name="cirujanoTitulo"
                                        className={styles.doctorTitle}
                                        value={form.cirujanoTitulo}
                                        onChange={handleChange}
                                    >
                                        <option value="Dr.">Dr.</option>
                                        <option value="Dra.">Dra.</option>
                                    </select>
                                    <input
                                        name="cirujano"
                                        type="text"
                                        className={styles.input}
                                        placeholder="Apellido y nombre"
                                        value={form.cirujano}
                                        onChange={handleChange}
                                        list="cirujanos-sugeridos"
                                    />
                                    <datalist id="cirujanos-sugeridos">
                                        {[
                                            ...new Set(
                                                templates
                                                    .map((t) => getTemplateData(t).cirujano)
                                                    .filter(Boolean)
                                            ),
                                        ].map((n) => (
                                            <option key={n} value={n} />
                                        ))}
                                    </datalist>
                                </div>
                            </Field>

                            <Field
                                label="Anestesista"
                                required
                                done={!!form.anestesista.trim()}
                            >
                                <input
                                    name="anestesista"
                                    type="text"
                                    className={styles.input}
                                    placeholder="Dr./Dra."
                                    value={form.anestesista}
                                    onChange={handleChange}
                                />
                            </Field>

                            <details className={styles.details}>
                                <summary className={styles.detailsSummary}>
                                    + Agregar ayudantes (opcional)
                                </summary>
                                <div className={styles.detailsBody}>
                                    <Field label="1er ayudante">
                                        <input
                                            name="primerayudante"
                                            type="text"
                                            className={styles.input}
                                            placeholder="Dr./Dra."
                                            value={form.primerayudante}
                                            onChange={handleChange}
                                        />
                                    </Field>
                                    <Field label="2do ayudante">
                                        <input
                                            name="segundoayudante"
                                            type="text"
                                            className={styles.input}
                                            placeholder="Dr./Dra."
                                            value={form.segundoayudante}
                                            onChange={handleChange}
                                        />
                                    </Field>
                                </div>
                            </details>
                        </Section>

                        {/* 03 */}
                        <Section num="3" title="Fecha y horario" done={secciones[2].ok}>
                            <div className={styles.grid3}>
                                <Field label="Día" required done={!!form.dia}>
                                    <input
                                        name="dia"
                                        type="number"
                                        inputMode="numeric"
                                        min="1"
                                        max="31"
                                        className={styles.input}
                                        placeholder="DD"
                                        value={form.dia}
                                        onChange={handleChange}
                                    />
                                </Field>

                                <Field label="Mes" required done={!!form.mes}>
                                    <select
                                        name="mes"
                                        className={styles.input}
                                        value={form.mes}
                                        onChange={handleChange}
                                    >
                                        <option value="">—</option>
                                        {MESES.map((m) => (
                                            <option key={m} value={m}>
                                                {m}
                                            </option>
                                        ))}
                                    </select>
                                </Field>

                                <Field label="Año" required done={!!form.anio}>
                                    <input
                                        name="anio"
                                        type="number"
                                        inputMode="numeric"
                                        min="2000"
                                        max="2100"
                                        className={styles.input}
                                        placeholder="AAAA"
                                        value={form.anio}
                                        onChange={handleChange}
                                    />
                                </Field>
                            </div>

                            <div className={styles.grid2} style={{ marginTop: 12 }}>
                                <Field label="Hora inicio" required done={!!form.inichsinicio}>
                                    <input
                                        name="inichsinicio"
                                        type="time"
                                        className={styles.input}
                                        value={form.inichsinicio}
                                        onChange={handleChange}
                                    />
                                </Field>
                                <Field label="Hora fin" required done={!!form.hsfin}>
                                    <input
                                        name="hsfin"
                                        type="time"
                                        className={styles.input}
                                        value={form.hsfin}
                                        onChange={handleChange}
                                    />
                                </Field>
                            </div>
                        </Section>

                        {/* 04 */}
                        <Section
                            num="4"
                            title="Descripción quirúrgica"
                            done={secciones[3].ok}
                        >
                            <Field
                                label="1. Diagnóstico preoperatorio"
                                required
                                done={!!form.preoperatorio.trim()}
                            >
                                <textarea
                                    name="preoperatorio"
                                    className={styles.textarea}
                                    rows={3}
                                    placeholder="Diagnóstico previo a la cirugía..."
                                    value={form.preoperatorio}
                                    onChange={handleChange}
                                />
                            </Field>

                            <Field
                                label="2. Diagnóstico posoperatorio"
                                done={!!form.posoperatorio.trim()}
                            >
                                <textarea
                                    name="posoperatorio"
                                    className={styles.textarea}
                                    rows={3}
                                    placeholder="Opcional"
                                    value={form.posoperatorio}
                                    onChange={handleChange}
                                />
                            </Field>

                            <Field
                                label="3. Procedimiento quirúrgico"
                                required
                                done={!!form.procedimientoqx.trim()}
                            >
                                <textarea
                                    name="procedimientoqx"
                                    className={styles.textarea}
                                    rows={5}
                                    placeholder="Descripción detallada de la técnica..."
                                    value={form.procedimientoqx}
                                    onChange={handleChange}
                                />
                            </Field>

                            <Field label="4. Hallazgos" done={!!form.hallazgos.trim()}>
                                <textarea
                                    name="hallazgos"
                                    className={styles.textarea}
                                    rows={4}
                                    placeholder="Opcional"
                                    value={form.hallazgos}
                                    onChange={handleChange}
                                />
                            </Field>
                        </Section>

                        {/* Guardar plantilla */}
                        <div className={styles.section}>
                            {!showTemplateSaver ? (
                                <button
                                    type="button"
                                    className={styles.btnLink}
                                    onClick={() => setShowTemplateSaver(true)}
                                >
                                    💾 Guardar como plantilla reutilizable
                                </button>
                            ) : (
                                <>
                                    <h3 className={styles.subTitle}>Guardar plantilla</h3>
                                    <p className={styles.hint}>
                                        Se guardan el cirujano y los 4 campos de descripción. No se
                                        guardan datos del paciente.
                                    </p>
                                    <div className={styles.templateSaveRow}>
                                        <input
                                            type="text"
                                            className={styles.input}
                                            placeholder="Nombre de la plantilla"
                                            value={templateName}
                                            onChange={(e) => setTemplateName(e.target.value)}
                                            maxLength={80}
                                        />
                                        <div className={styles.templateSaveActions}>
                                            <button
                                                type="button"
                                                className={styles.btnGhost}
                                                onClick={() => {
                                                    setShowTemplateSaver(false);
                                                    setTemplateName("");
                                                }}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.btnPrimary}
                                                onClick={saveTemplate}
                                                disabled={savingTemplate}
                                            >
                                                {savingTemplate ? "Guardando..." : "Guardar"}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Panel de éxito */}
                        {saveStatus === "saved" && pdfStatus === "done" && pdfUrl && (
                            <div className={styles.successPanel}>
                                <div className={styles.successIconBig}>✓</div>
                                <h3 className={styles.successTitle}>¡Foja guardada!</h3>
                                <p className={styles.successSub}>
                                    El PDF está listo para descargar o compartir
                                </p>
                                <div className={styles.successActions}>
                                    <button
                                        type="button"
                                        className={styles.btnSecondary}
                                        onClick={openPdf}
                                    >
                                        📄 Ver PDF
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.btnDownload}
                                        onClick={downloadPdf}
                                    >
                                        ⬇ Descargar
                                    </button>
                                    <button
                                        type="button"
                                        className={styles.btnShare}
                                        onClick={handleSharePDF}
                                    >
                                        📤 Compartir
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className={styles.bottomSpacer} />

                        {/* Sticky footer */}
                        <div className={styles.stickyFooter}>
                            <button
                                type="button"
                                className={styles.btnGhost}
                                onClick={handleLimpiar}
                                disabled={saveStatus === "saving"}
                            >
                                Limpiar
                            </button>
                            <button
                                type="submit"
                                className={styles.btnPrimary}
                                disabled={saveStatus === "saving"}
                            >
                                {saveStatus === "saving" ? (
                                    <>
                                        <span className={styles.spinner} /> Guardando...
                                    </>
                                ) : saveStatus === "saved" ? (
                                    "✓ Guardado"
                                ) : (
                                    "Guardar y generar PDF"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

/* ───────────────────────────── Subcomponentes ───────────────────────────── */

function Section({ num, title, done, children }) {
    return (
        <section className={styles.section}>
            <div className={styles.sectionHeader}>
                <span
                    className={`${styles.sectionNum} ${done ? styles.sectionNumDone : ""}`}
                >
                    {done ? "✓" : num}
                </span>
                <h2 className={styles.sectionTitle}>{title}</h2>
            </div>
            <div className={styles.sectionBody}>{children}</div>
        </section>
    );
}

function Field({ label, required, done, children }) {
    return (
        <div className={styles.field}>
            <label className={styles.label}>
                {label}
                {required && <span className={styles.required}> *</span>}
                {done && <span className={styles.checkInline}> ✓</span>}
            </label>
            {children}
        </div>
    );
}
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, push } from "firebase/database";
import Header from "@/components/Header/Header";
import styles from "./foja.module.css";

// ────────────────────────────────────────────── Constantes
const MESES = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const INITIAL_FORM = {
    apelidoynombre: "",
    edad: "",
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
const buildPayload = (form) => ({
    paciente: {
        apelidoynombre: form.apelidoynombre,
        edad: form.edad,
    },
    equipo: {
        cirujano: form.cirujano,
        primerayudante: form.primerayudante,
        segundoayudante: form.segundoayudante,
        anestesista: form.anestesista,
    },
    fecha: {
        dia: form.dia,
        mes: form.mes,
        anio: form.anio,
    },
    horario: {
        inicio: form.inichsinicio,
        fin: form.hsfin,
    },
    descripcion: {
        preoperatorio: form.preoperatorio,
        posoperatorio: form.posoperatorio,
        procedimientoqx: form.procedimientoqx,
        hallazgos: form.hallazgos,
    },
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
export default function FojaQXPage() {
    const [form, setForm] = useState(INITIAL_FORM);
    const [saveStatus, setSaveStatus] = useState("idle"); // idle | saving | saved | error
    const [pdfStatus, setPdfStatus] = useState("idle");   // idle | loading | done | error
    const [savedKey, setSavedKey] = useState(null);
    const [errorMsg, setErrorMsg] = useState("");
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfFileName, setPdfFileName] = useState(null);
    const pdfUrlRef = useRef(null);

    // Limpiar URL al desmontar o cuando cambia
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

        // Validación rápida de campos obligatorios
        const required = ["apelidoynombre", "edad", "cirujano", "anestesista", "dia", "mes", "anio", "inichsinicio", "hsfin", "preoperatorio", "procedimientoqx"];
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
                ...form,
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

    return (
        <>
            <Header />
            <div className={styles.page}>
                <div className={styles.container}>
                    <header className={styles.header}>
                        <div className={styles.headerAccent} />
                        <div className={styles.headerContent}>
                            <span className={styles.headerTag}>Clínica de la Unión S.A.</span>
                            <h1 className={styles.title}>Foja Quirúrgica QX</h1>
                            <p className={styles.subtitle}>Completá el registro, guardalo en Firebase y descargá o compartí el PDF.</p>
                        </div>
                    </header>

                    <form onSubmit={handleGuardar} className={styles.form} noValidate>
                        {/* Sección 01 - Paciente */}
                        <section className={styles.section}>
                            <SectionHeader num="01" title="Datos del Paciente" />
                            <div className={styles.grid2}>
                                <div className={styles.fieldFull}>
                                    <label className={styles.label} htmlFor="apelidoynombre">Apellido y Nombre *</label>
                                    <input id="apelidoynombre" name="apelidoynombre" type="text" value={form.apelidoynombre} onChange={handleChange} className={styles.input} placeholder="Apellido, Nombre completo" required />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label} htmlFor="edad">Edad *</label>
                                    <input id="edad" name="edad" type="number" min="0" max="150" value={form.edad} onChange={handleChange} className={styles.input} placeholder="Años" required />
                                </div>
                            </div>
                        </section>

                        {/* Sección 02 - Equipo */}
                        <section className={styles.section}>
                            <SectionHeader num="02" title="Equipo Quirúrgico" />
                            <div className={styles.grid2}>
                                <Field label="Cirujano *" htmlFor="cirujano">
                                    <input id="cirujano" name="cirujano" type="text" value={form.cirujano} onChange={handleChange} className={styles.input} placeholder="Dr./Dra." required />
                                </Field>
                                <Field label="1er Ayudante" htmlFor="primerayudante">
                                    <input id="primerayudante" name="primerayudante" type="text" value={form.primerayudante} onChange={handleChange} className={styles.input} placeholder="Dr./Dra." />
                                </Field>
                                <Field label="2do Ayudante" htmlFor="segundoayudante">
                                    <input id="segundoayudante" name="segundoayudante" type="text" value={form.segundoayudante} onChange={handleChange} className={styles.input} placeholder="Dr./Dra." />
                                </Field>
                                <Field label="Anestesista *" htmlFor="anestesista">
                                    <input id="anestesista" name="anestesista" type="text" value={form.anestesista} onChange={handleChange} className={styles.input} placeholder="Dr./Dra." required />
                                </Field>
                            </div>
                        </section>

                        {/* Sección 03 - Fecha y horarios */}
                        <section className={styles.section}>
                            <SectionHeader num="03" title="Fecha y Horarios" />
                            <div className={styles.grid3}>
                                <Field label="Día *" htmlFor="dia">
                                    <input id="dia" name="dia" type="number" min="1" max="31" value={form.dia} onChange={handleChange} className={styles.input} placeholder="DD" required />
                                </Field>
                                <Field label="Mes *" htmlFor="mes">
                                    <select id="mes" name="mes" value={form.mes} onChange={handleChange} className={styles.select} required>
                                        <option value="">— Mes —</option>
                                        {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                </Field>
                                <Field label="Año *" htmlFor="anio">
                                    <input id="anio" name="anio" type="number" min="2000" max="2100" value={form.anio} onChange={handleChange} className={styles.input} placeholder="AAAA" required />
                                </Field>
                            </div>
                            <div className={styles.grid2} style={{ marginTop: "1.1rem" }}>
                                <Field label="Hora de Inicio *" htmlFor="inichsinicio">
                                    <input id="inichsinicio" name="inichsinicio" type="time" value={form.inichsinicio} onChange={handleChange} className={styles.input} required />
                                </Field>
                                <Field label="Hora de Fin *" htmlFor="hsfin">
                                    <input id="hsfin" name="hsfin" type="time" value={form.hsfin} onChange={handleChange} className={styles.input} required />
                                </Field>
                            </div>
                        </section>

                        {/* Sección 04 - Descripción */}
                        <section className={styles.section}>
                            <SectionHeader num="04" title="Descripción Quirúrgica" />
                            <Field label="1. Diagnóstico Preoperatorio *" htmlFor="preoperatorio" full>
                                <textarea id="preoperatorio" name="preoperatorio" value={form.preoperatorio} onChange={handleChange} className={styles.textarea} rows={3} placeholder="Diagnóstico previo a la cirugía..." required />
                            </Field>
                            <Field label="2. Diagnóstico Posoperatorio" htmlFor="posoperatorio" full>
                                <textarea id="posoperatorio" name="posoperatorio" value={form.posoperatorio} onChange={handleChange} className={styles.textarea} rows={3} placeholder="Diagnóstico posterior a la cirugía..." />
                            </Field>
                            <Field label="3. Procedimiento Quirúrgico *" htmlFor="procedimientoqx" full>
                                <textarea id="procedimientoqx" name="procedimientoqx" value={form.procedimientoqx} onChange={handleChange} className={styles.textarea} rows={5} placeholder="Descripción detallada del procedimiento..." required />
                            </Field>
                            <Field label="4. Operación y Hallazgos" htmlFor="hallazgos" full>
                                <textarea id="hallazgos" name="hallazgos" value={form.hallazgos} onChange={handleChange} className={styles.textarea} rows={4} placeholder="Hallazgos intraoperatorios..." />
                            </Field>
                        </section>

                        {/* Alertas de error */}
                        {(saveStatus === "error" || pdfStatus === "error") && (
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
                                    "Guardar Registro"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </>
    );
}

// ────────────────────────────────────────────── Subcomponentes
function SectionHeader({ num, title }) {
    return (
        <div className={styles.sectionHeader}>
            <span className={styles.sectionNumber}>{num}</span>
            <h2 className={styles.sectionTitle}>{title}</h2>
        </div>
    );
}

function Field({ label, htmlFor, children, full }) {
    return (
        <div className={full ? styles.fieldFull : styles.field}>
            <label className={styles.label} htmlFor={htmlFor}>{label}</label>
            {children}
        </div>
    );
}
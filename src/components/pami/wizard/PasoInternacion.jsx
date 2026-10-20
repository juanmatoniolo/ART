"use client";
import { useState } from "react";
import { getSession } from "@/utils/session";
import { onlyDigits, formatIdField, getPdfPages } from "@/app/ingresos/helpers";
import { guardarInternacionPami } from "@/lib/pami/internaciones";
import { db } from "@/lib/firebase";
import { ref, update } from "firebase/database";
import styles from "./PasoEvento.module.css";

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

function Campo({ label, error, children }) {
    return (
        <label className={styles.campo}>
            <span>{label}</span>
            {children}
            {error && <div className={styles.errorText}>{error}</div>}
        </label>
    );
}

export default function PasoInternacion({ estado, actualizar, avanzar, volver }) {
    const paciente = estado.paciente || {};
    const op = estado.op || {};

    const [form, setForm] = useState({
        tipoIngreso: "PISO",
        camaNumero: "",
        camaLetra: "",
        medicoSolicitante: paciente.medicoSolicitante || "",
        diagnostico: op.diagnostico || "",
        fechaDia: new Date().getDate().toString().padStart(2, "0"),
        fechaMes: (new Date().getMonth() + 1).toString().padStart(2, "0"),
        fechaAnio: new Date().getFullYear().toString(),
    });

    const [saving, setSaving] = useState(false);
    const [resultado, setResultado] = useState(estado.internacion || null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [generandoPdf, setGenerandoPdf] = useState(false);

    const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const guardar = async () => {
        if (!form.diagnostico) return alert("El diagnóstico es obligatorio.");

        setSaving(true);
        try {
            const res = await guardarInternacionPami({
                pacienteDni: paciente.dni,
                pacienteData: paciente,
                opId: op.id,
                opData: op,
                form: {
                    tipoIngreso: form.tipoIngreso,
                    camaNumero: form.camaNumero,
                    camaLetra: form.camaLetra,
                    medicoSolicitante: form.medicoSolicitante,
                    diagnostico: form.diagnostico,
                    diaIngreso: form.fechaDia,
                    mesIngreso: form.fechaMes,
                    anioIngreso: form.fechaAnio,
                    trabajadorApellido: paciente.apellido,
                    trabajadorNombre: paciente.nombre,
                    trabajadorDni: paciente.dni,
                    trabajadorNacimiento: paciente.fechaNacimiento,
                    trabajadorSexo: paciente.sexo,
                    trabajadorTelefono: paciente.telefono,
                    trabajadorCalle: paciente.domicilio,
                    trabajadorLocalidad: paciente.localidad,
                    trabajadorProvincia: paciente.provincia,
                    OS: "PAMI",
                    afiliadoPaciente: paciente.afiliado,
                    historiaClinica: paciente.historiaClinica,
                    familiarNombre: paciente.familiar?.nombre || "",
                    familiarParentezco: paciente.familiar?.parentezco || "",
                    familiarTelefono: paciente.familiar?.telefono || "",
                },
                oncoplan: !!paciente.oncoplan,
                usuario: usuarioActual(),
            });
            setResultado(res);
            actualizar({ internacion: res });
        } catch (err) {
            console.error(err);
            alert("Error al guardar la internación: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const generarPDF = async () => {
        if (!resultado?.payload) return;
        setGenerandoPdf(true);
        try {
            const res = await fetch("/api/ingresos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload: resultado.payload,
                    fileName: `INT_${paciente.apellido}_${paciente.dni}.pdf`,
                    pages: getPdfPages(resultado.tipoIngreso || "PISO"),
                }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            setPdfUrl(URL.createObjectURL(blob));
        } catch (err) {
            console.error(err);
            alert("No se pudo generar el PDF: " + err.message);
        } finally {
            setGenerandoPdf(false);
        }
    };

    if (resultado) {
        return (
            <div className={styles.paso}>
                <h2 className={styles.titulo}>✅ Internación guardada</h2>
                <p className={styles.hint}>El ingreso se registró correctamente y se vinculó a la OP.</p>

                <div className={styles.pdfBox}>
                    <div>
                        <strong>Documentos de la internación</strong>
                        <p className={styles.hint}>Se imprimen las hojas correspondientes a {resultado.tipoIngreso}.</p>
                    </div>
                    <div className={styles.actions}>
                        <button type="button" className={styles.btnPrimary} onClick={generarPDF} disabled={generandoPdf}>
                            {generandoPdf ? "Generando…" : "🖨️ Generar PDF"}
                        </button>
                        {pdfUrl && (
                            <>
                                <a className={styles.btnSecondary} href={pdfUrl} target="_blank" rel="noopener noreferrer">📂 Abrir</a>
                                <a className={styles.btnSecondary} href={pdfUrl} download>⬇️ Descargar</a>
                            </>
                        )}
                    </div>
                </div>

                <div className={styles.actions}>
                    <button type="button" className={styles.btnPrimary} onClick={avanzar}>Continuar →</button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.paso}>
            <h2 className={styles.titulo}>Internación</h2>
            <p className={styles.hint}>Completá los datos de la cama y el diagnóstico para generar el documento oficial.</p>

            <fieldset className={styles.fieldset}>
                <legend>Tipo de internación</legend>
                <div className={styles.chips}>
                    {[["PISO", "PISO"], ["UTI", "UTI (Terapia)"]].map(([v, l]) => (
                        <label key={v} className={`${styles.chip} ${form.tipoIngreso === v ? styles.chipActive : ""}`}>
                            <input type="radio" name="tipoIngreso" value={v} checked={form.tipoIngreso === v} onChange={onChange("tipoIngreso")} />
                            {l}
                        </label>
                    ))}
                </div>
            </fieldset>

            <div className={styles.row2}>
                <Campo label="N° de Cama">
                    <input className={styles.input} value={form.camaNumero} onChange={onChange("camaNumero")} placeholder="Ej: 12" />
                </Campo>
                {form.tipoIngreso === "PISO" && (
                    <Campo label="Letra (opcional)">
                        <input className={styles.input} value={form.camaLetra} onChange={onChange("camaLetra")} placeholder="A" maxLength={2} />
                    </Campo>
                )}
            </div>

            <Campo label="Médico solicitante">
                <input className={styles.input} value={form.medicoSolicitante} onChange={onChange("medicoSolicitante")} />
            </Campo>

            <Campo label="Diagnóstico de Ingreso *">
                <input className={styles.input} value={form.diagnostico} onChange={onChange("diagnostico")} />
            </Campo>

            <div className={styles.row3}>
                <Campo label="Día"><input className={styles.input} value={form.fechaDia} onChange={onChange("fechaDia")} /></Campo>
                <Campo label="Mes"><input className={styles.input} value={form.fechaMes} onChange={onChange("fechaMes")} /></Campo>
                <Campo label="Año"><input className={styles.input} value={form.fechaAnio} onChange={onChange("fechaAnio")} /></Campo>
            </div>

            <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={volver}>← Atrás</button>
                <button type="button" className={styles.btnPrimary} onClick={guardar} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar internación"}
                </button>
            </div>
        </div>
    );
}

PasoInternacion.hideShellNav = true;
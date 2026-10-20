"use client";
import { useState } from "react";
import { getSession } from "@/utils/session";
import { guardarCirugiaPami } from "@/lib/pami/cirugias";
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

export default function PasoCirugia({ estado, actualizar, avanzar, volver }) {
    const paciente = estado.paciente || {};
    const op = estado.op || {};

    const [form, setForm] = useState({
        procedimiento: op.diagnostico || "",
        doctor: paciente.cirujano || "",
        fechaCirugia: new Date().toISOString().slice(0, 10),
        diagnostico: op.diagnostico || "",
    });

    const [saving, setSaving] = useState(false);
    const [resultado, setResultado] = useState(estado.cirugia || null);
    const [pdfFrente, setPdfFrente] = useState(null);
    const [pdfDorso, setPdfDorso] = useState(null);
    const [generandoPdf, setGenerandoPdf] = useState(false);

    const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const guardar = async () => {
        if (!form.diagnostico || !form.procedimiento) return alert("Completá el diagnóstico y procedimiento.");

        setSaving(true);
        try {
            const res = await guardarCirugiaPami({
                pacienteDni: paciente.dni,
                pacienteData: paciente,
                opId: op.id,
                grupoMedico: { cirujano: form.doctor, ayudante1: paciente.ayudante1, ayudante2: paciente.ayudante2, anestesista: paciente.anestesista },
                form: {
                    tipoIngreso: "CIRUGIA",
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
                    diaCirugia: form.fechaCirugia.split("-")[2],
                    mesCirugia: form.fechaCirugia.split("-")[1],
                    anioCirugia: form.fechaCirugia.split("-")[0],
                    medicoSolicitante: form.doctor,
                    diagnostico: form.diagnostico,
                },
                oncoplan: !!paciente.oncoplan,
                usuario: usuarioActual(),
            });
            setResultado(res);
            actualizar({ cirugia: res });
        } catch (err) {
            console.error(err);
            alert("Error al guardar la cirugía: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const generarPDF = async (tipo) => {
        if (!resultado?.payload) return;
        setGenerandoPdf(true);
        try {
            // Estructura de payload para tu API /api/cx
            const payload = {
                pacienteDatos: {
                    apellido: paciente.apellido,
                    nombre: paciente.nombre,
                    dni: paciente.dni,
                    afiliado: paciente.afiliado,
                    sexo: paciente.sexo,
                    fechaNacimiento: paciente.fechaNacimiento,
                    telefono: paciente.telefono,
                    domicilio: paciente.domicilio,
                    localidad: paciente.localidad,
                    provincia: paciente.provincia,
                },
                familiar: paciente.familiar || {},
                formulario: {
                    "nombre-cirugia": form.procedimiento,
                    "doctor-cirujano": form.doctor,
                    "diagnostico-paciente": form.diagnostico,
                },
                fechaEstimada: form.fechaCirugia,
                servicio: "PISO",
                type: tipo,
                fileName: `CX_${paciente.apellido}_${paciente.dni}_${tipo}.pdf`,
            };

            const res = await fetch("/api/cx", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload, type: tipo, fileName: payload.fileName }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            if (tipo === "Frente") setPdfFrente(url);
            if (tipo === "Dorso") setPdfDorso(url);
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
                <h2 className={styles.titulo}>✅ Cirugía guardada</h2>
                <p className={styles.hint}>La cirugía se registró y se vinculó a la OP.</p>

                <div className={styles.pdfBox}>
                    <div>
                        <strong>Documentos de la cirugía</strong>
                        <p className={styles.hint}>Generá el frente y dorso para imprimir.</p>
                    </div>
                    <div className={styles.actions}>
                        <button type="button" className={styles.btnPrimary} onClick={() => generarPDF("Frente")} disabled={generandoPdf}>
                            {generandoPdf ? "Generando…" : "🖨️ Generar Frente"}
                        </button>
                        {pdfFrente && (
                            <>
                                <a className={styles.btnSecondary} href={pdfFrente} target="_blank" rel="noopener noreferrer">📂 Abrir Frente</a>
                                <a className={styles.btnSecondary} href={pdfFrente} download>⬇️ Descargar Frente</a>
                            </>
                        )}
                    </div>
                    <div className={styles.actions} style={{ marginTop: "1rem" }}>
                        <button type="button" className={styles.btnPrimary} onClick={() => generarPDF("Dorso")} disabled={generandoPdf}>
                            {generandoPdf ? "Generando…" : "🖨️ Generar Dorso"}
                        </button>
                        {pdfDorso && (
                            <>
                                <a className={styles.btnSecondary} href={pdfDorso} target="_blank" rel="noopener noreferrer">📂 Abrir Dorso</a>
                                <a className={styles.btnSecondary} href={pdfDorso} download>⬇️ Descargar Dorso</a>
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
            <h2 className={styles.titulo}>Cirugía</h2>
            <p className={styles.hint}>Completá los detalles del procedimiento quirúrgico.</p>

            <Campo label="Procedimiento / Cirugía *">
                <input className={styles.input} value={form.procedimiento} onChange={onChange("procedimiento")} />
            </Campo>

            <Campo label="Diagnóstico *">
                <input className={styles.input} value={form.diagnostico} onChange={onChange("diagnostico")} />
            </Campo>

            <div className={styles.row2}>
                <Campo label="Cirujano">
                    <input className={styles.input} value={form.doctor} onChange={onChange("doctor")} />
                </Campo>
                <Campo label="Fecha de Cirugía">
                    <input className={styles.input} type="date" value={form.fechaCirugia} onChange={onChange("fechaCirugia")} />
                </Campo>
            </div>

            <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={volver}>← Atrás</button>
                <button type="button" className={styles.btnPrimary} onClick={guardar} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar cirugía"}
                </button>
            </div>
        </div>
    );
}

PasoCirugia.hideShellNav = true;
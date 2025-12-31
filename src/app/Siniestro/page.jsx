"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Siniestro.module.css";

import { db } from "@/lib/firebase";
import { push, ref, set } from "firebase/database";

const STORAGE_KEY = "siniestro_form_draft_v1";

const initialForm = {
    ART: "",
    nroSiniestro: "",

    empleadorNombre: "",
    empleadorCuit: "",

    trabajadorApellido: "",
    trabajadorNombre: "",
    trabajadorDni: "",
    trabajadorNacimiento: "",
    trabajadorSexo: "",

    trabajadorCalle: "",
    trabajadorNumero: "",
    trabajadorPiso: "",
    trabajadorDepto: "",

    trabajadorLocalidad: "",
    trabajadorProvincia: "",
    trabajadorCP: "",
    trabajadorTelefono: "",

    // ✅ Motivo de consulta (solo contingencia)
    consultaTipo: "", // AT | AIT | EP | INT
};

function onlyDigits(s) {
    return (s ?? "").toString().replace(/\D/g, "");
}

function validate(form) {
    const e = {};

    if (!form.ART.trim()) e.ART = "ART requerida";

    if (!form.empleadorNombre.trim()) e.empleadorNombre = "Nombre de empresa requerido";
    const cuit = onlyDigits(form.empleadorCuit);
    if (!cuit) e.empleadorCuit = "CUIT requerido";
    if (cuit && cuit.length !== 11) e.empleadorCuit = "CUIT inválido (11 dígitos)";

    if (!form.trabajadorApellido.trim()) e.trabajadorApellido = "Apellido requerido";
    if (!form.trabajadorNombre.trim()) e.trabajadorNombre = "Nombre requerido";

    const dni = onlyDigits(form.trabajadorDni);
    if (!dni) e.trabajadorDni = "DNI requerido";
    if (dni && (dni.length < 7 || dni.length > 9)) e.trabajadorDni = "DNI inválido (7 a 9 dígitos)";

    if (!form.trabajadorNacimiento) e.trabajadorNacimiento = "Fecha de nacimiento requerida";
    if (!form.trabajadorSexo) e.trabajadorSexo = "Seleccioná sexo";

    if (!form.trabajadorCalle.trim()) e.trabajadorCalle = "Calle requerida";
    if (!form.trabajadorNumero.trim()) e.trabajadorNumero = "Número requerido";
    if (!form.trabajadorLocalidad.trim()) e.trabajadorLocalidad = "Localidad requerida";
    if (!form.trabajadorProvincia.trim()) e.trabajadorProvincia = "Provincia requerida";

    const tel = onlyDigits(form.trabajadorTelefono);
    if (!tel) e.trabajadorTelefono = "Teléfono requerido";
    if (tel && tel.length < 8) e.trabajadorTelefono = "Teléfono inválido";

    if (!form.consultaTipo) e.consultaTipo = "Seleccioná tipo de contingencia";

    return e;
}

function openAndPrintPdf(blob) {
    const url = URL.createObjectURL(blob);
    const w = window.open(url, "_blank", "noopener,noreferrer");
    if (!w) {
        alert("Popups bloqueados. Permití popups para imprimir.");
        return;
    }
    const timer = setInterval(() => {
        try {
            if (w.document?.readyState === "complete") {
                clearInterval(timer);
                w.focus();
                w.print();
                setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }
        } catch {
            clearInterval(timer);
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        }
    }, 300);
}

function safeMergeDraft(draft) {
    // ✅ solo dejamos keys conocidas para evitar basura/typos
    const out = { ...initialForm };
    if (!draft || typeof draft !== "object") return out;

    for (const k of Object.keys(initialForm)) {
        if (draft[k] != null) out[k] = String(draft[k]);
    }
    return out;
}

export default function SiniestroPage() {
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [createdId, setCreatedId] = useState(null);

    const submittingRef = useRef(false);

    // ✅ Restore draft al montar
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            setForm(safeMergeDraft(parsed));
        } catch {
            // si está roto, lo ignoramos
        }
    }, []);

    // ✅ Persist draft con debounce
    useEffect(() => {
        const t = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
            } catch {
                // sin acción
            }
        }, 250); // debounce cortito
        return () => clearTimeout(t);
    }, [form]);

    const canSubmit = useMemo(() => !saving, [saving]);
    const onChange = (key) => (e) =>
        setForm((p) => ({ ...p, [key]: e.target.value }));

    function clearDraftAndReset() {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch { }
        setForm(initialForm);
        setErrors({});
        setCreatedId(null);
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (submittingRef.current) return;
        submittingRef.current = true;

        setCreatedId(null);

        const v = validate(form);
        setErrors(v);
        if (Object.keys(v).length) {
            submittingRef.current = false;
            return;
        }

        setSaving(true);

        try {
            const payload = {
                ART: { nombre: form.ART.trim(), nroSiniestro: form.nroSiniestro.trim() },
                empleador: {
                    nombre: form.empleadorNombre.trim(),
                    cuit: onlyDigits(form.empleadorCuit),
                },
                trabajador: {
                    apellido: form.trabajadorApellido.trim(),
                    nombre: form.trabajadorNombre.trim(),
                    dni: onlyDigits(form.trabajadorDni),
                    nacimiento: form.trabajadorNacimiento,
                    sexo: form.trabajadorSexo,
                    calle: form.trabajadorCalle.trim(),
                    numero: form.trabajadorNumero.trim(),
                    piso: form.trabajadorPiso.trim(),
                    depto: form.trabajadorDepto.trim(),
                    localidad: form.trabajadorLocalidad.trim(),
                    provincia: form.trabajadorProvincia.trim(),
                    cp: onlyDigits(form.trabajadorCP),
                    telefono: onlyDigits(form.trabajadorTelefono),
                },
                consulta: {
                    tipo: form.consultaTipo, // AT | AIT | EP | INT
                },
                evolucionesMedicas: {},
                pedidos: {},
                informes: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            // 1) Guardar en RTDB
            const newRef = push(ref(db, "pacientes"));
            await set(newRef, payload);
            setCreatedId(newRef.key);

            // 2) Generar PDF
            const fileName = `ART_${payload.trabajador.apellido}_${payload.trabajador.dni || "DNI"}_${payload.ART.nroSiniestro || "SINIESTRO"}.pdf`;

            const res = await fetch("/api/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload, fileName }),
            });

            if (!res.ok) {
                const ct = res.headers.get("content-type") || "";
                let detail = "";

                if (ct.includes("application/json")) {
                    const errJson = await res.json().catch(() => null);
                    detail = errJson?.detail || errJson?.error || JSON.stringify(errJson);
                } else {
                    detail = await res.text().catch(() => "");
                }

                console.error("PDF FAIL:", { status: res.status, contentType: ct, detail });
                alert(
                    `Se guardó el paciente, pero falló el PDF (${res.status}).\n${detail || "sin detalle"}`
                );
                return;
            }

            const blob = await res.blob();
            openAndPrintPdf(blob);

            // ✅ si todo salió bien, limpiamos el borrador para el próximo
            try {
                localStorage.removeItem(STORAGE_KEY);
            } catch { }

            // 3) limpiar form
            setForm(initialForm);
            setErrors({});
        } catch (err) {
            console.error(err);
            alert("Error guardando o generando PDF. Revisá consola.");
        } finally {
            setSaving(false);
            submittingRef.current = false;
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <h1 className={styles.title}>Nuevo Siniestro / Paciente</h1>

                {createdId && (
                    <div className={styles.success}>
                        ✅ Guardado. ID: <b>{createdId}</b>
                    </div>
                )}

                <div className={styles.actions} style={{ justifyContent: "flex-end" }}>
                    <button
                        type="button"
                        onClick={clearDraftAndReset}
                        className={styles.secondaryBtn || styles.primaryBtn}
                        disabled={saving}
                        title="Borra el borrador guardado y resetea el formulario"
                    >
                        Limpiar borrador
                    </button>
                </div>

                <form onSubmit={onSubmit} className={styles.form}>
                    {/* 1 */}
                    <div className={styles.sectionTitle}>1) ART y número de siniestro</div>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label>ART *</label>
                            <input
                                value={form.ART}
                                onChange={onChange("ART")}
                                className={errors.ART ? styles.inputError : ""}
                            />
                            {errors.ART && <span className={styles.errorText}>{errors.ART}</span>}
                        </div>
                        <div className={styles.field}>
                            <label>N° siniestro (opcional)</label>
                            <input value={form.nroSiniestro} onChange={onChange("nroSiniestro")} />
                        </div>
                    </div>

                    {/* 2 */}
                    <div className={styles.sectionTitle}>2) Datos del empleador</div>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label>Nombre empresa *</label>
                            <input
                                value={form.empleadorNombre}
                                onChange={onChange("empleadorNombre")}
                                className={errors.empleadorNombre ? styles.inputError : ""}
                            />
                            {errors.empleadorNombre && (
                                <span className={styles.errorText}>{errors.empleadorNombre}</span>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label>CUIT *</label>
                            <input
                                value={form.empleadorCuit}
                                onChange={onChange("empleadorCuit")}
                                className={errors.empleadorCuit ? styles.inputError : ""}
                                inputMode="numeric"
                            />
                            {errors.empleadorCuit && (
                                <span className={styles.errorText}>{errors.empleadorCuit}</span>
                            )}
                        </div>
                    </div>

                    {/* 3 */}
                    <div className={styles.sectionTitle}>3) Datos del trabajador</div>
                    <div className={styles.grid}>
                        <div className={styles.field}>
                            <label>Apellido *</label>
                            <input
                                value={form.trabajadorApellido}
                                onChange={onChange("trabajadorApellido")}
                                className={errors.trabajadorApellido ? styles.inputError : ""}
                            />
                            {errors.trabajadorApellido && (
                                <span className={styles.errorText}>{errors.trabajadorApellido}</span>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label>Nombre *</label>
                            <input
                                value={form.trabajadorNombre}
                                onChange={onChange("trabajadorNombre")}
                                className={errors.trabajadorNombre ? styles.inputError : ""}
                            />
                            {errors.trabajadorNombre && (
                                <span className={styles.errorText}>{errors.trabajadorNombre}</span>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label>DNI *</label>
                            <input
                                value={form.trabajadorDni}
                                onChange={onChange("trabajadorDni")}
                                className={errors.trabajadorDni ? styles.inputError : ""}
                                inputMode="numeric"
                            />
                            {errors.trabajadorDni && (
                                <span className={styles.errorText}>{errors.trabajadorDni}</span>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label>Nacimiento *</label>
                            <input
                                type="date"
                                value={form.trabajadorNacimiento}
                                onChange={onChange("trabajadorNacimiento")}
                                className={errors.trabajadorNacimiento ? styles.inputError : ""}
                            />
                            {errors.trabajadorNacimiento && (
                                <span className={styles.errorText}>{errors.trabajadorNacimiento}</span>
                            )}
                        </div>

                        <div className={styles.fieldFull}>
                            <label>Sexo *</label>
                            <div className={styles.radioRow}>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="sexo"
                                        value="M"
                                        checked={form.trabajadorSexo === "M"}
                                        onChange={onChange("trabajadorSexo")}
                                    />
                                    Masculino
                                </label>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="sexo"
                                        value="F"
                                        checked={form.trabajadorSexo === "F"}
                                        onChange={onChange("trabajadorSexo")}
                                    />
                                    Femenino
                                </label>
                            </div>
                            {errors.trabajadorSexo && (
                                <span className={styles.errorText}>{errors.trabajadorSexo}</span>
                            )}
                        </div>

                        <div className={styles.field}>
                            <label>Calle *</label>
                            <input
                                value={form.trabajadorCalle}
                                onChange={onChange("trabajadorCalle")}
                                className={errors.trabajadorCalle ? styles.inputError : ""}
                            />
                            {errors.trabajadorCalle && (
                                <span className={styles.errorText}>{errors.trabajadorCalle}</span>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label>Número *</label>
                            <input
                                value={form.trabajadorNumero}
                                onChange={onChange("trabajadorNumero")}
                                className={errors.trabajadorNumero ? styles.inputError : ""}
                            />
                            {errors.trabajadorNumero && (
                                <span className={styles.errorText}>{errors.trabajadorNumero}</span>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label>Piso</label>
                            <input value={form.trabajadorPiso} onChange={onChange("trabajadorPiso")} />
                        </div>
                        <div className={styles.field}>
                            <label>Depto</label>
                            <input value={form.trabajadorDepto} onChange={onChange("trabajadorDepto")} />
                        </div>

                        <div className={styles.field}>
                            <label>Localidad *</label>
                            <input
                                value={form.trabajadorLocalidad}
                                onChange={onChange("trabajadorLocalidad")}
                                className={errors.trabajadorLocalidad ? styles.inputError : ""}
                            />
                            {errors.trabajadorLocalidad && (
                                <span className={styles.errorText}>{errors.trabajadorLocalidad}</span>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label>Provincia *</label>
                            <input
                                value={form.trabajadorProvincia}
                                onChange={onChange("trabajadorProvincia")}
                                className={errors.trabajadorProvincia ? styles.inputError : ""}
                            />
                            {errors.trabajadorProvincia && (
                                <span className={styles.errorText}>{errors.trabajadorProvincia}</span>
                            )}
                        </div>
                        <div className={styles.field}>
                            <label>CP</label>
                            <input
                                value={form.trabajadorCP}
                                onChange={onChange("trabajadorCP")}
                                inputMode="numeric"
                            />
                        </div>
                        <div className={styles.field}>
                            <label>Teléfono *</label>
                            <input
                                value={form.trabajadorTelefono}
                                onChange={onChange("trabajadorTelefono")}
                                className={errors.trabajadorTelefono ? styles.inputError : ""}
                                inputMode="numeric"
                            />
                            {errors.trabajadorTelefono && (
                                <span className={styles.errorText}>{errors.trabajadorTelefono}</span>
                            )}
                        </div>
                    </div>

                    {/* 4 */}
                    <div className={styles.sectionTitle}>4) Motivo de consulta</div>
                    <div className={styles.grid}>
                        <div className={styles.fieldFull}>
                            <label>Tipo de contingencia *</label>
                            <div className={styles.radioRow}>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="AT"
                                        checked={form.consultaTipo === "AT"}
                                        onChange={onChange("consultaTipo")}
                                    />
                                    Accidente de trabajo
                                </label>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="AIT"
                                        checked={form.consultaTipo === "AIT"}
                                        onChange={onChange("consultaTipo")}
                                    />
                                    Accidente In Itinere
                                </label>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="EP"
                                        checked={form.consultaTipo === "EP"}
                                        onChange={onChange("consultaTipo")}
                                    />
                                    Enfermedad Profesional
                                </label>
                                <label className={styles.radioLabel}>
                                    <input
                                        type="radio"
                                        name="tipo"
                                        value="INT"
                                        checked={form.consultaTipo === "INT"}
                                        onChange={onChange("consultaTipo")}
                                    />
                                    Intercurrencia
                                </label>
                            </div>
                            {errors.consultaTipo && (
                                <span className={styles.errorText}>{errors.consultaTipo}</span>
                            )}
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button type="submit" disabled={!canSubmit} className={styles.primaryBtn}>
                            {saving ? "Guardando y generando..." : "Guardar y generar PDF"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

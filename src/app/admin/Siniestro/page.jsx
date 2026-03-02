"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { push, ref, set } from "firebase/database";
import styles from "./page.module.css"; // CSS Module específico

const STORAGE_KEY = "siniestro_form_simple_v1";

const PRESTADOR_CONST = {
    nombre: "CLINICA DE LA UNION S.A",
    cuit: "30-70754530-0",
    calle: "Av. Siburu",
    nro: "1085",
    piso: "-",
    depto: "-",
    localidad: "Chajari",
    provincia: "Entre Rios",
    cp: "3228",
    celular: "3456-441580",
    mail: "clinicadelaunionart@gmail.com",
};

const initialForm = {
    ART: "",
    nroSiniestro: "",
    empleadorNombre: "",
    empleadorCuitDni: "",
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
    consultaTipo: "",
};

function onlyDigits(s) {
    return (s ?? "").toString().replace(/\D/g, "");
}

function formatCuitIf11(value) {
    const d = onlyDigits(value);
    if (d.length !== 11) return value;
    return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

function validate(f) {
    const e = {};
    const empId = onlyDigits(f.empleadorCuitDni);
    if (empId && empId.length < 8 && empId.length > 0) {
        e.empleadorCuitDni = "Debe tener al menos 8 números si se completa";
    }
    const dni = onlyDigits(f.trabajadorDni);
    if (dni && (dni.length < 7 || dni.length > 9)) {
        e.trabajadorDni = "DNI inválido (7 a 9 dígitos)";
    }
    const tel = onlyDigits(f.trabajadorTelefono);
    if (tel && tel.length < 8) {
        e.trabajadorTelefono = "Teléfono inválido";
    }
    return e;
}

function cx(...cls) {
    return cls.filter(Boolean).join(" ");
}

function Section({ title, subtitle, children }) {
    return (
        <section className={styles.section}>
            <div className={styles.sectionHead}>
                <div>
                    <h3 className={styles.sectionTitle}>{title}</h3>
                    {subtitle && <div className={styles.sectionHint}>{subtitle}</div>}
                </div>
            </div>
            {children}
        </section>
    );
}

export default function SiniestroPage() {
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [createdId, setCreatedId] = useState(null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfFileName, setPdfFileName] = useState(null);
    const [pdfError, setPdfError] = useState(null);

    const submittingRef = useRef(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setForm({ ...initialForm, ...JSON.parse(raw) });
        } catch { }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
            } catch { }
        }, 250);
        return () => clearTimeout(t);
    }, [form]);

    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    const canSubmit = useMemo(() => !saving, [saving]);

    const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const onBlurCuitDni = () => {
        setForm((p) => ({ ...p, empleadorCuitDni: formatCuitIf11(p.empleadorCuitDni) }));
    };

    function openPdf() {
        if (pdfUrl) window.open(pdfUrl, "_blank");
    }

    function downloadPdf() {
        if (!pdfUrl) return;
        const a = document.createElement("a");
        a.href = pdfUrl;
        a.download = pdfFileName || "FORMULARIO_ART.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
    }

    async function onSubmit(e) {
        e.preventDefault();
        if (submittingRef.current) return;
        submittingRef.current = true;

        setCreatedId(null);
        setPdfError(null);
        if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
        setPdfFileName(null);

        const v = validate(form);
        setErrors(v);
        if (Object.keys(v).length) {
            submittingRef.current = false;
            return;
        }

        setSaving(true);
        try {
            const payload = {
                ART: { nombre: form.ART.trim() || "", nroSiniestro: form.nroSiniestro.trim() || "" },
                empleador: { nombre: form.empleadorNombre.trim() || "", cuit: onlyDigits(form.empleadorCuitDni) || "" },
                trabajador: {
                    apellido: form.trabajadorApellido.trim() || "",
                    nombre: form.trabajadorNombre.trim() || "",
                    dni: onlyDigits(form.trabajadorDni) || "",
                    nacimiento: form.trabajadorNacimiento || "",
                    sexo: form.trabajadorSexo || "",
                    calle: form.trabajadorCalle.trim() || "",
                    numero: form.trabajadorNumero.trim() || "",
                    piso: form.trabajadorPiso.trim() || "",
                    depto: form.trabajadorDepto.trim() || "",
                    localidad: form.trabajadorLocalidad.trim() || "",
                    provincia: form.trabajadorProvincia.trim() || "",
                    cp: onlyDigits(form.trabajadorCP) || "",
                    telefono: onlyDigits(form.trabajadorTelefono) || "",
                },
                consulta: { tipo: form.consultaTipo || "" },
                prestador: PRESTADOR_CONST,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const newRef = push(ref(db, "pacientes"));
            await set(newRef, payload);
            setCreatedId(newRef.key);

            const fileName = `ART_${payload.trabajador.apellido || "SIN_APELLIDO"}_${payload.trabajador.dni || "SIN_DNI"}_${payload.ART.nroSiniestro || "SINIESTRO"}.pdf`;

            const res = await fetch("/api/pdf", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload, fileName }),
            });

            const ct = res.headers.get("content-type") || "";

            if (!res.ok || !ct.includes("application/pdf")) {
                const detail = ct.includes("application/json")
                    ? JSON.stringify(await res.json().catch(() => ({})), null, 2)
                    : await res.text().catch(() => "");
                console.error("PDF FAIL:", { status: res.status, ct, detail });
                setPdfError(`Falló la generación del PDF (${res.status}). Revisá consola.`);
                return;
            }

            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            setPdfUrl(url);
            setPdfFileName(fileName);
        } catch (err) {
            console.error(err);
            setPdfError("Error guardando o generando PDF. Revisá consola.");
        } finally {
            setSaving(false);
            submittingRef.current = false;
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.shell}>
                <div className={styles.header}>
                    <div>
                        <h1 className={styles.title}>Nuevo Siniestro</h1>
                        <p className={styles.subtitle}>Todos los campos son opcionales. Completá lo que necesites.</p>
                    </div>
                    <div className={styles.headerActions}>
                        <button
                            type="button"
                            className={styles.ghostBtn}
                            disabled={saving}
                            onClick={() => {
                                setForm(initialForm);
                                setErrors({});
                                setCreatedId(null);
                                setPdfError(null);
                                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                                setPdfUrl(null);
                                setPdfFileName(null);
                                localStorage.removeItem(STORAGE_KEY);
                            }}
                        >
                            Limpiar
                        </button>
                    </div>
                </div>

                {saving && <div className={styles.toastInfo}>⏳ Guardando datos y generando PDF...</div>}

                <form onSubmit={onSubmit} autoComplete="on">
                    <div className={styles.card}>
                        <Section title="1) ART + Motivo" subtitle="Todos los campos son opcionales">
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <label className={styles.label}>ART</label>
                                    <input
                                        className={cx(styles.input, errors.ART && styles.inputError)}
                                        value={form.ART}
                                        onChange={onChange("ART")}
                                        placeholder="Ej: Provincia ART, Galeno ART..."
                                    />
                                    {errors.ART && <div className={styles.errorText}>{errors.ART}</div>}
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>N° siniestro</label>
                                    <input
                                        className={styles.input}
                                        value={form.nroSiniestro}
                                        onChange={onChange("nroSiniestro")}
                                        inputMode="numeric"
                                        placeholder="Opcional"
                                    />
                                </div>
                                <div className={styles.fieldFull}>
                                    <label className={styles.label}>Motivo de consulta</label>
                                    <div className={styles.chips}>
                                        {[
                                            ["AT", "Accidente de trabajo"],
                                            ["AIT", "Accidente In Itinere"],
                                            ["EP", "Enfermedad Profesional"],
                                            ["INT", "Intercurrencia"],
                                        ].map(([val, label]) => (
                                            <label
                                                key={val}
                                                className={cx(styles.chip, form.consultaTipo === val && styles.chipActive)}
                                            >
                                                <input
                                                    type="radio"
                                                    name="motivo"
                                                    value={val}
                                                    checked={form.consultaTipo === val}
                                                    onChange={onChange("consultaTipo")}
                                                />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Section>

                        <Section title="2) Empleador" subtitle="Todos los campos son opcionales">
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <label className={styles.label}>Nombre empresa</label>
                                    <input
                                        className={styles.input}
                                        value={form.empleadorNombre}
                                        onChange={onChange("empleadorNombre")}
                                        placeholder="Razón social"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>CUIT / DNI</label>
                                    <input
                                        className={cx(styles.input, errors.empleadorCuitDni && styles.inputError)}
                                        value={form.empleadorCuitDni}
                                        onChange={onChange("empleadorCuitDni")}
                                        onBlur={onBlurCuitDni}
                                        inputMode="numeric"
                                        placeholder="Solo números"
                                    />
                                    {errors.empleadorCuitDni && <div className={styles.errorText}>{errors.empleadorCuitDni}</div>}
                                </div>
                            </div>
                        </Section>

                        <Section title="3) Trabajador" subtitle="Todos los campos son opcionales">
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <label className={styles.label}>Apellido</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorApellido}
                                        onChange={onChange("trabajadorApellido")}
                                        placeholder="Apellido"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Nombre</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorNombre}
                                        onChange={onChange("trabajadorNombre")}
                                        placeholder="Nombre"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>DNI</label>
                                    <input
                                        className={cx(styles.input, errors.trabajadorDni && styles.inputError)}
                                        value={form.trabajadorDni}
                                        onChange={onChange("trabajadorDni")}
                                        inputMode="numeric"
                                        placeholder="DNI"
                                    />
                                    {errors.trabajadorDni && <div className={styles.errorText}>{errors.trabajadorDni}</div>}
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Nacimiento</label>
                                    <input
                                        type="date"
                                        className={styles.input}
                                        value={form.trabajadorNacimiento}
                                        onChange={onChange("trabajadorNacimiento")}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Sexo</label>
                                    <div className={styles.chips}>
                                        {["M", "F"].map((val) => (
                                            <label
                                                key={val}
                                                className={cx(styles.chip, form.trabajadorSexo === val && styles.chipActive)}
                                            >
                                                <input
                                                    type="radio"
                                                    name="sexo"
                                                    value={val}
                                                    checked={form.trabajadorSexo === val}
                                                    onChange={onChange("trabajadorSexo")}
                                                />
                                                {val}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Teléfono</label>
                                    <input
                                        className={cx(styles.input, errors.trabajadorTelefono && styles.inputError)}
                                        value={form.trabajadorTelefono}
                                        onChange={onChange("trabajadorTelefono")}
                                        inputMode="numeric"
                                        placeholder="Teléfono"
                                    />
                                    {errors.trabajadorTelefono && <div className={styles.errorText}>{errors.trabajadorTelefono}</div>}
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Calle</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorCalle}
                                        onChange={onChange("trabajadorCalle")}
                                        placeholder="Calle"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Número</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorNumero}
                                        onChange={onChange("trabajadorNumero")}
                                        inputMode="numeric"
                                        placeholder="N°"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Piso</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorPiso}
                                        onChange={onChange("trabajadorPiso")}
                                        placeholder="Piso"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Depto</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorDepto}
                                        onChange={onChange("trabajadorDepto")}
                                        placeholder="Depto"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Localidad</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorLocalidad}
                                        onChange={onChange("trabajadorLocalidad")}
                                        placeholder="Localidad"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Provincia</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorProvincia}
                                        onChange={onChange("trabajadorProvincia")}
                                        placeholder="Provincia"
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>CP</label>
                                    <input
                                        className={styles.input}
                                        value={form.trabajadorCP}
                                        onChange={onChange("trabajadorCP")}
                                        inputMode="numeric"
                                        placeholder="CP"
                                    />
                                </div>
                            </div>
                        </Section>

                        <div className={styles.footer}>
                            <button type="submit" className={styles.primaryBtn} disabled={!canSubmit}>
                                {saving ? "Guardando y generando..." : "Guardar y generar PDF"}
                            </button>

                            <div className={styles.pdfRow}>
                                {createdId && (
                                    <div className={styles.toastSuccess}>
                                        ✅ Guardado. ID: <b>{createdId}</b>
                                    </div>
                                )}
                                {pdfError && <div className={styles.toastDanger}>❌ {pdfError}</div>}
                                {pdfUrl && (
                                    <div className={styles.toastSuccess}>
                                        <div className={styles.pdfActionsRow}>
                                            <span>📄 PDF generado: <b>{pdfFileName}</b></span>
                                            <div className={styles.pdfActions}>
                                                <button type="button" className={styles.secondaryBtn} onClick={openPdf}>
                                                    Abrir
                                                </button>
                                                <button type="button" className={styles.primaryBtn} onClick={downloadPdf}>
                                                    Descargar
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { push, ref, set } from "firebase/database";
import styles from "./page.module.css";

const STORAGE_KEY = "siniestro_form_v2";

const PRESTADOR_CONST = {
    nombre: "CLINICA DE LA UNION S.A",
    cuit: "30-70754530-1",
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

// Obtener fecha actual para valores por defecto
const today = new Date();
const defaultDay = String(today.getDate()).padStart(2, "0");
const defaultMonth = String(today.getMonth() + 1).padStart(2, "0");
const defaultYear = String(today.getFullYear());

const initialForm = {
    ART: "",
    nroSiniestro: "",
    empleadorNombre: "",
    empleadorCuitDni: "",
    trabajadorApellido: "",
    trabajadorNombre: "",
    trabajadorDni: "",
    trabajadorNacimiento: "",      // formato YYYY-MM-DD
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
    // Fechas adicionales
    diaIngreso: defaultDay,
    mesIngreso: defaultMonth,
    anioIngreso: defaultYear,
    diaDenuncia: defaultDay,
    mesDenuncia: defaultMonth,
    anioDenuncia: defaultYear,
    trabajadorEdad: "",   // calculada automáticamente
};



// Definir las opciones de ART ordenadas alfabéticamente
const ART_OPTIONS = [
    "Asociart",
    "COMFYE",
    "Federacion patronal AP",
    "Federacion patronal ART",
    "IAPS AP",
    "IAPS ART",
    "La segunda ART",
    "La segunda personas",
    "Medicar work",
    "Victoria seguros",
    "Reconquista ART"
];
function onlyDigits(s) {
    return (s ?? "").toString().replace(/\D/g, "");
}

function formatCuitIf11(value) {
    const d = onlyDigits(value);
    if (d.length !== 11) return value;
    return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

// Calcula edad exacta en años entre fecha de nacimiento y fecha actual
function calcularEdad(nacimiento) {
    if (!nacimiento) return "";
    const [y, m, d] = nacimiento.split("-").map(Number);
    if (!y || !m || !d) return "";
    const hoy = new Date();
    let edad = hoy.getFullYear() - y;
    const mesActual = hoy.getMonth() + 1;
    const diaActual = hoy.getDate();
    if (mesActual < m || (mesActual === m && diaActual < d)) {
        edad--;
    }
    return edad >= 0 ? String(edad) : "";
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

    // Validar fechas
    const validarFecha = (dia, mes, anio, prefix) => {
        const d = Number(dia), m = Number(mes), a = Number(anio);
        if (dia && (d < 1 || d > 31)) e[`${prefix}Dia`] = "Día inválido";
        if (mes && (m < 1 || m > 12)) e[`${prefix}Mes`] = "Mes inválido";
        if (anio && (a < 1900 || a > 2100)) e[`${prefix}Anio`] = "Año inválido";
    };
    validarFecha(f.diaIngreso, f.mesIngreso, f.anioIngreso, "ingreso");
    validarFecha(f.diaDenuncia, f.mesDenuncia, f.anioDenuncia, "denuncia");

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

function DatePartInput({ label, value, onChange, placeholder, maxLength, error, className }) {
    return (
        <div className={cx(styles.datePartField, className)}>
            <label className={styles.label}>{label}</label>
            <input
                className={cx(styles.input, error && styles.inputError)}
                value={value}
                onChange={onChange}
                inputMode="numeric"
                placeholder={placeholder}
                maxLength={maxLength}
            />
            {error && <div className={styles.errorText}>{error}</div>}
        </div>
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

    // Cargar borrador
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setForm({ ...initialForm, ...JSON.parse(raw) });
        } catch { }
    }, []);

    // Guardar borrador con debounce
    useEffect(() => {
        const t = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
            } catch { }
        }, 250);
        return () => clearTimeout(t);
    }, [form]);

    // Revocar URL del PDF al desmontar
    useEffect(() => {
        return () => {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        };
    }, [pdfUrl]);

    // Recalcular edad cuando cambia la fecha de nacimiento
    useEffect(() => {
        setForm((prev) => ({
            ...prev,
            trabajadorEdad: calcularEdad(prev.trabajadorNacimiento),
        }));
    }, [form.trabajadorNacimiento]);

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
                empleador: {
                    nombre: form.empleadorNombre.trim() || "",
                    cuit: onlyDigits(form.empleadorCuitDni) || "",
                },
                trabajador: {
                    apellido: form.trabajadorApellido.trim() || "",
                    nombre: form.trabajadorNombre.trim() || "",
                    dni: onlyDigits(form.trabajadorDni) || "",
                    nacimiento: form.trabajadorNacimiento || "",
                    edad: form.trabajadorEdad,
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
                fechaIngreso: {
                    dia: form.diaIngreso,
                    mes: form.mesIngreso,
                    anio: form.anioIngreso,
                    iso: `${form.anioIngreso}-${form.mesIngreso.padStart(2, "0")}-${form.diaIngreso.padStart(2, "0")}`,
                },
                fechaDenuncia: {
                    dia: form.diaDenuncia,
                    mes: form.mesDenuncia,
                    anio: form.anioDenuncia,
                    iso: `${form.anioDenuncia}-${form.mesDenuncia.padStart(2, "0")}-${form.diaDenuncia.padStart(2, "0")}`,
                },
                prestador: PRESTADOR_CONST,
                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            const newRef = push(ref(db, "pacientes"));
            await set(newRef, payload);
            setCreatedId(newRef.key);

            const fileName = `ART_${payload.trabajador.apellido || "SIN_APELLIDO"}_${payload.trabajador.dni || "SIN_DNI"
                }_${payload.ART.nroSiniestro || "SINIESTRO"}.pdf`;

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
                        {/* Sección 1: ART + Motivo */}
                        <Section title="1) ART + Motivo" subtitle="Todos los campos son opcionales">
                            <div className={styles.grid}>
                                <div className={styles.field}>
                                    <label className={styles.label}>ART</label>
                                    <select
                                        className={cx(styles.input, errors.ART && styles.inputError)}
                                        value={form.ART}
                                        onChange={onChange("ART")}
                                    >
                                        <option value="">Seleccione una ART</option>
                                        {ART_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
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

                        {/* Sección 2: Fechas (Ingreso y Denuncia) */}
                        <Section title="2) Fechas" subtitle="Fecha de ingreso y fecha de denuncia">
                            <div className={styles.fechasWrapper}>
                                {/* Fecha ingreso */}
                                <div className={styles.fechaGroup}>
                                    <div className={styles.fechaGroupLabel}>Fecha de ingreso</div>
                                    <div className={styles.fechaRow}>
                                        <DatePartInput
                                            label="Día"
                                            value={form.diaIngreso}
                                            onChange={onChange("diaIngreso")}
                                            placeholder="DD"
                                            maxLength={2}
                                            error={errors.ingresoDia}
                                        />
                                        <DatePartInput
                                            label="Mes"
                                            value={form.mesIngreso}
                                            onChange={onChange("mesIngreso")}
                                            placeholder="MM"
                                            maxLength={2}
                                            error={errors.ingresoMes}
                                        />
                                        <DatePartInput
                                            label="Año"
                                            value={form.anioIngreso}
                                            onChange={onChange("anioIngreso")}
                                            placeholder="AAAA"
                                            maxLength={4}
                                            error={errors.ingresoAnio}
                                            className={styles.datePartWide}
                                        />
                                    </div>
                                </div>

                                {/* Fecha denuncia */}
                                <div className={styles.fechaGroup}>
                                    <div className={styles.fechaGroupLabel}>Fecha de denuncia</div>
                                    <div className={styles.fechaRow}>
                                        <DatePartInput
                                            label="Día"
                                            value={form.diaDenuncia}
                                            onChange={onChange("diaDenuncia")}
                                            placeholder="DD"
                                            maxLength={2}
                                            error={errors.denunciaDia}
                                        />
                                        <DatePartInput
                                            label="Mes"
                                            value={form.mesDenuncia}
                                            onChange={onChange("mesDenuncia")}
                                            placeholder="MM"
                                            maxLength={2}
                                            error={errors.denunciaMes}
                                        />
                                        <DatePartInput
                                            label="Año"
                                            value={form.anioDenuncia}
                                            onChange={onChange("anioDenuncia")}
                                            placeholder="AAAA"
                                            maxLength={4}
                                            error={errors.denunciaAnio}
                                            className={styles.datePartWide}
                                        />
                                    </div>
                                </div>
                            </div>
                        </Section>

                        {/* Sección 3: Empleador */}
                        <Section title="3) Empleador" subtitle="Todos los campos son opcionales">
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

                        {/* Sección 4: Trabajador */}
                        <Section title="4) Trabajador" subtitle="Todos los campos son opcionales">
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

                                {/* Nacimiento */}
                                <div className={styles.field}>
                                    <label className={styles.label}>Fecha de nacimiento</label>
                                    <input
                                        type="date"
                                        className={styles.input}
                                        value={form.trabajadorNacimiento}
                                        onChange={onChange("trabajadorNacimiento")}
                                    />
                                </div>
                                <div className={styles.field}>
                                    <label className={styles.label}>Edad (calculada)</label>
                                    <input
                                        className={cx(styles.input, styles.inputReadonly)}
                                        value={form.trabajadorEdad ? `${form.trabajadorEdad} años` : ""}
                                        readOnly
                                        tabIndex={-1}
                                        placeholder="Se calcula automáticamente"
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
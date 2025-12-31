"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { push, ref, set } from "firebase/database";

const STORAGE_KEY = "siniestro_form_simple_v1";

// ✅ Prestador fijo (si ya lo llevaste a .env en el server, podés eliminarlo del payload)
const PRESTADOR_CONST = {
    nombre: "CLINICA DE LA UNION S.A",
    cuit: "",
    calle: "",
    nro: "",
    piso: "",
    depto: "",
    localidad: "Chajari",
    provincia: "Entre Rios",
    cp: "",
    celular: "",
    mail: "",
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

    consultaTipo: "", // AT | AIT | EP | INT
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

    if (!f.ART.trim()) e.ART = "ART requerida";

    if (!f.empleadorNombre.trim()) e.empleadorNombre = "Nombre de empresa requerido";
    const empId = onlyDigits(f.empleadorCuitDni);
    if (!empId) e.empleadorCuitDni = "CUIT/DNI requerido";
    else if (empId.length < 8) e.empleadorCuitDni = "Debe tener al menos 8 números";

    if (!f.trabajadorApellido.trim()) e.trabajadorApellido = "Apellido requerido";
    if (!f.trabajadorNombre.trim()) e.trabajadorNombre = "Nombre requerido";

    const dni = onlyDigits(f.trabajadorDni);
    if (!dni) e.trabajadorDni = "DNI requerido";
    if (dni && (dni.length < 7 || dni.length > 9)) e.trabajadorDni = "DNI inválido (7 a 9 dígitos)";

    if (!f.trabajadorNacimiento) e.trabajadorNacimiento = "Fecha de nacimiento requerida";
    if (!f.trabajadorSexo) e.trabajadorSexo = "Seleccioná sexo";

    if (!f.trabajadorCalle.trim()) e.trabajadorCalle = "Calle requerida";
    if (!f.trabajadorNumero.trim()) e.trabajadorNumero = "Número requerido";
    if (!f.trabajadorLocalidad.trim()) e.trabajadorLocalidad = "Localidad requerida";
    if (!f.trabajadorProvincia.trim()) e.trabajadorProvincia = "Provincia requerida";

    const tel = onlyDigits(f.trabajadorTelefono);
    if (!tel) e.trabajadorTelefono = "Teléfono requerido";
    if (tel && tel.length < 8) e.trabajadorTelefono = "Teléfono inválido";

    if (!f.consultaTipo) e.consultaTipo = "Seleccioná tipo de contingencia";

    return e;
}

function Section({ title, subtitle, children }) {
    return (
        <section className="mb-3">
            <div className="d-flex align-items-baseline justify-content-between mb-2">
                <div>
                    <div className="fw-semibold">{title}</div>
                    {subtitle ? <div className="text-muted small">{subtitle}</div> : null}
                </div>
            </div>

            <div className="p-3 p-md-4 rounded-3 border bg-light">{children}</div>
        </section>
    );
}

export default function SiniestroPage() {
    const [form, setForm] = useState(initialForm);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const [createdId, setCreatedId] = useState(null);

    // ✅ Estado del PDF
    const [pdfUrl, setPdfUrl] = useState(null);
    const [pdfFileName, setPdfFileName] = useState(null);
    const [pdfError, setPdfError] = useState(null);

    const submittingRef = useRef(false);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) setForm({ ...initialForm, ...JSON.parse(raw) });
        } catch { }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const t = setTimeout(() => {
            try {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
            } catch { }
        }, 250);
        return () => clearTimeout(t);
    }, [form]);

    // liberar blob anterior si generás otro
    useEffect(() => {
        return () => {
            try {
                if (pdfUrl) URL.revokeObjectURL(pdfUrl);
            } catch { }
        };
    }, [pdfUrl]);

    const canSubmit = useMemo(() => !saving, [saving]);

    const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const onBlurCuitDni = () => {
        setForm((p) => ({ ...p, empleadorCuitDni: formatCuitIf11(p.empleadorCuitDni) }));
    };

    function openPdf() {
        if (!pdfUrl) return;
        window.open(pdfUrl, "_blank", "noopener,noreferrer");
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

        // limpiar pdf anterior
        try {
            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
        } catch { }
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
                ART: { nombre: form.ART.trim(), nroSiniestro: form.nroSiniestro.trim() },

                empleador: {
                    nombre: form.empleadorNombre.trim(),
                    cuit: onlyDigits(form.empleadorCuitDni),
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

                consulta: { tipo: form.consultaTipo },

                // si el server ya usa ENV, esto se puede sacar
                prestador: PRESTADOR_CONST,

                createdAt: Date.now(),
                updatedAt: Date.now(),
            };

            // 1) Guardar en RTDB
            const newRef = push(ref(db, "pacientes"));
            await set(newRef, payload);
            setCreatedId(newRef.key);

            // 2) Generar PDF
            const fileName = `ART_${payload.trabajador.apellido}_${payload.trabajador.dni}_${payload.ART.nroSiniestro || "SINIESTRO"}.pdf`;

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
        <div className="container py-3 py-md-4" style={{ maxWidth: 900 }}>
            {/* Header */}
            <div className="d-flex align-items-start justify-content-between gap-2 mb-3">
                <div>
                    <h1 className="h4 mb-1">Nuevo Siniestro</h1>
                    <div className="text-muted small">Completá el formulario, guardá y descargá/abrí el PDF.</div>
                </div>

                <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    disabled={saving}
                    onClick={() => {
                        setForm(initialForm);
                        setErrors({});
                        setCreatedId(null);
                        setPdfError(null);
                        try {
                            if (pdfUrl) URL.revokeObjectURL(pdfUrl);
                        } catch { }
                        setPdfUrl(null);
                        setPdfFileName(null);
                        try {
                            localStorage.removeItem(STORAGE_KEY);
                        } catch { }
                    }}
                >
                    Limpiar
                </button>
            </div>

            {/* Status superior (solo lo esencial) */}
            {saving && <div className="alert alert-info py-2 small">⏳ Guardando datos y generando PDF...</div>}

            <form onSubmit={onSubmit} autoComplete="on">
                <div className="card shadow-sm border-0">
                    <div className="card-body">
                        {/* ✅ ART + MOTIVO juntos */}
                        <Section title="1) ART + Motivo" subtitle="Completar ART y seleccionar tipo de contingencia">
                            <div className="row g-2 g-md-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label">ART *</label>
                                    <input
                                        className={`form-control ${errors.ART ? "is-invalid" : ""}`}
                                        value={form.ART}
                                        onChange={onChange("ART")}
                                        placeholder="Ej: Provincia ART, Galeno ART..."
                                    />
                                    {errors.ART && <div className="invalid-feedback">{errors.ART}</div>}
                                </div>

                                <div className="col-12 col-md-6">
                                    <label className="form-label">N° siniestro</label>
                                    <input
                                        className="form-control"
                                        value={form.nroSiniestro}
                                        onChange={onChange("nroSiniestro")}
                                        inputMode="numeric"
                                        placeholder="Opcional"
                                    />
                                </div>

                                <div className="col-12 mt-2">
                                    <label className="form-label mb-1">Motivo de consulta *</label>
                                    <div className="d-flex flex-wrap gap-2">
                                        {[
                                            ["AT", "Accidente de trabajo"],
                                            ["AIT", "Accidente In Itinere"],
                                            ["EP", "Enfermedad Profesional"],
                                            ["INT", "Intercurrencia"],
                                        ].map(([val, label]) => (
                                            <div className="form-check" key={val}>
                                                <input
                                                    className="form-check-input"
                                                    type="radio"
                                                    name="motivo"
                                                    id={`motivo_${val}`}
                                                    value={val}
                                                    checked={form.consultaTipo === val}
                                                    onChange={onChange("consultaTipo")}
                                                />
                                                <label className="form-check-label" htmlFor={`motivo_${val}`}>
                                                    {label}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                    {errors.consultaTipo && <div className="text-danger small mt-1">{errors.consultaTipo}</div>}
                                </div>
                            </div>
                        </Section>

                        {/* EMPLEADOR */}
                        <Section title="2) Empleador" subtitle="Datos de la empresa">
                            <div className="row g-2 g-md-3">
                                <div className="col-12 col-md-7">
                                    <label className="form-label">Nombre empresa *</label>
                                    <input
                                        className={`form-control ${errors.empleadorNombre ? "is-invalid" : ""}`}
                                        value={form.empleadorNombre}
                                        onChange={onChange("empleadorNombre")}
                                        placeholder="Razón social"
                                    />
                                    {errors.empleadorNombre && <div className="invalid-feedback">{errors.empleadorNombre}</div>}
                                </div>

                                <div className="col-12 col-md-5">
                                    <label className="form-label">CUIT / DNI *</label>
                                    <input
                                        className={`form-control ${errors.empleadorCuitDni ? "is-invalid" : ""}`}
                                        value={form.empleadorCuitDni}
                                        onChange={onChange("empleadorCuitDni")}
                                        onBlur={onBlurCuitDni}
                                        placeholder="Solo números (se formatea si es CUIT)"
                                        inputMode="numeric"
                                    />
                                    {errors.empleadorCuitDni && <div className="invalid-feedback">{errors.empleadorCuitDni}</div>}
                                </div>
                            </div>
                        </Section>

                        {/* TRABAJADOR */}
                        <Section title="3) Trabajador" subtitle="Datos personales y domicilio">
                            <div className="row g-2 g-md-3">
                                <div className="col-12 col-md-6">
                                    <label className="form-label">Apellido *</label>
                                    <input
                                        className={`form-control ${errors.trabajadorApellido ? "is-invalid" : ""}`}
                                        value={form.trabajadorApellido}
                                        onChange={onChange("trabajadorApellido")}
                                        placeholder="Apellido"
                                    />
                                    {errors.trabajadorApellido && <div className="invalid-feedback">{errors.trabajadorApellido}</div>}
                                </div>

                                <div className="col-12 col-md-6">
                                    <label className="form-label">Nombre *</label>
                                    <input
                                        className={`form-control ${errors.trabajadorNombre ? "is-invalid" : ""}`}
                                        value={form.trabajadorNombre}
                                        onChange={onChange("trabajadorNombre")}
                                        placeholder="Nombre"
                                    />
                                    {errors.trabajadorNombre && <div className="invalid-feedback">{errors.trabajadorNombre}</div>}
                                </div>

                                <div className="col-12 col-md-4">
                                    <label className="form-label">DNI *</label>
                                    <input
                                        className={`form-control ${errors.trabajadorDni ? "is-invalid" : ""}`}
                                        value={form.trabajadorDni}
                                        onChange={onChange("trabajadorDni")}
                                        inputMode="numeric"
                                        placeholder="Ej: 12345678"
                                    />
                                    {errors.trabajadorDni && <div className="invalid-feedback">{errors.trabajadorDni}</div>}
                                </div>

                                <div className="col-12 col-md-4">
                                    <label className="form-label">Nacimiento *</label>
                                    <input
                                        type="date"
                                        className={`form-control ${errors.trabajadorNacimiento ? "is-invalid" : ""}`}
                                        value={form.trabajadorNacimiento}
                                        onChange={onChange("trabajadorNacimiento")}
                                    />
                                    {errors.trabajadorNacimiento && <div className="invalid-feedback">{errors.trabajadorNacimiento}</div>}
                                </div>

                                <div className="col-12 col-md-4">
                                    <label className="form-label d-block">Sexo *</label>
                                    <div className="btn-group w-100" role="group">
                                        <input
                                            type="radio"
                                            className="btn-check"
                                            name="sexo"
                                            id="sexoM"
                                            value="M"
                                            checked={form.trabajadorSexo === "M"}
                                            onChange={onChange("trabajadorSexo")}
                                        />
                                        <label className="btn btn-outline-primary" htmlFor="sexoM">
                                            M
                                        </label>

                                        <input
                                            type="radio"
                                            className="btn-check"
                                            name="sexo"
                                            id="sexoF"
                                            value="F"
                                            checked={form.trabajadorSexo === "F"}
                                            onChange={onChange("trabajadorSexo")}
                                        />
                                        <label className="btn btn-outline-primary" htmlFor="sexoF">
                                            F
                                        </label>
                                    </div>
                                    {errors.trabajadorSexo && <div className="text-danger small mt-1">{errors.trabajadorSexo}</div>}
                                </div>

                                <div className="col-12 col-md-6">
                                    <label className="form-label">Calle *</label>
                                    <input
                                        className={`form-control ${errors.trabajadorCalle ? "is-invalid" : ""}`}
                                        value={form.trabajadorCalle}
                                        onChange={onChange("trabajadorCalle")}
                                        placeholder="Calle"
                                    />
                                    {errors.trabajadorCalle && <div className="invalid-feedback">{errors.trabajadorCalle}</div>}
                                </div>

                                <div className="col-12 col-md-3">
                                    <label className="form-label">Número *</label>
                                    <input
                                        className={`form-control ${errors.trabajadorNumero ? "is-invalid" : ""}`}
                                        value={form.trabajadorNumero}
                                        onChange={onChange("trabajadorNumero")}
                                        inputMode="numeric"
                                        placeholder="N°"
                                    />
                                    {errors.trabajadorNumero && <div className="invalid-feedback">{errors.trabajadorNumero}</div>}
                                </div>

                                <div className="col-6 col-md-1">
                                    <label className="form-label">Piso</label>
                                    <input className="form-control" value={form.trabajadorPiso} onChange={onChange("trabajadorPiso")} placeholder="-" />
                                </div>

                                <div className="col-6 col-md-2">
                                    <label className="form-label">Depto</label>
                                    <input className="form-control" value={form.trabajadorDepto} onChange={onChange("trabajadorDepto")} placeholder="-" />
                                </div>

                                <div className="col-12 col-md-4">
                                    <label className="form-label">Localidad *</label>
                                    <input
                                        className={`form-control ${errors.trabajadorLocalidad ? "is-invalid" : ""}`}
                                        value={form.trabajadorLocalidad}
                                        onChange={onChange("trabajadorLocalidad")}
                                        placeholder="Localidad"
                                    />
                                    {errors.trabajadorLocalidad && <div className="invalid-feedback">{errors.trabajadorLocalidad}</div>}
                                </div>

                                <div className="col-12 col-md-4">
                                    <label className="form-label">Provincia *</label>
                                    <input
                                        className={`form-control ${errors.trabajadorProvincia ? "is-invalid" : ""}`}
                                        value={form.trabajadorProvincia}
                                        onChange={onChange("trabajadorProvincia")}
                                        placeholder="Provincia"
                                    />
                                    {errors.trabajadorProvincia && <div className="invalid-feedback">{errors.trabajadorProvincia}</div>}
                                </div>

                                <div className="col-6 col-md-2">
                                    <label className="form-label">CP</label>
                                    <input
                                        className="form-control"
                                        value={form.trabajadorCP}
                                        onChange={onChange("trabajadorCP")}
                                        inputMode="numeric"
                                        placeholder="Opcional"
                                    />
                                </div>

                                <div className="col-6 col-md-2">
                                    <label className="form-label">Teléfono *</label>
                                    <input
                                        className={`form-control ${errors.trabajadorTelefono ? "is-invalid" : ""}`}
                                        value={form.trabajadorTelefono}
                                        onChange={onChange("trabajadorTelefono")}
                                        inputMode="numeric"
                                        placeholder="Ej: 3456..."
                                    />
                                    {errors.trabajadorTelefono && <div className="invalid-feedback">{errors.trabajadorTelefono}</div>}
                                </div>
                            </div>
                        </Section>
                    </div>

                    {/* ✅ Footer: botón + “PDF generado” debajo */}
                    <div className="card-footer bg-white border-0 pt-0">
                        <button type="submit" className="btn btn-primary btn-lg w-100" disabled={!canSubmit}>
                            {saving ? "Guardando y generando..." : "Guardar y generar PDF"}
                        </button>

                        {/* Mensajes justo debajo del botón */}
                        <div className="mt-3">
                            {createdId && (
                                <div className="alert alert-success py-2 small mb-2">
                                    ✅ Guardado. ID: <b>{createdId}</b>
                                </div>
                            )}

                            {pdfError && (
                                <div className="alert alert-danger py-2 small mb-2">
                                    ❌ {pdfError}
                                </div>
                            )}

                            {pdfUrl && (
                                <div className="alert alert-success py-2 small mb-0">
                                    <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2">
                                        <div>
                                            📄 PDF generado: <b className="text-break">{pdfFileName}</b>
                                        </div>
                                        <div className="d-flex gap-2">
                                            <button type="button" className="btn btn-outline-primary btn-sm" onClick={openPdf}>
                                                Abrir
                                            </button>
                                            <button type="button" className="btn btn-primary btn-sm" onClick={downloadPdf}>
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
    );
}

"use client";
import { useEffect, useMemo, useState } from "react";
import { getSession } from "@/utils/session";
import {
    inicializarFormIngreso,
    onlyDigits,
    formatIdField,
    getPdfPages,
} from "@/app/ingresos/helpers";
import { guardarInternacionPami } from "@/lib/pami/internaciones";
import styles from "./PasoEvento.module.css";

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

function validarPaso(form) {
    const e = {};
    if (!form.trabajadorApellido?.trim()) e.trabajadorApellido = "Apellido obligatorio";
    if (!form.trabajadorNombre?.trim()) e.trabajadorNombre = "Nombre obligatorio";

    const dni = onlyDigits(form.trabajadorDni);
    if (!dni) e.trabajadorDni = "DNI obligatorio";
    else if (!((dni.length >= 7 && dni.length <= 9) || dni.length === 11))
        e.trabajadorDni = "DNI inválido (7-9 u 11 dígitos)";

    const tel = onlyDigits(form.trabajadorTelefono);
    if (!tel) e.trabajadorTelefono = "Teléfono obligatorio";
    else if (tel.length < 8) e.trabajadorTelefono = "Mínimo 8 dígitos";

    if (!form.trabajadorSexo) e.trabajadorSexo = "Seleccioná sexo";

    const d = onlyDigits(form.diaIngreso);
    const m = onlyDigits(form.mesIngreso);
    const a = onlyDigits(form.anioIngreso);
    if (!d || Number(d) < 1 || Number(d) > 31) e.diaIngreso = "Día inválido";
    if (!m || Number(m) < 1 || Number(m) > 12) e.mesIngreso = "Mes inválido";
    if (!a || (a.length !== 2 && a.length !== 4)) e.anioIngreso = "Año inválido";

    return e;
}

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

    const [form, setForm] = useState(() =>
        inicializarFormIngreso({ paciente, tipoIngreso: "PISO" })
    );
    const [grupoMedico, setGrupoMedico] = useState({
        cirujano: paciente.cirujano || "",
        ayudante1: paciente.ayudante1 || "",
        ayudante2: paciente.ayudante2 || "",
        anestesista: paciente.anestesista || "",
    });

    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [resultado, setResultado] = useState(estado.internacion || null);
    const [pdfUrl, setPdfUrl] = useState(null);
    const [generandoPdf, setGenerandoPdf] = useState(false);

    // Resetear letra de cama si pasa a UTI
    useEffect(() => {
        if (form.tipoIngreso === "UTI" && form.camaLetra) {
            setForm((p) => ({ ...p, camaLetra: "" }));
        }
    }, [form.tipoIngreso]); // eslint-disable-line react-hooks/exhaustive-deps

    const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
    const onChangeGrupo = (k) => (e) =>
        setGrupoMedico((p) => ({ ...p, [k]: e.target.value }));

    const guardar = async () => {
        const v = validarPaso(form);
        setErrors(v);
        if (Object.keys(v).length) {
            const first = document.querySelector(`.${styles.inputError}`);
            first?.scrollIntoView({ behavior: "smooth", block: "center" });
            first?.focus?.();
            return;
        }
        setSaving(true);
        try {
            const res = await guardarInternacionPami({
                pacienteDni: paciente.dni,
                pacienteData: paciente,
                opId: op.id,
                opData: op,
                grupoMedico,
                form,
                oncoplan: !!paciente.oncoplan,
                usuario: usuarioActual(),
            });
            setResultado(res);
            actualizar({
                internacion: {
                    id: res.pamiId,
                    ingresosId: res.ingresosId,
                    payload: res.payload,
                    tipoIngreso: res.tipoIngreso,
                },
            });
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
            const apellido = resultado.payload.trabajador?.apellido || "SIN_APELLIDO";
            const dni = onlyDigits(resultado.payload.trabajador?.dni) || "SIN_DNI";
            const fileName = `INT_${apellido}_${dni}.pdf`;

            const res = await fetch("/api/ingresos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload: resultado.payload,
                    fileName,
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

    /* ── Vista POST-guardado: preview + continuar ── */
    if (resultado) {
        return (
            <div className={styles.paso}>
                <h2 className={styles.titulo}>✅ Internación guardada</h2>
                <div className={styles.success}>
                    El ingreso se registró en <b>/ingresos</b> y en el historial del paciente.
                </div>
                <p className={styles.hint}>
                    ID interno: <code>{resultado.ingresosId}</code>
                </p>

                <div className={styles.pdfBox}>
                    <div>
                        <strong>Documentos de la internación</strong>
                        <p className={styles.hint}>
                            {resultado.tipoIngreso === "UTI"
                                ? "Se incluyen las planillas específicas de UTI."
                                : "Se imprimen las 8 hojas del formulario PISO."}
                        </p>
                    </div>
                    <div className={styles.actions}>
                        <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={generarPDF}
                            disabled={generandoPdf}
                        >
                            {generandoPdf ? "Generando…" : "🖨️ Generar PDF"}
                        </button>
                        {pdfUrl && (
                            <>
                                <a
                                    className={styles.btnSecondary}
                                    href={pdfUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    📂 Abrir
                                </a>
                                <a
                                    className={styles.btnSecondary}
                                    href={pdfUrl}
                                    download
                                >
                                    ⬇️ Descargar
                                </a>
                            </>
                        )}
                    </div>
                </div>

                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.btnPrimary}
                        onClick={avanzar}
                    >
                        Continuar →
                    </button>
                </div>
            </div>
        );
    }

    /* ── Formulario ── */
    return (
        <div className={styles.paso}>
            <h2 className={styles.titulo}>Internación</h2>
            <p className={styles.hint}>
                Completá los datos del ingreso. Se guarda en <b>/ingresos</b> y queda
                también en el historial del paciente PAMI.
            </p>

            {op.nroOP && (
                <div className={styles.opResumen}>
                    OP <strong>{op.nroOP}</strong>
                    {op.nroSolicitudMaterial && (
                        <>
                            {" · "}Solicitud <strong>{op.nroSolicitudMaterial}</strong>
                        </>
                    )}
                    {op.diagnostico && <> · {op.diagnostico}</>}
                    {paciente.oncoplan && (
                        <span className={styles.oncoplanBadge}>ONCOPLAN</span>
                    )}
                </div>
            )}

            <fieldset className={styles.fieldset}>
                <legend>Tipo de internación</legend>
                <div className={styles.chips}>
                    {[
                        ["PISO", "PISO"],
                        ["UTI", "UTI (Terapia)"],
                    ].map(([v, l]) => (
                        <label
                            key={v}
                            className={`${styles.chip} ${form.tipoIngreso === v ? styles.chipActive : ""
                                }`}
                        >
                            <input
                                type="radio"
                                name="tipoIngreso"
                                value={v}
                                checked={form.tipoIngreso === v}
                                onChange={onChange("tipoIngreso")}
                            />
                            {l}
                        </label>
                    ))}
                </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend>Fecha de ingreso</legend>
                <div className={styles.row3}>
                    <Campo label="Día *" error={errors.diaIngreso}>
                        <input
                            className={`${styles.input} ${errors.diaIngreso ? styles.inputError : ""
                                }`}
                            value={form.diaIngreso}
                            onChange={onChange("diaIngreso")}
                            maxLength={2}
                            inputMode="numeric"
                            placeholder="DD"
                        />
                    </Campo>
                    <Campo label="Mes *" error={errors.mesIngreso}>
                        <input
                            className={`${styles.input} ${errors.mesIngreso ? styles.inputError : ""
                                }`}
                            value={form.mesIngreso}
                            onChange={onChange("mesIngreso")}
                            maxLength={2}
                            inputMode="numeric"
                            placeholder="MM"
                        />
                    </Campo>
                    <Campo label="Año *" error={errors.anioIngreso}>
                        <input
                            className={`${styles.input} ${errors.anioIngreso ? styles.inputError : ""
                                }`}
                            value={form.anioIngreso}
                            onChange={onChange("anioIngreso")}
                            maxLength={4}
                            inputMode="numeric"
                            placeholder="AA o AAAA"
                        />
                    </Campo>
                </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend>Datos del paciente</legend>
                <div className={styles.row2}>
                    <Campo label="Apellido *" error={errors.trabajadorApellido}>
                        <input
                            className={`${styles.input} ${errors.trabajadorApellido ? styles.inputError : ""
                                }`}
                            value={form.trabajadorApellido}
                            onChange={onChange("trabajadorApellido")}
                            autoComplete="family-name"
                        />
                    </Campo>
                    <Campo label="Nombre *" error={errors.trabajadorNombre}>
                        <input
                            className={`${styles.input} ${errors.trabajadorNombre ? styles.inputError : ""
                                }`}
                            value={form.trabajadorNombre}
                            onChange={onChange("trabajadorNombre")}
                            autoComplete="given-name"
                        />
                    </Campo>
                </div>
                <div className={styles.row2}>
                    <Campo label="DNI *" error={errors.trabajadorDni}>
                        <input
                            className={`${styles.input} ${errors.trabajadorDni ? styles.inputError : ""
                                }`}
                            value={formatIdField(form.trabajadorDni)}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    trabajadorDni: onlyDigits(e.target.value),
                                }))
                            }
                            inputMode="numeric"
                            placeholder="Ej: 20.123.456"
                        />
                    </Campo>
                    <Campo label="Sexo *" error={errors.trabajadorSexo}>
                        <div className={styles.chips}>
                            {[
                                ["M", "Masculino"],
                                ["F", "Femenino"],
                            ].map(([v, l]) => (
                                <label
                                    key={v}
                                    className={`${styles.chip} ${form.trabajadorSexo === v ? styles.chipActive : ""
                                        } ${errors.trabajadorSexo ? styles.inputError : ""}`}
                                >
                                    <input
                                        type="radio"
                                        name="sexo"
                                        value={v}
                                        checked={form.trabajadorSexo === v}
                                        onChange={onChange("trabajadorSexo")}
                                    />
                                    {l}
                                </label>
                            ))}
                        </div>
                    </Campo>
                </div>
                <div className={styles.row2}>
                    <Campo label="Teléfono *" error={errors.trabajadorTelefono}>
                        <input
                            className={`${styles.input} ${errors.trabajadorTelefono ? styles.inputError : ""
                                }`}
                            value={form.trabajadorTelefono}
                            onChange={onChange("trabajadorTelefono")}
                            inputMode="tel"
                            placeholder="3456-123456"
                        />
                    </Campo>
                    <Campo label="Historia clínica">
                        <input
                            className={styles.input}
                            value={form.historiaClinica}
                            onChange={onChange("historiaClinica")}
                            placeholder="N° HC"
                        />
                    </Campo>
                </div>
                <div className={styles.row2}>
                    <Campo label="Obra social">
                        <input
                            className={styles.input}
                            value={form.OS}
                            onChange={onChange("OS")}
                            placeholder="PAMI"
                        />
                    </Campo>
                    <Campo label="N° de afiliado">
                        <input
                            className={styles.input}
                            value={form.afiliadoPaciente}
                            onChange={onChange("afiliadoPaciente")}
                        />
                    </Campo>
                </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend>Domicilio</legend>
                <div className={styles.row2}>
                    <Campo label="Calle">
                        <input
                            className={styles.input}
                            value={form.trabajadorCalle}
                            onChange={onChange("trabajadorCalle")}
                            autoComplete="address-line1"
                        />
                    </Campo>
                    <Campo label="Número">
                        <input
                            className={styles.input}
                            value={form.trabajadorNumero}
                            onChange={onChange("trabajadorNumero")}
                            inputMode="numeric"
                        />
                    </Campo>
                </div>
                <div className={styles.row2}>
                    <Campo label="Localidad">
                        <input
                            className={styles.input}
                            value={form.trabajadorLocalidad}
                            onChange={onChange("trabajadorLocalidad")}
                            autoComplete="address-level2"
                        />
                    </Campo>
                    <Campo label="Provincia">
                        <input
                            className={styles.input}
                            value={form.trabajadorProvincia}
                            onChange={onChange("trabajadorProvincia")}
                            autoComplete="address-level1"
                        />
                    </Campo>
                </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend>Datos de la internación</legend>
                <div className={styles.row2}>
                    <Campo
                        label={
                            form.tipoIngreso === "PISO"
                                ? "Cama (N° + letra opcional)"
                                : "Cama (solo N°)"
                        }
                    >
                        <div className={styles.row2}>
                            <input
                                className={styles.input}
                                value={form.camaNumero}
                                onChange={onChange("camaNumero")}
                                placeholder="N°"
                                inputMode="numeric"
                            />
                            {form.tipoIngreso === "PISO" && (
                                <input
                                    className={styles.input}
                                    value={form.camaLetra}
                                    onChange={onChange("camaLetra")}
                                    placeholder="A"
                                    maxLength={2}
                                />
                            )}
                        </div>
                    </Campo>
                    <Campo label="Médico solicitante">
                        <input
                            className={styles.input}
                            value={form.medicoSolicitante}
                            onChange={onChange("medicoSolicitante")}
                            placeholder="Apellido y nombre"
                        />
                    </Campo>
                </div>
                <Campo label="Diagnóstico de ingreso">
                    <input
                        className={styles.input}
                        value={form.diagnostico}
                        onChange={onChange("diagnostico")}
                        placeholder="Ej: Neumonía, Post-operatorio…"
                    />
                </Campo>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend>Familiar responsable</legend>
                <div className={styles.row3}>
                    <Campo label="Nombre completo">
                        <input
                            className={styles.input}
                            value={form.familiarNombre}
                            onChange={onChange("familiarNombre")}
                        />
                    </Campo>
                    <Campo label="Parentesco">
                        <input
                            className={styles.input}
                            value={form.familiarParentezco}
                            onChange={onChange("familiarParentezco")}
                        />
                    </Campo>
                    <Campo label="Teléfono">
                        <input
                            className={styles.input}
                            value={form.familiarTelefono}
                            onChange={onChange("familiarTelefono")}
                            inputMode="tel"
                        />
                    </Campo>
                </div>
            </fieldset>

            <fieldset className={styles.fieldset}>
                <legend>Grupo médico (opcional)</legend>
                <div className={styles.row2}>
                    <Campo label="Cirujano">
                        <input
                            className={styles.input}
                            value={grupoMedico.cirujano}
                            onChange={onChangeGrupo("cirujano")}
                        />
                    </Campo>
                    <Campo label="Anestesista">
                        <input
                            className={styles.input}
                            value={grupoMedico.anestesista}
                            onChange={onChangeGrupo("anestesista")}
                        />
                    </Campo>
                    <Campo label="Ayudante 1">
                        <input
                            className={styles.input}
                            value={grupoMedico.ayudante1}
                            onChange={onChangeGrupo("ayudante1")}
                        />
                    </Campo>
                    <Campo label="Ayudante 2">
                        <input
                            className={styles.input}
                            value={grupoMedico.ayudante2}
                            onChange={onChangeGrupo("ayudante2")}
                        />
                    </Campo>
                </div>
            </fieldset>

            {Object.keys(errors).length > 0 && (
                <div className={styles.warn}>
                    ⚠️ Revisá los campos marcados en rojo antes de continuar.
                </div>
            )}

            <div className={styles.actions}>
                <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={volver}
                >
                    ← Atrás
                </button>
                <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={guardar}
                    disabled={saving}
                >
                    {saving ? "Guardando…" : "Guardar internación"}
                </button>
            </div>
        </div>
    );
}

PasoInternacion.hideShellNav = true;
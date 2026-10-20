"use client";
import { useEffect, useState } from "react";
import { getSession } from "@/utils/session";
import { crearOP, listarOPsPaciente, ESTADOS_OP } from "@/lib/pami/op";
import { listarMedicos } from "@/lib/pami/medicos";
import styles from "./wizard.module.css";

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

const HOY = new Date().toISOString().slice(0, 10);

function Campo({ label, hint, error, children }) {
    return (
        <label className={styles.campo}>
            <span>{label}{hint && <small>{hint}</small>}</span>
            {children}
            {error && <div className={styles.errorText}>{error}</div>}
        </label>
    );
}

export default function Paso4OP({ estado, actualizar, avanzar, volver }) {
    const paciente = estado.paciente || {};
    const tipoEvento = estado.tipoEvento || "op";
    const pacienteKey = String(paciente.dni || "").replace(/\D/g, "");

    // Si es solo "op", no necesitamos el número obligatoriamente
    const esSoloSolicitud = tipoEvento === "op";

    const [modo, setModo] = useState("nuevo");
    const [opsExistentes, setOpsExistentes] = useState([]);
    const [opsLoading, setOpsLoading] = useState(false);
    const [opSeleccionada, setOpSeleccionada] = useState("");

    const [medicos, setMedicos] = useState([]);
    const [form, setForm] = useState({
        nroOP: "",
        nroSolicitudMaterial: "",
        diagnostico: "",
        cie10: "",
        fechaSolicitud: HOY,
        fechaAutorizacion: "",
        medicoSolicitante: "",
    });
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        listarMedicos().then(setMedicos).catch(console.warn);
        if (pacienteKey) {
            setOpsLoading(true);
            listarOPsPaciente(pacienteKey)
                .then(setOpsExistentes)
                .catch(console.warn)
                .finally(() => setOpsLoading(false));
        }
    }, [pacienteKey]);

    const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const validarNueva = () => {
        const e = {};
        // Solo pedimos diagnóstico siempre
        if (!form.diagnostico.trim()) e.diagnostico = "El diagnóstico es obligatorio";
        // Si NO es solo solicitud, le pedimos que ingrese el nro de OP
        if (!esSoloSolicitud && !form.nroOP.trim()) {
            e.nroOP = "Para continuar al evento, necesitás el N° de OP";
        }
        return e;
    };

    const guardarNueva = async () => {
        const v = validarNueva();
        setErrors(v);
        if (Object.keys(v).length) return;

        setSaving(true);
        try {
            const medicoObj = medicos.find((m) => m.nombre?.toLowerCase() === form.medicoSolicitante.toLowerCase()) || { nombre: form.medicoSolicitante };
            const op = await crearOP(
                pacienteKey,
                { dni: pacienteKey, oncoplanPaciente: !!paciente.oncoplan },
                {
                    nroOP: form.nroOP,
                    nroSolicitudMaterial: form.nroSolicitudMaterial,
                    tipo: tipoEvento,
                    diagnostico: form.diagnostico,
                    cie10: form.cie10,
                    fechaSolicitud: form.fechaSolicitud,
                    fechaAutorizacion: form.fechaAutorizacion || null,
                    medicoSolicitante: medicoObj,
                },
                { usuario: usuarioActual() }
            );

            actualizar({ op });
            avanzar();
        } catch (err) {
            console.error(err);
            alert("Error al guardar la OP: " + err.message);
        } finally {
            setSaving(false);
        }
    };

    const usarExistente = () => {
        if (!opSeleccionada) return alert("Elegí una OP");
        const op = opsExistentes.find((o) => o.id === opSeleccionada);
        if (!op) return;
        actualizar({ op });
        avanzar();
    };

    return (
        <div>
            <h2 className={styles.titulo}>Paso 4 · Orden de prestación (OP)</h2>
            <p className={styles.hint}>
                {esSoloSolicitud
                    ? "Cargá los datos del pedido. El N° de OP puede quedar vacío si PAMI aún no te lo dio."
                    : "Para generar el evento, necesitamos el N° de OP asignado por PAMI."}
            </p>

            <div className={styles.tabsOP}>
                <button
                    type="button"
                    className={`${styles.tabOP} ${modo === "nuevo" ? styles.tabOPActive : ""}`}
                    onClick={() => setModo("nuevo")}
                >
                    + Nueva Solicitud
                </button>
                {!esSoloSolicitud && (
                    <button
                        type="button"
                        className={`${styles.tabOP} ${modo === "existente" ? styles.tabOPActive : ""}`}
                        onClick={() => setModo("existente")}
                    >
                        Usar OP existente ({opsExistentes.length})
                    </button>
                )}
            </div>

            {modo === "nuevo" && (
                <>
                    <div className={styles.row2}>
                        <Campo
                            label="N° de OP"
                            hint={esSoloSolicitud ? "(opcional, se puede completar después)" : "(obligatorio)"}
                            error={errors.nroOP}
                        >
                            <input
                                className={`${styles.input} ${errors.nroOP ? styles.inputError : ""}`}
                                value={form.nroOP}
                                onChange={onChange("nroOP")}
                                placeholder="Ej: 12345678"
                            />
                        </Campo>
                        <Campo label="N° de solicitud de material" hint="(opcional)">
                            <input
                                className={styles.input}
                                value={form.nroSolicitudMaterial}
                                onChange={onChange("nroSolicitudMaterial")}
                                placeholder="Ej: 987654"
                            />
                        </Campo>
                    </div>

                    <Campo label="Diagnóstico *" error={errors.diagnostico}>
                        <input
                            className={`${styles.input} ${errors.diagnostico ? styles.inputError : ""}`}
                            value={form.diagnostico}
                            onChange={onChange("diagnostico")}
                            placeholder="Diagnóstico del pedido"
                        />
                    </Campo>

                    <div className={styles.row2}>
                        <Campo label="Código CIE-10" hint="(opcional)">
                            <input className={styles.input} value={form.cie10} onChange={onChange("cie10")} placeholder="Ej: J18.9" />
                        </Campo>
                        <Campo label="Fecha de solicitud">
                            <input className={styles.input} type="date" value={form.fechaSolicitud} onChange={onChange("fechaSolicitud")} />
                        </Campo>
                    </div>

                    <div className={styles.row2}>
                        <Campo label="Médico solicitante">
                            <input
                                className={styles.input}
                                list="medicos-list"
                                value={form.medicoSolicitante}
                                onChange={onChange("medicoSolicitante")}
                                placeholder="Apellido y nombre"
                            />
                            <datalist id="medicos-list">
                                {medicos.map((m) => <option key={m.id} value={m.nombre || ""} />)}
                            </datalist>
                        </Campo>
                    </div>

                    <div className={styles.navBar} style={{ marginTop: "1rem" }}>
                        <button type="button" className={styles.btnSecundario} onClick={volver}>
                            ← Atrás
                        </button>
                        <button type="button" className={styles.btnPrimario} onClick={guardarNueva} disabled={saving}>
                            {saving ? "Guardando…" : esSoloSolicitud ? "Guardar solicitud y finalizar" : "Guardar y continuar →"}
                        </button>
                    </div>
                </>
            )}

            {modo === "existente" && (
                <>
                    {opsLoading && <p className={styles.hint}>Cargando OPs…</p>}
                    {!opsLoading && opsExistentes.length === 0 && (
                        <p className={styles.vacio}>Este paciente no tiene OPs cargadas.</p>
                    )}
                    {!opsLoading && opsExistentes.length > 0 && (
                        <Campo label="Seleccionar OP">
                            <select className={styles.input} value={opSeleccionada} onChange={(e) => setOpSeleccionada(e.target.value)}>
                                <option value="">— Elegí una OP —</option>
                                {opsExistentes.map((o) => (
                                    <option key={o.id} value={o.id}>
                                        OP {o.nroOP || "(Sin N°)"} · {o.diagnostico || "Sin diagnóstico"}
                                    </option>
                                ))}
                            </select>
                        </Campo>
                    )}

                    <div className={styles.navBar} style={{ marginTop: "1rem" }}>
                        <button type="button" className={styles.btnSecundario} onClick={volver}>← Atrás</button>
                        <button type="button" className={styles.btnPrimario} onClick={usarExistente} disabled={!opSeleccionada}>
                            Usar esta OP y continuar →
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
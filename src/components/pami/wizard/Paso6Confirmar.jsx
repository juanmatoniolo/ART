"use client";
import { useRouter } from "next/navigation";
import styles from "./wizard.module.css";

function Row({ label, children }) {
    return (
        <div className={styles.resumenRow}>
            <dt>{label}</dt>
            <dd>{children || "—"}</dd>
        </div>
    );
}

const TIPO_LABELS = {
    op: "Solo Solicitud de OP",
    internacion: "Internación",
    cirugia: "Cirugía",
    estudio: "Estudio / Práctica",
};

export default function Paso6Confirmar({ estado, onFinish }) {
    const router = useRouter();
    const paciente = estado.paciente || {};
    const op = estado.op || {};
    const tipoEvento = estado.tipoEvento || "op";

    // El evento solo existe si es internación o cirugía
    const evento = tipoEvento === "cirugia"
        ? estado.cirugia
        : tipoEvento === "internacion"
            ? estado.internacion
            : null;

    const esSoloSolicitud = tipoEvento === "op";
    const opPendiente = !op.nroOP || op.nroOP.trim() === "";

    // Rutas adaptadas a tu estructura de carpetas (/administrador/pami/...)
    const irAlPaciente = () => router.push(`/administrador/pami/pacientes/${paciente.dni}`);
    const irAlDashboard = () => router.push("/administrador/pami");
    const nuevaOP = () => router.push("/administrador/pami/nuevo");

    return (
        <div>
            <h2 className={styles.titulo}>
                {esSoloSolicitud ? "✓ Solicitud guardada" : "✓ Todo listo"}
            </h2>

            <p className={styles.hint}>
                {esSoloSolicitud
                    ? "La solicitud de OP fue registrada correctamente. Podés ir al perfil del paciente para completar los datos de la internación o cirugía cuando PAMI te asigne el número."
                    : "El evento fue guardado exitosamente. Podés ir al perfil del paciente o generar una nueva OP."}
            </p>

            {opPendiente && esSoloSolicitud && (
                <div style={{
                    padding: ".85rem 1rem",
                    marginBottom: "1rem",
                    borderRadius: "10px",
                    background: "rgba(245, 158, 11, 0.14)",
                    border: "1px solid rgba(245, 158, 11, 0.35)",
                    color: "#f0c073",
                    fontSize: ".85rem",
                    lineHeight: 1.5
                }}>
                    ⚠️ <strong>Número de OP pendiente:</strong> Una vez que PAMI te asigne el número de autorización, entrá a la ficha del paciente y completá la internación o cirugía vinculándola a esta solicitud.
                </div>
            )}

            <dl className={styles.resumen}>
                <Row label="Paciente">
                    {paciente.nombreCompleto || `${paciente.apellido || ""} ${paciente.nombre || ""}`.trim()}
                    {paciente.oncoplan && (
                        <span
                            style={{
                                marginLeft: ".5rem",
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "#e11d48",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: 10,
                                letterSpacing: 0.6,
                            }}
                        >
                            ONCOPLAN
                        </span>
                    )}
                </Row>
                <Row label="DNI">{paciente.dni}</Row>
                <Row label="Afiliado">{paciente.afiliado}</Row>

                <Row label="Tipo de registro">
                    {TIPO_LABELS[tipoEvento] || tipoEvento}
                </Row>

                <Row label="N° de OP">
                    {op.nroOP ? (
                        <strong>{op.nroOP}</strong>
                    ) : (
                        <span style={{ color: "#f0c073", fontWeight: 600 }}>Pendiente de asignación (PAMI)</span>
                    )}
                    {op.nroSolicitudMaterial && ` · Solicitud mat. ${op.nroSolicitudMaterial}`}
                </Row>

                <Row label="Diagnóstico">{op.diagnostico}</Row>

                {/* Si se generó un ingreso (internación/cirugía), mostramos el ID */}
                {evento?.ingresosId && (
                    <Row label="ID del ingreso">
                        <code style={{ fontSize: ".85rem", opacity: .8 }}>{evento.ingresosId}</code>
                    </Row>
                )}
            </dl>

            <div className={styles.resumenAcciones}>
                <button type="button" className={styles.btnSecundario} onClick={irAlDashboard}>
                    Ir al dashboard
                </button>
                <button type="button" className={styles.btnSecundario} onClick={nuevaOP}>
                    + Nueva OP
                </button>
                <button type="button" className={styles.btnPrimario} onClick={irAlPaciente}>
                    Ver ficha del paciente →
                </button>
            </div>
        </div>
    );
}

Paso6Confirmar.hideShellNav = true;
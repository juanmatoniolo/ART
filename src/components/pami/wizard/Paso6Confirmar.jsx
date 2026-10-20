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
    material: "Material de Cirugía",
    internacion: "Internación",
    cirugia: "Cirugía",
};

export default function Paso6Confirmar({ estado, onFinish }) {
    const router = useRouter();
    const paciente = estado.paciente || {};
    const op = estado.op || {};
    const tipoEvento = estado.tipoEvento || "op";

    const irAlPaciente = () => router.push(`/administrador/pami/pacientes/${paciente.dni}`);
    const irAlDashboard = () => router.push("/administrador/pami");

    // Redirige al formulario de ingresos con los datos precargados para generar el PDF
    const irAGenerarPDF = () => {
        router.push(`/ingresos?dni=${paciente.dni}&os=PAMI&opId=${op.id || ""}&tipo=${tipoEvento}`);
    };

    const requiereGenerarPDF = tipoEvento === "internacion" || tipoEvento === "cirugia";

    return (
        <div>
            <h2 className={styles.titulo}>✓ Todo listo</h2>
            <p className={styles.hint}>
                {requiereGenerarPDF
                    ? "La OP se ha guardado y vinculado. El próximo paso es completar los datos del ingreso para generar el documento oficial."
                    : "La solicitud de OP fue registrada correctamente. Podés ir al perfil del paciente para continuar."}
            </p>

            {!op.nroOP && tipoEvento === "op" && (
                <div style={{ padding: "1rem", marginBottom: "1rem", borderRadius: "10px", background: "rgba(245, 158, 11, 0.14)", border: "1px solid rgba(245, 158, 11, 0.35)", color: "#f0c073", fontSize: ".85rem" }}>
                    ⚠️ <strong>Número de OP pendiente:</strong> Una vez que PAMI te asigne el número, entrá a la ficha del paciente para completarlo.
                </div>
            )}

            <dl className={styles.resumen}>
                <Row label="Paciente">
                    {paciente.nombreCompleto || `${paciente.apellido || ""} ${paciente.nombre || ""}`.trim()}
                    {paciente.oncoplan && (
                        <span style={{ marginLeft: ".5rem", padding: "1px 6px", borderRadius: 4, background: "#e11d48", color: "#fff", fontWeight: 700, fontSize: 10 }}>
                            ONCOPLAN
                        </span>
                    )}
                </Row>
                <Row label="DNI">{paciente.dni}</Row>
                <Row label="Afiliado">{paciente.afiliado}</Row>

                <Row label="Tipo de registro">
                    {TIPO_LABELS[tipoEvento] || tipoEvento}
                </Row>

                {tipoEvento === "op" || tipoEvento === "material" ? (
                    <>
                        <Row label="N° de OP">
                            {op.nroOP ? <strong>{op.nroOP}</strong> : <span style={{ color: "#f0c073", fontWeight: 600 }}>Pendiente (PAMI)</span>}
                        </Row>
                        <Row label="Diagnóstico">{op.diagnostico}</Row>
                    </>
                ) : (
                    <Row label="OP Vinculada">
                        {op.nroOP ? `OP ${op.nroOP} · ${op.diagnostico}` : "Vinculada sin número"}
                    </Row>
                )}

                {estado.borradorCreado && (
                    <Row label="Medicación">Se generó un borrador de medicación asociado.</Row>
                )}
            </dl>

            <div className={styles.resumenAcciones}>
                <button type="button" className={styles.btnSecundario} onClick={irAlDashboard}>
                    Ir al Dashboard
                </button>

                {requiereGenerarPDF ? (
                    <button
                        type="button"
                        className={styles.btnPrimario}
                        onClick={irAGenerarPDF}
                        style={{ background: "#2563eb", borderColor: "#2563eb" }}
                    >
                        🏥 Completar Ingreso y Generar PDF →
                    </button>
                ) : (
                    <button type="button" className={styles.btnPrimario} onClick={irAlPaciente}>
                        Ver ficha del paciente →
                    </button>
                )}
            </div>
        </div>
    );
}

Paso6Confirmar.hideShellNav = true;
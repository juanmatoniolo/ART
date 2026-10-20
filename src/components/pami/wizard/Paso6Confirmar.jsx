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

export default function Paso6Confirmar({ estado, onFinish }) {
    const router = useRouter();
    const paciente = estado.paciente || {};
    const op = estado.op || {};

    const irAlDashboard = () => router.push("/administrador/pami");
    const irAlPaciente = () => router.push(`/administrador/pami/pacientes/${paciente.dni}`);

    return (
        <div>
            <h2 className={styles.titulo}>✓ Trámite guardado</h2>
            <p className={styles.hint}>El registro se generó con éxito.</p>

            <dl className={styles.resumen}>
                <Row label="Paciente">
                    {paciente.nombreCompleto || `${paciente.apellido || ""} ${paciente.nombre || ""}`.trim()}
                </Row>
                <Row label="DNI">{paciente.dni}</Row>
                <Row label="Tipo de trámite">
                    {estado.tipoEvento === "op" ? "Solicitud de OP" :
                        estado.tipoEvento === "material" ? "Material de Cirugía" :
                            estado.tipoEvento === "internacion" ? "Internación" : "Cirugía"}
                </Row>

                {op?.nroOP && <Row label="N° de OP">{op.nroOP}</Row>}
                {op?.diagnostico && <Row label="Diagnóstico">{op.diagnostico}</Row>}
                {estado.borradorCreado && <Row label="Presupuesto">Se guardó un borrador de medicación.</Row>}
            </dl>

            <div className={styles.resumenAcciones}>
                <button type="button" className={styles.btnSecundario} onClick={irAlDashboard}>
                    Ir al Dashboard
                </button>
                <button type="button" className={styles.btnPrimario} onClick={irAlPaciente}>
                    Ver Ficha del Paciente →
                </button>
            </div>
        </div>
    );
}

Paso6Confirmar.hideShellNav = true;
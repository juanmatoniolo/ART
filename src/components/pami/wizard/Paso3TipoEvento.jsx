"use client";
import styles from "./wizard.module.css";

const OPCIONES = [
    {
        id: "op",
        icon: "📄",
        label: "Solo Solicitud de OP",
        desc: "Registrar el pedido. Quedará abierto hasta que PAMI asigne el número.",
    },
    {
        id: "internacion",
        icon: "🏥",
        label: "Internación",
        desc: "Internar al paciente (PISO o UTI).",
    },
    {
        id: "cirugia",
        icon: "🔪",
        label: "Cirugía",
        desc: "Programar una práctica quirúrgica.",
    },
    {
        id: "estudio",
        icon: "🔬",
        label: "Estudio / Práctica",
        desc: "Registrar un estudio médico o práctica ambulatoria.",
    }
];

export default function Paso3TipoEvento({ estado, actualizar }) {
    const seleccionado = estado.tipoEvento || null;

    return (
        <div>
            <h2 className={styles.titulo}>Paso 3 · ¿Qué vamos a hacer?</h2>
            <p className={styles.hint}>
                Elegí si querés solo registrar el pedido a PAMI o si ya tenés los datos para generar la internación/cirugía.
            </p>

            <div className={styles.opcionesGrid}>
                {OPCIONES.map((op) => (
                    <button
                        key={op.id}
                        type="button"
                        className={`${styles.opcionCard} ${seleccionado === op.id ? styles.opcionCardActive : ""}`}
                        onClick={() => actualizar({ tipoEvento: op.id })}
                    >
                        <span className={styles.opcionIcon}>{op.icon}</span>
                        <span className={styles.opcionLabel}>{op.label}</span>
                        <span className={styles.opcionDesc}>{op.desc}</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
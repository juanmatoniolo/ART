"use client";
import styles from "./wizard.module.css";

export default function Paso2Oncoplan({ estado, actualizar }) {
    const paciente = estado.paciente || {};
    const [oncoplan, setOncoplan] = useState(!!paciente.oncoplan);
    const [confirmado, setConfirmado] = useState(!!paciente.oncoplanConfirmado);

    const aplicar = () => {
        actualizar({
            paciente: { ...paciente, oncoplan, oncoplanConfirmado: confirmado ? { fecha: Date.now(), por: "actual" } : null },
        });
    };

    return (
        <div>
            <h2 className={styles.titulo}>Paso 2 · Modalidad PAMI</h2>
            <p className={styles.hint}>
                Si el paciente es <strong>oncológico</strong>, todas sus OP y eventos heredan
                la etiqueta ONCOPLAN.
            </p>

            <label className={styles.toggleCard}>
                <input
                    type="checkbox"
                    checked={oncoplan}
                    onChange={(e) => {
                        setOncoplan(e.target.checked);
                        setConfirmado(false);
                    }}
                />
                <div>
                    <strong>Paciente ONCOPLAN</strong>
                    <small>PAMI oncológico (cáncer)</small>
                </div>
            </label>

            {oncoplan && (
                <label className={styles.confirmCard}>
                    <input
                        type="checkbox"
                        checked={confirmado}
                        onChange={(e) => setConfirmado(e.target.checked)}
                    />
                    <div>
                        <strong>Confirmo que el paciente está cargado y aceptado en ONCOPLAN</strong>
                        <small>
                            Esta confirmación queda registrada con usuario y fecha, y es
                            obligatoria para generar OP oncológicas.
                        </small>
                    </div>
                </label>
            )}

            <button type="button" className={styles.btnSecundario} onClick={aplicar}>
                Guardar cambios
            </button>
        </div>
    );
}
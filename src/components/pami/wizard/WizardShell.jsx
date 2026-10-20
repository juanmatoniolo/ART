"use client";
import { useState } from "react";
import WizardStepper from "./WizardStepper";
import styles from "./wizard.module.css";

export default function WizardShell({ pasos, estadoInicial = {}, onFinish }) {
    const [pasoActual, setPasoActual] = useState(0);
    const [estado, setEstado] = useState(estadoInicial);

    const paso = pasos[pasoActual];
    const esUltimo = pasoActual === pasos.length - 1;

    const actualizar = (patch) => setEstado((s) => ({ ...s, ...patch }));
    const avanzar = () => {
        if (esUltimo) return onFinish?.(estado);
        setPasoActual((n) => Math.min(pasos.length - 1, n + 1));
    };
    const volver = () => setPasoActual((n) => Math.max(0, n - 1));

    return (
        <div className={styles.wizard}>
            <WizardStepper
                pasos={pasos}
                actual={pasoActual}
                onPaso={(i) => i <= pasoActual && setPasoActual(i)}
            />
            <div className={styles.pasoContenido}>
                {paso.render({ estado, actualizar, avanzar, volver })}
            </div>

            {!paso.hideShellNav && (
                <div className={styles.navBar}>
                    {pasoActual > 0 && (
                        <button
                            type="button"
                            className={styles.btnSecundario}
                            onClick={volver}
                        >
                            ← Atrás
                        </button>
                    )}
                    <button
                        type="button"
                        className={styles.btnPrimario}
                        onClick={() => {
                            const result = paso.onNext?.(estado, { avanzar });
                            if (result !== false) avanzar();
                        }}
                    >
                        {esUltimo ? "Finalizar" : "Siguiente →"}
                    </button>
                </div>
            )}
        </div>
    );
}
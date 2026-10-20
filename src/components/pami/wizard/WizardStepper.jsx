"use client";
import styles from "./wizard.module.css";

export default function WizardStepper({ pasos, actual, onPaso }) {
    return (
        <nav className={styles.stepper} aria-label="Pasos del wizard">
            {pasos.map((p, i) => {
                const active = i === actual;
                const done = i < actual;
                return (
                    <button
                        key={p.id}
                        type="button"
                        className={`${styles.step} ${active ? styles.stepActive : ""} ${done ? styles.stepDone : ""}`}
                        onClick={() => done && onPaso(i)}
                        disabled={!done && !active}
                        aria-current={active ? "step" : undefined}
                    >
                        <span className={styles.stepNum}>{done ? "✓" : i + 1}</span>
                        <span className={styles.stepLabel}>
                            {p.icon ? `${p.icon} ` : ""}
                            {p.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}
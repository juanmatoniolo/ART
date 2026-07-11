import styles from "../page.module.css";

export default function Stepper({ pasoActivo, setPasoActivo, pasos, pasosCompletados }) {
  return (
    <nav className={styles.stepper}>
      {pasos.map((paso) => (
        <button
          key={paso.num}
          className={`${styles.step} ${pasosCompletados[paso.num] ? styles.stepDone : ""} ${pasoActivo === paso.num ? styles.stepActive : ""}`}
          onClick={() => setPasoActivo(paso.num)}
          title={paso.label}
        >
          <span className={styles.stepNum}>{pasosCompletados[paso.num] ? "✓" : paso.num}</span>
          <span className={styles.stepLabel}>{paso.icon} {paso.label}</span>
        </button>
      ))}
    </nav>
  );
}
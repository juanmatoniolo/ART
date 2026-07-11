import styles from "../page.module.css";

export default function ResumenEnvio({ canSend, gmailUrl, faltantes, adjuntosRecordatorio, asunto, emailsActivos, paciente }) {
  return (
    <>
      <a
        href={canSend ? gmailUrl : "#"}
        className={`${styles.sendBtn} ${!canSend ? styles.sendBtnOff : ""}`}
        onClick={e => !canSend && e.preventDefault()}
        target="_blank" rel="noopener noreferrer"
      >
        {canSend ? "🚀 Abrir Gmail con mail listo" : "🔒 Completá los pasos"}
      </a>
      {!canSend && faltantes.length > 0 && (
        <div className={styles.requiredBox}>
          <p className={styles.requiredTitle}>⚠️ Faltan:</p>
          <ul className={styles.requiredList}>{faltantes.map((f, i) => <li key={i}>{f}</li>)}</ul>
        </div>
      )}
      {canSend && (
        <div className={styles.readyBox}>
          <p className={styles.readyTitle}>✅ ¡Listo para enviar!</p>
          <p className={styles.readyText}>Gmail se abrirá con todo listo. Solo adjuntá los archivos.</p>
        </div>
      )}
      {adjuntosRecordatorio.length > 0 && (
        <div className={styles.adjuntosBox}>
          <p className={styles.adjuntosTitle}>📎 No olvides adjuntar:</p>
          <ul className={styles.adjuntosList}>{adjuntosRecordatorio.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </div>
      )}
      {paciente && (
        <div className={styles.resumenCard}>
          <p className={styles.resumenTitle}>📋 Resumen</p>
          <div className={styles.resumenLine}><span className={styles.resumenLabel}>Para:</span><span className={styles.resumenValue}>{emailsActivos.length} destinatario(s)</span></div>
          <div className={styles.resumenLine}><span className={styles.resumenLabel}>Asunto:</span><span className={styles.resumenValue}>{asunto}</span></div>
        </div>
      )}
    </>
  );
}
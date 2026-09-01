import styles from "../cx-common.module.css";
import { preopStatus } from "../_utils/helpers";

export default function StatsBar({ cirugias }) {
  const pendientes = cirugias.filter((c) => !c.realizada);
  const hoy = new Date().toISOString().slice(0, 10);
  const deHoy = pendientes.filter((c) => c.fechaEstimada?.slice(0, 10) === hoy);
  const sinPreop = pendientes.filter((c) => !preopStatus(c).completo);
  const realizadas = cirugias.filter((c) => c.realizada);

  return (
    <div className={styles.statsBar}>
      <div className={styles.statCard}>
        <span className={styles.statNum}>{pendientes.length}</span>
        <span className={styles.statLabel}>Programadas</span>
      </div>
      <div className={`${styles.statCard} ${styles.statHoy}`}>
        <span className={styles.statNum}>{deHoy.length}</span>
        <span className={styles.statLabel}>Hoy</span>
      </div>
      <div className={`${styles.statCard} ${styles.statWarn}`}>
        <span className={styles.statNum}>{sinPreop.length}</span>
        <span className={styles.statLabel}>Sin preop completo</span>
      </div>
      <div className={`${styles.statCard} ${styles.statDone}`}>
        <span className={styles.statNum}>{realizadas.length}</span>
        <span className={styles.statLabel}>Realizadas</span>
      </div>
    </div>
  );
}
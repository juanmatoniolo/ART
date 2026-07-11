import styles from "../page.module.css";
import { PROVEEDORES } from "../utils/proveedores";

export default function PasoArtes({ selectedArts, toggleArt, toggleAllArts }) {
  return (
    <div className={`${styles.block} ${styles.blockHighlight}`}>
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>🏢 1. ARTs / Aseguradoras</p>
        <div className={styles.blockBadges}>
          <span className={styles.blockHint}>{selectedArts.size} seleccionada(s)</span>
          {selectedArts.size > 0 && <span className={styles.checkBadge}>✓</span>}
        </div>
      </div>
      <div className={styles.toggleRow}>
        <button className={styles.tinyBtn} onClick={() => toggleAllArts(true)}>Seleccionar todas</button>
        <button className={styles.tinyBtn} onClick={() => toggleAllArts(false)}>Limpiar</button>
      </div>
      <div className={styles.artGrid}>
        {PROVEEDORES.map(p => (
          <button
            key={p.id}
            className={`${styles.artChip} ${selectedArts.has(p.id) ? styles.artChipOn : ""}`}
            style={selectedArts.has(p.id) ? { "--c": p.color } : undefined}
            onClick={() => toggleArt(p.id)}
          >
            <span className={styles.artDot} style={{ backgroundColor: p.color }} />
            {p.nombre}
            {selectedArts.has(p.id) && <span className={styles.artCheck}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
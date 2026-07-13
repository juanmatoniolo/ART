// components/PasoArtes.jsx
import { useState } from 'react';
import styles from '../page.module.css';

export default function PasoArtes({ 
  arts, 
  selectedArts, 
  toggleArt, 
  toggleAllArts,
  onManageArts, // abre modal de gestión
}) {
  return (
    <div className={`${styles.block} ${styles.blockHighlight}`}>
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>🏢 1. ARTs / Aseguradoras</p>
        <div className={styles.blockBadges}>
          <span className={styles.blockHint}>{selectedArts.size} seleccionada(s)</span>
          <button className={styles.tinyBtn} onClick={onManageArts}>
            ⚙️ Gestionar
          </button>
        </div>
      </div>
      <div className={styles.toggleRow}>
        <button className={styles.tinyBtn} onClick={() => toggleAllArts(true)}>Seleccionar todas</button>
        <button className={styles.tinyBtn} onClick={() => toggleAllArts(false)}>Limpiar</button>
      </div>
      <div className={styles.artGrid}>
        {arts.map(p => (
          <button
            key={p.id}
            className={`${styles.artChip} ${selectedArts.has(p.id) ? styles.artChipOn : ""}`}
            style={selectedArts.has(p.id) ? { "--c": p.color || '#3b82f6' } : undefined}
            onClick={() => toggleArt(p.id)}
          >
            <span className={styles.artDot} style={{ backgroundColor: p.color || '#3b82f6' }} />
            {p.nombre}
            {selectedArts.has(p.id) && <span className={styles.artCheck}>✓</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
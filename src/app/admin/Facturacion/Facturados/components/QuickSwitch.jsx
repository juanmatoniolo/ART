// src/app/admin/Facturacion/Facturados/components/QuickSwitch.jsx
import styles from '../facturados.module.css';

export default function QuickSwitch({ estado, counts, onSwitch }) {
  return (
    <div className={styles.quickSwitch}>
      <button
        className={`${styles.switchBtn} ${estado === 'borrador' ? styles.switchBtnActive : ''}`}
        onClick={() => onSwitch('borrador')}
      >📝 Borradores ({counts.borradores})</button>
      <button
        className={`${styles.switchBtn} ${estado === 'cerrado' ? styles.switchBtnActive : ''}`}
        onClick={() => onSwitch('cerrado')}
      >✅ Facturados ({counts.cerrados})</button>
      <button
        className={`${styles.switchBtn} ${estado === 'todos' ? styles.switchBtnActive : ''}`}
        onClick={() => onSwitch('todos')}
      >📄 Todos ({counts.total})</button>
    </div>
  );
}
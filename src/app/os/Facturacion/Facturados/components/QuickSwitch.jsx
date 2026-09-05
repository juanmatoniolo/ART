// src/app/admin/Facturacion/Facturados/components/QuickSwitch.jsx
import styles from './Quickswitch.module.css';

const TABS = [
  { key: 'todos', label: 'Todos', countKey: 'total' },
  { key: 'cerrado', label: 'Facturados', countKey: 'cerrados' },
  { key: 'borrador', label: 'Borradores', countKey: 'borradores' },
];

export default function QuickSwitch({ estado, counts, onSwitch }) {
  return (
    <div className={styles.quickSwitch}>
      {TABS.map(({ key, label, countKey }) => (
        <button
          key={key}
          className={`${styles.tab} ${estado === key ? styles.tabActive : ''}`}
          onClick={() => onSwitch(key)}
        >
          {label}
          <span className={styles.count}>{counts[countKey]}</span>
        </button>
      ))}
    </div>
  );
}
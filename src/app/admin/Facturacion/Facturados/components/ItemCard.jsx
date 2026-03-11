// src/app/admin/Facturacion/Facturados/components/ItemCard.jsx
import Link from 'next/link';
import styles from '../facturados.module.css';
import { money, fmtDate, prettyLabel } from '../../utils/calculos';

export default function ItemCard({ item, isSelected, onToggleSelect, onPrintART }) {
  const isClosed = item.estado === 'cerrado';
  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.checkboxInline}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(item.id)}
          />
        </div>
        <div className={styles.state}>
          <span className={`${styles.badge} ${isClosed ? styles.badgeOk : styles.badgeDraft}`}>
            {isClosed ? 'CERRADO' : 'BORRADOR'}
          </span>
          <div className={styles.date}>📅 {fmtDate(item.fecha)}</div>
        </div>
        <div className={styles.total}>
          <span className={styles.totalLabel}>TOTAL</span>
          <span className={styles.totalValue}>$ {money(item.total || 0)}</span>
        </div>
      </div>

      <div className={styles.mainInfo}>
        <div className={styles.name}>{item.pacienteNombre || 'Sin nombre'}</div>

        <div className={styles.metaRow}>
          <span className={styles.pill}>DNI: {item.dni || '—'}</span>
          <span className={styles.pill}>Siniestro: {item.nroSiniestro || '—'}</span>
          <span className={styles.pill}>{prettyLabel(item.artNombre || 'SIN ART')}</span>
        </div>

        {isClosed ? (
          <div className={styles.facturaLine}>🧾 Factura: {item.facturaNro || '—'}</div>
        ) : (
          <div className={styles.facturaLineMuted}>📝 Pendiente de cierre</div>
        )}

        <div className={styles.actions}>
          <Link className={styles.btn} href={`/admin/Facturacion/Facturados/${item.id}`}>
            👁 Ver
          </Link>
          <Link className={styles.btn} href={`/admin/Facturacion/Nuevo?draft=${item.id}`}>
            ✏️ Editar
          </Link>
          <button className={styles.btnArt} onClick={() => onPrintART(item.id)}>
            🖨️ ART
          </button>
        </div>
      </div>
    </article>
  );
}
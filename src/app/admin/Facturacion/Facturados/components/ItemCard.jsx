// src/app/admin/Facturacion/Facturados/components/ItemCard.jsx
import Link from 'next/link';
import styles from './itemcard.module.css';
import { money, fmtDate, prettyLabel } from '../../utils/calculos';

export default function ItemCard({ item, isSelected, onToggleSelect, onPrintART }) {
  const isClosed = item.estado === 'cerrado';

  return (
    <article className={`${styles.card} ${isSelected ? styles.selected : ''}`}>

      {/* ── Franja superior: checkbox · estado · fecha · total ── */}
      <div className={styles.cardTop}>
        <input
          type="checkbox"
          className={styles.chk}
          checked={isSelected}
          onChange={() => onToggleSelect(item.id)}
        />

        {/*       <span className={`${styles.badge} ${isClosed ? styles.badgeOk : styles.badgeDraft}`}>
          {isClosed ? 'Cerrado' : 'Borrador'}
        </span> */}

        <div className={styles.dateChip}>

          {fmtDate(item.fecha)}
        </div>

        <div className={styles.topSpacer} />

        <div className={styles.totalBlock}>
          <span className={styles.totalVal}>$ {money(item.total || 0)}</span>
        </div>
      </div>

      {/* ── Cuerpo: nombre · pills · factura · acciones ── */}
      <div className={styles.body}>
        <div className={styles.name}>{item.pacienteNombre || 'Sin nombre'}</div>

        <div className={styles.pills}>
          <span className={styles.pill}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            DNI {item.dni || '—'}
          </span>
          <span className={styles.pill}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Sin. {item.nroSiniestro || '—'}
          </span>
          <span className={styles.pill}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
            </svg>
            {prettyLabel(item.artNombre || 'Sin ART')}
          </span>
        </div>

        {isClosed ? (
          <div className={`${styles.facturaLine} ${styles.facturaOk}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Factura: {item.facturaNro || '—'}
          </div>
        ) : (
          <div className={`${styles.facturaLine} ${styles.facturaMuted}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Pendiente de cierre
          </div>
        )}

        <div className={styles.actions}>
          <Link className={`${styles.actBtn} ${styles.btnView}`}
            href={`/admin/Facturacion/Facturados/${item.id}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Ver
          </Link>

          <Link className={`${styles.actBtn} ${styles.btnEdit}`}
            href={`/admin/Facturacion/Nuevo?draft=${item.id}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Editar
          </Link>

          <button className={`${styles.actBtn} ${styles.btnArt}`}
            onClick={() => onPrintART(item.id)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            ART
          </button>
        </div>
      </div>
    </article>
  );
}
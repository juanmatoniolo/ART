// src/app/admin/Facturacion/Facturados/components/Header.jsx
import Link from 'next/link';
import styles from './header.module.css';

export default function Header({ selectedCount, onExport, onDelete, deleting }) {
  return (
    <div className={styles.header}>

      {/* ── Top: brand + acciones ── */}
      <div className={styles.top}>
        <div className={styles.brand}>
          <div className={styles.icon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="2" />
              <path d="M9 12h6M9 16h4" />
            </svg>
          </div>
          <div className={styles.brandText}>
            <h1 className={styles.title}>Siniestros facturados</h1>
            <p className={styles.subtitle}>Seleccioná, editá o exportá plantillas para ART</p>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/admin/Facturacion" className={styles.btnGhost}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
            Volver
          </Link>

          <div className={styles.dividerV} />

          <Link href="/admin/Facturacion/Nuevo" className={styles.btnPrimary}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7-7 7 7" />
            </svg>
            Nueva factura
          </Link>

          <button
            className={styles.btnExport}
            onClick={onExport}
            disabled={selectedCount === 0}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v10m0 0l-3-3m3 3l3-3M5 15v3a2 2 0 002 2h10a2 2 0 002-2v-3" />
            </svg>
            Exportar Excel
          </button>

          <button
            className={styles.btnDanger}
            onClick={onDelete}
            disabled={selectedCount === 0 || deleting}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4h6v2" />
            </svg>
            {deleting ? 'Eliminando…' : 'Eliminar selec.'}
          </button>
        </div>
      </div>



    </div>
  );
}
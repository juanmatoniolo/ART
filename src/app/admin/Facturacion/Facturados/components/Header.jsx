// src/app/admin/Facturacion/Facturados/components/Header.jsx
import Link from 'next/link';
import styles from '../facturados.module.css';

export default function Header({ selectedCount, onExport, onDelete, deleting }) {
  return (
    <div className={styles.headerTop}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>📋 Siniestros</h1>
        <p className={styles.subtitle}>Seleccioná, editá o exportá plantillas para ART</p>
      </div>

      <div className={styles.headerActions}>
        <Link href="/admin/Facturacion" className={styles.btnGhost}>← Volver</Link>
        <Link href="/admin/Facturacion/Nuevo" className={styles.btnPrimary}>➕ Nueva factura</Link>
        <button
          className={styles.btnPrimary}
          onClick={onExport}
          disabled={selectedCount === 0}
        >
          📊 Exportar Excel completo
        </button>
        <button
          className={styles.btnDanger}
          onClick={onDelete}
          disabled={selectedCount === 0 || deleting}
        >
          {deleting ? 'Eliminando...' : '🗑️ Eliminar seleccionados'}
        </button>
      </div>
    </div>
  );
}
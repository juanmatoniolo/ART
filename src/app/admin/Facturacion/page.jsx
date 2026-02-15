'use client';

import Link from 'next/link';
import { ConvenioProvider } from './components/ConvenioContext';
import styles from './facturacionDashboard.module.css';

export default function FacturacionDashboardPage() {
  return (
    <ConvenioProvider>
      <div className={styles.page}>
        <header className={styles.header}>
          <h1 className={styles.title}>🧾 Facturación</h1>
          <p className={styles.subtitle}>
            Elegí si querés <b>cargar una factura nueva</b> o <b>ver / retomar</b> siniestros ya guardados.
          </p>
        </header>

        <section className={styles.grid}>
          <Link href="/admin/Facturacion/Nuevo" className={`${styles.card} ${styles.cardPrimary}`}>
            <div className={styles.cardIcon}>➕</div>
            <div className={styles.cardTitle}>Nuevo</div>
            <div className={styles.cardDesc}>
              Cargar una factura desde cero con prácticas, cirugías, laboratorio, medicación y descartables.
            </div>
            <div className={styles.cardCta}>Ir a cargar →</div>
          </Link>

          <Link href="/admin/Facturacion/Facturados" className={`${styles.card} ${styles.cardSecondary}`}>
            <div className={styles.cardIcon}>📦</div>
            <div className={styles.cardTitle}>Facturados</div>
            <div className={styles.cardDesc}>
              Ver todos los siniestros <b>guardados</b> y <b>cerrados</b>. Descargar cuando lo necesites.
            </div>
            <div className={styles.cardCta}>Ir a ver →</div>
          </Link>
        </section>

        <footer className={styles.footer}>
          <span className={styles.note}>💾 Todo se lee/guarda en Firebase Realtime Database.</span>
        </footer>
      </div>
    </ConvenioProvider>
  );
}

// app/os/inicio/page.jsx
import Link from 'next/link';
import { Receipt, Handshake, ChevronRight } from 'lucide-react';
import styles from '../os.module.css';

const ACCESOS = [
  {
    href: '/os/med-descartables',
    title: 'Facturación',
    desc: 'Presupuestos de medicación y descartables.',
    icon: Receipt,
  },
  {
    href: '/os/conveniosos',
    title: 'Convenios',
    desc: 'Consultar y cargar convenios de obras sociales.',
    icon: Handshake,
  },
];

export default function InicioPage() {
  return (
    <div className={styles.home}>
      <h1 className={styles.homeTitle}>Panel de Obras Sociales</h1>
      <p className={styles.homeSubtitle}>Elegí una sección para empezar.</p>
      <div className={styles.cards}>
        {ACCESOS.map(({ href, title, desc, icon: Icon }) => (
          <Link key={href} href={href} className={styles.card}>
            <span className={styles.cardIcon}>
              <Icon size={22} aria-hidden />
            </span>
            <span className={styles.cardBody}>
              <strong>{title}</strong>
              <span>{desc}</span>
            </span>
            <ChevronRight size={20} className={styles.cardArrow} aria-hidden />
          </Link>
        ))}
      </div>
    </div>
  );
}

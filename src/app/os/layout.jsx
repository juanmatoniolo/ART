'use client';

import AppShell from '@/components/AppShell/AppShell';
import { Receipt, Handshake } from 'lucide-react';
import styles from './os.module.css';

const NAV_ITEMS = [
  { href: '/med-descartables', label: 'Facturación', icon: Receipt },
  { href: '/conveniosos', label: 'Convenios', icon: Handshake },
];


export default function OSLayout({ children }) {
  return (
    <AppShell
      basePath="/os"
      homeHref="/os/inicio"
      navItems={NAV_ITEMS}
      allowedRoles={["OS"]}
    >
      <div className={styles.scope}>{children}</div>
    </AppShell>
  );
}

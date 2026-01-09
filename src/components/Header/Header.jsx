'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Stethoscope, Home, FileText, ClipboardList } from 'lucide-react';
import styles from './Header.module.css';

export default function Header() {
    const pathname = usePathname();

    return (
        <header className={styles.header}>
            <div className={styles.left}>
                <Stethoscope size={22} aria-hidden />
                <span className={styles.brand}>Clínica de la Unión S.A.</span>
            </div>

            <nav className={styles.nav}>
                <Link
                    href="/"
                    className={`${styles.navLink} ${pathname === '/' ? styles.active : ''}`}
                >
                    <Home size={16} />
                    Inicio
                </Link>

                <Link
                    href="/Siniestro"
                    className={`${styles.navLink} ${pathname.startsWith('/Siniestro') ? styles.active : ''}`}
                >
                    <FileText size={16} />
                    Siniestros
                </Link>

                <Link
                    href="/cx"
                    className={`${styles.navLink} ${pathname.startsWith('/cx') ? styles.active : ''}`}
                >
                    <ClipboardList size={16} />
                    Formulario CX
                </Link>
            </nav>
        </header>
    );
}

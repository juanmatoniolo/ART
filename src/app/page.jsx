'use client';

import Link from 'next/link';
import styles from './page.module.css';
import { LogIn } from 'lucide-react';
import Header from '@/components/Header/Header';

export default function HomePage() {
  return (
    <div className={styles.wrapper}>
      <Header />

      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="title">
          <h1 id="title" className={styles.title}>
            Sistema de Gestión Médica
          </h1>

          <p className={styles.subtitle}>
            Acceda para gestionar pacientes y registros clínicos.
          </p>

          <Link href="/login" className={`${styles.btn} ${styles.btnSecondary}`}>
            <LogIn size={18} aria-hidden="true" />
            Ingresar
          </Link>
        </section>
      </main>

      <footer className={styles.footer}>
        © {new Date().getFullYear()} Clínica de la Unión S.A.
      </footer>
    </div>
  );
}

'use client';

import Link from 'next/link';
import styles from './page.module.css';
import { Stethoscope, LogIn, UserPlus } from 'lucide-react';

export default function HomePage() {
  return (
    <div className={styles.wrapper}>
      {/* Header minimal */}
      <header className={styles.header}>
        <div className={styles.brand}>
          <Stethoscope size={22} aria-hidden="true" />
          <span>Clínica de la Unión S.A.</span>
        </div>
      </header>

      {/* Hero minimal */}
      <main className={styles.main}>
        <section className={styles.card} aria-labelledby="title">
          <h1 id="title" className={styles.title}>
            Sistema de Gestión Médica
          </h1>
          <p className={styles.subtitle}>
            Acceda para gestionar pacientes y registros clínicos.
          </p>

          <div className={styles.actions}>
            <Link href="/login" className={`${styles.btn} ${styles.btnPrimary}`}>
              <LogIn size={18} aria-hidden="true" />
              Iniciar sesión
            </Link>
            <Link href="/register" className={`${styles.btn} ${styles.btnSecondary}`}>
              <UserPlus size={18} aria-hidden="true" />
              Registrarse
            </Link>
          </div>
        </section>
      </main>

      {/* Footer minimal */}
      <footer className={styles.footer}>
        © {new Date().getFullYear()} Clínica de la Unión S.A.
      </footer>
    </div>
  );
}

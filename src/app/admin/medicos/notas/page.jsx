'use client';

import Link from 'next/link';
import styles from '../medicos.module.css';

export default function NotasPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>📝 Notas de Médicos</h1>
        <Link href="/admin/medicos" className={styles.btnSecondary}>
          ← Volver
        </Link>
      </header>
      <p>Aquí podrás gestionar notas generales sobre los médicos.</p>
      {/* Puedes agregar un editor de texto o lista de notas */}
    </div>
  );
}
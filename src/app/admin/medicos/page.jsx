'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import useDoctors from './hooks/useDoctors';
import styles from './medicos.module.css';

export default function MedicosPage() {
  const { doctors, loading, deleteDoctor } = useDoctors();
  const [search, setSearch] = useState('');

  const doctoresFiltrados = useMemo(() => {
    const q = search.toLowerCase();
    return doctors.filter(
      (d) =>
        !q ||
        d.apellido?.toLowerCase().includes(q) ||
        d.nombre?.toLowerCase().includes(q) ||
        d.matricula?.toLowerCase().includes(q) ||
        d.especialidad?.toLowerCase().includes(q)
    );
  }, [doctors, search]);

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando médicos...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Médicos</h1>
        <div className={styles.headerButtons}>
          <Link href="/admin/medicos/dashboard" className={styles.btnSecondary}>
            📊 Dashboard
          </Link>
          <Link href="/admin/medicos/nuevo" className={styles.btnPrimary}>
            + Nuevo médico
          </Link>
        </div>
      </header>

      <div className={styles.searchBar}>
        <input
          type="text"
          placeholder="Buscar médico por nombre, matrícula o especialidad..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>#</th>
              <th>Apellido y nombre</th>
              <th>Matrícula</th>
              <th>Especialidad</th>
              <th>Teléfono</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {doctoresFiltrados.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  No se encontraron médicos.
                </td>
              </tr>
            ) : (
              doctoresFiltrados.map((doc, i) => (
                <tr key={doc.id}>
                  <td className={styles.numCell}>{doc.numero ?? i + 1}</td>
                  <td>
                    {doc.apellido}, {doc.nombre}
                  </td>
                  <td>{doc.matricula || '—'}</td>
                  <td>{doc.especialidad || '—'}</td>
                  <td>
                    {doc.telefono ? (
                      <a
                        href={`https://wa.me/${doc.telefono.replace(/[\s-]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.whatsappLink}
                      >
                        {doc.telefono}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <Link href={`/admin/medicos/${doc.id}`} className={styles.btnEdit}>
                        ✏️
                      </Link>
                      <button
                        className={styles.btnDelete}
                        onClick={() => deleteDoctor(doc.id)}
                        title="Eliminar médico"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
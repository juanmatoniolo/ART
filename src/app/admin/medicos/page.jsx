'use client';

import useDoctors from './hooks/useDoctors';
import Link from 'next/link';
import { FaWhatsapp } from 'react-icons/fa'; // Importamos desde react-icons
import styles from './medicos.module.css';

export default function MedicosPage() {
  const { doctors, loading, deleteDoctor } = useDoctors();

  const getWhatsAppLink = (telefono) => {
    if (!telefono) return '#';
    let numero = telefono.trim();
    if (!numero.startsWith('+')) {
      numero = numero.replace(/[\s-]/g, '');
      if (numero.startsWith('549')) {
        numero = '+' + numero;
      } else {
        numero = '+549' + numero;
      }
    }
    return `https://wa.me/${encodeURIComponent(numero)}`;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>👨‍⚕️ Médicos</h1>
        <div className={styles.headerButtons}>
          <Link href="/admin/medicos/notas" className={styles.btnSecondary}>
            📝 Notas
          </Link>
          <Link href="/admin/medicos/dashboard" className={styles.btnSecondary}>
            📊 Dashboard
          </Link>
          <Link href="/admin/medicos/nuevo" className={styles.btnPrimary}>
            + Nuevo médico
          </Link>
        </div>
      </header>

      {loading ? (
        <div className={styles.loading}>Cargando...</div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Apellido</th>
                <th>Nombre</th>
                <th>Matrícula</th>
                <th>Especialidad</th>
                <th>Teléfono</th>
                <th>Atención</th>
                <th>Acciones</th>
                <th>WhatsApp</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.apellido}</td>
                  <td>{doc.nombre}</td>
                  <td>{doc.matricula}</td>
                  <td>{doc.especialidad}</td>
                  <td>{doc.telefono}</td>
                  <td>{doc.atencion?.join(', ')}</td>
                  <td>
                    <Link href={`/admin/medicos/${doc.id}`} className={styles.btnEdit}>✏️</Link>
                    <button onClick={() => deleteDoctor(doc.id)} className={styles.btnDelete}>🗑️</button>
                  </td>
                  <td>
                    {doc.telefono ? (
                      <a
                        href={getWhatsAppLink(doc.telefono)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.btnWhatsApp}
                        title="Enviar WhatsApp"
                      >
                        <FaWhatsapp size={20} />
                      </a>
                    ) : (
                      <span className={styles.noPhone}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
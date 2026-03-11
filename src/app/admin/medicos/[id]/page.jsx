'use client';

import { useParams, useRouter } from 'next/navigation';
import useDoctors from '../hooks/useDoctors';
import DoctorForm from '../components/DoctorForm';
import { useEffect, useState } from 'react';
import styles from '../medicos.module.css';

export default function MedicoEditPage() {
  const { id } = useParams();
  const router = useRouter();
  const { doctors, createDoctor, updateDoctor } = useDoctors();
  const [initialData, setInitialData] = useState(null);

  const isNew = id === 'nuevo';

  useEffect(() => {
    if (!isNew && doctors.length > 0) {
      const found = doctors.find((d) => d.id === id);
      if (found) setInitialData(found);
      else router.push('/admin/medicos');
    }
  }, [id, doctors, isNew, router]);

  const handleSubmit = async (data) => {
    try {
      if (isNew) {
        await createDoctor(data);
      } else {
        await updateDoctor(id, data);
      }
      router.push('/admin/medicos');
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    }
  };

  if (!isNew && !initialData) return <div className={styles.loading}>Cargando...</div>;

  return (
    <div className={styles.container}>
      <h1>{isNew ? 'Nuevo médico' : 'Editar médico'}</h1>
      <DoctorForm
        initialData={initialData || {}}
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/medicos')}
      />
    </div>
  );
}
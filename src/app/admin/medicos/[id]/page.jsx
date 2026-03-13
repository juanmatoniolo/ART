'use client';

import { useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useDoctors from '../hooks/useDoctors';
import DoctorForm from '../components/DoctorForm';
import styles from '../medicos.module.css';

export default function MedicoEditPage() {
  const params = useParams();
  const id = params?.id;
  const router = useRouter();
  const { doctors, loading, createDoctor, updateDoctor } = useDoctors();

  const isNew = id === 'nuevo';

  const initialData = useMemo(() => {
    if (isNew) return {};
    return doctors.find((d) => d.id === id) || null;
  }, [doctors, id, isNew]);

  useEffect(() => {
    if (isNew) return;
    if (loading) return;

    if (!initialData) {
      router.replace('/admin/medicos');
    }
  }, [isNew, loading, initialData, router]);

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

  if (!isNew && loading) {
    return <div className={styles.loading}>Cargando...</div>;
  }

  if (!isNew && !initialData) {
    return <div className={styles.loading}>Redirigiendo...</div>;
  }

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
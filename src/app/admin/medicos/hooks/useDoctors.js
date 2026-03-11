import { useEffect, useState } from 'react';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function useDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const doctorsRef = ref(db, 'medicos');
    return onValue(doctorsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const loaded = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
        }));
        setDoctors(loaded);
      } else {
        setDoctors([]);
      }
      setLoading(false);
    });
  }, []);

  const createDoctor = async (doctorData) => {
    const newRef = push(ref(db, 'medicos'));
    await set(newRef, {
      ...doctorData,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return newRef.key;
  };

  const updateDoctor = async (id, doctorData) => {
    await update(ref(db, `medicos/${id}`), {
      ...doctorData,
      updatedAt: Date.now(),
    });
  };

  const deleteDoctor = async (id) => {
    if (window.confirm('¿Eliminar este médico?')) {
      await remove(ref(db, `medicos/${id}`));
    }
  };

  return {
    doctors,
    loading,
    createDoctor,
    updateDoctor,
    deleteDoctor,
  };
}
'use client';

import { useFarmaciaContext } from '../context/FarmaciaContext';
import CargaMasivaModal from '../components/modals/CargaMasivaModal';
import { useRouter } from 'next/navigation';

export default function CargaMasivaPage() {
  const { procesarCargaMasiva, cargarCatalogo } = useFarmaciaContext();
  const router = useRouter();

  const handleSubmit = (data) => {
    procesarCargaMasiva(data);
    router.back();
  };

  return (
    <CargaMasivaModal
      onClose={() => router.back()}
      onSubmit={handleSubmit}
      cargarCatalogo={cargarCatalogo}
    />
  );
}

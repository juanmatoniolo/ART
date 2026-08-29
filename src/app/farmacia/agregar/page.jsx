'use client';

import { useFarmaciaContext } from '../context/FarmaciaContext';
import AgregarModal from '../components/modals/AgregarModal';
import { useRouter } from 'next/navigation';

export default function AgregarPage() {
  const { agregarProducto } = useFarmaciaContext();
  const router = useRouter();

  const handleSubmit = (data) => {
    agregarProducto(data);
    router.back();
  };

  return <AgregarModal onClose={() => router.back()} onSubmit={handleSubmit} />;
}

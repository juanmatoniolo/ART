'use client';

import { useFarmaciaContext } from '../context/FarmaciaContext';
import ImportarExcelModal from '../components/modals/ImportarExcelModal';
import { useRouter } from 'next/navigation';

export default function ImportarExcelPage() {
  const { importarDesdeExcel } = useFarmaciaContext();
  const router = useRouter();

  const handleSubmit = (data) => {
    importarDesdeExcel(data);
    router.back();
  };

  return <ImportarExcelModal onClose={() => router.back()} onSubmit={handleSubmit} />;
}

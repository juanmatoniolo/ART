'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import MensajeModal from '../components/modals/MensajeModal';

export const dynamic = 'force-dynamic'; // 👈 evita el prerenderizado

export default function MensajePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mensaje = {
    texto: searchParams.get('texto') || '',
    tipo: searchParams.get('tipo') || 'info',
  };

  const handleClose = () => {
    router.back();
  };

  return <MensajeModal data={mensaje} onClose={handleClose} />;
}
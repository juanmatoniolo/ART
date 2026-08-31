import { Suspense } from 'react';
import MensajePageClient from './MensajePageClient';

export default function MensajePage() {
  return (
    <Suspense fallback={<div>Cargando...</div>}>
      <MensajePageClient />
    </Suspense>
  );
}
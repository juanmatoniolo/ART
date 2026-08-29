'use client';

import { useFarmaciaContext } from '../context/FarmaciaContext';
import MovimientosTab from '../components/MovimientosTab';

export default function MovimientosPage() {
  const { movimientos, usuarioActual, eliminarMovimiento } = useFarmaciaContext();

  return (
    <MovimientosTab
      movimientos={movimientos}
      userRole={usuarioActual?.rol || ''}
      onEliminarMovimiento={eliminarMovimiento}
    />
  );
}

'use client';

import { useFarmaciaContext } from '../context/FarmaciaContext';
import MovimientosTab from '../components/MovimientosTab';

export default function MovimientosPage() {
  const {
    movimientos,
    usuarioActual,
    eliminarMovimiento,
    editarMovimiento, // ✅ Asegúrate de obtenerlo
  } = useFarmaciaContext();

  return (
    <MovimientosTab
      movimientos={movimientos}
      userRole={usuarioActual?.TipoEmpleado || usuarioActual?.rol || ''}
      onEliminarMovimiento={eliminarMovimiento}
      onEditarMovimiento={editarMovimiento} // ✅ Pasarlo correctamente
    />
  );
}
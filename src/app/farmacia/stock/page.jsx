'use client';

import { useFarmaciaContext } from '../context/FarmaciaContext';
import StockTab from '../components/StockTab';
import { useRouter } from 'next/navigation';

export default function StockPage() {
  const { items, estadisticas, editarProducto, eliminarProducto } = useFarmaciaContext();
  const router = useRouter();

  return (
    <StockTab
      items={items}
      estadisticas={estadisticas}
      onAgregar={() => router.push('/farmacia/agregar')}
      onCargaMasiva={() => router.push('/farmacia/carga-masiva')}
      onImportar={() => router.push('/farmacia/importar-excel')}
      onReparto={() => router.push('/farmacia/reparto')}
      editarProducto={editarProducto}
      eliminarProducto={eliminarProducto}
    />
  );
}
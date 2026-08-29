'use client';

import { useFarmaciaContext } from '../context/FarmaciaContext';
import ExportarTab from '../components/ExportarTab';

export default function ExportarPage() {
  const { estadisticas, movimientos, exportarDatos } = useFarmaciaContext();

  const handleExportar = (tipo) => {
    exportarDatos({ tipo, incluirSinStock: true }, movimientos);
  };

  return (
    <ExportarTab
      estadisticas={estadisticas}
      movimientos={movimientos}
      onExportar={handleExportar}
    />
  );
}

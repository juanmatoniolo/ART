'use client';

import { useFarmaciaContext } from './context/FarmaciaContext';
import DashboardTab from './components/DashboardTab';

export default function FarmaciaDashboardPage() {
  const { estadisticas, itemsBajoStockList, movimientos } = useFarmaciaContext();

  return (
    <DashboardTab
      estadisticas={estadisticas}
      itemsBajoStockList={itemsBajoStockList}
      movimientos={movimientos}
    />
  );
}

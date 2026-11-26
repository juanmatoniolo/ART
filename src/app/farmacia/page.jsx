"use client";
import { useFarmaciaContext } from "./context/FarmaciaContext";
import DashboardTab from "./components/DashboardTab";

// El layout ya provee header, navegación y padding (.mainContent).
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

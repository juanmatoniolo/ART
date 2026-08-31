"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFarmaciaContext } from "./context/FarmaciaContext";
import StatsHeader from "@/app/farmacia/components/StatsHeader";
import DashboardTab from "./components/DashboardTab";

export default function FarmaciaDashboardPage() {
  const { estadisticas, itemsBajoStockList, movimientos } = useFarmaciaContext();
  const router = useRouter();
  const [theme, setTheme] = useState("light");
  const [loadingLogout, setLoadingLogout] = useState(false);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
    // Aquí puedes aplicar el tema al documento si lo necesitas
    document.documentElement.setAttribute("data-theme", theme === "light" ? "dark" : "light");
  };

  const handleIngresoMercaderia = () => {
    router.push("/farmacia/carga-masiva");
  };

  return (
    <div>
 
      <main style={{ padding: "2rem" }}>
        <DashboardTab
          estadisticas={estadisticas}
          itemsBajoStockList={itemsBajoStockList}
          movimientos={movimientos}
        />
      </main>
    </div>
  );
}
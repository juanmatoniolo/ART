"use client";

import RoleGate from "@/components/RoleGate/RoleGate";
import RootDashboard from "@/components/RootDashboard/RootDashboard";

// Panel ROOT: resumen, usuarios (roles múltiples, corte de servicio), permisos y paneles.
export default function RootDashboardPage() {
  return (
    <RoleGate allowed={["ROOT"]}>
      <RootDashboard />
    </RoleGate>
  );
}

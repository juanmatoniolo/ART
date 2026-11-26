"use client";
// La edición de nomencladores no está disponible para el rol OS (solo consulta).
// Entran SUPERROOT (ROOT) y ROOT (ADM); al resto RoleGate le muestra "Acceso denegado".
import RoleGate from "@/components/RoleGate/RoleGate";

export default function EditarNomencladoresLayout({ children }) {
  return <RoleGate allowed={["ADM"]}>{children}</RoleGate>;
}

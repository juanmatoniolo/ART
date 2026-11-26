"use client";

import RoleGate from "@/components/RoleGate/RoleGate";
import UsuariosManager from "@/components/UsuariosManager/UsuariosManager";

// Alta de usuarios (ADM). Roles múltiples y corte de servicio: /admin/root (ROOT).
export default function EmpleadosPage() {
  return (
    <RoleGate allowed={["ADM"]}>
      <UsuariosManager mode="adm" />
    </RoleGate>
  );
}

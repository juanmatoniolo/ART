"use client";

import RoleGate from "@/components/RoleGate/RoleGate";
import { AREAS } from "@/lib/roles";

// Exige sesión activa y un rol habilitado para esta área (ver lib/roles.js).
export default function Layout({ children }) {
  return <RoleGate allowed={AREAS["/ingresos"]}>{children}</RoleGate>;
}

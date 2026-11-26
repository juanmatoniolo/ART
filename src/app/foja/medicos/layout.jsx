"use client";

import RoleGate from "@/components/RoleGate/RoleGate";
import { AREAS } from "@/lib/roles";

// Exige sesión activa y un rol habilitado (ver lib/roles.js). La página /foja
// es pública para cargar, pero el panel de médicos no.
export default function Layout({ children }) {
  return <RoleGate allowed={AREAS["/foja"]}>{children}</RoleGate>;
}

"use client";

import AppShell from "@/components/AppShell/AppShell";
import { Users, ClipboardPlus, Pill, BookOpen, FolderTree, HardHat } from "lucide-react";

const NAV_ITEMS = [
  { href: "/comunicador", label: "Comunicador", icon: Users },
  { href: "/ingresos", label: "Ingresos", icon: ClipboardPlus },
  { href: "/pami", label: "PAMI", icon: Pill },
  { href: "/nomencladores", label: "Nomencladores", icon: BookOpen },
  { href: "/cx", label: "CX", icon: FolderTree },
  { href: "/art", label: "ART", icon: HardHat },
];

// ADM también puede entrar al panel de administrador. ROOT siempre tiene acceso.
const ALLOWED_ROLES = ["ADMINISTRADOR", "ADM"];

export default function AdministradorLayout({ children }) {
  return (
    <AppShell basePath="/administrador" navItems={NAV_ITEMS} allowedRoles={ALLOWED_ROLES}>
      {children}
    </AppShell>
  );
}

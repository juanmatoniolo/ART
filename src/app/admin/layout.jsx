"use client";

import AppShell from "@/components/AppShell/AppShell";
import {
  Users,
  FileText,
  Pill,
  BookOpen,
  FolderTree,
  Stethoscope,
  HardHat,
  ClipboardList,
  HeartPulse,
  ShieldCheck,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/comunicador", label: "Comunicador", icon: Users },
  { href: "/Facturacion", label: "Facturación", icon: FileText },
  { href: "/med-descartables", label: "Farmacia", icon: Pill },
  { href: "/pami", label: "PAMI", icon: HeartPulse },
  { href: "/nomencladores", label: "Nomencladores", icon: BookOpen },
  { href: "/cx", label: "CX", icon: FolderTree },
  { href: "/medicos", label: "Médicos", icon: Stethoscope },
  { href: "/art", label: "ART", icon: HardHat },
  { href: "/rp", label: "RP", icon: ClipboardList },
  { href: "/root", label: "Superroot", icon: ShieldCheck, roles: ["ROOT"] },
];

// ROOT siempre tiene acceso (ver hasAccess en utils/session)
const ALLOWED_ROLES = ["ADM"];

export default function AdminLayout({ children }) {
  return (
    <AppShell basePath="/admin" navItems={NAV_ITEMS} allowedRoles={ALLOWED_ROLES}>
      {children}
    </AppShell>
  );
}

"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { clearSession, getSession } from "@/utils/session";
import styles from "./page.module.css";

import {
  Home,
  Users,
  Briefcase,
  FileText,
  Pill,
  BookOpen,
  FolderTree,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const session = getSession?.();
    if (!session) {
      router.push("/login");
    }
  }, [router]);

  const cerrarSesion = () => {
    clearSession();
    router.push("/login");
  };

  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");

  // Cierra el menú móvil al navegar
  const handleLinkClick = () => {
    setMobileMenuOpen(false);
  };

  if (!isClient) {
    return <div className={styles.loading}>Cargando...</div>;
  }
const navItems = [
    { href: "/admin", label: "", icon: Home },
    { href: "/admin/comunicador", label: "Comunicador", icon: Users },
  /*   { href: "/admin/empleados", label: "Empleados", icon: Briefcase }, */
    { href: "/admin/Facturacion", label: "Facturación", icon: FileText },
    { href: "/admin/med-descartables", label: "Med + Descartables", icon: Pill },
    { href: "/admin/nomencladores", label: "Nomencladores", icon: BookOpen },
  /*   { href: "/admin/Siniestro", label: "Siniestros", icon: FolderTree }, */
    { href: "/admin/cx", label: "CX", icon: FolderTree }, 
];

  return (
    <div className={styles.layout}>
      {/* Header superior */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Image src="/logo.png" alt="Logo" width={40} height={40} priority />
          <span className={styles.brand}>Clínica Unión</span>
        </div>

        {/* Navegación desktop */}
        <nav className={styles.desktopNav}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${isActive(item.href) ? styles.active : ""}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.headerRight}>
          <button
            className={styles.iconButton}
            onClick={() => router.push("/admin/configuracion")}
            title="Configuración"
          >
            <Settings size={20} />
          </button>
          <button
            className={`${styles.iconButton} ${styles.logoutBtn}`}
            onClick={cerrarSesion}
            title="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>

          {/* Botón menú móvil */}
          <button
            className={styles.mobileMenuButton}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Menú"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {/* Menú móvil desplegable */}
      {mobileMenuOpen && (
        <div className={styles.mobileMenu}>
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.mobileNavLink} ${isActive(item.href) ? styles.active : ""}`}
                onClick={handleLinkClick}
              >
                <Icon size={20} />
                <span>{item.label}</span>
              </Link>
            );
          })}
          <div className={styles.mobileDivider} />
          <Link
            href="/admin/configuracion"
            className={styles.mobileNavLink}
            onClick={handleLinkClick}
          >
            <Settings size={20} />
            <span>Configuración</span>
          </Link>
          <button
            className={`${styles.mobileNavLink} ${styles.logoutBtn}`}
            onClick={() => { cerrarSesion(); handleLinkClick(); }}
          >
            <LogOut size={20} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      )}

      {/* Contenido principal */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
        </footer>
      </main>
    </div>
  );
}
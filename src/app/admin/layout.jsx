"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import "@/app/globals.css";
import styles from "./page.module.css";
import { clearSession, getSession } from "@/utils/session";

import {
  UserRound,        // Pacientes
  IdCard,           // Empleados
  ReceiptText,      // Facturación
  BookOpenText,     // Nomencladores
  Handshake,        // Convenios
  StickyNote,       // Utilidades
  Pill,             // Med
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import UtilidadesDueBadge from "@/components/utilidades/UtilidadesDueBadge";

export default function AdminLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);

    const s = getSession?.();
    if (!s) {
      router.push("/login");
      return;
    }
  }, [router]);

  const cerrarSesion = () => {
    clearSession();
    router.push("/login");
  };

  const isActive = (href) => pathname === href;

  if (!isClient) {
    return (
      <div className={styles.layout}>
        <div className={styles.loading}>Cargando...</div>
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      {/* === SIDEBAR === */}
      <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
        <div className={styles.sidebarHeader}>
          <Image
            src="/logo.png"
            alt="Logo"
            width={42}
            height={42}
            priority
          />
          {!collapsed && <span className={styles.brand}>Clínica Unión</span>}
        </div>

        <button
          className={styles.collapseBtn}
          onClick={() => setCollapsed((p) => !p)}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          type="button"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>

        <nav className={styles.navMenu}>
          {/* === PRINCIPAL === */}
          <Link
            href="/admin/pacientes"
            title={collapsed ? "Pacientes" : undefined}
            className={`${styles.menuItem} ${isActive("/admin/pacientes") ? styles.active : ""}`}
          >
            <UserRound size={20} />
            {!collapsed && <span>Pacientes</span>}
          </Link>

          <Link
            href="/admin/empleados"
            title={collapsed ? "Empleados" : undefined}
            className={`${styles.menuItem} ${isActive("/admin/empleados") ? styles.active : ""}`}
          >
            <IdCard size={20} />
            {!collapsed && <span>Empleados</span>}
          </Link>

          <Link
            href="/admin/Facturacion"
            title={collapsed ? "Facturación" : undefined}
            className={`${styles.menuItem} ${isActive("/admin/Facturacion") ? styles.active : ""}`}
          >
            <ReceiptText size={20} />
            {!collapsed && <span>Facturación</span>}
          </Link>

          {/* === NOMENCLADORES === */}
          <div className={styles.sectionTitle}>{!collapsed && "Nomencladores"}</div>

          <Link
            href="/admin/nomencladores"
            title={collapsed ? "Nomencladores" : undefined}
            className={`${styles.menuItem} ${isActive("/admin/nomencladores") ? styles.active : ""}`}
          >
            <BookOpenText size={20} />
            {!collapsed && <span>Nomencladores</span>}
          </Link>

          <Link
            href="/admin/nomencladores/editar"
            title={collapsed ? "Convenios" : undefined}
            className={`${styles.menuItem} ${isActive("/admin/nomencladores/editar") ? styles.active : ""}`}
          >
            <Handshake size={20} />
            {!collapsed && <span>Convenios</span>}
          </Link>

          {/* === UTILIDADES === */}
          <div className={styles.sectionTitle}>{!collapsed && "Utilidades"}</div>

          <Link
            href="/admin/utilidades"
            title={collapsed ? "Utilidades" : undefined}
            className={`${styles.menuItem} ${isActive("/admin/utilidades") ? styles.active : ""}`}
          >
            <StickyNote size={20} />

            {!collapsed ? (
              <span className={styles.menuText}>
                Utilidades
                <UtilidadesDueBadge className={styles.utilBadge} />
              </span>
            ) : (
              <UtilidadesDueBadge className={styles.utilBadgeCollapsed} />
            )}
          </Link>

          <Link
            href="/admin/med-descartables"
            title={collapsed ? "Med + Descartables" : undefined}
            className={`${styles.menuItem} ${isActive("/admin/med-descartables") ? styles.active : ""}`}
          >
            <span className={styles.iconStack} aria-hidden="true">
              <Pill size={18} />
            </span>
            {!collapsed && <span>Med + Descartables</span>}
          </Link>

          {/* === USUARIO === */}
          <div className={styles.sectionTitle}>{!collapsed && "Usuario"}</div>

          <button
            className={styles.menuItem}
            onClick={() => router.push("/admin/configuracion")}
            title={collapsed ? "Configuración" : undefined}
            type="button"
          >
            <Settings size={20} />
            {!collapsed && <span>Configuración</span>}
          </button>

          <button
            className={`${styles.menuItem} ${styles.logoutBtn}`}
            onClick={cerrarSesion}
            title={collapsed ? "Cerrar sesión" : undefined}
            type="button"
          >
            <LogOut size={20} />
            {!collapsed && <span>Cerrar sesión</span>}
          </button>
        </nav>
      </aside>

      {/* === CONTENIDO === */}
      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
        </footer>
      </main>
    </div>
  );
}

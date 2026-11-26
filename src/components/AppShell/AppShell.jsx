"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Settings, LogOut, Menu, X, LayoutGrid, ChevronDown } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { canUse, panelsFor, roleLabel } from "@/lib/roles";
import RoleGate from "@/components/RoleGate/RoleGate";
import styles from "./AppShell.module.css";

/**
 * Layout compartido para los paneles internos.
 *
 * @param {string}   basePath     Ruta raíz del panel, ej. "/admin".
 * @param {Array}    navItems     [{ href, label, icon, roles?, group? }]. href relativo a basePath.
 *                                Los ítems con el mismo group se muestran como un menú desplegable.
 *                                Con roles, el ítem solo se muestra a esos roles (ROOT ve todo).
 * @param {string[]} allowedRoles Roles que pueden entrar (ids o nombres). ROOT entra siempre.
 * @param {Function} [canAccess]  (usuario) => boolean. Si se pasa, reemplaza a allowedRoles.
 * @param {string}   [homeHref]   Destino de "Inicio" (por defecto basePath).
 * @param {string|null} [settingsHref] Ruta de configuración; null la oculta.
 */
export default function AppShell({ allowedRoles = "*", canAccess, ...props }) {
  return (
    <RoleGate allowed={allowedRoles.length === 0 ? "*" : allowedRoles} check={canAccess}>
      <Shell {...props} />
    </RoleGate>
  );
}

function Shell({
  basePath,
  navItems,
  homeHref = basePath,
  settingsHref = `${basePath}/configuracion`,
  children,
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { usuario, logout } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);

  // Cerrar menús al navegar y bloquear el scroll del fondo mientras el menú móvil está abierto
  useEffect(() => {
    setMenuOpen(false);
    setOpenGroup(null);
  }, [pathname]);
  // Cerrar el desplegable con click afuera o Escape
  useEffect(() => {
    if (!openGroup) return;
    const close = (e) => {
      if (e.type === "keydown" ? e.key === "Escape" : !e.target.closest?.("[data-navgroup]")) setOpenGroup(null);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", close);
    };
  }, [openGroup]);
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  const cerrarSesion = async () => {
    await logout();
    router.push("/login");
  };

  const roles = usuario?.roles || [];
  // El logo es el botón de inicio (no hay ítem "Inicio" en el menú)
  const items = navItems
    .filter((i) => !i.roles || canUse(roles, i.roles))
    .map((i) => ({ ...i, href: basePath + i.href }));

  const isActive = (href) =>
    href === homeHref ? pathname === homeHref || pathname === basePath : pathname === href || pathname.startsWith(href + "/");

  // Agrupar: cada grupo aparece donde está su primer ítem
  const entries = [];
  for (const item of items) {
    if (!item.group) entries.push(item);
    else {
      const g = entries.find((e) => e.group === item.group && e.items);
      if (g) g.items.push(item);
      else entries.push({ group: item.group, items: [item] });
    }
  }

  const userName = usuario?.nombre || usuario?.user || "";
  const allRoles = roles.map(roleLabel).join(" · ");
  // Otros paneles a los que puede ir (usuarios con varios roles)
  const otherPanels = panelsFor(roles).filter((p) => !p.href.startsWith(basePath));

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <Link
          href={homeHref}
          className={`${styles.headerLeft} ${pathname === homeHref || pathname === basePath ? styles.homeActive : ""}`}
          aria-label="Ir al inicio"
          title="Inicio"
        >
          <Image src="/logo.png" alt="" width={36} height={36} priority />
          <span className={styles.brandText}>
            <span>Clínica</span>
            <span>Unión</span>
          </span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Secciones">
          {entries.map((e) =>
            e.items ? (
              <div key={e.group} className={styles.navGroup} data-navgroup>
                <button
                  type="button"
                  className={`${styles.navLink} ${e.items.some((i) => isActive(i.href)) ? styles.active : ""}`}
                  aria-expanded={openGroup === e.group}
                  aria-haspopup="true"
                  onClick={() => setOpenGroup((g) => (g === e.group ? null : e.group))}
                  data-allow-repeat
                >
                  <span>{e.group}</span>
                  <ChevronDown size={16} aria-hidden className={openGroup === e.group ? styles.chevOpen : ""} />
                </button>
                {openGroup === e.group && (
                  <div className={styles.navMenu} role="menu">
                    {e.items.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        role="menuitem"
                        className={`${styles.navMenuLink} ${isActive(href) ? styles.navMenuActive : ""}`}
                        aria-current={isActive(href) ? "page" : undefined}
                      >
                        <Icon size={18} aria-hidden />
                        <span>{label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={e.href}
                href={e.href}
                className={`${styles.navLink} ${isActive(e.href) ? styles.active : ""}`}
                aria-current={isActive(e.href) ? "page" : undefined}
                title={e.label}
                aria-label={e.iconOnly ? e.label : undefined}
              >
                <e.icon size={18} aria-hidden />
                {!e.iconOnly && <span>{e.label}</span>}
              </Link>
            )
          )}
        </nav>

        <div className={styles.headerRight}>
          {otherPanels.length > 0 && (
            <details className={styles.panelSwitch}>
              <summary className={styles.iconButton} title="Cambiar de panel" aria-label="Cambiar de panel">
                <LayoutGrid size={20} />
              </summary>
              <div className={styles.panelMenu}>
                {otherPanels.map((p) => (
                  <Link key={p.href} href={p.href} className={styles.panelLink}>
                    {p.label}
                  </Link>
                ))}
              </div>
            </details>
          )}
          {settingsHref && (
            <button
              className={styles.iconButton}
              onClick={() => router.push(settingsHref)}
              title="Mi cuenta y configuración"
              aria-label="Mi cuenta y configuración"
            >
              <Settings size={20} />
            </button>
          )}
          <button
            className={`${styles.iconButton} ${styles.logoutBtn}`}
            onClick={cerrarSesion}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
          <button
            className={styles.mobileMenuButton}
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </header>

      {menuOpen && (
        <nav className={styles.mobileMenu} aria-label="Secciones">
          {userName && (
            <div className={styles.mobileUser}>
              <strong>{userName}</strong>
              {allRoles && <span className={styles.userRole}>{allRoles}</span>}
            </div>
          )}
          {entries.map((e) => {
            const link = ({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`${styles.mobileNavLink} ${isActive(href) ? styles.active : ""}`}
                aria-current={isActive(href) ? "page" : undefined}
              >
                <Icon size={20} aria-hidden />
                <span>{label}</span>
              </Link>
            );
            return e.items ? (
              <div key={e.group} className={styles.mobileGroup}>
                <span className={styles.mobileSection}>{e.group}</span>
                {e.items.map(link)}
              </div>
            ) : (
              link(e)
            );
          })}
          {otherPanels.length > 0 && (
            <>
              <div className={styles.mobileDivider} />
              <span className={styles.mobileSection}>Otros paneles</span>
              {otherPanels.map((p) => (
                <Link key={p.href} href={p.href} className={styles.mobileNavLink}>
                  <LayoutGrid size={20} aria-hidden />
                  <span>{p.label}</span>
                </Link>
              ))}
            </>
          )}
          <div className={styles.mobileDivider} />
          {settingsHref && (
            <Link href={settingsHref} className={styles.mobileNavLink}>
              <Settings size={20} aria-hidden />
              <span>Configuración</span>
            </Link>
          )}
          <button className={styles.mobileNavLink} onClick={cerrarSesion}>
            <LogOut size={20} aria-hidden />
            <span>Cerrar sesión</span>
          </button>
        </nav>
      )}

      <main className={styles.main}>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
        </footer>
      </main>
    </div>
  );
}

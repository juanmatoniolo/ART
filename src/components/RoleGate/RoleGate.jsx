"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ShieldAlert, Ban, LogIn } from "lucide-react";
import { useSession } from "@/context/SessionContext";
import { canUse, panelsFor } from "@/lib/roles";
import styles from "./RoleGate.module.css";

/**
 * Protege un área: exige sesión activa y alguno de los roles permitidos.
 * @param {string[]|"*"} allowed  ids de rol (ver lib/roles). ROOT entra siempre.
 * @param {(usuario) => boolean} [check] chequeo alternativo (reemplaza a allowed).
 */
export default function RoleGate({ allowed = "*", check, children }) {
  const { status, usuario, logout } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === "anonymous") {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, router, pathname]);

  // Hasta que Firebase confirme la sesión no se monta la página:
  // así ninguna lectura a la base sale sin token.
  if (status === "loading") {
    return <div className={styles.screen}><p className={styles.muted}>Cargando…</p></div>;
  }

  if (status === "suspended") {
    return (
      <Message icon={Ban} title="Servicio suspendido">
        Tu usuario tiene el acceso cortado. Si creés que es un error, hablá con el administrador.
        <button className={styles.btn} onClick={() => router.replace("/login")}>
          <LogIn size={18} aria-hidden /> Ir al inicio de sesión
        </button>
      </Message>
    );
  }

  if (status === "noprofile") {
    return (
      <Message icon={ShieldAlert} title="Usuario sin perfil">
        Tu cuenta existe pero todavía no tiene roles asignados. Pedile al administrador que la configure.
        <button className={styles.btn} onClick={() => router.replace("/login")}>
          <LogIn size={18} aria-hidden /> Ir al inicio de sesión
        </button>
      </Message>
    );
  }

  if (!usuario) {
    return <div className={styles.screen}><p className={styles.muted}>Redirigiendo…</p></div>;
  }

  const ok = check ? check(usuario) : canUse(usuario.roles || [], allowed);
  if (!ok) {
    const panels = panelsFor(usuario.roles || []);
    return (
      <Message icon={ShieldAlert} title="Acceso denegado">
        Tu usuario no tiene permisos para esta sección.
        {panels.length > 0 && (
          <span className={styles.panels}>
            {panels.map((p) => (
              <button key={p.href} className={styles.btn} onClick={() => router.push(p.href)}>
                Ir a {p.label}
              </button>
            ))}
          </span>
        )}
        <button className={`${styles.btn} ${styles.ghost}`} onClick={() => logout().then(() => router.replace("/login"))}>
          Cerrar sesión
        </button>
      </Message>
    );
  }

  return children;
}

function Message({ icon: Icon, title, children }) {
  return (
    <div className={styles.screen}>
      <div className={styles.card} role="alert">
        <Icon size={36} className={styles.icon} aria-hidden />
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}

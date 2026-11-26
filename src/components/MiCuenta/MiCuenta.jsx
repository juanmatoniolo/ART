"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import {
  UserRound,
  ShieldCheck,
  LayoutGrid,
  Database,
  KeyRound,
  Pencil,
  Eye,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { auth } from "@/lib/firebase";
import { useSession } from "@/context/SessionContext";
import { AREAS, ROLES, canUse, isInternalEmail, roleLabel } from "@/lib/roles";
import { DATA_NODES, accessOf } from "@/lib/permissions";
import { notify } from "@/lib/notify";
import { singleFlight } from "@/lib/singleFlight";
import styles from "./MiCuenta.module.css";
import PasswordInput from "@/components/PasswordInput/PasswordInput";

const AREA_INFO = {
  "/admin": { label: "Panel Root", href: "/admin" },
  "/administrador": { label: "Panel ART", href: "/administrador" },
  "/farmacia": { label: "Farmacia", href: "/farmacia" },
  "/historia-clinica": { label: "Historias clínicas", href: "/historia-clinica" },
  "/uti": { label: "UTI", href: "/uti/admin" },
  "/foja": { label: "Fojas quirúrgicas", href: "/foja/medicos" },
  "/os": { label: "Obras sociales", href: "/os" },
  "/ingresos": { label: "Ingresos", href: "/ingresos" },
  "/Siniestro": { label: "Siniestros", href: "/Siniestro" },
  "/NomecladorNAcional": { label: "Nomenclador nacional", href: "/NomecladorNAcional" },
};

const fmt = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" });
};

export default function MiCuenta() {
  const { usuario } = useSession();
  const roles = useMemo(() => usuario?.roles || [], [usuario]);
  const meta = auth.currentUser?.metadata;

  const areas = Object.keys(AREAS).filter((a) => canUse(roles, AREAS[a]));
  const datos = useMemo(() => {
    const best = (node) => {
      const levels = roles.map((r) => accessOf(r, node));
      return levels.includes("rw") ? "rw" : levels.includes("r") ? "r" : null;
    };
    return Object.entries(DATA_NODES)
      .map(([key, n]) => ({ key, label: n.label, access: best(key) }))
      .filter((n) => n.access);
  }, [roles]);

  const especiales = [];
  if (roles.includes("ROOT")) {
    especiales.push(
      "Administrar todos los usuarios: crear, editar, asignar roles y eliminar.",
      "Cortar y restablecer el servicio de cualquier usuario.",
      "Entrar al sistema como otro usuario para ver lo mismo que ve él.",
      "Ver los permisos de cada rol y el resumen del sistema (panel Superroot)."
    );
  } else if (roles.includes("ADM")) {
    especiales.push("Dar de alta usuarios comunes y cambiarles nombre o contraseña (Empleados).");
  }

  if (!usuario) return null;
  const email = usuario.email || "";

  return (
    <div className={styles.wrap}>
      <h1 className={styles.title}>Mi cuenta</h1>

      <section className={`${styles.card} ${styles.profile}`}>
        <div className={styles.avatar} aria-hidden>
          {(usuario.nombre || "?").trim().charAt(0).toUpperCase()}
        </div>
        <div className={styles.profileBody}>
          <h2 className={styles.name}>{usuario.nombre}</h2>
          <p className={styles.muted}>{isInternalEmail(email) ? `Usuario: ${usuario.user}` : email}</p>
          <div className={styles.chips}>
            {roles.map((r) => (
              <span key={r} className={`${styles.chip} ${r === "ROOT" || r === "ADM" ? styles.chipPriv : ""}`}>
                {roleLabel(r)}
              </span>
            ))}
            <span className={`${styles.chip} ${styles.chipOk}`}>Activo</span>
          </div>
        </div>
        <dl className={styles.facts}>
          <div>
            <dt>Cuenta creada</dt>
            <dd>{fmt(meta?.creationTime)}</dd>
          </div>
          <div>
            <dt>Último ingreso</dt>
            <dd>{fmt(meta?.lastSignInTime)}</dd>
          </div>
        </dl>
      </section>

      <section className={styles.card}>
        <h2 className={styles.cardTitle}>
          <ShieldCheck size={18} aria-hidden /> Tus roles
        </h2>
        <ul className={styles.roleList}>
          {ROLES.filter((r) => roles.includes(r.id)).map((r) => (
            <li key={r.id}>
              <strong>{r.label}</strong>
              <span>{r.desc}</span>
            </li>
          ))}
        </ul>
      </section>

      {especiales.length > 0 && (
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Sparkles size={18} aria-hidden /> Acciones especiales
          </h2>
          <ul className={styles.bullets}>
            {especiales.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
          {roles.includes("ROOT") && (
            <Link href="/admin/root" className={styles.linkBtn}>
              Abrir panel Superroot <ArrowRight size={16} aria-hidden />
            </Link>
          )}
        </section>
      )}

      <div className={styles.grid2}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <LayoutGrid size={18} aria-hidden /> Paneles a los que podés entrar
          </h2>
          <ul className={styles.panelList}>
            {areas.map((a) => {
              const info = AREA_INFO[a] || { label: a, href: a };
              return (
                <li key={a}>
                  <Link href={info.href} className={styles.panelLink}>
                    {info.label} <ArrowRight size={16} aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={styles.card}>
          <h2 className={styles.cardTitle}>
            <Database size={18} aria-hidden /> Datos que podés usar
          </h2>
          {roles.includes("ROOT") || roles.includes("ADM") ? (
            <p className={styles.muted}>
              <span className={styles.rw}>
                <Pencil size={13} aria-hidden /> Lee y edita
              </span>{" "}
              todos los datos del sistema ({datos.length} secciones).
            </p>
          ) : (
          <ul className={styles.dataList}>
            {datos.map((d) => (
              <li key={d.key}>
                <span>{d.label}</span>
                {d.access === "rw" ? (
                  <span className={styles.rw}>
                    <Pencil size={13} aria-hidden /> Lee y edita
                  </span>
                ) : (
                  <span className={styles.r}>
                    <Eye size={13} aria-hidden /> Solo lectura
                  </span>
                )}
              </li>
            ))}
          </ul>
          )}
        </section>
      </div>

      {email ? <CambiarClave email={email} /> : null}
    </div>
  );
}

function CambiarClave({ email }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");

  const submit = singleFlight("micuenta:password", async (e) => {
    e.preventDefault();
    if (nueva.length < 8) return notify.warning("La contraseña nueva debe tener al menos 8 caracteres.");
    if (nueva !== repetir) return notify.warning("Las contraseñas nuevas no coinciden.");
    try {
      const user = auth.currentUser;
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(email, actual));
      await updatePassword(user, nueva);
      setActual("");
      setNueva("");
      setRepetir("");
      notify.success("Contraseña actualizada.");
    } catch (err) {
      const code = err?.code || "";
      notify.error(
        code.includes("invalid-credential") || code.includes("wrong-password")
          ? "La contraseña actual no es correcta."
          : "No se pudo cambiar la contraseña. Intentá de nuevo."
      );
    }
  });

  return (
    <section className={styles.card}>
      <h2 className={styles.cardTitle}>
        <KeyRound size={18} aria-hidden /> Cambiar mi contraseña
      </h2>
      <form className={styles.form} onSubmit={submit}>
        <label>
          <span>Contraseña actual</span>
          <PasswordInput value={actual} onChange={(e) => setActual(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>
          <span>Nueva contraseña</span>
          <PasswordInput value={nueva} onChange={(e) => setNueva(e.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <label>
          <span>Repetir nueva</span>
          <PasswordInput value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" minLength={8} required />
        </label>
        <button type="submit" className={styles.btnPrimary}>
          <UserRound size={16} aria-hidden /> Guardar contraseña
        </button>
      </form>
    </section>
  );
}

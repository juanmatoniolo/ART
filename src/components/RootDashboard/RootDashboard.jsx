"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  LayoutGrid,
  UserCheck,
  UserX,
  MailPlus,
  AlertTriangle,
  Clock,
  Eye,
  Pencil,
  Minus,
  ArrowRight,
  Globe,
} from "lucide-react";
import UsuariosManager from "@/components/UsuariosManager/UsuariosManager";
import useUsuarios from "@/components/UsuariosManager/useUsuarios";
import { AREAS, ROLES, canUse } from "@/lib/roles";
import { DATA_NODES, accessOf } from "@/lib/permissions";
import styles from "./RootDashboard.module.css";

const TABS = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard },
  { id: "usuarios", label: "Usuarios", icon: Users },
  { id: "permisos", label: "Permisos", icon: ShieldCheck },
  { id: "paneles", label: "Paneles", icon: LayoutGrid },
];

const AREA_INFO = {
  "/admin": { label: "Panel Root", desc: "Facturación, CX, médicos, RP, farmacia y PAMI" },
  "/administrador": { label: "Panel ART", desc: "Ingresos, PAMI, CX y comunicador ART" },
  "/farmacia": { label: "Farmacia", desc: "Stock, movimientos, precios, reparto" },
  "/historia-clinica": { label: "Historias clínicas", desc: "Alta y búsqueda de HC" },
  "/uti": { label: "UTI", desc: "Terapia intensiva", href: "/uti/admin" },
  "/foja": { label: "Fojas quirúrgicas", desc: "Fojas y plantillas", href: "/foja/medicos" },
  "/os": { label: "Obras sociales", desc: "Convenios, facturación y nomencladores de obras sociales" },
  "/ingresos": { label: "Ingresos", desc: "Ingreso de pacientes" },
  "/Siniestro": { label: "Siniestros", desc: "Siniestros ART" },
  "/NomecladorNAcional": { label: "Nomenclador nacional", desc: "Consulta de prácticas" },
};

const fmtDate = (v) => {
  if (!v) return "Nunca";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

function readTab() {
  if (typeof window === "undefined") return "resumen";
  const h = window.location.hash.replace("#", "");
  return TABS.some((t) => t.id === h) ? h : "resumen";
}

export default function RootDashboard({ store: storeProp }) {
  const own = useUsuarios({ enabled: !storeProp });
  const store = storeProp || own;
  const [tab, setTab] = useState("resumen");
  const [userFilter, setUserFilter] = useState("todos");

  // Pestaña en el hash (#usuarios) para poder volver con "atrás"
  useEffect(() => {
    const sync = () => setTab(readTab());
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const go = (id, filter) => {
    if (filter) setUserFilter(filter);
    window.history.pushState(null, "", `#${id}`);
    setTab(id);
  };

  return (
    <div className={styles.wrap}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>
            <ShieldCheck size={26} aria-hidden /> Panel Superroot
          </h1>
          <p className={styles.subtitle}>Usuarios, roles, accesos y paneles del sistema.</p>
        </div>
      </header>

      <nav className={styles.tabs} role="tablist" aria-label="Secciones del panel ROOT">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={`${styles.tab} ${tab === id ? styles.tabActive : ""}`}
            onClick={() => go(id)}
            data-allow-repeat
          >
            <Icon size={18} aria-hidden />
            <span>{label}</span>
            {id === "usuarios" && store.legacy.length > 0 && (
              <span className={styles.badge} title="Pendientes de migrar">{store.legacy.length}</span>
            )}
          </button>
        ))}
      </nav>

      <div role="tabpanel">
        {tab === "resumen" && <Resumen store={store} go={go} />}
        {tab === "usuarios" && (
          <UsuariosManager key={userFilter} mode="root" store={store} embedded initialFilter={userFilter} />
        )}
        {tab === "permisos" && <Permisos users={store.users} />}
        {tab === "paneles" && <Paneles />}
      </div>
    </div>
  );
}

/* ============================ RESUMEN ============================ */
function Resumen({ store, go }) {
  const { users, legacy, loading, error } = store;
  const activos = users.filter((u) => u.activo);
  const cortados = users.filter((u) => !u.activo);
  const nunca = activos.filter((u) => !u.lastSignIn);
  const roots = activos.filter((u) => u.roles.includes("ROOT"));
  const recientes = [...users]
    .filter((u) => u.lastSignIn)
    .sort((a, b) => new Date(b.lastSignIn) - new Date(a.lastSignIn))
    .slice(0, 6);

  const porRol = ROLES.map((r) => ({ ...r, n: activos.filter((u) => u.roles.includes(r.id)).length }));
  const maxRol = Math.max(1, ...porRol.map((r) => r.n));

  const alertas = [
    legacy.length > 0 && {
      tone: "info",
      text: `${legacy.length} usuario(s) del sistema anterior sin email asignado: no pueden entrar.`,
      action: () => go("usuarios"),
      cta: "Migrar",
    },
    cortados.length > 0 && {
      tone: "warn",
      text: `${cortados.length} usuario(s) con el servicio cortado.`,
      action: () => go("usuarios", "cortados"),
      cta: "Ver",
    },
    nunca.length > 0 && {
      tone: "muted",
      text: `${nunca.length} usuario(s) activos que nunca ingresaron.`,
      action: () => go("usuarios", "activos"),
      cta: "Ver",
    },
    roots.length === 1 && {
      tone: "muted",
      text: "Hay un solo usuario SUPERROOT. Si pierde el acceso, nadie puede administrar usuarios.",
    },
  ].filter(Boolean);

  if (error) return <p className={styles.error}>{error}</p>;

  return (
    <div className={styles.resumen}>
      <div className={styles.kpis}>
        <Kpi icon={Users} label="Usuarios" value={users.length} loading={loading} onClick={() => go("usuarios", "todos")} />
        <Kpi icon={UserCheck} label="Activos" value={activos.length} tone="ok" loading={loading} onClick={() => go("usuarios", "activos")} />
        <Kpi icon={UserX} label="Servicio cortado" value={cortados.length} tone="warn" loading={loading} onClick={() => go("usuarios", "cortados")} />
        <Kpi icon={MailPlus} label="Pendientes de migrar" value={legacy.length} tone="info" loading={loading} onClick={() => go("usuarios")} />
      </div>

      <div className={styles.grid2}>
        <section className={styles.card}>
          <h2 className={styles.cardTitle}>Usuarios activos por rol</h2>
          <ul className={styles.bars}>
            {porRol.map((r) => (
              <li key={r.id} className={styles.barRow}>
                <span className={styles.barLabel} title={r.desc}>{r.label}</span>
                <span className={styles.barTrack}>
                  <span className={styles.barFill} style={{ width: `${(r.n / maxRol) * 100}%` }} />
                </span>
                <span className={styles.barValue}>{r.n}</span>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.stack}>
          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <AlertTriangle size={18} aria-hidden /> Atención
            </h2>
            {alertas.length === 0 ? (
              <p className={styles.muted}>Todo en orden.</p>
            ) : (
              <ul className={styles.alerts}>
                {alertas.map((a, i) => (
                  <li key={i} className={`${styles.alert} ${styles["alert_" + a.tone]}`}>
                    <span>{a.text}</span>
                    {a.action && (
                      <button className={styles.linkBtn} onClick={a.action}>
                        {a.cta} <ArrowRight size={14} aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>
              <Clock size={18} aria-hidden /> Últimos ingresos
            </h2>
            {recientes.length === 0 ? (
              <p className={styles.muted}>{loading ? "Cargando…" : "Todavía no hay ingresos registrados."}</p>
            ) : (
              <ul className={styles.recent}>
                {recientes.map((u) => (
                  <li key={u.uid}>
                    <span className={styles.recentName}>{u.nombre}</span>
                    <span className={styles.recentDate}>{fmtDate(u.lastSignIn)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, tone = "base", loading, onClick }) {
  return (
    <button className={`${styles.kpi} ${styles["kpi_" + tone]}`} onClick={onClick}>
      <span className={styles.kpiIcon}>
        <Icon size={20} aria-hidden />
      </span>
      <span className={styles.kpiValue}>{loading ? "…" : value}</span>
      <span className={styles.kpiLabel}>{label}</span>
    </button>
  );
}

/* ============================ PERMISOS ============================ */
function Permisos({ users }) {
  const [roleId, setRoleId] = useState("ADMINISTRADOR");
  const role = ROLES.find((r) => r.id === roleId);
  const areas = Object.keys(AREAS).filter((a) => canUse([roleId], AREAS[a]));
  const nodes = useMemo(
    () =>
      Object.entries(DATA_NODES)
        .map(([key, n]) => ({ key, label: n.label, access: accessOf(roleId, key), publicCreate: n.publicCreate }))
        .sort((a, b) => (b.access === "rw") - (a.access === "rw") || (b.access === "r") - (a.access === "r")),
    [roleId]
  );
  const count = users.filter((u) => u.roles.includes(roleId)).length;

  return (
    <div className={styles.permisos}>
      <div className={styles.roleChips} role="group" aria-label="Elegir rol">
        {ROLES.map((r) => (
          <button
            key={r.id}
            className={`${styles.roleChip} ${r.id === roleId ? styles.roleChipOn : ""}`}
            onClick={() => setRoleId(r.id)}
            aria-pressed={r.id === roleId}
            data-allow-repeat
          >
            {r.label}
          </button>
        ))}
      </div>

      <section className={styles.card}>
        <div className={styles.roleHead}>
          <div>
            <h2 className={styles.cardTitle}>{role.label}</h2>
            <p className={styles.muted}>{role.desc}</p>
          </div>
          <span className={styles.pill}>{count} usuario(s)</span>
        </div>

        <h3 className={styles.subTitle}>Pantallas</h3>
        <div className={styles.areaChips}>
          {areas.map((a) => (
            <span key={a} className={styles.areaChip}>{AREA_INFO[a]?.label || a}</span>
          ))}
        </div>

        <h3 className={styles.subTitle}>Datos</h3>
        <ul className={styles.nodes}>
          {nodes.map((n) => (
            <li key={n.key} className={`${styles.node} ${!n.access ? styles.nodeNone : ""}`}>
              <span className={styles.nodeLabel}>
                {n.label}
                {n.publicCreate && (
                  <span className={styles.publicTag} title="El formulario público /cx puede crear solicitudes">
                    <Globe size={12} aria-hidden /> público: crear
                  </span>
                )}
              </span>
              <AccessBadge access={n.access} />
            </li>
          ))}
        </ul>
        {(roleId === "ROOT" || roleId === "ADM") && (
          <p className={styles.muted}>SUPERROOT y ROOT leen y escriben todos los datos y entran a todos los paneles. Solo SUPERROOT administra usuarios.</p>
        )}
      </section>

      <p className={styles.footnote}>
        Para cambiar estos permisos se edita <code>src/lib/permissions.js</code>, se regeneran las reglas
        (<code>node scripts/build-rules.mjs</code>) y se publican (<code>node scripts/deploy-rules.mjs --apply</code>).
        En la consola de Firebase se ven en Realtime Database, pestaña Reglas.
      </p>
    </div>
  );
}

function AccessBadge({ access }) {
  if (access === "rw")
    return (
      <span className={`${styles.access} ${styles.accessRw}`}>
        <Pencil size={13} aria-hidden /> Lee y escribe
      </span>
    );
  if (access === "r")
    return (
      <span className={`${styles.access} ${styles.accessR}`}>
        <Eye size={13} aria-hidden /> Solo lectura
      </span>
    );
  return (
    <span className={`${styles.access} ${styles.accessNone}`}>
      <Minus size={13} aria-hidden /> Sin acceso
    </span>
  );
}

/* ============================ PANELES ============================ */
function Paneles() {
  return (
    <div className={styles.panels}>
      {Object.entries(AREAS).map(([path, allowed]) => {
        const info = AREA_INFO[path] || { label: path, desc: "" };
        const roles = allowed === "*" ? ["Todos"] : allowed.map((id) => ROLES.find((r) => r.id === id)?.label || id);
        return (
          <Link key={path} href={info.href || path} className={styles.panel}>
            <span className={styles.panelBody}>
              <strong>{info.label}</strong>
              <span className={styles.muted}>{info.desc}</span>
              <span className={styles.panelRoles}>
                {roles.map((r) => (
                  <span key={r} className={styles.areaChip}>{r}</span>
                ))}
              </span>
            </span>
            <ArrowRight size={18} className={styles.panelArrow} aria-hidden />
          </Link>
        );
      })}
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import {
  UserPlus,
  Search,
  RefreshCw,
  Power,
  Trash2,
  Save,
  X,
  ShieldCheck,
  Pencil,
  MailPlus,
  LogIn,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { startImpersonation } from "@/lib/impersonation";
import { authFetch } from "@/lib/apiClient";
import { notify } from "@/lib/notify";
import { singleFlight } from "@/lib/singleFlight";
import { useSession } from "@/context/SessionContext";
import { PRIVILEGED_ROLES, ROLES, isInternalEmail } from "@/lib/roles";
import useUsuarios from "./useUsuarios";
import styles from "./UsuariosManager.module.css";

const fmtDate = (v) => {
  if (!v) return "Nunca";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
};

/**
 * Gestión de usuarios.
 * mode="root": control total (roles múltiples, cortar servicio, eliminar).
 * mode="adm":  alta de usuarios no privilegiados y cambio de nombre/contraseña.
 * store:    datos compartidos (useUsuarios) cuando lo usa el dashboard ROOT.
 * embedded: sin título propio (lo pone el contenedor).
 */
export default function UsuariosManager({ mode = "adm", store, embedded = false, initialFilter = "todos" }) {
  const isRootMode = mode === "root";
  const { usuario } = useSession();
  const own = useUsuarios({ enabled: !store });
  const { users, setUsers, legacy, setLegacy, loading, error, reload: load } = store || own;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState(initialFilter); // todos | activos | cortados
  const [showCreate, setShowCreate] = useState(false);
  const [prefill, setPrefill] = useState(null); // usuario viejo a migrar

  const grantable = useMemo(
    () => (isRootMode ? ROLES : ROLES.filter((r) => !PRIVILEGED_ROLES.includes(r.id))),
    [isRootMode]
  );

  const replaceUser = (u) => setUsers((list) => list.map((x) => (x.uid === u.uid ? u : x)));

  const visible = users.filter((u) => {
    if (filter === "activos" && !u.activo) return false;
    if (filter === "cortados" && u.activo) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [u.nombre, u.email, u.user, ...u.roles].join(" ").toLowerCase().includes(q);
  });

  const activos = users.filter((u) => u.activo).length;

  return (
    <section className={styles.wrap}>
      <header className={styles.header}>
        <div className={embedded ? styles.srOnly : undefined}>
          <h1 className={styles.title}>
            {isRootMode ? <ShieldCheck size={24} aria-hidden /> : null}
            {isRootMode ? "Usuarios y accesos" : "Usuarios"}
          </h1>
          <p className={styles.subtitle}>
            {isRootMode
              ? "Asigná roles, cortá o restablecé el servicio de cada usuario."
              : "Alta de usuarios y cambio de contraseña."}
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.btnGhost} onClick={load} disabled={loading} aria-label="Actualizar">
            <RefreshCw size={18} aria-hidden /> <span className={styles.hideSm}>Actualizar</span>
          </button>
          <button
            className={styles.btnPrimary}
            onClick={() => {
              setPrefill(null);
              setShowCreate((v) => !v);
            }}
          >
            {showCreate ? <X size={18} aria-hidden /> : <UserPlus size={18} aria-hidden />}
            {showCreate ? "Cerrar" : "Nuevo usuario"}
          </button>
        </div>
      </header>

      <div className={styles.stats}>
        <span><strong>{users.length}</strong> usuarios</span>
        <span className={styles.ok}><strong>{activos}</strong> activos</span>
        <span className={styles.off}><strong>{users.length - activos}</strong> con servicio cortado</span>
      </div>

      {isRootMode && legacy.length > 0 && (
        <section className={styles.legacy}>
          <h2 className={styles.cardTitle}>
            <MailPlus size={18} aria-hidden /> Pendientes de migrar ({legacy.length})
          </h2>
          <p className={styles.muted}>
            Usuarios del sistema anterior. Asignales un email y una contraseña para que puedan entrar.
          </p>
          <ul className={styles.legacyList}>
            {legacy.map((l) => (
              <li key={l.key} className={styles.legacyItem}>
                <span className={styles.who}>
                  <strong className={styles.name}>{l.nombre}</strong>
                  <span className={styles.email}>
                    usuario: {l.user} · rol: {l.rolOriginal || "sin rol"}
                  </span>
                </span>
                <button
                  className={styles.btnGhost}
                  onClick={() => {
                    setPrefill(l);
                    setShowCreate(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  <MailPlus size={16} aria-hidden /> Asignar email
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {showCreate && (
        <CreateUserForm
          key={prefill?.key || "nuevo"}
          grantable={grantable}
          prefill={prefill}
          onCreated={(u) => {
            setUsers((list) => [...list, u].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")));
            if (prefill) setLegacy((list) => list.filter((x) => x.key !== prefill.key));
            setPrefill(null);
            setShowCreate(false);
          }}
        />
      )}

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} aria-hidden />
          <input
            type="search"
            placeholder="Buscar por nombre, email o rol"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className={styles.segmented} role="group" aria-label="Filtrar por estado">
          {["todos", "activos", "cortados"].map((f) => (
            <button
              key={f}
              className={filter === f ? styles.segActive : ""}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              data-allow-repeat
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {loading && !users.length ? <p className={styles.muted}>Cargando usuarios…</p> : null}
      {!loading && !error && !visible.length ? <p className={styles.muted}>No hay usuarios para mostrar.</p> : null}

      <ul className={styles.list}>
        {visible.map((u) => (
          <UserCard
            key={u.uid}
            u={u}
            isSelf={u.uid === usuario?.uid}
            isRootMode={isRootMode}
            grantable={grantable}
            onChange={replaceUser}
            onDeleted={() => setUsers((list) => list.filter((x) => x.uid !== u.uid))}
          />
        ))}
      </ul>
    </section>
  );
}

function RolePicker({ roles, value, onChange, disabledIds = [] }) {
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((r) => r !== id) : [...value, id]);
  return (
    <div className={styles.roles}>
      {roles.map((r) => (
        <label
          key={r.id}
          className={`${styles.roleChip} ${value.includes(r.id) ? styles.roleOn : ""}`}
          title={r.desc}
        >
          <input
            type="checkbox"
            checked={value.includes(r.id)}
            onChange={() => toggle(r.id)}
            disabled={disabledIds.includes(r.id)}
          />
          {r.label}
        </label>
      ))}
    </div>
  );
}

function CreateUserForm({ grantable, prefill, onCreated }) {
  const [form, setForm] = useState({
    nombre: prefill?.nombre || "",
    email: "",
    password: "",
    roles: prefill?.roles || [],
    legacyKey: prefill?.key || undefined,
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = singleFlight("usuarios:create", async (e) => {
    e.preventDefault();
    if (!form.roles.length) return notify.warning("Elegí al menos un rol.");
    try {
      const { user } = await authFetch("/api/usuarios", { method: "POST", body: form });
      notify.success(`Usuario ${user.nombre} creado.`);
      onCreated(user);
    } catch (err) {
      notify.error(err.message);
    }
  });

  return (
    <form className={styles.createCard} onSubmit={submit}>
      <h2 className={styles.cardTitle}>{prefill ? `Migrar a ${prefill.nombre}` : "Nuevo usuario"}</h2>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Nombre y apellido</span>
          <input value={form.nombre} onChange={set("nombre")} required autoComplete="off" />
        </label>
        <label className={styles.field}>
          <span>Email</span>
          <input type="email" value={form.email} onChange={set("email")} required autoComplete="off" inputMode="email" />
        </label>
        <label className={styles.field}>
          <span>Contraseña inicial</span>
          <input
            type="text"
            value={form.password}
            onChange={set("password")}
            required
            minLength={8}
            autoComplete="new-password"
          />
          <small>Mínimo 8 caracteres. Pasásela al usuario.</small>
        </label>
      </div>
      <span className={styles.label}>Roles</span>
      <RolePicker roles={grantable} value={form.roles} onChange={(roles) => setForm((f) => ({ ...f, roles }))} />
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary}>
          <UserPlus size={18} aria-hidden /> Crear usuario
        </button>
      </div>
    </form>
  );
}

function UserCard({ u, isSelf, isRootMode, grantable, onChange, onDeleted }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(null); // "cut" | "delete"
  const router = useRouter();
  const privileged = u.roles.some((r) => PRIVILEGED_ROLES.includes(r));
  const canEdit = isRootMode || !privileged;

  const patch = async (body, okMsg) => {
    try {
      const { user } = await authFetch(`/api/usuarios/${u.uid}`, { method: "PATCH", body });
      onChange(user);
      notify.success(okMsg);
      return true;
    } catch (err) {
      notify.error(err.message);
      return false;
    }
  };

  const entrarComo = singleFlight(`usuarios:impersonate:${u.uid}`, async () => {
    try {
      const home = await startImpersonation(u.uid);
      notify.info(`Entraste como ${u.nombre}.`);
      router.push(home);
    } catch (err) {
      notify.error(err.message);
    }
  });

  const toggleService = singleFlight(`usuarios:service:${u.uid}`, async () => {
    const ok = await patch(
      { activo: !u.activo },
      u.activo ? `Servicio cortado para ${u.nombre}.` : `Servicio restablecido para ${u.nombre}.`
    );
    if (ok) setConfirming(null);
  });

  const remove = singleFlight(`usuarios:delete:${u.uid}`, async () => {
    try {
      await authFetch(`/api/usuarios/${u.uid}`, { method: "DELETE" });
      notify.success(`Usuario ${u.nombre} eliminado.`);
      onDeleted();
    } catch (err) {
      notify.error(err.message);
    }
  });

  return (
    <li className={`${styles.card} ${u.activo ? "" : styles.cardOff}`}>
      <div className={styles.cardHead}>
        <div className={styles.who}>
          <strong className={styles.name}>
            {u.nombre}
            {isSelf && <span className={styles.selfTag}>vos</span>}
          </strong>
          <span className={styles.email}>
            {isInternalEmail(u.email) ? `usuario: ${u.user}` : u.email}
          </span>
        </div>
        <span className={`${styles.status} ${u.activo ? styles.statusOn : styles.statusOff}`}>
          {u.activo ? "Activo" : "Servicio cortado"}
        </span>
      </div>

      <div className={styles.roles}>
        {u.roles.length ? (
          u.roles.map((r) => (
            <span key={r} className={`${styles.roleTag} ${PRIVILEGED_ROLES.includes(r) ? styles.rolePriv : ""}`}>
              {ROLES.find((x) => x.id === r)?.label || r}
            </span>
          ))
        ) : (
          <span className={styles.muted}>Sin roles</span>
        )}
      </div>

      <p className={styles.meta}>Último ingreso: {fmtDate(u.lastSignIn)}</p>

      {editing && (
        <EditUserForm
          u={u}
          isSelf={isSelf}
          isRootMode={isRootMode}
          grantable={grantable}
          onSave={async (body) => {
            if (await patch(body, `Cambios guardados para ${body.nombre || u.nombre}.`)) setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {confirming && (
        <div className={styles.confirm} role="alertdialog" aria-label="Confirmar acción">
          <span>
            {confirming === "cut"
              ? `¿Cortar el servicio a ${u.nombre}? No va a poder usar el sistema hasta que lo restablezcas.`
              : `¿Eliminar a ${u.nombre}? Esta acción no se puede deshacer.`}
          </span>
          <div className={styles.inlineActions}>
            <button className={styles.btnDanger} onClick={confirming === "cut" ? toggleService : remove}>
              {confirming === "cut" ? "Sí, cortar servicio" : "Sí, eliminar"}
            </button>
            <button className={styles.btnGhost} onClick={() => setConfirming(null)}>Cancelar</button>
          </div>
        </div>
      )}

      {!editing && (
        <div className={styles.actions}>
          {canEdit && (
            <button className={styles.btnPrimary} onClick={() => setEditing(true)}>
              <Pencil size={16} aria-hidden /> Editar
            </button>
          )}
          {isRootMode && !isSelf && u.activo && (
            <button className={styles.btnGhost} onClick={entrarComo} title={`Usar el sistema como ${u.nombre}`}>
              <LogIn size={16} aria-hidden /> Entrar como
            </button>
          )}
          {isRootMode && !isSelf && (
            <button
              className={u.activo ? styles.btnWarn : styles.btnOk}
              onClick={u.activo ? () => setConfirming("cut") : toggleService}
            >
              <Power size={16} aria-hidden /> {u.activo ? "Cortar servicio" : "Restablecer servicio"}
            </button>
          )}
          {isRootMode && !isSelf && (
            <button
              className={styles.btnGhostDanger}
              onClick={() => setConfirming("delete")}
              aria-label={`Eliminar a ${u.nombre}`}
            >
              <Trash2 size={16} aria-hidden />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** Edición completa de un usuario: nombre, email/usuario, contraseña, roles y servicio. */
function EditUserForm({ u, isSelf, isRootMode, grantable, onSave, onCancel }) {
  const originalLogin = isInternalEmail(u.email) ? u.user : u.email;
  const [nombre, setNombre] = useState(u.nombre);
  const [email, setEmail] = useState(originalLogin);
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState(u.roles);
  const [activo, setActivo] = useState(u.activo);

  const submit = singleFlight(`usuarios:edit:${u.uid}`, async (e) => {
    e.preventDefault();
    const body = {};
    if (nombre.trim() !== u.nombre) body.nombre = nombre.trim();
    if (email.trim().toLowerCase() !== String(originalLogin).toLowerCase()) body.email = email.trim();
    if (password) {
      if (password.length < 8) return notify.warning("La contraseña debe tener al menos 8 caracteres.");
      body.password = password;
    }
    if (isRootMode) {
      if (!roles.length) return notify.warning("Elegí al menos un rol.");
      if ([...roles].sort().join() !== [...u.roles].sort().join()) body.roles = roles;
      if (!isSelf && activo !== u.activo) body.activo = activo;
    }
    if (!Object.keys(body).length) return notify.info("No hay cambios para guardar.");
    await onSave(body);
  });

  return (
    <form className={styles.editForm} onSubmit={submit}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>Nombre y apellido</span>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} required />
        </label>
        <label className={styles.field}>
          <span>Email o usuario</span>
          <input value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="off" inputMode="email" />
        </label>
        <label className={styles.field}>
          <span>Nueva contraseña</span>
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Dejar vacío para no cambiarla"
            autoComplete="new-password"
          />
        </label>
      </div>

      {isRootMode && (
        <>
          <span className={styles.label}>Roles</span>
          <RolePicker roles={grantable} value={roles} onChange={setRoles} disabledIds={isSelf ? ["ROOT"] : []} />
          {!isSelf && (
            <label className={styles.switchRow}>
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              <span>{activo ? "Servicio activo" : "Servicio cortado (no puede entrar)"}</span>
            </label>
          )}
        </>
      )}

      <div className={styles.inlineActions}>
        <button type="submit" className={styles.btnPrimary}>
          <Save size={16} aria-hidden /> Guardar cambios
        </button>
        <button type="button" className={styles.btnGhost} onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

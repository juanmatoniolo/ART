import "server-only";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { HttpError } from "@/lib/serverAuth";
import { PRIVILEGED_ROLES, ROLE_IDS, rolesFromMap, toLoginEmail } from "@/lib/roles";

export const usuariosRef = (uid = "") => getAdminDb().ref(uid ? `usuarios/${uid}` : "usuarios");

/** Normaliza y valida la lista de roles recibida. */
export function parseRoles(input) {
  const list = Array.isArray(input) ? input : [];
  const roles = [...new Set(list.filter((r) => ROLE_IDS.includes(r)))];
  if (!roles.length) throw new HttpError(400, "Asigná al menos un rol.");
  return roles;
}

export const toRoleMap = (roles) => Object.fromEntries(roles.map((r) => [r, true]));

/** Solo SUPERROOT (id ROOT) puede otorgar o quitar SUPERROOT/ROOT (ids ROOT/ADM). */
export function assertCanGrant(actorRoles, roles) {
  if (actorRoles.includes("ROOT")) return;
  const priv = roles.filter((r) => PRIVILEGED_ROLES.includes(r));
  if (priv.length) throw new HttpError(403, `Solo SUPERROOT puede asignar los roles ${priv.map((r) => (r === "ROOT" ? "SUPERROOT" : "ROOT")).join(" / ")}.`);
}

/** Debe quedar al menos un SUPERROOT activo. */
export async function assertKeepsARoot(changingUid, nextRoles, nextActivo) {
  const all = (await usuariosRef().get()).val() || {};
  const remaining = Object.entries(all).filter(([uid, p]) => {
    const roles = uid === changingUid ? nextRoles : rolesFromMap(p.roles);
    const activo = uid === changingUid ? nextActivo : p.activo === true;
    return activo && roles.includes("ROOT");
  });
  if (!remaining.length) throw new HttpError(400, "Tiene que quedar al menos un usuario SUPERROOT activo.");
}

export function cleanEmail(identifier) {
  const v = String(identifier || "").trim().toLowerCase();
  if (!v) throw new HttpError(400, "Ingresá un email.");
  return toLoginEmail(v);
}

export function cleanPassword(pw) {
  const v = String(pw || "");
  if (v.length < 8) throw new HttpError(400, "La contraseña debe tener al menos 8 caracteres.");
  return v;
}

/** Perfil público (lo que devuelve la API). Nunca incluye contraseñas. */
export function publicUser(uid, profile, authRecord) {
  return {
    uid,
    nombre: profile?.nombre || "",
    user: profile?.user || "",
    email: profile?.email || authRecord?.email || "",
    roles: rolesFromMap(profile?.roles),
    activo: profile?.activo === true,
    createdAt: profile?.createdAt || null,
    createdBy: profile?.createdBy || "",
    updatedAt: profile?.updatedAt || null,
    updatedBy: profile?.updatedBy || "",
    lastSignIn: authRecord?.metadata?.lastSignInTime || null,
    authDisabled: authRecord?.disabled ?? null,
  };
}

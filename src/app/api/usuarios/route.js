// GET  /api/usuarios   lista de usuarios (ADM, ROOT)
// POST /api/usuarios   crea un usuario con email + contraseña (ADM, ROOT)
import { handle, requireUser, HttpError } from "@/lib/serverAuth";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { toRoleId } from "@/lib/roles";
import { getAdminDb } from "@/lib/firebaseAdmin";
import {
  assertCanGrant,
  cleanEmail,
  cleanPassword,
  parseRoles,
  publicUser,
  toRoleMap,
  usuariosRef,
} from "./_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (request) => {
  const actor = await requireUser(request, ["ADM"]);
  const profiles = (await usuariosRef().get()).val() || {};
  const uids = Object.keys(profiles);

  // Datos de Auth (último ingreso, deshabilitado) en lotes de 100
  const authByUid = {};
  for (let i = 0; i < uids.length; i += 100) {
    const res = await getAdminAuth().getUsers(uids.slice(i, i + 100).map((uid) => ({ uid })));
    res.users.forEach((u) => (authByUid[u.uid] = u));
  }

  const users = uids
    .map((uid) => publicUser(uid, profiles[uid], authByUid[uid]))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  // ROOT: usuarios del sistema viejo que todavía no tienen cuenta (sin contraseñas)
  let legacy = [];
  if (actor.roles.includes("ROOT")) {
    const migrated = new Set(Object.values(profiles).map((p) => p.legacyKey).filter(Boolean));
    const old = (await getAdminDb().ref("users").get()).val() || {};
    legacy = Object.entries(old)
      .filter(([key, u]) => !migrated.has(key) && !u?.migratedTo)
      .map(([key, u]) => ({
        key,
        nombre: u?.nombre || u?.user || key,
        user: u?.user || "",
        roles: [toRoleId(u?.TipoEmpleado)].filter(Boolean),
        rolOriginal: u?.TipoEmpleado || "",
      }));
  }

  return Response.json({ users, legacy });
});

export const POST = handle(async (request) => {
  const actor = await requireUser(request, ["ADM"]);
  const body = await request.json().catch(() => ({}));

  const email = cleanEmail(body.email);
  const password = cleanPassword(body.password);
  const nombre = String(body.nombre || "").trim();
  if (!nombre) throw new HttpError(400, "Ingresá el nombre.");
  const roles = parseRoles(body.roles);
  assertCanGrant(actor.roles, roles);
  const legacyKey = body.legacyKey ? String(body.legacyKey) : null;
  if (legacyKey && !actor.roles.includes("ROOT")) throw new HttpError(403, "Solo SUPERROOT puede migrar usuarios.");

  const authUser = await getAdminAuth().createUser({ email, password, displayName: nombre });
  const now = Date.now();
  const profile = {
    nombre,
    user: email.split("@")[0],
    email,
    roles: toRoleMap(roles),
    activo: true,
    createdAt: now,
    createdBy: actor.profile.nombre || actor.email,
    updatedAt: now,
    updatedBy: actor.profile.nombre || actor.email,
    ...(legacyKey ? { legacyKey } : {}),
  };
  try {
    await usuariosRef(authUser.uid).set(profile);
    // Migración: la contraseña vieja (texto plano) deja de existir
    if (legacyKey) await getAdminDb().ref(`users/${legacyKey}`).update({ password: null, migratedTo: authUser.uid });
  } catch (err) {
    await getAdminAuth().deleteUser(authUser.uid).catch(() => {});
    throw err;
  }
  return Response.json({ user: publicUser(authUser.uid, profile, authUser) }, { status: 201 });
});

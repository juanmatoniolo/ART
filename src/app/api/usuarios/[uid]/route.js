// PATCH  /api/usuarios/:uid  { nombre?, email?, password?, roles?, activo? }
//   - nombre / email / password: ADM (sobre usuarios no privilegiados) o ROOT
//   - roles / activo (cortar o restablecer el servicio): solo ROOT
// DELETE /api/usuarios/:uid  solo ROOT
import { handle, requireUser, HttpError } from "@/lib/serverAuth";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { PRIVILEGED_ROLES, rolesFromMap } from "@/lib/roles";
import {
  assertKeepsARoot,
  cleanEmail,
  cleanPassword,
  parseRoles,
  publicUser,
  toRoleMap,
  usuariosRef,
} from "../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function loadTarget(uid) {
  const profile = (await usuariosRef(uid).get()).val();
  if (!profile) throw new HttpError(404, "El usuario no existe.");
  return profile;
}

export const PATCH = handle(async (request, ctx) => {
  const { uid } = await ctx.params;
  const actor = await requireUser(request, ["ADM"]);
  const isRoot = actor.roles.includes("ROOT");
  const target = await loadTarget(uid);
  const targetRoles = rolesFromMap(target.roles);
  const body = await request.json().catch(() => ({}));

  if (!isRoot && targetRoles.some((r) => PRIVILEGED_ROLES.includes(r))) {
    throw new HttpError(403, "Solo SUPERROOT puede modificar usuarios ROOT o SUPERROOT.");
  }

  const updates = {};
  const authUpdates = {};

  if (body.nombre !== undefined) {
    const nombre = String(body.nombre).trim();
    if (!nombre) throw new HttpError(400, "El nombre no puede quedar vacío.");
    updates.nombre = nombre;
    authUpdates.displayName = nombre;
  }

  if (body.email !== undefined) {
    const email = cleanEmail(body.email);
    if (email !== target.email) {
      authUpdates.email = email;
      updates.email = email;
      updates.user = email.split("@")[0];
    }
  }

  if (body.password !== undefined && body.password !== "") {
    authUpdates.password = cleanPassword(body.password);
  }

  let nextRoles = targetRoles;
  if (body.roles !== undefined) {
    if (!isRoot) throw new HttpError(403, "Solo SUPERROOT puede cambiar roles.");
    nextRoles = parseRoles(body.roles);
    updates.roles = toRoleMap(nextRoles);
  }

  let nextActivo = target.activo === true;
  if (body.activo !== undefined) {
    if (!isRoot) throw new HttpError(403, "Solo SUPERROOT puede cortar o restablecer el servicio.");
    if (uid === actor.uid && body.activo !== true) throw new HttpError(400, "No podés cortarte el servicio a vos mismo.");
    nextActivo = body.activo === true;
    updates.activo = nextActivo;
    authUpdates.disabled = !nextActivo;
  }

  if (uid === actor.uid && updates.roles && !nextRoles.includes("ROOT")) {
    throw new HttpError(400, "No podés quitarte el rol SUPERROOT a vos mismo.");
  }
  if (updates.roles || updates.activo !== undefined) {
    await assertKeepsARoot(uid, nextRoles, nextActivo);
  }

  if (!Object.keys(updates).length && !Object.keys(authUpdates).length) {
    throw new HttpError(400, "No hay cambios para guardar.");
  }

  if (Object.keys(authUpdates).length) await getAdminAuth().updateUser(uid, authUpdates);
  // Cortar el servicio: invalida también las sesiones abiertas
  if (updates.activo === false) await getAdminAuth().revokeRefreshTokens(uid);

  updates.updatedAt = Date.now();
  updates.updatedBy = actor.profile.nombre || actor.email;
  await usuariosRef(uid).update(updates);

  const fresh = (await usuariosRef(uid).get()).val();
  const authRecord = await getAdminAuth().getUser(uid).catch(() => null);
  return Response.json({ user: publicUser(uid, fresh, authRecord) });
});

export const DELETE = handle(async (request, ctx) => {
  const { uid } = await ctx.params;
  const actor = await requireUser(request, ["ROOT"]);
  if (uid === actor.uid) throw new HttpError(400, "No podés eliminar tu propio usuario.");
  await loadTarget(uid);
  await assertKeepsARoot(uid, [], false);
  await getAdminAuth().deleteUser(uid).catch((err) => {
    if (err?.code !== "auth/user-not-found") throw err;
  });
  await usuariosRef(uid).remove();
  return Response.json({ ok: true });
});

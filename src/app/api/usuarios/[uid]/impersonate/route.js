// POST /api/usuarios/:uid/impersonate  (solo ROOT)
// Devuelve un token para entrar como ese usuario y otro para volver a la cuenta ROOT.
// Cada uso queda registrado en auditoria_root/.
import { handle, requireUser, HttpError } from "@/lib/serverAuth";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { panelsFor, rolesFromMap } from "@/lib/roles";
import { usuariosRef } from "../../_shared";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (request, ctx) => {
  const { uid } = await ctx.params;
  const actor = await requireUser(request, ["ROOT"]);
  if (!actor.roles.includes("ROOT")) throw new HttpError(403, "Solo SUPERROOT puede entrar como otro usuario.");
  if (uid === actor.uid) throw new HttpError(400, "Ya estás en tu propia cuenta.");

  const target = (await usuariosRef(uid).get()).val();
  if (!target) throw new HttpError(404, "El usuario no existe.");
  if (target.activo !== true) throw new HttpError(400, "El usuario tiene el servicio cortado. Restablecelo para entrar.");

  const auth = getAdminAuth();
  const token = await auth.createCustomToken(uid, { impersonatedBy: actor.uid });
  const returnToken = await auth.createCustomToken(actor.uid);

  await getAdminDb().ref("auditoria_root").push({
    accion: "entrar_como",
    por: actor.uid,
    porNombre: actor.profile.nombre || actor.email,
    destino: uid,
    destinoNombre: target.nombre || "",
    fecha: Date.now(),
  });

  const roles = rolesFromMap(target.roles);
  return Response.json({
    token,
    returnToken,
    target: { uid, nombre: target.nombre || "", home: panelsFor(roles)[0]?.href || "/" },
    actor: { nombre: actor.profile.nombre || actor.email },
  });
});

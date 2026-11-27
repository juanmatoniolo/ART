// Verificación de identidad y roles en API routes (servidor).
import "server-only";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { rolesFromMap } from "@/lib/roles";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Valida el ID token (Authorization: Bearer ...), que la cuenta esté activa
 * y que tenga alguno de los roles pedidos (ROOT siempre pasa).
 * @returns {{ uid, email, profile, roles }}
 */
export async function requireUser(request, allowedRoles = []) {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HttpError(401, "Falta iniciar sesión.");

  let decoded;
  try {
    decoded = await getAdminAuth().verifyIdToken(token, true); // true = rechaza tokens revocados
  } catch {
    throw new HttpError(401, "Sesión inválida o vencida. Volvé a iniciar sesión.");
  }

  const snap = await getAdminDb().ref(`usuarios/${decoded.uid}`).get();
  const profile = snap.val();
  if (!profile || profile.activo !== true) throw new HttpError(403, "Tu usuario no está activo.");

  const roles = rolesFromMap(profile.roles);
  const ok = roles.includes("ROOT") || allowedRoles.some((r) => roles.includes(r));
  if (allowedRoles.length && !ok) throw new HttpError(403, "No tenés permisos para esta acción.");

  return { uid: decoded.uid, email: decoded.email, profile, roles };
}

/**
 * Para rutas públicas: rechaza cuerpos más grandes que maxBytes (413).
 * Usa Content-Length; sin ese encabezado, el handler igual valida el JSON.
 */
export function limitBody(request, maxBytes = 2 * 1024 * 1024) {
  const len = Number(request.headers.get("content-length") || 0);
  if (len > maxBytes) throw new HttpError(413, "Los datos enviados son demasiado grandes.");
}

/** Envuelve un handler y convierte errores en respuestas JSON. */
export function handle(fn) {
  return async (request, ctx) => {
    try {
      return await fn(request, ctx);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : mapFirebaseError(err)?.status || 500;
      // err.expose: errores de configuración del servidor (ver lib/firebaseAdmin.js) con
      // un mensaje pensado para mostrarse; no incluyen datos ni credenciales.
      const message =
        err instanceof HttpError || err?.expose
          ? err.message
          : mapFirebaseError(err)?.message || "Error interno.";
      if (status >= 500) console.error("[api]", err);
      return Response.json({ error: message }, { status });
    }
  };
}

function mapFirebaseError(err) {
  switch (err?.code || err?.errorInfo?.code) {
    case "auth/email-already-exists":
      return { status: 409, message: "Ya existe un usuario con ese email." };
    case "auth/invalid-email":
      return { status: 400, message: "El email no es válido." };
    case "auth/invalid-password":
      return { status: 400, message: "La contraseña debe tener al menos 6 caracteres." };
    case "auth/user-not-found":
      return { status: 404, message: "El usuario no existe." };
    default:
      return null;
  }
}

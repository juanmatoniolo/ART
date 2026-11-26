// "Entrar como" otro usuario (solo ROOT). Guarda en sessionStorage cómo volver.
import { signInWithCustomToken, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { authFetch } from "@/lib/apiClient";

const KEY = "impersonation";
const RETURN_TOKEN_TTL = 55 * 60 * 1000; // los custom tokens valen 1 hora

export function getImpersonation() {
  if (typeof window === "undefined") return null;
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || "null");
  } catch {
    return null;
  }
}

/** Entra como el usuario uid. Devuelve la ruta de inicio de ese usuario. */
export async function startImpersonation(uid) {
  const data = await authFetch(`/api/usuarios/${uid}/impersonate`, { method: "POST", body: {} });
  sessionStorage.setItem(
    KEY,
    JSON.stringify({
      returnToken: data.returnToken,
      actorNombre: data.actor.nombre,
      targetNombre: data.target.nombre,
      startedAt: Date.now(),
    })
  );
  await signInWithCustomToken(auth, data.token);
  window.dispatchEvent(new Event("impersonation-change"));
  return data.target.home;
}

/** Vuelve a la cuenta ROOT. Devuelve la ruta a donde ir. */
export async function stopImpersonation() {
  const info = getImpersonation();
  sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event("impersonation-change"));
  if (info?.returnToken && Date.now() - info.startedAt < RETURN_TOKEN_TTL) {
    try {
      await signInWithCustomToken(auth, info.returnToken);
      return "/admin/root#usuarios";
    } catch {
      // token vencido o inválido: volver a iniciar sesión
    }
  }
  await signOut(auth);
  return "/login";
}

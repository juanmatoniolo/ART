// Interceptor de fetch para la REST API de la Realtime Database:
//  1. Agrega el ID token de Firebase (?auth=...) para que las reglas lo acepten.
//  2. Las lecturas completas de nodos compartidos (pacientes, médicos, ...) se
//     sirven desde la suscripción en vivo compartida (memoria, siempre al día),
//     en vez de volver a descargarlos en cada pantalla.
//  3. Los pedidos a las API routes propias (/api/...) llevan el ID token en
//     "Authorization: Bearer ...", así todas las pantallas quedan autenticadas
//     sin tener que pasar el token a mano.
import { auth } from "@/lib/firebase";
import { DB_URL } from "@/lib/config";
import { getShared } from "@/lib/dbCache";

// Nodos que muchas pantallas leen enteros por REST
const SHARED_REST = new Set([
  "pacientes",
  "medicos",
  "Facturacion/siniestros",
  "ART-MAILS/arts",
  "ART-MAILS/atajos",
  "ART-MAILS/acciones",
  "WHATSAPP/mensajes",
  "facturacionOS/osociales",
]);
const WRITE_GRACE_MS = 3000; // después de escribir, leer del servidor
const lastWrite = new Map(); // nodo raíz -> timestamp

let installed = false;

const rootOf = (path) => path.split("/")[0];

/** ¿Es una API route propia (mismo origen, /api/...)? */
function isOwnApi(url) {
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/**
 * Pedidos a las API routes propias: agrega "Authorization: Bearer <ID token>"
 * (las rutas lo validan con requireUser). Si el pedido ya trae Authorization,
 * no se toca. Sin sesión se envía igual y el servidor responde 401.
 */
async function fetchOwnApi(originalFetch, input, init) {
  const base = input instanceof Request ? input.headers : undefined;
  const headers = new Headers(init?.headers || base);
  if (!headers.has("authorization")) {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  }
  if (input instanceof Request) return originalFetch(new Request(input, { headers }), init && { ...init, headers });
  return originalFetch(input, { ...init, headers });
}

export function installDbRestAuth() {
  if (installed || typeof window === "undefined" || !DB_URL) return;
  installed = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input?.url;
    if (!url) return originalFetch(input, init);
    if (isOwnApi(url)) return fetchOwnApi(originalFetch, input, init);
    if (!url.startsWith(DB_URL)) return originalFetch(input, init);

    const method = (init?.method || (typeof input === "object" && input?.method) || "GET").toUpperCase();
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, "").replace(/\.json$/, ""));

    if (method !== "GET") {
      lastWrite.set(rootOf(path), Date.now());
    } else if (
      SHARED_REST.has(path) &&
      [...u.searchParams.keys()].length === 0 &&
      Date.now() - (lastWrite.get(rootOf(path)) || 0) > WRITE_GRACE_MS
    ) {
      try {
        await auth.authStateReady();
        const snap = await getShared(path);
        return new Response(JSON.stringify(snap.val()), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch {
        // si falla (permisos, red), seguimos con la llamada normal
      }
    }

    await auth.authStateReady();
    const user = auth.currentUser;
    if (!user) return originalFetch(input, init);

    const token = await user.getIdToken();
    u.searchParams.set("auth", token);
    if (typeof input === "string" || input instanceof URL) return originalFetch(u.toString(), init);
    return originalFetch(new Request(u.toString(), input), init);
  };
}

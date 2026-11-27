// Firebase Admin SDK. SOLO servidor (API routes). Nunca importar desde componentes cliente.
// Se carga e inicializa recién al primer uso:
//  - el build no necesita las credenciales;
//  - las rutas que no lo usan (ej. PDF públicos) no dependen de él;
//  - si el paquete o las credenciales fallan en el servidor, el error llega como
//    respuesta JSON con el motivo (err.expose, ver handle en lib/serverAuth.js)
//    en lugar de una página 500 sin explicación.
import "server-only";

let mods = null;

function exposed(message, cause) {
  const err = new Error(message, { cause });
  err.expose = true;
  return err;
}

function loadAdmin() {
  if (mods) return mods;
  try {
    mods = {
      app: require("firebase-admin/app"),
      auth: require("firebase-admin/auth"),
      database: require("firebase-admin/database"),
    };
    return mods;
  } catch (e) {
    throw exposed(`No se pudo cargar firebase-admin en el servidor: ${e?.message || e}`, e);
  }
}

function adminApp() {
  const { getApps, initializeApp, cert } = loadAdmin().app;
  const existing = getApps().find((a) => a.name === "admin");
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // En .env la clave viene con "\n" escapados
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw exposed("Faltan las variables FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY en el servidor.");
  }
  try {
    return initializeApp(
      {
        credential: cert({ projectId, clientEmail, privateKey }),
        databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
      },
      "admin"
    );
  } catch (e) {
    throw exposed(`No se pudo iniciar firebase-admin (revisá FIREBASE_PRIVATE_KEY): ${e?.message || e}`, e);
  }
}

export const getAdminAuth = () => loadAdmin().auth.getAuth(adminApp());
export const getAdminDb = () => loadAdmin().database.getDatabase(adminApp());

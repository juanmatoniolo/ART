// Firebase Admin SDK. SOLO servidor (API routes). Nunca importar desde componentes cliente.
// Se inicializa recién al primer uso: así el build no necesita las credenciales.
import "server-only";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

function adminApp() {
  const existing = getApps().find((a) => a.name === "admin");
  if (existing) return existing;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // En .env la clave viene con "\n" escapados
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Faltan FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY");
  }
  return initializeApp(
    {
      credential: cert({ projectId, clientEmail, privateKey }),
      databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
    },
    "admin"
  );
}

export const getAdminAuth = () => getAuth(adminApp());
export const getAdminDb = () => getDatabase(adminApp());

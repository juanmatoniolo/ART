// GET /api/firmas/:archivo   (ej. /api/firmas/DR-BRARDA.jpeg)
// Devuelve la imagen de una firma. Las firmas son datos sensibles: viven en
// src/private/firmas (fuera de public/, no se sirven solas) y solo se entregan
// a usuarios con sesión activa y rol autorizado. El navegador manda el token
// automáticamente (ver lib/dbRestAuth.js). Usar desde el cliente con lib/firmas.js.
import fs from "node:fs/promises";
import path from "node:path";
import { requireUser, handle, HttpError } from "@/lib/serverAuth";

export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), "src", "private", "firmas");
// Roles que imprimen documentos con firma (RP y facturas). ROOT entra siempre.
const ROLES_FIRMAS = ["ADM"];

export const GET = handle(async (request, ctx) => {
  await requireUser(request, ROLES_FIRMAS);

  const { archivo } = await ctx.params;
  // Solo nombres simples: evita leer otros archivos con "../"
  if (!/^[A-Za-z0-9-]+\.jpe?g$/.test(String(archivo || ""))) {
    throw new HttpError(404, "Firma no encontrada.");
  }

  let bytes;
  try {
    bytes = await fs.readFile(path.join(DIR, archivo));
  } catch {
    throw new HttpError(404, "Firma no encontrada.");
  }

  return new Response(bytes, {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
});

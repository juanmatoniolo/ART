import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs";

/* ============================================================
   Cliente de Drive con OAuth (refresh token)
   Mismas credenciales que /api/documentos/upload
============================================================ */

function getDriveClient() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Faltan GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET o GOOGLE_OAUTH_REFRESH_TOKEN en las env vars",
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    "https://developers.google.com/oauthplayground", // redirectUri, no se usa para refresh
  );

  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return google.drive({ version: "v3", auth: oauth2Client });
}

/* ============================================================
   GET: /api/documentos/proxy?id=FILE_ID
============================================================ */

export async function GET(req) {
  try {
    const url = new URL(req.url);
    const fileId = url.searchParams.get("id");

    if (!fileId) {
      return NextResponse.json(
        { error: "Falta parámetro ?id=" },
        { status: 400 },
      );
    }

    const drive = getDriveClient();

    /* 1) Metadatos (mimeType, name, size) */
    let meta;
    try {
      const metaRes = await drive.files.get({
        fileId,
        fields: "id,name,mimeType,size",
      });
      meta = metaRes.data;
    } catch (err) {
      const status = err?.code || err?.response?.status || 500;
      console.error("[PROXY] Error metadatos:", status, err?.message);

      if (status === 404) {
        return NextResponse.json(
          { error: "Archivo no encontrado en Drive" },
          { status: 404 },
        );
      }
      if (status === 403) {
        return NextResponse.json(
          { error: "Sin permisos para leer el archivo" },
          { status: 403 },
        );
      }
      if (status === 401) {
        return NextResponse.json(
          {
            error:
              "Credenciales inválidas. Regenerá GOOGLE_OAUTH_REFRESH_TOKEN.",
          },
          { status: 401 },
        );
      }
      throw err;
    }

    /* 2) Contenido del archivo */
    const fileRes = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );

    const buffer = Buffer.from(fileRes.data);
    const mimeType = meta.mimeType || "application/octet-stream";
    const safeName = String(meta.name || "documento").replace(
      /[^a-zA-Z0-9._-]/g,
      "_",
    );

    /* 3) inline → el navegador lo muestra (imágenes, PDFs)
       - Para PDFs y WebP querés "inline"
       - Si algún día querés forzar descarga, cambiá a "attachment" */
    const disposition = `inline; filename="${safeName}"`;

    /* 4) Devolver el archivo con headers correctos */
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": disposition,
        "Cache-Control": "private, max-age=300, must-revalidate",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (e) {
    console.error("[PROXY] ERROR:", e);
    return NextResponse.json(
      {
        error: "No se pudo obtener el archivo",
        detail: e?.message || String(e),
      },
      { status: 500 },
    );
  }
}
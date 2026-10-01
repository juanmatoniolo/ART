// src/app/api/cloudinary/delete-folder/route.js
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function POST(req) {
  try {
    const { folderPath } = await req.json();

    if (!folderPath || typeof folderPath !== "string") {
      return NextResponse.json(
        { error: "Falta folderPath" },
        { status: 400 },
      );
    }

    // Normalizar: sin barra inicial, con barra final para el prefijo
    const cleanFolder = folderPath.replace(/^\/+/, "").replace(/\/+$/, "");
    const prefix = `${cleanFolder}/`;

    const results = {
      folder: cleanFolder,
      deletedResources: null,
      deletedFolder: null,
      errors: [],
    };

    /* 1) Borrar todos los recursos con ese prefijo (imágenes + raw) */
    for (const resourceType of ["image", "raw", "video"]) {
      try {
        const res = await cloudinary.api.delete_resources_by_prefix(
          prefix,
          { resource_type: resourceType, invalidate: true },
        );
        if (res?.deleted && Object.keys(res.deleted).length > 0) {
          results.deletedResources = {
            ...(results.deletedResources || {}),
            [resourceType]: res.deleted,
          };
        }
      } catch (err) {
        // 404 = no hay recursos de ese tipo, no es error real
        if (err?.http_code !== 404) {
          results.errors.push({
            step: `delete_resources_by_prefix(${resourceType})`,
            message: err?.message || String(err),
          });
        }
      }
    }

    /* 2) Borrar la carpeta vacía */
    try {
      const del = await cloudinary.api.delete_folder(cleanFolder);
      results.deletedFolder = del;
    } catch (err) {
      // 404 = la carpeta ya no existía (quizás no había nada)
      if (err?.http_code !== 404) {
        results.errors.push({
          step: "delete_folder",
          message: err?.message || String(err),
        });
      }
    }

    return NextResponse.json({ ok: true, result: results });
  } catch (err) {
    console.error("[cloudinary/delete-folder]", err);
    return NextResponse.json(
      { error: err?.message || "Error al eliminar la carpeta" },
      { status: 500 },
    );
  }
}
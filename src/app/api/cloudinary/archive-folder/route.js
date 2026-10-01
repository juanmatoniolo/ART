// src/app/api/cloudinary/archive-folder/route.js
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
    const { folderPath, reason = "ELIMINADO" } = await req.json();

    if (!folderPath || typeof folderPath !== "string") {
      return NextResponse.json(
        { error: "Falta folderPath" },
        { status: 400 },
      );
    }

    const cleanFolder = folderPath.replace(/^\/+/, "").replace(/\/+$/, "");
    const folderName = cleanFolder.split("/").pop() || "SIN_NOMBRE";

    // Timestamp legible: 2025-01-15_14-32-05
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const ts = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

    const newFolder = `clinica/_archivados/${ts}_${reason}_${folderName}`;

    const moved = [];
    const errors = [];
    let nextCursor = null;

    /* 1) Listar todos los recursos bajo el prefijo (paginado) */
    do {
      const res = await cloudinary.api.resources({
        type: "upload",
        prefix: `${cleanFolder}/`,
        max_results: 100,
        next_cursor: nextCursor,
      });

      for (const r of res.resources || []) {
        const filename = r.public_id.split("/").pop();
        const newPublicId = `${newFolder}/${filename}`;
        try {
          const ren = await cloudinary.uploader.rename(
            r.public_id,
            newPublicId,
            {
              resource_type: r.resource_type,
              invalidate: true,
            },
          );
          moved.push({ from: r.public_id, to: ren.public_id });
        } catch (err) {
          errors.push({ publicId: r.public_id, error: err.message });
        }
      }

      nextCursor = res.next_cursor;
    } while (nextCursor);

    /* 2) Intentar borrar la carpeta original vacía (si falla, no es crítico) */
    let deletedFolder = null;
    try {
      deletedFolder = await cloudinary.api.delete_folder(cleanFolder);
    } catch (err) {
      if (err?.http_code !== 404) {
        errors.push({ step: "delete_folder", error: err.message });
      }
    }

    return NextResponse.json({
      ok: true,
      result: {
        originalFolder: cleanFolder,
        newFolder,
        movedCount: moved.length,
        moved,
        deletedFolder,
        errors,
      },
    });
  } catch (err) {
    console.error("[cloudinary/archive-folder]", err);
    return NextResponse.json(
      { error: err?.message || "Error al archivar la carpeta" },
      { status: 500 },
    );
  }
}
// src/app/api/cloudinary/delete/route.js
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
    const { publicId, resourceType = "image" } = await req.json();
    if (!publicId) {
      return NextResponse.json({ error: "Falta publicId" }, { status: 400 });
    }

    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });

    // Cloudinary devuelve { result: "ok" | "not found" }
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    console.error("[cloudinary/delete]", err);
    return NextResponse.json(
      { error: err?.message || "Error al eliminar en Cloudinary" },
      { status: 500 },
    );
  }
}
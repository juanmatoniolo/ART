/**
 * Ruta: src/lib/cloudinary-server.js
 * Utilidades de Cloudinary para servidor (borrado y URLs optimizadas).
 * Solo debe usarse en el servidor (Route Handlers, Server Actions, API).
 */
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Elimina un recurso de Cloudinary por public_id.
 * @param {string} publicId
 * @param {"image"|"raw"|"video"} [resourceType="image"]
 */
export async function deleteFromCloudinary(publicId, resourceType = "image") {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
    });
    return result;
  } catch (error) {
    console.error("[cloudinary-server] Error deleting:", error);
    throw error;
  }
}

/**
 * Genera una URL optimizada a partir de un public_id (imágenes).
 */
export function getOptimizedUrl(publicId, options = {}) {
  return cloudinary.url(publicId, {
    fetch_format: "auto",
    quality: "auto",
    crop: "scale",
    width: 800,
    ...options,
  });
}

/**
 * Convierte una URL completa de Cloudinary a una URL optimizada.
 */
export function getOptimizedUrlFromUrl(url, options = {}) {
  if (!url || !url.includes("res.cloudinary.com")) return url;
  const parts = url.split("/image/upload/");
  if (parts.length < 2) return url;
  const publicIdWithVersion = parts[1];
  const publicId = publicIdWithVersion.replace(/^v\d+\//, "");
  return getOptimizedUrl(publicId, options);
}
// src/lib/cloudinary-client.js
// Utilidades cliente para Cloudinary (subida unsigned + borrado).
// NO expone secretos: la subida es unsigned y el borrado pasa por API interna.

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

/* =========================================================
   Detección de tipo
   ========================================================= */

export function isPdfFile(file) {
  return (
    (file?.name && /\.pdf$/i.test(file.name)) ||
    file?.type === "application/pdf"
  );
}

/* =========================================================
   Subida unsigned (con progreso)
   ========================================================= */

/**
 * Sube un archivo a Cloudinary (unsigned upload).
 * @param {File|Blob} file
 * @param {object} opts
 * @param {string} [opts.folder]
 * @param {string} [opts.publicId]
 * @param {(pct:number)=>void} [opts.onProgress]
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<{publicId,url,resourceType,format,bytes,name}>}
 */
export function uploadToCloudinary(file, opts = {}) {
  const { folder, publicId, onProgress, signal } = opts;

  return new Promise((resolve, reject) => {
    if (!CLOUD_NAME || !UPLOAD_PRESET) {
      return reject(
        new Error(
          "Falta config de Cloudinary (cloud name o upload preset). Revisá .env.local",
        ),
      );
    }

    const isPdf = isPdfFile(file);
    const resourceType = isPdf ? "raw" : "image";
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`;

    const fd = new FormData();
    fd.append("file", file);
    fd.append("upload_preset", UPLOAD_PRESET);
    if (folder) fd.append("folder", folder);
    if (publicId) fd.append("public_id", publicId);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress((e.loaded / e.total) * 100);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const d = JSON.parse(xhr.responseText);
          resolve({
            publicId: d.public_id,
            url: d.secure_url,
            resourceType: d.resource_type,
            format: d.format,
            bytes: d.bytes,
            name: file?.name || `${d.public_id}.${d.format || ""}`,
          });
        } catch {
          reject(new Error("Respuesta inválida de Cloudinary"));
        }
      } else {
        let msg = `Error ${xhr.status}`;
        try {
          const j = JSON.parse(xhr.responseText);
          if (j.error?.message) msg = j.error.message;
        } catch {}
        reject(new Error(msg));
      }
    };

    xhr.onerror = () => reject(new Error("Error de red. Revisá tu conexión."));
    xhr.onabort = () =>
      reject(
        new Error(
          "La subida tardó más de lo esperado. Verificá tu conexión e intentá de nuevo.",
        ),
      );

    if (signal) signal.addEventListener("abort", () => xhr.abort());
    xhr.send(fd);
  });
}

/* =========================================================
   Borrado de un recurso individual
   ========================================================= */

/**
 * Elimina un recurso de Cloudinary (llama a la API interna).
 * @param {string} publicId
 * @param {"image"|"raw"|"video"} [resourceType="image"]
 */
export async function deleteFromCloudinary(publicId, resourceType = "image") {
  const res = await fetch("/api/cloudinary/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicId, resourceType }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

/* =========================================================
   Borrado de una carpeta completa
   ========================================================= */

/**
 * Elimina una carpeta completa de Cloudinary (todos sus recursos + la carpeta).
 * @param {string} folderPath - Ej: "clinica/GOMEZ-JUAN-30123456-OSDE-6100001"
 * @returns {Promise<{folder, deletedResources, deletedFolder, errors}>}
 */
export async function deleteFolderFromCloudinary(folderPath) {
  const res = await fetch("/api/cloudinary/delete-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ folderPath }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data.result;
}

/* =========================================================
   Construcción de rutas de carpeta
   ========================================================= */

/**
 * Construye la ruta de la carpeta del paciente en Cloudinary.
 * Debe coincidir con buildCloudinaryFolder() de DocumentacionSection/DocumentosModal.
 * @returns {string} Ej: "clinica/GOMEZ-JUAN-30123456-OSDE-6100001"
 */
export function buildPatientFolderPath(form) {
  const clean = (s) =>
    String(s || "")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "_")
      .replace(/[^A-Za-z0-9_-]/g, "")
      .toUpperCase();

  const apellido = clean(form?.trabajadorApellido) || "SIN_APELLIDO";
  const nombre = clean(form?.trabajadorNombre) || "SIN_NOMBRE";
  const dni = clean(form?.trabajadorDni) || "SIN_DNI";
  const os = clean(form?.OS) || "SIN_OS";
  const afiliado = clean(form?.afiliadoPaciente) || "SIN_AFILIADO";
  return `clinica/${apellido}-${nombre}-${dni}-${os}-${afiliado}`;
}
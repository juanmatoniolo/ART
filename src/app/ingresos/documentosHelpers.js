// src/app/ingresos/documentosHelpers.js
// Helpers de documentos del módulo de ingresos. Google Drive → Cloudinary.
//
// Doc shape esperado:
//   { publicId, url, resourceType, name, fecha,
//     fromPdf?: true, pageNumber?, totalPages? }
//
// Reglas de render:
//   - fromPdf: true        → 1 hoja completa por imagen
//   - resourceType "raw"   → PDF legacy, embebido como PDF nativo
//   - resto                → grilla 2×3

export {
    uploadToCloudinary,
    deleteFromCloudinary,
} from "@/lib/cloudinary-client";

/* =========================================================
   Identificación de tipos
   ========================================================= */

function isLegacyRawPdf(doc) {
    return doc?.resourceType === "raw";
}

function isFromPdf(doc) {
    return doc?.fromPdf === true;
}

function isGridImage(doc) {
    return !isLegacyRawPdf(doc) && !isFromPdf(doc);
}

/* =========================================================
   Carga de imágenes y PDFs
   ========================================================= */

function loadImageElement(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
            console.warn("[docs] No se pudo cargar imagen:", url);
            resolve(null);
        };
        img.src = url;
    });
}

/**
 * Convierte cualquier imagen (WebP/PNG/JPEG) a bytes PNG usando canvas.
 * Esto evita el problema de que pdf-lib no soporta WebP.
 * @returns {Promise<Uint8Array|null>}
 */
async function imageToPngBytes(url) {
    const img = await loadImageElement(url);
    if (!img) return null;

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");

    // Fondo blanco por si la imagen tiene transparencias
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    const dataUrl = canvas.toDataURL("image/png");
    const base64 = dataUrl.split(",")[1];
    return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function loadFileBytes(doc) {
    const url = typeof doc === "string" ? doc : doc?.url;
    if (!url) return null;
    try {
        const res = await fetch(url, { mode: "cors" });
        if (!res.ok) {
            console.warn(`[docs] No se pudo cargar ${url}: HTTP ${res.status}`);
            return null;
        }
        return await res.arrayBuffer();
    } catch (err) {
        console.warn(`[docs] Error cargando ${url}:`, err);
        return null;
    }
}

/* =========================================================
   Collage de imágenes normales (2×3 por página)
   ========================================================= */

async function buildCollageCanvases({ docs, form }) {
    const PAGE_W = 1240;
    const PAGE_H = 1754;
    const MARGIN = 60;
    const GAP = 24;
    const COLS = 2;
    const ROWS = 3;
    const CELL_W = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
    const CELL_H = (PAGE_H - MARGIN * 2 - 110 - GAP * (ROWS - 1)) / ROWS;

    const loaded = await Promise.all(
        docs.map(async (d) => {
            const img = await loadImageElement(d.url);
            return img ? { img, doc: d } : null;
        }),
    );
    const valid = loaded.filter(Boolean);
    if (!valid.length) return [];

    const perPage = COLS * ROWS;
    const totalPages = Math.ceil(valid.length / perPage);
    const canvases = [];

    for (let p = 0; p < totalPages; p++) {
        const slice = valid.slice(p * perPage, (p + 1) * perPage);
        const canvas = document.createElement("canvas");
        canvas.width = PAGE_W;
        canvas.height = PAGE_H;
        const ctx = canvas.getContext("2d");

        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, PAGE_W, PAGE_H);

        const paciente =
            `${form.trabajadorApellido || ""} ${form.trabajadorNombre || ""}`
                .trim()
                .toUpperCase();
        const os = (form.OS || "").toUpperCase();
        const afiliado = form.afiliadoPaciente || "";

        ctx.fillStyle = "#111827";
        ctx.font = "bold 32px sans-serif";
        ctx.fillText("DOCUMENTACIÓN DEL PACIENTE - FRENTE", MARGIN, MARGIN);

        ctx.font = "20px sans-serif";
        ctx.fillStyle = "#374151";
        ctx.fillText(
            `Paciente: ${paciente || "—"}   |   O.S: ${os || "—"}   |   N° Afil.: ${afiliado || "—"}`,
            MARGIN,
            MARGIN + 34,
        );
        ctx.fillText(
            `Fecha: ${new Date().toLocaleDateString("es-AR")}   |   Página ${p + 1} de ${totalPages}`,
            MARGIN,
            MARGIN + 62,
        );

        const topOffset = MARGIN + 100;

        slice.forEach((item, idx) => {
            const col = idx % COLS;
            const row = Math.floor(idx / COLS);
            const x = MARGIN + col * (CELL_W + GAP);
            const y = topOffset + row * (CELL_H + GAP);

            ctx.strokeStyle = "#9ca3af";
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, CELL_W, CELL_H);

            const iw = item.img.width;
            const ih = item.img.height;
            const scale = Math.min((CELL_W - 16) / iw, (CELL_H - 44) / ih);
            const dw = iw * scale;
            const dh = ih * scale;
            const dx = x + (CELL_W - dw) / 2;
            const dy = y + 8 + (CELL_H - 44 - dh) / 2;

            ctx.drawImage(item.img, dx, dy, dw, dh);

            ctx.fillStyle = "#111827";
            ctx.font = "bold 16px sans-serif";
            const label = item.doc.name || `documento${idx + 1}`;
            ctx.fillText(label, x + 10, y + CELL_H - 14);
        });

        canvases.push(canvas);
    }

    return canvases;
}

/* =========================================================
   FRENTE (grilla + hojas completas + PDFs legacy)
   ========================================================= */

export async function generarFrentePDFBlob({ docs, form }) {
    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const A4_W = 595.28;
    const A4_H = 841.89;

    const allDocs = Array.isArray(docs) ? docs : [];
    const gridDocs = allDocs.filter(isGridImage);
    const pdfImageDocs = allDocs.filter(isFromPdf);
    const legacyRawDocs = allDocs.filter(isLegacyRawPdf);

    console.log(
        `[docs] generarFrentePDFBlob → grid: ${gridDocs.length}, fromPdf: ${pdfImageDocs.length}, legacyRaw: ${legacyRawDocs.length}`,
    );

    /* 1) Grilla de fotos normales */
    if (gridDocs.length > 0) {
        const canvases = await buildCollageCanvases({
            docs: gridDocs,
            form,
        });

        for (const canvas of canvases) {
            const pngDataUrl = canvas.toDataURL("image/png");
            const pngBase64 = pngDataUrl.split(",")[1];
            const pngBytes = Uint8Array.from(atob(pngBase64), (c) =>
                c.charCodeAt(0),
            );
            const pngImage = await pdf.embedPng(pngBytes);
            const page = pdf.addPage([A4_W, A4_H]);
            const scale = A4_W / pngImage.width;
            const imgH = pngImage.height * scale;
            page.drawImage(pngImage, {
                x: 0,
                y: A4_H - imgH,
                width: A4_W,
                height: imgH,
            });
        }
    }

    /* 2) Imágenes fromPdf → 1 hoja completa cada una
          ⚠️ Antes intentaba embedPng(bytes) directo, lo cual falla con WebP.
          Ahora pasamos por canvas → PNG. */
    for (const doc of pdfImageDocs) {
        try {
            const pngBytes = await imageToPngBytes(doc.url);
            if (!pngBytes) {
                console.warn("[docs] No se pudo decodificar fromPdf:", doc.url);
                continue;
            }

            const embedded = await pdf.embedPng(pngBytes);
            const page = pdf.addPage([A4_W, A4_H]);

            const MARGIN_PT = 18;
            const maxW = A4_W - MARGIN_PT * 2;
            const maxH = A4_H - MARGIN_PT * 2;
            const scale = Math.min(
                maxW / embedded.width,
                maxH / embedded.height,
            );
            const w = embedded.width * scale;
            const h = embedded.height * scale;
            const x = (A4_W - w) / 2;
            const y = (A4_H - h) / 2;

            page.drawImage(embedded, { x, y, width: w, height: h });
        } catch (err) {
            console.warn(
                `[docs] No se pudo embeber fromPdf "${doc.name}":`,
                err?.message || err,
            );
        }
    }

    /* 3) PDFs legacy (resourceType "raw") → embebido nativo */
    for (const doc of legacyRawDocs) {
        try {
            const bytes = await loadFileBytes(doc);
            if (!bytes) continue;

            const srcDoc = await PDFDocument.load(bytes, {
                ignoreEncryption: true,
            });
            const pageIndices = srcDoc.getPageIndices();
            const copiedPages = await pdf.copyPages(srcDoc, pageIndices);
            copiedPages.forEach((p) => pdf.addPage(p));
        } catch (err) {
            console.warn(
                `[docs] No se pudo embeber legacy "${doc.name}":`,
                err?.message || err,
            );
        }
    }

    if (pdf.getPageCount() === 0) {
        throw new Error(
            "No se pudieron cargar los documentos. Verificá que las imágenes o PDFs se hayan subido correctamente.",
        );
    }

    const bytes = await pdf.save();
    return new Blob([bytes], { type: "application/pdf" });
}

/* =========================================================
   DORSO
   ========================================================= */

export async function generarDorsoPDFBlob({ pacienteNombre = "" } = {}) {
    const res = await fetch("/templates/DORSO-CX.pdf");
    if (!res.ok) {
        throw new Error(
            "No se encontró /templates/DORSO-CX.pdf. Verificá que esté en public/templates/.",
        );
    }
    const bytes = await res.arrayBuffer();

    const { PDFDocument } = await import("pdf-lib");
    const pdf = await PDFDocument.load(bytes);

    try {
        const form = pdf.getForm();
        const allFields = form.getFields().map((f) => f.getName());
        console.log("[DORSO] Campos del PDF:", allFields);

        let tf = null;
        try {
            tf = form.getTextField("nombres-paciente");
        } catch {
            try {
                tf = form.getTextField("nombres-pacientes");
            } catch {}
        }

        if (tf) {
            tf.setText((pacienteNombre || "").toUpperCase());
            console.log("[DORSO] Campo completado con:", pacienteNombre);
        } else {
            console.warn(
                "[DORSO] No se encontró 'nombres-paciente' ni 'nombres-pacientes'",
            );
        }
    } catch (e) {
        console.warn("[DORSO] Error rellenando el form:", e?.message);
    }

    try {
        pdf.getForm().flatten();
    } catch (e) {
        console.warn("[DORSO] No se pudo aplanar el form:", e?.message);
    }

    const totalPages = pdf.getPageCount();
    for (let i = totalPages - 1; i >= 1; i--) {
        pdf.removePage(i);
    }

    const out = await pdf.save();
    return new Blob([out], { type: "application/pdf" });
}

export function openPDFBlob(blob, fileName = "documento.pdf") {
    const url = URL.createObjectURL(blob);
    const win = window.open("", "_blank");
    if (win) {
        win.location.href = url;
    } else {
        const a = document.createElement("a");
        a.href = url;
        a.target = "_blank";
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}
/**
 * Genera un PDF (A4) con la documentación:
 *   - Imágenes → grilla 2×3 por página
 *   - PDFs → se embeben sus páginas originales
 * Devuelve un Blob PDF, o null si no hay documentos válidos.
 * No fusiona con nada: el caller decide cómo combinarlo.
 */

/* =========================================================
   Helpers para identificar y cargar archivos
   ========================================================= */

function isPdfDoc(doc) {
	return /\.pdf$/i.test(doc?.name || "");
}

function loadImage(src) {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

async function loadFileBytes(fileId) {
	try {
		const res = await fetch(`/api/documentos/proxy?id=${fileId}`);
		if (!res.ok) {
			console.warn(
				`[docs] No se pudo cargar ${fileId}: HTTP ${res.status}`,
			);
			return null;
		}
		return await res.arrayBuffer();
	} catch (err) {
		console.warn(`[docs] Error cargando ${fileId}:`, err);
		return null;
	}
}

/* =========================================================
   Grilla de imágenes (2×3 por página)
   ========================================================= */

async function buildImageCanvases({ docs, form }) {
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
			const img = await loadImage(`/api/documentos/proxy?id=${d.fileId}`);
			return img ? { img, doc: d } : null;
		}),
	);
	const valid = loaded.filter(Boolean);
	if (!valid.length) return [];

	const perPage = COLS * ROWS;
	const totalPages = Math.ceil(valid.length / perPage);

	const paciente =
		`${form?.trabajadorApellido || ""} ${form?.trabajadorNombre || ""}`
			.trim()
			.toUpperCase();
	const os = (form?.OS || "").toUpperCase();
	const afiliado = form?.afiliadoPaciente || "";
	const hoy = new Date().toLocaleDateString("es-AR");

	const canvases = [];

	for (let p = 0; p < totalPages; p++) {
		const slice = valid.slice(p * perPage, (p + 1) * perPage);

		const canvas = document.createElement("canvas");
		canvas.width = PAGE_W;
		canvas.height = PAGE_H;
		const ctx = canvas.getContext("2d");

		ctx.fillStyle = "#ffffff";
		ctx.fillRect(0, 0, PAGE_W, PAGE_H);

		ctx.fillStyle = "#111827";
		ctx.font = "bold 32px sans-serif";
		ctx.fillText("DOCUMENTACIÓN DEL PACIENTE", MARGIN, MARGIN);

		ctx.font = "20px sans-serif";
		ctx.fillStyle = "#374151";
		ctx.fillText(
			`Paciente: ${paciente || "—"}   |   O.S: ${os || "—"}   |   N° Afil.: ${afiliado || "—"}`,
			MARGIN,
			MARGIN + 34,
		);
		ctx.fillText(
			`Fecha: ${hoy}   |   Página ${p + 1} de ${totalPages}`,
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
			ctx.fillText(
				item.doc.name || `documento${idx + 1}`,
				x + 10,
				y + CELL_H - 14,
			);
		});

		canvases.push(canvas);
	}

	return canvases;
}

/* =========================================================
   Generar PDF combinado (imágenes + PDFs)
   ========================================================= */

export async function generarDocumentosPDFBlob({ docs, form }) {
	const allDocs = Array.isArray(docs) ? docs : [];
	if (allDocs.length === 0) return null;

	const { PDFDocument } = await import("pdf-lib");
	const pdf = await PDFDocument.create();
	const A4_W = 595.28;
	const A4_H = 841.89;

	const imageDocs = allDocs.filter((d) => !isPdfDoc(d));
	const pdfDocs = allDocs.filter((d) => isPdfDoc(d));

	/* ───── 1) Grilla de imágenes (si hay) ───── */
	if (imageDocs.length > 0) {
		const canvases = await buildImageCanvases({
			docs: imageDocs,
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

	/* ───── 2) PDFs: embeber sus páginas tal cual ───── */
	for (const doc of pdfDocs) {
		try {
			const bytes = await loadFileBytes(doc.fileId);
			if (!bytes) continue;

			const srcDoc = await PDFDocument.load(bytes, {
				ignoreEncryption: true,
			});
			const pageIndices = srcDoc.getPageIndices();
			const copiedPages = await pdf.copyPages(srcDoc, pageIndices);
			copiedPages.forEach((p) => pdf.addPage(p));
		} catch (err) {
			console.warn(
				`[docs] No se pudo embeber "${doc.name}":`,
				err?.message || err,
			);
		}
	}

	/* ───── 3) Validación ───── */
	if (pdf.getPageCount() === 0) {
		console.warn("[docs] No se pudo generar ninguna página");
		return null;
	}

	const bytes = await pdf.save();
	return new Blob([bytes], { type: "application/pdf" });
}
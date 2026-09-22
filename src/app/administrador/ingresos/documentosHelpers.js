import { convertToWebP, cropToRatio } from "./helpers";

const UPLOAD_TIMEOUT_MS = 20000;

export function uploadWithProgress(url, formData, onProgress, signal) {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("POST", url);
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
		};
		xhr.onload = () => {
			if (xhr.status >= 200 && xhr.status < 300) {
				try {
					resolve(JSON.parse(xhr.responseText));
				} catch {
					reject(new Error("Respuesta inválida del servidor"));
				}
			} else {
				let msg = `Error ${xhr.status}`;
				try {
					const j = JSON.parse(xhr.responseText);
					if (j.error) msg = j.error;
				} catch {}
				reject(new Error(msg));
			}
		};
		xhr.onerror = () =>
			reject(new Error("Error de red. Revisá tu conexión."));
		xhr.ontimeout = () => reject(new Error("Tiempo de espera agotado"));
		xhr.onabort = () =>
			reject(new Error("Subida cancelada por tiempo de espera"));
		if (signal) signal.addEventListener("abort", () => xhr.abort());
		xhr.send(formData);
	});
}

function loadImage(src) {
	return new Promise((resolve) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => resolve(null);
		img.src = src;
	});
}

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
			const img = await loadImage(`/api/documentos/proxy?id=${d.fileId}`);
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

export async function generarFrentePDFBlob({ docs, form }) {
	const canvases = await buildCollageCanvases({ docs, form });
	if (!canvases.length) throw new Error("No se pudieron cargar las imágenes");

	const { PDFDocument } = await import("pdf-lib");
	const pdf = await PDFDocument.create();
	const A4_W = 595.28;
	const A4_H = 841.89;

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

	const bytes = await pdf.save();
	return new Blob([bytes], { type: "application/pdf" });
}

/* =========================================================
   DORSO: completa "nombres-paciente" y deja SOLO la hoja 1
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

	/* 1) Rellenar el campo */
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

	/* 2) Aplanar */
	try {
		pdf.getForm().flatten();
	} catch (e) {
		console.warn("[DORSO] No se pudo aplanar el form:", e?.message);
	}

	/* 3) Recortar a hoja 1 */
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

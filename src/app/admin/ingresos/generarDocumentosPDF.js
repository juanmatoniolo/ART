/**
 * Genera un PDF (A4) con la documentación (fotos) en grilla 2×3 por página.
 * Devuelve un Blob PDF, o null si no hay documentos válidos.
 * No fusiona con nada: el caller decide cómo combinarlo.
 */
export async function generarDocumentosPDFBlob({ docs, form }) {
	if (!Array.isArray(docs) || docs.length === 0) return null;

	const { PDFDocument } = await import("pdf-lib");

	const PAGE_W = 1240;
	const PAGE_H = 1754;
	const MARGIN = 60;
	const GAP = 24;
	const COLS = 2;
	const ROWS = 3;
	const CELL_W = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
	const CELL_H = (PAGE_H - MARGIN * 2 - 110 - GAP * (ROWS - 1)) / ROWS;

	const loaded = await Promise.all(
		docs.map(
			(d) =>
				new Promise((resolve) => {
					const img = new Image();
					img.onload = () => resolve({ img, doc: d });
					img.onerror = () => resolve(null);
					img.src = `/api/documentos/proxy?id=${d.fileId}`;
				}),
		),
	);
	const valid = loaded.filter(Boolean);
	if (!valid.length) return null;

	const perPage = COLS * ROWS;
	const totalPages = Math.ceil(valid.length / perPage);

	const pdf = await PDFDocument.create();
	const A4_W = 595.28;
	const A4_H = 841.89;

	const paciente =
		`${form?.trabajadorApellido || ""} ${form?.trabajadorNombre || ""}`
			.trim()
			.toUpperCase();
	const os = (form?.OS || "").toUpperCase();
	const afiliado = form?.afiliadoPaciente || "";
	const hoy = new Date().toLocaleDateString("es-AR");

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

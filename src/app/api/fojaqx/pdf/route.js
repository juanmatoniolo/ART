import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";

// Ruta al template (ubicado en public/templates/FOJAQX.pdf)
const TEMPLATE_PATH = path.join(
	process.cwd(),
	"public",
	"templates",
	"FOJAQX.pdf",
);

// Etiquetas que van en NEGRITA dentro del campo `cx`.
const CX_LABELS = [
	"1. Diagnóstico Preoperatorio",
	"2. Diagnóstico Posoperatorio",
	"3. Procedimiento Quirúrgico",
	"4. Operación y Hallazgos",
];

function cleanText(s) {
	const v = (s ?? "").toString().trim();
	if (!v || v === "-" || v.toLowerCase() === "n/a") return "";
	return v;
}

function pad2(value) {
	return String(value ?? "").padStart(2, "0");
}

// Arma el texto unificado de la descripción. Si el payload ya trae `cx`, lo usa.
function buildCx(payload) {
	if (typeof payload.cx === "string" && payload.cx.trim() !== "") {
		return payload.cx;
	}
	const d = payload.descripcion || {};
	const secciones = [
		["1. Diagnóstico Preoperatorio", d.preoperatorio],
		["2. Diagnóstico Posoperatorio", d.posoperatorio],
		["3. Procedimiento Quirúrgico", d.procedimientoqx],
		["4. Operación y Hallazgos", d.hallazgos],
	];
	return secciones
		.map(
			([etiqueta, contenido]) =>
				`${etiqueta}: ${(contenido ?? "").toString().trim()}`,
		)
		.join("\n\n");
}

// Convierte el texto `cx` en "líneas lógicas". Cada línea es un array de runs
// { text, bold }: la etiqueta conocida va en negrita y el resto normal.
function buildRichLines(cx) {
	return cx.split("\n").map((line) => {
		for (const label of CX_LABELS) {
			if (line.startsWith(label)) {
				let rest = line.slice(label.length);
				let boldPart = label;
				if (rest.startsWith(":")) {
					boldPart += ":";
					rest = rest.slice(1);
				}
				return [
					{ text: boldPart, bold: true },
					{ text: rest, bold: false },
				];
			}
		}
		return [{ text: line, bold: false }];
	});
}

// Dibuja el texto enriquecido (etiquetas en negrita) dentro del rectángulo del
// campo `cx`, con corte de línea automático según el ancho disponible.
function drawRichText(page, logicalLines, opts) {
	const { x, yTop, minY, maxWidth, fontSize, lineHeight, helv, helvBold } =
		opts;
	const fontFor = (bold) => (bold ? helvBold : helv);
	const spaceW = helv.widthOfTextAtSize(" ", fontSize);
	let y = yTop;

	for (const runs of logicalLines) {
		// Aplanar runs en palabras, conservando el flag de negrita.
		const words = [];
		for (const run of runs) {
			for (const piece of run.text.split(" ")) {
				if (piece !== "") words.push({ text: piece, bold: run.bold });
			}
		}

		// Línea en blanco (separador entre secciones).
		if (words.length === 0) {
			y -= lineHeight;
			if (y < minY) return;
			continue;
		}

		let lineWords = [];
		let lineWidth = 0;

		const flush = () => {
			let cx2 = x;
			for (const w of lineWords) {
				const f = fontFor(w.bold);
				page.drawText(w.text, { x: cx2, y, size: fontSize, font: f });
				cx2 += f.widthOfTextAtSize(w.text, fontSize) + spaceW;
			}
			y -= lineHeight;
			lineWords = [];
			lineWidth = 0;
		};

		for (const w of words) {
			const f = fontFor(w.bold);
			const wWidth = f.widthOfTextAtSize(w.text, fontSize);
			const add = (lineWords.length === 0 ? 0 : spaceW) + wWidth;
			if (lineWords.length > 0 && lineWidth + add > maxWidth) {
				flush();
				if (y < minY) return;
			}
			lineWords.push(w);
			lineWidth += add;
		}

		if (lineWords.length) {
			flush();
			if (y < minY) return;
		}
	}
}

// Campos del formulario (todos menos `cx`, que se dibuja aparte con negrita).
function buildPdfFields(payload) {
	const paciente = payload.paciente || {};
	const equipo = payload.equipo || {};
	const fecha = payload.fecha || {};
	const horario = payload.horario || {};

	const edadLimpia = cleanText(paciente.edad);
	const edadFormateada = edadLimpia
		? /\baños?\b/i.test(edadLimpia)
			? edadLimpia
			: `${edadLimpia} años`
		: "";

	return {
		apelidoynombre: cleanText(paciente.apelidoynombre),
		edad: edadFormateada,
		cirujano: cleanText(equipo.cirujano),
		primerayudante: cleanText(equipo.primerayudante),
		segundoayudante: cleanText(equipo.segundoayudante),
		anestesista: cleanText(equipo.anestesista),
		dia: pad2(fecha.dia),
		mes: cleanText(fecha.mes),
		anio: cleanText(fecha.anio),
		inichsinicio: cleanText(horario.inicio),
		hsfin: cleanText(horario.fin),
	};
}

async function fillFormFields(form, fields) {
	const missing = [];

	for (const [name, value] of Object.entries(fields)) {
		try {
			const field = form.getTextField(name);
			if (!field) throw new Error(`Field ${name} not found`);
			field.setText(value || "");
			field.setFontSize(11);
		} catch (err) {
			missing.push(name);
		}
	}

	if (missing.length)
		console.log("[FOJA-QX] Campos no encontrados:", missing);
}

// GET: diagnóstico (lista de campos del template)
export async function GET(req) {
	try {
		const templateBytes = await fs.readFile(TEMPLATE_PATH);
		const pdfDoc = await PDFDocument.load(templateBytes);
		const form = pdfDoc.getForm();
		const fieldNames = form.getFields().map((f) => f.getName());
		return NextResponse.json({
			ok: true,
			fieldsCount: fieldNames.length,
			fieldNames,
		});
	} catch (e) {
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}

// POST: generar PDF relleno
export async function POST(req) {
	try {
		const { payload, fileName } = await req.json();
		if (!payload)
			return NextResponse.json(
				{ error: "Missing payload" },
				{ status: 400 },
			);

		const templateBytes = await fs.readFile(TEMPLATE_PATH);
		const pdfDoc = await PDFDocument.load(templateBytes);
		const form = pdfDoc.getForm();

		// 1) Rellenar los campos normales (paciente, equipo, fecha, horario)
		const fields = buildPdfFields(payload);
		await fillFormFields(form, fields);

		// 2) Capturar la posición del campo `cx` y quitarlo del formulario,
		//    porque la descripción la dibujamos a mano (con etiquetas en negrita).
		const cxText = buildCx(payload);
		let cxRect = null;
		let cxPage = null;
		try {
			const cxField = form.getTextField("cx");
			const widget = cxField.acroField.getWidgets()[0];
			cxRect = widget.getRectangle();
			cxPage = pdfDoc.getPages()[0];
			try {
				form.removeField(cxField);
			} catch (_) {
				cxField.setText("");
			}
		} catch (e) {
			console.log("[FOJA-QX] campo cx no disponible:", e.message);
		}

		// 3) Congelar el resto del formulario
		form.flatten();

		// 4) Dibujar la descripción con etiquetas en negrita
		if (cxRect && cxPage && cxText.trim() !== "") {
			const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
			const helvBold = await pdfDoc.embedFont(
				StandardFonts.HelveticaBold,
			);
			const fontSize = 10;
			const pad = 5;

			drawRichText(cxPage, buildRichLines(cxText), {
				x: cxRect.x + pad,
				yTop: cxRect.y + cxRect.height - pad - fontSize,
				minY: cxRect.y + pad,
				maxWidth: cxRect.width - pad * 2,
				fontSize,
				lineHeight: fontSize * 1.4,
				helv,
				helvBold,
			});
		}

		const pdfBytes = await pdfDoc.save();
		const safeName = (fileName || "FOJA_QX.pdf").replace(
			/[^a-zA-Z0-9._-]/g,
			"_",
		);

		return new NextResponse(pdfBytes, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `inline; filename="${safeName}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		console.error("[PDF ERROR]", error);
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

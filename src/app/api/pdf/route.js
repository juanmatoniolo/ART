import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

const LUGAR_FECHA_CONST = "Chajari, Entre Rios";

function templatePath() {
	return path.join(
		process.cwd(),
		"src",
		"templates",
		"FORMULARIO-ART-UNIFICADO.pdf"
	);
}

function onlyDigits(s) {
	return (s ?? "").toString().replace(/\D/g, "");
}

function cleanText(s) {
	const v = (s ?? "").toString().trim();
	if (!v) return "";
	// si usás "-" como “vacío”, lo convertimos en ""
	if (v === "-" || v.toLowerCase() === "n/a") return "";
	return v;
}

function splitDateISO(iso) {
	if (!iso) return { dia: "", mes: "", anio: "" };
	const [yyyy, mm, dd] = iso.split("-");
	return { dia: dd || "", mes: mm || "", anio: yyyy || "" };
}

function getPrestadorFromEnv() {
	const nombre = cleanText(process.env.PRESTADOR_NOMBRE);
	const cuit = onlyDigits(process.env.PRESTADOR_CUIT);

	const calle = cleanText(process.env.PRESTADOR_CALLE);
	const nro = cleanText(process.env.PRESTADOR_NUMERO);
	const piso = cleanText(process.env.PRESTADOR_PISO);
	const depto = cleanText(process.env.PRESTADOR_DEPTO);

	const localidad = cleanText(process.env.PRESTADOR_LOCALIDAD);
	const provincia = cleanText(process.env.PRESTADOR_PROVINCIA);
	const cp = onlyDigits(process.env.PRESTADOR_CP);

	const ddn = onlyDigits(process.env.PRESTADOR_TEL_DDN);
	const tel = onlyDigits(process.env.PRESTADOR_TEL);
	const celular = onlyDigits(`${ddn}${tel}`); // ej: 3456 + 441580

	const mail = cleanText(process.env.PRESTADOR_MAIL);

	return {
		nombre,
		cuit,
		calle,
		nro,
		piso,
		depto,
		localidad,
		provincia,
		cp,
		celular,
		mail,
	};
}

function buildPdfFields(payload) {
	const t = payload.trabajador || {};
	const emp = payload.empleador || {};
	const art = payload.ART || {};
	const c = payload.consulta || {};

	// ✅ Prestador SIEMPRE desde ENV
	const p = getPrestadorFromEnv();

	const nac = splitDateISO(t.nacimiento);
	const nombreEmpleado = `${cleanText(t.apellido)} ${cleanText(
		t.nombre
	)}`.trim();

	return {
		// ART
		art: cleanText(art.nombre),
		"num-siniestro": cleanText(art.nroSiniestro),

		// EMPLEADO
		"empleado-nombre": nombreEmpleado,
		"empleado-dni": onlyDigits(t.dni),

		"empleado-dia": nac.dia,
		"empleado-mes": nac.mes,
		"empleado-anio": nac.anio,

		"Sexo M": t.sexo === "M",
		F: t.sexo === "F",

		"empleado-calle": cleanText(t.calle),
		"empleado-nro": cleanText(t.numero),
		"empleado-piso": cleanText(t.piso),
		"empleado-depto": cleanText(t.depto),
		"empleado-localidad": cleanText(t.localidad),
		"empleado-provincia": cleanText(t.provincia),
		"empleado-cp": onlyDigits(t.cp),
		"empleado-celular": onlyDigits(t.telefono),

		// EMPLEADOR
		"empleador-nombre": cleanText(emp.nombre),
		"empleador-cuit": onlyDigits(emp.cuit),
		"empleador-cuil": onlyDigits(emp.cuit),

		// MOTIVO
		"motivo-trabajo": c.tipo === "AT",
		"motivo-in-itinere": c.tipo === "AIT",
		"motivo-enfermedad-profesional": c.tipo === "EP",
		"motivo-intercurrencia": c.tipo === "INT",

		// CONST
		"lugar-fecha": LUGAR_FECHA_CONST,

		// PRESTADOR (desde ENV)
		"prestador-nombre": p.nombre,
		"prestador-cuit": p.cuit,

		"prestador-calle": p.calle,
		"prestador-nro": p.nro,
		"prestador-piso": p.piso,
		"prestador-depto": p.depto,

		"prestador-localidad": p.localidad,
		"prestador-provincia": p.provincia,
		"prestador-cp": p.cp,

		"prestador-celular": p.celular,
		"prestador-mail": p.mail,
	};
}

function fillFormFields(form, fields) {
	const missing = [];

	for (const [name, value] of Object.entries(fields || {})) {
		let ok = false;

		// TextField
		try {
			const tf = form.getTextField(name);
			tf.setText(value == null ? "" : String(value));
			ok = true;
		} catch {}

		if (ok) continue;

		// Checkbox
		try {
			const cb = form.getCheckBox(name);
			if (value === true) cb.check();
			else cb.uncheck();
			ok = true;
		} catch {}

		if (!ok) missing.push(name);
	}

	if (missing.length) console.log("[PDF] missing fields:", missing);
}

// GET debug
export async function GET(req) {
	try {
		const url = new URL(req.url);
		const debug = url.searchParams.get("debug") === "1";
		const pdfFile = templatePath();

		if (!debug) {
			return NextResponse.json({
				ok: true,
				runtime: "nodejs",
				template: pdfFile,
			});
		}

		const templateBytes = await fs.readFile(pdfFile);
		const pdfDoc = await PDFDocument.load(templateBytes);
		const form = pdfDoc.getForm();
		const fieldNames = form.getFields().map((f) => f.getName());

		// ✅ también devolvemos el prestador ya parseado desde ENV para confirmar
		const prestador = getPrestadorFromEnv();

		return NextResponse.json({
			ok: true,
			runtime: "nodejs",
			template: pdfFile,
			fieldsCount: fieldNames.length,
			fieldNames,
			prestadorFromEnv: prestador,
		});
	} catch (e) {
		return NextResponse.json(
			{
				ok: false,
				error: "No se pudo leer el template",
				detail: e?.message || String(e),
			},
			{ status: 500 }
		);
	}
}

export async function POST(req) {
	try {
		const { payload, fileName } = await req.json();

		if (!payload) {
			return NextResponse.json(
				{ error: "Falta payload" },
				{ status: 400 }
			);
		}

		const pdfFile = templatePath();
		const templateBytes = await fs.readFile(pdfFile);

		const pdfDoc = await PDFDocument.load(templateBytes);
		const form = pdfDoc.getForm();

		const fields = buildPdfFields(payload);
		fillFormFields(form, fields);

		form.flatten();
		const out = await pdfDoc.save();

		const safeName = (fileName || "FORMULARIO_ART.pdf")
			.toString()
			.replace(/[^a-zA-Z0-9._-]/g, "_");

		return new NextResponse(out, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `inline; filename="${safeName}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		console.error("[PDF] ERROR:", e);
		return NextResponse.json(
			{
				error: "No se pudo generar el PDF",
				detail: e?.message || String(e),
			},
			{ status: 500 }
		);
	}
}

// src/app/api/pdf/route.js
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

// ✅ Prestador fijo (NO pedir en el form)
const PRESTADOR = {
	nombre: process.env.PRESTADOR_NOMBRE || "CLINICA DE LA UNION S.A",
	cuit: process.env.PRESTADOR_CUIT || "30-70754530-1",
	calle: process.env.PRESTADOR_CALLE || "AV. SIBURU",
	numero: process.env.PRESTADOR_NUMERO || "1085",
	piso: process.env.PRESTADOR_PISO || "-",
	depto: process.env.PRESTADOR_DEPTO || "-",
	localidad: process.env.PRESTADOR_LOCALIDAD || "CHAJARI",
	provincia: process.env.PRESTADOR_PROVINCIA || "ENTRE RIOS",
	cp: process.env.PRESTADOR_CP || "3228",
	telDdn: process.env.PRESTADOR_TEL_DDN || "3456",
	tel: process.env.PRESTADOR_TEL || "441580",
	fax: process.env.PRESTADOR_FAX || "-",
	mail: process.env.PRESTADOR_MAIL || "CLINICADELAUNIONART@GMAIL.COM",
};

// ✅ Otro dato constante
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

function splitDateISO(iso) {
	if (!iso) return { dia: "", mes: "", anio: "" };
	const [yyyy, mm, dd] = iso.split("-");
	return { dia: dd || "", mes: mm || "", anio: yyyy || "" };
}

function buildPdfFields(payload) {
	const t = payload.trabajador || {};
	const e = payload.empleador || {};
	const a = payload.ART || {};
	const c = payload.consulta || {};
	const p = payload.prestador || PRESTADOR;

	const apellidoNombre = `${(t.apellido || "").trim()} ${(
		t.nombre || ""
	).trim()}`.trim();
	const nac = splitDateISO(t.nacimiento);

	return {
		// ✅ nombres EXACTOS del debug (pdf-lib)
		art: (a.nombre || "").trim(),
		"num-siniestro": (a.nroSiniestro || "").trim(),

		// Empleado
		"empleado-nombre": apellidoNombre,
		"empleado-dni": onlyDigits(t.dni),
		"empleado-dia": nac.dia,
		"empleado-mes": nac.mes,
		"empleado-anio": nac.anio,

		"Sexo M": t.sexo === "M",
		F: t.sexo === "F",

		"empleado-calle": (t.calle || "").trim(),
		"empleado-nro": (t.numero || "").trim(),
		"empleado-piso": (t.piso || "").trim(),
		"empleado-depto": (t.depto || "").trim(),
		"empleado-localidad": (t.localidad || "").trim(),
		"empleado-provincia": (t.provincia || "").trim(),
		"empleado-cp": onlyDigits(t.cp),
		"empleado-celular": onlyDigits(t.telefono),

		// Empleador (tu form: nombre + cuit)
		"empleador-nombre": (e.nombre || "").trim(),
		"empleador-cuit": onlyDigits(e.cuit),

		// Existe en el PDF, pero no lo pedís: lo dejamos vacío (o si querés lo igualamos al CUIT)
		"empleador-cuil": "",

		// Campos del empleador que existen pero NO los capturás en tu form: vacíos
		"empleador-calle": "",
		"empleador-nro": "",
		"empleador-piso": "",
		"empleador-depto": "",
		"empleador-localidad": "",
		"empleador-provincia": "",
		"empleador-cp": "",
		"empleador-celular": "",
		"empleador-mail": "",

		// Prestador (fijo) -> el PDF solo tiene prestador-nombre según tu debug
		"prestador-nombre": (p.nombre || "").trim(),

		// Motivo (solo contingencia)
		"motivo-trabajo": c.tipo === "AT",
		"motivo-in-itinere": c.tipo === "AIT",
		"motivo-enfermedad-profesional": c.tipo === "EP",
		"motivo-intercurrencia": c.tipo === "INT",

		// Constante
		"lugar-fecha": LUGAR_FECHA_CONST,
	};
}

function fillFormFields(form, fields) {
	const missing = [];
	for (const [name, value] of Object.entries(fields || {})) {
		let ok = false;

		// Text
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

// ✅ GET: health + debug fields (?debug=1)
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

		return NextResponse.json({
			ok: true,
			runtime: "nodejs",
			template: pdfFile,
			fieldsCount: fieldNames.length,
			fieldNames,
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

		// ✅ Inyectar constantes (no confiar en cliente)
		payload.prestador = PRESTADOR;

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

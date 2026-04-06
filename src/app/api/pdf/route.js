import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

const LUGAR_FECHA_CONST = "CHAJARÍ, ENTRE RÍOS";

function templatePath() {
	return path.join(process.cwd(), "src", "templates", "ART-COMPLETOS.pdf");
}

// Solo dígitos (para limpieza interna, pero no se usa en campos con formato)
function onlyDigits(s) {
	return (s ?? "").toString().replace(/\D/g, "");
}

// Limpia texto: recorta, mayúsculas, evita valores vacíos o "-"
function cleanText(s) {
	const v = (s ?? "").toString().trim();
	if (!v) return "";
	if (v === "-" || v.toLowerCase() === "n/a") return "";
	return v.toUpperCase();
}

function pad2(value) {
	return String(value ?? "").padStart(2, "0");
}

function splitDateISO(iso) {
	if (!iso) return { dia: "", mes: "", anio: "" };
	const [yyyy, mm, dd] = iso.split("-");
	return {
		dia: dd ? pad2(dd) : "",
		mes: mm ? pad2(mm) : "",
		anio: yyyy || "",
	};
}

function formatDate({ dia, mes, anio }) {
	if (!dia || !mes || !anio) return "";
	return `${pad2(dia)}-${pad2(mes)}-${anio}`;
}

// Función auxiliar para formatear CUIT (11 dígitos) con guiones y puntos
// Se usa solo si se necesita aplicar formato, pero en general el frontend ya lo envía formateado.
function formatCuil(digits) {
	const d = onlyDigits(digits);
	if (d.length !== 11) return digits;
	return `${d.slice(0, 2)}-${d.slice(2, 4)}.${d.slice(4, 7)}.${d.slice(7, 10)}-${d.slice(10)}`;
}

// Construye los campos a rellenar en el PDF a partir del payload recibido.
function buildPdfFields(payload) {
	const t = payload.trabajador || {};
	const emp = payload.empleador || {};
	const art = payload.ART || {};
	const c = payload.consulta || {};
	const fechaIngreso = payload.fechaIngreso || {};
	const fechaDenuncia = payload.fechaDenuncia || {};

	// ✅ TOMAR PRESTADOR DEL PAYLOAD (enviado desde el frontend)
	const p = payload.prestador || {};

	// Cálculos de fechas y nombre completo
	const nac = splitDateISO(t.nacimiento);
	const nombreEmpleado = `${cleanText(t.apellido)} ${cleanText(t.nombre)}`.trim();
	const edad = t.edad ? `${t.edad} AÑOS` : "";

	const fechaIngresoObj = {
		dia: pad2(fechaIngreso.dia || ""),
		mes: pad2(fechaIngreso.mes || ""),
		anio: String(fechaIngreso.anio || ""),
	};

	const fechaDenunciaObj = {
		dia: pad2(fechaDenuncia.dia || ""),
		mes: pad2(fechaDenuncia.mes || ""),
		anio: String(fechaDenuncia.anio || ""),
	};

	const fechaNacimientoStr = formatDate(nac);
	const fechaIngresoStr = formatDate(fechaIngresoObj);
	const fechaDenunciaStr = formatDate(fechaDenunciaObj);

	// Retornamos los valores que se escribirán en los campos del PDF
	return {
		// ART
		art: cleanText(art.nombre),
		"num-siniestro": cleanText(art.nroSiniestro),

		// TRABAJADOR
		"empleado-nombre": nombreEmpleado,
		"empleado-dni": cleanText(t.dni),        // conserva puntos y guiones
		"empleado-dia": nac.dia,
		"empleado-mes": nac.mes,
		"empleado-anio": nac.anio,
		"fecha-nacimiento": fechaNacimientoStr,
		"empleado-edad": edad,
		"empleado-calle": cleanText(t.calle),
		"empleado-nro": cleanText(t.numero),
		"empleado-piso": cleanText(t.piso),
		"empleado-depto": cleanText(t.depto),
		"empleado-localidad": cleanText(t.localidad),
		"empleado-provincia": cleanText(t.provincia),
		"empleado-cp": cleanText(t.cp),          // mantiene formato si lo tiene
		"empleado-celular": cleanText(t.telefono),
		"Sexo M": t.sexo === "M",
		F: t.sexo === "F",

		// EMPLEADOR
		"empleador-nombre": cleanText(emp.nombre),
		"empleador-cuit": cleanText(emp.cuit),   // conserva guiones y puntos
		"empleador-cuil": cleanText(emp.cuit),

		// MOTIVO
		"motivo-trabajo": c.tipo === "AT",
		"motivo-in-itinere": c.tipo === "AIT",
		"motivo-enfermedad-profesional": c.tipo === "EP",
		"motivo-intercurrencia": c.tipo === "INT",

		// FECHAS (ingreso y denuncia)
		dia: fechaIngresoObj.dia,
		mes: fechaIngresoObj.mes,
		anio: fechaIngresoObj.anio,
		"fecha-ingreso": fechaIngresoStr,
		"dia-denuncia": fechaDenunciaObj.dia,
		"mes-denuncia": fechaDenunciaObj.mes,
		"anio-denuncia": fechaDenunciaObj.anio,
		"fecha-denuncia": fechaDenunciaStr,

		// LUGAR Y FECHA CONSTANTE
		"lugar-fecha": LUGAR_FECHA_CONST,

		// ✅ PRESTADOR (desde payload, respetando el formato original)
		"prestador-nombre": cleanText(p.nombre),
		"prestador-cuit": cleanText(p.cuit),       // ej: "30-70754530-0"
		"prestador-calle": cleanText(p.calle),
		"prestador-nro": cleanText(p.nro),
		"prestador-piso": cleanText(p.piso),
		"prestador-depto": cleanText(p.depto),
		"prestador-localidad": cleanText(p.localidad),
		"prestador-provincia": cleanText(p.provincia),
		"prestador-cp": cleanText(p.cp),
		"prestador-celular": cleanText(p.celular),
		"prestador-mail": cleanText(p.mail),
	};
}

// Rellena los campos del formulario del PDF
function fillFormFields(form, fields) {
	const missing = [];

	for (const [name, value] of Object.entries(fields || {})) {
		let ok = false;

		try {
			const tf = form.getTextField(name);
			tf.setText(value == null ? "" : String(value).toUpperCase());
			ok = true;
		} catch {}

		if (ok) continue;

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

// Endpoint GET de diagnóstico (no requiere variables de entorno)
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
			// Ya no dependemos de ENV, pero se puede mostrar un mensaje
			message: "Los datos del prestador se toman del payload enviado por el frontend",
		});
	} catch (e) {
		return NextResponse.json(
			{
				ok: false,
				error: "No se pudo leer el template",
				detail: e?.message || String(e),
			},
			{ status: 500 },
		);
	}
}

// Endpoint POST: genera el PDF con los datos recibidos
export async function POST(req) {
	try {
		const { payload, fileName } = await req.json();

		if (!payload) {
			return NextResponse.json(
				{ error: "Falta payload" },
				{ status: 400 },
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
			{ status: 500 },
		);
	}
}
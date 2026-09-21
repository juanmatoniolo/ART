import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

const LUGAR_FECHA_CONST = "CHAJARÍ, ENTRE RÍOS";
const DEFAULT_TEMPLATE = "ART-COMPLETOS.pdf";

// Páginas del template INT-UIT-FOJA según tipo de ingreso
const PAGES_BY_TYPE = {
	PISO: [1, 2, 3, 4, 5, 6, 7, 8],
	UTI: [1, 9, 10, 11, 12],
};

function getTemplatePath(templateName = DEFAULT_TEMPLATE) {
	const file = templateName.toLowerCase().endsWith(".pdf")
		? templateName
		: `${templateName}.pdf`;
	return path.join(process.cwd(), "src", "templates", file);
}

function cleanFileName(fileName = "FORMULARIO.pdf") {
	return fileName.toString().replace(/[^a-zA-Z0-9._-]/g, "_");
}

function onlyDigits(s) {
	return (s ?? "").toString().replace(/\D/g, "");
}

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

function normalizePayload(payload, pdfType = "art") {
	if (pdfType !== "evolucion") return payload;

	return {
		...payload,
		fechaIngreso: {
			...(payload?.fechaIngreso || {}),
			dia: "",
			mes: "",
			anio: "",
		},
	};
}

/* ============================================================
   ART (formulario existente, sin cambios)
   ============================================================ */
function buildArtFields(payload) {
	const t = payload.trabajador || {};
	const emp = payload.empleador || {};
	const art = payload.ART || {};
	const c = payload.consulta || {};
	const fechaIngreso = payload.fechaIngreso || {};
	const fechaDenuncia = payload.fechaDenuncia || {};
	const p = payload.prestador || {};

	const nac = splitDateISO(t.nacimiento);
	const nombreEmpleado =
		`${cleanText(t.apellido)} ${cleanText(t.nombre)}`.trim();
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

	return {
		art: cleanText(art.nombre),
		"num-siniestro": cleanText(art.nroSiniestro),

		"empleado-nombre": nombreEmpleado,
		"empleado-dni": cleanText(t.dni),
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
		"empleado-cp": cleanText(t.cp),
		"empleado-celular": cleanText(t.telefono),
		"Sexo M": t.sexo === "M",
		F: t.sexo === "F",

		"empleador-nombre": cleanText(emp.nombre),
		"empleador-cuit": cleanText(emp.cuit),
		"empleador-cuil": cleanText(emp.cuit),

		"motivo-trabajo": c.tipo === "AT",
		"motivo-in-itinere": c.tipo === "AIT",
		"motivo-enfermedad-profesional": c.tipo === "EP",
		"motivo-intercurrencia": c.tipo === "INT",

		dia: fechaIngresoObj.dia,
		mes: fechaIngresoObj.mes,
		anio: fechaIngresoObj.anio,
		"fecha-ingreso": fechaIngresoStr,
		"dia-denuncia": fechaDenunciaObj.dia,
		"mes-denuncia": fechaDenunciaObj.mes,
		"anio-denuncia": fechaDenunciaObj.anio,
		"fecha-denuncia": fechaDenunciaStr,

		"lugar-fecha": LUGAR_FECHA_CONST,

		"prestador-nombre": cleanText(p.nombre),
		"prestador-cuit": cleanText(p.cuit),
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

/* ============================================================
   INGRESO PACIENTES (template INT-UIT-FOJA.pdf)
   ============================================================ */
function buildIngresoFields(payload) {
	const t = payload.trabajador || {};
	const fam = payload.familiar || {};
	const int = payload.internacion || {};
	const fi = payload.fechaIngreso || {};
	const p = payload.prestador || {};

	const nac = splitDateISO(t.nacimiento);
	const fechaIngresoObj = {
		dia: pad2(fi.dia || ""),
		mes: pad2(fi.mes || ""),
		anio: String(fi.anio || ""),
	};

	const habitacionCama = cleanText(int.habitacionCama);

	return {
		// ===== Datos del ingreso =====
		os: cleanText(payload.OS),
		"obra-social": cleanText(payload.OS),
		"afiliado-paciente": cleanText(payload.afiliadoPaciente),
		"nro-afiliado": cleanText(payload.afiliadoPaciente),
		"tipo-ingreso": cleanText(payload.tipoIngreso),
		"fecha-ingreso": formatDate(fechaIngresoObj),
		"dia-ingreso": fechaIngresoObj.dia,
		"mes-ingreso": fechaIngresoObj.mes,
		"anio-ingreso": fechaIngresoObj.anio,

		// ===== Paciente =====
		"paciente-apellido": cleanText(t.apellido),
		"paciente-nombre": cleanText(t.nombre),
		"paciente-nombre-completo":
			`${cleanText(t.apellido)} ${cleanText(t.nombre)}`.trim(),
		"paciente-dni": cleanText(t.dni),
		"paciente-nacimiento": formatDate(nac),
		"paciente-dia": nac.dia,
		"paciente-mes": nac.mes,
		"paciente-anio": nac.anio,
		"paciente-edad": t.edad ? `${t.edad} AÑOS` : "",
		"paciente-sexo": cleanText(t.sexo),
		"paciente-calle": cleanText(t.calle),
		"paciente-numero": cleanText(t.numero),
		"paciente-piso": cleanText(t.piso),
		"paciente-depto": cleanText(t.depto),
		"paciente-localidad": cleanText(t.localidad),
		"paciente-provincia": cleanText(t.provincia),
		"paciente-cp": cleanText(t.cp),
		"paciente-telefono": cleanText(t.telefono),

		// ===== Familiar =====
		"familiar-nombre": cleanText(fam.nombre),
		"familiar-parentezco": cleanText(fam.parentezco),
		"familiar-telefono": cleanText(fam.telefono),

		// ===== Internación =====
		"habitacion-cama": habitacionCama,
		cama: habitacionCama,
		"cama-numero": cleanText(int.camaNumero),
		"cama-letra": cleanText(int.camaLetra),

		// ===== Prestador =====
		"prestador-nombre": cleanText(p.nombre),
		"prestador-cuit": cleanText(p.cuit),
		"prestador-calle": cleanText(p.calle),
		"prestador-nro": cleanText(p.nro),
		"prestador-piso": cleanText(p.piso),
		"prestador-depto": cleanText(p.depto),
		"prestador-localidad": cleanText(p.localidad),
		"prestador-provincia": cleanText(p.provincia),
		"prestador-cp": cleanText(p.cp),
		"prestador-celular": cleanText(p.celular),
		"prestador-mail": cleanText(p.mail),
		"lugar-fecha": LUGAR_FECHA_CONST,
	};
}

/* ============================================================
   Filler genérico (texto + checkbox)
   ============================================================ */
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

/* ============================================================
   GET: debug del template
   ============================================================ */
export async function GET(req) {
	try {
		const url = new URL(req.url);
		const debug = url.searchParams.get("debug") === "1";
		const templateName =
			url.searchParams.get("templateName") || DEFAULT_TEMPLATE;
		const pdfFile = getTemplatePath(templateName);

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
			pages: pdfDoc.getPageCount(),
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
			{ status: 500 },
		);
	}
}

/* ============================================================
   POST: genera el PDF
   ============================================================ */
export async function POST(req) {
	try {
		const {
			payload,
			fileName,
			templateName,
			template,
			pdfType = "art",
			pages,
		} = await req.json();

		if (!payload) {
			return NextResponse.json(
				{ error: "Falta payload" },
				{ status: 400 },
			);
		}

		const isIngreso = pdfType === "ingreso";
		const finalTemplate =
			templateName ||
			template ||
			(isIngreso ? "INT-UIT-FOJA.pdf" : DEFAULT_TEMPLATE);

		const pdfFile = getTemplatePath(finalTemplate);
		const templateBytes = await fs.readFile(pdfFile);

		const pdfDoc = await PDFDocument.load(templateBytes);
		const safePayload = normalizePayload(payload, pdfType);
		const fields = isIngreso
			? buildIngresoFields(safePayload)
			: buildArtFields(safePayload);

		let finalDoc;

		if (isIngreso) {
			// 1. Determinar páginas a conservar
			const tipo = safePayload.tipoIngreso || "PISO";
			const keep =
				Array.isArray(pages) && pages.length > 0
					? pages
					: PAGES_BY_TYPE[tipo] || PAGES_BY_TYPE.PISO;

			const totalPages = pdfDoc.getPageCount();
			const zeroBased = keep
				.map((p) => Number(p) - 1)
				.filter((i) => i >= 0 && i < totalPages);

			// 2. Crear doc nuevo sólo con las páginas elegidas
			finalDoc = await PDFDocument.create();
			const copied = await finalDoc.copyPages(pdfDoc, zeroBased);
			copied.forEach((pg) => finalDoc.addPage(pg));

			// 3. Rellenar form del doc NUEVO
			const form = finalDoc.getForm();
			fillFormFields(form, fields);
			form.flatten();
		} else {
			// ART / evolucion: flujo original
			const form = pdfDoc.getForm();
			fillFormFields(form, fields);
			form.flatten();
			finalDoc = pdfDoc;
		}

		const out = await finalDoc.save();
		const safeName = cleanFileName(fileName || "FORMULARIO.pdf");

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

import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";

const TEMPLATE_NAME = "INT-UIT-FOJA.pdf";

const PAGES_BY_TYPE = {
	PISO: [1, 2, 3, 4, 5, 6, 7, 8],
	UTI: [1, 9, 10, 11, 12],
};

/* ------------------------- helpers ------------------------- */
function getTemplatePath() {
	return path.join(process.cwd(), "src", "templates", TEMPLATE_NAME);
}

function cleanFileName(fileName = "INGRESO.pdf") {
	return fileName.toString().replace(/[^a-zA-Z0-9._-]/g, "_");
}

function cleanText(s) {
	const v = (s ?? "").toString().trim();
	if (!v) return "";
	if (v === "-" || v.toLowerCase() === "n/a") return "";
	return v.toUpperCase();
}

function pad2(v) {
	return String(v ?? "").padStart(2, "0");
}

function normalizeYear2(v) {
	const d = String(v ?? "").replace(/\D/g, "");
	if (!d) return "";
	if (d.length >= 4) return d.slice(-2);
	return d.padStart(2, "0").slice(-2);
}

function normalizeMonthDay(v) {
	const d = String(v ?? "").replace(/\D/g, "");
	if (!d) return "";
	return d.slice(-2).padStart(2, "0");
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

/* ============================================================
   buildIngresoFields
   ============================================================ */
function buildIngresoFields(payload) {
	const t = payload.trabajador || {};
	const fam = payload.familiar || {};
	const int = payload.internacion || {};
	const fi = payload.fechaIngreso || {};

	// ===== Fechas =====
	const nac = splitDateISO(t.nacimiento);

	const ingDia = normalizeMonthDay(fi.dia);
	const ingMes = normalizeMonthDay(fi.mes);
	const ingAnio = normalizeYear2(fi.anio);

	// ===== Apellido / Nombre por separado + combinado =====
	const apellidoPaciente = cleanText(t.apellido);
	const nombrePaciente = cleanText(t.nombre);
	const nombreCompleto = `${apellidoPaciente} ${nombrePaciente}`.trim();

	const edad = t.edad ? `${String(t.edad).trim()} AÑOS` : "";

	const domicilio = [
		cleanText(t.calle),
		cleanText(t.numero),
		t.piso ? `PISO ${cleanText(t.piso)}` : "",
		t.depto ? `DPTO ${cleanText(t.depto)}` : "",
	]
		.filter(Boolean)
		.join(" ")
		.trim();

	const ingresoFecha = [ingDia, ingMes, ingAnio].filter(Boolean).join("/");
	const nacimientoFecha = [nac.dia, nac.mes, nac.anio]
		.filter(Boolean)
		.join("/");

	const os = cleanText(payload.OS);
	const afiliado = cleanText(payload.afiliadoPaciente);
	const dni = cleanText(t.dni);
	const diagnostico = cleanText(payload.diagnostico);
	const medicoSolicitante = cleanText(payload.medicoSolicitante);
	const historiaClinica = cleanText(payload.historiaClinica);

	// ===== Habitación/Cama con prefijo según tipo =====
	const esUTI = payload.tipoIngreso === "UTI";
	let habitacionCamaTexto = "";
	if (esUTI) {
		const cama = cleanText(int.camaNumero);
		habitacionCamaTexto = cama ? `CAMA: ${cama}` : "";
	} else {
		const hab = cleanText(int.habitacionCama);
		habitacionCamaTexto = hab ? `HAB.: ${hab}` : "";
	}

	const esMasculino = t.sexo === "M";
	const esFemenino = t.sexo === "F";

	const parentescoVal = cleanText(fam.parentezco);

	return {
		// =========================================================
		//  HC
		// =========================================================
		"hc-paciente": historiaClinica,
		hc: historiaClinica,
		"hc-n": historiaClinica,
		"hc-no": historiaClinica,
		"historia-clinica": historiaClinica,
		"nro-hc": historiaClinica,

		// =========================================================
		//  OBRA SOCIAL
		// =========================================================
		os: os,
		"o-s": os,
		"o.s": os,
		"obra-social": os,
		"o-social": os,
		obrasocial: os,
		mutual: os,
		"mutual-paciente": os,
		art: os,
		"a-r-t": os,
		art_os: os,

		// =========================================================
		//  N° AFILIADO
		// =========================================================
		"afiliado-paciente": afiliado,
		"afiliado-no": afiliado,
		afiliado: afiliado,
		"nro-afiliado": afiliado,
		"n-afiliado": afiliado,

		// =========================================================
		//  PACIENTE — apellido, nombre y combinado por separado
		// =========================================================
		// ⚠️ Apellido solo
		"apellido-paciente": apellidoPaciente,
		"paciente-apellido": apellidoPaciente,
		apellido: apellidoPaciente,

		// ⚠️ Nombre solo
		"nombre-paciente": nombrePaciente,
		"paciente-nombre": nombrePaciente,
		nombre: nombrePaciente,

		// Combinado (hoja principal)
		"nombres-paciente": nombreCompleto,
		"paciente-nombre-completo": nombreCompleto,
		"nombre-completo": nombreCompleto,
		"apellido-nombre": nombreCompleto,
		nombres: nombreCompleto,

		// =========================================================
		//  SEXO
		// =========================================================
		"masculino-paciente": esMasculino,
		"femenino-paciente": esFemenino,
		masculino: esMasculino,
		femenino: esFemenino,
		"sexo-m": esMasculino,
		"sexo-f": esFemenino,
		"paciente-sexo": cleanText(t.sexo),
		sexo: cleanText(t.sexo),

		// =========================================================
		//  DOCUMENTO
		// =========================================================
		"dni-paciente": dni,
		dni: dni,
		documento: dni,
		"paciente-dni": dni,
		"nro-documento": dni,
		"n-documento": dni,

		// =========================================================
		//  FECHA DE NACIMIENTO
		// =========================================================
		dia: nac.dia,
		mes: nac.mes,
		año: nac.anio,
		anio: nac.anio,
		"fecha-nacimiento": nacimientoFecha,
		"paciente-nacimiento": nacimientoFecha,
		"paciente-dia": nac.dia,
		"paciente-mes": nac.mes,
		"paciente-anio": nac.anio,
		"paciente-año": nac.anio,

		// =========================================================
		//  FECHA DE INGRESO  →  dia-int / mes-int / año-int
		// =========================================================
		"dia-int": ingDia,
		"mes-int": ingMes,
		"año-int": ingAnio,
		"anio-int": ingAnio,

		// Variantes por compatibilidad
		"dia-ingreso": ingDia,
		"mes-ingreso": ingMes,
		"año-ingreso": ingAnio,
		"anio-ingreso": ingAnio,

		ingreso: ingresoFecha,
		"fecha-ingreso": ingresoFecha,

		// =========================================================
		//  EDAD
		// =========================================================
		edad: edad,
		"edad-paciente": edad,
		"paciente-edad": edad,
		"edad-anios": edad,
		"edad-años": edad,

		// =========================================================
		//  UBICACIÓN
		// =========================================================
		"localidad-paciente": cleanText(t.localidad),
		localidad: cleanText(t.localidad),
		"paciente-localidad": cleanText(t.localidad),

		"provincia-paciente": cleanText(t.provincia),
		provincia: cleanText(t.provincia),
		"paciente-provincia": cleanText(t.provincia),

		"nacimiento-paciente": cleanText(t.localidad),
		"lugar-nacimiento": cleanText(t.localidad),

		// =========================================================
		//  DOMICILIO
		// =========================================================
		"domicilio-paciente": domicilio,
		domicilio: domicilio,
		"paciente-domicilio": domicilio,
		"domicilio-habitual": domicilio,
		"domicilio-habitual-paciente": domicilio,

		// =========================================================
		//  TELÉFONO PACIENTE
		// =========================================================
		"telefono-paciente": cleanText(t.telefono),
		telefono: cleanText(t.telefono),
		"paciente-telefono": cleanText(t.telefono),
		celular: cleanText(t.telefono),

		// =========================================================
		//  FAMILIAR
		// =========================================================
		"familiar-nombre": cleanText(fam.nombre),
		"nombre-familiar": cleanText(fam.nombre),
		familiar: cleanText(fam.nombre),

		"familiar-telefono": cleanText(fam.telefono),
		"telefono-familiar": cleanText(fam.telefono),

		// ⚠️ PARENTESCO: el ID real es "familiar-parenteszco" (con SZ)
		"familiar-parenteszco": parentescoVal,
		"familiar-parentezco": parentescoVal,
		"familiar-parentesco": parentescoVal,
		parenteszco: parentescoVal,
		parentezco: parentescoVal,
		parentesco: parentescoVal,
		"parentezco-familiar": parentescoVal,
		"parentesco-familiar": parentescoVal,

		// =========================================================
		//  INTERNACIÓN
		// =========================================================
		servicio: cleanText(payload.tipoIngreso),
		"tipo-ingreso": cleanText(payload.tipoIngreso),

		"habitacion-cama": habitacionCamaTexto,
		habitacion: habitacionCamaTexto,
		cama: habitacionCamaTexto,

		"cama-numero": cleanText(int.camaNumero),
		"cama-letra": cleanText(int.camaLetra),

		// =========================================================
		//  DIAGNÓSTICO / MÉDICO
		// =========================================================
		cx: diagnostico,
		"cx-0": diagnostico,
		diagnostico: diagnostico,
		"diagnostico-ingreso": diagnostico,
		"diagnostico-al-ingreso": diagnostico,

		"nombre-dr": medicoSolicitante,
		"medico-solicitante": medicoSolicitante,
		medico: medicoSolicitante,
		"medico-cabecera": medicoSolicitante,
		"medico-de-cabecera": medicoSolicitante,

		// =========================================================
		//  EGRESO
		// =========================================================
		e: "",
		"fecha-egreso": "",
		egreso: "",
	};
}

/* ---------------- filler genérico ---------------- */
function fillFormFields(form, fields) {
	const missing = [];
	const filled = [];

	for (const [name, value] of Object.entries(fields || {})) {
		let ok = false;

		// 1) TEXT FIELD
		try {
			const tf = form.getTextField(name);
			tf.setText(value == null ? "" : String(value).toUpperCase());
			ok = true;
			filled.push(name);
		} catch {}

		// 2) CHECKBOX
		if (!ok) {
			try {
				const cb = form.getCheckBox(name);
				value === true ? cb.check() : cb.uncheck();
				ok = true;
				filled.push(name);
			} catch {}
		}

		// 3) RADIO
		if (!ok) {
			try {
				const rg = form.getRadioGroup(name);
				if (value) rg.select(String(value));
				ok = true;
				filled.push(name);
			} catch {}
		}

		// 4) DROPDOWN
		if (!ok) {
			try {
				const dd = form.getDropdown(name);
				if (value) dd.select(String(value));
				ok = true;
				filled.push(name);
			} catch {}
		}

		if (!ok) missing.push(name);
	}

	// LOG
	console.log("\n========== [INGRESOS-PDF] RESULTADO ==========");
	console.log("✅ Campos rellenados:", filled.length);
	console.log("   " + filled.join(", "));
	console.log("❌ Campos NO encontrados en el template:", missing.length);
	if (missing.length) console.log("   " + missing.join(", "));

	const allPdfFields = form.getFields().map((f) => f.getName());
	console.log(
		"\n📋 Campos REALES que tiene el PDF (" + allPdfFields.length + "):",
	);
	console.log("   " + allPdfFields.join(", "));

	const notCovered = allPdfFields.filter((n) => !filled.includes(n));
	if (notCovered.length) {
		console.log("\n⚠️  Campos del PDF que NO estamos rellenando:");
		console.log("   " + notCovered.join(", "));
	}
	console.log("==============================================\n");

	return { filled, missing, allPdfFields, notCovered };
}

/* ============================================================
   GET  →  debug / annotate
   ============================================================ */
export async function GET(req) {
	try {
		const url = new URL(req.url);
		const debug = url.searchParams.get("debug") === "1";
		const annotate = url.searchParams.get("annotate") === "1";
		const pdfFile = getTemplatePath();

		if (!debug && !annotate) {
			return NextResponse.json({ ok: true, template: pdfFile });
		}

		const bytes = await fs.readFile(pdfFile);
		const pdfDoc = await PDFDocument.load(bytes);
		const form = pdfDoc.getForm();
		const pages = pdfDoc.getPages();

		const fieldsInfo = [];
		for (const field of form.getFields()) {
			const ctor = field.constructor.name;
			let tipo = "otro";
			if (ctor.includes("TextField")) tipo = "text";
			else if (ctor.includes("CheckBox")) tipo = "checkbox";
			else if (ctor.includes("RadioGroup")) tipo = "radio";
			else if (ctor.includes("Dropdown")) tipo = "dropdown";
			else if (ctor.includes("OptionList")) tipo = "optionlist";

			const widgets = field.acroField.getWidgets();
			const paginas = [];
			const rects = [];
			widgets.forEach((w) => {
				const pageRef = w.P();
				const idx = pages.findIndex((p) => p.ref === pageRef);
				if (idx >= 0) paginas.push(idx + 1);
				try {
					const r = w.getRectangle();
					rects.push({
						x: Math.round(r.x),
						y: Math.round(r.y),
						width: Math.round(r.width),
						height: Math.round(r.height),
					});
				} catch {}
			});

			fieldsInfo.push({
				name: field.getName(),
				type: tipo,
				pages: [...new Set(paginas)],
				rects,
			});
		}

		if (debug) {
			return NextResponse.json({
				ok: true,
				template: pdfFile,
				totalPages: pdfDoc.getPageCount(),
				fieldsCount: fieldsInfo.length,
				fieldNames: fieldsInfo.map((f) => f.name),
				fields: fieldsInfo,
			});
		}

		// annotate
		const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
		for (const field of form.getFields()) {
			const name = field.getName();
			const widgets = field.acroField.getWidgets();
			for (const w of widgets) {
				const pageRef = w.P();
				const page = pages.find((p) => p.ref === pageRef);
				if (!page) continue;
				try {
					const r = w.getRectangle();
					page.drawRectangle({
						x: r.x,
						y: r.y,
						width: r.width,
						height: r.height,
						borderColor: rgb(1, 0, 0),
						borderWidth: 1,
						color: rgb(1, 1, 0),
						opacity: 0.15,
						borderOpacity: 1,
					});
					page.drawText(name, {
						x: r.x + 2,
						y: r.y + r.height + 2,
						size: 6,
						font,
						color: rgb(0.8, 0, 0),
					});
				} catch {}
			}
		}

		const outBytes = await pdfDoc.save();
		return new NextResponse(outBytes, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": 'inline; filename="ANOTADO.pdf"',
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		return NextResponse.json(
			{
				ok: false,
				error: "No se pudo procesar el template",
				detail: e?.message || String(e),
			},
			{ status: 500 },
		);
	}
}

/* ============================================================
   POST  →  genera el PDF de ingreso
   ============================================================ */
export async function POST(req) {
	try {
		const { payload, fileName, pages } = await req.json();

		if (!payload) {
			return NextResponse.json(
				{ error: "Falta payload" },
				{ status: 400 },
			);
		}

		const pdfFile = getTemplatePath();
		const templateBytes = await fs.readFile(pdfFile);
		const srcDoc = await PDFDocument.load(templateBytes);

		const form = srcDoc.getForm();
		fillFormFields(form, buildIngresoFields(payload));
		form.flatten();

		const tipo = payload.tipoIngreso === "UTI" ? "UTI" : "PISO";
		const keep =
			Array.isArray(pages) && pages.length > 0
				? pages
				: PAGES_BY_TYPE[tipo];

		const totalPages = srcDoc.getPageCount();
		const zeroBased = keep
			.map((p) => Number(p) - 1)
			.filter((i) => i >= 0 && i < totalPages);

		const outDoc = await PDFDocument.create();
		const copied = await outDoc.copyPages(srcDoc, zeroBased);
		copied.forEach((pg) => outDoc.addPage(pg));

		const outBytes = await outDoc.save();
		const safeName = cleanFileName(fileName || "INGRESO.pdf");

		return new NextResponse(outBytes, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `inline; filename="${safeName}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		console.error("[INGRESOS-PDF] ERROR:", e);
		return NextResponse.json(
			{
				error: "No se pudo generar el PDF",
				detail: e?.message || String(e),
			},
			{ status: 500 },
		);
	}
}

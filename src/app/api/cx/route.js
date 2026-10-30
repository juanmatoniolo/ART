import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";

export const runtime = "nodejs";

const TEMPLATE_FILENAME = "INT-UIT-FOJA.pdf"; // Unificamos la plantilla

function getTemplatePath() {
	return path.join(process.cwd(), "public", "templates", TEMPLATE_FILENAME);
}

/* ============================================================
   HELPERS
============================================================ */

function cleanText(v) {
	const s = String(v ?? "").trim();
	if (!s) return "";
	if (s === "-" || s.toLowerCase() === "n/a") return "";
	return s.toUpperCase();
}

function pad2(v) {
	return String(v ?? "").padStart(2, "0");
}
function onlyDigits(v) {
	return String(v ?? "").replace(/\D/g, "");
}

function normalizeYear2(v) {
	const d = onlyDigits(v);
	if (!d) return "";
	if (d.length >= 4) return d.slice(-2);
	return d.padStart(2, "0").slice(-2);
}

function splitISO(iso) {
	if (!iso) return { dia: "", mes: "", anio: "" };
	const [yyyy, mm, dd] = String(iso).split("-");
	return {
		dia: dd ? pad2(dd) : "",
		mes: mm ? pad2(mm) : "",
		anio: yyyy || "",
	};
}

function formatAfiliado(raw) {
	const d = onlyDigits(raw);
	if (!d) return "";
	if (d.length > 8) {
		const p = d.padStart(11, "0").slice(-11);
		return `${p.slice(0, 2)}-${p.slice(2, 4)}.${p.slice(4, 7)}.${p.slice(7, 10)}-${p.slice(10)}`;
	}
	if (d.length === 7)
		return `${d.slice(0, 1)}.${d.slice(1, 4)}.${d.slice(4, 7)}`;
	if (d.length === 8)
		return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}`;
	return d.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/* ============================================================
   BUILD FIELDS
============================================================ */

function buildCxFields(payload) {
	const pd = payload?.pacienteDatos || {};
	const fam = payload?.familiar || pd?.familiar || {};
	const formulario = payload?.formulario || {};
	const servicio = cleanText(payload?.servicio || "PISO");
	const habitacionCama = cleanText(
		payload?.habitacionCama || pd?.habitacionCama || "",
	);

	const lugarNacimiento = cleanText(
		payload?.lugarNacimiento ||
			pd?.lugarNacimiento ||
			formulario?.["nacimiento-paciente"] ||
			formulario?.["nacmiento-paciente"] ||
			formulario?.["lugar-nacimiento"] ||
			"",
	);

	const nac = splitISO(pd.fechaNacimiento);

	let cxFecha = { dia: "", mes: "", anio: "" };
	if (payload?.fechaCirugia?.dia || payload?.fechaCirugia?.mes) {
		cxFecha = {
			dia: pad2(payload.fechaCirugia.dia),
			mes: pad2(payload.fechaCirugia.mes),
			anio: normalizeYear2(payload.fechaCirugia.anio),
		};
	} else if (payload?.fechaEstimada) {
		const parts = splitISO(payload.fechaEstimada);
		cxFecha = {
			dia: parts.dia,
			mes: parts.mes,
			anio: normalizeYear2(parts.anio),
		};
	}

	const edadNum = onlyDigits(pd.edad);
	const edad = edadNum ? `${edadNum} AÑOS` : "";

	const apellido = cleanText(pd.apellido);
	const nombre = cleanText(pd.nombre);
	const nombreCompleto = `${apellido} ${nombre}`.trim();

	/* ✅ AFILIADO / DNI */
	const dniRaw = pd.dni || "";
	const dniFormateado = formatAfiliado(dniRaw);

	// NUEVO: Capturamos el N° de afiliado específico (ej PAMI)
	const afiliadoRaw = cleanText(pd.afiliadoPaciente || "");
	const afiliadoFinal = afiliadoRaw || dniFormateado; // Si hay afiliado, lo usamos.

	const hcRaw = cleanText(pd.historiaClinica);
	const historiaClinicaFinal = hcRaw || dniFormateado;

	const art = cleanText(formulario.art || formulario.os || "");
	const cx = cleanText(formulario.cx || "");

	const doctorRaw = cleanText(
		formulario["nombre-dr"] ||
			formulario.nombreDr ||
			formulario.medico ||
			"",
	);
	const doctorPrint =
		doctorRaw && !/^DR\.?\s/i.test(doctorRaw)
			? `DR. ${doctorRaw}`
			: doctorRaw;

	const localidad = cleanText(pd.localidad);
	const provincia = cleanText(pd.provincia);
	const domicilio = cleanText(pd.domicilio);
	const telefono = cleanText(pd.telefono);

	const famNombre = cleanText(fam.nombre);
	const famParentezco = cleanText(fam.parentezco || fam.parentesco || "");
	const famTelefono = cleanText(fam.telefono);

	const esMasculino = pd.sexo === "M";
	const esFemenino = pd.sexo === "F";

	return {
		"apellido-paciente": apellido,
		apellido: apellido,
		"paciente-apellido": apellido,
		"nombre-paciente": nombre,
		nombre: nombre,
		"paciente-nombre": nombre,
		"nombres-paciente": nombreCompleto,
		nombres: nombreCompleto,
		"nombre-completo": nombreCompleto,
		"apellido-nombre": nombreCompleto,

		edad: edad,
		"edad-paciente": edad,
		"paciente-edad": edad,
		"edad-anios": edad,
		"edad-años": edad,

		"masculino-paciente": esMasculino,
		"femenino-paciente": esFemenino,
		masculino: esMasculino,
		femenino: esFemenino,
		sexo: cleanText(pd.sexo),
		"paciente-sexo": cleanText(pd.sexo),

		"dni-paciente": dniFormateado,
		dni: dniFormateado,
		documento: dniFormateado,
		"paciente-dni": dniFormateado,
		"afiliado-paciente": afiliadoFinal,
		afiliado: afiliadoFinal,
		"nro-afiliado": afiliadoFinal,

		dia: nac.dia,
		mes: nac.mes,
		año: nac.anio,
		anio: nac.anio,
		día: nac.dia,
		"dia-int": cxFecha.dia,
		"día-int": cxFecha.dia,
		"mes-int": cxFecha.mes,
		"año-int": cxFecha.anio,
		"anio-int": cxFecha.anio,

		"localidad-paciente": localidad,
		localidad: localidad,
		"paciente-localidad": localidad,
		"provincia-paciente": provincia,
		provincia: provincia,
		"paciente-provincia": provincia,
		"domicilio-paciente": domicilio,
		domicilio: domicilio,
		"domicilio-habitual": domicilio,
		"paciente-domicilio": domicilio,
		"telefono-paciente": telefono,
		telefono: telefono,
		"paciente-telefono": telefono,
		celular: telefono,

		"nacmiento-paciente": lugarNacimiento,
		"nacimiento-paciente": lugarNacimiento,
		"lugar-nacimiento": lugarNacimiento,
		nacimientoPaciente: lugarNacimiento,
		lugarNacimiento: lugarNacimiento,

		"hc-paciente": historiaClinicaFinal,
		hc: historiaClinicaFinal,
		"hc-n": historiaClinicaFinal,
		"hc-no": historiaClinicaFinal,
		"historia-clinica": historiaClinicaFinal,
		"nro-hc": historiaClinicaFinal,

		art: art,
		"a-r-t": art,
		art_os: art,
		os: art,
		"o-s": art,
		"o.s": art,
		"obra-social": art,
		"o-social": art,
		obrasocial: art,
		mutual: art,

		servicio: servicio,
		"tipo-ingreso": servicio,

		cx: cx,
		"cx-0": cx,
		diagnostico: cx,
		"diagnostico-ingreso": cx,
		"diagnostico-al-ingreso": cx,

		"nombre-dr": doctorPrint,
		"medico-solicitante": doctorPrint,
		medico: doctorPrint,
		doctor: doctorPrint,
		"medico-cabecera": doctorPrint,

		"familiar-nombre": famNombre,
		"nombre-familiar": famNombre,
		familiar: famNombre,
		"familiar-parentezco": famParentezco,
		"familiar-parentesco": famParentezco,
		"familiar-parenteszco": famParentezco,
		parentezco: famParentezco,
		parentesco: famParentezco,
		"parentezco-familiar": famParentezco,
		"familiar-telefono": famTelefono,
		"telefono-familiar": famTelefono,

		"habitacion-cama": habitacionCama,
		habitacion: habitacionCama,
		cama: habitacionCama,
	};
}

/* ============================================================
   FILL
============================================================ */

function fillFormFields(form, fields) {
	const missing = [];
	const filled = [];

	for (const [name, value] of Object.entries(fields || {})) {
		let ok = false;
		try {
			const tf = form.getTextField(name);
			tf.setText(value == null ? "" : String(value));
			ok = true;
			filled.push(name);
		} catch {}
		if (!ok) {
			try {
				const cb = form.getCheckBox(name);
				if (value === true) cb.check();
				else cb.uncheck();
				ok = true;
				filled.push(name);
			} catch {}
		}
		if (!ok) {
			try {
				const rg = form.getRadioGroup(name);
				if (value) rg.select(String(value));
				ok = true;
				filled.push(name);
			} catch {}
		}
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

	console.log("[CX-PDF] Campos rellenados:", filled.length);
	if (missing.length > 0)
		console.log("[CX-PDF] Campos no encontrados:", missing);
	return { filled, missing };
}

/* ============================================================
   POST
============================================================ */

export async function POST(req) {
	try {
		const { payload, type = "Frente", fileName } = await req.json();

		if (!payload) {
			return NextResponse.json(
				{ error: "Falta payload" },
				{ status: 400 },
			);
		}

		console.log(
			"[CX-PDF] Generando PDF unificado desde:",
			TEMPLATE_FILENAME,
		);

		const templatePath = getTemplatePath();
		const templateBytes = await fs.readFile(templatePath);
		const pdfDoc = await PDFDocument.load(templateBytes);
		const form = pdfDoc.getForm();

		const fields = buildCxFields(payload);
		fillFormFields(form, fields);

		// ⚠️ ORDEN ESTRICTO DE PÁGINAS PARA CIRUGÍA: 1-2-13-3-4-5-14-6-7-8
		const pageOrder = [1, 2, 13, 3, 4, 5, 14, 6, 7, 8];
		const indices = pageOrder.map((n) => n - 1);

		const totalPages = pdfDoc.getPageCount();
		const validIndices = indices.filter((idx) => idx < totalPages);

		if (validIndices.length < indices.length) {
			console.warn(
				`[CX-PDF] El template tiene ${totalPages} páginas. Se extraerán solo las disponibles.`,
			);
		}

		const finalPdfDoc = await PDFDocument.create();
		const copiedPages = await finalPdfDoc.copyPages(pdfDoc, validIndices);
		copiedPages.forEach((page) => finalPdfDoc.addPage(page));

		const finalForm = finalPdfDoc.getForm();
		try {
			finalForm.flatten();
		} catch (e) {
			console.warn(
				"[CX-PDF] Aviso: No se pudo aplanar el formulario al extraer páginas.",
			);
		}

		const outBytes = await finalPdfDoc.save();

		const safeName = String(fileName || `CX_${type}.pdf`).replace(
			/[^a-zA-Z0-9._-]/g,
			"_",
		);

		return new NextResponse(outBytes, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `inline; filename="${safeName}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (e) {
		console.error("[CX-PDF] ERROR:", e);
		return NextResponse.json(
			{
				error: "No se pudo generar el PDF",
				detail: e?.message || String(e),
			},
			{ status: 500 },
		);
	}
}

export async function GET(req) {
	try {
		const url = new URL(req.url);
		const debug = url.searchParams.get("debug") === "1";

		if (!debug) {
			return NextResponse.json({
				ok: true,
				template: TEMPLATE_FILENAME,
				usage: "POST { payload, type, fileName } — GET ?debug=1",
			});
		}

		const templatePath = getTemplatePath();
		const bytes = await fs.readFile(templatePath);
		const pdfDoc = await PDFDocument.load(bytes);
		const form = pdfDoc.getForm();

		return NextResponse.json({
			ok: true,
			template: TEMPLATE_FILENAME,
			totalPages: pdfDoc.getPageCount(),
			fieldsCount: form.getFields().length,
			fieldNames: form.getFields().map((f) => f.getName()),
		});
	} catch (e) {
		return NextResponse.json(
			{ ok: false, error: e?.message || String(e) },
			{ status: 500 },
		);
	}
}

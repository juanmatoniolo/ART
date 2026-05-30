import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import { PDFDocument, StandardFonts } from "pdf-lib";

export const runtime = "nodejs";

// Ruta al template (ubicado en public/templates/FOJAQX.pdf)
const TEMPLATE_PATH = path.join(process.cwd(), "public", "templates", "FOJAQX.pdf");

function cleanText(s) {
  const v = (s ?? "").toString().trim();
  if (!v || v === "-" || v.toLowerCase() === "n/a") return "";
  return v;
}

function pad2(value) {
  return String(value ?? "").padStart(2, "0");
}

function buildPdfFields(payload) {
  const paciente = payload.paciente || {};
  const equipo = payload.equipo || {};
  const fecha = payload.fecha || {};
  const horario = payload.horario || {};
  const descripcion = payload.descripcion || {};

  return {
    apelidoynombre: cleanText(paciente.apelidoynombre),
    edad: cleanText(paciente.edad),
    cirujano: cleanText(equipo.cirujano),
    primerayudante: cleanText(equipo.primerayudante),
    segundoayudante: cleanText(equipo.segundoayudante),
    anestesista: cleanText(equipo.anestesista),
    dia: pad2(fecha.dia),
    mes: cleanText(fecha.mes),
    anio: cleanText(fecha.anio),
    inichsinicio: cleanText(horario.inicio),
    hsfin: cleanText(horario.fin),
    preoperatorio: (descripcion.preoperatorio ?? "").toString(),
    posoperatorio: (descripcion.posoperatorio ?? "").toString(),
    procedimientoqx: (descripcion.procedimientoqx ?? "").toString(),
    hallazgos: (descripcion.hallazgos ?? "").toString(),
  };
}

async function fillFormFields(form, fields) {
  const missing = [];

  for (const [name, value] of Object.entries(fields)) {
    try {
      const field = form.getTextField(name);
      if (!field) throw new Error(`Field ${name} not found`);

      // Asignar texto
      field.setText(value || "");

      // Tamaño de fuente fijo: 11 puntos
      field.setFontSize(11);

      // Habilitar multilínea para campos largos
      const multilineFields = ["preoperatorio", "posoperatorio", "procedimientoqx", "hallazgos"];
      if (multilineFields.includes(name)) {
        field.enableMultiline();
      }
    } catch (err) {
      missing.push(name);
    }
  }

  if (missing.length) console.log("[FOJA-QX] Campos no encontrados:", missing);
}

// GET: diagnóstico (lista de campos del template)
export async function GET(req) {
  try {
    const templateBytes = await fs.readFile(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();
    const fieldNames = form.getFields().map(f => f.getName());
    return NextResponse.json({ ok: true, fieldsCount: fieldNames.length, fieldNames });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// POST: generar PDF relleno
export async function POST(req) {
  try {
    const { payload, fileName } = await req.json();
    if (!payload) return NextResponse.json({ error: "Missing payload" }, { status: 400 });

    const templateBytes = await fs.readFile(TEMPLATE_PATH);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const form = pdfDoc.getForm();

    const fields = buildPdfFields(payload);
    await fillFormFields(form, fields);

    // Congelar el formulario (los textos se vuelven estáticos)
    form.flatten();

    const pdfBytes = await pdfDoc.save();
    const safeName = (fileName || "FOJA_QX.pdf").replace(/[^a-zA-Z0-9._-]/g, "_");

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
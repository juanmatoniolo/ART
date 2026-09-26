// app/admin/rp/helpers.js

// =====================================================================
//  FECHAS / STRINGS / SANITIZACIÓN
// =====================================================================
export const fmtDate = (iso) => {
	if (!iso) return "—";
	const [y, m, d] = String(iso).split("-");
	return `${d}/${m}/${y}`;
};

export const fmtDateLong = (iso) => {
	if (!iso) return "—";
	try {
		return new Date(iso).toLocaleDateString("es-AR", {
			day: "2-digit",
			month: "long",
			year: "numeric",
		});
	} catch {
		return iso;
	}
};

export const chunk = (arr, size) => {
	const out = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
};

export const esc = (s) =>
	String(s ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");

export function sanitizeForFirebase(value) {
	if (Array.isArray(value)) return value.map(sanitizeForFirebase);
	if (value && typeof value === "object") {
		const out = {};
		for (const [k, v] of Object.entries(value)) {
			if (v === undefined) continue;
			out[k] = sanitizeForFirebase(v);
		}
		return out;
	}
	return value;
}

// =====================================================================
//  CONVENIOS
// =====================================================================
export function extraerValoresConvenio(c) {
	if (!c?.valores_generales) return { honorarios_medicos: [] };
	const out = { honorarios_medicos: c.honorarios_medicos || [] };
	for (const [k, v] of Object.entries(c.valores_generales)) {
		out[k] = typeof v === "number" ? v : parseNumberLocal(v);
	}
	return out;
}

function parseNumberLocal(val) {
	if (val == null || val === "") return 0;
	const s = String(val).trim().replace(/\s+/g, "");
	const cleaned = s
		.replace(/\./g, "")
		.replace(",", ".")
		.replace(/[^\d.-]/g, "");
	const n = Number(cleaned);
	return Number.isFinite(n) ? n : 0;
}

export const tipoCostoPorOrigen = (origen, hayAoter) => {
	if (origen === "aoter") return "Honorario Médico";
	if (origen === "bioquimica") return "Gasto Sanatorial";
	if (hayAoter) return "Gasto Sanatorial";
	return "";
};

// =====================================================================
//  SUB-CÓDIGOS
// =====================================================================
const SUBCodigos = {
	430201: "Incluye medicación + descartables", // Curación
	130110: "Incluye medicación + descartables", // Sutura de herida
};

export function getSubCodigoInfo(codigo) {
	if (!codigo) return null;
	const key = String(codigo).replace(/[.\s]/g, "");
	return SUBCodigos[key] || null;
}

// =====================================================================
//  FIRMAS DE MÉDICOS
//  Los archivos viven en /public/firmas/ y se sirven como /firmas/xxx.jpeg
//  El matching es por apellido (case-insensitive, sin tildes, sin espacios
//  extra). Para homónimos se exige además una parte del nombre.
// =====================================================================

// apellido (normalizado) → archivo
const FIRMAS_POR_APELLIDO = {
	"BRARDA":       "/firmas/DR-BRARDA.jpeg",
	"CANAGLIA":     "/firmas/DR-CANAGLIA.jpeg",
	"CIANCIOSI":    "/firmas/DR-CIANCIOSI.jpeg",
	"DEL PUERTO":   "/firmas/DR-DEL-PUERTO.jpeg",
	"FRESCO":       "/firmas/DR-FRESCO.jpeg",
	"GIMENEZ":      "/firmas/DR-GIMENEZ.jpeg",
	"LOVATTO":      "/firmas/DR-LOVATTO.jpeg",
	"PERTUS":       "/firmas/DR-PERTUS.jpeg",
	"SALOMON":      "/firmas/DR-SALOMON-ALEJANDRO.jpeg",
	"ESPINOLA":     "/firmas/DRA-ESPINOLA.jpeg",
	"GALLARDO":     "/firmas/DRA-GALLARDO.jpeg",
	"ZABALLA":      "/firmas/DRA-ZABALLA.jpeg",
};

// Casos con apellido repetido: se exige que el nombre contenga `nombreMatch`.
const FIRMAS_ESPECIALES = [
	{ apellido: "PERCARA", nombreMatch: "JOSE", url: "/firmas/DR-PERCARA-JOSE.jpeg" },
	// Si algún día agregás "Percara Gonzalo", va acá con su propio archivo.
];

const _norm = (s) =>
	String(s ?? "")
		.trim()
		.toUpperCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "") // quita tildes y convierte Ñ → N
		.replace(/\s+/g, " ");

/**
 * Devuelve la URL relativa (ej: "/firmas/DR-BRARDA.jpeg") o null.
 * @param {{apellido?:string, nombre?:string}} medico
 */
export function getFirmaForMedico(medico) {
    if (!medico?.apellido) return null;
    const ape = _norm(medico.apellido);
    const nom = _norm(medico.nombre);
    const url = FIRMAS_POR_APELLIDO[ape] || null;
    console.log('[firma]', { apellidoOriginal: medico.apellido, ape, nom, url });
    return url;
}
/**
 * Convierte la URL relativa en absoluta usando el origen del proyecto.
 * Necesario porque la ventana de impresión (window.open('', '_blank'))
 * no hereda el origen.
 */
function _toAbsolute(url, origin) {
	if (!url) return null;
	if (/^https?:\/\//i.test(url)) return url;
	if (!origin) return url;
	return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}

// =====================================================================
//  HTML DE IMPRESIÓN
// =====================================================================

function truncarNombreInsumo(nombre) {
	const limpio = String(nombre ?? "").replace(/_/g, " ");
	return limpio.length > 10 ? `${limpio.slice(0, 10)}...` : limpio;
}

function renderInsumosHtml(insumos) {
	if (!Array.isArray(insumos) || insumos.length === 0) return "";
	const parseCant = (v) => {
		const n = Number(String(v ?? "").replace(",", "."));
		return Number.isFinite(n) ? n : 0;
	};
	const items = insumos
		.map((i) => {
			const cant = parseCant(i.cantidad);
			const cantTxt = Number.isInteger(cant)
				? cant
				: cant.toLocaleString("es-AR", { maximumFractionDigits: 3 });
			return `<div class="insumo-line-item">${esc(truncarNombreInsumo(i.nombre))} × ${esc(cantTxt)}</div>`;
		})
		.join("");
	return `<div class="insumos-line">${items}</div>`;
}

function renderRpHtml(rp, logoSrc, origin) {
	const pac = rp.paciente || {};
	const med = rp.medico || {};
	const esLab = !!rp.esLab;

	const practicas = esLab ? [] : rp.practicas || [];
	const labs = esLab ? rp.estudiosLab || [] : [];

	const hayAoter = practicas.some((p) => p.origen === "aoter");

	const solicitaAuto = esLab
		? labs.map((l) => l.descripcion).join(" · ")
		: practicas.map((p) => p.descripcion).join(" · ");
	const solicitaTxt =
		rp.solicitaManual && rp.solicitaManual.trim()
			? rp.solicitaManual.trim()
			: solicitaAuto || "—";

	let mainBlockHtml = "";

	if (esLab) {
		mainBlockHtml = labs.length
			? `
            <div class="codes">
                <div class="codes-title">Estudios de laboratorio</div>
                ${labs
					.map(
						(l) => `
                    <div class="code-row">
                        <span class="code">${esc(l.codigo)}</span>
                        <span class="code-desc">${esc(l.descripcion)}</span>
                        <span class="code-type"></span>
                    </div>`,
					)
					.join("")}
            </div>`
			: `<div class="codes"><div class="code-row"><span class="code-desc italic">Sin estudios de laboratorio cargados</span></div></div>`;
	} else {
		mainBlockHtml = practicas.length
			? `
            <div class="codes">
                <div class="codes-title">Códigos</div>
                ${practicas
					.map((p) => {
						const tipo = tipoCostoPorOrigen(p.origen, hayAoter);
						const sub = getSubCodigoInfo(p.codigo);
						return `
                        <div class="code-row">
                            <span class="code">${esc(p.codigo)}</span>
                            <span class="code-desc">${esc(p.descripcion)}</span>
                            <span class="code-type">${esc(tipo)}</span>
                        </div>
                        ${sub ? `<div class="code-sub">↳ ${esc(sub)}</div>` : ""}
                        ${renderInsumosHtml(p.insumos)}`;
					})
					.join("")}
            </div>`
			: `<div class="codes"><div class="code-row"><span class="code-desc italic">Sin prácticas cargadas</span></div></div>`;
	}

	// -----------------------------------------------------------------
	//  Firma del médico
	// -----------------------------------------------------------------
	const firmaUrl = _toAbsolute(getFirmaForMedico(med), origin);

	const firmaHtml = `
		<div class="firma">
			${firmaUrl ? `<img class="firma-img" src="${esc(firmaUrl)}" alt="firma" />` : ""}
			<div class="firma-line"></div>
			<div class="firma-name">Dr/a. ${esc(med.apellido)}, ${esc(med.nombre)}</div>
			${med.matricula ? `<div class="firma-meta">MP ${esc(med.matricula)}</div>` : ""}
			${med.especialidad ? `<div class="firma-meta">${esc(med.especialidad)}</div>` : ""}
		</div>
	`;

	return `
        <div class="rp">
            <div class="head">
                <img class="logo" src="${logoSrc}" alt="logo" />
                <div class="clinic">
                    <div class="clinic-name">CLINICA DE LA UNION S.A</div>
                    <div class="clinic-addr">AV. SIBURU 1085 - CHAJARI, E.R (3228)</div>
                </div>
                <div class="tipo-badge">${esc(rp.tipoDoc || "RP")}</div>
            </div>
            <div class="sep"></div>
            <div class="row">
                <span class="lbl">Paciente:</span>
                <span class="val bold grow">${esc(pac.nombreCompleto)}</span>
            </div>
            <div class="row">
                <span class="lbl">DNI:</span>
                <span class="val grow">${esc(pac.dni)}</span>
                <span class="lbl">ART:</span>
                <span class="val grow">${esc(pac.artSeguro)}</span>
            </div>
            <div class="sep"></div>
            <div class="solicita">
                <span class="lbl">Solicita:</span>
                <span class="val italic grow">${esc(solicitaTxt)}</span>
            </div>
            ${mainBlockHtml}
            <div class="bottom">
                <div class="dg-row">
                    <span class="lbl">DG:</span>
                    <span class="val grow">${esc(rp.diagnostico)}</span>
                </div>
                <div class="fecha-row">
                    <span class="lbl">Fecha:</span>
                    <span class="val bold">${esc(fmtDate(rp.fecha))}</span>
                </div>
                ${firmaHtml}
            </div>
        </div>
    `;
}

/**
 * @param {Array} rps      RPs a imprimir
 * @param {string} logoSrc URL absoluta del logo (ej: "http://localhost:3000/logo.png")
 * @param {"print"|"download"|"manual"} mode
 */
export function buildPrintHtml(rps, logoSrc, mode = "print") {
	// Extraemos el origen desde logoSrc para resolver las firmas
	let origin = "";
	try {
		origin = new URL(logoSrc).origin;
	} catch {
		origin = "";
	}

	const sheets = chunk(rps, 4);
	const body = sheets
		.map(
			(sheet) => `
            <div class="sheet">
                ${sheet.map((rp) => renderRpHtml(rp, logoSrc, origin)).join("")}
            </div>`,
		)
		.join("");

	const toolbar =
		mode === "manual"
			? `
        <div class="toolbar no-print">
            <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir</button>
            <button class="btn" id="btnPdf" onclick="downloadPdf()">📥 Descargar PDF</button>
        </div>`
			: "";

	const autoAction =
		mode === "print"
			? `<script>window.addEventListener('load', function () {
                    setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 500);
                });<\/script>`
			: mode === "download"
				? `<script>window.addEventListener('load', function () {
                        setTimeout(function () { downloadPdf(); }, 500);
                    });<\/script>`
				: "";

	return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Recetas / RP</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
<style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }

    .toolbar {
        position: sticky; top: 0; z-index: 100;
        display: flex; align-items: center; gap: 12px;
        padding: 12px 20px;
        background: #1f2937; color: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        flex-wrap: wrap;
    }
    .toolbar .btn {
        cursor: pointer; border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08); color: #fff;
        padding: 10px 18px; border-radius: 8px;
        font-size: 15px; font-weight: 600; font-family: inherit;
    }
    .toolbar .btn:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
    .toolbar .btn-primary { background: linear-gradient(90deg, #44794d, #6fa17b); border-color: transparent; }

    .sheet {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        width: 210mm; height: 297mm;
        padding: 4mm; gap: 3mm;
        page-break-after: always;
        break-after: page;
        background: #fff;
    }
    .sheet:last-child { page-break-after: auto; break-after: auto; }

    .rp {
        width: 100%; height: 100%;
        padding: 4mm 4.5mm 3.5mm;
        border: 1px dashed #cbd5e1;
        display: flex; flex-direction: column;
        gap: 1.6mm;
        font-size: 9pt; line-height: 1.3;
        color: #000; overflow: hidden;
        page-break-inside: avoid; break-inside: avoid;
    }
    .head { display: flex; align-items: center; gap: 3mm; flex-shrink: 0; }
    .logo { width: 13mm; height: 13mm; object-fit: contain; flex-shrink: 0; }
    .clinic { flex: 1; min-width: 0; }
    .clinic-name { font-weight: 800; font-size: 10.5pt; letter-spacing: 0.3px; line-height: 1.05; }
    .clinic-addr { font-weight: 700; font-size: 8.5pt; line-height: 1.15; margin-top: 0.6mm; }
    .tipo-badge {
        font-size: 8pt; font-weight: 700;
        border: 1px solid #111; border-radius: 999px;
        padding: 0.6mm 2.5mm; letter-spacing: 0.5px; flex-shrink: 0;
    }
    .sep { border-top: 0.6pt solid #94a3b8; margin: 0.2mm 0; flex-shrink: 0; }
    .row { display: flex; align-items: baseline; gap: 1.6mm; flex-shrink: 0; }
    .lbl { font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    .val {
        border-bottom: 0.6pt solid #111;
        padding: 0 1mm 0.4mm;
        min-height: 4mm; min-width: 12mm;
    }
    .val.bold { font-weight: 700; }
    .val.grow { flex: 1; min-width: 0; }
    .val.italic { font-style: italic; }

    .solicita {
        display: flex; align-items: flex-start;
        gap: 1.6mm; font-size: 9.5pt; line-height: 1.4;
        flex-shrink: 0; min-height: 12mm;
        padding: 1mm 0 1.5mm;
    }
    .solicita .lbl { padding-top: 0.8mm; }
    .solicita .val {
        min-height: 8mm; padding: 1mm 1mm 0.5mm;
        display: flex; align-items: flex-start;
        border-bottom: 0.6pt solid #111;
    }

    .codes {
        flex: 0 1 auto;
        max-height: 78mm;
        border-top: 0.5pt dashed #cbd5e1;
        padding-top: 1.5mm;
        overflow: hidden;
    }
    .codes-title {
        font-weight: 800; font-size: 8pt;
        text-transform: uppercase; letter-spacing: 0.5px;
        color: #334155; margin-bottom: 1.2mm;
    }
    .code-row {
        display: grid; grid-template-columns: 22mm 1fr auto;
        gap: 2mm; align-items: baseline;
        font-size: 8.5pt; line-height: 1.4;
        padding: 0.4mm 0;
    }
    .code { font-family: 'Courier New', monospace; font-weight: 700; white-space: nowrap; }
    .code-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .code-type { font-size: 7.5pt; font-style: italic; color: #475569; white-space: nowrap; }
    .italic { font-style: italic; }

    .code-sub {
        font-size: 7.5pt;
        font-style: italic;
        color: #475569;
        padding-left: 24mm;
        margin-top: -0.4mm;
        margin-bottom: 0.6mm;
    }

    .insumos-line {
        padding-left: 24mm;
        margin-top: -0.2mm;
        margin-bottom: 1mm;
        font-size: 7.5pt;
        font-style: italic;
        color: #475569;
        line-height: 1.3;
        word-break: break-word;
    }

    .bottom {
        margin-top: auto;
        border-top: 0.6pt solid #94a3b8;
        padding-top: 2mm;
        display: flex;
        flex-direction: column;
        gap: 1.5mm;
        flex-shrink: 0;
    }
    .dg-row, .fecha-row { display: flex; align-items: baseline; gap: 1.6mm; font-size: 9pt; }

    /* -----------------------------------------------------------------
       Firma: imagen (si hay) arriba de la línea, todo centrado.
       ----------------------------------------------------------------- */
    .firma {
        margin-top: 6mm;
        padding-bottom: 1mm;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
        text-align: center;
    }
    .firma-img {
        display: block;
        max-height: 20mm;
        max-width: 55mm;
        object-fit: contain;
        margin-bottom: -2mm;
    }
    .firma-line {
        border-top: 0.7pt solid #111;
        width: 55mm;
        margin: 0 auto 1.2mm;
    }
    .firma-name { font-weight: 700; font-size: 8.5pt; line-height: 1.15; }
    .firma-meta { font-size: 7.5pt; color: #475569; line-height: 1.15; }

    @media screen {
        body { background: #e5e7eb; padding: 0; }
        #content { padding: 6mm 0; }
        .sheet { margin: 0 auto 6mm; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    }
    @media print {
        body { background: #fff; padding: 0; }
        #content { padding: 0; }
        .no-print { display: none !important; }
        .sheet { margin: 0; box-shadow: none; }
    }
</style>
</head>
<body>

${toolbar}
<div id="content">${body}</div>

<script>
async function downloadPdf() {
    const btn = document.getElementById('btnPdf');
    const sheets = document.querySelectorAll('.sheet');
    if (!sheets.length) return;
    const originalText = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Generando…'; }
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        for (let i = 0; i < sheets.length; i++) {
            const canvas = await html2canvas(sheets[i], {
                scale: 3, useCORS: true,
                backgroundColor: '#ffffff', logging: false,
                windowWidth: sheets[i].scrollWidth,
                windowHeight: sheets[i].scrollHeight,
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }
        const stamp = new Date().toISOString().slice(0, 10);
        pdf.save('recetas-rp-' + stamp + '.pdf');
    } catch (err) {
        console.error(err);
        alert('Error al generar PDF: ' + (err && err.message ? err.message : err));
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = originalText; }
    }
}
<\/script>
${autoAction}
</body>
</html>`;
}
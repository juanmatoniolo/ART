// app/admin/rp/statsPrint.js
// Genera el HTML imprimible de estadísticas. Solo se ocupa del layout.
import { esc } from "./helpers";

/**
 * @param {Object}   p
 * @param {string}   p.logoSrc
 * @param {string}   [p.titulo]
 * @param {{label:string,value:string}[]} p.filtros
 * @param {{label:string,value:string,sub?:string,accent?:string}[]} p.kpis
 * @param {{title:string, subtitle?:string, columns:{label:string,num?:boolean,wrap?:boolean}[], rows:string[][], footer?:string[], highlight?:boolean}[]} p.sections
 * @param {Object}   [p.resumen]
 * @param {string}   [p.observaciones]
 */
export function buildStatsPrintHtml({
	logoSrc,
	titulo = "Informe de estadísticas — Recetas / RP",
	filtros = [],
	kpis = [],
	sections = [],
	resumen = null,
	observaciones = "",
}) {
	const ahora = new Date().toLocaleString("es-AR");

	const filtrosHtml = filtros.length
		? filtros
				.map(
					(f) =>
						`<span class="chip"><b>${esc(f.label)}:</b> ${esc(f.value)}</span>`,
				)
				.join("")
		: `<span class="chip chip-all">Sin filtros — todos los datos</span>`;

	const kpisHtml = kpis.length
		? `<div class="kpis">${kpis
				.map(
					(k) => `
				<div class="kpi"${k.accent ? ` style="border-color:${k.accent};background:linear-gradient(180deg,#fff,${k.accent}10)"` : ""}>
					<div class="kpi-label">${esc(k.label)}</div>
					<div class="kpi-value"${k.accent ? ` style="color:${k.accent}"` : ""}>${esc(k.value)}</div>
					${k.sub ? `<div class="kpi-sub">${esc(k.sub)}</div>` : ""}
				</div>`,
				)
				.join("")}</div>`
		: "";

	const resumenHtml = resumen
		? `
		<div class="resumen">
			<div class="resumen-title">📌 Resumen ejecutivo</div>
			<div class="resumen-grid">
				<div><b>${esc(String(resumen.rps ?? 0))}</b><span>RPs</span></div>
				<div><b>${esc(String(resumen.pacientes ?? 0))}</b><span>Pacientes</span></div>
				<div><b>${esc(String(resumen.medicos ?? 0))}</b><span>Médicos</span></div>
				<div><b>${esc(String(resumen.practicas ?? 0))}</b><span>Prácticas</span></div>
				<div><b>${esc(resumen.promedio ?? "$ 0")}</b><span>Prom. / RP</span></div>
				<div><b>${esc(resumen.rango ?? "—")}</b><span>Período</span></div>
			</div>
		</div>`
		: "";

	const sectionHtml = (s) => {
		if (!s.rows.length) {
			return `<section class="sec"><h2>${esc(s.title)}</h2><p class="empty">Sin datos para los filtros elegidos.</p></section>`;
		}
		const head = s.columns
			.map((c) => `<th class="${c.num ? "num" : ""}">${esc(c.label)}</th>`)
			.join("");
		const body = s.rows
			.map(
				(r) =>
					`<tr>${r
						.map(
							(c, i) =>
								`<td class="${s.columns[i]?.num ? "num" : ""} ${s.columns[i]?.wrap ? "wrap" : ""}">${esc(c)}</td>`,
						)
						.join("")}</tr>`,
			)
			.join("");
		const foot = s.footer
			? `<tfoot><tr>${s.footer
					.map(
						(c, i) =>
							`<td class="${s.columns[i]?.num ? "num" : ""}">${esc(c)}</td>`,
					)
					.join("")}</tr></tfoot>`
			: "";
		return `
			<section class="sec ${s.highlight ? "sec-highlight" : ""}">
				<h2>${esc(s.title)}${s.subtitle ? `<span class="sec-sub"> — ${esc(s.subtitle)}</span>` : ""}</h2>
				<table>
					<thead><tr>${head}</tr></thead>
					<tbody>${body}</tbody>
					${foot}
				</table>
			</section>`;
	};

	const obsHtml = observaciones
		? `<div class="obs"><b>Observaciones:</b> ${esc(observaciones)}</div>`
		: "";

	return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>${esc(titulo)}</title>
<style>
	@page { size: A4 portrait; margin: 12mm 10mm 14mm; }
	* { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
	html, body { margin: 0; padding: 0; background: #fff; color: #111; font-family: Arial, Helvetica, sans-serif; font-size: 9pt; }

	.toolbar {
		position: sticky; top: 0; z-index: 10;
		display: flex; gap: 12px; align-items: center;
		padding: 10px 16px; background: #1f2937; color: #fff;
	}
	.toolbar button {
		cursor: pointer; border: 0; border-radius: 8px;
		padding: 9px 16px; font-size: 14px; font-weight: 600;
		background: linear-gradient(90deg, #44794d, #6fa17b); color: #fff;
	}
	.toolbar button.alt { background: rgba(255,255,255,0.12); }
	.toolbar span { font-size: 12px; opacity: .75; }

	.page { max-width: 190mm; margin: 0 auto; padding: 6mm 0; }

	.head { display: flex; align-items: center; gap: 4mm; border-bottom: 1.2pt solid #111; padding-bottom: 3mm; }
	.logo { width: 14mm; height: 14mm; object-fit: contain; }
	.head-txt { flex: 1; }
	.clinic { font-weight: 800; font-size: 11pt; letter-spacing: .3px; }
	.title { font-size: 10pt; font-weight: 700; color: #334155; margin-top: .8mm; }
	.gen { font-size: 8pt; color: #64748b; text-align: right; white-space: nowrap; }

	.filters { margin: 3mm 0 2mm; display: flex; flex-wrap: wrap; gap: 1.5mm; align-items: center; }
	.filters-title { font-weight: 800; font-size: 8pt; text-transform: uppercase; letter-spacing: .5px; color: #334155; margin-right: 1mm; }
	.chip { border: .6pt solid #94a3b8; border-radius: 999px; padding: .6mm 2.6mm; font-size: 8pt; background: #f8fafc; }
	.chip-all { color: #475569; font-style: italic; }

	.resumen { margin: 3mm 0 4mm; border: 1pt solid #0f172a; border-radius: 2mm; padding: 2.5mm 3mm; background: #f1f5f9; }
	.resumen-title { font-weight: 800; font-size: 8.5pt; letter-spacing: .4px; text-transform: uppercase; color: #0f172a; margin-bottom: 2mm; }
	.resumen-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 2mm; }
	.resumen-grid > div { text-align: center; padding: 1.5mm 1mm; background: #fff; border-radius: 1.5mm; border: .5pt solid #cbd5e1; }
	.resumen-grid b { display: block; font-size: 10.5pt; color: #0f172a; }
	.resumen-grid span { font-size: 7pt; text-transform: uppercase; letter-spacing: .3px; color: #475569; }

	.kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.5mm; margin: 3mm 0 4mm; }
	.kpi { border: .7pt solid #cbd5e1; border-radius: 2mm; padding: 2.2mm 3mm; background: #f8fafc; break-inside: avoid; }
	.kpi-label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .4px; color: #475569; font-weight: 700; }
	.kpi-value { font-size: 13pt; font-weight: 800; margin-top: .6mm; }
	.kpi-sub { font-size: 7.5pt; color: #64748b; margin-top: .4mm; }

	.sec { margin-top: 5mm; break-inside: auto; }
	.sec h2 { font-size: 10pt; margin: 0 0 1.6mm; padding-bottom: 1mm; border-bottom: .8pt solid #94a3b8; color: #0f172a; break-after: avoid; }
	.sec-sub { font-weight: 400; font-size: 8pt; color: #64748b; }
	.sec-highlight h2 { border-bottom-color: #0f172a; border-bottom-width: 1.2pt; }
	table { width: 100%; border-collapse: collapse; font-size: 8pt; }
	thead { display: table-header-group; }
	tr { break-inside: avoid; page-break-inside: avoid; }
	th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .3px; color: #334155; background: #e2e8f0; padding: 1.2mm 1.6mm; border-bottom: .8pt solid #94a3b8; }
	td { padding: 1.1mm 1.6mm; border-bottom: .4pt solid #e2e8f0; vertical-align: top; }
	td.wrap { white-space: normal; word-break: break-word; }
	tbody tr:nth-child(even) td { background: #f8fafc; }
	th.num, td.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
	tfoot td { font-weight: 800; border-top: .9pt solid #111; border-bottom: none; background: #f1f5f9; }
	.empty { color: #64748b; font-style: italic; margin: 1mm 0; }

	.obs { margin-top: 5mm; padding: 2mm 3mm; border-left: 2pt solid #0f172a; background: #f8fafc; font-size: 8.5pt; }

	.foot { margin-top: 6mm; font-size: 7.5pt; color: #64748b; border-top: .5pt solid #cbd5e1; padding-top: 1.5mm; display: flex; justify-content: space-between; }

	@media screen { body { background: #e5e7eb; } .page { background: #fff; padding: 10mm; margin: 8mm auto; box-shadow: 0 4px 16px rgba(0,0,0,.15); } }
	@media print { .toolbar { display: none !important; } .page { padding: 0; } }
</style>
</head>
<body>
	<div class="toolbar">
		<button onclick="window.print()">🖨️ Imprimir</button>
		<button class="alt" onclick="window.close()">✕ Cerrar</button>
		<span>Para guardar como PDF elegí “Guardar como PDF” en el diálogo de impresión.</span>
	</div>
	<div class="page">
		<div class="head">
			<img class="logo" src="${esc(logoSrc)}" alt="logo" />
			<div class="head-txt">
				<div class="clinic">CLINICA DE LA UNION S.A</div>
				<div class="title">${esc(titulo)}</div>
			</div>
			<div class="gen">Generado: ${esc(ahora)}</div>
		</div>

		<div class="filters">
			<span class="filters-title">Filtros aplicados</span>
			${filtrosHtml}
		</div>

		${resumenHtml}
		${kpisHtml}
		${sections.map(sectionHtml).join("")}
		${obsHtml}

		<div class="foot">
			<span>Informe de uso interno · Datos según las RPs guardadas en el historial.</span>
			<span>${esc(ahora)}</span>
		</div>
	</div>

	<script>
		(function () {
			function waitForImages() {
				var imgs = Array.prototype.slice.call(document.querySelectorAll('img'));
				return Promise.all(imgs.map(function (img) {
					if (img.complete) return Promise.resolve();
					return new Promise(function (res) {
						img.addEventListener('load', res);
						img.addEventListener('error', res);
					});
				}));
			}
			window.addEventListener('load', function () {
				waitForImages().then(function () {
					setTimeout(function () { try { window.focus(); window.print(); } catch (e) {} }, 300);
				});
			});
		})();
	<\/script>
</body>
</html>`;
}
/**
 * imprimirHistoria.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Genera e imprime la historia clínica completa de un paciente en una ventana
 * nueva con CSS propio, optimizada para hoja A4.
 *
 * Uso:
 *   import { imprimirHistoria } from "@/app/uti/imprimirHistoria";
 *   imprimirHistoria(registro);
 *
 * El objeto `registro` tiene la estructura de Firebase:
 * {
 *   paciente, dni, obraSocial, cama, medicoIngreso, fechaIngreso, motivoIngreso,
 *   diagnosticoActual, antecedentes, tratamientoActual,
 *   activo, fechaAlta, medicoAlta, motivoAlta, tipoAlta,
 *   evoluciones: [{ fechaDoc, medicoEvolucion, texto, fechaReal }],
 *   examenesList: [{ tipo, fechaExamen, medico, informe, linkEstudio, fechaCarga }],
 *   pendientesList: [{ descripcion, tipo, resuelto, fechaCreacion }],
 *   // Para reingresos, puede haber reingresoFecha, etc.
 * }
 */

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtFecha(str) {
  if (!str) return "—";
  // "2026-03-14" → "14/03/2026"
  const [y, m, d] = String(str).split("-");
  return d && m && y ? `${d}/${m}/${y}` : str;
}

function fmtTimestamp(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("es-AR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ts; }
}

function diasEntre(fechaStr, hastaStr) {
  if (!fechaStr) return 0;
  const desde = new Date(fechaStr + "T00:00:00");
  const hasta = hastaStr ? new Date(hastaStr) : new Date();
  hasta.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((hasta - desde) / 86400000));
}

function escapar(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br>");
}

// ── Íconos SVG compactos para imprimir ────────────────────────────────────────
const ICONO_EVOL    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8"/></svg>`;
const ICONO_EXAMEN  = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM12 18v-6M9 15h6"/></svg>`;
const ICONO_PEND    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;
const ICONO_ALTA    = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`;

const TIPOS_EXAMEN_ICONOS = {
  "Laboratorio": "🧪",
  "Rx":          "🫁",
  "Tomografía":  "🖥️",
  "Ecografía":   "📡",
  "ECG":         "💓",
  "RMN":         "🧲",
  "Endoscopía":  "🔬",
  "Otro":        "📋",
};

// ── CSS de impresión optimizado para A4 ───────────────────────────────────────
const CSS_PRINT = `
  @page {
    size: A4 portrait;
    margin: 12mm 14mm 12mm 14mm;
  }

  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif;
    font-size: 9.5pt;
    color: #1a1a1a;
    background: #fff;
    line-height: 1.45;
  }

  /* Encabezado del documento */
  .doc-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2.5pt solid #0f2a56;
    padding-bottom: 6pt;
    margin-bottom: 10pt;
  }

  .doc-header-left { flex: 1; }

  .doc-title {
    font-size: 13pt;
    font-weight: 700;
    color: #0f2a56;
    letter-spacing: -0.01em;
    line-height: 1.2;
  }

  .doc-subtitle {
    font-size: 8pt;
    color: #64748b;
    margin-top: 1pt;
  }

  .doc-header-right {
    text-align: right;
    font-size: 7.5pt;
    color: #64748b;
    line-height: 1.6;
  }

  .doc-header-right strong { color: #334155; }

  /* Tarjeta del paciente */
  .paciente-card {
    background: #f1f5f9;
    border: 1pt solid #cbd5e1;
    border-radius: 5pt;
    padding: 7pt 9pt;
    margin-bottom: 9pt;
    display: flex;
    flex-wrap: wrap;
    gap: 4pt 12pt;
  }

  .paciente-nombre {
    font-size: 12pt;
    font-weight: 700;
    color: #0f172a;
    width: 100%;
    margin-bottom: 3pt;
  }

  .paciente-campo {
    font-size: 8.5pt;
    color: #334155;
  }

  .paciente-campo label {
    color: #64748b;
    font-weight: 600;
    margin-right: 2pt;
    text-transform: uppercase;
    font-size: 7pt;
    letter-spacing: 0.04em;
  }

  /* Sección reutilizable */
  .seccion {
    margin-bottom: 8pt;
    page-break-inside: avoid;
  }

  .seccion-titulo {
    display: flex;
    align-items: center;
    gap: 4pt;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #334155;
    border-bottom: 1pt solid #e2e8f0;
    padding-bottom: 3pt;
    margin-bottom: 5pt;
  }

  .seccion-titulo svg { flex-shrink: 0; }

  .seccion-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4pt 10pt;
  }

  .seccion-campo { display: flex; flex-direction: column; gap: 1pt; }
  .seccion-campo.full { grid-column: 1 / -1; }

  .campo-label {
    font-size: 6.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #94a3b8;
  }

  .campo-valor {
    font-size: 9pt;
    color: #0f172a;
    white-space: pre-wrap;
    line-height: 1.5;
  }

  /* Divider entre datos y timeline */
  .divider {
    border: none;
    border-top: 1pt solid #e2e8f0;
    margin: 7pt 0;
  }

  /* ── Timeline cronológico ── */
  .timeline-header {
    display: flex;
    align-items: center;
    gap: 4pt;
    font-size: 7.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: #334155;
    border-bottom: 1pt solid #e2e8f0;
    padding-bottom: 3pt;
    margin-bottom: 6pt;
  }

  .timeline { display: flex; flex-direction: column; gap: 0; }

  .tl-item {
    display: flex;
    gap: 7pt;
    padding: 5pt 0;
    border-bottom: 0.5pt solid #f1f5f9;
    page-break-inside: avoid;
    break-inside: avoid;
  }

  .tl-item:last-child { border-bottom: none; }

  .tl-left {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 16pt;
    flex-shrink: 0;
    padding-top: 1pt;
  }

  .tl-dot {
    width: 7pt; height: 7pt; border-radius: 50%;
    flex-shrink: 0;
  }

  .tl-dot-evol   { background: #7c3aed; }
  .tl-dot-examen { background: #0d9488; }
  .tl-dot-alta   { background: #15803d; }
  .tl-dot-pend   { background: #d97706; }

  .tl-line {
    width: 1pt; flex: 1; background: #e2e8f0; margin-top: 2pt;
  }

  .tl-body { flex: 1; min-width: 0; }

  .tl-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 3pt;
    margin-bottom: 2pt;
  }

  .badge {
    font-size: 6.5pt; font-weight: 700; padding: 0.5pt 4pt;
    border-radius: 20pt; white-space: nowrap;
  }

  .badge-fecha  { background: #eff6ff; color: #1e4d8c; border: 0.5pt solid #bfdbfe; }
  .badge-medico { background: #f5f3ff; color: #6d28d9; border: 0.5pt solid #ede9fe; }
  .badge-carga  { background: #f8fafc; color: #64748b; border: 0.5pt solid #e2e8f0; }
  .badge-tipo   { background: #f0fdfa; color: #0f766e; border: 0.5pt solid #ccfbf1; }
  .badge-tipo-pend { background: #fffbeb; color: #b45309; border: 0.5pt solid #fef3c7; }
  .badge-alta   { background: #f0fdf4; color: #15803d; border: 0.5pt solid #bbf7d0; font-size: 7pt; font-weight: 700; }
  .badge-traslado { background: #fffbeb; color: #b45309; border: 0.5pt solid #fde68a; font-size: 7pt; font-weight: 700; }
  .badge-resuelto { background: #f0fdf4; color: #15803d; border: 0.5pt solid #bbf7d0; text-decoration: none; }
  .badge-pendiente{ background: #fef2f2; color: #b91c1c; border: 0.5pt solid #fecaca; }

  .tl-texto {
    font-size: 8.5pt;
    color: #1e293b;
    white-space: pre-wrap;
    line-height: 1.5;
    margin-top: 1pt;
  }

  .tl-link {
    font-size: 7.5pt; color: #0d9488; text-decoration: underline;
    margin-top: 2pt; display: block; word-break: break-all;
  }

  /* ── Bloque de reingreso ── */
  .reingreso-divider {
    page-break-before: auto;
    break-before: auto;
    border-top: 2pt dashed #cbd5e1;
    margin: 10pt 0 8pt;
    padding-top: 8pt;
    display: flex;
    align-items: center;
    gap: 6pt;
    color: #64748b;
    font-size: 8pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Alta / Traslado block ── */
  .alta-block {
    background: #f0fdf4;
    border: 1pt solid #86efac;
    border-radius: 4pt;
    padding: 5pt 7pt;
    margin-top: 4pt;
    page-break-inside: avoid;
  }

  .alta-block.traslado {
    background: #fffbeb;
    border-color: #fcd34d;
  }

  .alta-titulo {
    font-size: 7pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #15803d; margin-bottom: 2pt;
  }

  .alta-block.traslado .alta-titulo { color: #b45309; }

  .alta-detalle { font-size: 8.5pt; color: #1e293b; }

  /* ── Footer ── */
  .doc-footer {
    margin-top: 12pt;
    border-top: 1pt solid #e2e8f0;
    padding-top: 5pt;
    font-size: 7pt;
    color: #94a3b8;
    display: flex;
    justify-content: space-between;
  }

  /* ── Contador de pendientes al pie ── */
  .pendientes-resumen {
    background: #fffbeb;
    border: 1pt solid #fde68a;
    border-radius: 4pt;
    padding: 5pt 7pt;
    margin-bottom: 8pt;
    page-break-inside: avoid;
  }

  .pendientes-resumen-titulo {
    font-size: 7pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.06em; color: #b45309; margin-bottom: 3pt;
  }

  .pendiente-row {
    display: flex; align-items: flex-start; gap: 4pt;
    font-size: 8pt; color: #334155; padding: 1.5pt 0;
    border-bottom: 0.5pt solid #fef3c7;
  }

  .pendiente-row:last-child { border-bottom: none; }

  .pendiente-dot {
    width: 5pt; height: 5pt; border-radius: 50%;
    background: #d97706; flex-shrink: 0; margin-top: 2pt;
  }
`;

// ── Función principal ──────────────────────────────────────────────────────────
export function imprimirHistoria(registro) {
  if (!registro) return;

  const ahora = new Date().toLocaleString("es-AR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const evos   = Array.isArray(registro.evoluciones)    ? registro.evoluciones    : [];
  const exams  = Array.isArray(registro.examenesList)   ? registro.examenesList   : [];
  const pends  = Array.isArray(registro.pendientesList) ? registro.pendientesList : [];

  const pendActivos  = pends.filter(p => !p.resuelto);
  const pendResueltos = pends.filter(p => p.resuelto);

  const diasInternado = registro.activo
    ? diasEntre(registro.fechaIngreso)
    : diasEntre(registro.fechaIngreso, registro.fechaAlta);

  // ── Construir timeline cronológico (evols + exams mezclados por fecha) ────────
  const itemsTimeline = [];

  evos.forEach(e => {
    itemsTimeline.push({
      tipo: "evol",
      fecha: e.fechaDoc || "",
      fechaReal: e.fechaReal || "",
      medico: e.medicoEvolucion || "",
      texto: e.texto || "",
      _raw: e,
    });
  });

  exams.forEach(ex => {
    itemsTimeline.push({
      tipo: "examen",
      fecha: ex.fechaExamen || "",
      fechaReal: ex.fechaCarga || "",
      medico: ex.medico || "",
      texto: ex.informe || "",
      tipoExamen: ex.tipo || "Otro",
      link: ex.linkEstudio || "",
      _raw: ex,
    });
  });

  // Ordenar cronológicamente (fecha clínica asc → más antiguo primero)
  itemsTimeline.sort((a, b) => {
    const da = a.fecha || "0000-00-00";
    const db = b.fecha || "0000-00-00";
    if (da !== db) return da.localeCompare(db);
    // Mismo día: evoluciones antes que exámenes
    if (a.tipo !== b.tipo) return a.tipo === "evol" ? -1 : 1;
    return 0;
  });

  // ── Generar HTML de cada ítem del timeline ────────────────────────────────────
  const htmlTimeline = itemsTimeline.map((it, i) => {
    const isLast = i === itemsTimeline.length - 1;
    const dotClass = it.tipo === "evol" ? "tl-dot-evol" : "tl-dot-examen";
    const svgIcon  = it.tipo === "evol" ? ICONO_EVOL : ICONO_EXAMEN;

    let badgeTipo = "";
    if (it.tipo === "examen") {
      const emoji = TIPOS_EXAMEN_ICONOS[it.tipoExamen] || "📋";
      badgeTipo = `<span class="badge badge-tipo">${emoji} ${escapar(it.tipoExamen)}</span>`;
    }

    const linkHTML = it.link
      ? `<a class="tl-link" href="${escapar(it.link)}">${escapar(it.link)}</a>`
      : "";

    return `
      <div class="tl-item">
        <div class="tl-left">
          <div class="tl-dot ${dotClass}"></div>
          ${!isLast ? '<div class="tl-line"></div>' : ""}
        </div>
        <div class="tl-body">
          <div class="tl-meta">
            ${svgIcon}
            <span class="badge badge-fecha">${fmtFecha(it.fecha)}</span>
            ${badgeTipo}
            ${it.medico ? `<span class="badge badge-medico">Dr. ${escapar(it.medico)}</span>` : ""}
            ${it.fechaReal ? `<span class="badge badge-carga">Cargado: ${escapar(it.fechaReal)}</span>` : ""}
          </div>
          <div class="tl-texto">${escapar(it.texto)}</div>
          ${linkHTML}
        </div>
      </div>`;
  }).join("");

  // ── HTML del alta / traslado ──────────────────────────────────────────────────
  const htmlAlta = !registro.activo && registro.fechaAlta ? `
    <div class="tl-item">
      <div class="tl-left">
        <div class="tl-dot tl-dot-alta"></div>
      </div>
      <div class="tl-body">
        <div class="tl-meta">
          ${ICONO_ALTA}
          <span class="badge ${registro.tipoAlta === 'traslado' ? 'badge-traslado' : 'badge-alta'}">
            ${registro.tipoAlta === 'traslado' ? '🚑 TRASLADO' : '✅ ALTA MÉDICA'}
          </span>
          <span class="badge badge-fecha">${fmtTimestamp(registro.fechaAlta)}</span>
          ${registro.medicoAlta ? `<span class="badge badge-medico">Dr. ${escapar(registro.medicoAlta)}</span>` : ""}
        </div>
        <div class="tl-texto">${escapar(registro.motivoAlta)}</div>
      </div>
    </div>` : "";

  // ── HTML de pendientes al pie ─────────────────────────────────────────────────
  const htmlPendientes = pends.length > 0 ? `
    <div class="pendientes-resumen">
      <div class="pendientes-resumen-titulo">
        ${ICONO_PEND} Pendientes / Estudios — ${pendActivos.length} activo${pendActivos.length !== 1 ? "s" : ""}, ${pendResueltos.length} resuelto${pendResueltos.length !== 1 ? "s" : ""}
      </div>
      ${pends.map(p => `
        <div class="pendiente-row">
          <div class="pendiente-dot" style="${p.resuelto ? 'background:#15803d' : 'background:#d97706'}"></div>
          <div>
            <span class="badge ${p.resuelto ? 'badge-resuelto' : 'badge-pendiente'}">${escapar(p.tipo)}</span>
            ${p.resuelto ? '<span style="font-size:7pt;color:#15803d;margin-left:3pt">✓ resuelto</span>' : ""}
            &nbsp;${escapar(p.descripcion)}
            <span style="font-size:7pt;color:#94a3b8;margin-left:4pt">${fmtTimestamp(p.fechaCreacion)}</span>
          </div>
        </div>`).join("")}
    </div>` : "";

  // ── HTML del reingreso banner (si aplica) ─────────────────────────────────────
  const htmlReingreso = registro.reingresoFecha ? `
    <div class="reingreso-divider">
      🔄 Reingreso al servicio — ${fmtTimestamp(registro.reingresoFecha)}
    </div>` : "";

  // ── Documento completo ────────────────────────────────────────────────────────
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Historia Clínica — ${escapar(registro.paciente)}</title>
  <style>${CSS_PRINT}</style>
</head>
<body>

  <!-- ── Encabezado ── -->
  <div class="doc-header">
    <div class="doc-header-left">
      <div class="doc-title">🏥 Historia Clínica — UTI</div>
      <div class="doc-subtitle">Clínica de la Unión S.A. · Unidad de Terapia Intensiva</div>
    </div>
    <div class="doc-header-right">
      <strong>Impreso:</strong> ${ahora}<br>
      <strong>Cama:</strong> ${escapar(String(registro.cama))}<br>
      <strong>Estado:</strong> ${registro.activo ? "INTERNADO" : (registro.tipoAlta === "traslado" ? "TRASLADO" : "ALTA")}
    </div>
  </div>

  <!-- ── Tarjeta del paciente ── -->
  <div class="paciente-card">
    <div class="paciente-nombre">${escapar(registro.paciente)}${registro.dni ? ` <span style="font-weight:400;font-size:9pt;color:#64748b">· DNI ${escapar(registro.dni)}</span>` : ""}</div>

    <div class="paciente-campo"><label>Obra Social</label>${escapar(registro.obraSocial) || "—"}</div>
    <div class="paciente-campo"><label>Ingreso</label>${fmtFecha(registro.fechaIngreso)}</div>
    <div class="paciente-campo"><label>Médico</label>${registro.medicoIngreso ? `Dr. ${escapar(registro.medicoIngreso)}` : "—"}</div>
    <div class="paciente-campo"><label>Días internado</label>${diasInternado} día${diasInternado !== 1 ? "s" : ""}</div>
  </div>

  <!-- ── Datos clínicos ── -->
  <div class="seccion">
    <div class="seccion-grid">
      ${registro.motivoIngreso ? `
      <div class="seccion-campo full">
        <div class="campo-label">Motivo de ingreso</div>
        <div class="campo-valor">${escapar(registro.motivoIngreso)}</div>
      </div>` : ""}

      ${registro.diagnosticoActual ? `
      <div class="seccion-campo full">
        <div class="campo-label">Diagnóstico</div>
        <div class="campo-valor">${escapar(registro.diagnosticoActual)}</div>
      </div>` : ""}

      ${registro.antecedentes ? `
      <div class="seccion-campo full">
        <div class="campo-label">Antecedentes</div>
        <div class="campo-valor">${escapar(registro.antecedentes)}</div>
      </div>` : ""}

      ${registro.tratamientoActual ? `
      <div class="seccion-campo full">
        <div class="campo-label">Tratamiento actual</div>
        <div class="campo-valor">${escapar(registro.tratamientoActual)}</div>
      </div>` : ""}
    </div>
  </div>

  ${htmlReingreso}

  <!-- ── Pendientes activos al inicio del documento ── -->
  ${pendActivos.length > 0 ? htmlPendientes : ""}

  <hr class="divider">

  <!-- ── Timeline cronológico ── -->
  ${itemsTimeline.length > 0 || !registro.activo ? `
  <div class="timeline-header">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#334155" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
    Evolución cronológica
    <span style="font-size:7pt;font-weight:500;color:#94a3b8;margin-left:4pt;text-transform:none;letter-spacing:0">
      ${itemsTimeline.length} registro${itemsTimeline.length !== 1 ? "s" : ""} · más antiguo primero
    </span>
  </div>
  <div class="timeline">
    ${htmlTimeline || '<div style="font-size:8.5pt;color:#94a3b8;font-style:italic;padding:4pt 0">Sin evoluciones registradas.</div>'}
    ${htmlAlta}
  </div>` : ""}

  <!-- ── Pendientes resueltos al pie (si los hay) ── -->
  ${pendResueltos.length > 0 && pendActivos.length === 0 ? htmlPendientes : ""}

  <!-- ── Footer ── -->
  <div class="doc-footer">
    <span>Clínica de la Unión S.A. — UTI · ${ahora}</span>
    <span>Paciente: ${escapar(registro.paciente)} ${registro.dni ? `· DNI ${escapar(registro.dni)}` : ""} · Cama ${escapar(String(registro.cama))}</span>
  </div>

  <script>
    // Imprimir automáticamente al cargar
    window.addEventListener('load', function() {
      setTimeout(function() {
        window.print();
        // Cerrar la ventana después de imprimir (si el navegador lo permite)
        window.addEventListener('afterprint', function() { window.close(); });
      }, 350);
    });
  </script>
</body>
</html>`;

  // ── Abrir ventana de impresión ────────────────────────────────────────────────
  const ventana = window.open("", "_blank", "width=900,height=700,scrollbars=yes");
  if (!ventana) {
    alert("Por favor permitir ventanas emergentes para imprimir.");
    return;
  }
  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}
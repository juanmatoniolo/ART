function imprimirHistoria(registro) {
	if (!registro) return;

	const ahora = new Date().toLocaleString("es-AR", {
		day: "2-digit",
		month: "2-digit",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	const esc = (str) =>
		!str
			? ""
			: String(str)
					.replace(/&/g, "&amp;")
					.replace(/</g, "&lt;")
					.replace(/>/g, "&gt;")
					.replace(/"/g, "&quot;")
					.replace(/\n/g, "<br>");

	const fmtFecha = (str) => {
		if (!str) return "—";
		const [y, m, d] = String(str).split("-");
		return d && m && y ? `${d}/${m}/${y}` : str;
	};

	const fmtDateTime = (ts) => {
		if (!ts) return "—";
		try {
			return new Date(ts).toLocaleString("es-AR", {
				day: "2-digit",
				month: "2-digit",
				year: "numeric",
				hour: "2-digit",
				minute: "2-digit",
			});
		} catch {
			return ts;
		}
	};

	const diasEntre = (fechaStr, hastaStr) => {
		if (!fechaStr) return 0;
		const desde = new Date(fechaStr + "T00:00:00");
		const hasta = hastaStr ? new Date(hastaStr) : new Date();
		hasta.setHours(0, 0, 0, 0);
		return Math.max(0, Math.round((hasta - desde) / 86400000));
	};

	const iconosExamen = {
		Laboratorio: "🧪",
		Rx: "🫁",
		Tomografía: "🖥️",
		Ecografía: "📡",
		ECG: "💓",
		RMN: "🧲",
		Endoscopía: "🔬",
		Otro: "📋",
	};

	// --- Datos del ingreso actual ---
	const evos = Array.isArray(registro.evoluciones)
		? registro.evoluciones
		: [];
	const exams = Array.isArray(registro.examenesList)
		? registro.examenesList
		: [];
	const pends = Array.isArray(registro.pendientesList)
		? registro.pendientesList
		: [];
	const previos = Array.isArray(registro.ingresos) ? registro.ingresos : [];

	const pendActivos = pends.filter((p) => !p.resuelto);
	const pendResueltos = pends.filter((p) => p.resuelto);

	// --- Construir timeline unificado (solo ingreso actual) ---
	const timeline = [];
	evos.forEach((e) => {
		timeline.push({
			tipo: "evol",
			fecha: e.fechaDoc || "",
			medico: e.medicoEvolucion || "",
			texto: e.texto || "",
		});
	});
	exams.forEach((ex) => {
		timeline.push({
			tipo: "examen",
			fecha: ex.fechaExamen || "",
			medico: ex.medico || "",
			texto: ex.informe || "",
			tipoExamen: ex.tipo || "Otro",
			link: ex.linkEstudio || "",
		});
	});
	// Ordenar cronológicamente ascendente
	timeline.sort((a, b) =>
		(a.fecha || "0000-00-00").localeCompare(b.fecha || "0000-00-00"),
	);

	// Función para renderizar una línea del timeline (compacta)
	const renderTimelineItem = (it) => {
		if (it.tipo === "evol") {
			return `
        <div class="tl-item">
          <div class="tl-fecha">${fmtFecha(it.fecha)}</div>
          <div class="tl-tipo">📋 Evol</div>
          <div class="tl-medico">Dr. ${esc(it.medico)}</div>
          <div class="tl-texto">${esc(it.texto)}</div>
        </div>
      `;
		} else {
			const icono = iconosExamen[it.tipoExamen] || "📋";
			return `
        <div class="tl-item">
          <div class="tl-fecha">${fmtFecha(it.fecha)}</div>
          <div class="tl-tipo">${icono} ${esc(it.tipoExamen)}</div>
          <div class="tl-medico">${esc(it.medico)}</div>
          <div class="tl-texto">${esc(it.texto)}</div>
          ${it.link ? `<div class="tl-link">🔗 ${esc(it.link)}</div>` : ""}
        </div>
      `;
		}
	};

	// HTML del timeline
	const htmlTimeline = timeline.length
		? `<div class="timeline">${timeline.map(renderTimelineItem).join("")}</div>`
		: '<div class="sin-datos">Sin evoluciones o exámenes registrados.</div>';

	// --- HTML de pendientes compacto ---
	const pendHTML = (() => {
		if (pends.length === 0) return "";
		const activosHTML = pendActivos
			.map(
				(p) => `
      <div class="pend-item">
        <span class="pend-tipo">${esc(p.tipo)}</span>
        <span class="pend-desc">${esc(p.descripcion)}</span>
        <span class="pend-fecha">${fmtDateTime(p.fechaCreacion)}</span>
      </div>
    `,
			)
			.join("");
		const resueltosHTML = pendResueltos.length
			? `
      <div class="pend-separador">Resueltos</div>
      ${pendResueltos
			.map(
				(p) => `
        <div class="pend-item resuelto">
          <span class="pend-tipo">${esc(p.tipo)}</span>
          <span class="pend-desc">${esc(p.descripcion)}</span>
          <span class="pend-fecha">${fmtDateTime(p.fechaResolucion)}</span>
        </div>
      `,
			)
			.join("")}
    `
			: "";
		return `
      <div class="seccion">
        <div class="seccion-titulo">⏳ Pendientes</div>
        ${activosHTML}
        ${resueltosHTML}
      </div>
    `;
	})();

	// --- HTML de ingresos previos (solo resumen) ---
	const previosHTML = previos.length
		? `
    <div class="seccion">
      <div class="seccion-titulo">📁 Ingresos previos (${previos.length})</div>
      ${previos
			.map(
				(ing, idx) => `
        <div class="previo-item">
          <div class="previo-header">
            <span class="previo-fecha">${fmtFecha(ing.fechaIngreso)} → ${fmtDateTime(ing.fechaAlta)}</span>
            <span class="previo-cama">Cama ${ing.cama}</span>
          </div>
          <div class="previo-diagnostico">${ing.diagnosticoActual || "—"}</div>
          <div class="previo-meta">
            Evol: ${ing.evoluciones?.length || 0} · Exám: ${ing.examenesList?.length || 0} · Pend: ${ing.pendientesList?.length || 0}
          </div>
        </div>
      `,
			)
			.join("")}
    </div>
  `
		: "";

	// --- Datos del paciente ---
	const dias = diasEntre(
		registro.fechaIngreso,
		registro.activo ? null : registro.fechaAlta,
	);
	const estado = registro.activo
		? "INTERNADO"
		: registro.tipoAlta === "traslado"
			? "TRASLADO"
			: "ALTA";

	const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>HC — ${esc(registro.paciente)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 8mm 10mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Arial', 'Helvetica Neue', Helvetica, sans-serif;
      font-size: 9pt;
      line-height: 1.4;
      color: #111;
      background: #fff;
    }
    .header {
      display: flex;
      justify-content: space-between;
      border-bottom: 1.5pt solid #2c3e66;
      padding-bottom: 4pt;
      margin-bottom: 8pt;
    }
    .header-left {
      font-weight: bold;
    }
    .header-left .titulo {
      font-size: 12pt;
      color: #1a3a6b;
    }
    .header-left .subtitulo {
      font-size: 7pt;
      color: #6c757d;
    }
    .header-right {
      text-align: right;
      font-size: 7pt;
      color: #6c757d;
    }
    .paciente-card {
      background: #f8f9fa;
      border: 0.5pt solid #dee2e6;
      border-radius: 3pt;
      padding: 6pt 8pt;
      margin-bottom: 8pt;
    }
    .paciente-nombre {
      font-size: 11pt;
      font-weight: bold;
      margin-bottom: 3pt;
    }
    .paciente-datos {
      display: flex;
      flex-wrap: wrap;
      gap: 4pt 12pt;
      font-size: 8.5pt;
    }
    .seccion {
      margin-bottom: 8pt;
      break-inside: avoid;
    }
    .seccion-titulo {
      font-size: 8pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #2c3e66;
      border-bottom: 0.5pt solid #dee2e6;
      padding-bottom: 2pt;
      margin-bottom: 5pt;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4pt 8pt;
    }
    .campo {
      display: flex;
      flex-direction: column;
      gap: 1pt;
    }
    .campo-label {
      font-size: 6.5pt;
      font-weight: bold;
      color: #6c757d;
      text-transform: uppercase;
    }
    .campo-valor {
      font-size: 9pt;
    }
    /* Timeline compacto */
    .timeline {
      margin-top: 4pt;
    }
    .tl-item {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 4pt 8pt;
      padding: 3pt 0;
      border-bottom: 0.25pt solid #e9ecef;
    }
    .tl-fecha {
      font-weight: bold;
      color: #0d6efd;
      min-width: 55pt;
    }
    .tl-tipo {
      font-size: 7.5pt;
      background: #e9ecef;
      padding: 1pt 4pt;
      border-radius: 10pt;
      white-space: nowrap;
    }
    .tl-medico {
      font-size: 7.5pt;
      color: #6f42c1;
      white-space: nowrap;
    }
    .tl-texto {
      flex: 1;
      font-size: 8.5pt;
      line-height: 1.4;
    }
    .tl-link {
      width: 100%;
      font-size: 7pt;
      color: #0d9488;
      margin-top: 2pt;
      word-break: break-all;
    }
    /* Pendientes */
    .pend-item {
      display: flex;
      flex-wrap: wrap;
      gap: 4pt 8pt;
      padding: 3pt 0;
      border-bottom: 0.25pt solid #e9ecef;
      align-items: baseline;
    }
    .pend-tipo {
      font-size: 7pt;
      background: #ffe8cc;
      padding: 1pt 4pt;
      border-radius: 10pt;
      font-weight: bold;
      white-space: nowrap;
    }
    .pend-desc {
      flex: 1;
      font-size: 8.5pt;
    }
    .pend-fecha {
      font-size: 7pt;
      color: #6c757d;
      white-space: nowrap;
    }
    .pend-separador {
      font-size: 7pt;
      font-weight: bold;
      margin: 5pt 0 2pt;
      color: #6c757d;
    }
    .resuelto {
      opacity: 0.6;
    }
    /* Ingresos previos */
    .previo-item {
      background: #f8f9fa;
      border: 0.5pt solid #dee2e6;
      border-radius: 3pt;
      padding: 5pt 6pt;
      margin-bottom: 5pt;
    }
    .previo-header {
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      font-weight: bold;
      margin-bottom: 2pt;
    }
    .previo-diagnostico {
      font-size: 8pt;
      margin: 2pt 0;
    }
    .previo-meta {
      font-size: 7pt;
      color: #6c757d;
    }
    .sin-datos {
      font-size: 8pt;
      color: #adb5bd;
      font-style: italic;
      padding: 4pt 0;
    }
    .footer {
      margin-top: 12pt;
      border-top: 0.5pt solid #dee2e6;
      padding-top: 4pt;
      font-size: 6.5pt;
      color: #6c757d;
      display: flex;
      justify-content: space-between;
    }
    /* No romper página dentro de secciones importantes */
    .seccion, .paciente-card, .previo-item, .tl-item, .pend-item {
      break-inside: avoid;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="titulo">🏥 Historia Clínica — UTI</div>
      <div class="subtitulo">Clínica de la Unión S.A. · Unidad de Terapia Intensiva</div>
    </div>
    <div class="header-right">
      <strong>Impreso:</strong> ${ahora}<br>
      <strong>Cama:</strong> ${esc(String(registro.cama))}<br>
      <strong>Estado:</strong> ${estado}
    </div>
  </div>

  <div class="paciente-card">
    <div class="paciente-nombre">${esc(registro.paciente)}${registro.dni ? ` · DNI ${esc(registro.dni)}` : ""}</div>
    <div class="paciente-datos">
      <span><strong>Obra Social:</strong> ${esc(registro.obraSocial) || "—"}</span>
      <span><strong>Ingreso:</strong> ${fmtFecha(registro.fechaIngreso)} (${dias} días)</span>
      <span><strong>Médico:</strong> ${registro.medicoIngreso ? `Dr. ${esc(registro.medicoIngreso)}` : "—"}</span>
    </div>
  </div>

  <div class="grid">
    ${
		registro.motivoIngreso
			? `
      <div class="campo full">
        <div class="campo-label">Motivo de ingreso</div>
        <div class="campo-valor">${esc(registro.motivoIngreso)}</div>
      </div>
    `
			: ""
	}
    ${
		registro.diagnosticoActual
			? `
      <div class="campo full">
        <div class="campo-label">Diagnóstico actual</div>
        <div class="campo-valor">${esc(registro.diagnosticoActual)}</div>
      </div>
    `
			: ""
	}
    ${
		registro.antecedentes
			? `
      <div class="campo full">
        <div class="campo-label">Antecedentes</div>
        <div class="campo-valor">${esc(registro.antecedentes)}</div>
      </div>
    `
			: ""
	}
    ${
		registro.tratamientoActual
			? `
      <div class="campo full">
        <div class="campo-label">Tratamiento actual</div>
        <div class="campo-valor">${esc(registro.tratamientoActual)}</div>
      </div>
    `
			: ""
	}
  </div>

  ${previosHTML}

  <div class="seccion">
    <div class="seccion-titulo">📅 Evolución y exámenes (ingreso actual)</div>
    ${htmlTimeline}
  </div>

  ${pendHTML}

  ${
		!registro.activo && registro.fechaAlta
			? `
    <div class="seccion">
      <div class="seccion-titulo">${registro.tipoAlta === "traslado" ? "🚑 Traslado" : "✅ Alta"}</div>
      <div><strong>Fecha:</strong> ${fmtDateTime(registro.fechaAlta)}</div>
      <div><strong>Médico:</strong> ${registro.medicoAlta ? `Dr. ${esc(registro.medicoAlta)}` : "—"}</div>
      <div><strong>Motivo:</strong> ${esc(registro.motivoAlta)}</div>
    </div>
  `
			: ""
  }

  <div class="footer">
    <span>Clínica de la Unión S.A. — UTI</span>
    <span>${esc(registro.paciente)} ${registro.dni ? `· DNI ${esc(registro.dni)}` : ""} · ${ahora}</span>
  </div>

  <script>
    window.onload = () => {
      setTimeout(() => {
        window.print();
        window.addEventListener("afterprint", () => window.close());
      }, 400);
    };
  </script>
</body>
</html>`;

	const w = window.open("", "_blank", "width=860,height=720,scrollbars=yes");
	if (!w) {
		alert("Activar ventanas emergentes para imprimir.");
		return;
	}
	w.document.open();
	w.document.write(html);
	w.document.close();
}

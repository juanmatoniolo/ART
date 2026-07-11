const FIRMA = `Saludos,
Juanma - Área de ART
Clínica de la Unión S.A.
Chajarí, Entre Ríos
WhatsApp: 3456441580`;

export const getPacienteNombre = (p) =>
  `${p?.trabajador?.apellido || ""} ${p?.trabajador?.nombre || ""}`.trim();

export const normalize = (value) =>
  String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const buildGmailUrl = ({ to, subject, body }) => {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
};

export const getAccionesTexto = (ids, accionesDisponibles) => {
  const map = Object.fromEntries(accionesDisponibles.map(a => [a.id, a]));
  const tieneFkt = ids.includes("fkt");
  const tieneMgt = ids.includes("mgt");

  const labels = ids.reduce((acc, id) => {
    if (id === "fkt" || id === "mgt") return acc;
    acc.push(map[id]?.short || id.toUpperCase());
    return acc;
  }, []);

  if (tieneFkt && tieneMgt) {
    labels.push("FKT + MGT");
  } else {
    if (tieneFkt) labels.push("FKT");
    if (tieneMgt) labels.push("MGT");
  }
  return labels.join(" Y ");
};

export const buildSolicitudes = (ids, medico, accionesDisponibles) => {
  const map = Object.fromEntries(accionesDisponibles.map(a => [a.id, a]));
  const medicoTexto = medico?.trim() || "______";

  const solicitudes = ids.map(id => {
    const accion = map[id];
    if (!accion) return "";
    return accion.codigo.replace(/\{medico\}/g, medicoTexto);
  }).filter(Boolean);

  if (ids.includes("fkt") && ids.includes("mgt")) {
    const lineasFiltradas = solicitudes.filter(linea =>
      linea !== map["fkt"]?.codigo.replace("{medico}", medicoTexto) &&
      linea !== map["mgt"]?.codigo.replace("{medico}", medicoTexto)
    );
    return [...lineasFiltradas, "SE SOLICITAN FKT + MGT POR 10 SESIONES"];
  }
  return solicitudes;
};

export const generarAsunto = (paciente, tab, accionesSeleccionadas, medico, atajoActivo, accionesDisponibles) => {
  if (!paciente) return "";
  const nombre = getPacienteNombre(paciente) || "";
  const dni = paciente?.trabajador?.dni || "";
  
  if (atajoActivo?.asunto) {
    return atajoActivo.asunto
      .replace(/\{nombre\}/g, nombre)
      .replace(/\{dni\}/g, dni || "—")
      .replace(/\{stro\}/g, paciente?.ART?.nroSiniestro || "—")
      .replace(/\{art\}/g, paciente?.ART?.nombre || "—")
      .replace(/\{medico\}/g, medico.trim() || "______");
  }
  if (tab === "facturacion") {
    return `FACTURACION PTE ${nombre} - DNI ${dni || "—"}`;
  }
  const accionesTexto = getAccionesTexto(accionesSeleccionadas, accionesDisponibles);
  return `SE ENVIA ${accionesTexto} PTE ${nombre} DNI ${dni || "—"}`;
};

export const generarCuerpo = (paciente, tab, accionesSeleccionadas, medico, atajoActivo, accionesDisponibles) => {
  if (!paciente) return "";
  const nombre = getPacienteNombre(paciente) || "";
  const dni = paciente?.trabajador?.dni || "";
  const stro = paciente?.ART?.nroSiniestro || "";
  const artPaciente = paciente?.ART?.nombre || "";
  const medicoTexto = medico.trim() || "______";

  if (atajoActivo?.cuerpo) {
    return atajoActivo.cuerpo
      .replace(/\{nombre\}/g, nombre)
      .replace(/\{dni\}/g, dni || "—")
      .replace(/\{stro\}/g, stro || "—")
      .replace(/\{art\}/g, artPaciente || "—")
      .replace(/\{medico\}/g, medicoTexto)
      .replace(/\{firma\}/g, FIRMA);
  }

  let base = "";
  if (tab === "facturacion") {
    base = `Buen día.\n\nPor medio del presente, se adjunta facturación correspondiente al paciente:\n\nNombre completo: ${nombre}\nDNI: ${dni || "—"}\nN° de siniestro: ${stro || "—"}\nART: ${artPaciente || "—"}\nMédico: Dr/a. ${medicoTexto}\n\n${FIRMA}`;
  } else {
    const accionesTexto = getAccionesTexto(accionesSeleccionadas, accionesDisponibles);
    base = `Buen día.\n\nPor medio del presente, se remite la documentación médica correspondiente al paciente en referencia.\n\nAdjunto: ${accionesTexto}\n\nSolicito autorización a la brevedad de lo/s siguiente/es código/s:\n${buildSolicitudes(accionesSeleccionadas, medicoTexto, accionesDisponibles).join("\n")}\n\n${FIRMA}`;
  }

  // ** LÍNEA OBLIGATORIA DE EVOLUCIÓN **
  if (accionesSeleccionadas.includes("evolucion")) {
    const codEvolucion = `/COD.: 42.01.01 CONSULTA MEDICA DR ${medicoTexto}`;
    if (!base.includes(codEvolucion)) {
      // Insertar después de "Solicito autorización..." o al final
      const fraseAutorizacion = "Solicito autorización a la brevedad de lo/s siguiente/es código/s:";
      if (base.includes(fraseAutorizacion)) {
        base = base.replace(fraseAutorizacion, `${fraseAutorizacion}\n${codEvolucion}`);
      } else {
        base += `\n\nSolicito autorización para:\n${codEvolucion}`;
      }
    }
  }
  return base;
};
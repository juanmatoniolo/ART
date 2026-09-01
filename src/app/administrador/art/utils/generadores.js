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

export const generarAsunto = (paciente, tab, atajosActivos) => {
  if (tab === "facturacion") {
    return "CLINICA DE LA UNION S.A CUIT 30707545301";
  }
  if (tab === "convenios") {
    return "Nuevo convenio - Clínica de la Unión S.A.";
  }
  // siniestros
  if (!paciente) return "";
  const nombre = getPacienteNombre(paciente) || "";
  const dni = paciente?.trabajador?.dni || "";
  const stro = paciente?.ART?.nroSiniestro || "—";

  const partes = (atajosActivos || []).map(a => a.label.toUpperCase()).filter(Boolean);
  const textoCombinado = partes.length ? partes.join(" + ") : "DOCUMENTACIÓN";

  return `SE ENVIA ${textoCombinado} PTE ${nombre} DNI ${dni || "—"} STRO ${stro}`;
};

export const generarCuerpo = (paciente, tab, atajosActivos, medico) => {
  if (tab === "facturacion") {
    return `Buen día.\n\nAdjunto factura y detalle de la misma para su auditoría y posterior pago.\n\nSaludos,\nJuanma – Área ART  \nClínica de la Unión S.A.  \nChajarí, Entre Ríos`;
  }
  if (tab === "convenios") {
    return `Buen día.\n\nTenemos el agrado de informar que se ha formalizado un nuevo convenio con Clínica de la Unión S.A. para la atención de sus afiliados.\n\nAdjuntamos la documentación correspondiente para su conocimiento y registro.\n\nQuedamos a su disposición para cualquier consulta.\n\nSaludos,\nJuanma - Área de ART\nClínica de la Unión S.A.\nChajarí, Entre Ríos\nWhatsApp: 3456441580`;
  }
  // siniestros
  if (!paciente) return "";
  const nombre = getPacienteNombre(paciente) || "";
  const dni = paciente?.trabajador?.dni || "";
  const stro = paciente?.ART?.nroSiniestro || "";
  const artPaciente = paciente?.ART?.nombre || "";
  const medicoTexto = medico?.trim() || "______";

  const adjuntos = (atajosActivos || []).map(a => a.adjunto).filter(Boolean);
  const adjuntoTexto = adjuntos.length ? adjuntos.join(" + ") : "—";

  const solicitudes = (atajosActivos || []).map(a => a.solicitud.replace(/\{medico\}/g, medicoTexto)).filter(Boolean);
  const solicitudesTexto = solicitudes.length ? solicitudes.join("\n") : "—";

  let base = `Buen día.\n\nPor medio del presente, se remite la documentación médica correspondiente al paciente en referencia.\n\nAdjunto: ${adjuntoTexto}\n\nSolicito autorización a la brevedad de lo/s siguiente/es código/s:\n${solicitudesTexto}\n\nSaludos,\nJuanma - Área de ART\nClínica de la Unión S.A.\nChajarí, Entre Ríos\nWhatsApp: 3456441580`;

  if (!solicitudes.length) {
    base = base.replace("Solicito autorización a la brevedad de lo/s siguiente/es código/s:\n—", "Solicito autorización a la brevedad.");
  }

  return base;
};
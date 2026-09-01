// ─── Helpers ────────────────────────────────────────────────
export const cleanValue = (value) => {
  if (value == null) return "";
  return String(value).trim();
};

export const splitProfessionalName = (value, fallbackTitle = "Dr.") => {
  const fullName = cleanValue(value);
  const match = fullName.match(/^(Dr\.?|Dra\.?)\s*(.*)$/i);

  if (!match) {
    return {
      titulo: fallbackTitle,
      nombre: fullName,
      completo: fullName ? `${fallbackTitle} ${fullName}`.trim() : "",
    };
  }

  const titulo = match[1].toLowerCase().startsWith("dra") ? "Dra." : "Dr.";
  const nombre = cleanValue(match[2]);

  return {
    titulo,
    nombre,
    completo: nombre ? `${titulo} ${nombre}` : titulo,
  };
};

export const joinProfessionalName = (titulo, nombre) => {
  const cleanName = cleanValue(nombre).replace(/^(Dr\.?|Dra\.?)\s*/i, "");
  return cleanName ? `${titulo || "Dr."} ${cleanName}`.trim() : "";
};

const parseCx = (cx) => {
  // (copia exacta de la función parseCx del código de médicos)
  // ...
};

export const normalizeRegistro = (raw = {}, id = raw.id, dbPath = raw._dbPath || `fojaqx/${id}`) => {
  // (copia exacta)
};

export const normalizeTemplate = (raw = {}, id = raw.id, dbPath = raw._dbPath || `fojaqx/plantillas/${id}`) => {
  // (copia exacta)
};

export const formatDate = (dia, mes, anio) =>
  dia && mes && anio ? `${dia} ${mes} ${anio}` : "Sin fecha";

export const formatTime = (inicio, fin) => {
  if (!inicio && !fin) return null;
  return [inicio, fin].filter(Boolean).join(" – ");
};

export const buildCx = (reg) => {
  const normalized = normalizeRegistro(reg);
  return [
    `1. Diagnóstico Preoperatorio: ${normalized.preoperatorio}`,
    `2. Diagnóstico Posoperatorio: ${normalized.posoperatorio}`,
    `3. Procedimiento Quirúrgico: ${normalized.procedimientoqx}`,
    `4. Operación y Hallazgos: ${normalized.hallazgos}`,
  ].join("\n\n");
};

export const buildPdfPayload = (reg) => {
  const normalized = normalizeRegistro(reg);

  return {
    paciente: {
      apelidoynombre: normalized.apelidoynombre,
      edad: normalized.edad,
    },
    equipo: {
      cirujano: normalized.cirujano,
      primerayudante: normalized.primerayudante,
      segundoayudante: normalized.segundoayudante,
      anestesista: normalized.anestesista,
    },
    fecha: {
      dia: normalized.dia,
      mes: normalized.mes,
      anio: normalized.anio,
    },
    horario: {
      inicio: normalized.inichsinicio,
      fin: normalized.hsfin,
    },
    descripcion: {
      preoperatorio: normalized.preoperatorio,
      posoperatorio: normalized.posoperatorio,
      procedimientoqx: normalized.procedimientoqx,
      hallazgos: normalized.hallazgos,
    },
    cx: buildCx(normalized),
  };
};

export const buildFileName = (reg) => {
  const normalized = normalizeRegistro(reg);
  const apellido = normalized.apelidoynombre
    ? normalized.apelidoynombre.split(",")[0].trim().replace(/\s+/g, "_")
    : "foja";

  const fecha = [normalized.dia, normalized.mes, normalized.anio]
    .filter(Boolean)
    .join("-");

  return `FojaQX_${apellido}${fecha ? `_${fecha}` : ""}.pdf`;
};
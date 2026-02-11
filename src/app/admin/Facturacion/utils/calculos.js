// utils/calculos.js

/**
 * Convierte un valor a número de forma robusta
 */
export const parseNumber = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  let s = String(val).trim().replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) s = s.replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Formatea un número como moneda argentina
 */
export const money = (n) => {
  if (n == null || n === '' || n === '-') return '—';
  const num = typeof n === 'number' ? n : parseNumber(n);
  return Number.isFinite(num)
    ? num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '—';
};

/**
 * Normaliza texto para búsqueda (sin tildes, minúsculas)
 */
export const normalize = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * Determina si una práctica es radiografía (RX)
 */
export const isRadiografia = (item) => {
  const d = normalize(item?.descripcion || '');
  return d.includes('radiograf') || d.includes('rx');
};

/**
 * Determina si una práctica es "por exposición subsiguiente"
 */
export const isSubsiguiente = (item) => {
  const d = normalize(item?.descripcion || '');
  return d.includes('por exposicion subsiguiente') || d.includes('por exposición subsiguiente');
};

/**
 * Vincula prácticas subsiguientes con su principal
 * @param {Object} item - Práctica a evaluar
 * @param {Array} data - Lista completa de prácticas
 * @returns {Array} - Array con la práctica y su subsiguiente (si corresponde)
 */
export const vincularSubsiguientes = (item, data) => {
  const idx = data.findIndex((d) =>
    item.__key ? d.__key === item.__key : d.codigo === item.codigo
  );
  if (idx === -1) return [item];
  const prev = data[idx - 1];
  const next = data[idx + 1];
  if (isSubsiguiente(item) && prev) return [prev, item];
  if (next && isSubsiguiente(next)) return [item, next];
  return [item];
};

/**
 * Escapa caracteres especiales para expresiones regulares
 */
export const escapeRegExp = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Resalta el término de búsqueda en el texto (devuelve JSX)
 */
export const highlight = (text, q) => {
  if (!text || !q) return text;
  const regex = new RegExp(`(${escapeRegExp(q)})`, 'gi');
  return String(text).split(regex).map((part, i) =>
    part.toLowerCase() === String(q).toLowerCase() ? (
      <mark key={i} className="highlight">{part}</mark>
    ) : part
  );
};

/**
 * Calcula honorarios, gastos y total de una práctica según el convenio
 */
export const calcularPractica = (practica, valoresConvenio) => {
  const {
    galenoRx = 0,
    gastoRx = 0,
    galenoQuir = 0,
    gastoOperatorio = 0,
    otrosGastos = 0
  } = valoresConvenio || {};

  const qgal = parseNumber(practica.qgal || practica.q_gal || 0);
  const gto = parseNumber(practica.gto || 0);

  // Radiología (capítulo 34)
  if (isRadiografia(practica)) {
    const gastoOp = (gastoRx * gto) / 2;
    const honorario = galenoRx * qgal + gastoOp;
    return {
      honorarioMedico: honorario,
      gastoSanatorial: gastoOp,
      total: honorario + gastoOp,
      formula: `RX: (${galenoRx} × ${qgal}) + ((${gastoRx} × ${gto}) / 2)`
    };
  }

  // Cirugías (capítulos 12 o 13)
  const capituloNum = Number(String(practica.capitulo || '').replace(/\D/g, '')) || 0;
  if (capituloNum === 12 || capituloNum === 13) {
    const honorario = galenoQuir * qgal;
    const gasto = gastoOperatorio * gto;
    return {
      honorarioMedico: honorario,
      gastoSanatorial: gasto,
      total: honorario + gasto,
      formula: `Cirugía: (${galenoQuir} × ${qgal}) + (${gastoOperatorio} × ${gto})`
    };
  }

  // Otras prácticas
  const honorario = qgal * otrosGastos;
  const gasto = gto * otrosGastos;
  return {
    honorarioMedico: honorario,
    gastoSanatorial: gasto,
    total: honorario + gasto,
    formula: `Directo: (${qgal} × ${otrosGastos}) + (${gto} × ${otrosGastos})`
  };
};

/**
 * Calcula el total de un laboratorio según la unidad bioquímica y el valor UB del convenio
 */
export const calcularLaboratorio = (laboratorio, valoresConvenio) => {
  const { valorUB = 0 } = valoresConvenio || {};
  const ub = parseNumber(laboratorio.unidadBioquimica || 0);
  const total = ub * valorUB;
  return {
    valorUB,
    valorCalculado: total,
    total,
    formula: `${ub} × ${valorUB}`
  };
};

/**
 * Calcula el total de días de pensión
 */
export const calcularPension = (dias, valoresConvenio) => {
  const { pension = 0 } = valoresConvenio || {};
  const total = pension * dias;
  return { pension, dias, total, formula: `${pension} × ${dias}` };
};
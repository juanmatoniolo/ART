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

// ============================================================================
// FUNCIONES PARA PRÁCTICAS ESPECIALES (valores fijos del convenio)
// ============================================================================

/**
 * Detecta si una práctica es especial (consulta, ECG, eco, artroscopia, etc.)
 * y devuelve los valores correspondientes del convenio, más flags.
 * @param {Object} practica - Datos de la práctica (código, descripción, etc.)
 * @param {Object} valoresConvenio - Valores del convenio seleccionado
 * @returns {Object|null} - { honorario, gasto, soloHonorario, soloGasto } o null si no es especial
 */
function esPracticaEspecial(practica, valoresConvenio) {
  const cod = String(practica.codigo || '').trim();
  const desc = normalize(practica.descripcion || '');

  // Helper para buscar un valor en valoresConvenio con diferentes nombres
  const buscarValor = (claves) => {
    for (const clave of claves) {
      const v = valoresConvenio[clave];
      if (v != null) return parseNumber(v);
    }
    return null;
  };

  // 1. Consulta (solo honorario)
  if (desc.includes('consulta') || cod === 'consulta') {
    const valor = buscarValor(['consulta', 'Consulta', 'CONSULTA']);
    if (valor !== null) {
      return {
        honorario: valor,
        gasto: 0,
        soloHonorario: true,
        soloGasto: false,
      };
    }
  }

  // 2. ECG (electrocardiograma) – código 17.01.01 + 42.03.03 o descripción
  if (cod.includes('17.01.01') || desc.includes('ecg') || desc.includes('electro')) {
    const valor = buscarValor(['ECG Y EX EN CV', 'ECG', 'electrocardiograma']);
    if (valor !== null) {
      return {
        honorario: valor,
        gasto: 0,
        soloHonorario: true,
        soloGasto: false,
      };
    }
  }

  // 3. Eco partes blandas (código 18.06.01)
  if (cod.includes('18.06.01') || desc.includes('eco partes blandas')) {
    const valor = buscarValor(['Ecografia Partes Blandas No Moduladas', 'Ecografia Partes Blandas']);
    if (valor !== null) {
      return {
        honorario: valor,
        gasto: 0,
        soloHonorario: true,
        soloGasto: false,
      };
    }
  }

  // 4. Artroscopia – distinguimos por descripción (hombro, simple, etc.)
  if (cod.includes('120902') || desc.includes('artroscopia')) {
    if (desc.includes('hombro')) {
      const valor = buscarValor(['Artroscopia Hombro', 'Artroscopia Hombro (total)']);
      if (valor !== null) {
        // Ejemplo de distribución: 70% honorario, 30% gasto (ajustable)
        const honorario = Math.round(valor * 0.7);
        const gasto = valor - honorario;
        return { honorario, gasto, soloHonorario: false, soloGasto: false };
      }
    } else if (desc.includes('simple')) {
      const valor = buscarValor(['Artroscopia Simple Gastoss Sanatoriales', 'Artroscopia Simple Gastos']);
      if (valor !== null) {
        // Asumimos que es solo gasto
        return { honorario: 0, gasto: valor, soloHonorario: false, soloGasto: true };
      }
    }
  }

  // 5. Curaciones
  if (desc.includes('curacion')) {
    const valor = buscarValor(['Curaciones', 'curaciones']);
    if (valor !== null) {
      return { honorario: 0, gasto: valor, soloHonorario: false, soloGasto: true };
    }
  }

  // 6. FKT
  if (desc.includes('fkt')) {
    const valor = buscarValor(['FKT', 'fkt']);
    if (valor !== null) {
      return { honorario: 0, gasto: valor, soloHonorario: false, soloGasto: true };
    }
  }

  // 7. Otros gastos (puedes agregar más según necesidad)

  // No es especial
  return null;
}

// ============================================================================
// CÁLCULO DE PRÁCTICAS (VERSIÓN EXTENDIDA)
// ============================================================================

/**
 * Calcula honorarios, gastos y total de una práctica según el convenio.
 * Ahora soporta prácticas especiales con valores fijos.
 * @param {Object} practica - Datos de la práctica
 * @param {Object} valoresConvenio - Valores del convenio
 * @returns {Object} - { honorarioMedico, gastoSanatorial, total, formula, soloHonorario, soloGasto }
 */
export const calcularPractica = (practica, valoresConvenio) => {
  // Valores por defecto
  const defaults = {
    galenoRx: 0,
    gastoRx: 0,
    galenoQuir: 0,
    gastoOperatorio: 0,
    otrosGastos: 0
  };
  const v = { ...defaults, ...valoresConvenio };

  // 1. Verificar si es una práctica especial
  const especial = esPracticaEspecial(practica, v);
  if (especial) {
    return {
      honorarioMedico: especial.honorario,
      gastoSanatorial: especial.gasto,
      total: especial.honorario + especial.gasto,
      formula: `Especial: $${money(especial.honorario)} + $${money(especial.gasto)}`,
      soloHonorario: especial.soloHonorario,
      soloGasto: especial.soloGasto,
    };
  }

  // 2. Si no es especial, aplicamos la lógica original
  const qgal = parseNumber(practica.qgal || practica.q_gal || 0);
  const gto = parseNumber(practica.gto || 0);

  // Radiología (capítulo 34)
  if (isRadiografia(practica)) {
    const gastoOp = (v.gastoRx * gto) / 2;
    const honorario = v.galenoRx * qgal + gastoOp;
    return {
      honorarioMedico: honorario,
      gastoSanatorial: gastoOp,
      total: honorario + gastoOp,
      formula: `RX: (${v.galenoRx} × ${qgal}) + ((${v.gastoRx} × ${gto}) / 2)`,
      soloHonorario: false,
      soloGasto: false,
    };
  }

  // Cirugías (capítulos 12 o 13)
  const capituloNum = Number(String(practica.capitulo || '').replace(/\D/g, '')) || 0;
  if (capituloNum === 12 || capituloNum === 13) {
    const honorario = v.galenoQuir * qgal;
    const gasto = v.gastoOperatorio * gto;
    return {
      honorarioMedico: honorario,
      gastoSanatorial: gasto,
      total: honorario + gasto,
      formula: `Cirugía: (${v.galenoQuir} × ${qgal}) + (${v.gastoOperatorio} × ${gto})`,
      soloHonorario: false,
      soloGasto: false,
    };
  }

  // Otras prácticas
  const honorario = qgal * v.otrosGastos;
  const gasto = gto * v.otrosGastos;
  return {
    honorarioMedico: honorario,
    gastoSanatorial: gasto,
    total: honorario + gasto,
    formula: `Directo: (${qgal} × ${v.otrosGastos}) + (${gto} × ${v.otrosGastos})`,
    soloHonorario: false,
    soloGasto: false,
  };
};

// ============================================================================
// CÁLCULO DE LABORATORIO
// ============================================================================

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

// ============================================================================
// CÁLCULO DE PENSIÓN
// ============================================================================

/**
 * Calcula el total de días de pensión
 */
export const calcularPension = (dias, valoresConvenio) => {
  const { pension = 0 } = valoresConvenio || {};
  const total = pension * dias;
  return { pension, dias, total, formula: `${pension} × ${dias}` };
};

// ============================================================================
// FUNCIONES PARA AOTER (honorarios por nivel de complejidad)
// ============================================================================

/**
 * Obtiene los honorarios de cirujano, ayudante1 y ayudante2 para una práctica AOTER
 * @param {string|number} complejidad - Nivel de complejidad (1 a 10 según el JSON)
 * @param {Object} valoresConvenio - Valores del convenio (debe incluir honorarios_medicos)
 * @returns {Object} - { cirujano, ayudante1, ayudante2 } (en número)
 */
export const obtenerHonorariosAoter = (complejidad, valoresConvenio) => {
  const nivel = Number(complejidad) || 0;
  const honorarios = valoresConvenio?.honorarios_medicos;

  if (!Array.isArray(honorarios) || nivel < 1 || nivel > honorarios.length) {
    return { cirujano: 0, ayudante1: 0, ayudante2: 0 };
  }

  const item = honorarios[nivel - 1]; // índice 0 = nivel 1

  // Función auxiliar para convertir a número, manejando "NO" o cadenas vacías
  const toNumber = (val) => {
    if (val === 'NO' || val === '-' || val === '') return 0;
    const num = parseNumber(val);
    return isNaN(num) ? 0 : num;
  };

  return {
    cirujano: toNumber(item?.Cirujano),
    ayudante1: toNumber(item?.Ayudante_1),
    ayudante2: toNumber(item?.Ayudante_2),
  };
};
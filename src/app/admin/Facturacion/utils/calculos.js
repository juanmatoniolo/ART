// Función para parsear números
export const parseNumber = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  
  let s = String(val).trim().replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// Formatear dinero
export const money = (n) => {
  if (n == null || n === '' || n === '-') return '—';
  const num = typeof n === 'number' ? n : parseNumber(n);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('es-AR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

// Cálculos específicos para prácticas
export const calcularPractica = (practica, valoresConvenio) => {
  const { galenoRx, gastoRx, galenoQuir, gastoOperatorio, otrosGastos } = valoresConvenio;
  
  // Para prácticas RX (capítulo 34)
  if (practica.esRX) {
    const gastoOp = (gastoRx * practica.gto) / 2;
    const honorario = (galenoRx * practica.qgal) + gastoOp;
    
    return {
      honorarioMedico: honorario,
      gastoSanatorial: gastoOp,
      total: honorario + gastoOp,
      formula: `RX: (${galenoRx} × ${practica.qgal}) + ((${gastoRx} × ${practica.gto}) / 2)`
    };
  }
  
  // Para cirugías (capítulos 12, 13)
  if (practica.capitulo === '12' || practica.capitulo === '13') {
    const honorario = galenoQuir * practica.qgal;
    const gasto = gastoOperatorio * practica.gto;
    
    return {
      honorarioMedico: honorario,
      gastoSanatorial: gasto,
      total: honorario + gasto,
      formula: `Cirugía: (${galenoQuir} × ${practica.qgal}) + (${gastoOperatorio} × ${practica.gto})`
    };
  }
  
  // Para otras prácticas
  const honorario = practica.qgal * otrosGastos;
  const gasto = practica.gto * otrosGastos;
  
  return {
    honorarioMedico: honorario,
    gastoSanatorial: gasto,
    total: honorario + gasto,
    formula: `Directo: (${practica.qgal} × ${otrosGastos}) + (${practica.gto} × ${otrosGastos})`
  };
};

// Cálculos para laboratorios
export const calcularLaboratorio = (laboratorio, valoresConvenio) => {
  const { valorUB } = valoresConvenio;
  const valor = laboratorio.unidadBioquimica * valorUB;
  
  return {
    valorUB,
    valorCalculado: valor,
    total: valor,
    formula: `${laboratorio.unidadBioquimica} × ${valorUB}`
  };
};

// Cálculos para pensión
export const calcularPension = (dias, valoresConvenio) => {
  const { pension } = valoresConvenio;
  const total = pension * dias;
  
  return {
    pension,
    dias,
    total,
    formula: `${pension} × ${dias}`
  };
};

// Normalizar texto para búsqueda
export const normalize = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
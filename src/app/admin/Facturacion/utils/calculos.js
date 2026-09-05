// utils/calculos.js
// ============================================================================
//  HELPERS NUMÉRICOS / FORMATEO
// ============================================================================

export const parseNumber = (val) => {
  if (val == null || val === "") return 0;
  if (typeof val === "number") return Number.isFinite(val) ? val : 0;

  let s = String(val)
    .trim()
    .replace(/[^\d.,-]/g, "");

  if (s.includes(",") && s.includes(".")) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }

  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

export const money = (n) => {
  if (n == null || n === "" || n === "-") return "—";
  const num = typeof n === "number" ? n : parseNumber(n);
  return Number.isFinite(num)
    ? num.toLocaleString("es-AR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : "—";
};

export const normalize = (s) =>
  (s ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const normalizeCodeDigits = (code) =>
  String(code ?? "").replace(/\D/g, "");

export const normalizeKey = (s) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export const prettyLabel = (s) =>
  String(s ?? "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const fmtDate = (ms) => {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString("es-AR");
  } catch {
    return "—";
  }
};

export const safeNum = (v) => {
  const n = typeof v === "number" ? v : parseNumber(v);
  return Number.isFinite(n) ? n : 0;
};

export const round2 = (n) => {
  const num = parseNumber(n);
  return Number.isFinite(num) ? Math.round((num + Number.EPSILON) * 100) / 100 : 0;
};

// ============================================================================
//  UTILIDADES DEL NOMENCLADOR (flags, búsqueda, etc.)
// ============================================================================

export const isRadiografia = (item) => {
  const d = normalize(item?.descripcion || "");
  return d.includes("radiograf") || d.includes("rx");
};

export const isSubsiguiente = (item) => {
  const d = normalize(item?.descripcion || "");
  return (
    d.includes("por exposicion subsiguiente") ||
    d.includes("por exposición subsiguiente")
  );
};

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

export const escapeRegExp = (s) =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const highlight = (text, q) => {
  if (!text || !q) return text;
  const regex = new RegExp(`(${escapeRegExp(q)})`, "gi");
  return String(text)
    .split(regex)
    .map((part, i) =>
      part.toLowerCase() === String(q).toLowerCase() ? (
        <mark key={i} className="highlight">
          {part}
        </mark>
      ) : (
        part
      )
    );
};

// ============================================================================
//  MAPEO DE CAPÍTULOS → CLAVES DE valores_generales
// ============================================================================

const MAPEO_CAPITULOS = {
  // Quirúrgicos (capítulos 01–13)
  "01": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "02": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "03": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "04": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "05": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "06": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "07": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "08": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "09": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "10": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "11": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "12": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },
  "13": { honorario: "Galeno_Quir", gasto: "Gasto_Operatorio" },

  // No quirúrgicos (HP + gasto variable)
  "14": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "15": { honorario: "Galeno_Rx_Practica", gasto: "Laboratorios_NBU" },
  "16": { honorario: "Galeno_Rx_Practica", gasto: "Gasto_Operatorio" },
  "17": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "18": { honorario: "Galeno_Rx_Practica", gasto: "Gasto_Rx" },
  "19": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "21": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "22": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "23": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "25": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "27": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "28": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "29": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "30": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "31": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "32": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "33": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "34": { honorario: "Galeno_Rx_Practica", gasto: "Gasto_Rx" },
  "40": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "41": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "42": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "43": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
  "44": { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" },
};

const DEFAULT_MAP = { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" };

// ============================================================================
//  EXCEPCIONES POR RANGO DE CÓDIGO (24 – Hemoterapia, 26 – Medicina Nuclear)
// ============================================================================

function getMappingByCodigo(codigo) {
  const cod = normalizeCodeDigits(codigo);
  // Hemoterapia (24)
  if (cod.startsWith("2401")) {
    const num = parseInt(cod.slice(4), 10);
    if (num >= 1 && num <= 13) {
      return { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" };
    } else if (num >= 14 && num <= 21) {
      return { honorario: "Galeno_Rx_Practica", gasto: "Laboratorios_NBU" };
    }
  }
  // Medicina Nuclear (26)
  if (cod.startsWith("2601")) {
    return { honorario: "Galeno_Rx_Practica", gasto: "Otros_Gastos" };
  }
  if (cod.startsWith("2605")) {
    return { honorario: "Galeno_Rx_Practica", gasto: "Gasto_Rx" };
  }
  return null;
}

// ============================================================================
//  BÚSQUEDA FLEXIBLE EN valores_generales (para prácticas especiales)
// ============================================================================

export const buscarValorFlexible = (valoresConvenio, posiblesClaves, defaultValue = 0) => {
  if (!valoresConvenio) return defaultValue;
  for (const clave of posiblesClaves) {
    const normClave = normalizeKey(clave);
    for (const [key, val] of Object.entries(valoresConvenio)) {
      if (normalizeKey(key) === normClave) {
        const parsed = parseNumber(val);
        if (parsed !== 0 || (val !== undefined && val !== null && val !== "")) {
          return parsed;
        }
      }
    }
  }
  return defaultValue;
};

// ============================================================================
//  PRÁCTICAS ESPECIALES (valores fijos del convenio)
// ============================================================================

const PRACTICAS_ESPECIALES = [
  // 1) Pensión (43.01.01, 43.10.01, 43.11.01)
  {
    detect: (practica) => {
      const cod = normalizeCodeDigits(practica.codigo);
      return cod === "430101" || cod === "431001" || cod === "431101";
    },
    calcular: (practica, v) => {
      const diaPension = buscarValorFlexible(v, ["Pension", "DIA_DE_PENSION-INTERNACION_PISO"], 169211);
      const gto = parseNumber(practica.gto || 0);
      const gasto = gto * diaPension;
      return {
        honorario: 0,
        gasto,
        soloHonorario: false,
        soloGasto: true,
        label: `Pensión (${gto} × ${money(diaPension)})`,
        meta: { baseKey: "Pension", baseValue: diaPension },
      };
    },
  },

  // 2) UTI (40.01.01 y similares)
  {
    detect: (practica) => {
      const cod = normalizeCodeDigits(practica.codigo);
      const d = normalize(practica.descripcion);
      return cod === "400101" || 
             d.includes("uti") || 
             d.includes("terapia intensiva") || 
             d.includes("cuidados intensivos") ||
             d.includes("arancel global") ||
             d.includes("veinticuatro horas");
    },
    calcular: (practica, v) => {
      const diaUTI = buscarValorFlexible(v, ["DIA_UTI", "DIA_UTI(_G+H)", "DIA_UTI_(G+H)", "DIA_UTI_(_G+H)"], 545733);
      const gto = parseNumber(practica.gto || 0);
      const gasto = gto * diaUTI;
      return {
        honorario: 0,
        gasto,
        soloHonorario: false,
        soloGasto: true,
        label: `UTI (${gto} × ${money(diaUTI)})`,
        meta: { baseKey: "DIA_UTI", baseValue: diaUTI },
      };
    },
  },

  // 3) Consulta
  {
    detect: (practica) => {
      const cod = normalizeCodeDigits(practica.codigo);
      const d = normalize(practica.descripcion);
      return cod === "420101" || d.includes("consulta") || practica.codigo === "consulta";
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Consulta", "CONSULTA"], 40000);
      return {
        honorario: valor,
        gasto: 0,
        soloHonorario: true,
        soloGasto: false,
        label: `Consulta (${money(valor)})`,
        meta: { baseKey: "Consulta", baseValue: valor },
      };
    },
  },

  // 4) Curaciones R (43.02.01)
  {
    detect: (practica) => {
      const cod = normalizeCodeDigits(practica.codigo);
      const d = normalize(practica.descripcion);
      return cod === "430201" || d === "curaciones" || d.includes("curacion") || d.includes("curación");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Curaciones_R", "CURACIONES_R", "Curaciones"], 11165);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Curaciones R (${money(valor)})`,
        meta: { baseKey: "Curaciones_R", baseValue: valor },
      };
    },
  },

  // 5) Curaciones Quemados
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("quemado") || d.includes("quemadura") || d.includes("curacion de quemado");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Curaciones_Quemados", "CURACIONES_QUEMADOS"], 19657);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Curaciones Quemados (${money(valor)})`,
        meta: { baseKey: "Curaciones_Quemados", baseValue: valor },
      };
    },
  },

  // 6) ECG
  {
    detect: (practica) => {
      const cod = normalizeCodeDigits(practica.codigo);
      const d = normalize(practica.descripcion);
      return cod === "170101" || cod === "420303" || d.includes("ecg") || d.includes("electrocardiograma");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["ECG Y EX EN CV", "ECG"], 80564);
      return {
        honorario: valor,
        gasto: 0,
        soloHonorario: true,
        soloGasto: false,
        label: `ECG (${money(valor)})`,
        meta: { baseKey: "ECG Y EX EN CV", baseValue: valor },
      };
    },
  },

  // 7) Ecografía Partes Blandas (18.06.01) - SOLO ESTA ES ESPECIAL
  {
    detect: (practica) => {
      const cod = normalizeCodeDigits(practica.codigo);
      const d = normalize(practica.descripcion);
      return cod === "180601" || d.includes("partes blandas no moduladas") || d.includes("eco partes blandas");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Ecografia_partes_blandas_no_moduladas"], 53130);
      return {
        honorario: valor,
        gasto: 0,
        soloHonorario: true,
        soloGasto: false,
        label: `Eco Partes Blandas (${money(valor)})`,
        meta: { baseKey: "Ecografia_partes_blandas_no_moduladas", baseValue: valor },
      };
    },
  },

  // 8) Ecografía Abdominal Completa (18.01.12) - SOLO ESTA ES ESPECIAL
  {
    detect: (practica) => {
      const cod = normalizeCodeDigits(practica.codigo);
      const d = normalize(practica.descripcion);
      return cod === "180112" || d.includes("ecografia abdominal completa") || d.includes("eco abdominal completo");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Ecografia_abdominal_completa"], 215000);
      return {
        honorario: valor,
        gasto: 0,
        soloHonorario: true,
        soloGasto: false,
        label: `Eco Abdominal Completa (${money(valor)})`,
        meta: { baseKey: "Ecografia_abdominal_completa", baseValue: valor },
      };
    },
  },

  // 9) FKT
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("fkt") && !d.includes("+ mgt") && !d.includes("mgt");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["FKT"], 17060);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `FKT (${money(valor)})`,
        meta: { baseKey: "FKT", baseValue: valor },
      };
    },
  },

  // 10) FKT + MGT
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("fkt") && d.includes("mgt");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["FKT_+_MGT", "FKT+MGT"], 24351);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `FKT + MGT (${money(valor)})`,
        meta: { baseKey: "FKT_+_MGT", baseValue: valor },
      };
    },
  },

  // 11) Módulo Oxígeno
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("oxigeno") || d.includes("oxígeno") || d.includes("modulo oxigeno");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["MODULO_OXIGENO"], 93500);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Módulo Oxígeno (${money(valor)})`,
        meta: { baseKey: "MODULO_OXIGENO", baseValue: valor },
      };
    },
  },

  // 12) Artroscopia de hombro (total dividido 70/30)
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("artroscopia hombro") || d.includes("artroscopia de hombro");
    },
    calcular: (practica, v) => {
      const valorTotal = buscarValorFlexible(v, ["Artroscopia_Hombro"], 1558700);
      const honorario = Math.round(valorTotal * 0.7);
      const gasto = valorTotal - honorario;
      return {
        honorario,
        gasto,
        soloHonorario: false,
        soloGasto: false,
        label: `Artroscopia hombro (70/30) - ${money(valorTotal)}`,
        meta: { baseKey: "Artroscopia_Hombro", baseValue: valorTotal },
      };
    },
  },

  // 13) Artroscopia simple (solo gasto)
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("artroscopia simple");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Artroscopia_Simple_Gastos_Sanatoriales"], 1138500);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Artroscopia simple (${money(valor)})`,
        meta: { baseKey: "Artroscopia_Simple_Gastos_Sanatoriales", baseValue: valor },
      };
    },
  },

  // 14) Ligamento cruzado (solo gasto)
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("ligamento cruzado") || d.includes("lig cruzado");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Lig_Cruzado_Gastos_Sanatoriales"], 1421200);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Ligamento cruzado (${money(valor)})`,
        meta: { baseKey: "Lig_Cruzado_Gastos_Sanatoriales", baseValue: valor },
      };
    },
  },

  // 15) GASTOS ARTROSCOPIA COMPLEJA (solo gasto)
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("artroscopia compleja") || d.includes("complejidad 8") || d.includes("gastos artroscopia compleja");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["GASTOS_ARTROSCOPIA_COMPLEJA_COMPLEJIDAD_8"], 1558700);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Artroscopia compleja (${money(valor)})`,
        meta: { baseKey: "GASTOS_ARTROSCOPIA_COMPLEJA_COMPLEJIDAD_8", baseValue: valor },
      };
    },
  },

  // 16) Mod Prep Sangre Transf
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("mod prep sangre transf") || d.includes("preparacion sangre transfusion");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Mod_Prep_Sangre_Transf"], 164159);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Mod Prep Sangre Transf (${money(valor)})`,
        meta: { baseKey: "Mod_Prep_Sangre_Transf", baseValue: valor },
      };
    },
  },

  // 17) Mod Prep Sangre Sin Transf
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("mod prep sangre sin transf") || d.includes("preparacion sangre sin transfusion");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Mod_Prep_Sangre_sin_Transf"], 84109);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Mod Prep Sangre Sin Transf (${money(valor)})`,
        meta: { baseKey: "Mod_Prep_Sangre_sin_Transf", baseValue: valor },
      };
    },
  },

  // 18) Der Transfusion
  {
    detect: (practica) => {
      const d = normalize(practica.descripcion);
      return d.includes("der transfusion") || d.includes("transfusion") || d.includes("hemotransfusion");
    },
    calcular: (practica, v) => {
      const valor = buscarValorFlexible(v, ["Der_Transfusion"], 35420);
      return {
        honorario: 0,
        gasto: valor,
        soloHonorario: false,
        soloGasto: true,
        label: `Der Transfusion (${money(valor)})`,
        meta: { baseKey: "Der_Transfusion", baseValue: valor },
      };
    },
  },
];

// ============================================================================
//  FUNCIÓN DETECTAR ESPECIAL
// ============================================================================

export const detectarEspecial = (practica, valoresConvenio) => {
  // Primero verificamos si la práctica es una ecografía del capítulo 18 que NO es especial
  const cod = normalizeCodeDigits(practica.codigo);
  const capitulo = String(practica.capitulo || "").padStart(2, "0");
  
  // ✅ EXCEPCIÓN: Las ecografías del capítulo 18 (excepto 180601 y 180112) NO son especiales
  if (capitulo === "18") {
    const codNum = parseInt(cod, 10);
    // Si el código es 180601 o 180112, SÍ son especiales (Partes Blandas y Abdominal Completa)
    if (cod === "180601" || cod === "180112") {
      // Estas SÍ son especiales
    } else {
      // Todas las demás ecografías NO son especiales → retornamos false
      return false;
    }
  }

  // Si llegamos acá, evaluamos las reglas normales
  for (const regla of PRACTICAS_ESPECIALES) {
    if (regla.detect(practica)) {
      return true;
    }
  }
  return false;
};

// ============================================================================
//  FUNCIÓN QUE EVALÚA LAS PRÁCTICAS ESPECIALES (para calcular)
// ============================================================================

function esPracticaEspecial(practica, valoresConvenio) {
  // Primero verificamos si es una ecografía del capítulo 18 que NO es especial
  const cod = normalizeCodeDigits(practica.codigo);
  const capitulo = String(practica.capitulo || "").padStart(2, "0");
  
  // ✅ EXCEPCIÓN: Las ecografías del capítulo 18 (excepto 180601 y 180112) NO son especiales
  if (capitulo === "18") {
    const codNum = parseInt(cod, 10);
    if (cod !== "180601" && cod !== "180112") {
      // No es especial → retornamos null para que use el mapeo normal
      return null;
    }
  }

  // Si llegamos acá, evaluamos las reglas normales
  for (const regla of PRACTICAS_ESPECIALES) {
    if (regla.detect(practica)) {
      const resultado = regla.calcular(practica, valoresConvenio);
      return resultado;
    }
  }
  return null;
}

// ============================================================================
//  CÁLCULO PRINCIPAL DE PRÁCTICAS
// ============================================================================

export const calcularPractica = (practica, valoresConvenio) => {
  const v = { ...valoresConvenio };

  // 1) Prácticas especiales (valores fijos)
  const especial = esPracticaEspecial(practica, v);
  if (especial) {
    const total = especial.honorario + especial.gasto;
    return {
      honorarioMedico: especial.honorario,
      gastoSanatorial: especial.gasto,
      total,
      formula: especial.label,
      soloHonorario: especial.soloHonorario || false,
      soloGasto: especial.soloGasto || false,
      meta: {
        kind: "especial",
        baseKey: especial.meta?.baseKey || null,
        baseValue: especial.meta?.baseValue || null,
        codigoNormalizado: normalizeCodeDigits(practica?.codigo),
      },
    };
  }

  // 2) Obtener mapeo por código (rangos) o por capítulo
  let mapeo = getMappingByCodigo(practica.codigo);
  if (!mapeo) {
    const capitulo = String(practica.capitulo || "").padStart(2, "0");
    mapeo = MAPEO_CAPITULOS[capitulo] || DEFAULT_MAP;
  }

  const qgal = parseNumber(practica.qgal || practica.q_gal || 0);
  const gto = parseNumber(practica.gto || 0);

  const honorarioBase = parseNumber(v[mapeo.honorario]);
  const gastoBase = parseNumber(v[mapeo.gasto]);

  const honorario = qgal * honorarioBase;
  const gasto = gto * gastoBase;

  return {
    honorarioMedico: honorario,
    gastoSanatorial: gasto,
    total: honorario + gasto,
    formula: `(${qgal} × ${honorarioBase}) + (${gto} × ${gastoBase})`,
    soloHonorario: false,
    soloGasto: false,
    meta: {
      kind: "capitulo",
      capitulo: practica.capitulo,
      honorarioKey: mapeo.honorario,
      gastoKey: mapeo.gasto,
      qgal,
      gto,
      honorarioBase,
      gastoBase,
    },
  };
};

// ============================================================================
//  LABORATORIO
// ============================================================================

export const calcularLaboratorio = (laboratorio, valoresConvenio) => {
  const valorUB = parseNumber(valoresConvenio?.Laboratorios_NBU || 1989);
  const ub = parseNumber(laboratorio.unidadBioquimica || 0);
  const total = ub * valorUB;

  return {
    valorUB,
    valorCalculado: total,
    total,
    formula: `${money(ub)} × ${money(valorUB)}`,
  };
};

// ============================================================================
//  PENSIÓN (genérica)
// ============================================================================

export const calcularPension = (dias, valoresConvenio) => {
  const pension = parseNumber(valoresConvenio?.pension ?? 3590);
  const d = parseNumber(dias);
  const total = pension * d;

  return {
    pension,
    dias: d,
    total,
    formula: `${money(pension)} × ${money(d)}`,
  };
};

// ============================================================================
//  AOTER
// ============================================================================

export const obtenerHonorariosAoter = (complejidad, valoresConvenio) => {
  const nivel = Number(complejidad) || 0;
  const honorarios = valoresConvenio?.honorarios_medicos;

  if (!Array.isArray(honorarios) || nivel < 1 || nivel > honorarios.length) {
    return { cirujano: 0, ayudante1: 0, ayudante2: 0 };
  }

  const item = honorarios[nivel - 1];

  const toNumber = (val) => {
    if (val === "NO" || val === "-" || val === "") return 0;
    const num = parseNumber(val);
    return Number.isFinite(num) ? num : 0;
  };

  return {
    cirujano: toNumber(item?.Cirujano),
    ayudante1: toNumber(item?.Ayudante_1),
    ayudante2: toNumber(item?.Ayudante_2),
  };
};

// ============================================================================
//  ALIASES
// ============================================================================

export const norm = normalize;
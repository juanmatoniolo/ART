"use client";

import { useState, useEffect } from "react";
import { ref, set, remove, get, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import styles from "./conveniosAdmin.module.css";
import * as XLSX from "xlsx";

/* =========================
   Utils
   ========================= */
const prettyKey = (k) => k.replace(/_/g, " ");

const formatNumber = (num) => {
  if (num === undefined || num === null) return "";
  const entero = Math.round(Number(num));
  return entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// NUEVA FUNCIÓN: Formato moneda argentina para impresión
const formatCurrency = (num) => {
  if (typeof num !== "number" || isNaN(num)) return num;
  const fixed = num.toFixed(2);
  const [integerPart, decimalPart] = fixed.split(".");
  const integerWithDots = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$${integerWithDots},${decimalPart}`;
};

const normalizeKeys = (obj) => {
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k.trim().replace(/\s+/g, "_")] = normalizeKeys(v);
    }
    return out;
  }
  return obj;
};

const parseLocaleNumber = (str) => {
  if (typeof str !== "string") return str;
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? str : num;
};

const toNumber = (val) => {
  if (typeof val === "number") return Math.round(val * 100) / 100;
  if (typeof val === "string") {
    const parsed = parseLocaleNumber(val);
    if (typeof parsed === "number") return Math.round(parsed * 100) / 100;
  }
  return 0;
};

const convertirValoresANumero = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertirValoresANumero(item));
  } else if (obj && typeof obj === "object") {
    const newObj = {};
    for (const [k, v] of Object.entries(obj)) {
      newObj[k] = convertirValoresANumero(v);
    }
    return newObj;
  } else if (typeof obj === "string") {
    const parsed = parseLocaleNumber(obj);
    return typeof parsed === "number" ? Math.round(parsed * 100) / 100 : obj;
  } else if (typeof obj === "number") {
    return Math.round(obj * 100) / 100;
  } else {
    return obj;
  }
};

const ordenValoresGenerales = [
  "Gasto_Operatorio",
  "Pension",
  "Gasto_Rx",
  "Galeno_Rx_Practica",
  "Galeno_Quir",
  "Otros_Gastos",
  "Medicación_Valor_Kairos",
  "Curaciones_R",
  "Curaciones_Quemados",
  "Der_Transfusion",
  "Lig_Cruzado_Gastos_Sanatoriales",
  "Artroscopia_Simple_Gastos_Sanatoriales",
  "Artroscopia_Hombro",
  "Laboratorios_NBU",
  "Mod_Prep_Sangre_sin_Transf",
  "Mod_Prep_Sangre_Transf",
  "FKT",
  "FKT_+_MGT",
  "Consulta",
  "Ecografia_partes_blandas_no_moduladas",
  "ECG_Y_EX_EN_CV",
];

const conceptosHonorarios = [
  "Laboratorios_NBU",
  "Mod_Prep_Sangre_sin_Transf",
  "Mod_Prep_Sangre_Transf",
  "FKT",
  "FKT_+_MGT",
  "Consulta",
  "Ecografia_partes_blandas_no_moduladas",
  "ECG_Y_EX_EN_CV",
];

const PLANTILLA_BASE = {
  valores_generales: {
    Gasto_Operatorio: 0,
    Pension: 0,
    Gasto_Rx: 0,
    Galeno_Rx_Practica: 0,
    Galeno_Quir: 0,
    Otros_Gastos: 0,
    "Medicación_Valor_Kairos": "-",
    Curaciones_R: 0,
    Curaciones_Quemados: 0,
    Der_Transfusion: 0,
    Lig_Cruzado_Gastos_Sanatoriales: 0,
    Artroscopia_Simple_Gastos_Sanatoriales: 0,
    Artroscopia_Hombro: 0,
    Laboratorios_NBU: 0,
    Mod_Prep_Sangre_sin_Transf: 0,
    Mod_Prep_Sangre_Transf: 0,
    FKT: 0,
    "FKT_+_MGT": 0,
    Consulta: 0,
    Ecografia_partes_blandas_no_moduladas: 0,
    ECG_Y_EX_EN_CV: 0,
  },
  honorarios_medicos: Array.from({ length: 10 }, (_, i) => ({
    Cirujano: 0,
    Ayudante_1: 0,
    Ayudante_2: 0,
  })),
};

const InputNumero = ({ value, onChange }) => {
  const numValue = typeof value === "number" ? value : 0;
  const [displayValue, setDisplayValue] = useState(() => {
    if (Number.isInteger(numValue)) return numValue.toString();
    return numValue.toFixed(2).replace(".", ",");
  });

  useEffect(() => {
    if (Number.isInteger(numValue)) {
      setDisplayValue(numValue.toString());
    } else {
      setDisplayValue(numValue.toFixed(2).replace(".", ","));
    }
  }, [numValue]);

  const handleBlur = () => {
    const parsed = parseFloat(displayValue.replace(",", ".")) || 0;
    const redondeado = Math.round(parsed * 100) / 100;
    onChange(redondeado);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.target.blur();
    }
  };

  return (
    <input
      type="text"
      className={styles.input}
      value={displayValue}
      onChange={(e) => setDisplayValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
};

export default function ConveniosAdmin() {
  const [convenios, setConvenios] = useState({});
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [activo, setActivo] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});
  const [mensaje, setMensaje] = useState("");
  const [fechaImpresion, setFechaImpresion] = useState("");
  const [logoBase64, setLogoBase64] = useState("");

  const [modalEliminar, setModalEliminar] = useState(null);
  const [modalRenombrar, setModalRenombrar] = useState(null);
  const [nuevoNombreConvenio, setNuevoNombreConvenio] = useState("");

  const [showPercentModal, setShowPercentModal] = useState(false);
  const [percentSource, setPercentSource] = useState("");
  const [porcentajeHonorarios, setPorcentajeHonorarios] = useState(10);
  const [porcentajeGastos, setPorcentajeGastos] = useState(10);
  const [newNamePercent, setNewNamePercent] = useState("");

  /* ===== Cargar convenios en tiempo real ===== */
  useEffect(() => {
    const conveniosRef = ref(db, "convenios");
    const unsubscribe = onValue(conveniosRef, (snapshot) => {
      setConvenios(snapshot.val() || {});
    });
    return () => unsubscribe();
  }, []);

  // Precargar el logo como Base64 para que esté disponible al imprimir
  useEffect(() => {
    fetch("/logo.png")
      .then((res) => res.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => setLogoBase64(reader.result);
        reader.readAsDataURL(blob);
      })
      .catch(() => setLogoBase64(""));
  }, []);

  /* ===== Crear nuevo convenio desde plantilla ===== */
  const crearDesdePlantilla = async () => {
    if (!nuevoNombre.trim()) {
      setMensaje("⚠️ Ingresá un nombre para el nuevo convenio");
      return;
    }
    const safe = nuevoNombre.trim().replace(/\s+/g, "_");
    const baseKey = "OCTUBRE_-_ACTUALIDAD_2026";
    const baseData = convenios[baseKey];

    let newData;
    if (!baseData) {
      newData = JSON.parse(JSON.stringify(PLANTILLA_BASE));
      setMensaje(
        "ℹ️ No se encontró la plantilla OCTUBRE, se usó la plantilla por defecto."
      );
    } else {
      newData = JSON.parse(JSON.stringify(baseData));
    }

    await set(ref(db, `convenios/${safe}`), newData);
    setNuevoNombre("");
    setMensaje(`✅ Convenio creado desde plantilla: ${prettyKey(safe)}`);
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Abrir modal de aumento porcentual ===== */
  const abrirModalPorcentaje = () => {
    setShowPercentModal(true);
    setPercentSource("");
    setPorcentajeHonorarios(10);
    setPorcentajeGastos(10);
    setNewNamePercent("");
  };

  /* ===== Confirmar aumento porcentual ===== */
  const confirmarAumentoPorcentaje = async () => {
    if (!newNamePercent.trim()) {
      alert("Ingresá un nombre para el nuevo convenio");
      return;
    }
    if (!percentSource) {
      alert("Seleccioná un convenio origen");
      return;
    }
    const pHonorarios = parseFloat(porcentajeHonorarios);
    const pGastos = parseFloat(porcentajeGastos);
    if (isNaN(pHonorarios) || isNaN(pGastos)) {
      alert("Ingresá porcentajes válidos (pueden ser cero)");
      return;
    }
    const sourceData = convenios[percentSource];
    if (!sourceData) return;

    const factorHonorarios = 1 + pHonorarios / 100;
    const factorGastos = 1 + pGastos / 100;

    const roundInt = (num) => Math.round(num);

    const applyFactorToBranch = (obj, factor) => {
      if (Array.isArray(obj)) {
        return obj.map((item) => applyFactorToBranch(item, factor));
      } else if (obj && typeof obj === "object") {
        const newObj = {};
        for (const [k, v] of Object.entries(obj)) {
          newObj[k] = applyFactorToBranch(v, factor);
        }
        return newObj;
      } else if (typeof obj === "number") {
        return roundInt(obj * factor);
      } else if (typeof obj === "string") {
        const parsed = parseLocaleNumber(obj);
        if (typeof parsed === "number") {
          return roundInt(parsed * factor);
        } else {
          return obj;
        }
      } else {
        return obj;
      }
    };

    const newData = JSON.parse(JSON.stringify(sourceData));

    if (newData.honorarios_medicos) {
      newData.honorarios_medicos = applyFactorToBranch(
        newData.honorarios_medicos,
        factorHonorarios
      );
    }

    if (newData.valores_generales) {
      const generales = newData.valores_generales;
      const honorariosGenerales = {};
      const gastosGenerales = {};

      for (const [key, value] of Object.entries(generales)) {
        if (conceptosHonorarios.includes(key)) {
          honorariosGenerales[key] = value;
        } else {
          gastosGenerales[key] = value;
        }
      }

      const honorariosAplicados = applyFactorToBranch(
        honorariosGenerales,
        factorHonorarios
      );
      const gastosAplicados = applyFactorToBranch(
        gastosGenerales,
        factorGastos
      );

      newData.valores_generales = { ...gastosAplicados, ...honorariosAplicados };
    }

    const safeName = newNamePercent.trim().replace(/\s+/g, "_");
    await set(ref(db, `convenios/${safeName}`), newData);
    setShowPercentModal(false);
    setMensaje(
      `✅ Convenio creado: Honorarios ${pHonorarios}%, Gastos ${pGastos}%`
    );
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Editar (abre el editor visual) ===== */
  const editar = (nombre) => {
    const data = convenios[nombre];
    if (!data) return;
    const dataNormalizada = convertirValoresANumero(
      JSON.parse(JSON.stringify(data))
    );

    const ordenGuardado = dataNormalizada._orden_valores_generales;
    const clavesExistentes = Object.keys(
      dataNormalizada.valores_generales || {}
    );
    let ordenInicial;
    if (ordenGuardado && Array.isArray(ordenGuardado)) {
      const nuevas = clavesExistentes.filter(
        (k) => !ordenGuardado.includes(k)
      );
      ordenInicial = [
        ...ordenGuardado.filter((k) => clavesExistentes.includes(k)),
        ...nuevas,
      ];
    } else {
      const ordenadas = ordenValoresGenerales.filter((k) =>
        clavesExistentes.includes(k)
      );
      const otras = clavesExistentes.filter(
        (k) => !ordenValoresGenerales.includes(k)
      );
      ordenInicial = [...ordenadas, ...otras];
    }

    setActivo(nombre);
    setEditBuffer({
      valores_generales: dataNormalizada.valores_generales || {},
      honorarios_medicos: Array.isArray(dataNormalizada.honorarios_medicos)
        ? dataNormalizada.honorarios_medicos
        : [],
      _orden_valores_generales: ordenInicial,
    });
  };

  /* ===== Guardar cambios ===== */
  const guardar = async () => {
    if (!activo) return;
    const refConv = ref(db, `convenios/${activo}`);
    const payload = normalizeKeys({
      ...editBuffer,
      _orden_valores_generales:
        editBuffer._orden_valores_generales ||
        Object.keys(editBuffer.valores_generales || {}),
    });
    await set(refConv, payload);
    setActivo(null);
    setEditBuffer({});
    setMensaje("✅ Convenio actualizado correctamente");
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Eliminar ===== */
  const confirmarEliminar = async () => {
    await remove(ref(db, `convenios/${modalEliminar}`));
    setModalEliminar(null);
    setMensaje("🗑️ Convenio eliminado");
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Renombrar ===== */
  const confirmarRenombrar = async () => {
    if (!modalRenombrar || !nuevoNombreConvenio.trim()) return;
    const snap = await get(ref(db, `convenios/${modalRenombrar}`));
    if (!snap.exists()) return;
    const data = snap.val();
    const safe = nuevoNombreConvenio.trim().replace(/\s+/g, "_");
    await set(ref(db, `convenios/${safe}`), data);
    await remove(ref(db, `convenios/${modalRenombrar}`));
    setModalRenombrar(null);
    setNuevoNombreConvenio("");
    setMensaje("✏️ Convenio renombrado correctamente");
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Generar Excel ===== */
  const descargarExcel = (nombre) => {
    const data = convenios[nombre];
    if (!data) return;

    const dataNormalizada = convertirValoresANumero(
      JSON.parse(JSON.stringify(data))
    );
    const nombreLegible = prettyKey(nombre);

    const generales = dataNormalizada.valores_generales || {};
    const ordenGuardado = dataNormalizada._orden_valores_generales;
    let todosConceptos;
    if (ordenGuardado && Array.isArray(ordenGuardado)) {
      const nuevas = Object.keys(generales).filter(
        (k) => !ordenGuardado.includes(k)
      );
      todosConceptos = [
        ...ordenGuardado.filter((k) => generales.hasOwnProperty(k)),
        ...nuevas,
      ];
    } else {
      const conceptosOrdenados = ordenValoresGenerales.filter((key) =>
        generales.hasOwnProperty(key)
      );
      const otrosConceptos = Object.keys(generales).filter(
        (key) => !ordenValoresGenerales.includes(key)
      );
      todosConceptos = [...conceptosOrdenados, ...otrosConceptos];
    }

    const wsDataGenerales = [
      ["Concepto", "Valor"],
      ...todosConceptos.map((key) => [prettyKey(key), generales[key]]),
    ];

    const wb = XLSX.utils.book_new();
    const wsGenerales = XLSX.utils.aoa_to_sheet(wsDataGenerales);

    const rangeGenerales = XLSX.utils.decode_range(wsGenerales["!ref"]);
    for (let R = rangeGenerales.s.r; R <= rangeGenerales.e.r; R++) {
      for (let C = rangeGenerales.s.c; C <= rangeGenerales.e.c; C++) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!wsGenerales[cellRef]) continue;
        wsGenerales[cellRef].s = {
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    }
    wsGenerales["!cols"] = [{ wch: 40 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, wsGenerales, "Valores Generales");

    const honorarios = dataNormalizada.honorarios_medicos || [];
    const wsDataHonorarios = [
      ["Nivel", "Cirujano", "Ayudante 1", "Ayudante 2"],
      ...honorarios.map((row, idx) => [
        idx + 1,
        row.Cirujano || 0,
        row.Ayudante_1 || 0,
        row.Ayudante_2 || 0,
      ]),
    ];
    const wsHonorarios = XLSX.utils.aoa_to_sheet(wsDataHonorarios);
    const rangeHonorarios = XLSX.utils.decode_range(wsHonorarios["!ref"]);
    for (let R = rangeHonorarios.s.r; R <= rangeHonorarios.e.r; R++) {
      for (let C = rangeHonorarios.s.c; C <= rangeHonorarios.e.c; C++) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        if (!wsHonorarios[cellRef]) continue;
        wsHonorarios[cellRef].s = {
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }
    }
    wsHonorarios["!cols"] = [
      { wch: 10 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ];
    XLSX.utils.book_append_sheet(wb, wsHonorarios, "Honorarios Médicos");

    XLSX.writeFile(
      wb,
      `convenio_${nombreLegible.replace(/\s+/g, "_")}.xlsx`
    );
    setMensaje(`✅ Excel generado: ${nombreLegible}`);
    setTimeout(() => setMensaje(""), 3000);
  };

  // Formateo de fecha
  const formatearFechaLegible = (fechaISO) => {
    if (!fechaISO) return "________________";
    const [year, month, day] = fechaISO.split("-");
    const meses = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    const mes = meses[parseInt(month, 10) - 1];
    return `${parseInt(day, 10)} de ${mes} de ${year}`;
  };

  /* ===== GENERADORES HTML PARA IMPRESIÓN ===== */
  const generarHTMLImpresionFormal = (data, nombre, fecha) => {
    const nombreConvenio = prettyKey(nombre);
    const generales = data.valores_generales || {};
    const fechaLegible = formatearFechaLegible(fecha);

    const ordenGuardado = data._orden_valores_generales;
    let todosConceptos;
    if (ordenGuardado && Array.isArray(ordenGuardado)) {
      const nuevas = Object.keys(generales).filter(
        (k) => !ordenGuardado.includes(k)
      );
      todosConceptos = [
        ...ordenGuardado.filter((k) => generales.hasOwnProperty(k)),
        ...nuevas,
      ];
    } else {
      const conceptosOrdenados = ordenValoresGenerales.filter((key) =>
        generales.hasOwnProperty(key)
      );
      const otrosConceptos = Object.keys(generales).filter(
        (key) => !ordenValoresGenerales.includes(key)
      );
      todosConceptos = [...conceptosOrdenados, ...otrosConceptos];
    }

    const displayValue = (val) => {
      if (typeof val === "number") {
        if (val === 0) return "No admite";
        return formatCurrency(val);
      }
      return val;
    };

    return `
      <html>
        <head>
          <title>Convenio ${nombreConvenio}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              font-size: 11px;
              color: #1e293b;
              line-height: 1.4;
              padding: 20px 25px;
              background: white;
            }
            .watermark {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%) rotate(-25deg);
              opacity: 0.03;
              font-size: 120px;
              font-weight: 900;
              color: #2f6f4e;
              pointer-events: none;
              z-index: 0;
              letter-spacing: 15px;
              white-space: nowrap;
            }
            .contenido { position: relative; z-index: 1; }
            .logo-header {
              display: flex;
              align-items: center;
              gap: 14px;
              margin-bottom: 20px;
              border-bottom: 2px solid #2f6f4e;
              padding-bottom: 10px;
            }
            .logo-img { height: 50px; width: auto; object-fit: contain; }
            .logo-text { font-size: 16px; font-weight: 800; color: #2f6f4e; letter-spacing: 0.5px; }
            .logo-sub { font-size: 10px; color: #475569; margin-top: 2px; }
            .cabecera { margin-bottom: 18px; font-size: 11px; }
            .cabecera p { margin: 4px 0; }
            h2 {
              margin-top: 18px;
              border-bottom: 1px solid #94a3b8;
              font-size: 12px;
              color: #2f6f4e;
              padding-bottom: 2px;
            }
            table { border-collapse: collapse; width: 100%; margin: 10px 0; font-size: 10px; }
            th, td { border: 0.5px solid #94a3b8; padding: 4px 7px; text-align: left; }
            th { background-color: #e2e8f0; font-weight: 600; color: #0f172a; }
            .valor { text-align: right; }
            tbody tr:nth-child(even) { background-color: #f8fafc; }
            .pie-pagina {
              margin-top: 25px;
              padding: 12px;
              background-color: #f9f9f9;
              border: 1px solid #ccc;
              border-radius: 6px;
              font-weight: bold;
              color: #222;
              font-size: 10px;
              line-height: 1.5;
              text-align: justify;
            }
            .pie-pagina p { margin: 3px 0; }
            .firmas {
              margin-top: 60px;
              display: flex;
              justify-content: space-between;
              gap: 40px;
            }
            .firma-block { width: 45%; text-align: center; }
            .firma-linea { margin-top: 40px; border-top: 1px solid #000; padding-top: 5px; font-size: 9px; color: #333; }
            
            /* Numeración de página automática */
            @page {
              size: A4;
              margin: 20mm 15mm 25mm 15mm; /* margen superior amplio para el encabezado */
              @top-center {
                content: "Hoja " counter(page) " de " counter(pages);
                font-size: 9px;
                color: #666;
                font-family: 'Segoe UI', Arial, sans-serif;
              }
            }
            @media print {
              body { padding: 0; font-size: 10.5px; }
              .watermark { opacity: 0.02; }
            }
          </style>
        </head>
        <body>
          <div class="watermark">CU</div>
          <div class="contenido">
            <div class="logo-header">
              ${logoBase64 ? `<img src="${logoBase64}" alt="Logo" class="logo-img" />` : ""}
              <div>
                <div class="logo-text">Clínica de la Unión S.A.</div>
                <div class="logo-sub">CUIT: 30-70754530-1 | ART · Convenios</div>
              </div>
            </div>

            <div class="cabecera">
              <p><strong>Señores prestadores ART:</strong></p>
              <p>Nos dirigimos a usted a fin de comunicarles los nuevos valores a facturar a partir del día <strong>${fechaLegible}</strong>.</p>
            </div>

            <h2>Valores Generales</h2>
            <table>
              <thead><tr><th>Concepto</th><th>Valor</th></tr></thead>
              <tbody>
                ${todosConceptos
                  .map((key) => {
                    const val = generales[key];
                    const valorMostrado = displayValue(val);
                    return `<tr><td>${prettyKey(key)}</td><td class="valor">${valorMostrado}</td></tr>`;
                  })
                  .join("")}
              </tbody>
            </table>

            <h2>Honorarios Médicos por Complejidad</h2>
            <table>
              <thead><tr><th>Nivel</th><th>Cirujano</th><th>Ayudante 1</th><th>Ayudante 2</th></tr></thead>
              <tbody>
                ${(data.honorarios_medicos || [])
                  .map(
                    (row, idx) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td class="valor">${displayValue(row.Cirujano)}</td>
                    <td class="valor">${displayValue(row.Ayudante_1)}</td>
                    <td class="valor">${displayValue(row.Ayudante_2)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>

            <div class="pie-pagina">
              <p>En caso de no aceptar se rescinde convenio. No se aceptarán contrapropuestas. En caso de aceptar aranceles se solicita reenviar este documento firmado y sellado debidamente.</p>
              <p>Importante: los siniestros en curso pasan a incrementarse de acuerdo a esta grilla de valores. Caso contrario avisar para derivar al paciente.</p>
              <p>Los pagos se realizan dentro de los 30 días corridos enviada la facturación a los mails/app correspondientes.</p>
              <p>Se deja constancia que los anestesistas van por A.E.A.</p>
              <p><strong>Plazo de respuesta: 48 horas hábiles previas al inicio de vigencia del convenio.</strong></p>
              <p><strong>Atte: Clínica de la Unión S.A &nbsp;| &nbsp;CUIT: 30-70754530-1</strong></p>
            </div>

            <div class="firmas">
              <div class="firma-block">
                <div class="firma-linea">Firma y sello de la ART</div>
                <br>
                <div style="margin-top:6px;">Fecha: _______/_______/__________</div>
              </div>
              <div class="firma-block">
                <div style="margin-top: 10px; display: flex; align-items: center; justify-content: center; gap: 8px;">
                  ${logoBase64 ? `<img src="${logoBase64}" style="height:35px;" />` : ""}
                  <div style="font-size: 9px; text-align: left;">
                    <div style="font-weight:600;">Clínica de la Unión S.A.</div>
                    <div>CUIT: 30-70754530-1</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const generarHTMLImpresionInterno = (data, nombre) => {
    const nombreConvenio = prettyKey(nombre);
    const generales = data.valores_generales || {};

    const ordenGuardado = data._orden_valores_generales;
    let todosConceptos;
    if (ordenGuardado && Array.isArray(ordenGuardado)) {
      const nuevas = Object.keys(generales).filter(
        (k) => !ordenGuardado.includes(k)
      );
      todosConceptos = [
        ...ordenGuardado.filter((k) => generales.hasOwnProperty(k)),
        ...nuevas,
      ];
    } else {
      const conceptosOrdenados = ordenValoresGenerales.filter((key) =>
        generales.hasOwnProperty(key)
      );
      const otrosConceptos = Object.keys(generales).filter(
        (key) => !ordenValoresGenerales.includes(key)
      );
      todosConceptos = [...conceptosOrdenados, ...otrosConceptos];
    }

    const displayValue = (val) => {
      if (typeof val === "number") {
        if (val === 0) return "No admite";
        return formatCurrency(val);
      }
      return val;
    };

    return `
      <html>
        <head>
          <title>Interno - ${nombreConvenio}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Arial, sans-serif;
              font-size: 10px;
              color: #1e293b;
              line-height: 1.3;
              padding: 10px 15px;
              background: white;
            }
            h1 { color: #2f6f4e; font-size: 14px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #cbd5e1; }
            h2 { margin-top: 12px; border-bottom: 1px solid #94a3b8; font-size: 11px; color: #334155; }
            table { border-collapse: collapse; width: 100%; margin: 8px 0; font-size: 9px; }
            th, td { border: 0.5px solid #94a3b8; padding: 3px 6px; text-align: left; }
            th { background-color: #e2e8f0; font-weight: 600; }
            .valor { text-align: right; }
            tbody tr:nth-child(even) { background-color: #f8fafc; }
            
            @page {
              size: A4;
              margin: 15mm 10mm;
              @top-center {
                content: "Hoja " counter(page) " de " counter(pages);
                font-size: 8px;
                color: #999;
              }
            }
            @media print { body { padding: 0; font-size: 9.5px; } }
          </style>
        </head>
        <body>
          <h1>${nombreConvenio}</h1>
          <h2>Valores Generales</h2>
          <table>
            <thead><tr><th>Concepto</th><th>Valor</th></tr></thead>
            <tbody>
              ${todosConceptos
                .map((key) => {
                  const val = generales[key];
                  const valorMostrado = displayValue(val);
                  return `<tr><td>${prettyKey(key)}</td><td class="valor">${valorMostrado}</td></tr>`;
                })
                .join("")}
            </tbody>
          </table>
          <h2>Honorarios Médicos por Complejidad</h2>
          <table>
            <thead><tr><th>Nivel</th><th>Cirujano</th><th>Ayudante 1</th><th>Ayudante 2</th></tr></thead>
            <tbody>
              ${(data.honorarios_medicos || [])
                .map(
                  (row, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td class="valor">${displayValue(row.Cirujano)}</td>
                  <td class="valor">${displayValue(row.Ayudante_1)}</td>
                  <td class="valor">${displayValue(row.Ayudante_2)}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </body>
      </html>
    `;
  };

  /* ===== Funciones de impresión ===== */
  const imprimirConvenioFormal = () => {
    if (!activo) {
      alert("Seleccioná un convenio para imprimir");
      return;
    }
    if (!fechaImpresion) {
      alert("Establecé la fecha de vigencia antes de imprimir.");
      return;
    }
    const printWindow = window.open("", "_blank");
    printWindow.document.write(
      generarHTMLImpresionFormal(editBuffer, activo, fechaImpresion)
    );
    printWindow.document.close();
    printWindow.print();
  };

  const imprimirConvenioInterno = () => {
    if (!activo) {
      alert("Seleccioná un convenio para imprimir");
      return;
    }
    const printWindow = window.open("", "_blank");
    printWindow.document.write(generarHTMLImpresionInterno(editBuffer, activo));
    printWindow.document.close();
    printWindow.print();
  };

  const imprimirConvenioFormalDesdeLista = (nombre) => {
    if (!fechaImpresion) {
      alert("Establecé la fecha de vigencia antes de imprimir.");
      return;
    }
    const data = convenios[nombre];
    if (!data) return;
    const dataNormalizada = convertirValoresANumero(
      JSON.parse(JSON.stringify(data))
    );
    const printWindow = window.open("", "_blank");
    printWindow.document.write(
      generarHTMLImpresionFormal(dataNormalizada, nombre, fechaImpresion)
    );
    printWindow.document.close();
    printWindow.print();
  };

  const imprimirConvenioInternoDesdeLista = (nombre) => {
    const data = convenios[nombre];
    if (!data) return;
    const dataNormalizada = convertirValoresANumero(
      JSON.parse(JSON.stringify(data))
    );
    const printWindow = window.open("", "_blank");
    printWindow.document.write(
      generarHTMLImpresionInterno(dataNormalizada, nombre)
    );
    printWindow.document.close();
    printWindow.print();
  };

  // ================== EDITOR VISUAL (drag & drop) ==================
  const EditorValores = () => {
    if (!activo) return null;

    const [dragIndex, setDragIndex] = useState(null);

    const handleGeneralChange = (key, newVal) => {
      setEditBuffer((prev) => ({
        ...prev,
        valores_generales: { ...prev.valores_generales, [key]: newVal },
      }));
    };

    const handleAddGeneral = () => {
      const newKey = prompt("Ingresá el nombre del nuevo concepto:");
      if (!newKey) return;
      const safeKey = newKey.trim().replace(/\s+/g, "_");
      setEditBuffer((prev) => ({
        ...prev,
        valores_generales: { ...prev.valores_generales, [safeKey]: 0 },
        _orden_valores_generales: [
          ...(prev._orden_valores_generales ||
            Object.keys(prev.valores_generales)),
          safeKey,
        ],
      }));
    };

    const handleDeleteGeneral = (key) => {
      if (!confirm(`¿Eliminar "${prettyKey(key)}"?`)) return;
      const newGenerales = { ...editBuffer.valores_generales };
      delete newGenerales[key];
      setEditBuffer((prev) => ({
        ...prev,
        valores_generales: newGenerales,
        _orden_valores_generales: (prev._orden_valores_generales || []).filter(
          (k) => k !== key
        ),
      }));
    };

    const todosConceptos =
      editBuffer._orden_valores_generales ||
      Object.keys(editBuffer.valores_generales || {});

    const handleDragStart = (e, index) => {
      setDragIndex(index);
      e.dataTransfer.effectAllowed = "move";
      e.currentTarget.style.opacity = "0.5";
    };
    const handleDragEnd = (e) => {
      e.currentTarget.style.opacity = "1";
      setDragIndex(null);
    };
    const handleDragOver = (e) => e.preventDefault();
    const handleDrop = (e, dropIndex) => {
      e.preventDefault();
      if (dragIndex === null || dragIndex === dropIndex) return;
      const newOrden = [...todosConceptos];
      const [moved] = newOrden.splice(dragIndex, 1);
      newOrden.splice(dropIndex, 0, moved);
      setEditBuffer((prev) => ({
        ...prev,
        _orden_valores_generales: newOrden,
      }));
      setDragIndex(null);
    };

    const handleCirujanoChange = (index, newVal) => {
      const newHonorarios = [...editBuffer.honorarios_medicos];
      newHonorarios[index] = {
        Cirujano: newVal,
        Ayudante_1: Math.round(newVal * 0.3 * 100) / 100,
        Ayudante_2: index >= 3 ? Math.round(newVal * 0.2 * 100) / 100 : 0,
      };
      setEditBuffer((prev) => ({ ...prev, honorarios_medicos: newHonorarios }));
    };

    const handleAddHonorario = () => {
      setEditBuffer((prev) => ({
        ...prev,
        honorarios_medicos: [
          ...prev.honorarios_medicos,
          { Cirujano: 0, Ayudante_1: 0, Ayudante_2: 0 },
        ],
      }));
    };

    const handleDeleteHonorario = (index) => {
      if (!confirm(`¿Eliminar fila ${index + 1}?`)) return;
      setEditBuffer((prev) => ({
        ...prev,
        honorarios_medicos: prev.honorarios_medicos.filter(
          (_, i) => i !== index
        ),
      }));
    };

    return (
      <div className={styles.editorCard}>
        <div className={styles.editorHeader}>
          <h4>✏️ Editando: {prettyKey(activo)}</h4>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <label
              style={{
                color: "#aaa",
                fontSize: "0.85rem",
                whiteSpace: "nowrap",
              }}
            >
              Fecha vigencia:
              <input
                type="date"
                className={styles.input}
                value={fechaImpresion}
                onChange={(e) => setFechaImpresion(e.target.value)}
                style={{
                  marginLeft: "0.5rem",
                  width: "auto",
                  display: "inline-block",
                }}
              />
            </label>
            <button
              className={styles.btnSecondary}
              onClick={imprimirConvenioFormal}
              title="Imprimir con membrete"
            >
              🖨️ Formal
            </button>
            <button
              className={styles.btnSecondary}
              onClick={imprimirConvenioInterno}
              title="Solo tabla de valores"
            >
              📋 Interno
            </button>
          </div>
        </div>

        <div className={styles.editorSection}>
          <h5>
            📋 Valores Generales{" "}
            <span style={{ fontSize: "0.75rem", color: "#888" }}>
              (arrastrá para reordenar)
            </span>
          </h5>
          <table className={styles.editTable}>
            <thead>
              <tr>
                <th style={{ width: "30px" }}></th>
                <th>Concepto</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {todosConceptos.map((key, index) => (
                <tr
                  key={key}
                  draggable
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  style={{ cursor: "grab", transition: "opacity 0.15s" }}
                >
                  <td
                    style={{ textAlign: "center", color: "#666" }}
                    title="Arrastrar para reordenar"
                  >
                    ⋮⋮
                  </td>
                  <td>{prettyKey(key)}</td>
                  <td>
                    <InputNumero
                      value={toNumber(editBuffer.valores_generales[key])}
                      onChange={(v) => handleGeneralChange(key, v)}
                    />
                  </td>
                  <td>
                    <button
                      className={styles.btnDangerSmall}
                      onClick={() => handleDeleteGeneral(key)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className={styles.btnSecondary} onClick={handleAddGeneral}>
            ➕ Agregar nuevo concepto
          </button>
        </div>

        <div className={styles.editorSection}>
          <h5>👨‍⚕️ Honorarios Médicos (por complejidad)</h5>
          <p className={styles.hint}>
            Ayudante 1 = 30% del Cirujano, Ayudante 2 = 20% (solo niveles ≥ 4).
          </p>
          <table className={styles.editTable}>
            <thead>
              <tr>
                <th>#</th>
                <th>Cirujano</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {editBuffer.honorarios_medicos.map((row, index) => (
                <tr key={index}>
                  <td>{index + 1}</td>
                  <td>
                    <InputNumero
                      value={toNumber(row.Cirujano)}
                      onChange={(v) => handleCirujanoChange(index, v)}
                    />
                  </td>
                  <td>
                    <button
                      className={styles.btnDangerSmall}
                      onClick={() => handleDeleteHonorario(index)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className={styles.btnSecondary} onClick={handleAddHonorario}>
            ➕ Agregar nivel
          </button>
        </div>

        <details className={styles.jsonDetails}>
          <summary>🔍 Ver JSON completo</summary>
          <pre
            style={{
              fontSize: 12,
              opacity: 0.8,
              maxHeight: "300px",
              overflow: "auto",
            }}
          >
            {JSON.stringify(editBuffer, null, 2)}
          </pre>
        </details>

        <div className={styles.editorActions}>
          <button className={styles.btnSecondary} onClick={() => setActivo(null)}>
            Cancelar
          </button>
          <button className={styles.btnPrimary} onClick={guardar}>
            Guardar
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>🩺 Administración de Convenios</h2>

      {mensaje && <div className={styles.message}>{mensaje}</div>}

      <div
        style={{
          background: "#0f172a",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: "10px",
          padding: "0.75rem 1rem",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <label style={{ color: "#aaa", fontSize: "0.9rem" }}>
          📅 Fecha de vigencia para impresión:
        </label>
        <input
          type="date"
          className={styles.input}
          value={fechaImpresion}
          onChange={(e) => setFechaImpresion(e.target.value)}
          style={{ width: "auto" }}
        />
        {fechaImpresion && (
          <span style={{ color: "#6fa17b", fontSize: "0.85rem" }}>
            ({formatearFechaLegible(fechaImpresion)})
          </span>
        )}
      </div>

      <div className={styles.newRow}>
        <input
          className={styles.input}
          placeholder="Nuevo convenio..."
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
        />
        <button className={styles.btnPrimary} onClick={crearDesdePlantilla}>
          ➕ Crear (desde plantilla)
        </button>
      </div>

      <div className={styles.buttonRow}>
        <button className={styles.btnSecondary} onClick={abrirModalPorcentaje}>
          📈 Aumentar / Reducir % desde existente
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Convenio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(convenios).map(([nombre, data]) => (
              <tr key={nombre}>
                <td>{prettyKey(nombre)}</td>
                <td className={styles.actions}>
                  <button onClick={() => editar(nombre)} title="Editar">
                    ✏️
                  </button>
                  <button
                    onClick={() => setModalRenombrar(nombre)}
                    title="Renombrar"
                  >
                    📝
                  </button>
                  <button
                    onClick={() => imprimirConvenioFormalDesdeLista(nombre)}
                    title="Imprimir Formal"
                  >
                    🖨️
                  </button>
                  <button
                    onClick={() => imprimirConvenioInternoDesdeLista(nombre)}
                    title="Imprimir Interno"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => setModalEliminar(nombre)}
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditorValores />

      {showPercentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalAumento}>
            <h3>📈 Crear convenio con aumento</h3>
            <div className={styles.modalBody}>
              <label>Convenio origen</label>
              <select
                className={styles.select}
                value={percentSource}
                onChange={(e) => setPercentSource(e.target.value)}
              >
                <option value="">-- Seleccionar --</option>
                {Object.keys(convenios).map((key) => (
                  <option key={key} value={key}>
                    {prettyKey(key)}
                  </option>
                ))}
              </select>

              <div className={styles.porcentajesGrid}>
                <div>
                  <label>% Honorarios</label>
                  <input
                    type="number"
                    step="0.1"
                    className={styles.input}
                    value={porcentajeHonorarios}
                    onChange={(e) => setPorcentajeHonorarios(e.target.value)}
                  />
                </div>
                <div>
                  <label>% Gastos</label>
                  <input
                    type="number"
                    step="0.1"
                    className={styles.input}
                    value={porcentajeGastos}
                    onChange={(e) => setPorcentajeGastos(e.target.value)}
                  />
                </div>
              </div>

              <label>Nombre del nuevo convenio</label>
              <input
                className={styles.input}
                value={newNamePercent}
                onChange={(e) => setNewNamePercent(e.target.value)}
                placeholder="Ej: OCTUBRE_2026_AJUSTADO"
              />

              <p className={styles.hint}>
                Los valores se redondearán a enteros. Conceptos de honorarios:
                Lab, Mod Prep Sangre, FKT, Consulta, Ecografía, ECG.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.btnSecondary}
                onClick={() => setShowPercentModal(false)}
              >
                Cancelar
              </button>
              <button
                className={styles.btnPrimary}
                onClick={confirmarAumentoPorcentaje}
              >
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEliminar && (
        <Modal
          title="Eliminar convenio"
          message={`¿Eliminar "${prettyKey(modalEliminar)}"?`}
          onCancel={() => setModalEliminar(null)}
          onConfirm={confirmarEliminar}
          confirmText="Eliminar"
          confirmClass={styles.btnDanger}
        />
      )}

      {modalRenombrar && (
        <Modal
          title="Renombrar convenio"
          variant="solid"
          message={
            <>
              <p>Nuevo nombre:</p>
              <input
                className={styles.input}
                value={nuevoNombreConvenio}
                onChange={(e) => setNuevoNombreConvenio(e.target.value)}
              />
            </>
          }
          onCancel={() => setModalRenombrar(null)}
          onConfirm={confirmarRenombrar}
          confirmText="Renombrar"
          confirmClass={styles.btnWarning}
        />
      )}
    </div>
  );
}

function Modal({
  title,
  message,
  onCancel,
  onConfirm,
  confirmText,
  confirmClass,
  variant = "default",
}) {
  return (
    <div
      className={`${styles.modalOverlay} ${variant === "solid" ? styles.modalOverlaySolid : ""}`}
    >
      <div
        className={`${styles.modal} ${variant === "solid" ? styles.modalSolid : ""}`}
      >
        <h4>{title}</h4>
        <div className={styles.modalBody}>{message}</div>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
          <button className={confirmClass} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
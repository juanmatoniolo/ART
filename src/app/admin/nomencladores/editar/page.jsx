"use client";

import { useState, useEffect } from "react";
import { ref, set, remove, get, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import styles from "./conveniosAdmin.module.css";

/* =========================
   Utils
   ========================= */
const prettyKey = (k) => k.replace(/_/g, " ");

// Formatea número con puntos de miles (ej. 1234567 -> "1.234.567")
const formatNumber = (num) => {
  if (num === undefined || num === null) return "";
  // Asegurar que sea número entero (redondeado)
  const entero = Math.round(Number(num));
  return entero.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
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

// Convierte string con formato argentino a número
const parseLocaleNumber = (str) => {
  if (typeof str !== "string") return str;
  const cleaned = str.replace(/\./g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? str : num;
};

// Redondea a 2 decimales y asegura que sea número (para edición)
const toNumber = (val) => {
  if (typeof val === 'number') return Math.round(val * 100) / 100;
  if (typeof val === 'string') {
    const parsed = parseLocaleNumber(val);
    if (typeof parsed === 'number') return Math.round(parsed * 100) / 100;
  }
  return 0;
};

// Función recursiva para convertir todo a números (para edición)
const convertirValoresANumero = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(item => convertirValoresANumero(item));
  } else if (obj && typeof obj === 'object') {
    const newObj = {};
    for (const [k, v] of Object.entries(obj)) {
      newObj[k] = convertirValoresANumero(v);
    }
    return newObj;
  } else if (typeof obj === 'string') {
    const parsed = parseLocaleNumber(obj);
    return typeof parsed === 'number' ? Math.round(parsed * 100) / 100 : obj;
  } else if (typeof obj === 'number') {
    return Math.round(obj * 100) / 100;
  } else {
    return obj;
  }
};

// Orden deseado para los valores generales
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
  "ECG_Y_EX_EN_CV"
];

// Conceptos de valores generales que se consideran honorarios (para aumentos)
const conceptosHonorarios = [
  "Laboratorios_NBU",
  "Mod_Prep_Sangre_sin_Transf",
  "Mod_Prep_Sangre_Transf",
  "FKT",
  "FKT_+_MGT",
  "Consulta",
  "Ecografia_partes_blandas_no_moduladas",
  "ECG_Y_EX_EN_CV"
];

// Plantilla base por defecto (usada si no existe OCTUBRE_-_ACTUALIDAD_2026)
const PLANTILLA_BASE = {
  valores_generales: {
    "Gasto_Operatorio": 0,
    "Pension": 0,
    "Gasto_Rx": 0,
    "Galeno_Rx_Practica": 0,
    "Galeno_Quir": 0,
    "Otros_Gastos": 0,
    "Medicación_Valor_Kairos": "-",
    "Curaciones_R": 0,
    "Curaciones_Quemados": 0,
    "Der_Transfusion": 0,
    "Lig_Cruzado_Gastos_Sanatoriales": 0,
    "Artroscopia_Simple_Gastos_Sanatoriales": 0,
    "Artroscopia_Hombro": 0,
    "Laboratorios_NBU": 0,
    "Mod_Prep_Sangre_sin_Transf": 0,
    "Mod_Prep_Sangre_Transf": 0,
    "FKT": 0,
    "FKT_+_MGT": 0,
    "Consulta": 0,
    "Ecografia_partes_blandas_no_moduladas": 0,
    "ECG_Y_EX_EN_CV": 0
  },
  honorarios_medicos: Array.from({ length: 10 }, (_, i) => ({
    Cirujano: 0,
    Ayudante_1: 0,
    Ayudante_2: 0
  }))
};

// Componente input con formato local
const InputNumero = ({ value, onChange }) => {
  const numValue = typeof value === 'number' ? value : 0;
  const [displayValue, setDisplayValue] = useState(() => {
    if (Number.isInteger(numValue)) return numValue.toString();
    return numValue.toFixed(2).replace('.', ',');
  });

  useEffect(() => {
    if (Number.isInteger(numValue)) {
      setDisplayValue(numValue.toString());
    } else {
      setDisplayValue(numValue.toFixed(2).replace('.', ','));
    }
  }, [numValue]);

  const handleBlur = () => {
    const parsed = parseFloat(displayValue.replace(',', '.')) || 0;
    const redondeado = Math.round(parsed * 100) / 100;
    onChange(redondeado);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
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

  const [modalEliminar, setModalEliminar] = useState(null);
  const [modalRenombrar, setModalRenombrar] = useState(null);
  const [nuevoNombreConvenio, setNuevoNombreConvenio] = useState("");

  // Modal de aumento porcentual (con dos porcentajes)
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
      // Usar la plantilla por defecto
      newData = JSON.parse(JSON.stringify(PLANTILLA_BASE));
      setMensaje("ℹ️ No se encontró la plantilla OCTUBRE, se usó la plantilla por defecto.");
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

  /* ===== Confirmar aumento porcentual con dos porcentajes ===== */
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

    // Redondear a entero
    const roundInt = (num) => Math.round(num);

    // Función recursiva para aplicar factor a una rama (objeto o array)
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
          return obj; // strings no numéricos (ej. "-")
        }
      } else {
        return obj;
      }
    };

    // Clonar datos origen
    const newData = JSON.parse(JSON.stringify(sourceData));

    // Aplicar factor a honorarios_medicos (siempre con factorHonorarios)
    if (newData.honorarios_medicos) {
      newData.honorarios_medicos = applyFactorToBranch(newData.honorarios_medicos, factorHonorarios);
    }

    // Separar valores_generales en dos grupos: los que son honorarios y los que son gastos
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

      // Aplicar factores
      const honorariosAplicados = applyFactorToBranch(honorariosGenerales, factorHonorarios);
      const gastosAplicados = applyFactorToBranch(gastosGenerales, factorGastos);

      // Combinar
      newData.valores_generales = { ...gastosAplicados, ...honorariosAplicados };
    }

    const safeName = newNamePercent.trim().replace(/\s+/g, "_");
    await set(ref(db, `convenios/${safeName}`), newData);
    setShowPercentModal(false);
    setMensaje(`✅ Convenio creado: Honorarios ${pHonorarios}%, Gastos ${pGastos}%`);
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Editar (abre el editor visual) ===== */
  const editar = (nombre) => {
    const data = convenios[nombre];
    if (!data) return;
    const dataNormalizada = convertirValoresANumero(JSON.parse(JSON.stringify(data)));
    setActivo(nombre);
    setEditBuffer({
      valores_generales: dataNormalizada.valores_generales || {},
      honorarios_medicos: Array.isArray(dataNormalizada.honorarios_medicos)
        ? dataNormalizada.honorarios_medicos
        : [],
    });
  };

  /* ===== Guardar cambios ===== */
  const guardar = async () => {
    if (!activo) return;
    const refConv = ref(db, `convenios/${activo}`);
    const payload = normalizeKeys(editBuffer);
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

  const imprimirConvenio = () => {
    if (!activo) {
      alert("Seleccioná un convenio para imprimir");
      return;
    }

    const data = editBuffer;
    const nombreConvenio = prettyKey(activo);

    // Ordenar valores generales según la lista
    const generales = data.valores_generales || {};
    const conceptosOrdenados = ordenValoresGenerales.filter(key => generales.hasOwnProperty(key));
    const otrosConceptos = Object.keys(generales).filter(key => !ordenValoresGenerales.includes(key));
    const todosConceptos = [...conceptosOrdenados, ...otrosConceptos];

    // Construir el HTML de la ventana de impresión con formato de miles
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
    <html>
      <head>
        <title>Convenio ${nombreConvenio}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 15px; font-size: 11px; }
          h1 { color: #333; font-size: 16px; }
          h2 { margin-top: 20px; border-bottom: 1px solid #ccc; font-size: 14px; }
          table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
          th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
          th { background-color: #e0e0e0; }
          .valor { text-align: right; }
          .footer { margin-top: 20px; font-size: 0.85em; color: #666; }
          /* Rayado (zebra stripes) */
          tbody tr:nth-child(even) {
            background-color: #f2f2f2;
          }
          tbody tr:nth-child(odd) {
            background-color: #ffffff;
          }
        </style>
      </head>
      <body>
        <h1>Convenio: ${nombreConvenio}</h1>
        <h2>Valores Generales</h2>
        <table>
          <thead>
            <tr><th>Concepto</th><th>Valor</th></tr>
          </thead>
          <tbody>
            ${todosConceptos.map(key => {
              const val = generales[key];
              const valorFormateado = typeof val === 'number' ? formatNumber(val) : val;
              return `
              <tr>
                <td>${prettyKey(key)}</td>
                <td class="valor">${valorFormateado}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
        <h2>Honorarios Médicos por Complejidad</h2>
        <table>
          <thead>
            <tr><th>Nivel</th><th>Cirujano</th><th>Ayudante 1</th><th>Ayudante 2</th></tr>
          </thead>
          <tbody>
            ${data.honorarios_medicos.map((row, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td class="valor">${formatNumber(row.Cirujano)}</td>
                <td class="valor">${formatNumber(row.Ayudante_1)}</td>
                <td class="valor">${formatNumber(row.Ayudante_2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
       
      </body>
    </html>
  `);
    printWindow.document.close();
    printWindow.print();
  };

  // ================== EDITOR VISUAL ==================
  const EditorValores = () => {
    if (!activo) return null;

    const handleGeneralChange = (key, newVal) => {
      setEditBuffer(prev => ({
        ...prev,
        valores_generales: {
          ...prev.valores_generales,
          [key]: newVal
        }
      }));
    };

    const handleAddGeneral = () => {
      const newKey = prompt("Ingresá el nombre del nuevo concepto (ej: 'Consulta_Guardia'):");
      if (!newKey) return;
      const safeKey = newKey.trim().replace(/\s+/g, "_");
      setEditBuffer(prev => ({
        ...prev,
        valores_generales: {
          ...prev.valores_generales,
          [safeKey]: 0
        }
      }));
    };

    const handleDeleteGeneral = (key) => {
      if (!confirm(`¿Eliminar el concepto "${prettyKey(key)}"?`)) return;
      const newGenerales = { ...editBuffer.valores_generales };
      delete newGenerales[key];
      setEditBuffer(prev => ({
        ...prev,
        valores_generales: newGenerales
      }));
    };

    // Obtener lista de conceptos existentes, pero ordenados según el orden deseado
    const conceptosExistentes = Object.keys(editBuffer.valores_generales || {});
    const conceptosOrdenados = ordenValoresGenerales.filter(key => conceptosExistentes.includes(key));
    const otrosConceptos = conceptosExistentes.filter(key => !ordenValoresGenerales.includes(key));
    const todosConceptos = [...conceptosOrdenados, ...otrosConceptos];

    // Honorarios: solo se edita Cirujano
const handleCirujanoChange = (index, newVal) => {
  const redondeado = newVal;
  const newHonorarios = [...editBuffer.honorarios_medicos];
  newHonorarios[index] = {
    Cirujano: redondeado,
    Ayudante_1: Math.round(redondeado * 0.3 * 100) / 100,
    Ayudante_2: index >= 3 ? Math.round(redondeado * 0.2 * 100) / 100 : 0, // a partir del nivel 4 (índice 3) hay 2 ayudantes
  };
  setEditBuffer(prev => ({
    ...prev,
    honorarios_medicos: newHonorarios
  }));
};

    const handleAddHonorario = () => {
      setEditBuffer(prev => ({
        ...prev,
        honorarios_medicos: [
          ...prev.honorarios_medicos,
          { Cirujano: 0, Ayudante_1: 0, Ayudante_2: 0 }
        ]
      }));
    };

    const handleDeleteHonorario = (index) => {
      if (!confirm(`¿Eliminar la fila de honorarios ${index + 1}?`)) return;
      const newHonorarios = editBuffer.honorarios_medicos.filter((_, i) => i !== index);
      setEditBuffer(prev => ({
        ...prev,
        honorarios_medicos: newHonorarios
      }));
    };

    return (
      <div className={styles.editorCard}>
        <div className={styles.editorHeader}>
          <h4>✏️ Editando: {prettyKey(activo)}</h4>
          <button className={styles.btnSecondary} onClick={imprimirConvenio}>
            🖨️ Imprimir
          </button>
        </div>

        {/* Valores Generales ordenados */}
        <div className={styles.editorSection}>
          <h5>📋 Valores Generales</h5>
          <table className={styles.editTable}>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Valor</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {todosConceptos.map((key) => (
                <tr key={key}>
                  <td>{prettyKey(key)}</td>
                  <td>
                    <InputNumero
                      value={toNumber(editBuffer.valores_generales[key])}
                      onChange={(newVal) => handleGeneralChange(key, newVal)}
                    />
                  </td>
                  <td>
                    <button
                      className={styles.btnDangerSmall}
                      onClick={() => handleDeleteGeneral(key)}
                      onMouseDown={(e) => e.preventDefault()}
                      tabIndex={-1}
                      title="Eliminar concepto"
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

        {/* Honorarios Médicos */}
        <div className={styles.editorSection}>
          <h5>👨‍⚕️ Honorarios Médicos (por complejidad)</h5>
          <p className={styles.hint}>Ayudante 1 = 30% del Cirujano, Ayudante 2 = 20% del Cirujano (cada uno). Para complejidades menores a 4, el segundo ayudante no se utiliza (queda en 0).</p>
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
                      onChange={(val) => handleCirujanoChange(index, val)}
                    />
                  </td>
                  <td>
                    <button
                      className={styles.btnDangerSmall}
                      onClick={() => handleDeleteHonorario(index)}
                      onMouseDown={(e) => e.preventDefault()}
                      tabIndex={-1}
                      title="Eliminar fila"
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className={styles.btnSecondary} onClick={handleAddHonorario}>
            ➕ Agregar nuevo nivel de complejidad
          </button>
        </div>

        {/* Vista JSON (opcional) */}
        <details className={styles.jsonDetails}>
          <summary>🔍 Ver JSON completo</summary>
          <pre style={{ fontSize: 12, opacity: 0.8, maxHeight: '300px', overflow: 'auto' }}>
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

      {/* Crear desde plantilla */}
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

      {/* Botón de aumento porcentual */}
      <div className={styles.buttonRow}>
        <button className={styles.btnSecondary} onClick={abrirModalPorcentaje}>
          📈 Aumentar / Reducir % desde existente
        </button>
      </div>

      {/* Tabla de convenios */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Convenio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(convenios).map(([nombre, data]) => (
              <tr key={nombre}>
                <td>{prettyKey(nombre)}</td>
                <td>
                  {Object.keys(data.valores_generales || {}).length
                    ? "🟢 Cargado"
                    : "🟡 Sin datos"}
                </td>
                <td className={styles.actions}>
                  <button onClick={() => editar(nombre)}>✏️</button>
                  <button onClick={() => setModalRenombrar(nombre)}>📝</button>
                  <button onClick={() => setModalEliminar(nombre)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Editor visual */}
      <EditorValores />

      {/* Modal de aumento porcentual (rediseñado) */}
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
                Los valores se redondearán a números enteros. Usá valores negativos para reducir.
                Los conceptos de Laboratorio, Mod Prep Sangre, FKT, Consulta, Ecografía y ECG se consideran honorarios.
              </p>
            </div>
            <div className={styles.modalActions}>
              <button className={styles.btnSecondary} onClick={() => setShowPercentModal(false)}>
                Cancelar
              </button>
              <button className={styles.btnPrimary} onClick={confirmarAumentoPorcentaje}>
                Crear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modales Eliminar / Renombrar */}
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

/* =========================
   Modal reutilizable
   ========================= */
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
      className={`${styles.modalOverlay} ${variant === "solid" ? styles.modalOverlaySolid : ""
        }`}
    >
      <div
        className={`${styles.modal} ${variant === "solid" ? styles.modalSolid : ""
          }`}
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
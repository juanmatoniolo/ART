'use client';
import { useState, useEffect, useMemo, useId } from 'react';
import * as XLSX from 'xlsx';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from './facturacionClinica.module.css';

// === CONSTANTES Y DATOS ===

// Valores constantes del Excel (de la hoja CODIGOS-INTERNOS)
const VALORES_CONSTANTES = {
  GALENO_QX: 1435.5,
  GASTOS_OPERATORIOS: 3281,
  GASTOS_RX: 1648,
  GALENO_RX: 1411,
  PENSION: 2838
};

// Categorías de prácticas para filtrado
const CATEGORIAS_PRACTICAS = [
  { value: 'todas', label: 'Todas las categorías' },
  { value: 'consulta', label: 'Consulta' },
  { value: 'curacion', label: 'Curación' },
  { value: 'quirurgica', label: 'Quirúrgica' },
  { value: 'procedimiento', label: 'Procedimiento' },
  { value: 'estudio', label: 'Estudio' },
  { value: 'pension', label: 'Pensión' },
  { value: 'insumo', label: 'Insumos/Descartables' },
  { value: 'rx', label: 'Radiología (RX)' }
];

// Base de datos completa de prácticas médicas (similar a CODIGOS-INTERNOS)
const PRACTICAS_COMPLETAS = [
  // CONSULTAS
  { id: 11, tipo: 'consulta', categoria: 'consulta', codInt: '11', practica: 'CONSULTA EN GUARDIA', codigo: '42.01.01', gal: '', honMedico: '34650', gto: '', gtoSanatorial: '', formula: 'directo' },
  { id: 12, tipo: 'consulta', categoria: 'consulta', codInt: '12', practica: 'CONSULTA', codigo: '42.01.01', gal: '', honMedico: '34650', gto: '', gtoSanatorial: '', formula: 'directo' },
  
  // CURACIONES
  { id: 3, tipo: 'curacion', categoria: 'curacion', codInt: '3', practica: 'CURACIÓN', codigo: '43.02.01', gal: '', honMedico: '-', gto: '', gtoSanatorial: '8820', formula: 'directo' },
  
  // QUIRÚRGICAS
  { id: 4, tipo: 'quirurgica', categoria: 'quirurgica', codInt: '4', practica: 'SUTURA', codigo: '13.01.10', gal: '30', honMedico: '43065', gto: '45', gtoSanatorial: '147645', formula: 'directo' },
  { id: 84, tipo: 'quirurgica', categoria: 'quirurgica', codInt: '83', practica: 'INTERVENCION QUIR.', codigo: '43.11.01', gal: '0', honMedico: '-', gto: '8', gtoSanatorial: '22704', formula: 'directo' },
  { id: 8, tipo: 'quirurgica', categoria: 'quirurgica', codInt: '', practica: 'ARTROSCOPIA SIMPLE', codigo: 'XX.06.03 12.09.02', gal: '', honMedico: '1232000', gto: '', gtoSanatorial: '900000', formula: 'directo' },
  { id: 9, tipo: 'quirurgica', categoria: 'quirurgica', codInt: '', practica: 'ARTROSCOPIA COMPLEJA', codigo: 'XX.07.03 12.09.02', gal: '', honMedico: '1361250', gto: '', gtoSanatorial: '1123200', formula: 'directo' },
  
  // PROCEDIMIENTOS
  { id: 5, tipo: 'procedimiento', categoria: 'procedimiento', codInt: '5', practica: 'INFILTRACIÓN', codigo: '12.18.01', gal: '9', honMedico: 'VER AOTER', gto: '7', gtoSanatorial: '22967', formula: 'directo' },
  
  // ESTUDIOS
  { id: 6, tipo: 'estudio', categoria: 'estudio', codInt: '6', practica: 'ECOGRAFIA PARTES BLAN (MODULADAS)', codigo: '18.06.01', gal: '', honMedico: '42000', gto: '', gtoSanatorial: '-', formula: 'directo' },
  { id: 7, tipo: 'estudio', categoria: 'estudio', codInt: '7', practica: 'ELECTRO ECG', codigo: '17.01.01 42.03.03', gal: '', honMedico: '63690', gto: '', gtoSanatorial: '-', formula: 'directo' },
  
  // PENSION
  { id: 81, tipo: 'pension', categoria: 'pension', codInt: '81', practica: 'DÍA DE PENSION', codigo: '43.01.01', gal: '0', honMedico: '-', gto: '57', gtoSanatorial: '161766', formula: 'pension' },
  
  // INSUMOS
  { id: 83, tipo: 'insumo', categoria: 'insumo', codInt: '83', practica: 'DESCARTABLES', codigo: '43.10.01', gal: '', honMedico: '', gto: '5', gtoSanatorial: '14190', formula: 'directo' },
  
  // RX - Con fórmula especial
  { id: 201, tipo: 'rx', categoria: 'rx', codInt: '201', practica: 'CRANEO MNO, SPN, CARA (FRENTE)', codigo: '34.02.01', gal: '6.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 202, tipo: 'rx', categoria: 'rx', codInt: '202', practica: 'CRANEO MNO, SPN, CARA (PERFIL)', codigo: '34.02.02', gal: '2.25', honMedico: 'CALCULADO', gto: '20.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 204, tipo: 'rx', categoria: 'rx', codInt: '204', practica: 'ART TEMPOROMANDIBULAR', codigo: '34.02.04', gal: '9.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 207, tipo: 'rx', categoria: 'rx', codInt: '207', practica: 'CRANEO ODONTOLOGICO', codigo: '34.02.07', gal: '5.25', honMedico: 'CALCULADO', gto: '60.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 209, tipo: 'rx', categoria: 'rx', codInt: '209', practica: 'COLUMNA (FRENTE)', codigo: '34.02.09', gal: '6.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 210, tipo: 'rx', categoria: 'rx', codInt: '210', practica: 'COLUMNA (PERFIL)', codigo: '34.02.10', gal: '2.25', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 211, tipo: 'rx', categoria: 'rx', codInt: '211', practica: 'HOBRO, HUMERO, PELVIS, FEMUR, CADERA (FRENTE)', codigo: '34.02.11', gal: '6.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 212, tipo: 'rx', categoria: 'rx', codInt: '212', practica: 'HOBRO, HUMERO, PELVIS, FEMUR, CADERA (PERFIL)', codigo: '34.02.12', gal: '2.25', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 213, tipo: 'rx', categoria: 'rx', codInt: '213', practica: 'CODO, MANO, MUÑECA, DEDOS, RODILLA, TOBILLO (FRENTE Y PERFIL)', codigo: '34.02.13', gal: '6.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340301, tipo: 'rx', categoria: 'rx', codInt: '340301', practica: 'TORAX, PARRILLA COSTAL (FRENTE)', codigo: '34.03.01', gal: '6.75', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340302, tipo: 'rx', categoria: 'rx', codInt: '340302', practica: 'TORAX, PARRILLA COSTAL (PERFIL)', codigo: '34.03.02', gal: '2.25', honMedico: 'CALCULADO', gto: '21.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340418, tipo: 'rx', categoria: 'rx', codInt: '340418', practica: 'COLANGIO POST-OP', codigo: '34.04.18', gal: '9.75', honMedico: 'CALCULADO', gto: '60.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340421, tipo: 'rx', categoria: 'rx', codInt: '340421', practica: 'ABDOMEN (FRENTE)', codigo: '34.04.21', gal: '5.25', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340422, tipo: 'rx', categoria: 'rx', codInt: '340422', practica: 'ABDOMEN (PERFIL)', codigo: '34.04.22', gal: '2.25', honMedico: 'CALCULADO', gto: '20.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340501, tipo: 'rx', categoria: 'rx', codInt: '340501', practica: 'ARBOL URINARIO SIMPLE', codigo: '34.05.01', gal: '5.25', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
];

// Convenios disponibles
const CONVENIOS_OPCIONES = [
  { key: 'ART', label: 'ART' },
  { key: 'IAPS', label: 'IAPS' },
  { key: 'OSDE', label: 'OSDE' },
  { key: 'SWISS', label: 'SWISS MEDICAL' },
  { key: 'GALENO', label: 'GALENO' },
  { key: 'PARTICULAR', label: 'PARTICULAR' }
];

// Médicos disponibles
const MEDICOS_OPCIONES = [
  { id: 'dr_fresco', nombre: 'DR FRESCO' },
  { id: 'dr_cianciosi', nombre: 'DR CIANCIOSI' },
  { id: 'dr_general', nombre: 'MÉDICO GENERAL' },
  { id: 'sin_medico', nombre: 'SIN MÉDICO ASIGNADO' }
];

// Función money mejorada
const money = (n) => {
  if (n == null || n === '' || n === '-' || n === 'CALCULADO') return '-';

  if (typeof n === 'number') {
    return n.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  const str = String(n).trim();

  if (str.includes('.') && str.includes(',')) {
    const sinPuntosMiles = str.replace(/\.(?=\d{3})/g, '');
    const conPuntoDecimal = sinPuntosMiles.replace(',', '.');
    const num = parseFloat(conPuntoDecimal);
    return Number.isNaN(num) ? str : num.toLocaleString('es-AR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  if (str.includes(',')) {
    const partes = str.split(',');
    if (partes.length === 2) {
      const despuesComa = partes[1];
      if (despuesComa.length <= 2) {
        const num = parseFloat(str.replace(',', '.'));
        return Number.isNaN(num) ? str : num.toLocaleString('es-AR', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      }
    }
    const sinComas = str.replace(/,/g, '');
    const num = parseFloat(sinComas);
    return Number.isNaN(num) ? str : num.toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  if (str.includes('.')) {
    const sinPuntos = str.replace(/\./g, '');
    const num = parseFloat(sinPuntos);
    return Number.isNaN(num) ? str : num.toLocaleString('es-AR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    });
  }

  const num = parseFloat(str);
  return Number.isNaN(num) ? str : num.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Datos de laboratorio hardcodeados (en lugar de cargarlos desde archivo)
const LABORATORIOS_HARDCODEADOS = [
  { codigo: '1', practica_bioquimica: 'ACTO BIOQUÍMICO.', unidad_bioquimica: 3 },
  { codigo: '2', practica_bioquimica: 'ACETONURIA.', unidad_bioquimica: 1 },
  { codigo: '4', practica_bioquimica: 'ACIDIMETRIA GASTRICA, CURVA DE', unidad_bioquimica: 3 },
  { codigo: '13', practica_bioquimica: 'AGLUTININAS Anti-RH.', unidad_bioquimica: 0 },
  { codigo: '14', practica_bioquimica: 'AGLUTININAS del SISTEMAS ABO.', unidad_bioquimica: 3 },
  { codigo: '15', practica_bioquimica: 'ALBUMINA.', unidad_bioquimica: 1.5 },
  { codigo: '16', practica_bioquimica: 'ALCOHOL DEHIDROGENASA, ADH.', unidad_bioquimica: 10 },
  { codigo: '17', practica_bioquimica: 'ALCOHOLEMIA.', unidad_bioquimica: 10 },
  { codigo: '18', practica_bioquimica: 'ALDOLASA.', unidad_bioquimica: 6 },
  { codigo: '19', practica_bioquimica: 'ALDOSTERONA.', unidad_bioquimica: 15 },
  { codigo: '20', practica_bioquimica: 'ALFA FETO PROTEINA.', unidad_bioquimica: 10 },
  { codigo: '22', practica_bioquimica: 'AMILASA - sérica.', unidad_bioquimica: 4 },
  { codigo: '23', practica_bioquimica: 'AMILASA - urinaria.', unidad_bioquimica: 4 },
  { codigo: '25', practica_bioquimica: 'AMINOACIDOS FRACCIONADOS', unidad_bioquimica: 12.5 },
  { codigo: '27', practica_bioquimica: 'AMINOACIDURIA FRACCIONADA', unidad_bioquimica: 12.5 },
  { codigo: '28', practica_bioquimica: 'AMNIOTICO, LIQUIDO CELULAS NARANJAS.', unidad_bioquimica: 1 },
  { codigo: '29', practica_bioquimica: 'AMNIOTICO, LIQUIDO ESPECTROFOTOMETRIA', unidad_bioquimica: 5 },
  { codigo: '30', practica_bioquimica: 'AMNIOTICO, LIQUIDO LECITINA - ESFINGOMIELINA.', unidad_bioquimica: 5 },
  { codigo: '31', practica_bioquimica: 'AMONEMIA.', unidad_bioquimica: 20 },
  { codigo: '32', practica_bioquimica: 'AMP CICLICO.', unidad_bioquimica: 15 },
  { codigo: '33', practica_bioquimica: 'ANGIOTENSINA.', unidad_bioquimica: 15 },
  { codigo: '34', practica_bioquimica: 'ANHIDRASA CARBONICA B, ERITROCITARIA.', unidad_bioquimica: 2 },
  { codigo: '35', practica_bioquimica: 'ANTIBIOGRAMA.', unidad_bioquimica: 4 },
  { codigo: '36', practica_bioquimica: 'ANTIBIOGRAMA BACILO DE KOCH (7)', unidad_bioquimica: 60 },
  { codigo: '40', practica_bioquimica: 'ANTICUERPOS ANTIGLOMERULAR (IFI)', unidad_bioquimica: 6 },
  { codigo: '41', practica_bioquimica: 'ANTICUERPOS ANTIMENBRANA BASAL (IFI)', unidad_bioquimica: 6 },
  { codigo: '42', practica_bioquimica: 'ANTICUERPO ANTIMUSCULO LISO (IFI)', unidad_bioquimica: 7 },
  { codigo: '43', practica_bioquimica: 'ANTICUERPOS CONTRA CEPA BACTERIANA AISLADA.', unidad_bioquimica: 3 },
  { codigo: '44', practica_bioquimica: 'ANTICUERPOS ANTIFRACCION MICROSOMAL DE TIROIDES (IFI)', unidad_bioquimica: 6 },
  { codigo: '46', practica_bioquimica: 'ANTICUERPOS ANTITIROGLOBULINA.', unidad_bioquimica: 6 },
  { codigo: '49', practica_bioquimica: 'ANTIDESIXIRRIBONUCLEASA - ADNEASA – Anti-DNA.', unidad_bioquimica: 9 },
  { codigo: '50', practica_bioquimica: 'ANTIESTAFILOLISINA.', unidad_bioquimica: 3 },
  { codigo: '51', practica_bioquimica: 'ANTIESTREPTOLISINAS "O" (ASTO - AELO)', unidad_bioquimica: 4 },
  { codigo: '52', practica_bioquimica: 'ANTIESTREPTOQUINASA.', unidad_bioquimica: 3 },
  { codigo: '54', practica_bioquimica: 'ANTIHIALURONIDASA.', unidad_bioquimica: 4 },
  { codigo: '55', practica_bioquimica: 'ANTIMITOCONDRIALES, ANTICUERPOS.', unidad_bioquimica: 7 },
  { codigo: '56', practica_bioquimica: 'ANTINUCLEARES ANTICUERPOS - FAN', unidad_bioquimica: 7 },
  { codigo: '57', practica_bioquimica: 'ANTITRIPSINA, Alfa 1', unidad_bioquimica: 10 },
  { codigo: '58', practica_bioquimica: 'ANTITROMBINA III', unidad_bioquimica: 15 },
  { codigo: '59', practica_bioquimica: 'ARSENICO.', unidad_bioquimica: 15 },
  { codigo: '60', practica_bioquimica: 'ASCORBICO, ACIDO.', unidad_bioquimica: 18 },
  { codigo: '61', practica_bioquimica: 'AUTOVACUNA.', unidad_bioquimica: 5 },
  { codigo: '63', practica_bioquimica: 'ANTICUERPOS Anti-HIV (ELISA)', unidad_bioquimica: 11 },
  { codigo: '64', practica_bioquimica: 'ANTICUERPOS Anti-HIV (A.D.)', unidad_bioquimica: 11 },
  { codigo: '101', practica_bioquimica: 'BACILOSCOPIA DIRECTA - ZIEHL NEELSEN', unidad_bioquimica: 2 },
  { codigo: '102', practica_bioquimica: 'BACILOSCOPIA, DIRECTA y CULTIVO', unidad_bioquimica: 8 },
  { codigo: '103', practica_bioquimica: 'BACILOSCOPIA (IFI)', unidad_bioquimica: 10 },
  { codigo: '104', practica_bioquimica: 'BACTERIOLOGIA, DIRECTA (Coloración de Gram)', unidad_bioquimica: 2 },
  { codigo: '105', practica_bioquimica: 'BACTERIOLOGICO, DIRECTO-CULTIVO e IDENTIFICACIÓN', unidad_bioquimica: 5 },
  { codigo: '107', practica_bioquimica: 'BARBITURICOS - urinarios.', unidad_bioquimica: 12 },
  { codigo: '108', practica_bioquimica: 'BENCE-JONES, PROTEINAS DE', unidad_bioquimica: 3 },
  { codigo: '109', practica_bioquimica: 'BICARBONATO.', unidad_bioquimica: 0 },
  { codigo: '110', practica_bioquimica: 'BILIRRUBINEMIA TOTAL, DIRECTA E INDIRECTA.', unidad_bioquimica: 1.5 },
  { codigo: '111', practica_bioquimica: 'BILIRRUBINURIA.', unidad_bioquimica: 1.5 },
  { codigo: '131', practica_bioquimica: 'CADENA LIVIANA KAPPA Y LAMBDA', unidad_bioquimica: 40 },
  { codigo: '132', practica_bioquimica: 'CADMIO - urinario.', unidad_bioquimica: 12 },
  { codigo: '133', practica_bioquimica: 'CALCEMIA TOTAL.', unidad_bioquimica: 1.5 },
  { codigo: '134', practica_bioquimica: 'CALCIO IONICO.', unidad_bioquimica: 4 },
  { codigo: '135', practica_bioquimica: 'CALCIO PRUEBA DE LA SOBRECARGA.', unidad_bioquimica: 5 },
  { codigo: '136', practica_bioquimica: 'CALCIURIA.', unidad_bioquimica: 2 },
  { codigo: '137', practica_bioquimica: 'CALCITONINA - sérica.', unidad_bioquimica: 16 },
  { codigo: '138', practica_bioquimica: 'CALCULO - urinario.', unidad_bioquimica: 8 },
  { codigo: '139', practica_bioquimica: 'CARBONICO, ANDHIDRICO - (PCO2)', unidad_bioquimica: 0 },
  { codigo: '140', practica_bioquimica: 'CARIOTIPO, MAPA CROMOSOMICO.', unidad_bioquimica: 37 },
  { codigo: '141', practica_bioquimica: 'CAROTENO BETA - sérico.', unidad_bioquimica: 15 },
  { codigo: '143', practica_bioquimica: 'CATECOLAMINAS, LIBRES - FRACCIONADAS.', unidad_bioquimica: 25 },
  { codigo: '144', practica_bioquimica: 'CEA - ANTÍGENO CARCINOEMBRIOGENICO', unidad_bioquimica: 12.5 },
  { codigo: '148', practica_bioquimica: 'CELULAS NEOPLASICAS - líquidos, exudados, trasudados.', unidad_bioquimica: 9 },
  { codigo: '150', practica_bioquimica: 'CEREBROSIDOS (Cromatográfico).', unidad_bioquimica: 0 },
  { codigo: '151', practica_bioquimica: 'CERULOPLASMINA.', unidad_bioquimica: 6 },
  { codigo: '152', practica_bioquimica: 'CETOGENOESTEROIDES - urinarios.', unidad_bioquimica: 5 },
  { codigo: '154', practica_bioquimica: 'CETONEMIA.', unidad_bioquimica: 1.5 },
  { codigo: '157', practica_bioquimica: '17- CETOESTEROIDES NEUTROS TOTALES', unidad_bioquimica: 5 },
  { codigo: '158', practica_bioquimica: '17 CETOESTER., PRUEBA/Rta. A LA ESTIMULACION CON ACTH', unidad_bioquimica: 5 },
  { codigo: '159', practica_bioquimica: '17 CETOESTER., PRUEBA/Rta. A LA INHIBIC. CON DEXAMETASONA', unidad_bioquimica: 5 },
  { codigo: '160', practica_bioquimica: '17 CETOESTER., PRUEBA/Rta. A LA INHIB. Y ESTIMUL.', unidad_bioquimica: 5 },
];

// Datos de convenios hardcodeados (ejemplo básico)
const CONVENIOS_HARDCODEADOS = {
  "IAPS Junio-Septiembre": {
    valores_generales: {
      "Galeno_Rx_Practica": 1176,
      "Galeno_Rx_y_Practica": 1176,
      "Gasto_Operatorio": 3281,
      "Gasto_Rx": 1373,
      "Consulta": 34650,
      "PENSION": 2838,
      "Unidad_Bioquimica": 1224.11
    }
  },
  "IAPS Octubre-Actualidad": {
    valores_generales: {
      "Galeno_Rx_Practica": 1411,
      "Galeno_Rx_y_Practica": 1411,
      "Gasto_Operatorio": 3281,
      "Gasto_Rx": 1648,
      "Consulta": 34650,
      "PENSION": 2838,
      "Unidad_Bioquimica": 1573
    }
  },
  "ART Junio-Septiembre": {
    valores_generales: {
      "Galeno_Rx_Practica": 1430,
      "Galeno_Rx_y_Practica": 1430,
      "Gasto_Operatorio": 3281,
      "Gasto_Rx": 1373,
      "Consulta": 34650,
      "PENSION": 2838,
      "Unidad_Bioquimica": 1224.11
    }
  }
};

// === COMPONENTE PRINCIPAL ===
export default function FacturacionClinica() {
  // === ESTADOS PRINCIPALES ===
  const [convenioTipo, setConvenioTipo] = useState('');
  const [convenioPeriodo, setConvenioPeriodo] = useState('');
  const [convenioData, setConvenioData] = useState(null);
  const [todosConvenios, setTodosConvenios] = useState(CONVENIOS_HARDCODEADOS);
  const [conveniosFiltrados, setConveniosFiltrados] = useState([]);

  const [paciente, setPaciente] = useState({
    apellido: '',
    nombre: '',
    artSeguro: '',
    nroSiniestro: '',  // STRO del Excel
    dni: '',
    fechaAtencion: new Date().toISOString().split('T')[0],
    medicoAsignado: '',
    prestador: 'IAPSER', // Default como en Excel
    totalSiniestro: 0 // TOTAL STRO
  });

  const [practicasAgregadas, setPracticasAgregadas] = useState([]);
  const [laboratoriosAgregados, setLaboratoriosAgregados] = useState([]);
  const [medicamentosAgregados, setMedicamentosAgregados] = useState([]);
  const [filtroPracticas, setFiltroPracticas] = useState('');
  const [filtroLaboratorios, setFiltroLaboratorios] = useState('');
  const [filtroMedicamentos, setFiltroMedicamentos] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas');
  const [presupuestos, setPresupuestos] = useState([]);
  const [activeTab, setActiveTab] = useState('convenio');

  // Datos externos
  const [nomencladorBioquimica, setNomencladorBioquimica] = useState({
    practicas: LABORATORIOS_HARDCODEADOS,
    metadata: {
      unidad_bioquimica_valor_referencia: 1224.11
    }
  });
  const [medicamentosDB, setMedicamentosDB] = useState([]);
  const [descartablesDB, setDescartablesDB] = useState([]);
  const [loading, setLoading] = useState({
    bioquimica: false,
    medicamentos: true
  });

  // Generar IDs únicos
  const uniqueId = useId();

  // === EFECTOS ===

  // Cargar todos los datos (versión simplificada)
  useEffect(() => {
    const cargarTodosDatos = async () => {
      try {
        // 1. Usar convenios hardcodeados
        setTodosConvenios(CONVENIOS_HARDCODEADOS);
        
        // 2. Usar laboratorios hardcodeados
        setNomencladorBioquimica({
          practicas: LABORATORIOS_HARDCODEADOS,
          metadata: {
            unidad_bioquimica_valor_referencia: 1224.11
          }
        });
        
        // 3. Cargar presupuestos guardados
        const guardados = localStorage.getItem('presupuestosClinica');
        if (guardados) {
          try {
            setPresupuestos(JSON.parse(guardados));
          } catch (e) {
            console.log('Error al parsear presupuestos:', e);
            localStorage.setItem('presupuestosClinica', JSON.stringify([]));
          }
        } else {
          localStorage.setItem('presupuestosClinica', JSON.stringify([]));
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
        // Fallback a datos hardcodeados
        setTodosConvenios(CONVENIOS_HARDCODEADOS);
        setNomencladorBioquimica({
          practicas: LABORATORIOS_HARDCODEADOS,
          metadata: {
            unidad_bioquimica_valor_referencia: 1224.11
          }
        });
      }
    };

    cargarTodosDatos();
  }, []);

  // Cargar medicamentos de Firebase (mantener como está)
  useEffect(() => {
    const cargarMedicamentos = () => {
      setLoading(prev => ({ ...prev, medicamentos: true }));

      try {
        const medicamentosRef = ref(db, 'medydescartables/medicamentos');
        const descartablesRef = ref(db, 'medydescartables/descartables');

        const unsubscribeMed = onValue(medicamentosRef, (snap) => {
          if (snap.exists()) {
            const data = snap.val();
            const lista = Object.entries(data).map(([key, item]) => ({
              id: key,
              nombre: item.nombre || key,
              precio: item.precioReferencia || item.precio || 0,
              presentacion: item.presentacion || 'unidad',
              tipo: 'medicamento'
            }));
            setMedicamentosDB(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
          } else {
            // Datos de ejemplo si Firebase falla
            setMedicamentosDB([
              { id: '1', nombre: 'IODOPOVIDONA', precio: 12000, presentacion: 'FCO', tipo: 'medicamento' },
              { id: '2', nombre: 'AGUA OXIGENADA', precio: 1130, presentacion: 'FCO', tipo: 'medicamento' },
              { id: '3', nombre: 'DICLOFENAX', precio: 4750, presentacion: 'AMP', tipo: 'medicamento' },
              { id: '4', nombre: 'DEXAMETASONA', precio: 12450, presentacion: 'AMP', tipo: 'medicamento' },
              { id: '5', nombre: 'BETAMETASONA', precio: 9990, presentacion: 'AMP', tipo: 'medicamento' },
              { id: '6', nombre: 'XILOCAINA 2%', precio: 1690, presentacion: 'AMP', tipo: 'medicamento' },
            ]);
          }
        });

        const unsubscribeDesc = onValue(descartablesRef, (snap) => {
          if (snap.exists()) {
            const data = snap.val();
            const lista = Object.entries(data).map(([key, item]) => ({
              id: key,
              nombre: item.nombre || key,
              precio: item.precioReferencia || item.precio || 0,
              presentacion: item.presentacion || 'unidad',
              tipo: 'descartable'
            }));
            setDescartablesDB(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
          } else {
            // Datos de ejemplo si Firebase falla
            setDescartablesDB([
              { id: '1', nombre: 'GASAS ESTERILES', precio: 1000, presentacion: 'DESC', tipo: 'descartable' },
              { id: '2', nombre: 'VENDAS CAMBRIC 10 CM', precio: 2100, presentacion: 'DESC', tipo: 'descartable' },
              { id: '3', nombre: 'CINTA HP', precio: 6877, presentacion: 'DESC', tipo: 'descartable' },
              { id: '4', nombre: 'ABOCATH N20', precio: 4500, presentacion: 'DESC', tipo: 'descartable' },
              { id: '5', nombre: 'JERINGAS 10 CC', precio: 1300, presentacion: 'DESC', tipo: 'descartable' },
              { id: '6', nombre: 'MONONYLON 3/0', precio: 25100, presentacion: 'DESC', tipo: 'descartable' },
            ]);
          }
        });

        setLoading(prev => ({ ...prev, medicamentos: false }));

        return () => {
          unsubscribeMed();
          unsubscribeDesc();
        };
      } catch (error) {
        console.error('Error cargando medicamentos:', error);
        setLoading(prev => ({ ...prev, medicamentos: false }));
        // Datos de ejemplo
        setMedicamentosDB([
          { id: '1', nombre: 'IODOPOVIDONA', precio: 12000, presentacion: 'FCO', tipo: 'medicamento' },
          { id: '2', nombre: 'AGUA OXIGENADA', precio: 1130, presentacion: 'FCO', tipo: 'medicamento' },
        ]);
        setDescartablesDB([
          { id: '1', nombre: 'GASAS ESTERILES', precio: 1000, presentacion: 'DESC', tipo: 'descartable' },
          { id: '2', nombre: 'VENDAS CAMBRIC 10 CM', precio: 2100, presentacion: 'DESC', tipo: 'descartable' },
        ]);
      }
    };

    cargarMedicamentos();
  }, []);

  // Filtrar convenios
  useEffect(() => {
    if (!convenioTipo || !todosConvenios) {
      setConveniosFiltrados([]);
      return;
    }

    const filtrados = Object.keys(todosConvenios)
      .filter(key => key.toLowerCase().includes(convenioTipo.toLowerCase()))
      .map(key => ({
        key,
        label: key,
        periodo: key.includes('Junio-Sept') ? 'Junio-Septiembre' :
          key.includes('Octubre-Actualidad') ? 'Octubre-Actualidad' :
            key.includes('Febrero-Mayo') ? 'Febrero-Mayo' :
              key.includes('Junio-Septiembre') ? 'Junio-Septiembre' : key
      }));

    setConveniosFiltrados(filtrados);

    if (filtrados.length === 1) {
      setConvenioPeriodo(filtrados[0].key);
      cargarConvenioEspecifico(filtrados[0].key);
    } else {
      setConvenioPeriodo('');
      setConvenioData(null);
    }
  }, [convenioTipo, todosConvenios]);

  // === FUNCIONES PRINCIPALES ===

  // Cargar convenio específico
  const cargarConvenioEspecifico = (convenioKey) => {
    if (!convenioKey || !todosConvenios[convenioKey]) {
      setConvenioData(null);
      return;
    }

    const convenio = todosConvenios[convenioKey];
    const valoresGenerales = convenio.valores_generales || {};

    // Obtener valor UB del convenio
    const keysPosibles = [
      'Laboratorios_NBU_T',
      'Laboratorios_NBU',
      'Laboratorios NBU T',
      'Laboratorios NBU',
      'UB',
      'Unidad_Bioquimica',
      'Unidad Bioquimica',
      'Unidad_Bioquimica'
    ];

    let valorUB = 1224.11; // Valor por defecto
    for (const k of keysPosibles) {
      if (valoresGenerales[k] != null) {
        valorUB = valoresGenerales[k];
        break;
      }
    }

    setConvenioData({
      ...convenio,
      valores_generales: valoresGenerales,
      unidad_bioquimica: valorUB,
      key: convenioKey
    });
    setConvenioPeriodo(convenioKey);
  };

  // Calcular valores RX según fórmula del Excel
  const calcularValoresRX = (practica) => {
    if (!convenioData || practica.formula !== 'rx') {
      return { honMedico: 0, gtoSanatorial: 0, formula: '' };
    }

    // Valores del convenio o valores por defecto del Excel
    const galenoRx = convenioData.valores_generales?.Galeno_Rx_Practica ||
      convenioData.valores_generales?.Galeno_Rx_y_Practica ||
      VALORES_CONSTANTES.GALENO_RX; // 1411 del Excel
    
    const gtoOp = convenioData.valores_generales?.Gasto_Operatorio ||
      VALORES_CONSTANTES.GASTOS_OPERATORIOS; // 3281 del Excel

    const gal = parseFloat(practica.gal) || 0;
    const gto = parseFloat(practica.gto) || 0;

    // Fórmula exacta del Excel (CODIGOS-INTERNOS columna E):
    // HON. MÉDICO = (GALENO_RX * GAL) + ((GTO_OP * GTO) / 2)
    const honMedico = (galenoRx * gal) + ((gtoOp * gto) / 2);
    
    // Fórmula exacta del Excel (CODIGOS-INTERNOS columna G):
    // GTO SANATORIAL = (GTO_OP * GTO) / 2
    const gtoSanatorial = (gtoOp * gto) / 2;

    return {
      honMedico: Math.round(honMedico),
      gtoSanatorial: Math.round(gtoSanatorial),
      formula: `(${galenoRx} × ${gal}) + ((${gtoOp} × ${gto}) / 2) = $${money(honMedico)}`
    };
  };

  // Calcular valores de pensión
  const calcularValoresPension = (practica) => {
    if (practica.formula !== 'pension' || !convenioData) {
      return { gtoSanatorial: 0 };
    }

    // Para pensión, usar el valor de PENSION del convenio (2838 del Excel)
    const valorPension = convenioData.valores_generales?.PENSION || VALORES_CONSTANTES.PENSION;
    const gto = parseFloat(practica.gto) || 0;
    
    const gtoSanatorial = valorPension * gto;

    return {
      gtoSanatorial: Math.round(gtoSanatorial),
      formula: `${valorPension} × ${gto} = $${money(gtoSanatorial)}`
    };
  };

  // Búsqueda inteligente de prácticas
  const buscarPracticasInteligente = (termino, categoria = 'todas') => {
    if (!termino.trim() && categoria === 'todas') {
      return PRACTICAS_COMPLETAS;
    }

    const busqueda = termino.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return PRACTICAS_COMPLETAS.filter(p => {
      // Filtrar por categoría
      if (categoria !== 'todas' && p.categoria !== categoria) return false;

      // Si no hay término de búsqueda, mostrar todas de la categoría
      if (!termino.trim()) return true;

      // Búsqueda en múltiples campos
      return (
        (p.codInt && p.codInt.toString().toLowerCase().includes(busqueda)) ||
        p.practica.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(busqueda) ||
        p.codigo.toLowerCase().includes(busqueda) ||
        p.tipo.toLowerCase().includes(busqueda)
      );
    });
  };

  // Agregar práctica con cálculos automáticos
  const agregarPractica = (practica) => {
    if (!convenioData) {
      alert('Primero debe seleccionar un convenio');
      return;
    }

    let honMedico = 0;
    let gtoSanatorial = 0;
    let formulaDesc = '';

    if (practica.formula === 'rx') {
      const valores = calcularValoresRX(practica);
      honMedico = valores.honMedico;
      gtoSanatorial = valores.gtoSanatorial;
      formulaDesc = valores.formula;
    } else if (practica.formula === 'pension') {
      const valores = calcularValoresPension(practica);
      gtoSanatorial = valores.gtoSanatorial;
      formulaDesc = valores.formula;
      honMedico = 0; // Pension no tiene honorarios médicos
    } else {
      // Prácticas directas
      honMedico = parseFloat(practica.honMedico.toString().replace(/\./g, '').replace(',', '.')) || 0;
      gtoSanatorial = parseFloat(practica.gtoSanatorial.toString().replace(/\./g, '').replace(',', '.')) || 0;
      formulaDesc = 'Valor directo';
    }

    const nuevaPractica = {
      id: `${uniqueId}-${practica.id}-${Date.now()}`,
      tipo: 'practica',
      categoria: practica.categoria,
      codInt: practica.codInt,
      practica: practica.practica,
      codigo: practica.codigo,
      gal: practica.gal,
      honMedico,
      gto: practica.gto,
      gtoSanatorial,
      formula: practica.formula,
      formulaDesc,
      cantidad: 1,
      medico: paciente.medicoAsignado || 'MÉDICO GENERAL',
      subtotalHonorarios: honMedico,
      subtotalGastos: gtoSanatorial,
      total: honMedico + gtoSanatorial
    };

    setPracticasAgregadas(prev => [...prev, nuevaPractica]);
    
    // Actualizar total del siniestro
    calcularTotalSiniestro();
  };

  // Calcular total del siniestro (STRO)
  const calcularTotalSiniestro = () => {
    const totalPracticas = practicasAgregadas.reduce((sum, p) => sum + p.total, 0);
    const totalLaboratorios = laboratoriosAgregados.reduce((sum, l) => sum + l.total, 0);
    const totalMedicamentos = medicamentosAgregados.reduce((sum, m) => sum + m.total, 0);
    
    const totalSiniestro = totalPracticas + totalLaboratorios + totalMedicamentos;
    
    setPaciente(prev => ({
      ...prev,
      totalSiniestro
    }));
    
    return totalSiniestro;
  };

  // Agregar estudio de laboratorio
  const agregarLaboratorio = (estudio) => {
    if (!convenioData) {
      alert('Primero debe seleccionar un convenio');
      return;
    }

    const valorUB = convenioData.unidad_bioquimica ||
      nomencladorBioquimica?.metadata?.unidad_bioquimica_valor_referencia ||
      1224.11;

    const valorCalculado = estudio.unidad_bioquimica * valorUB;

    const nuevoLaboratorio = {
      id: `${uniqueId}-lab-${estudio.codigo}-${Date.now()}`,
      tipo: 'laboratorio',
      codigo: estudio.codigo,
      practica: estudio.practica_bioquimica,
      unidad_bioquimica: estudio.unidad_bioquimica,
      valorUB: valorUB,
      valorCalculado,
      cantidad: 1,
      subtotal: valorCalculado,
      total: valorCalculado,
      formula: `${estudio.unidad_bioquimica} × ${money(valorUB)} = $${money(valorCalculado)}`
    };

    setLaboratoriosAgregados(prev => [...prev, nuevoLaboratorio]);
    calcularTotalSiniestro();
  };

  // Agregar medicamento o descartable
  const agregarMedicamento = (item) => {
    const nuevoMedicamento = {
      id: `${uniqueId}-med-${item.id}-${Date.now()}`,
      tipo: item.tipo,
      nombre: item.nombre,
      presentacion: item.presentacion,
      precio: item.precio,
      cantidad: 1,
      subtotal: item.precio,
      total: item.precio
    };

    setMedicamentosAgregados(prev => [...prev, nuevoMedicamento]);
    calcularTotalSiniestro();
  };

  // Actualizar cantidad de cualquier item
  const actualizarCantidad = (tipo, id, nuevaCantidad) => {
    if (nuevaCantidad < 1) return;

    switch (tipo) {
      case 'practica':
        setPracticasAgregadas(prev =>
          prev.map(p => {
            if (p.id === id) {
              return {
                ...p,
                cantidad: nuevaCantidad,
                subtotalHonorarios: p.honMedico * nuevaCantidad,
                subtotalGastos: p.gtoSanatorial * nuevaCantidad,
                total: (p.honMedico + p.gtoSanatorial) * nuevaCantidad
              };
            }
            return p;
          })
        );
        break;

      case 'laboratorio':
        setLaboratoriosAgregados(prev =>
          prev.map(l => {
            if (l.id === id) {
              const subtotal = l.valorCalculado * nuevaCantidad;
              return {
                ...l,
                cantidad: nuevaCantidad,
                subtotal,
                total: subtotal
              };
            }
            return l;
          })
        );
        break;

      case 'medicamento':
        setMedicamentosAgregados(prev =>
          prev.map(m => {
            if (m.id === id) {
              const subtotal = m.precio * nuevaCantidad;
              return {
                ...m,
                cantidad: nuevaCantidad,
                subtotal,
                total: subtotal
              };
            }
            return m;
          })
        );
        break;
    }
    
    calcularTotalSiniestro();
  };

  // Eliminar item
  const eliminarItem = (tipo, id) => {
    switch (tipo) {
      case 'practica':
        setPracticasAgregadas(prev => prev.filter(p => p.id !== id));
        break;
      case 'laboratorio':
        setLaboratoriosAgregados(prev => prev.filter(l => l.id !== id));
        break;
      case 'medicamento':
        setMedicamentosAgregados(prev => prev.filter(m => m.id !== id));
        break;
    }
    
    calcularTotalSiniestro();
  };

  // Calcular totales con desglose
  const calcularTotales = useMemo(() => {
    const totalPracticas = practicasAgregadas.reduce((sum, p) => sum + p.total, 0);
    const totalLaboratorios = laboratoriosAgregados.reduce((sum, l) => sum + l.total, 0);
    const totalMedicamentos = medicamentosAgregados.reduce((sum, m) => sum + m.total, 0);
    const totalGeneral = totalPracticas + totalLaboratorios + totalMedicamentos;

    // Desglose como en Excel: GASTOS vs HONORARIOS
    const gastosClinica = practicasAgregadas.reduce((sum, p) => sum + p.subtotalGastos, 0) +
                         medicamentosAgregados.reduce((sum, m) => sum + m.total, 0);
    
    const honorariosMedicos = practicasAgregadas.reduce((sum, p) => sum + p.subtotalHonorarios, 0);

    return {
      totalPracticas,
      totalLaboratorios,
      totalMedicamentos,
      totalGeneral,
      gastosClinica,
      honorariosMedicos,
      estudiosLaboratorio: totalLaboratorios
    };
  }, [practicasAgregadas, laboratoriosAgregados, medicamentosAgregados]);

  // Filtrar prácticas con búsqueda inteligente
  const practicasFiltradas = useMemo(() => {
    return buscarPracticasInteligente(filtroPracticas, categoriaFiltro);
  }, [filtroPracticas, categoriaFiltro]);

  // Filtrar laboratorios
  const laboratoriosFiltrados = useMemo(() => {
    if (!nomencladorBioquimica?.practicas) return [];
    if (!filtroLaboratorios) return nomencladorBioquimica.practicas.slice(0, 50);

    const busqueda = filtroLaboratorios.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return nomencladorBioquimica.practicas.filter(p =>
      p.codigo.toString().includes(busqueda) ||
      p.practica_bioquimica.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(busqueda)
    ).slice(0, 50);
  }, [nomencladorBioquimica, filtroLaboratorios]);

  // Filtrar medicamentos
  const medicamentosFiltrados = useMemo(() => {
    const todosItems = [...medicamentosDB, ...descartablesDB];

    if (!filtroMedicamentos) return todosItems.slice(0, 50);

    const busqueda = filtroMedicamentos.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return todosItems.filter(item =>
      item.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(busqueda) ||
      item.tipo.toLowerCase().includes(busqueda)
    ).slice(0, 50);
  }, [medicamentosDB, descartablesDB, filtroMedicamentos]);

  // Guardar presupuesto
  const guardarPresupuesto = () => {
    if (!paciente.apellido || !paciente.nombre || !paciente.dni) {
      alert('Complete los datos del paciente');
      return;
    }

    if (practicasAgregadas.length === 0 &&
      laboratoriosAgregados.length === 0 &&
      medicamentosAgregados.length === 0) {
      alert('Agregue al menos un item');
      return;
    }

    if (!convenioData) {
      alert('Debe seleccionar un convenio');
      return;
    }

    const nuevoPresupuesto = {
      id: `pres-${Date.now()}`,
      fecha: new Date().toISOString(),
      paciente: { ...paciente, totalSiniestro: calcularTotalSiniestro() },
      convenio: convenioPeriodo,
      convenioData: convenioData?.valores_generales,
      practicas: [...practicasAgregadas],
      laboratorios: [...laboratoriosAgregados],
      medicamentos: [...medicamentosAgregados],
      totales: { ...calcularTotales },
      estado: 'borrador'
    };

    const guardados = JSON.parse(localStorage.getItem('presupuestosClinica') || '[]');
    guardados.push(nuevoPresupuesto);
    localStorage.setItem('presupuestosClinica', JSON.stringify(guardados));
    setPresupuestos(guardados);

    alert('Presupuesto guardado exitosamente');
  };

  // Generar Excel con estructura similar al original
  const generarExcelCompleto = () => {
    if (!paciente.apellido) {
      alert('Complete datos del paciente');
      return;
    }

    const wb = XLSX.utils.book_new();

    // === HOJA "AGREGAR" (similar a la hoja AGREGAR del Excel) ===
    const hojaAgregar = [
      ['', 'PACIENTE', 'DNI', 'STRO', 'TOTAL STRO', 'C-I', 'DETALLE', 'PRESTACION', 'U', 'MONTO', 'TOTAL', 'MEDICO', '', 'CLINICA', 'HON MED', 'TOTAL'],
      ['CdU', `${paciente.apellido}, ${paciente.nombre}`, paciente.dni, paciente.nroSiniestro, 
       paciente.totalSiniestro || calcularTotalSiniestro(), '12', 'PRACTICA', '', '', '', '', 
       paciente.medicoAsignado || 'MÉDICO GENERAL', '', '', '', '']
    ];

    // Agregar prácticas
    practicasAgregadas.forEach((p, idx) => {
      hojaAgregar.push([
        '', // CdU
        '', // PACIENTE (vacío después del primero)
        '', // DNI
        '', // STRO
        p.total, // TOTAL STRO (individual)
        '12', // C-I (asumido)
        p.practica, // DETALLE
        p.codigo, // PRESTACION
        p.cantidad, // U
        '', // MONTO
        p.total, // TOTAL
        p.medico, // MEDICO
        '', // (vacío)
        p.formula === 'rx' ? `RX: ${p.formulaDesc}` : '', // CLINICA (info adicional)
        p.honMedico, // HON MED
        p.total // TOTAL
      ]);
    });

    const wsAgregar = XLSX.utils.aoa_to_sheet(hojaAgregar);
    XLSX.utils.book_append_sheet(wb, wsAgregar, 'AGREGAR');

    // === HOJA "DETALLE" (similar a la hoja DETALLE del Excel) ===
    const hojaDetalle = [
      ['', 'PACIENTE', 'DNI', 'STRO', 'TOTAL STRO', 'C-I', 'DETALLE', 'PRESTACION', 'U', 'MONTO', 'TOTAL', 'MEDICO', 'CLINICA', 'HON MED', 'TOTAL'],
      ['', `${paciente.apellido}, ${paciente.nombre}`, paciente.dni, paciente.nroSiniestro, 
       paciente.totalSiniestro || calcularTotalSiniestro(), '12', 'PRACTICA', '', '', '', '', 
       paciente.medicoAsignado || 'MÉDICO GENERAL', '', '', '']
    ];

    // Combinar todos los items
    const todosItems = [
      ...practicasAgregadas.map(p => ({ ...p, tipoItem: 'PRACTICA' })),
      ...laboratoriosAgregados.map(l => ({ ...l, tipoItem: 'LABORATORIO' })),
      ...medicamentosAgregados.map(m => ({ ...m, tipoItem: 'MEDICAMENTO' }))
    ];

    todosItems.forEach(item => {
      hojaDetalle.push([
        '', // (vacío)
        '', // PACIENTE
        '', // DNI
        '', // STRO
        item.total, // TOTAL STRO
        '12', // C-I
        item.tipoItem === 'PRACTICA' ? item.practica : 
          item.tipoItem === 'LABORATORIO' ? item.practica : item.nombre, // DETALLE
        item.tipoItem === 'PRACTICA' ? item.codigo : 
          item.tipoItem === 'LABORATORIO' ? item.codigo : item.tipo, // PRESTACION
        item.cantidad, // U
        item.tipoItem === 'PRACTICA' ? (item.honMedico + item.gtoSanatorial) : 
          item.tipoItem === 'LABORATORIO' ? item.valorCalculado : item.precio, // MONTO
        item.total, // TOTAL
        item.tipoItem === 'PRACTICA' ? item.medico : '', // MEDICO
        item.tipoItem === 'PRACTICA' ? item.gtoSanatorial : 
          item.tipoItem === 'MEDICAMENTO' ? item.total : '', // CLINICA
        item.tipoItem === 'PRACTICA' ? item.honMedico : '', // HON MED
        item.total // TOTAL
      ]);
    });

    const wsDetalle = XLSX.utils.aoa_to_sheet(hojaDetalle);
    XLSX.utils.book_append_sheet(wb, wsDetalle, 'DETALLE');

    // === HOJA "MENSUAL" (resumen) ===
    const hojaMensual = [
      ['PRESTADOR IAPSER'],
      ['PRESTADOR | PACIENTE', 'DNI', 'STRO', 'GASTOS', 'HONORARIOS', 'TOTAL'],
      [`${paciente.prestador} | ${paciente.apellido}, ${paciente.nombre}`, 
       paciente.dni, paciente.nroSiniestro, 
       calcularTotales.gastosClinica, 
       calcularTotales.honorariosMedicos, 
       calcularTotales.totalGeneral]
    ];

    const wsMensual = XLSX.utils.aoa_to_sheet(hojaMensual);
    XLSX.utils.book_append_sheet(wb, wsMensual, 'MENSUAL');

    // === HOJA "RESUMEN" (detallado para el usuario) ===
    const hojaResumen = [
      ['FACTURA CLÍNICA - PRESUPUESTO COMPLETO'],
      [`Convenio: ${convenioPeriodo || 'No seleccionado'}`],
      [`Fecha: ${new Date().toLocaleString('es-AR')}`],
      [],
      ['DATOS DEL PACIENTE'],
      ['Apellido y Nombre', `${paciente.apellido}, ${paciente.nombre}`],
      ['DNI', paciente.dni],
      ['ART/Seguro', paciente.artSeguro],
      ['N° Siniestro (STRO)', paciente.nroSiniestro],
      ['Total Siniestro (TOTAL STRO)', paciente.totalSiniestro || calcularTotalSiniestro()],
      ['Médico Asignado', paciente.medicoAsignado || 'MÉDICO GENERAL'],
      ['Prestador', paciente.prestador],
      [],
      ['RESUMEN FINANCIERO'],
      ['', '', '', '', '', '', 'GASTOS CLÍNICA:', money(calcularTotales.gastosClinica)],
      ['', '', '', '', '', '', 'HONORARIOS MÉDICOS:', money(calcularTotales.honorariosMedicos)],
      ['', '', '', '', '', '', 'ESTUDIOS LABORATORIO:', money(calcularTotales.estudiosLaboratorio)],
      ['', '', '', '', '', '', 'TOTAL GENERAL:', money(calcularTotales.totalGeneral)]
    ];

    const wsResumen = XLSX.utils.aoa_to_sheet(hojaResumen);
    XLSX.utils.book_append_sheet(wb, wsResumen, 'RESUMEN');

    // Nombre del archivo similar al Excel original
    const nombreArchivo = `FACTURACION_${paciente.apellido}_${paciente.dni}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  };

  // Limpiar todos los datos
  const limpiarTodo = () => {
    if (window.confirm('¿Está seguro de que desea limpiar todos los datos?')) {
      setPracticasAgregadas([]);
      setLaboratoriosAgregados([]);
      setMedicamentosAgregados([]);
      setPaciente(prev => ({
        ...prev,
        nroSiniestro: '',
        totalSiniestro: 0
      }));
      alert('Todos los datos han sido limpiados');
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.titulo}>🏥 Sistema de Facturación Clínica IAPSER</h1>

      {/* === TABS DE NAVEGACIÓN === */}
      <div className={styles.tabsNavegacion}>
        <button
          className={`${styles.tabNav} ${activeTab === 'convenio' ? styles.tabNavActive : ''}`}
          onClick={() => setActiveTab('convenio')}
        >
          📋 Convenio
        </button>
        <button
          className={`${styles.tabNav} ${activeTab === 'paciente' ? styles.tabNavActive : ''}`}
          onClick={() => setActiveTab('paciente')}
        >
          👤 Paciente
        </button>
        <button
          className={`${styles.tabNav} ${activeTab === 'practicas' ? styles.tabNavActive : ''}`}
          onClick={() => setActiveTab('practicas')}
          disabled={!convenioData}
        >
          🏥 Prácticas
        </button>
        <button
          className={`${styles.tabNav} ${activeTab === 'laboratorios' ? styles.tabNavActive : ''}`}
          onClick={() => setActiveTab('laboratorios')}
          disabled={!convenioData}
        >
          🧪 Laboratorios
        </button>
        <button
          className={`${styles.tabNav} ${activeTab === 'medicamentos' ? styles.tabNavActive : ''}`}
          onClick={() => setActiveTab('medicamentos')}
        >
          💊 Medicamentos
        </button>
        <button
          className={`${styles.tabNav} ${activeTab === 'resumen' ? styles.tabNavActive : ''}`}
          onClick={() => setActiveTab('resumen')}
          disabled={practicasAgregadas.length === 0 &&
            laboratoriosAgregados.length === 0 &&
            medicamentosAgregados.length === 0}
        >
          📊 Resumen
        </button>
      </div>

      {/* === TAB: CONVENIO === */}
      {activeTab === 'convenio' && (
        <div className={styles.card}>
          <h3>📋 Selección de Convenio</h3>

          <div className={styles.formGroup}>
            <label>Tipo de Convenio:</label>
            <select
              className={styles.selectInput}
              value={convenioTipo}
              onChange={(e) => setConvenioTipo(e.target.value)}
            >
              <option value="">Seleccione tipo...</option>
              {CONVENIOS_OPCIONES.map(c => (
                <option key={c.key} value={c.key}>{c.label}</option>
              ))}
            </select>
          </div>

          {convenioTipo && (
            <div className={styles.formGroup}>
              <label>Período:</label>
              <div className={styles.conveniosGrid}>
                {conveniosFiltrados.map(c => (
                  <button
                    key={c.key}
                    className={`${styles.btnConvenio} ${convenioPeriodo === c.key ? styles.btnConvenioActive : ''}`}
                    onClick={() => cargarConvenioEspecifico(c.key)}
                  >
                    {c.periodo}
                  </button>
                ))}
              </div>
            </div>
          )}

          {convenioData && (
            <div className={styles.infoConvenio}>
              <h4>✅ Convenio seleccionado:</h4>
              <p><strong>Nombre:</strong> {convenioPeriodo}</p>
              
              <div className={styles.valoresDestacados}>
                <div className={styles.valorItem}>
                  <span>Galeno Rx:</span>
                  <strong>{money(convenioData.valores_generales?.Galeno_Rx_Practica ||
                    convenioData.valores_generales?.Galeno_Rx_y_Practica || VALORES_CONSTANTES.GALENO_RX)}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Gasto Operatorio:</span>
                  <strong>{money(convenioData.valores_generales?.Gasto_Operatorio || VALORES_CONSTANTES.GASTOS_OPERATORIOS)}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Gasto Rx:</span>
                  <strong>{money(convenioData.valores_generales?.Gasto_Rx || VALORES_CONSTANTES.GASTOS_RX)}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Consulta:</span>
                  <strong>{money(convenioData.valores_generales?.Consulta || '34650')}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Unidad Bioquímica:</span>
                  <strong>{money(convenioData.unidad_bioquimica || 1224.11)}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Pensión:</span>
                  <strong>{money(convenioData.valores_generales?.PENSION || VALORES_CONSTANTES.PENSION)}</strong>
                </div>
              </div>

              <button
                className={styles.btnSiguiente}
                onClick={() => setActiveTab('paciente')}
              >
                Siguiente → Datos del Paciente
              </button>
            </div>
          )}
        </div>
      )}

      {/* === TAB: PACIENTE === */}
      {activeTab === 'paciente' && (
        <div className={styles.card}>
          <h3>👤 Datos del Paciente</h3>

          <div className={styles.gridDatos}>
            <div className={styles.formGroup}>
              <label>Apellido:</label>
              <input
                type="text"
                placeholder="Apellido"
                value={paciente.apellido}
                onChange={(e) => setPaciente(prev => ({ ...prev, apellido: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Nombre:</label>
              <input
                type="text"
                placeholder="Nombre"
                value={paciente.nombre}
                onChange={(e) => setPaciente(prev => ({ ...prev, nombre: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>DNI:</label>
              <input
                type="text"
                placeholder="DNI"
                value={paciente.dni}
                onChange={(e) => setPaciente(prev => ({ ...prev, dni: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>ART/Seguro Personal:</label>
              <input
                type="text"
                placeholder="ART/Seguro Personal"
                value={paciente.artSeguro}
                onChange={(e) => setPaciente(prev => ({ ...prev, artSeguro: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>N° Siniestro (STRO):</label>
              <input
                type="text"
                placeholder="N° Siniestro"
                value={paciente.nroSiniestro}
                onChange={(e) => setPaciente(prev => ({ ...prev, nroSiniestro: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Fecha de Atención:</label>
              <input
                type="date"
                value={paciente.fechaAtencion}
                onChange={(e) => setPaciente(prev => ({ ...prev, fechaAtencion: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Médico Asignado:</label>
              <select
                value={paciente.medicoAsignado}
                onChange={(e) => setPaciente(prev => ({ ...prev, medicoAsignado: e.target.value }))}
              >
                <option value="">Seleccionar médico...</option>
                {MEDICOS_OPCIONES.map(m => (
                  <option key={m.id} value={m.nombre}>{m.nombre}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>Prestador:</label>
              <input
                type="text"
                placeholder="Prestador (ej: IAPSER)"
                value={paciente.prestador}
                onChange={(e) => setPaciente(prev => ({ ...prev, prestador: e.target.value }))}
              />
            </div>
          </div>

          <div className={styles.botonesNavegacion}>
            <button
              className={styles.btnAtras}
              onClick={() => setActiveTab('convenio')}
            >
              ← Volver a Convenio
            </button>
            <button
              className={styles.btnSiguiente}
              onClick={() => setActiveTab('practicas')}
              disabled={!paciente.apellido || !paciente.nombre || !paciente.dni}
            >
              Siguiente → Prácticas
            </button>
          </div>
        </div>
      )}

      {/* === TAB: PRACTICAS === */}
      {activeTab === 'practicas' && (
        <div className={styles.card}>
          <h3>🏥 Prácticas Médicas</h3>

          <div className={styles.buscadorPracticas}>
            <div className={styles.filtrosSuperiores}>
              <input
                type="text"
                placeholder="Buscar por código interno, práctica o nomenclador..."
                value={filtroPracticas}
                onChange={(e) => setFiltroPracticas(e.target.value)}
                className={styles.inputBusqueda}
              />
              
              <select
                value={categoriaFiltro}
                onChange={(e) => setCategoriaFiltro(e.target.value)}
                className={styles.selectCategoria}
              >
                {CATEGORIAS_PRACTICAS.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.infoPanel}>
            <p><strong>Convenio activo:</strong> {convenioPeriodo}</p>
            <p><em>Las prácticas con fórmula RX se calculan automáticamente según el convenio</em></p>
          </div>

          <div className={styles.tablaPracticas}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>COD INT.</th>
                  <th>PRÁCTICA</th>
                  <th>CÓDIGO</th>
                  <th>CATEGORÍA</th>
                  <th>GAL</th>
                  <th>HON. MÉDICO</th>
                  <th>GTO</th>
                  <th>FÓRMULA</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {practicasFiltradas.map(p => (
                  <tr key={p.id}>
                    <td>{p.codInt || '-'}</td>
                    <td>{p.practica}</td>
                    <td>{p.codigo}</td>
                    <td>
                      <span className={`${styles.badgeCategoria}`}>
                        {p.categoria}
                      </span>
                    </td>
                    <td>{p.gal || '-'}</td>
                    <td>
                      {p.formula === 'rx' ? (
                        <span className={styles.calculado} title="Se calculará según convenio">CALCULADO</span>
                      ) : p.honMedico === '-' ? '-' : money(p.honMedico)}
                    </td>
                    <td>{p.gto || '-'}</td>
                    <td>
                      {p.formula === 'rx' ? (
                        <span className={styles.formulaRx} title="Fórmula RX: (Galeno_Rx × GAL) + ((GTO_Op × GTO) / 2)">RX</span>
                      ) : p.formula === 'pension' ? (
                        <span className={styles.formulaPension} title="Fórmula PENSION: PENSION × GTO">PENSIÓN</span>
                      ) : (
                        <span>DIRECTO</span>
                      )}
                    </td>
                    <td>
                      <button
                        className={styles.btnAgregar}
                        onClick={() => agregarPractica(p)}
                        title={`Agregar ${p.practica}`}
                      >
                        ➕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={styles.botonesNavegacion}>
            <button
              className={styles.btnAtras}
              onClick={() => setActiveTab('paciente')}
            >
              ← Volver a Paciente
            </button>
            <button
              className={styles.btnSiguiente}
              onClick={() => setActiveTab('laboratorios')}
            >
              Siguiente → Laboratorios
            </button>
          </div>
        </div>
      )}

      {/* === TAB: LABORATORIOS === */}
      {activeTab === 'laboratorios' && (
        <div className={styles.card}>
          <h3>🧪 Estudios de Laboratorio</h3>

          <div className={styles.infoPanel}>
            <p><strong>Unidad Bioquímica del convenio:</strong> ${money(convenioData?.unidad_bioquimica || 0)}</p>
            <p><em>El valor se calcula: U.B. × Valor UB del convenio</em></p>
          </div>

          <div className={styles.buscadorPracticas}>
            <input
              type="text"
              placeholder="Buscar estudio por código o descripción..."
              value={filtroLaboratorios}
              onChange={(e) => setFiltroLaboratorios(e.target.value)}
              className={styles.inputBusqueda}
            />
          </div>

          {loading.bioquimica ? (
            <div className={styles.cargando}>
              <p>Cargando nomenclador bioquímico...</p>
            </div>
          ) : (
            <div className={styles.tablaPracticas}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>CÓDIGO</th>
                    <th>PRÁCTICA</th>
                    <th>U.B.</th>
                    <th>VALOR ESTIMADO</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {laboratoriosFiltrados.map(p => {
                    const valorCalculado = p.unidad_bioquimica * (convenioData?.unidad_bioquimica || 1224.11);
                    return (
                      <tr key={`${p.codigo}-${p.practica_bioquimica}`}>
                        <td>{p.codigo}</td>
                        <td>{p.practica_bioquimica}</td>
                        <td>{p.unidad_bioquimica}</td>
                        <td>${money(valorCalculado)}</td>
                        <td>
                          <button
                            className={styles.btnAgregar}
                            onClick={() => agregarLaboratorio(p)}
                          >
                            ➕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.botonesNavegacion}>
            <button
              className={styles.btnAtras}
              onClick={() => setActiveTab('practicas')}
            >
              ← Volver a Prácticas
            </button>
            <button
              className={styles.btnSiguiente}
              onClick={() => setActiveTab('medicamentos')}
            >
              Siguiente → Medicamentos
            </button>
          </div>
        </div>
      )}

      {/* === TAB: MEDICAMENTOS === */}
      {activeTab === 'medicamentos' && (
        <div className={styles.card}>
          <h3>💊 Medicamentos y Descartables</h3>

          <div className={styles.buscadorPracticas}>
            <input
              type="text"
              placeholder="Buscar medicamento o descartable..."
              value={filtroMedicamentos}
              onChange={(e) => setFiltroMedicamentos(e.target.value)}
              className={styles.inputBusqueda}
            />
          </div>

          {loading.medicamentos ? (
            <div className={styles.cargando}>
              <p>Cargando medicamentos y descartables...</p>
            </div>
          ) : (
            <div className={styles.tablaPracticas}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>TIPO</th>
                    <th>NOMBRE</th>
                    <th>PRESENTACIÓN</th>
                    <th>PRECIO</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {medicamentosFiltrados.map(item => (
                    <tr key={`${item.tipo}-${item.id}`}>
                      <td>
                        <span className={`${styles.badge} ${item.tipo === 'medicamento' ? styles.badgeMedicamento : styles.badgeDescartable}`}>
                          {item.tipo === 'medicamento' ? '💊' : '🧷'} {item.tipo}
                        </span>
                      </td>
                      <td>{item.nombre}</td>
                      <td>{item.presentacion}</td>
                      <td>${money(item.precio)}</td>
                      <td>
                        <button
                          className={styles.btnAgregar}
                          onClick={() => agregarMedicamento(item)}
                        >
                          ➕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={styles.botonesNavegacion}>
            <button
              className={styles.btnAtras}
              onClick={() => setActiveTab('laboratorios')}
            >
              ← Volver a Laboratorios
            </button>
            <button
              className={styles.btnSiguiente}
              onClick={() => setActiveTab('resumen')}
              disabled={practicasAgregadas.length === 0 &&
                laboratoriosAgregados.length === 0 &&
                medicamentosAgregados.length === 0}
            >
              Siguiente → Resumen
            </button>
          </div>
        </div>
      )}

      {/* === TAB: RESUMEN === */}
      {activeTab === 'resumen' && (
        <div className={styles.card}>
          <h3>🧾 Resumen de Factura</h3>

          {/* Datos del paciente */}
          <div className={styles.resumenPaciente}>
            <h4>📋 Datos del Paciente:</h4>
            <div className={styles.gridResumen}>
              <div><strong>Nombre:</strong> {paciente.apellido}, {paciente.nombre}</div>
              <div><strong>DNI:</strong> {paciente.dni}</div>
              <div><strong>ART/Seguro:</strong> {paciente.artSeguro || '-'}</div>
              <div><strong>Siniestro (STRO):</strong> {paciente.nroSiniestro || '-'}</div>
              <div><strong>Total Siniestro:</strong> ${money(paciente.totalSiniestro)}</div>
              <div><strong>Médico:</strong> {paciente.medicoAsignado || 'MÉDICO GENERAL'}</div>
              <div><strong>Prestador:</strong> {paciente.prestador}</div>
              <div><strong>Convenio:</strong> {convenioPeriodo}</div>
              <div><strong>Fecha:</strong> {paciente.fechaAtencion}</div>
            </div>
          </div>

          {/* Prácticas agregadas */}
          {practicasAgregadas.length > 0 && (
            <div className={styles.seccionAgregados}>
              <h4>🏥 Prácticas Médicas ({practicasAgregadas.length})</h4>
              <div className={styles.tablaAgregadas}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>PRÁCTICA</th>
                      <th>COD</th>
                      <th>CANT.</th>
                      <th>HON. MÉDICO</th>
                      <th>GTO SANAT.</th>
                      <th>FÓRMULA</th>
                      <th>TOTAL</th>
                      <th>ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {practicasAgregadas.map(p => (
                      <tr key={p.id}>
                        <td>{p.practica}</td>
                        <td>{p.codigo}</td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={p.cantidad}
                            onChange={(e) => actualizarCantidad('practica', p.id, parseInt(e.target.value) || 1)}
                            className={styles.inputCantidad}
                          />
                        </td>
                        <td>${money(p.honMedico)}</td>
                        <td>${money(p.gtoSanatorial)}</td>
                        <td className={styles.celdaFormula} title={p.formulaDesc}>
                          {p.formula === 'rx' ? 'RX' : p.formula === 'pension' ? 'PENSIÓN' : 'DIRECTO'}
                        </td>
                        <td>${money(p.total)}</td>
                        <td>
                          <button
                            className={styles.btnEliminar}
                            onClick={() => eliminarItem('practica', p.id)}
                            title="Eliminar práctica"
                          >
                            ❌
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Laboratorios agregados */}
          {laboratoriosAgregados.length > 0 && (
            <div className={styles.seccionAgregados}>
              <h4>🧪 Estudios de Laboratorio ({laboratoriosAgregados.length})</h4>
              <div className={styles.tablaAgregadas}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>ESTUDIO</th>
                      <th>COD</th>
                      <th>U.B.</th>
                      <th>VALOR UB</th>
                      <th>CANT.</th>
                      <th>TOTAL</th>
                      <th>ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {laboratoriosAgregados.map(l => (
                      <tr key={l.id}>
                        <td>{l.practica}</td>
                        <td>{l.codigo}</td>
                        <td>{l.unidad_bioquimica}</td>
                        <td>${money(l.valorUB)}</td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={l.cantidad}
                            onChange={(e) => actualizarCantidad('laboratorio', l.id, parseInt(e.target.value) || 1)}
                            className={styles.inputCantidad}
                          />
                        </td>
                        <td>${money(l.total)}</td>
                        <td>
                          <button
                            className={styles.btnEliminar}
                            onClick={() => eliminarItem('laboratorio', l.id)}
                            title="Eliminar estudio"
                          >
                            ❌
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Medicamentos agregados */}
          {medicamentosAgregados.length > 0 && (
            <div className={styles.seccionAgregados}>
              <h4>💊 Medicamentos y Descartables ({medicamentosAgregados.length})</h4>
              <div className={styles.tablaAgregadas}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>TIPO</th>
                      <th>NOMBRE</th>
                      <th>PRESENTACIÓN</th>
                      <th>PRECIO</th>
                      <th>CANT.</th>
                      <th>TOTAL</th>
                      <th>ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicamentosAgregados.map(m => (
                      <tr key={m.id}>
                        <td>{m.tipo === 'medicamento' ? '💊 Medicamento' : '🧷 Descartable'}</td>
                        <td>{m.nombre}</td>
                        <td>{m.presentacion}</td>
                        <td>${money(m.precio)}</td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={m.cantidad}
                            onChange={(e) => actualizarCantidad('medicamento', m.id, parseInt(e.target.value) || 1)}
                            className={styles.inputCantidad}
                          />
                        </td>
                        <td>${money(m.total)}</td>
                        <td>
                          <button
                            className={styles.btnEliminar}
                            onClick={() => eliminarItem('medicamento', m.id)}
                            title="Eliminar item"
                          >
                            ❌
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Totales con desglose como en Excel */}
          <div className={styles.totales}>
            <h4>💰 Resumen Financiero (Formato IAPS)</h4>
            <div className={styles.lineaTotal}>
              <span>GASTOS CLÍNICA:</span>
              <span>${money(calcularTotales.gastosClinica)}</span>
            </div>
            <div className={styles.lineaTotal}>
              <span>HONORARIOS MÉDICOS:</span>
              <span>${money(calcularTotales.honorariosMedicos)}</span>
            </div>
            {laboratoriosAgregados.length > 0 && (
              <div className={styles.lineaTotal}>
                <span>ESTUDIOS DE LABORATORIO:</span>
                <span>${money(calcularTotales.estudiosLaboratorio)}</span>
              </div>
            )}
            <div className={styles.lineaTotalPrincipal}>
              <strong>TOTAL STRO (TOTAL SINIESTRO):</strong>
              <strong>${money(calcularTotales.totalGeneral)}</strong>
            </div>
          </div>

          {/* Botones de acción */}
          <div className={styles.botonesAccion}>
            <button
              className={styles.btnAtras}
              onClick={() => setActiveTab('medicamentos')}
            >
              ← Volver a Medicamentos
            </button>
            <button
              className={styles.btnLimpiar}
              onClick={limpiarTodo}
              title="Limpiar todos los datos"
            >
              🗑️ Limpiar Todo
            </button>
            <button
              className={styles.btnGuardar}
              onClick={guardarPresupuesto}
              disabled={!paciente.apellido ||
                (practicasAgregadas.length === 0 &&
                  laboratoriosAgregados.length === 0 &&
                  medicamentosAgregados.length === 0)}
            >
              💾 Guardar Presupuesto
            </button>
            <button
              className={styles.btnExcel}
              onClick={generarExcelCompleto}
              disabled={practicasAgregadas.length === 0 &&
                laboratoriosAgregados.length === 0 &&
                medicamentosAgregados.length === 0}
              title="Generar Excel con estructura IAPS"
            >
              📊 Generar Excel IAPS
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
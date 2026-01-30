'use client';
import { useState, useEffect, useMemo, useId } from 'react';
import * as XLSX from 'xlsx';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from './facturacionClinica.module.css';

// Datos de prácticas rápidas
const PRACTICAS_RAPIDAS = [
  { id: 11, tipo: 'consulta', codInt: '11', practica: 'CONSULTA EN GUARDIA', codigo: '42.01.01', gal: '', honMedico: '34650', gto: '', gtoSanatorial: '', formula: 'directo' },
  { id: 12, tipo: 'consulta', codInt: '12', practica: 'CONSULTA', codigo: '42.01.01', gal: '', honMedico: '34650', gto: '', gtoSanatorial: '', formula: 'directo' },
  { id: 3, tipo: 'curacion', codInt: '3', practica: 'CURACIÓN', codigo: '43.02.01', gal: '', honMedico: '-', gto: '', gtoSanatorial: '8820', formula: 'directo' },
  { id: 4, tipo: 'quirurgica', codInt: '4', practica: 'SUTURA', codigo: '13.01.10', gal: '30', honMedico: '43065', gto: '45', gtoSanatorial: '147645', formula: 'directo' },
  { id: 5, tipo: 'procedimiento', codInt: '5', practica: 'INFILTRACIÓN', codigo: '12.18.01', gal: '9', honMedico: 'VER AOTER', gto: '7', gtoSanatorial: '22967', formula: 'directo' },
  { id: 6, tipo: 'estudio', codInt: '6', practica: 'ECOGRAFIA PARTES BLAN (MODULADAS)', codigo: '18.06.01', gal: '', honMedico: '42000', gto: '', gtoSanatorial: '-', formula: 'directo' },
  { id: 7, tipo: 'estudio', codInt: '7', practica: 'ELECTRO ECG', codigo: '17.01.01 42.03.03', gal: '', honMedico: '63690', gto: '', gtoSanatorial: '-', formula: 'directo' },
  { id: 8, tipo: 'quirurgica', codInt: '', practica: 'ARTROSCOPIA SIMPLE', codigo: 'XX.06.03 12.09.02', gal: '', honMedico: '1232000', gto: '', gtoSanatorial: '900000', formula: 'directo' },
  { id: 9, tipo: 'quirurgica', codInt: '', practica: 'ARTROSCOPIA COMPLEJA', codigo: 'XX.07.03 12.09.02', gal: '', honMedico: '1361250', gto: '', gtoSanatorial: '1123200', formula: 'directo' },
  { id: 81, tipo: 'pension', codInt: '81', practica: 'DÍA DE PENSION', codigo: '43.01.01', gal: '0', honMedico: '-', gto: '57', gtoSanatorial: '161766', formula: 'directo' },
  { id: 83, tipo: 'insumo', codInt: '83', practica: 'DESCARTABLES', codigo: '43.10.01', gal: '', honMedico: '', gto: '5', gtoSanatorial: '14190', formula: 'directo' },
  { id: 84, tipo: 'quirurgica', codInt: '83', practica: 'INTERVENCION QUIR.', codigo: '43.11.01', gal: '0', honMedico: '-', gto: '8', gtoSanatorial: '22704', formula: 'directo' },

  // RX - Estas se calculan con fórmula
  { id: 201, tipo: 'rx', codInt: '201', practica: 'CRANEO MNO, SPN, CARA (FRENTE)', codigo: '34.02.01', gal: '6.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 202, tipo: 'rx', codInt: '202', practica: 'CRANEO MNO, SPN, CARA (PERFIL)', codigo: '34.02.02', gal: '2.25', honMedico: 'CALCULADO', gto: '20.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 204, tipo: 'rx', codInt: '204', practica: 'ART TEMPOROMANDIBULAR', codigo: '34.02.04', gal: '9.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 207, tipo: 'rx', codInt: '207', practica: 'CRANEO ODONTOLOGICO', codigo: '34.02.07', gal: '5.25', honMedico: 'CALCULADO', gto: '60.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 209, tipo: 'rx', codInt: '209', practica: 'COLUMNA (FRENTE)', codigo: '34.02.09', gal: '6.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 210, tipo: 'rx', codInt: '210', practica: 'COLUMNA (PERFIL)', codigo: '34.02.10', gal: '2.25', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 211, tipo: 'rx', codInt: '211', practica: 'HOBRO, HUMERO, PELVIS, FEMUR, CADERA (FRENTE)', codigo: '34.02.11', gal: '6.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 212, tipo: 'rx', codInt: '212', practica: 'HOBRO, HUMERO, PELVIS, FEMUR, CADERA (PERFIL)', codigo: '34.02.12', gal: '2.25', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 213, tipo: 'rx', codInt: '213', practica: 'CODO, MANO, MUÑECA, DEDOS, RODILLA, TOBILLO (FRENTE Y PERFIL)', codigo: '34.02.13', gal: '6.75', honMedico: 'CALCULADO', gto: '30.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340301, tipo: 'rx', codInt: '340301', practica: 'TORAX, PARRILLA COSTAL (FRENTE)', codigo: '34.03.01', gal: '6.75', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340302, tipo: 'rx', codInt: '340302', practica: 'TORAX, PARRILLA COSTAL (PERFIL)', codigo: '34.03.02', gal: '2.25', honMedico: 'CALCULADO', gto: '21.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340418, tipo: 'rx', codInt: '340418', practica: 'COLANGIO POST-OP', codigo: '34.04.18', gal: '9.75', honMedico: 'CALCULADO', gto: '60.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340421, tipo: 'rx', codInt: '340421', practica: 'ABDOMEN (FRENTE)', codigo: '34.04.21', gal: '5.25', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340422, tipo: 'rx', codInt: '340422', practica: 'ABDOMEN (PERFIL)', codigo: '34.04.22', gal: '2.25', honMedico: 'CALCULADO', gto: '20.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
  { id: 340501, tipo: 'rx', codInt: '340501', practica: 'ARBOL URINARIO SIMPLE', codigo: '34.05.01', gal: '5.25', honMedico: 'CALCULADO', gto: '25.00', gtoSanatorial: 'CALCULADO', formula: 'rx' },
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

// Función money mejorada
const money = (n) => {
  if (n == null || n === '' || n === '-') return '-';

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

export default function FacturacionClinica() {
  // === ESTADOS PRINCIPALES ===
  const [convenioTipo, setConvenioTipo] = useState('');
  const [convenioPeriodo, setConvenioPeriodo] = useState('');
  const [convenioData, setConvenioData] = useState(null);
  const [todosConvenios, setTodosConvenios] = useState({});
  const [conveniosFiltrados, setConveniosFiltrados] = useState([]);

  const [paciente, setPaciente] = useState({
    apellido: '',
    nombre: '',
    artSeguro: '',
    nroSiniestro: '',
    dni: ''
  });

  const [practicasAgregadas, setPracticasAgregadas] = useState([]);
  const [laboratoriosAgregados, setLaboratoriosAgregados] = useState([]);
  const [medicamentosAgregados, setMedicamentosAgregados] = useState([]);
  const [filtroPracticas, setFiltroPracticas] = useState('');
  const [filtroLaboratorios, setFiltroLaboratorios] = useState('');
  const [filtroMedicamentos, setFiltroMedicamentos] = useState('');
  const [presupuestos, setPresupuestos] = useState([]);
  const [activeTab, setActiveTab] = useState('convenio');

  // Datos externos
  const [nomencladorBioquimica, setNomencladorBioquimica] = useState(null);
  const [medicamentosDB, setMedicamentosDB] = useState([]);
  const [descartablesDB, setDescartablesDB] = useState([]);
  const [loading, setLoading] = useState({
    bioquimica: true,
    medicamentos: true
  });

  // Generar IDs únicos
  const uniqueId = useId();

  // === CARGAR TODOS LOS DATOS ===
  useEffect(() => {
    const cargarTodosDatos = async () => {
      try {
        // 1. Cargar convenios
        const conveniosResponse = await fetch('/datos-clini-default-rtdb-export.json');
        const conveniosData = await conveniosResponse.json();
        setTodosConvenios(conveniosData.convenios || {});

        // 2. Cargar nomenclador bioquímico
        const nomencladorResponse = await fetch('/archivos/NomecladorBioquimica.json');
        if (nomencladorResponse.ok) {
          const nomencladorData = await nomencladorResponse.json();
          setNomencladorBioquimica(nomencladorData);
        }
        setLoading(prev => ({ ...prev, bioquimica: false }));

        // 3. Cargar presupuestos guardados
        const guardados = localStorage.getItem('presupuestosClinica');
        if (guardados) {
          setPresupuestos(JSON.parse(guardados));
        }
      } catch (error) {
        console.error('Error cargando datos:', error);
      }
    };

    cargarTodosDatos();
  }, []);

  // === CARGAR MEDICAMENTOS DE FIREBASE ===
  useEffect(() => {
    const cargarMedicamentos = () => {
      setLoading(prev => ({ ...prev, medicamentos: true }));

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
        }
      });

      setLoading(prev => ({ ...prev, medicamentos: false }));

      return () => {
        unsubscribeMed();
        unsubscribeDesc();
      };
    };

    cargarMedicamentos();
  }, []);

  // === FILTRAR CONVENIOS ===
  useEffect(() => {
    if (!convenioTipo || !todosConvenios) {
      setConveniosFiltrados([]);
      return;
    }

    const filtrados = Object.keys(todosConvenios)
      .filter(key => key.includes(convenioTipo))
      .map(key => ({
        key,
        label: key,
        periodo: key.includes('Junio-Sept') ? 'Junio-Septiembre' :
          key.includes('Octubre-Actualidad') ? 'Octubre-Actualidad' :
            key.includes('Febrero-Mayo') ? 'Febrero-Mayo' :
              key.includes('Junio-Septiembre') ? 'Junio-Septiembre' : 'Otro'
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

  // === CARGAR CONVENIO ESPECÍFICO ===
  const cargarConvenioEspecifico = (convenioKey) => {
    if (!convenioKey || !todosConvenios[convenioKey]) {
      setConvenioData(null);
      return;
    }

    const convenio = todosConvenios[convenioKey];
    const valoresGenerales = {};

    Object.entries(convenio.valores_generales || {}).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const cleaned = value.replace(/\./g, '').replace(',', '.').trim();
        valoresGenerales[key] = parseFloat(cleaned) || 0;
      } else {
        valoresGenerales[key] = Number(value) || 0;
      }
    });

    // Obtener valor UB del convenio
    const keysPosibles = [
      'Laboratorios_NBU_T',
      'Laboratorios_NBU',
      'Laboratorios NBU T',
      'Laboratorios NBU',
      'UB',
      'Unidad_Bioquimica',
      'Unidad Bioquimica',
    ];

    let valorUB = 0;
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

  // === CALCULAR VALORES RX ===
  const calcularValoresRX = (practica) => {
    if (!convenioData || practica.formula !== 'rx') {
      return { honMedico: 0, gtoSanatorial: 0 };
    }

    const galenoRx = convenioData.valores_generales?.Galeno_Rx_Practica ||
      convenioData.valores_generales?.Galeno_Rx_y_Practica || 1176;
    const gtoRx = convenioData.valores_generales?.Gasto_Rx || 1373;

    const gal = parseFloat(practica.gal) || 0;
    const gto = parseFloat(practica.gto) || 0;

    const honMedico = (gal * galenoRx) + ((gtoRx * 30) / 2);
    const gtoSanatorial = (gtoRx * 30) / 2;

    return {
      honMedico: Math.round(honMedico),
      gtoSanatorial: Math.round(gtoSanatorial)
    };
  };

  // === AGREGAR PRACTICA ===
  const agregarPractica = (practica) => {
    if (!convenioData) {
      alert('Primero debe seleccionar un convenio');
      return;
    }

    let honMedico = 0;
    let gtoSanatorial = 0;

    if (practica.formula === 'rx') {
      const valores = calcularValoresRX(practica);
      honMedico = valores.honMedico;
      gtoSanatorial = valores.gtoSanatorial;
    } else {
      honMedico = parseFloat(practica.honMedico.replace(/\./g, '').replace(',', '.')) || 0;
      gtoSanatorial = parseFloat(practica.gtoSanatorial.replace(/\./g, '').replace(',', '.')) || 0;
    }

    const nuevaPractica = {
      id: `${uniqueId}-${practica.id}-${Date.now()}`,
      tipo: 'practica',
      codInt: practica.codInt,
      practica: practica.practica,
      codigo: practica.codigo,
      gal: practica.gal,
      honMedico,
      gto: practica.gto,
      gtoSanatorial,
      formula: practica.formula,
      cantidad: 1,
      subtotalHonorarios: honMedico,
      subtotalGastos: gtoSanatorial,
      total: honMedico + gtoSanatorial
    };

    setPracticasAgregadas(prev => [...prev, nuevaPractica]);
  };

  // === AGREGAR ESTUDIO DE LABORATORIO ===
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
      total: valorCalculado
    };

    setLaboratoriosAgregados(prev => [...prev, nuevoLaboratorio]);
  };

  // === AGREGAR MEDICAMENTO O DESCARTABLE ===
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
  };

  // === ACTUALIZAR CANTIDAD ===
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
  };

  // === ELIMINAR ITEM ===
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
  };

  // === CALCULAR TOTALES ===
  const calcularTotales = useMemo(() => {
    const totalPracticas = practicasAgregadas.reduce((sum, p) => sum + p.total, 0);
    const totalLaboratorios = laboratoriosAgregados.reduce((sum, l) => sum + l.total, 0);
    const totalMedicamentos = medicamentosAgregados.reduce((sum, m) => sum + m.total, 0);
    const totalGeneral = totalPracticas + totalLaboratorios + totalMedicamentos;

    return {
      totalPracticas,
      totalLaboratorios,
      totalMedicamentos,
      totalGeneral
    };
  }, [practicasAgregadas, laboratoriosAgregados, medicamentosAgregados]);

  // === FILTRAR PRACTICAS ===
  const practicasFiltradas = useMemo(() => {
    if (!filtroPracticas) return PRACTICAS_RAPIDAS;

    const busqueda = filtroPracticas.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return PRACTICAS_RAPIDAS.filter(p =>
      p.codInt.toLowerCase().includes(busqueda) ||
      p.practica.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(busqueda) ||
      p.codigo.toLowerCase().includes(busqueda)
    );
  }, [filtroPracticas]);

  // === FILTRAR LABORATORIOS ===
  const laboratoriosFiltrados = useMemo(() => {
    if (!nomencladorBioquimica?.practicas) return [];
    if (!filtroLaboratorios) return nomencladorBioquimica.practicas.slice(0, 50);

    const busqueda = filtroLaboratorios.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return nomencladorBioquimica.practicas.filter(p =>
      p.codigo.toString().includes(busqueda) ||
      p.practica_bioquimica.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(busqueda)
    ).slice(0, 50);
  }, [nomencladorBioquimica, filtroLaboratorios]);

  // === FILTRAR MEDICAMENTOS ===
  const medicamentosFiltrados = useMemo(() => {
    const todosItems = [...medicamentosDB, ...descartablesDB];

    if (!filtroMedicamentos) return todosItems.slice(0, 50);

    const busqueda = filtroMedicamentos.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    return todosItems.filter(item =>
      item.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(busqueda) ||
      item.tipo.toLowerCase().includes(busqueda)
    ).slice(0, 50);
  }, [medicamentosDB, descartablesDB, filtroMedicamentos]);

  // === GUARDAR PRESUPUESTO ===
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
      paciente: { ...paciente },
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

  // === GENERAR EXCEL ===
  const generarExcel = () => {
    if (!paciente.apellido) {
      alert('Complete datos del paciente');
      return;
    }

    const wb = XLSX.utils.book_new();

    // Hoja principal
    const hojaData = [
      ['FACTURA CLÍNICA - PRESUPUESTO COMPLETO'],
      [`Convenio: ${convenioPeriodo || 'No seleccionado'}`],
      [`Fecha: ${new Date().toLocaleString('es-AR')}`],
      [],
      ['DATOS DEL PACIENTE'],
      ['Apellido y Nombre', `${paciente.apellido}, ${paciente.nombre}`],
      ['DNI', paciente.dni],
      ['ART/Seguro', paciente.artSeguro],
      ['N° Siniestro', paciente.nroSiniestro],
      [],
      ['1. PRÁCTICAS MÉDICAS'],
      ['COD INT.', 'PRÁCTICA', 'CÓDIGO', 'CANT.', 'HON. MÉDICO', 'GTO SANAT.', 'TOTAL']
    ];

    // Prácticas médicas
    practicasAgregadas.forEach(p => {
      hojaData.push([
        p.codInt,
        p.practica,
        p.codigo,
        p.cantidad,
        p.honMedico,
        p.gtoSanatorial,
        p.total
      ]);
    });

    // Laboratorios
    if (laboratoriosAgregados.length > 0) {
      hojaData.push([], ['2. ESTUDIOS DE LABORATORIO']);
      hojaData.push(['CÓDIGO', 'PRÁCTICA', 'U.B.', 'VALOR UB', 'VALOR', 'CANT.', 'TOTAL']);

      laboratoriosAgregados.forEach(l => {
        hojaData.push([
          l.codigo,
          l.practica,
          l.unidad_bioquimica,
          l.valorUB,
          l.valorCalculado,
          l.cantidad,
          l.total
        ]);
      });
    }

    // Medicamentos
    if (medicamentosAgregados.length > 0) {
      hojaData.push([], ['3. MEDICAMENTOS Y DESCARTABLES']);
      hojaData.push(['TIPO', 'NOMBRE', 'PRESENTACIÓN', 'PRECIO UNIT.', 'CANT.', 'TOTAL']);

      medicamentosAgregados.forEach(m => {
        hojaData.push([
          m.tipo === 'medicamento' ? 'Medicamento' : 'Descartable',
          m.nombre,
          m.presentacion,
          m.precio,
          m.cantidad,
          m.total
        ]);
      });
    }

    // Totales
    hojaData.push(
      [],
      ['RESUMEN FINANCIERO'],
      ['', '', '', '', '', '', 'TOTAL PRÁCTICAS:', calcularTotales.totalPracticas],
      ['', '', '', '', '', '', 'TOTAL LABORATORIOS:', calcularTotales.totalLaboratorios],
      ['', '', '', '', '', '', 'TOTAL MEDICAMENTOS:', calcularTotales.totalMedicamentos],
      ['', '', '', '', '', '', 'TOTAL GENERAL:', calcularTotales.totalGeneral]
    );

    const ws = XLSX.utils.aoa_to_sheet(hojaData);
    XLSX.utils.book_append_sheet(wb, ws, 'Presupuesto');

    // Hoja de convenio
    if (convenioData?.valores_generales) {
      const convenioDataSheet = [
        ['VALORES DEL CONVENIO'],
        [`Convenio: ${convenioPeriodo}`],
        [`Unidad Bioquímica: ${convenioData.unidad_bioquimica}`],
        [],
        ['ITEM', 'VALOR']
      ];

      Object.entries(convenioData.valores_generales).forEach(([key, value]) => {
        convenioDataSheet.push([key, value]);
      });

      const ws2 = XLSX.utils.aoa_to_sheet(convenioDataSheet);
      XLSX.utils.book_append_sheet(wb, ws2, 'Convenio');
    }

    const nombreArchivo = `Presupuesto_${paciente.apellido}_${paciente.nombre}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.titulo}>🏥 Sistema de Facturación Clínica</h1>

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
                    convenioData.valores_generales?.Galeno_Rx_y_Practica || 0)}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Gasto Rx:</span>
                  <strong>{money(convenioData.valores_generales?.Gasto_Rx || 0)}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Consulta:</span>
                  <strong>{money(convenioData.valores_generales?.Consulta || 0)}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Unidad Bioquímica:</span>
                  <strong>{money(convenioData.unidad_bioquimica || 0)}</strong>
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
              <label>ART/Seguro Personal:</label>
              <input
                type="text"
                placeholder="ART/Seguro Personal"
                value={paciente.artSeguro}
                onChange={(e) => setPaciente(prev => ({ ...prev, artSeguro: e.target.value }))}
              />
            </div>

            <div className={styles.formGroup}>
              <label>N° Siniestro:</label>
              <input
                type="text"
                placeholder="N° Siniestro"
                value={paciente.nroSiniestro}
                onChange={(e) => setPaciente(prev => ({ ...prev, nroSiniestro: e.target.value }))}
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
              disabled={!paciente.apellido || !paciente.nombre}
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
            <input
              type="text"
              placeholder="Buscar práctica por código o descripción..."
              value={filtroPracticas}
              onChange={(e) => setFiltroPracticas(e.target.value)}
              className={styles.inputBusqueda}
            />
          </div>

          <div className={styles.tablaPracticas}>
            <table className={styles.tabla}>
              <thead>
                <tr>
                  <th>COD INT.</th>
                  <th>PRÁCTICA</th>
                  <th>CÓDIGO</th>
                  <th>GAL</th>
                  <th>HON. MÉDICO</th>
                  <th>GTO</th>
                  <th>ACCIÓN</th>
                </tr>
              </thead>
              <tbody>
                {practicasFiltradas.map(p => (
                  <tr key={p.id}>
                    <td>{p.codInt}</td>
                    <td>{p.practica}</td>
                    <td>{p.codigo}</td>
                    <td>{p.gal}</td>
                    <td>
                      {p.formula === 'rx' ? (
                        <span className={styles.calculado}>CALCULADO</span>
                      ) : p.honMedico}
                    </td>
                    <td>{p.gto}</td>
                    <td>
                      <button
                        className={styles.btnAgregar}
                        onClick={() => agregarPractica(p)}
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
            <h4>Paciente:</h4>
            <p><strong>Nombre:</strong> {paciente.apellido}, {paciente.nombre}</p>
            <p><strong>DNI:</strong> {paciente.dni}</p>
            <p><strong>ART/Seguro:</strong> {paciente.artSeguro}</p>
            <p><strong>Siniestro:</strong> {paciente.nroSiniestro}</p>
            <p><strong>Convenio:</strong> {convenioPeriodo}</p>
            <p><strong>Unidad Bioquímica:</strong> ${money(convenioData?.unidad_bioquimica || 0)}</p>
          </div>

          {/* Prácticas agregadas */}
          {practicasAgregadas.length > 0 && (
            <div className={styles.seccionAgregados}>
              <h4>🏥 Prácticas Médicas</h4>
              <div className={styles.tablaAgregadas}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>PRÁCTICA</th>
                      <th>CANT.</th>
                      <th>HON. MÉDICO</th>
                      <th>GTO SANAT.</th>
                      <th>TOTAL</th>
                      <th>ACCIÓN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {practicasAgregadas.map(p => (
                      <tr key={p.id}>
                        <td>{p.practica}</td>
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
                        <td>${money(p.total)}</td>
                        <td>
                          <button
                            className={styles.btnEliminar}
                            onClick={() => eliminarItem('practica', p.id)}
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
              <h4>🧪 Estudios de Laboratorio</h4>
              <div className={styles.tablaAgregadas}>
                <table className={styles.tabla}>
                  <thead>
                    <tr>
                      <th>ESTUDIO</th>
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
              <h4>💊 Medicamentos y Descartables</h4>
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
                        <td>{m.tipo === 'medicamento' ? '💊' : '🧷'} {m.tipo}</td>
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

          {/* Totales */}
          <div className={styles.totales}>
            <h4>💰 Resumen Financiero</h4>
            <div className={styles.lineaTotal}>
              <span>Total Prácticas Médicas:</span>
              <span>${money(calcularTotales.totalPracticas)}</span>
            </div>
            {laboratoriosAgregados.length > 0 && (
              <div className={styles.lineaTotal}>
                <span>Total Estudios de Laboratorio:</span>
                <span>${money(calcularTotales.totalLaboratorios)}</span>
              </div>
            )}
            {medicamentosAgregados.length > 0 && (
              <div className={styles.lineaTotal}>
                <span>Total Medicamentos y Descartables:</span>
                <span>${money(calcularTotales.totalMedicamentos)}</span>
              </div>
            )}
            <div className={styles.lineaTotalPrincipal}>
              <strong>TOTAL GENERAL:</strong>
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
              onClick={generarExcel}
              disabled={practicasAgregadas.length === 0 &&
                laboratoriosAgregados.length === 0 &&
                medicamentosAgregados.length === 0}
            >
              📊 Generar Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
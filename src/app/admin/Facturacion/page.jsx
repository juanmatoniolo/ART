'use client';
import { useState, useEffect, useMemo, useId } from 'react';
import * as XLSX from 'xlsx';
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

// Convenios disponibles (solo nombres para selección inicial)
const CONVENIOS_OPCIONES = [
  { key: 'ART', label: 'ART' },
  { key: 'IAPS', label: 'IAPS' },
  { key: 'OSDE', label: 'OSDE' },
  { key: 'SWISS', label: 'SWISS MEDICAL' },
  { key: 'GALENO', label: 'GALENO' },
  { key: 'PARTICULAR', label: 'PARTICULAR' }
];

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
  const [filtroPracticas, setFiltroPracticas] = useState('');
  const [presupuestos, setPresupuestos] = useState([]);
  const [buscarPaciente, setBuscarPaciente] = useState('');
  const [mostrarBuscador, setMostrarBuscador] = useState(false);
  const [activeTab, setActiveTab] = useState('paciente');

  // Generar IDs únicos estables
  const uniqueId = useId();

  // === CARGAR TODOS LOS CONVENIOS ===
  useEffect(() => {
    const cargarConvenios = async () => {
      try {
        const response = await fetch('/datos-clini-default-rtdb-export.json');
        const data = await response.json();
        setTodosConvenios(data.convenios || {});
      } catch (error) {
        console.error('Error cargando convenios:', error);
      }
    };

    cargarConvenios();
    
    // Cargar presupuestos guardados
    const guardados = localStorage.getItem('presupuestosClinica');
    if (guardados) {
      setPresupuestos(JSON.parse(guardados));
    }
  }, []);

  // === FILTRAR CONVENIOS SEGÚN TIPO ===
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
    
    // Seleccionar el primer convenio si hay solo uno
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
    // Convertir valores de string a número
    const valoresGenerales = {};
    Object.entries(convenio.valores_generales || {}).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const cleaned = value.replace(/\./g, '').replace(',', '.').trim();
        valoresGenerales[key] = parseFloat(cleaned) || 0;
      } else {
        valoresGenerales[key] = Number(value) || 0;
      }
    });
    
    setConvenioData({
      ...convenio,
      valores_generales: valoresGenerales,
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

    // Fórmula: (Galeno * Galeno_Rx) + ((Gto_Rx * 30) / 2)
    const honMedico = (gal * galenoRx) + ((gtoRx * 30) / 2);
    
    // Fórmula: (Gto_Rx * 30) / 2
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
      // Valores directos
      honMedico = parseFloat(practica.honMedico.replace(/\./g, '').replace(',', '.')) || 0;
      gtoSanatorial = parseFloat(practica.gtoSanatorial.replace(/\./g, '').replace(',', '.')) || 0;
    }

    const nuevaPractica = {
      id: `${uniqueId}-${practica.id}-${practicasAgregadas.length}`,
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

  // === ACTUALIZAR CANTIDAD ===
  const actualizarCantidad = (id, nuevaCantidad) => {
    if (nuevaCantidad < 1) return;
    
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
  };

  // === ELIMINAR PRACTICA ===
  const eliminarPractica = (id) => {
    setPracticasAgregadas(prev => prev.filter(p => p.id !== id));
  };

  // === CALCULAR TOTALES ===
  const calcularTotales = useMemo(() => {
    const totalHonorarios = practicasAgregadas.reduce((sum, p) => sum + p.subtotalHonorarios, 0);
    const totalGastos = practicasAgregadas.reduce((sum, p) => sum + p.subtotalGastos, 0);
    const totalGeneral = totalHonorarios + totalGastos;
    const totalPracticas = practicasAgregadas.reduce((sum, p) => sum + p.cantidad, 0);

    return {
      totalHonorarios,
      totalGastos,
      totalGeneral,
      totalPracticas
    };
  }, [practicasAgregadas]);

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

  // === GUARDAR PRESUPUESTO ===
  const guardarPresupuesto = () => {
    if (!paciente.apellido || !paciente.nombre || !paciente.dni) {
      alert('Complete los datos del paciente');
      return;
    }

    if (practicasAgregadas.length === 0) {
      alert('Agregue al menos una práctica');
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
      totales: { ...calcularTotales },
      estado: 'borrador'
    };

    // Guardar en localStorage
    const guardados = JSON.parse(localStorage.getItem('presupuestosClinica') || '[]');
    guardados.push(nuevoPresupuesto);
    localStorage.setItem('presupuestosClinica', JSON.stringify(guardados));
    setPresupuestos(guardados);

    alert('Presupuesto guardado exitosamente');
  };

  // === GENERAR EXCEL ===
  const generarExcel = () => {
    if (!paciente.apellido || practicasAgregadas.length === 0) {
      alert('Complete datos del paciente y agregue prácticas');
      return;
    }

    const wb = XLSX.utils.book_new();
    
    // Hoja principal
    const hojaData = [
      ['FACTURA CLÍNICA'],
      [`Convenio: ${convenioPeriodo || 'No seleccionado'}`],
      [`Fecha: ${new Date().toLocaleString('es-AR')}`],
      [],
      ['DATOS DEL PACIENTE'],
      ['Apellido y Nombre', `${paciente.apellido}, ${paciente.nombre}`],
      ['DNI', paciente.dni],
      ['ART/Seguro', paciente.artSeguro],
      ['N° Siniestro', paciente.nroSiniestro],
      [],
      ['DETALLE DE PRÁCTICAS'],
      ['COD INT.', 'PRÁCTICA', 'CÓDIGO', 'GAL', 'HON. MÉDICO', 'GTO', 'GTO SANATORIAL', 'CANT.', 'SUB HON.', 'SUB GTOS.', 'TOTAL']
    ];

    // Agregar prácticas
    practicasAgregadas.forEach(p => {
      hojaData.push([
        p.codInt,
        p.practica,
        p.codigo,
        p.gal,
        p.honMedico,
        p.gto,
        p.gtoSanatorial,
        p.cantidad,
        p.subtotalHonorarios,
        p.subtotalGastos,
        p.total
      ]);
    });

    // Totales
    hojaData.push(
      [],
      ['RESUMEN DE TOTALES'],
      ['', '', '', '', '', '', '', '', 'TOTAL HONORARIOS:', calcularTotales.totalHonorarios],
      ['', '', '', '', '', '', '', '', 'TOTAL GASTOS:', calcularTotales.totalGastos],
      ['', '', '', '', '', '', '', '', 'TOTAL GENERAL:', calcularTotales.totalGeneral]
    );

    const ws = XLSX.utils.aoa_to_sheet(hojaData);
    XLSX.utils.book_append_sheet(wb, ws, 'Factura');

    // Hoja de resumen de convenio
    if (convenioData?.valores_generales) {
      const convenioDataSheet = [
        ['VALORES DEL CONVENIO'],
        [`Convenio: ${convenioPeriodo}`],
        [],
        ['ITEM', 'VALOR']
      ];

      Object.entries(convenioData.valores_generales).forEach(([key, value]) => {
        convenioDataSheet.push([key, value]);
      });

      const ws2 = XLSX.utils.aoa_to_sheet(convenioDataSheet);
      XLSX.utils.book_append_sheet(wb, ws2, 'Convenio');
    }

    const nombreArchivo = `Factura_${paciente.apellido}_${paciente.nombre}_${Date.now()}.xlsx`;
    XLSX.writeFile(wb, nombreArchivo);
  };

  // === CARGAR PACIENTE DESDE JSON ===
  const cargarPacienteDesdeJson = async () => {
    try {
      const response = await fetch('/datos-clini-default-rtdb-export.json');
      const data = await response.json();
      const pacientes = data.pacientes ? Object.values(data.pacientes) : [];
      
      if (pacientes.length > 0) {
        const pacienteData = pacientes[0]; // Tomar el primero como ejemplo
        setPaciente({
          apellido: pacienteData.trabajador?.apellido || '',
          nombre: pacienteData.trabajador?.nombre || '',
          artSeguro: pacienteData.ART?.nombre || '',
          nroSiniestro: pacienteData.ART?.nroSiniestro || '',
          dni: pacienteData.trabajador?.dni || ''
        });
        setMostrarBuscador(false);
      }
    } catch (error) {
      console.error('Error cargando paciente:', error);
    }
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
          className={`${styles.tabNav} ${activeTab === 'resumen' ? styles.tabNavActive : ''}`}
          onClick={() => setActiveTab('resumen')}
          disabled={practicasAgregadas.length === 0}
        >
          📊 Resumen
        </button>
      </div>

      {/* === TAB: CONVENIO === */}
      {activeTab === 'convenio' && (
        <div className={styles.card}>
          <h3>📋 Selección de Convenio</h3>
          
          {/* Tipo de convenio */}
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

          {/* Período del convenio */}
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

          {/* Info del convenio cargado */}
          {convenioData && (
            <div className={styles.infoConvenio}>
              <h4>✅ Convenio seleccionado:</h4>
              <p><strong>Nombre:</strong> {convenioPeriodo}</p>
              <div className={styles.valoresDestacados}>
                <div className={styles.valorItem}>
                  <span>Galeno Rx:</span>
                  <strong>{convenioData.valores_generales?.Galeno_Rx_Practica || 
                           convenioData.valores_generales?.Galeno_Rx_y_Practica || 0}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Gasto Rx:</span>
                  <strong>{convenioData.valores_generales?.Gasto_Rx || 0}</strong>
                </div>
                <div className={styles.valorItem}>
                  <span>Consulta:</span>
                  <strong>{convenioData.valores_generales?.Consulta || 0}</strong>
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
          
          <div className={styles.botonesAcceso}>
            <button 
              className={styles.btnAcceso}
              onClick={() => setMostrarBuscador(!mostrarBuscador)}
            >
              {mostrarBuscador ? '✖️ Cerrar buscador' : '🔍 Buscar paciente existente'}
            </button>
            <button 
              className={styles.btnAcceso}
              onClick={cargarPacienteDesdeJson}
            >
              📋 Cargar paciente de prueba
            </button>
          </div>

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
          
          {!convenioData && (
            <div className={styles.alerta}>
              ⚠️ Primero debe seleccionar un convenio en la pestaña "Convenio"
            </div>
          )}

          <div className={styles.buscadorPracticas}>
            <input
              type="text"
              placeholder="Buscar práctica por código o descripción..."
              value={filtroPracticas}
              onChange={(e) => setFiltroPracticas(e.target.value)}
              className={styles.inputBusqueda}
              disabled={!convenioData}
            />
          </div>

          {/* Tabla de prácticas */}
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
                  <th>GTO SANATORIAL</th>
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
                      {p.formula === 'rx' ? (
                        <span className={styles.calculado}>CALCULADO</span>
                      ) : p.gtoSanatorial}
                    </td>
                    <td>
                      <button 
                        className={styles.btnAgregar}
                        onClick={() => agregarPractica(p)}
                        disabled={!convenioData}
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
              onClick={() => setActiveTab('resumen')}
              disabled={practicasAgregadas.length === 0}
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
          </div>

          {/* Prácticas agregadas */}
          {practicasAgregadas.length > 0 && (
            <div className={styles.tablaAgregadas}>
              <table className={styles.tabla}>
                <thead>
                  <tr>
                    <th>CÓD INT.</th>
                    <th>PRÁCTICA</th>
                    <th>CANT.</th>
                    <th>HON. MÉDICO</th>
                    <th>GTO SANAT.</th>
                    <th>SUB HON.</th>
                    <th>SUB GTOS.</th>
                    <th>TOTAL</th>
                    <th>ACCIÓN</th>
                  </tr>
                </thead>
                <tbody>
                  {practicasAgregadas.map(p => (
                    <tr key={p.id}>
                      <td>{p.codInt}</td>
                      <td>{p.practica}</td>
                      <td>
                        <input
                          type="number"
                          min="1"
                          value={p.cantidad}
                          onChange={(e) => actualizarCantidad(p.id, parseInt(e.target.value) || 1)}
                          className={styles.inputCantidad}
                        />
                      </td>
                      <td>${p.honMedico.toLocaleString('es-AR')}</td>
                      <td>${p.gtoSanatorial.toLocaleString('es-AR')}</td>
                      <td>${p.subtotalHonorarios.toLocaleString('es-AR')}</td>
                      <td>${p.subtotalGastos.toLocaleString('es-AR')}</td>
                      <td>${p.total.toLocaleString('es-AR')}</td>
                      <td>
                        <button 
                          className={styles.btnEliminar}
                          onClick={() => eliminarPractica(p.id)}
                        >
                          ❌
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totales */}
          <div className={styles.totales}>
            <h4>💰 Resumen Financiero</h4>
            <div className={styles.lineaTotal}>
              <span>Total Honorarios Médicos:</span>
              <span>${calcularTotales.totalHonorarios.toLocaleString('es-AR')}</span>
            </div>
            <div className={styles.lineaTotal}>
              <span>Total Gastos Sanatoriales:</span>
              <span>${calcularTotales.totalGastos.toLocaleString('es-AR')}</span>
            </div>
            <div className={styles.lineaTotalPrincipal}>
              <strong>TOTAL GENERAL:</strong>
              <strong>${calcularTotales.totalGeneral.toLocaleString('es-AR')}</strong>
            </div>
          </div>

          {/* Botones de acción */}
          <div className={styles.botonesAccion}>
            <button 
              className={styles.btnAtras}
              onClick={() => setActiveTab('practicas')}
            >
              ← Volver a Prácticas
            </button>
            <button 
              className={styles.btnGuardar}
              onClick={guardarPresupuesto}
              disabled={!paciente.apellido || practicasAgregadas.length === 0}
            >
              💾 Guardar Presupuesto
            </button>
            <button 
              className={styles.btnExcel}
              onClick={generarExcel}
              disabled={practicasAgregadas.length === 0}
            >
              📊 Generar Excel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
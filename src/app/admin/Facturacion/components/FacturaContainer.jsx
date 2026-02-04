'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConvenio } from './ConvenioContext';
import DatosPaciente from './DatosPaciente';
import PracticasModule from './PracticasModule';
import LaboratoriosModule from './LaboratoriosModule';
import MedicamentosModule from './MedicamentosModule';
import ResumenFactura from './ResumenFactura';
import styles from './facturacion.module.css';

// Función money local
const money = (n) => {
  if (n == null || n === '' || n === '-' || n === undefined) return '—';
  const num = typeof n === 'number' ? n : parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('es-AR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

// Claves para localStorage
const STORAGE_KEYS = {
  PACIENTE: 'facturacion_paciente',
  PRACTICAS: 'facturacion_practicas',
  LABORATORIOS: 'facturacion_laboratorios',
  MEDICAMENTOS: 'facturacion_medicamentos',
  DESCARTABLES: 'facturacion_descartables',
  TAB_ACTIVA: 'facturacion_tab_activa'
};

export default function FacturaContainer() {
  const { convenios, convenioSel, valoresConvenio, cambiarConvenio, loading } = useConvenio();
  
  // Estado para manejar si estamos en el cliente
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  // Cargar estado desde localStorage SOLO en el cliente
  const loadFromStorage = () => {
    if (!isClient) {
      return {
        paciente: {
          nombreCompleto: '',
          dni: '',
          artSeguro: '',
          nroSiniestro: '',
          fechaAtencion: new Date().toISOString().split('T')[0]
        },
        practicas: [],
        laboratorios: [],
        medicamentos: [],
        descartables: [],
        tabActiva: 'datos'
      };
    }
    
    try {
      const paciente = JSON.parse(localStorage.getItem(STORAGE_KEYS.PACIENTE)) || {
        nombreCompleto: '',
        dni: '',
        artSeguro: '',
        nroSiniestro: '',
        fechaAtencion: new Date().toISOString().split('T')[0]
      };
      
      const practicas = JSON.parse(localStorage.getItem(STORAGE_KEYS.PRACTICAS)) || [];
      const laboratorios = JSON.parse(localStorage.getItem(STORAGE_KEYS.LABORATORIOS)) || [];
      const medicamentos = JSON.parse(localStorage.getItem(STORAGE_KEYS.MEDICAMENTOS)) || [];
      const descartables = JSON.parse(localStorage.getItem(STORAGE_KEYS.DESCARTABLES)) || [];
      const tabActiva = localStorage.getItem(STORAGE_KEYS.TAB_ACTIVA) || 'datos';
      
      return { paciente, practicas, laboratorios, medicamentos, descartables, tabActiva };
    } catch (error) {
      console.error('Error cargando datos del storage:', error);
      return {
        paciente: {
          nombreCompleto: '',
          dni: '',
          artSeguro: '',
          nroSiniestro: '',
          fechaAtencion: new Date().toISOString().split('T')[0]
        },
        practicas: [],
        laboratorios: [],
        medicamentos: [],
        descartables: [],
        tabActiva: 'datos'
      };
    }
  };

  const { paciente: loadedPaciente, practicas: loadedPracticas, laboratorios: loadedLaboratorios, 
          medicamentos: loadedMedicamentos, descartables: loadedDescartables, tabActiva: loadedTab } = loadFromStorage();

  const [activeTab, setActiveTab] = useState(loadedTab);
  const [paciente, setPaciente] = useState(loadedPaciente);
  const [practicas, setPracticas] = useState(loadedPracticas);
  const [laboratorios, setLaboratorios] = useState(loadedLaboratorios);
  const [medicamentos, setMedicamentos] = useState(loadedMedicamentos);
  const [descartables, setDescartables] = useState(loadedDescartables);

  // Guardar en localStorage cuando cambien los datos (solo en cliente)
  useEffect(() => {
    if (!isClient) return;
    
    const saveToStorage = () => {
      try {
        localStorage.setItem(STORAGE_KEYS.PACIENTE, JSON.stringify(paciente));
        localStorage.setItem(STORAGE_KEYS.PRACTICAS, JSON.stringify(practicas));
        localStorage.setItem(STORAGE_KEYS.LABORATORIOS, JSON.stringify(laboratorios));
        localStorage.setItem(STORAGE_KEYS.MEDICAMENTOS, JSON.stringify(medicamentos));
        localStorage.setItem(STORAGE_KEYS.DESCARTABLES, JSON.stringify(descartables));
        localStorage.setItem(STORAGE_KEYS.TAB_ACTIVA, activeTab);
      } catch (error) {
        console.error('Error guardando en storage:', error);
      }
    };
    
    saveToStorage();
  }, [paciente, practicas, laboratorios, medicamentos, descartables, activeTab, isClient]);

  // Función para setPaciente que también guarda en storage
  const handleSetPaciente = (nuevosDatos) => {
    setPaciente(nuevosDatos);
  };

  // Funciones para agregar items con persistencia
  const agregarPractica = (nuevaPractica) => {
    setPracticas(prev => [...prev, nuevaPractica]);
  };

  const agregarLaboratorio = (nuevoLaboratorio) => {
    setLaboratorios(prev => [...prev, nuevoLaboratorio]);
  };

  const agregarMedicamento = (nuevoMedicamento) => {
    setMedicamentos(prev => [...prev, nuevoMedicamento]);
  };

  const agregarDescartable = (nuevoDescartable) => {
    setDescartables(prev => [...prev, nuevoDescartable]);
  };

  // Función para actualizar cantidades
  const actualizarCantidad = (tipo, id, cantidad) => {
    if (cantidad < 1) return;
    
    const actualizar = (items, setItems) => {
      return setItems(items.map(item => 
        item.id === id ? {
          ...item,
          cantidad: cantidad,
          total: (item.total / (item.cantidad || 1)) * cantidad,
          ...(item.honorarioMedico && {
            honorarioMedico: (item.honorarioMedico / (item.cantidad || 1)) * cantidad,
            gastoSanatorial: (item.gastoSanatorial / (item.cantidad || 1)) * cantidad
          })
        } : item
      ));
    };
    
    switch(tipo) {
      case 'practica':
        actualizar(practicas, setPracticas);
        break;
      case 'laboratorio':
        actualizar(laboratorios, setLaboratorios);
        break;
      case 'medicamento':
        actualizar(medicamentos, setMedicamentos);
        break;
      case 'descartable':
        actualizar(descartables, setDescartables);
        break;
    }
  };

  // Función para eliminar items
  const eliminarItem = (tipo, id) => {
    switch(tipo) {
      case 'practica':
        setPracticas(prev => prev.filter(p => p.id !== id));
        break;
      case 'laboratorio':
        setLaboratorios(prev => prev.filter(l => l.id !== id));
        break;
      case 'medicamento':
        setMedicamentos(prev => prev.filter(m => m.id !== id));
        break;
      case 'descartable':
        setDescartables(prev => prev.filter(d => d.id !== id));
        break;
    }
  };

  // Limpiar factura completamente
  const limpiarFactura = () => {
    if (!isClient) return;
    
    if (window.confirm('¿Está seguro de que desea limpiar toda la factura? Se perderán todos los datos.')) {
      setPracticas([]);
      setLaboratorios([]);
      setMedicamentos([]);
      setDescartables([]);
      setPaciente({
        nombreCompleto: '',
        dni: '',
        artSeguro: '',
        nroSiniestro: '',
        fechaAtencion: new Date().toISOString().split('T')[0]
      });
      setActiveTab('datos');
      
      // Limpiar localStorage
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    }
  };

  // Función para cerrar siniestro (exportar y limpiar)
  const cerrarSiniestro = () => {
    if (!isClient) return;
    
    if (!paciente.nombreCompleto || !paciente.dni) {
      alert('Complete los datos del paciente primero');
      setActiveTab('datos');
      return;
    }
    
    if (window.confirm('¿Está seguro de que desea cerrar este siniestro? Se generará el archivo y se limpiarán los datos.')) {
      // Aquí iría la lógica para generar el archivo Excel
      generarExcel();
      
      // Limpiar todo después de exportar
      limpiarFactura();
    }
  };

  // Función para generar Excel (placeholder)
  const generarExcel = () => {
    if (!isClient) return;
    alert('Función generar Excel se implementará aquí');
    // Implementar lógica de exportación a Excel
  };

  // Función para cargar siniestro existente
  const cargarSiniestro = (datos) => {
    if (!isClient) return;
    
    if (window.confirm('¿Cargar este siniestro? Se perderán los datos actuales.')) {
      setPaciente(datos.paciente || {});
      setPracticas(datos.practicas || []);
      setLaboratorios(datos.laboratorios || []);
      setMedicamentos(datos.medicamentos || []);
      setDescartables(datos.descartables || []);
      setActiveTab(datos.tabActiva || 'datos');
    }
  };

  // Guardar siniestro con nombre
  const guardarSiniestro = (nombre) => {
    if (!isClient) return;
    
    const siniestro = {
      id: Date.now(),
      nombre: nombre || `Siniestro_${new Date().toLocaleString()}`,
      fecha: new Date().toISOString(),
      paciente,
      practicas,
      laboratorios,
      medicamentos,
      descartables,
      tabActiva: activeTab,
      convenio: convenioSel
    };
    
    try {
      const siniestros = JSON.parse(localStorage.getItem('facturacion_siniestros')) || [];
      siniestros.push(siniestro);
      localStorage.setItem('facturacion_siniestros', JSON.stringify(siniestros));
      alert(`Siniestro guardado como: ${siniestro.nombre}`);
    } catch (error) {
      console.error('Error guardando siniestro:', error);
      alert('Error al guardar el siniestro');
    }
  };

  // Helper function para manejar disabled de manera consistente
  const isButtonDisabled = (condition) => {
    // En el servidor, siempre retornar false
    if (!isClient) return false;
    
    // En el cliente, usar undefined cuando es false para evitar hidratación
    return condition ? true : undefined;
  };

  // Determinar si los tabs deben estar deshabilitados
  const shouldDisableTabs = activeTab !== 'datos' && (!paciente.nombreCompleto || !paciente.dni);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>🧾 Sistema de Facturación Clínica</h1>
          
          {/* Botones de guardar/cargar */}
          <div className={styles.headerActions}>
            <button 
              className={styles.btnSecundario}
              onClick={() => {
                if (!isClient) return;
                const nombre = prompt('Nombre del siniestro:');
                if (nombre) guardarSiniestro(nombre);
              }}
              title="Guardar siniestro actual"
              disabled={!isClient}
            >
              {isClient ? '💾 Guardar' : 'Cargando...'}
            </button>
            
            <button 
              className={styles.btnSecundario}
              onClick={limpiarFactura}
              title="Limpiar todo"
              disabled={!isClient}
            >
              {isClient ? '🗑️ Limpiar' : 'Cargando...'}
            </button>
            
            <button 
              className={styles.btnPrimario}
              onClick={cerrarSiniestro}
              disabled={isButtonDisabled(!paciente.nombreCompleto || !paciente.dni)}
              title="Cerrar siniestro y generar archivo"
            >
              {isClient ? '✅ Cerrar Siniestro' : 'Cargando...'}
            </button>
          </div>
        </div>

        <div className={styles.convenioInfo}>
          <div className={styles.convenioSelector}>
            <label>Convenio:</label>
            <select 
              value={convenioSel} 
              onChange={(e) => cambiarConvenio(e.target.value)}
              disabled={loading || !isClient}
              className={styles.select}
            >
              {loading || !isClient ? (
                <option>Cargando convenios...</option>
              ) : (
                Object.keys(convenios).map(k => (
                  <option key={k} value={k}>
                    {convenios[k]?.nombre || k}
                  </option>
                ))
              )}
            </select>
          </div>
          
          {valoresConvenio && isClient && (
            <div className={styles.convenioValores}>
              <div className={styles.valorItem}>
                <span>Galeno Rx:</span>
                <strong>${money(valoresConvenio.galenoRx)}</strong>
              </div>
              <div className={styles.valorItem}>
                <span>Gasto Rx:</span>
                <strong>${money(valoresConvenio.gastoRx)}</strong>
              </div>
              <div className={styles.valorItem}>
                <span>Galeno Quir:</span>
                <strong>${money(valoresConvenio.galenoQuir)}</strong>
              </div>
              <div className={styles.valorItem}>
                <span>Gasto Op:</span>
                <strong>${money(valoresConvenio.gastoOperatorio)}</strong>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Tabs de navegación */}
      <div className={styles.tabs}>
        {['datos', 'practicas', 'laboratorios', 'medicamentos', 'resumen'].map((tab) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === tab ? styles.activeTab : ''}`}
            onClick={() => isClient && setActiveTab(tab)}
            disabled={isButtonDisabled(tab !== 'datos' && (!paciente.nombreCompleto || !paciente.dni))}
          >
            {tab === 'datos' && '👤 Datos Paciente'}
            {tab === 'practicas' && '🏥 Prácticas'}
            {tab === 'laboratorios' && '🧪 Laboratorios'}
            {tab === 'medicamentos' && '💊 Medicamentos'}
            {tab === 'resumen' && '📋 Resumen Factura'}
          </button>
        ))}
      </div>

      {/* Contenido de las tabs */}
      <div className={styles.content}>
        <AnimatePresence mode="wait">
          {activeTab === 'datos' && (
            <motion.div
              key="datos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <DatosPaciente
                paciente={paciente}
                setPaciente={handleSetPaciente}
                onSiguiente={() => {
                  if (isClient) {
                    console.log('Navegando a prácticas...');
                    setActiveTab('practicas');
                  }
                }}
              />
            </motion.div>
          )}

          {activeTab === 'practicas' && (
            <motion.div
              key="practicas"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <PracticasModule
                practicasAgregadas={practicas}
                agregarPractica={agregarPractica}
                onAtras={() => isClient && setActiveTab('datos')}
                onSiguiente={() => isClient && setActiveTab('laboratorios')}
              />
            </motion.div>
          )}

          {activeTab === 'laboratorios' && (
            <motion.div
              key="laboratorios"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <LaboratoriosModule
                laboratoriosAgregados={laboratorios}
                agregarLaboratorio={agregarLaboratorio}
                onAtras={() => isClient && setActiveTab('practicas')}
                onSiguiente={() => isClient && setActiveTab('medicamentos')}
              />
            </motion.div>
          )}

          {activeTab === 'medicamentos' && (
            <motion.div
              key="medicamentos"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <MedicamentosModule
                medicamentosAgregados={medicamentos}
                descartablesAgregados={descartables}
                agregarMedicamento={agregarMedicamento}
                agregarDescartable={agregarDescartable}
                onAtras={() => isClient && setActiveTab('laboratorios')}
                onSiguiente={() => isClient && setActiveTab('resumen')}
              />
            </motion.div>
          )}

          {activeTab === 'resumen' && (
            <motion.div
              key="resumen"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <ResumenFactura
                paciente={paciente}
                practicas={practicas}
                laboratorios={laboratorios}
                medicamentos={medicamentos}
                descartables={descartables}
                actualizarCantidad={actualizarCantidad}
                eliminarItem={eliminarItem}
                limpiarFactura={limpiarFactura}
                onAtras={() => isClient && setActiveTab('medicamentos')}
                generarExcel={generarExcel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Información de autoguardado */}
      <div className={styles.autoSaveInfo}>
        <small>
          {isClient ? '💾 Los datos se guardan automáticamente. Se mantendrán hasta que cierre el siniestro.' : 'Cargando...'}
        </small>
      </div>
    </div>
  );
}
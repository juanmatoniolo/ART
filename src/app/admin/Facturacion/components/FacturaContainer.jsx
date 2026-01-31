// src/app/admin/facturacion/FacturaContainer.jsx
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConvenio } from './ConvenioContext';
import DatosPaciente from './DatosPaciente';
import PracticasModule from './PracticasModule';
import LaboratoriosModule from './LaboratoriosModule';
import MedicamentosModule from './MedicamentosModule';
import ResumenFactura from './ResumenFactura';
import styles from './facturacion.module.css';

// Función money que falta
const money = (n) => {
  if (n == null || n === '' || n === '-' || n === undefined) return '—';
  const num = typeof n === 'number' ? n : parseFloat(n);
  if (isNaN(num)) return '—';
  return num.toLocaleString('es-AR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

export default function FacturaContainer() {
  const { convenios, convenioSel, valoresConvenio, cambiarConvenio, loading } = useConvenio();
  const [activeTab, setActiveTab] = useState('datos');
  
  // Estado del paciente
  const [paciente, setPaciente] = useState({
    apellido: '',
    nombre: '',
    dni: '',
    artSeguro: '',
    nroSiniestro: '',
    fechaAtencion: new Date().toISOString().split('T')[0]
  });
  
  // Estados para los items
  const [practicas, setPracticas] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [descartables, setDescartables] = useState([]);

  // Funciones para manejar los tabs
  const handleSiguiente = () => {
    const tabs = ['datos', 'practicas', 'laboratorios', 'medicamentos', 'resumen'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    }
  };

  const handleAtras = () => {
    const tabs = ['datos', 'practicas', 'laboratorios', 'medicamentos', 'resumen'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  // Funciones para agregar items
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

  // Limpiar factura
  const limpiarFactura = () => {
    if (window.confirm('¿Está seguro de que desea limpiar toda la factura?')) {
      setPracticas([]);
      setLaboratorios([]);
      setMedicamentos([]);
      setDescartables([]);
      setPaciente({
        apellido: '',
        nombre: '',
        dni: '',
        artSeguro: '',
        nroSiniestro: '',
        fechaAtencion: new Date().toISOString().split('T')[0]
      });
      setActiveTab('datos');
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>🧾 Sistema de Facturación Clínica</h1>
        <div className={styles.convenioInfo}>
          <div className={styles.convenioSelector}>
            <label>Convenio:</label>
            <select 
              value={convenioSel} 
              onChange={(e) => cambiarConvenio(e.target.value)}
              disabled={loading}
              className={styles.select}
            >
              {loading ? (
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
          
          {valoresConvenio && (
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
            onClick={() => setActiveTab(tab)}
            disabled={tab !== 'datos' && (!paciente.apellido || !paciente.nombre || !paciente.dni)}
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
                setPaciente={setPaciente}
                onSiguiente={() => setActiveTab('practicas')}
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
                onAtras={() => setActiveTab('datos')}
                onSiguiente={() => setActiveTab('laboratorios')}
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
                onAtras={() => setActiveTab('practicas')}
                onSiguiente={() => setActiveTab('medicamentos')}
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
                onAtras={() => setActiveTab('laboratorios')}
                onSiguiente={() => setActiveTab('resumen')}
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
                onAtras={() => setActiveTab('medicamentos')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConvenio } from './ConvenioContext';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '../utils/storage';
import DatosPaciente from './DatosPaciente';
import PracticasModule from './PracticasModule';
import LaboratoriosModule from './LaboratoriosModule';
import MedicamentosModule from './MedicamentosModule';
import ResumenFactura from './ResumenFactura';
import styles from './facturacion.module.css';

const money = (n) => {
  if (n == null || n === '' || n === '-') return '—';
  const num = typeof n === 'number' ? n : parseFloat(n);
  return isNaN(num) ? '—' : num.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function FacturaContainer() {
  const { convenios, convenioSel, valoresConvenio, cambiarConvenio, loading } = useConvenio();
  const [isClient, setIsClient] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(true);

  useEffect(() => { setIsClient(true); }, []);

  // Estados iniciales
  const [activeTab, setActiveTab] = useState('datos');
  const [paciente, setPaciente] = useState({
    nombreCompleto: '',
    dni: '',
    artSeguro: '',
    nroSiniestro: '',
    fechaAtencion: new Date().toISOString().split('T')[0]
  });
  const [practicas, setPracticas] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [descartables, setDescartables] = useState([]);

  // Cargar desde localStorage al montar
  useEffect(() => {
    if (!isClient) return;
    setPaciente(getStorageItem(STORAGE_KEYS.PACIENTE, paciente));
    setPracticas(getStorageItem(STORAGE_KEYS.PRACTICAS, []));
    setLaboratorios(getStorageItem(STORAGE_KEYS.LABORATORIOS, []));
    setMedicamentos(getStorageItem(STORAGE_KEYS.MEDICAMENTOS, []));
    setDescartables(getStorageItem(STORAGE_KEYS.DESCARTABLES, []));
    setActiveTab(getStorageItem(STORAGE_KEYS.TAB_ACTIVA, 'datos'));
    setLoadingStorage(false);
  }, [isClient]);

  // Guardar automáticamente
  useEffect(() => {
    if (!isClient || loadingStorage) return;
    setStorageItem(STORAGE_KEYS.PACIENTE, paciente);
    setStorageItem(STORAGE_KEYS.PRACTICAS, practicas);
    setStorageItem(STORAGE_KEYS.LABORATORIOS, laboratorios);
    setStorageItem(STORAGE_KEYS.MEDICAMENTOS, medicamentos);
    setStorageItem(STORAGE_KEYS.DESCARTABLES, descartables);
    setStorageItem(STORAGE_KEYS.TAB_ACTIVA, activeTab);
  }, [paciente, practicas, laboratorios, medicamentos, descartables, activeTab, isClient, loadingStorage]);

  // Handlers
  const handleSetPaciente = (nuevosDatos) => setPaciente(nuevosDatos);
  const agregarPractica = (nueva) => setPracticas(prev => [...prev, nueva]);
  const agregarLaboratorio = (nuevo) => setLaboratorios(prev => [...prev, nuevo]);
  const agregarMedicamento = (nuevo) => setMedicamentos(prev => [...prev, nuevo]);
  const agregarDescartable = (nuevo) => setDescartables(prev => [...prev, nuevo]);

  // Actualizar cantidad (solo id y cantidad, detecta tipo automáticamente)
  const actualizarCantidad = (id, cantidad) => {
    if (cantidad < 1) return;
    const actualizarArray = (items, setItems) => {
      const index = items.findIndex(i => i.id === id);
      if (index === -1) return false;
      const item = items[index];
      const factor = cantidad / (item.cantidad || 1);
      const nuevoItem = {
        ...item,
        cantidad,
        total: item.total * factor,
        ...(item.honorarioMedico && { honorarioMedico: item.honorarioMedico * factor }),
        ...(item.gastoSanatorial && { gastoSanatorial: item.gastoSanatorial * factor })
      };
      setItems(prev => prev.map(i => i.id === id ? nuevoItem : i));
      return true;
    };

    if (actualizarArray(practicas, setPracticas)) return;
    if (actualizarArray(laboratorios, setLaboratorios)) return;
    if (actualizarArray(medicamentos, setMedicamentos)) return;
    if (actualizarArray(descartables, setDescartables)) return;
  };

  const eliminarItem = (id) => {
    setPracticas(prev => prev.filter(p => p.id !== id));
    setLaboratorios(prev => prev.filter(l => l.id !== id));
    setMedicamentos(prev => prev.filter(m => m.id !== id));
    setDescartables(prev => prev.filter(d => d.id !== id));
  };

  const limpiarFactura = () => {
    if (!isClient || !window.confirm('¿Limpiar toda la factura?')) return;
    setPracticas([]);
    setLaboratorios([]);
    setMedicamentos([]);
    setDescartables([]);
    setPaciente({ nombreCompleto: '', dni: '', artSeguro: '', nroSiniestro: '', fechaAtencion: new Date().toISOString().split('T')[0] });
    setActiveTab('datos');
    Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  };

  const cerrarSiniestro = () => {
    if (!isClient) return;
    if (!paciente.nombreCompleto || !paciente.dni) {
      alert('Complete los datos del paciente primero');
      setActiveTab('datos');
      return;
    }
    if (window.confirm('¿Cerrar siniestro? Se generará el archivo.')) {
      generarExcel();
      limpiarFactura();
    }
  };

  const generarExcel = () => alert('Función generar Excel se implementará aquí');

  const guardarSiniestro = (nombre) => {
    if (!isClient || !nombre) return;
    const siniestro = {
      id: Date.now(),
      nombre,
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
      const siniestros = getStorageItem(STORAGE_KEYS.SINIESTROS, []);
      siniestros.push(siniestro);
      setStorageItem(STORAGE_KEYS.SINIESTROS, siniestros);
      alert(`Siniestro guardado como: ${nombre}`);
    } catch (error) {
      console.error(error);
      alert('Error al guardar');
    }
  };

  if (!isClient || loadingStorage) {
    return <div className={styles.container}><div className={styles.loading}>Cargando datos...</div></div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>🧾 Sistema de Facturación Clínica</h1>
          <div className={styles.headerActions}>
            <button className={styles.btnSecundario} onClick={() => {
              const nombre = prompt('Nombre del siniestro:');
              if (nombre) guardarSiniestro(nombre);
            }}>💾 Guardar</button>
            <button className={styles.btnSecundario} onClick={limpiarFactura}>🗑️ Limpiar</button>
            <button className={styles.btnPrimario} onClick={cerrarSiniestro} disabled={!paciente.nombreCompleto || !paciente.dni}>✅ Cerrar Siniestro</button>
          </div>
        </div>

        <div className={styles.convenioInfo}>
          <div className={styles.convenioSelector}>
            <label>Convenio:</label>
            <select value={convenioSel} onChange={(e) => cambiarConvenio(e.target.value)} disabled={loading} className={styles.select}>
              {loading ? <option>Cargando convenios...</option> : Object.keys(convenios).map(k => (
                <option key={k} value={k}>{convenios[k]?.nombre || k}</option>
              ))}
            </select>
          </div>
          {valoresConvenio && (
            <div className={styles.convenioValores}>
              <div className={styles.valorItem}><span>Galeno Rx:</span><strong>${money(valoresConvenio.galenoRx)}</strong></div>
              <div className={styles.valorItem}><span>Gasto Rx:</span><strong>${money(valoresConvenio.gastoRx)}</strong></div>
              <div className={styles.valorItem}><span>Galeno Quir:</span><strong>${money(valoresConvenio.galenoQuir)}</strong></div>
              <div className={styles.valorItem}><span>Gasto Op:</span><strong>${money(valoresConvenio.gastoOperatorio)}</strong></div>
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
            disabled={tab !== 'datos' && (!paciente.nombreCompleto || !paciente.dni)}
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
              <DatosPaciente paciente={paciente} setPaciente={handleSetPaciente} onSiguiente={() => setActiveTab('practicas')} />
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
                generarExcel={generarExcel}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className={styles.autoSaveInfo}>
        <small>💾 Los datos se guardan automáticamente.</small>
      </div>
    </div>
  );
}
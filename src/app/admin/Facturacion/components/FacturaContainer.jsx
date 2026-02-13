'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useConvenio } from './ConvenioContext';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '../utils/storage';

import DatosPaciente from './DatosPaciente';
import PracticasModule from './PracticasModule';
import CirugiasModule from './CirugiasModule';
import LaboratoriosModule from './LaboratoriosModule';
import MedicamentosModule from './MedicamentosModule';
import ResumenFactura from './ResumenFactura';

import { calcularPractica, calcularLaboratorio, money as moneyFmt } from '../utils/calculos';
import styles from './facturacion.module.css';

const todayISO = () => new Date().toISOString().split('T')[0];

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

function aplicarPrestadorEnPractica(calculoBase, prestadorTipo) {
  const honor = safeNum(calculoBase?.honorarioMedico);
  const gasto = safeNum(calculoBase?.gastoSanatorial);

  if (prestadorTipo === 'Dr') {
    return { honorarioMedico: honor, gastoSanatorial: 0, total: honor };
  }
  return { honorarioMedico: 0, gastoSanatorial: gasto, total: gasto };
}

function recalcularPracticaConPrestador(item, valoresConvenio, prestadorTipo) {
  const base = calcularPractica(item, valoresConvenio);
  const aplicado = aplicarPrestadorEnPractica(base, prestadorTipo);
  return { ...item, ...base, ...aplicado, prestadorTipo };
}

function normalizarLab(item, valoresConvenio) {
  const calc = calcularLaboratorio(item, valoresConvenio);
  const total = safeNum(calc?.total);
  return {
    ...item,
    ...calc,
    honorarioMedico: total,
    gastoSanatorial: 0,
    total
  };
}

function normalizarMedDesc(item) {
  const cantidad = Math.max(1, safeNum(item?.cantidad) || 1);
  const unit = safeNum(item?.valorUnitario ?? item?.precio ?? 0);
  const total = unit * cantidad;
  return {
    ...item,
    cantidad,
    valorUnitario: unit,
    honorarioMedico: 0,
    gastoSanatorial: total,
    total
  };
}

export default function FacturaContainer() {
  const { convenios, convenioSel, valoresConvenio, cambiarConvenio, loading } = useConvenio();

  const [isClient, setIsClient] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(true);

  useEffect(() => setIsClient(true), []);

  const [activeTab, setActiveTab] = useState('datos');
  const [paciente, setPaciente] = useState({
    nombreCompleto: '',
    dni: '',
    artSeguro: '',
    nroSiniestro: '',
    fechaAtencion: todayISO()
  });

  const [practicas, setPracticas] = useState([]);
  const [cirugias, setCirugias] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [descartables, setDescartables] = useState([]);

  const totalItems = useMemo(
    () => practicas.length + cirugias.length + laboratorios.length + medicamentos.length + descartables.length,
    [practicas.length, cirugias.length, laboratorios.length, medicamentos.length, descartables.length]
  );

  // ===== Chips (valores del convenio) =====
  const chips = useMemo(() => {
    const galenoRx = safeNum(valoresConvenio?.galenoRx);
    const gastoRx = safeNum(valoresConvenio?.gastoRx);
    const gastoOperatorio = safeNum(valoresConvenio?.gastoOperatorio);
    const galenoQuir = safeNum(valoresConvenio?.galenoQuir);
    const diaPension =
      safeNum(valoresConvenio?.diaPension) ||
      safeNum(valoresConvenio?.pension) ||
      safeNum(valoresConvenio?.pensionDia);

    const otrosGastos = safeNum(valoresConvenio?.otrosGastos);
    const valorUB = safeNum(valoresConvenio?.valorUB);

    return { galenoRx, gastoRx, gastoOperatorio, galenoQuir, diaPension, otrosGastos, valorUB };
  }, [valoresConvenio]);

  // Load localStorage
  useEffect(() => {
    if (!isClient) return;

    setPaciente(getStorageItem(STORAGE_KEYS.PACIENTE, paciente));
    setPracticas(getStorageItem(STORAGE_KEYS.PRACTICAS, []));
    setCirugias(getStorageItem(STORAGE_KEYS.CIRUGIAS, []));
    setLaboratorios(getStorageItem(STORAGE_KEYS.LABORATORIOS, []));
    setMedicamentos(getStorageItem(STORAGE_KEYS.MEDICAMENTOS, []));
    setDescartables(getStorageItem(STORAGE_KEYS.DESCARTABLES, []));
    setActiveTab(getStorageItem(STORAGE_KEYS.TAB_ACTIVA, 'datos'));

    setLoadingStorage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient]);

  // Auto save
  useEffect(() => {
    if (!isClient || loadingStorage) return;

    setStorageItem(STORAGE_KEYS.PACIENTE, paciente);
    setStorageItem(STORAGE_KEYS.PRACTICAS, practicas);
    setStorageItem(STORAGE_KEYS.CIRUGIAS, cirugias);
    setStorageItem(STORAGE_KEYS.LABORATORIOS, laboratorios);
    setStorageItem(STORAGE_KEYS.MEDICAMENTOS, medicamentos);
    setStorageItem(STORAGE_KEYS.DESCARTABLES, descartables);
    setStorageItem(STORAGE_KEYS.TAB_ACTIVA, activeTab);
  }, [paciente, practicas, cirugias, laboratorios, medicamentos, descartables, activeTab, isClient, loadingStorage]);

  // Add handlers
  const agregarPractica = useCallback(
    (nueva) => {
      setPracticas((prev) => [...prev, nueva]);
    },
    []
  );

  const agregarCirugia = useCallback((nueva) => {
    setCirugias((prev) => [...prev, nueva]);
  }, []);

  const agregarLaboratorio = useCallback(
    (nuevo) => {
      const normal = valoresConvenio ? normalizarLab(nuevo, valoresConvenio) : nuevo;
      setLaboratorios((prev) => [...prev, normal]);
    },
    [valoresConvenio]
  );

  const agregarMedicamento = useCallback((nuevo) => {
    setMedicamentos((prev) => [...prev, normalizarMedDesc(nuevo)]);
  }, []);

  const agregarDescartable = useCallback((nuevo) => {
    setDescartables((prev) => [...prev, normalizarMedDesc(nuevo)]);
  }, []);

  // actualizarCantidad
  const actualizarCantidad = useCallback(
    (id, cantidad) => {
      const c = Math.max(1, Number(cantidad) || 1);

      const actualizarArray = (items, setItems) => {
        const index = items.findIndex((i) => i.id === id);
        if (index === -1) return false;

        const item = items[index];
        const oldC = Math.max(1, Number(item.cantidad) || 1);
        const factor = c / oldC;

        const next = {
          ...item,
          cantidad: c,
          total: safeNum(item.total) * factor,
          ...(item.honorarioMedico != null && { honorarioMedico: safeNum(item.honorarioMedico) * factor }),
          ...(item.gastoSanatorial != null && { gastoSanatorial: safeNum(item.gastoSanatorial) * factor })
        };

        setItems((prev) => prev.map((x) => (x.id === id ? next : x)));
        return true;
      };

      if (actualizarArray(practicas, setPracticas)) return;
      if (actualizarArray(cirugias, setCirugias)) return;
      if (actualizarArray(laboratorios, setLaboratorios)) return;
      if (actualizarArray(medicamentos, setMedicamentos)) return;
      if (actualizarArray(descartables, setDescartables)) return;
    },
    [practicas, cirugias, laboratorios, medicamentos, descartables]
  );

  // actualizarItem (Dr/Clínica + nombres)
  const actualizarItem = useCallback(
    (id, patch) => {
      const applyIn = (items, setItems, kind) => {
        const idx = items.findIndex((x) => x.id === id);
        if (idx === -1) return false;

        const current = items[idx];
        const merged = { ...current, ...patch };

        if (kind === 'practica') {
          if (!valoresConvenio) {
            setItems((prev) => prev.map((x) => (x.id === id ? merged : x)));
            return true;
          }
          const prestadorTipo = merged.prestadorTipo || 'Clinica';
          const recalculada = recalcularPracticaConPrestador(merged, valoresConvenio, prestadorTipo);
          setItems((prev) => prev.map((x) => (x.id === id ? recalculada : x)));
          return true;
        }

        if (kind === 'laboratorio') {
          if (!valoresConvenio) {
            const total = safeNum(merged.total);
            setItems((prev) => prev.map((x) => (x.id === id ? { ...merged, honorarioMedico: total, gastoSanatorial: 0 } : x)));
            return true;
          }
          const normal = normalizarLab(merged, valoresConvenio);
          setItems((prev) => prev.map((x) => (x.id === id ? normal : x)));
          return true;
        }

        if (kind === 'medicamento' || kind === 'descartable' || kind === 'cirugia') {
          const normal = normalizarMedDesc(merged);
          setItems((prev) => prev.map((x) => (x.id === id ? normal : x)));
          return true;
        }

        setItems((prev) => prev.map((x) => (x.id === id ? merged : x)));
        return true;
      };

      if (applyIn(practicas, setPracticas, 'practica')) return;
      if (applyIn(cirugias, setCirugias, 'cirugia')) return;
      if (applyIn(laboratorios, setLaboratorios, 'laboratorio')) return;
      if (applyIn(medicamentos, setMedicamentos, 'medicamento')) return;
      if (applyIn(descartables, setDescartables, 'descartable')) return;
    },
    [practicas, cirugias, laboratorios, medicamentos, descartables, valoresConvenio]
  );

  const eliminarItem = useCallback((id) => {
    setPracticas((prev) => prev.filter((p) => p.id !== id));
    setCirugias((prev) => prev.filter((c) => c.id !== id));
    setLaboratorios((prev) => prev.filter((l) => l.id !== id));
    setMedicamentos((prev) => prev.filter((m) => m.id !== id));
    setDescartables((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const limpiarFactura = useCallback(() => {
    if (!isClient || !window.confirm('¿Limpiar toda la factura?')) return;

    setPracticas([]);
    setCirugias([]);
    setLaboratorios([]);
    setMedicamentos([]);
    setDescartables([]);
    setPaciente({ nombreCompleto: '', dni: '', artSeguro: '', nroSiniestro: '', fechaAtencion: todayISO() });
    setActiveTab('datos');

    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }, [isClient]);

  const guardarSiniestro = useCallback(
    (nombre) => {
      if (!isClient || !nombre) return;

      const siniestro = {
        id: Date.now(),
        nombre,
        fecha: new Date().toISOString(),
        paciente,
        practicas,
        cirugias,
        laboratorios,
        medicamentos,
        descartables,
        tabActiva: activeTab,
        convenio: convenioSel
      };

      const siniestros = getStorageItem(STORAGE_KEYS.SINIESTROS, []);
      siniestros.push(siniestro);
      setStorageItem(STORAGE_KEYS.SINIESTROS, siniestros);

      alert(`Siniestro guardado como: ${nombre}`);
    },
    [isClient, paciente, practicas, cirugias, laboratorios, medicamentos, descartables, activeTab, convenioSel]
  );

  const cerrarSiniestro = useCallback(async () => {
    if (!isClient) return;

    if (!paciente.nombreCompleto || !paciente.dni) {
      alert('Complete los datos del paciente primero');
      setActiveTab('datos');
      return;
    }

    const nombre = prompt('Nombre del siniestro (para guardar y exportar):', paciente.nombreCompleto || 'Siniestro');
    if (!nombre) return;

    const siniestro = {
      id: Date.now(),
      nombre,
      fecha: new Date().toISOString(),
      paciente,
      practicas,
      cirugias,
      laboratorios,
      medicamentos,
      descartables,
      tabActiva: activeTab,
      convenio: convenioSel
    };

    const siniestros = getStorageItem(STORAGE_KEYS.SINIESTROS, []);
    siniestros.push(siniestro);
    setStorageItem(STORAGE_KEYS.SINIESTROS, siniestros);

    alert('Siniestro cerrado y guardado.');
    limpiarFactura();
  }, [isClient, paciente, practicas, cirugias, laboratorios, medicamentos, descartables, activeTab, convenioSel, limpiarFactura]);

  const puedeNavegar = Boolean(paciente.nombreCompleto && paciente.dni);

  const tabs = [
    { key: 'datos', label: '👤 Datos Paciente' },
    { key: 'practicas', label: '🏥 Prácticas' },
    { key: 'cirugias', label: '🩺 Cirugías' },
    { key: 'laboratorios', label: '🧪 Laboratorios' },
    { key: 'medicamentos', label: '💊 Medicamentos' },
    { key: 'resumen', label: '📋 Resumen' }
  ];

  if (!isClient || loadingStorage) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Cargando datos...</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Sistema de Facturación Clínica</h1>
            <p className={styles.subtitle}>Carga rápida, desglose por Dr/Clínica y exportación.</p>
          </div>

          <div className={styles.headerActions}>
            <button
              className={styles.btnSecundario}
              onClick={() => {
                const nombre = prompt('Nombre del siniestro:');
                if (nombre) guardarSiniestro(nombre);
              }}
            >
              💾 Guardar
            </button>

            <button className={styles.btnSecundario} onClick={limpiarFactura}>
              🗑️ Limpiar
            </button>

            <button
              className={styles.btnPrimario}
              onClick={cerrarSiniestro}
              disabled={!puedeNavegar}
              title={!puedeNavegar ? 'Complete nombre y DNI para cerrar el siniestro' : ''}
            >
              ✅ Cerrar Siniestro
            </button>
          </div>
        </div>

        <div className={styles.titleRow}>
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
                Object.keys(convenios).map((k) => (
                  <option key={k} value={k}>
                    {convenios[k]?.nombre || k}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className={styles.counterBadge}>
            {totalItems} {totalItems === 1 ? 'ítem' : 'ítems'} en factura
          </div>
        </div>

        {/* Chips de valores del convenio */}
        {valoresConvenio && (
          <div className={styles.chipsContainer}>
            <span className={`${styles.chip} ${styles.chipGastoRx}`}>
              <b>Gasto Rx</b> <span className={styles.chipValue}>{moneyFmt(chips.gastoRx)}</span>
            </span>
            <span className={`${styles.chip} ${styles.chipGalenoRx}`}>
              <b>Galeno Rx</b> <span className={styles.chipValue}>{moneyFmt(chips.galenoRx)}</span>
            </span>
            <span className={`${styles.chip} ${styles.chipGtoOperatorio}`}>
              <b>G. Oper.</b> <span className={styles.chipValue}>{moneyFmt(chips.gastoOperatorio)}</span>
            </span>
            <span className={`${styles.chip} ${styles.chipGalenoQuir}`}>
              <b>Gal. Quir.</b> <span className={styles.chipValue}>{moneyFmt(chips.galenoQuir)}</span>
            </span>
            <span className={`${styles.chip} ${styles.chipPension}`}>
              <b>Pensión</b> <span className={styles.chipValue}>{moneyFmt(chips.diaPension)}</span>
            </span>
            <span className={`${styles.chip} ${styles.chipUb}`}>
              <b>U.B.</b> <span className={styles.chipValue}>{moneyFmt(chips.valorUB)}</span>
            </span>
            <span className={`${styles.chip} ${styles.chipOtros}`}>
              <b>Otros</b> <span className={styles.chipValue}>{moneyFmt(chips.otrosGastos)}</span>
            </span>
          </div>
        )}
      </header>

      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`${styles.tab} ${activeTab === tab.key ? styles.activeTab : ''}`}
            onClick={() => setActiveTab(tab.key)}
            disabled={tab.key !== 'datos' && !puedeNavegar}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.content}>
        <AnimatePresence mode="wait">
          {activeTab === 'datos' && (
            <motion.div key="datos" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <DatosPaciente paciente={paciente} setPaciente={setPaciente} onSiguiente={() => setActiveTab('practicas')} />
            </motion.div>
          )}

          {activeTab === 'practicas' && (
            <motion.div key="practicas" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <PracticasModule
                practicasAgregadas={practicas}
                agregarPractica={agregarPractica}
                onAtras={() => setActiveTab('datos')}
                onSiguiente={() => setActiveTab('cirugias')}
              />
            </motion.div>
          )}

          {activeTab === 'cirugias' && (
            <motion.div key="cirugias" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <CirugiasModule
                cirugiasAgregadas={cirugias}
                agregarCirugia={agregarCirugia}
                onAtras={() => setActiveTab('practicas')}
                onSiguiente={() => setActiveTab('laboratorios')}
              />
            </motion.div>
          )}

          {activeTab === 'laboratorios' && (
            <motion.div key="laboratorios" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <LaboratoriosModule
                laboratoriosAgregados={laboratorios}
                agregarLaboratorio={agregarLaboratorio}
                onAtras={() => setActiveTab('cirugias')}
                onSiguiente={() => setActiveTab('medicamentos')}
              />
            </motion.div>
          )}

          {activeTab === 'medicamentos' && (
            <motion.div key="medicamentos" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
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
            <motion.div key="resumen" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <ResumenFactura
                paciente={paciente}
                practicas={practicas}
                cirugias={cirugias}
                laboratorios={laboratorios}
                medicamentos={medicamentos}
                descartables={descartables}
                actualizarCantidad={actualizarCantidad}
                actualizarItem={actualizarItem}
                eliminarItem={eliminarItem}
                limpiarFactura={limpiarFactura}
                onAtras={() => setActiveTab('medicamentos')}
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
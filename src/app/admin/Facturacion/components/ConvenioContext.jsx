// src/app/admin/facturacion/ConvenioContext.jsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';

const ConvenioContext = createContext(null);

export const useConvenio = () => {
  const context = useContext(ConvenioContext);
  if (!context) {
    throw new Error('useConvenio debe usarse dentro de ConvenioProvider');
  }
  return context;
};

// Función para extraer valores dinámicamente
const extraerValoresConvenio = (convenioData) => {
  if (!convenioData || !convenioData.valores_generales) {
    return {
      gastoRx: 1648,
      galenoRx: 1411,
      gastoOperatorio: 3281,
      galenoQuir: 1435.5,
      pension: 2838,
      otrosGastos: 0,
      valorUB: 1224.11,
      consulta: 34650,
      unidadBioquimica: 1224.11,
      _rawData: {},
      _convenioName: 'No seleccionado'
    };
  }

  const vg = convenioData.valores_generales;
  
  // Función para buscar valores con múltiples claves posibles
  const buscarValor = (claves, defaultValue = 0) => {
    for (const clave of claves) {
      if (vg[clave] != null && vg[clave] !== '') {
        // Convertir string a número si es necesario
        let valor = vg[clave];
        if (typeof valor === 'string') {
          // Limpiar formato de moneda
          valor = valor.replace(/[^\d.,-]/g, '').replace(',', '.');
          const num = parseFloat(valor);
          return isNaN(num) ? defaultValue : num;
        }
        return Number(valor) || defaultValue;
      }
    }
    return defaultValue;
  };

  return {
    gastoRx: buscarValor(['Gasto_Rx', 'Gastos_Rx', 'Gasto Rx', 'gasto_rx'], 1648),
    galenoRx: buscarValor(['Galeno_Rx_Practica', 'Galeno_Rx_y_Practica', 'Galeno_Rx', 'galeno_rx'], 1411),
    gastoOperatorio: buscarValor(['Gasto_Operatorio', 'Gasto Operatorio', 'gasto_operatorio', 'GASTOS_OPERATORIOS'], 3281),
    galenoQuir: buscarValor(['Galeno_Quir', 'Galeno Quir', 'Galeno_Quirurgico', 'galeno_quir', 'GALENO_QX'], 1435.5),
    pension: buscarValor(['PENSION', 'Pension', 'Dia_Pension', 'Día_Pensión', 'pension'], 2838),
    otrosGastos: buscarValor(['Otros_Gastos', 'Otros gastos', 'Otros_Gastos_Medicos', 'otros_gastos'], 0),
    consulta: buscarValor(['Consulta', 'consulta', 'CONSULTA'], 34650),
    valorUB: buscarValor([
      'Laboratorios_NBU_T',
      'Laboratorios_NBU',
      'Unidad_Bioquimica',
      'Unidad Bioquimica',
      'UB',
      'unidad_bioquimica'
    ], 1224.11),
    unidadBioquimica: buscarValor([
      'Laboratorios_NBU_T',
      'Laboratorios_NBU',
      'Unidad_Bioquimica',
      'Unidad Bioquimica',
      'UB'
    ], 1224.11),
    // Datos crudos para depuración
    _rawData: vg,
    _convenioName: convenioData.nombre || convenioData.key || 'No seleccionado'
  };
};

export const ConvenioProvider = ({ children }) => {
  const [convenios, setConvenios] = useState({});
  const [convenioSel, setConvenioSel] = useState('');
  const [convenioData, setConvenioData] = useState(null);
  const [valoresConvenio, setValoresConvenio] = useState(() => 
    extraerValoresConvenio(null)
  );
  const [loading, setLoading] = useState(true);

  // Cargar convenios desde Firebase
  useEffect(() => {
    const conveniosRef = ref(db, 'convenios');
    const unsub = onValue(conveniosRef, (snap) => {
      if (!snap.exists()) {
        console.log('No hay convenios en Firebase');
        setConvenios({});
        setLoading(false);
        return;
      }
      
      const val = snap.val();
      console.log('Convenios cargados:', Object.keys(val));
      setConvenios(val);
      
      const stored = localStorage.getItem('convenioActivoFacturacion');
      const elegir = stored && val[stored] ? stored : Object.keys(val)[0] || '';
      setConvenioSel(elegir);
      setLoading(false);
    }, (error) => {
      console.error('Error cargando convenios:', error);
      setLoading(false);
    });
    
    return () => unsub();
  }, []);

  // Actualizar valores cuando cambia el convenio seleccionado
  useEffect(() => {
    if (!convenioSel || !convenios[convenioSel]) {
      console.log('No hay convenio seleccionado o no existe');
      setConvenioData(null);
      setValoresConvenio(extraerValoresConvenio(null));
      return;
    }
    
    localStorage.setItem('convenioActivoFacturacion', convenioSel);
    const data = convenios[convenioSel];
    console.log('Convenio seleccionado:', convenioSel, data);
    setConvenioData(data);
    
    const nuevosValores = extraerValoresConvenio(data);
    console.log('Valores extraídos:', nuevosValores);
    setValoresConvenio(nuevosValores);
    
  }, [convenioSel, convenios]);

  const cambiarConvenio = (nuevoConvenio) => {
    console.log('Cambiando convenio a:', nuevoConvenio);
    setConvenioSel(nuevoConvenio);
  };

  // Función para forzar actualización de valores
  const actualizarValores = () => {
    if (convenioData) {
      const nuevosValores = extraerValoresConvenio(convenioData);
      setValoresConvenio(nuevosValores);
      return nuevosValores;
    }
    return valoresConvenio;
  };

  return (
    <ConvenioContext.Provider value={{
      convenios,
      convenioSel,
      convenioData,
      valoresConvenio,
      loading,
      cambiarConvenio,
      actualizarValores,
      // Valores individuales para acceso rápido
      get gastoRx() { return valoresConvenio.gastoRx; },
      get galenoRx() { return valoresConvenio.galenoRx; },
      get gastoOperatorio() { return valoresConvenio.gastoOperatorio; },
      get galenoQuir() { return valoresConvenio.galenoQuir; },
      get pension() { return valoresConvenio.pension; },
      get otrosGastos() { return valoresConvenio.otrosGastos; },
      get valorUB() { return valoresConvenio.valorUB; },
      get consulta() { return valoresConvenio.consulta; }
    }}>
      {children}
    </ConvenioContext.Provider>
  );
};
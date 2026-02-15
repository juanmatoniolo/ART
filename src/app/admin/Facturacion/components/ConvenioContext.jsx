// src/app/admin/facturacion/ConvenioContext.jsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';

const ConvenioContext = createContext(null);

export const useConvenio = () => {
  const context = useContext(ConvenioContext);
  if (!context) throw new Error('useConvenio debe usarse dentro de ConvenioProvider');
  return context;
};

/**
 * Convierte cualquier valor (string con coma/puntos, $ etc) a número.
 * (igual a tu parseNumber pero local para que este archivo sea autónomo)
 */
const toNumber = (val) => {
  if (val == null || val === '') return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;

  let s = String(val).trim().replace(/[^\d.,-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
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

      // ✅ NUEVO: curaciones fijo (si no hay convenio cargado)
      Curaciones_R: 0,

      unidadBioquimica: 1224.11,
      honorarios_medicos: [],
      _rawData: {},
      _convenioName: 'No seleccionado'
    };
  }

  const vg = convenioData.valores_generales;

  /**
   * Busca un valor dentro de vg por distintas claves.
   * - Importante: deja que 0 sea válido.
   */
  const buscarValor = (claves, defaultValue = 0) => {
    for (const clave of claves) {
      if (vg[clave] != null && vg[clave] !== '') {
        return toNumber(vg[clave]);
      }
    }
    return defaultValue;
  };

  /**
   * ✅ OPCIONAL PERO RECOMENDADO:
   * “Exponer” también TODOS los campos numéricos del convenio,
   * para que después puedas hacer más prácticas especiales sin tocar este archivo.
   */
  const extras = {};
  for (const [k, v] of Object.entries(vg || {})) {
    // si es string/number y parece numérico, lo convertimos
    if (typeof v === 'number') extras[k] = v;
    else if (typeof v === 'string') extras[k] = toNumber(v);
  }

  return {
    // (tus campos principales)
    gastoRx: buscarValor(['Gasto_Rx', 'Gastos_Rx', 'Gasto Rx', 'gasto_rx'], 1648),
    galenoRx: buscarValor(['Galeno_Rx_Practica', 'Galeno_Rx_y_Practica', 'Galeno_Rx', 'galeno_rx'], 1411),
    gastoOperatorio: buscarValor(['Gasto_Operatorio', 'Gasto Operatorio', 'gasto_operatorio', 'GASTOS_OPERATORIOS'], 3281),
    galenoQuir: buscarValor(['Galeno_Quir', 'Galeno Quir', 'Galeno_Quirurgico', 'galeno_quir', 'GALENO_QX'], 1435.5),
    pension: buscarValor(['PENSION', 'Pension', 'Dia_Pension', 'Día_Pensión', 'pension'], 2838),
    otrosGastos: buscarValor(['Otros_Gastos', 'Otros gastos', 'Otros_Gastos_Medicos', 'otros_gastos'], 0),
    consulta: buscarValor(['Consulta', 'consulta', 'CONSULTA'], 34650),
    valorUB: buscarValor(
      ['Laboratorios_NBU_T', 'Laboratorios_NBU', 'Unidad_Bioquimica', 'Unidad Bioquimica', 'UB', 'unidad_bioquimica'],
      1224.11
    ),
    unidadBioquimica: buscarValor(['Laboratorios_NBU_T', 'Laboratorios_NBU', 'Unidad_Bioquimica', 'Unidad Bioquimica', 'UB'], 1224.11),

    /**
     * ✅ CLAVE: ahora sí llega al cálculo especial
     * Tu convenio tiene "Curaciones_R: 8820"
     */
    Curaciones_R: buscarValor(['Curaciones_R', 'CURACIONES_R', 'Curaciones', 'curaciones'], 0),

    honorarios_medicos: convenioData.honorarios_medicos || [],
    _rawData: vg,
    _convenioName: convenioData.nombre || convenioData.key || 'No seleccionado',

    // ✅ esto te expone todo vg ya parseado (por si querés más reglas especiales)
    ...extras,
  };
};

export const ConvenioProvider = ({ children }) => {
  const [convenios, setConvenios] = useState({});
  const [convenioSel, setConvenioSel] = useState('');
  const [convenioData, setConvenioData] = useState(null);
  const [valoresConvenio, setValoresConvenio] = useState(() => extraerValoresConvenio(null));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const conveniosRef = ref(db, 'convenios');
    const unsub = onValue(
      conveniosRef,
      (snap) => {
        if (!snap.exists()) {
          setConvenios({});
          setLoading(false);
          return;
        }
        const val = snap.val();
        setConvenios(val);
        const stored = localStorage.getItem('convenioActivoFacturacion');
        const elegir = stored && val[stored] ? stored : Object.keys(val)[0] || '';
        setConvenioSel(elegir);
        setLoading(false);
      },
      (error) => {
        console.error('Error cargando convenios:', error);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!convenioSel || !convenios[convenioSel]) {
      setConvenioData(null);
      setValoresConvenio(extraerValoresConvenio(null));
      return;
    }
    localStorage.setItem('convenioActivoFacturacion', convenioSel);
    const data = convenios[convenioSel];
    setConvenioData(data);
    setValoresConvenio(extraerValoresConvenio(data));
  }, [convenioSel, convenios]);

  const cambiarConvenio = (nuevoConvenio) => setConvenioSel(nuevoConvenio);

  const actualizarValores = () => {
    if (convenioData) {
      const nuevosValores = extraerValoresConvenio(convenioData);
      setValoresConvenio(nuevosValores);
      return nuevosValores;
    }
    return valoresConvenio;
  };

  return (
    <ConvenioContext.Provider
      value={{
        convenios,
        convenioSel,
        convenioData,
        valoresConvenio,
        loading,
        cambiarConvenio,
        actualizarValores,

        // getters “legacy”
        get gastoRx() { return valoresConvenio.gastoRx; },
        get galenoRx() { return valoresConvenio.galenoRx; },
        get gastoOperatorio() { return valoresConvenio.gastoOperatorio; },
        get galenoQuir() { return valoresConvenio.galenoQuir; },
        get pension() { return valoresConvenio.pension; },
        get otrosGastos() { return valoresConvenio.otrosGastos; },
        get valorUB() { return valoresConvenio.valorUB; },
        get consulta() { return valoresConvenio.consulta; },

        // ✅ útil si querés acceder directo:
        get Curaciones_R() { return valoresConvenio.Curaciones_R; },
      }}
    >
      {children}
    </ConvenioContext.Provider>
  );
};

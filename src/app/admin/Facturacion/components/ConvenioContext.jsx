// src/app/admin/facturacion/ConvenioContext.jsx
'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';

const ConvenioContext = createContext(null);

export const useConvenio = () => {
  const context = useContext(ConvenioContext);
  if (!context) throw new Error('useConvenio debe usarse dentro de ConvenioProvider');
  return context;
};

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
      Curaciones_R: 0,
      unidadBioquimica: 1224.11,
      honorarios_medicos: [],
      _rawData: {},
      _convenioName: 'No seleccionado',
      Dia_Pension_Internacion_Piso: 0,
      Dia_UTI: 0,
      Ecografia_Abdominal_Completa: 0,
      Modulo_Oxigeno: 0,
      Gastos_Artroscopia_Compleja: 0,
    };
  }

  const vg = convenioData.valores_generales;

  const buscarValor = (claves, defaultValue = 0) => {
    for (const clave of claves) {
      if (vg[clave] != null && vg[clave] !== '') {
        return toNumber(vg[clave]);
      }
    }
    return defaultValue;
  };

  const extras = {};
  for (const [k, v] of Object.entries(vg || {})) {
    if (typeof v === 'number') extras[k] = v;
    else if (typeof v === 'string') extras[k] = toNumber(v);
  }

  return {
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
    Curaciones_R: buscarValor(['Curaciones_R', 'CURACIONES_R', 'Curaciones', 'curaciones'], 0),

    // ✅ NUEVOS MÓDULOS
    Dia_Pension_Internacion_Piso: buscarValor([
      'DIA_DE_PENSION-INTERNACION_PISO',
      'Dia_de_Pension-Internacion_Piso',
      'Dia_Pension_Internacion_Piso'
    ], 0),
    Dia_UTI: buscarValor([
      'DIA_UTI_(_G+H)',
      'Dia_UTI',
      'DIA_UTI'
    ], 0),
    Ecografia_Abdominal_Completa: buscarValor([
      'Ecografia_abdominal_completa',
      'Ecografia_Abdominal_Completa'
    ], 0),
    Modulo_Oxigeno: buscarValor([
      'MODULO_OXIGENO',
      'Modulo_Oxigeno'
    ], 0),
    Gastos_Artroscopia_Compleja: buscarValor([
      'GASTOS_ARTROSCOPIA_COMPLEJA_COMPLEJIDAD_8',
      'Gastos_Artroscopia_Compleja'
    ], 0),

    honorarios_medicos: convenioData.honorarios_medicos || [],
    _rawData: vg,
    _convenioName: convenioData.nombre || convenioData.key || 'No seleccionado',

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

  const cambiarConvenio = useCallback((nuevoConvenio) => {
    setConvenioSel(nuevoConvenio);
  }, []);

  const actualizarValores = useCallback(() => {
    if (convenioData) {
      const nuevosValores = extraerValoresConvenio(convenioData);
      setValoresConvenio(nuevosValores);
      return nuevosValores;
    }
    return valoresConvenio;
  }, [convenioData, valoresConvenio]);

  const value = useMemo(() => ({
    convenios,
    convenioSel,
    convenioData,
    valoresConvenio,
    loading,
    cambiarConvenio,
    actualizarValores,

    get gastoRx() { return valoresConvenio.gastoRx; },
    get galenoRx() { return valoresConvenio.galenoRx; },
    get gastoOperatorio() { return valoresConvenio.gastoOperatorio; },
    get galenoQuir() { return valoresConvenio.galenoQuir; },
    get pension() { return valoresConvenio.pension; },
    get otrosGastos() { return valoresConvenio.otrosGastos; },
    get valorUB() { return valoresConvenio.valorUB; },
    get consulta() { return valoresConvenio.consulta; },
    get Curaciones_R() { return valoresConvenio.Curaciones_R; },

    // ✅ Getters para los nuevos módulos
    get diaPensionInternacionPiso() { return valoresConvenio.Dia_Pension_Internacion_Piso; },
    get diaUTI() { return valoresConvenio.Dia_UTI; },
    get ecoAbdominal() { return valoresConvenio.Ecografia_Abdominal_Completa; },
    get moduloOxigeno() { return valoresConvenio.Modulo_Oxigeno; },
    get gastosArtroscopiaCompleja() { return valoresConvenio.Gastos_Artroscopia_Compleja; },
  }), [
    convenios, convenioSel, convenioData, valoresConvenio, loading,
    cambiarConvenio, actualizarValores
  ]);

  return (
    <ConvenioContext.Provider value={value}>
      {children}
    </ConvenioContext.Provider>
  );
};
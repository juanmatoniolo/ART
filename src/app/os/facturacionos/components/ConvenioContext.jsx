'use client';

import {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';

const ConvenioContext = createContext(null);

export const useConvenio = () => {
  const ctx = useContext(ConvenioContext);
  if (!ctx) throw new Error('useConvenio debe usarse dentro de ConvenioProvider');
  return ctx;
};

/* ---------- helpers ---------- */
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

const normalizeKey = (k) =>
  String(k ?? '')
    .toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-\.]+/g, '_')
    .replace(/[^\w]/g, '');

const pickValue = (source, keys) => {
  if (!source) return undefined;
  for (const k of keys) {
    if (k == null) continue;
    if (source[k] != null && source[k] !== '') return source[k];
    const norm = normalizeKey(k);
    if (source[norm] != null && source[norm] !== '') return source[norm];
  }
  return undefined;
};

/* ---------- aranceles del convenio ---------- */
const ARANCELES_DEF = [
  { id: 'gastoQuirurgico', label: 'Gasto Quirúrgico',
    keys: ['GASTO QUIRURGICO', 'Gasto_Operatorio', 'Gasto Quirurgico', 'gastoQuirurgico'] },
  { id: 'gastosRx', label: 'Gastos RX',
    keys: ['GASTOS RX', 'Gasto_Rx', 'Gasto Rx', 'gastosRx'] },
  { id: 'gastosBioquimicos', label: 'Gastos Bioquímicos',
    keys: ['GASTOS BIOQUIMICOS', 'Gastos_Bioquimicos', 'Gasto_Bioquimico', 'gastosBioquimicos'] },
  { id: 'otrosGastos', label: 'Otros Gastos',
    keys: ['OTROS GASTOS', 'Otros_Gastos', 'otrosGastos'] },
  { id: 'unidadPension', label: 'Unidad de Pensión',
    keys: ['UNIDAD DE PENSION', 'Pension', 'Unidad_Pension', 'unidadPension'] },
  { id: 'unidadesHonorarioPractica', label: 'Unidades Honorario Práctica',
    keys: ['UNIDADES HONORARIO PRACTICA', 'Galeno_Quir', 'Galeno_Comun', 'unidadesHonorarioPractica'] },
  { id: 'unidadesHonorarioBioq', label: 'Unidades Honorario Bioquímico',
    keys: ['UNIDADES HONORARIO BIOQUIMICO', 'Galeno_Rx_Practica', 'unidadesHonorarioBioq'] },
  { id: 'gastosTomografia', label: 'Gastos Tomografía',
    keys: ['GASTOS TOMOGRAFIA', 'Gastos_Tomografia', 'Gasto_Tomografia', 'gastosTomografia'] },
  { id: 'gastosTRadiante', label: 'Gastos T. Radiante',
    keys: ['GASTOS T.RADIANTE', 'Gastos_T_Radiante', 'gastosTRadiante'] },
  { id: 'unidadHonorarioModulado', label: 'Unidad Honorario Modulado',
    keys: ['UNIDAD HONORARIO MODULADO', 'unidadHonorarioModulado'] },
  { id: 'unidadGastoModulado', label: 'Unidad Gasto Modulado',
    keys: ['UNIDAD GASTO MODULADO', 'unidadGastoModulado'] },
  { id: 'unidadGastoPractica', label: 'Unidad Gasto Práctica',
    keys: ['UNIDAD GASTO PRACTICA', 'unidadGastoPractica'] },
  { id: 'unidadNBU', label: 'Unidad NBU',
    keys: ['UNIDAD NBU', 'Laboratorios_NBU', 'unidadNBU'] },
  { id: 'gastoQuirurgicoAoter', label: 'Gasto Quirúrgico AOTER',
    keys: ['GASTO QUIRURGICO AOTER', 'gastoQuirurgicoAoter'] },
  { id: 'gastoQuirurgicoAeci', label: 'Gasto Quirúrgico AECI',
    keys: ['GASTO QUIRURGICO AECI', 'gastoQuirurgicoAeci'] },
  { id: 'consulta', label: 'Consulta', keys: ['CONSULTA', 'Consulta'] },
  { id: 'curaciones', label: 'Curaciones R', keys: ['Curaciones_R', 'CURACIONES_R', 'Curaciones'] },
  { id: 'curacionesQuemados', label: 'Curaciones Quemados',
    keys: ['Curaciones_Quemados', 'CURACIONES_QUEMADOS'] },
  { id: 'ecg', label: 'ECG', keys: ['ECG_Y_EX_EN_CV', 'ECG'] },
  { id: 'ecografiaPartesBlandas', label: 'Ecografía partes blandas',
    keys: ['Ecografia_partes_blandas_no_moduladas'] },
  { id: 'artroscopiaHombro', label: 'Artroscopía Hombro', keys: ['Artroscopia_Hombro'] },
  { id: 'artroscopiaSimple', label: 'Artroscopía Simple',
    keys: ['Artroscopia_Simple_Gastos_Sanatoriales'] },
  { id: 'ligCruzado', label: 'Lig. Cruzado', keys: ['Lig_Cruzado_Gastos_Sanatoriales'] },
  { id: 'derTransfusion', label: 'Der. Transfusión', keys: ['Der_Transfusion'] },
  { id: 'prepSangreTransf', label: 'Prep. Sangre c/Transf.', keys: ['Mod_Prep_Sangre_Transf'] },
  { id: 'prepSangreSinTransf', label: 'Prep. Sangre s/Transf.', keys: ['Mod_Prep_Sangre_sin_Transf'] },
];

/* ---------- source / builders ---------- */
// FIX: priorizamos valoresArancelarios (que es lo que trae el convenio OS)
const getSource = (convenioData) => {
  if (!convenioData) return {};
  return (
    convenioData.valoresArancelarios ||
    convenioData.valores_generales ||
    convenioData.valoresGenerales ||
    convenioData.valores ||
    convenioData ||
    {}
  );
};

const buildValoresConvenio = (convenioData) => {
  if (!convenioData) return null;
  const source = getSource(convenioData);
  const out = { ...source };
  for (const [k, v] of Object.entries(source)) {
    const norm = normalizeKey(k);
    if (!(norm in out)) out[norm] = v;
  }
  for (const def of ARANCELES_DEF) {
    const val = toNumber(pickValue(source, def.keys));
    if (!(def.id in out)) out[def.id] = val;
  }
  return out;
};

const extraerAranceles = (convenioData) => {
  const source = getSource(convenioData);
  const result = {};
  for (const def of ARANCELES_DEF) {
    result[def.id] = toNumber(pickValue(source, def.keys));
  }
  return result;
};

const construirArancelesVisibles = (aranceles) =>
  ARANCELES_DEF
    .map((def) => ({ id: def.id, label: def.label, value: aranceles[def.id] ?? 0 }))
    .filter((item) => item.value > 0);

/* ---------- prácticas incluidas ---------- */
// FIX: soporta mapa {codigo: valorNumerico} y prioriza modulosIncluidos
const extractPracticasIncluidas = (convenioData) => {
  if (!convenioData) return [];
  const vg = convenioData.valores_generales || convenioData.valoresArancelarios || {};

  const candidates = [
    convenioData.modulosIncluidos,          // prioridad OS
    convenioData.practicasIncluidas,
    convenioData.practicas_incluidas,
    convenioData.Practicas_Incluidas,
    convenioData.PracticasIncluidas,
    convenioData.PRACTICAS_INCLUIDAS,
    convenioData.practicas,
    convenioData.Practicas,
    convenioData.modulos_incluidos,
    convenioData.nomenclador,
    vg.practicasIncluidas,
    vg.practicas_incluidas,
    vg.practicas,
    vg.modulosIncluidos,
  ];

  let raw = null;
  for (const c of candidates) {
    if (c != null && c !== '' && typeof c === 'object') { raw = c; break; }
  }
  if (!raw) return [];

  let arr = Array.isArray(raw)
    ? raw
    : Object.entries(raw).map(([k, v]) => {
        if (v && typeof v === 'object') {
          return { codigo: v.codigo ?? v.code ?? k, ...v };
        }
        const num = toNumber(v);
        // Si el valor es numérico > 0, ES el gasto
        if (num > 0) return { codigo: k, descripcion: '', gastos: num };
        // Si es string descriptivo, es descripción
        return { codigo: k, descripcion: String(v) };
      });

  const pickGastos = (it) =>
    toNumber(
      it.gastos ?? it.gasto ?? it.valor ?? it.arancel ?? it.precio ??
      it.gastoSanatorial ?? it.Gastos ?? it.Valor ?? 0
    );
  const pickHonorarios = (it) =>
    toNumber(it.honorarios ?? it.honorario ?? it.honorarioMedico ?? 0);

  const out = [];
  const seen = new Set();
  for (const it of arr) {
    if (it == null) continue;
    let codigo, descripcion;
    if (typeof it === 'string' || typeof it === 'number') {
      codigo = String(it).trim();
      descripcion = '';
    } else if (typeof it === 'object') {
      codigo = String(
        it.codigo ?? it.code ?? it.cod ?? it.Codigo ?? it.CODIGO ?? it.Código ?? ''
      ).trim();
      descripcion = String(
        it.descripcion ?? it.description ?? it.nombre ?? it.detalle ?? ''
      ).trim();
    }
    if (!codigo || seen.has(codigo)) continue;
    seen.add(codigo);
    out.push({
      codigo,
      descripcion,
      gastos: pickGastos(it),
      honorarios: pickHonorarios(it),
      completo: it.completo ?? '',
      __raw: it,
    });
  }
  return out;
};

/* ---------- matching con convenios raíz ---------- */
const slugify = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const buscarConvenioRaiz = (convOS, conveniosRaiz) => {
  if (!convOS) return null;
  const rootList = Object.entries(conveniosRaiz).map(([id, v]) => ({ id, ...v }));
  if (!rootList.length) return null;

  const nombresOS = [
    convOS.nombreConvenio,
    convOS.obraSocial?.sigla,
    convOS.obraSocial?.descripcion,
  ].filter(Boolean).map(slugify);

  for (const r of rootList) {
    const rName = slugify(r.id);
    for (const n of nombresOS) {
      if (n && (n === rName || rName.includes(n) || n.includes(rName))) return r;
    }
  }

  for (const r of rootList) {
    const rTokens = new Set(slugify(r.id).split(' ').filter(Boolean));
    for (const n of nombresOS) {
      const nTokens = slugify(n).split(' ').filter(Boolean);
      const common = nTokens.filter((t) => rTokens.has(t));
      if (common.length >= 2) return r;
    }
  }

  if (rootList.length === 1) return rootList[0];
  return null;
};

/* ---------- Provider ---------- */
export const ConvenioProvider = ({ children }) => {
  const [conveniosOSMap, setConveniosOSMap] = useState({});
  const [conveniosRaizMap, setConveniosRaizMap] = useState({});
  const [obrasSociales, setObrasSociales] = useState([]);
  const [osSel, setOsSel] = useState('');
  const [convenioSel, setConvenioSel] = useState('');
  const [loading, setLoading] = useState(true);

  // 1) convenios de facturacionOS
  useEffect(() => {
    const r = ref(db, 'facturacionOS/convenios');
    const unsub = onValue(
      r,
      (snap) => { setConveniosOSMap(snap.exists() ? snap.val() : {}); setLoading(false); },
      (err) => { console.error('Error cargando convenios OS:', err); setLoading(false); }
    );
    return () => unsub();
  }, []);

  // 2) convenios raíz
  useEffect(() => {
    const r = ref(db, 'convenios');
    const unsub = onValue(
      r,
      (snap) => { setConveniosRaizMap(snap.exists() ? snap.val() : {}); },
      (err) => console.error('Error cargando convenios raíz:', err)
    );
    return () => unsub();
  }, []);

  // 3) obras sociales
  useEffect(() => {
    const r = ref(db, 'facturacionOS/osociales');
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.exists() ? snap.val() : null;
        if (Array.isArray(val)) setObrasSociales(val);
        else if (val && typeof val === 'object') {
          // FIX: preservamos la key (id) por si no viene dentro del value
          setObrasSociales(
            Object.entries(val).map(([id, v]) => ({ id, ...(v || {}) }))
          );
        } else setObrasSociales([]);
      },
      (err) => console.error('Error cargando OS:', err)
    );
    return () => unsub();
  }, []);

  const convenios = useMemo(
    () => Object.entries(conveniosOSMap).map(([id, value]) => ({ id, ...value })),
    [conveniosOSMap]
  );

  // FIX: matching robusto (string u objeto) + ordenado por fechaCarga desc
  const conveniosDeOS = useCallback(
    (sigla) => {
      if (!sigla) return [];
      const match = (c) => {
        const os = c.obraSocial;
        if (!os) return false;
        if (typeof os === 'string') return os === sigla;
        return (
          os.sigla === sigla ||
          os.codOS === sigla ||
          os.descripcion === sigla
        );
      };
      return convenios
        .filter(match)
        .sort((a, b) => {
          const fa = new Date(a.fechaCarga || 0).getTime();
          const fb = new Date(b.fechaCarga || 0).getTime();
          return fb - fa;
        });
    },
    [convenios]
  );

  useEffect(() => {
    if (!convenios.length || !obrasSociales.length) return;
    const storedOS = localStorage.getItem('os-activaFacturacion');
    const storedConv = localStorage.getItem('os-convenioActivoFacturacion');
    if (storedOS) setOsSel(storedOS);
    if (storedConv && conveniosOSMap[storedConv]) {
      setConvenioSel(storedConv);
      const data = conveniosOSMap[storedConv];
      if (data?.obraSocial?.sigla) setOsSel(data.obraSocial.sigla);
    }
  }, [convenios.length, obrasSociales.length]); // eslint-disable-line

  useEffect(() => {
    if (!osSel) return;
    const lista = conveniosDeOS(osSel);
    const actual = conveniosOSMap[convenioSel];
    const actualPertenece =
      actual &&
      (() => {
        const os = actual.obraSocial;
        if (!os) return false;
        if (typeof os === 'string') return os === osSel;
        return os.sigla === osSel || os.codOS === osSel || os.descripcion === osSel;
      })();
    if (!actualPertenece) setConvenioSel(lista[0]?.id || '');
  }, [osSel, conveniosDeOS, conveniosOSMap, convenioSel]);

  useEffect(() => {
    if (osSel) localStorage.setItem('os-activaFacturacion', osSel);
  }, [osSel]);

  useEffect(() => {
    if (convenioSel) localStorage.setItem('os-convenioActivoFacturacion', convenioSel);
  }, [convenioSel]);

  /* -------- CONVENIO COMBINADO -------- */
  // FIX: respetamos los valores propios del convenio OS y usamos la raíz como fallback
  const convenioData = useMemo(() => {
    if (!convenioSel) return null;
    const convOS = conveniosOSMap[convenioSel];
    if (!convOS) return null;

    const convRaiz = buscarConvenioRaiz(convOS, conveniosRaizMap);

    const merged = {
      ...convOS,
      id: convenioSel,
      _convenioRaizId: convRaiz?.id || null,
    };

    if (convRaiz) {
      merged.valores_generales =
        convOS.valores_generales ||
        convOS.valoresArancelarios ||
        convOS.valoresGenerales ||
        convOS.valores ||
        convRaiz.valores_generales ||
        convRaiz.valoresArancelarios ||
        convRaiz.valoresGenerales ||
        convRaiz.valores ||
        null;

      merged.honorarios_medicos =
        convOS.honorarios_medicos ||
        convOS.honorariosMedicos ||
        convRaiz.honorarios_medicos ||
        convRaiz.honorariosMedicos ||
        null;

      if (!merged.modulosIncluidos && convRaiz.modulosIncluidos) {
        merged.modulosIncluidos = convRaiz.modulosIncluidos;
      }
    }

    return merged;
  }, [convenioSel, conveniosOSMap, conveniosRaizMap]);

  const aranceles = useMemo(() => extraerAranceles(convenioData), [convenioData]);
  const arancelesVisibles = useMemo(() => construirArancelesVisibles(aranceles), [aranceles]);
  const valoresConvenio = useMemo(() => buildValoresConvenio(convenioData), [convenioData]);
  const practicasIncluidas = useMemo(() => extractPracticasIncluidas(convenioData), [convenioData]);

  const cambiarOS = useCallback((sigla) => setOsSel(sigla || ''), []);
  const cambiarConvenio = useCallback((id) => setConvenioSel(id || ''), []);

  const value = useMemo(
    () => ({
      obrasSociales, osSel, cambiarOS,
      convenios, conveniosMap: conveniosOSMap, conveniosDeOS,
      conveniosRaiz: conveniosRaizMap,
      convenioSel, convenioData, cambiarConvenio,
      aranceles, arancelesVisibles, valoresConvenio,
      practicasIncluidas, loading,

      get gastoQuirurgico() { return aranceles.gastoQuirurgico; },
      get gastosRx() { return aranceles.gastosRx; },
      get gastosBioquimicos() { return aranceles.gastosBioquimicos; },
      get otrosGastos() { return aranceles.otrosGastos; },
      get unidadPension() { return aranceles.unidadPension; },
      get unidadesHonorarioPractica() { return aranceles.unidadesHonorarioPractica; },
      get unidadesHonorarioBioq() { return aranceles.unidadesHonorarioBioq; },
      get gastosTomografia() { return aranceles.gastosTomografia; },
      get gastosTRadiante() { return aranceles.gastosTRadiante; },
      get unidadHonorarioModulado() { return aranceles.unidadHonorarioModulado; },
      get unidadGastoModulado() { return aranceles.unidadGastoModulado; },
      get unidadGastoPractica() { return aranceles.unidadGastoPractica; },
      get unidadNBU() { return aranceles.unidadNBU; },
      get gastoQuirurgicoAoter() { return aranceles.gastoQuirurgicoAoter; },
      get gastoQuirurgicoAeci() { return aranceles.gastoQuirurgicoAeci; },

      get gastoOperatorio() { return aranceles.gastoQuirurgico; },
      get pension() { return aranceles.unidadPension; },
      get valorUB() { return aranceles.unidadNBU; },
      get gastoRx() { return aranceles.gastosRx; },
      get consulta() { return aranceles.consulta; },
      get Curaciones_R() { return aranceles.curaciones; },
      get galenoRx() { return aranceles.unidadesHonorarioBioq; },
      get galenoQuir() { return aranceles.unidadesHonorarioPractica; },

      get curacionesQuemados() { return aranceles.curacionesQuemados; },
      get ecg() { return aranceles.ecg; },
      get ecografiaPartesBlandas() { return aranceles.ecografiaPartesBlandas; },
      get artroscopiaHombro() { return aranceles.artroscopiaHombro; },
      get artroscopiaSimple() { return aranceles.artroscopiaSimple; },
      get ligCruzado() { return aranceles.ligCruzado; },
      get derTransfusion() { return aranceles.derTransfusion; },
      get prepSangreTransf() { return aranceles.prepSangreTransf; },
      get prepSangreSinTransf() { return aranceles.prepSangreSinTransf; },
    }),
    [
      obrasSociales, osSel, cambiarOS,
      convenios, conveniosOSMap, conveniosDeOS,
      conveniosRaizMap,
      convenioSel, convenioData, cambiarConvenio,
      aranceles, arancelesVisibles, valoresConvenio,
      practicasIncluidas, loading,
    ]
  );

  return (
    <ConvenioContext.Provider value={value}>
      {children}
    </ConvenioContext.Provider>
  );
};
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, push, set, update, get } from 'firebase/database';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/firebase';

import { useConvenio } from './ConvenioContext';
import { STORAGE_KEYS, getStorageItem, setStorageItem } from '../utils/storage';
import { cerrarPacientePorFactura } from '../utils/siniestroPacienteSync';

import DatosPaciente from './DatosPaciente';
import PracticasModule from './PracticasModule';
import CirugiasModule from './CirugiasModule';
import LaboratoriosModule from './LaboratoriosModule';
import MedicamentosModule from './MedicamentosModule';
import ResumenFactura from './ResumenFactura';

import {
  calcularPractica,
  calcularLaboratorio,
  money as moneyFmt,
  parseNumber,
  isRadiografia,
} from '../utils/calculos';

import styles from './facturacion.module.css';

const todayISO = () => new Date().toISOString().split('T')[0];

const onlyDigits = (s) => String(s ?? '').replace(/\D/g, '');

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const round2 = (num) => Math.round(num * 100) / 100;

const normalizeArtKey = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'sin_art';

const normalizeSiniestroKey = (artNombre, nroSiniestro) => {
  const a = normalizeArtKey(artNombre || 'sin_art');
  const n = String(nroSiniestro ?? '').trim().toLowerCase();
  return `${a}__${n || 'sin_siniestro'}`;
};

const prettyLabel = (s) =>
  String(s ?? '')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function aplicarPrestadorEnPractica(calculoBase, prestadorTipo) {
  const honor = safeNum(calculoBase?.honorarioMedico);
  const gasto = safeNum(calculoBase?.gastoSanatorial);
  if (prestadorTipo === 'Dr') return { honorarioMedico: honor, gastoSanatorial: 0, total: honor };
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
  return { ...item, ...calc, honorarioMedico: total, gastoSanatorial: 0, total };
}

function normalizarMedDesc(item) {
  const cantidad = round2(Math.max(0.01, parseNumber(item?.cantidad) || 1));
  const unit = round2(safeNum(item?.valorUnitario ?? item?.precio ?? 0));
  const total = round2(unit * cantidad);
  return {
    ...item,
    cantidad,
    valorUnitario: unit,
    honorarioMedico: 0,
    gastoSanatorial: total,
    total,
  };
}

const patchEsSoloTexto = (patch) => {
  if (!patch || typeof patch !== 'object') return true;
  const numericKeys = new Set(['cantidad', 'valorUnitario', 'precio', 'total', 'honorarioMedico', 'gastoSanatorial']);
  return Object.keys(patch).every((k) => !numericKeys.has(k));
};

export default function FacturaContainer() {
  const { convenios, convenioSel, valoresConvenio, cambiarConvenio, loading } = useConvenio();
  const searchParams = useSearchParams();
  const router = useRouter();

  const draftFromUrl = searchParams.get('draft') || '';
  const newFromUrl = searchParams.get('new') === '1';

  const [isClient, setIsClient] = useState(false);
  const [loadingStorage, setLoadingStorage] = useState(true);
  const [loadingDraft, setLoadingDraft] = useState(false);

  useEffect(() => setIsClient(true), []);

  const [activeTab, setActiveTab] = useState('datos');
  const [paciente, setPaciente] = useState({
    pacienteId: '',
    nombreCompleto: '',
    dni: '',
    artSeguro: '',
    nroSiniestro: '',
    fechaAtencion: todayISO(),
  });

  const [practicas, setPracticas] = useState([]);
  const [cirugias, setCirugias] = useState([]);
  const [laboratorios, setLaboratorios] = useState([]);
  const [medicamentos, setMedicamentos] = useState([]);
  const [descartables, setDescartables] = useState([]);

  const [draftId, setDraftId] = useState('');
  const [lockMsg, setLockMsg] = useState('');

  const resetStoredDraftId = useCallback(() => {
    setDraftId('');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('FACTURACION_DRAFT_ID');
    }
  }, []);

  const totalItems = useMemo(
    () =>
      practicas.length +
      cirugias.length +
      laboratorios.length +
      medicamentos.length +
      descartables.length,
    [practicas, cirugias, laboratorios, medicamentos, descartables]
  );

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

  const totalesFactura = useMemo(() => {
    const all = [...practicas, ...cirugias, ...laboratorios, ...medicamentos, ...descartables];
    const honor = all.reduce((acc, it) => acc + (parseNumber(it?.honorarioMedico) || 0), 0);
    const gasto = all.reduce((acc, it) => acc + (parseNumber(it?.gastoSanatorial) || 0), 0);
    return { honor, gasto, total: honor + gasto };
  }, [practicas, cirugias, laboratorios, medicamentos, descartables]);

  useEffect(() => {
    if (!isClient) return;

    if (newFromUrl) {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
      localStorage.removeItem('FACTURACION_DRAFT_ID');
      setPaciente({ pacienteId: '', nombreCompleto: '', dni: '', artSeguro: '', nroSiniestro: '', fechaAtencion: todayISO() });
      setPracticas([]);
      setCirugias([]);
      setLaboratorios([]);
      setMedicamentos([]);
      setDescartables([]);
      setActiveTab('datos');
      setDraftId('');
    } else if (!draftFromUrl) {
      setPaciente(getStorageItem(STORAGE_KEYS.PACIENTE, paciente));
      setPracticas(getStorageItem(STORAGE_KEYS.PRACTICAS, []));
      setCirugias(getStorageItem(STORAGE_KEYS.CIRUGIAS, []));
      setLaboratorios(getStorageItem(STORAGE_KEYS.LABORATORIOS, []));
      setMedicamentos(getStorageItem(STORAGE_KEYS.MEDICAMENTOS, []));
      setDescartables(getStorageItem(STORAGE_KEYS.DESCARTABLES, []));
      setActiveTab(getStorageItem(STORAGE_KEYS.TAB_ACTIVA, 'datos'));
      setDraftId(getStorageItem('FACTURACION_DRAFT_ID', ''));
    }

    setLoadingStorage(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isClient, newFromUrl, draftFromUrl]);

  useEffect(() => {
    if (!isClient) return;
    if (!draftFromUrl) return;

    let alive = true;

    (async () => {
      setLoadingDraft(true);
      setLockMsg('');
      try {
        const snap = await get(ref(db, `Facturacion/${draftFromUrl}`));
        if (!alive) return;

        if (!snap.exists()) {
          setLockMsg(`No existe el borrador ID: ${draftFromUrl}`);
          setLoadingDraft(false);
          return;
        }

        const v = snap.val();
        const estado = v?.estado || (v?.cerradoAt ? 'cerrado' : 'borrador');

        if (estado === 'cerrado') {
          setLockMsg('⚠️ Este siniestro está CERRADO. Podés editarlo, pero al guardar pasará a borrador.');
        }

        const pacienteData = v?.paciente || {};

        const findValue = (sources, ...keys) => {
          for (const source of sources) {
            if (source && typeof source === 'object') {
              for (const key of keys) {
                if (source[key] !== undefined && source[key] !== null && source[key] !== '') {
                  return source[key];
                }
              }
            }
          }
          return '';
        };

        const nombre = findValue(
          [pacienteData, v],
          'nombreCompleto',
          'nombre',
          'apellido',
          'fullName',
          'pacienteNombre',
          'nombrePaciente'
        );

        const dni = findValue([pacienteData, v], 'dni', 'documento', 'DNI', 'Documento');

        const art = findValue([pacienteData, v], 'artSeguro', 'art', 'seguro', 'artNombre', 'ART');

        const siniestro = findValue(
          [pacienteData, v],
          'nroSiniestro',
          'siniestro',
          'numeroSiniestro',
          'NroSiniestro'
        );

        const fecha = findValue([pacienteData, v], 'fechaAtencion', 'fecha', 'atencion', 'fecha_atencion') || todayISO();

        setPaciente({
          pacienteId: pacienteData.pacienteId || v?.pacienteId || '',
          nombreCompleto: nombre,
          dni: dni,
          artSeguro: art,
          nroSiniestro: siniestro,
          fechaAtencion: fecha,
        });

        setPracticas(Array.isArray(v?.practicas) ? v.practicas : []);
        setCirugias(Array.isArray(v?.cirugias) ? v.cirugias : []);
        setLaboratorios(Array.isArray(v?.laboratorios) ? v.laboratorios : []);
        setMedicamentos(Array.isArray(v?.medicamentos) ? v.medicamentos : []);
        setDescartables(Array.isArray(v?.descartables) ? v.descartables : []);

        if (v?.convenio) {
          if (convenios && convenios[v.convenio]) {
            cambiarConvenio(v.convenio);
          }
        } else if (v?.convenioNombre) {
          const claveEncontrada = Object.keys(convenios || {}).find(
            (key) => convenios[key]?.nombre === v.convenioNombre
          );
          if (claveEncontrada) {
            cambiarConvenio(claveEncontrada);
          }
        }

        setDraftId(draftFromUrl);
        setActiveTab('datos');
      } catch (e) {
        console.error('Error al cargar draft:', e);
        setLockMsg('Error al cargar el borrador desde Firebase.');
      } finally {
        if (alive) setLoadingDraft(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [draftFromUrl, isClient, convenios]);

  useEffect(() => {
    if (!isClient || loadingStorage) return;

    setStorageItem(STORAGE_KEYS.PACIENTE, paciente);
    setStorageItem(STORAGE_KEYS.PRACTICAS, practicas);
    setStorageItem(STORAGE_KEYS.CIRUGIAS, cirugias);
    setStorageItem(STORAGE_KEYS.LABORATORIOS, laboratorios);
    setStorageItem(STORAGE_KEYS.MEDICAMENTOS, medicamentos);
    setStorageItem(STORAGE_KEYS.DESCARTABLES, descartables);
    setStorageItem(STORAGE_KEYS.TAB_ACTIVA, activeTab);
    setStorageItem('FACTURACION_DRAFT_ID', draftId);
  }, [
    paciente,
    practicas,
    cirugias,
    laboratorios,
    medicamentos,
    descartables,
    activeTab,
    isClient,
    loadingStorage,
    draftId,
  ]);

  const [existentes, setExistentes] = useState([]);

  const findExisting = useCallback(
    async ({ excludeId } = {}) => {
      const dniDigits = onlyDigits(paciente?.dni);
      const artNombre = paciente?.artSeguro || '';
      const nroSiniestro = paciente?.nroSiniestro || '';
      const key = normalizeSiniestroKey(artNombre, nroSiniestro);

      const tieneSiniestro = String(nroSiniestro).trim() !== '';
      if (!dniDigits && !tieneSiniestro) return [];

      const snap = await get(ref(db, 'Facturacion'));
      if (!snap.exists()) return [];
      const all = snap.val();

      return Object.entries(all)
        .filter(([id]) => id !== 'siniestros' && id !== excludeId)
        .map(([id, v]) => ({ id, ...v }))
        .filter((v) => {
          const vDni = onlyDigits(v?.paciente?.dni || v?.dni || '');
          const vKey =
            v?.siniestroKey ||
            normalizeSiniestroKey(
              v?.paciente?.artSeguro || v?.artSeguro || '',
              v?.paciente?.nroSiniestro || v?.nroSiniestro || ''
            );
          const matchDni = dniDigits && vDni && vDni === dniDigits;
          const matchSiniestro = tieneSiniestro && vKey === key;
          return matchDni || matchSiniestro;
        })
        .map((v) => ({
          id: v.id,
          nombre: v?.paciente?.nombreCompleto || v?.nombre || 'Sin nombre',
          dni: v?.paciente?.dni || v?.dni || '',
          nroSiniestro: v?.paciente?.nroSiniestro || v?.nroSiniestro || '',
          estado: v?.estado || (v?.cerradoAt ? 'cerrado' : 'borrador'),
          updatedAt: v?.updatedAt || v?.createdAt || 0,
          facturaNro: v?.facturaNro || '',
        }))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    },
    [paciente]
  );

  useEffect(() => {
    if (!isClient) return;
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const found = await findExisting({ excludeId: draftId });
        if (alive) setExistentes(found);
      } catch (e) {
        console.error('Error buscando duplicados:', e);
        if (alive) setExistentes([]);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [isClient, paciente?.dni, paciente?.artSeguro, paciente?.nroSiniestro, draftId, findExisting]);

  const guardarEnRTDB = useCallback(
    async ({ estado, nombre, forceNew = false }) => {
      setLockMsg('');

      const convenioNombre = convenios?.[convenioSel]?.nombre || convenioSel;

      const artNombre = paciente?.artSeguro || '';
      const nroSiniestro = paciente?.nroSiniestro || '';
      const siniestroKey = normalizeSiniestroKey(artNombre, nroSiniestro);

      let id = forceNew ? '' : draftId;
      if (!id) {
        const newRef = push(ref(db, 'Facturacion'));
        id = newRef.key;
      }

      const now = Date.now();

      const prevSnap = await get(ref(db, `Facturacion/${id}`));
      const prev = prevSnap.exists() ? prevSnap.val() : null;

      const payload = {
        estado,
        nombre: nombre || paciente?.nombreCompleto || 'Siniestro',
        updatedAt: now,
        siniestroKey,

        convenio: convenioSel,
        convenioNombre,

        paciente: { ...paciente },

        practicas: practicas || [],
        cirugias: cirugias || [],
        laboratorios: laboratorios || [],
        medicamentos: medicamentos || [],
        descartables: descartables || [],

        totales: {
          honorarios: safeNum(totalesFactura.honor),
          gastos: safeNum(totalesFactura.gasto),
          total: safeNum(totalesFactura.total),
        },

        createdAt: prev?.createdAt ? prev.createdAt : now,
      };

      if (estado === 'cerrado') {
        payload.facturaNro = prev?.facturaNro || `FAC-${new Date().getFullYear()}-${now}`;
        payload.cerradoAt = now;
      }

      await set(ref(db, `Facturacion/${id}`), { id, ...(prev || {}), ...payload });

      await update(ref(db, `Facturacion/siniestros/${siniestroKey}`), {
        status: estado,
        id,
        updatedAt: now,
        dni: paciente?.dni || '',
      });

      await cerrarPacientePorFactura({ id, ...payload }, id);

      if (estado === 'borrador') setDraftId(id);
      if (estado === 'cerrado') setDraftId('');

      return { id, ...payload };
    },
    [
      paciente,
      practicas,
      cirugias,
      laboratorios,
      medicamentos,
      descartables,
      totalesFactura,
      convenioSel,
      convenios,
      draftId,
    ]
  );

  const RX_DOCTOR = 'Retamoso';
  const forceRxDoctor = (p) => {
    if (!isRadiografia?.(p)) return p;
    return { ...p, medico: RX_DOCTOR, medicoNombre: RX_DOCTOR, doctor: RX_DOCTOR, dr: RX_DOCTOR };
  };

  const agregarPractica = useCallback((nueva) => setPracticas((prev) => [...prev, forceRxDoctor(nueva)]), []);
  const agregarCirugia = useCallback((nueva) => setCirugias((prev) => [...prev, nueva]), []);
  const agregarLaboratorio = useCallback(
    (nuevo) => {
      const normal = valoresConvenio ? normalizarLab(nuevo, valoresConvenio) : nuevo;
      setLaboratorios((prev) => [...prev, normal]);
    },
    [valoresConvenio]
  );
  const agregarMedicamento = useCallback((nuevo) => setMedicamentos((prev) => [...prev, normalizarMedDesc(nuevo)]), []);
  const agregarDescartable = useCallback((nuevo) => setDescartables((prev) => [...prev, normalizarMedDesc(nuevo)]), []);

  const actualizarCantidad = useCallback(
    (id, cantidad) => {
      const c = parseNumber(cantidad);
      const finalC = Number.isFinite(c) && c > 0 ? c : 1;

      const actualizarArray = (items, setItems) => {
        const index = items.findIndex((i) => i.id === id);
        if (index === -1) return false;

        const item = items[index];
        const oldC = parseNumber(item.cantidad) || 1;
        const factor = finalC / (oldC || 1);

        const next = {
          ...item,
          cantidad: finalC,
          total: safeNum(item.total) * factor,
          ...(item.honorarioMedico != null && { honorarioMedico: safeNum(item.honorarioMedico) * factor }),
          ...(item.gastoSanatorial != null && { gastoSanatorial: safeNum(item.gastoSanatorial) * factor }),
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

  const actualizarItem = useCallback(
    (id, patch) => {
      const applyIn = (items, setItems, kind) => {
        const idx = items.findIndex((x) => x.id === id);
        if (idx === -1) return false;

        const current = items[idx];
        let merged = { ...current, ...patch };

        if (kind === 'practica') {
          merged = forceRxDoctor(merged);

          if (patchEsSoloTexto(patch)) {
            setItems((prev) => prev.map((x) => (x.id === id ? merged : x)));
            return true;
          }
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
          if (patchEsSoloTexto(patch)) {
            setItems((prev) => prev.map((x) => (x.id === id ? merged : x)));
            return true;
          }
          if (!valoresConvenio) {
            const total = safeNum(merged.total);
            setItems((prev) =>
              prev.map((x) => (x.id === id ? { ...merged, honorarioMedico: total, gastoSanatorial: 0 } : x))
            );
            return true;
          }
          const normal = normalizarLab(merged, valoresConvenio);
          setItems((prev) => prev.map((x) => (x.id === id ? normal : x)));
          return true;
        }

        if (kind === 'cirugia') {
          if (patchEsSoloTexto(patch)) {
            setItems((prev) => prev.map((x) => (x.id === id ? merged : x)));
            return true;
          }
          const cantidad = Math.max(1, Math.round(parseNumber(merged.cantidad) || 1));
          const baseTotal = safeNum(current.total) || safeNum(merged.total) || 0;
          const total = (baseTotal / (parseNumber(current.cantidad) || 1)) * cantidad;

          setItems((prev) => prev.map((x) => (x.id === id ? { ...merged, cantidad, total } : x)));
          return true;
        }

        if (kind === 'medicamento' || kind === 'descartable') {
          if (patchEsSoloTexto(patch)) {
            setItems((prev) => prev.map((x) => (x.id === id ? merged : x)));
            return true;
          }
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

  const marcarCargaIndependiente = useCallback(() => {
    if (draftFromUrl) return;
    resetStoredDraftId();
    setLockMsg('Carga nueva: al guardar se creara un borrador independiente.');
  }, [draftFromUrl, resetStoredDraftId]);

  const limpiarFactura = useCallback(() => {
    if (!isClient || !window.confirm('¿Limpiar toda la factura?')) return;

    setPracticas([]);
    setCirugias([]);
    setLaboratorios([]);
    setMedicamentos([]);
    setDescartables([]);
    setPaciente({
      pacienteId: '',
      nombreCompleto: '',
      dni: '',
      artSeguro: '',
      nroSiniestro: '',
      fechaAtencion: todayISO(),
    });
    setActiveTab('datos');
    setDraftId('');
    localStorage.removeItem('FACTURACION_DRAFT_ID');
    Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
  }, [isClient]);

  const guardarSiniestro = useCallback(async () => {
    if (!isClient) return;

    const nombre = prompt('Nombre del siniestro:', paciente.nombreCompleto || 'Siniestro');
    if (!nombre) return;

    try {
      const saved = await guardarEnRTDB({ estado: 'borrador', nombre });
      alert(
        `✅ Borrador guardado\nART: ${paciente.artSeguro || 'SIN ART'}\nSiniestro: ${paciente.nroSiniestro || '-'}\nID: ${saved.id}`
      );
    } catch (e) {
      console.error(e);
      alert(lockMsg || e?.message || '❌ Error al guardar. Revisá permisos/ruta.');
    }
  }, [isClient, paciente, guardarEnRTDB, lockMsg]);

  const guardarSiniestroNuevo = useCallback(async () => {
    if (!isClient) return;

    const nombre = prompt('Nombre del nuevo borrador:', paciente.nombreCompleto || 'Siniestro');
    if (!nombre) return;

    try {
      const saved = await guardarEnRTDB({ estado: 'borrador', nombre, forceNew: true });
      alert(
        `Borrador nuevo guardado\nART: ${paciente.artSeguro || 'SIN ART'}\nSiniestro: ${paciente.nroSiniestro || '-'}\nID: ${saved.id}`
      );
      router.replace(`/admin/Facturacion/Nuevo?draft=${saved.id}`);
    } catch (e) {
      console.error(e);
      alert(lockMsg || e?.message || 'Error al guardar el nuevo borrador.');
    }
  }, [isClient, paciente, guardarEnRTDB, lockMsg, router]);

  const cerrarSiniestro = useCallback(async () => {
    if (!isClient) return;

    if (!paciente.nombreCompleto || !paciente.dni) {
      alert('Complete los datos del paciente primero');
      setActiveTab('datos');
      return;
    }

    const nombre = prompt('Nombre del siniestro (para cerrar y facturar):', paciente.nombreCompleto || 'Siniestro');
    if (!nombre) return;

    try {
      const saved = await guardarEnRTDB({ estado: 'cerrado', nombre });

      alert(
        `✅ Factura generada\nNro: ${saved.facturaNro}\nART: ${paciente.artSeguro || 'SIN ART'}\nSiniestro: ${paciente.nroSiniestro || '-'}\nID: ${saved.id}`
      );

      limpiarFactura();
      router.replace('/admin/Facturacion/Nuevo');
    } catch (e) {
      console.error(e);
      alert(lockMsg || e?.message || '❌ Error al cerrar y generar factura.');
    }
  }, [isClient, paciente, guardarEnRTDB, limpiarFactura, lockMsg, router]);

  const puedeNavegar = Boolean(paciente.nombreCompleto && paciente.dni);

  const tabs = [
    { key: 'datos', label: '👤 Datos Paciente' },
    { key: 'practicas', label: '🏥 Prácticas' },
    { key: 'cirugias', label: '🩺 Cirugías' },
    { key: 'laboratorios', label: '🧪 Laboratorios' },
    { key: 'medicamentos', label: '💊 Medicamentos' },
    { key: 'resumen', label: '📋 Resumen' },
  ];

  if (!isClient || loadingStorage || loadingDraft) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>{loadingDraft ? 'Cargando borrador desde Firebase…' : 'Cargando datos…'}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.topNav}>
          <div className={styles.viewToggle}>
            <Link className={styles.toggleBtn} href="/admin/Facturacion/Facturados?estado=borrador">
              📝 Borradores
            </Link>
            <Link className={styles.toggleBtn} href="/admin/Facturacion/Facturados?estado=cerrado">
              ✅ Cerrados
            </Link>
            <Link className={styles.toggleBtnAlt} href="/admin/Facturacion/Facturados">
              📦 Todos
            </Link>
          </div>

          <div className={styles.quickActions}>
            <Link className={styles.toggleBtnAlt} href="/admin/Facturacion/Nuevo?new=1">
              ➕ Nuevo
            </Link>

            {draftId ? (
              <Link className={styles.toggleBtnAlt} href={`/admin/Facturacion/Facturados/${draftId}`}>
                👁 Ver actual
              </Link>
            ) : null}
          </div>
        </div>

        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>Sistema de Facturación Clínica</h1>
            <p className={styles.subtitle}>
              Carga rápida, desglose por Dr/Clínica y exportación.
              {draftId ? <span className={styles.draftPill}>📝 Borrador: {draftId}</span> : null}
            </p>
            {lockMsg ? <div className={styles.alert}>{lockMsg}</div> : null}
          </div>

          <div className={styles.headerActions}>
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
                <option>Cargando convenios…</option>
              ) : (
                Object.keys(convenios).map((k) => (
                  <option key={k} value={k}>
                    {prettyLabel(convenios[k]?.nombre || k)}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className={styles.counterBadge}>
            {totalItems} {totalItems === 1 ? 'ítem' : 'ítems'} en factura
          </div>
        </div>

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

      {/* ===== CARTEL DE DUPLICADOS (sin botón) ===== */}
      {existentes.length > 0 && (
        <div className={styles.duplicateAlert}>
          <div className={styles.duplicateHeader}>
            ⚠️ Este paciente ya tiene {existentes.length}{' '}
            {existentes.length === 1 ? 'registro cargado' : 'registros cargados'}
          </div>
          <div className={styles.duplicateBody}>
            <p>
              Podés abrir uno para editarlo, o seguir cargando este como{' '}
              <b>uno nuevo e independiente</b> (no se pisa con los anteriores).
            </p>
            <div className={styles.duplicateLinks}>
              {existentes.slice(0, 6).map((ex) => (
                <Link
                  key={ex.id}
                  href={`/admin/Facturacion/Nuevo?draft=${ex.id}`}
                  className={styles.duplicateLink}
                >
                  {ex.estado === 'cerrado' ? '✅' : '📝'} {ex.nombre}
                  {ex.nroSiniestro ? ` · Stro ${ex.nroSiniestro}` : ''}
                  {' · '}
                  {new Date(ex.updatedAt || Date.now()).toLocaleDateString('es-AR')}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

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
            <motion.div
              key="datos"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <DatosPaciente
                paciente={paciente}
                setPaciente={setPaciente}
                onSiguiente={() => setActiveTab('practicas')}
                onPacienteSeleccionado={marcarCargaIndependiente}
              />
            </motion.div>
          )}

          {activeTab === 'practicas' && (
            <motion.div
              key="practicas"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <PracticasModule
                practicasAgregadas={practicas}
                agregarPractica={agregarPractica}
                onAtras={() => setActiveTab('datos')}
                onSiguiente={() => setActiveTab('cirugias')}
              />
            </motion.div>
          )}

          {activeTab === 'cirugias' && (
            <motion.div
              key="cirugias"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <CirugiasModule
                cirugiasAgregadas={cirugias}
                practicasAgregadas={practicas}
                agregarCirugia={agregarCirugia}
                agregarPractica={agregarPractica}
                onAtras={() => setActiveTab('practicas')}
                onSiguiente={() => setActiveTab('laboratorios')}
              />
            </motion.div>
          )}

          {activeTab === 'laboratorios' && (
            <motion.div
              key="laboratorios"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <LaboratoriosModule
                laboratoriosAgregados={laboratorios}
                agregarLaboratorio={agregarLaboratorio}
                onAtras={() => setActiveTab('cirugias')}
                onSiguiente={() => setActiveTab('medicamentos')}
              />
            </motion.div>
          )}

          {activeTab === 'medicamentos' && (
            <motion.div
              key="medicamentos"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <MedicamentosModule
                medicamentosAgregados={medicamentos}
                descartablesAgregados={descartables}
                agregarMedicamento={agregarMedicamento}
                agregarDescartable={agregarDescartable}
                actualizarItem={actualizarItem}
                onAtras={() => setActiveTab('laboratorios')}
                onSiguiente={() => setActiveTab('resumen')}
              />
            </motion.div>
          )}

          {activeTab === 'resumen' && (
            <motion.div
              key="resumen"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
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

      {/* ===== BARRA INFERIOR ===== */}
      <div className={styles.footerBar}>
        <div className={styles.footerActions}>
          {draftId ? (
            <button className={styles.btnSecundario} onClick={guardarSiniestroNuevo} disabled={!puedeNavegar}>
              Guardar copia nueva
            </button>
          ) : null}

          {/* Si hay duplicados y no estamos editando, mostramos "Guardar como nuevo" */}
          {existentes.length > 0 && !draftId && (
            <button className={styles.btnPrimario} onClick={guardarSiniestroNuevo} disabled={!puedeNavegar}>
              Guardar como nuevo
            </button>
          )}

          <button className={styles.btnSecundario} onClick={guardarSiniestro} disabled={!puedeNavegar}>
            {draftId ? 'Actualizar borrador' : 'Guardar borrador'}
          </button>
        </div>
      </div>
    </div>
  );
}
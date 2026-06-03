import { get, ref, update } from 'firebase/database';
import { db } from '@/lib/firebase';

const onlyDigits = (value = '') => String(value ?? '').replace(/\D/g, '');

const normalizeKey = (value = '') =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeSiniestro = (value = '') =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

export function getFacturaPaciente(factura = {}) {
  const paciente = factura?.paciente || {};

  return {
    pacienteId: paciente.pacienteId || factura.pacienteId || '',
    dni: paciente.dni || factura.dni || '',
    artNombre: paciente.artSeguro || factura.artNombre || factura.artSeguro || '',
    nroSiniestro: paciente.nroSiniestro || factura.nroSiniestro || '',
  };
}

function scorePacienteMatch(paciente = {}, facturaPaciente = {}) {
  const trabajador = paciente.trabajador || {};
  const art = paciente.ART || {};

  const dniFactura = onlyDigits(facturaPaciente.dni);
  const dniPaciente = onlyDigits(trabajador.dni);
  const siniestroFactura = normalizeSiniestro(facturaPaciente.nroSiniestro);
  const siniestroPaciente = normalizeSiniestro(art.nroSiniestro);
  const artFactura = normalizeKey(facturaPaciente.artNombre);
  const artPaciente = normalizeKey(art.nombre);

  let score = 0;
  if (dniFactura && dniPaciente && dniFactura === dniPaciente) score += 4;
  if (siniestroFactura && siniestroPaciente && siniestroFactura === siniestroPaciente) score += 5;
  if (artFactura && artPaciente && artFactura === artPaciente) score += 2;

  return score;
}

export function findPacienteIdByFactura(pacientes = {}, factura = {}) {
  const facturaPaciente = getFacturaPaciente(factura);
  if (facturaPaciente.pacienteId && pacientes[facturaPaciente.pacienteId]) {
    return facturaPaciente.pacienteId;
  }

  let best = { id: '', score: 0 };
  let sameBestCount = 0;
  for (const [id, paciente] of Object.entries(pacientes || {})) {
    const score = scorePacienteMatch(paciente, facturaPaciente);
    if (score > best.score) {
      best = { id, score };
      sameBestCount = 1;
    } else if (score === best.score && score > 0) {
      sameBestCount++;
    }
  }

  if (best.score >= 6) return best.id;
  if (best.score === 5 && sameBestCount === 1) return best.id;
  return '';
}

export async function cerrarPacientePorFactura(factura = {}, facturaId = '') {
  const pacientesSnap = await get(ref(db, 'pacientes'));
  if (!pacientesSnap.exists()) return null;

  const pacientes = pacientesSnap.val() || {};
  const pacienteId = findPacienteIdByFactura(pacientes, factura);
  if (!pacienteId) return null;

  const paciente = pacientes[pacienteId] || {};
  if (paciente.estado === 'cerrado') return pacienteId;

  await update(ref(db, `pacientes/${pacienteId}`), {
    estado: 'cerrado',
    cerradoAt: Date.now(),
    cerradoPorFacturacionId: facturaId || factura.id || '',
  });

  return pacienteId;
}

export async function cerrarPacientesPorFacturacion(facturacion = {}) {
  const pacientesSnap = await get(ref(db, 'pacientes'));
  if (!pacientesSnap.exists()) return { matched: 0, updated: 0 };

  const pacientes = pacientesSnap.val() || {};
  const updates = {};
  let matched = 0;
  let updated = 0;
  const now = Date.now();

  for (const [facturaId, factura] of Object.entries(facturacion || {})) {
    if (!factura || typeof factura !== 'object' || facturaId === 'siniestros') continue;

    const estado = factura.estado || (factura.cerradoAt ? 'cerrado' : 'borrador');
    if (estado !== 'borrador' && estado !== 'cerrado') continue;

    const pacienteId = findPacienteIdByFactura(pacientes, factura);
    if (!pacienteId) continue;

    matched++;
    if ((pacientes[pacienteId]?.estado || 'activo') === 'cerrado') continue;

    updates[`pacientes/${pacienteId}/estado`] = 'cerrado';
    updates[`pacientes/${pacienteId}/cerradoAt`] = now;
    updates[`pacientes/${pacienteId}/cerradoPorFacturacionId`] = facturaId;
    updates[`pacientes/${pacienteId}/cerradoPorFacturacionEstado`] = estado;
    updated++;
  }

  if (updated > 0) {
    await update(ref(db), updates);
  }

  return { matched, updated };
}

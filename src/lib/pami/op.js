// lib/pami/op.js
import { db } from "./firebase-stub"; // ajustá al import real
import { ref, get, push, set, update } from "firebase/database";

const PATH = "PAMI/pacientes";

export const ESTADOS_OP = [
	{ id: "cargado", label: "Pedido cargado", color: "#6b7280" },
	{ id: "aceptado", label: "Aceptado", color: "#2f6f4e" },
	{ id: "rechazado", label: "Rechazado", color: "#c0392b" },
	{ id: "pasado", label: "Pasado", color: "#2563eb" },
	{ id: "culminado", label: "Culminado", color: "#111827" },
];

export const TIPOS_EVENTO = [
	{ id: "internacion", label: "Internación" },
	{ id: "cirugia", label: "Cirugía" },
	{ id: "practica", label: "Práctica" },
	{ id: "medicacion", label: "Medicación" },
];

/**
 * Crea una OP bajo el paciente. Si el paciente es oncoplan,
 * la OP hereda `oncoplan: true`.
 */
export async function crearOP(
	pacienteKey,
	{ dni, oncoplanPaciente },
	opData,
	{ usuario = "sistema" } = {},
) {
	const now = Date.now();
	const op = {
		nroOP: String(opData.nroOP || "").trim(),
		nroSolicitudMaterial: String(opData.nroSolicitudMaterial || "").trim(),
		tipo: opData.tipo || "practica",
		diagnostico: String(opData.diagnostico || "").trim(),
		cie10: String(opData.cie10 || "").trim(),
		fechaSolicitud:
			opData.fechaSolicitud || new Date().toISOString().slice(0, 10),
		fechaAutorizacion: opData.fechaAutorizacion || null,
		medicoSolicitante: opData.medicoSolicitante || null,
		oncoplan: !!oncoplanPaciente,
		estado: "cargado",
		historial: [
			{
				estado: "cargado",
				fecha: now,
				usuario,
				nota: "Pedido cargado",
			},
		],
		adjuntos: [],
		createdBy: usuario,
		createdAt: now,
		updatedBy: usuario,
		updatedAt: now,
	};

	const node = push(ref(db, `${PATH}/${pacienteKey}/ops`));
	await set(node, op);
	return { id: node.key, ...op };
}

export async function cambiarEstadoOP(
	pacienteKey,
	opId,
	nuevoEstado,
	{ usuario = "sistema", nota = "" } = {},
) {
	const refOp = ref(db, `${PATH}/${pacienteKey}/ops/${opId}`);
	const snap = await get(refOp);
	if (!snap.exists()) throw new Error("OP no encontrada");
	const op = snap.val();
	const historial = Array.isArray(op.historial) ? [...op.historial] : [];
	historial.push({ estado: nuevoEstado, fecha: Date.now(), usuario, nota });

	const patch = {
		estado: nuevoEstado,
		historial,
		updatedAt: Date.now(),
		updatedBy: usuario,
	};
	if (nuevoEstado === "aceptado" && !op.fechaAutorizacion) {
		patch.fechaAutorizacion = new Date().toISOString().slice(0, 10);
	}
	await update(refOp, patch);
}

export async function listarOPsPaciente(pacienteKey) {
	const snap = await get(ref(db, `${PATH}/${pacienteKey}/ops`));
	if (!snap.exists()) return [];
	return Object.entries(snap.val())
		.map(([id, v]) => ({ id, ...v }))
		.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

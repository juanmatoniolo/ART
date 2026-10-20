// lib/pami/pacientes.js
// Estado del paciente + Oncoplan. Podés mergearlo con `lib/pami.js` o importarlo aparte.
import { db } from "@/lib/firebase";
import { ref, update } from "firebase/database";

const PATH = "PAMI/pacientes";

const dniKeyLocal = (raw) => {
	const d = String(raw ?? "").replace(/\D/g, "");
	return d.length === 11 ? d.slice(2, 10) : d;
};

export const ESTADOS_PACIENTE = [
	{
		id: "activo",
		label: "Activo",
		color: "#2f6f4e",
		bg: "rgba(47,111,78,.14)",
		icon: "●",
	},
	{
		id: "alta",
		label: "Alta",
		color: "#2563eb",
		bg: "rgba(37,99,235,.14)",
		icon: "▲",
	},
	{
		id: "fallecido",
		label: "Fallecido",
		color: "#6b7280",
		bg: "rgba(107,114,128,.14)",
		icon: "✕",
	},
];

export const estadoDef = (id) =>
	ESTADOS_PACIENTE.find((e) => e.id === id) || ESTADOS_PACIENTE[0];

export async function cambiarEstadoPaciente(
	dni,
	nuevoEstado,
	{ usuario = "sistema", nota = "" } = {},
) {
	const key = dniKeyLocal(dni);
	await update(ref(db, `${PATH}/${key}`), {
		estado: nuevoEstado,
		estadoCambiado: {
			estado: nuevoEstado,
			fecha: Date.now(),
			por: usuario,
			nota,
		},
		updatedAt: Date.now(),
		modifiedBy: usuario,
	});
}

export async function setOncoplanPaciente(
	dni,
	oncoplan,
	{ usuario = "sistema" } = {},
) {
	const key = dniKeyLocal(dni);
	await update(ref(db, `${PATH}/${key}`), {
		oncoplan: !!oncoplan,
		oncoplanConfirmado: oncoplan
			? { por: usuario, fecha: Date.now() }
			: null,
		updatedAt: Date.now(),
		modifiedBy: usuario,
	});
}

export function puedeGenerarEventos(paciente) {
	return paciente?.estado !== "fallecido";
}

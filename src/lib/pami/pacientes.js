// Agregar a lib/pami.js existente

export const ESTADOS_PACIENTE = [
	{ id: "activo", label: "Activo", color: "#2f6f4e" },
	{ id: "alta", label: "Alta", color: "#2563eb" },
	{ id: "fallecido", label: "Fallecido", color: "#6b7280" },
];

/**
 * Cambia el estado del paciente y registra el cambio en `estadoCambiado`.
 */
export async function cambiarEstadoPaciente(
	dni,
	nuevoEstado,
	{ usuario = "sistema", nota = "" } = {},
) {
	const key = dniKey(dni);
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

/**
 * Marca/desmarca el flag Oncoplan con confirmación explícita.
 */
export async function setOncoplanPaciente(
	dni,
	oncoplan,
	{ usuario = "sistema" } = {},
) {
	const key = dniKey(dni);
	await update(ref(db, `${PATH}/${key}`), {
		oncoplan: !!oncoplan,
		oncoplanConfirmado: oncoplan
			? { por: usuario, fecha: Date.now() }
			: null,
		updatedAt: Date.now(),
		modifiedBy: usuario,
	});
}

/**
 * Guard: bloquea generar nuevas OP/eventos para pacientes fallecidos.
 */
export function puedeGenerarEventos(paciente) {
	return paciente?.estado !== "fallecido";
}

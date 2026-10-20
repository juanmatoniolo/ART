// lib/pami/internaciones.js
import { db } from "@/lib/firebase";
import { ref, push, set, update, get, remove } from "firebase/database";
import {
	PRESTADOR_CONST,
	onlyDigits,
	buildHabitacionCama,
	buildHabitacionCamaTexto,
	normalizeYear2,
	formatIdField,
	getPdfPages,
} from "@/app/ingresos/helpers";

const INGRESOS_NODE = "ingresos-pacientes";
const PAMI_PATH = "PAMI/pacientes";

/** Construye el payload con el MISMO schema que usa /ingresos.jsx */
function buildIngresoPayload(form, extra = {}) {
	const habitacionCama = buildHabitacionCama(form);
	const habitacionCamaTexto = buildHabitacionCamaTexto(form);
	const anio = normalizeYear2(form.anioIngreso);
	const lugarNac = (form.trabajadorLugarNacimiento || "")
		.trim()
		.toUpperCase();

	return {
		OS: (form.OS || "").trim().toUpperCase(),
		afiliadoPaciente: (form.afiliadoPaciente || "").trim().toUpperCase(),
		historiaClinica: (form.historiaClinica || "").trim().toUpperCase(),
		tipoIngreso: form.tipoIngreso || "PISO",
		"nacimiento-paciente": lugarNac,
		nacimientoPaciente: lugarNac,
		lugarNacimiento: lugarNac,
		fechaIngreso: {
			dia: onlyDigits(form.diaIngreso).slice(-2),
			mes: onlyDigits(form.mesIngreso).slice(-2),
			anio,
		},
		trabajador: {
			apellido: form.trabajadorApellido.trim().toUpperCase(),
			nombre: form.trabajadorNombre.trim().toUpperCase(),
			dni: formatIdField(form.trabajadorDni) || "",
			nacimiento: form.trabajadorNacimiento || "",
			lugarNacimiento: lugarNac,
			edad: form.trabajadorEdad || "",
			sexo: form.trabajadorSexo || "",
			calle: form.trabajadorCalle.trim().toUpperCase() || "",
			numero: form.trabajadorNumero.trim().toUpperCase() || "",
			piso: form.trabajadorPiso.trim().toUpperCase() || "",
			depto: form.trabajadorDepto.trim().toUpperCase() || "",
			localidad: form.trabajadorLocalidad.trim().toUpperCase() || "",
			provincia: form.trabajadorProvincia.trim().toUpperCase() || "",
			cp: onlyDigits(form.trabajadorCP) || "",
			telefono: onlyDigits(form.trabajadorTelefono),
		},
		familiar: {
			nombre: (form.familiarNombre || "").trim().toUpperCase(),
			parentezco: (form.familiarParentezco || "").trim().toUpperCase(),
			telefono: onlyDigits(form.familiarTelefono),
		},
		internacion: {
			camaNumero: onlyDigits(form.camaNumero),
			camaLetra:
				form.tipoIngreso === "UTI"
					? ""
					: (form.camaLetra || "").trim().toUpperCase(),
			habitacionCama,
			habitacionCamaTexto,
		},
		medicoSolicitante: (form.medicoSolicitante || "").trim().toUpperCase(),
		diagnostico: (form.diagnostico || "").trim().toUpperCase(),
		documentacion: [],
		prestador: PRESTADOR_CONST,
		...extra,
	};
}

/**
 * Guarda la internación en DOS nodos:
 *   - ingresos-pacientes/{id}                         → para imprimir desde /ingresos
 *   - PAMI/pacientes/{dni}/internaciones/{pamiId}    → para el timeline PAMI
 * Ambos quedan linkeados con pamiId ↔ ingresosId.
 */
export async function guardarInternacionPami({
	pacienteDni,
	pacienteData,
	opId,
	opData,
	grupoMedico = {},
	medicoTratante = null,
	form, // mismo shape que ingresos.jsx
	oncoplan = false,
	usuario = "sistema",
}) {
	const pacienteKey = String(pacienteDni || "").replace(/\D/g, "");
	if (!pacienteKey) throw new Error("DNI inválido");

	const now = Date.now();

	// 1) Guardar en ingresos-pacientes (mismo schema que /ingresos)
	const ingresoRef = push(ref(db, INGRESOS_NODE));
	const ingresoPayload = {
		...buildIngresoPayload(form, {
			pamiPacienteKey: pacienteKey,
			opId: opId || null,
			oncoplan,
			estado: "abierto",
		}),
		createdBy: usuario,
		createdAt: now,
		updatedAt: now,
	};
	await set(ingresoRef, ingresoPayload);

	// 2) Guardar link en PAMI/pacientes/{dni}/internaciones
	const pamiRef = push(ref(db, `${PAMI_PATH}/${pacienteKey}/internaciones`));
	const pamiPayload = {
		ingresosId: ingresoRef.key,
		opId: opId || null,
		tipo: form.tipoIngreso || "PISO",
		oncoplan,
		fechaIngreso: `${form.anioIngreso?.length === 4 ? form.anioIngreso : `20${form.anioIngreso}`}-${form.mesIngreso}-${form.diaIngreso}`,
		fechaEgreso: null,
		cama: buildHabitacionCama(form) || "",
		medicoTratante: medicoTratante || {
			nombre: form.medicoSolicitante || "",
		},
		grupoMedico: {
			cirujano: grupoMedico.cirujano || "",
			ayudante1: grupoMedico.ayudante1 || "",
			ayudante2: grupoMedico.ayudante2 || "",
			anestesista: grupoMedico.anestesista || "",
		},
		diagnostico: form.diagnostico || "",
		estado: "activa",
		historial: [
			{
				estado: "activa",
				fecha: now,
				usuario,
				nota: "Internación creada",
			},
		],
		createdBy: usuario,
		createdAt: now,
		updatedBy: usuario,
		updatedAt: now,
	};
	await set(pamiRef, pamiPayload);

	// 3) Back-reference: ingresos-pacientes → pamiInternacionId
	await update(ref(db, `${INGRESOS_NODE}/${ingresoRef.key}`), {
		pamiInternacionId: pamiRef.key,
		updatedAt: now,
	});

	// 4) Si hay OP vinculada, marcarla como "pasado" y trackear el evento
	if (opId) {
		const opRef = ref(db, `${PAMI_PATH}/${pacienteKey}/ops/${opId}`);
		const opSnap = await get(opRef);
		if (opSnap.exists()) {
			const op = opSnap.val();
			const historial = Array.isArray(op.historial)
				? [...op.historial]
				: [];
			historial.push({
				estado: "pasado",
				fecha: now,
				usuario,
				nota: "Internación iniciada",
			});
			await update(opRef, {
				estado: "pasado",
				historial,
				internacionId: pamiRef.key,
				updatedAt: now,
				updatedBy: usuario,
			});
		}
	}

	return {
		ingresosId: ingresoRef.key,
		pamiId: pamiRef.key,
		payload: ingresoPayload,
		tipoIngreso: form.tipoIngreso || "PISO",
	};
}

/** Cierra la internación (marca fechaEgreso y estado). */
export async function cerrarInternacionPami(
	pacienteDni,
	pamiId,
	{ usuario = "sistema", nota = "" } = {},
) {
	const pacienteKey = String(pacienteDni || "").replace(/\D/g, "");
	const now = Date.now();
	const refInt = ref(
		db,
		`${PAMI_PATH}/${pacienteKey}/internaciones/${pamiId}`,
	);
	const snap = await get(refInt);
	if (!snap.exists()) throw new Error("Internación no encontrada");
	const data = snap.val();
	const historial = Array.isArray(data.historial) ? [...data.historial] : [];
	historial.push({ estado: "cerrada", fecha: now, usuario, nota });

	await update(refInt, {
		estado: "cerrada",
		fechaEgreso: new Date().toISOString().slice(0, 10),
		historial,
		updatedAt: now,
		updatedBy: usuario,
	});

	if (data.ingresosId) {
		await update(ref(db, `${INGRESOS_NODE}/${data.ingresosId}`), {
			estado: "cerrado",
			updatedAt: now,
		});
	}
}

export async function listarInternacionesPaciente(pacienteDni) {
	const pacienteKey = String(pacienteDni || "").replace(/\D/g, "");
	const snap = await get(
		ref(db, `${PAMI_PATH}/${pacienteKey}/internaciones`),
	);
	if (!snap.exists()) return [];
	return Object.entries(snap.val())
		.map(([id, v]) => ({ id, ...v }))
		.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export const eliminarInternacionPami = (pacienteDni, pamiId) =>
	remove(
		ref(
			db,
			`${PAMI_PATH}/${String(pacienteDni).replace(/\D/g, "")}/internaciones/${pamiId}`,
		),
	);

export const listarTodasLasInternaciones = (pacientesDb = []) => {
	const out = [];
	for (const pac of pacientesDb) {
		for (const [id, v] of Object.entries(pac.internaciones || {})) {
			out.push({
				id,
				pacienteDni: pac.dni,
				pacienteNombre: [pac.apellido, pac.nombre]
					.filter(Boolean)
					.join(" "),
				pacienteAfiliado: pac.afiliado || "",
				pacienteOncoplan: !!pac.oncoplan,
				pacienteEstado: pac.estado || "activo",
				...v,
				oncoplan: v.oncoplan ?? !!pac.oncoplan,
			});
		}
	}
	return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
};

// lib/pami/cirugias.js
import { db } from "@/lib/firebase";
import { ref, push, set, update, get, remove } from "firebase/database";
import { guardarInternacionPami } from "./internaciones"; // reutiliza el payload builder
import {
	PRESTADOR_CONST,
	onlyDigits,
	normalizeYear2,
	formatIdField,
	buildHabitacionCama,
	buildHabitacionCamaTexto,
} from "@/app/ingresos/helpers";

const INGRESOS_NODE = "ingresos-pacientes";
const PAMI_PATH = "PAMI/pacientes";

// Reutilizamos la misma construcción que internación (mismo schema)
import { guardarInternacionPami as _internacion } from "./internaciones";

/**
 * Cirugía: mismo flujo que internación pero con fechaCirugia,
 * internacionId opcional y documento distinto.
 */
export async function guardarCirugiaPami({
	pacienteDni,
	pacienteData,
	opId,
	grupoMedico = {},
	internacionId = null, // si la cirugía es durante una internación
	form,
	oncoplan = false,
	usuario = "sistema",
}) {
	const pacienteKey = String(pacienteDni || "").replace(/\D/g, "");
	if (!pacienteKey) throw new Error("DNI inválido");

	const now = Date.now();

	// 1) Guardar en ingresos-pacientes
	const ingresoRef = push(ref(db, INGRESOS_NODE));
	const ingresoPayload = {
		OS: (form.OS || "").trim().toUpperCase(),
		afiliadoPaciente: (form.afiliadoPaciente || "").trim().toUpperCase(),
		historiaClinica: (form.historiaClinica || "").trim().toUpperCase(),
		tipoIngreso: "CIRUGIA",
		fechaIngreso: {
			dia: onlyDigits(form.diaCirugia || "").slice(-2),
			mes: onlyDigits(form.mesCirugia || "").slice(-2),
			anio: normalizeYear2(form.anioCirugia || ""),
		},
		trabajador: {
			apellido: form.trabajadorApellido.trim().toUpperCase(),
			nombre: form.trabajadorNombre.trim().toUpperCase(),
			dni: formatIdField(form.trabajadorDni) || "",
			nacimiento: form.trabajadorNacimiento || "",
			edad: form.trabajadorEdad || "",
			sexo: form.trabajadorSexo || "",
			calle: form.trabajadorCalle?.trim().toUpperCase() || "",
			numero: form.trabajadorNumero?.trim().toUpperCase() || "",
			piso: form.trabajadorPiso?.trim().toUpperCase() || "",
			depto: form.trabajadorDepto?.trim().toUpperCase() || "",
			localidad: form.trabajadorLocalidad?.trim().toUpperCase() || "",
			provincia: form.trabajadorProvincia?.trim().toUpperCase() || "",
			cp: onlyDigits(form.trabajadorCP) || "",
			telefono: onlyDigits(form.trabajadorTelefono || ""),
		},
		familiar: {
			nombre: (form.familiarNombre || "").trim().toUpperCase(),
			parentezco: (form.familiarParentezco || "").trim().toUpperCase(),
			telefono: onlyDigits(form.familiarTelefono || ""),
		},
		internacion: {
			camaNumero: onlyDigits(form.camaNumero || ""),
			camaLetra: (form.camaLetra || "").trim().toUpperCase(),
			habitacionCama: buildHabitacionCama(form),
			habitacionCamaTexto: buildHabitacionCamaTexto(form),
		},
		medicoSolicitante: (form.medicoSolicitante || "").trim().toUpperCase(),
		diagnostico: (form.diagnostico || "").trim().toUpperCase(),
		documentacion: [],
		prestador: PRESTADOR_CONST,
		pamiPacienteKey: pacienteKey,
		pamiCirugiaId: null, // se setea abajo
		opId: opId || null,
		internacionId: internacionId || null,
		oncoplan,
		estado: "abierto",
		createdBy: usuario,
		createdAt: now,
		updatedAt: now,
	};
	await set(ingresoRef, ingresoPayload);

	// 2) Guardar link en PAMI/pacientes/{dni}/cirugias
	const pamiRef = push(ref(db, `${PAMI_PATH}/${pacienteKey}/cirugias`));
	const fechaISO = `${form.anioCirugia?.length === 4 ? form.anioCirugia : `20${form.anioCirugia}`}-${form.mesCirugia}-${form.diaCirugia}`;
	const pamiPayload = {
		ingresosId: ingresoRef.key,
		opId: opId || null,
		internacionId: internacionId || null,
		oncoplan,
		fechaCirugia: fechaISO,
		grupoMedico: {
			cirujano: grupoMedico.cirujano || "",
			ayudante1: grupoMedico.ayudante1 || "",
			ayudante2: grupoMedico.ayudante2 || "",
			anestesista: grupoMedico.anestesista || "",
		},
		diagnostico: form.diagnostico || "",
		estado: "programada",
		historial: [
			{
				estado: "programada",
				fecha: now,
				usuario,
				nota: "Cirugía creada",
			},
		],
		createdBy: usuario,
		createdAt: now,
		updatedBy: usuario,
		updatedAt: now,
	};
	await set(pamiRef, pamiPayload);

	// 3) Back-reference
	await update(ref(db, `${INGRESOS_NODE}/${ingresoRef.key}`), {
		pamiCirugiaId: pamiRef.key,
		updatedAt: now,
	});

	// 4) Si hay OP, marcarla como "pasado"
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
				nota: "Cirugía realizada",
			});
			await update(opRef, {
				estado: "pasado",
				historial,
				cirugiaId: pamiRef.key,
				updatedAt: now,
				updatedBy: usuario,
			});
		}
	}

	return {
		ingresosId: ingresoRef.key,
		pamiId: pamiRef.key,
		payload: ingresoPayload,
		tipoIngreso: "CIRUGIA",
	};
}

export async function cerrarCirugiaPami(
	pacienteDni,
	pamiId,
	{ usuario = "sistema", nota = "" } = {},
) {
	const pacienteKey = String(pacienteDni || "").replace(/\D/g, "");
	const now = Date.now();
	const refCx = ref(db, `${PAMI_PATH}/${pacienteKey}/cirugias/${pamiId}`);
	const snap = await get(refCx);
	if (!snap.exists()) throw new Error("Cirugía no encontrada");
	const data = snap.val();
	const historial = Array.isArray(data.historial) ? [...data.historial] : [];
	historial.push({ estado: "realizada", fecha: now, usuario, nota });
	await update(refCx, {
		estado: "realizada",
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

export async function listarCirugiasPaciente(pacienteDni) {
	const pacienteKey = String(pacienteDni || "").replace(/\D/g, "");
	const snap = await get(ref(db, `${PAMI_PATH}/${pacienteKey}/cirugias`));
	if (!snap.exists()) return [];
	return Object.entries(snap.val())
		.map(([id, v]) => ({ id, ...v }))
		.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

export const eliminarCirugiaPami = (pacienteDni, pamiId) =>
	remove(
		ref(
			db,
			`${PAMI_PATH}/${String(pacienteDni).replace(/\D/g, "")}/cirugias/${pamiId}`,
		),
	);

export const listarTodasLasCirugias = (pacientesDb = []) => {
	const out = [];
	for (const pac of pacientesDb) {
		for (const [id, v] of Object.entries(pac.cirugias || {})) {
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

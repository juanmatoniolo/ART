// src/lib/pami.js
import { db } from "./firebase";
import { ref, get, set, update, push, remove } from "firebase/database";

const PATH = "PAMI/pacientes";

/** Clave del paciente = DNI (8 dígitos). Si llega un CUIL (11), extrae el DNI. */
export const dniKey = (raw) => {
	const d = String(raw ?? "").replace(/\D/g, "");
	return d.length === 11 ? d.slice(2, 10) : d;
};

// RTDB rechaza `undefined`: lo eliminamos antes de escribir
const clean = (obj) => JSON.parse(JSON.stringify(obj));

// { a: 1, b: { c: 2 } } → { "a": 1, "b/c": 2 } (omite vacíos; permite merge sin pisar hermanos)
const aplanar = (obj, prefix = "", out = {}) => {
	for (const [k, v] of Object.entries(obj)) {
		if (v === undefined || v === null || v === "") continue;
		if (typeof v === "object" && !Array.isArray(v))
			aplanar(v, `${prefix}${k}/`, out);
		else out[`${prefix}${k}`] = v;
	}
	return out;
};

/* ───────────── Pacientes ───────────── */

/**
 * Ingreso PAMI: crea PAMI/pacientes/{dni}. Si ya existe devuelve { exists: true } sin escribir;
 * con { actualizar: true } hace merge por campos de primer nivel.
 */
export async function guardarPacientePami(
	paciente,
	{ usuario = "sistema", actualizar = false } = {},
) {
	try {
		const key = dniKey(paciente.dni);
		if (key.length < 7) return { success: false, error: "DNI inválido" };

		const nodo = ref(db, `${PATH}/${key}`);
		const snap = await get(ref(db, `${PATH}/${key}/dni`)); // existencia barata
		if (snap.exists() && !actualizar)
			return { success: false, exists: true, key };

		const now = Date.now();
		const data = clean({
			...paciente,
			dni: key,
			modifiedBy: usuario,
			updatedAt: now,
		});

		if (snap.exists()) await update(nodo, data);
		else await set(nodo, { ...data, createdBy: usuario, createdAt: now });

		return { success: true, key, updated: snap.exists() };
	} catch (error) {
		console.error("❌ Error al guardar paciente PAMI:", error);
		return { success: false, error: error.message };
	}
}

/**
 * Crea el paciente si no existe; si existe, completa/actualiza solo los campos
 * no vacíos (merge por path, no pisa `medicamentos` ni `cirugia`).
 */
export async function asegurarPacientePami(
	datos,
	{ usuario = "sistema" } = {},
) {
	const key = dniKey(datos.dni);
	if (key.length < 7) throw new Error("DNI inválido");

	const existe = (await get(ref(db, `${PATH}/${key}/dni`))).exists();
	const now = Date.now();
	await update(ref(db, `${PATH}/${key}`), {
		...aplanar({ ...datos, dni: key }),
		modifiedBy: usuario,
		updatedAt: now,
		...(existe ? {} : { createdBy: usuario, createdAt: now }),
	});
	return { key, creado: !existe };
}

/** Devuelve el paciente completo (incluye `medicamentos`) o null. */
export async function obtenerPacientePami(dni) {
	const snap = await get(ref(db, `${PATH}/${dniKey(dni)}`));
	return snap.exists() ? snap.val() : null;
}

/* ───────────── Presupuestos de medicación (PAMI/pacientes/{dni}/medicamentos) ───────────── */

export async function guardarPresupuestoPami(
	pacienteKey,
	presupuesto,
	{ usuario = "sistema", id = null } = {},
) {
	const now = Date.now();
	const data = clean({
		...presupuesto,
		estado: "borrador",
		modifiedBy: usuario,
		updatedAt: now,
	});

	if (id) {
		await update(
			ref(db, `${PATH}/${pacienteKey}/medicamentos/${id}`),
			data,
		);
		return { id };
	}
	const nuevo = push(ref(db, `${PATH}/${pacienteKey}/medicamentos`));
	await set(nuevo, { ...data, createdBy: usuario, createdAt: now });
	return { id: nuevo.key };
}

export const eliminarPresupuestoPami = (pacienteKey, id) =>
	remove(ref(db, `${PATH}/${pacienteKey}/medicamentos/${id}`));

// lib/pami/medicos.js
import { db } from "@/lib/firebase";
import {
	ref,
	get,
	set,
	update,
	push,
	remove,
	onValue,
} from "firebase/database";

const PATH = "PAMI/medicos";

export async function listarMedicos() {
	const snap = await get(ref(db, PATH));
	if (!snap.exists()) return [];
	return Object.entries(snap.val())
		.map(([id, m]) => ({ id, ...m }))
		.filter((m) => m.activo !== false)
		.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
}

export function suscribirMedicos(cb) {
	return onValue(ref(db, PATH), (snap) => {
		const data = snap.val() || {};
		cb(
			Object.entries(data)
				.map(([id, m]) => ({ id, ...m }))
				.filter((m) => m.activo !== false)
				.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || "")),
		);
	});
}

export async function guardarMedico(data) {
	const now = Date.now();
	const node = push(ref(db, PATH));
	await set(node, { ...data, activo: true, createdAt: now, updatedAt: now });
	return node.key;
}

export async function actualizarMedico(id, data) {
	await update(ref(db, `${PATH}/${id}`), { ...data, updatedAt: Date.now() });
}

export const eliminarMedico = (id) => remove(ref(db, `${PATH}/${id}`));

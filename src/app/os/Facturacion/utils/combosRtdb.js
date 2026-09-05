import { ref, push, set, update, remove, onValue } from "firebase/database";
import { db } from "@/lib/firebase";

const combosRef = () => ref(db, "medydescartables/combos");

export function listenCombos(cb) {
	return onValue(combosRef(), (snap) => cb(snap.exists() ? snap.val() : {}));
}

export async function createCombo(combo) {
	const r = push(combosRef());
	const now = Date.now();
	await set(r, { ...combo, createdAt: now, updatedAt: now });
	return r.key;
}

export async function updateCombo(id, patch) {
	const now = Date.now();
	await update(ref(db, `medydescartables/combos/${id}`), {
		...patch,
		updatedAt: now,
	});
}

export async function deleteCombo(id) {
	await remove(ref(db, `medydescartables/combos/${id}`));
}

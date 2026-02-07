export const NOTES_NODE = "utilidades_root/notes";

export function nowTs() {
	return Date.now();
}

export function normalizeText(input) {
	if (typeof input !== "string") return "";
	return input.trim().replace(/\s+/g, " ");
}

export function safeText(input, maxLen) {
	const txt = normalizeText(input);
	if (!maxLen) return txt;
	return txt.length > maxLen ? txt.slice(0, maxLen) : txt;
}

export function parseTags(input) {
	const raw = normalizeText(input);
	if (!raw) return [];
	const parts = raw
		.split(",")
		.map((t) => normalizeText(t).toLowerCase())
		.filter(Boolean)
		.map((t) => t.replace(/\s+/g, "_"))
		.map((t) => t.replace(/[^a-z0-9_áéíóúñü-]/gi, ""))
		.filter(Boolean);

	return Array.from(new Set(parts)).slice(0, 12);
}

export function isDueWithinDays(note, days) {
	if (!note || note.archived) return false;
	if (!note.date) return false;
	const t = new Date(note.date).getTime();
	if (Number.isNaN(t)) return false;

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const max = new Date(today);
	max.setDate(max.getDate() + days);

	return t >= today.getTime() && t <= max.getTime();
}

export function isOverdue(note) {
	if (!note || note.archived) return false;
	if (!note.date) return false;
	const t = new Date(note.date).getTime();
	if (Number.isNaN(t)) return false;

	const today = new Date();
	today.setHours(0, 0, 0, 0);

	return t < today.getTime();
}

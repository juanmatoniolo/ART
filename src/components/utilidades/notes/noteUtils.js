// noteUtils.js
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

export function formatDdMmYyyy(yyyyMmDd) {
	// "2026-02-07" => "07/02/2026"
	if (!yyyyMmDd || typeof yyyyMmDd !== "string") return "";
	const m = yyyyMmDd.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!m) return yyyyMmDd;
	const [, y, mo, d] = m;
	return `${d}/${mo}/${y}`;
}

export function startOfDayLocalMs(yyyyMmDd) {
	const d = new Date(`${yyyyMmDd}T00:00:00`);
	const t = d.getTime();
	return Number.isNaN(t) ? null : t;
}

export function daysUntil(yyyyMmDd) {
	const due = startOfDayLocalMs(yyyyMmDd);
	if (!due) return null;

	const now = new Date();
	const todayStart = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	const diffMs = due - todayStart;
	return Math.floor(diffMs / (24 * 60 * 60 * 1000));
}

export function urgencyBucket(note) {
	// devuelve: "overdue" | "red" | "yellow" | "green" | "none"
	if (!note || !note.date) return "none";
	const d = daysUntil(note.date);
	if (d === null) return "none";
	if (d < 0) return "overdue";
	if (d <= 3) return "red";
	if (d <= 7) return "yellow";
	return "green";
}

export function isOverdue(note) {
	if (!note || !note.date) return false;
	const d = daysUntil(note.date);
	return typeof d === "number" && d < 0;
}

export function isDueWithinDays(note, days) {
	if (!note || !note.date) return false;
	const d = daysUntil(note.date);
	return typeof d === "number" && d >= 0 && d <= (Number(days) || 0);
}

export function addDaysToYyyyMmDd(days) {
	const n = Number(days);
	if (!Number.isFinite(n) || n < 0) return "";
	const now = new Date();
	const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	base.setDate(base.getDate() + n);

	const y = base.getFullYear();
	const m = String(base.getMonth() + 1).padStart(2, "0");
	const d = String(base.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

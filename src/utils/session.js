// utils/session.js

const SESSION_KEY = "userSession";
const EXPIRATION_MS = 4 * 60 * 60 * 1000; // 4 horas

export function setSession(userData) {
	if (typeof window === "undefined") return; // ✅ Previene errores SSR

	const data = {
		...userData,
		expiresAt: Date.now() + EXPIRATION_MS,
	};

	try {
		localStorage.setItem(SESSION_KEY, JSON.stringify(data));
	} catch (err) {
		console.error("❌ Error al guardar sesión:", err);
	}
}

export function getSession() {
	if (typeof window === "undefined") return null; // ✅ Previene ReferenceError

	try {
		const session = localStorage.getItem(SESSION_KEY);
		if (!session) return null;

		const data = JSON.parse(session);
		if (Date.now() > data.expiresAt) {
			localStorage.removeItem(SESSION_KEY);
			return null;
		}

		return data;
	} catch (err) {
		console.error("❌ Error al obtener sesión:", err);
		return null;
	}
}

export function clearSession() {
	if (typeof window === "undefined") return; // ✅ Previene errores SSR
	try {
		localStorage.removeItem(SESSION_KEY);
	} catch (err) {
		console.error("❌ Error al limpiar sesión:", err);
	}
}

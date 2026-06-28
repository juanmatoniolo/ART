// utils/session.js

const SESSION_KEY = "userSession";
const EXPIRATION_MS = 7 * 60 * 60 * 1000; // 7 horas

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

export function isAuthenticated() {
	if (typeof window === "undefined") return false; // ✅ Previene errores SSR

	const session = getSession();
	return session !== null && session !== undefined;
}

// ✅ ¿Es el usuario root? (acceso total)
// Funciona si lo marcás con root:true o con TipoEmpleado:'ROOT'
export function isRoot() {
	const session = getSession();
	if (!session) return false;
	return session.root === true || session.TipoEmpleado === "ROOT";
}

// ✅ ¿Puede acceder a una ruta según su rol?
// El root pasa SIEMPRE, sin importar los roles permitidos.
export function hasAccess(rolesPermitidos = []) {
	const session = getSession();
	if (!session) return false; // no logueado
	if (isRoot()) return true; // 👈 acceso total
	return rolesPermitidos.includes(session.TipoEmpleado);
}

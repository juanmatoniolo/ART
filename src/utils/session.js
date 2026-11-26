// utils/session.js
// Caché local del perfil del usuario autenticado con Firebase Auth.
// La fuente de verdad es Firebase (Auth + usuarios/{uid}); este caché solo
// existe para que las pantallas puedan leer la sesión de forma síncrona.
// La seguridad real la imponen las reglas de la base: editar este caché
// a mano no da acceso a ningún dato.

import { rolesFromMap, roleLabel, roleLegacy } from "@/lib/roles";

const SESSION_KEY = "userSession";
const EXPIRATION_MS = 7 * 60 * 60 * 1000; // 7 horas (se renueva en cada carga)

/** Arma el objeto de sesión a partir del usuario de Auth y su perfil en la base. */
export function buildSession(authUser, profile) {
	const roles = rolesFromMap(profile?.roles);
	const username = profile?.user || (authUser?.email || "").split("@")[0];
	return {
		uid: authUser.uid,
		id: authUser.uid,
		key: authUser.uid,
		user: username,
		usuario: username,
		nombre: profile?.nombre || username,
		email: profile?.email || authUser.email || "",
		roles,
		// Nombres históricos (los comparan las pantallas viejas)
		roleLabels: roles.map(roleLegacy),
		// Nombres para mostrar (SUPERROOT, ROOT, ART, ...)
		displayRoles: roles.map(roleLabel),
		// Compatibilidad: rol principal con el nombre histórico
		TipoEmpleado: roles.length ? roleLegacy(roles[0]) : "",
		root: roles.includes("ROOT"),
	};
}

export function setSession(userData) {
	if (typeof window === "undefined") return;
	try {
		localStorage.setItem(
			SESSION_KEY,
			JSON.stringify({ ...userData, expiresAt: Date.now() + EXPIRATION_MS })
		);
		window.dispatchEvent(new Event("session-change"));
	} catch (err) {
		console.error("Error al guardar sesión:", err);
	}
}

export function getSession() {
	if (typeof window === "undefined") return null;
	try {
		const raw = localStorage.getItem(SESSION_KEY);
		if (!raw) return null;
		const data = JSON.parse(raw);
		if (!data?.uid || Date.now() > data.expiresAt) {
			localStorage.removeItem(SESSION_KEY);
			return null;
		}
		return data;
	} catch (err) {
		console.error("Error al obtener sesión:", err);
		return null;
	}
}

export function clearSession() {
	if (typeof window === "undefined") return;
	try {
		localStorage.removeItem(SESSION_KEY);
		window.dispatchEvent(new Event("session-change"));
	} catch (err) {
		console.error("Error al limpiar sesión:", err);
	}
}

export function isAuthenticated() {
	return getSession() != null;
}

/** Roles (ids) de la sesión actual. */
export function sessionRoles(session = getSession()) {
	return Array.isArray(session?.roles) ? session.roles : [];
}

/** ¿La sesión tiene alguno de estos roles? Acepta ids ("FARMACIA") o nombres históricos ("Farmacia"). */
export function hasRole(session, ...wanted) {
	const ids = sessionRoles(session);
	const labels = session?.roleLabels || [];
	return wanted.some((w) => ids.includes(w) || labels.includes(w));
}

// ¿Es ROOT? (acceso total)
export function isRoot() {
	return sessionRoles().includes("ROOT");
}

// ¿Puede acceder según sus roles? ROOT pasa siempre.
export function hasAccess(rolesPermitidos = []) {
	const session = getSession();
	if (!session) return false;
	if (isRoot()) return true;
	return hasRole(session, ...rolesPermitidos);
}

/** Cierra la sesión de verdad (Firebase Auth + caché local). */
export async function cerrarSesion() {
	clearSession();
	const [{ auth }, { signOut }] = await Promise.all([import("@/lib/firebase"), import("firebase/auth")]);
	await signOut(auth);
}

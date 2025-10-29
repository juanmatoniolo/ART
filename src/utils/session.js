// utils/session.js
const SESSION_KEY = "userSession";
const EXPIRATION_MS = 4 * 60 * 60 * 1000; // 4 horas

export function setSession(userData) {
	const data = {
		...userData,
		expiresAt: Date.now() + EXPIRATION_MS,
	};
	localStorage.setItem(SESSION_KEY, JSON.stringify(data));
}

export function getSession() {
	const session = localStorage.getItem(SESSION_KEY);
	if (!session) return null;

	const data = JSON.parse(session);
	if (Date.now() > data.expiresAt) {
		localStorage.removeItem(SESSION_KEY);
		return null;
	}

	return data;
}

export function clearSession() {
	localStorage.removeItem(SESSION_KEY);
}

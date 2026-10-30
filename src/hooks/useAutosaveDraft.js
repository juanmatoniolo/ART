"use client";

import { useEffect, useRef, useState, useCallback } from "react";

/**
 * Persiste un estado en localStorage con debounce.
 *
 * @param {string} key             - Clave única de localStorage
 * @param {any}    initialValue    - Valor si no hay nada guardado
 * @param {object} opts
 * @param {number} opts.debounceMs - ms de agrupación de escrituras (default 500)
 * @param {number} opts.version    - Versión del schema (default 1)
 *
 * @returns {[value, setValue, helpers]}
 *   helpers = { clear, wasRestored, dismissRestored }
 */
function readSaved(key, version) {
	if (typeof window === "undefined")
		return { value: undefined, restored: false };
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return { value: undefined, restored: false };
		const parsed = JSON.parse(raw);
		if (parsed?.v === version && parsed?.data !== undefined) {
			return { value: parsed.data, restored: true };
		}
	} catch (e) {
		console.warn("[useAutosaveDraft] no se pudo leer", e);
	}
	return { value: undefined, restored: false };
}

export function useAutosaveDraft(key, initialValue, opts = {}) {
	const { debounceMs = 500, version = 1 } = opts;

	const skipNextSaveRef = useRef(false);

	const [initialRead] = useState(() => readSaved(key, version));
	const [value, setValue] = useState(() =>
		initialRead.value !== undefined ? initialRead.value : initialValue,
	);
	const [wasRestored, setWasRestored] = useState(initialRead.restored);

	// Guardado debounced
	useEffect(() => {
		if (skipNextSaveRef.current) {
			skipNextSaveRef.current = false;
			return;
		}
		const t = setTimeout(() => {
			try {
				window.localStorage.setItem(
					key,
					JSON.stringify({
						v: version,
						savedAt: Date.now(),
						data: value,
					}),
				);
			} catch (e) {
				console.warn("[useAutosaveDraft] no se pudo guardar", e);
			}
		}, debounceMs);
		return () => clearTimeout(t);
	}, [value, key, version, debounceMs]);

	const clear = useCallback(() => {
		try {
			window.localStorage.removeItem(key);
		} catch {}
		skipNextSaveRef.current = true;
		setWasRestored(false);
	}, [key]);

	const dismissRestored = useCallback(() => setWasRestored(false), []);

	return [value, setValue, { clear, wasRestored, dismissRestored }];
}

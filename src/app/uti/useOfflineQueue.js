"use client";

import { useEffect, useState, useCallback } from "react";
import { db } from "@/lib/firebase";
import { ref, update, push } from "firebase/database";

const DB_NAME = "uti_offline";
const STORE = "queue";
const DB_VERSION = 1;

// ── IndexedDB helpers ─────────────────────────────────────────────────────────
function openDB() {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = (e) => {
			const db = e.target.result;
			if (!db.objectStoreNames.contains(STORE)) {
				db.createObjectStore(STORE, {
					keyPath: "id",
					autoIncrement: true,
				});
			}
		};
		req.onsuccess = (e) => resolve(e.target.result);
		req.onerror = (e) => reject(e.target.error);
	});
}

async function enqueue(item) {
	const db = await openDB();
	const tx = db.transaction(STORE, "readwrite");
	const store = tx.objectStore(STORE);
	return new Promise((resolve, reject) => {
		const req = store.add({ ...item, ts: Date.now() });
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

async function dequeue(id) {
	const db = await openDB();
	const tx = db.transaction(STORE, "readwrite");
	const store = tx.objectStore(STORE);
	return new Promise((resolve, reject) => {
		const req = store.delete(id);
		req.onsuccess = () => resolve();
		req.onerror = () => reject(req.error);
	});
}

async function getAll() {
	const db = await openDB();
	const tx = db.transaction(STORE, "readonly");
	const store = tx.objectStore(STORE);
	return new Promise((resolve, reject) => {
		const req = store.getAll();
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

// ── Hook principal ────────────────────────────────────────────────────────────
export function useOfflineQueue() {
	const [online, setOnline] = useState(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);
	const [pending, setPending] = useState(0);
	const [syncing, setSyncing] = useState(false);

	// Refrescar contador de pendientes
	const refreshPending = useCallback(async () => {
		try {
			const items = await getAll();
			setPending(items.length);
		} catch {
			setPending(0);
		}
	}, []);

	useEffect(() => {
		refreshPending();
		const up = () => setOnline(true);
		const down = () => setOnline(false);
		window.addEventListener("online", up);
		window.addEventListener("offline", down);
		return () => {
			window.removeEventListener("online", up);
			window.removeEventListener("offline", down);
		};
	}, [refreshPending]);

	// Cuando vuelve la conexión, sincronizar automáticamente
	useEffect(() => {
		if (online) syncQueue();
	}, [online]);

	// Sincronizar cola con Firebase
	const syncQueue = useCallback(async () => {
		let items;
		try {
			items = await getAll();
		} catch {
			return;
		}
		if (!items.length) return;

		setSyncing(true);
		for (const item of items) {
			try {
				if (item.editId) {
					await update(ref(db, `UTI/${item.editId}`), item.data);
				} else {
					await update(push(ref(db, "UTI")), item.data);
				}
				await dequeue(item.id);
			} catch {
				// Si falla un item, dejar el resto en cola
				break;
			}
		}
		setSyncing(false);
		await refreshPending();
	}, [refreshPending]);

	// Guardar (online → Firebase directo / offline → cola local)
	const save = useCallback(
		async ({ editId, data }) => {
			if (online) {
				try {
					if (editId) await update(ref(db, `UTI/${editId}`), data);
					else await update(push(ref(db, "UTI")), data);
					return { ok: true, offline: false };
				} catch {
					// Si falla aunque parezca online, encolar
				}
			}
			// Guardar en cola offline
			await enqueue({ editId, data });
			await refreshPending();
			return { ok: true, offline: true };
		},
		[online, refreshPending],
	);

	return { online, pending, syncing, save, syncQueue };
}

"use client";
// Capa de lectura optimizada para la Realtime Database.
//
// - cached():      memoria con TTL + deduplicación de pedidos simultáneos.
// - restCount():   cantidad de hijos sin descargarlos (?shallow=true).
// - restLast():    últimos N hijos por clave (orderBy="$key"&limitToLast=N).
// - restGet():     nodo completo con caché (para nodos chicos o poco cambiantes).
// - useLiveNode(): suscripción en vivo COMPARTIDA entre pantallas; al salir de la
//                  pantalla se mantiene viva unos minutos para que volver sea instantáneo.
//
// Todo se limpia al cambiar de usuario (cada uno tiene permisos distintos).
import { useEffect, useSyncExternalStore } from "react";
import { onValue, ref } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { DB_URL } from "@/lib/config";

const memory = new Map(); // key -> { at, value }
const inflight = new Map(); // key -> Promise
const live = new Map(); // path -> { data, loaded, error, listeners:Set, unsub, timer }

let currentUid;
if (typeof window !== "undefined") {
  onAuthStateChanged(auth, (u) => {
    const uid = u?.uid || null;
    if (currentUid !== undefined && uid !== currentUid) resetDbCache();
    currentUid = uid;
  });
}

export function resetDbCache() {
  memory.clear();
  inflight.clear();
  for (const entry of live.values()) {
    clearTimeout(entry.timer);
    entry.unsub?.();
  }
  live.clear();
}

/** Borra del caché las claves que empiezan con prefix (usar después de escribir). */
export function invalidate(prefix = "") {
  for (const k of memory.keys()) if (k.includes(prefix)) memory.delete(k);
}

export async function cached(key, ttlMs, loader) {
  const hit = memory.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    try {
      const value = await loader();
      memory.set(key, { at: Date.now(), value });
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

async function restJson(path, params = {}) {
  const url = new URL(`${DB_URL}/${path}.json`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`No se pudo leer ${path}`);
  return res.json();
}

/** Cantidad de hijos de un nodo, sin bajar su contenido. */
export const restCount = (path, ttlMs = 60_000) =>
  cached(`count:${path}`, ttlMs, async () => {
    const keys = await restJson(path, { shallow: "true" });
    return keys && typeof keys === "object" ? Object.keys(keys).length : 0;
  });

/** Últimos N hijos (por clave = orden de creación para push ids). */
export const restLast = (path, n, ttlMs = 60_000) =>
  cached(`last:${path}:${n}`, ttlMs, () => restJson(path, { orderBy: '"$key"', limitToLast: String(n) }));

/** Nodo completo con caché en memoria. */
export const restGet = (path, ttlMs = 60_000) => cached(`get:${path}`, ttlMs, () => restJson(path));

/* ---------------- suscripciones en vivo compartidas ---------------- */

const KEEP_ALIVE_MS = 5 * 60 * 1000;
const EMPTY = { data: undefined, loaded: false, error: null };

function entryFor(path) {
  let e = live.get(path);
  if (!e) {
    e = { snapshot: EMPTY, listeners: new Set(), unsub: null, timer: null };
    live.set(path, e);
  }
  return e;
}

function subscribe(path, listener) {
  const e = entryFor(path);
  clearTimeout(e.timer);
  e.listeners.add(listener);
  if (!e.unsub) {
    e.unsub = onValue(
      ref(db, path),
      (snap) => {
        e.snapshot = { data: snap.val(), loaded: true, error: null };
        e.listeners.forEach((l) => l());
      },
      (error) => {
        e.snapshot = { data: e.snapshot.data, loaded: true, error };
        e.listeners.forEach((l) => l());
      }
    );
  }
  return () => {
    e.listeners.delete(listener);
    if (e.listeners.size === 0) {
      e.timer = setTimeout(() => {
        e.unsub?.();
        e.unsub = null;
        // los datos quedan en memoria: al volver se muestran al instante y se refrescan
      }, KEEP_ALIVE_MS);
    }
  };
}

/**
 * Lee un nodo en vivo compartiendo una sola descarga entre todas las pantallas.
 * @returns {{ data: any, loaded: boolean, error: Error|null }}
 */
export function useLiveNode(path) {
  const snapshot = useSyncExternalStore(
    (cb) => (path ? subscribe(path, cb) : () => {}),
    () => (path ? entryFor(path).snapshot : EMPTY),
    () => EMPTY
  );
  return snapshot;
}

/** Igual que useLiveNode pero ejecuta onData(val) cada vez que cambia (para estados existentes). */
export function useLiveNodeEffect(path, onData, onError) {
  const { data, loaded, error } = useLiveNode(path);
  useEffect(() => {
    if (error) onError?.(error);
    else if (loaded) onData(data ?? null);
    // onData / onError se pasan inline; solo reaccionamos a los datos
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loaded, error]);
}

/**
 * Hijos cuyo campo `child` es igual a `value`.
 * Usa la consulta indexada de Firebase (requiere ".indexOn" en las reglas);
 * si el índice todavía no está publicado, cae a leer el nodo completo (con caché) y filtrar.
 */
export const restWhere = (path, child, value, ttlMs = 60_000) =>
  cached(`where:${path}:${child}=${value}`, ttlMs, async () => {
    try {
      return (await restJson(path, { orderBy: `"${child}"`, equalTo: JSON.stringify(value) })) || {};
    } catch {
      const all = (await getShared(path)).val() || {};
      return Object.fromEntries(Object.entries(all).filter(([, v]) => v && v[child] === value));
    }
  });

/* ---------- reemplazos directos de onValue / get para nodos pesados ---------- */

const snapLike = (data) => ({
  val: () => (data === undefined ? null : data),
  exists: () => data !== undefined && data !== null,
});

/**
 * Igual que onValue(ref(db, path), cb, onError) pero compartido: una sola
 * descarga para todas las pantallas que miran el mismo nodo.
 * Devuelve la función para desuscribirse.
 */
export function onSharedValue(path, cb, onError) {
  const e = entryFor(path);
  let lastData = Symbol("none");
  const listener = () => {
    const { data, loaded, error } = e.snapshot;
    if (!loaded) return;
    if (error) return onError?.(error);
    if (data === lastData) return;
    lastData = data;
    cb(snapLike(data));
  };
  const unsub = subscribe(path, listener);
  if (e.snapshot.loaded && e.unsub) queueMicrotask(listener);
  return unsub;
}

/**
 * Igual que get(ref(db, path)) pero usando la suscripción compartida:
 * la primera vez descarga, las siguientes responden al instante con datos al día.
 */
export function getShared(path) {
  return new Promise((resolve, reject) => {
    let unsub = null;
    unsub = onSharedValue(
      path,
      (snap) => {
        queueMicrotask(() => unsub?.());
        resolve(snap);
      },
      (err) => {
        queueMicrotask(() => unsub?.());
        reject(err);
      }
    );
  });
}

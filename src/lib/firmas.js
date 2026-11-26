"use client";
// Firmas (datos sensibles) desde la API protegida /api/firmas/:archivo.
// Se descargan con el token de la sesión (lo agrega lib/dbRestAuth.js) y se
// guardan en memoria como data URL, para poder insertarlas en el HTML de las
// ventanas de impresión sin exponer ninguna URL pública.
import { useEffect, useState } from "react";

const pending = new Map(); // archivo -> Promise<string|null>
const ready = new Map(); // archivo -> data URL

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Descarga (una sola vez) la firma y devuelve su data URL, o null si no hay acceso. */
export function loadFirma(archivo) {
  if (!archivo) return Promise.resolve(null);
  if (ready.has(archivo)) return Promise.resolve(ready.get(archivo));
  if (pending.has(archivo)) return pending.get(archivo);

  const p = (async () => {
    try {
      const res = await fetch(`/api/firmas/${encodeURIComponent(archivo)}`);
      if (!res.ok) return null;
      const url = await blobToDataUrl(await res.blob());
      ready.set(archivo, url);
      return url;
    } catch {
      return null;
    } finally {
      pending.delete(archivo);
    }
  })();
  pending.set(archivo, p);
  return p;
}

/** Descarga varias firmas en paralelo. */
export function loadFirmas(archivos = []) {
  return Promise.all([...new Set(archivos.filter(Boolean))].map(loadFirma));
}

/** Data URL ya descargada (sincrónico), o null. */
export function getFirmaCargada(archivo) {
  return (archivo && ready.get(archivo)) || null;
}

/** Hook: data URL de la firma (null mientras carga o si no hay permiso). */
export function useFirma(archivo) {
  const [url, setUrl] = useState(() => getFirmaCargada(archivo));
  useEffect(() => {
    let alive = true;
    loadFirma(archivo).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [archivo]);
  return url;
}

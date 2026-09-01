import { useState, useEffect } from "react";
import { FIREBASE_URL } from "../utils/firebase";

export default function usePacientes() {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${FIREBASE_URL}/pacientes.json`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!data) { setPacientes([]); return; }
        const lista = Object.entries(data)
          .map(([id, v]) => ({ id, ...v, fullName: `${v?.trabajador?.apellido || ""} ${v?.trabajador?.nombre || ""}`.trim() }))
          .filter(p => p.fullName || p.trabajador?.dni)
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        setPacientes(lista);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  return { pacientes, loading };
}
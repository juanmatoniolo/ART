import { useState, useEffect } from "react";
import { FIREBASE_URL } from "../utils/irebase";

export default function useDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${FIREBASE_URL}/medicos.json`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!data) { setDoctors([]); return; }
        const lista = Object.entries(data).map(([id, val]) => ({
          id,
          ...val,
          nombreCompleto: `${val.apellido || ""}, ${val.nombre || ""}`.trim()
        }));
        setDoctors(lista);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { doctors, loading };
}
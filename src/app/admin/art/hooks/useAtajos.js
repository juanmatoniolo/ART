import { useState, useEffect, useCallback } from "react";
import { FIREBASE_URL } from "../utils/firebase";

export default function useAtajos() {
  const [atajos, setAtajos] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(() => {
    setLoading(true);
    fetch(`${FIREBASE_URL}/ART-MAILS/atajos.json`)
      .then(r => r.json())
      .then(data => {
        if (data) {
          const lista = Object.entries(data).map(([id, val]) => ({ id, ...val }));
          setAtajos(lista);
        } else setAtajos([]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return { atajos, loading, recargar: cargar };
}
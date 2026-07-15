// src/app/admin/art/hooks/useArts.js
"use client";

import { useState, useEffect, useCallback } from "react";
import { FIREBASE_URL } from "../utils/firebase";

const ARTS_PATH = `${FIREBASE_URL}/ART-MAILS/arts.json`;

export default function useArts() {
  const [arts, setArts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchArts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      console.log("🔄 Cargando ARTs desde:", ARTS_PATH);
      
      const res = await fetch(ARTS_PATH, {
        signal: AbortSignal.timeout(10000),
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status} - ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("📦 Datos recibidos:", data);
      
      if (data) {
        const artsList = Object.entries(data).map(([id, value]) => ({
          id,
          nombre: value.nombre || id,
          color: value.color || "#3b82f6",
          siniestros: Array.isArray(value.siniestros) ? value.siniestros : [],
          facturacion: Array.isArray(value.facturacion) ? value.facturacion : [],
          convenios: Array.isArray(value.convenios) ? value.convenios : [],
          ...value,
        }));
        setArts(artsList);
      } else {
        setArts([]);
      }
    } catch (err) {
      console.error("❌ Error fetching arts:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchArts();
  }, [fetchArts]);

  const addArt = useCallback(async (newArt) => {
    try {
      const artToSave = {
        nombre: newArt.nombre,
        color: newArt.color || "#3b82f6",
        siniestros: Array.isArray(newArt.siniestros) ? newArt.siniestros : [],
        facturacion: Array.isArray(newArt.facturacion) ? newArt.facturacion : [],
        convenios: Array.isArray(newArt.convenios) ? newArt.convenios : [],
        ...newArt,
      };

      const response = await fetch(`${FIREBASE_URL}/ART-MAILS/arts.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(artToSave),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const newArtWithId = { id: data.name, ...artToSave };
      setArts((prev) => [...prev, newArtWithId]);
      return newArtWithId;
    } catch (err) {
      console.error("❌ Error adding art:", err);
      throw err;
    }
  }, []);

  const updateArt = useCallback(async (id, updatedData) => {
    try {
      const response = await fetch(`${FIREBASE_URL}/ART-MAILS/arts/${id}.json`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setArts((prev) =>
        prev.map((art) => (art.id === id ? { id, ...updatedData } : art))
      );
    } catch (err) {
      console.error("❌ Error updating art:", err);
      throw err;
    }
  }, []);

  const deleteArt = useCallback(async (id) => {
    try {
      const response = await fetch(`${FIREBASE_URL}/ART-MAILS/arts/${id}.json`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setArts((prev) => prev.filter((art) => art.id !== id));
    } catch (err) {
      console.error("❌ Error deleting art:", err);
      throw err;
    }
  }, []);

  return {
    arts,
    loading,
    error,
    addArt,
    updateArt,
    deleteArt,
    refetch: fetchArts,
  };
}
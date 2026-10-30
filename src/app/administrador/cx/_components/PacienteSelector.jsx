"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import styles from "../cx-common.module.css";

export default function PacienteSelector({ onSelect, selectedPacienteId }) {
  const [pacientes, setPacientes] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Escuchamos la base de datos de PAMI
    const unsub = onValue(ref(db, "PAMI/pacientes"), (snap) => {
      const data = snap.val() || {};
      const lista = Object.entries(data).map(([dni, p]) => ({
        id: dni,
        ...p,
        nombreCompleto: `${p.apellido || ""} ${p.nombre || ""}`.trim(),
      }));
      // Ordenar alfabéticamente
      lista.sort((a, b) => a.nombreCompleto.localeCompare(b.nombreCompleto));
      setPacientes(lista);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return pacientes.slice(0, 15); // Mostrar los primeros 15 por defecto
    return pacientes.filter(
      (p) =>
        p.nombreCompleto.toLowerCase().includes(q) ||
        p.dni.includes(q) ||
        (p.afiliado && p.afiliado.includes(q))
    ).slice(0, 30);
  }, [pacientes, busqueda]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <input
        type="text"
        className={styles.input}
        placeholder="Buscar paciente PAMI por DNI, Nombre o Afiliado..."
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
      />

      <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.5rem", background: "#0b1220", borderRadius: "8px", border: "1px solid #253348", padding: "0.5rem" }}>
        {loading ? (
          <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8" }}>Cargando pacientes...</div>
        ) : filtrados.length === 0 ? (
          <div style={{ padding: "1rem", textAlign: "center", color: "#94a3b8" }}>No se encontraron pacientes.</div>
        ) : (
          filtrados.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                padding: "0.75rem",
                background: selectedPacienteId === p.id ? "rgba(111, 161, 123, 0.2)" : "#1a2335",
                border: `1px solid ${selectedPacienteId === p.id ? "#6fa17b" : "transparent"}`,
                borderRadius: "8px",
                cursor: "pointer",
                textAlign: "left",
                color: "#e2e8f0",
                transition: "all 0.2s",
              }}
            >
              <strong style={{ fontSize: "14px" }}>{p.nombreCompleto}</strong>
              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                DNI: {p.dni} · Afiliado: {p.afiliado || "—"}
                {p.oncoplan && <span style={{ marginLeft: "8px", color: "#e11d48", fontWeight: "bold" }}>ONCOPLAN</span>}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
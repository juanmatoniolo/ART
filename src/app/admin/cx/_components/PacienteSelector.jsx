import { useState, useEffect } from "react";
import styles from "../cx-common.module.css";

export default function PacienteSelector({ onSelect, selectedPacienteId }) {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchPacientes = async () => {
      try {
        const res = await fetch("https://datos-clini-default-rtdb.firebaseio.com/pacientes.json");
        const data = await res.json();
        if (data) {
          const list = Object.entries(data).map(([id, value]) => ({
            id,
            ...value,
            nombreCompleto: `${value.trabajador?.apellido || ""} ${value.trabajador?.nombre || ""}`.trim(),
            dni: value.trabajador?.dni || "",
          }));
          setPacientes(list);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPacientes();
  }, []);

  const filtered = pacientes.filter(
    (p) =>
      p.nombreCompleto.toLowerCase().includes(search.toLowerCase()) ||
      p.dni.includes(search),
  );

  if (loading) return <div className={styles.loadingSpinner}>Cargando pacientes...</div>;

  return (
    <div className={styles.pacienteSelector}>
      <input
        type="text"
        placeholder="Buscar por nombre o DNI..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={styles.input}
      />
      <div className={styles.pacienteList}>
        {filtered.map((p) => (
          <div
            key={p.id}
            className={`${styles.pacienteItem} ${selectedPacienteId === p.id ? styles.selected : ""}`}
            onClick={() => onSelect(p)}
          >
            <strong>{p.nombreCompleto}</strong>{" "}
            <span className={styles.pacienteDni}>(DNI: {p.dni || "—"})</span>
          </div>
        ))}
      </div>
    </div>
  );
}
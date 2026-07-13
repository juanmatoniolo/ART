import { useState, useMemo, useRef } from "react";
import styles from "../page.module.css";
import { normalize } from "../utils/generadores";

export default function PasoPaciente({ pacientes, loading, paciente, setPaciente }) {
  const [searchTerm, setSearchTerm] = useState(paciente?.fullName || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const filtered = useMemo(() => {
    const term = normalize(searchTerm.trim());
    if (!term) return [];
    return pacientes
      .filter(p => {
        const nombre = normalize(p.fullName);
        const dni = normalize(p.trabajador?.dni);
        const siniestro = normalize(p.ART?.nroSiniestro);
        return nombre.includes(term) || dni.includes(term) || siniestro.includes(term);
      })
      .slice(0, 10);
  }, [pacientes, searchTerm]);

  const handleSelect = (p) => {
    setPaciente(p);
    setSearchTerm(p.fullName || p.trabajador?.dni || "");
    setShowSuggestions(false);
  };

  const handleClear = () => {
    setPaciente(null);
    setSearchTerm("");
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  return (
    <div className={styles.pacienteWrapper}>
      <div className={styles.fieldHeader}>
        <span className={styles.fieldLabel}>👤 Paciente</span>
        {paciente && <span className={styles.checkBadge}>✓</span>}
        {loading && <span className={styles.badge}>Cargando...</span>}
      </div>

      <div className={styles.searchWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="🔍 Buscar por nombre, DNI o siniestro..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setShowSuggestions(true);
            if (paciente) setPaciente(null);
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {paciente && (
          <button className={styles.clearBtn} onClick={handleClear}>✕</button>
        )}
      </div>

      {showSuggestions && (
        <div className={styles.dropdown}>
          {filtered.length > 0 ? (
            <>
              <div className={styles.dropdownHeader}>
                {filtered.length} resultado{filtered.length > 1 ? "s" : ""}
              </div>
              {filtered.map(p => (
                <button
                  key={p.id}
                  className={styles.dropdownItem}
                  onMouseDown={() => handleSelect(p)}
                >
                  <span className={styles.itemName}>{p.fullName || "Sin nombre"}</span>
                  <span className={styles.itemMeta}>
                    DNI {p.trabajador?.dni || "—"} · Stro {p.ART?.nroSiniestro || "—"}
                  </span>
                </button>
              ))}
            </>
          ) : searchTerm ? (
            <div className={styles.emptyState}>No se encontró "{searchTerm}"</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
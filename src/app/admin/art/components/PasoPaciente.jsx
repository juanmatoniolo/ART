import { useMemo, useState, useRef } from "react";
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

  return (
    <div className={`${styles.block} ${styles.searchBlock} ${styles.blockHighlight}`}>
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>👤 2. Paciente</p>
        {loading && <span className={styles.badge}>Cargando...</span>}
        {paciente && <span className={styles.checkBadge}>✓</span>}
      </div>
      <div className={styles.searchWrap}>
        <input
          ref={inputRef}
          type="search"
          className={styles.inp}
          placeholder="🔍 Buscar por apellido, nombre, DNI o siniestro..."
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); setPaciente(null); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        />
        {showSuggestions && filtered.length > 0 && (
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>{filtered.length} encontrado{filtered.length > 1 ? "s" : ""}</div>
            {filtered.map(p => (
              <button key={p.id} className={styles.dropItem} onMouseDown={() => handleSelect(p)}>
                <span className={styles.dropName}>{p.fullName || "Sin nombre"}</span>
                <span className={styles.dropMeta}>DNI {p.trabajador?.dni || "—"} · Stro {p.ART?.nroSiniestro || "—"} · {p.ART?.nombre || "Sin ART"}</span>
              </button>
            ))}
          </div>
        )}
        {showSuggestions && searchTerm && filtered.length === 0 && (
          <div className={styles.dropdown}><p className={styles.emptyMsg}>No se encontró "{searchTerm}"</p></div>
        )}
      </div>
      {paciente && (
        <div className={styles.pacienteCard}>
          <div className={styles.pacienteCardHeader}>
            <span className={styles.pacienteNombre}>{paciente.fullName}</span>
            <button className={styles.tinyBtn} onClick={() => { setPaciente(null); setSearchTerm(""); }}>✕ Cambiar</button>
          </div>
          <div className={styles.pacienteMeta}>
            <span>🆔 DNI: <strong>{paciente.trabajador?.dni || "—"}</strong></span>
            <span>📋 Stro: <strong>{paciente.ART?.nroSiniestro || "—"}</strong></span>
            <span>🏢 ART: <strong>{paciente.ART?.nombre || "—"}</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
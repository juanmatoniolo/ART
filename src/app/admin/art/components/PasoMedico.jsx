import { useState, useMemo, useRef } from "react";
import styles from "../page.module.css";
import useDoctors from "../hooks/useDoctors";

export default function PasoMedico({ medico, setMedico }) {
  const { doctors, loading } = useDoctors();
  const [search, setSearch] = useState(medico || "");
  const [showList, setShowList] = useState(false);
  const inputRef = useRef(null);

  const filtrados = useMemo(() => {
    if (!search.trim()) return doctors;
    const q = search.toLowerCase();
    return doctors.filter(
      (d) =>
        d.apellido?.toLowerCase().includes(q) ||
        d.nombre?.toLowerCase().includes(q) ||
        d.matricula?.toLowerCase().includes(q)
    );
  }, [doctors, search]);

  const handleSelect = (doc) => {
    const nombreCompleto = `${doc.apellido}, ${doc.nombre}`;
    setMedico(nombreCompleto);
    setSearch(nombreCompleto);
    setShowList(false);
  };

  const handleClear = () => {
    setMedico("");
    setSearch("");
    setShowList(false);
    inputRef.current?.focus();
  };

  return (
    <div className={styles.medicoWrapper}>
      <div className={styles.fieldHeader}>
        <span className={styles.fieldLabel}>👨‍⚕️ Médico</span>
        {medico && <span className={styles.checkBadge}>✓</span>}
        {loading && <span className={styles.badge}>Cargando...</span>}
      </div>

      <div className={styles.searchWrapper}>
        <input
          ref={inputRef}
          type="text"
          className={styles.searchInput}
          placeholder="🔍 Buscar por apellido, nombre o matrícula..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setMedico(e.target.value);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          onBlur={() => setTimeout(() => setShowList(false), 200)}
        />
        {medico && (
          <button className={styles.clearBtn} onClick={handleClear}>✕</button>
        )}
      </div>

      {showList && (
        <div className={styles.dropdown}>
          {filtrados.length > 0 ? (
            <>
              <div className={styles.dropdownHeader}>
                {filtrados.length} médico{filtrados.length > 1 ? "s" : ""} encontrado
                {filtrados.length > 1 ? "s" : ""}
              </div>
              {filtrados.map((doc) => (
                <button
                  key={doc.id}
                  className={styles.dropdownItem}
                  onMouseDown={() => handleSelect(doc)}
                >
                  <span className={styles.itemName}>
                    {doc.apellido}, {doc.nombre}
                  </span>
                  <span className={styles.itemMeta}>
                    🏷️ Mat. {doc.matricula || "—"}
                  </span>
                </button>
              ))}
            </>
          ) : search ? (
            <div className={styles.emptyState}>No se encontró "{search}"</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
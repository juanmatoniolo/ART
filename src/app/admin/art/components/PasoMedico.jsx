import { useState, useMemo } from "react";
import styles from "../page.module.css";
import useDoctors from "../hooks/useDoctors";

export default function PasoMedico({ medico, setMedico }) {
  const { doctors, loading } = useDoctors();
  const [search, setSearch] = useState(medico);
  const [showList, setShowList] = useState(false);

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

  const seleccionar = (doc) => {
    setMedico(doc.nombreCompleto); // o podrías guardar "apellido, nombre"
    setSearch(doc.nombreCompleto);
    setShowList(false);
  };

  return (
    <div
      className={`${styles.block} ${styles.blockHighlight}`}
     
    >
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>👨‍⚕️ Médico</p>
        {medico && <span className={styles.checkBadge}>✓</span>}
      </div>

      <div className={styles.searchWrap} >
        <input
          type="text"
          className={styles.inp}
          placeholder="🔍 Buscar por apellido, nombre o matrícula..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setMedico(e.target.value); // permite escritura libre
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          onBlur={() => setTimeout(() => setShowList(false), 200)}
        />

        {showList && filtrados.length > 0 && (
          <div
            className={styles.dropdown}
            style={{ zIndex: 99999, position: "absolute" }}
          >
            <div className={styles.dropdownHeader}>
              {filtrados.length} médico{filtrados.length > 1 ? "s" : ""} encontrado{filtrados.length > 1 ? "s" : ""}
            </div>
            {filtrados.map((doc) => (
              <button
                key={doc.id}
                className={styles.dropItem}
                onMouseDown={() => seleccionar(doc)}
              >
                <span className={styles.dropName}>
                  {doc.apellido}, {doc.nombre}
                </span>
                <span className={styles.dropMeta}>
                  🏷️ Mat. {doc.matricula || "—"}
                </span>
              </button>
            ))}
          </div>
        )}

        {showList && search && filtrados.length === 0 && (
          <div className={styles.dropdown} style={{ zIndex: 99999 }}>
            <p className={styles.emptyMsg}>No se encontró "{search}"</p>
          </div>
        )}
      </div>

      {loading && (
        <span className={styles.badge} style={{ marginTop: 8 }}>
          Cargando médicos...
        </span>
      )}
    </div>
  );
}
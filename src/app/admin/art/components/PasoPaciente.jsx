import { useState, useMemo, useRef } from "react";
import styles from "../page.module.css";
import { normalize } from "../utils/generadores";

export default function PasoPaciente({
  pacientes,
  loading,
  paciente,
  setPaciente,
  // ─── NUEVOS PROPS ────────────────────────────────────────────────
  selectedArtsNames = [],   // array de nombres de ART seleccionadas
  selectedArtsLabel = "",   // texto para mostrar (ej: "COMFYE" o "2 ARTs")
}) {
  const [searchTerm, setSearchTerm] = useState(paciente?.fullName || "");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef(null);

  const tieneArtsSeleccionadas = selectedArtsNames.length > 0;

  const filtered = useMemo(() => {
    const term = normalize(searchTerm.trim());
    if (!term) return [];

    const normArts = selectedArtsNames.map((n) => normalize(n));

    // 1) Filtrar por término de búsqueda
    const results = pacientes
      .filter((p) => {
        const nombre = normalize(p.fullName);
        const dni = normalize(p.trabajador?.dni);
        const siniestro = normalize(p.ART?.nroSiniestro);
        return nombre.includes(term) || dni.includes(term) || siniestro.includes(term);
      })
      .map((p) => {
        // 2) Determinar si pertenece a alguna de las ARTs seleccionadas
        const patArt = normalize(p.ART?.nombre || "");
        const matches =
          !tieneArtsSeleccionadas ||
          normArts.some(
            (na) => na && patArt && (patArt === na || patArt.includes(na) || na.includes(patArt))
          );
        return { ...p, _matchesArt: matches };
      });

    // 3) Ordenar: primero los que coinciden, después el resto
    results.sort((a, b) => {
      if (a._matchesArt === b._matchesArt) return 0;
      return a._matchesArt ? -1 : 1;
    });

    return results.slice(0, 10);
  }, [pacientes, searchTerm, selectedArtsNames, tieneArtsSeleccionadas]);

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

      {/* ─── Info del paciente seleccionado (incluye ART) ───────────────── */}
      {paciente && (
        <div
          style={{
            marginBottom: 8,
            padding: "8px 10px",
            background: "#f0f9ff",
            border: "1px solid #bae6fd",
            borderRadius: 8,
            fontSize: "0.85em",
          }}
        >
          <div style={{ fontWeight: 600, color: "#0369a1", marginBottom: 4 }}>
            🏢 ART: {paciente.ART?.nombre || "Sin ART"}
          </div>
          <div style={{ color: "#0c4a6e" }}>
            DNI {paciente.trabajador?.dni || "—"} · Stro{" "}
            {paciente.ART?.nroSiniestro || "—"}
          </div>
        </div>
      )}

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
                {tieneArtsSeleccionadas && (
                  <span style={{ opacity: 0.7, marginLeft: 6 }}>
                    · ordenados por ART {selectedArtsLabel}
                  </span>
                )}
              </div>

              {filtered.map((p) => {
                const patientArt = p.ART?.nombre || "Sin ART";
                const matches = p._matchesArt;

                return (
                  <button
                    key={p.id}
                    className={styles.dropdownItem}
                    onMouseDown={() => handleSelect(p)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 4,
                      opacity: matches ? 1 : 0.65,
                      borderLeft: matches
                        ? "3px solid #22c55e"
                        : tieneArtsSeleccionadas
                        ? "3px solid #f59e0b"
                        : "3px solid transparent",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        width: "100%",
                        gap: 8,
                        flexWrap: "wrap",
                      }}
                    >
                      <span className={styles.itemName}>
                        {p.fullName || "Sin nombre"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.75em",
                          padding: "2px 8px",
                          borderRadius: 999,
                          fontWeight: 600,
                          background: matches ? "#dcfce7" : "#fef3c7",
                          color: matches ? "#15803d" : "#92400e",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🏢 {patientArt}
                      </span>
                    </div>

                    <span className={styles.itemMeta}>
                      DNI {p.trabajador?.dni || "—"} · Stro{" "}
                      {p.ART?.nroSiniestro || "—"}
                    </span>

                    {!matches && tieneArtsSeleccionadas && (
                      <span
                        style={{
                          fontSize: "0.75em",
                          color: "#b45309",
                          fontWeight: 500,
                          marginTop: 2,
                        }}
                      >
                        ⚠ No pertenece a {selectedArtsLabel}
                      </span>
                    )}
                  </button>
                );
              })}
            </>
          ) : searchTerm ? (
            <div className={styles.emptyState}>No se encontró "{searchTerm}"</div>
          ) : null}
        </div>
      )}
    </div>
  );
}
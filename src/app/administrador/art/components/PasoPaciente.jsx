import { useState, useMemo, useRef } from "react";
import styles from "../page.module.css";
import { normalize } from "../utils/generadores";

// ✅ 1. Diccionario de equivalencias (abreviaturas y errores comunes)
const EQUIVALENCIAS = {
  "fed": "federacion",
  "federación": "federacion",
  "federacion": "federacion",
  "ap": "art",
  "art": "art",
  "medicar": "medical",
  "medical": "medical",
  "segunda": "segunda",
  "patronal": "patronal",
  "work": "work",
  "asociart": "asociart",
  "comfye": "comfye",
  "iaps": "iaps",
  "iapser": "iaps",
  "reconquista": "reconquista",
  "victoria": "victoria",
};

// ✅ 2. Función para limpiar y expandir abreviaturas
const limpiarYExpandir = (str) => {
  if (!str) return "";
  // Normalizar (quitar acentos, minúsculas)
  let texto = (str || "").toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  // Quitar puntos y caracteres especiales, excepto espacios
  texto = texto.replace(/[^a-z0-9\s]/g, "");
  // Dividir en palabras y expandir abreviaturas
  const palabras = texto.split(/\s+/).filter(Boolean);
  const expandidas = palabras.map(p => EQUIVALENCIAS[p] || p);
  return expandidas.join(" ");
};

// ✅ 3. Función para calcular distancia de Levenshtein (tolerancia a errores de tipeo)
function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ✅ 4. Función maestra de comparación
const sonSimilares = (artPaciente, artSeleccionada) => {
  const a = limpiarYExpandir(artPaciente);
  const b = limpiarYExpandir(artSeleccionada);

  // 1. Coincidencia exacta (ej: "federacion patronal art" === "federacion patronal art")
  if (a === b) return true;
  
  // 2. Coincidencia parcial (ej: "federacion patronal art" incluye a "federacion patronal")
  if (a.includes(b) || b.includes(a)) return true;

  // 3. Tolerancia a errores de tipeo (Levenshtein) por palabra
  const palabrasA = a.split(/\s+/);
  const palabrasB = b.split(/\s+/);
  
  // Si tienen diferente cantidad de palabras, no aplicamos Levenshtein
  if (palabrasA.length !== palabrasB.length) return false;

  let diferencias = 0;
  for (let i = 0; i < palabrasA.length; i++) {
    if (palabrasA[i] !== palabrasB[i]) {
      // Si la distancia de Levenshtein es mayor a 2, cuenta como diferencia
      if (levenshtein(palabrasA[i], palabrasB[i]) > 2) {
        diferencias++;
      }
    }
  }
  // Si más de 1 palabra es muy diferente, no son similares
  return diferencias <= 1;
};

export default function PasoPaciente({
  pacientes,
  loading,
  paciente,
  setPaciente,
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

    // 1) Filtrar por término de búsqueda
    const results = pacientes
      .filter((p) => {
        const nombre = normalize(p.fullName);
        const dni = normalize(p.trabajador?.dni);
        const siniestro = normalize(p.ART?.nroSiniestro);
        return nombre.includes(term) || dni.includes(term) || siniestro.includes(term);
      })
      .map((p) => {
        const patArt = p.ART?.nombre || "";
        
        // ✅ LÓGICA DE COMPARACIÓN MEJORADA
        const matches =
          !tieneArtsSeleccionadas ||
          selectedArtsNames.some((na) => sonSimilares(patArt, na));

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
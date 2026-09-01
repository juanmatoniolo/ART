import styles from "../page.module.css";

// Definición local de las categorías (podés moverla a utils si querés)
const CATEGORIAS_ACCIONES = {
  consulta: { label: "Consultas", icon: "📋" },
  practica: { label: "Prácticas", icon: "🏥" },
  estudio: { label: "Estudios", icon: "🔬" },
  sesion: { label: "Sesiones", icon: "🏃" },
};

export default function PasoPracticas({
  accionesDisponibles,
  accionesSeleccionadas,
  setAccionesSeleccionadas,
  setMostrarGestionAcciones,
  openEditAction,    // si querés pasar estas props desde page.jsx
  openNewAction,
}) {
  // Agrupar acciones por categoría
  const accionesAgrupadas = accionesDisponibles.reduce((acc, a) => {
    const cat = a.categoria || "practica";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(a);
    return acc;
  }, {});

  const toggleAccion = (id) => {
    setAccionesSeleccionadas((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((a) => a !== id);
        return next.length ? next : ["evolucion"];
      }
      return [...prev, id];
    });
  };

  return (
    <div className={`${styles.block} ${styles.blockHighlight}`}>
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>🩺 3. Prácticas / Prestaciones</p>
        <div className={styles.blockBadges}>
          <span className={styles.blockHint}>
            {accionesSeleccionadas.length} seleccionada(s)
          </span>
          <button
            className={styles.tinyBtn}
            onClick={() => setMostrarGestionAcciones(true)}
          >
            ⚙️ Gestionar
          </button>
        </div>
      </div>

      {/* Atajos rápidos */}
      <div className={styles.quickRow}>
        <button
          className={styles.tinyBtn}
          onClick={() => setAccionesSeleccionadas(["evolucion"])}
        >
          📋 Solo evolución
        </button>
        <button
          className={styles.tinyBtn}
          onClick={() => setAccionesSeleccionadas(["evolucion", "curacion"])}
        >
          🩹 + Curación
        </button>
        <button
          className={styles.tinyBtn}
          onClick={() => setAccionesSeleccionadas(["evolucion", "fkt", "mgt"])}
        >
          🏃 + FKT/MGT
        </button>
        <button
          className={styles.tinyBtn}
          onClick={() => setAccionesSeleccionadas(["evolucion", "rx"])}
        >
          📷 + RX
        </button>
        <button
          className={styles.tinyBtn}
          onClick={() => setAccionesSeleccionadas(["evolucion", "rmn"])}
        >
          🧲 + RMN
        </button>
      </div>

      {/* Acciones agrupadas por categoría */}
      {Object.entries(accionesAgrupadas).map(([cat, acciones]) => (
        <div key={cat} className={styles.categoriaGroup}>
          <p className={styles.categoriaLabel}>
            {CATEGORIAS_ACCIONES[cat]?.icon}{" "}
            {CATEGORIAS_ACCIONES[cat]?.label || cat}
          </p>
          <div className={styles.chips}>
            {acciones.map((a) => (
              <button
                key={a.id}
                className={`${styles.chip} ${
                  accionesSeleccionadas.includes(a.id) ? styles.chipOn : ""
                }`}
                onClick={() => toggleAccion(a.id)}
              >
                {a.emoji} {a.label}
                {accionesSeleccionadas.includes(a.id) && (
                  <span className={styles.chipCheck}>✓</span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
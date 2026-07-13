import { useState } from "react";
import styles from "../page.module.css";

export default function AtajosDeMail({
  atajos,
  loading,
  atajoActivo,
  aplicarAtajo,
  desactivarAtajo,
  setMostrarFormAtajo,
  setEditandoAtajo,
  setNuevoAtajoLabel,
  setNuevoAtajoAsunto,
  setNuevoAtajoAcciones,
  setNuevoAtajoCuerpo,
  eliminarAtajo,
}) {
  const [filter, setFilter] = useState("");

  const atajosFiltrados = atajos.filter((a) =>
    a.label.toLowerCase().includes(filter.toLowerCase()) ||
    a.asunto?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className={styles.block}>
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>⚡ Atajos de Mail</p>
        <span className={styles.blockHint}>Asunto + Cuerpo predefinido</span>
        {atajoActivo && (
          <span className={styles.badge} style={{ background: "#16a34a", color: "white" }}>
            ✅ Activo
          </span>
        )}
      </div>

      <div className={styles.atajosWrapper}>
        {/* Filtro */}
        <div className={styles.atajosFilter}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="🔍 Filtrar atajos por nombre o asunto..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        {loading ? (
          <p className={styles.emptyMsg}>Cargando atajos...</p>
        ) : atajosFiltrados.length > 0 ? (
          <div className={styles.atajosList}>
            {atajosFiltrados.map((atajo) => {
              const isActive = atajoActivo?.id === atajo.id;
              return (
                <div
                  key={atajo.id}
                  className={`${styles.atajoCard} ${isActive ? styles.atajoCardActive : ""}`}
                >
                  {/* Encabezado con nombre, acciones y botón Aplicar */}
                  <div className={styles.atajoCardHeader}>
                    <span className={styles.atajoNombre}>{atajo.label}</span>
                    <div className={styles.atajoCardActions}>
                    
                      {/* Editar */}
                      <button
                        className={styles.atajoEdit}
                        onClick={() => {
                          setEditandoAtajo(atajo);
                          setNuevoAtajoLabel(atajo.label);
                          setNuevoAtajoAsunto(atajo.asunto || "");
                          setNuevoAtajoAcciones(atajo.acciones?.length ? atajo.acciones : ["evolucion"]);
                          setNuevoAtajoCuerpo(atajo.cuerpo || "");
                          setMostrarFormAtajo(true);
                        }}
                        title="Editar atajo"
                      >
                        ✏️
                      </button>
                      {/* Eliminar */}
                      <button
                        className={styles.atajoDelete}
                        onClick={() => eliminarAtajo(atajo.id)}
                        title="Eliminar atajo"
                      >
                        ×
                      </button>

                      <button
                        className={`${styles.aplicarBtn} ${isActive ? styles.aplicarBtnActive : ""}`}
                        onClick={() => {
                          if (isActive) {
                            desactivarAtajo();
                          } else {
                            aplicarAtajo(atajo);
                          }
                        }}
                      >
                        {isActive ? "✅" : "🚀"}
                      </button>

                    </div>
                  </div>

                  {/* Preview compacto: solo asunto y cuerpo abreviado */}
                  <div className={styles.atajoCardBody}>
                    {atajo.asunto && (
                      <p className={styles.atajoPreview}>
                        <strong>Asunto:</strong> {atajo.asunto}
                      </p>
                    )}
                    {atajo.cuerpo && (
                      <p className={styles.atajoPreview}>
                        <strong>Cuerpo:</strong> {atajo.cuerpo.substring(0, 60)}…
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.emptyMsg}>
            {filter ? "No hay atajos que coincidan con el filtro" : "No hay atajos creados. ¡Creá uno!"}
          </p>
        )}

        <button
          className={styles.crearAtajoBtn}
          onClick={() => {
            setEditandoAtajo(null);
            setNuevoAtajoLabel("");
            setNuevoAtajoAsunto("");
            setNuevoAtajoAcciones(["evolucion"]);
            setNuevoAtajoCuerpo("");
            setMostrarFormAtajo(true);
          }}
        >
          ➕ Crear nuevo atajo
        </button>

        {atajoActivo && (
          <button className={styles.desactivarAtajoBtn} onClick={desactivarAtajo}>
            ✖ Desactivar atajo
          </button>
        )}
      </div>
    </div>
  );
}
import styles from "../page.module.css";

export default function AtajosDeMail({ atajos, loading, atajoActivo, setAtajoActivo, setAccionesSeleccionadas, setMostrarFormAtajo, setEditandoAtajo, setNuevoAtajoLabel, setNuevoAtajoAsunto, setNuevoAtajoAcciones, setNuevoAtajoCuerpo, eliminarAtajo }) {
  return (
    <div className={styles.block}>
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>⚡ Atajos de Mail</p>
        <span className={styles.blockHint}>Asunto + Cuerpo predefinido</span>
      </div>
      <div className={styles.atajosWrapper}>
        {loading ? (
          <p className={styles.emptyMsg}>Cargando atajos...</p>
        ) : atajos.length > 0 ? (
          <div className={styles.atajosList}>
            {atajos.map(atajo => (
              <div key={atajo.id} className={`${styles.atajoCard} ${atajoActivo?.id === atajo.id ? styles.atajoCardActive : ""}`}>
                <div className={styles.atajoCardHeader}>
                  <button
                    className={styles.atajoCardBtn}
                    onClick={() => {
                      setAtajoActivo(atajoActivo?.id === atajo.id ? null : atajo);
                      if (atajoActivo?.id !== atajo.id) {
                        if (atajo.acciones?.length) setAccionesSeleccionadas(atajo.acciones);
                        else setAccionesSeleccionadas(["evolucion"]);
                      }
                    }}
                  >
                    {atajoActivo?.id === atajo.id ? "✅ " : "⚡ "}{atajo.label}
                  </button>
                  <div className={styles.atajoCardActions}>
                    <button className={styles.atajoEdit} onClick={() => {
                      setEditandoAtajo(atajo);
                      setNuevoAtajoLabel(atajo.label);
                      setNuevoAtajoAsunto(atajo.asunto || "");
                      setNuevoAtajoAcciones(atajo.acciones?.length ? atajo.acciones : ["evolucion"]);
                      setNuevoAtajoCuerpo(atajo.cuerpo || "");
                      setMostrarFormAtajo(true);
                    }}>✏️</button>
                    <button className={styles.atajoDelete} onClick={() => eliminarAtajo(atajo.id)}>×</button>
                  </div>
                </div>
                {atajoActivo?.id === atajo.id && (
                  <div className={styles.atajoCardPreview}>
                    <p className={styles.atajoPreviewLabel}>✅ Atajo activo</p>
                    {atajo.asunto && <p className={styles.atajoPreview}><strong>Asunto:</strong> {atajo.asunto}</p>}
                    {atajo.cuerpo && <p className={styles.atajoPreview}><strong>Cuerpo:</strong> {atajo.cuerpo.substring(0, 80)}...</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.emptyMsg}>No hay atajos creados. ¡Creá uno!</p>
        )}
        <button className={styles.crearAtajoBtn} onClick={() => {
          setEditandoAtajo(null);
          setNuevoAtajoLabel("");
          setNuevoAtajoAsunto("");
          setNuevoAtajoAcciones(["evolucion"]);
          setNuevoAtajoCuerpo("");
          setMostrarFormAtajo(true);
        }}>
          ➕ Crear nuevo atajo
        </button>
      </div>
    </div>
  );
}
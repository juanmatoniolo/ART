import styles from "../cx-common.module.css";

export default function SolicitudesTab({
  solicitudes,
  loadingSolicitudes,
  cargarSolicitudEnFormulario,
}) {
  return (
    <div>
      <h3 style={{ marginBottom: "1rem", color: "#cbd5e1" }}>
        Solicitudes de pacientes (desde el formulario público)
      </h3>
      {loadingSolicitudes ? (
        <div className={styles.loadingSpinner} />
      ) : solicitudes.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📋</span>
          <p>No hay solicitudes pendientes.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Teléfono</th>
                <th>Localidad</th>
                <th>Fecha solicitud</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((sol) => (
                <tr key={sol.id} className={sol.atendida ? styles.rowAtendida : ""}>
                  <td className={styles.cellName}>
                    <strong>
                      {sol.apellido} {sol.nombre}
                    </strong>
                    <div className={styles.subText}>DNI {sol.dni}</div>
                  </td>
                  <td>{sol.telefono || "—"}</td>
                  <td>
                    {sol.localidad}, {sol.provincia}
                  </td>
                  <td>
                    {new Date(sol.fechaSolicitud).toLocaleDateString("es-AR")}
                  </td>
                  <td>
                    <span
                      className={`${styles.estadoBadge} ${
                        sol.atendida ? styles.estadoAtendida : styles.estadoPendiente
                      }`}
                    >
                      {sol.atendida ? "Atendida" : "Pendiente"}
                    </span>
                  </td>
                  <td className={styles.actionsCell}>
                    <button
                      className={styles.iconBtn}
                      title="Ver detalles"
                      onClick={() => {
                        const detail = `Paciente: ${sol.apellido} ${sol.nombre}\nDNI: ${sol.dni}\nTeléfono: ${sol.telefono}\nDomicilio: ${sol.domicilio}, ${sol.localidad}, ${sol.provincia}\nNacimiento: ${sol.nacimiento} (${sol.edad} años)\nLugar nac.: ${sol.lugarNacimiento}`;
                        alert(detail);
                      }}
                    >
                      👁️
                    </button>
                    {!sol.atendida && (
                      <>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}
                          title="Cargar en formulario"
                          onClick={() => cargarSolicitudEnFormulario(sol)}
                        >
                          ✍️
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnWarning}`}
                          title="Marcar como atendida sin cirugía"
                          onClick={async () => {
                            if (confirm("¿Marcar como atendida sin cargar cirugía?")) {
                              await fetch(
                                `https://datos-clini-default-rtdb.firebaseio.com/solicitudes-cirugia/${sol.id}.json`,
                                {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({
                                    atendida: true,
                                    fechaAtendida: Date.now(),
                                  }),
                                }
                              );
                              // Recargar solicitudes (se debe pasar una función para refrescar)
                              window.location.reload(); // solución temporal, mejor pasar prop
                            }
                          }}
                        >
                          ✅
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
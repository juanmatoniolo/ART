"use client";

import styles from "../cx-common.module.css";

export default function SolicitudesTab({
  solicitudes = [],
  loadingSolicitudes,
  cargarSolicitudEnFormulario,
  onEliminar,
  onDescargarFrente,
  onDescargarDorso,
  onVerDatos,
  onRecargar,
}) {
  if (loadingSolicitudes) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingSpinner} />
        <p>Cargando solicitudes...</p>
      </div>
    );
  }

  // Estilos base para los botones para que se vean uniformes
  const btnStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    padding: "6px 10px",
    fontSize: "12px",
    fontWeight: "600",
    borderRadius: "6px",
    border: "1px solid",
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.2s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <h2 className={styles.sectionTitle} style={{ margin: 0 }}>
          Solicitudes de pacientes (desde el formulario público)
        </h2>
        <button type="button" onClick={onRecargar} className={styles.secondaryBtn} style={{ padding: "6px 12px", fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
          🔄 Actualizar Tabla
        </button>
      </div>

      {solicitudes.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📭</span>
          <p>No hay solicitudes pendientes en este momento.</p>
        </div>
      ) : (
        <div className={styles.tableWrapper} style={{ width: "100%", overflowX: "auto" }}>
          <table className={styles.table} style={{ width: "100%", minWidth: "1100px" }}>
            <thead>
              <tr>
                <th style={{ width: "18%" }}>Paciente</th>
                <th style={{ width: "12%" }}>Contacto</th>
                <th style={{ width: "18%" }}>Familiar</th>
                <th style={{ width: "15%" }}>Localidad</th>
                <th style={{ width: "10%" }}>Fecha</th>
                <th style={{ width: "9%", textAlign: "center" }}>Estado</th>
                <th style={{ width: "28%", textAlign: "center" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {solicitudes.map((sol) => {
                const isAtendida = sol.estado === "Atendida" || sol.atendida;

                return (
                  <tr key={sol.id} className={isAtendida ? styles.rowAtendida : ""}>
                    <td>
                      <div className={styles.cellName}>
                        <strong style={{ fontSize: "14px" }}>{sol.apellido} {sol.nombre}</strong>
                        <div className={styles.subText} style={{ fontSize: "12px" }}>DNI {sol.dni || "—"}</div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: "600" }}>{sol.telefono || "—"}</div>
                    </td>
                    <td>
                      <div className={styles.cellName}>
                        <strong style={{ fontSize: "13.5px" }}>{sol.familiarNombre || "—"}</strong>
                        <div className={styles.subText} style={{ fontSize: "12px" }}>{sol.familiarParentezco || "—"} · {sol.familiarTelefono || "—"}</div>
                      </div>
                    </td>
                    <td>
                      {sol.localidad ? `${sol.localidad}, ${sol.provincia || ""}` : "—"}
                    </td>
                    <td>
                      {sol.fechaSolicitud ? new Date(sol.fechaSolicitud).toLocaleDateString("es-AR") : "—"}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`${styles.estadoBadge} ${isAtendida ? styles.estadoAtendida : styles.estadoPendiente}`}>
                        {isAtendida ? "Atendida" : "Pendiente"}
                      </span>
                    </td>
                    <td>
                      {/* AGRUPACIÓN DE BOTONES CON FLEX-WRAP */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          padding: "4px 0"
                        }}
                      >
                        {/* VER */}
                        <button
                          type="button"
                          onClick={() => onVerDatos(sol)}
                          title="Ver todos los datos"
                          style={{ ...btnStyle, background: "#1e293b", borderColor: "#334155", color: "#cbd5e1" }}
                        >
                          👁️ Ver
                        </button>

                        {/* PDFs */}
                        <button
                          type="button"
                          onClick={() => onDescargarFrente(sol)}
                          title="Descargar Frente"
                          style={{ ...btnStyle, background: "transparent", borderColor: "#475569", color: "#94a3b8" }}
                        >
                          📄 Frente
                        </button>
                        <button
                          type="button"
                          onClick={() => onDescargarDorso(sol)}
                          title="Descargar Dorso"
                          style={{ ...btnStyle, background: "transparent", borderColor: "#475569", color: "#94a3b8" }}
                        >
                          📄 Dorso
                        </button>

                        {/* CARGAR CX (Destacado) */}
                        <button
                          type="button"
                          onClick={() => cargarSolicitudEnFormulario(sol)}
                          title="Cargar datos al formulario"
                          style={{
                            ...btnStyle,
                            background: "rgba(111, 161, 123, 0.15)",
                            borderColor: "#6fa17b",
                            color: "#6fa17b",
                            fontWeight: "700"
                          }}
                        >
                          🔄 Cargar CX
                        </button>

                        {/* ELIMINAR */}
                        <button
                          type="button"
                          onClick={() => onEliminar(sol.id)}
                          title="Eliminar solicitud"
                          style={{ ...btnStyle, background: "rgba(239, 68, 68, 0.1)", borderColor: "rgba(239, 68, 68, 0.4)", color: "#fca5a5" }}
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
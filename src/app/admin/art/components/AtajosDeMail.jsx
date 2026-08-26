"use client";
import { useState } from "react";
import styles from "../page.module.css";

export default function AtajosDeMail({
  atajos,
  loading,
  atajosActivos,
  aplicarAtajo,
  quitarAtajo,
  desactivarAtajo,
  setMostrarFormAtajo,
  setEditandoAtajo,
  setNuevoAtajoLabel,
  setNuevoAtajoAdjunto,
  setNuevoAtajoSolicitud,
  eliminarAtajo,
}) {
  const [filtro, setFiltro] = useState("");

  const atajosFiltrados = (atajos || []).filter((a) =>
    a.label.toLowerCase().includes(filtro.toLowerCase()) ||
    a.adjunto?.toLowerCase().includes(filtro.toLowerCase())
  );

  const isActive = (id) => atajosActivos.some((a) => a.id === id);

  return (
    <div className={`${styles.block} ${styles.atajosWrapper}`}>
      <div className={styles.blockTop}>
        <p className={styles.blockLabel}>
          ⚡ Atajos de Mail
          {atajosActivos.length > 0 && ` · ${atajosActivos.length} activos`}
        </p>
        <button className={styles.tinyBtn} onClick={() => setMostrarFormAtajo(true)}>
          + Nuevo
        </button>
      </div>

      <div className={styles.atajosFilter}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar atajo…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        />
      </div>

      {loading ? (
        <p className={styles.emptyMsg}>Cargando atajos…</p>
      ) : (
        <>
          <div className={styles.atajosChipsGrid}>
            {atajosFiltrados.length === 0 ? (
              <p className={styles.emptyMsg}>
                {filtro.trim() ? "No hay atajos que coincidan" : "No hay atajos guardados"}
              </p>
            ) : (
              atajosFiltrados.map((atajo) => {
                const active = isActive(atajo.id);
                return (
                  <button
                    key={atajo.id}
                    className={`${styles.atajoChip} ${active ? styles.atajoChipActive : ""}`}
                    onClick={() => (active ? quitarAtajo(atajo.id) : aplicarAtajo(atajo))}
                    title={atajo.adjunto || atajo.solicitud || ""}
                  >
                    <span className={styles.atajoChipLabel}>{atajo.label}</span>
                    {active && <span className={styles.atajoChipCheck}>✓</span>}
                    <button
                      className={styles.atajoChipDelete}
                      onClick={(e) => {
                        e.stopPropagation();
                        eliminarAtajo(atajo.id);
                      }}
                      title="Eliminar atajo"
                    >
                      ×
                    </button>
                  </button>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
         
            {atajosActivos.length > 0 && (
              <button className={styles.desactivarAtajoBtn} onClick={desactivarAtajo}>
                ❌ Desactivar todos ({atajosActivos.length})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
"use client";
import { useState, useEffect } from "react";
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
  const [filtro, setFiltro] = useState("");
  const [orden, setOrden] = useState([]);
  const [isOpen, setIsOpen] = useState(true); // cerrado por defecto, se abre al buscar

  // Filtrar atajos
  const atajosFiltrados = (atajos || []).filter((a) =>
    a.label.toLowerCase().includes(filtro.toLowerCase()) ||
    a.asunto?.toLowerCase().includes(filtro.toLowerCase())
  );

  // Sincronizar orden con los atajos filtrados
  useEffect(() => {
    const idsFiltrados = atajosFiltrados.map((a) => a.id);
    const idsActuales = orden.filter((id) => idsFiltrados.includes(id));
    const nuevosIds = idsFiltrados.filter((id) => !idsActuales.includes(id));
    if (nuevosIds.length > 0 || idsActuales.length !== idsFiltrados.length) {
      setOrden([...idsActuales, ...nuevosIds]);
    } else if (orden.length === 0 && idsFiltrados.length > 0) {
      setOrden(idsFiltrados);
    }
  }, [atajosFiltrados]);

  const atajosOrdenados = orden
    .map((id) => atajosFiltrados.find((a) => a.id === id))
    .filter(Boolean);

  // Drag & Drop
  const [dragOverId, setDragOverId] = useState(null);

  const handleDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e, id) => {
    e.preventDefault();
    setDragOverId(id);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOverId(null);
  };

  const handleDrop = (e, targetId) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData("text/plain");
    if (draggedId === targetId) return;

    const nuevaOrden = [...orden];
    const draggedIndex = nuevaOrden.indexOf(draggedId);
    const targetIndex = nuevaOrden.indexOf(targetId);
    if (draggedIndex === -1 || targetIndex === -1) return;

    nuevaOrden.splice(draggedIndex, 1);
    nuevaOrden.splice(targetIndex, 0, draggedId);
    setOrden(nuevaOrden);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDragOverId(null);
  };

  // Manejar cambio en el filtro: abrir acordeón si hay texto
  const handleFiltroChange = (e) => {
    const valor = e.target.value;
    setFiltro(valor);
    if (valor.trim().length > 0 && !isOpen) {
      setIsOpen(true);
    }
  };

  if (loading) return <p className={styles.emptyMsg}>Cargando atajos…</p>;

  return (
    <div className={`${styles.block} ${styles.atajosWrapper}`}>
      <div className={styles.blockTop}>
        <div
          className={styles.atajosHeaderLeft}
          onClick={() => setIsOpen(!isOpen)}
          style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}
        >
          <p className={styles.blockLabel}>⚡ Atajos de Mail</p>
          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
            {isOpen ? "▼" : "▶"}
          </span>
        </div>
        <button className={styles.tinyBtn} onClick={() => setMostrarFormAtajo(true)}>
          + Nuevo
        </button>
      </div>

      {/* Buscador siempre visible */}
      <div className={styles.atajosFilter}>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Buscar atajo…"
          value={filtro}
          onChange={handleFiltroChange}
        />
      </div>

      {/* Contenido colapsable (lista y botones) */}
      {isOpen && (
        <>
          <div className={styles.atajosAccordion}>
            {atajosOrdenados.length === 0 ? (
              <p className={styles.emptyMsg}>
                {filtro.trim() ? "No hay atajos que coincidan con tu búsqueda" : "No hay atajos guardados"}
              </p>
            ) : (
              atajosOrdenados.map((atajo) => {
                const isActive = atajoActivo?.id === atajo.id;
                const isDragOver = dragOverId === atajo.id;

                return (
                  <div
                    key={atajo.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, atajo.id)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, atajo.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, atajo.id)}
                    onDragEnd={handleDragEnd}
                    className={`${styles.atajoCard} ${
                      isActive ? styles.atajoCardActive : ""
                    } ${isDragOver ? styles.atajoCardDragOver : ""}`}
                    style={{ cursor: "grab" }}
                  >
                    <div className={styles.atajoCardHeader}>
                      <span className={styles.atajoNombre}>
                        {atajo.label}
                        {isActive && " (activo)"}
                      </span>
                      <div className={styles.atajoCardActions}>
                        <button
                          className={`${styles.aplicarBtn} ${
                            isActive ? styles.aplicarBtnActive : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isActive) {
                              desactivarAtajo();
                            } else {
                              aplicarAtajo(atajo);
                            }
                          }}
                        >
                          {isActive ? "Desactivar" : "Aplicar"}
                        </button>
                        <button
                          className={styles.atajoEdit}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditandoAtajo(atajo);
                            setNuevoAtajoLabel(atajo.label || "");
                            setNuevoAtajoAsunto(atajo.asunto || "");
                            setNuevoAtajoAcciones(atajo.acciones || []);
                            setNuevoAtajoCuerpo(atajo.cuerpo || "");
                            setMostrarFormAtajo(true);
                          }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          className={styles.atajoDelete}
                          onClick={(e) => {
                            e.stopPropagation();
                            eliminarAtajo(atajo.id);
                          }}
                          title="Eliminar"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

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
            ✨ Crear nuevo atajo
          </button>

          {atajoActivo && (
            <button className={styles.desactivarAtajoBtn} onClick={desactivarAtajo}>
              ❌ Desactivar atajo actual
            </button>
          )}
        </>
      )}
    </div>
  );
}
"use client";

import { useState, useEffect } from "react";
import {
  crearConvenio,
  escucharConvenios,
  eliminarConvenio,
} from "@/lib/conveniosService";
import { ref, get, set, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import styles from "./conveniosAdmin.module.css";

/* =========================
   Utils
   ========================= */
const prettyKey = (k) => k.replace(/_/g, " ");

const normalizeKeys = (obj) => {
  if (Array.isArray(obj)) return obj.map(normalizeKeys);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k.trim().replace(/\s+/g, "_")] = normalizeKeys(v);
    }
    return out;
  }
  return obj;
};

export default function ConveniosAdmin() {
  const [convenios, setConvenios] = useState({});
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [activo, setActivo] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});
  const [mensaje, setMensaje] = useState("");

  const [modalEliminar, setModalEliminar] = useState(null);
  const [modalRenombrar, setModalRenombrar] = useState(null);
  const [nuevoNombreConvenio, setNuevoNombreConvenio] = useState("");

  /* ===== Load convenios ===== */
  useEffect(() => {
    escucharConvenios(setConvenios);
  }, []);

  /* ===== Crear ===== */
  const crear = async () => {
    if (!nuevoNombre.trim()) return;
    const safe = nuevoNombre.trim().replace(/\s+/g, "_");
    await crearConvenio(safe);
    setNuevoNombre("");
    setMensaje(`✅ Convenio "${prettyKey(safe)}" creado`);
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Editar ===== */
  const editar = (nombre) => {
    const data = convenios[nombre];
    if (!data) return;
    setActivo(nombre);
    setEditBuffer({
      valores_generales: { ...(data.valores_generales || {}) },
      honorarios_medicos: Array.isArray(data.honorarios_medicos)
        ? [...data.honorarios_medicos]
        : [],
    });
  };

  /* ===== Guardar ===== */
  const guardar = async () => {
    if (!activo) return;
    const refConv = ref(db, `convenios/${activo}`);
    const payload = normalizeKeys(editBuffer);
    await set(refConv, payload);
    setActivo(null);
    setEditBuffer({});
    setMensaje("✅ Convenio actualizado correctamente");
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Eliminar ===== */
  const confirmarEliminar = async () => {
    await eliminarConvenio(modalEliminar);
    setModalEliminar(null);
    setMensaje("🗑️ Convenio eliminado");
    setTimeout(() => setMensaje(""), 3000);
  };

  /* ===== Renombrar (CORRECTO) ===== */
  const confirmarRenombrar = async () => {
    if (!modalRenombrar || !nuevoNombreConvenio.trim()) return;

    const snap = await get(ref(db, `convenios/${modalRenombrar}`));
    if (!snap.exists()) return;

    const data = snap.val();
    const safe = nuevoNombreConvenio.trim().replace(/\s+/g, "_");

    await set(ref(db, `convenios/${safe}`), data);
    await remove(ref(db, `convenios/${modalRenombrar}`));

    setModalRenombrar(null);
    setNuevoNombreConvenio("");
    setMensaje("✏️ Convenio renombrado correctamente");
    setTimeout(() => setMensaje(""), 3000);
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>🩺 Administración de Convenios</h2>

      {mensaje && <div className={styles.message}>{mensaje}</div>}

      {/* Crear */}
      <div className={styles.newRow}>
        <input
          className={styles.input}
          placeholder="Nuevo convenio..."
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
        />
        <button className={styles.btnPrimary} onClick={crear}>
          ➕ Crear
        </button>
      </div>

      {/* Tabla */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Convenio</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(convenios).map(([nombre, data]) => (
              <tr key={nombre}>
                <td>{prettyKey(nombre)}</td>
                <td>
                  {Object.keys(data.valores_generales || {}).length
                    ? "🟢 Cargado"
                    : "🟡 Sin datos"}
                </td>
                <td className={styles.actions}>
                  <button onClick={() => editar(nombre)}>✏️</button>
                  <button onClick={() => setModalRenombrar(nombre)}>📝</button>
                  <button onClick={() => setModalEliminar(nombre)}>🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ===== Editor ===== */}
      {activo && (
        <div className={styles.editorCard}>
          <h4>✏️ Editando: {prettyKey(activo)}</h4>

          <pre style={{ fontSize: 12, opacity: 0.8 }}>
            {JSON.stringify(editBuffer, null, 2)}
          </pre>

          <div className={styles.editorActions}>
            <button
              className={styles.btnSecondary}
              onClick={() => setActivo(null)}
            >
              Cancelar
            </button>
            <button className={styles.btnPrimary} onClick={guardar}>
              Guardar
            </button>
          </div>
        </div>
      )}

      {/* ===== Modales ===== */}
      {modalEliminar && (
        <Modal
          title="Eliminar convenio"
          message={`¿Eliminar "${prettyKey(modalEliminar)}"?`}
          onCancel={() => setModalEliminar(null)}
          onConfirm={confirmarEliminar}
          confirmText="Eliminar"
          confirmClass={styles.btnDanger}
        />
      )}

      {modalRenombrar && (
        <Modal
          title="Renombrar convenio"
          variant="solid"
          message={
            <>
              <p>Nuevo nombre:</p>
              <input
                className={styles.input}
                value={nuevoNombreConvenio}
                onChange={(e) => setNuevoNombreConvenio(e.target.value)}
              />
            </>
          }
          onCancel={() => setModalRenombrar(null)}
          onConfirm={confirmarRenombrar}
          confirmText="Renombrar"
          confirmClass={styles.btnWarning}
        />
      )}
    </div>
  );
}

/* =========================
   Modal (con variante SOLID)
   ========================= */
function Modal({
  title,
  message,
  onCancel,
  onConfirm,
  confirmText,
  confirmClass,
  variant = "default",
}) {
  return (
    <div
      className={`${styles.modalOverlay} ${variant === "solid" ? styles.modalOverlaySolid : ""
        }`}
    >
      <div
        className={`${styles.modal} ${variant === "solid" ? styles.modalSolid : ""
          }`}
      >
        <h4>{title}</h4>
        <div className={styles.modalBody}>{message}</div>
        <div className={styles.modalActions}>
          <button className={styles.btnSecondary} onClick={onCancel}>
            Cancelar
          </button>
          <button className={confirmClass} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';
import { useState, useEffect } from "react";
import {
  crearConvenio,
  escucharConvenios,
  eliminarConvenio,
} from "@/lib/conveniosService";
import { ref, get, set, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import styles from "./conveniosAdmin.module.css";

export default function ConveniosAdmin() {
  const [convenios, setConvenios] = useState({});
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [activo, setActivo] = useState(null);
  const [editBuffer, setEditBuffer] = useState({});
  const [nuevaPractica, setNuevaPractica] = useState({ nombre: "", valor: "" });
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [errores, setErrores] = useState({});
  const [modalEliminar, setModalEliminar] = useState(null);
  const [modalRenombrar, setModalRenombrar] = useState(null);
  const [modalConfirmarCrear, setModalConfirmarCrear] = useState(false);
  const [modalConfirmarGuardar, setModalConfirmarGuardar] = useState(false);
  const [modalConfirmarCancelar, setModalConfirmarCancelar] = useState(false);
  const [nuevoNombreConvenio, setNuevoNombreConvenio] = useState("");

  /* === Escuchar convenios === */
  useEffect(() => {
    escucharConvenios(setConvenios);
  }, []);

  /* === Crear nuevo convenio === */
  const handleCrear = () => {
    if (!nuevoNombre.trim()) return setMensaje("⚠️ Ingresá un nombre válido.");
    setModalConfirmarCrear(true);
  };

  const confirmarCrear = async () => {
    await crearConvenio(nuevoNombre.trim());
    setNuevoNombre("");
    setModalConfirmarCrear(false);
    setMensaje("✅ Convenio creado correctamente.");
    setTimeout(() => setMensaje(""), 3000);
  };

  /* === Editar === */
  const handleEditar = (nombre) => {
    const data = convenios[nombre];
    if (!data) return setMensaje("⚠️ Este convenio no tiene datos todavía.");

    // 🔹 Convertir claves con '_' → ' ' para mostrar bonito en pantalla
    const mostrarBonito = (obj) => {
      if (!obj || typeof obj !== "object") return obj;
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const displayKey = key.replace(/_/g, " ");
        result[displayKey] =
          typeof value === "object" ? mostrarBonito(value) : value;
      }
      return result;
    };

    setEditBuffer({
      valores_generales: mostrarBonito(data.valores_generales || {}),
      honorarios_medicos: [...(data.honorarios_medicos || [null])],
    });

    setActivo(nombre);
    setErrores({});
  };

  const handleCancelar = () => setModalConfirmarCancelar(true);
  const confirmarCancelar = () => {
    setActivo(null);
    setEditBuffer({});
    setErrores({});
    setModalConfirmarCancelar(false);
  };

  /* === Inputs === */
  const handleChange = (tipo, clave, campo, valor) => {
    setEditBuffer((prev) => {
      const updated = structuredClone(prev);
      if (tipo === "valores_generales") {
        updated.valores_generales[clave] = valor;
      } else if (tipo === "honorarios_medicos") {
        if (!updated.honorarios_medicos[clave])
          updated.honorarios_medicos[clave] = {};
        updated.honorarios_medicos[clave][campo] = valor;
      }
      return updated;
    });
  };

  /* === Prácticas === */
  const handleAgregarPractica = () => {
    if (!nuevaPractica.nombre.trim()) return;
    setEditBuffer((prev) => ({
      ...prev,
      valores_generales: {
        ...prev.valores_generales,
        [nuevaPractica.nombre]: nuevaPractica.valor,
      },
    }));
    setNuevaPractica({ nombre: "", valor: "" });
  };

  const handleEliminarPractica = (nombre) => {
    setEditBuffer((prev) => {
      const nuevo = structuredClone(prev);
      delete nuevo.valores_generales[nombre];
      return nuevo;
    });
  };

  /* === Validar === */
  const validarCampos = () => {
    const nuevosErrores = {};
    for (const [clave, valor] of Object.entries(editBuffer.valores_generales || {}))
      if (valor === "" || valor === null) nuevosErrores[`val-${clave}`] = true;
    setErrores(nuevosErrores);
    return true;
  };

  /* === Guardar con normalización === */
  const handleGuardar = () => {
    if (!validarCampos()) {
      setMensaje("⚠️ Revisá los campos antes de guardar.");
      return;
    }
    setModalConfirmarGuardar(true);
  };

  const confirmarGuardar = async () => {
    if (!activo) return;
    setGuardando(true);

    try {
      const convenioRef = ref(db, `convenios/${activo}`);
      const snap = await get(convenioRef);
      const currentData = snap.exists() ? snap.val() : {};

      // 🔹 Reemplazar espacios por guiones bajos antes de guardar
      const normalizarClaves = (obj) => {
        if (Array.isArray(obj)) return obj.map(normalizarClaves);
        if (obj && typeof obj === "object") {
          const res = {};
          for (const [k, v] of Object.entries(obj)) {
            const safeKey = k.replace(/\s+/g, "_"); // ← convierte “Bonito Nombre” → “Bonito_Nombre”
            res[safeKey] = normalizarClaves(v);
          }
          return res;
        }
        return obj;
      };

      // 🔹 Fusionar y limpiar
      const merged = {
        valores_generales: {
          ...(currentData.valores_generales || {}),
          ...(normalizarClaves(editBuffer.valores_generales || {})),
        },
        honorarios_medicos: editBuffer.honorarios_medicos?.length
          ? editBuffer.honorarios_medicos
          : currentData.honorarios_medicos || [null],
      };

      const cleanData = (obj) => {
        if (Array.isArray(obj)) {
          return obj
            .map((item) => cleanData(item))
            .filter((item) => item !== undefined && item !== null);
        } else if (obj && typeof obj === "object") {
          const cleaned = {};
          for (const [key, value] of Object.entries(obj)) {
            const cleanedValue = cleanData(value);
            if (cleanedValue !== undefined && cleanedValue !== null && cleanedValue !== "")
              cleaned[key] = cleanedValue;
          }
          return cleaned;
        }
        return obj;
      };

      // 🔹 Sanitiza claves para Firebase
      const sanitizeKeys = (obj) => {
        if (Array.isArray(obj)) return obj.map(sanitizeKeys);
        if (obj && typeof obj === "object") {
          const cleaned = {};
          for (const [key, value] of Object.entries(obj)) {
            const safeKey = key.replace(/[.#$/[\]]/g, "_").replace(/\//g, "_");
            cleaned[safeKey] = sanitizeKeys(value);
          }
          return cleaned;
        }
        return obj;
      };

      const sanitized = sanitizeKeys(cleanData(merged));
      await set(convenioRef, sanitized);

      setMensaje("✅ Convenio actualizado correctamente.");
      setTimeout(() => {
        setActivo(null);
        setEditBuffer({});
      }, 600);
    } catch (err) {
      console.error(err);
      setMensaje("❌ Error al guardar los datos.");
    } finally {
      setGuardando(false);
      setModalConfirmarGuardar(false);
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  /* === Eliminar === */
  const confirmarEliminar = async () => {
    await eliminarConvenio(modalEliminar);
    setModalEliminar(null);
    setMensaje("✅ Convenio eliminado correctamente.");
    setTimeout(() => setMensaje(""), 3000);
  };

  /* === Renombrar === */
  const handleRenombrar = async () => {
    if (!modalRenombrar || !nuevoNombreConvenio.trim()) return;
    const snap = await get(ref(db, `convenios/${modalRenombrar}`));
    if (!snap.exists()) return alert("Convenio no encontrado");
    const data = snap.val();
    await set(ref(db, `convenios/${nuevoNombreConvenio}`), data);
    await remove(ref(db, `convenios/${modalRenombrar}`));
    setModalRenombrar(null);
    setNuevoNombreConvenio("");
    setMensaje("✅ Convenio renombrado correctamente.");
    setTimeout(() => setMensaje(""), 3000);
  };


  /* === Render === */
  return (
    <div className={styles.wrapper}>
      <h2 className={styles.title}>🩺 Administración de Convenios</h2>

      {mensaje && <div className={styles.message}>{mensaje}</div>}

      <div className={styles.newRow}>
        <input
          className={styles.input}
          placeholder="Nuevo convenio..."
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
        />
        <button className={styles.btnPrimary} onClick={handleCrear}>
          ➕ Crear
        </button>
      </div>

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
            {Object.keys(convenios).length === 0 && (
              <tr>
                <td colSpan={3}>No hay convenios cargados.</td>
              </tr>
            )}
            {Object.entries(convenios).map(([nombre, data]) => {
              const cargado = Object.keys(data.valores_generales || {}).length > 0;
              return (
                <tr key={nombre}>
                  <td>{nombre}</td>
                  <td>{cargado ? "🟢 Cargado" : "🟡 Sin datos"}</td>
                  <td className={styles.actions}>
                    <button onClick={() => handleEditar(nombre)}>✏️</button>
                    <button onClick={() => setModalRenombrar(nombre)}>📝</button>
                    <button onClick={() => setModalEliminar(nombre)}>🗑️</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* === MODALES === */}
      {modalConfirmarCrear && (
        <Modal
          title="Confirmar creación"
          message={`¿Crear el convenio "${nuevoNombre}"?`}
          onCancel={() => setModalConfirmarCrear(false)}
          onConfirm={confirmarCrear}
          confirmText="Crear"
          confirmClass={styles.btnPrimary}
        />
      )}

      {modalConfirmarGuardar && (
        <Modal
          title="Guardar cambios"
          message={`¿Guardar los cambios en "${activo}"?`}
          onCancel={() => setModalConfirmarGuardar(false)}
          onConfirm={confirmarGuardar}
          confirmText="Guardar"
          confirmClass={styles.btnPrimary}
        />
      )}

      {modalConfirmarCancelar && (
        <Modal
          title="Cancelar edición"
          message="¿Descartar los cambios?"
          onCancel={() => setModalConfirmarCancelar(false)}
          onConfirm={confirmarCancelar}
          confirmText="Descartar"
          confirmClass={styles.btnSecondary}
        />
      )}

      {modalEliminar && (
        <Modal
          title="Eliminar convenio"
          message={`¿Eliminar "${modalEliminar}"?`}
          onCancel={() => setModalEliminar(null)}
          onConfirm={confirmarEliminar}
          confirmText="Eliminar"
          confirmClass={styles.btnDanger}
        />
      )}

      {modalRenombrar && (
        <Modal
          title="Renombrar Convenio"
          message={
            <>
              <p>
                Nuevo nombre para <strong>{modalRenombrar}</strong>:
              </p>
              <input
                type="text"
                className={styles.input}
                placeholder="Ej: ART-Noviembre-2025"
                value={nuevoNombreConvenio}
                onChange={(e) => setNuevoNombreConvenio(e.target.value)}
              />
            </>
          }
          onCancel={() => setModalRenombrar(null)}
          onConfirm={handleRenombrar}
          confirmText="Renombrar"
          confirmClass={styles.btnWarning}
        />
      )}

      {activo && editBuffer && (
        <EditorConvenio
          activo={activo}
          editBuffer={editBuffer}
          errores={errores}
          guardando={guardando}
          handleChange={handleChange}
          handleAgregarPractica={handleAgregarPractica}
          handleEliminarPractica={handleEliminarPractica}
          handleGuardar={handleGuardar}
          handleCancelar={handleCancelar}
          nuevaPractica={nuevaPractica}
          setNuevaPractica={setNuevaPractica}
        />
      )}
    </div>
  );
}

/* === MODAL === */
function Modal({ title, message, onCancel, onConfirm, confirmText, confirmClass }) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
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

/* === EDITOR === */
function EditorConvenio({
  activo,
  editBuffer,
  errores,
  guardando,
  handleChange,
  handleAgregarPractica,
  handleEliminarPractica,
  handleGuardar,
  handleCancelar,
  nuevaPractica,
  setNuevaPractica,
}) {
  if (!editBuffer?.valores_generales) return null;

  return (
    <div className={styles.editorCard}>
      <h4>✏️ Editando: {activo}</h4>

      <h5>📑 Prácticas</h5>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Valor ($)</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(editBuffer.valores_generales || {}).map(([nombre, valor]) => (
            <tr key={nombre}>
              <td>{nombre}</td>
              <td>
                <input
                  className={`${styles.input} ${errores[`val-${nombre}`] ? styles.errorInput : ""}`}
                  value={valor}
                  onChange={(e) => handleChange("valores_generales", nombre, "", e.target.value)}
                />
              </td>
              <td>
                <button className={styles.btnDanger} onClick={() => handleEliminarPractica(nombre)}>
                  🗑️
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <input
                className={styles.input}
                placeholder="Nueva práctica"
                value={nuevaPractica.nombre}
                onChange={(e) => setNuevaPractica({ ...nuevaPractica, nombre: e.target.value })}
              />
            </td>
            <td>
              <input
                className={styles.input}
                placeholder="Valor"
                value={nuevaPractica.valor}
                onChange={(e) => setNuevaPractica({ ...nuevaPractica, valor: e.target.value })}
              />
            </td>
            <td>
              <button className={styles.btnPrimary} onClick={handleAgregarPractica}>
                ➕
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <h5>👨‍⚕️ Honorarios Médicos</h5>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Nivel</th>
            <th>Cirujano</th>
            <th>Ayudante 1</th>
            <th>Ayudante 2</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(editBuffer.honorarios_medicos || {}).map(([nivel, h]) => (
            <tr key={nivel}>
              <td>{nivel}</td>
              {Object.entries(h || {}).map(([campo, valor]) => (
                <td key={campo}>
                  <input
                    className={`${styles.input} ${errores[`hon-${nivel}-${campo}`] ? styles.errorInput : ""}`}
                    value={valor}
                    onChange={(e) =>
                      handleChange("honorarios_medicos", nivel, campo, e.target.value)
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className={styles.editorActions}>
        <button className={styles.btnSecondary} onClick={handleCancelar}>
          ❌ Cancelar
        </button>
        <button className={styles.btnPrimary} onClick={handleGuardar} disabled={guardando}>
          💾 {guardando ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import {
  crearConvenio,
  escucharConvenios,
  eliminarConvenio
} from "@/lib/conveniosService";
import { ref, get, set, remove } from "firebase/database";
import { db } from "@/lib/firebase";

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

  // 🔹 Escucha en vivo los convenios desde Firebase
  useEffect(() => {
    escucharConvenios(setConvenios);
  }, []);

  /* === CREAR NUEVO CONVENIO === */
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

  /* === EDITAR === */
  const handleEditar = (nombre) => {
    setActivo(nombre);
    setEditBuffer(JSON.parse(JSON.stringify(convenios[nombre])));
    setErrores({});
  };

  const handleCancelar = () => setModalConfirmarCancelar(true);

  const confirmarCancelar = () => {
    setActivo(null);
    setEditBuffer({});
    setErrores({});
    setModalConfirmarCancelar(false);
  };

  /* === INPUTS === */
  const handleChange = (tipo, clave, campo, valor) => {
    setEditBuffer((prev) => {
      const updated = { ...prev };
      if (tipo === "valores_generales") updated.valores_generales[clave] = valor;
      else updated.honorarios_medicos[clave][campo] = valor;
      return updated;
    });
  };

  /* === PRÁCTICAS === */
  const handleAgregarPractica = () => {
    if (!nuevaPractica.nombre.trim()) return;
    setEditBuffer((prev) => ({
      ...prev,
      valores_generales: {
        ...prev.valores_generales,
        [nuevaPractica.nombre]: nuevaPractica.valor
      }
    }));
    setNuevaPractica({ nombre: "", valor: "" });
  };

  const handleEliminarPractica = (nombre) => {
    const nuevo = { ...editBuffer };
    delete nuevo.valores_generales[nombre];
    setEditBuffer(nuevo);
  };

  /* === VALIDACIÓN === */
  const validarCampos = () => {
    const nuevosErrores = {};
    for (const [clave, valor] of Object.entries(editBuffer.valores_generales || {}))
      if (valor === "" || valor === null) nuevosErrores[`val-${clave}`] = true;
    for (const [nivel, h] of Object.entries(editBuffer.honorarios_medicos || {})) {
      const honorario = h || {};
      for (const [campo, valor] of Object.entries(honorario))
        if (valor === "" || valor === null)
          nuevosErrores[`hon-${nivel}-${campo}`] = true;
    }
    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  /* === GUARDAR (OPTIMIZADO) === */
  const handleGuardar = () => {
    if (!validarCampos()) {
      setMensaje("⚠️ Completá todos los campos antes de guardar.");
      return;
    }
    setModalConfirmarGuardar(true);
  };

  const confirmarGuardar = async () => {
    if (!activo) return;
    setGuardando(true);
    try {
      // 🚀 Guardado atómico ultra rápido
      await set(ref(db, `convenios/${activo}`), editBuffer);

      setMensaje("✅ Convenio guardado correctamente.");
      setActivo(null);
      setEditBuffer({});
    } catch (err) {
      console.error(err);
      setMensaje("❌ Error al guardar los datos.");
    } finally {
      setGuardando(false);
      setModalConfirmarGuardar(false);
      setTimeout(() => setMensaje(""), 3000);
    }
  };

  /* === ELIMINAR === */
  const confirmarEliminar = async () => {
    await eliminarConvenio(modalEliminar);
    setModalEliminar(null);
    setMensaje("✅ Convenio eliminado correctamente.");
    setTimeout(() => setMensaje(""), 3000);
  };

  /* === RENOMBRAR === */
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

  /* === RENDER === */
  return (
    <div className="container mt-4 text-light">
      <h2>🩺 Administración de Convenios</h2>

      {mensaje && <div className="alert alert-success text-center py-2 small">{mensaje}</div>}

      {/* Crear nuevo */}
      <div className="d-flex gap-2 my-3">
        <input
          className="form-control"
          placeholder="Nuevo convenio..."
          value={nuevoNombre}
          onChange={(e) => setNuevoNombre(e.target.value)}
        />
        <button className="btn btn-success" onClick={handleCrear}>
          ➕ Crear
        </button>
      </div>

      {/* Tabla de convenios */}
      <table className="table table-dark table-striped table-hover">
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
            const cargado = Object.values(data.valores_generales || {}).some((v) => v);
            return (
              <tr key={nombre}>
                <td>{nombre}</td>
                <td>{cargado ? "🟢 Cargado" : "🟡 Sin datos"}</td>
                <td>
                  <button
                    className="btn btn-sm btn-outline-info me-2"
                    onClick={() => handleEditar(nombre)}
                  >
                    ✏️ {cargado ? "Editar" : "Cargar"}
                  </button>
                  <button
                    className="btn btn-sm btn-outline-warning me-2"
                    onClick={() => setModalRenombrar(nombre)}
                  >
                    📝 Renombrar
                  </button>
                  <button
                    className="btn btn-sm btn-outline-danger"
                    onClick={() => setModalEliminar(nombre)}
                  >
                    🗑️ Eliminar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* === MODALES === */}
      {modalConfirmarCrear && (
        <Modal
          title="Confirmar creación"
          message={`¿Deseas crear el convenio "${nuevoNombre}"?`}
          onCancel={() => setModalConfirmarCrear(false)}
          onConfirm={confirmarCrear}
          confirmText="Crear"
          confirmClass="btn-success"
        />
      )}

      {modalConfirmarGuardar && (
        <Modal
          title="Guardar cambios"
          message={`¿Deseas guardar los cambios realizados en "${activo}"?`}
          onCancel={() => setModalConfirmarGuardar(false)}
          onConfirm={confirmarGuardar}
          confirmText="Guardar"
          confirmClass="btn-success"
        />
      )}

      {modalConfirmarCancelar && (
        <Modal
          title="Cancelar edición"
          message="¿Deseas descartar los cambios?"
          onCancel={() => setModalConfirmarCancelar(false)}
          onConfirm={confirmarCancelar}
          confirmText="Descartar"
          confirmClass="btn-secondary"
        />
      )}

      {modalEliminar && (
        <Modal
          title="Eliminar convenio"
          message={`¿Seguro que deseas eliminar "${modalEliminar}"?`}
          onCancel={() => setModalEliminar(null)}
          onConfirm={confirmarEliminar}
          confirmText="Eliminar"
          confirmClass="btn-danger"
        />
      )}

      {modalRenombrar && (
        <div className="modal fade show d-block">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-dark text-light">
              <div className="modal-header">
                <h5 className="modal-title text-warning">Renombrar Convenio</h5>
                <button className="btn-close btn-close-white" onClick={() => setModalRenombrar(null)}></button>
              </div>
              <div className="modal-body">
                <label className="form-label">Nuevo nombre para <strong>{modalRenombrar}</strong></label>
                <input
                  type="text"
                  className="form-control bg-dark text-light border-secondary"
                  placeholder="Ej: ART-Noviembre-2025"
                  value={nuevoNombreConvenio}
                  onChange={(e) => setNuevoNombreConvenio(e.target.value)}
                />
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setModalRenombrar(null)}>Cancelar</button>
                <button className="btn btn-warning" onClick={handleRenombrar}>Renombrar</button>
              </div>
            </div>
          </div>
        </div>
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

/* === MODAL GENÉRICO === */
function Modal({ title, message, onCancel, onConfirm, confirmText, confirmClass }) {
  return (
    <div className="modal fade show d-block">
      <div className="modal-dialog modal-dialog-centered">
        <div className="modal-content bg-dark text-light">
          <div className="modal-header">
            <h5 className="modal-title">{title}</h5>
            <button className="btn-close btn-close-white" onClick={onCancel}></button>
          </div>
          <div className="modal-body">
            <p>{message}</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onCancel}>Cancelar</button>
            <button className={`btn ${confirmClass}`} onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* === EDITOR DE CONVENIO === */
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
  setNuevaPractica
}) {
  return (
    <div className="card bg-dark mt-4 p-3 shadow-sm">
      <h4 className="text-info">✏️ Editando: {activo}</h4>
      <h5 className="mt-3">📑 Prácticas</h5>
      <table className="table table-dark table-striped table-sm">
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
                  className={`form-control form-control-sm bg-dark text-light ${
                    errores[`val-${nombre}`] ? "border-danger" : "border-secondary"
                  }`}
                  value={valor}
                  onChange={(e) =>
                    handleChange("valores_generales", nombre, "", e.target.value)
                  }
                />
              </td>
              <td>
                <button
                  className="btn btn-sm btn-outline-danger"
                  onClick={() => handleEliminarPractica(nombre)}
                >
                  🗑️
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td>
              <input
                className="form-control form-control-sm bg-dark text-light"
                placeholder="Nueva práctica"
                value={nuevaPractica.nombre}
                onChange={(e) =>
                  setNuevaPractica({ ...nuevaPractica, nombre: e.target.value })
                }
              />
            </td>
            <td>
              <input
                className="form-control form-control-sm bg-dark text-light"
                placeholder="Valor"
                value={nuevaPractica.valor}
                onChange={(e) =>
                  setNuevaPractica({ ...nuevaPractica, valor: e.target.value })
                }
              />
            </td>
            <td>
              <button
                className="btn btn-sm btn-outline-success"
                onClick={handleAgregarPractica}
              >
                ➕
              </button>
            </td>
          </tr>
        </tbody>
      </table>

      <h5 className="mt-3">👨‍⚕️ Honorarios Médicos</h5>
      <table className="table table-dark table-striped table-sm">
        <thead>
          <tr>
            <th>Nivel</th>
            <th>Cirujano</th>
            <th>Ayudante 1</th>
            <th>Ayudante 2</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(editBuffer.honorarios_medicos || {}).map(([nivel, h]) => {
            const honorario = h || { Cirujano: "", "Ayudante 1": "", "Ayudante 2": "" };
            return (
              <tr key={nivel}>
                <td>{nivel}</td>
                {Object.entries(honorario).map(([campo, valor]) => (
                  <td key={campo}>
                    <input
                      className={`form-control form-control-sm bg-dark text-light ${
                        errores[`hon-${nivel}-${campo}`]
                          ? "border-danger"
                          : "border-secondary"
                      }`}
                      value={valor}
                      onChange={(e) =>
                        handleChange("honorarios_medicos", nivel, campo, e.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="d-flex justify-content-end gap-2 mt-3">
        <button className="btn btn-outline-secondary" onClick={handleCancelar}>
          ❌ Cancelar
        </button>
        <button className="btn btn-success" onClick={handleGuardar} disabled={guardando}>
          💾 {guardando ? "Guardando..." : "Guardar y cerrar"}
        </button>
      </div>
    </div>
  );
}

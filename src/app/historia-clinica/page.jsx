"use client";

import { useState, useEffect, useMemo } from "react";
import { ref, onValue, push, set, update } from "firebase/database";
import { db } from "../../lib/firebase";
import Fuse from "fuse.js";
import styles from "./historias.module.css";

const ITEMS_PER_PAGE = 20;

export default function HistoriasClinicasPage() {
  // Estados de datos
  const [pacientes, setPacientes] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [displayed, setDisplayed] = useState([]);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [loading, setLoading] = useState(true);
  const [lastNumbers, setLastNumbers] = useState([]);

  // Estados de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [searchField, setSearchField] = useState("all"); // "all", "nombre", "dni", "historia"
  const [showOnlyAlerts, setShowOnlyAlerts] = useState(false);

  // Usuario logueado
  const [currentUser, setCurrentUser] = useState(null);

  // Formulario de alta
  const [form, setForm] = useState({
    nombre_apellido: "",
    dni: "",
    historia_clinica: "",
  });
  const [submitting, setSubmitting] = useState(false);

  // Edición inline
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});

  // Configuración de Fuse según el campo seleccionado
  const fuse = useMemo(() => {
    if (!pacientes.length) return null;
    let keys = ["nombre_apellido", "dni", "historia_clinica"];
    if (searchField === "nombre") keys = ["nombre_apellido"];
    else if (searchField === "dni") keys = ["dni"];
    else if (searchField === "historia") keys = ["historia_clinica"];
    // "all" usa las tres claves
    return new Fuse(pacientes, {
      keys,
      threshold: 0.3, // difuso
      includeScore: false,
    });
  }, [pacientes, searchField]);

  // Cargar datos y últimos números
  useEffect(() => {
    const pacientesRef = ref(db, "historias-clinicas");
    const unsubscribe = onValue(pacientesRef, (snapshot) => {
      const data = snapshot.val();
      let lista = [];
      if (data) {
        lista = Object.entries(data).map(([id, values]) => ({
          id,
          ...values,
        }));
      }
      setPacientes(lista);

      // Calcular últimos 5 números de HC
      const numbers = lista
        .map((p) => p.historia_clinica)
        .filter((n) => n && !isNaN(Number(n)))
        .sort((a, b) => Number(b) - Number(a))
        .slice(0, 5);
      setLastNumbers(numbers);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Aplicar búsqueda difusa + filtro de alertas
  useEffect(() => {
    let results = pacientes;

    // Búsqueda difusa
    if (searchTerm.trim() && fuse) {
      const fuseResults = fuse.search(searchTerm).map((r) => r.item);
      results = fuseResults;
    }

    // Filtro de alertas
    if (showOnlyAlerts) {
      results = results.filter((p) => p.alertas && p.alertas.length > 0);
    }

    setFiltered(results);
    setVisibleCount(ITEMS_PER_PAGE);
  }, [searchTerm, searchField, fuse, pacientes, showOnlyAlerts]);

  // Paginación local
  useEffect(() => {
    setDisplayed(filtered.slice(0, visibleCount));
  }, [filtered, visibleCount]);

  // Login
  useEffect(() => {
    const savedUser = localStorage.getItem("historia_user");
    if (savedUser) setCurrentUser(savedUser);
  }, []);

  const handleLogin = () => {
    const name = prompt("Ingresa tu nombre (para registrar cambios):");
    if (name && name.trim()) {
      setCurrentUser(name.trim());
      localStorage.setItem("historia_user", name.trim());
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem("historia_user");
  };

  // Agregar paciente
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) {
      alert("Debes iniciar sesión para agregar pacientes");
      return;
    }
    if (!form.nombre_apellido || !form.dni || !form.historia_clinica) {
      alert("Todos los campos son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const newRef = push(ref(db, "historias-clinicas"));
      await set(newRef, {
        nombre_apellido: form.nombre_apellido,
        dni: form.dni,
        historia_clinica: form.historia_clinica,
        alertas: [],
        createdBy: currentUser,
        createdAt: Date.now(),
        modifiedBy: currentUser,
        modifiedAt: Date.now(),
      });
      setForm({ nombre_apellido: "", dni: "", historia_clinica: "" });
      alert("Paciente agregado correctamente");
    } catch (error) {
      console.error(error);
      alert("Error al agregar paciente");
    } finally {
      setSubmitting(false);
    }
  };

  // Edición inline
  const startEdit = (paciente) => {
    if (!currentUser) {
      alert("Debes iniciar sesión para editar");
      return;
    }
    setEditingId(paciente.id);
    setEditValues({
      nombre_apellido: paciente.nombre_apellido || "",
      dni: paciente.dni || "",
      historia_clinica: paciente.historia_clinica || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (id) => {
    if (!currentUser) return;
    try {
      const updates = {
        ...editValues,
        modifiedBy: currentUser,
        modifiedAt: Date.now(),
      };
      await update(ref(db, `historias-clinicas/${id}`), updates);
      setEditingId(null);
      setEditValues({});
    } catch (error) {
      console.error(error);
      alert("Error al guardar cambios");
    }
  };

  const handleEditChange = (e) => {
    setEditValues({ ...editValues, [e.target.name]: e.target.value });
  };

  const loadMore = () => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <p>Cargando historias clínicas...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Historias Clínicas</h1>

      {/* Barra de login */}
      <div className={styles.loginBar}>
        <div className={styles.userInfo}>
          {currentUser ? (
            <>
              <span className={styles.userName}>👤 {currentUser}</span>
              <button onClick={handleLogout} className={styles.logoutButton}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <button onClick={handleLogin} className={styles.loginButton}>
              Iniciar sesión
            </button>
          )}
        </div>
      </div>

      {/* Últimos números de HC */}
      {lastNumbers.length > 0 && (
        <div className={styles.lastNumbersCard}>
          <div className={styles.lastNumbersTitle}>📋 Últimos números de historia clínica:</div>
          <ul className={styles.lastNumbersList}>
            {lastNumbers.map((num, idx) => (
              <li key={idx} className={styles.lastNumberItem}>
                {num}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Formulario de alta (solo si está logueado) */}
      {currentUser && (
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>Agregar nuevo paciente</h2>
          <form onSubmit={handleSubmit} className={styles.formGrid}>
            <input
              type="text"
              name="nombre_apellido"
              placeholder="Nombre y apellido"
              value={form.nombre_apellido}
              onChange={(e) => setForm({ ...form, nombre_apellido: e.target.value })}
              className={styles.formInput}
              required
            />
            <input
              type="text"
              name="dni"
              placeholder="DNI"
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
              className={styles.formInput}
              required
            />
            <input
              type="text"
              name="historia_clinica"
              placeholder="N° Historia Clínica"
              value={form.historia_clinica}
              onChange={(e) => setForm({ ...form, historia_clinica: e.target.value })}
              className={styles.formInput}
              required
            />
            <button type="submit" disabled={submitting} className={styles.submitButton}>
              {submitting ? "Guardando..." : "Agregar"}
            </button>
          </form>
        </div>
      )}

      {/* Opciones de búsqueda */}
      <div className={styles.searchOptions}>
        <select
          value={searchField}
          onChange={(e) => setSearchField(e.target.value)}
          className={styles.searchSelect}
        >
          <option value="all">🔎 Buscar en todos los campos</option>
          <option value="nombre">👤 Por nombre y apellido</option>
          <option value="dni">🆔 Por DNI</option>
          <option value="historia">📋 Por N° de historia clínica</option>
        </select>

        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showOnlyAlerts}
            onChange={(e) => setShowOnlyAlerts(e.target.checked)}
          />
          ⚠️ Mostrar solo pacientes con alertas
        </label>
      </div>

      <input
        type="text"
        placeholder="🔍 Escribe para buscar (búsqueda difusa, tolerante a errores)"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className={styles.searchInput}
      />

      {/* Tabla de resultados */}
      <div className={styles.tableWrapper}>
        <div className={styles.tableInner}>
          <table className={styles.responsiveTable}>
            <thead>
              <tr>
                <th>Nombre y apellido</th>
                <th>DNI</th>
                <th>N° Historia Clínica</th>
                <th>Alertas</th>
                <th>Modificado por</th>
              </tr>
            </thead>
            <tbody>
              {displayed.length === 0 ? (
                <tr>
                  <td colSpan="5" className={styles.emptyMessage}>
                    No se encontraron resultados
                  </td>
                </tr>
              ) : (
                displayed.map((paciente) => (
                  <tr
                    key={paciente.id}
                    className={currentUser ? styles.clickableRow : ""}
                    onClick={() => currentUser && startEdit(paciente)}
                  >
                    {editingId === paciente.id ? (
                      <>
                        <td>
                          <input
                            name="nombre_apellido"
                            value={editValues.nombre_apellido}
                            onChange={handleEditChange}
                            className={styles.editInput}
                          />
                        </td>
                        <td>
                          <input
                            name="dni"
                            value={editValues.dni}
                            onChange={handleEditChange}
                            className={styles.editInput}
                          />
                        </td>
                        <td>
                          <input
                            name="historia_clinica"
                            value={editValues.historia_clinica}
                            onChange={handleEditChange}
                            className={styles.editInput}
                          />
                        </td>
                        <td>{paciente.alertas?.join(", ") || "-"}</td>
                        <td>
                          <div className={styles.editButtons}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                saveEdit(paciente.id);
                              }}
                              className={styles.saveButton}
                            >
                              💾
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEdit();
                              }}
                              className={styles.cancelButton}
                            >
                              ✖
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td>{paciente.nombre_apellido || "-"}</td>
                        <td>{paciente.dni || "-"}</td>
                        <td>{paciente.historia_clinica || "-"}</td>
                        <td>
                          {paciente.alertas && paciente.alertas.length > 0 ? (
                            <span className={styles.alertBadge}>
                              {paciente.alertas.join(", ")}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td>{paciente.modifiedBy || paciente.createdBy || "-"}</td>
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {filtered.length > visibleCount && (
        <button onClick={loadMore} className={styles.loadMoreButton}>
          Cargar más ({filtered.length - visibleCount} restantes)
        </button>
      )}
    </div>
  );
}
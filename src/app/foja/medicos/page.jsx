"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, onValue, off, update } from "firebase/database";
import { getSession, isAuthenticated } from "@/utils/session";
import Header from "@/components/Header/Header";

// Estilos en línea (si no tienes el archivo CSS)
const styles = {
  loading: {
    textAlign: "center",
    padding: "50px",
    fontSize: "18px",
    color: "#666"
  },
  error: {
    textAlign: "center",
    padding: "50px",
    fontSize: "18px",
    color: "#d32f2f"
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "20px"
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "20px",
    color: "#333"
  },
  filters: {
    display: "flex",
    gap: "10px",
    marginBottom: "20px",
    flexWrap: "wrap"
  },
  searchInput: {
    flex: 1,
    minWidth: "200px",
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px"
  },
  filterSelect: {
    padding: "10px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    fontSize: "14px",
    minWidth: "150px"
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))",
    gap: "20px"
  },
  card: {
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "15px",
    backgroundColor: "#fff",
    boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
  },
  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
    paddingBottom: "10px",
    borderBottom: "2px solid #f0f0f0"
  },
  date: {
    fontSize: "12px",
    color: "#666"
  },
  cardBody: {
    marginBottom: "15px"
  },
  cardActions: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: "10px",
    borderTop: "1px solid #f0f0f0"
  },
  btnEdit: {
    padding: "8px 16px",
    backgroundColor: "#1976d2",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px"
  },
  empty: {
    textAlign: "center",
    padding: "40px",
    color: "#666"
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000
  },
  modal: {
    backgroundColor: "white",
    borderRadius: "8px",
    padding: "20px",
    maxWidth: "600px",
    maxHeight: "80vh",
    overflowY: "auto",
    width: "90%"
  },
  modalError: {
    backgroundColor: "#ffebee",
    color: "#c62828",
    padding: "10px",
    borderRadius: "4px",
    marginBottom: "15px"
  },
  editForm: {
    display: "flex",
    flexDirection: "column",
    gap: "10px"
  },
  modalRow: {
    display: "flex",
    gap: "10px"
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "20px"
  },
  btnCancel: {
    padding: "8px 16px",
    backgroundColor: "#9e9e9e",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer"
  },
  btnSave: {
    padding: "8px 16px",
    backgroundColor: "#4caf50",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer"
  }
};

// ────────────────────────────────────────────── Helper para formatear fecha
const formatDate = (dia, mes, anio) => `${dia}/${mes}/${anio}`;

export default function MedicosPage() {
  const router = useRouter();
  const [registros, setRegistros] = useState([]);
  const [filteredRegistros, setFilteredRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCirujano, setFilterCirujano] = useState("");
  const [filterAnestesista, setFilterAnestesista] = useState("");
  const [editingRegistro, setEditingRegistro] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [userRole, setUserRole] = useState(null);

  // ──────────────── Verificar autenticación y rol ────────────────
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authed = await isAuthenticated();
        if (!authed) {
          router.push("/login");
          return;
        }
        const session = getSession();
        if (session?.TipoEmpleado !== "MEDICO") {
          setErrorMsg("Acceso denegado. Solo médicos pueden ver esta página.");
          setTimeout(() => router.push("/"), 2000);
          return;
        }
        setUserRole(session.TipoEmpleado);
      } catch (error) {
        console.error("Error en autenticación:", error);
        setErrorMsg("Error al verificar autenticación");
        router.push("/login");
      }
    };
    checkAuth();
  }, [router]);

  // ──────────────── Cargar datos desde Firebase ────────────────
  useEffect(() => {
    if (userRole !== "MEDICO") return;

    const fojaRef = ref(db, "fojaqx");
    const unsubscribe = onValue(
      fojaRef,
      (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const lista = Object.entries(data).map(([id, value]) => ({
            id,
            ...value,
          }));
          // Ordenar por timestamp descendente (más reciente primero)
          lista.sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || ""));
          setRegistros(lista);
          setFilteredRegistros(lista);
        } else {
          setRegistros([]);
          setFilteredRegistros([]);
        }
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setErrorMsg("Error al cargar los registros.");
        setLoading(false);
      }
    );

    return () => off(fojaRef);
  }, [userRole]);

  // ──────────────── Filtros combinados (nombre, cirujano, anestesista) ────────────────
  useEffect(() => {
    let results = [...registros];

    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      results = results.filter((reg) =>
        reg.apelidoynombre?.toLowerCase().includes(term)
      );
    }

    if (filterCirujano) {
      results = results.filter((reg) => reg.cirujano === filterCirujano);
    }

    if (filterAnestesista) {
      results = results.filter((reg) => reg.anestesista === filterAnestesista);
    }

    setFilteredRegistros(results);
  }, [searchTerm, filterCirujano, filterAnestesista, registros]);

  // ──────────────── Obtener listas únicas para los selectores ────────────────
  const cirujanosUnicos = [...new Set(registros.map((r) => r.cirujano).filter(Boolean))];
  const anestesistasUnicos = [...new Set(registros.map((r) => r.anestesista).filter(Boolean))];

  // ──────────────── Abrir modal de edición ────────────────
  const handleEdit = (registro) => {
    setEditingRegistro(registro);
    setEditForm({ ...registro });
  };

  // ──────────────── Manejar cambios en el formulario de edición ────────────────
  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  // ──────────────── Guardar cambios en Firebase ────────────────
  const handleSaveEdit = async () => {
    if (!editingRegistro) return;
    setSaving(true);
    setErrorMsg("");

    try {
      const registroRef = ref(db, `fojaqx/${editingRegistro.id}`);
      // No se debe modificar el id ni el timestamp original (opcional mantener timestamp)
      const { id, timestamp, ...datosActualizados } = editForm;
      await update(registroRef, {
        ...datosActualizados,
        updatedAt: new Date().toISOString(),
      });
      setEditingRegistro(null);
      setEditForm({});
    } catch (err) {
      setErrorMsg("Error al actualizar: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const closeModal = () => {
    setEditingRegistro(null);
    setEditForm({});
  };

  if (loading) return <div style={styles.loading}>Cargando historias clínicas...</div>;
  if (errorMsg && !registros.length)
    return <div style={styles.error}>{errorMsg}</div>;

  return (
    <>
      <Header />
      <div style={styles.container}>
        <h1 style={styles.title}>Gestión de Fojas Quirúrgicas - Médicos</h1>

        {/* Barra de búsqueda y filtros */}
        <div style={styles.filters}>
          <input
            type="text"
            placeholder="Buscar por paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />

          <select
            value={filterCirujano}
            onChange={(e) => setFilterCirujano(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">Todos los cirujanos</option>
            {cirujanosUnicos.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filterAnestesista}
            onChange={(e) => setFilterAnestesista(e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">Todos los anestesistas</option>
            {anestesistasUnicos.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>

        {/* Listado de registros */}
        {filteredRegistros.length === 0 ? (
          <p style={styles.empty}>No se encontraron registros.</p>
        ) : (
          <div style={styles.grid}>
            {filteredRegistros.map((reg) => (
              <div key={reg.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <h3>{reg.apelidoynombre}</h3>
                  <span style={styles.date}>
                    {formatDate(reg.dia, reg.mes, reg.anio)}
                  </span>
                </div>
                <div style={styles.cardBody}>
                  <p><strong>Edad:</strong> {reg.edad} años</p>
                  <p><strong>Cirujano:</strong> {reg.cirujano}</p>
                  <p><strong>Anestesista:</strong> {reg.anestesista}</p>
                  <p><strong>Procedimiento:</strong> {reg.procedimientoqx}</p>
                  <p><strong>Preoperatorio:</strong> {reg.preoperatorio}</p>
                  <p><strong>Hallazgos:</strong> {reg.hallazgos || "Ninguno"}</p>
                </div>
                <div style={styles.cardActions}>
                  <button onClick={() => handleEdit(reg)} style={styles.btnEdit}>
                    Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editingRegistro && (
        <div style={styles.modalOverlay} onClick={closeModal}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Editar Foja Quirúrgica</h2>
            {errorMsg && <div style={styles.modalError}>{errorMsg}</div>}
            <form style={styles.editForm}>
              <label>Apellido y Nombre</label>
              <input name="apelidoynombre" value={editForm.apelidoynombre || ""} onChange={handleEditChange} />

              <label>Edad</label>
              <input name="edad" type="number" value={editForm.edad || ""} onChange={handleEditChange} />

              <label>Cirujano</label>
              <input name="cirujano" value={editForm.cirujano || ""} onChange={handleEditChange} />

              <label>1er Ayudante</label>
              <input name="primerayudante" value={editForm.primerayudante || ""} onChange={handleEditChange} />

              <label>2do Ayudante</label>
              <input name="segundoayudante" value={editForm.segundoayudante || ""} onChange={handleEditChange} />

              <label>Anestesista</label>
              <input name="anestesista" value={editForm.anestesista || ""} onChange={handleEditChange} />

              <div style={styles.modalRow}>
                <div>
                  <label>Día</label>
                  <input name="dia" value={editForm.dia || ""} onChange={handleEditChange} />
                </div>
                <div>
                  <label>Mes</label>
                  <input name="mes" value={editForm.mes || ""} onChange={handleEditChange} />
                </div>
                <div>
                  <label>Año</label>
                  <input name="anio" value={editForm.anio || ""} onChange={handleEditChange} />
                </div>
              </div>

              <div style={styles.modalRow}>
                <div>
                  <label>Hora inicio</label>
                  <input name="inichsinicio" type="time" value={editForm.inichsinicio || ""} onChange={handleEditChange} />
                </div>
                <div>
                  <label>Hora fin</label>
                  <input name="hsfin" type="time" value={editForm.hsfin || ""} onChange={handleEditChange} />
                </div>
              </div>

              <label>Diagnóstico Preoperatorio</label>
              <textarea name="preoperatorio" rows="2" value={editForm.preoperatorio || ""} onChange={handleEditChange} />

              <label>Diagnóstico Posoperatorio</label>
              <textarea name="posoperatorio" rows="2" value={editForm.posoperatorio || ""} onChange={handleEditChange} />

              <label>Procedimiento Quirúrgico</label>
              <textarea name="procedimientoqx" rows="3" value={editForm.procedimientoqx || ""} onChange={handleEditChange} />

              <label>Hallazgos</label>
              <textarea name="hallazgos" rows="2" value={editForm.hallazgos || ""} onChange={handleEditChange} />

              <div style={styles.modalActions}>
                <button type="button" onClick={closeModal} style={styles.btnCancel}>Cancelar</button>
                <button type="button" onClick={handleSaveEdit} style={styles.btnSave} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, onValue, off, update } from "firebase/database";
import { getSession, isAuthenticated } from "@/utils/session";
import styles from "./medicos.module.css";
import Header from "@/components/Header/Header";

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

  if (loading) return <div className={styles.loading}>Cargando historias clínicas...</div>;
  if (errorMsg && !registros.length)
    return <div className={styles.error}>{errorMsg}</div>;

  return (
    <>
      <Header />
      <div className={styles.container}>
        <h1 className={styles.title}>Gestión de Fojas Quirúrgicas - Médicos</h1>

        {/* Barra de búsqueda y filtros */}
        <div className={styles.filters}>
          <input
            type="text"
            placeholder="Buscar por paciente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />

          <select
            value={filterCirujano}
            onChange={(e) => setFilterCirujano(e.target.value)}
            className={styles.filterSelect}
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
            className={styles.filterSelect}
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
          <p className={styles.empty}>No se encontraron registros.</p>
        ) : (
          <div className={styles.grid}>
            {filteredRegistros.map((reg) => (
              <div key={reg.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h3>{reg.apelidoynombre}</h3>
                  <span className={styles.date}>
                    {formatDate(reg.dia, reg.mes, reg.anio)}
                  </span>
                </div>
                <div className={styles.cardBody}>
                  <p><strong>Edad:</strong> {reg.edad} años</p>
                  <p><strong>Cirujano:</strong> {reg.cirujano}</p>
                  <p><strong>Anestesista:</strong> {reg.anestesista}</p>
                  <p><strong>Procedimiento:</strong> {reg.procedimientoqx}</p>
                  <p><strong>Preoperatorio:</strong> {reg.preoperatorio}</p>
                  <p><strong>Hallazgos:</strong> {reg.hallazgos || "Ninguno"}</p>
                </div>
                <div className={styles.cardActions}>
                  <button onClick={() => handleEdit(reg)} className={styles.btnEdit}>
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
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>Editar Foja Quirúrgica</h2>
            {errorMsg && <div className={styles.modalError}>{errorMsg}</div>}
            <form className={styles.editForm}>
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

              <div className={styles.modalRow}>
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

              <div className={styles.modalRow}>
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

              <div className={styles.modalActions}>
                <button type="button" onClick={closeModal} className={styles.btnCancel}>Cancelar</button>
                <button type="button" onClick={handleSaveEdit} className={styles.btnSave} disabled={saving}>
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
'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../cx-common.module.css";   // ← importamos los estilos comunes

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

export default function SolicitudesCirugia() {
  const router = useRouter();
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [filtro, setFiltro] = useState("todas");
  const [showCirugiaModal, setShowCirugiaModal] = useState(false);
  const [selectedSolicitud, setSelectedSolicitud] = useState(null);
  const [cirugiaForm, setCirugiaForm] = useState({
    cirugia: "",
    medico: "",
    art: "",
    fechaEstimada: "",
  });
  const [saving, setSaving] = useState(false);

  const cargarSolicitudes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${FIREBASE_URL}/solicitudes-cirugia.json`);
      if (!res.ok) throw new Error("Error al cargar solicitudes");
      const data = await res.json();
      if (data) {
        const lista = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
          fechaSolicitud: value.fechaSolicitud || value.createdAt || Date.now(),
        }));
        lista.sort((a, b) => b.fechaSolicitud - a.fechaSolicitud);
        setSolicitudes(lista);
      } else {
        setSolicitudes([]);
      }
    } catch (err) {
      setError("No se pudieron cargar las solicitudes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarSolicitudes();
  }, []);

  const handleAbrirCirugia = (solicitud) => {
    setSelectedSolicitud(solicitud);
    setCirugiaForm({
      cirugia: "",
      medico: "",
      art: "",
      fechaEstimada: "",
    });
    setShowCirugiaModal(true);
  };

  const handleGuardarCirugia = async () => {
    if (!cirugiaForm.cirugia || !cirugiaForm.medico || !cirugiaForm.fechaEstimada) {
      alert("Por favor complete todos los campos requeridos: cirugía, médico y fecha estimativa");
      return;
    }

    setSaving(true);
    try {
      const solicitud = selectedSolicitud;
      const dataCirugia = {
        pacienteId: solicitud.pacienteId || null,
        pacienteDatos: {
          apellido: solicitud.apellido,
          nombre: solicitud.nombre,
          dni: solicitud.dni,
          fechaNacimiento: solicitud.nacimiento,
          edad: solicitud.edad,
          sexo: solicitud.sexo,
          localidad: solicitud.localidad,
          provincia: solicitud.provincia,
          domicilio: solicitud.domicilio,
          telefono: solicitud.telefono,
        },
        cirugia: cirugiaForm.cirugia,
        doctor: cirugiaForm.medico,
        fechaEstimada: cirugiaForm.fechaEstimada,
        formulario: {
          ...solicitud,
          cx: cirugiaForm.cirugia,
          "nombre-dr": cirugiaForm.medico,
          art: cirugiaForm.art,
        },
        ecgProfesional: "",
        ecgFecha: "",
        labProfesional: "",
        labFecha: "",
        realizada: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const res = await fetch(`${FIREBASE_URL}/cirugias.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataCirugia),
      });
      if (!res.ok) throw new Error("Error al guardar en cirugías");

      await fetch(`${FIREBASE_URL}/solicitudes-cirugia/${solicitud.id}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atendida: true, fechaAtendida: Date.now() }),
      });

      alert("Cirugía cargada correctamente y solicitud marcada como atendida.");
      setShowCirugiaModal(false);
      cargarSolicitudes();
    } catch (err) {
      console.error(err);
      alert("Error al procesar la cirugía");
    } finally {
      setSaving(false);
    }
  };

  const filtrarSolicitudes = () => {
    if (filtro === "pendientes") return solicitudes.filter(s => !s.atendida);
    if (filtro === "atendidas") return solicitudes.filter(s => s.atendida);
    return solicitudes;
  };

  const listaFiltrada = filtrarSolicitudes();

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <p>Cargando solicitudes...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.bannerError}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Barra de pestañas de navegación (idéntica a programadas) */}
      <div className={styles.pageHeader}>
        <div className={styles.tabsContainer}>
          <button
            className={styles.tabButton}
            onClick={() => router.push("/admin/cx")}
          >
            📋 Formulario
          </button>
          <button
            className={`${styles.tabButton} ${styles.activeTab}`}
          >
            📝 Solicitudes
          </button>
          <button
            className={styles.tabButton}
            onClick={() => router.push("/admin/cx/programada")}
          >
            📅 Programadas
          </button>
        </div>
      </div>

      <div className={styles.container}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Solicitudes de Cirugía</h1>
            <p className={styles.pageSubtitle}>Pacientes que solicitaron cirugía desde el formulario público</p>
          </div>
        </div>

        {/* Pestañas internas de filtro (Todas / Pendientes / Atendidas) */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${filtro === "todas" ? styles.tabActive : ""}`}
            onClick={() => setFiltro("todas")}
          >
            Todas
            <span className={styles.tabCount}>{solicitudes.length}</span>
          </button>
          <button
            className={`${styles.tab} ${filtro === "pendientes" ? styles.tabActive : ""}`}
            onClick={() => setFiltro("pendientes")}
          >
            Pendientes
            <span className={styles.tabCount}>{solicitudes.filter(s => !s.atendida).length}</span>
          </button>
          <button
            className={`${styles.tab} ${filtro === "atendidas" ? styles.tabActive : ""}`}
            onClick={() => setFiltro("atendidas")}
          >
            Atendidas
            <span className={styles.tabCount}>{solicitudes.filter(s => s.atendida).length}</span>
          </button>
        </div>

        {listaFiltrada.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>📋</span>
            <p>No hay solicitudes {filtro !== "todas" ? filtro : ""}</p>
          </div>
        ) : (
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Paciente</th>
                  <th>Teléfono</th>
                  <th>Fecha solicitud</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {listaFiltrada.map((s) => (
                  <tr key={s.id} className={s.atendida ? styles.rowAtendida : ""}>
                    <td className={styles.cellName}>
                      <strong>{s.apellido} {s.nombre}</strong>
                      <div className={styles.subText}>{s.dni}</div>
                    </td>
                    <td>{s.telefono}</td>
                    <td>{new Date(s.fechaSolicitud).toLocaleDateString("es-AR")}</td>
                    <td>
                      <span className={`${styles.estadoBadge} ${s.atendida ? styles.estadoAtendida : styles.estadoPendiente}`}>
                        {s.atendida ? "Atendida" : "Pendiente"}
                      </span>
                    </td>
                    <td className={styles.actionsCell}>
                      <button
                        className={styles.iconBtn}
                        title="Ver detalles"
                        onClick={() => setSelected(s)}
                      >
                        👁️
                      </button>
                      {!s.atendida && (
                        <>
                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnSuccess}`}
                            title="Cargar cirugía"
                            onClick={() => handleAbrirCirugia(s)}
                          >
                            ✍️
                          </button>
                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnWarning}`}
                            title="Marcar como atendida sin cirugía"
                            onClick={() => {
                              if (confirm("¿Marcar como atendida sin cargar cirugía? Esto solo cambiará el estado.")) {
                                fetch(`${FIREBASE_URL}/solicitudes-cirugia/${s.id}.json`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ atendida: true, fechaAtendida: Date.now() }),
                                }).then(() => cargarSolicitudes());
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

      {/* Modal de detalle (usa clases del CSS común) */}
      {selected && (
        <div className={styles.modalOverlay} onClick={() => setSelected(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Detalle de solicitud</h2>
              <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.detailRow}><strong>Paciente:</strong> {selected.apellido} {selected.nombre}</div>
              <div className={styles.detailRow}><strong>DNI / CUIL:</strong> {selected.dni}</div>
              <div className={styles.detailRow}><strong>Sexo:</strong> {selected.sexo === "M" ? "Masculino" : selected.sexo === "F" ? "Femenino" : "No especificado"}</div>
              <div className={styles.detailRow}><strong>Fecha de nacimiento:</strong> {selected.nacimiento}</div>
              <div className={styles.detailRow}><strong>Edad:</strong> {selected.edad} años</div>
              <div className={styles.detailRow}><strong>Lugar de nacimiento:</strong> {selected.lugarNacimiento}</div>
              <div className={styles.detailRow}><strong>Domicilio:</strong> {selected.domicilio}</div>
              <div className={styles.detailRow}><strong>Localidad:</strong> {selected.localidad}</div>
              <div className={styles.detailRow}><strong>Provincia:</strong> {selected.provincia}</div>
              <div className={styles.detailRow}><strong>Teléfono:</strong> {selected.telefono}</div>
              <div className={styles.detailRow}><strong>Fecha de solicitud:</strong> {new Date(selected.fechaSolicitud).toLocaleString("es-AR")}</div>
              {selected.atendida && (
                <div className={styles.detailRow}><strong>Fecha de atención:</strong> {new Date(selected.fechaAtendida).toLocaleString("es-AR")}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para cargar cirugía */}
      {showCirugiaModal && selectedSolicitud && (
        <div className={styles.modalOverlay} onClick={() => setShowCirugiaModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className={styles.modalHeader}>
              <h2>Cargar cirugía para {selectedSolicitud.apellido} {selectedSolicitud.nombre}</h2>
              <button className={styles.closeBtn} onClick={() => setShowCirugiaModal(false)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Cirugía a realizar *</label>
                <input
                  type="text"
                  className={styles.input}
                  value={cirugiaForm.cirugia}
                  onChange={(e) => setCirugiaForm({ ...cirugiaForm, cirugia: e.target.value })}
                  placeholder="Ej: Colecistectomía laparoscópica"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Médico cirujano *</label>
                <input
                  type="text"
                  className={styles.input}
                  value={cirugiaForm.medico}
                  onChange={(e) => setCirugiaForm({ ...cirugiaForm, medico: e.target.value })}
                  placeholder="Nombre del profesional"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>ART / Obra Social</label>
                <input
                  type="text"
                  className={styles.input}
                  value={cirugiaForm.art}
                  onChange={(e) => setCirugiaForm({ ...cirugiaForm, art: e.target.value })}
                  placeholder="Opcional"
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Fecha estimativa de cirugía *</label>
                <input
                  type="date"
                  className={styles.input}
                  value={cirugiaForm.fechaEstimada}
                  onChange={(e) => setCirugiaForm({ ...cirugiaForm, fechaEstimada: e.target.value })}
                />
              </div>
              <div className={styles.actionsModal}>
                <button className={styles.cancelBtn} onClick={() => setShowCirugiaModal(false)} disabled={saving}>
                  Cancelar
                </button>
                <button className={styles.saveBtn} onClick={handleGuardarCirugia} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cirugía"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
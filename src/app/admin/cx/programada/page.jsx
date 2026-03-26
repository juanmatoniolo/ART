"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

// Lista de médicos ordenada alfabéticamente
const DOCTORES = [
    "BRARDA AGUSTIN",
    "CANAGLIA GUSTAVO",
    "CIANCIOSI SEBASTIAN",
    "DEL PUERTO RODRIGO",
    "GIMENEZ MARTIN",
    "PERTUS DIEGO",
].sort();

export default function CirugiasProgramadasPage() {
    const [tab, setTab] = useState("programadas");
    const [cirugias, setCirugias] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filterFechaDesde, setFilterFechaDesde] = useState("");
    const [filterFechaHasta, setFilterFechaHasta] = useState("");
    const [filterDoctor, setFilterDoctor] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editando, setEditando] = useState(null);
    const [formEdit, setFormEdit] = useState({
        fechaEstimada: "",
        tipoCirugia: "",
        doctor: "",
        ecgProfesional: "",
        ecgFecha: "",
        labProfesional: "",
        labFecha: "",
    });

    const fetchCirugias = async () => {
        try {
            setLoading(true);
            const res = await fetch(
                "https://datos-clini-default-rtdb.firebaseio.com/cirugias.json"
            );
            if (!res.ok) throw new Error("Error al cargar cirugías");
            const data = await res.json();

            if (data) {
                const list = Object.entries(data).map(([id, value]) => ({
                    id,
                    ...value,
                }));
                setCirugias(list);
            } else {
                setCirugias([]);
            }
        } catch (err) {
            console.error(err);
            setError("No se pudieron cargar las cirugías.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCirugias();
    }, []);

    // === Acciones comunes ===
    const marcarRealizada = async (id, realizadaActual) => {
        if (realizadaActual) return;
        const confirmar = confirm("¿Marcar esta cirugía como realizada?");
        if (!confirmar) return;

        try {
            const res = await fetch(
                `https://datos-clini-default-rtdb.firebaseio.com/cirugias/${id}.json`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        realizada: true,
                        fechaRealizacion: new Date().toISOString(),
                    }),
                }
            );
            if (!res.ok) throw new Error("Error al actualizar");
            fetchCirugias();
        } catch (err) {
            console.error(err);
            alert("No se pudo marcar la cirugía como realizada.");
        }
    };

    const eliminarCirugia = async (id) => {
        const confirmar = confirm(
            "¿Eliminar permanentemente esta cirugía? Esta acción no se puede deshacer."
        );
        if (!confirmar) return;

        try {
            const res = await fetch(
                `https://datos-clini-default-rtdb.firebaseio.com/cirugias/${id}.json`,
                {
                    method: "DELETE",
                }
            );
            if (!res.ok) throw new Error("Error al eliminar");
            fetchCirugias();
        } catch (err) {
            console.error(err);
            alert("No se pudo eliminar la cirugía.");
        }
    };

    // === Edición (modal) ===
    const abrirModalEdicion = (cirugia) => {
        let doctorActual = cirugia.doctor || "";
        if (!doctorActual && cirugia.formulario) {
            const posibleDoctorKey = Object.keys(cirugia.formulario).find(
                (k) =>
                    k.toLowerCase().includes("doctor") ||
                    k.toLowerCase().includes("dr") ||
                    k.toLowerCase() === "nombre-dr"
            );
            doctorActual = posibleDoctorKey ? cirugia.formulario[posibleDoctorKey] : "";
        }

        const tipoCirugiaActual = cirugia.formulario?.cx || cirugia.tipoCirugia || "";

        setEditando({
            id: cirugia.id,
            fecha: cirugia.fechaEstimada || "",
            tipoCirugia: tipoCirugiaActual,
            doctor: doctorActual,
            ecgProf: cirugia.ecgProfesional || "",
            ecgFecha: cirugia.ecgFecha || "",
            labProf: cirugia.labProfesional || "",
            labFecha: cirugia.labFecha || "",
        });
        setFormEdit({
            fechaEstimada: cirugia.fechaEstimada || "",
            tipoCirugia: tipoCirugiaActual,
            doctor: doctorActual,
            ecgProfesional: cirugia.ecgProfesional || "",
            ecgFecha: cirugia.ecgFecha || "",
            labProfesional: cirugia.labProfesional || "",
            labFecha: cirugia.labFecha || "",
        });
        setModalOpen(true);
    };

    const guardarEdicion = async () => {
        if (!editando) return;

        const updates = {
            fechaEstimada: formEdit.fechaEstimada,
            doctor: formEdit.doctor,
            ecgProfesional: formEdit.ecgProfesional,
            ecgFecha: formEdit.ecgFecha,
            labProfesional: formEdit.labProfesional,
            labFecha: formEdit.labFecha,
        };

        const cirugiaActual = cirugias.find((c) => c.id === editando.id);
        const nuevoFormulario = { ...(cirugiaActual?.formulario || {}) };

        if (formEdit.tipoCirugia) {
            nuevoFormulario.cx = formEdit.tipoCirugia;
        } else {
            delete nuevoFormulario.cx;
        }

        let doctorKey = Object.keys(nuevoFormulario).find(
            (k) =>
                k.toLowerCase().includes("doctor") ||
                k.toLowerCase().includes("dr") ||
                k.toLowerCase() === "nombre-dr"
        );
        if (!doctorKey && formEdit.doctor) {
            doctorKey = "nombre-dr";
        }
        if (doctorKey) {
            nuevoFormulario[doctorKey] = formEdit.doctor;
        } else if (formEdit.doctor) {
            nuevoFormulario["nombre-dr"] = formEdit.doctor;
        }

        if (Object.keys(nuevoFormulario).length > 0) {
            updates.formulario = nuevoFormulario;
        }

        try {
            const res = await fetch(
                `https://datos-clini-default-rtdb.firebaseio.com/cirugias/${editando.id}.json`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(updates),
                }
            );
            if (!res.ok) throw new Error("Error al guardar cambios");
            setModalOpen(false);
            fetchCirugias();
        } catch (err) {
            console.error(err);
            alert("No se pudieron guardar los cambios.");
        }
    };

    // === Helper: obtener médico normalizado ===
    const getDoctor = (cx) => {
        if (cx.doctor) return cx.doctor;
        if (cx.formulario) {
            const doctorKey = Object.keys(cx.formulario).find(
                (k) =>
                    k.toLowerCase().includes("doctor") ||
                    k.toLowerCase().includes("dr") ||
                    k === "nombre-dr"
            );
            return doctorKey ? cx.formulario[doctorKey] : "";
        }
        return "";
    };

    // === Filtros y orden para Programadas (solo pendientes) ===
    const cirugiasPendientes = () => {
        let filtered = cirugias.filter((cx) => !cx.realizada);
        // Filtro por rango de fechas
        filtered = filtered.filter((cx) => {
            if (!cx.fechaEstimada) return false;
            const fecha = new Date(cx.fechaEstimada);
            if (filterFechaDesde && fecha < new Date(filterFechaDesde)) return false;
            if (filterFechaHasta && fecha > new Date(filterFechaHasta)) return false;
            return true;
        });
        // Filtro por médico
        if (filterDoctor) {
            filtered = filtered.filter((cx) => getDoctor(cx) === filterDoctor);
        }
        // Ordenar por fecha estimada ascendente (más próximas primero)
        filtered.sort(
            (a, b) => new Date(a.fechaEstimada) - new Date(b.fechaEstimada)
        );
        return filtered;
    };

    // === Historial (solo realizadas) ===
    const cirugiasRealizadas = () => {
        let filtered = cirugias.filter((cx) => cx.realizada);
        if (filterFechaDesde) {
            filtered = filtered.filter((cx) => {
                const fecha = new Date(cx.fechaRealizacion);
                return fecha >= new Date(filterFechaDesde);
            });
        }
        if (filterFechaHasta) {
            filtered = filtered.filter((cx) => {
                const fecha = new Date(cx.fechaRealizacion);
                return fecha <= new Date(filterFechaHasta);
            });
        }
        if (filterDoctor) {
            filtered = filtered.filter((cx) => getDoctor(cx) === filterDoctor);
        }
        // Ordenar por fecha realización descendente (más reciente primero)
        filtered.sort(
            (a, b) =>
                new Date(b.fechaRealizacion) - new Date(a.fechaRealizacion)
        );
        return filtered;
    };

    const esProxima = (fechaEstimada) => {
        if (!fechaEstimada) return false;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const fecha = new Date(fechaEstimada);
        fecha.setHours(0, 0, 0, 0);
        const diffDays = (fecha - hoy) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 3;
    };

    if (loading) {
        return (
            <main className={styles.page}>
                <div className={styles.loadingState}>
                    <div className={styles.loadingSpinner} />
                    <p>Cargando cirugías...</p>
                </div>
            </main>
        );
    }

    return (
        <div className={styles.page}>
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Gestión de Cirugías</h1>
                    <p className={styles.subtitle}>Programación, seguimiento e historial</p>
                </div>

                {/* Tabs */}
                <div className={styles.tabs}>
                    <button
                        className={`${styles.tab} ${tab === "programadas" ? styles.active : ""}`}
                        onClick={() => setTab("programadas")}
                    >
                        📅 Programadas
                    </button>
                    <button
                        className={`${styles.tab} ${tab === "historial" ? styles.active : ""}`}
                        onClick={() => setTab("historial")}
                    >
                        📋 Historial
                    </button>
                </div>

                {/* ========== TAB PROGRAMADAS ========== */}
                {tab === "programadas" && (
                    <>
                        {/* Filtros */}
                        <div className={styles.filterContainer}>
                            <div className={styles.filterGroup}>
                                <label>Desde:</label>
                                <input
                                    type="date"
                                    value={filterFechaDesde}
                                    onChange={(e) => setFilterFechaDesde(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Hasta:</label>
                                <input
                                    type="date"
                                    value={filterFechaHasta}
                                    onChange={(e) => setFilterFechaHasta(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Médico:</label>
                                <select
                                    value={filterDoctor}
                                    onChange={(e) => setFilterDoctor(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    {DOCTORES.map((dr) => (
                                        <option key={dr} value={dr}>
                                            {dr}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                className={styles.clearFilterBtn}
                                onClick={() => {
                                    setFilterFechaDesde("");
                                    setFilterFechaHasta("");
                                    setFilterDoctor("");
                                }}
                            >
                                Limpiar filtros
                            </button>
                        </div>

                        {/* Tabla de pendientes */}
                        {cirugiasPendientes().length === 0 ? (
                            <div className={styles.empty}>No hay cirugías programadas.</div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Paciente</th>
                                            <th>Cirugía</th>
                                            <th>Médico</th>
                                            <th>Fecha estimada</th>
                                            <th>ECG</th>
                                            <th>Lab</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cirugiasPendientes().map((cx) => (
                                            <tr
                                                key={cx.id}
                                                className={esProxima(cx.fechaEstimada) ? styles.rowProxima : ""}
                                            >
                                                <td>
                                                    <strong>
                                                        {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
                                                    </strong>
                                                    {cx.pacienteDatos?.dni && (
                                                        <div className={styles.dni}>{cx.pacienteDatos.dni}</div>
                                                    )}
                                                </td>
                                                <td>{cx.formulario?.cx || "—"}</td>
                                                <td>{getDoctor(cx) || "—"}</td>
                                                <td>
                                                    {cx.fechaEstimada
                                                        ? new Date(cx.fechaEstimada).toLocaleDateString()
                                                        : "—"}
                                                </td>
                                                <td>
                                                    {cx.ecgProfesional && <div>{cx.ecgProfesional}</div>}
                                                    {cx.ecgFecha && (
                                                        <div className={styles.fechaHora}>
                                                            {new Date(cx.ecgFecha).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {cx.labProfesional && <div>{cx.labProfesional}</div>}
                                                    {cx.labFecha && (
                                                        <div className={styles.fechaHora}>
                                                            {new Date(cx.labFecha).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={styles.badgePendiente}>Pendiente</span>
                                                </td>
                                                <td>
                                                    <div className={styles.actions}>
                                                        <button
                                                            className={styles.realizarBtn}
                                                            onClick={() => marcarRealizada(cx.id, cx.realizada)}
                                                        >
                                                            Realizar
                                                        </button>
                                                        <button
                                                            className={styles.editarBtn}
                                                            onClick={() => abrirModalEdicion(cx)}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            className={styles.eliminarBtn}
                                                            onClick={() => eliminarCirugia(cx.id)}
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* ========== TAB HISTORIAL ========== */}
                {tab === "historial" && (
                    <>
                        <div className={styles.filterContainer}>
                            <div className={styles.filterGroup}>
                                <label>Desde:</label>
                                <input
                                    type="date"
                                    value={filterFechaDesde}
                                    onChange={(e) => setFilterFechaDesde(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Hasta:</label>
                                <input
                                    type="date"
                                    value={filterFechaHasta}
                                    onChange={(e) => setFilterFechaHasta(e.target.value)}
                                />
                            </div>
                            <div className={styles.filterGroup}>
                                <label>Médico:</label>
                                <select
                                    value={filterDoctor}
                                    onChange={(e) => setFilterDoctor(e.target.value)}
                                >
                                    <option value="">Todos</option>
                                    {DOCTORES.map((dr) => (
                                        <option key={dr} value={dr}>
                                            {dr}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button
                                className={styles.clearFilterBtn}
                                onClick={() => {
                                    setFilterFechaDesde("");
                                    setFilterFechaHasta("");
                                    setFilterDoctor("");
                                }}
                            >
                                Limpiar filtros
                            </button>
                        </div>

                        {cirugiasRealizadas().length === 0 ? (
                            <div className={styles.empty}>No hay cirugías realizadas.</div>
                        ) : (
                            <div className={styles.tableWrapper}>
                                <table className={styles.table}>
                                    <thead>
                                        <tr>
                                            <th>Paciente</th>
                                            <th>Cirugía</th>
                                            <th>Médico</th>
                                            <th>Fecha realizada</th>
                                            <th>ECG</th>
                                            <th>Lab</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {cirugiasRealizadas().map((cx) => (
                                            <tr key={cx.id} className={styles.rowRealizada}>
                                                <td>
                                                    <strong>
                                                        {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
                                                    </strong>
                                                    {cx.pacienteDatos?.dni && (
                                                        <div className={styles.dni}>{cx.pacienteDatos.dni}</div>
                                                    )}
                                                </td>
                                                <td>{cx.formulario?.cx || "—"}</td>
                                                <td>{getDoctor(cx) || "—"}</td>
                                                <td>
                                                    {cx.fechaRealizacion
                                                        ? new Date(cx.fechaRealizacion).toLocaleString()
                                                        : "—"}
                                                </td>
                                                <td>
                                                    {cx.ecgProfesional && <div>{cx.ecgProfesional}</div>}
                                                    {cx.ecgFecha && (
                                                        <div className={styles.fechaHora}>
                                                            {new Date(cx.ecgFecha).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    {cx.labProfesional && <div>{cx.labProfesional}</div>}
                                                    {cx.labFecha && (
                                                        <div className={styles.fechaHora}>
                                                            {new Date(cx.labFecha).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td>
                                                    <div className={styles.actions}>
                                                        <button
                                                            className={styles.editarBtn}
                                                            onClick={() => abrirModalEdicion(cx)}
                                                        >
                                                            Editar
                                                        </button>
                                                        <button
                                                            className={styles.eliminarBtn}
                                                            onClick={() => eliminarCirugia(cx.id)}
                                                        >
                                                            Eliminar
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {/* Modal de edición (común) */}
                {modalOpen && (
                    <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
                        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                            <h2>Editar cirugía</h2>
                            <div className={styles.modalForm}>
                                <label>
                                    Fecha estimada:
                                    <input
                                        type="date"
                                        value={formEdit.fechaEstimada}
                                        onChange={(e) =>
                                            setFormEdit({ ...formEdit, fechaEstimada: e.target.value })
                                        }
                                    />
                                </label>
                                <label>
                                    Tipo de cirugía:
                                    <input
                                        type="text"
                                        value={formEdit.tipoCirugia}
                                        onChange={(e) =>
                                            setFormEdit({ ...formEdit, tipoCirugia: e.target.value })
                                        }
                                        placeholder="Ej: Colecistectomía"
                                    />
                                </label>
                                <label>
                                    Médico:
                                    <select
                                        value={formEdit.doctor}
                                        onChange={(e) => setFormEdit({ ...formEdit, doctor: e.target.value })}
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        {DOCTORES.map((dr) => (
                                            <option key={dr} value={dr}>
                                                {dr}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label>
                                    Profesional ECG:
                                    <select
                                        value={formEdit.ecgProfesional}
                                        onChange={(e) =>
                                            setFormEdit({ ...formEdit, ecgProfesional: e.target.value })
                                        }
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        <option value="Percara Gonzalo">Percara Gonzalo</option>
                                        <option value="Capovila Braulio">Capovila Braulio</option>
                                    </select>
                                </label>
                                <label>
                                    Fecha ECG:
                                    <input
                                        type="date"
                                        value={formEdit.ecgFecha}
                                        onChange={(e) =>
                                            setFormEdit({ ...formEdit, ecgFecha: e.target.value })
                                        }
                                    />
                                </label>
                                <label>
                                    Profesional Laboratorio:
                                    <select
                                        value={formEdit.labProfesional}
                                        onChange={(e) =>
                                            setFormEdit({ ...formEdit, labProfesional: e.target.value })
                                        }
                                    >
                                        <option value="">-- Seleccionar --</option>
                                        <option value="Marmol Carlos">Marmol Carlos</option>
                                        <option value="Confalonieri Maria">Confalonieri Maria</option>
                                    </select>
                                </label>
                                <label>
                                    Fecha Laboratorio:
                                    <input
                                        type="date"
                                        value={formEdit.labFecha}
                                        onChange={(e) =>
                                            setFormEdit({ ...formEdit, labFecha: e.target.value })
                                        }
                                    />
                                </label>
                            </div>
                            <div className={styles.modalButtons}>
                                <button onClick={guardarEdicion} className={styles.guardarBtn}>
                                    Guardar
                                </button>
                                <button onClick={() => setModalOpen(false)} className={styles.cancelarBtn}>
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
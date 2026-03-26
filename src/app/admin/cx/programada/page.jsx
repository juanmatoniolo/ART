"use client";

import { useEffect, useState } from "react";
import * as XLSX from "xlsx";
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

    // Admin: carga masiva
    const [archivoPreview, setArchivoPreview] = useState([]);
    const [archivo, setArchivo] = useState(null);
    const [mensaje, setMensaje] = useState("");

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

    // === Estadísticas por médico (solo para Programadas) ===
    const doctorStatsPendientes = () => {
        const stats = {};
        cirugiasPendientes().forEach((cx) => {
            const dr = getDoctor(cx);
            if (dr) {
                stats[dr] = (stats[dr] || 0) + 1;
            }
        });
        return Object.entries(stats)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([nombre, cantidad]) => ({ nombre, cantidad }));
    };

    // === Exportar a Excel (toda la lista) ===
    const exportarExcel = async (scope) => {
        try {
            setMensaje("📥 Generando Excel...");
            const wb = XLSX.utils.book_new();

            const filas = [
                [
                    "ID",
                    "Paciente",
                    "DNI",
                    "Cirugía",
                    "Médico",
                    "Fecha estimada",
                    "Realizada",
                    "Fecha realización",
                    "ECG Profesional",
                    "Fecha ECG",
                    "Lab Profesional",
                    "Fecha Lab",
                ],
            ];

            cirugias.forEach((cx) => {
                filas.push([
                    cx.id,
                    `${cx.pacienteDatos?.apellido || ""} ${cx.pacienteDatos?.nombre || ""}`.trim(),
                    cx.pacienteDatos?.dni || "",
                    cx.formulario?.cx || "",
                    getDoctor(cx),
                    cx.fechaEstimada ? new Date(cx.fechaEstimada).toLocaleDateString() : "",
                    cx.realizada ? "Sí" : "No",
                    cx.fechaRealizacion ? new Date(cx.fechaRealizacion).toLocaleString() : "",
                    cx.ecgProfesional || "",
                    cx.ecgFecha ? new Date(cx.ecgFecha).toLocaleDateString() : "",
                    cx.labProfesional || "",
                    cx.labFecha ? new Date(cx.labFecha).toLocaleDateString() : "",
                ]);
            });

            const ws = XLSX.utils.aoa_to_sheet(filas);
            ws["!cols"] = [
                { wch: 20 },
                { wch: 30 },
                { wch: 15 },
                { wch: 30 },
                { wch: 25 },
                { wch: 15 },
                { wch: 10 },
                { wch: 20 },
                { wch: 20 },
                { wch: 15 },
                { wch: 20 },
                { wch: 15 },
            ];
            XLSX.utils.book_append_sheet(wb, ws, "Cirugías");
            const fecha = new Date().toISOString().slice(0, 10);
            XLSX.writeFile(wb, `cirugias_${fecha}.xlsx`);
            setMensaje("✅ Excel exportado correctamente.");
            setTimeout(() => setMensaje(""), 3000);
        } catch (err) {
            console.error(err);
            setMensaje("❌ Error al exportar Excel.");
            setTimeout(() => setMensaje(""), 3500);
        }
    };

    // === Importar desde Excel ===
    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setArchivo(file);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

            if (!data || data.length < 2) {
                setMensaje("⚠️ El archivo no contiene datos.");
                return;
            }

            const headers = data[0].map((h) => String(h).trim().toLowerCase());
            const idxPaciente = headers.findIndex(
                (h) => h.includes("paciente") || h === "nombre completo"
            );
            const idxDni = headers.findIndex((h) => h === "dni");
            const idxCirugia = headers.findIndex((h) => h.includes("cirugía") || h === "cirugia");
            const idxMedico = headers.findIndex((h) => h.includes("médico") || h === "medico");
            const idxFecha = headers.findIndex((h) => h.includes("fecha estimada") || h === "fecha");
            const idxEcgProf = headers.findIndex((h) => h.includes("ecg profesional") || h === "ecg");
            const idxEcgFecha = headers.findIndex((h) => h.includes("fecha ecg"));
            const idxLabProf = headers.findIndex((h) => h.includes("lab profesional") || h === "laboratorio");
            const idxLabFecha = headers.findIndex((h) => h.includes("fecha lab"));

            const rows = [];
            for (let i = 1; i < data.length; i++) {
                const row = data[i];
                if (!row[idxPaciente] && !row[idxDni]) continue;

                const nombreCompleto = row[idxPaciente] || "";
                const partes = nombreCompleto.split(" ");
                const apellido = partes.slice(0, -1).join(" ") || "";
                const nombre = partes.slice(-1).join(" ") || "";

                rows.push({
                    pacienteDatos: {
                        apellido,
                        nombre,
                        dni: row[idxDni] ? String(row[idxDni]) : "",
                    },
                    formulario: {
                        cx: row[idxCirugia] || "",
                    },
                    doctor: row[idxMedico] || "",
                    fechaEstimada: row[idxFecha]
                        ? new Date(row[idxFecha]).toISOString().split("T")[0]
                        : "",
                    ecgProfesional: row[idxEcgProf] || "",
                    ecgFecha: row[idxEcgFecha]
                        ? new Date(row[idxEcgFecha]).toISOString().split("T")[0]
                        : "",
                    labProfesional: row[idxLabProf] || "",
                    labFecha: row[idxLabFecha]
                        ? new Date(row[idxLabFecha]).toISOString().split("T")[0]
                        : "",
                });
            }

            if (rows.length === 0) {
                setMensaje("⚠️ No se encontraron datos válidos en el archivo.");
                return;
            }

            setArchivoPreview(rows);
            setMensaje(`✅ Se cargaron ${rows.length} registros para previsualizar.`);
        };
        reader.readAsBinaryString(file);
    };

    const confirmarCargaExcel = async () => {
        if (!archivoPreview.length) {
            setMensaje("⚠️ No hay datos para cargar.");
            return;
        }

        try {
            const updates = {};
            for (const item of archivoPreview) {
                const id = Date.now() + "_" + Math.random().toString(36).substr(2, 8);
                updates[`cirugias/${id}`] = {
                    ...item,
                    realizada: false,
                    fechaCreacion: new Date().toISOString(),
                };
            }

            await fetch("https://datos-clini-default-rtdb.firebaseio.com/cirugias.json", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(updates),
            });

            setArchivoPreview([]);
            setArchivo(null);
            setMensaje("✅ Datos cargados exitosamente.");
            fetchCirugias();
            setTimeout(() => setMensaje(""), 3000);
        } catch (err) {
            console.error(err);
            setMensaje("❌ Error al cargar los datos.");
            setTimeout(() => setMensaje(""), 3000);
        }
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

                {mensaje && (
                    <div
                        className={`${styles.toast} ${mensaje.includes("✅") ? styles.toastSuccess : styles.toastInfo
                            }`}
                    >
                        {mensaje}
                    </div>
                )}

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
                    <button
                        className={`${styles.tab} ${tab === "admin" ? styles.active : ""}`}
                        onClick={() => setTab("admin")}
                    >
                        ⚙️ Administración
                    </button>
                </div>

                {/* ========== TAB PROGRAMADAS ========== */}
                {tab === "programadas" && (
                    <>
                        {/* Estadísticas rápidas por médico */}
                        {doctorStatsPendientes().length > 0 && (
                            <div className={styles.statsSection}>
                                <h3 className={styles.statsTitle}>Pendientes por médico</h3>
                                <div className={styles.statsGrid}>
                                    {doctorStatsPendientes().map((stat) => (
                                        <div key={stat.nombre} className={styles.statCard}>
                                            <div className={styles.statName}>{stat.nombre}</div>
                                            <div className={styles.statCounts}>
                                                <span>Pendientes: {stat.cantidad}</span>
                                            </div>
                                            <button
                                                className={styles.filterDoctorBtn}
                                                onClick={() => setFilterDoctor(stat.nombre)}
                                            >
                                                Filtrar
                                            </button>
                                        </div>
                                    ))}
                                    {filterDoctor && (
                                        <button
                                            className={styles.clearDoctorFilterBtn}
                                            onClick={() => setFilterDoctor("")}
                                        >
                                            Limpiar filtro médico
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

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

                {/* ========== TAB ADMINISTRACIÓN ========== */}
                {tab === "admin" && (
                    <div className={styles.adminSection}>
                        <div className={styles.adminActions}>
                            <button className={styles.btnPrimary} onClick={() => exportarExcel()}>
                                📥 Exportar lista completa (Excel)
                            </button>
                            <div className={styles.importArea}>
                                <input
                                    id="excelCirugias"
                                    type="file"
                                    accept=".xlsx, .xls"
                                    className={styles.fileInput}
                                    onChange={handleExcelUpload}
                                />
                                <label htmlFor="excelCirugias" className={styles.fileInputLabel}>
                                    📤 Seleccionar archivo Excel para importar
                                </label>
                                {archivo && <span className={styles.fileName}>{archivo.name}</span>}
                            </div>
                        </div>

                        {archivoPreview.length > 0 && (
                            <div className={styles.previewSection}>
                                <h4>Previsualización ({archivoPreview.length} registros)</h4>
                                <div className={styles.tableWrapper}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>Paciente</th>
                                                <th>DNI</th>
                                                <th>Cirugía</th>
                                                <th>Médico</th>
                                                <th>Fecha estimada</th>
                                                <th>ECG Prof.</th>
                                                <th>Fecha ECG</th>
                                                <th>Lab Prof.</th>
                                                <th>Fecha Lab</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {archivoPreview.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>
                                                        {item.pacienteDatos?.apellido} {item.pacienteDatos?.nombre}
                                                    </td>
                                                    <td>{item.pacienteDatos?.dni}</td>
                                                    <td>{item.formulario?.cx}</td>
                                                    <td>{item.doctor}</td>
                                                    <td>{item.fechaEstimada}</td>
                                                    <td>{item.ecgProfesional}</td>
                                                    <td>{item.ecgFecha}</td>
                                                    <td>{item.labProfesional}</td>
                                                    <td>{item.labFecha}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button className={styles.btnSaveChanges} onClick={confirmarCargaExcel}>
                                    ✅ Confirmar carga a Firebase
                                </button>
                            </div>
                        )}
                    </div>
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
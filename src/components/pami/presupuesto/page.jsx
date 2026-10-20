"use client";
import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import { listarBorradoresGlobales, eliminarPresupuestoPami } from "@/lib/pami/presupuestos";
import PresupuestoTab from "@/components/pami/presupuesto/PresupuestoTab";
import BorradoresList from "@/components/pami/presupuesto/BorradoresList";
import EstadisticasPanel from "@/components/pami/presupuesto/EstadisticasPanel";
import styles from "@/app/pami/presupuesto.module.css"; // ← el insumosAdmin.module.css renombrado

const p = styles;

export default function PresupuestoPamiPage() {
    const [solapa, setSolapa] = useState("presupuesto");
    const [items, setItems] = useState([]);
    const [pacientesDb, setPacientesDb] = useState([]);
    const [busquedaPaciente, setBusquedaPaciente] = useState("");
    const [busquedaBorrador, setBusquedaBorrador] = useState("");
    const [filtroVinculo, setFiltroVinculo] = useState("todos");

    /* Listeners */
    useEffect(() => {
        return onValue(ref(db, "medydescartables"), (snap) => {
            if (!snap.exists()) return setItems([]);
            const data = snap.val();
            const lista = [];
            for (const categoria of ["medicamentos", "descartables"]) {
                Object.entries(data[categoria] || {}).forEach(([key, d]) => {
                    lista.push({
                        key,
                        categoria,
                        nombre: d.nombre || key.replace(/_/g, " "),
                        precioFacturacion: d.precioFacturacion ?? 0,
                        presentacion: d.presentacion || "unidad",
                        tipo: categoria === "medicamentos" ? "medicamento" : "descartable",
                        activo: d.activo !== false,
                    });
                });
            }
            setItems(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        });
    }, []);

    useEffect(() => {
        return onValue(ref(db, "PAMI/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientesDb(Object.entries(data).map(([dni, paciente]) => ({ dni, ...paciente })));
        });
    }, []);

    /* Filtros */
    const pacientesFiltrados = useMemo(() => {
        const q = busquedaPaciente.trim();
        if (!q) return pacientesDb;
        return pacientesDb.filter((x) =>
            matchesAllTerms(`${x.dni || ""} ${x.afiliado || ""} ${x.apellido || ""} ${x.nombre || ""}`, q)
        );
    }, [pacientesDb, busquedaPaciente]);

    const borradoresTodos = useMemo(() => listarBorradoresGlobales(pacientesDb), [pacientesDb]);
    const borradoresFiltrados = useMemo(() => {
        const q = busquedaBorrador.trim();
        let lista = borradoresTodos;
        if (q) lista = lista.filter((b) => matchesAllTerms(`${b.pacienteNombre} ${b.pacienteDni} ${b.pacienteAfiliado}`, q));
        if (filtroVinculo === "conOP") lista = lista.filter((b) => b.opId);
        if (filtroVinculo === "conInternacion") lista = lista.filter((b) => b.internacionId);
        if (filtroVinculo === "conCirugia") lista = lista.filter((b) => b.cirugiaId);
        if (filtroVinculo === "huerfanos") lista = lista.filter((b) => !b.opId && !b.internacionId && !b.cirugiaId);
        return lista;
    }, [borradoresTodos, busquedaBorrador, filtroVinculo]);

    const abrirBorradorGlobal = async (b) => {
        // pasa al tab "presupuesto" y deja al paciente cargado; el PresupuestoTab
        // detecta el draft y lo muestra
        setSolapa("presupuesto");
        // TODO: pasar el draft al PresupuestoTab via context / store global
        // Por simplicidad, por ahora solo navegamos:
        // (en la próxima iteración podemos usar un context o un ref global)
    };

    const eliminarBorradorGlobal = async (b) => {
        if (!confirm(`¿Eliminar el borrador de ${b.pacienteNombre || b.pacienteDni}?`)) return;
        await eliminarPresupuestoPami(b.pacienteDni, b.id);
    };

    return (
        <div className={`${styles.wrapper} ${styles.dark}`}>
            <div className={styles.headerBar}>
                <h2 className={styles.title}>Presupuesto PAMI</h2>
                <span className={p.headerHint}>Gestión de medicación y descartables</span>
            </div>

            <nav className={p.tabs} aria-label="Secciones PAMI" role="tablist">
                {[
                    ["presupuesto", "Presupuesto", "Crear y consultar presupuestos"],
                    ["pacientes", "Pacientes", "Buscar pacientes registrados"],
                    ["borradores", "Borradores", "Todos los borradores"],
                    ["estadisticas", "Estadísticas", "Consultar indicadores"],
                ].map(([id, label, desc]) => (
                    <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={solapa === id}
                        className={`${p.tab} ${solapa === id ? p.tabActive : ""}`}
                        onClick={() => setSolapa(id)}
                    >
                        <span>{label}</span><small>{desc}</small>
                    </button>
                ))}
            </nav>

            {solapa === "presupuesto" && (
                <PresupuestoTab items={items} pacientesDb={pacientesDb} onRefresh={() => { }} />
            )}

            {solapa === "pacientes" && (
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Pacientes registrados</h3>
                    <input
                        className={p.input}
                        type="search"
                        placeholder="Buscar por DNI, afiliado, apellido o nombre…"
                        value={busquedaPaciente}
                        onChange={(e) => setBusquedaPaciente(e.target.value)}
                    />
                    <p className={p.hint}>{pacientesFiltrados.length} pacientes encontrados.</p>
                    <ul className={p.list}>
                        {pacientesFiltrados.slice(0, 200).map((x) => (
                            <li className={p.row} key={x.dni}>
                                <div>
                                    <div className={p.rowName}>{x.apellido || ""}, {x.nombre || ""}</div>
                                    <div className={p.rowMeta}>
                                        DNI {x.dni} · Afiliado {x.afiliado || "—"} ·{" "}
                                        {Object.keys(x.medicamentos || {}).length} borrador(es)
                                    </div>
                                </div>
                                <div className={p.rowActions}>
                                    <button
                                        type="button"
                                        className={`${p.btn} ${p.btnSm}`}
                                        onClick={() => { setSolapa("presupuesto"); setBusquedaPaciente(""); }}
                                    >
                                        Cargar
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {solapa === "borradores" && (
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Todos los borradores</h3>
                    <p className={p.hint}>
                        Un paciente puede tener varios borradores. Podés filtrar por vínculo con OP,
                        internación o cirugía.
                    </p>
                    <div className={p.grid2}>
                        <input
                            className={p.input}
                            type="search"
                            placeholder="Buscar por paciente, DNI o afiliado…"
                            value={busquedaBorrador}
                            onChange={(e) => setBusquedaBorrador(e.target.value)}
                        />
                        <select
                            className={p.input}
                            value={filtroVinculo}
                            onChange={(e) => setFiltroVinculo(e.target.value)}
                        >
                            <option value="todos">Todos</option>
                            <option value="conOP">Con OP vinculada</option>
                            <option value="conInternacion">Con internación</option>
                            <option value="conCirugia">Con cirugía</option>
                            <option value="huerfanos">Sin vínculo (huérfanos)</option>
                        </select>
                    </div>
                    <p className={p.hint}>{borradoresFiltrados.length} borradores.</p>
                    <BorradoresList
                        borradores={borradoresFiltrados}
                        onAbrir={abrirBorradorGlobal}
                        onEliminar={eliminarBorradorGlobal}
                        showPaciente
                        emptyText={busquedaBorrador || filtroVinculo !== "todos" ? "No hay borradores que coincidan." : undefined}
                    />
                </section>
            )}

            {solapa === "estadisticas" && <EstadisticasPanel pacientesDb={pacientesDb} />}
        </div>
    );
}
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation"; // <--- IMPORTAMOS EL ROUTER
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import { obtenerPacientePami } from "@/lib/pami";
import { listarBorradoresGlobales, eliminarPresupuestoPami } from "@/lib/pami/presupuestos";
import PresupuestoTab from "@/components/pami/presupuesto/PresupuestoTab";
import BorradoresList from "@/components/pami/presupuesto/BorradoresList";
import EstadisticasPanel from "@/components/pami/presupuesto/EstadisticasPanel";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

const p = styles;

export default function PresupuestoPamiPage() {
    const router = useRouter(); // <--- INICIALIZAMOS EL ROUTER

    const [solapa, setSolapa] = useState("presupuesto");
    const [items, setItems] = useState([]);
    const [pacientesDb, setPacientesDb] = useState([]);
    const [busquedaBorrador, setBusquedaBorrador] = useState("");
    const [filtroVinculo, setFiltroVinculo] = useState("todos");
    const [pendingOpen, setPendingOpen] = useState(null);
    const [resetKey, setResetKey] = useState(0);
    const [flash, setFlash] = useState("");

    const mostrarFlash = (m, ms = 3200) => { setFlash(m); setTimeout(() => setFlash(""), ms); };

    useEffect(() => {
        const unsubMed = onValue(ref(db, "medydescartables"), (snap) => {
            if (!snap.exists()) return setItems([]);
            const data = snap.val();
            const lista = [];
            for (const categoria of ["medicamentos", "descartables"]) {
                Object.entries(data[categoria] || {}).forEach(([key, d]) => {
                    lista.push({ key, categoria, nombre: d.nombre || key.replace(/_/g, " "), precioFacturacion: d.precioFacturacion ?? 0, presentacion: d.presentacion || "unidad", tipo: categoria === "medicamentos" ? "medicamento" : "descartable", activo: d.activo !== false });
                });
            }
            setItems(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        });

        const unsubPac = onValue(ref(db, "PAMI/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientesDb(Object.entries(data).map(([dni, paciente]) => ({ dni, ...paciente })));
        });

        return () => { unsubMed(); unsubPac(); };
    }, []);

    const borradoresTodos = useMemo(() => listarBorradoresGlobales(pacientesDb), [pacientesDb]);
    const borradoresFiltrados = useMemo(() => {
        let lista = borradoresTodos;
        const q = busquedaBorrador.trim();
        if (q) lista = lista.filter((b) => matchesAllTerms(`${b.pacienteNombre} ${b.pacienteDni} ${b.pacienteAfiliado}`, q));
        if (filtroVinculo === "huerfanos") lista = lista.filter((b) => !b.opId && !b.internacionId && !b.cirugiaId);
        return lista;
    }, [borradoresTodos, busquedaBorrador, filtroVinculo]);

    const abrirBorradorGlobal = async (b) => {
        try {
            const data = await obtenerPacientePami(b.pacienteDni);
            if (!data) return mostrarFlash("No se encontró el paciente.");
            const { medicamentos = {}, ...datos } = data;

            // Inyectamos el ID de la base de datos al borrador
            const borradorConId = { ...b.raw, id: b.id };

            setPendingOpen({
                paciente: { dni: b.pacienteDni, ...datos },
                borrador: borradorConId
            });
            setSolapa("presupuesto");
        } catch (e) { mostrarFlash("Error al abrir borrador."); }
    };

    const iniciarNuevo = () => {
        setPendingOpen(null);
        setResetKey(prev => prev + 1);
        setSolapa("presupuesto");
    };

    return (
        <div className={`${p.wrapper} ${p.dark}`}>

            {/* HEADER CON BOTÓN VOLVER */}
            <div className={p.headerBar}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                    <button
                        type="button"
                        className={p.btn}
                        onClick={() => router.push("/administrador/pami")}
                        title="Volver al Dashboard"
                    >
                        ← Volver
                    </button>
                    <h2 className={p.title} style={{ margin: 0 }}>Presupuestos PAMI</h2>
                </div>

                <div className={p.headerActions}>
                    <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={iniciarNuevo}>
                        + Nuevo Presupuesto
                    </button>
                </div>
            </div>

            <nav className={p.tabs} role="tablist">
                {[
                    ["presupuesto", "Presupuesto", "Crear / Consultar"],
                    ["borradores", "Borradores", "Todos los guardados"],
                    ["estadisticas", "Estadísticas", "Indicadores"],
                ].map(([id, label, descripcion]) => (
                    <button key={id} type="button" role="tab" aria-selected={solapa === id} className={`${p.tab} ${solapa === id ? p.tabActive : ""}`} onClick={() => setSolapa(id)}>
                        <span>{label}</span>
                        <small>{descripcion}</small>
                    </button>
                ))}
            </nav>

            {flash && <div className={p.toast}>{flash}</div>}

            {solapa === "presupuesto" && (
                <PresupuestoTab
                    key={resetKey}
                    items={items}
                    pacientesDb={pacientesDb}
                    initialPaciente={pendingOpen?.paciente}
                    initialDraft={pendingOpen?.borrador}
                    onInitialLoaded={() => setPendingOpen(null)}
                />
            )}

            {solapa === "borradores" && (
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Todos los borradores</h3>
                    <div className={p.grid2}>
                        <input className={p.input} type="search" placeholder="Buscar por paciente, DNI o afiliado…" value={busquedaBorrador} onChange={(e) => setBusquedaBorrador(e.target.value)} />
                        <select className={p.input} value={filtroVinculo} onChange={(e) => setFiltroVinculo(e.target.value)}>
                            <option value="todos">Todos</option>
                            <option value="huerfanos">Sin vínculo (huérfanos)</option>
                        </select>
                    </div>
                    <p className={p.hint}>{borradoresFiltrados.length} borradores.</p>
                    <BorradoresList borradores={borradoresFiltrados} onAbrir={abrirBorradorGlobal} onEliminar={async (b) => { if (confirm("¿Eliminar?")) { await eliminarPresupuestoPami(b.pacienteDni, b.id); mostrarFlash("Eliminado"); } }} showPaciente />
                </section>
            )}

            {solapa === "estadisticas" && <EstadisticasPanel pacientesDb={pacientesDb} />}
        </div>
    );
}
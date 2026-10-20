"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { getSession } from "@/utils/session";
import { matchesAllTerms, formatCurrency } from "@/app/farmacia/utils/farmacia";
import { eliminarPacientePami } from "@/lib/pami";
import { listarTodasLasOPs, ESTADOS_OP, cambiarEstadoOP } from "@/lib/pami/op";
import { listarTodasLasInternaciones, cerrarInternacionPami } from "@/lib/pami/internaciones";
import { listarTodasLasCirugias, cerrarCirugiaPami } from "@/lib/pami/cirugias";
import { listarBorradoresGlobales, eliminarPresupuestoPami } from "@/lib/pami/presupuestos";
import { ESTADOS_PACIENTE, estadoDef } from "@/lib/pami/pacientes";
import OncoplanBadge from "@/components/pami/presupuesto/OncoplanBadge";
import BorradoresList from "@/components/pami/presupuesto/BorradoresList";
import EstadisticasPanel from "@/components/pami/presupuesto/EstadisticasPanel";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

const p = styles;

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

const fmtFechaHora = (ms) => {
    if (!ms) return "—";
    const d = new Date(ms);
    return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
};

const fmtFecha = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = String(iso).split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
};

/* ══════════ TABS ══════════ */

function TabPacientes({ pacientesDb, onAbrirPaciente, onEliminarPaciente, onAgregarOP }) {
    const [q, setQ] = useState("");
    const [filtroEstado, setFiltroEstado] = useState("todos");
    const [filtroOncoplan, setFiltroOncoplan] = useState("todos");

    const filtrados = useMemo(() => {
        let lista = pacientesDb;
        const query = q.trim();
        if (query) {
            lista = lista.filter((x) =>
                matchesAllTerms(`${x.dni || ""} ${x.afiliado || ""} ${x.apellido || ""} ${x.nombre || ""}`, query)
            );
        }
        if (filtroEstado !== "todos") lista = lista.filter((x) => (x.estado || "activo") === filtroEstado);
        if (filtroOncoplan === "oncoplan") lista = lista.filter((x) => x.oncoplan);
        if (filtroOncoplan === "normal") lista = lista.filter((x) => !x.oncoplan);
        return lista.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [pacientesDb, q, filtroEstado, filtroOncoplan]);

    return (
        <section className={p.card}>
            <h3 className={p.cardTitle}>Pacientes registrados</h3>
            <div className={p.grid2}>
                <input
                    className={p.input}
                    type="search"
                    placeholder="Buscar por DNI, afiliado, apellido o nombre…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                <div className={p.grid2}>
                    <select className={p.input} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                        <option value="todos">Todos los estados</option>
                        {ESTADOS_PACIENTE.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                    </select>
                    <select className={p.input} value={filtroOncoplan} onChange={(e) => setFiltroOncoplan(e.target.value)}>
                        <option value="todos">Todas las modalidades</option>
                        <option value="oncoplan">Solo ONCOPLAN</option>
                        <option value="normal">Solo PAMI normal</option>
                    </select>
                </div>
            </div>
            <p className={p.hint}>{filtrados.length} pacientes.</p>

            {filtrados.length === 0 ? (
                <div className={p.empty}>No hay pacientes que coincidan.</div>
            ) : (
                <ul className={p.list}>
                    {filtrados.slice(0, 200).map((x) => {
                        const eDef = estadoDef(x.estado || "activo");
                        return (
                            <li key={x.dni} className={p.row}>
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div className={p.rowName}>
                                        {x.apellido || ""}, {x.nombre || ""}
                                        {x.oncoplan && <> <OncoplanBadge small /></>}
                                    </div>
                                    <div className={p.rowMeta}>
                                        DNI {x.dni} · Afiliado {x.afiliado || "—"}
                                        <span style={{ marginLeft: ".4rem", padding: "1px 6px", borderRadius: 999, border: `1px solid ${eDef.color}`, color: eDef.color, fontSize: ".68rem", fontWeight: 800 }}>
                                            {eDef.label}
                                        </span>
                                    </div>
                                </div>
                                <div className={p.rowActions}>
                                    <button type="button" className={`${p.btn} ${p.btnSm} ${p.btnPrimary}`} onClick={() => onAgregarOP(x.dni)}>
                                        + Agregar OP
                                    </button>
                                    <button type="button" className={`${p.btn} ${p.btnSm}`} onClick={() => onAbrirPaciente(x.dni)}>
                                        Ficha
                                    </button>
                                    <button type="button" className={`${p.btn} ${p.btnSm} ${p.btnDangerSm}`} onClick={() => onEliminarPaciente(x)}>
                                        ✕
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

function TabOPs({ ops, onAbrirPaciente, onCambiarEstado }) {
    const [q, setQ] = useState("");
    const [filtroEstado, setFiltroEstado] = useState("todos");

    const filtradas = useMemo(() => {
        let lista = ops;
        const query = q.trim();
        if (query) {
            lista = lista.filter((o) => matchesAllTerms(`${o.pacienteNombre} ${o.pacienteDni} ${o.nroOP || ""} ${o.diagnostico || ""}`, query));
        }
        if (filtroEstado !== "todos") lista = lista.filter((o) => o.estado === filtroEstado);
        return lista;
    }, [ops, q, filtroEstado]);

    return (
        <section className={p.card}>
            <h3 className={p.cardTitle}>Órdenes de prestación</h3>
            <div className={p.grid2}>
                <input className={p.input} type="search" placeholder="Buscar por paciente, N° OP o diagnóstico…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className={p.input} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    {ESTADOS_OP.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
            </div>
            <p className={p.hint}>{filtradas.length} OPs.</p>

            <ul className={p.list}>
                {filtradas.slice(0, 300).map((o) => {
                    const eDef = ESTADOS_OP.find((e) => e.id === o.estado) || ESTADOS_OP[0];
                    return (
                        <li key={`${o.pacienteDni}-${o.id}`} className={p.draftItem}>
                            <div className={p.draftInfo}>
                                <div className={p.draftTitle}>
                                    OP {o.nroOP || "(Sin N°)"} · {o.pacienteNombre}
                                    {o.oncoplan && <> <OncoplanBadge small /></>}
                                </div>
                                <div className={p.draftMeta}>
                                    DNI {o.pacienteDni} · {fmtFechaHora(o.createdAt)} · <span style={{ color: eDef.color }}>{eDef.label}</span>
                                </div>
                            </div>
                            <div className={p.draftActions}>
                                <button type="button" className={`${p.btn} ${p.btnSm}`} onClick={() => onAbrirPaciente(o.pacienteDni)}>Abrir ficha</button>
                                <select className={p.input} style={{ width: "auto", minHeight: 32, fontSize: ".76rem" }} value={o.estado} onChange={(e) => onCambiarEstado(o.pacienteDni, o.id, e.target.value)}>
                                    {ESTADOS_OP.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                                </select>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

/* ══════════ MAIN PAGE ══════════ */

export default function PamiDashboardPage() {
    const router = useRouter();
    const [solapa, setSolapa] = useState("pacientes"); // Por defecto, mostramos Pacientes
    const [pacientesDb, setPacientesDb] = useState([]);
    const [flash, setFlash] = useState("");

    const mostrarFlash = (m, ms = 3200) => { setFlash(m); setTimeout(() => setFlash(""), ms); };

    useEffect(() => {
        const unsub = onValue(ref(db, "PAMI/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientesDb(Object.entries(data).map(([dni, paciente]) => ({ dni, ...paciente })));
        });
        return () => unsub();
    }, []);

    const ops = useMemo(() => listarTodasLasOPs(pacientesDb), [pacientesDb]);
    const internaciones = useMemo(() => listarTodasLasInternaciones(pacientesDb), [pacientesDb]);
    const cirugias = useMemo(() => listarTodasLasCirugias(pacientesDb), [pacientesDb]);
    const borradores = useMemo(() => listarBorradoresGlobales(pacientesDb), [pacientesDb]);

    const abrirPaciente = (dni) => router.push(`/administrador/pami/pacientes/${dni}`);
    const agregarOP = (dni) => router.push(`/administrador/pami/nuevo?pacienteKey=${dni}`);

    const handleEliminarPaciente = async (pac) => {
        if (!confirm(`¿Eliminar el paciente?\nSe borrarán también todos sus datos.`)) return;
        try {
            await eliminarPacientePami(pac.dni);
            mostrarFlash("Paciente eliminado.");
        } catch (e) { mostrarFlash("Error al eliminar."); }
    };

    return (
        <div className={`${p.wrapper} ${p.dark}`}>
            <div className={p.headerBar}>
                <h2 className={p.title}>PAMI · Dashboard</h2>
                <div className={p.headerActions}>
                    <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => router.push("/administrador/pami/nuevo")}>
                        + Agregar Paciente / OP
                    </button>
                    <button type="button" className={p.btn} onClick={() => router.push("/administrador/pami/presupuestos")}>
                        🛒 Presupuestos
                    </button>
                </div>
            </div>

            <nav className={p.tabs} role="tablist">
                {[
                    ["pacientes", "Pacientes", `${pacientesDb.length}`],
                    ["op", "OPs", `${ops.length}`],
                    ["internaciones", "Internaciones", `${internaciones.length}`],
                    ["cirugias", "Cirugías", `${cirugias.length}`],
                    ["borradores", "Presupuestos", `${borradores.length}`],
                    ["estadisticas", "Estadísticas", "Métricas"],
                ].map(([id, label, desc]) => (
                    <button key={id} type="button" role="tab" aria-selected={solapa === id} className={`${p.tab} ${solapa === id ? p.tabActive : ""}`} onClick={() => setSolapa(id)}>
                        <span>{label}</span>
                        <small>{desc}</small>
                    </button>
                ))}
            </nav>

            {flash && <div className={p.toast}>{flash}</div>}

            {solapa === "pacientes" && (
                <TabPacientes pacientesDb={pacientesDb} onAbrirPaciente={abrirPaciente} onEliminarPaciente={handleEliminarPaciente} onAgregarOP={agregarOP} />
            )}
            {solapa === "op" && <TabOPs ops={ops} onAbrirPaciente={abrirPaciente} onCambiarEstado={cambiarEstadoOP} />}
            {solapa === "borradores" && (
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Todos los presupuestos</h3>
                    <BorradoresList borradores={borradores} onAbrir={() => router.push("/administrador/pami/presupuestos")} onEliminar={async (b) => { await eliminarPresupuestoPami(b.pacienteDni, b.id); mostrarFlash("Borrador eliminado"); }} showPaciente />
                </section>
            )}
            {solapa === "estadisticas" && <EstadisticasPanel pacientesDb={pacientesDb} />}
        </div>
    );
}
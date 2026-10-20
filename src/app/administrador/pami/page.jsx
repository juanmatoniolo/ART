"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, onValue, update } from "firebase/database";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import { eliminarPacientePami } from "@/lib/pami";
import { listarTodasLasOPs, ESTADOS_OP } from "@/lib/pami/op";
import { listarTodasLasInternaciones } from "@/lib/pami/internaciones";
import { listarTodasLasCirugias } from "@/lib/pami/cirugias";
import { listarBorradoresGlobales, eliminarPresupuestoPami } from "@/lib/pami/presupuestos";
import { ESTADOS_PACIENTE, estadoDef } from "@/lib/pami/pacientes";
import BorradoresList from "@/components/pami/presupuesto/BorradoresList";
import EstadisticasPanel from "@/components/pami/presupuesto/EstadisticasPanel";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

const p = styles;

function TabPacientes({ pacientesDb, ops, onAbrirPaciente, onEliminarPaciente, onAgregarOP, onToggleOncoplan }) {
    const [q, setQ] = useState("");
    const [filtroPendientes, setFiltroPendientes] = useState("todos");
    const [expandidoDni, setExpandidoDni] = useState(null);
    const [copiedField, setCopiedField] = useState(null);

    const handleCopy = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const filtrados = useMemo(() => {
        let lista = pacientesDb;
        const query = q.trim();

        if (query) {
            lista = lista.filter((x) =>
                matchesAllTerms(`${x.dni || ""} ${x.afiliado || ""} ${x.apellido || ""} ${x.nombre || ""}`, query)
            );
        }

        if (filtroPendientes === "op_pendiente") {
            lista = lista.filter((pac) => {
                const opsPac = ops.filter(o => o.pacienteDni === pac.dni);
                return opsPac.some(o => o.estado === "cargado" || o.estado === "solicitado");
            });
        } else if (filtroPendientes === "oncoplan_pendiente") {
            lista = lista.filter((pac) => pac.oncoplan && pac.oncoplanEstado !== "habilitado");
        }

        return lista.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [pacientesDb, ops, q, filtroPendientes]);

    const enviarWhatsApp = (paciente) => {
        if (!paciente.telefono) return alert("El paciente no tiene un teléfono registrado.");
        const tel = String(paciente.telefono).replace(/\D/g, "");
        window.open(`https://wa.me/549${tel}`, "_blank");
    };

    return (
        <section className={p.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
                <h3 className={p.cardTitle} style={{ margin: 0 }}>Pacientes registrados</h3>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                    <select className={p.input} style={{ maxWidth: "200px" }} value={filtroPendientes} onChange={(e) => setFiltroPendientes(e.target.value)}>
                        <option value="todos">Todos los pacientes</option>
                        <option value="op_pendiente">Con OP Pendiente</option>
                        <option value="oncoplan_pendiente">ONCOPLAN Pendiente</option>
                    </select>
                    <input
                        className={p.input}
                        style={{ maxWidth: "250px" }}
                        type="search"
                        placeholder="Buscar DNI, nombre…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                </div>
            </div>

            <p className={p.hint}>{filtrados.length} pacientes encontrados. (Hacé clic en uno para ver acciones rápidas)</p>

            <ul className={p.list}>
                {filtrados.map((x) => {
                    const eDef = estadoDef(x.estado || "activo");
                    const isOncPending = x.oncoplan && x.oncoplanEstado !== "habilitado";
                    const isOncHab = x.oncoplan && x.oncoplanEstado === "habilitado";
                    const isExpanded = expandidoDni === x.dni;

                    return (
                        <li key={x.dni} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                            <div
                                className={p.row}
                                style={{ cursor: "pointer", borderColor: isExpanded ? "var(--accent)" : "var(--border)" }}
                                onClick={() => setExpandidoDni(isExpanded ? null : x.dni)}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div className={p.rowName}>
                                        {x.apellido || ""}, {x.nombre || ""}
                                        {isOncPending && <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 6px", background: "#f59e0b", color: "#fff", borderRadius: 4, fontWeight: "bold" }}>ONCOPLAN PENDIENTE</span>}
                                        {isOncHab && <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 6px", background: "#e11d48", color: "#fff", borderRadius: 4, fontWeight: "bold" }}>ONCOPLAN</span>}
                                    </div>
                                    <div className={p.rowMeta}>
                                        DNI {x.dni} · Afiliado {x.afiliado || "—"} · Tel: {x.telefono || "—"}
                                        <span style={{ marginLeft: ".4rem", padding: "1px 6px", borderRadius: 999, border: `1px solid ${eDef.color}`, color: eDef.color, fontSize: ".68rem", fontWeight: 800 }}>
                                            {eDef.label}
                                        </span>
                                    </div>
                                </div>
                                <div className={p.rowActions} onClick={e => e.stopPropagation()}>
                                    <button type="button" className={`${p.btn} ${p.btnSm} ${p.btnPrimary}`} onClick={() => onAgregarOP(x.dni)}>
                                        + OP
                                    </button>
                                    <button type="button" className={`${p.btn} ${p.btnSm}`} onClick={() => setExpandidoDni(isExpanded ? null : x.dni)}>
                                        {isExpanded ? "Cerrar" : "▼ Ver datos"}
                                    </button>
                                </div>
                            </div>

                            {isExpanded && (
                                <div style={{ padding: "1.25rem", background: "var(--surface-2)", border: "1px solid var(--accent-border)", borderRadius: "8px", marginLeft: "1rem", marginRight: "1rem", display: "flex", flexDirection: "column", gap: "1rem" }}>

                                    {/* GRILLA DE COPIADO RÁPIDO */}
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>

                                        {/* Nombre */}
                                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>NOMBRE</div>
                                                <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.apellido}, {x.nombre}</div>
                                            </div>
                                            <button onClick={() => handleCopy(`${x.apellido}, ${x.nombre}`, `nom-${x.dni}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }} title="Copiar Nombre">
                                                {copiedField === `nom-${x.dni}` ? "✅" : "📋"}
                                            </button>
                                        </div>

                                        {/* DNI */}
                                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>DNI</div>
                                                <div style={{ fontWeight: 800 }}>{x.dni}</div>
                                            </div>
                                            <button onClick={() => handleCopy(x.dni, `dni-${x.dni}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }} title="Copiar DNI">
                                                {copiedField === `dni-${x.dni}` ? "✅" : "📋"}
                                            </button>
                                        </div>

                                        {/* Afiliado */}
                                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>AFILIADO</div>
                                                <div style={{ fontWeight: 800 }}>{x.afiliado || "—"}</div>
                                            </div>
                                            <button onClick={() => handleCopy(x.afiliado?.split('/')[0] || "", `afil-${x.dni}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }} title="Copiar Afiliado (sin /)">
                                                {copiedField === `afil-${x.dni}` ? "✅" : "📋"}
                                            </button>
                                        </div>

                                    </div>

                                    {/* ACCIONES */}
                                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.5rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                                        <button type="button" className={`${p.btn} ${p.btnSm}`} style={{ background: "#25D366", borderColor: "#25D366", color: "#fff" }} onClick={() => enviarWhatsApp(x)}>
                                            💬 Enviar WhatsApp
                                        </button>
                                        <button type="button" className={`${p.btn} ${p.btnSm}`} onClick={() => onAbrirPaciente(x.dni)}>
                                            📄 Ver Ficha Completa
                                        </button>

                                        {isOncPending && (
                                            <button type="button" className={`${p.btn} ${p.btnSm}`} style={{ borderColor: "#e11d48", color: "#e11d48" }} onClick={() => onToggleOncoplan(x.dni, true)}>
                                                ✓ Habilitar ONCOPLAN
                                            </button>
                                        )}
                                        {isOncHab && (
                                            <button type="button" className={`${p.btn} ${p.btnSm}`} onClick={() => onToggleOncoplan(x.dni, false)}>
                                                Quitar ONCOPLAN
                                            </button>
                                        )}
                                        <button type="button" className={`${p.btn} ${p.btnSm} ${p.btnDangerSm}`} onClick={() => onEliminarPaciente(x)}>
                                            🗑️ Eliminar Paciente
                                        </button>
                                    </div>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

export default function PamiDashboardPage() {
    const router = useRouter();
    const [solapa, setSolapa] = useState("pacientes");
    const [pacientesDb, setPacientesDb] = useState([]);

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
    const agregarOP = (dni) => router.push(`/administrador/pami/nuevo?pacienteKey=${dni}&tipo=op`);

    const handleEliminarPaciente = async (pac) => {
        if (!confirm(`¿Eliminar el paciente?\nSe borrarán también todos sus datos.`)) return;
        await eliminarPacientePami(pac.dni);
    };

    const handleToggleOncoplan = async (dni, habilitar) => {
        if (!confirm(habilitar ? "¿Marcar ONCOPLAN como HABILITADO por PAMI?" : "¿Quitar estado ONCOPLAN?")) return;
        await update(ref(db, `PAMI/pacientes/${dni}`), {
            oncoplanEstado: habilitar ? "habilitado" : "pendiente",
            updatedAt: Date.now()
        });
    };

    return (
        <div className={`${p.wrapper} ${p.dark}`}>
            <div className={p.headerBar}>
                <h2 className={p.title}>PAMI · Dashboard</h2>
                <div className={p.headerActions}>
                    <button type="button" className={p.btn} onClick={() => router.push("/administrador/pami/nuevo-paciente")}>
                        + Agregar Paciente
                    </button>
                    <button type="button" className={`${p.btn} ${p.btnPrimary}`} onClick={() => router.push("/administrador/pami/nuevo?tipo=op")}>
                        + Nueva OP
                    </button>
                    <button type="button" className={p.btn} style={{ borderColor: "#e11d48", color: "#e11d48" }} onClick={() => router.push("/administrador/pami/oncoplan")}>
                        + ONCOPLAN
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

            {solapa === "pacientes" && (
                <TabPacientes
                    pacientesDb={pacientesDb}
                    ops={ops}
                    onAbrirPaciente={abrirPaciente}
                    onEliminarPaciente={handleEliminarPaciente}
                    onAgregarOP={agregarOP}
                    onToggleOncoplan={handleToggleOncoplan}
                />
            )}

            {solapa === "borradores" && (
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Todos los presupuestos</h3>
                    <BorradoresList borradores={borradores} onAbrir={() => router.push("/administrador/pami/presupuestos")} onEliminar={async (b) => { await eliminarPresupuestoPami(b.pacienteDni, b.id); }} showPaciente />
                </section>
            )}
            {solapa === "estadisticas" && <EstadisticasPanel pacientesDb={pacientesDb} />}
        </div>
    );
}
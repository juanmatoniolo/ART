"use client";
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import { dniKey } from "@/lib/pami";
import styles from "./wizard.module.css";

const OncoplanTag = () => (
    <span style={{ padding: "1px 6px", borderRadius: 4, background: "#e11d48", color: "#fff", fontWeight: 700, fontSize: 10, letterSpacing: 0.6 }}>ONCOPLAN</span>
);

export default function Paso1Paciente({ estado, actualizar }) {
    const [busqueda, setBusqueda] = useState("");
    const [pacientes, setPacientes] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [modoManual, setModoManual] = useState(false);
    const [copiedField, setCopiedField] = useState(null); // Estado para el feedback

    const [manual, setManual] = useState({ nombreCompleto: "", dni: "", afiliado: "", telefono: "" });

    useEffect(() => {
        const unsub = onValue(ref(db, "PAMI/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientes(
                Object.entries(data).map(([dni, p]) => ({
                    dni, ...p,
                    nombreCompleto: [p.apellido, p.nombre].filter(Boolean).join(" "),
                }))
            );
            setCargando(false);
        });
        return () => unsub();
    }, []);

    const filtrados = useMemo(() => {
        const q = busqueda.trim();
        if (!q) return pacientes.slice(0, 15);
        return pacientes.filter((p) =>
            matchesAllTerms(`${p.dni} ${p.afiliado || ""} ${p.apellido || ""} ${p.nombre || ""}`, q)
        ).slice(0, 30);
    }, [pacientes, busqueda]);

    const seleccionar = (p) => actualizar({ paciente: p, pacienteKey: dniKey(p.dni) });
    const deseleccionar = () => actualizar({ paciente: null });

    const handleCopy = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    const guardarManual = () => {
        if (!manual.nombreCompleto || !manual.dni) return alert("Nombre y DNI son obligatorios");
        const partes = manual.nombreCompleto.trim().split(/\s+/);
        actualizar({
            paciente: {
                dni: manual.dni,
                afiliado: manual.afiliado,
                telefono: manual.telefono,
                apellido: partes[0] || "",
                nombre: partes.slice(1).join(" "),
                nombreCompleto: manual.nombreCompleto,
                oncoplan: false
            },
            pacienteKey: dniKey(manual.dni)
        });
        setModoManual(false);
    };

    return (
        <div>
            <h2 className={styles.titulo}>Paso 1 · Paciente</h2>
            <p className={styles.hint}>Buscá un paciente existente o cargalo manualmente si no está en la base.</p>

            {estado.paciente ? (
                <div style={{ padding: "1.5rem", border: "1px solid var(--accent-border)", borderRadius: "12px", background: "var(--accent-weak)", display: "flex", flexDirection: "column", gap: "1rem" }}>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--accent-border)", paddingBottom: "0.75rem" }}>
                        <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "var(--text)" }}>
                            Datos del Paciente
                        </div>
                        <button type="button" className={styles.btnSecundario} onClick={deseleccionar} style={{ padding: "4px 12px", fontSize: "0.8rem" }}>Cambiar Paciente</button>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "1rem" }}>

                        {/* BLOQUE NOMBRE */}
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>Apellido y Nombre</div>
                                <div style={{ fontWeight: 800, fontSize: "1rem" }}>
                                    {estado.paciente.apellido}, {estado.paciente.nombre} {estado.paciente.oncoplan && <OncoplanTag />}
                                </div>
                            </div>
                            <button
                                onClick={() => handleCopy(`${estado.paciente.apellido}, ${estado.paciente.nombre}`, 'nombre')}
                                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--text)" }}
                                title="Copiar Nombre"
                            >
                                {copiedField === 'nombre' ? "✅ Copiado" : "📋 Copiar"}
                            </button>
                        </div>

                        {/* BLOQUE DNI */}
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>DNI</div>
                                <div style={{ fontWeight: 800, fontSize: "1rem" }}>{estado.paciente.dni}</div>
                            </div>
                            <button
                                onClick={() => handleCopy(estado.paciente.dni, 'dni')}
                                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--text)" }}
                                title="Copiar DNI"
                            >
                                {copiedField === 'dni' ? "✅ Copiado" : "📋 Copiar"}
                            </button>
                        </div>

                        {/* BLOQUE AFILIADO */}
                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "8px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <div style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", fontWeight: 700, marginBottom: "4px" }}>N° Afiliado</div>
                                <div style={{ fontWeight: 800, fontSize: "1rem" }}>{estado.paciente.afiliado || "—"}</div>
                            </div>
                            <button
                                onClick={() => handleCopy(estado.paciente.afiliado?.split('/')[0] || "", 'afil')}
                                style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "6px", padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "0.8rem", color: "var(--text)" }}
                                title="Copiar solo el número de afiliado (sin el /)"
                            >
                                {copiedField === 'afil' ? "✅ Copiado" : "📋 Copiar"}
                            </button>
                        </div>

                    </div>
                </div>
            ) : modoManual ? (
                <div style={{ padding: "1rem", border: "1px solid var(--border)", borderRadius: "10px", background: "var(--surface-2)" }}>
                    <h3 style={{ fontSize: "1rem", marginBottom: "1rem" }}>Cargar Paciente Manualmente</h3>
                    <label className={styles.campo}><span>Apellido y Nombre *</span><input className={styles.input} value={manual.nombreCompleto} onChange={e => setManual({ ...manual, nombreCompleto: e.target.value })} /></label>
                    <label className={styles.campo}><span>DNI *</span><input className={styles.input} value={manual.dni} onChange={e => setManual({ ...manual, dni: e.target.value })} /></label>
                    <label className={styles.campo}><span>Afiliado</span><input className={styles.input} value={manual.afiliado} onChange={e => setManual({ ...manual, afiliado: e.target.value })} /></label>
                    <label className={styles.campo}><span>Teléfono</span><input className={styles.input} value={manual.telefono} onChange={e => setManual({ ...manual, telefono: e.target.value })} /></label>

                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
                        <button type="button" className={styles.btnPrimario} onClick={guardarManual} style={{ flex: 1 }}>Continuar</button>
                        <button type="button" className={styles.btnSecundario} onClick={() => setModoManual(false)}>Cancelar</button>
                    </div>
                </div>
            ) : (
                <>
                    <input className={styles.input} type="search" placeholder="Buscar por DNI, afiliado o nombre…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
                    <ul className={styles.listaResultados} style={{ maxHeight: "300px" }}>
                        {cargando && <li className={styles.vacio}>Cargando…</li>}
                        {!cargando && filtrados.length === 0 && <li className={styles.vacio}>No se encontraron pacientes.</li>}
                        {filtrados.map((p) => (
                            <li key={p.dni}>
                                <button type="button" className={styles.item} onClick={() => seleccionar(p)}>
                                    <div>
                                        <strong>{p.nombreCompleto || `DNI ${p.dni}`} {p.oncoplan && <OncoplanTag />}</strong>
                                        <div className={styles.meta}>DNI {p.dni} · Afil {p.afiliado}</div>
                                    </div>
                                </button>
                            </li>
                        ))}
                    </ul>
                    <button type="button" className={styles.btnSecundario} style={{ marginTop: "1rem", width: "100%" }} onClick={() => setModoManual(true)}>
                        + Cargar paciente manualmente
                    </button>
                </>
            )}
        </div>
    );
}
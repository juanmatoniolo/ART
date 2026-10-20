"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, update } from "firebase/database";
import { dniKey } from "@/lib/pami";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

export default function SolicitudOncoplánPage() {
    const router = useRouter();
    const [pacientesDb, setPacientesDb] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [pacienteSeleccionado, setPacienteSeleccionado] = useState(null);

    const [diagnostico, setDiagnostico] = useState("");
    const [tipoCancer, setTipoCancer] = useState("");

    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState("");

    const mostrarFlash = (m) => { setFlash(m); setTimeout(() => setFlash(""), 3000); };

    // Listener temporal para buscar pacientes
    useMemo(() => {
        import("firebase/database").then(({ onValue }) => {
            onValue(ref(db, "PAMI/pacientes"), (snap) => {
                const data = snap.val() || {};
                setPacientesDb(Object.entries(data).map(([dni, p]) => ({ dni, ...p })));
            });
        });
    }, []);

    const sugerencias = useMemo(() => {
        const q = busqueda.trim();
        if (q.length < 2) return [];
        return pacientesDb.filter(p =>
            `${p.dni} ${p.afiliado} ${p.apellido} ${p.nombre}`.toLowerCase().includes(q.toLowerCase())
        ).slice(0, 5);
    }, [pacientesDb, busqueda]);

    const generarSolicitud = async () => {
        if (!pacienteSeleccionado) return alert("Seleccioná un paciente.");
        if (!diagnostico.trim() || !tipoCancer.trim()) return alert("Completá el diagnóstico y el tipo de cáncer.");

        setSaving(true);
        try {
            const key = dniKey(pacienteSeleccionado.dni);

            // 1. Guardar en Firebase que está pendiente de ONCOPLAN
            await update(ref(db, `PAMI/pacientes/${key}`), {
                oncoplan: true,
                oncoplanEstado: "pendiente",
                diagnosticoOncologico: diagnostico,
                tipoCancer: tipoCancer,
                fechaSolicitudOncoplán: Date.now(),
                updatedAt: Date.now()
            });

            // 2. Generar el correo
            const nombreCompleto = `${pacienteSeleccionado.apellido}, ${pacienteSeleccionado.nombre}`;
            const asunto = `Solicitud de Alta ONCOPLAN - ${nombreCompleto} - DNI ${pacienteSeleccionado.dni} - Afil ${pacienteSeleccionado.afiliado}`;

            const cuerpo = `Estimados,\n\nPor medio del presente solicitamos el ALTA en el plan ONCOPLAN para el paciente:\n\nNombre: ${nombreCompleto}\nDNI: ${pacienteSeleccionado.dni}\nN° Afiliado: ${pacienteSeleccionado.afiliado}\n\nDiagnóstico: ${diagnostico}\nTipo de Cáncer: ${tipoCancer}\n\nAdjuntamos la documentación respaldatoria correspondiente.\n\nQuedamos a la espera de su confirmación.\n\nAtentamente,\nClínica de la Unión\nChajarí, Entre Ríos`;

            // En la función generarSolicitud, busca estas líneas y cambialas:

            const mailtoLink = `mailto:?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;

            // Abrir en nueva pestaña
            window.open(mailtoLink, "_blank");



            mostrarFlash("Mail generado. Una vez que PAMI responda, marcá el paciente como HABILITADO en el Dashboard.");
            setTimeout(() => router.push("/administrador/pami"), 3000);
        } catch (e) {
            alert("Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`${styles.wrapper} ${styles.dark}`} style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: "800px", marginTop: "2rem" }}>

                <div className={styles.headerBar}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <button type="button" className={styles.btn} onClick={() => router.push("/administrador/pami")}>← Volver</button>
                        <h2 className={styles.title} style={{ margin: 0, color: "#e11d48" }}>Solicitar Alta ONCOPLAN</h2>
                    </div>
                </div>

                {flash && <div className={styles.toast}>{flash}</div>}

                <div className={styles.card}>

                    {/* BUSCADOR DE PACIENTE */}
                    <div style={{ position: "relative", marginBottom: "2rem" }}>
                        <label className={styles.field}>
                            <span>1. Buscar Paciente</span>
                            <input
                                className={styles.input}
                                value={busqueda}
                                onChange={e => { setBusqueda(e.target.value); setPacienteSeleccionado(null); }}
                                placeholder="Buscar por DNI, nombre o afiliado..."
                            />
                        </label>

                        {sugerencias.length > 0 && !pacienteSeleccionado && (
                            <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", listStyle: "none", padding: ".4rem", margin: ".2rem 0 0 0", boxShadow: "var(--shadow)" }}>
                                {sugerencias.map(p => (
                                    <li key={p.dni}>
                                        <div
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setPacienteSeleccionado(p);
                                                setBusqueda(`${p.apellido}, ${p.nombre}`);
                                            }}
                                            style={{ padding: ".5rem", cursor: "pointer", borderBottom: "1px solid var(--border)" }}
                                        >
                                            <strong>{p.apellido}, {p.nombre}</strong> - DNI {p.dni}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {pacienteSeleccionado && (
                            <div style={{ marginTop: "1rem", padding: "1rem", background: "rgba(225, 29, 72, 0.1)", border: "1px solid #e11d48", borderRadius: "8px" }}>
                                <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>{pacienteSeleccionado.apellido}, {pacienteSeleccionado.nombre}</div>
                                <div style={{ fontSize: ".85rem", color: "var(--muted)" }}>DNI: {pacienteSeleccionado.dni} · Afiliado: {pacienteSeleccionado.afiliado}</div>
                            </div>
                        )}
                    </div>

                    {/* DATOS MÉDICOS */}
                    <label className={styles.field} style={{ marginBottom: "1rem" }}>
                        <span>2. Diagnóstico Oncológico</span>
                        <input className={styles.input} value={diagnostico} onChange={e => setDiagnostico(e.target.value)} placeholder="Ej: Adenocarcinoma gástrico" />
                    </label>

                    <label className={styles.field} style={{ marginBottom: "2rem" }}>
                        <span>3. Tipo de Cáncer / Localización</span>
                        <input className={styles.input} value={tipoCancer} onChange={e => setTipoCancer(e.target.value)} placeholder="Ej: Estómago / Mama / Pulmón" />
                    </label>

                    {/* BOTON GENERAR */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            style={{ background: "#e11d48", borderColor: "#e11d48", minWidth: "250px" }}
                            onClick={generarSolicitud}
                            disabled={saving || !pacienteSeleccionado}
                        >
                            {saving ? "Generando..." : "Generar Mail y Marcar Pendiente"}
                        </button>
                    </div>

                    <p className={styles.hint} style={{ marginTop: "1rem", textAlign: "right" }}>
                        Al hacer clic, se abrirá tu gestor de correo con el mensaje redactado.
                    </p>
                </div>
            </div>
        </div>
    );
}
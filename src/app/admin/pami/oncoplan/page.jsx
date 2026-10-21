"use client";
import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, update, onValue } from "firebase/database";
import { dniKey } from "@/lib/pami";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

const ONCOPLAN_EMAIL_DESTINO = "dcc@pami.org.ar";

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

    useEffect(() => {
        const unsub = onValue(ref(db, "PAMI/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientesDb(Object.entries(data).map(([dni, p]) => ({ dni, ...p })));
        });
        return () => unsub();
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

            // 2. Armar asunto y cuerpo
            const nombreCompleto = `${pacienteSeleccionado.apellido}, ${pacienteSeleccionado.nombre}`;
            const asunto = `Solicitud de Alta ONCOPLAN - ${nombreCompleto} - DNI ${pacienteSeleccionado.dni} - Afil ${pacienteSeleccionado.afiliado}`;

            const cuerpo =
`Estimados,

Por medio del presente solicitamos el ALTA en el plan ONCOPLAN para el paciente:

Nombre: ${nombreCompleto}
DNI: ${pacienteSeleccionado.dni}
N° Afiliado: ${pacienteSeleccionado.afiliado}

Diagnóstico: ${diagnostico}
Tipo de Cáncer: ${tipoCancer}

Adjuntamos la documentación respaldatoria correspondiente.

Quedamos a la espera de su confirmación.

Atentamente,
Clínica de la Unión
Chajarí, Entre Ríos`;

            // 3. Abrir Gmail web con todo precargado
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1` +
                `&to=${encodeURIComponent(ONCOPLAN_EMAIL_DESTINO)}` +
                `&su=${encodeURIComponent(asunto)}` +
                `&body=${encodeURIComponent(cuerpo)}`;

            const nuevaVentana = window.open(gmailUrl, "_blank");
            // Fallback si el navegador bloquea el popup
            if (!nuevaVentana || nuevaVentana.closed || typeof nuevaVentana.closed === "undefined") {
                window.location.href = gmailUrl;
            }

            mostrarFlash("Gmail abierto. No olvides ADJUNTAR la documentación antes de enviar. Una vez que PAMI responda, marcá el paciente como HABILITADO en el Dashboard.");
            setTimeout(() => router.push("/admin/pami"), 4000);
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
                        <button type="button" className={styles.btn} onClick={() => router.push("/admin/pami")}>← Volver</button>
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
                        Al hacer clic se abrirá <strong>Gmail</strong> con el correo redactado para <strong>{ONCOPLAN_EMAIL_DESTINO}</strong>.
                        Acordate de <strong>adjuntar la documentación</strong> antes de enviar.
                    </p>
                </div>
            </div>
        </div>
    );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dniKey, asegurarPacientePami } from "@/lib/pami";
import { getSession } from "@/utils/session";
import PacienteFormBasico from "@/components/pami/presupuesto/PacienteFormBasico";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

const PACIENTE_VACIO = {
    dni: "", afiliado: "", nombreCompleto: "", historiaClinica: "", sexo: "",
    fechaNacimiento: "", telefono: "", domicilio: "", localidad: "", provincia: "",
    famNombre: "", famParentezco: "", famTelefono: "",
    cirujano: "", ayudante1: "", ayudante2: "", anestesista: ""
};

// Función para adaptar el formulario al formato de la Base de Datos
const aDb = (f) => {
    const { famNombre, famParentezco, famTelefono, nombreCompleto, ...resto } = f;
    const partes = String(nombreCompleto || "").trim().split(/\s+/).filter(Boolean);

    return {
        ...resto,
        apellido: partes[0] || "",
        nombre: partes.slice(1).join(" "),
        familiar: {
            nombre: (famNombre || "").trim(),
            parentezco: (famParentezco || "").trim(),
            telefono: (famTelefono || "").trim()
        },
    };
};

export default function NuevoPacientePage() {
    const router = useRouter();
    const [paciente, setPaciente] = useState(PACIENTE_VACIO);
    const [oncoplan, setOncoplan] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState("");

    const mostrarFlash = (m) => {
        setFlash(m);
        setTimeout(() => setFlash(""), 3000);
    };

    const guardarPaciente = async () => {
        // Validaciones básicas
        if (!paciente.nombreCompleto.trim()) return mostrarFlash("⚠️ Completá apellido y nombre.");
        if (dniKey(paciente.dni).length < 7) return mostrarFlash("⚠️ Ingresá un DNI válido.");
        if (!paciente.afiliado.trim()) return mostrarFlash("⚠️ Ingresá el N° de afiliado PAMI.");

        setSaving(true);
        try {
            const s = (typeof getSession === "function" && getSession()) || {};
            const usuario = s.user || s.usuario || s.nombre || "sistema";

            // Guardamos el paciente (si ya existe, actualiza los datos)
            await asegurarPacientePami({
                ...aDb(paciente),
                oncoplan,
                oncoplanEstado: oncoplan ? "pendiente" : null // Si se marca oncoplan, queda pendiente por defecto
            }, { usuario });

            mostrarFlash("✅ Paciente guardado correctamente.");

            // Redirigimos al dashboard después de un breve segundo
            setTimeout(() => router.push("/administrador/pami"), 1200);
        } catch (e) {
            console.error(e);
            alert("Error al guardar el paciente: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`${styles.wrapper} ${styles.dark}`} style={{ display: "flex", justifyContent: "center" }}>
            <div style={{ width: "100%", maxWidth: "900px", marginTop: "2rem" }}>

                {/* HEADER */}
                <div className={styles.headerBar}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <button
                            type="button"
                            className={styles.btn}
                            onClick={() => router.push("/administrador/pami")}
                        >
                            ← Volver al Dashboard
                        </button>
                        <h2 className={styles.title} style={{ margin: 0 }}>Agregar Paciente</h2>
                    </div>
                </div>

                {flash && <div className={styles.toast}>{flash}</div>}

                {/* FORMULARIO */}
                <div className={styles.card}>
                    <p className={styles.hint} style={{ marginBottom: "1.5rem" }}>
                        Cargá los datos principales del paciente. Una vez guardado, vas a poder generarle OPs, presupuestos o internaciones desde el Dashboard.
                    </p>

                    <PacienteFormBasico
                        paciente={paciente}
                        onChange={(p) => setPaciente({ ...paciente, ...p })}
                        onDniBlur={() => { }} // No hace falta buscar en la BD porque es para crear uno nuevo
                        oncoplan={oncoplan}
                        onOncoplanChange={setOncoplan}
                        pacientesDb={[]} // Pasamos array vacío para que no muestre sugerencias mientras escribe
                    />

                    {/* BOTONERA */}
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
                        <button
                            type="button"
                            className={styles.btn}
                            onClick={() => router.push("/administrador/pami")}
                            disabled={saving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            onClick={guardarPaciente}
                            disabled={saving}
                            style={{ minWidth: "200px" }}
                        >
                            {saving ? "Guardando..." : "Guardar Paciente"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
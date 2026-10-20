"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { dniKey, asegurarPacientePami } from "@/lib/pami";
import { getSession } from "@/utils/session";
import PacienteFormBasico from "@/components/pami/presupuesto/PacienteFormBasico";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

const PACIENTE_VACIO = {
    dni: "", afiliado: "", nombreCompleto: "", historiaClinica: "", sexo: "",
    fechaNacimiento: "", telefono: "", domicilio: "", localidad: "", provincia: "", cp: "",
    famNombre: "", famParentezco: "", famTelefono: "",
    cirujano: "", ayudante1: "", ayudante2: "", anestesista: ""
};

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
        }
    };
};

export default function NuevoPacientePage() {
    const router = useRouter();
    const [paciente, setPaciente] = useState(PACIENTE_VACIO);
    const [oncoplan, setOncoplan] = useState(false);
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState("");

    const mostrarFlash = (m) => { setFlash(m); setTimeout(() => setFlash(""), 3000); };

    const guardarPaciente = async () => {
        if (!paciente.nombreCompleto.trim()) return mostrarFlash("⚠️ Completá apellido y nombre.");
        if (dniKey(paciente.dni).length < 7) return mostrarFlash("⚠️ Ingresá un DNI válido.");
        if (!paciente.afiliado.trim()) return mostrarFlash("⚠️ Ingresá el N° de afiliado PAMI.");

        setSaving(true);
        try {
            const s = (typeof getSession === "function" && getSession()) || {};
            const usuario = s.user || s.usuario || s.nombre || "sistema";

            await asegurarPacientePami({
                ...aDb(paciente),
                oncoplan,
                oncoplanEstado: oncoplan ? "pendiente" : null
            }, { usuario });

            mostrarFlash("✅ Paciente guardado correctamente.");
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

                <div className={styles.headerBar}>
                    <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                        <button type="button" className={styles.btn} onClick={() => router.push("/administrador/pami")}>
                            ← Volver
                        </button>
                        <h2 className={styles.title} style={{ margin: 0 }}>Agregar Paciente</h2>
                    </div>
                </div>

                {flash && <div className={styles.toast}>{flash}</div>}

                <div className={styles.card}>
                    <p className={styles.hint} style={{ marginBottom: "1.5rem" }}>
                        Cargá todos los datos del paciente. Esta información se usará para autocompletar futuras OPs, Cirugías e Internaciones.
                    </p>

                    <PacienteFormBasico
                        paciente={paciente}
                        onChange={(p) => setPaciente({ ...paciente, ...p })}
                        onDniBlur={() => { }}
                        oncoplan={oncoplan}
                        onOncoplanChange={setOncoplan}
                        pacientesDb={[]}
                    />

                    <div style={{ display: "flex", justifyContent: "flex-end", gap: "1rem", marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1.5rem" }}>
                        <button type="button" className={styles.btn} onClick={() => router.push("/administrador/pami")} disabled={saving}>
                            Cancelar
                        </button>
                        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={guardarPaciente} disabled={saving} style={{ minWidth: "200px" }}>
                            {saving ? "Guardando..." : "Guardar Paciente"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
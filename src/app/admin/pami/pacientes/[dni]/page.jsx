"use client";
import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, update, remove } from "firebase/database";
import { getSession } from "@/utils/session";
import { obtenerPacientePami, eliminarPacientePami, asegurarPacientePami, dniKey } from "@/lib/pami";
import { cambiarEstadoPaciente, setOncoplanPaciente, puedeGenerarEventos } from "@/lib/pami/pacientes";
import { listarOPsPaciente, cambiarEstadoOP } from "@/lib/pami/op";
import { listarInternacionesPaciente, cerrarInternacionPami } from "@/lib/pami/internaciones";
import { listarCirugiasPaciente, cerrarCirugiaPami } from "@/lib/pami/cirugias";
import { listarBorradoresPaciente } from "@/lib/pami/presupuestos";
import PacienteHeader from "@/components/pami/paciente/PacienteHeader";
import PacienteTimeline from "@/components/pami/paciente/PacienteTimeline";
import styles from "@/components/pami/paciente/paciente.module.css";

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

export default function PacientePamiPage() {
    const { dni } = useParams();
    const router = useRouter();
    const pacienteKey = dniKey(dni);

    const [paciente, setPaciente] = useState(null);
    const [ops, setOps] = useState([]);
    const [internaciones, setInternaciones] = useState([]);
    const [cirugias, setCirugias] = useState([]);
    const [presupuestos, setPresupuestos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [flash, setFlash] = useState("");

    const mostrarFlash = (m, ms = 3200) => {
        setFlash(m);
        setTimeout(() => setFlash(""), ms);
    };

    const cargarTodo = async () => {
        setLoading(true);
        try {
            const data = await obtenerPacientePami(pacienteKey);
            if (!data) {
                setNotFound(true);
                return;
            }
            const { medicamentos = {}, ops: opsRaw = {}, internaciones: internRaw = {}, cirugias: cirugRaw = {}, ...datos } = data;
            setPaciente({
                ...datos,
                dni: pacienteKey,
                estado: datos.estado || "activo",
                nombreCompleto: [datos.apellido, datos.nombre].filter(Boolean).join(" "),
            });
            setOps(Object.entries(opsRaw).map(([id, v]) => ({ id, ...v })));
            setInternaciones(Object.entries(internRaw).map(([id, v]) => ({ id, ...v })));
            setCirugias(Object.entries(cirugRaw).map(([id, v]) => ({ id, ...v })));
            setPresupuestos(Object.entries(medicamentos).map(([id, v]) => ({ id, ...v })));
        } catch (e) {
            console.error(e);
            mostrarFlash("No se pudo cargar el paciente.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (pacienteKey) cargarTodo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pacienteKey]);

    const canGenerarEventos = useMemo(() => puedeGenerarEventos(paciente), [paciente]);

    /* ── Acciones ── */
    const handleCambiarEstado = async (nuevoEstado) => {
        if (!confirm(`¿Cambiar el estado del paciente a "${nuevoEstado}"?`)) return;
        try {
            await cambiarEstadoPaciente(pacienteKey, nuevoEstado, { usuario: usuarioActual() });
            await cargarTodo();
            mostrarFlash(`Estado actualizado.`);
        } catch (e) {
            mostrarFlash("No se pudo cambiar el estado.");
        }
    };

    const handleToggleOncoplan = async (nuevoValor) => {
        if (!confirm(nuevoValor ? "¿Marcar este paciente como Oncoplan?" : "¿Quitar la marca Oncoplan?")) return;
        try {
            await setOncoplanPaciente(pacienteKey, nuevoValor, { usuario: usuarioActual() });
            await cargarTodo();
            mostrarFlash(nuevoValor ? "Paciente marcado como ONCOPLAN." : "Oncoplan removido.");
        } catch (e) {
            mostrarFlash("No se pudo actualizar Oncoplan.");
        }
    };

    // En handleEditar, asegurate de tener esto:
    const handleEditar = async (form) => {
        try {
            // Preparamos el objeto para la base de datos, armando el nodo familiar
            const { famNombre, famParentezco, famTelefono, ...resto } = form;
            const dataAGuardar = {
                ...resto,
                dni: pacienteKey,
                familiar: {
                    nombre: famNombre || "",
                    parentezco: famParentezco || "",
                    telefono: famTelefono || ""
                }
            };

            await asegurarPacientePami(dataAGuardar, { usuario: usuarioActual() });
            await cargarTodo();
            mostrarFlash("Datos actualizados correctamente.");
        } catch (e) {
            console.error(e);
            mostrarFlash("No se pudieron guardar los datos.");
        }
    };
    const handleEliminarPaciente = async () => {
        if (!confirm(`¿Eliminar el paciente ${paciente?.nombreCompleto || pacienteKey}?\nSe borrarán también todos sus datos.`)) return;
        try {
            await eliminarPacientePami(pacienteKey);
            router.push("/admin/pami");
        } catch (e) {
            mostrarFlash("No se pudo eliminar el paciente.");
        }
    };

    const handleCambiarEstadoOP = async (opId, nuevoEstado) => {
        try {
            await cambiarEstadoOP(pacienteKey, opId, nuevoEstado, { usuario: usuarioActual() });
            await cargarTodo();
            mostrarFlash("Estado de la OP actualizado.");
        } catch (e) {
            mostrarFlash("No se pudo cambiar el estado de la OP.");
        }
    };

    const handleAsignarNroOP = async (opId) => {
        const nro = prompt("Ingresá el N° de OP asignado por PAMI:");
        if (!nro || !nro.trim()) return;

        try {
            const opRef = ref(db, `PAMI/pacientes/${pacienteKey}/ops/${opId}`);
            await update(opRef, {
                nroOP: nro.trim(),
                estado: "cargado",
                updatedAt: Date.now()
            });
            await cargarTodo();
            mostrarFlash("Número de OP asignado con éxito.");
        } catch (e) {
            console.error(e);
            mostrarFlash("Error al asignar el número de OP.");
        }
    };

    // --- NUEVA FUNCIÓN PARA ELIMINAR UN EVENTO INDIVIDUAL ---
    const handleEliminarEvento = async (tipo, id) => {
        if (!confirm(`¿Estás seguro de que querés eliminar este registro?`)) return;

        try {
            let path = "";
            if (tipo === "op") path = `PAMI/pacientes/${pacienteKey}/ops/${id}`;
            else if (tipo === "internacion") path = `PAMI/pacientes/${pacienteKey}/internaciones/${id}`;
            else if (tipo === "cirugia") path = `PAMI/pacientes/${pacienteKey}/cirugias/${id}`;
            else if (tipo === "presupuesto") path = `PAMI/pacientes/${pacienteKey}/medicamentos/${id}`;

            if (!path) return;

            await remove(ref(db, path));
            await cargarTodo();
            mostrarFlash("Registro eliminado con éxito.");
        } catch (e) {
            console.error(e);
            mostrarFlash("Error al eliminar el registro.");
        }
    };

    const handleCerrarInternacion = async (pamiId) => {
        if (!confirm("¿Cerrar esta internación? Se registrará la fecha de egreso como hoy.")) return;
        try {
            await cerrarInternacionPami(pacienteKey, pamiId, { usuario: usuarioActual() });
            await cargarTodo();
            mostrarFlash("Internación cerrada.");
        } catch (e) {
            mostrarFlash("No se pudo cerrar la internación.");
        }
    };

    const handleCerrarCirugia = async (pamiId) => {
        if (!confirm("¿Marcar la cirugía como realizada?")) return;
        try {
            await cerrarCirugiaPami(pacienteKey, pamiId, { usuario: usuarioActual() });
            await cargarTodo();
            mostrarFlash("Cirugía marcada como realizada.");
        } catch (e) {
            mostrarFlash("No se pudo actualizar la cirugía.");
        }
    };

    const handleNuevaOP = () => router.push(`/admin/pami/nuevo?pacienteKey=${pacienteKey}&tipo=op`);
    const handleNuevaInternacionDesdeOP = (opId) => router.push(`/admin/pami/nuevo?pacienteKey=${pacienteKey}&opId=${opId}&tipo=internacion`);
    const handleNuevaCirugiaDesdeOP = (opId) => router.push(`/admin/pami/nuevo?pacienteKey=${pacienteKey}&opId=${opId}&tipo=cirugia`);
    const handleAbrirPresupuesto = () => router.push("/admin/pami/presupuestos");
    const handleAbrirIngreso = (ingresosId) => router.push(`/ingresos?id=${ingresosId}`);

    /* ── Render ── */
    if (loading) {
        return <div className={styles.ficha}><div className={styles.loading}>Cargando paciente…</div></div>;
    }

    if (notFound || !paciente) {
        return (
            <div className={styles.ficha}>
                <button className={styles.btn} onClick={() => router.push("/admin/pami")} style={{ alignSelf: "flex-start", marginBottom: "1rem" }}>
                    ← Volver al Dashboard
                </button>
                <div className={styles.notFound}>
                    <h2>Paciente no encontrado</h2>
                    <p>No hay datos para DNI {pacienteKey}.</p>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.ficha}>
            {flash && <div className={styles.toast}>{flash}</div>}

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
                <button type="button" className={styles.btn} onClick={() => router.push("/admin/pami")}>
                    ← Volver al Dashboard
                </button>
            </div>

            <PacienteHeader
                paciente={paciente}
                canGenerarEventos={canGenerarEventos}
                onCambiarEstado={handleCambiarEstado}
                onToggleOncoplan={handleToggleOncoplan}
                onEditar={handleEditar}
                onNuevaOP={handleNuevaOP}
                onEliminar={handleEliminarPaciente}
            />

            <PacienteTimeline
                pacienteKey={pacienteKey}
                ops={ops}
                internaciones={internaciones}
                cirugias={cirugias}
                presupuestos={presupuestos}
                onChangeEstadoOP={handleCambiarEstadoOP}
                onCerrarInternacion={handleCerrarInternacion}
                onCerrarCirugia={handleCerrarCirugia}
                onAbrirPresupuesto={handleAbrirPresupuesto}
                onAbrirIngreso={handleAbrirIngreso}
                onNuevaInternacionDesdeOP={canGenerarEventos ? handleNuevaInternacionDesdeOP : null}
                onNuevaCirugiaDesdeOP={canGenerarEventos ? handleNuevaCirugiaDesdeOP : null}
                onAsignarNroOP={handleAsignarNroOP}
                onEliminarEvento={handleEliminarEvento} // <-- NUEVA PROP
            />
        </div>
    );
}
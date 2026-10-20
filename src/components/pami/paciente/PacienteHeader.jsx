"use client";
import { useState } from "react";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";
import OncoplanBadge from "@/components/pami/presupuesto/OncoplanBadge";
import { ESTADOS_PACIENTE, estadoDef } from "@/lib/pami/pacientes";
import styles from "./paciente.module.css";

const fmtEdad = (fechaISO) => {
    if (!fechaISO) return "";
    const [y, m, d] = String(fechaISO).split("-").map(Number);
    if (!y || !m || !d) return "";
    const hoy = new Date();
    let edad = hoy.getFullYear() - y;
    if (hoy.getMonth() + 1 < m || (hoy.getMonth() + 1 === m && hoy.getDate() < d)) edad--;
    return `${edad} años`;
};

const fmtFecha = (iso) => {
    if (!iso) return "";
    const [y, m, d] = String(iso).split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
};

export default function PacienteHeader({
    paciente,
    onCambiarEstado,
    onToggleOncoplan,
    onEditar,
    onNuevaOP,
    onEliminar,
    canGenerarEventos,
}) {
    const [estadoMenuOpen, setEstadoMenuOpen] = useState(false);
    const [editando, setEditando] = useState(false);
    const [form, setForm] = useState(() => ({
        apellido: paciente.apellido || "",
        nombre: paciente.nombre || "",
        afiliado: paciente.afiliado || "",
        historiaClinica: paciente.historiaClinica || "",
        sexo: paciente.sexo || "",
        fechaNacimiento: paciente.fechaNacimiento || "",
        telefono: paciente.telefono || "",
        domicilio: paciente.domicilio || "",
        localidad: paciente.localidad || "",
        provincia: paciente.provincia || "",
        lugarNacimiento: paciente.lugarNacimiento || "",
        cirujano: paciente.cirujano || "",
        ayudante1: paciente.ayudante1 || "",
        ayudante2: paciente.ayudante2 || "",
        anestesista: paciente.anestesista || "",
        famNombre: paciente.familiar?.nombre || "",
        famParentezco: paciente.familiar?.parentezco || "",
        famTelefono: paciente.familiar?.telefono || "",
    }));

    const eDef = estadoDef(paciente.estado);
    const nombreCompleto = paciente.nombreCompleto || [paciente.apellido, paciente.nombre].filter(Boolean).join(" ");
    const edad = fmtEdad(paciente.fechaNacimiento);

    const onField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const guardarEdicion = () => {
        onEditar?.(form);
        setEditando(false);
    };

    return (
        <section className={styles.header}>
            <div className={styles.headerTop}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h1 className={styles.nombre}>{nombreCompleto || `DNI ${paciente.dni}`}</h1>
                    <div className={styles.subtitulo}>
                        DNI {paciente.dni}
                        {paciente.afiliado && ` · Afiliado ${paciente.afiliado}`}
                        {paciente.historiaClinica && ` · HC ${paciente.historiaClinica}`}
                        {edad && ` · ${edad}`}
                        {paciente.sexo && ` · ${paciente.sexo === "M" ? "Masculino" : paciente.sexo === "F" ? "Femenino" : paciente.sexo}`}
                    </div>
                    <div className={styles.badges}>
                        {paciente.oncoplan && <span className={`${styles.badgeBase} ${styles.badgeOncoplan}`}>ONCOPLAN</span>}
                        <span
                            className={`${styles.badgeBase} ${styles.badgeEstado}`}
                            style={{ color: eDef.color, borderColor: eDef.color, background: eDef.bg }}
                        >
                            {eDef.icon} {eDef.label}
                        </span>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        onClick={onNuevaOP}
                        disabled={!canGenerarEventos}
                        title={!canGenerarEventos ? "Paciente fallecido: no se pueden generar nuevas OP" : "Crear nueva OP"}
                    >
                        + Nueva OP
                    </button>

                    <details
                        className={styles.estadoMenu}
                        open={estadoMenuOpen}
                        onToggle={(e) => setEstadoMenuOpen(e.currentTarget.open)}
                    >
                        <summary className={styles.estadoMenuSummary}>Cambiar estado</summary>
                        <div className={styles.estadoMenuList}>
                            {ESTADOS_PACIENTE.map((e) => (
                                <button
                                    key={e.id}
                                    type="button"
                                    onClick={() => {
                                        setEstadoMenuOpen(false);
                                        if (e.id !== paciente.estado) onCambiarEstado?.(e.id);
                                    }}
                                >
                                    <span className={styles.estadoDot} style={{ background: e.color }} />
                                    {e.label}
                                    {e.id === paciente.estado && " ✓"}
                                </button>
                            ))}
                        </div>
                    </details>

                    <button
                        type="button"
                        className={styles.btn}
                        onClick={() => onToggleOncoplan?.(!paciente.oncoplan)}
                        title={paciente.oncoplan ? "Quitar Oncoplan" : "Marcar como Oncoplan"}
                    >
                        {paciente.oncoplan ? "Quitar ONCOPLAN" : "Marcar ONCOPLAN"}
                    </button>

                    <button type="button" className={styles.btn} onClick={() => setEditando((v) => !v)}>
                        {editando ? "Cancelar edición" : "✏️ Editar datos"}
                    </button>

                    {onEliminar && (
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.btnDanger}`}
                            onClick={onEliminar}
                        >
                            🗑️ Eliminar
                        </button>
                    )}
                </div>
            </div>

            {paciente.estado === "fallecido" && (
                <div className={styles.warnBanner}>
                    <span>⚠️</span>
                    <div>
                        Este paciente está marcado como <strong>fallecido</strong> desde{" "}
                        {paciente.estadoCambiado?.fecha
                            ? new Date(paciente.estadoCambiado.fecha).toLocaleDateString("es-AR")
                            : "—"}
                        . No se pueden generar nuevas OP ni eventos.
                    </div>
                </div>
            )}

            {!editando && (
                <dl className={styles.headerGrid}>
                    <div><dt>Teléfono</dt><dd>{paciente.telefono || "—"}</dd></div>
                    <div><dt>Domicilio</dt><dd>{paciente.domicilio || "—"}</dd></div>
                    <div><dt>Localidad</dt><dd>{paciente.localidad || "—"}</dd></div>
                    <div><dt>Provincia</dt><dd>{paciente.provincia || "—"}</dd></div>
                    <div><dt>Nacimiento</dt><dd>{fmtFecha(paciente.fechaNacimiento) || "—"}</dd></div>
                    <div><dt>Lugar nac.</dt><dd>{paciente.lugarNacimiento || "—"}</dd></div>
                    {(paciente.familiar?.nombre || paciente.familiar?.telefono) && (
                        <div style={{ gridColumn: "1 / -1" }}>
                            <dt>Familiar</dt>
                            <dd>
                                {paciente.familiar?.nombre || "—"}
                                {paciente.familiar?.parentezco && ` (${paciente.familiar.parentezco})`}
                                {paciente.familiar?.telefono && ` · ${paciente.familiar.telefono}`}
                            </dd>
                        </div>
                    )}
                    {(paciente.cirujano || paciente.anestesista || paciente.ayudante1 || paciente.ayudante2) && (
                        <div style={{ gridColumn: "1 / -1" }}>
                            <dt>Equipo médico</dt>
                            <dd>
                                {[
                                    paciente.cirujano && `Cirujano: ${paciente.cirujano}`,
                                    paciente.ayudante1 && `Ay. 1: ${paciente.ayudante1}`,
                                    paciente.ayudante2 && `Ay. 2: ${paciente.ayudante2}`,
                                    paciente.anestesista && `Anestesista: ${paciente.anestesista}`,
                                ].filter(Boolean).join(" · ") || "—"}
                            </dd>
                        </div>
                    )}
                </dl>
            )}

            {editando && (
                <div className={styles.editPanel}>
                    <div className={styles.editGrid}>
                        {[
                            ["apellido", "Apellido"],
                            ["nombre", "Nombre"],
                            ["afiliado", "N° afiliado PAMI"],
                            ["historiaClinica", "Historia clínica"],
                            ["fechaNacimiento", "Fecha de nacimiento", "date"],
                            ["telefono", "Teléfono", "tel"],
                            ["domicilio", "Domicilio"],
                            ["localidad", "Localidad"],
                            ["provincia", "Provincia"],
                            ["lugarNacimiento", "Lugar de nacimiento"],
                            ["cirujano", "Cirujano"],
                            ["anestesista", "Anestesista"],
                            ["ayudante1", "Ayudante 1"],
                            ["ayudante2", "Ayudante 2"],
                            ["famNombre", "Familiar — nombre"],
                            ["famParentezco", "Familiar — parentesco"],
                            ["famTelefono", "Familiar — teléfono", "tel"],
                        ].map(([key, label, type]) => (
                            <label key={key} className={styles.editField}>
                                <span>{label}</span>
                                <input
                                    className={styles.input}
                                    type={type || "text"}
                                    value={form[key] || ""}
                                    onChange={onField(key)}
                                />
                            </label>
                        ))}
                        <label className={styles.editField}>
                            <span>Sexo</span>
                            <select className={styles.input} value={form.sexo} onChange={onField("sexo")}>
                                <option value="">—</option>
                                <option value="M">Masculino</option>
                                <option value="F">Femenino</option>
                            </select>
                        </label>
                    </div>
                    <div className={styles.editActions}>
                        <button type="button" className={styles.btn} onClick={() => setEditando(false)}>Cancelar</button>
                        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={guardarEdicion}>
                            Guardar cambios
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
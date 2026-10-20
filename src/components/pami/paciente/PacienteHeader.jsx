"use client";
import { useState } from "react";
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

export default function PacienteHeader({
    paciente, onCambiarEstado, onToggleOncoplan, onEditar, onNuevaOP, onEliminar, canGenerarEventos,
}) {
    const [editando, setEditando] = useState(false);
    const [copiedField, setCopiedField] = useState(null);

    // Estado para el form de edición (mapeado desde el objeto paciente)
    const [form, setForm] = useState(() => ({
        apellido: paciente.apellido || "", nombre: paciente.nombre || "",
        afiliado: paciente.afiliado || "", historiaClinica: paciente.historiaClinica || "",
        sexo: paciente.sexo || "", fechaNacimiento: paciente.fechaNacimiento || "",
        telefono: paciente.telefono || "", domicilio: paciente.domicilio || "",
        localidad: paciente.localidad || "", provincia: paciente.provincia || "",
        famNombre: paciente.familiar?.nombre || "",
        famParentezco: paciente.familiar?.parentezco || "",
        famTelefono: paciente.familiar?.telefono || "",
        cirujano: paciente.cirujano || "", ayudante1: paciente.ayudante1 || "",
        ayudante2: paciente.ayudante2 || "", anestesista: paciente.anestesista || "",
    }));

    const eDef = estadoDef(paciente.estado);
    const nombreCompleto = [paciente.apellido, paciente.nombre].filter(Boolean).join(" ") || `DNI ${paciente.dni}`;
    const edad = fmtEdad(paciente.fechaNacimiento);

    const onField = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
    const guardarEdicion = () => { onEditar?.(form); setEditando(false); };

    const copiar = (text, field) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedField(field);
        setTimeout(() => setCopiedField(null), 2000);
    };

    return (
        <section className={styles.header}>
            <div className={styles.headerTop}>
                <div style={{ minWidth: 0, flex: 1 }}>
                    <h1 className={styles.nombre}>{nombreCompleto}</h1>

                    <div className={styles.subtitulo}>
                        {edad && <span>🎂 {edad}</span>}
                        {paciente.sexo && <span>👤 {paciente.sexo === "M" ? "Masculino" : "Femenino"}</span>}
                        {paciente.telefono && <span>📞 {paciente.telefono}</span>}
                    </div>

                    <div className={styles.badges}>
                        {paciente.oncoplan && <span className={`${styles.badgeBase} ${styles.badgeOncoplan}`}>ONCOPLAN</span>}
                        <span className={`${styles.badgeBase} ${styles.badgeEstado}`} style={{ color: eDef.color, borderColor: eDef.color, background: eDef.bg }}>
                            {eDef.icon} {eDef.label}
                        </span>
                    </div>
                </div>

                <div className={styles.headerActions}>
                    <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onNuevaOP} disabled={!canGenerarEventos}>
                        + Nueva OP
                    </button>
                    <button type="button" className={styles.btn} onClick={() => setEditando(!editando)}>
                        ✏️ {editando ? "Cancelar" : "Editar"}
                    </button>

                    <details className={styles.estadoMenu}>
                        <summary className={styles.estadoMenuSummary}>Estado</summary>
                        <div className={styles.estadoMenuList}>
                            {ESTADOS_PACIENTE.map((e) => (
                                <button key={e.id} type="button" onClick={() => { if (e.id !== paciente.estado) onCambiarEstado?.(e.id); }}>
                                    <span className={styles.estadoDot} style={{ background: e.color }} />
                                    {e.label}
                                </button>
                            ))}
                        </div>
                    </details>

                    {paciente.oncoplan ? (
                        <button type="button" className={styles.btn} onClick={() => onToggleOncoplan?.(false)}>Quitar ONC</button>
                    ) : (
                        <button type="button" className={styles.btn} onClick={() => onToggleOncoplan?.(true)}>+ ONCOPLAN</button>
                    )}
                    <button type="button" className={`${styles.btn} ${styles.btnDanger}`} onClick={onEliminar}>Eliminar</button>
                </div>
            </div>

            {/* DATOS GRANDES CON BOTONES DE COPIADO */}
            {!editando && (
                <>
                    <div className={styles.headerGrid} style={{ marginTop: "1rem" }}>
                        <div className={styles.datoBox}>
                            <span className={styles.datoLabel}>DNI</span>
                            <span className={styles.datoValor}>{paciente.dni}</span>
                            <button className={styles.btnCopiar} onClick={() => copiar(paciente.dni, 'dni')}>{copiedField === 'dni' ? "✅" : "📋"}</button>
                        </div>
                        <div className={styles.datoBox}>
                            <span className={styles.datoLabel}>N° AFILIADO PAMI</span>
                            <span className={styles.datoValor}>{paciente.afiliado || "—"}</span>
                            <button className={styles.btnCopiar} onClick={() => copiar(paciente.afiliado?.split('/')[0] || "", 'afil')}>{copiedField === 'afil' ? "✅" : "📋"}</button>
                        </div>
                        <div className={styles.datoBox}>
                            <span className={styles.datoLabel}>HISTORIA CLÍNICA</span>
                            <span className={styles.datoValor}>{paciente.historiaClinica || "—"}</span>
                            <button className={styles.btnCopiar} onClick={() => copiar(paciente.historiaClinica, 'hc')}>{copiedField === 'hc' ? "✅" : "📋"}</button>
                        </div>
                        <div className={styles.datoBox}>
                            <span className={styles.datoLabel}>TELÉFONO</span>
                            <span className={styles.datoValor}>{paciente.telefono || "—"}</span>
                        </div>
                    </div>

                    <div className={styles.headerGrid} style={{ marginTop: "1rem" }}>
                        <div className={styles.datoBox} style={{ gridColumn: "1 / -1" }}>
                            <span className={styles.datoLabel}>DOMICILIO COMPLETO</span>
                            <span className={styles.datoValor}>
                                {paciente.domicilio || "—"} {paciente.localidad ? `, ${paciente.localidad}` : ""} {paciente.provincia ? `, ${paciente.provincia}` : ""}
                            </span>
                        </div>
                    </div>

                    {/* FAMILIAR RESPONSABLE */}
                    {(paciente.familiar?.nombre || paciente.familiar?.telefono) && (
                        <div style={{ marginTop: "1rem" }}>
                            <h4 className={styles.datoLabel} style={{ marginBottom: "0.5rem" }}>Familiar Responsable</h4>
                            <div className={styles.headerGrid}>
                                <div className={styles.datoBox}>
                                    <span className={styles.datoLabel}>NOMBRE Y PARENTESCO</span>
                                    <span className={styles.datoValor}>{paciente.familiar?.nombre} ({paciente.familiar?.parentezco})</span>
                                </div>
                                <div className={styles.datoBox}>
                                    <span className={styles.datoLabel}>TELÉFONO</span>
                                    <span className={styles.datoValor}>{paciente.familiar?.telefono || "—"}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* EQUIPO MÉDICO */}
                    {(paciente.cirujano || paciente.anestesista) && (
                        <div style={{ marginTop: "1rem" }}>
                            <h4 className={styles.datoLabel} style={{ marginBottom: "0.5rem" }}>Equipo Médico</h4>
                            <div className={styles.headerGrid}>
                                <div className={styles.datoBox}><span className={styles.datoLabel}>CIRUJANO</span><span className={styles.datoValor}>{paciente.cirujano || "—"}</span></div>
                                <div className={styles.datoBox}><span className={styles.datoLabel}>ANESTESISTA</span><span className={styles.datoValor}>{paciente.anestesista || "—"}</span></div>
                                <div className={styles.datoBox}><span className={styles.datoLabel}>AYUDANTE 1</span><span className={styles.datoValor}>{paciente.ayudante1 || "—"}</span></div>
                                <div className={styles.datoBox}><span className={styles.datoLabel}>AYUDANTE 2</span><span className={styles.datoValor}>{paciente.ayudante2 || "—"}</span></div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* FORMULARIO DE EDICIÓN EXPANDIDO */}
            {editando && (
                <div className={styles.editPanel}>
                    <h3 style={{ marginBottom: "1rem", fontSize: "1.1rem" }}>Editar Datos del Paciente</h3>
                    <div className={styles.editGrid}>
                        <label className={styles.editField}><span>Apellido</span><input className={styles.input} value={form.apellido} onChange={onField("apellido")} /></label>
                        <label className={styles.editField}><span>Nombre</span><input className={styles.input} value={form.nombre} onChange={onField("nombre")} /></label>
                        <label className={styles.editField}><span>DNI</span><input className={styles.input} value={form.afiliado} onChange={onField("afiliado")} /></label>
                        <label className={styles.editField}><span>N° Afiliado</span><input className={styles.input} value={form.afiliado} onChange={onField("afiliado")} /></label>
                        <label className={styles.editField}><span>Historia Clínica</span><input className={styles.input} value={form.historiaClinica} onChange={onField("historiaClinica")} /></label>
                        <label className={styles.editField}><span>Teléfono</span><input className={styles.input} value={form.telefono} onChange={onField("telefono")} /></label>
                        <label className={styles.editField}><span>Domicilio</span><input className={styles.input} value={form.domicilio} onChange={onField("domicilio")} /></label>
                        <label className={styles.editField}><span>Localidad</span><input className={styles.input} value={form.localidad} onChange={onField("localidad")} /></label>
                        <label className={styles.editField}><span>Provincia</span><input className={styles.input} value={form.provincia} onChange={onField("provincia")} /></label>

                        <label className={styles.editField}><span>Familiar: Nombre</span><input className={styles.input} value={form.famNombre} onChange={onField("famNombre")} /></label>
                        <label className={styles.editField}><span>Familiar: Parentesco</span><input className={styles.input} value={form.famParentezco} onChange={onField("famParentezco")} /></label>
                        <label className={styles.editField}><span>Familiar: Teléfono</span><input className={styles.input} value={form.famTelefono} onChange={onField("famTelefono")} /></label>

                        <label className={styles.editField}><span>Cirujano</span><input className={styles.input} value={form.cirujano} onChange={onField("cirujano")} /></label>
                        <label className={styles.editField}><span>Anestesista</span><input className={styles.input} value={form.anestesista} onChange={onField("anestesista")} /></label>
                        <label className={styles.editField}><span>Ayudante 1</span><input className={styles.input} value={form.ayudante1} onChange={onField("ayudante1")} /></label>
                        <label className={styles.editField}><span>Ayudante 2</span><input className={styles.input} value={form.ayudante2} onChange={onField("ayudante2")} /></label>
                    </div>
                    <div className={styles.editActions}>
                        <button type="button" className={styles.btn} onClick={() => setEditando(false)}>Cancelar</button>
                        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={guardarEdicion}>Guardar Cambios</button>
                    </div>
                </div>
            )}
        </section>
    );
}
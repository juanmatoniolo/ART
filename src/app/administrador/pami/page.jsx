"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { ref, onValue, update, push, set, remove } from "firebase/database";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import { eliminarPacientePami } from "@/lib/pami";
import { listarTodasLasOPs, ESTADOS_OP, cambiarEstadoOP } from "@/lib/pami/op";
import { listarTodasLasInternaciones } from "@/lib/pami/internaciones";
import { listarTodasLasCirugias } from "@/lib/pami/cirugias";
import { listarBorradoresGlobales, eliminarPresupuestoPami } from "@/lib/pami/presupuestos";
import { ESTADOS_PACIENTE, estadoDef } from "@/lib/pami/pacientes";
import BorradoresList from "@/components/pami/presupuesto/BorradoresList";
import EstadisticasPanel from "@/components/pami/presupuesto/EstadisticasPanel";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

const p = styles;

// ============================================================
// Helper para URLs (agrega https:// si falta el protocolo)
// ============================================================
function normalizeUrl(url) {
    if (!url) return "";
    const u = url.trim();
    if (!u) return "";
    if (/^https?:\/\//i.test(u)) return u;
    return `https://${u}`;
}

// ============================================================
// TAB: Mis claves (usuarios y contraseñas de páginas)
// ============================================================
function TabClaves({ claves, onSave, onDelete }) {
    const [q, setQ] = useState("");
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ nombre: "", usuario: "", password: "", link: "", notas: "" });
    const [showPass, setShowPass] = useState({});
    const [showFormPass, setShowFormPass] = useState(false);
    const [copied, setCopied] = useState(null);

    const handleCopy = async (text, field) => {
        if (!text) return;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(field);
            setTimeout(() => setCopied(null), 2000);
        } catch (e) {
            console.error("No se pudo copiar:", e);
        }
    };

    const resetForm = () => {
        setForm({ nombre: "", usuario: "", password: "", link: "", notas: "" });
        setEditingId(null);
        setShowForm(false);
        setShowFormPass(false);
    };

    const handleEdit = (c) => {
        setForm({
            nombre: c.nombre || "",
            usuario: c.usuario || "",
            password: c.password || "",
            link: c.link || "",
            notas: c.notas || "",
        });
        setEditingId(c.id);
        setShowForm(true);
        setShowFormPass(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.nombre.trim()) {
            alert("El nombre es obligatorio (ej: PAMI GUERRICO).");
            return;
        }
        await onSave({ ...form, id: editingId });
        resetForm();
    };

    const filtradas = useMemo(() => {
        let lista = claves;
        const query = q.trim();
        if (query) {
            lista = lista.filter((c) =>
                matchesAllTerms(`${c.nombre || ""} ${c.usuario || ""} ${c.link || ""} ${c.notas || ""}`, query)
            );
        }
        return [...lista].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [claves, q]);

    return (
        <section className={p.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
                <h3 className={p.cardTitle} style={{ margin: 0 }}>🔐 Mis claves</h3>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                    <input
                        className={p.input}
                        style={{ maxWidth: "250px" }}
                        type="search"
                        placeholder="Buscar nombre, usuario o link…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                    />
                    <button
                        type="button"
                        className={`${p.btn} ${p.btnPrimary}`}
                        onClick={() => { resetForm(); setShowForm(true); }}
                    >
                        + Nueva clave
                    </button>
                </div>
            </div>

            {showForm && (
                <form
                    onSubmit={handleSubmit}
                    style={{
                        padding: "1rem",
                        background: "var(--surface-2)",
                        border: "1px solid var(--accent-border)",
                        borderRadius: "8px",
                        marginBottom: "1rem",
                        display: "grid",
                        gap: "0.5rem",
                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    }}
                >
                    <input
                        className={p.input}
                        placeholder="Nombre (ej: PAMI GUERRICO)"
                        value={form.nombre}
                        onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                        autoFocus
                    />
                    <input
                        className={p.input}
                        placeholder="Usuario"
                        value={form.usuario}
                        onChange={(e) => setForm({ ...form, usuario: e.target.value })}
                        autoComplete="off"
                    />
                    <div style={{ position: "relative", display: "flex" }}>
                        <input
                            className={p.input}
                            style={{ flex: 1, paddingRight: "2.2rem" }}
                            type={showFormPass ? "text" : "password"}
                            placeholder="Contraseña"
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            autoComplete="new-password"
                        />
                        <button
                            type="button"
                            onClick={() => setShowFormPass((v) => !v)}
                            style={{
                                position: "absolute",
                                right: 4,
                                top: "50%",
                                transform: "translateY(-50%)",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "1rem",
                                padding: "4px 8px",
                            }}
                            title={showFormPass ? "Ocultar" : "Mostrar"}
                        >
                            {showFormPass ? "🙈" : "👁️"}
                        </button>
                    </div>
                    <input
                        className={p.input}
                        placeholder="Link (https://...)"
                        value={form.link}
                        onChange={(e) => setForm({ ...form, link: e.target.value })}
                        autoComplete="off"
                    />
                    <input
                        className={p.input}
                        placeholder="Notas (opcional)"
                        value={form.notas}
                        onChange={(e) => setForm({ ...form, notas: e.target.value })}
                        style={{ gridColumn: "1 / -1" }}
                    />
                    <div style={{ gridColumn: "1 / -1", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <button type="submit" className={`${p.btn} ${p.btnPrimary}`}>
                            {editingId ? "Guardar cambios" : "Agregar"}
                        </button>
                        <button type="button" className={p.btn} onClick={resetForm}>
                            Cancelar
                        </button>
                    </div>
                </form>
            )}

            <p className={p.hint}>
                {filtradas.length} {filtradas.length === 1 ? "clave guardada" : "claves guardadas"}.
            </p>

            {filtradas.length === 0 ? (
                <div className={p.empty}>No hay claves guardadas todavía.</div>
            ) : (
                <ul className={p.list}>
                    {filtradas.map((c) => {
                        const linkUrl = normalizeUrl(c.link);
                        return (
                            <li
                                key={c.id}
                                className={p.row}
                                style={{ alignItems: "flex-start", flexDirection: "column", gap: "0.75rem" }}
                            >
                                {/* Encabezado: nombre + acciones */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", gap: "0.5rem", flexWrap: "wrap" }}>
                                    <div className={p.rowName} style={{ wordBreak: "break-word" }}>
                                        {c.nombre}
                                    </div>
                                    <div className={p.rowActions}>
                                        <button type="button" className={`${p.btn} ${p.btnSm}`} onClick={() => handleEdit(c)}>
                                            ✏️ Editar
                                        </button>
                                        <button type="button" className={`${p.btn} ${p.btnSm} ${p.btnDangerSm}`} onClick={() => onDelete(c)}>
                                            🗑️
                                        </button>
                                    </div>
                                </div>

                                {/* Tarjetas de campos */}
                                <div
                                    style={{
                                        display: "grid",
                                        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                                        gap: "0.5rem",
                                        width: "100%",
                                    }}
                                >
                                    {/* Usuario */}
                                    <div
                                        style={{
                                            background: "var(--surface-2)",
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            minWidth: 0,
                                        }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>USUARIO</div>
                                            <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {c.usuario || "—"}
                                            </div>
                                        </div>
                                        {c.usuario && (
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(c.usuario, `u-${c.id}`)}
                                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }}
                                                title="Copiar usuario"
                                            >
                                                {copied === `u-${c.id}` ? "✅" : "📋"}
                                            </button>
                                        )}
                                    </div>

                                    {/* Contraseña */}
                                    <div
                                        style={{
                                            background: "var(--surface-2)",
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            minWidth: 0,
                                        }}
                                    >
                                        <div style={{ minWidth: 0 }}>
                                            <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>CONTRASEÑA</div>
                                            <div style={{ fontWeight: 700, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {showPass[c.id]
                                                    ? (c.password || "—")
                                                    : "•".repeat(Math.min(Math.max((c.password || "").length, 8), 14))}
                                            </div>
                                        </div>
                                        {c.password && (
                                            <div style={{ display: "flex", gap: "4px" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPass((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                                                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }}
                                                    title={showPass[c.id] ? "Ocultar contraseña" : "Mostrar contraseña"}
                                                >
                                                    {showPass[c.id] ? "🙈" : "👁️"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(c.password, `pw-${c.id}`)}
                                                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }}
                                                    title="Copiar contraseña"
                                                >
                                                    {copied === `pw-${c.id}` ? "✅" : "📋"}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Link */}
                                    <div
                                        style={{
                                            background: "var(--surface-2)",
                                            padding: "0.5rem 0.75rem",
                                            borderRadius: "6px",
                                            border: "1px solid var(--border)",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            alignItems: "center",
                                            gridColumn: "1 / -1",
                                            minWidth: 0,
                                        }}
                                    >
                                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                                            <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>LINK</div>
                                            {linkUrl ? (
                                                <a
                                                    href={linkUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ color: "var(--accent)", fontWeight: 700, wordBreak: "break-all" }}
                                                >
                                                    {c.link}
                                                </a>
                                            ) : (
                                                <div style={{ fontWeight: 700 }}>—</div>
                                            )}
                                        </div>
                                        {linkUrl && (
                                            <div style={{ display: "flex", gap: "4px" }}>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopy(c.link, `l-${c.id}`)}
                                                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }}
                                                    title="Copiar link"
                                                >
                                                    {copied === `l-${c.id}` ? "✅" : "📋"}
                                                </button>
                                                <a
                                                    href={linkUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ textDecoration: "none", fontSize: "1.1rem", padding: "4px" }}
                                                    title="Abrir link"
                                                >
                                                    🔗
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {c.notas && (
                                    <div style={{ fontSize: "0.85rem", color: "var(--muted)", width: "100%" }}>
                                        📝 {c.notas}
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}

// ============================================================
// TAB: Pacientes (sin cambios)
// ============================================================
function TabPacientes({ pacientesDb, ops, onAbrirPaciente, onEliminarPaciente, onAgregarOP, onToggleOncoplan, onAsignarNroOP }) {
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
                return opsPac.some(o => o.estado === "solicitado");
            });
        } else if (filtroPendientes === "oncoplan_pendiente") {
            lista = lista.filter((pac) => pac.oncoplan && pac.oncoplanEstado !== "habilitado");
        }

        return lista.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }, [pacientesDb, ops, q, filtroPendientes]);

    const enviarWhatsApp = (paciente) => {
        if (!paciente.telefono) return alert("El paciente no tiene un teléfono registrado.");

        let tel = String(paciente.telefono).replace(/\D/g, "");
        if (!tel.startsWith("54")) tel = `549${tel}`;

        const texto = encodeURIComponent(`Hola ${paciente.apellido}, ${paciente.nombre}, le escribimos de Clínica de la Unión. 🏥`);

        window.open(`https://web.whatsapp.com/send?phone=${tel}&text=${texto}`, "_blank");
    };

    return (
        <section className={p.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}>
                <h3 className={p.cardTitle} style={{ margin: 0 }}>Pacientes registrados</h3>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }}>
                    <select className={p.input} style={{ maxWidth: "200px" }} value={filtroPendientes} onChange={(e) => setFiltroPendientes(e.target.value)}>
                        <option value="todos">Todos los pacientes</option>
                        <option value="op_pendiente">Con OP Pendiente (Falta N°)</option>
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

                    const opPendienteObj = ops.find(o => o.pacienteDni === x.dni && o.estado === "solicitado");
                    const opListaObj = ops.find(o => o.pacienteDni === x.dni && (o.estado === "cargado" || o.estado === "aceptado"));

                    const isExpanded = expandidoDni === x.dni;

                    return (
                        <li key={x.dni} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>

                            <div
                                className={p.row}
                                style={{ cursor: "pointer", borderColor: isExpanded ? "var(--accent)" : "var(--border)" }}
                                onClick={() => setExpandidoDni(isExpanded ? null : x.dni)}
                            >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                    <div className={p.rowName} style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                                        <span>{x.apellido || ""}, {x.nombre || ""}</span>

                                        {isOncPending && <span style={{ fontSize: 10, padding: "2px 6px", background: "#f59e0b", color: "#fff", borderRadius: 4, fontWeight: "bold" }}>ONCOPLAN PENDIENTE</span>}
                                        {isOncHab && <span style={{ fontSize: 10, padding: "2px 6px", background: "#e11d48", color: "#fff", borderRadius: 4, fontWeight: "bold" }}>ONCOPLAN</span>}

                                        {opPendienteObj && (
                                            <span
                                                onClick={(e) => { e.stopPropagation(); onAsignarNroOP(x.dni, opPendienteObj.id); }}
                                                style={{ fontSize: 10, padding: "2px 6px", background: "#f59e0b", color: "#000", borderRadius: 4, fontWeight: "bold", cursor: "pointer", border: "1px solid #d97706" }}
                                                title="Hacé clic para cargar el N° de OP"
                                            >
                                                ⚠️ Cargar N° OP
                                            </span>
                                        )}

                                        {opListaObj && (
                                            <span style={{ fontSize: 10, padding: "2px 6px", background: "#2f6f4e", color: "#fff", borderRadius: 4, fontWeight: "bold" }}>
                                                ✅ OP LISTA (N° {opListaObj.nroOP})
                                            </span>
                                        )}
                                    </div>
                                    <div className={p.rowMeta}>
                                        DNI {x.dni} · Afiliado {x.afiliado || "—"} · Tel: {x.telefono || "—"}
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

                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem" }}>
                                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div style={{ minWidth: 0 }}>
                                                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>NOMBRE</div>
                                                <div style={{ fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.apellido}, {x.nombre}</div>
                                            </div>
                                            <button onClick={() => handleCopy(`${x.apellido}, ${x.nombre}`, `nom-${x.dni}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }} title="Copiar Nombre">
                                                {copiedField === `nom-${x.dni}` ? "✅" : "📋"}
                                            </button>
                                        </div>
                                        <div style={{ background: "var(--surface)", padding: "0.75rem", borderRadius: "6px", border: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                            <div>
                                                <div style={{ fontSize: "0.7rem", color: "var(--muted)", fontWeight: 700 }}>DNI</div>
                                                <div style={{ fontWeight: 800 }}>{x.dni}</div>
                                            </div>
                                            <button onClick={() => handleCopy(x.dni, `dni-${x.dni}`)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.1rem", padding: "4px" }} title="Copiar DNI">
                                                {copiedField === `dni-${x.dni}` ? "✅" : "📋"}
                                            </button>
                                        </div>
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

// ============================================================
// TAB: OPs (sin cambios)
// ============================================================
function TabOPs({ ops, onAbrirPaciente, onCambiarEstado }) {
    const [q, setQ] = useState("");
    const [filtroEstado, setFiltroEstado] = useState("todos");

    const filtradas = useMemo(() => {
        let lista = ops;
        const query = q.trim();
        if (query) lista = lista.filter((o) => matchesAllTerms(`${o.pacienteNombre} ${o.pacienteDni} ${o.nroOP || ""} ${o.diagnostico || ""}`, query));
        if (filtroEstado !== "todos") lista = lista.filter((o) => o.estado === filtroEstado);
        return lista;
    }, [ops, q, filtroEstado]);

    return (
        <section className={p.card}>
            <h3 className={p.cardTitle}>Órdenes de prestación (OPs)</h3>
            <div className={p.grid2} style={{ marginBottom: "1rem" }}>
                <input className={p.input} type="search" placeholder="Buscar por paciente, N° OP o diagnóstico…" value={q} onChange={(e) => setQ(e.target.value)} />
                <select className={p.input} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
                    <option value="todos">Todos los estados</option>
                    {ESTADOS_OP.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                </select>
            </div>
            <p className={p.hint}>{filtradas.length} OPs encontradas.</p>

            {filtradas.length === 0 ? (
                <div className={p.empty}>No hay OPs que coincidan con la búsqueda.</div>
            ) : (
                <ul className={p.list}>
                    {filtradas.map((o) => {
                        const eDef = ESTADOS_OP.find((e) => e.id === o.estado) || ESTADOS_OP[0];
                        return (
                            <li key={`${o.pacienteDni}-${o.id}`} className={p.draftItem}>
                                <div className={p.draftInfo}>
                                    <div className={p.draftTitle}>
                                        OP {o.nroOP || "(Sin N°)"} · {o.pacienteNombre}
                                        {o.oncoplan && <span style={{ marginLeft: 8, fontSize: 10, padding: "2px 6px", background: "#e11d48", color: "#fff", borderRadius: 4, fontWeight: "bold" }}>ONCOPLAN</span>}
                                    </div>
                                    <div className={p.draftMeta}>
                                        DNI {o.pacienteDni} · <span style={{ color: eDef.color, fontWeight: "bold" }}>{eDef.label}</span> · {o.diagnostico}
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
            )}
        </section>
    );
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================
export default function PamiDashboardPage() {
    const router = useRouter();
    const [solapa, setSolapa] = useState("pacientes");
    const [pacientesDb, setPacientesDb] = useState([]);
    const [clavesDb, setClavesDb] = useState([]);

    // ---- Pacientes ----
    useEffect(() => {
        const unsub = onValue(ref(db, "PAMI/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientesDb(Object.entries(data).map(([dni, paciente]) => ({ dni, ...paciente })));
        });
        return () => unsub();
    }, []);

    // ---- Mis claves ----
    useEffect(() => {
        const unsub = onValue(ref(db, "PAMI/claves"), (snap) => {
            const data = snap.val() || {};
            setClavesDb(Object.entries(data).map(([id, c]) => ({ id, ...c })));
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

    const handleAsignarNroOP = async (dni, opId) => {
        const nro = prompt("Ingresá el N° de OP asignado por PAMI:");
        if (!nro || !nro.trim()) return;

        try {
            const opRef = ref(db, `PAMI/pacientes/${dni}/ops/${opId}`);
            await update(opRef, {
                nroOP: nro.trim(),
                estado: "cargado",
                updatedAt: Date.now()
            });
            alert("Número de OP asignado con éxito.");
        } catch (e) {
            console.error(e);
            alert("Error al asignar el número de OP.");
        }
    };

    const handleCambiarEstadoOP = async (dni, opId, nuevoEstado) => {
        try {
            await cambiarEstadoOP(dni, opId, nuevoEstado, { usuario: "sistema" });
        } catch (e) {
            console.error(e);
        }
    };

    // ---- Handlers: Mis claves ----
    const handleSaveClave = async (data) => {
        try {
            const { id, ...rest } = data;
            const payload = {
                nombre: (rest.nombre || "").trim(),
                usuario: (rest.usuario || "").trim(),
                password: rest.password || "",
                link: (rest.link || "").trim(),
                notas: (rest.notas || "").trim(),
                updatedAt: Date.now(),
            };

            if (id) {
                await update(ref(db, `PAMI/claves/${id}`), payload);
            } else {
                const newRef = push(ref(db, "PAMI/claves"));
                await set(newRef, { ...payload, createdAt: Date.now() });
            }
        } catch (e) {
            console.error(e);
            alert("Error al guardar la clave.");
        }
    };

    const handleDeleteClave = async (c) => {
        if (!confirm(`¿Eliminar la clave "${c.nombre}"?\nEsta acción no se puede deshacer.`)) return;
        try {
            await remove(ref(db, `PAMI/claves/${c.id}`));
        } catch (e) {
            console.error(e);
            alert("Error al eliminar la clave.");
        }
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
                    ["claves", "Mis claves", `${clavesDb.length}`],
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
                    onAsignarNroOP={handleAsignarNroOP}
                />
            )}

            {solapa === "op" && (
                <TabOPs ops={ops} onAbrirPaciente={abrirPaciente} onCambiarEstado={handleCambiarEstadoOP} />
            )}

            {solapa === "internaciones" && (
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Internaciones</h3>
                    <p className={p.hint}>{internaciones.length} internaciones registradas.</p>
                    <ul className={p.list}>
                        {internaciones.map(i => (
                            <li key={i.id} className={p.row}>
                                <div>
                                    <div className={p.rowName}>{i.pacienteNombre} - {i.tipo}</div>
                                    <div className={p.rowMeta}>{i.diagnostico} · Ingreso: {i.fechaIngreso}</div>
                                </div>
                                <button className={`${p.btn} ${p.btnSm}`} onClick={() => abrirPaciente(i.pacienteDni)}>Ver Ficha</button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {solapa === "cirugias" && (
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Cirugías</h3>
                    <p className={p.hint}>{cirugias.length} cirugías registradas.</p>
                    <ul className={p.list}>
                        {cirugias.map(c => (
                            <li key={c.id} className={p.row}>
                                <div>
                                    <div className={p.rowName}>{c.pacienteNombre}</div>
                                    <div className={p.rowMeta}>{c.diagnostico} · Fecha: {c.fechaCirugia}</div>
                                </div>
                                <button className={`${p.btn} ${p.btnSm}`} onClick={() => abrirPaciente(c.pacienteDni)}>Ver Ficha</button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {solapa === "borradores" && (
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Todos los presupuestos</h3>
                    <BorradoresList borradores={borradores} onAbrir={() => router.push("/administrador/pami/presupuestos")} onEliminar={async (b) => { await eliminarPresupuestoPami(b.pacienteDni, b.id); }} showPaciente />
                </section>
            )}

            {solapa === "claves" && (
                <TabClaves
                    claves={clavesDb}
                    onSave={handleSaveClave}
                    onDelete={handleDeleteClave}
                />
            )}

            {solapa === "estadisticas" && <EstadisticasPanel pacientesDb={pacientesDb} />}
        </div>
    );
}
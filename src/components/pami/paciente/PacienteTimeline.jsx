"use client";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";
import OncoplanBadge from "@/components/pami/presupuesto/OncoplanBadge";
import { ESTADOS_OP } from "@/lib/pami/op";
import { estadoDef } from "@/lib/pami/pacientes";
import styles from "./paciente.module.css";

const fmtFechaHora = (ms) => {
    if (!ms) return "—";
    const d = new Date(ms);
    return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
};

const fmtFecha = (iso) => {
    if (!iso) return "—";
    const [y, m, d] = String(iso).split("-");
    return y && m && d ? `${d}/${m}/${y}` : iso;
};

const ICONS = {
    op: "📄",
    internacion: "🏥",
    cirugia: "🔪",
    presupuesto: "🛒",
};

const TITULOS = {
    op: "Orden de prestación",
    internacion: "Internación",
    cirugia: "Cirugía",
    presupuesto: "Presupuesto de medicación",
};

/** Normaliza cada tipo de evento a un shape común */
function normalizeEvents(ops, internaciones, cirugias, presupuestos) {
    const out = [];

    for (const op of ops) {
        out.push({
            kind: "op",
            id: op.id,
            fechaMs: Number(op.createdAt || op.updatedAt || 0),
            titulo: `OP ${op.nroOP || "s/n°"}`,
            subtitulo: [op.diagnostico, op.nroSolicitudMaterial && `Solicitud ${op.nroSolicitudMaterial}`].filter(Boolean).join(" · "),
            estado: op.estado,
            estadoLabel: ESTADOS_OP.find((e) => e.id === op.estado)?.label || op.estado,
            estadoColor: ESTADOS_OP.find((e) => e.id === op.estado)?.color || "#6b7280",
            oncoplan: !!op.oncoplan,
            historial: Array.isArray(op.historial) ? op.historial : [],
            raw: op,
        });
    }
    for (const i of internaciones) {
        out.push({
            kind: "internacion",
            id: i.id,
            fechaMs: Number(i.createdAt || i.updatedAt || 0),
            titulo: `Internación ${i.tipo || ""}`.trim(),
            subtitulo: [i.diagnostico, i.cama && `Cama ${i.cama}`, i.fechaIngreso && `Ingreso ${fmtFecha(i.fechaIngreso)}`].filter(Boolean).join(" · "),
            estado: i.estado || "activa",
            estadoLabel: i.estado === "cerrada" ? "Cerrada" : "Activa",
            estadoColor: i.estado === "cerrada" ? "#6b7280" : "#2f6f4e",
            oncoplan: !!i.oncoplan,
            historial: Array.isArray(i.historial) ? i.historial : [],
            raw: i,
        });
    }
    for (const c of cirugias) {
        out.push({
            kind: "cirugia",
            id: c.id,
            fechaMs: Number(c.createdAt || c.updatedAt || 0),
            titulo: "Cirugía",
            subtitulo: [c.diagnostico, c.fechaCirugia && `Fecha ${fmtFecha(c.fechaCirugia)}`, c.grupoMedico?.cirujano && `Cirujano: ${c.grupoMedico.cirujano}`].filter(Boolean).join(" · "),
            estado: c.estado || "programada",
            estadoLabel: c.estado === "realizada" ? "Realizada" : c.estado === "suspendida" ? "Suspendida" : "Programada",
            estadoColor: c.estado === "realizada" ? "#2f6f4e" : c.estado === "suspendida" ? "#c0392b" : "#2563eb",
            oncoplan: !!c.oncoplan,
            historial: Array.isArray(c.historial) ? c.historial : [],
            raw: c,
        });
    }
    for (const p of presupuestos) {
        const items = Array.isArray(p.items) ? p.items : Object.values(p.items || {});
        const codigos = Array.isArray(p.codigos) ? p.codigos : Object.values(p.codigos || {});
        out.push({
            kind: "presupuesto",
            id: p.id,
            fechaMs: Number(p.createdAt || p.updatedAt || 0),
            titulo: "Presupuesto de medicación",
            subtitulo: `${items.length} ítem(s)${codigos.length ? ` + ${codigos.length} código(s)` : ""} · ${formatCurrency(p.total || 0)}`,
            estado: "borrador",
            estadoLabel: "Borrador",
            estadoColor: "#6b7280",
            oncoplan: !!p.oncoplan,
            historial: [],
            raw: p,
        });
    }

    return out.sort((a, b) => b.fechaMs - a.fechaMs);
}

export default function PacienteTimeline({
    pacienteKey,
    ops = [],
    internaciones = [],
    cirugias = [],
    presupuestos = [],
    onChangeEstadoOP,
    onCerrarInternacion,
    onCerrarCirugia,
    onAbrirPresupuesto,
    onAbrirIngreso,
    onNuevaInternacionDesdeOP,
    onNuevaCirugiaDesdeOP,
}) {
    const [filtro, setFiltro] = useState("todos");
    const [expandido, setExpandido] = useState({});

    const eventos = useMemo(
        () => normalizeEvents(ops, internaciones, cirugias, presupuestos),
        [ops, internaciones, cirugias, presupuestos]
    );

    const filtrados = useMemo(
        () => (filtro === "todos" ? eventos : eventos.filter((e) => e.kind === filtro)),
        [eventos, filtro]
    );

    const toggle = (key) => setExpandido((p) => ({ ...p, [key]: !p[key] }));

    if (eventos.length === 0) {
        return (
            <div className={styles.timelineEmpty}>
                Todavía no hay OP, internaciones, cirugías ni presupuestos para este paciente.
            </div>
        );
    }

    return (
        <div>
            <div className={styles.tabs} style={{ marginBottom: ".85rem" }}>
                {[
                    ["todos", "Todos", eventos.length],
                    ["op", "OP", eventos.filter((e) => e.kind === "op").length],
                    ["internacion", "Internaciones", eventos.filter((e) => e.kind === "internacion").length],
                    ["cirugia", "Cirugías", eventos.filter((e) => e.kind === "cirugia").length],
                    ["presupuesto", "Presupuestos", eventos.filter((e) => e.kind === "presupuesto").length],
                ].map(([id, label, count]) => (
                    <button
                        key={id}
                        type="button"
                        className={`${styles.tab} ${filtro === id ? styles.tabActive : ""}`}
                        onClick={() => setFiltro(id)}
                    >
                        {label}
                        <span className={styles.tabCount}>{count}</span>
                    </button>
                ))}
            </div>

            <div className={styles.timeline}>
                {filtrados.map((ev) => {
                    const expKey = `${ev.kind}:${ev.id}`;
                    const isExp = !!expandido[expKey];
                    return (
                        <article key={expKey} className={styles.tlCard}>
                            <div className={styles.tlTop}>
                                <div className={styles.tlLeft}>
                                    <span className={styles.tlIcon} aria-hidden>{ICONS[ev.kind]}</span>
                                    <div className={styles.tlInfo}>
                                        <h3 className={styles.tlTitulo}>
                                            {ev.titulo}
                                            {ev.oncoplan && <> <OncoplanBadge small /></>}
                                        </h3>
                                        {ev.subtitulo && <div className={styles.tlSubtitulo}>{ev.subtitulo}</div>}
                                        <div className={styles.tlBadges}>
                                            <span className={styles.tlBadge} style={{ color: ev.estadoColor }}>
                                                ● {ev.estadoLabel}
                                            </span>
                                            <span className={styles.tlBadge} style={{ color: "#9aa4b2" }}>
                                                {TITULOS[ev.kind]}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <span className={styles.tlFecha}>{fmtFechaHora(ev.fechaMs)}</span>
                            </div>

                            <div className={styles.tlActions}>
                                {ev.kind === "op" && (
                                    <>
                                        {ev.historial.length > 0 && (
                                            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => toggle(expKey)}>
                                                {isExp ? "Ocultar historial" : `Ver historial (${ev.historial.length})`}
                                            </button>
                                        )}
                                        {ev.estado !== "culminado" && onChangeEstadoOP && (
                                            <select
                                                className={styles.btn}
                                                style={{ fontSize: ".74rem", minHeight: 30, padding: "0 .65rem" }}
                                                value={ev.estado}
                                                onChange={(e) => onChangeEstadoOP(ev.id, e.target.value)}
                                            >
                                                {ESTADOS_OP.map((e) => (
                                                    <option key={e.id} value={e.id}>{e.label}</option>
                                                ))}
                                            </select>
                                        )}
                                        {ev.estado !== "culminado" && onNuevaInternacionDesdeOP && (
                                            <button
                                                type="button"
                                                className={`${styles.btn} ${styles.btnSm}`}
                                                onClick={() => onNuevaInternacionDesdeOP(ev.id)}
                                            >
                                                + Internación
                                            </button>
                                        )}
                                        {ev.estado !== "culminado" && onNuevaCirugiaDesdeOP && (
                                            <button
                                                type="button"
                                                className={`${styles.btn} ${styles.btnSm}`}
                                                onClick={() => onNuevaCirugiaDesdeOP(ev.id)}
                                            >
                                                + Cirugía
                                            </button>
                                        )}
                                    </>
                                )}

                                {ev.kind === "internacion" && (
                                    <>
                                        {ev.raw.ingresosId && onAbrirIngreso && (
                                            <button
                                                type="button"
                                                className={`${styles.btn} ${styles.btnSm}`}
                                                onClick={() => onAbrirIngreso(ev.raw.ingresosId)}
                                            >
                                                Ver en /ingresos
                                            </button>
                                        )}
                                        {ev.estado !== "cerrada" && onCerrarInternacion && (
                                            <button
                                                type="button"
                                                className={`${styles.btn} ${styles.btnSm}`}
                                                onClick={() => onCerrarInternacion(ev.id)}
                                            >
                                                Cerrar internación
                                            </button>
                                        )}
                                    </>
                                )}

                                {ev.kind === "cirugia" && (
                                    <>
                                        {ev.raw.ingresosId && onAbrirIngreso && (
                                            <button
                                                type="button"
                                                className={`${styles.btn} ${styles.btnSm}`}
                                                onClick={() => onAbrirIngreso(ev.raw.ingresosId)}
                                            >
                                                Ver en /ingresos
                                            </button>
                                        )}
                                        {ev.estado === "programada" && onCerrarCirugia && (
                                            <button
                                                type="button"
                                                className={`${styles.btn} ${styles.btnSm}`}
                                                onClick={() => onCerrarCirugia(ev.id)}
                                            >
                                                Marcar realizada
                                            </button>
                                        )}
                                    </>
                                )}

                                {ev.kind === "presupuesto" && onAbrirPresupuesto && (
                                    <button
                                        type="button"
                                        className={`${styles.btn} ${styles.btnSm}`}
                                        onClick={() => onAbrirPresupuesto(ev.raw)}
                                    >
                                        Abrir presupuesto
                                    </button>
                                )}

                                {ev.historial.length > 0 && ev.kind !== "op" && (
                                    <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => toggle(expKey)}>
                                        {isExp ? "Ocultar historial" : `Ver historial (${ev.historial.length})`}
                                    </button>
                                )}
                            </div>

                            {isExp && ev.historial.length > 0 && (
                                <div className={styles.tlExpand}>
                                    <ul className={styles.tlHistorial}>
                                        {ev.historial
                                            .slice()
                                            .sort((a, b) => (a.fecha || 0) - (b.fecha || 0))
                                            .map((h, i) => (
                                                <li key={i}>
                                                    <span>
                                                        <strong>{h.estado}</strong>
                                                        {h.nota && ` — ${h.nota}`}
                                                        {h.usuario && <span style={{ opacity: .7 }}> · por {h.usuario}</span>}
                                                    </span>
                                                    <span className="fecha">{fmtFechaHora(h.fecha)}</span>
                                                </li>
                                            ))}
                                    </ul>
                                </div>
                            )}
                        </article>
                    );
                })}
            </div>
        </div>
    );
}
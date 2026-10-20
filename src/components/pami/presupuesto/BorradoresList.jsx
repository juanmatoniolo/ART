"use client";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";
import OncoplanBadge from "./OncoplanBadge";
import styles from "./presupuesto.module.css";

const miles = (v) => {
    const d = String(v || "").replace(/\D/g, "");
    return d.length <= 8 ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d;
};

const fmtFechaHora = (ms) => {
    if (!ms) return "—";
    const d = new Date(ms);
    return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Chip con el contexto del borrador (OP/Internación/Cirugía) */
function ContextoBadge({ b }) {
    const parts = [];
    if (b.opId) parts.push("OP");
    if (b.internacionId) parts.push("Internación");
    if (b.cirugiaId) parts.push("Cirugía");
    if (!parts.length) return null;
    return (
        <span style={{
            display: "inline-block",
            padding: "1px 6px",
            marginLeft: ".4rem",
            borderRadius: 999,
            background: "rgba(37, 99, 235, .15)",
            border: "1px solid rgba(37, 99, 235, .45)",
            color: "#60a5fa",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 0.3,
        }}>
            {parts.join(" · ")}
        </span>
    );
}

export default function BorradoresList({
    borradores,
    onAbrir,
    onEliminar,
    showPaciente = true,
    emptyText = "Todavía no hay borradores guardados.",
}) {
    if (!borradores.length) {
        return <div className={styles.empty}>{emptyText}</div>;
    }
    return (
        <ul className={styles.list}>
            {borradores.map((b) => (
                <li key={`${b.pacienteDni || "paciente"}-${b.id}`} className={styles.draftItem}>
                    <div className={styles.draftInfo}>
                        <div className={styles.draftTitle}>
                            {showPaciente ? (b.pacienteNombre || `DNI ${b.pacienteDni}`) : `Borrador ${b.id.slice(-6)}`}
                            {b.oncoplan && <> <OncoplanBadge small /></>}
                            <ContextoBadge b={b} />
                        </div>
                        <div className={styles.draftMeta}>
                            {showPaciente && (
                                <>
                                    DNI {miles(b.pacienteDni)}
                                    {b.pacienteAfiliado ? ` · Afiliado ${b.pacienteAfiliado}` : ""}
                                    {" · "}
                                </>
                            )}
                            {fmtFechaHora(b.fechaMs)}
                        </div>
                        <div className={styles.draftMeta}>
                            {b.itemsCount} ítem(s)
                            {b.codigosCount > 0 ? ` + ${b.codigosCount} código(s)` : ""}
                            {" · "}<strong>{formatCurrency(b.total || 0)}</strong>
                        </div>
                    </div>
                    <div className={styles.draftActions}>
                        <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => onAbrir(b)}>
                            Abrir
                        </button>
                        <button type="button" className={`${styles.btn} ${styles.btnSm} ${styles.btnDangerSm}`} onClick={() => onEliminar(b)} aria-label="Eliminar borrador">
                            ✕
                        </button>
                    </div>
                </li>
            ))}
        </ul>
    );
}
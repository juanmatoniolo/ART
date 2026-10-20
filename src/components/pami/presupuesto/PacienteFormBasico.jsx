"use client";
import { useState, useMemo } from "react";
import styles from "./presupuesto.module.css";
import OncoplanToggle from "./OncoplanToggle";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";

export default function PacienteFormBasico({
    paciente, onChange, onDniBlur, oncoplan, onOncoplanChange, showOncoplan = true, statusText = "", readonly = false, pacientesDb = [],
}) {
    const [showSuggestions, setShowSuggestions] = useState(false);

    const field = (key, value = paciente[key]) => ({
        className: styles.input,
        value: value ?? "",
        onChange: (e) => { onChange({ [key]: e.target.value }); setShowSuggestions(true); },
        onFocus: () => setShowSuggestions(true),
        disabled: readonly,
    });

    const sanitizeAfiliado = (v) => {
        const limpio = String(v ?? "").replace(/[^\d/]/g, "");
        const p = limpio.split("/");
        if (p.length === 1) return p[0];
        return `${p[0]}/${p.slice(1).join("").slice(0, 2)}`;
    };
    const miles = (v) => {
        const d = String(v || "").replace(/\D/g, "");
        return d.length <= 8 ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d;
    };

    const sugerencias = useMemo(() => {
        const q = `${paciente.nombreCompleto || ""} ${paciente.dni || ""} ${paciente.afiliado || ""}`.trim();
        if (!q || q.length < 2) return [];

        return pacientesDb.filter((p) => {
            const texto = `${p.nombreCompleto || ""} ${p.apellido || ""} ${p.nombre || ""} ${p.dni || ""} ${p.afiliado || ""}`;
            return matchesAllTerms(texto, q);
        }).slice(0, 5);
    }, [pacientesDb, paciente.nombreCompleto, paciente.dni, paciente.afiliado]);

    const seleccionarPaciente = (p) => {
        onChange({
            dni: p.dni || "", nombreCompleto: p.nombreCompleto || `${p.apellido || ""} ${p.nombre || ""}`.trim(),
            afiliado: p.afiliado || "", historiaClinica: p.historiaClinica || "", sexo: p.sexo || "",
            fechaNacimiento: p.fechaNacimiento || "", telefono: p.telefono || "", domicilio: p.domicilio || "",
            localidad: p.localidad || "", provincia: p.provincia || "", famNombre: p.familiar?.nombre || "",
            famParentezco: p.familiar?.parentezco || "", famTelefono: p.familiar?.telefono || "",
            // También traemos el equipo médico si el paciente ya lo tiene guardado
            cirujano: p.cirujano || "", ayudante1: p.ayudante1 || "", ayudante2: p.ayudante2 || "", anestesista: p.anestesista || ""
        });
        if (p.oncoplan !== undefined && onOncoplanChange) onOncoplanChange(p.oncoplan);
        setShowSuggestions(false);
    };

    const handleBlur = () => {
        setTimeout(() => { setShowSuggestions(false); if (onDniBlur) onDniBlur(); }, 200);
    };

    return (
        <div style={{ position: "relative" }}>
            {/* DATOS BÁSICOS */}
            <div className={styles.grid2}>
                <label className={styles.field} style={{ gridColumn: "1 / -1" }}>
                    <span>Apellido y Nombre (o busque por DNI / Afiliado)</span>
                    <input {...field("nombreCompleto")} onBlur={handleBlur} autoComplete="off" placeholder="Ej: PÉREZ JUAN CARLOS" />

                    {showSuggestions && !readonly && (
                        <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", listStyle: "none", padding: ".4rem", margin: ".2rem 0 0 0", boxShadow: "var(--shadow)" }}>
                            {sugerencias.length > 0 ? (
                                sugerencias.map((p) => (
                                    <li key={p.dni}>
                                        <div
                                            onMouseDown={(e) => { e.preventDefault(); seleccionarPaciente(p); }}
                                            style={{ width: "100%", textAlign: "left", padding: ".5rem .75rem", cursor: "pointer", borderRadius: "6px" }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"}
                                            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                                        >
                                            <div style={{ fontWeight: 800 }}>{p.nombreCompleto || `${p.apellido} ${p.nombre}`}</div>
                                            <div style={{ fontSize: ".75rem", color: "var(--muted)" }}>DNI {p.dni} {p.afiliado ? `· Afiliado ${p.afiliado}` : ""}</div>
                                        </div>
                                    </li>
                                ))
                            ) : (
                                <li style={{ padding: ".5rem .75rem", fontSize: ".85rem", color: "var(--muted)" }}>
                                    No se encontraron coincidencias (o la lista está cargando).
                                </li>
                            )}
                        </ul>
                    )}
                </label>

                <label className={styles.field}><span>DNI</span><input className={styles.input} inputMode="numeric" placeholder="Ej: 20.123.456" value={miles(paciente.dni)} onChange={(e) => { onChange({ dni: e.target.value.replace(/\D/g, "") }); setShowSuggestions(true); }} onBlur={handleBlur} disabled={readonly} /></label>
                <label className={styles.field}><span>N° de afiliado PAMI</span><input className={styles.input} inputMode="numeric" placeholder="Ej: 1505000015/00" value={paciente.afiliado || ""} onChange={(e) => { onChange({ afiliado: sanitizeAfiliado(e.target.value) }); setShowSuggestions(true); }} onBlur={handleBlur} disabled={readonly} /></label>
                <label className={styles.field}><span>N° Historia Clínica</span><input className={styles.input} value={paciente.historiaClinica || ""} onChange={(e) => onChange({ historiaClinica: e.target.value.replace(/\D/g, "") })} disabled={readonly} /></label>
                <label className={styles.field}><span>Sexo</span><select className={styles.input} value={paciente.sexo || ""} onChange={(e) => onChange({ sexo: e.target.value })} disabled={readonly}><option value="">—</option><option value="M">Masculino</option><option value="F">Femenino</option></select></label>
            </div>

            {/* EQUIPO MÉDICO (OPCIONAL) */}
            <div style={{ marginTop: "1.5rem" }}>
                <h4 className={styles.sub} style={{ marginBottom: "0.5rem" }}>Equipo Médico (Opcional)</h4>
                <p className={styles.hint} style={{ marginBottom: "0.75rem" }}>Si completás estos datos, aparecerán impresos en el presupuesto.</p>
                <div className={styles.grid2}>
                    <label className={styles.field}><span>Cirujano</span><input className={styles.input} placeholder="Apellido y nombre" value={paciente.cirujano || ""} onChange={(e) => onChange({ cirujano: e.target.value })} disabled={readonly} /></label>
                    <label className={styles.field}><span>Anestesista</span><input className={styles.input} placeholder="Apellido y nombre" value={paciente.anestesista || ""} onChange={(e) => onChange({ anestesista: e.target.value })} disabled={readonly} /></label>
                    <label className={styles.field}><span>Ayudante 1</span><input className={styles.input} placeholder="Apellido y nombre" value={paciente.ayudante1 || ""} onChange={(e) => onChange({ ayudante1: e.target.value })} disabled={readonly} /></label>
                    <label className={styles.field}><span>Ayudante 2</span><input className={styles.input} placeholder="Apellido y nombre" value={paciente.ayudante2 || ""} onChange={(e) => onChange({ ayudante2: e.target.value })} disabled={readonly} /></label>
                </div>
            </div>

            {showOncoplan && <OncoplanToggle checked={!!oncoplan} onChange={onOncoplanChange} disabled={readonly} />}
            {statusText && <p className={styles.hint} style={{ marginTop: ".75rem" }}>{statusText}</p>}
        </div>
    );
}
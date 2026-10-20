"use client";
import { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import { dniKey } from "@/lib/pami";
import styles from "./wizard.module.css";

const OncoplanTag = () => (
    <span
        style={{
            display: "inline-block",
            padding: "1px 6px",
            borderRadius: 4,
            background: "#e11d48",
            color: "#fff",
            fontWeight: 700,
            fontSize: 10,
            letterSpacing: 0.6,
        }}
    >
        ONCOPLAN
    </span>
);

export default function Paso1Paciente({ estado, actualizar }) {
    const [busqueda, setBusqueda] = useState("");
    const [pacientes, setPacientes] = useState([]);
    const [cargando, setCargando] = useState(true);

    useEffect(() => {
        const unsub = onValue(ref(db, "PAMI/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientes(
                Object.entries(data).map(([dni, p]) => ({
                    dni,
                    ...p,
                    nombreCompleto: [p.apellido, p.nombre]
                        .filter(Boolean)
                        .join(" "),
                }))
            );
            setCargando(false);
        });
        return () => unsub();
    }, []);

    const filtrados = useMemo(() => {
        const q = busqueda.trim();
        if (!q) return pacientes.slice(0, 15);
        return pacientes
            .filter((p) =>
                matchesAllTerms(
                    `${p.dni} ${p.afiliado || ""} ${p.apellido || ""} ${p.nombre || ""}`,
                    q
                )
            )
            .slice(0, 30);
    }, [pacientes, busqueda]);

    const seleccionar = (p) => {
        actualizar({ paciente: p, pacienteKey: dniKey(p.dni) });
    };

    const deseleccionar = () => actualizar({ paciente: null });

    return (
        <div>
            <h2 className={styles.titulo}>Paso 1 · Paciente</h2>
            <p className={styles.hint}>
                Buscá un paciente existente o creá uno nuevo desde el wizard.
            </p>

            <input
                className={styles.input}
                type="search"
                placeholder="Buscar por DNI, afiliado o nombre…"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                autoFocus
            />

            {estado.paciente && (
                <div className={styles.seleccionado}>
                    <strong>{estado.paciente.nombreCompleto || `DNI ${estado.paciente.dni}`}</strong>
                    <span>DNI {estado.paciente.dni}</span>
                    {estado.paciente.afiliado && <span>Afiliado {estado.paciente.afiliado}</span>}
                    {estado.paciente.oncoplan && <OncoplanTag />}
                    <button type="button" className={styles.linkBtn} onClick={deseleccionar}>
                        Cambiar
                    </button>
                </div>
            )}

            {!estado.paciente && (
                <ul className={styles.listaResultados}>
                    {cargando && <li className={styles.vacio}>Cargando pacientes…</li>}
                    {!cargando && filtrados.length === 0 && (
                        <li className={styles.vacio}>
                            No se encontraron pacientes.
                        </li>
                    )}
                    {filtrados.map((p) => (
                        <li key={p.dni}>
                            <button
                                type="button"
                                className={styles.item}
                                onClick={() => seleccionar(p)}
                            >
                                <div style={{ display: "flex", flexDirection: "column", gap: ".15rem" }}>
                                    <strong>
                                        {p.nombreCompleto || `DNI ${p.dni}`}
                                        {p.oncoplan && <> <OncoplanTag /></>}
                                    </strong>
                                    <div className={styles.meta}>
                                        DNI {p.dni}
                                        {p.afiliado && ` · Afiliado ${p.afiliado}`}
                                        {p.estado === "fallecido" && " · FALLECIDO"}
                                    </div>
                                </div>
                                {p.estado === "fallecido" && (
                                    <span className={styles.badgeFallecido}>✕</span>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
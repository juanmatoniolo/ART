"use client";
import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import { obtenerPacientePami, dniKey } from "@/lib/pami";
import styles from "./wizard.module.css";

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
                    nombreCompleto: [p.apellido, p.nombre].filter(Boolean).join(" "),
                })),
            );
            setCargando(false);
        });
        return () => unsub();
    }, []);

    const filtrados = useMemo(() => {
        const q = busqueda.trim();
        if (!q) return pacientes.slice(0, 15);
        return pacientes.filter((p) =>
            matchesAllTerms(
                `${p.dni} ${p.afiliado || ""} ${p.apellido || ""} ${p.nombre || ""}`,
                q,
            ),
        ).slice(0, 30);
    }, [pacientes, busqueda]);

    const seleccionar = (p) => {
        actualizar({ paciente: p, pacienteKey: dniKey(p.dni) });
    };

    return (
        <div>
            <h2 className={styles.titulo}>Paso 1 · Paciente</h2>
            <p className={styles.hint}>
                Buscá un paciente existente o creá uno nuevo.
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
                    <strong>{estado.paciente.nombreCompleto}</strong>
                    <span>DNI {estado.paciente.dni}</span>
                    <button type="button" className={styles.linkBtn} onClick={() => actualizar({ paciente: null })}>
                        Cambiar
                    </button>
                </div>
            )}

            {!estado.paciente && (
                <ul className={styles.listaResultados}>
                    {cargando && <li className={styles.vacio}>Cargando pacientes…</li>}
                    {!cargando && filtrados.length === 0 && (
                        <li className={styles.vacio}>
                            No se encontraron pacientes.{" "}
                            <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={() => actualizar({ crearNuevoPaciente: true })}
                            >
                                Crear uno nuevo
                            </button>
                        </li>
                    )}
                    {filtrados.map((p) => (
                        <li key={p.dni}>
                            <button type="button" className={styles.item} onClick={() => seleccionar(p)}>
                                <div>
                                    <strong>{p.nombreCompleto || `DNI ${p.dni}`}</strong>
                                    <div className={styles.meta}>
                                        DNI {p.dni}
                                        {p.afiliado && ` · Afiliado ${p.afiliado}`}
                                        {p.oncoplan && " · ONCOPLAN"}
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
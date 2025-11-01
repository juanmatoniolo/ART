"use client";

import { useEffect, useState } from "react";
import Fuse from "fuse.js";
import Link from "next/link";
import styles from "./homePacientes.module.css";

export default function HomePacientes() {
    const [pacientes, setPacientes] = useState([]);
    const [query, setQuery] = useState("");
    const [resultados, setResultados] = useState([]);

    // 🔹 Obtener pacientes desde Firebase
    useEffect(() => {
        const fetchPacientes = async () => {
            try {
                const res = await fetch(
                    "https://datos-clini-default-rtdb.firebaseio.com/pacientes.json"
                );
                const data = await res.json();
                if (!data) return;
                const lista = Object.entries(data).map(([id, valores]) => ({
                    id,
                    ...valores,
                }));
                setPacientes(lista);
            } catch (error) {
                console.error("Error al obtener pacientes:", error);
            }
        };

        fetchPacientes();
    }, []);

    // 🔹 Buscar pacientes
    useEffect(() => {
        if (!query.trim()) {
            setResultados([]);
            return;
        }

        const fuse = new Fuse(pacientes, {
            keys: ["Nombre", "Apellido", "dni", "Empleador", "estado"],
            includeMatches: true,
            threshold: 0.3,
        });

        setResultados(fuse.search(query));
    }, [query, pacientes]);

    // 🔹 Resaltar coincidencias
    const highlight = (text, match) => {
        if (!match || !text) return text;
        const indices = match.indices;
        let result = "";
        let lastIndex = 0;
        indices.forEach(([start, end]) => {
            result += text.slice(lastIndex, start);
            result += `<mark>${text.slice(start, end + 1)}</mark>`;
            lastIndex = end + 1;
        });
        result += text.slice(lastIndex);
        return <span dangerouslySetInnerHTML={{ __html: result }} />;
    };

    const listaFinal = query.trim()
        ? resultados.map((r) => ({ ...r.item, matches: r.matches }))
        : pacientes;

    const pacientesActivos = listaFinal.filter((p) => p.estado !== "Alta médica");
    const pacientesAlta = listaFinal.filter((p) => p.estado === "Alta médica");

    return (
        <div className={styles.wrapper}>
            <div className={styles.content}>
                <h1 className={styles.title}>📋 Pacientes</h1>
                <p className={styles.subtitle}>
                    Busque y acceda rápidamente a la ficha de cada paciente.
                </p>

                {/* 🔍 Buscador */}
                <input
                    type="text"
                    className={styles.search}
                    placeholder="Buscar paciente por nombre, apellido, DNI, empleador o estado..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                />

                {/* 🩺 Pacientes en tratamiento */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitle}>Pacientes en tratamiento</h2>
                    {pacientesActivos.length === 0 ? (
                        <p className={styles.empty}>No se encontraron pacientes en tratamiento.</p>
                    ) : (
                        <ul className={styles.list}>
                            {pacientesActivos.map((paciente) => (
                                <li key={paciente.id} className={styles.item}>
                                    <div className={styles.itemInfo}>
                                        <strong>
                                            {highlight(
                                                paciente.Nombre,
                                                paciente.matches?.find((m) => m.key === "Nombre")
                                            )}{" "}
                                            {highlight(
                                                paciente.Apellido,
                                                paciente.matches?.find((m) => m.key === "Apellido")
                                            )}
                                        </strong>{" "}
                                        — DNI:{" "}
                                        {highlight(
                                            paciente.dni,
                                            paciente.matches?.find((m) => m.key === "dni")
                                        )}
                                        <br />
                                        <small className={styles.textMuted}>
                                            {paciente.Empleador && (
                                                <>Empleador: {paciente.Empleador}</>
                                            )}
                                        </small>
                                    </div>
                                    <Link
                                        href={`/admin/pacientes/${paciente.id}`}
                                        className={`${styles.btn} ${styles.btnPrimary}`}
                                    >
                                        Ver ficha
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                {/* 🏥 Pacientes con alta médica */}
                <section className={styles.section}>
                    <h2 className={styles.sectionTitleDanger}>Pacientes con Alta Médica</h2>
                    {pacientesAlta.length === 0 ? (
                        <p className={styles.empty}>No hay pacientes con alta médica.</p>
                    ) : (
                        <ul className={styles.list}>
                            {pacientesAlta.map((paciente) => (
                                <li key={paciente.id} className={`${styles.item} ${styles.itemAlta}`}>
                                    <div>
                                        <strong>
                                            {highlight(
                                                paciente.Nombre,
                                                paciente.matches?.find((m) => m.key === "Nombre")
                                            )}{" "}
                                            {highlight(
                                                paciente.Apellido,
                                                paciente.matches?.find((m) => m.key === "Apellido")
                                            )}
                                        </strong>{" "}
                                        — DNI:{" "}
                                        {highlight(
                                            paciente.dni,
                                            paciente.matches?.find((m) => m.key === "dni")
                                        )}
                                        <br />
                                        <span className={styles.badge}>Alta médica</span>
                                    </div>
                                    <Link
                                        href={`/admin/pacientes/${paciente.id}`}
                                        className={`${styles.btn} ${styles.btnOutlineDanger}`}
                                    >
                                        Ver ficha
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>

            <footer className={styles.footer}>
                © {new Date().getFullYear()} Clínica de la Unión S.A. — Sistema Médico Interno
            </footer>
        </div>
    );
}

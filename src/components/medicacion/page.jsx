"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import styles from "./medydescartables.module.css";

function normalizeText(input) {
    return String(input ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function matchesAllTerms(texto, busqueda) {
    const t = normalizeText(texto);
    const q = normalizeText(busqueda);
    if (!q) return true;

    const terms = q.split(" ").filter(Boolean);
    return terms.every((term) => t.includes(term));
}

export default function MedyDescartablesPage() {
    const [busqueda, setBusqueda] = useState("");
    const [items, setItems] = useState([]);

    useEffect(() => {
        const refMeds = ref(db, "medydescartables/medicamentos");
        const refDesc = ref(db, "medydescartables/descartables");

        let medsData = null;
        let descData = null;

        const build = () => {
            const arr = [];

            if (medsData) {
                for (const [nombre, precio] of Object.entries(medsData)) {
                    arr.push({
                        nombre,
                        precio,
                        tipo: "Medicacion",
                        id: `medydescartables/medicamentos/${nombre}`,
                    });
                }
            }

            if (descData) {
                for (const [nombre, precio] of Object.entries(descData)) {
                    arr.push({
                        nombre,
                        precio,
                        tipo: "Descartable", // ✅ singular para matchear tu CSS y textos
                        id: `medydescartables/descartables/${nombre}`,
                    });
                }
            }

            arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
            setItems(arr);
        };

        const unsubMeds = onValue(refMeds, (snap) => {
            medsData = snap.exists() ? snap.val() : {};
            build();
        });

        const unsubDesc = onValue(refDesc, (snap) => {
            descData = snap.exists() ? snap.val() : {};
            build();
        });

        return () => {
            unsubMeds();
            unsubDesc();
        };
    }, []);

    const filtrados = useMemo(() => {
        return items.filter((it) => matchesAllTerms(it.nombre, busqueda));
    }, [items, busqueda]);

    return (
        <div className={styles.wrapper}>
            <h2 className={styles.title}>💊 Medicación y 🧷 Descartables</h2>

            <div className={styles.controls}>
                <input
                    type="text"
                    className={styles.search}
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder='Buscar (ej: "suero dextrosa 10")'
                />
            </div>

            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th style={{ textAlign: "right" }}>Precio ($)</th>
                    </tr>
                </thead>

                <tbody>
                    {filtrados.length === 0 ? (
                        <tr>
                            <td colSpan={3} style={{ padding: 12 }}>
                                No hay coincidencias.
                            </td>
                        </tr>
                    ) : (
                        filtrados.map((item) => {
                            const esMedicacion = item.tipo === "Medicacion";

                            return (
                                <tr key={item.id}>
                                    <td>{String(item.nombre).replace(/_/g, " ")}</td>

                                    <td>
                                        {esMedicacion ? (
                                            <span className={styles.medicacion}>💊 Medicación</span>
                                        ) : (
                                            <span className={styles.descartable}>🧷 Descartable</span>
                                        )}
                                    </td>

                                    <td style={{ textAlign: "right" }}>
                                        {Number(item.precio ?? 0).toLocaleString("es-AR", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
                                    </td>

                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
}

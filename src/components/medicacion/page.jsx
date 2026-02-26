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
                for (const [key, itemData] of Object.entries(medsData)) {
                    arr.push({
                        id: `medydescartables/medicamentos/${key}`,
                        nombre: itemData.nombre || key,
                        precio: itemData.precioReferencia || itemData.precio || 0,
                        presentacion: itemData.presentacion || "ampolla",
                        tipo: "Medicacion",
                        tipoFormatted: "💊 Medicación"
                    });
                }
            }

            if (descData) {
                for (const [key, itemData] of Object.entries(descData)) {
                    arr.push({
                        id: `medydescartables/descartables/${key}`,
                        nombre: itemData.nombre || key,
                        precio: itemData.precioReferencia || itemData.precio || 0,
                        presentacion: itemData.presentacion || "unidad",
                        tipo: "Descartable",
                        tipoFormatted: "🧷 Descartable"
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
        return items.filter((it) => 
            matchesAllTerms(it.nombre, busqueda) || 
            matchesAllTerms(it.presentacion, busqueda) ||
            matchesAllTerms(it.tipoFormatted, busqueda)
        );
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
                    placeholder='Buscar (ej: "suero", "ampolla", "descartable")'
                />
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>Producto</th>
                            <th>Presentación</th>
                            <th>Tipo</th>
                            <th>Precio ($)</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filtrados.length === 0 ? (
                            <tr>
                                <td colSpan={4} className={styles.noResults}>
                                    No hay coincidencias.
                                </td>
                            </tr>
                        ) : (
                            filtrados.map((item) => {
                                const esMedicacion = item.tipo === "Medicacion";

                                return (
                                    <tr key={item.id}>
                                        <td className={styles.productCell}>
                                            {String(item.nombre).replace(/_/g, " ")}
                                        </td>

                                        <td>
                                            <span className={styles.presentacion}>
                                                {item.presentacion.charAt(0).toUpperCase() + item.presentacion.slice(1)}
                                            </span>
                                        </td>

                                        <td>
                                            {esMedicacion ? (
                                                <span className={styles.medicacion}>{item.tipoFormatted}</span>
                                            ) : (
                                                <span className={styles.descartable}>{item.tipoFormatted}</span>
                                            )}
                                        </td>

                                        <td className={styles.priceCell}>
                                            {Number(item.precio ?? 0).toLocaleString("es-AR", {
                                                style: "currency",
                                                currency: "ARS",
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
        </div>
    );
}
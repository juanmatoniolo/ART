"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import styles from "./medydescartables.module.css";

export default function MedyDescartablesPage() {
    const [items, setItems] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [filtro, setFiltro] = useState("todos");
    const [filtrados, setFiltrados] = useState([]);

    /* === Escuchar Firebase === */
    useEffect(() => {
        const refInsumos = ref(db, "medydescartables");
        const unsub = onValue(refInsumos, (snap) => {
            if (!snap.exists()) return setItems([]);

            const data = snap.val();
            const meds = data.medicamentos
                ? Object.entries(data.medicamentos).map(([nombre, precio]) => ({
                    nombre,
                    precio,
                    tipo: "Medicacion",
                }))
                : [];

            const desc = data.descartables
                ? Object.entries(data.descartables).map(([nombre, precio]) => ({
                    nombre,
                    precio,
                    tipo: "Descartable",
                }))
                : [];

            const combinados = [...meds, ...desc].sort((a, b) =>
                a.nombre.localeCompare(b.nombre)
            );

            setItems(combinados);
        });

        return () => unsub();
    }, []);

    /* === Buscar y filtrar === */
    useEffect(() => {
        const query = busqueda.toLowerCase().trim();
        const filtrados = items.filter((item) => {
            const coincideNombre = item.nombre.toLowerCase().includes(query);
            const coincideTipo =
                filtro === "todos" || item.tipo.toLowerCase() === filtro;
            return coincideNombre && coincideTipo;
        });
        setFiltrados(filtrados);
    }, [busqueda, filtro, items]);

    /* === Render === */
    return (
        <div className={styles.wrapper}>
            <h2 className={styles.title}>💊 Medicación y 🧷 Descartables</h2>

            <div className={styles.controls}>
                <input
                    type="text"
                    className={styles.search}
                    placeholder="Buscar producto..."
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />

                <select
                    className={styles.select}
                    value={filtro}
                    onChange={(e) => setFiltro(e.target.value)}
                >
                    <option value="todos">🔍 Ver todos</option>
                    <option value="medicacion">💊 Solo medicación</option>
                    <option value="descartable">🧷 Solo descartables</option>
                </select>
            </div>

            <table className={styles.table}>
                <thead>
                    <tr>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th>Precio ($)</th>
                    </tr>
                </thead>
                <tbody>
                    {filtrados.length === 0 ? (
                        <tr>
                            <td colSpan={3}>No se encontraron resultados.</td>
                        </tr>
                    ) : (
                        filtrados.map((item) => (
                            <tr key={item.nombre}>
                                <td>{item.nombre.replace(/_/g, " ")}</td>
                                <td>
                                    {item.tipo === "Medicacion" ? (
                                        <span className={styles.medicacion}>💊 Medicación</span>
                                    ) : (
                                        <span className={styles.descartable}>🧷 Descartable</span>
                                    )}
                                </td>
                                <td>
                                    {isNaN(item.precio)
                                        ? item.precio
                                        : `$${parseFloat(item.precio).toLocaleString("es-AR", {
                                            minimumFractionDigits: 2,
                                        })}`}
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}

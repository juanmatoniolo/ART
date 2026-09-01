"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { formatCurrency, matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import styles from "./insumosAdmin.module.css";

/* ===========================================================
   Presentaciones por tipo
   =========================================================== */
const PRESENTACIONES = {
    medicamentos: [
        ["ampolla", "Ampolla"],
        ["vial", "Vial"],
        ["tabletas", "Tabletas"],
        ["frasco", "Frasco"],
        ["bolsa", "Bolsa"],
        ["jeringa", "Jeringa"],
        ["gasas", "Gasas"],
        ["tubo", "Tubo"],
        ["tiras", "Tiras"],
    ],
    descartables: [
        ["unidad", "Unidad"],
        ["rollo", "Rollo"],
        ["juego", "Juego"],
        ["bolsa", "Bolsa"],
        ["frasco", "Frasco"],
        ["kit", "Kit"],
        ["set", "Set"],
        ["tubo", "Tubo"],
    ],
};

/* ===========================================================
   Componente principal
   =========================================================== */
export default function PreciosPage() {
    const [tipo, setTipo] = useState("todos");
    const [items, setItems] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [mensaje, setMensaje] = useState("");

    // ─── Leer TODOS los datos desde Firebase ─────────────────────
    useEffect(() => {
        const refItems = ref(db, "medydescartables");
        const unsub = onValue(refItems, (snap) => {
            if (!snap.exists()) {
                setItems([]);
                return;
            }
            const data = snap.val();
            const lista = [];

            // Medicamentos
            if (data.medicamentos) {
                Object.entries(data.medicamentos).forEach(([key, d]) => {
                    lista.push({
                        key,
                        nombre: d.nombre || key.replace(/_/g, " "),
                        precioCosto: d.precioCosto ?? d.precioReferencia ?? 0,
                        precioFacturacion: d.precioFacturacion ?? 0,
                        presentacion: d.presentacion || "unidad",
                        tipo: "medicamento",
                        stockActual: d.stockActual ?? 0,
                        stockMinimo: d.stockMinimo ?? 10,
                        activo: d.activo !== false,
                        categoria: "medicamentos",
                    });
                });
            }

            // Descartables
            if (data.descartables) {
                Object.entries(data.descartables).forEach(([key, d]) => {
                    lista.push({
                        key,
                        nombre: d.nombre || key.replace(/_/g, " "),
                        precioCosto: d.precioCosto ?? d.precioReferencia ?? 0,
                        precioFacturacion: d.precioFacturacion ?? 0,
                        presentacion: d.presentacion || "unidad",
                        tipo: "descartable",
                        stockActual: d.stockActual ?? 0,
                        stockMinimo: d.stockMinimo ?? 10,
                        activo: d.activo !== false,
                        categoria: "descartables",
                    });
                });
            }

            setItems(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        });
        return () => unsub();
    }, []);

    // ─── Filtrado ────────────────────────────────────────────────
    const filtrados = useMemo(() => {
        return items.filter((item) => {
            if (!item.activo) return false;
            if (tipo === "medicamentos" && item.categoria !== "medicamentos") return false;
            if (tipo === "descartables" && item.categoria !== "descartables") return false;
            return matchesAllTerms(item.nombre, busqueda);
        });
    }, [items, tipo, busqueda]);

    // ─── Estilos para alinear columnas ──────────────────────────
    const colStyles = {
        table: { tableLayout: "fixed", width: "100%", borderCollapse: "collapse" },
        colNombre: { width: "30%" },
        colPresentacion: { width: "15%", textAlign: "center" },
        colTipo: { width: "15%", textAlign: "center" },
        colPrecioCosto: { width: "20%", textAlign: "right" },
        colPrecioFacturacion: { width: "20%", textAlign: "right" },
    };

    // ─── Render ──────────────────────────────────────────────────
    return (
        <div className={`${styles.wrapper} ${styles.dark}`}>
            <div className={styles.headerBar}>
                <h2 className={styles.title}>💲 Precios de Insumos</h2>
            </div>

            {mensaje && <div className={styles.toast}>{mensaje}</div>}

            <div className={styles.content}>
                <div className={styles.adminHeader}>
                    <select
                        className={styles.selectTipo}
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                    >
                        <option value="todos">📦 Todos</option>
                        <option value="medicamentos">💊 Medicación</option>
                        <option value="descartables">🧷 Descartables</option>
                    </select>

                    <input
                        type="text"
                        className={styles.search}
                        placeholder="Buscar producto..."
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                    />
                </div>

                <div style={{ overflowX: "auto", width: "100%" }}>
                    <table style={colStyles.table} className={styles.table}>
                        <thead>
                            <tr>
                                <th style={colStyles.colNombre}>Producto</th>
                                <th style={colStyles.colPresentacion}>Presentación</th>
                                <th style={colStyles.colTipo}>Tipo</th>
                                <th style={colStyles.colPrecioFacturacion}>Precio Facturación ($)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: "center", padding: "2rem" }}>
                                        No hay productos.
                                    </td>
                                </tr>
                            ) : (
                                filtrados.map((item) => {
                                    return (
                                        <tr key={`${item.categoria}|${item.key}`}>
                                            <td style={colStyles.colNombre}>{item.nombre}</td>
                                            <td style={colStyles.colPresentacion}>
                                                {PRESENTACIONES[item.categoria].find(
                                                    ([v]) => v === item.presentacion
                                                )?.[1] || item.presentacion}
                                            </td>
                                            <td style={colStyles.colTipo}>
                                                <span
                                                    className={
                                                        item.tipo === "medicamento"
                                                            ? styles.badgeMed
                                                            : styles.badgeDesc
                                                    }
                                                >
                                                    {item.tipo === "medicamento"
                                                        ? "Medicamento"
                                                        : "Descartable"}
                                                </span>
                                            </td>
                                          
                                            <td style={colStyles.colPrecioFacturacion}>
                                                {formatCurrency(item.precioFacturacion)}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
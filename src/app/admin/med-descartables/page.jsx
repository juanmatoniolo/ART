"use client";

import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue, update, remove } from "firebase/database";
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

    // Modal de edición
    const [modalAbierto, setModalAbierto] = useState(false);
    const [itemEditando, setItemEditando] = useState(null);
    const [formEdit, setFormEdit] = useState({
        presentacion: "",
        precioCosto: "",
        precioFacturacion: "",
    });

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

    // ─── Abrir modal ─────────────────────────────────────────────
    const abrirModal = (item) => {
        setItemEditando(item);
        setFormEdit({
            presentacion: item.presentacion,
            precioCosto: String(item.precioCosto),
            precioFacturacion: String(item.precioFacturacion),
        });
        setModalAbierto(true);
    };

    const cerrarModal = () => {
        setModalAbierto(false);
        setItemEditando(null);
        setFormEdit({ presentacion: "", precioCosto: "", precioFacturacion: "" });
    };

    // ─── Guardar edición ──────────────────────────────────────────
    const guardarEdicion = async () => {
        const costo = parseFloat(formEdit.precioCosto.replace(",", ".")) || 0;
        const fact = parseFloat(formEdit.precioFacturacion.replace(",", ".")) || 0;
        if (costo < 0 || fact < 0) {
            setMensaje("⚠️ Los precios no pueden ser negativos.");
            setTimeout(() => setMensaje(""), 3000);
            return;
        }

        try {
            const categoria = itemEditando.categoria;
            await update(ref(db, `medydescartables/${categoria}/${itemEditando.key}`), {
                presentacion: formEdit.presentacion,
                precioCosto: costo,
                precioFacturacion: fact,
            });
            setMensaje("✅ Producto actualizado.");
            setTimeout(() => setMensaje(""), 2000);
            cerrarModal();
        } catch (error) {
            console.error(error);
            setMensaje("❌ Error al guardar.");
            setTimeout(() => setMensaje(""), 3000);
        }
    };

    // ─── Eliminar ─────────────────────────────────────────────────
    const eliminarProducto = async (key, categoria) => {
        const nombre = items.find((i) => i.key === key)?.nombre || key;
        if (!confirm(`¿Eliminar "${nombre}"?`)) return;
        try {
            await remove(ref(db, `medydescartables/${categoria}/${key}`));
            setMensaje("🗑️ Producto eliminado.");
            setTimeout(() => setMensaje(""), 2000);
        } catch (error) {
            console.error(error);
            setMensaje("❌ Error al eliminar.");
            setTimeout(() => setMensaje(""), 3000);
        }
    };

    // ─── Estilos para alinear columnas ──────────────────────────
    const colStyles = {
        table: { tableLayout: "fixed", width: "100%", borderCollapse: "collapse" },
        colNombre: { width: "28%" },
        colPresentacion: { width: "18%", textAlign: "center" },
        colTipo: { width: "14%", textAlign: "center" },
        colPrecio: { width: "14%", textAlign: "right" },
        colAcciones: { width: "12%", textAlign: "center" },
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
                                <th style={colStyles.colPrecio}>Precio Costo ($)</th>
                                <th style={colStyles.colPrecio}>Precio Facturación ($)</th>
                                <th style={colStyles.colAcciones}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtrados.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: "center", padding: "2rem" }}>
                                        No hay productos.
                                    </td>
                                </tr>
                            ) : (
                                filtrados.map((item) => (
                                    <tr key={`${item.categoria}_${item.key}`}>
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
                                        <td style={colStyles.colPrecio}>
                                            {formatCurrency(item.precioCosto)}
                                        </td>
                                        <td style={colStyles.colPrecio}>
                                            {formatCurrency(item.precioFacturacion)}
                                        </td>
                                        <td style={colStyles.colAcciones}>
                                            <button
                                                className={styles.btnPrimary}
                                                onClick={() => abrirModal(item)}
                                                style={{ marginRight: "5px" }}
                                            >
                                                ✏️
                                            </button>
                                            <button
                                                className={styles.btnDanger}
                                                onClick={() => eliminarProducto(item.key, item.categoria)}
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* MODAL DE EDICIÓN */}
            {modalAbierto && (
                <div className={styles.modalOverlay} onClick={cerrarModal}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <h3>Editar producto</h3>
                        <div className={styles.modalBody}>
                            <p>
                                <strong>{itemEditando?.nombre}</strong>
                            </p>

                            <div className={styles.fieldGroup}>
                                <label>Presentación</label>
                                <select
                                    className={styles.input}
                                    value={formEdit.presentacion}
                                    onChange={(e) =>
                                        setFormEdit((prev) => ({
                                            ...prev,
                                            presentacion: e.target.value,
                                        }))
                                    }
                                >
                                    {PRESENTACIONES[itemEditando?.categoria || "medicamentos"].map(
                                        ([v, label]) => (
                                            <option key={v} value={v}>
                                                {label}
                                            </option>
                                        )
                                    )}
                                </select>
                            </div>

                            <div className={styles.fieldGroup}>
                                <label>Precio Costo ($)</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={formEdit.precioCosto}
                                    onChange={(e) =>
                                        setFormEdit((prev) => ({
                                            ...prev,
                                            precioCosto: e.target.value,
                                        }))
                                    }
                                />
                            </div>

                            <div className={styles.fieldGroup}>
                                <label>Precio Facturación ($)</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    value={formEdit.precioFacturacion}
                                    onChange={(e) =>
                                        setFormEdit((prev) => ({
                                            ...prev,
                                            precioFacturacion: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <div className={styles.modalFooter}>
                            <button className={styles.btnPrimary} onClick={guardarEdicion}>
                                💾 Guardar
                            </button>
                            <button className={styles.btnDanger} onClick={cerrarModal}>
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
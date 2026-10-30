"use client";
import { useMemo, useState } from "react";
import { matchesAllTerms, formatCurrency } from "@/app/farmacia/utils/farmacia";
import { labelPresentacion } from "@/lib/pami/presupuestos";
import styles from "./presupuesto.module.css";

const MAX_VISIBLES = 30;
const MIN_BUSQUEDA = 2;
const VISIBLES_SIN_BUSQUEDA = 20;

const TOP_ITEMS_RAW = [
    "SUERO_FISIOLOGICO_500_M_L",
    "RANITIDINA",
    "METOCLOPRAMIDA_(RELIVERAN)_-_FACTURACION",
    "KETOROLAC",
    "ABOCATH_20",
    "LLAVE_3_VIAS_CPROLONGADOR",
    "V_13"
];

const normalizeStr = (str) => String(str || "").toUpperCase().replace(/[^A-Z0-9]/g, '');
const TOP_ITEMS_NORM = TOP_ITEMS_RAW.map(normalizeStr);

export default function CatalogoProductos({ items, onAgregar }) {
    const [tipo, setTipo] = useState("todos");
    const [busqueda, setBusqueda] = useState("");
    const [pendientes, setPendientes] = useState({});
    const [agregadoId, setAgregadoId] = useState(null);

    const consultaActiva = busqueda.trim().length >= MIN_BUSQUEDA;

    const filtrados = useMemo(() => {
        let activos = items.filter((i) => i.activo);

        if (tipo !== "todos") {
            activos = activos.filter((i) => i.categoria === tipo);
        }

        if (consultaActiva) {
            activos = activos.filter((i) => matchesAllTerms(i.nombre, busqueda));
        }

        activos.sort((a, b) => {
            const aNorm = normalizeStr(a.nombre);
            const bNorm = normalizeStr(b.nombre);

            const idxA = TOP_ITEMS_NORM.findIndex(t => aNorm.includes(t));
            const idxB = TOP_ITEMS_NORM.findIndex(t => bNorm.includes(t));

            if (idxA !== -1 && idxB !== -1) return idxA - idxB;
            if (idxA !== -1) return -1;
            if (idxB !== -1) return 1;
            return a.nombre.localeCompare(b.nombre);
        });

        return activos.slice(0, consultaActiva ? MAX_VISIBLES : VISIBLES_SIN_BUSQUEDA);
    }, [items, tipo, busqueda, consultaActiva]);

    const getPend = (id) => pendientes[id] !== undefined ? pendientes[id] : "1";
    const getPendNum = (id) => {
        const val = String(getPend(id)).replace(",", ".");
        const num = parseFloat(val);
        return isNaN(num) ? 0 : num;
    };

    const setPend = (id, raw) => setPendientes((p) => ({ ...p, [id]: raw }));

    const sumar = (id) => {
        const current = getPendNum(id);
        setPend(id, String(current + 1).replace(".", ","));
    };

    const restar = (id) => {
        const current = getPendNum(id);
        const next = Math.max(0, current - 1);
        setPend(id, String(next).replace(".", ","));
    };

    const agregar = (item) => {
        const id = `${item.categoria}:${item.key}`;
        const qty = getPendNum(id) || 1;
        onAgregar(item, qty);
        setPend(id, "1");
        setAgregadoId(id);
        setTimeout(() => setAgregadoId(null), 1500);
    };

    return (
        <div>
            <div className={styles.grid2} style={{ marginBottom: "1rem" }}>
                <select className={styles.input} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    <option value="todos">📦 Todos</option>
                    <option value="medicamentos">💊 Medicación</option>
                    <option value="descartables">🧷 Descartables</option>
                </select>
                <input type="search" className={styles.input} placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </div>

            {filtrados.length === 0 ? (
                <div className={styles.empty}>No hay productos cargados.</div>
            ) : (
                // QUITAMOS EL maxHeight y overflowY DE AQUI
                <ul className={styles.list} style={{ paddingRight: "5px" }}>
                    {filtrados.map((item) => {
                        const id = `${item.categoria}:${item.key}`;
                        const isAgregado = agregadoId === id;
                        const itemNorm = normalizeStr(item.nombre);
                        const isTop = TOP_ITEMS_NORM.some(t => itemNorm.includes(t));

                        return (
                            <li key={id} className={`${styles.productRow} ${isAgregado ? styles.productRowAgregado : ""}`}>
                                <div className={styles.productInfo}>
                                    <div className={styles.rowName}>
                                        {isTop && <span style={{ color: "#fbbf24", marginRight: "5px" }} title="Más usado">⭐</span>}
                                        {item.nombre}
                                    </div>
                                    <div className={styles.rowMeta}>
                                        {labelPresentacion(item.categoria, item.presentacion)} · {formatCurrency(item.precioFacturacion)}
                                    </div>
                                </div>
                                <div className={styles.productActions}>
                                    <div className={styles.qtyGroup}>
                                        <button type="button" className={styles.qtyBtn} onClick={() => restar(id)}>−</button>
                                        <input
                                            className={styles.qtyInput}
                                            value={getPend(id)}
                                            onChange={(e) => setPend(id, e.target.value)}
                                            inputMode="decimal"
                                        />
                                        <button type="button" className={styles.qtyBtn} onClick={() => sumar(id)}>+</button>
                                    </div>
                                    <button type="button" className={`${styles.btn} ${styles.btnSm} ${isAgregado ? styles.btnAgregado : styles.btnPrimary}`} onClick={() => agregar(item)} style={{ minWidth: 85 }}>
                                        {isAgregado ? "✓ Listo" : "Agregar"}
                                    </button>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
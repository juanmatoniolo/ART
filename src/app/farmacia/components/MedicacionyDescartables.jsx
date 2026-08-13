"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import s from "../farmaciaDashboard.module.css";

/* ===========================================================
   Helpers reutilizados
   =========================================================== */
const limpiarNombre = (str) =>
    String(str ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

const normalizeText = (input) =>
    String(input ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();

const matchesAllTerms = (texto, busqueda) => {
    const t = normalizeText(texto);
    const q = normalizeText(busqueda);
    if (!q) return true;
    return q.split(" ").filter(Boolean).every((term) => t.includes(term));
};

const capitalizar = (s) => {
    const v = String(s ?? "");
    return v.charAt(0).toUpperCase() + v.slice(1);
};

const formatoMoneda = (n) =>
    Number(n ?? 0).toLocaleString("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const CATEGORIAS = [
    { cat: "medicamentos", tipo: "Medicacion", label: "💊 Medicación", presDefault: "ampolla" },
    { cat: "descartables", tipo: "Descartable", label: "🧷 Descartable", presDefault: "unidad" },
];

// Opciones de precio disponibles
const OPCIONES_PRECIO = [
    { valor: "precioReferencia", label: "Precio referencia" },
    { valor: "precioCosto", label: "Precio costo" },
    { valor: "precioFacturacion", label: "Precio facturación" },
    { valor: "precioOtros", label: "Otros precios" },
    { valor: "precio", label: "Precio genérico" },
];

export default function MedicacionyDescartables() {
    const [busqueda, setBusqueda] = useState("");
    const [items, setItems] = useState([]);
    const [precioCampo, setPrecioCampo] = useState("precioReferencia"); // campo por defecto

    /* Suscripción a Firebase para ambas categorías */
    useEffect(() => {
        const datos = {};

        const build = () => {
            const arr = [];
            for (const { cat, tipo, label, presDefault } of CATEGORIAS) {
                const data = datos[cat];
                if (!data) continue;
                for (const [key, d] of Object.entries(data)) {
                    arr.push({
                        id: `medydescartables/${cat}/${key}`,
                        nombre: limpiarNombre(d.nombre || key),
                        presentacion: d.presentacion || presDefault,
                        tipo,
                        tipoFormatted: label,
                        // Almacenamos todos los posibles precios
                        precioReferencia: Number(d.precioReferencia || d.precio || 0),
                        precioCosto: Number(d.precioCosto || d.precioReferencia || d.precio || 0),
                        precioFacturacion: Number(d.precioFacturacion || d.precioReferencia || d.precio || 0),
                        precioOtros: Number(d.precioOtros || d.precioReferencia || d.precio || 0),
                        precio: Number(d.precio || d.precioReferencia || 0),
                    });
                }
            }
            arr.sort((a, b) => a.nombre.localeCompare(b.nombre));
            setItems(arr);
        };

        const unsubs = CATEGORIAS.map(({ cat }) =>
            onValue(ref(db, `medydescartables/${cat}`), (snap) => {
                datos[cat] = snap.exists() ? snap.val() : {};
                build();
            })
        );

        return () => unsubs.forEach((u) => u());
    }, []);

    const filtrados = useMemo(
        () =>
            items.filter(
                (it) =>
                    matchesAllTerms(it.nombre, busqueda) ||
                    matchesAllTerms(it.presentacion, busqueda) ||
                    matchesAllTerms(it.tipoFormatted, busqueda)
            ),
        [items, busqueda]
    );

    // Función para obtener el precio según el campo seleccionado
    const obtenerPrecio = (item) => {
        const valor = item[precioCampo];
        return Number.isFinite(valor) ? valor : 0;
    };

    // Descargar CSV con los datos filtrados
    const descargarCSV = () => {
        if (filtrados.length === 0) {
            alert("No hay datos para exportar.");
            return;
        }

        const opcion = OPCIONES_PRECIO.find((o) => o.valor === precioCampo);
        const etiquetaPrecio = opcion ? opcion.label : "Precio";

        const cabeceras = ["Producto", "Presentación", "Tipo", etiquetaPrecio];
        const filas = filtrados.map((item) => {
            const nombre = String(item.nombre).replace(/_/g, " ");
            const presentacion = String(item.presentacion || "").replace(/_/g, " ");
            const tipo = item.tipo === "Medicacion" ? "Medicación" : "Descartable";
            const precio = obtenerPrecio(item).toFixed(2).replace(".", ",");
            return [`"${nombre}"`, `"${presentacion}"`, `"${tipo}"`, `"${precio}"`].join(";");
        });

        const csvContent = [cabeceras.join(";"), ...filas].join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `medicacion_descartables_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    return (
        <div className={s.panel}>
            {/* Encabezado */}
            <div className={s.panelHeader}>
                <div>
                    <h3 className={s.panelTitle}>💊 Medicación y 🧷 Descartables</h3>
                    <p className={s.panelSub}>{filtrados.length} productos registrados</p>
                </div>
                <div className={s.panelActions}>
                    <button
                        className={`${s.actionBtn} ${s.btn_secondary}`}
                        onClick={descargarCSV}
                        disabled={filtrados.length === 0}
                    >
                        ⬇️ Descargar lista
                    </button>
                </div>
            </div>

            {/* Filtros: búsqueda y selector de precio */}
            <div className={s.filtersRow}>
                <div className={s.searchWrap}>
                    <span className={`${s.searchIconInner} ${s.svgIc}`}>🔍</span>
                    <input
                        className={s.searchInput}
                        type="text"
                        value={busqueda}
                        onChange={(e) => setBusqueda(e.target.value)}
                        placeholder='Buscar (ej: "suero", "ampolla", "descartable")'
                    />
                </div>
                <select
                    className={s.filterSelect}
                    value={precioCampo}
                    onChange={(e) => setPrecioCampo(e.target.value)}
                >
                    {OPCIONES_PRECIO.map((op) => (
                        <option key={op.valor} value={op.valor}>
                            {op.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Tabla de resultados */}
            <div className={s.tableWrap} style={{ display: "block", overflowX: "auto" }}>
                <table className={s.stockTable}>
                    <thead>
                        <tr>
                            <th className={s.thLeft}>Producto</th>
                            <th>Presentación</th>
                            <th>Tipo</th>
                            <th className={s.thRight}>
                                {OPCIONES_PRECIO.find((o) => o.valor === precioCampo)?.label || "Precio"}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtrados.length === 0 ? (
                            <tr>
                                <td colSpan={4}>
                                    <div className={s.emptyState}>
                                        <span>📭</span>
                                        <p>No hay coincidencias.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filtrados.map((item) => (
                                <tr key={item.id} className={s.stockRow}>
                                    <td>
                                        <div className={s.productCell}>
                                            <span className={s.productCellName}>{item.nombre}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={s.badgeNeutral}>
                                            {capitalizar(item.presentacion)}
                                        </span>
                                    </td>
                                    <td>
                                        <span
                                            className={
                                                item.tipo === "Medicacion"
                                                    ? s.badgeMed
                                                    : s.badgeDesc
                                            }
                                        >
                                            {item.tipoFormatted}
                                        </span>
                                    </td>
                                    <td className={s.valueCell}>
                                        {formatoMoneda(obtenerPrecio(item))}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
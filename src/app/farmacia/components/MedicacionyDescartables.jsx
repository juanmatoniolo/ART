"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import s from "../farmaciaDashboard.module.css"; // ← usamos el CSS del dashboard

/* ===========================================================
   Helpers (los mismos, pero sin estilos locales)
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

/* ===========================================================
   Componente principal
   - Ahora recibe el tema desde el padre (Dashboard) y no tiene toggle.
   =========================================================== */

export default function MedicacionyDescartables() {
    // El tema ya lo aplica el contenedor padre (.dashboardContainer con clase .light o .dark)
    // Así que no necesitamos manejar tema aquí.

    const [busqueda, setBusqueda] = useState("");
    const [items, setItems] = useState([]);

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
                        precio: d.precioReferencia || d.precio || 0,
                        presentacion: d.presentacion || presDefault,
                        tipo,
                        tipoFormatted: label,
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

    return (
        <div className={s.panel}>
            {/* Encabezado similar a otros tabs */}
            <div className={s.panelHeader}>
                <div>
                    <h3 className={s.panelTitle}>💊 Medicación y 🧷 Descartables</h3>
                    <p className={s.panelSub}>{filtrados.length} productos registrados</p>
                </div>
            </div>

            {/* Buscador (reutilizamos los estilos del dashboard) */}
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
            </div>

            {/* Tabla de resultados */}
            <div className={s.tableWrap}>
                <table className={s.stockTable}>
                    <thead>
                        <tr>
                            <th className={s.thLeft}>Producto</th>
                            <th>Presentación</th>
                            <th>Tipo</th>
                            <th className={s.thRight}>Precio ($)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filtrados.length === 0 ? (
                            <tr>
                                <td colSpan={4} className={s.emptyState}>
                                    <span>📭</span>
                                    <p>No hay coincidencias.</p>
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
                                    <td className={s.valueCell}>{formatoMoneda(item.precio)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
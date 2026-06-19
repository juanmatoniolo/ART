"use client";

import { useEffect, useMemo, useState } from "react";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import styles from "./medydescartables.module.css";

/* ===========================================================
   Helpers
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

/* Config por categoría (evita duplicar el bloque de mapeo) */
const CATEGORIAS = [
    { cat: "medicamentos", tipo: "Medicacion", label: "💊 Medicación", presDefault: "ampolla" },
    { cat: "descartables", tipo: "Descartable", label: "🧷 Descartable", presDefault: "unidad" },
];

/* ===========================================================
   Componente
   - tema:        opcional. Si lo pasa el padre, manda ese.
   - mostrarToggle: muestra un botón de tema (para uso standalone).
   =========================================================== */

export default function MedyDescartablesPage({ tema: temaProp, mostrarToggle = false }) {
    const [busqueda, setBusqueda] = useState("");
    const [items, setItems] = useState([]);
    const [temaLocal, setTemaLocal] = useState("claro");

    const tema = temaProp ?? temaLocal;

    /* Si no recibe tema por prop, lo lee/escucha desde localStorage */
    useEffect(() => {
        if (temaProp || typeof window === "undefined") return;

        const guardado = localStorage.getItem("insumos-tema");
        if (guardado === "claro" || guardado === "oscuro") setTemaLocal(guardado);

        const onStorage = (e) => {
            if (e.key === "insumos-tema" && (e.newValue === "claro" || e.newValue === "oscuro")) {
                setTemaLocal(e.newValue);
            }
        };
        window.addEventListener("storage", onStorage);
        return () => window.removeEventListener("storage", onStorage);
    }, [temaProp]);

    const alternarTema = () => {
        setTemaLocal((t) => {
            const nuevo = t === "oscuro" ? "claro" : "oscuro";
            if (typeof window !== "undefined") localStorage.setItem("insumos-tema", nuevo);
            return nuevo;
        });
    };

    /* Suscripción a Firebase para ambas categorías */
    useEffect(() => {
        const datos = {}; // { medicamentos: {...}, descartables: {...} }

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
        <div className={`${styles.wrapper} ${tema === "oscuro" ? styles.dark : ""}`}>
            <div className={styles.headerBar}>
                <h2 className={styles.title}>💊 Medicación y 🧷 Descartables</h2>
                {mostrarToggle && (
                    <button
                        className={styles.themeToggle}
                        onClick={alternarTema}
                        title="Cambiar tema"
                        aria-label="Cambiar tema"
                    >
                        {tema === "oscuro" ? "☀️ Claro" : "🌙 Oscuro"}
                    </button>
                )}
            </div>

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
                            <th className={styles.thPrice}>Precio ($)</th>
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
                            filtrados.map((item) => (
                                <tr key={item.id}>
                                    <td className={styles.productCell}>{item.nombre}</td>
                                    <td>
                                        <span className={styles.presentacion}>
                                            {capitalizar(item.presentacion)}
                                        </span>
                                    </td>
                                    <td>
                                        <span
                                            className={
                                                item.tipo === "Medicacion"
                                                    ? styles.medicacion
                                                    : styles.descartable
                                            }
                                        >
                                            {item.tipoFormatted}
                                        </span>
                                    </td>
                                    <td className={styles.priceCell}>{formatoMoneda(item.precio)}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
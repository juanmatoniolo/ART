"use client";
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import MedyDescartablesPage from "@/components/medicacion/page";
import { db } from "@/lib/firebase";
import {
    ref,
    onValue,
    set,
    remove,
    update,
    get, // ✅ para descargar listas
} from "firebase/database";
import styles from "./insumosAdmin.module.css";

/** Sanitiza claves para Firebase */
const limpiarKey = (str) =>
    String(str ?? "")
        .replace(/[.#$/[\]]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .trim();

/** Normaliza para búsqueda */
const normalizeText = (input) =>
    String(input ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/** Coincidencia: contiene TODOS los términos (AND) */
const matchesAllTerms = (texto, busqueda) => {
    const t = normalizeText(texto);
    const q = normalizeText(busqueda);
    if (!q) return true;
    const terms = q.split(" ").filter(Boolean);
    return terms.every((term) => t.includes(term));
};

export default function InsumosAdmin() {
    const [tab, setTab] = useState("ver");
    const [tipo, setTipo] = useState("medicamentos");
    const [meds, setMeds] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [nuevoNombre, setNuevoNombre] = useState("");
    const [nuevoPrecio, setNuevoPrecio] = useState("");
    const [mensaje, setMensaje] = useState("");
    const [modificados, setModificados] = useState({});
    const [archivoPreview, setArchivoPreview] = useState([]);
    const [archivo, setArchivo] = useState(null);

    /* === Escuchar Firebase === */
    useEffect(() => {
        if (tab !== "admin") return;

        const refItems = ref(db, `medydescartables/${tipo}`);
        const unsub = onValue(refItems, (snap) => {
            if (!snap.exists()) return setMeds([]);

            const data = snap.val();
            const lista = Object.entries(data).map(([nombre, precio]) => ({
                nombre,
                precio,
            }));

            setMeds(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        });

        return () => unsub();
    }, [tab, tipo]);

    /* === Agregar === */
    const handleAgregar = async () => {
        if (!nuevoNombre.trim() || !String(nuevoPrecio).trim()) {
            setMensaje("⚠️ Completá nombre y precio.");
            return;
        }

        const key = limpiarKey(nuevoNombre);
        const price = Number(nuevoPrecio);

        if (!key) {
            setMensaje("⚠️ El nombre no es válido.");
            return;
        }
        if (Number.isNaN(price)) {
            setMensaje("⚠️ El precio no es válido.");
            return;
        }

        await set(ref(db, `medydescartables/${tipo}/${key}`), price);

        setNuevoNombre("");
        setNuevoPrecio("");
        setMensaje("✅ Producto agregado correctamente.");
        setTimeout(() => setMensaje(""), 2500);
    };

    /* === Eliminar === */
    const handleEliminar = async (nombre) => {
        if (!confirm(`¿Eliminar "${nombre.replace(/_/g, " ")}"?`)) return;

        await remove(ref(db, `medydescartables/${tipo}/${nombre}`));

        setMensaje("🗑️ Producto eliminado.");
        setTimeout(() => setMensaje(""), 2500);
    };

    /* === Editar === */
    const handleEditar = (nombre, nuevoValor) => {
        const keyLimpia = limpiarKey(nombre);
        const val = Number(nuevoValor);

        setModificados((prev) => ({
            ...prev,
            [keyLimpia]: Number.isNaN(val) ? "" : val,
        }));
    };

    /* === Guardar modificaciones === */
    const guardarModificaciones = async () => {
        if (Object.keys(modificados).length === 0) return;

        const updates = {};
        for (const [nombre, precio] of Object.entries(modificados)) {
            if (precio === "" || Number.isNaN(Number(precio))) continue;
            updates[`medydescartables/${tipo}/${nombre}`] = Number(precio);
        }

        await update(ref(db), updates);

        setMensaje("💾 Cambios guardados correctamente ✅");
        setModificados({});
        setTimeout(() => setMensaje(""), 3000);
    };

    const filtrados = useMemo(() => {
        return meds.filter((item) => matchesAllTerms(item.nombre, busqueda));
    }, [meds, busqueda]);

    /* === Descargar plantilla === */
    const descargarPlantilla = () => {
        const wb = XLSX.utils.book_new();
        const datos = [["Nombre", "Precio"]];
        const ws = XLSX.utils.aoa_to_sheet(datos);
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_insumos.xlsx");
    };

    /* =========================
       ✅ Descargar lista (dropdown)
       ========================= */

    const exportarExcel = (rows, filenameBase) => {
        const wb = XLSX.utils.book_new();

        const sheetData = [
            ["Tipo", "Nombre", "Precio"],
            ...rows.map((r) => [
                r.tipo,
                String(r.nombre).replace(/_/g, " "),
                Number(r.precio ?? 0),
            ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [{ wch: 16 }, { wch: 40 }, { wch: 14 }];

        XLSX.utils.book_append_sheet(wb, ws, "Lista");

        const fecha = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `${filenameBase}_${fecha}.xlsx`);
    };

    const descargarLista = async (scope) => {
        try {
            setMensaje("📥 Generando Excel...");

            const rows = [];

            const fetchCategoria = async (cat, label) => {
                const snap = await get(ref(db, `medydescartables/${cat}`));
                if (!snap.exists()) return;

                const data = snap.val() || {};
                for (const [nombre, precio] of Object.entries(data)) {
                    rows.push({ tipo: label, nombre, precio });
                }
            };

            if (scope === "medicamentos") {
                await fetchCategoria("medicamentos", "Medicacion");
                rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
                exportarExcel(rows, "lista_medicacion");
                setMensaje("✅ Excel de medicación descargado.");
            }

            if (scope === "descartables") {
                await fetchCategoria("descartables", "Descartable");
                rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
                exportarExcel(rows, "lista_descartables");
                setMensaje("✅ Excel de descartables descargado.");
            }

            if (scope === "ambos") {
                await fetchCategoria("medicamentos", "Medicacion");
                await fetchCategoria("descartables", "Descartable");
                rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
                exportarExcel(rows, "lista_medicacion_y_descartables");
                setMensaje("✅ Excel completo descargado.");
            }

            setTimeout(() => setMensaje(""), 3000);
        } catch (err) {
            console.error(err);
            setMensaje("❌ Error al generar el Excel.");
            setTimeout(() => setMensaje(""), 3500);
        }
    };

    /* === Leer Excel (evita duplicados) === */
    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setArchivo(file);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const bstr = evt.target.result;
            const wb = XLSX.read(bstr, { type: "binary" });

            const wsname = wb.SheetNames[0];
            const ws = wb.Sheets[wsname];

            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            const rows = data
                .slice(1)
                .filter((r) => r[0] && r[1])
                .map(([nombre, precio]) => ({
                    nombre: limpiarKey(nombre),
                    precio: Number(precio),
                }))
                .filter((r) => r.nombre && !Number.isNaN(r.precio));

            const seen = new Set();
            const duplicates = new Set();

            rows.forEach((item) => {
                if (seen.has(item.nombre)) duplicates.add(item.nombre);
                else seen.add(item.nombre);
            });

            if (duplicates.size > 0) {
                setArchivoPreview([]);
                setMensaje(
                    "⚠️ Existen productos duplicados en el Excel: " +
                    Array.from(duplicates).join(", ")
                );
                setTimeout(() => setMensaje(""), 5000);
                return;
            }

            setArchivoPreview(rows);
        };

        reader.readAsBinaryString(file);
    };

    /* === Cargar a Firebase === */
    const confirmarCargaExcel = async () => {
        if (!archivoPreview.length) {
            setMensaje("⚠️ No hay datos para cargar.");
            return;
        }

        const seen = new Set();
        const duplicates = new Set();
        for (const it of archivoPreview) {
            const k = limpiarKey(it.nombre);
            if (!k) continue;
            if (seen.has(k)) duplicates.add(k);
            else seen.add(k);
        }
        if (duplicates.size > 0) {
            setMensaje(
                "⚠️ Hay duplicados en la previsualización: " +
                Array.from(duplicates).join(", ")
            );
            setTimeout(() => setMensaje(""), 5000);
            return;
        }

        const updates = {};
        archivoPreview.forEach((item) => {
            const key = limpiarKey(item.nombre);
            const price = Number(item.precio);
            if (!key || Number.isNaN(price)) return;
            updates[`medydescartables/${tipo}/${key}`] = price;
        });

        await update(ref(db), updates);

        setArchivoPreview([]);
        setArchivo(null);
        setMensaje("✅ Archivo Excel cargado correctamente.");
        setTimeout(() => setMensaje(""), 3000);
    };

    return (
        <div className={styles.wrapper}>
            <h2 className={styles.title}>🧪 Insumos: Medicación y Descartables</h2>

            {mensaje && (
                <div
                    className={`${styles.toast} ${mensaje.includes("✅") || mensaje.includes("💾")
                            ? styles.toastSuccess
                            : styles.toastInfo
                        }`}
                >
                    {mensaje}
                </div>
            )}

            {/* Tabs */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${tab === "ver" ? styles.active : ""}`}
                    onClick={() => setTab("ver")}
                >
                    💊 Med + 🧷 Descartables
                </button>

                <button
                    className={`${styles.tab} ${tab === "admin" ? styles.active : ""}`}
                    onClick={() => setTab("admin")}
                >
                    ⚙️ Administración
                </button>

                <button
                    className={`${styles.tab} ${tab === "masiva" ? styles.active : ""}`}
                    onClick={() => setTab("masiva")}
                >
                    📦 Carga Masiva
                </button>
            </div>

            {/* ✅ Dropdown único: Descargar lista */}
            <div className={styles.content} style={{ paddingTop: 0 }}>
                <select
                    className={styles.selectTipo} // si querés otro estilo, cambiá por styles.select
                    defaultValue=""
                    onChange={(e) => {
                        const value = e.target.value;
                        if (!value) return;
                        descargarLista(value);
                        e.target.value = ""; // vuelve al placeholder
                    }}
                >
                    <option value="" disabled>
                        📥 Descargar lista
                    </option>
                    <option value="medicamentos">💊 Medicación</option>
                    <option value="descartables">🧷 Descartables</option>
                    <option value="ambos">📦 Medicación + Descartables</option>
                </select>
            </div>

            {/* Ver */}
            {tab === "ver" && (
                <div className={styles.content}>
                    <MedyDescartablesPage />
                </div>
            )}

            {/* Admin */}
            {tab === "admin" && (
                <div className={styles.content}>
                    <div className={styles.adminHeader}>
                        <select
                            className={styles.selectTipo}
                            value={tipo}
                            onChange={(e) => setTipo(e.target.value)}
                        >
                            <option value="medicamentos">💊 Medicación</option>
                            <option value="descartables">🧷 Descartables</option>
                        </select>

                        <input
                            type="text"
                            className={styles.search}
                            placeholder='Buscar (ej: "suero dextrosa 10")'
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>

                    {/* Agregar */}
                    <div className={styles.form}>
                        <h4>➕ Agregar producto</h4>
                        <div className={styles.row}>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder="Nombre..."
                                value={nuevoNombre}
                                onChange={(e) => setNuevoNombre(e.target.value)}
                            />
                            <input
                                type="number"
                                className={styles.input}
                                placeholder="Precio..."
                                value={nuevoPrecio}
                                onChange={(e) => setNuevoPrecio(e.target.value)}
                            />
                            <button className={styles.btnPrimary} onClick={handleAgregar}>
                                💾 Guardar
                            </button>
                        </div>
                    </div>

                    {/* Tabla */}
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th>Precio ($)</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtrados.length === 0 ? (
                                <tr>
                                    <td colSpan={3}>No hay productos.</td>
                                </tr>
                            ) : (
                                filtrados.map((item) => (
                                    <tr key={`${tipo}_${item.nombre}`}>
                                        <td>{item.nombre.replace(/_/g, " ")}</td>
                                        <td>
                                            <input
                                                type="number"
                                                defaultValue={item.precio}
                                                className={styles.inputPrecio}
                                                onChange={(e) =>
                                                    handleEditar(item.nombre, e.target.value)
                                                }
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className={styles.btnDanger}
                                                onClick={() => handleEliminar(item.nombre)}
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>

                    <div className={styles.footerActions}>
                        <button
                            className={styles.btnSaveChanges}
                            onClick={guardarModificaciones}
                            disabled={Object.keys(modificados).length === 0}
                        >
                            💾 Guardar Modificaciones
                        </button>
                    </div>
                </div>
            )}

            {/* Carga masiva */}
            {tab === "masiva" && (
                <div className={styles.content}>
                    <h4>📦 Carga masiva de productos</h4>

                    <select
                        className={styles.selectTipo}
                        value={tipo}
                        onChange={(e) => setTipo(e.target.value)}
                    >
                        <option value="medicamentos">💊 Medicación</option>
                        <option value="descartables">🧷 Descartables</option>
                    </select>

                    <div className={styles.form}>
                        <p className={styles.textMuted}>
                            Subí un archivo Excel (.xlsx) o descargá la plantilla.
                        </p>

                        <button className={styles.btnPrimary} onClick={descargarPlantilla}>
                            📥 Descargar plantilla
                        </button>

                        <div style={{ marginTop: "1rem" }}>
                            <input
                                id="fileExcel"
                                type="file"
                                accept=".xlsx, .xls"
                                className={styles.fileInput}
                                onChange={handleExcelUpload}
                            />

                            <label htmlFor="fileExcel" className={styles.fileInputLabel}>
                                📤 Seleccionar archivo
                            </label>

                            {archivo && <span className={styles.fileName}>{archivo.name}</span>}
                        </div>
                    </div>

                    {/* Previsualización */}
                    {archivoPreview.length > 0 && (
                        <div className={styles.form}>
                            <h5>👀 Previsualización ({archivoPreview.length} items)</h5>

                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Precio</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {archivoPreview.map((item, i) => (
                                        <tr key={`${item.nombre}_${i}`}>
                                            <td>
                                                <input
                                                    className={styles.input}
                                                    value={item.nombre}
                                                    onChange={(e) => {
                                                        const copy = [...archivoPreview];
                                                        copy[i].nombre = limpiarKey(e.target.value);
                                                        setArchivoPreview(copy);
                                                    }}
                                                />
                                            </td>

                                            <td>
                                                <input
                                                    type="number"
                                                    className={styles.input}
                                                    value={item.precio}
                                                    onChange={(e) => {
                                                        const copy = [...archivoPreview];
                                                        copy[i].precio = e.target.value;
                                                        setArchivoPreview(copy);
                                                    }}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <button
                                className={styles.btnSaveChanges}
                                onClick={confirmarCargaExcel}
                            >
                                ✅ Confirmar carga a Firebase
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

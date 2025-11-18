"use client";
import { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import MedyDescartablesPage from "@/components/medicacion/page";
import { db } from "@/lib/firebase";
import { ref, onValue, set, remove, update } from "firebase/database";
import styles from "./insumosAdmin.module.css";

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

    /* === Sanitiza claves para Firebase === */
    const limpiarKey = (str) =>
        String(str)
            .replace(/[.#$/[\]]/g, "") // prohíbidos Firebase
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_")
            .replace(/^_+|_+$/g, "")
            .trim();

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
        if (!nuevoNombre.trim() || !nuevoPrecio.trim())
            return setMensaje("⚠️ Completá nombre y precio.");

        const key = limpiarKey(nuevoNombre);

        await set(
            ref(db, `medydescartables/${tipo}/${key}`),
            parseFloat(nuevoPrecio)
        );

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

        setModificados((prev) => ({
            ...prev,
            [keyLimpia]: parseFloat(nuevoValor),
        }));
    };

    /* === Guardar modificaciones === */
    const guardarModificaciones = async () => {
        if (Object.keys(modificados).length === 0) return;

        const updates = {};

        Object.entries(modificados).forEach(([nombre, precio]) => {
            updates[`medydescartables/${tipo}/${nombre}`] = precio;
        });

        await update(ref(db), updates);

        setMensaje("💾 Cambios guardados correctamente ✅");
        setModificados({});
        setTimeout(() => setMensaje(""), 3000);
    };

    const filtrados = meds.filter((item) =>
        item.nombre.toLowerCase().includes(busqueda.toLowerCase())
    );

    /* === Descargar plantilla === */
    const descargarPlantilla = () => {
        const wb = XLSX.utils.book_new();
        const datos = [["Nombre", "Precio"]];
        const ws = XLSX.utils.aoa_to_sheet(datos);
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_insumos.xlsx");
    };

    /* === Leer Excel === */
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

            const preview = data
                .slice(1)
                .filter((r) => r[0] && r[1])
                .map(([nombre, precio]) => ({
                    nombre: limpiarKey(nombre),
                    precio: parseFloat(precio),
                }));

            setArchivoPreview(preview);
        };
        reader.readAsBinaryString(file);
    };

    /* === Cargar a Firebase === */
    const confirmarCargaExcel = async () => {
        if (!archivoPreview.length)
            return setMensaje("⚠️ No hay datos para cargar.");

        const updates = {};

        archivoPreview.forEach((item) => {
            const key = limpiarKey(item.nombre);
            updates[`medydescartables/${tipo}/${key}`] = parseFloat(item.precio);
        });

        await update(ref(db), updates);

        setArchivoPreview([]);
        setArchivo(null);
        setMensaje("✅ Archivo Excel cargado correctamente.");
        setTimeout(() => setMensaje(""), 3000);
    };

    /* === RENDER === */
    return (
        <div className={styles.wrapper}>
            <h2 className={styles.title}>🧪 Insumos: Medicación y Descartables</h2>

            {mensaje && (
                <div
                    className={`${styles.toast} ${
                        mensaje.includes("✅") || mensaje.includes("💾")
                            ? styles.toastSuccess
                            : styles.toastInfo
                    }`}
                >
                    {mensaje}
                </div>
            )}

            {/* === Tabs === */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${
                        tab === "ver" ? styles.active : ""
                    }`}
                    onClick={() => setTab("ver")}
                >
                    💊 Med + 🧷 Descartables
                </button>

                <button
                    className={`${styles.tab} ${
                        tab === "admin" ? styles.active : ""
                    }`}
                    onClick={() => setTab("admin")}
                >
                    ⚙️ Administración
                </button>

                <button
                    className={`${styles.tab} ${
                        tab === "masiva" ? styles.active : ""
                    }`}
                    onClick={() => setTab("masiva")}
                >
                    📦 Carga Masiva
                </button>
            </div>

            {/* === Ver === */}
            {tab === "ver" && (
                <div className={styles.content}>
                    <MedyDescartablesPage />
                </div>
            )}

            {/* === Admin === */}
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
                            placeholder="Buscar producto..."
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
                            <button
                                className={styles.btnPrimary}
                                onClick={handleAgregar}
                            >
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
                                    <tr key={item.nombre}>
                                        <td>
                                            {item.nombre.replace(/_/g, " ")}
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                defaultValue={item.precio}
                                                className={styles.inputPrecio}
                                                onChange={(e) =>
                                                    handleEditar(
                                                        item.nombre,
                                                        e.target.value
                                                    )
                                                }
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className={styles.btnDanger}
                                                onClick={() =>
                                                    handleEliminar(item.nombre)
                                                }
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
                            disabled={
                                Object.keys(modificados).length === 0
                            }
                        >
                            💾 Guardar Modificaciones
                        </button>
                    </div>
                </div>
            )}

            {/* === Carga masiva === */}
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

                        <button
                            className={styles.btnPrimary}
                            onClick={descargarPlantilla}
                        >
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

                            <label
                                htmlFor="fileExcel"
                                className={styles.fileInputLabel}
                            >
                                📤 Seleccionar archivo
                            </label>

                            {archivo && (
                                <span className={styles.fileName}>
                                    {archivo.name}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Previsualización */}
                    {archivoPreview.length > 0 && (
                        <div className={styles.form}>
                            <h5>
                                👀 Previsualización (
                                {archivoPreview.length} items)
                            </h5>

                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Precio</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {archivoPreview.map((item, i) => (
                                        <tr key={i}>
                                            <td>
                                                <input
                                                    className={styles.input}
                                                    value={item.nombre}
                                                    onChange={(e) => {
                                                        const copy = [
                                                            ...archivoPreview,
                                                        ];
                                                        copy[i].nombre =
                                                            limpiarKey(
                                                                e.target.value
                                                            );
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
                                                        const copy = [
                                                            ...archivoPreview,
                                                        ];
                                                        copy[i].precio =
                                                            e.target.value;
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

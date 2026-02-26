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
    get,
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
    const [items, setItems] = useState([]);
    const [busqueda, setBusqueda] = useState("");
    const [nuevoNombre, setNuevoNombre] = useState("");
    const [nuevoPrecio, setNuevoPrecio] = useState("");
    const [nuevaPresentacion, setNuevaPresentacion] = useState("ampolla");
    const [mensaje, setMensaje] = useState("");
    const [modificados, setModificados] = useState({});
    const [archivoPreview, setArchivoPreview] = useState([]);
    const [archivo, setArchivo] = useState(null);

    /* === Escuchar Firebase - FIXED === */
    useEffect(() => {
        if (tab !== "admin") return;

        const refItems = ref(db, `medydescartables/${tipo}`);
        const unsub = onValue(refItems, (snap) => {
            if (!snap.exists()) return setItems([]);

            const data = snap.val();
            const lista = Object.entries(data).map(([key, itemData]) => ({
                key, // Guardamos la key original
                nombre: itemData.nombre || key,
                precio: typeof itemData.precioReferencia === 'number' ? itemData.precioReferencia : 
                       typeof itemData.precio === 'number' ? itemData.precio : 0,
                presentacion: itemData.presentacion || "unidad",
                tipo: itemData.tipo || (tipo === "medicamentos" ? "medicamento" : "descartable")
            }));

            setItems(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        });

        return () => unsub();
    }, [tab, tipo]);

    /* === Agregar - FIXED === */
    const handleAgregar = async () => {
        if (!nuevoNombre.trim() || !String(nuevoPrecio).trim()) {
            setMensaje("⚠️ Completá nombre y precio.");
            return;
        }

        const key = limpiarKey(nuevoNombre);
        const price = parseFloat(nuevoPrecio);

        if (!key) {
            setMensaje("⚠️ El nombre no es válido.");
            return;
        }
        if (isNaN(price) || price < 0) {
            setMensaje("⚠️ El precio no es válido.");
            return;
        }

        const itemData = {
            nombre: nuevoNombre,
            tipo: tipo === "medicamentos" ? "medicamento" : "descartable",
            presentacion: nuevaPresentacion,
            stockActual: 0,
            stockMinimo: 10,
            precioReferencia: price,
            activo: true
        };

        try {
            await set(ref(db, `medydescartables/${tipo}/${key}`), itemData);
            setNuevoNombre("");
            setNuevoPrecio("");
            setNuevaPresentacion("ampolla");
            setMensaje("✅ Producto agregado correctamente.");
            setTimeout(() => setMensaje(""), 2500);
        } catch (error) {
            console.error("Error al agregar:", error);
            setMensaje("❌ Error al agregar producto.");
            setTimeout(() => setMensaje(""), 2500);
        }
    };

    /* === Eliminar === */
    const handleEliminar = async (key) => {
        const nombreMostrar = items.find(item => item.key === key)?.nombre || key;
        if (!confirm(`¿Eliminar "${nombreMostrar.replace(/_/g, " ")}"?`)) return;

        try {
            await remove(ref(db, `medydescartables/${tipo}/${key}`));
            setMensaje("🗑️ Producto eliminado.");
            setTimeout(() => setMensaje(""), 2500);
        } catch (error) {
            console.error("Error al eliminar:", error);
            setMensaje("❌ Error al eliminar producto.");
            setTimeout(() => setMensaje(""), 2500);
        }
    };

    /* === Editar - FIXED === */
    const handleEditar = (key, campo, nuevoValor) => {
        setModificados((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [campo]: campo === 'precio' ?
                    (isNaN(parseFloat(nuevoValor)) ? 0 : parseFloat(nuevoValor)) :
                    nuevoValor
            }
        }));
    };

    /* === Guardar modificaciones - FIXED === */
    const guardarModificaciones = async () => {
        if (Object.keys(modificados).length === 0) return;

        try {
            const updates = {};
            for (const [key, cambios] of Object.entries(modificados)) {
                const itemOriginal = items.find(item => item.key === key);
                if (!itemOriginal) continue;

                // Construir objeto actualizado
                const itemActualizado = {
                    nombre: itemOriginal.nombre,
                    tipo: itemOriginal.tipo,
                    presentacion: cambios.presentacion !== undefined ? cambios.presentacion : itemOriginal.presentacion,
                    stockActual: itemOriginal.stockActual || 0,
                    stockMinimo: itemOriginal.stockMinimo || 10,
                    precioReferencia: cambios.precio !== undefined ? Number(cambios.precio) : itemOriginal.precio,
                    activo: true
                };

                updates[`medydescartables/${tipo}/${key}`] = itemActualizado;
            }

            await update(ref(db), updates);
            setMensaje("💾 Cambios guardados correctamente ✅");
            setModificados({});
            setTimeout(() => setMensaje(""), 3000);
        } catch (error) {
            console.error("Error al guardar modificaciones:", error);
            setMensaje("❌ Error al guardar cambios.");
            setTimeout(() => setMensaje(""), 3000);
        }
    };

    const filtrados = useMemo(() => {
        return items.filter((item) => matchesAllTerms(item.nombre, busqueda));
    }, [items, busqueda]);

    /* === Descargar plantilla === */
    const descargarPlantilla = () => {
        const wb = XLSX.utils.book_new();
        const datos = [["Nombre", "Precio", "Presentacion"]];
        const ws = XLSX.utils.aoa_to_sheet(datos);
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_insumos.xlsx");
    };

    /* === Descargar lista - FIXED === */
    const exportarExcel = (rows, filenameBase) => {
        const wb = XLSX.utils.book_new();

        const sheetData = [
            ["Tipo", "Nombre", "Presentacion", "Precio"],
            ...rows.map((r) => [
                r.tipo === "medicamento" ? "Medicación" : "Descartable",
                String(r.nombre).replace(/_/g, " "),
                r.presentacion,
                Number(r.precio ?? 0),
            ]),
        ];

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [{ wch: 16 }, { wch: 40 }, { wch: 20 }, { wch: 14 }];

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
                for (const [key, itemData] of Object.entries(data)) {
                    rows.push({
                        tipo: itemData.tipo || (cat === "medicamentos" ? "medicamento" : "descartable"),
                        nombre: itemData.nombre || key,
                        presentacion: itemData.presentacion || "unidad",
                        precio: itemData.precioReferencia || itemData.precio || 0
                    });
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

            const rows = data
                .slice(1)
                .filter((r) => r[0] && r[1])
                .map(([nombre, precio, presentacion]) => ({
                    nombre: limpiarKey(nombre),
                    precio: parseFloat(precio) || 0,
                    presentacion: presentacion || (tipo === "medicamentos" ? "ampolla" : "unidad")
                }))
                .filter((r) => r.nombre);

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

        try {
            const updates = {};
            archivoPreview.forEach((item) => {
                const key = limpiarKey(item.nombre);
                const price = parseFloat(item.precio) || 0;
                if (!key) return;

                updates[`medydescartables/${tipo}/${key}`] = {
                    nombre: item.nombre.replace(/_/g, " "),
                    tipo: tipo === "medicamentos" ? "medicamento" : "descartable",
                    presentacion: item.presentacion || (tipo === "medicamentos" ? "ampolla" : "unidad"),
                    stockActual: 0,
                    stockMinimo: 10,
                    precioReferencia: price,
                    activo: true
                };
            });

            await update(ref(db), updates);

            setArchivoPreview([]);
            setArchivo(null);
            setMensaje("✅ Archivo Excel cargado correctamente.");
            setTimeout(() => setMensaje(""), 3000);
        } catch (error) {
            console.error("Error al cargar Excel:", error);
            setMensaje("❌ Error al cargar archivo Excel.");
            setTimeout(() => setMensaje(""), 3000);
        }
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
            <div className={styles.content} style={{ paddingTop: 0, marginBottom: "1.5rem" }}>
                <select
                    className={styles.selectTipo}
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
                                step="0.01"
                                className={styles.input}
                                placeholder="Precio..."
                                value={nuevoPrecio}
                                onChange={(e) => setNuevoPrecio(e.target.value)}
                            />
                            <select
                                className={styles.input}
                                value={nuevaPresentacion}
                                onChange={(e) => setNuevaPresentacion(e.target.value)}
                            >
                                {tipo === "medicamentos" ? (
                                    <>
                                        <option value="ampolla">Ampolla</option>
                                        <option value="vial">Vial</option>
                                        <option value="tabletas">Tabletas</option>
                                        <option value="frasco">Frasco</option>
                                        <option value="bolsa">Bolsa</option>
                                        <option value="jeringa">Jeringa</option>
                                        <option value="gasas">Gasas</option>
                                        <option value="tubo">Tubo</option>
                                        <option value="tiras">Tiras</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="unidad">Unidad</option>
                                        <option value="rollo">Rollo</option>
                                        <option value="juego">Juego</option>
                                        <option value="bolsa">Bolsa</option>
                                        <option value="frasco">Frasco</option>
                                        <option value="kit">Kit</option>
                                        <option value="set">Set</option>
                                        <option value="tubo">Tubo</option>
                                    </>
                                )}
                            </select>
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
                                <th>Presentación</th>
                                <th>Precio ($)</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>

                        <tbody>
                            {filtrados.length === 0 ? (
                                <tr>
                                    <td colSpan={4}>No hay productos.</td>
                                </tr>
                            ) : (
                                filtrados.map((item) => (
                                    <tr key={`${tipo}_${item.key}`}>
                                        <td>{item.nombre.replace(/_/g, " ")}</td>
                                        <td>
                                            <select
                                                className={styles.inputPrecio}
                                                defaultValue={item.presentacion}
                                                onChange={(e) =>
                                                    handleEditar(item.key, 'presentacion', e.target.value)
                                                }
                                            >
                                                {tipo === "medicamentos" ? (
                                                    <>
                                                        <option value="ampolla">Ampolla</option>
                                                        <option value="vial">Vial</option>
                                                        <option value="tabletas">Tabletas</option>
                                                        <option value="frasco">Frasco</option>
                                                        <option value="bolsa">Bolsa</option>
                                                        <option value="jeringa">Jeringa</option>
                                                        <option value="gasas">Gasas</option>
                                                        <option value="tubo">Tubo</option>
                                                        <option value="tiras">Tiras</option>
                                                    </>
                                                ) : (
                                                    <>
                                                        <option value="unidad">Unidad</option>
                                                        <option value="rollo">Rollo</option>
                                                        <option value="juego">Juego</option>
                                                        <option value="bolsa">Bolsa</option>
                                                        <option value="frasco">Frasco</option>
                                                        <option value="kit">Kit</option>
                                                        <option value="set">Set</option>
                                                        <option value="tubo">Tubo</option>
                                                    </>
                                                )}
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                step="0.01"
                                                defaultValue={item.precio}
                                                className={styles.inputPrecio}
                                                onChange={(e) =>
                                                    handleEditar(item.key, 'precio', e.target.value)
                                                }
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className={styles.btnDanger}
                                                onClick={() => handleEliminar(item.key)}
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
                                        <th>Presentación</th>
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
                                                <select
                                                    className={styles.input}
                                                    value={item.presentacion}
                                                    onChange={(e) => {
                                                        const copy = [...archivoPreview];
                                                        copy[i].presentacion = e.target.value;
                                                        setArchivoPreview(copy);
                                                    }}
                                                >
                                                    {tipo === "medicamentos" ? (
                                                        <>
                                                            <option value="ampolla">Ampolla</option>
                                                            <option value="vial">Vial</option>
                                                            <option value="tabletas">Tabletas</option>
                                                            <option value="frasco">Frasco</option>
                                                            <option value="bolsa">Bolsa</option>
                                                            <option value="jeringa">Jeringa</option>
                                                            <option value="gasas">Gasas</option>
                                                            <option value="tubo">Tubo</option>
                                                            <option value="tiras">Tiras</option>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <option value="unidad">Unidad</option>
                                                            <option value="rollo">Rollo</option>
                                                            <option value="juego">Juego</option>
                                                            <option value="bolsa">Bolsa</option>
                                                            <option value="frasco">Frasco</option>
                                                            <option value="kit">Kit</option>
                                                            <option value="set">Set</option>
                                                            <option value="tubo">Tubo</option>
                                                        </>
                                                    )}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    step="0.01"
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
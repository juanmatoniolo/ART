"use client";
import { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import MedyDescartablesPage from "@/components/medicacion/page";
import { db } from "@/lib/firebase";
import { ref, onValue, set, remove, update, get } from "firebase/database";
import styles from "./insumosAdmin.module.css";

/* ===========================================================
   Helpers
   =========================================================== */

/** Sanitiza claves para Firebase */
const limpiarKey = (str) =>
    String(str ?? "")
        .replace(/[.#$/[\]]/g, "")
        .replace(/\s+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .trim();

/** Nombre legible (espacios, sin guiones bajos) */
const limpiarNombre = (str) =>
    String(str ?? "").replace(/_/g, " ").replace(/\s+/g, " ").trim();

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
    return q.split(" ").filter(Boolean).every((term) => t.includes(term));
};

/** Presentaciones por tipo (única fuente de verdad, sin repetir en el JSX) */
const PRESENTACIONES = {
    medicamentos: [
        ["ampolla", "Ampolla"], ["vial", "Vial"], ["tabletas", "Tabletas"],
        ["frasco", "Frasco"], ["bolsa", "Bolsa"], ["jeringa", "Jeringa"],
        ["gasas", "Gasas"], ["tubo", "Tubo"], ["tiras", "Tiras"],
    ],
    descartables: [
        ["unidad", "Unidad"], ["rollo", "Rollo"], ["juego", "Juego"],
        ["bolsa", "Bolsa"], ["frasco", "Frasco"], ["kit", "Kit"],
        ["set", "Set"], ["tubo", "Tubo"],
    ],
};

const OpcionesPresentacion = ({ tipo }) =>
    PRESENTACIONES[tipo].map(([v, label]) => (
        <option key={v} value={v}>{label}</option>
    ));

const tipoSingular = (tipo) => (tipo === "medicamentos" ? "medicamento" : "descartable");

/** Detecta nombres que colisionan en una misma key */
const duplicadosPorKey = (lista) => {
    const seen = new Set();
    const dup = new Set();
    for (const it of lista) {
        const k = limpiarKey(it.nombre);
        if (!k) continue;
        if (seen.has(k)) dup.add(limpiarNombre(it.nombre));
        else seen.add(k);
    }
    return [...dup];
};

/* ===========================================================
   Componente
   =========================================================== */

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
    const [tema, setTema] = useState("claro");

    /* === Tema: leer y persistir preferencia === */
    useEffect(() => {
        if (typeof window === "undefined") return;
        const guardado = localStorage.getItem("insumos-tema");
        if (guardado === "claro" || guardado === "oscuro") setTema(guardado);
    }, []);

    useEffect(() => {
        if (typeof window !== "undefined") localStorage.setItem("insumos-tema", tema);
    }, [tema]);

    /* === Reset de presentación al cambiar de tipo === */
    useEffect(() => {
        setNuevaPresentacion(PRESENTACIONES[tipo][0][0]);
    }, [tipo]);

    /* === Helper único para mensajes (evita setTimeout repetidos) === */
    const mostrarMensaje = (texto, ms = 2500) => {
        setMensaje(texto);
        if (ms) setTimeout(() => setMensaje(""), ms);
    };

    /* === Escuchar Firebase === */
    useEffect(() => {
        if (tab !== "admin") return;

        const refItems = ref(db, `medydescartables/${tipo}`);
        const unsub = onValue(refItems, (snap) => {
            if (!snap.exists()) return setItems([]);

            const data = snap.val();
            const lista = Object.entries(data).map(([key, d]) => ({
                key,
                nombre: d.nombre || limpiarNombre(key),
                precio:
                    typeof d.precioReferencia === "number" ? d.precioReferencia :
                        typeof d.precio === "number" ? d.precio : 0,
                presentacion: d.presentacion || "unidad",
                tipo: d.tipo || tipoSingular(tipo),
                // Conservamos el stock para no resetearlo al editar
                stockActual: typeof d.stockActual === "number" ? d.stockActual : 0,
                stockMinimo: typeof d.stockMinimo === "number" ? d.stockMinimo : 10,
            }));

            setItems(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        });

        return () => unsub();
    }, [tab, tipo]);

    /* === Agregar === */
    const handleAgregar = async () => {
        const nombre = limpiarNombre(nuevoNombre);
        const key = limpiarKey(nombre);
        const price = parseFloat(nuevoPrecio);

        if (!nombre || !String(nuevoPrecio).trim()) {
            return mostrarMensaje("⚠️ Completá nombre y precio.");
        }
        if (!key) return mostrarMensaje("⚠️ El nombre no es válido.");
        if (isNaN(price) || price < 0) return mostrarMensaje("⚠️ El precio no es válido.");

        try {
            await set(ref(db, `medydescartables/${tipo}/${key}`), {
                nombre,
                tipo: tipoSingular(tipo),
                presentacion: nuevaPresentacion,
                stockActual: 0,
                stockMinimo: 10,
                precioReferencia: price,
                activo: true,
            });
            setNuevoNombre("");
            setNuevoPrecio("");
            setNuevaPresentacion(PRESENTACIONES[tipo][0][0]);
            mostrarMensaje("✅ Producto agregado correctamente.");
        } catch (error) {
            console.error("Error al agregar:", error);
            mostrarMensaje("❌ Error al agregar producto.");
        }
    };

    /* === Eliminar === */
    const handleEliminar = async (key) => {
        const nombre = items.find((i) => i.key === key)?.nombre || limpiarNombre(key);
        if (!confirm(`¿Eliminar "${nombre}"?`)) return;

        try {
            await remove(ref(db, `medydescartables/${tipo}/${key}`));
            mostrarMensaje("🗑️ Producto eliminado.");
        } catch (error) {
            console.error("Error al eliminar:", error);
            mostrarMensaje("❌ Error al eliminar producto.");
        }
    };

    /* === Editar (en memoria) === */
    const handleEditar = (key, campo, valor) => {
        setModificados((prev) => ({
            ...prev,
            [key]: {
                ...prev[key],
                [campo]:
                    campo === "precio"
                        ? (isNaN(parseFloat(valor)) ? 0 : parseFloat(valor))
                        : valor,
            },
        }));
    };

    /* === Guardar modificaciones (incluye renombrar con migración de key) === */
    const guardarModificaciones = async () => {
        const keys = Object.keys(modificados);
        if (keys.length === 0) return;

        const updates = {};
        const keysExistentes = new Set(items.map((i) => i.key));

        for (const key of keys) {
            const cambios = modificados[key];
            const original = items.find((i) => i.key === key);
            if (!original) continue;

            const nombreFinal = limpiarNombre(cambios.nombre ?? original.nombre);
            const nuevoKey = limpiarKey(nombreFinal);

            if (!nuevoKey) {
                return mostrarMensaje("⚠️ Hay un nombre vacío o inválido.", 3000);
            }
            // Colisión: el nuevo nombre ya existe en otro registro
            if (nuevoKey !== key && keysExistentes.has(nuevoKey)) {
                return mostrarMensaje(`⚠️ Ya existe un producto llamado "${nombreFinal}".`, 4000);
            }

            const itemActualizado = {
                nombre: nombreFinal,
                tipo: original.tipo,
                presentacion: cambios.presentacion ?? original.presentacion,
                stockActual: original.stockActual,
                stockMinimo: original.stockMinimo,
                precioReferencia:
                    cambios.precio !== undefined ? Number(cambios.precio) : Number(original.precio),
                activo: true,
            };

            if (nuevoKey !== key) {
                updates[`medydescartables/${tipo}/${key}`] = null; // elimina el registro anterior
                keysExistentes.delete(key);
                keysExistentes.add(nuevoKey);
            }
            updates[`medydescartables/${tipo}/${nuevoKey}`] = itemActualizado;
        }

        try {
            await update(ref(db), updates);
            setModificados({});
            mostrarMensaje("💾 Cambios guardados correctamente ✅", 3000);
        } catch (error) {
            console.error("Error al guardar modificaciones:", error);
            mostrarMensaje("❌ Error al guardar cambios.", 3000);
        }
    };

    const filtrados = useMemo(
        () => items.filter((item) => matchesAllTerms(item.nombre, busqueda)),
        [items, busqueda]
    );

    /* === Descargar plantilla === */
    const descargarPlantilla = () => {
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.aoa_to_sheet([["Nombre", "Precio", "Presentacion"]]);
        XLSX.utils.book_append_sheet(wb, ws, "Plantilla");
        XLSX.writeFile(wb, "plantilla_insumos.xlsx");
    };

    /* === Exportar a Excel === */
    const exportarExcel = (rows, filenameBase) => {
        const wb = XLSX.utils.book_new();
        const sheetData = [
            ["Tipo", "Nombre", "Presentacion", "Precio"],
            ...rows.map((r) => [
                r.tipo === "medicamento" ? "Medicación" : "Descartable",
                limpiarNombre(r.nombre),
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
            mostrarMensaje("📥 Generando Excel...", 0);
            const rows = [];

            const fetchCategoria = async (cat) => {
                const snap = await get(ref(db, `medydescartables/${cat}`));
                if (!snap.exists()) return;
                for (const [key, d] of Object.entries(snap.val() || {})) {
                    rows.push({
                        tipo: d.tipo || tipoSingular(cat),
                        nombre: d.nombre || limpiarNombre(key),
                        presentacion: d.presentacion || "unidad",
                        precio: d.precioReferencia || d.precio || 0,
                    });
                }
            };

            const planes = {
                medicamentos: { cats: ["medicamentos"], file: "lista_medicacion", msg: "✅ Excel de medicación descargado." },
                descartables: { cats: ["descartables"], file: "lista_descartables", msg: "✅ Excel de descartables descargado." },
                ambos: { cats: ["medicamentos", "descartables"], file: "lista_medicacion_y_descartables", msg: "✅ Excel completo descargado." },
            };

            const plan = planes[scope];
            if (!plan) return;

            for (const cat of plan.cats) await fetchCategoria(cat);
            rows.sort((a, b) => a.nombre.localeCompare(b.nombre));
            exportarExcel(rows, plan.file);
            mostrarMensaje(plan.msg, 3000);
        } catch (err) {
            console.error(err);
            mostrarMensaje("❌ Error al generar el Excel.", 3500);
        }
    };

    /* === Leer Excel === */
    const handleExcelUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setArchivo(file);

        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target.result, { type: "binary" });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

            const rows = data
                .slice(1)
                .filter((r) => r[0] && r[1])
                .map(([nombre, precio, presentacion]) => ({
                    nombre: limpiarNombre(nombre),
                    precio: parseFloat(precio) || 0,
                    presentacion: presentacion || PRESENTACIONES[tipo][0][0],
                }))
                .filter((r) => limpiarKey(r.nombre));

            const dups = duplicadosPorKey(rows);
            if (dups.length) {
                setArchivoPreview([]);
                return mostrarMensaje("⚠️ Productos duplicados en el Excel: " + dups.join(", "), 5000);
            }
            setArchivoPreview(rows);
        };
        reader.readAsBinaryString(file);
    };

    /* === Cargar a Firebase === */
    const confirmarCargaExcel = async () => {
        if (!archivoPreview.length) return mostrarMensaje("⚠️ No hay datos para cargar.");

        const dups = duplicadosPorKey(archivoPreview);
        if (dups.length) {
            return mostrarMensaje("⚠️ Hay duplicados en la previsualización: " + dups.join(", "), 5000);
        }

        try {
            const updates = {};
            archivoPreview.forEach((item) => {
                const key = limpiarKey(item.nombre);
                if (!key) return;
                updates[`medydescartables/${tipo}/${key}`] = {
                    nombre: limpiarNombre(item.nombre),
                    tipo: tipoSingular(tipo),
                    presentacion: item.presentacion || PRESENTACIONES[tipo][0][0],
                    stockActual: 0,
                    stockMinimo: 10,
                    precioReferencia: parseFloat(item.precio) || 0,
                    activo: true,
                };
            });

            await update(ref(db), updates);
            setArchivoPreview([]);
            setArchivo(null);
            mostrarMensaje("✅ Archivo Excel cargado correctamente.", 3000);
        } catch (error) {
            console.error("Error al cargar Excel:", error);
            mostrarMensaje("❌ Error al cargar archivo Excel.", 3000);
        }
    };

    /* === Editar fila de la previsualización === */
    const editarPreview = (i, campo, valor) => {
        setArchivoPreview((prev) => {
            const copy = [...prev];
            copy[i] = { ...copy[i], [campo]: valor };
            return copy;
        });
    };

    /* === Clases dinámicas === */
    const toastVariant = mensaje.includes("❌")
        ? styles.toastError
        : mensaje.includes("✅") || mensaje.includes("💾")
            ? styles.toastSuccess
            : styles.toastInfo;

    return (
        <div className={`${styles.wrapper} ${tema === "oscuro" ? styles.dark : ""}`}>
            <div className={styles.headerBar}>
                <h2 className={styles.title}>🧪 Insumos: Medicación y Descartables</h2>
                <button
                    className={styles.themeToggle}
                    onClick={() => setTema((t) => (t === "oscuro" ? "claro" : "oscuro"))}
                    aria-label="Cambiar tema"
                    title="Cambiar tema"
                >
                    {tema === "oscuro" ? "☀️ Claro" : "🌙 Oscuro"}
                </button>
            </div>

            {mensaje && <div className={`${styles.toast} ${toastVariant}`}>{mensaje}</div>}

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

            {/* Descargar lista */}
            <div className={styles.content} style={{ paddingTop: 0, marginBottom: "1.5rem" }}>
                <select
                    className={styles.selectTipo}
                    defaultValue=""
                    onChange={(e) => {
                        const value = e.target.value;
                        if (!value) return;
                        descargarLista(value);
                        e.target.value = "";
                    }}
                >
                    <option value="" disabled>📥 Descargar lista</option>
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
                                <OpcionesPresentacion tipo={tipo} />
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
                                        <td>
                                            <input
                                                type="text"
                                                className={styles.inputPrecio}
                                                defaultValue={limpiarNombre(item.nombre)}
                                                onChange={(e) =>
                                                    handleEditar(item.key, "nombre", e.target.value)
                                                }
                                            />
                                        </td>
                                        <td>
                                            <select
                                                className={styles.inputPrecio}
                                                defaultValue={item.presentacion}
                                                onChange={(e) =>
                                                    handleEditar(item.key, "presentacion", e.target.value)
                                                }
                                            >
                                                <OpcionesPresentacion tipo={tipo} />
                                            </select>
                                        </td>
                                        <td>
                                            <input
                                                type="number"
                                                step="0.01"
                                                defaultValue={item.precio}
                                                className={styles.inputPrecio}
                                                onChange={(e) =>
                                                    handleEditar(item.key, "precio", e.target.value)
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
                                                    onChange={(e) => editarPreview(i, "nombre", e.target.value)}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className={styles.input}
                                                    value={item.presentacion}
                                                    onChange={(e) => editarPreview(i, "presentacion", e.target.value)}
                                                >
                                                    <OpcionesPresentacion tipo={tipo} />
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    type="number"
                                                    step="0.01"
                                                    className={styles.input}
                                                    value={item.precio}
                                                    onChange={(e) => editarPreview(i, "precio", e.target.value)}
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <button className={styles.btnSaveChanges} onClick={confirmarCargaExcel}>
                                ✅ Confirmar carga a Firebase
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
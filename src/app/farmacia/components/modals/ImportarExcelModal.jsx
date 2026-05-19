"use client";
import { useState, useRef } from "react";
import s from "../../farmaciaDashboard.module.css";
import { Overlay, CloseBtn } from "./AgregarModal";
import { parsearArchivoImportacion, generarPlantillaExcel, formatCurrency } from "../../utils/farmacia";

export default function ImportarExcelModal({ onClose, onSubmit }) {
    const [paso, setPaso] = useState("upload"); // upload | preview | loading
    const [productos, setProductos] = useState([]);
    const [error, setError] = useState("");
    const inputRef = useRef();

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setError("");
        try {
            const parsed = await parsearArchivoImportacion(file);
            if (!parsed.length) { setError("El archivo está vacío o mal formateado"); return; }
            setProductos(parsed);
            setPaso("preview");
        } catch (err) {
            setError("Error al leer el archivo. Asegurate de usar el formato CSV correcto.");
        }
    };

    const handleSubmit = async () => {
        setPaso("loading");
        const ok = await onSubmit(productos);
        if (ok) onClose();
        else setPaso("preview");
    };

    const validos = productos.filter(p => p.valido);
    const invalidos = productos.filter(p => !p.valido);

    return (
        <Overlay onClose={onClose} wide>
            <div className={s.modalHeader}>
                <h3 className={s.modalTitle}>📂 Importar desde CSV/Excel</h3>
                <CloseBtn onClick={onClose} />
            </div>

            <div className={s.modalBody}>
                {paso === "upload" && (
                    <div className={s.uploadSection}>
                        {/* Paso 1: descargar plantilla */}
                        <div className={s.uploadStep}>
                            <div className={s.uploadStepNum}>1</div>
                            <div className={s.uploadStepBody}>
                                <p className={s.uploadStepTitle}>Descargá la plantilla</p>
                                <p className={s.uploadStepDesc}>
                                    Usá nuestro formato CSV para completar los productos.
                                </p>
                                <button
                                    className={`${s.actionBtn} ${s.btn_secondary}`}
                                    onClick={generarPlantillaExcel}
                                >
                                    📥 Descargar plantilla CSV
                                </button>
                            </div>
                        </div>

                        {/* Columnas esperadas */}
                        <div className={s.uploadColsInfo}>
                            <p className={s.uploadColsTitle}>Columnas del archivo:</p>
                            <div className={s.uploadColsGrid}>
                                {[
                                    { col: "nombre", desc: "Nombre del producto", req: true },
                                    { col: "tipo", desc: '"medicamento" o "descartable"', req: true },
                                    { col: "presentacion", desc: "ampolla, tabletas, unidad…", req: false },
                                    { col: "precio", desc: "Precio unitario (número)", req: true },
                                    { col: "stockInicial", desc: "Unidades a cargar", req: false },
                                    { col: "stockMinimo", desc: "Alerta de stock bajo", req: false },
                                ].map(c => (
                                    <div key={c.col} className={s.uploadColItem}>
                                        <code className={s.uploadColName}>{c.col}</code>
                                        <span className={s.uploadColDesc}>{c.desc}</span>
                                        {c.req && <span className={s.uploadColReq}>*</span>}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Paso 2: subir archivo */}
                        <div className={s.uploadStep}>
                            <div className={s.uploadStepNum}>2</div>
                            <div className={s.uploadStepBody}>
                                <p className={s.uploadStepTitle}>Subí el archivo completado</p>
                                <div
                                    className={s.dropZone}
                                    onClick={() => inputRef.current?.click()}
                                >
                                    <span className={s.dropZoneIcon}>📄</span>
                                    <p>Tocá para seleccionar archivo</p>
                                    <small>.csv o .txt separado por comas</small>
                                    <input
                                        ref={inputRef}
                                        type="file"
                                        accept=".csv,.txt"
                                        style={{ display: "none" }}
                                        onChange={handleFile}
                                    />
                                </div>
                                {error && <p className={s.uploadError}>{error}</p>}
                            </div>
                        </div>
                    </div>
                )}

                {paso === "preview" && (
                    <div className={s.previewSection}>
                        {/* Resumen */}
                        <div className={s.previewSummary}>
                            <div className={s.previewSummaryItem} style={{ color: "var(--c-green)" }}>
                                <span className={s.previewSummaryNum}>{validos.length}</span>
                                <span>válidos</span>
                            </div>
                            {invalidos.length > 0 && (
                                <div className={s.previewSummaryItem} style={{ color: "var(--c-red)" }}>
                                    <span className={s.previewSummaryNum}>{invalidos.length}</span>
                                    <span>inválidos (se omitirán)</span>
                                </div>
                            )}
                        </div>

                        {invalidos.length > 0 && (
                            <div className={s.previewWarning}>
                                ⚠️ Las filas inválidas no tienen nombre o precio. Se omitirán.
                            </div>
                        )}

                        {/* Tabla preview */}
                        <div className={s.previewTableWrap}>
                            <table className={s.previewTable}>
                                <thead>
                                    <tr>
                                        <th></th>
                                        <th>Nombre</th>
                                        <th>Tipo</th>
                                        <th>Presentación</th>
                                        <th>Precio</th>
                                        <th>Stock inicial</th>
                                        <th>Stock mín.</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {productos.map((p, i) => (
                                        <tr key={i} className={p.valido ? "" : s.previewRowInvalid}>
                                            <td>{p.valido ? "✅" : "❌"}</td>
                                            <td>{p.nombre || "—"}</td>
                                            <td>
                                                <span className={p.tipo === "medicamento" ? s.badgeMed : s.badgeDesc}>
                                                    {p.tipo}
                                                </span>
                                            </td>
                                            <td>{p.presentacion}</td>
                                            <td>{p.precio > 0 ? formatCurrency(p.precio) : <span style={{ color: "var(--c-red)" }}>falta</span>}</td>
                                            <td>{p.stockInicial}</td>
                                            <td>{p.stockMinimo}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <button
                            className={s.btnBack}
                            onClick={() => { setPaso("upload"); setProductos([]); }}
                        >
                            ← Subir otro archivo
                        </button>
                    </div>
                )}

                {paso === "loading" && (
                    <div className={s.emptyState}>
                        <span className={s.loadingSpinner}>⏳</span>
                        <p>Importando {validos.length} productos...</p>
                    </div>
                )}
            </div>

            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                {paso === "preview" && (
                    <button
                        className={`${s.actionBtn} ${s.btn_secondary}`}
                        onClick={handleSubmit}
                        disabled={validos.length === 0}
                    >
                        📥 Importar {validos.length} productos
                    </button>
                )}
            </div>
        </Overlay>
    );
}
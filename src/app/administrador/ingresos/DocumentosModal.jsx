"use client";

import { useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, update } from "firebase/database";
import styles from "./ingresos.module.css";
import CropPreviewModal from "./CropPreviewModal";
import CameraGuideModal from "./CameraGuideModal";
import {
    generarFrentePDFBlob,
    generarDorsoPDFBlob,
    openPDFBlob,
    uploadWithProgress,
} from "./documentosHelpers";
import {
    convertToWebP,
    buildFolderName,
    cx,
    onlyDigits,
    getPdfPages,
    PRESTADOR_CONST,
} from "./helpers";

const DB_NODE = "ingresos-pacientes";
const UPLOAD_TIMEOUT_MS = 30000;

export default function DocumentosModal({ paciente, onClose, onUpdated }) {
    if (!paciente) return null;

    const [docs, setDocs] = useState(() =>
        Array.isArray(paciente?.documentacion) ? paciente.documentacion : []
    );
    const [cropToDni, setCropToDni] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [replacingId, setReplacingId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [printing, setPrinting] = useState(null);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [cropPreview, setCropPreview] = useState(null);
    const [showCameraGuide, setShowCameraGuide] = useState(false);
    const [cameraTarget, setCameraTarget] = useState(null);
    const [imgErrors, setImgErrors] = useState({});

    const replaceInputRef = useRef(null);
    const addInputRef = useRef(null);
    const docToReplaceRef = useRef(null);

    const formLike = {
        trabajadorApellido: paciente?.trabajador?.apellido || "",
        trabajadorNombre: paciente?.trabajador?.nombre || "",
        OS: paciente?.OS || "",
        afiliadoPaciente: paciente?.afiliadoPaciente || "",
    };
    const pacienteNombre =
        `${formLike.trabajadorApellido} ${formLike.trabajadorNombre}`.trim() || "—";

    const persistDocs = async (newDocs) => {
        await update(ref(db, `${DB_NODE}/${paciente.id}`), {
            documentacion: newDocs,
            updatedAt: Date.now(),
        });
        setDocs(newDocs);
        onUpdated?.();
    };

    const flashMsg = (text) => {
        setMsg(text);
        setTimeout(() => setMsg(""), 4000);
    };

    const procesarConPreview = async (file) => {
        const webpBlob = await convertToWebP(file, 0.75, 1600);
        return await new Promise((resolve) => {
            setCropPreview({
                previewBlob: webpBlob,
                initialRatio: cropToDni ? 1.585 : 0,
                onConfirm: (croppedBlob) => {
                    setCropPreview(null);
                    resolve(croppedBlob);
                },
                onCancel: () => {
                    setCropPreview(null);
                    resolve(null);
                },
            });
        });
    };

    const handleDelete = async (doc) => {
        if (
            !confirm(
                `¿Eliminar "${doc.name}"?\n\nSe borra de Google Drive y de la ficha del paciente.`
            )
        )
            return;
        setDeletingId(doc.fileId);
        setError("");
        try {
            const res = await fetch("/api/documentos/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId: doc.fileId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Error ${res.status}`);

            await persistDocs(docs.filter((d) => d.fileId !== doc.fileId));
            flashMsg(
                data.alreadyGone
                    ? "🗑️ Registro eliminado (ya no existía en Drive)"
                    : "🗑️ Documento eliminado"
            );
        } catch (err) {
            console.error(err);
            setError("No se pudo eliminar: " + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    const handleReplaceClick = (doc) => {
        docToReplaceRef.current = doc;
        replaceInputRef.current?.click();
    };

    const handleReplaceFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;
        const oldDoc = docToReplaceRef.current;
        if (!oldDoc) return;

        setReplacingId(oldDoc.fileId);
        setError("");
        try {
            const finalBlob = await procesarConPreview(file);
            if (!finalBlob) return;

            const fd = new FormData();
            fd.append("file", finalBlob, "documento.webp");
            fd.append("folderName", buildFolderName(formLike));

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
            let newData;
            try {
                newData = await uploadWithProgress(
                    "/api/documentos/upload",
                    fd,
                    () => { },
                    controller.signal
                );
            } finally {
                clearTimeout(timeoutId);
            }

            try {
                await fetch("/api/documentos/delete", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ fileId: oldDoc.fileId }),
                });
            } catch (delErr) {
                console.warn("No se pudo borrar la vieja:", delErr);
            }

            const newDocs = docs.map((d) =>
                d.fileId === oldDoc.fileId
                    ? {
                        fileId: newData.fileId,
                        name: newData.name,
                        url: newData.url,
                        fecha: Date.now(),
                    }
                    : d
            );
            await persistDocs(newDocs);
            flashMsg("🔄 Documento reemplazado");
        } catch (err) {
            console.error(err);
            setError("No se pudo reemplazar: " + err.message);
        } finally {
            setReplacingId(null);
            docToReplaceRef.current = null;
        }
    };

    const handleAddFile = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;

        setAdding(true);
        setError("");
        try {
            const nuevos = [];
            const folderName = buildFolderName(formLike);

            for (const file of files) {
                const finalBlob = await procesarConPreview(file);
                if (!finalBlob) continue;

                const fd = new FormData();
                fd.append("file", finalBlob, "documento.webp");
                fd.append("folderName", folderName);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
                let data;
                try {
                    data = await uploadWithProgress(
                        "/api/documentos/upload",
                        fd,
                        () => { },
                        controller.signal
                    );
                } finally {
                    clearTimeout(timeoutId);
                }

                nuevos.push({
                    fileId: data.fileId,
                    name: data.name,
                    url: data.url,
                    fecha: Date.now(),
                });
            }

            if (!nuevos.length) return;

            await persistDocs([...docs, ...nuevos]);
            flashMsg(
                nuevos.length === 1
                    ? "✅ Documento agregado"
                    : `✅ ${nuevos.length} documentos agregados`
            );
        } catch (err) {
            console.error(err);
            setError("No se pudo agregar: " + err.message);
        } finally {
            setAdding(false);
        }
    };

    const openCameraForAdd = () => {
        setCameraTarget("add");
        setShowCameraGuide(true);
    };

    const confirmCamera = () => {
        setShowCameraGuide(false);
        setTimeout(() => {
            if (cameraTarget === "add") addInputRef.current?.click();
            else replaceInputRef.current?.click();
            setCameraTarget(null);
        }, 100);
    };

    const handlePrintDocumentacion = async () => {
        if (!docs.length) {
            alert("No hay documentos para imprimir.");
            return;
        }
        setPrinting("documentacion");
        setError("");
        try {
            const tipoIngreso = paciente?.tipoIngreso || "PISO";
            const payload = {
                ...paciente,
                prestador: paciente?.prestador || PRESTADOR_CONST,
            };
            const apellido = payload.trabajador?.apellido || "SIN_APELLIDO";
            const dni = onlyDigits(payload.trabajador?.dni) || "SIN_DNI";
            const os = (payload.OS || "OS").replace(/\s+/g, "_");
            const formFileName = `INT_${apellido}_${dni}_${os}.pdf`;

            const formRes = await fetch("/api/ingresos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload,
                    fileName: formFileName,
                    pages: getPdfPages(tipoIngreso),
                }),
            });
            if (!formRes.ok) {
                const detail = await formRes.text().catch(() => "");
                throw new Error(
                    `No se pudo generar el formulario (${formRes.status}). ${detail}`
                );
            }
            const formBytes = await formRes.arrayBuffer();

            const docBlob = await generarFrentePDFBlob({ docs, form: formLike });
            const docBytes = await docBlob.arrayBuffer();

            const { PDFDocument } = await import("pdf-lib");
            const formPdf = await PDFDocument.load(formBytes);
            const docPdf = await PDFDocument.load(docBytes);
            const mergedPdf = await PDFDocument.create();

            const formPages = await mergedPdf.copyPages(
                formPdf,
                formPdf.getPageIndices()
            );
            formPages.forEach((pg) => mergedPdf.addPage(pg));

            const docPages = await mergedPdf.copyPages(docPdf, docPdf.getPageIndices());
            docPages.forEach((pg) => mergedPdf.addPage(pg));

            const mergedBytes = await mergedPdf.save();
            const mergedBlob = new Blob([mergedBytes], { type: "application/pdf" });
            openPDFBlob(
                mergedBlob,
                `DOCUMENTACION_${pacienteNombre.replace(/\s+/g, "_")}.pdf`
            );
        } catch (err) {
            console.error(err);
            setError("No se pudo generar la documentación: " + err.message);
        } finally {
            setPrinting(null);
        }
    };

    const handlePrintDorso = async () => {
        setPrinting("dorso");
        setError("");
        try {
            const blob = await generarDorsoPDFBlob({ pacienteNombre });
            openPDFBlob(blob, `DORSO_${pacienteNombre.replace(/\s+/g, "_")}.pdf`);
        } catch (err) {
            console.error(err);
            setError("No se pudo generar el DORSO: " + err.message);
        } finally {
            setPrinting(null);
        }
    };

    const busy = deletingId !== null || replacingId !== null || adding;

    return (
        <>
            <div className={styles.modalOverlay} onClick={onClose}>
                <div
                    className={styles.modalContent}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ============ HEADER ============ */}
                    <header className={styles.docModalHeader}>
                        <div className={styles.docModalHeaderText}>
                            <h2 className={styles.docModalTitle}>📎 Documentación</h2>
                            <p className={styles.docModalSubtitle}>
                                <b>{pacienteNombre}</b>
                                {paciente?.OS ? ` · ${paciente.OS}` : ""}
                                {paciente?.tipoIngreso ? ` · ${paciente.tipoIngreso}` : ""}
                            </p>
                        </div>
                        <button
                            type="button"
                            className={styles.docModalCloseBtn}
                            onClick={onClose}
                            aria-label="Cerrar"
                        >
                            ✕
                        </button>
                    </header>

                    {/* ============ BODY ============ */}
                    <div className={styles.docModalBody}>
                        {error && (
                            <div className={styles.docAlertDanger}>
                                <span className={styles.docAlertIcon}>❌</span>
                                <span className={styles.docAlertText}>{error}</span>
                                <button
                                    type="button"
                                    className={styles.docAlertClose}
                                    onClick={() => setError("")}
                                    aria-label="Cerrar error"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {msg && (
                            <div className={styles.docAlertSuccess}>
                                <span className={styles.docAlertIcon}>✅</span>
                                <span className={styles.docAlertText}>{msg}</span>
                            </div>
                        )}

                        {/* Bloque de acciones (agregar) */}
                        <section className={styles.docAddCard}>
                            <div className={styles.docAddHeader}>
                                <h3 className={styles.docAddTitle}>Agregar documentación</h3>
                                <p className={styles.docAddSubtitle}>
                                    Se convierte a WebP y se sube a Drive
                                </p>
                            </div>

                            <div className={styles.docAddActions}>
                                <button
                                    type="button"
                                    className={styles.docAddBtn}
                                    onClick={openCameraForAdd}
                                    disabled={busy}
                                >
                                    <span className={styles.docAddBtnIcon}>📷</span>
                                    <span className={styles.docAddBtnLabel}>Tomar foto</span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.docAddBtn}
                                    onClick={() => addInputRef.current?.click()}
                                    disabled={busy}
                                >
                                    <span className={styles.docAddBtnIcon}>🖼️</span>
                                    <span className={styles.docAddBtnLabel}>
                                        {adding ? "Subiendo…" : "Galería"}
                                    </span>
                                </button>
                            </div>

                            <label className={styles.docSwitchRow}>
                                <input
                                    type="checkbox"
                                    checked={cropToDni}
                                    onChange={(e) => setCropToDni(e.target.checked)}
                                    className={styles.docSwitchInput}
                                />
                                <span className={styles.docSwitchTrack}>
                                    <span className={styles.docSwitchThumb} />
                                </span>
                                <span className={styles.docSwitchLabel}>
                                    ✂️ Editor con formato DNI
                                </span>
                            </label>
                        </section>

                        {/* Lista de documentos */}
                        <section className={styles.docListSection}>
                            <div className={styles.docListHeader}>
                                <h3 className={styles.docListTitle}>
                                    Documentos cargados
                                </h3>
                                <span className={styles.docListCount}>
                                    {docs.length}
                                </span>
                            </div>

                            {docs.length === 0 ? (
                                <div className={styles.docEmpty}>
                                    <div className={styles.docEmptyIcon}>📄</div>
                                    <div className={styles.docEmptyTitle}>
                                        Sin documentación
                                    </div>
                                    <div className={styles.docEmptyHint}>
                                        Usá los botones de arriba para agregar fotos del
                                        DNI, carnet o estudios.
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.docList}>
                                    {docs.map((d, idx) => {
                                        const broken = imgErrors[d.fileId];
                                        const isDeleting = deletingId === d.fileId;
                                        const isReplacing = replacingId === d.fileId;

                                        return (
                                            <article key={d.fileId} className={styles.docCard}>
                                                <button
                                                    type="button"
                                                    className={styles.docCardImageWrap}
                                                    onClick={() => {
                                                        if (!broken)
                                                            window.open(
                                                                d.url,
                                                                "_blank",
                                                                "noopener,noreferrer"
                                                            );
                                                    }}
                                                    aria-label={`Ver ${d.name}`}
                                                >
                                                    {broken ? (
                                                        <div className={styles.docCardImageFallback}>
                                                            <span>📄</span>
                                                            <span>Sin vista previa</span>
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={`/api/documentos/proxy?id=${d.fileId}`}
                                                            alt={d.name}
                                                            className={styles.docCardImage}
                                                            onError={() =>
                                                                setImgErrors((prev) => ({
                                                                    ...prev,
                                                                    [d.fileId]: true,
                                                                }))
                                                            }
                                                        />
                                                    )}
                                                    <span className={styles.docCardBadge}>
                                                        #{idx + 1}
                                                    </span>
                                                </button>

                                                <div className={styles.docCardInfo}>
                                                    <div className={styles.docCardName} title={d.name}>
                                                        {d.name}
                                                    </div>
                                                </div>

                                                <div className={styles.docCardActions}>
                                                    <button
                                                        type="button"
                                                        className={styles.docActionSecondary}
                                                        onClick={() =>
                                                            window.open(
                                                                d.url,
                                                                "_blank",
                                                                "noopener,noreferrer"
                                                            )
                                                        }
                                                        disabled={busy || broken}
                                                    >
                                                        👁️ <span>Ver</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.docActionSecondary}
                                                        onClick={() => handleReplaceClick(d)}
                                                        disabled={busy}
                                                        aria-label="Reemplazar"
                                                    >
                                                        {isReplacing ? "⏳" : "🔄"}{" "}
                                                        <span>Cambiar</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={styles.docActionDanger}
                                                        onClick={() => handleDelete(d)}
                                                        disabled={busy}
                                                        aria-label="Eliminar"
                                                    >
                                                        {isDeleting ? "⏳" : "🗑️"}
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Inputs ocultos */}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={replaceInputRef}
                            onChange={handleReplaceFile}
                            style={{ display: "none" }}
                        />
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            ref={addInputRef}
                            onChange={handleAddFile}
                            style={{ display: "none" }}
                        />
                    </div>

                    {/* ============ FOOTER STICKY ============ */}
                    <footer className={styles.docModalFooter}>
                        <button
                            type="button"
                            className={styles.docFooterPrimary}
                            onClick={handlePrintDocumentacion}
                            disabled={printing !== null || !docs.length}
                        >
                            {printing === "documentacion"
                                ? "⏳ Generando…"
                                : "🖨️ Imprimir documentación"}
                        </button>
                        <button
                            type="button"
                            className={styles.docFooterSecondary}
                            onClick={handlePrintDorso}
                            disabled={printing !== null}
                        >
                            {printing === "dorso" ? "⏳ Generando…" : "🖨️ Imprimir dorso"}
                        </button>
                    </footer>
                </div>
            </div>

            {cropPreview && (
                <CropPreviewModal
                    previewBlob={cropPreview.previewBlob}
                    initialRatio={cropPreview.initialRatio}
                    onConfirm={cropPreview.onConfirm}
                    onCancel={cropPreview.onCancel}
                />
            )}

            {showCameraGuide && (
                <CameraGuideModal
                    onContinue={confirmCamera}
                    onCancel={() => {
                        setShowCameraGuide(false);
                        setCameraTarget(null);
                    }}
                />
            )}
        </>
    );
}
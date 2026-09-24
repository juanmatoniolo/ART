"use client";

import { useEffect, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, update } from "firebase/database";
import styles from "./DocumentosModal.module.css";
import CropPreviewModal from "./CropPreviewModal";
import {
    generarFrentePDFBlob,
    generarDorsoPDFBlob,
    openPDFBlob,
    uploadWithProgress,
} from "./documentosHelpers";
import {
    convertToWebP,
    buildFolderName,
    onlyDigits,
    getPdfPages,
    PRESTADOR_CONST,
} from "./helpers";

const DB_NODE = "ingresos-pacientes";
const UPLOAD_TIMEOUT_IMG_MS = 45000;
const UPLOAD_TIMEOUT_PDF_MS = 180000;
const PDF_MAX_MB = 5;

/* Nombre del archivo: APELLIDO_NOMBRE_DNI_OS_AFILIADO.webp */
function buildDocFileName(form, ext = "webp") {
    const clean = (s) =>
        String(s || "")
            .trim()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, "_")
            .replace(/[^A-Za-z0-9_-]/g, "")
            .toUpperCase();
    const parts = [
        clean(form?.trabajadorApellido),
        clean(form?.trabajadorNombre),
        clean(form?.trabajadorDni),
        clean(form?.OS),
        clean(form?.afiliadoPaciente),
    ].filter(Boolean);
    const base = parts.join("_") || "DOCUMENTO";
    return `${base}.${ext}`;
}

function sanitizePdfName(originalName) {
    const base = String(originalName || "documento")
        .replace(/\.pdf$/i, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9._-]/g, "")
        .toUpperCase();
    return `${base || "DOCUMENTO"}.pdf`;
}

function isPdfName(name) {
    return /\.pdf$/i.test(name || "");
}

function buildProxyUrl(fileId) {
    return `/api/documentos/proxy?id=${encodeURIComponent(fileId)}`;
}

function buildProxyEmbedUrl(fileId) {
    return `${buildProxyUrl(fileId)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}

export default function DocumentosModal({ paciente, onClose, onUpdated }) {
    const [docs, setDocs] = useState(() =>
        Array.isArray(paciente?.documentacion) ? paciente.documentacion : [],
    );
    const [cropToDni, setCropToDni] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [replacingId, setReplacingId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [pdfAdding, setPdfAdding] = useState(false);
    const [printing, setPrinting] = useState(null);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");
    const [cropPreview, setCropPreview] = useState(null);
    const [imgErrors, setImgErrors] = useState({});

    const replaceInputRef = useRef(null);
    const addInputRef = useRef(null);
    const cameraInputRef = useRef(null);
    const pdfInputRef = useRef(null);
    const docToReplaceRef = useRef(null);

    useEffect(() => {
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, []);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && !adding && !cropPreview && !pdfAdding) {
                onClose();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, adding, cropPreview, pdfAdding]);

    if (!paciente) return null;

    const formLike = {
        trabajadorApellido: paciente?.trabajador?.apellido || "",
        trabajadorNombre: paciente?.trabajador?.nombre || "",
        trabajadorDni: paciente?.trabajador?.dni || "",
        OS: paciente?.OS || "",
        afiliadoPaciente: paciente?.afiliadoPaciente || "",
    };
    const pacienteNombre =
        `${formLike.trabajadorApellido} ${formLike.trabajadorNombre}`.trim() ||
        "—";

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
                `¿Eliminar "${doc.name}"?\n\nSe borra de Google Drive y de la ficha del paciente.`,
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
                    : "🗑️ Documento eliminado",
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
            fd.append("file", finalBlob, buildDocFileName(formLike));
            fd.append("folderName", buildFolderName(formLike));

            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                UPLOAD_TIMEOUT_IMG_MS,
            );
            let newData;
            try {
                newData = await uploadWithProgress(
                    "/api/documentos/upload",
                    fd,
                    () => {},
                    controller.signal,
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
                    : d,
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
            const fileName = buildDocFileName(formLike);

            for (const file of files) {
                const finalBlob = await procesarConPreview(file);
                if (!finalBlob) continue;

                const fd = new FormData();
                fd.append("file", finalBlob, fileName);
                fd.append("folderName", folderName);

                const controller = new AbortController();
                const timeoutId = setTimeout(
                    () => controller.abort(),
                    UPLOAD_TIMEOUT_IMG_MS,
                );
                let data;
                try {
                    data = await uploadWithProgress(
                        "/api/documentos/upload",
                        fd,
                        () => {},
                        controller.signal,
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
                    : `✅ ${nuevos.length} documentos agregados`,
            );
        } catch (err) {
            console.error(err);
            setError("No se pudo agregar: " + err.message);
        } finally {
            setAdding(false);
        }
    };

    /* 🆕 Subir PDF */
    const handlePdfSelected = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (file.type !== "application/pdf" && !isPdfName(file.name)) {
            alert("Solo se permiten archivos PDF.");
            return;
        }

        const maxBytes = PDF_MAX_MB * 1024 * 1024;
        if (file.size > maxBytes) {
            const mb = (file.size / 1024 / 1024).toFixed(2);
            alert(
                `El PDF no puede pesar más de ${PDF_MAX_MB} MB. ` +
                    `Este archivo pesa ${mb} MB.`,
            );
            return;
        }

        setPdfAdding(true);
        setError("");
        try {
            const fd = new FormData();
            const finalName = sanitizePdfName(file.name);
            fd.append("file", file, finalName);
            fd.append("folderName", buildFolderName(formLike));

            const controller = new AbortController();
            const timeoutId = setTimeout(
                () => controller.abort(),
                UPLOAD_TIMEOUT_PDF_MS,
            );
            let data;
            try {
                data = await uploadWithProgress(
                    "/api/documentos/upload",
                    fd,
                    () => {},
                    controller.signal,
                );
            } finally {
                clearTimeout(timeoutId);
            }

            await persistDocs([
                ...docs,
                {
                    fileId: data.fileId,
                    name: data.name,
                    url: data.url,
                    fecha: Date.now(),
                },
            ]);
            flashMsg(`✅ PDF "${file.name}" subido`);
        } catch (err) {
            console.error(err);
            const esTimeout = /tardó más|tiempo de espera/i.test(err.message);
            setError(
                esTimeout
                    ? `${err.message} Tip: comprimí el PDF antes de subirlo.`
                    : "No se pudo subir el PDF: " + err.message,
            );
        } finally {
            setPdfAdding(false);
        }
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
                    `No se pudo generar el formulario (${formRes.status}). ${detail}`,
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
                formPdf.getPageIndices(),
            );
            formPages.forEach((pg) => mergedPdf.addPage(pg));

            const docPages = await mergedPdf.copyPages(
                docPdf,
                docPdf.getPageIndices(),
            );
            docPages.forEach((pg) => mergedPdf.addPage(pg));

            const mergedBytes = await mergedPdf.save();
            const mergedBlob = new Blob([mergedBytes], {
                type: "application/pdf",
            });
            openPDFBlob(
                mergedBlob,
                `DOCUMENTACION_${pacienteNombre.replace(/\s+/g, "_")}.pdf`,
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
            openPDFBlob(
                blob,
                `DORSO_${pacienteNombre.replace(/\s+/g, "_")}.pdf`,
            );
        } catch (err) {
            console.error(err);
            setError("No se pudo generar el DORSO: " + err.message);
        } finally {
            setPrinting(null);
        }
    };

    const busy =
        deletingId !== null ||
        replacingId !== null ||
        adding ||
        pdfAdding;

    return (
        <>
            <div
                className={styles.modalOverlay}
                role="presentation"
                onClick={onClose}
            >
                <div
                    className={styles.modalContent}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="docs-modal-title"
                    onClick={(e) => e.stopPropagation()}
                >
                    <header className={styles.docModalHeader}>
                        <div className={styles.docModalHeaderText}>
                            <h2
                                id="docs-modal-title"
                                className={styles.docModalTitle}
                            >
                                📎 Documentación
                            </h2>
                            <p className={styles.docModalSubtitle}>
                                <b>{pacienteNombre}</b>
                                {paciente?.OS ? ` · ${paciente.OS}` : ""}
                                {paciente?.tipoIngreso
                                    ? ` · ${paciente.tipoIngreso}`
                                    : ""}
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

                    <div className={styles.docModalBody}>
                        {error && (
                            <div className={styles.docAlertDanger}>
                                <span className={styles.docAlertIcon}>❌</span>
                                <span className={styles.docAlertText}>
                                    {error}
                                </span>
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
                                <span className={styles.docAlertText}>
                                    {msg}
                                </span>
                            </div>
                        )}

                        <section className={styles.docAddCard}>
                            <div className={styles.docAddHeader}>
                                <h3 className={styles.docAddTitle}>
                                    Agregar documentación
                                </h3>
                                <p className={styles.docAddSubtitle}>
                                    Fotos o PDFs — se suben a Drive
                                </p>
                            </div>

                            <div className={styles.docAddActions}>
                                <button
                                    type="button"
                                    className={styles.docAddBtn}
                                    onClick={() =>
                                        cameraInputRef.current?.click()
                                    }
                                    disabled={busy}
                                >
                                    <span className={styles.docAddBtnIcon}>
                                        📷
                                    </span>
                                    <span className={styles.docAddBtnLabel}>
                                        Tomar foto
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.docAddBtn}
                                    onClick={() => addInputRef.current?.click()}
                                    disabled={busy}
                                >
                                    <span className={styles.docAddBtnIcon}>
                                        🖼️
                                    </span>
                                    <span className={styles.docAddBtnLabel}>
                                        {adding ? "Subiendo…" : "Galería"}
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    className={styles.docAddBtn}
                                    onClick={() => pdfInputRef.current?.click()}
                                    disabled={busy}
                                    title={`Subir PDF (máx ${PDF_MAX_MB} MB)`}
                                >
                                    <span className={styles.docAddBtnIcon}>
                                        📄
                                    </span>
                                    <span className={styles.docAddBtnLabel}>
                                        {pdfAdding ? "Subiendo…" : "Subir PDF"}
                                    </span>
                                </button>
                            </div>

                            <label className={styles.docSwitchRow}>
                                <input
                                    type="checkbox"
                                    checked={cropToDni}
                                    onChange={(e) =>
                                        setCropToDni(e.target.checked)
                                    }
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
                                    <div className={styles.docEmptyIcon}>
                                        📄
                                    </div>
                                    <div className={styles.docEmptyTitle}>
                                        Sin documentación
                                    </div>
                                    <div className={styles.docEmptyHint}>
                                        Usá los botones de arriba para agregar
                                        fotos, PDFs o estudios.
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.docList}>
                                    {docs.map((d, idx) => {
                                        const isPdf = isPdfName(d.name);
                                        const broken =
                                            imgErrors[d.fileId] && !isPdf;
                                        const isDeleting =
                                            deletingId === d.fileId;
                                        const isReplacing =
                                            replacingId === d.fileId;

                                        return (
                                            <article
                                                key={d.fileId}
                                                className={styles.docCard}
                                            >
                                                <button
                                                    type="button"
                                                    className={
                                                        styles.docCardImageWrap
                                                    }
                                                    onClick={() =>
                                                        window.open(
                                                            buildProxyUrl(
                                                                d.fileId,
                                                            ),
                                                            "_blank",
                                                            "noopener,noreferrer",
                                                        )
                                                    }
                                                    aria-label={`Ver ${d.name}`}
                                                    title="Abrir en pestaña nueva"
                                                >
                                                    {isPdf ? (
                                                        <iframe
                                                            src={buildProxyEmbedUrl(
                                                                d.fileId,
                                                            )}
                                                            title={d.name}
                                                            loading="lazy"
                                                            className={
                                                                styles.docCardImage
                                                            }
                                                            style={{
                                                                width: "100%",
                                                                height: "100%",
                                                                border: 0,
                                                                background:
                                                                    "#fff",
                                                                pointerEvents:
                                                                    "none",
                                                            }}
                                                        />
                                                    ) : broken ? (
                                                        <div
                                                            className={
                                                                styles.docCardImageFallback
                                                            }
                                                        >
                                                            <span>📄</span>
                                                            <span>
                                                                Sin vista previa
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        <img
                                                            src={buildProxyUrl(
                                                                d.fileId,
                                                            )}
                                                            alt={d.name}
                                                            loading="lazy"
                                                            decoding="async"
                                                            className={
                                                                styles.docCardImage
                                                            }
                                                            onError={() =>
                                                                setImgErrors(
                                                                    (prev) => ({
                                                                        ...prev,
                                                                        [d.fileId]:
                                                                            true,
                                                                    }),
                                                                )
                                                            }
                                                        />
                                                    )}
                                                    <span
                                                        className={
                                                            styles.docCardBadge
                                                        }
                                                    >
                                                        #{idx + 1}
                                                    </span>
                                                    {isPdf && (
                                                        <span
                                                            className={
                                                                styles.docCardBadge
                                                            }
                                                            style={{
                                                                left: "auto",
                                                                right: 8,
                                                                background:
                                                                    "rgba(239,68,68,0.85)",
                                                                color: "#fff",
                                                            }}
                                                        >
                                                            PDF
                                                        </span>
                                                    )}
                                                </button>

                                                <div
                                                    className={
                                                        styles.docCardInfo
                                                    }
                                                >
                                                    <div
                                                        className={
                                                            styles.docCardName
                                                        }
                                                        title={d.name}
                                                    >
                                                        {d.name}
                                                    </div>
                                                </div>

                                                {/* 🆕 Botones compactos con flex-wrap */}
                                                <div
                                                    className={
                                                        styles.docCardActions
                                                    }
                                                    style={{
                                                        flexWrap: "wrap",
                                                        gap: 6,
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        className={
                                                            styles.docActionSecondary
                                                        }
                                                        onClick={() =>
                                                            window.open(
                                                                buildProxyUrl(
                                                                    d.fileId,
                                                                ),
                                                                "_blank",
                                                                "noopener,noreferrer",
                                                            )
                                                        }
                                                        disabled={
                                                            broken && !isPdf
                                                        }
                                                        aria-label="Ver documento"
                                                        title="Ver"
                                                        style={{
                                                            padding: "5px 10px",
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        👁️
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={
                                                            styles.docActionSecondary
                                                        }
                                                        onClick={() =>
                                                            handleReplaceClick(d)
                                                        }
                                                        disabled={busy}
                                                        aria-label="Reemplazar documento"
                                                        title="Reemplazar"
                                                        style={{
                                                            padding: "5px 10px",
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {isReplacing
                                                            ? "⏳"
                                                            : "🔄"}{" "}
                                                        
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className={
                                                            styles.docActionDanger
                                                        }
                                                        onClick={() =>
                                                            handleDelete(d)
                                                        }
                                                        disabled={busy}
                                                        aria-label="Eliminar documento"
                                                        title="Eliminar"
                                                        style={{
                                                            padding: "5px 10px",
                                                            fontSize: 12,
                                                        }}
                                                    >
                                                        {isDeleting
                                                            ? "⏳"
                                                            : "🗑️"}
                                                    </button>
                                                </div>
                                            </article>
                                        );
                                    })}
                                </div>
                            )}
                        </section>

                        {/* Reemplazar: abre galería (single) */}
                        <input
                            type="file"
                            accept="image/*"
                            ref={replaceInputRef}
                            onChange={handleReplaceFile}
                            style={{ display: "none" }}
                        />

                        {/* Agregar desde galería: múltiple */}
                        <input
                            type="file"
                            accept="image/*"
                            multiple
                            ref={addInputRef}
                            onChange={handleAddFile}
                            style={{ display: "none" }}
                        />

                        {/* Tomar foto: cámara trasera directa */}
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={cameraInputRef}
                            onChange={handleAddFile}
                            style={{ display: "none" }}
                        />

                        {/* 🆕 Subir PDF */}
                        <input
                            type="file"
                            accept="application/pdf,.pdf"
                            ref={pdfInputRef}
                            onChange={handlePdfSelected}
                            style={{ display: "none" }}
                        />
                    </div>

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
                            {printing === "dorso"
                                ? "⏳ Generando…"
                                : "🖨️ Imprimir dorso"}
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
        </>
    );
}
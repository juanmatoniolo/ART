"use client";

import { useRef, useState } from "react";
import stylesBase from "./ingresos.module.css";
import stylesOwn from "./DocumentacionSection.module.css";
import CropPreviewModal from "./CropPreviewModal";
import {
    cx,
    Section,
    buildFolderName,
    convertToWebP,
} from "./helpers";

const styles = { ...stylesBase, ...stylesOwn };

/* Timeouts diferenciados:
   - Imágenes WebP: livianas, 45s sobra
   - PDFs: hasta 5 MB, pueden tardar; 3 min de margen */
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

/* Sanitiza el nombre original del PDF */
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

/* URL del proxy para mostrar inline (mismo origin, sin CORS) */
function buildProxyUrl(fileId) {
    return `/api/documentos/proxy?id=${encodeURIComponent(fileId)}`;
}

/* URL del proxy con parámetros para iframe (sin toolbar ni panel) */
function buildProxyEmbedUrl(fileId) {
    return `${buildProxyUrl(fileId)}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
}

function uploadWithProgress(url, formData, onProgress, signal) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    resolve(JSON.parse(xhr.responseText));
                } catch {
                    reject(new Error("Respuesta inválida del servidor"));
                }
            } else {
                let msg = `Error ${xhr.status}`;
                try {
                    const j = JSON.parse(xhr.responseText);
                    if (j.error) msg = j.error;
                } catch { }
                reject(new Error(msg));
            }
        };
        xhr.onerror = () => reject(new Error("Error de red. Revisá tu conexión."));
        xhr.ontimeout = () => reject(new Error("Tiempo de espera agotado"));
        xhr.onabort = () =>
            reject(
                new Error(
                    "La subida tardó más de lo esperado. Verificá tu conexión e intentá de nuevo.",
                ),
            );
        if (signal) signal.addEventListener("abort", () => xhr.abort());
        xhr.send(formData);
    });
}

export default function DocumentacionSection({ docs, setDocs, form }) {
    const [deletingDocId, setDeletingDocId] = useState(null);
    const [cropToDni, setCropToDni] = useState(true);
    const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");
    const [imgErrors, setImgErrors] = useState({});
    const [cropPreview, setCropPreview] = useState(null);
    const [pdfUploading, setPdfUploading] = useState(false);

    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);
    const pdfInputRef = useRef(null);

    const [uploadState, setUploadState] = useState({
        active: false,
        currentFile: 0,
        totalFiles: 0,
        percent: 0,
        stage: "",
        error: "",
    });

    const resetUploadState = () =>
        setUploadState({
            active: false,
            currentFile: 0,
            totalFiles: 0,
            percent: 0,
            stage: "",
            error: "",
        });

    const validarPaciente = () => {
        if (!form.trabajadorApellido.trim() || !form.trabajadorNombre.trim()) {
            alert("Completá apellido y nombre antes de subir documentación.");
            return false;
        }
        return true;
    };

    const openCamera = () => {
        if (!validarPaciente()) return;
        cameraInputRef.current?.click();
    };

    const openGallery = () => {
        if (!validarPaciente()) return;
        galleryInputRef.current?.click();
    };

    const openPdfPicker = () => {
        if (!validarPaciente()) return;
        pdfInputRef.current?.click();
    };

    /* =========================================================
       IMÁGENES: WebP + crop + subida
       ========================================================= */
    const handleFileSelected = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;

        setUploadSuccessMsg("");
        const nuevos = [];

        for (let i = 0; i < files.length; i++) {
            const file = files[i];

            setUploadState({
                active: true,
                currentFile: i + 1,
                totalFiles: files.length,
                percent: 0,
                stage: "convirtiendo",
                error: "",
            });

            let webpBlob;
            try {
                webpBlob = await convertToWebP(file, 0.75, 1600);
            } catch (err) {
                setUploadState((s) => ({
                    ...s,
                    active: false,
                    stage: "",
                    percent: 0,
                    error: "No se pudo procesar la imagen: " + err.message,
                }));
                return;
            }

            const finalBlob = await new Promise((resolve) => {
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

            if (!finalBlob) {
                resetUploadState();
                return;
            }

            setUploadState((s) => ({ ...s, stage: "subiendo", percent: 0 }));

            try {
                const fd = new FormData();
                fd.append("file", finalBlob, buildDocFileName(form));
                fd.append("folderName", buildFolderName(form));

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
                        (pct) => setUploadState((s) => ({ ...s, percent: pct })),
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
            } catch (err) {
                if (nuevos.length) setDocs((prev) => [...prev, ...nuevos]);
                setUploadState((s) => ({
                    ...s,
                    active: false,
                    percent: 0,
                    stage: "",
                    error:
                        files.length > 1
                            ? `Se subieron ${nuevos.length} de ${files.length}. ${err.message}`
                            : `${err.message} Volvé a intentar.`,
                }));
                return;
            }
        }

        setDocs((prev) => [...prev, ...nuevos]);
        resetUploadState();

        const total = nuevos.length;
        setUploadSuccessMsg(
            total === 1
                ? `✅ "${nuevos[0].name}" subido correctamente`
                : `✅ ${total} documentos subidos correctamente`,
        );
        setTimeout(() => setUploadSuccessMsg(""), 5000);
    };

    /* =========================================================
       PDF: subida directa (máx 5 MB)
       ========================================================= */
    const handlePdfSelected = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file) return;

        if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
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

        setUploadSuccessMsg("");
        setPdfUploading(true);
        setUploadState({
            active: true,
            currentFile: 1,
            totalFiles: 1,
            percent: 0,
            stage: "subiendo",
            error: "",
        });

        try {
            const fd = new FormData();
            const finalName = sanitizePdfName(file.name);
            fd.append("file", file, finalName);
            fd.append("folderName", buildFolderName(form));

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
                    (pct) => setUploadState((s) => ({ ...s, percent: pct })),
                    controller.signal,
                );
            } finally {
                clearTimeout(timeoutId);
            }

            setDocs((prev) => [
                ...prev,
                {
                    fileId: data.fileId,
                    name: data.name,
                    url: data.url,
                    fecha: Date.now(),
                },
            ]);
            resetUploadState();
            setUploadSuccessMsg(`✅ PDF "${file.name}" subido correctamente`);
            setTimeout(() => setUploadSuccessMsg(""), 5000);
        } catch (err) {
            const esTimeout = /tardó más|tiempo de espera/i.test(err.message);
            setUploadState((s) => ({
                ...s,
                active: false,
                percent: 0,
                stage: "",
                error: esTimeout
                    ? `${err.message} Tip: si el PDF pesa cerca de ${PDF_MAX_MB} MB, comprimilo antes de subirlo.`
                    : `${err.message} Volvé a intentar.`,
            }));
        } finally {
            setPdfUploading(false);
        }
    };

    const handleDeleteDoc = async (doc) => {
        const ok = window.confirm(
            `¿Eliminar "${doc.name}"?\n\nSe borra de Google Drive y de la ficha del paciente.`,
        );
        if (!ok) return;
        setDeletingDocId(doc.fileId);
        try {
            const res = await fetch("/api/documentos/delete", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fileId: doc.fileId }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
            setDocs((prev) => prev.filter((d) => d.fileId !== doc.fileId));
        } catch (err) {
            console.error(err);
            alert("No se pudo eliminar el documento: " + err.message);
        } finally {
            setDeletingDocId(null);
        }
    };

    const stageLabel = () => {
        if (uploadState.stage === "convirtiendo") return "Procesando imagen…";
        if (uploadState.stage === "subiendo") return "Subiendo a Drive…";
        return "Procesando…";
    };

    const disabled =
        uploadState.active ||
        pdfUploading ||
        !form.trabajadorApellido ||
        !form.trabajadorNombre;

    return (
        <>
            <Section
                title="6) Documentación"
                subtitle="Fotos (WebP, recortadas) o PDFs. Se suben a Google Drive."
            >
                <div className={styles.docAddCard}>
                    <div className={styles.docAddActions}>
                        <button
                            type="button"
                            className={styles.docAddBtn}
                            onClick={openCamera}
                            disabled={disabled}
                        >
                            <span className={styles.docAddBtnIcon}>📷</span>
                            <span className={styles.docAddBtnLabel}>Tomar foto</span>
                        </button>
                        <button
                            type="button"
                            className={styles.docAddBtn}
                            onClick={openGallery}
                            disabled={disabled}
                        >
                            <span className={styles.docAddBtnIcon}>🖼️</span>
                            <span className={styles.docAddBtnLabel}>Galería</span>
                        </button>
                        <button
                            type="button"
                            className={styles.docAddBtn}
                            onClick={openPdfPicker}
                            disabled={disabled}
                            title={`Subir PDF (máx ${PDF_MAX_MB} MB)`}
                        >
                            <span className={styles.docAddBtnIcon}>📄</span>
                            <span className={styles.docAddBtnLabel}>
                                {pdfUploading ? "Subiendo…" : "Subir PDF"}
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

                    <div className={styles.docFolderHint}>
                        📁 Carpeta: <b>{buildFolderName(form) || "—"}</b>
                    </div>
                </div>

                <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileSelected}
                    style={{ display: "none" }}
                />
                <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelected}
                    style={{ display: "none" }}
                />
                <input
                    ref={pdfInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={handlePdfSelected}
                    style={{ display: "none" }}
                />

                {uploadState.active && (
                    <div className={styles.uploadBanner}>
                        <div className={styles.spinner} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div className={styles.uploadLabel}>
                                {stageLabel()}
                                {uploadState.totalFiles > 1 && (
                                    <span className={styles.uploadCounter}>
                                        {" "}
                                        ({uploadState.currentFile}/{uploadState.totalFiles})
                                    </span>
                                )}
                                {uploadState.stage === "subiendo" && uploadState.percent > 0 && (
                                    <span className={styles.uploadPercent}>
                                        {" "}
                                        — {Math.round(uploadState.percent)}%
                                    </span>
                                )}
                            </div>
                            <div className={styles.progressBar}>
                                <div
                                    className={styles.progressFill}
                                    style={{
                                        width:
                                            uploadState.stage === "subiendo"
                                                ? `${uploadState.percent}%`
                                                : "15%",
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {uploadState.error && !uploadState.active && (
                    <div className={styles.uploadError}>
                        <div style={{ flex: 1 }}>❌ {uploadState.error}</div>
                        <button
                            type="button"
                            className={styles.errorCloseBtn}
                            onClick={() => setUploadState((s) => ({ ...s, error: "" }))}
                        >
                            ✕
                        </button>
                    </div>
                )}

                {uploadSuccessMsg && (
                    <div className={styles.docAlertSuccess} style={{ marginTop: 12 }}>
                        <span className={styles.docAlertIcon}>✅</span>
                        <span className={styles.docAlertText}>{uploadSuccessMsg}</span>
                    </div>
                )}

                {docs.length > 0 && (
                    <div className={styles.docListSection}>
                        <div className={styles.docListHeader}>
                            <h3 className={styles.docListTitle}>
                                Documentos en este ingreso
                            </h3>
                            <span className={styles.docListCount}>{docs.length}</span>
                        </div>

                        <div className={styles.docList}>
                            {docs.map((d, idx) => {
                                const isPdf = /\.pdf$/i.test(d.name || "");
                                const broken = imgErrors[d.fileId] && !isPdf;
                                const isDeleting = deletingDocId === d.fileId;

                                return (
                                    <article key={d.fileId} className={styles.docCard}>
                                        {/* Preview: iframe para PDF, img para imágenes */}
                                        <button
                                            type="button"
                                            className={styles.docCardImageWrap}
                                            onClick={() =>
                                                window.open(
                                                    buildProxyUrl(d.fileId),
                                                    "_blank",
                                                    "noopener,noreferrer",
                                                )
                                            }
                                            aria-label={`Ver ${d.name}`}
                                            title="Abrir en pestaña nueva"
                                        >
                                            {isPdf ? (
                                                <iframe
                                                    src={buildProxyEmbedUrl(d.fileId)}
                                                    title={d.name}
                                                    loading="lazy"
                                                    className={styles.docCardImage}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                        border: 0,
                                                        background: "#fff",
                                                        pointerEvents: "none",
                                                    }}
                                                />
                                            ) : broken ? (
                                                <div className={styles.docCardImageFallback}>
                                                    <span>📄</span>
                                                    <span>Sin vista previa</span>
                                                </div>
                                            ) : (
                                                <img
                                                    src={buildProxyUrl(d.fileId)}
                                                    alt={d.name}
                                                    loading="lazy"
                                                    decoding="async"
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
                                            {isPdf && (
                                                <span
                                                    className={styles.docCardBadge}
                                                    style={{
                                                        left: "auto",
                                                        right: 8,
                                                        background: "rgba(239,68,68,0.85)",
                                                        color: "#fff",
                                                    }}
                                                >
                                                    PDF
                                                </span>
                                            )}
                                        </button>

                                        <div className={styles.docCardInfo}>
                                            <div className={styles.docCardStatus}>
                                                ✅ Subido
                                            </div>
                                            <div
                                                className={styles.docCardName}
                                                title={d.name}
                                            >
                                                {d.name}
                                            </div>
                                        </div>

                                        <div className={styles.docCardActions}>
                                            <button
                                                type="button"
                                                className={styles.docActionSecondary}
                                                onClick={() =>
                                                    window.open(
                                                        buildProxyUrl(d.fileId),
                                                        "_blank",
                                                        "noopener,noreferrer",
                                                    )
                                                }
                                                disabled={broken}
                                                aria-label="Ver documento"
                                            >
                                                👁️ <span>Ver</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.docActionDanger}
                                                onClick={() => handleDeleteDoc(d)}
                                                disabled={isDeleting}
                                                aria-label="Eliminar documento"
                                            >
                                                {isDeleting ? "⏳" : "🗑️"}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    </div>
                )}
            </Section>

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
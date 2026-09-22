"use client";

import { useRef, useState } from "react";
import styles from "./ingresos.module.css";
import CropPreviewModal from "./CropPreviewModal";
import CameraGuideModal from "./CameraGuideModal";
import {
    cx,
    Section,
    buildFolderName,
    convertToWebP,
} from "./helpers";

const UPLOAD_TIMEOUT_MS = 30000;

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
        xhr.onabort = () => reject(new Error("Subida cancelada por tiempo de espera"));
        if (signal) signal.addEventListener("abort", () => xhr.abort());
        xhr.send(formData);
    });
}

export default function DocumentacionSection({
    docs,
    setDocs,
    form,
    pdfUrl,
    pdfFileName,
}) {
    const [deletingDocId, setDeletingDocId] = useState(null);
    const [generatingCollage, setGeneratingCollage] = useState(false);
    const [cropToDni, setCropToDni] = useState(true);
    const [uploadSuccessMsg, setUploadSuccessMsg] = useState("");
    const [imgErrors, setImgErrors] = useState({});
    const [cropPreview, setCropPreview] = useState(null);
    const [showCameraGuide, setShowCameraGuide] = useState(false);

    const cameraInputRef = useRef(null);
    const galleryInputRef = useRef(null);

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

    const openCamera = () => {
        if (!form.trabajadorApellido.trim() || !form.trabajadorNombre.trim()) {
            alert("Completá apellido y nombre antes de subir documentación.");
            return;
        }
        setShowCameraGuide(true);
    };

    const confirmCamera = () => {
        setShowCameraGuide(false);
        setTimeout(() => cameraInputRef.current?.click(), 100);
    };

    const openGallery = () => {
        if (!form.trabajadorApellido.trim() || !form.trabajadorNombre.trim()) {
            alert("Completá apellido y nombre antes de subir documentación.");
            return;
        }
        galleryInputRef.current?.click();
    };

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
                fd.append("file", finalBlob, "documento.webp");
                fd.append("folderName", buildFolderName(form));

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

                let data;
                try {
                    data = await uploadWithProgress(
                        "/api/documentos/upload",
                        fd,
                        (pct) => setUploadState((s) => ({ ...s, percent: pct })),
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
                : `✅ ${total} documentos subidos correctamente`
        );
        setTimeout(() => setUploadSuccessMsg(""), 5000);
    };

    const handleDeleteDoc = async (doc) => {
        const ok = window.confirm(
            `¿Eliminar "${doc.name}"?\n\nSe borra de Google Drive y de la ficha del paciente.`
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

    const generarHojaImpresion = async () => {
        /* ... mismo código que ya tenías ... */
        if (!docs.length && !pdfUrl) {
            alert("No hay documentos ni PDF para imprimir.");
            return;
        }
        setGeneratingCollage(true);
        const printWindow = window.open("", "_blank");

        try {
            const PAGE_W = 1240;
            const PAGE_H = 1754;
            const MARGIN = 60;
            const GAP = 24;
            const COLS = 2;
            const ROWS = 3;
            const CELL_W = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
            const CELL_H = (PAGE_H - MARGIN * 2 - 110 - GAP * (ROWS - 1)) / ROWS;

            let valid = [];
            if (docs.length) {
                const loaded = await Promise.all(
                    docs.map(
                        (d) =>
                            new Promise((resolve) => {
                                const img = new Image();
                                img.onload = () => resolve({ img, doc: d });
                                img.onerror = () => resolve(null);
                                img.src = `/api/documentos/proxy?id=${d.fileId}`;
                            })
                    )
                );
                valid = loaded.filter(Boolean);
            }

            const collages = [];
            if (valid.length) {
                const perPage = COLS * ROWS;
                const totalPages = Math.ceil(valid.length / perPage);

                for (let p = 0; p < totalPages; p++) {
                    const slice = valid.slice(p * perPage, (p + 1) * perPage);
                    const canvas = document.createElement("canvas");
                    canvas.width = PAGE_W;
                    canvas.height = PAGE_H;
                    const ctx = canvas.getContext("2d");

                    ctx.fillStyle = "#ffffff";
                    ctx.fillRect(0, 0, PAGE_W, PAGE_H);

                    const paciente = `${form.trabajadorApellido} ${form.trabajadorNombre}`
                        .trim()
                        .toUpperCase();
                    const os = (form.OS || "").toUpperCase();
                    const afiliado = form.afiliadoPaciente || "";

                    ctx.fillStyle = "#111827";
                    ctx.font = "bold 32px sans-serif";
                    ctx.fillText("DOCUMENTACIÓN DEL PACIENTE", MARGIN, MARGIN);

                    ctx.font = "20px sans-serif";
                    ctx.fillStyle = "#374151";
                    ctx.fillText(
                        `Paciente: ${paciente || "—"}   |   O.S: ${os || "—"}   |   N° Afil.: ${afiliado || "—"}`,
                        MARGIN,
                        MARGIN + 34
                    );
                    ctx.fillText(
                        `Fecha: ${new Date().toLocaleDateString("es-AR")}   |   Página ${p + 1} de ${totalPages}`,
                        MARGIN,
                        MARGIN + 62
                    );

                    const topOffset = MARGIN + 100;

                    slice.forEach((item, idx) => {
                        const col = idx % COLS;
                        const row = Math.floor(idx / COLS);
                        const x = MARGIN + col * (CELL_W + GAP);
                        const y = topOffset + row * (CELL_H + GAP);

                        ctx.strokeStyle = "#9ca3af";
                        ctx.lineWidth = 2;
                        ctx.strokeRect(x, y, CELL_W, CELL_H);

                        const iw = item.img.width;
                        const ih = item.img.height;
                        const scale = Math.min((CELL_W - 16) / iw, (CELL_H - 44) / ih);
                        const dw = iw * scale;
                        const dh = ih * scale;
                        const dx = x + (CELL_W - dw) / 2;
                        const dy = y + 8 + (CELL_H - 44 - dh) / 2;

                        ctx.drawImage(item.img, dx, dy, dw, dh);

                        ctx.fillStyle = "#111827";
                        ctx.font = "bold 16px sans-serif";
                        ctx.fillText(item.doc.name || `documento${idx + 1}`, x + 10, y + CELL_H - 14);
                    });

                    collages.push(canvas);
                }
            }

            if (pdfUrl) {
                const { PDFDocument } = await import("pdf-lib");
                const formRes = await fetch(pdfUrl);
                const formBytes = await formRes.arrayBuffer();
                const formPdf = await PDFDocument.load(formBytes);
                const mergedPdf = await PDFDocument.create();

                const formPages = await mergedPdf.copyPages(
                    formPdf,
                    formPdf.getPageIndices()
                );
                formPages.forEach((pg) => mergedPdf.addPage(pg));

                const A4_W = 595.28;
                const A4_H = 841.89;

                for (const canvas of collages) {
                    const pngDataUrl = canvas.toDataURL("image/png");
                    const pngBase64 = pngDataUrl.split(",")[1];
                    const pngBytes = Uint8Array.from(atob(pngBase64), (c) =>
                        c.charCodeAt(0)
                    );
                    const pngImage = await mergedPdf.embedPng(pngBytes);
                    const page = mergedPdf.addPage([A4_W, A4_H]);
                    const scale = A4_W / pngImage.width;
                    const imgH = pngImage.height * scale;
                    page.drawImage(pngImage, {
                        x: 0,
                        y: A4_H - imgH,
                        width: A4_W,
                        height: imgH,
                    });
                }

                const mergedBytes = await mergedPdf.save();
                const mergedBlob = new Blob([mergedBytes], { type: "application/pdf" });
                const mergedUrl = URL.createObjectURL(mergedBlob);

                if (printWindow) printWindow.location.href = mergedUrl;
                else {
                    const a = document.createElement("a");
                    a.href = mergedUrl;
                    a.target = "_blank";
                    a.download = pdfFileName || "FORMULARIO_COMPLETO.pdf";
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                }
                return;
            }

            if (!collages.length) {
                alert("No se pudieron cargar las imágenes.");
                if (printWindow) printWindow.close();
                return;
            }

            const pagesDataUrls = collages.map((c) => c.toDataURL("image/png"));
            const html = `...`; // mismo HTML que ya tenías
            if (printWindow) {
                printWindow.document.write(html);
                printWindow.document.close();
            } else {
                alert("Permití las ventanas emergentes para ver la hoja.");
            }
        } catch (err) {
            console.error(err);
            alert("No se pudo generar la hoja: " + err.message);
            if (printWindow) printWindow.close();
        } finally {
            setGeneratingCollage(false);
        }
    };

    const stageLabel = () => {
        if (uploadState.stage === "convirtiendo") return "Procesando imagen…";
        if (uploadState.stage === "subiendo") return "Subiendo a Drive…";
        return "Procesando…";
    };

    const isMerged = !!pdfUrl && docs.length > 0;
    const disabled =
        uploadState.active || !form.trabajadorApellido || !form.trabajadorNombre;

    return (
        <>
            <Section
                title="6) Documentación"
                subtitle="Se convierten a WebP, se recortan y se suben a Google Drive."
            >
                {/* ---- Panel de acciones ---- */}
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

                {/* ---- Inputs ocultos ---- */}
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

                {/* ---- Estado de subida ---- */}
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

                {/* ---- Lista de documentos ---- */}
                {docs.length > 0 && (
                    <div className={styles.docListSection}>
                        <div className={styles.docListHeader}>
                            <h3 className={styles.docListTitle}>Documentos en este ingreso</h3>
                            <span className={styles.docListCount}>{docs.length}</span>
                        </div>

                        <div className={styles.docList}>
                            {docs.map((d, idx) => {
                                const broken = imgErrors[d.fileId];
                                const isDeleting = deletingDocId === d.fileId;

                                return (
                                    <article key={d.fileId} className={styles.docCard}>
                                        <button
                                            type="button"
                                            className={styles.docCardImageWrap}
                                            onClick={() => {
                                                if (!broken)
                                                    window.open(d.url, "_blank", "noopener,noreferrer");
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
                                            <span className={styles.docCardBadge}>#{idx + 1}</span>
                                        </button>

                                        <div className={styles.docCardInfo}>
                                            <div className={styles.docCardStatus}>✅ Subido</div>
                                            <div className={styles.docCardName} title={d.name}>
                                                {d.name}
                                            </div>
                                        </div>

                                        <div className={styles.docCardActions}>
                                            <button
                                                type="button"
                                                className={styles.docActionSecondary}
                                                onClick={() =>
                                                    window.open(d.url, "_blank", "noopener,noreferrer")
                                                }
                                                disabled={broken}
                                            >
                                                👁️ <span>Ver</span>
                                            </button>
                                            <button
                                                type="button"
                                                className={styles.docActionDanger}
                                                onClick={() => handleDeleteDoc(d)}
                                                disabled={isDeleting}
                                            >
                                                {isDeleting ? "⏳" : "🗑️"}
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            className={styles.docPrintAllBtn}
                            onClick={generarHojaImpresion}
                            disabled={generatingCollage}
                        >
                            {generatingCollage
                                ? "⏳ Generando…"
                                : isMerged
                                    ? "🖨️ Imprimir TODO (formulario + docs)"
                                    : "🖨️ Imprimir todos los documentos"}
                        </button>
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

            {showCameraGuide && (
                <CameraGuideModal
                    onContinue={confirmCamera}
                    onCancel={() => setShowCameraGuide(false)}
                />
            )}
        </>
    );
}
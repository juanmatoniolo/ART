"use client";

import { useState } from "react";
import styles from "./ingresos.module.css";
import {
    cx,
    Section,
    buildFolderName,
    convertToWebP,
    cropToRatio,
} from "./helpers";

const UPLOAD_TIMEOUT_MS = 20000;

function uploadWithProgress(url, formData, onProgress, signal) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url);

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                onProgress((e.loaded / e.total) * 100);
            }
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

        if (signal) {
            signal.addEventListener("abort", () => xhr.abort());
        }

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

    const handleFileSelected = async (e) => {
        const files = Array.from(e.target.files || []);
        e.target.value = "";
        if (!files.length) return;

        if (!form.trabajadorApellido.trim() || !form.trabajadorNombre.trim()) {
            alert("Completá apellido y nombre antes de subir documentación.");
            return;
        }

        setUploadSuccessMsg("");
        setUploadState({
            active: true,
            currentFile: 1,
            totalFiles: files.length,
            percent: 0,
            stage: "convirtiendo",
            error: "",
        });

        const nuevos = [];

        try {
            const folderName = buildFolderName(form);

            for (let i = 0; i < files.length; i++) {
                setUploadState((s) => ({
                    ...s,
                    currentFile: i + 1,
                    percent: 0,
                    stage: "convirtiendo",
                }));

                let webpBlob = await convertToWebP(files[i], 0.8);
                if (cropToDni) {
                    webpBlob = await cropToRatio(webpBlob, 1.585);
                }

                setUploadState((s) => ({ ...s, stage: "subiendo", percent: 0 }));

                const fd = new FormData();
                fd.append("file", webpBlob, "documento.webp");
                fd.append("folderName", folderName);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

                try {
                    const data = await uploadWithProgress(
                        "/api/documentos/upload",
                        fd,
                        (pct) => setUploadState((s) => ({ ...s, percent: pct })),
                        controller.signal
                    );

                    nuevos.push({
                        fileId: data.fileId,
                        name: data.name,
                        url: data.url,
                        fecha: Date.now(),
                    });
                } catch (err) {
                    if (nuevos.length) setDocs((prev) => [...prev, ...nuevos]);
                    throw new Error(
                        files.length > 1
                            ? `Se subieron ${nuevos.length} de ${files.length} archivos. ${err.message} Volvé a tocar "Subir imagen" para reintentar los que faltan.`
                            : `${err.message} Volvé a tocar "Subir imagen" para reintentar.`
                    );
                } finally {
                    clearTimeout(timeoutId);
                }
            }

            setDocs((prev) => [...prev, ...nuevos]);
            resetUploadState();

            const total = nuevos.length;
            setUploadSuccessMsg(
                total === 1
                    ? `✅ "${nuevos[0].name}" subido correctamente a Google Drive`
                    : `✅ ${total} documentos subidos correctamente a Google Drive`
            );
            setTimeout(() => setUploadSuccessMsg(""), 5000);
        } catch (err) {
            console.error(err);
            setUploadState((s) => ({
                ...s,
                active: false,
                percent: 0,
                stage: "",
                error: err.message || "Error al subir. Volvé a intentar.",
            }));
        }
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
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `Error ${res.status}`);
            }
            setDocs((prev) => prev.filter((d) => d.fileId !== doc.fileId));
        } catch (err) {
            console.error(err);
            alert("No se pudo eliminar el documento: " + err.message);
        } finally {
            setDeletingDocId(null);
        }
    };

    const generarHojaImpresion = async () => {
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
                        const label = item.doc.name || `documento${idx + 1}`;
                        ctx.fillText(label, x + 10, y + CELL_H - 14);
                    });

                    collages.push(canvas);
                }
            }

            /* CASO CON PDF → fusionar */
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

                if (printWindow) {
                    printWindow.location.href = mergedUrl;
                } else {
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

            /* CASO SIN PDF → solo collage */
            if (!collages.length) {
                alert("No se pudieron cargar las imágenes.");
                if (printWindow) printWindow.close();
                return;
            }

            const pagesDataUrls = collages.map((c) => c.toDataURL("image/png"));

            const html = `
        <html>
          <head>
            <title>Documentación del paciente</title>
            <style>
              @page { size: A4; margin: 0; }
              body { margin: 0; padding: 0; background: #f3f4f6; }
              .page { page-break-after: always; display: block; }
              .page:last-child { page-break-after: auto; }
              .page img { width: 100%; height: auto; display: block; }
              @media print { body { background: #fff; } }
              .no-print { text-align: center; padding: 20px; }
              .no-print button {
                padding: 12px 24px; font-size: 16px; cursor: pointer;
                background: #22c55e; color: white; border: none;
                border-radius: 8px; font-weight: 600;
              }
              @media print { .no-print { display: none; } }
            </style>
          </head>
          <body>
            <div class="no-print">
              <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
            </div>
            ${pagesDataUrls
                    .map((url) => `<div class="page"><img src="${url}" /></div>`)
                    .join("")}
          </body>
        </html>
      `;

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
        if (uploadState.stage === "convirtiendo") return "Convirtiendo a WebP...";
        if (uploadState.stage === "subiendo") return "Subiendo a Google Drive...";
        return "Procesando...";
    };

    const isMerged = !!pdfUrl && docs.length > 0;

    return (
        <Section
            title="6) Documentación"
            subtitle="Sacá fotos del DNI, carnet, estudios. Se convierten a WebP, se recortan al formato DNI y se suben a Google Drive."
        >
            <div className={styles.grid}>
                <div className={styles.field}>
                    <label
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 8,
                            cursor: "pointer",
                        }}
                    >
                        <input
                            type="checkbox"
                            checked={cropToDni}
                            onChange={(e) => setCropToDni(e.target.checked)}
                            style={{ width: 18, height: 18 }}
                        />
                        <span>✂️ Recortar en horizontal (formato DNI / carnet)</span>
                    </label>

                    <label className={styles.label}>📷 Subir imagen</label>
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        multiple
                        onChange={handleFileSelected}
                        disabled={
                            uploadState.active ||
                            !form.trabajadorApellido ||
                            !form.trabajadorNombre
                        }
                        className={styles.input}
                        style={{ paddingTop: 10 }}
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
                                    {uploadState.stage === "subiendo" &&
                                        uploadState.percent > 0 && (
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
                                title="Cerrar"
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    <div className={styles.sectionHint} style={{ marginTop: 6 }}>
                        Carpeta destino en Drive: <b>{buildFolderName(form) || "—"}</b>
                    </div>
                </div>
            </div>

            {docs.length > 0 && (
                <div style={{ marginTop: 14 }}>
                    <div className={styles.sectionHint}>
                        📁 Documentos en este ingreso ({docs.length}):
                    </div>

                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                            gap: 12,
                            marginTop: 10,
                        }}
                    >
                        {docs.map((d, idx) => {
                            const hasError = imgErrors[d.fileId];
                            return (
                                <div
                                    key={d.fileId}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        borderRadius: 10,
                                        overflow: "hidden",
                                        background: "rgba(59,130,246,0.08)",
                                        border: "1px solid rgba(59,130,246,0.3)",
                                    }}
                                >
                                    <div
                                        onClick={() => {
                                            if (!hasError) {
                                                window.open(d.url, "_blank", "noopener,noreferrer");
                                            }
                                        }}
                                        style={{
                                            width: "100%",
                                            height: 140,
                                            background: "#0f172a",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: hasError ? "default" : "pointer",
                                            overflow: "hidden",
                                        }}
                                    >
                                        {hasError ? (
                                            <span
                                                style={{
                                                    color: "#94a3b8",
                                                    fontSize: 13,
                                                    textAlign: "center",
                                                    padding: "0 8px",
                                                }}
                                            >
                                                📄 Sin vista previa
                                            </span>
                                        ) : (
                                            <img
                                                key={`${d.fileId}-${idx}`}
                                                src={`/api/documentos/proxy?id=${d.fileId}`}
                                                alt={d.name}
                                                style={{
                                                    maxWidth: "100%",
                                                    maxHeight: "100%",
                                                    objectFit: "contain",
                                                }}
                                                onError={() => {
                                                    setImgErrors((prev) => ({
                                                        ...prev,
                                                        [d.fileId]: "Error",
                                                    }));
                                                }}
                                            />
                                        )}
                                    </div>

                                    <div style={{ padding: "8px 10px", flex: 1 }}>
                                        <div
                                            style={{
                                                fontWeight: 600,
                                                fontSize: 13,
                                                color: "#22c55e",
                                                marginBottom: 4,
                                            }}
                                        >
                                            ✅ Subido correctamente
                                        </div>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "#cbd5e1",
                                                marginBottom: 8,
                                                wordBreak: "break-all",
                                            }}
                                        >
                                            <b>{d.name}</b>
                                            <br />
                                            <span style={{ opacity: 0.7 }}>
                                                Documento #{idx + 1}
                                            </span>
                                        </div>

                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button
                                                type="button"
                                                className={styles.secondaryBtn}
                                                style={{
                                                    height: 30,
                                                    paddingLeft: 10,
                                                    paddingRight: 10,
                                                    fontSize: 12,
                                                    flex: 1,
                                                }}
                                                onClick={() =>
                                                    window.open(d.url, "_blank", "noopener,noreferrer")
                                                }
                                            >
                                                👁️ Ver
                                            </button>
                                            <button
                                                type="button"
                                                className={cx(styles.iconBtn, styles.iconBtnDanger)}
                                                onClick={() => handleDeleteDoc(d)}
                                                disabled={deletingDocId === d.fileId}
                                                style={{ height: 30 }}
                                            >
                                                {deletingDocId === d.fileId ? "⏳" : "🗑️"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div
                        style={{
                            marginTop: 14,
                            display: "flex",
                            gap: 12,
                            flexWrap: "wrap",
                            alignItems: "center",
                        }}
                    >
                        <button
                            type="button"
                            className={styles.primaryBtn}
                            style={{
                                height: 42,
                                width: "auto",
                                paddingLeft: 18,
                                paddingRight: 18,
                            }}
                            onClick={generarHojaImpresion}
                            disabled={generatingCollage}
                        >
                            {generatingCollage
                                ? "⏳ Generando..."
                                : isMerged
                                    ? "🖨️ Imprimir TODO (formulario + documentos)"
                                    : "🖨️ Imprimir todos los documentos juntos"}
                        </button>
                        <div className={styles.sectionHint}>
                            {isMerged
                                ? "Se abre un PDF único con el formulario y los documentos al final."
                                : "Se abre una hoja A4 con todos los documentos en grilla."}
                        </div>
                    </div>
                </div>
            )}

            {uploadSuccessMsg && (
                <div
                    style={{
                        marginTop: 12,
                        padding: "10px 14px",
                        borderRadius: 8,
                        background: "rgba(34,197,94,0.15)",
                        border: "1px solid rgba(34,197,94,0.4)",
                        color: "#22c55e",
                        fontWeight: 500,
                        fontSize: 14,
                    }}
                >
                    {uploadSuccessMsg}
                </div>
            )}
        </Section>
    );
}
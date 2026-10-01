"use client";

import { useRef, useState } from "react";
import stylesBase from "./ingresos.module.css";
import stylesOwn from "./DocumentacionSection.module.css";
import CropPreviewModal from "./CropPreviewModal";
import { Section, convertToWebP } from "./helpers";
import {
    uploadToCloudinary,
    deleteFromCloudinary,
} from "@/lib/cloudinary-client";

const styles = { ...stylesBase, ...stylesOwn };

const IMG_TIMEOUT_MS = 45000;
const PDF_TIMEOUT_MS = 180000;
const PDF_MAX_MB = 5;
const PDF_RENDER_WIDTH = 1600;
const PDF_RENDER_QUALITY = 0.85;

/* =========================================================
   Helpers
   ========================================================= */
function clean(s) {
    return String(s || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9_-]/g, "")
        .toUpperCase();
}

function buildBaseName(form) {
    const parts = [
        clean(form?.trabajadorApellido),
        clean(form?.trabajadorNombre),
        clean(form?.trabajadorDni),
        clean(form?.OS),
        clean(form?.afiliadoPaciente),
    ].filter(Boolean);
    return parts.join("_") || "DOCUMENTO";
}

function buildFolder(form) {
    const a = clean(form?.trabajadorApellido) || "SIN_APELLIDO";
    const n = clean(form?.trabajadorNombre) || "SIN_NOMBRE";
    const d = clean(form?.trabajadorDni) || "SIN_DNI";
    const o = clean(form?.OS) || "SIN_OS";
    const af = clean(form?.afiliadoPaciente) || "SIN_AFILIADO";
    return `clinica/${a}-${n}-${d}-${o}-${af}`;
}

async function pdfToImages(file) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    const data = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data }).promise;
    const out = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const vp1 = page.getViewport({ scale: 1 });
        const scale = PDF_RENDER_WIDTH / vp1.width;
        const vp = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const blob = await new Promise((r) =>
            canvas.toBlob(r, "image/webp", PDF_RENDER_QUALITY),
        );
        if (blob) out.push({ blob, pageNumber: i, totalPages: pdf.numPages });
    }
    return out;
}

function isPdfFile(file) {
    return (
        (file?.name && /\.pdf$/i.test(file.name)) ||
        file?.type === "application/pdf"
    );
}

/* =========================================================
   Componente
   ========================================================= */
export default function DocumentacionSection({ docs, setDocs, form }) {
    const [queue, setQueue] = useState({}); // id → { name, percent, stage, error, kind }
    const [cropToDni, setCropToDni] = useState(false);
    const [cropPreview, setCropPreview] = useState(null);

    const cameraRef = useRef(null);
    const galleryRef = useRef(null);
    const pdfRef = useRef(null);

    const updateQ = (id, patch) =>
        setQueue((q) => ({ ...q, [id]: { ...q[id], ...patch } }));

    const removeQ = (id) =>
        setQueue((q) => {
            const n = { ...q };
            delete n[id];
            return n;
        });

    const newId = (suffix = "") =>
        `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}${suffix}`;

    /* ------------------------------------------------------
       Subida individual (llamada en background)
       ------------------------------------------------------ */
    const uploadOne = async (blob, { tempId, label, kind, formSnapshot }) => {
        updateQ(tempId, { stage: "subiendo", percent: 0 });

        const folderPath = buildFolder(formSnapshot);
        const base = buildBaseName(formSnapshot);
        const pid =
            kind === "pdf-page"
                ? `${base}_PDF_${Date.now()}_p${label.pageNumber}`
                : `${base}_${Date.now()}`;

        const controller = new AbortController();
        const to = setTimeout(
            () => controller.abort(),
            kind === "pdf-page" ? PDF_TIMEOUT_MS : IMG_TIMEOUT_MS,
        );

        try {
            const data = await uploadToCloudinary(blob, {
                folder: folderPath,
                publicId: pid,
                onProgress: (pct) => updateQ(tempId, { percent: pct }),
                signal: controller.signal,
            });
            clearTimeout(to);

            setDocs((prev) => [
                ...prev,
                {
                    publicId: data.publicId,
                    url: data.url,
                    resourceType: data.resourceType,
                    name: label.name || `${pid}.${data.format || "webp"}`,
                    fecha: Date.now(),
                    fromPdf: kind === "pdf-page",
                    pageNumber: label.pageNumber,
                    totalPages: label.totalPages,
                },
            ]);
            removeQ(tempId);
        } catch (err) {
            clearTimeout(to);
            updateQ(tempId, { stage: "error", error: err.message, percent: 0 });
        }
    };

    /* ------------------------------------------------------
       Selección de imágenes (múltiple)
       ------------------------------------------------------ */
    const handleImages = (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        const formSnapshot = { ...form };

        files.forEach((file) => {
            const tempId = newId();
            setQueue((q) => ({
                ...q,
                [tempId]: {
                    name: file.name,
                    percent: 0,
                    stage: "convirtiendo",
                    error: null,
                    kind: "image",
                },
            }));

            (async () => {
                try {
                    let blob = await convertToWebP(file, 0.75, 1600);

                    if (cropToDni) {
                        const cropped = await new Promise((resolve) => {
                            setCropPreview({
                                previewBlob: blob,
                                initialRatio: 1.585,
                                onConfirm: (b) => {
                                    setCropPreview(null);
                                    resolve(b);
                                },
                                onCancel: () => {
                                    setCropPreview(null);
                                    resolve(null);
                                },
                            });
                        });
                        if (!cropped) {
                            removeQ(tempId);
                            return;
                        }
                        blob = cropped;
                    }

                    await uploadOne(blob, {
                        tempId,
                        label: { name: file.name },
                        kind: "image",
                        formSnapshot,
                    });
                } catch (err) {
                    updateQ(tempId, { stage: "error", error: err.message });
                }
            })();
        });
    };

    /* ------------------------------------------------------
       Selección de PDF → páginas → subida en background
       ------------------------------------------------------ */
    const handlePdf = (file) => {
        if (!file) return;
        if (file.size > PDF_MAX_MB * 1024 * 1024) {
            alert(`El PDF no puede pesar más de ${PDF_MAX_MB} MB.`);
            return;
        }
        const tempId = newId("_pdf");
        const formSnapshot = { ...form };

        setQueue((q) => ({
            ...q,
            [tempId]: {
                name: file.name,
                percent: 0,
                stage: "convirtiendo",
                error: null,
                kind: "pdf",
            },
        }));

        (async () => {
            try {
                const pages = await pdfToImages(file);
                if (!pages.length) throw new Error("PDF sin páginas legibles");

                removeQ(tempId);

                for (const p of pages) {
                    const pageId = newId(`_p${p.pageNumber}`);
                    setQueue((q) => ({
                        ...q,
                        [pageId]: {
                            name: `${file.name} — pág ${p.pageNumber}/${p.totalPages}`,
                            percent: 0,
                            stage: "subiendo",
                            error: null,
                            kind: "pdf",
                        },
                    }));

                    uploadOne(p.blob, {
                        tempId: pageId,
                        label: {
                            name: `${file.name} — pág ${p.pageNumber}`,
                            pageNumber: p.pageNumber,
                            totalPages: p.totalPages,
                        },
                        kind: "pdf-page",
                        formSnapshot,
                    });
                }
            } catch (err) {
                updateQ(tempId, { stage: "error", error: err.message });
            }
        })();
    };

    const handleDelete = async (doc) => {
        if (!confirm(`¿Eliminar "${doc.name}"?`)) return;
        try {
            await deleteFromCloudinary(
                doc.publicId,
                doc.resourceType || "image",
            );
            setDocs((prev) =>
                prev.filter((d) => d.publicId !== doc.publicId),
            );
        } catch (e) {
            alert("No se pudo eliminar: " + e.message);
        }
    };

    const queueEntries = Object.entries(queue);
    const uploadingCount = queueEntries.filter(
        ([, v]) => v.stage !== "error",
    ).length;
    const errorCount = queueEntries.filter(
        ([, v]) => v.stage === "error",
    ).length;

    return (
        <>
            <Section
                title="Documentación"
                subtitle="Opcional. Se sube en segundo plano — podés seguir cargando datos mientras tanto."
            >
                {/* Botones de acción */}
                <div
                    style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                    }}
                >
                    <button
                        type="button"
                        className={styles.docAddBtn}
                        onClick={() => cameraRef.current?.click()}
                        style={{ flex: "1 1 140px" }}
                    >
                        <span className={styles.docAddBtnIcon}>📷</span>
                        <span className={styles.docAddBtnLabel}>Cámara</span>
                    </button>
                    <button
                        type="button"
                        className={styles.docAddBtn}
                        onClick={() => galleryRef.current?.click()}
                        style={{ flex: "1 1 140px" }}
                    >
                        <span className={styles.docAddBtnIcon}>🖼️</span>
                        <span className={styles.docAddBtnLabel}>Galería</span>
                    </button>
                    <button
                        type="button"
                        className={styles.docAddBtn}
                        onClick={() => pdfRef.current?.click()}
                        style={{ flex: "1 1 140px" }}
                    >
                        <span className={styles.docAddBtnIcon}>📄</span>
                        <span className={styles.docAddBtnLabel}>PDF</span>
                    </button>
                </div>

                <label
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 10,
                        fontSize: 13,
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        userSelect: "none",
                    }}
                >
                    <input
                        type="checkbox"
                        checked={cropToDni}
                        onChange={(e) => setCropToDni(e.target.checked)}
                    />
                    ✂️ Editor formato DNI (recortar cada foto)
                </label>

                {/* Lista compacta de items (subiendo + subidos) */}
                {(queueEntries.length > 0 || docs.length > 0) && (
                    <div
                        style={{
                            marginTop: 12,
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                        }}
                    >
                        {queueEntries.map(([id, u]) => (
                            <div
                                key={id}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    background:
                                        u.stage === "error"
                                            ? "rgba(239,68,68,0.1)"
                                            : "var(--bg-section)",
                                    border: `1px solid ${u.stage === "error"
                                            ? "rgba(239,68,68,0.3)"
                                            : "var(--border-color)"
                                        }`,
                                    fontSize: 13,
                                }}
                            >
                                <span style={{ fontSize: 14, flexShrink: 0 }}>
                                    {u.stage === "error"
                                        ? "❌"
                                        : u.stage === "convirtiendo"
                                            ? "⚙️"
                                            : "⏳"}
                                </span>
                                <span
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {u.name}
                                </span>
                                <span
                                    style={{
                                        color:
                                            u.stage === "error"
                                                ? "#f87171"
                                                : "var(--text-muted)",
                                        fontSize: 12,
                                        flexShrink: 0,
                                    }}
                                >
                                    {u.stage === "error"
                                        ? u.error || "Error"
                                        : u.stage === "convirtiendo"
                                            ? "Convirtiendo…"
                                            : `${Math.round(u.percent || 0)}%`}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => removeQ(id)}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "var(--text-muted)",
                                        fontSize: 14,
                                        padding: 2,
                                        flexShrink: 0,
                                    }}
                                    title="Quitar de la lista"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}

                        {docs.map((d) => (
                            <div
                                key={d.publicId}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "8px 10px",
                                    borderRadius: 8,
                                    background: "var(--bg-section)",
                                    border: "1px solid var(--border-color)",
                                    fontSize: 13,
                                }}
                            >
                                {d.resourceType === "raw" ? (
                                    <span style={{ fontSize: 14, flexShrink: 0 }}>
                                        📄
                                    </span>
                                ) : (
                                    <img
                                        src={d.url}
                                        alt=""
                                        style={{
                                            width: 32,
                                            height: 32,
                                            objectFit: "cover",
                                            borderRadius: 4,
                                            flexShrink: 0,
                                        }}
                                    />
                                )}
                                <span
                                    style={{
                                        flex: 1,
                                        minWidth: 0,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {d.name}
                                </span>
                                <span
                                    style={{
                                        color: "#4ade80",
                                        fontSize: 14,
                                        fontWeight: 700,
                                        flexShrink: 0,
                                    }}
                                    title="Subido"
                                >
                                    ✓
                                </span>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(d)}
                                    style={{
                                        background: "transparent",
                                        border: "none",
                                        cursor: "pointer",
                                        color: "var(--text-muted)",
                                        fontSize: 13,
                                        padding: 2,
                                        flexShrink: 0,
                                    }}
                                    title="Eliminar"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {/* Resumen */}
                {(docs.length > 0 || uploadingCount > 0 || errorCount > 0) && (
                    <div
                        style={{
                            marginTop: 10,
                            fontSize: 12,
                            color: "var(--text-muted)",
                            display: "flex",
                            gap: 10,
                            flexWrap: "wrap",
                        }}
                    >
                        {docs.length > 0 && (
                            <span>
                                ✅ {docs.length} subido
                                {docs.length !== 1 ? "s" : ""}
                            </span>
                        )}
                        {uploadingCount > 0 && (
                            <span>⏳ {uploadingCount} en curso</span>
                        )}
                        {errorCount > 0 && (
                            <span style={{ color: "#f87171" }}>
                                ❌ {errorCount} con error
                            </span>
                        )}
                    </div>
                )}
            </Section>

            <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                onChange={(e) => {
                    handleImages(e.target.files);
                    e.target.value = "";
                }}
                style={{ display: "none" }}
            />
            <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                    handleImages(e.target.files);
                    e.target.value = "";
                }}
                style={{ display: "none" }}
            />
            <input
                ref={pdfRef}
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => {
                    handlePdf(e.target.files?.[0]);
                    e.target.value = "";
                }}
                style={{ display: "none" }}
            />

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
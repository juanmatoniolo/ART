"use client";

import { useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, update } from "firebase/database";
import styles from "./ingresos.module.css";
import {
    generarFrentePDFBlob,
    openPDFBlob,
    uploadWithProgress,
} from "./documentosHelpers";
import {
    convertToWebP,
    cropToRatio,
    buildFolderName,
    cx,
    onlyDigits,
    getPdfPages,
    PRESTADOR_CONST,
} from "./helpers";

const DB_NODE = "ingresos-pacientes";
const UPLOAD_TIMEOUT_MS = 20000;

export default function DocumentosModal({ paciente, onClose, onUpdated }) {
    if (!paciente) {
        console.warn("DocumentosModal: paciente es undefined, no renderiza.");
        return null;
    }

    const [docs, setDocs] = useState(() =>
        Array.isArray(paciente?.documentacion) ? paciente.documentacion : []
    );
    const [cropToDni, setCropToDni] = useState(true);
    const [deletingId, setDeletingId] = useState(null);
    const [replacingId, setReplacingId] = useState(null);
    const [adding, setAdding] = useState(false);
    const [printing, setPrinting] = useState(false);
    const [error, setError] = useState("");
    const [msg, setMsg] = useState("");

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

    /* ---------- Eliminar ---------- */
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
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                throw new Error(d.error || `Error ${res.status}`);
            }
            await persistDocs(docs.filter((d) => d.fileId !== doc.fileId));
            flashMsg("🗑️ Documento eliminado");
        } catch (err) {
            console.error(err);
            setError("No se pudo eliminar: " + err.message);
        } finally {
            setDeletingId(null);
        }
    };

    /* ---------- Reemplazar ---------- */
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
            let webpBlob = await convertToWebP(file, 0.8);
            if (cropToDni) webpBlob = await cropToRatio(webpBlob, 1.585);

            const fd = new FormData();
            fd.append("file", webpBlob, "documento.webp");
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

    /* ---------- Agregar ---------- */
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
                let webpBlob = await convertToWebP(file, 0.8);
                if (cropToDni) webpBlob = await cropToRatio(webpBlob, 1.585);

                const fd = new FormData();
                fd.append("file", webpBlob, "documento.webp");
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

            const newDocs = [...docs, ...nuevos];
            await persistDocs(newDocs);
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

    /* =========================================================
       Imprimir Documentación completa = FORMULARIO + FOTOS
       Funciona tanto para PISO como UTI.
       ========================================================= */
    const handlePrintDocumentacion = async () => {
        if (!docs.length) {
            alert("No hay documentos para imprimir.");
            return;
        }
        setPrinting(true);
        setError("");
        try {
            /* 1) Generar PDF del formulario (INT PISO o INT UTI) */
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

            /* 2) Generar el collage de documentación (FRENTE) */
            const docBlob = await generarFrentePDFBlob({ docs, form: formLike });
            const docBytes = await docBlob.arrayBuffer();

            /* 3) Fusionar con pdf-lib: formulario primero, luego docs */
            const { PDFDocument } = await import("pdf-lib");
            const formPdf = await PDFDocument.load(formBytes);
            const docPdf = await PDFDocument.load(docBytes);
            const mergedPdf = await PDFDocument.create();

            const formPages = await mergedPdf.copyPages(
                formPdf,
                formPdf.getPageIndices()
            );
            formPages.forEach((pg) => mergedPdf.addPage(pg));

            const docPages = await mergedPdf.copyPages(
                docPdf,
                docPdf.getPageIndices()
            );
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
            setPrinting(false);
        }
    };

    const busy = deletingId !== null || replacingId !== null || adding;

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                        <h2 style={{ margin: 0, fontSize: 18 }}>
                            📎 Documentación del paciente
                        </h2>
                        <div
                            style={{
                                fontSize: 13,
                                opacity: 0.75,
                                marginTop: 4,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <b>{pacienteNombre}</b>
                            {paciente?.OS ? ` | O.S: ${paciente.OS}` : ""}
                            {paciente?.afiliadoPaciente
                                ? ` | N° Afil.: ${paciente.afiliadoPaciente}`
                                : ""}
                            {paciente?.tipoIngreso ? ` | ${paciente.tipoIngreso}` : ""}
                        </div>
                    </div>
                    <button
                        type="button"
                        className={styles.modalCloseBtn}
                        onClick={onClose}
                        title="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <div className={styles.modalBody}>
                    {error && (
                        <div className={styles.uploadError} style={{ marginBottom: 12 }}>
                            <div style={{ flex: 1 }}>❌ {error}</div>
                            <button
                                type="button"
                                className={styles.errorCloseBtn}
                                onClick={() => setError("")}
                            >
                                ✕
                            </button>
                        </div>
                    )}

                    {msg && (
                        <div
                            style={{
                                marginBottom: 12,
                                padding: "10px 14px",
                                borderRadius: 8,
                                background: "rgba(34,197,94,0.15)",
                                border: "1px solid rgba(34,197,94,0.4)",
                                color: "#22c55e",
                                fontWeight: 500,
                                fontSize: 14,
                            }}
                        >
                            {msg}
                        </div>
                    )}

                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                            marginBottom: 12,
                            flexWrap: "wrap",
                        }}
                    >
                        <label
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                cursor: "pointer",
                                fontSize: 13,
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={cropToDni}
                                onChange={(e) => setCropToDni(e.target.checked)}
                                style={{ width: 16, height: 16 }}
                            />
                            <span>✂️ Recortar al subir/reemplazar (formato DNI)</span>
                        </label>

                        <button
                            type="button"
                            className={styles.secondaryBtn}
                            style={{ height: 34, paddingLeft: 14, paddingRight: 14 }}
                            onClick={() => addInputRef.current?.click()}
                            disabled={busy}
                        >
                            {adding ? "⏳ Subiendo..." : "➕ Agregar documento"}
                        </button>
                    </div>

                    {docs.length === 0 ? (
                        <div className={styles.empty} style={{ padding: 30 }}>
                            Este paciente no tiene documentación cargada.
                        </div>
                    ) : (
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                                gap: 12,
                            }}
                        >
                            {docs.map((d, idx) => (
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
                                        onClick={() =>
                                            window.open(d.url, "_blank", "noopener,noreferrer")
                                        }
                                        style={{
                                            width: "100%",
                                            height: 160,
                                            background: "#0f172a",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            cursor: "pointer",
                                            overflow: "hidden",
                                        }}
                                        title="Clic para ver en Google Drive"
                                    >
                                        <img
                                            src={`/api/documentos/proxy?id=${d.fileId}`}
                                            alt={d.name}
                                            style={{
                                                maxWidth: "100%",
                                                maxHeight: "100%",
                                                objectFit: "contain",
                                            }}
                                            onError={(e) => {
                                                e.target.style.display = "none";
                                                e.target.parentElement.innerHTML =
                                                    '<span style="color:#94a3b8;font-size:13px">📄 Sin vista previa</span>';
                                            }}
                                        />
                                    </div>
                                    <div style={{ padding: "8px 10px" }}>
                                        <div
                                            style={{
                                                fontSize: 12,
                                                color: "#cbd5e1",
                                                marginBottom: 6,
                                                wordBreak: "break-all",
                                            }}
                                        >
                                            <b>{d.name}</b>{" "}
                                            <span style={{ opacity: 0.7 }}>#{idx + 1}</span>
                                        </div>
                                        <div style={{ display: "flex", gap: 6 }}>
                                            <button
                                                type="button"
                                                className={styles.secondaryBtn}
                                                style={{
                                                    height: 32,
                                                    paddingLeft: 8,
                                                    paddingRight: 8,
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
                                                className={styles.secondaryBtn}
                                                style={{
                                                    height: 32,
                                                    paddingLeft: 10,
                                                    paddingRight: 10,
                                                    fontSize: 12,
                                                }}
                                                onClick={() => handleReplaceClick(d)}
                                                disabled={busy}
                                                title="Reemplazar por otra foto/archivo"
                                            >
                                                {replacingId === d.fileId ? "⏳" : "🔄"}
                                            </button>
                                            <button
                                                type="button"
                                                className={cx(styles.iconBtn, styles.iconBtnDanger)}
                                                style={{ height: 32, width: 32 }}
                                                onClick={() => handleDelete(d)}
                                                disabled={busy}
                                                title="Eliminar"
                                            >
                                                {deletingId === d.fileId ? "⏳" : "🗑️"}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

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
                        capture="environment"
                        multiple
                        ref={addInputRef}
                        onChange={handleAddFile}
                        style={{ display: "none" }}
                    />
                </div>

                <div className={styles.modalFooter}>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        style={{
                            height: 42,
                            width: "auto",
                            paddingLeft: 18,
                            paddingRight: 18,
                        }}
                        onClick={handlePrintDocumentacion}
                        disabled={printing || !docs.length}
                    >
                        {printing
                            ? "⏳ Generando..."
                            : "🖨️ Imprimir Documentación"}
                    </button>
                    <div style={{ flex: 1 }} />
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ height: 42, paddingLeft: 18, paddingRight: 18 }}
                        onClick={onClose}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
}
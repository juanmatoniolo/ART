"use client";

import { useEffect, useState } from "react";
import styles from "./ingresos.module.css";

export default function CropPreviewModal({
    previewBlob,
    onConfirm,
    onCancel,
}) {
    const [previewUrl, setPreviewUrl] = useState("");
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!previewBlob) return;
        const url = URL.createObjectURL(previewBlob);
        setPreviewUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [previewBlob]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && !uploading) onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel, uploading]);

    const handleConfirm = async () => {
        setUploading(true);
        try {
            await onConfirm();
        } finally {
            setUploading(false);
        }
    };

    if (!previewUrl) return null;

    return (
        <div
            className={styles.cropModalOverlay}
            onClick={uploading ? undefined : onCancel}
        >
            <div
                className={styles.cropModalContent}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.cropModalHeader}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>
                        ✂️ Vista previa — así se va a recortar
                    </h3>
                    <button
                        type="button"
                        className={styles.modalCloseBtn}
                        onClick={onCancel}
                        disabled={uploading}
                        title="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <div className={styles.cropModalBody}>
                    <div className={styles.cropPreviewBox}>
                        <img
                            src={previewUrl}
                            alt="Vista previa"
                            style={{
                                width: "100%",
                                height: "auto",
                                display: "block",
                                borderRadius: 8,
                            }}
                        />
                    </div>
                    <div
                        className={styles.sectionHint}
                        style={{ marginTop: 10, textAlign: "center" }}
                    >
                        Si no te gusta cómo quedó, tocá "Elegir otra" y probá con otra foto.
                    </div>
                </div>

                <div className={styles.cropModalFooter}>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ flex: 1, minHeight: 48 }}
                        onClick={onCancel}
                        disabled={uploading}
                    >
                        🔄 Elegir otra
                    </button>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        style={{ flex: 1, minHeight: 48, width: "auto" }}
                        onClick={handleConfirm}
                        disabled={uploading}
                    >
                        {uploading ? "⏳ Subiendo..." : "✅ Subir esta foto"}
                    </button>
                </div>
            </div>
        </div>
    );
}
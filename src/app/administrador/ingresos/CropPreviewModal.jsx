"use client";

import { useCallback, useEffect, useState } from "react";
import Cropper from "react-easy-crop";
import styles from "./CropPreviewModal.module.css";

/* ---------- helpers para generar la imagen recortada ---------- */
function createImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.addEventListener("load", () => resolve(img));
        img.addEventListener("error", (err) => reject(err));
        img.crossOrigin = "anonymous";
        img.src = url;
    });
}

async function getCroppedBlob(imageSrc, pixelCrop) {
    const image = await createImage(imageSrc);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) reject(new Error("No se pudo generar la imagen"));
                else resolve(blob);
            },
            "image/webp",
            0.85
        );
    });
}

/* ---------- ratios predefinidos ---------- */
const RATIOS = [
    { label: "DNI / Carnet", value: 1.585 },
    { label: "Credencial", value: 1.42 },
    { label: "Cuadrado", value: 1 },
    { label: "Vertical", value: 0.72 },
];

export default function CropPreviewModal({
    previewBlob,
    initialRatio = 1.585,
    onConfirm,
    onCancel,
}) {
    const [imageUrl, setImageUrl] = useState("");
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [aspect, setAspect] = useState(initialRatio || 1.585);
    const [pixelCrop, setPixelCrop] = useState(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (!previewBlob) return;
        const url = URL.createObjectURL(previewBlob);
        setImageUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [previewBlob]);

    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape" && !uploading) onCancel();
        };
        window.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
        };
    }, [onCancel, uploading]);

    const onCropComplete = useCallback((_, croppedAreaPixels) => {
        setPixelCrop(croppedAreaPixels);
    }, []);

    const handleConfirm = async () => {
        if (!pixelCrop || !imageUrl) return;
        setUploading(true);
        try {
            const cropped = await getCroppedBlob(imageUrl, pixelCrop);
            await onConfirm(cropped);
        } catch (err) {
            console.error(err);
            alert("No se pudo recortar: " + err.message);
        } finally {
            setUploading(false);
        }
    };

    if (!imageUrl) return null;

    return (
        <div
            className={styles.cropModalOverlay}
            role="presentation"
            onClick={uploading ? undefined : onCancel}
        >
            <div
                className={styles.cropModalContent}
                role="dialog"
                aria-modal="true"
                aria-label="Ajustá el encuadre de la foto"
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.cropModalHeader}>
                    <h3>✂️ Ajustá el encuadre</h3>
                    <button
                        type="button"
                        className={styles.modalCloseBtn}
                        onClick={onCancel}
                        disabled={uploading}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </header>

                <div className={styles.cropEditorContainer}>
                    <Cropper
                        image={imageUrl}
                        crop={crop}
                        zoom={zoom}
                        aspect={aspect}
                        onCropChange={setCrop}
                        onZoomChange={setZoom}
                        onCropComplete={onCropComplete}
                        showGrid
                        objectFit="contain"
                    />
                </div>

                <div className={styles.cropControls}>
                    <div className={styles.cropRatioRow}>
                        {RATIOS.map((r) => (
                            <button
                                key={r.label}
                                type="button"
                                className={`${styles.cropRatioBtn} ${aspect === r.value ? styles.cropRatioBtnActive : ""
                                    }`}
                                onClick={() => setAspect(r.value)}
                                disabled={uploading}
                            >
                                {r.label}
                            </button>
                        ))}
                    </div>

                    <div className={styles.cropZoomRow}>
                        <span className={styles.cropZoomLabel}>🔍 Zoom</span>
                        <input
                            type="range"
                            min={1}
                            max={3}
                            step={0.01}
                            value={zoom}
                            onChange={(e) => setZoom(Number(e.target.value))}
                            className={styles.cropZoomSlider}
                            disabled={uploading}
                        />
                        <span className={styles.cropZoomValue}>{zoom.toFixed(2)}x</span>
                    </div>

                    <div className={styles.sectionHint}>
                        Arrastrá la imagen para mover. Ajustá el zoom. Elegí el formato.
                    </div>
                </div>

                <footer className={styles.cropModalFooter}>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ flex: 1 }}
                        onClick={onCancel}
                        disabled={uploading}
                    >
                        🔄 Elegir otra
                    </button>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        style={{ flex: 1, width: "auto" }}
                        onClick={handleConfirm}
                        disabled={uploading}
                    >
                        {uploading ? "⏳ Subiendo..." : "✅ Subir esta foto"}
                    </button>
                </footer>
            </div>
        </div>
    );
}
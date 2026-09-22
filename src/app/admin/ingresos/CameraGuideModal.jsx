"use client";

import { useEffect } from "react";
import styles from "./ingresos.module.css";

export default function CameraGuideModal({ onContinue, onCancel }) {
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === "Escape") onCancel();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel]);

    return (
        <div className={styles.cropModalOverlay} onClick={onCancel}>
            <div
                className={styles.cropModalContent}
                style={{ maxWidth: 420 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className={styles.cropModalHeader}>
                    <h3 style={{ margin: 0, fontSize: 16 }}>📷 Cómo sacar la foto</h3>
                    <button
                        type="button"
                        className={styles.modalCloseBtn}
                        onClick={onCancel}
                        title="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                <div className={styles.cropModalBody}>
                    <div className={styles.cameraGuideFrame}>
                        <div className={styles.cameraGuideCornerTL} />
                        <div className={styles.cameraGuideCornerTR} />
                        <div className={styles.cameraGuideCornerBL} />
                        <div className={styles.cameraGuideCornerBR} />
                        <span className={styles.cameraGuideText}>
                            Encuadrá el documento aquí
                        </span>
                    </div>

                    <ul className={styles.cameraGuideList}>
                        <li>📍 Apoyá el DNI sobre una superficie plana</li>
                        <li>💡 Buscá buena luz, sin sombras ni reflejos</li>
                        <li>📐 Que el documento ocupe todo el ancho posible</li>
                        <li>🎯 Evitá mover el celular al sacar la foto</li>
                    </ul>
                </div>

                <div className={styles.cropModalFooter}>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        style={{ flex: 1, minHeight: 48 }}
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        style={{ flex: 1, minHeight: 48, width: "auto" }}
                        onClick={onContinue}
                    >
                        📷 Continuar
                    </button>
                </div>
            </div>
        </div>
    );
}
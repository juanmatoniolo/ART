"use client";

import { useEffect, useRef } from "react";
import styles from "./CameraGuideModal.module.css";

export default function CameraGuideModal({ onContinue, onCancel }) {
    const dialogRef = useRef(null);
    const continueBtnRef = useRef(null);

    useEffect(() => {
        const previouslyFocused = document.activeElement;

        const onKey = (e) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onCancel();
                return;
            }
            if (e.key === "Tab" && dialogRef.current) {
                const focusables = dialogRef.current.querySelectorAll(
                    'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
                );
                if (!focusables.length) return;
                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", onKey);
        document.body.style.overflow = "hidden";

        const t = window.setTimeout(() => continueBtnRef.current?.focus(), 50);

        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = "";
            window.clearTimeout(t);
            if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
        };
    }, [onCancel]);

    return (
        <div
            className={styles.cropModalOverlay}
            role="presentation"
            onClick={onCancel}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="camera-guide-title"
                aria-describedby="camera-guide-desc"
                className={`${styles.cropModalContent} ${styles.cameraGuideModal}`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className={styles.cropModalHeader}>
                    <h2 id="camera-guide-title" className={styles.cameraGuideTitle}>
                        📷 Cómo sacar la foto
                    </h2>
                    <button
                        type="button"
                        className={styles.modalCloseBtn}
                        onClick={onCancel}
                        aria-label="Cerrar guía de cámara"
                    >
                        ✕
                    </button>
                </header>

                <div className={styles.cropModalBody}>
                    <div
                        className={styles.cameraGuideFrame}
                        role="img"
                        aria-label="Marco de referencia para encuadrar el documento dentro del área punteada"
                    >
                        <span className={styles.cameraGuideCornerTL} aria-hidden="true" />
                        <span className={styles.cameraGuideCornerTR} aria-hidden="true" />
                        <span className={styles.cameraGuideCornerBL} aria-hidden="true" />
                        <span className={styles.cameraGuideCornerBR} aria-hidden="true" />
                        <span className={styles.cameraGuideText}>
                            Encuadrá el documento aquí
                        </span>
                    </div>

                    <ul id="camera-guide-desc" className={styles.cameraGuideList}>
                        <li><span aria-hidden="true">📍</span><span>Apoyá el DNI sobre una superficie plana</span></li>
                        <li><span aria-hidden="true">💡</span><span>Buscá buena luz, sin sombras ni reflejos</span></li>
                        <li><span aria-hidden="true">📐</span><span>Que el documento ocupe todo el ancho posible</span></li>
                        <li><span aria-hidden="true">🎯</span><span>Evitá mover el celular al sacar la foto</span></li>
                    </ul>
                </div>

                <footer className={styles.cropModalFooter}>
                    <button
                        type="button"
                        className={styles.secondaryBtn}
                        onClick={onCancel}
                    >
                        Cancelar
                    </button>
                    <button
                        ref={continueBtnRef}
                        type="button"
                        className={styles.primaryBtn}
                        onClick={onContinue}
                    >
                        📷 Continuar
                    </button>
                </footer>
            </div>
        </div>
    );
}
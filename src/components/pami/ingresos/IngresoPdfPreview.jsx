"use client";
import { useState } from "react";
import { getPdfPages } from "@/app/ingresos/helpers";
import styles from "./ingreso.module.css";

export default function IngresoPdfPreview({ payload, tipoIngreso, onContinue }) {
    const [loading, setLoading] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    const generarPDF = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/ingresos", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    payload,
                    fileName: `PAMI_${payload.trabajador.apellido}_${payload.trabajador.dni}.pdf`,
                    pages: getPdfPages(tipoIngreso || payload.tipoIngreso),
                }),
            });
            if (!res.ok) throw new Error(`Error ${res.status}`);
            const blob = await res.blob();
            setPdfUrl(URL.createObjectURL(blob));
        } catch (e) {
            alert("No se pudo generar el PDF: " + e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.previewBox}>
            <button type="button" className={styles.btnPrimario} onClick={generarPDF} disabled={loading}>
                {loading ? "Generando…" : "🖨️ Generar PDF"}
            </button>
            {pdfUrl && (
                <>
                    <a className={styles.btnSecundario} href={pdfUrl} target="_blank" rel="noopener noreferrer">Abrir PDF</a>
                    <a className={styles.btnSecundario} href={pdfUrl} download={`PAMI_${payload.trabajador.apellido}_${payload.trabajador.dni}.pdf`}>Descargar</a>
                </>
            )}
            {onContinue && (
                <button type="button" className={styles.btnPrimario} onClick={onContinue}>
                    Continuar →
                </button>
            )}
        </div>
    );
}
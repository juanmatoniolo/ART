"use client";

import { useState, useEffect, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, push } from "firebase/database";
import styles from "./foja.module.css";

const initialState = {
  apelidoynombre: "",
  edad: "",
  cirujano: "",
  segundoayudante: "",
  anestesista: "",
  dia: "",
  mes: "",
  anio: "",
  hsfin: "",
  inichsinicio: "",
  primerayudante: "",
  preoperatorio: "",
  posoperatorio: "",
  procedimientoqx: "",
  hallazgos: "",
};

export default function FojaQXPage() {
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState("idle"); // idle | saving | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [pdfFileName, setPdfFileName] = useState(null);
  const [pdfError, setPdfError] = useState(null);
  const [firebaseId, setFirebaseId] = useState(null);

  // Limpiar URL del blob al desmontar
  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("saving");
    setErrorMsg("");
    setPdfError(null);
    setFirebaseId(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setPdfFileName(null);
    }

    try {
      // 1. Guardar en Firebase
      const fojaRef = ref(db, "fojaqx");
      const snapshot = await push(fojaRef, {
        ...form,
        timestamp: new Date().toISOString(),
      });
      const newId = snapshot.key;
      setFirebaseId(newId);

      // 2. Generar PDF llamando a la API route
      const response = await fetch("/api/fojaqx/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al generar PDF: ${response.status} ${errorText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const fileName = `FojaQX_${form.apelidoynombre.replace(/\s/g, "_")}_${form.dia}_${form.mes}_${form.anio}.pdf`;
      setPdfUrl(url);
      setPdfFileName(fileName);

      setStatus("success");
      setForm(initialState);
      // Opcional: resetear el formulario después de 4 segundos
      setTimeout(() => {
        if (status === "success") setStatus("idle");
      }, 8000);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setErrorMsg(err.message || "Error al guardar o generar PDF. Intente nuevamente.");
    }
  };

  const handleReset = () => {
    setForm(initialState);
    setStatus("idle");
    setErrorMsg("");
    setPdfError(null);
    setFirebaseId(null);
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setPdfFileName(null);
    }
  };

  const openPdf = () => {
    if (pdfUrl) window.open(pdfUrl, "_blank", "noopener,noreferrer");
  };

  const downloadPdf = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = pdfFileName || "foja_quirurgica.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.headerAccent} />
          <div className={styles.headerContent}>
            <span className={styles.headerTag}>Registro Quirúrgico</span>
            <h1 className={styles.title}>Foja Quirúrgica QX</h1>
            <p className={styles.subtitle}>
              Completar todos los campos y confirmar para guardar el registro y generar el PDF.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* Sección: Datos del Paciente */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>01</span>
              <h2 className={styles.sectionTitle}>Datos del Paciente</h2>
            </div>
            <div className={styles.grid2}>
              <div className={styles.fieldFull}>
                <label className={styles.label} htmlFor="apelidoynombre">
                  Apellido y Nombre
                </label>
                <input
                  id="apelidoynombre"
                  name="apelidoynombre"
                  type="text"
                  value={form.apelidoynombre}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Apellido completo, Nombre"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="edad">
                  Edad
                </label>
                <input
                  id="edad"
                  name="edad"
                  type="number"
                  min="0"
                  max="150"
                  value={form.edad}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Años"
                  required
                />
              </div>
            </div>
          </section>

          {/* Sección: Equipo Quirúrgico */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>02</span>
              <h2 className={styles.sectionTitle}>Equipo Quirúrgico</h2>
            </div>
            <div className={styles.grid2}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="cirujano">
                  Cirujano
                </label>
                <input
                  id="cirujano"
                  name="cirujano"
                  type="text"
                  value={form.cirujano}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Dr./Dra."
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="primerayudante">
                  Primer Ayudante
                </label>
                <input
                  id="primerayudante"
                  name="primerayudante"
                  type="text"
                  value={form.primerayudante}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Dr./Dra."
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="segundoayudante">
                  Segundo Ayudante
                </label>
                <input
                  id="segundoayudante"
                  name="segundoayudante"
                  type="text"
                  value={form.segundoayudante}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Dr./Dra."
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="anestesista">
                  Anestesista
                </label>
                <input
                  id="anestesista"
                  name="anestesista"
                  type="text"
                  value={form.anestesista}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="Dr./Dra."
                  required
                />
              </div>
            </div>
          </section>

          {/* Sección: Fecha y Horarios */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>03</span>
              <h2 className={styles.sectionTitle}>Fecha y Horarios</h2>
            </div>
            <div className={styles.grid3}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="dia">
                  Día
                </label>
                <input
                  id="dia"
                  name="dia"
                  type="number"
                  min="1"
                  max="31"
                  value={form.dia}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="DD"
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="mes">
                  Mes
                </label>
                <select
                  id="mes"
                  name="mes"
                  value={form.mes}
                  onChange={handleChange}
                  className={styles.select}
                  required
                >
                  <option value="">— Mes —</option>
                  {[
                    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
                    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
                  ].map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="anio">
                  Año
                </label>
                <input
                  id="anio"
                  name="anio"
                  type="number"
                  min="2000"
                  max="2100"
                  value={form.anio}
                  onChange={handleChange}
                  className={styles.input}
                  placeholder="AAAA"
                  required
                />
              </div>
            </div>
            <div className={styles.grid2} style={{ marginTop: "1.25rem" }}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="inichsinicio">
                  Hora de Inicio
                </label>
                <input
                  id="inichsinicio"
                  name="inichsinicio"
                  type="time"
                  value={form.inichsinicio}
                  onChange={handleChange}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="hsfin">
                  Hora de Fin
                </label>
                <input
                  id="hsfin"
                  name="hsfin"
                  type="time"
                  value={form.hsfin}
                  onChange={handleChange}
                  className={styles.input}
                  required
                />
              </div>
            </div>
          </section>

          {/* Sección: Descripción Quirúrgica */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionNumber}>04</span>
              <h2 className={styles.sectionTitle}>Descripción Quirúrgica</h2>
            </div>
            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="preoperatorio">
                Diagnóstico Preoperatorio
              </label>
              <textarea
                id="preoperatorio"
                name="preoperatorio"
                value={form.preoperatorio}
                onChange={handleChange}
                className={styles.textarea}
                rows={3}
                placeholder="Descripción del diagnóstico previo a la cirugía..."
                required
              />
            </div>
            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="procedimientoqx">
                Procedimiento Quirúrgico
              </label>
              <textarea
                id="procedimientoqx"
                name="procedimientoqx"
                value={form.procedimientoqx}
                onChange={handleChange}
                className={styles.textarea}
                rows={4}
                placeholder="Descripción detallada del procedimiento realizado..."
                required
              />
            </div>
            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="hallazgos">
                Hallazgos Intraoperatorios
              </label>
              <textarea
                id="hallazgos"
                name="hallazgos"
                value={form.hallazgos}
                onChange={handleChange}
                className={styles.textarea}
                rows={3}
                placeholder="Hallazgos durante la cirugía..."
              />
            </div>
            <div className={styles.fieldFull}>
              <label className={styles.label} htmlFor="posoperatorio">
                Indicaciones Posoperatorias
              </label>
              <textarea
                id="posoperatorio"
                name="posoperatorio"
                value={form.posoperatorio}
                onChange={handleChange}
                className={styles.textarea}
                rows={3}
                placeholder="Indicaciones y cuidados post operatorios..."
              />
            </div>
          </section>

          {/* Status messages */}
          {status === "saving" && (
            <div className={styles.alertInfo}>
              <span className={styles.alertIcon}>⏳</span>
              Guardando registro y generando PDF...
            </div>
          )}
          {status === "success" && (
            <div className={styles.alertSuccess}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <span className={styles.alertIcon}>✓</span>
                  Registro guardado correctamente en Firebase.
                  {firebaseId && <span style={{ fontSize: "0.85rem", marginLeft: "0.5rem" }}>ID: {firebaseId}</span>}
                </div>
                {pdfUrl && (
                  <div className={styles.pdfActions} style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" className={styles.btnSecondary} onClick={openPdf}>
                      📄 Abrir PDF
                    </button>
                    <button type="button" className={styles.btnPrimary} onClick={downloadPdf}>
                      ⬇️ Descargar PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          {status === "error" && (
            <div className={styles.alertError}>
              <span className={styles.alertIcon}>✕</span>
              {errorMsg}
            </div>
          )}
          {pdfError && (
            <div className={styles.alertError}>
              <span className={styles.alertIcon}>⚠️</span>
              {pdfError}
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <button
              type="button"
              onClick={handleReset}
              className={styles.btnSecondary}
              disabled={status === "saving"}
            >
              Limpiar
            </button>
            <button
              type="submit"
              className={styles.btnPrimary}
              disabled={status === "saving"}
            >
              {status === "saving" ? (
                <>
                  <span className={styles.spinner} />
                  Guardando...
                </>
              ) : (
                "Guardar Registro y Generar PDF"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
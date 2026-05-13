"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";  // ← Importar useRouter
import { PDFDocument } from "pdf-lib";
import styles from "../cx-common.module.css";
// ─────────────────────────────────────────────
//  CONSTANTES
// ─────────────────────────────────────────────
const MAPPING_URL = "/mappings/cd-campos_fields_rects.json";
const TEMPLATE_FRENTE_URL = "/templates/FRENTE-CX.pdf";
const TEMPLATE_DORSO_URL  = "/templates/DORSO-CX.pdf";
const DB_URL = "https://datos-clini-default-rtdb.firebaseio.com/cirugias";

const DOCTORES = [
    "BRARDA AGUSTIN",
    "CANAGLIA GUSTAVO",
    "CIANCIOSI SEBASTIAN",
    "DEL PUERTO RODRIGO",
    "GIMENEZ MARTIN",
    "PERTUS DIEGO",
].sort();

// ─────────────────────────────────────────────
//  HELPERS (CORREGIDOS PARA FECHAS LOCALES)
// ─────────────────────────────────────────────
function safeUpper(v) {
    return v === null || v === undefined ? "" : String(v).toUpperCase();
}

function formatNumberWithThousands(value) {
    if (!value && value !== 0) return "";
    const n = String(value).replace(/[^\d]/g, "");
    return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : "";
}

function parseFormattedNumber(v) {
    return v ? String(v).replace(/\./g, "") : "";
}

function fmtDate(iso) {
    if (!iso) return "—";
    const parts = iso.split('-');
    if (parts.length === 3) {
        const [year, month, day] = parts;
        return new Date(year, month-1, day).toLocaleDateString("es-AR");
    }
    return new Date(iso).toLocaleDateString("es-AR");
}

function fmtDateTime(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
}

function daysUntil(iso) {
    if (!iso) return null;
    const parts = iso.split('-');
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    const fecha = new Date(year, month-1, day);
    const hoy = new Date();
    hoy.setHours(0,0,0,0);
    fecha.setHours(0,0,0,0);
    return Math.round((fecha - hoy) / 86400000);
}

function getDoctor(cx) {
    if (cx.doctor) return cx.doctor;
    if (cx.formulario) {
        const k = Object.keys(cx.formulario).find(k =>
            k.toLowerCase().includes("doctor") ||
            k.toLowerCase().includes("dr") ||
            k === "nombre-dr"
        );
        return k ? cx.formulario[k] : "";
    }
    return "";
}

function preopStatus(cx) {
    const ecg = !!(cx.ecgProfesional && cx.ecgFecha);
    const lab = !!(cx.labProfesional && cx.labFecha);
    return { ecg, lab, completo: ecg && lab };
}

function generateSafeFilename(str) {
    return (str || "Paciente")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9\s-]/g, "")
        .replace(/\s+/g, "-").replace(/-+/g, "-").trim().toUpperCase();
}

// ─────────────────────────────────────────────
//  PDF DESDE PROGRAMADAS (CON MAPPING)
// ─────────────────────────────────────────────
async function buildPdfFromCX(cx, templateUrl, mapping, canonical) {
    if (!mapping || !canonical) throw new Error("Mapping no cargado");

    const templateBytes = await fetch(templateUrl, { cache: "no-store" }).then(r => {
        if (!r.ok) throw new Error(`Error cargando template (${r.status})`);
        return r.arrayBuffer();
    });
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const pdfForm = pdfDoc.getForm();

    const trySetText = (fieldName, value) => {
        const v = safeUpper((value ?? '').toString()).trim();
        if (!v) return;
        try { pdfForm.getTextField(fieldName).setText(v); } catch { }
    };
    const tryCheck = (fieldName, shouldCheck) => {
        if (!shouldCheck) return;
        try { pdfForm.getCheckBox(fieldName).check(); } catch { }
    };

    const ap = cx.pacienteDatos?.apellido || '';
    const nom = cx.pacienteDatos?.nombre || '';
    const nombresPaciente = [ap, nom].filter(Boolean).join(' ').trim();
    const edadValue = cx.pacienteDatos?.edad ? `${cx.pacienteDatos.edad} años` : '';
    const doctorRaw = getDoctor(cx);
    const doctorPrint = doctorRaw && !/^dr\.?\s/i.test(doctorRaw) ? `Dr. ${doctorRaw}` : doctorRaw;

    trySetText('apellido-paciente', ap);
    trySetText('nombre-paciente', nom);
    trySetText('nombres-paciente', nombresPaciente);
    trySetText('edad', edadValue);
    trySetText('edad-paciente', edadValue);
    trySetText('servicio', 'PISO');
    trySetText('nombre-dr', doctorPrint);
    tryCheck('masculino-paciente', cx.pacienteDatos?.sexo === 'M');
    tryCheck('femenino-paciente', cx.pacienteDatos?.sexo === 'F');

    const form = cx.formulario || {};
    for (const [canonName, value] of Object.entries(form)) {
        const internals = canonical.canonicalToInternal[canonName] || [];
        const isBtn = mapping[internals[0]]?.[0]?.field_type === '/Btn';
        for (const internal of internals) {
            if (isBtn) tryCheck(internal, !!value);
            else trySetText(internal, value);
        }
        if (isBtn) tryCheck(canonName, !!value);
        else trySetText(canonName, value);
    }

    pdfForm.flatten();
    return await pdfDoc.save();
}

async function downloadCxPdf(cx, type, mapping, canonical) {
    if (!mapping || !canonical) {
        alert("Los datos de mapeo aún no están listos. Intenta de nuevo en unos segundos.");
        return;
    }
    const url = type === "Frente" ? TEMPLATE_FRENTE_URL : TEMPLATE_DORSO_URL;
    try {
        const bytes = await buildPdfFromCX(cx, url, mapping, canonical);
        const blob = new Blob([bytes], { type: "application/pdf" });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const name = generateSafeFilename(`${cx.pacienteDatos?.apellido || ""} ${cx.pacienteDatos?.nombre || ""}`.trim());
        a.href = href;
        a.download = `${name}-${type}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(href), 1200);
    } catch (err) {
        console.error(err);
        alert("Error al generar el PDF");
    }
}

// ─────────────────────────────────────────────
//  MODALES (sin cambios)
// ─────────────────────────────────────────────
function ModalEstudio({ cx, estudio, onSave, onCancel }) {
    const [profesional, setProfesional] = useState(estudio === 'ecg' ? cx.ecgProfesional || "" : cx.labProfesional || "");
    const [fecha, setFecha] = useState(estudio === 'ecg' ? (cx.ecgFecha || "") : (cx.labFecha || ""));
    const opciones = estudio === 'ecg'
        ? ["Percara Gonzalo", "Capovila Braulio"]
        : ["Marmol Carlos", "Confalonieri Maria"];
    const titulo = estudio === 'ecg' ? "ECG Preoperatorio" : "Laboratorio";
    const emoji = estudio === 'ecg' ? "🫀" : "🧪";

    const handleSave = () => {
        if (!profesional && !fecha) {
            onCancel();
            return;
        }
        onSave(profesional, fecha);
    };

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <span className={styles.modalIcon}>{emoji}</span>
                    <h2>{titulo}</h2>
                </div>
                <div className={styles.modalBody}>
                    <label className={styles.modalLabel}>
                        Profesional
                        <select className={styles.modalInput} value={profesional} onChange={e => setProfesional(e.target.value)}>
                            <option value="">— Seleccionar —</option>
                            {opciones.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                    </label>
                    <label className={styles.modalLabel}>
                        Fecha
                        <input type="date" className={styles.modalInput} value={fecha} onChange={e => setFecha(e.target.value)} />
                    </label>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
                    <button className={styles.btnPrimary} onClick={handleSave}>Guardar</button>
                </div>
            </div>
        </div>
    );
}

function ModalRealizacion({ cx, onConfirm, onCancel }) {
    const hoy = new Date().toISOString().slice(0, 16);
    const [fechaRealizacion, setFechaRealizacion] = useState(hoy);

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <span className={styles.modalIcon}>✅</span>
                    <h2>Confirmar cirugía realizada</h2>
                </div>
                <div className={styles.modalBody}>
                    <p className={styles.modalPatient}>
                        <strong>{cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}</strong>
                    </p>
                    <p className={styles.modalCx}>{cx.formulario?.cx || "—"}</p>
                    <label className={styles.modalLabel}>
                        Fecha y hora de realización
                        <input
                            type="datetime-local"
                            value={fechaRealizacion}
                            onChange={e => setFechaRealizacion(e.target.value)}
                            className={styles.modalInput}
                        />
                    </label>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
                    <button className={styles.btnSuccess} onClick={() => onConfirm(fechaRealizacion)}>
                        Confirmar como realizada
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModalEdicion({ cx, onSave, onCancel }) {
    const [form, setForm] = useState({
        fechaEstimada:  cx.fechaEstimada  || "",
        tipoCirugia:    cx.formulario?.cx || cx.tipoCirugia || "",
        doctor:         getDoctor(cx)     || "",
        ecgProfesional: cx.ecgProfesional || "",
        ecgFecha:       cx.ecgFecha       || "",
        labProfesional: cx.labProfesional || "",
        labFecha:       cx.labFecha       || "",
    });

    const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

    return (
        <div className={styles.overlay} onClick={onCancel}>
            <div className={styles.modal} style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <span className={styles.modalIcon}>✏️</span>
                    <h2>Editar cirugía</h2>
                </div>
                <div className={styles.modalBody}>
                    <p className={styles.modalPatient}>
                        <strong>{cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}</strong>
                        {cx.pacienteDatos?.dni && <span className={styles.dniBadge}>DNI {formatNumberWithThousands(cx.pacienteDatos.dni)}</span>}
                    </p>

                    <div className={styles.editGrid}>
                        <label className={styles.editLabel}>
                            Fecha estimada
                            <input type="date" className={styles.modalInput} value={form.fechaEstimada}
                                onChange={e => set("fechaEstimada", e.target.value)} />
                        </label>
                        <label className={styles.editLabel} style={{ gridColumn: "1/-1" }}>
                            Tipo de cirugía
                            <input type="text" className={styles.modalInput} value={form.tipoCirugia}
                                onChange={e => set("tipoCirugia", e.target.value)}
                                placeholder="Ej: Colecistectomía laparoscópica" />
                        </label>
                        <label className={styles.editLabel} style={{ gridColumn: "1/-1" }}>
                            Médico cirujano
                            <select className={styles.modalInput} value={form.doctor}
                                onChange={e => set("doctor", e.target.value)}>
                                <option value="">— Seleccionar —</option>
                                {DOCTORES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </label>

                        <div className={styles.preopGroup}>
                            <p className={styles.preopTitle}>🫀 ECG Preoperatorio</p>
                            <label className={styles.editLabel}>
                                Profesional
                                <select className={styles.modalInput} value={form.ecgProfesional}
                                    onChange={e => set("ecgProfesional", e.target.value)}>
                                    <option value="">— Seleccionar —</option>
                                    <option value="Percara Gonzalo">Percara Gonzalo</option>
                                    <option value="Capovila Braulio">Capovila Braulio</option>
                                </select>
                            </label>
                            <label className={styles.editLabel}>
                                Fecha
                                <input type="date" className={styles.modalInput} value={form.ecgFecha}
                                    onChange={e => set("ecgFecha", e.target.value)} />
                            </label>
                        </div>

                        <div className={styles.preopGroup}>
                            <p className={styles.preopTitle}>🧪 Laboratorio</p>
                            <label className={styles.editLabel}>
                                Profesional
                                <select className={styles.modalInput} value={form.labProfesional}
                                    onChange={e => set("labProfesional", e.target.value)}>
                                    <option value="">— Seleccionar —</option>
                                    <option value="Marmol Carlos">Marmol Carlos</option>
                                    <option value="Confalonieri Maria">Confalonieri Maria</option>
                                </select>
                            </label>
                            <label className={styles.editLabel}>
                                Fecha
                                <input type="date" className={styles.modalInput} value={form.labFecha}
                                    onChange={e => set("labFecha", e.target.value)} />
                            </label>
                        </div>
                    </div>
                </div>
                <div className={styles.modalFooter}>
                    <button className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
                    <button className={styles.btnPrimary} onClick={() => onSave(form)}>
                        Guardar cambios
                    </button>
                </div>
            </div>
        </div>
    );
}

function ModalFicha({ cx, mapping, canonical, onClose }) {
    const dr     = getDoctor(cx);
    const preop  = preopStatus(cx);
    const dias   = daysUntil(cx.fechaEstimada);

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={`${styles.modal} ${styles.fichaModal}`} onClick={e => e.stopPropagation()}>
                <div className={styles.fichaHeader}>
                    <div>
                        <h2 className={styles.fichaTitle}>FICHA QUIRÚRGICA</h2>
                        <p className={styles.fichaSubtitle}>Programación preoperatoria</p>
                    </div>
                    <div className={styles.fichaActions}>
                        <button className={styles.btnSecondary} onClick={onClose}>✕</button>
                    </div>
                </div>

                <div className={styles.fichaBody} id="fichaImprimir">
                    <div className={styles.fichaSection}>
                        <h3>Paciente</h3>
                        <div className={styles.fichaRow}>
                            <span className={styles.fichaKey}>Nombre completo</span>
                            <span className={styles.fichaVal}>
                                {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
                            </span>
                        </div>
                        {cx.pacienteDatos?.dni && (
                            <div className={styles.fichaRow}>
                                <span className={styles.fichaKey}>DNI</span>
                                <span className={styles.fichaVal}>{formatNumberWithThousands(cx.pacienteDatos.dni)}</span>
                            </div>
                        )}
                        {cx.pacienteDatos?.edad && (
                            <div className={styles.fichaRow}>
                                <span className={styles.fichaKey}>Edad</span>
                                <span className={styles.fichaVal}>{cx.pacienteDatos.edad} años</span>
                            </div>
                        )}
                    </div>

                    <div className={styles.fichaSection}>
                        <h3>Cirugía</h3>
                        <div className={styles.fichaRow}>
                            <span className={styles.fichaKey}>Procedimiento</span>
                            <span className={styles.fichaVal}>{cx.formulario?.cx || "—"}</span>
                        </div>
                        <div className={styles.fichaRow}>
                            <span className={styles.fichaKey}>Cirujano</span>
                            <span className={styles.fichaVal}>{dr ? `Dr. ${dr}` : "—"}</span>
                        </div>
                        <div className={styles.fichaRow}>
                            <span className={styles.fichaKey}>Fecha estimada</span>
                            <span className={styles.fichaVal}>
                                {fmtDate(cx.fechaEstimada)}
                                {dias !== null && dias >= 0 && dias <= 7 && (
                                    <span className={styles.diasBadge}>
                                        {dias === 0 ? "HOY" : `en ${dias} día${dias > 1 ? "s" : ""}`}
                                    </span>
                                )}
                            </span>
                        </div>
                    </div>

                    <div className={styles.fichaSection}>
                        <h3>Preoperatorio</h3>
                        <div className={styles.fichaRow}>
                            <span className={styles.fichaKey}>🫀 ECG</span>
                            <span className={styles.fichaVal}>
                                {cx.ecgProfesional
                                    ? <>{cx.ecgProfesional} — {fmtDate(cx.ecgFecha)}</>
                                    : <span className={styles.faltante}>PENDIENTE</span>}
                            </span>
                        </div>
                        <div className={styles.fichaRow}>
                            <span className={styles.fichaKey}>🧪 Laboratorio</span>
                            <span className={styles.fichaVal}>
                                {cx.labProfesional
                                    ? <>{cx.labProfesional} — {fmtDate(cx.labFecha)}</>
                                    : <span className={styles.faltante}>PENDIENTE</span>}
                            </span>
                        </div>
                        <div className={`${styles.fichaRow} ${styles.fichaStatus}`}>
                            <span className={styles.fichaKey}>Estado preop</span>
                            <span className={preop.completo ? styles.statusOk : styles.statusWarn}>
                                {preop.completo ? "✅ COMPLETO" : "⚠️ INCOMPLETO"}
                            </span>
                        </div>
                    </div>

                    <div className={styles.fichaPdfButtons}>
                        <button className={styles.btnPdfFrente}
                            onClick={() => downloadCxPdf(cx, "Frente", mapping, canonical)}>
                            ↓ PDF Frente
                        </button>
                        <button className={styles.btnPdfDorso}
                            onClick={() => downloadCxPdf(cx, "Dorso", mapping, canonical)}>
                            ↓ PDF Dorso
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ModalListaDia({ cirugias, onClose }) {
    const hoy = new Date().toISOString().slice(0, 10);
    const [fecha, setFecha] = useState(hoy);

    const lista = cirugias.filter(cx => {
        if (!cx.fechaEstimada || cx.realizada) return false;
        return cx.fechaEstimada.slice(0, 10) === fecha;
    });

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={`${styles.modal} ${styles.fichaModal}`} onClick={e => e.stopPropagation()}>
                <div className={styles.fichaHeader}>
                    <div>
                        <h2 className={styles.fichaTitle}>LISTA QUIRÚRGICA</h2>
                        <p className={styles.fichaSubtitle}>Programación del día</p>
                    </div>
                    <div className={styles.fichaActions}>
                        <button className={styles.btnPrint} onClick={() => window.print()}>🖨️ Imprimir</button>
                        <button className={styles.btnSecondary} onClick={onClose}>✕</button>
                    </div>
                </div>
                <div className={styles.fichaBody}>
                    <label className={styles.editLabel} style={{ marginBottom: 16 }}>
                        Fecha a imprimir
                        <input type="date" className={styles.modalInput}
                            value={fecha} onChange={e => setFecha(e.target.value)} />
                    </label>

                    {lista.length === 0 ? (
                        <div className={styles.listaVacia}>No hay cirugías programadas para este día.</div>
                    ) : (
                        <div className={styles.listaTable}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Paciente</th>
                                        <th>Cirugía</th>
                                        <th>Cirujano</th>
                                        <th>Preop</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.map((cx, i) => {
                                        const preop = preopStatus(cx);
                                        return (
                                            <tr key={cx.id}>
                                                <td>{i + 1}</td>
                                                <td>
                                                    <strong>{cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}</strong>
                                                    {cx.pacienteDatos?.dni && <div style={{ fontSize: 11, opacity: .6 }}>DNI {formatNumberWithThousands(cx.pacienteDatos.dni)}</div>}
                                                </td>
                                                <td>{cx.formulario?.cx || "—"}</td>
                                                <td>{getDoctor(cx) || "—"}</td>
                                                <td>{preop.completo ? "✅" : "⚠️"}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function CirugiaCard({ cx, onRealizar, onEditar, onEliminar, onVerFicha, onEstudioClick, onDownloadFrente, mapping, canonical }) {
    const dr    = getDoctor(cx);
    const preop = preopStatus(cx);
    const dias  = daysUntil(cx.fechaEstimada);
    const esHoy     = dias === 0;
    const esMañana  = dias === 1;
    const esProximo = dias !== null && dias >= 0 && dias <= 3;

    let urgencyClass = "";
    if (esHoy)    urgencyClass = styles.cardHoy;
    else if (esMañana) urgencyClass = styles.cardMañana;
    else if (esProximo) urgencyClass = styles.cardProximo;

    return (
        <div className={`${styles.cxCard} ${urgencyClass}`}>
            {esHoy && <div className={styles.urgencyBanner}>HOY</div>}
            {esMañana && <div className={`${styles.urgencyBanner} ${styles.bannerMañana}`}>MAÑANA</div>}

            <div className={styles.cardTop}>
                <div className={styles.cardPatient}>
                    <span className={styles.cardPatientName}>
                        {cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}
                    </span>
                    {cx.pacienteDatos?.dni && (
                        <span className={styles.dniBadge}>DNI {formatNumberWithThousands(cx.pacienteDatos.dni)}</span>
                    )}
                </div>
                {!preop.completo && (
                    <span className={styles.alertBadge} title="Preoperatorio incompleto">
                        ⚠️ Preop incompleto
                    </span>
                )}
            </div>

            <div className={styles.cardCx}>{cx.formulario?.cx || "—"}</div>

            <div className={styles.cardMeta}>
                <span className={styles.metaItem}>
                    <span className={styles.metaIcon}>👨‍⚕️</span>
                    {dr ? `Dr. ${dr}` : "Sin médico"}
                </span>
                <span className={styles.metaItem}>
                    <span className={styles.metaIcon}>📅</span>
                    {fmtDate(cx.fechaEstimada)}
                    {dias !== null && dias >= 0 && (
                        <span className={`${styles.diasChip} ${esHoy ? styles.chipHoy : esProximo ? styles.chipProximo : ""}`}>
                            {dias === 0 ? "Hoy" : `${dias}d`}
                        </span>
                    )}
                </span>
            </div>

            <div className={styles.cardPreop}>
                <div 
                    className={`${styles.preopItem} ${preop.ecg ? styles.preopOk : styles.preopWarn} ${styles.clickable}`}
                    onClick={() => onEstudioClick(cx, 'ecg')}
                >
                    <span>🫀 ECG</span>
                    {preop.ecg
                        ? <span>{cx.ecgProfesional} · {fmtDate(cx.ecgFecha)}</span>
                        : <span>Pendiente</span>}
                </div>
                <div 
                    className={`${styles.preopItem} ${preop.lab ? styles.preopOk : styles.preopWarn} ${styles.clickable}`}
                    onClick={() => onEstudioClick(cx, 'lab')}
                >
                    <span>🧪 Lab</span>
                    {preop.lab
                        ? <span>{cx.labProfesional} · {fmtDate(cx.labFecha)}</span>
                        : <span>Pendiente</span>}
                </div>
            </div>

            <div className={styles.cardActions}>
                <button className={styles.actionPdf} onClick={() => onDownloadFrente(cx)}>📄 PDF</button>
                <button className={styles.actionView} onClick={() => onVerFicha(cx)}>📋 Ficha</button>
                <button className={styles.actionEdit} onClick={() => onEditar(cx)}>✏️ Editar</button>
                <button className={styles.actionDone} onClick={() => onRealizar(cx)}>✅ Realizada</button>
                <button className={styles.actionDelete} onClick={() => onEliminar(cx.id)}>🗑</button>
            </div>
        </div>
    );
}

function StatsBar({ cirugias }) {
    const pendientes = cirugias.filter(c => !c.realizada);
    const hoy        = new Date().toISOString().slice(0, 10);
    const deHoy      = pendientes.filter(c => c.fechaEstimada?.slice(0,10) === hoy);
    const sinPreop   = pendientes.filter(c => !preopStatus(c).completo);
    const realizadas = cirugias.filter(c => c.realizada);

    return (
        <div className={styles.statsBar}>
            <div className={styles.statCard}>
                <span className={styles.statNum}>{pendientes.length}</span>
                <span className={styles.statLabel}>Programadas</span>
            </div>
            <div className={`${styles.statCard} ${styles.statHoy}`}>
                <span className={styles.statNum}>{deHoy.length}</span>
                <span className={styles.statLabel}>Hoy</span>
            </div>
            <div className={`${styles.statCard} ${styles.statWarn}`}>
                <span className={styles.statNum}>{sinPreop.length}</span>
                <span className={styles.statLabel}>Sin preop completo</span>
            </div>
            <div className={`${styles.statCard} ${styles.statDone}`}>
                <span className={styles.statNum}>{realizadas.length}</span>
                <span className={styles.statLabel}>Realizadas</span>
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
//  PÁGINA PRINCIPAL
// ─────────────────────────────────────────────
export default function CirugiasProgramadasPage() {
    const router = useRouter();  // ← hook para navegación
    const [tab, setTab]         = useState("programadas");
    const [cirugias, setCirugias] = useState([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState("");
    const [search, setSearch]     = useState("");
    const [filterFechaDesde, setFilterFechaDesde] = useState("");
    const [filterFechaHasta, setFilterFechaHasta] = useState("");
    const [filterDoctor, setFilterDoctor]         = useState("");
    const [filterSoloIncompleto, setFilterSoloIncompleto] = useState(false);

    const [modalRealizar, setModalRealizar] = useState(null);
    const [modalEditar,   setModalEditar]   = useState(null);
    const [modalFicha,    setModalFicha]    = useState(null);
    const [modalListaDia, setModalListaDia] = useState(false);
    const [modalEstudio,  setModalEstudio]  = useState(null);

    const [mapping, setMapping] = useState(null);
    const [canonical, setCanonical] = useState(null);

    // ── Fetch mapping ──────────────────────────────
    useEffect(() => {
        fetch(MAPPING_URL, { cache: "no-store" })
            .then(res => {
                if (!res.ok) throw new Error("Error cargando mapping");
                return res.json();
            })
            .then(data => {
                setMapping(data);
                const canonicalToInternal = {};
                const internalToCanonical = {};
                for (const internalName of Object.keys(data)) {
                    let canon = internalName
                        .toLowerCase()
                        .trim()
                        .replace(/\s+/g, '-')
                        .replace(/[()]/g, '')
                        .replace(/__\d+$/g, '')
                        .replace(/-\d+$/g, '');
                    internalToCanonical[internalName] = canon;
                    if (!canonicalToInternal[canon]) canonicalToInternal[canon] = [];
                    canonicalToInternal[canon].push(internalName);
                }
                for (const k of Object.keys(canonicalToInternal)) {
                    canonicalToInternal[k] = Array.from(new Set(canonicalToInternal[k])).sort();
                }
                setCanonical({ canonicalToInternal, internalToCanonical });
            })
            .catch(err => {
                console.error("Error cargando mapping:", err);
                setError("No se pudo cargar el mapeo de campos. La generación de PDF puede no funcionar.");
            });
    }, []);

    // ── Fetch cirugías ─────────────────────────────
    const fetchCirugias = async () => {
        try {
            setLoading(true);
            const res  = await fetch(`${DB_URL}.json`);
            if (!res.ok) throw new Error("Error al cargar cirugías");
            const data = await res.json();
            setCirugias(data ? Object.entries(data).map(([id, v]) => ({ id, ...v })) : []);
        } catch (err) {
            setError("No se pudieron cargar las cirugías.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCirugias(); }, []);

    // ── Acciones ───────────────────────────────────
    const marcarRealizada = async (cx, fechaRealizacion) => {
        await fetch(`${DB_URL}/${cx.id}.json`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ realizada: true, fechaRealizacion }),
        });
        setModalRealizar(null);
        fetchCirugias();
    };

    const eliminarCirugia = async (id) => {
        if (!confirm("¿Eliminar permanentemente esta cirugía? Esta acción no se puede deshacer.")) return;
        await fetch(`${DB_URL}/${id}.json`, { method: "DELETE" });
        fetchCirugias();
    };

    const guardarEdicion = async (cx, formEdit) => {
        const cirugiaActual = cirugias.find(c => c.id === cx.id);
        const nuevoFormulario = { ...(cirugiaActual?.formulario || {}) };

        if (formEdit.tipoCirugia) nuevoFormulario.cx = formEdit.tipoCirugia;
        else delete nuevoFormulario.cx;

        let doctorKey = Object.keys(nuevoFormulario).find(k =>
            k.toLowerCase().includes("doctor") ||
            k.toLowerCase().includes("dr") ||
            k === "nombre-dr"
        ) || "nombre-dr";
        nuevoFormulario[doctorKey] = formEdit.doctor;

        const updates = {
            fechaEstimada:  formEdit.fechaEstimada,
            doctor:         formEdit.doctor,
            ecgProfesional: formEdit.ecgProfesional,
            ecgFecha:       formEdit.ecgFecha,
            labProfesional: formEdit.labProfesional,
            labFecha:       formEdit.labFecha,
            formulario:     nuevoFormulario,
            updatedAt:      Date.now(),
        };

        await fetch(`${DB_URL}/${cx.id}.json`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
        });
        setModalEditar(null);
        fetchCirugias();
    };

    const guardarEstudio = async (cx, tipo, profesional, fecha) => {
        const updates = {
            [`${tipo}Profesional`]: profesional,
            [`${tipo}Fecha`]: fecha,
            updatedAt: Date.now(),
        };
        await fetch(`${DB_URL}/${cx.id}.json`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
        });
        setModalEstudio(null);
        fetchCirugias();
    };

    // ── Filtros ────────────────────────────────────
    const applyFilters = (list) => {
        return list.filter(cx => {
            const dr   = getDoctor(cx);
            const full = `${cx.pacienteDatos?.apellido || ""} ${cx.pacienteDatos?.nombre || ""} ${cx.pacienteDatos?.dni || ""} ${cx.formulario?.cx || ""}`.toLowerCase();
            if (search && !full.includes(search.toLowerCase())) return false;
            if (filterDoctor && dr !== filterDoctor) return false;
            if (filterSoloIncompleto && preopStatus(cx).completo) return false;
            return true;
        });
    };

    const cirugiasPendientes = useMemo(() => {
        let list = cirugias.filter(cx => !cx.realizada);
        list = list.filter(cx => {
            if (!cx.fechaEstimada) return false;
            if (filterFechaDesde && cx.fechaEstimada < filterFechaDesde) return false;
            if (filterFechaHasta && cx.fechaEstimada > filterFechaHasta) return false;
            return true;
        });
        list = applyFilters(list);
        list.sort((a, b) => a.fechaEstimada.localeCompare(b.fechaEstimada));
        return list;
    }, [cirugias, search, filterDoctor, filterFechaDesde, filterFechaHasta, filterSoloIncompleto]);

    const cirugiasRealizadas = useMemo(() => {
        let list = cirugias.filter(cx => cx.realizada);
        list = list.filter(cx => {
            if (!cx.fechaRealizacion) return false;
            const fecha = cx.fechaRealizacion.slice(0,10);
            if (filterFechaDesde && fecha < filterFechaDesde) return false;
            if (filterFechaHasta && fecha > filterFechaHasta) return false;
            return true;
        });
        list = applyFilters(list);
        list.sort((a, b) => (b.fechaRealizacion || "").localeCompare(a.fechaRealizacion || ""));
        return list;
    }, [cirugias, search, filterDoctor, filterFechaDesde, filterFechaHasta, filterSoloIncompleto]);

    const limpiarFiltros = () => {
        setSearch(""); setFilterFechaDesde(""); setFilterFechaHasta("");
        setFilterDoctor(""); setFilterSoloIncompleto(false);
    };

    if (loading) return (
        <div className={styles.page}>
            <div className={styles.loadingCenter}>
                <div className={styles.spinner} />
                <p>Cargando cirugías…</p>
            </div>
        </div>
    );

    return (
        <div className={styles.page}>
            {/* ========== BARRA DE NAVEGACIÓN (igual a la de solicitudes) ========== */}
            <div className={styles.pageHeader}>
                <div className={styles.tabsContainer}>
                    <button
                        className={styles.tabButton}
                        onClick={() => router.push("/admin/cx")}
                    >
                        📋 Formulario
                    </button>
                    <button
                        className={styles.tabButton}
                        onClick={() => router.push("/admin/cx/solicitudes")}
                    >
                        📝 Solicitudes
                    </button>
                    <button
                        className={`${styles.tabButton} ${styles.activeTab}`}
                    >
                        📅 Programadas
                    </button>
                </div>
            </div>

            {/* Modales */}
            {modalRealizar && (
                <ModalRealizacion
                    cx={modalRealizar}
                    onConfirm={(fecha) => marcarRealizada(modalRealizar, fecha)}
                    onCancel={() => setModalRealizar(null)}
                />
            )}
            {modalEditar && (
                <ModalEdicion
                    cx={modalEditar}
                    onSave={(form) => guardarEdicion(modalEditar, form)}
                    onCancel={() => setModalEditar(null)}
                />
            )}
            {modalFicha && (
                <ModalFicha
                    cx={modalFicha}
                    mapping={mapping}
                    canonical={canonical}
                    onClose={() => setModalFicha(null)}
                />
            )}
            {modalListaDia && (
                <ModalListaDia cirugias={cirugias} onClose={() => setModalListaDia(false)} />
            )}
            {modalEstudio && (
                <ModalEstudio
                    cx={modalEstudio.cx}
                    estudio={modalEstudio.tipo}
                    onSave={(prof, fecha) => guardarEstudio(modalEstudio.cx, modalEstudio.tipo, prof, fecha)}
                    onCancel={() => setModalEstudio(null)}
                />
            )}

            <div className={styles.container}>
                {/* Header original (título y botón lista del día) */}
                <div className={styles.pageHeader}>
                    <div>
                        <h1 className={styles.pageTitle}>Gestión Quirúrgica</h1>
                        <p className={styles.pageSubtitle}>Programación, seguimiento e historial</p>
                    </div>
                    <div className={styles.headerActions}>
                        <button className={styles.btnListaDia} onClick={() => setModalListaDia(true)}>
                            🗓 Lista del día
                        </button>
                    </div>
                </div>

                {error && <div className={styles.errorBanner}>{error}</div>}

                <StatsBar cirugias={cirugias} />

                {/* Tabs internas (Programadas / Historial) */}
                <div className={styles.tabs}>
                    <button className={`${styles.tab} ${tab === "programadas" ? styles.tabActive : ""}`}
                        onClick={() => setTab("programadas")}>
                        📅 Programadas
                        <span className={styles.tabCount}>{cirugias.filter(c => !c.realizada).length}</span>
                    </button>
                    <button className={`${styles.tab} ${tab === "historial" ? styles.tabActive : ""}`}
                        onClick={() => setTab("historial")}>
                        📋 Historial
                        <span className={styles.tabCount}>{cirugias.filter(c => c.realizada).length}</span>
                    </button>
                </div>

                {/* Filtros */}
                <div className={styles.filters}>
                    <div className={styles.searchWrapper}>
                        <span className={styles.searchIcon}>🔍</span>
                        <input
                            type="text"
                            placeholder="Buscar por paciente, DNI o cirugía…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className={styles.searchInput}
                        />
                        {search && (
                            <button className={styles.clearSearch} onClick={() => setSearch("")}>✕</button>
                        )}
                    </div>

                    <div className={styles.filterRow}>
                        <label className={styles.filterLabel}>
                            Desde
                            <input type="date" className={styles.filterInput}
                                value={filterFechaDesde} onChange={e => setFilterFechaDesde(e.target.value)} />
                        </label>
                        <label className={styles.filterLabel}>
                            Hasta
                            <input type="date" className={styles.filterInput}
                                value={filterFechaHasta} onChange={e => setFilterFechaHasta(e.target.value)} />
                        </label>
                        <label className={styles.filterLabel}>
                            Médico
                            <select className={styles.filterInput}
                                value={filterDoctor} onChange={e => setFilterDoctor(e.target.value)}>
                                <option value="">Todos</option>
                                {DOCTORES.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </label>
                        {tab === "programadas" && (
                            <label className={styles.filterCheckLabel}>
                                <input type="checkbox" checked={filterSoloIncompleto}
                                    onChange={e => setFilterSoloIncompleto(e.target.checked)} />
                                Solo preop incompleto
                            </label>
                        )}
                        <button className={styles.clearBtn} onClick={limpiarFiltros}>Limpiar</button>
                    </div>
                </div>

                {/* PROGRAMADAS */}
                {tab === "programadas" && (
                    cirugiasPendientes.length === 0
                        ? <div className={styles.empty}>No hay cirugías programadas con los filtros aplicados.</div>
                        : <div className={styles.cardsGrid}>
                            {cirugiasPendientes.map(cx => (
                                <CirugiaCard
                                    key={cx.id}
                                    cx={cx}
                                    onRealizar={(c) => setModalRealizar(c)}
                                    onEditar={(c)   => setModalEditar(c)}
                                    onEliminar={eliminarCirugia}
                                    onVerFicha={(c) => setModalFicha(c)}
                                    onEstudioClick={(c, tipo) => setModalEstudio({ cx: c, tipo })}
                                    onDownloadFrente={(c) => downloadCxPdf(c, "Frente", mapping, canonical)}
                                    mapping={mapping}
                                    canonical={canonical}
                                />
                            ))}
                        </div>
                )}

                {/* HISTORIAL */}
                {tab === "historial" && (
                    cirugiasRealizadas.length === 0
                        ? <div className={styles.empty}>No hay cirugías realizadas con los filtros aplicados.</div>
                        : <div className={styles.tableWrapper}>
                            <table className={styles.table}>
                                <thead>
                                    <tr>
                                        <th>Paciente</th>
                                        <th>Cirugía</th>
                                        <th>Médico</th>
                                        <th>Realizada</th>
                                        <th>ECG</th>
                                        <th>Lab</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cirugiasRealizadas.map(cx => (
                                        <tr key={cx.id}>
                                            <td>
                                                <strong>{cx.pacienteDatos?.apellido} {cx.pacienteDatos?.nombre}</strong>
                                                {cx.pacienteDatos?.dni && <div className={styles.dniSmall}>DNI {formatNumberWithThousands(cx.pacienteDatos.dni)}</div>}
                                            </td>
                                            <td>{cx.formulario?.cx || "—"}</td>
                                            <td>{getDoctor(cx) || "—"}</td>
                                            <td>{fmtDateTime(cx.fechaRealizacion)}</td>
                                            <td>
                                                {cx.ecgProfesional || "—"}
                                                {cx.ecgFecha && <div className={styles.dniSmall}>{fmtDate(cx.ecgFecha)}</div>}
                                            </td>
                                            <td>
                                                {cx.labProfesional || "—"}
                                                {cx.labFecha && <div className={styles.dniSmall}>{fmtDate(cx.labFecha)}</div>}
                                            </td>
                                            <td>
                                                <div className={styles.tableActions}>
                                                    <button className={styles.actionView}  onClick={() => setModalFicha(cx)}>📋</button>
                                                    <button className={styles.actionEdit}  onClick={() => setModalEditar(cx)}>✏️</button>
                                                    <button className={styles.actionDelete} onClick={() => eliminarCirugia(cx.id)}>🗑</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                )}
            </div>
        </div>
    );
}
"use client";
import { useState, useEffect, useMemo } from "react";
import { db } from "@/lib/firebase";
import { ref, push, remove, onValue } from "firebase/database";

/**
 * Plantillas de procedimiento quirúrgico (guardar/reutilizar).
 * Guarda la "base" de un procedimiento para precargar el formulario después.
 *
 * Nodo RTDB: plantillas_qx/{pushId} = {
 *   nombre, procedimientoqx, preoperatorio, posoperatorio, hallazgos,
 *   cirujano, anestesista, primerayudante, segundoayudante, createdAt
 * }
 *
 * Props:
 *  - form: objeto con los valores actuales del formulario (para guardar como plantilla)
 *  - onAplicar(campos): recibe los campos de la plantilla para fusionarlos al form
 *  - onClose()
 */

const CAMPOS = [
    { k: "procedimientoqx", label: "Procedimiento quirúrgico", grupo: "proc" },
    { k: "preoperatorio", label: "Preoperatorio (diagnóstico)", grupo: "proc" },
    { k: "posoperatorio", label: "Posoperatorio (diagnóstico)", grupo: "proc" },
    { k: "hallazgos", label: "Hallazgos", grupo: "proc" },
    { k: "cirujano", label: "Cirujano", grupo: "equipo" },
    { k: "anestesista", label: "Anestesista", grupo: "equipo" },
    { k: "primerayudante", label: "Primer ayudante", grupo: "equipo" },
    { k: "segundoayudante", label: "Segundo ayudante", grupo: "equipo" },
];

const pick = (obj, incluirEquipo) =>
    CAMPOS.reduce((acc, c) => {
        if (c.grupo === "equipo" && !incluirEquipo) return acc;
        const v = obj?.[c.k];
        if (v != null && String(v).trim() !== "") acc[c.k] = v;
        return acc;
    }, {});

export default function PlantillasProcedimientoModal({ form = {}, onAplicar, onClose }) {
    const [plantillas, setPlantillas] = useState([]);
    const [nombre, setNombre] = useState("");
    const [incluirEquipo, setIncluirEquipo] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [busqueda, setBusqueda] = useState("");

    useEffect(() => {
        const r = ref(db, "fojaqx/plantillas");
        return onValue(r, (snap) => {
            const v = snap.val() || {};
            setPlantillas(
                Object.entries(v)
                    .map(([id, val]) => ({ id, ...val }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            );
        });
    }, []);

    const filtradas = useMemo(() => {
        const q = busqueda.trim().toLowerCase();
        if (!q) return plantillas;
        return plantillas.filter((p) => (p.nombre || "").toLowerCase().includes(q));
    }, [plantillas, busqueda]);

    // ¿Qué campos del formulario actual tienen contenido para guardar?
    const camposConDatos = pick(form, true);
    const hayDatos = Object.keys(pick(form, false)).length > 0; // al menos un campo de procedimiento

    const guardar = async () => {
        if (!nombre.trim() || !hayDatos) return;
        setGuardando(true);
        try {
            await push(ref(db, "fojaqx/plantillas"), {
                nombre: nombre.trim(),
                ...pick(form, incluirEquipo),
                createdAt: Date.now(),
            });
            setNombre("");
            setIncluirEquipo(false);
        } catch (e) { console.error(e); }
        setGuardando(false);
    };

    const aplicar = (p) => {
        const campos = pick(p, true);
        onAplicar?.(campos);
        onClose?.();
    };

    const eliminar = async (p) => {
        if (!confirm(`¿Eliminar la plantilla "${p.nombre}"?`)) return;
        try { await remove(ref(db, `fojaqx/plantillas/${p.id}`)); } catch (e) { console.error(e); }
    };

    return (
        <div className="pqx-overlay" onClick={onClose}>
            <div className="pqx-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="pqx-head">
                    <h3>Plantillas de procedimiento</h3>
                    <button className="pqx-x" onClick={onClose} aria-label="Cerrar">✕</button>
                </div>

                <div className="pqx-body">
                    {/* Guardar la foja actual como plantilla */}
                    <section className="pqx-box">
                        <p className="pqx-box-title">Guardar este procedimiento como plantilla</p>
                        {hayDatos ? (
                            <>
                                <input className="pqx-input" placeholder="Nombre de la plantilla (ej: Apendicectomía)"
                                    value={nombre} onChange={(e) => setNombre(e.target.value)} />

                                <p className="pqx-hint">Se guardará:</p>
                                <div className="pqx-tags">
                                    {Object.keys(pick(form, incluirEquipo)).map((k) => (
                                        <span key={k} className="pqx-tag">{CAMPOS.find((c) => c.k === k)?.label || k}</span>
                                    ))}
                                </div>

                                <label className="pqx-check">
                                    <input type="checkbox" checked={incluirEquipo} onChange={(e) => setIncluirEquipo(e.target.checked)} />
                                    Incluir también el equipo quirúrgico (cirujano, anestesista, ayudantes)
                                </label>

                                <button className="pqx-btn primary" disabled={!nombre.trim() || guardando} onClick={guardar}>
                                    {guardando ? "Guardando..." : "Guardar plantilla"}
                                </button>
                            </>
                        ) : (
                            <p className="pqx-empty-inline">Completá al menos el procedimiento o un diagnóstico para poder guardar una plantilla.</p>
                        )}
                    </section>

                    {/* Reutilizar una plantilla guardada */}
                    <section className="pqx-box">
                        <p className="pqx-box-title">Reutilizar una plantilla ({plantillas.length})</p>
                        <input className="pqx-input" placeholder="Buscar plantilla..."
                            value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />

                        {filtradas.length === 0 ? (
                            <p className="pqx-empty-inline">No hay plantillas guardadas todavía.</p>
                        ) : (
                            <div className="pqx-list">
                                {filtradas.map((p) => (
                                    <div key={p.id} className="pqx-item">
                                        <div className="pqx-item-info">
                                            <p className="pqx-item-name">{p.nombre}</p>
                                            <p className="pqx-item-meta">
                                                {(p.procedimientoqx || p.preoperatorio || "Sin descripción").slice(0, 70)}
                                                {(p.procedimientoqx || p.preoperatorio || "").length > 70 ? "…" : ""}
                                            </p>
                                        </div>
                                        <button className="pqx-btn ghost" onClick={() => aplicar(p)}>Usar</button>
                                        <button className="pqx-trash" onClick={() => eliminar(p)} aria-label="Eliminar">🗑</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                </div>

                <div className="pqx-foot">
                    <button className="pqx-btn ghost" onClick={onClose}>Cerrar</button>
                </div>
            </div>

            <style>{`
                .pqx-overlay { position: fixed; inset: 0; z-index: 1000; background: rgba(31,46,42,.5);
                    display: flex; align-items: flex-end; justify-content: center; padding: 0; }
                .pqx-modal { background: #fffdfa; width: 100%; max-width: 620px; max-height: 92vh;
                    border-radius: 22px 22px 0 0; display: flex; flex-direction: column; overflow: hidden;
                    font-family: 'Inter', system-ui, sans-serif; color: #1f2e2a; box-shadow: 0 -8px 40px rgba(0,0,0,.2); }
                .pqx-head { display: flex; align-items: center; justify-content: space-between;
                    padding: 16px 18px; background: #2c7a5e; color: #fff; }
                .pqx-head h3 { margin: 0; font-size: 19px; font-weight: 700; }
                .pqx-x { background: rgba(255,255,255,.2); border: none; color: #fff; width: 40px; height: 40px;
                    border-radius: 10px; font-size: 16px; cursor: pointer; }
                .pqx-body { padding: 16px; overflow-y: auto; display: flex; flex-direction: column; gap: 16px; }
                .pqx-box { border: 1.5px solid #e2dbd1; border-radius: 16px; padding: 16px; background: #fefcf9; }
                .pqx-box-title { margin: 0 0 12px; font-size: 16px; font-weight: 700; color: #2c7a5e; }
                .pqx-input { width: 100%; box-sizing: border-box; font-size: 16px; padding: 12px 14px; min-height: 50px;
                    border: 1.5px solid #e2dbd1; border-radius: 12px; background: #fff; margin-bottom: 10px; }
                .pqx-input:focus { outline: none; border-color: #2c7a5e; box-shadow: 0 0 0 3px rgba(44,122,94,.15); }
                .pqx-hint { margin: 4px 0 6px; font-size: 13px; color: #6b6b6b; }
                .pqx-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 12px; }
                .pqx-tag { background: #f0f7f4; color: #2c7a5e; font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 20px; }
                .pqx-check { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #4a5b55; margin-bottom: 12px; cursor: pointer; }
                .pqx-check input { width: 20px; height: 20px; }
                .pqx-btn { font-size: 15px; font-weight: 700; padding: 0 18px; min-height: 48px; border-radius: 40px; border: none; cursor: pointer; }
                .pqx-btn.primary { background: #2c7a5e; color: #fff; width: 100%; }
                .pqx-btn.primary:disabled { opacity: .5; cursor: not-allowed; }
                .pqx-btn.ghost { background: transparent; border: 1.5px solid #cdc2b6; color: #6b5e52; }
                .pqx-empty-inline { margin: 0; font-size: 14px; color: #6b6b6b; }
                .pqx-list { display: flex; flex-direction: column; gap: 8px; }
                .pqx-item { display: flex; align-items: center; gap: 10px; padding: 12px; border: 1.5px solid #e2dbd1; border-radius: 12px; background: #fff; }
                .pqx-item-info { flex: 1; min-width: 0; }
                .pqx-item-name { margin: 0; font-size: 16px; font-weight: 700; }
                .pqx-item-meta { margin: 3px 0 0; font-size: 13px; color: #6b6b6b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .pqx-trash { background: #fee9e9; border: none; color: #9b3a3a; width: 44px; height: 44px; border-radius: 10px; cursor: pointer; font-size: 16px; }

                @media (min-width: 640px) {
                    .pqx-overlay { align-items: center; padding: 20px; }
                    .pqx-modal { border-radius: 22px; }
                }
            `}</style>
        </div>
    );
}
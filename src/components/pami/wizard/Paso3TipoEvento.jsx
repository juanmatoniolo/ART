"use client";
import { useState, useEffect, useMemo } from "react";
import { getSession } from "@/utils/session";
import Fuse from "fuse.js";
import { crearOP, listarOPsPaciente, ESTADOS_OP } from "@/lib/pami/op";
import { guardarPresupuestoPami } from "@/lib/pami/presupuestos";
import CatalogoProductos from "../presupuesto/CatalogoProductos";
import styles from "./wizard.module.css";

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

const OPCIONES = [
    { id: "op", icon: "📄", label: "Solicitud de OP", desc: "Pedido inicial para que PAMI asigne un número." },
    { id: "material", icon: "📦", label: "Material de Cirugía", desc: "Pedido de insumos para una práctica." },
    { id: "internacion", icon: "🏥", label: "Internación", desc: "Requiere vincular una OP autorizada." },
    { id: "cirugia", icon: "🔪", label: "Cirugía", desc: "Requiere vincular una OP autorizada." },
];

export default function Paso3TipoEvento({ estado, actualizar, avanzar, volver, items = [] }) {
    const paciente = estado.paciente || {};
    const tipo = estado.tipoEvento;
    const requiereOPExistente = tipo === "internacion" || tipo === "cirugia";
    const esNuevaOP = tipo === "op" || tipo === "material";

    // Estados para OP Existente
    const [opsPaciente, setOpsPaciente] = useState([]);
    const [opVinculada, setOpVinculada] = useState(estado.opVinculada?.id || "");
    const [loadingOps, setLoadingOps] = useState(false);

    // Estados para Nueva OP
    const [formOP, setFormOP] = useState({ nroOP: "", diagnostico: "" });
    const [nomenclador, setNomenclador] = useState([]);
    const [busquedaCodigo, setBusquedaCodigo] = useState("");
    const [codigosAgregados, setCodigosAgregados] = useState([]);

    // Estado para el borrador
    const [carrito, setCarrito] = useState([]);
    const [saving, setSaving] = useState(false);

    // Cargar OPs si es internación o cirugía
    useEffect(() => {
        if (!requiereOPExistente || !paciente.dni) return;
        setLoadingOps(true);
        listarOPsPaciente(paciente.dni)
            .then(ops => {
                // Filtramos las OPs que ya tienen número
                setOpsPaciente(ops.filter(o => o.estado === "cargado" || o.estado === "aceptado"));
            })
            .finally(() => setLoadingOps(false));
    }, [paciente.dni, requiereOPExistente]);

    // Cargar Nomenclador si es OP nueva
    useEffect(() => {
        if (!esNuevaOP) return;
        fetch('/archivos/pami-nomenclador.json')
            .then(r => r.json())
            .then(j => { if (j && j.items) setNomenclador(j.items); });
    }, [esNuevaOP]);

    const fuse = useMemo(() => {
        if (!nomenclador.length) return null;
        return new Fuse(nomenclador, { keys: ['codigo', 'descripcion'], threshold: 0.3 });
    }, [nomenclador]);

    const sugerenciasCodigos = useMemo(() => {
        const q = busquedaCodigo.trim();
        if (q.length < 2 || !fuse) return [];
        return fuse.search(q, { limit: 10 }).map(r => r.item);
    }, [busquedaCodigo, fuse]);

    const seleccionarCodigo = (c) => {
        setCodigosAgregados([...codigosAgregados, { ...c, cantidad: 1 }]);
        setBusquedaCodigo("");
    };

    const guardarTodo = async () => {
        if (esNuevaOP && !formOP.diagnostico) return alert("Completá el diagnóstico de la OP.");
        if (requiereOPExistente && !opVinculada) return alert("Vinculá una OP existente.");

        setSaving(true);
        try {
            const usuario = usuarioActual();
            let opFinal = null;

            if (esNuevaOP) {
                opFinal = await crearOP(
                    paciente.dni,
                    { dni: paciente.dni, oncoplanPaciente: !!paciente.oncoplan },
                    {
                        nroOP: formOP.nroOP,
                        tipo: tipo,
                        diagnostico: formOP.diagnostico,
                        codigosSolicitados: codigosAgregados,
                    },
                    { usuario }
                );
            } else {
                opFinal = opsPaciente.find(o => o.id === opVinculada);
            }

            if (carrito.length > 0) {
                const total = carrito.reduce((s, c) => s + c.precio * (Number(c.cantidad) || 0), 0);
                await guardarPresupuestoPami(
                    paciente.dni,
                    { items: carrito, codigos: [], total, oncoplan: !!paciente.oncoplan, opId: opFinal?.id || null },
                    { usuario }
                );
            }

            actualizar({ op: opFinal, borradorCreado: carrito.length > 0 });
            avanzar(); // Pasa al paso de Confirmar
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <h2 className={styles.titulo}>Paso 2 · Registrar Evento</h2>
            <p className={styles.hint}>Elegí el tipo de registro y completá los datos necesarios.</p>

            {/* SELECCIÓN DE TIPO */}
            <div className={styles.opcionesGrid} style={{ gridTemplateColumns: "1fr 1fr", marginBottom: "2rem" }}>
                {OPCIONES.map((op) => (
                    <button
                        key={op.id}
                        type="button"
                        className={`${styles.opcionCard} ${tipo === op.id ? styles.opcionCardActive : ""}`}
                        onClick={() => actualizar({ tipoEvento: op.id })}
                    >
                        <span className={styles.opcionIcon}>{op.icon}</span>
                        <span className={styles.opcionLabel}>{op.label}</span>
                        <span className={styles.opcionDesc}>{op.desc}</span>
                    </button>
                ))}
            </div>

            {/* SI REQUIERE OP EXISTENTE */}
            {requiereOPExistente && (
                <div style={{ marginBottom: "2rem", padding: "1rem", background: "var(--surface-2)", borderRadius: "10px" }}>
                    <label className={styles.campo}>
                        <span style={{ color: "var(--accent)" }}>Vincular Orden de Prestación (Obligatorio)</span>
                        <select className={styles.input} value={opVinculada} onChange={e => setOpVinculada(e.target.value)}>
                            <option value="">— Elegí una OP autorizada —</option>
                            {opsPaciente.map((o) => (
                                <option key={o.id} value={o.id}>
                                    OP {o.nroOP} · {o.diagnostico} · {ESTADOS_OP.find(e => e.id === o.estado)?.label}
                                </option>
                            ))}
                        </select>
                    </label>
                    {opsPaciente.length === 0 && !loadingOps && (
                        <p className={styles.hint} style={{ color: "var(--danger)" }}>
                            ⚠️ No hay OPs activas. Primero generá una "Solicitud de OP".
                        </p>
                    )}
                </div>
            )}

            {/* SI ES NUEVA OP (FORMULARIO) */}
            {esNuevaOP && (
                <div style={{ marginBottom: "2rem", padding: "1rem", background: "var(--surface-2)", borderRadius: "10px" }}>
                    <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "var(--accent)" }}>Datos del Pedido (OP)</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                        <label className={styles.campo}>
                            <span>N° de OP (Opcional)</span>
                            <input className={styles.input} value={formOP.nroOP} onChange={e => setFormOP({ ...formOP, nroOP: e.target.value })} placeholder="Dejar vacío si no lo tenés" />
                        </label>
                        <label className={styles.campo}>
                            <span>Diagnóstico *</span>
                            <input className={styles.input} value={formOP.diagnostico} onChange={e => setFormOP({ ...formOP, diagnostico: e.target.value })} placeholder="Ej: Neumonía" />
                        </label>
                    </div>

                    <label className={styles.campo} style={{ position: "relative" }}>
                        <span>Buscar código en Nomenclador</span>
                        <input className={styles.input} value={busquedaCodigo} onChange={e => setBusquedaCodigo(e.target.value)} placeholder="Ej: 65.00.01..." />
                        {busquedaCodigo.trim().length >= 2 && sugerenciasCodigos.length > 0 && (
                            <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", listStyle: "none", padding: ".4rem", margin: ".2rem 0 0 0", boxShadow: "var(--shadow)" }}>
                                {sugerenciasCodigos.map((c, i) => (
                                    <li key={i}>
                                        <div onMouseDown={(e) => { e.preventDefault(); seleccionarCodigo(c); }} style={{ padding: ".5rem", cursor: "pointer" }}>
                                            <strong>{c.codigo}</strong> - {c.descripcion}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </label>

                    {codigosAgregados.length > 0 && (
                        <div style={{ marginTop: "1rem" }}>
                            {codigosAgregados.map((c, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", background: "var(--surface)", padding: "0.5rem", borderRadius: "4px", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
                                    <span>{c.codigo} - {c.descripcion}</span>
                                    <button onClick={() => setCodigosAgregados(codigosAgregados.filter((_, idx) => idx !== i))} style={{ color: "var(--danger)", background: "none", border: "none", cursor: "pointer" }}>✕</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            <div className={styles.navBar} style={{ marginTop: "2rem" }}>
                <button type="button" className={styles.btnSecundario} onClick={volver}>← Atrás</button>
                <button type="button" className={styles.btnPrimario} onClick={guardarTodo} disabled={saving || !tipo}>
                    {saving ? "Guardando…" : "Guardar y Continuar →"}
                </button>
            </div>
        </div>
    );
}

Paso3TipoEvento.hideShellNav = true;
"use client";
import { useState, useMemo } from "react";
import { getSession } from "@/utils/session";
import Fuse from "fuse.js";
import { crearOP } from "@/lib/pami/op";
import { guardarPresupuestoPami } from "@/lib/pami/presupuestos";
import CatalogoProductos from "../presupuesto/CatalogoProductos";
import styles from "./wizard.module.css";

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

export default function PasoDetalle({ estado, actualizar, avanzar, volver }) {
    const paciente = estado.paciente || {};
    const tipo = estado.tipoEvento;
    const esNuevaOP = tipo === "op" || tipo === "material";

    // Estados para generar OP nueva (si corresponde)
    const [formOP, setFormOP] = useState({
        nroOP: "", diagnostico: "", fechaSolicitud: new Date().toISOString().slice(0, 10),
    });
    const [nomenclador, setNomenclador] = useState([]);
    const [busquedaCodigo, setBusquedaCodigo] = useState("");
    const [codigosAgregados, setCodigosAgregados] = useState([]);

    // Estados para el borrador de medicamentos
    const [items, setItems] = useState([]); // Catálogo general
    const [carrito, setCarrito] = useState([]);

    const [saving, setSaving] = useState(false);

    // Cargar nomenclador al montar
    useMemo(() => {
        fetch('/archivos/pami-nomenclador.json')
            .then(r => r.json())
            .then(j => { if (j && j.items) setNomenclador(j.items); });
    }, []);

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
        if (esNuevaOP && !formOP.diagnostico) return alert("Completá el diagnóstico.");
        setSaving(true);

        try {
            const usuario = usuarioActual();
            let opData = estado.opVinculada; // Si ya venía vinculada (internación/cirugía)

            // 1. Si es OP nueva, la creamos
            if (esNuevaOP) {
                opData = await crearOP(
                    paciente.dni,
                    { dni: paciente.dni, oncoplanPaciente: !!paciente.oncoplan },
                    {
                        nroOP: formOP.nroOP,
                        tipo: tipo,
                        diagnostico: formOP.diagnostico,
                        fechaSolicitud: formOP.fechaSolicitud,
                        // Adjuntamos los códigos en la OP
                        codigosSolicitados: codigosAgregados,
                    },
                    { usuario }
                );
            }

            // 2. Guardar el borrador de presupuesto vinculado al evento
            if (carrito.length > 0) {
                const total = carrito.reduce((s, c) => s + c.precio * (Number(c.cantidad) || 0), 0);
                await guardarPresupuestoPami(
                    paciente.dni,
                    { items: carrito, codigos: [], total, oncoplan: !!paciente.oncoplan, opId: opData?.id || null },
                    { usuario }
                );
            }

            actualizar({ op: opData, borradorCreado: carrito.length > 0 });
            avanzar();
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <h2 className={styles.titulo}>Paso 3 · Detalle y Medicación</h2>
            <p className={styles.hint}>
                {esNuevaOP ? "Completá los datos del pedido y los códigos solicitados." : "Cargá la medicación utilizada para esta práctica."}
            </p>

            {/* SI ES OP NUEVA, PEDIMOS LOS DATOS DE LA OP */}
            {esNuevaOP && (
                <div style={{ marginBottom: "2rem", padding: "1rem", background: "var(--surface-2)", borderRadius: "10px" }}>
                    <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "var(--accent)" }}>Datos del Pedido (OP)</h3>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
                        <label className={styles.campo}>
                            <span>N° de OP (Opcional)</span>
                            <input className={styles.input} value={formOP.nroOP} onChange={e => setFormOP({ ...formOP, nroOP: e.target.value })} placeholder="Ej: 123456" />
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

            {/* BORRADOR DE MEDICACIÓN */}
            <div style={{ marginBottom: "2rem", padding: "1rem", background: "var(--surface-2)", borderRadius: "10px" }}>
                <h3 style={{ fontSize: "1rem", marginBottom: "1rem", color: "var(--accent)" }}>Borrador de Medicación (Opcional)</h3>
                <CatalogoProductos items={items} onAgregar={(item, qty) => {
                    setCarrito(prev => {
                        const existing = prev.find(x => x.id === `${item.categoria}:${item.key}`);
                        if (existing) return prev.map(x => x.id === existing.id ? { ...x, cantidad: x.cantidad + qty } : x);
                        return [...prev, { id: `${item.categoria}:${item.key}`, nombre: item.nombre, precio: item.precioFacturacion, cantidad: qty }];
                    });
                }} />

                {carrito.length > 0 && (
                    <div style={{ marginTop: "1rem" }}>
                        <p className={styles.hint}>Medicamentos agregados: {carrito.length}</p>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                            {carrito.map(c => (
                                <span key={c.id} style={{ fontSize: "0.8rem", background: "var(--surface)", padding: "4px 8px", borderRadius: "4px", border: "1px solid var(--border)" }}>
                                    {c.cantidad}x {c.nombre}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className={styles.navBar} style={{ marginTop: "2rem" }}>
                <button type="button" className={styles.btnSecundario} onClick={volver}>← Atrás</button>
                <button type="button" className={styles.btnPrimario} onClick={guardarTodo} disabled={saving}>
                    {saving ? "Guardando…" : "Guardar y Finalizar →"}
                </button>
            </div>
        </div>
    );
}

PasoDetalle.hideShellNav = true;
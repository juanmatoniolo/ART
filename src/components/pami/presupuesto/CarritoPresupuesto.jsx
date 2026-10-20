"use client";
import { useMemo, useState } from "react";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";
import { parseCantidad, parseMonto } from "@/lib/pami/presupuestos";
import OncoplanBadge from "./OncoplanBadge";
import styles from "./presupuesto.module.css";

export default function CarritoPresupuesto({ carrito, setCarrito, codigos, setCodigos, oncoplan, edicionId, saving, onGuardar, onImprimir, onNuevo }) {
    const [formCodigo, setFormCodigo] = useState({ codigo: "", descripcion: "", monto: "", cantidad: "1" });

    const totalProductos = useMemo(() => carrito.reduce((s, c) => s + c.precio * (Number(c.cantidad) || 0), 0), [carrito]);
    const totalCodigos = useMemo(() => codigos.reduce((s, c) => s + ((Number(c.monto) || 0) * (Number(c.cantidad) || 1)), 0), [codigos]);
    const total = totalProductos + totalCodigos;

    const quitar = (id) => setCarrito((c) => c.filter((x) => x.id !== id));
    const quitarCodigo = (id) => setCodigos((c) => c.filter((x) => x.id !== id));

    const agregarCodigo = () => {
        const codigo = formCodigo.codigo.trim();
        const descripcion = formCodigo.descripcion.trim();
        const monto = parseMonto(formCodigo.monto);
        const cantidad = Number(formCodigo.cantidad) || 1;

        if (!codigo && !descripcion) return;
        setCodigos((c) => [...c, { id: `cod-${Date.now()}`, codigo, descripcion, monto, cantidad }]);
        setFormCodigo({ codigo: "", descripcion: "", monto: "", cantidad: "1" });
    };

    return (
        <aside className={`${styles.card} ${styles.cart}`}>
            <h3 className={styles.cardTitle}>
                🛒 Presupuesto {oncoplan && <OncoplanBadge />}
            </h3>

            {carrito.length === 0 && codigos.length === 0 ? (
                <div className={styles.empty}>Agregá productos o códigos PAMI.</div>
            ) : (
                <>
                    {carrito.map((c) => (
                        <div key={c.id} className={styles.cartRow}>
                            <div style={{ minWidth: 0 }}>
                                <div className={styles.rowName}>✓ {c.nombre}</div>
                                <div className={styles.rowMeta}>{formatCurrency(c.precio)} c/u</div>
                            </div>
                            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => quitar(c.id)}>✕</button>
                            <div className={styles.cartControls}>
                                <input className={`${styles.input} ${styles.qty}`} value={c.cantidad} onChange={(e) => setCarrito((arr) => arr.map(x => x.id === c.id ? { ...x, cantidad: parseCantidad(e.target.value, 1) } : x))} />
                                <strong>{formatCurrency(c.precio * (Number(c.cantidad) || 0))}</strong>
                            </div>
                        </div>
                    ))}

                    {codigos.length > 0 && <div className={styles.sub}>Códigos PAMI</div>}
                    {codigos.map((c) => (
                        <div key={c.id} className={styles.cartRow}>
                            <div style={{ minWidth: 0 }}>
                                <div className={styles.rowName}>✓ {c.codigo ? `Cód. ${c.codigo}` : "Práctica"}</div>
                                <div className={styles.rowMeta}>{c.descripcion}</div>
                            </div>
                            <button type="button" className={`${styles.btn} ${styles.btnSm}`} onClick={() => quitarCodigo(c.id)}>✕</button>
                            <div className={styles.cartControls}>
                                <span style={{ fontSize: ".85rem", fontWeight: 700 }}>x {c.cantidad} u.</span>
                                <strong>{formatCurrency((Number(c.monto) || 0) * (Number(c.cantidad) || 1))}</strong>
                            </div>
                        </div>
                    ))}

                    {/* FORMULARIO DE CÓDIGOS CORREGIDO */}
                    <div className={styles.codigoForm}>
                        <div className={styles.codigoRow1}>
                            <label className={styles.field}>
                                <span>Código PAMI</span>
                                <input className={styles.input} placeholder="Ej: 62.001" value={formCodigo.codigo} onChange={(e) => setFormCodigo((f) => ({ ...f, codigo: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Cant.</span>
                                <input className={styles.input} type="number" min="1" value={formCodigo.cantidad} onChange={(e) => setFormCodigo((f) => ({ ...f, cantidad: e.target.value }))} />
                            </label>
                        </div>
                        <div className={styles.codigoRow2}>
                            <label className={styles.field}>
                                <span>Descripción / Práctica</span>
                                <input className={styles.input} placeholder="Ej: Días de pensión..." value={formCodigo.descripcion} onChange={(e) => setFormCodigo((f) => ({ ...f, descripcion: e.target.value }))} />
                            </label>
                            <label className={styles.field}>
                                <span>Monto unitario</span>
                                <input className={styles.input} placeholder="0,00" inputMode="decimal" value={formCodigo.monto} onChange={(e) => setFormCodigo((f) => ({ ...f, monto: e.target.value }))} />
                            </label>
                        </div>
                        <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.full}`} onClick={agregarCodigo}>
                            + Agregar código
                        </button>
                    </div>
                </>
            )}

            <div className={styles.total}>
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
            </div>

            <div className={styles.actions}>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary} ${styles.full}`} onClick={onGuardar} disabled={saving || (carrito.length === 0 && codigos.length === 0)}>
                    {saving ? "Guardando…" : edicionId ? "Actualizar borrador" : "Guardar borrador"}
                </button>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".5rem" }}>
                    <button type="button" className={styles.btn} onClick={onImprimir} disabled={carrito.length === 0 && codigos.length === 0}>🖨️ Imprimir</button>
                    <button type="button" className={styles.btn} onClick={onNuevo}>Nuevo</button>
                </div>
            </div>
        </aside>
    );
}
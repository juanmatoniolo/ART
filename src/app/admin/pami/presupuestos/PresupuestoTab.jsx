"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "@/lib/firebase";
import { ref, push, set, update } from "firebase/database";
import { matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import { useAutosaveDraft } from "@/hooks/useAutosaveDraft";
import styles from "@/components/pami/presupuesto/presupuesto.module.css";

const p = styles;

const AUTOSAVE_KEY = "pami:presupuesto:autosave";
const AUTOSAVE_VERSION = 1;

const todayISO = () => new Date().toISOString().slice(0, 10);

const emptyState = () => ({
    paciente: null,
    cart: [],
    notas: "",
    fecha: todayISO(),
    editId: null,
});

const money = (n) => {
    const v = Number(n) || 0;
    try {
        return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
    } catch {
        return `$${v.toFixed(2)}`;
    }
};

export default function PresupuestoTab({
    items = [],
    pacientesDb = [],
    initialPaciente,
    initialDraft,
    onInitialLoaded,
}) {
    const [draft, setDraft, { clear, wasRestored, dismissRestored }] = useAutosaveDraft(
        AUTOSAVE_KEY,
        emptyState(),
        { version: AUTOSAVE_VERSION }
    );

    const { paciente, cart, notas, fecha, editId } = draft;

    const setPaciente = (v) => setDraft((d) => ({ ...d, paciente: v }));
    const setCart = (u) => setDraft((d) => ({ ...d, cart: typeof u === "function" ? u(d.cart) : u }));
    const setNotas = (v) => setDraft((d) => ({ ...d, notas: v }));
    const setFecha = (v) => setDraft((d) => ({ ...d, fecha: v }));

    const [qPaciente, setQPaciente] = useState("");
    const [qProducto, setQProducto] = useState("");
    const [saving, setSaving] = useState(false);
    const [flash, setFlash] = useState("");

    const mostrarFlash = (m, ms = 3200) => {
        setFlash(m);
        setTimeout(() => setFlash(""), ms);
    };

    /* ── Cargar borrador abierto desde la lista ── */
    const loadedDraftRef = useRef(null);
    useEffect(() => {
        if (!initialDraft || !initialDraft.id) return;
        if (loadedDraftRef.current === initialDraft.id) return;
        loadedDraftRef.current = initialDraft.id;

        setDraft({
            paciente: initialPaciente ? { ...initialPaciente } : null,
            cart: Array.isArray(initialDraft.items) ? initialDraft.items : [],
            notas: initialDraft.notas || "",
            fecha: initialDraft.fecha || todayISO(),
            editId: initialDraft.id,
        });
        dismissRestored();
        onInitialLoaded?.();
    }, [initialDraft, initialPaciente, dismissRestored, onInitialLoaded, setDraft]);

    /* ── Cargar paciente pre-seleccionado (sin borrador) ── */
    const loadedPacienteRef = useRef(null);
    useEffect(() => {
        if (!initialPaciente || initialDraft) return;
        const key = initialPaciente.dni;
        if (!key) return;
        if (loadedPacienteRef.current === key) return;
        loadedPacienteRef.current = key;

        setDraft((d) => ({ ...d, paciente: { ...initialPaciente } }));
        onInitialLoaded?.();
    }, [initialPaciente, initialDraft, onInitialLoaded, setDraft]);

    /* ── Autocompletado paciente ── */
    const pacientesFiltrados = useMemo(() => {
        const q = qPaciente.trim();
        if (!q) return [];
        return pacientesDb
            .filter((pac) =>
                matchesAllTerms(`${pac.dni || ""} ${pac.apellido || ""} ${pac.nombre || ""} ${pac.afiliado || ""}`, q)
            )
            .slice(0, 8);
    }, [pacientesDb, qPaciente]);

    /* ── Productos filtrados ── */
    const productosFiltrados = useMemo(() => {
        const q = qProducto.trim();
        let lista = items.filter((it) => it.activo !== false);
        if (q) lista = lista.filter((it) => matchesAllTerms(`${it.nombre} ${it.key} ${it.presentacion}`, q));
        return lista.slice(0, 50);
    }, [items, qProducto]);

    /* ── Carrito ── */
    const addProducto = (prod, cantidad = 1) => {
        setCart((prev) => {
            const existing = prev.find((x) => x.key === prod.key);
            if (existing) {
                return prev.map((x) => (x.key === prod.key ? { ...x, cantidad: x.cantidad + cantidad } : x));
            }
            return [
                ...prev,
                {
                    key: prod.key,
                    nombre: prod.nombre,
                    presentacion: prod.presentacion,
                    tipo: prod.tipo,
                    categoria: prod.categoria,
                    precio: Number(prod.precioFacturacion) || 0,
                    cantidad: cantidad > 0 ? cantidad : 1,
                },
            ];
        });
    };

    const updateCartItem = (key, patch) => {
        setCart((prev) => prev.map((x) => (x.key === key ? { ...x, ...patch } : x)));
    };

    const removeCartItem = (key) => {
        setCart((prev) => prev.filter((x) => x.key !== key));
    };

    const total = useMemo(
        () => cart.reduce((acc, it) => acc + (Number(it.precio) || 0) * (Number(it.cantidad) || 0), 0),
        [cart]
    );

    /* ── Guardar ── */
    const guardarBorrador = async () => {
        if (!paciente?.dni) return mostrarFlash("⚠️ Seleccioná un paciente primero.");
        if (cart.length === 0) return mostrarFlash("⚠️ El presupuesto está vacío.");

        setSaving(true);
        try {
            const payload = {
                items: cart,
                total,
                notas: notas || "",
                fecha: fecha || todayISO(),
                tipo: "presupuesto",
                pacienteDni: paciente.dni,
                pacienteNombre: `${paciente.apellido || ""} ${paciente.nombre || ""}`.trim(),
                pacienteAfiliado: paciente.afiliado || "",
                updatedAt: Date.now(),
            };

            if (editId) {
                await update(ref(db, `PAMI/pacientes/${paciente.dni}/medicamentos/${editId}`), payload);
            } else {
                const newRef = push(ref(db, `PAMI/pacientes/${paciente.dni}/medicamentos`));
                await set(newRef, { ...payload, createdAt: Date.now() });
            }

            mostrarFlash("✅ Borrador guardado correctamente.");

            // Reset total: solo si guardó OK
            clear();
            setDraft(emptyState());
            setQProducto("");
            loadedDraftRef.current = null;
        } catch (e) {
            console.error(e);
            mostrarFlash("❌ No se pudo guardar el borrador.");
            // ⚠️ NO limpiamos: el autosave queda vivo para no perder nada
        } finally {
            setSaving(false);
        }
    };

    /* ── Limpiar ── */
    const limpiar = () => {
        if (!confirm("¿Vaciar el carrito y las notas del presupuesto actual?")) return;
        setDraft((d) => ({ ...d, cart: [], notas: "", editId: null }));
        setQProducto("");
        loadedDraftRef.current = null;
        mostrarFlash("Carrito y notas vaciados.");
    };

    /* ── Render ── */
    return (
        <div className={p.layout}>
            <div className={p.colMain}>

                {wasRestored && (
                    <div
                        className={p.status}
                        style={{
                            display: "flex",
                            gap: "1rem",
                            alignItems: "center",
                            justifyContent: "space-between",
                            flexWrap: "wrap",
                        }}
                    >
                        <span>📥 Recuperamos un borrador sin guardar de la sesión anterior.</span>
                        <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                            <button type="button" className={`${p.btn} ${p.btnSm}`} onClick={dismissRestored}>
                                Seguir editando
                            </button>
                            <button
                                type="button"
                                className={`${p.btn} ${p.btnSm} ${p.btnDangerSm}`}
                                onClick={() => {
                                    setDraft(emptyState());
                                    clear();
                                    loadedDraftRef.current = null;
                                }}
                            >
                                Descartar
                            </button>
                        </div>
                    </div>
                )}

                {/* 1. Paciente */}
                <section className={p.card}>
                    <h3 className={p.cardTitle}>1. Paciente</h3>

                    {paciente ? (
                        <div
                            style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                gap: ".75rem",
                                flexWrap: "wrap",
                                padding: ".7rem .85rem",
                                border: "1px solid var(--accent-border)",
                                borderRadius: 10,
                                background: "var(--accent-weak)",
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 800 }}>
                                    {paciente.apellido}, {paciente.nombre}
                                </div>
                                <div style={{ fontSize: ".8rem", color: "var(--muted)" }}>
                                    DNI {paciente.dni} · Afiliado {paciente.afiliado || "—"}
                                </div>
                            </div>
                            <button
                                type="button"
                                className={`${p.btn} ${p.btnSm}`}
                                onClick={() => { setPaciente(null); setQPaciente(""); }}
                            >
                                Cambiar
                            </button>
                        </div>
                    ) : (
                        <>
                            <label className={p.field}>
                                <span>Buscar paciente por DNI, nombre o afiliado</span>
                                <input
                                    className={p.input}
                                    value={qPaciente}
                                    onChange={(e) => setQPaciente(e.target.value)}
                                    placeholder="Ej: 30123456 / Pérez / 1234-5678"
                                />
                            </label>
                            {qPaciente.trim() && (
                                <ul className={p.list} style={{ marginTop: ".6rem" }}>
                                    {pacientesFiltrados.length === 0 ? (
                                        <li className={p.empty}>No se encontraron pacientes.</li>
                                    ) : (
                                        pacientesFiltrados.map((pac) => (
                                            <li
                                                key={pac.dni}
                                                className={p.row}
                                                style={{ cursor: "pointer" }}
                                                onClick={() => { setPaciente(pac); setQPaciente(""); }}
                                            >
                                                <div style={{ minWidth: 0 }}>
                                                    <div className={p.rowName}>{pac.apellido}, {pac.nombre}</div>
                                                    <div className={p.rowMeta}>DNI {pac.dni} · Afiliado {pac.afiliado || "—"}</div>
                                                </div>
                                                <span className={`${p.btn} ${p.btnSm}`}>Elegir</span>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            )}
                        </>
                    )}
                </section>

                {/* 2. Productos */}
                <section className={p.card}>
                    <h3 className={p.cardTitle}>2. Agregar medicamentos / descartables</h3>
                    <input
                        className={p.input}
                        type="search"
                        placeholder="Buscar por nombre, código o presentación…"
                        value={qProducto}
                        onChange={(e) => setQProducto(e.target.value)}
                    />
                    <p className={p.hint}>
                        {qProducto.trim()
                            ? `${productosFiltrados.length} productos encontrados.`
                            : `Mostrando ${productosFiltrados.length} productos. Escribí para filtrar.`}
                    </p>
                    <ul className={p.list}>
                        {productosFiltrados.map((prod) => {
                            const enCarrito = cart.find((x) => x.key === prod.key);
                            return (
                                <li key={prod.key} className={p.productRow}>
                                    <div className={p.productInfo}>
                                        <div className={p.rowName}>
                                            {prod.nombre}
                                            <span
                                                className={prod.tipo === "medicamento" ? p.badgeMed : p.badgeDesc}
                                                style={{ marginLeft: 6 }}
                                            >
                                                {prod.tipo === "medicamento" ? "MED" : "DESC"}
                                            </span>
                                        </div>
                                        <div className={p.rowMeta}>
                                            {prod.presentacion} · {money(prod.precioFacturacion)}
                                            {enCarrito && ` · En carrito: ${enCarrito.cantidad}`}
                                        </div>
                                    </div>
                                    <div className={p.productActions}>
                                        <button
                                            type="button"
                                            className={`${p.qtyBtn} ${p.qtyBtnAdd}`}
                                            onClick={() => addProducto(prod, 1)}
                                            title="Agregar al carrito"
                                        >
                                            +
                                        </button>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {/* 3. Notas */}
                <section className={p.card}>
                    <h3 className={p.cardTitle}>3. Notas / Observaciones</h3>
                    <label className={p.field}>
                        <span>Observaciones (opcional)</span>
                        <textarea
                            className={p.input}
                            rows={4}
                            value={notas}
                            onChange={(e) => setNotas(e.target.value)}
                            placeholder="Ej: Enviar a PAMI antes del viernes. Pendiente autorización de RX."
                            style={{ resize: "vertical" }}
                        />
                    </label>
                    <label className={p.field} style={{ marginTop: ".75rem" }}>
                        <span>Fecha del presupuesto</span>
                        <input
                            type="date"
                            className={p.input}
                            value={fecha}
                            onChange={(e) => setFecha(e.target.value)}
                        />
                    </label>
                </section>
            </div>

            {/* Carrito */}
            <aside className={p.cart}>
                <section className={p.card}>
                    <h3 className={p.cardTitle}>Carrito ({cart.length})</h3>
                    {cart.length === 0 ? (
                        <div className={p.empty}>Todavía no agregaste productos.</div>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {cart.map((it) => (
                                <li key={it.key} className={p.cartRow}>
                                    <div style={{ minWidth: 0 }}>
                                        <div className={p.codigoLabel}>{it.nombre}</div>
                                        <div className={p.codigoDesc}>
                                            {it.presentacion} · {money(it.precio)} c/u
                                        </div>
                                    </div>
                                    <div className={p.cartControls}>
                                        <div className={p.qtyGroup}>
                                            <button
                                                type="button"
                                                className={p.qtyBtn}
                                                onClick={() =>
                                                    updateCartItem(it.key, {
                                                        cantidad: Math.max(1, (Number(it.cantidad) || 1) - 1),
                                                    })
                                                }
                                            >
                                                −
                                            </button>
                                            <input
                                                type="number"
                                                className={p.qtyInput}
                                                value={it.cantidad}
                                                min={1}
                                                onChange={(e) =>
                                                    updateCartItem(it.key, {
                                                        cantidad: Math.max(1, Number(e.target.value) || 1),
                                                    })
                                                }
                                            />
                                            <button
                                                type="button"
                                                className={p.qtyBtn}
                                                onClick={() =>
                                                    updateCartItem(it.key, {
                                                        cantidad: (Number(it.cantidad) || 1) + 1,
                                                    })
                                                }
                                            >
                                                +
                                            </button>
                                        </div>
                                        <strong>
                                            {money((Number(it.precio) || 0) * (Number(it.cantidad) || 0))}
                                        </strong>
                                        <button
                                            type="button"
                                            className={`${p.btn} ${p.btnSm} ${p.btnDangerSm}`}
                                            onClick={() => removeCartItem(it.key)}
                                            title="Quitar del carrito"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className={p.total}>
                        <span>Total</span>
                        <span>{money(total)}</span>
                    </div>

                    <div className={p.actions} style={{ marginTop: ".75rem" }}>
                        <button
                            type="button"
                            className={`${p.btn} ${p.btnPrimary} ${p.full}`}
                            onClick={guardarBorrador}
                            disabled={saving || !paciente?.dni || cart.length === 0}
                        >
                            {saving ? "Guardando…" : editId ? "💾 Actualizar borrador" : "💾 Guardar borrador"}
                        </button>
                        <button
                            type="button"
                            className={`${p.btn} ${p.full}`}
                            onClick={limpiar}
                            disabled={saving}
                        >
                            🧹 Limpiar todo
                        </button>
                    </div>
                </section>
            </aside>

            {flash && <div className={p.toast}>{flash}</div>}
        </div>
    );
}
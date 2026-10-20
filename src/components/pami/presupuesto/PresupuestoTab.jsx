"use client";
import { useEffect, useState, useRef, useMemo } from "react";
import Fuse from 'fuse.js';
import { dniKey, obtenerPacientePami, asegurarPacientePami } from "@/lib/pami";
import { guardarPresupuestoPami, itemsDe, codigosDe } from "@/lib/pami/presupuestos";
import { getSession } from "@/utils/session";
import { formatCurrency } from "@/app/farmacia/utils/farmacia";
import PacienteFormBasico from "./PacienteFormBasico";
import CatalogoProductos from "./CatalogoProductos";
import BorradoresList from "./BorradoresList";
import PresupuestoImprimible from "./PresupuestoImprimible";
import { useReactToPrint } from "react-to-print";
import styles from "./presupuesto.module.css";

const PACIENTE_VACIO = { dni: "", afiliado: "", nombreCompleto: "", historiaClinica: "", sexo: "", fechaNacimiento: "", telefono: "", domicilio: "", localidad: "", provincia: "", famNombre: "", famParentezco: "", famTelefono: "", cirujano: "", ayudante1: "", ayudante2: "", anestesista: "" };

const desdeDb = (d) => ({
    dni: d.dni || "", afiliado: d.afiliado || "", historiaClinica: d.historiaClinica || "", sexo: d.sexo || "",
    fechaNacimiento: d.fechaNacimiento || "", telefono: d.telefono || "", domicilio: d.domicilio || "",
    localidad: d.localidad || "", provincia: d.provincia || "", cirujano: d.cirujano || "",
    ayudante1: d.ayudante1 || "", ayudante2: d.ayudante2 || "", anestesista: d.anestesista || "",
    nombreCompleto: [d.apellido, d.nombre].filter(Boolean).join(" ").trim(),
    famNombre: d.familiar?.nombre || "", famParentezco: d.familiar?.parentezco || "", famTelefono: d.familiar?.telefono || "",
});

const aDb = (f) => {
    const { famNombre, famParentezco, famTelefono, nombreCompleto, ...resto } = f;
    const partes = String(nombreCompleto || "").trim().split(/\s+/).filter(Boolean);
    return { ...resto, apellido: partes[0] || "", nombre: partes.slice(1).join(" "), familiar: { nombre: (famNombre || "").trim(), parentezco: (famParentezco || "").trim(), telefono: (famTelefono || "").trim() } };
};

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

export default function PresupuestoTab({ items, pacientesDb = [], initialPaciente = null, initialDraft = null, onInitialLoaded }) {
    const [paso, setPaso] = useState(1);
    const [paciente, setPaciente] = useState(PACIENTE_VACIO);
    const [oncoplan, setOncoplan] = useState(false);
    const [estado, setEstado] = useState(null);
    const [borradores, setBorradores] = useState([]);
    const [draftActivo, setDraftActivo] = useState(null);

    const [carrito, setCarrito] = useState([]);
    const [codigos, setCodigos] = useState([]);
    const [flash, setFlash] = useState("");
    const [saving, setSaving] = useState(false);

    const [formCodigo, setFormCodigo] = useState({ codigo: "", descripcion: "", monto: "", cantidad: "1" });
    const [nomenclador, setNomenclador] = useState([]);
    const [busquedaCodigo, setBusquedaCodigo] = useState("");

    const printRef = useRef(null);
    const imprimir = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Presupuesto-${paciente.nombreCompleto || "PAMI"}`,
        pageStyle: `@page { size: A4 portrait; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`,
    });

    const mostrarFlash = (m, ms = 3500) => { setFlash(m); setTimeout(() => setFlash(""), ms); };

    // Carga de Nomencladores
    useEffect(() => {
        const URL_NACIONAL = '/archivos/nacional-nomenclador.json';
        const URL_PAMI = '/archivos/pami-nomenclador.json';

        Promise.all([
            fetch(URL_PAMI).then(r => r.json()).catch(() => ({ items: [] })),
            fetch(URL_NACIONAL).then(r => r.json()).catch(() => ([]))
        ]).then(([dataPami, dataNacional]) => {
            const itemsPami = (dataPami.items || []).map(i => ({ ...i, origen: 'PAMI' }));
            const arrayNacional = Array.isArray(dataNacional) ? dataNacional : (dataNacional.items || []);
            const itemsNacional = arrayNacional.map(i => ({ ...i, origen: 'NACIONAL', monto: null }));
            setNomenclador([...itemsPami, ...itemsNacional]);
        });
    }, []);

    const fuse = useMemo(() => {
        if (!nomenclador.length) return null;
        return new Fuse(nomenclador, {
            keys: [{ name: 'codigo', weight: 3 }, { name: 'descripcion', weight: 1 }, { name: 'origen', weight: 0.5 }],
            threshold: 0.3, ignoreLocation: true,
        });
    }, [nomenclador]);

    // FIX: Asegurar que el borrador cargado guarde su ID correctamente
    useEffect(() => {
        if (!initialPaciente) return;
        const { medicamentos = {}, ...datos } = initialPaciente;
        setPaciente(desdeDb(datos));
        setOncoplan(!!initialPaciente.oncoplan);
        setBorradores(Object.entries(medicamentos).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
        setEstado("existente");

        if (initialDraft) {
            cargarBorrador(initialDraft);
        }
        onInitialLoaded?.();
    }, [initialPaciente, initialDraft]);

    const buscarPaciente = async (rawDni = paciente.dni) => {
        const key = dniKey(rawDni);
        if (key.length < 7) return;
        setEstado("buscando");
        try {
            const data = await obtenerPacientePami(key);
            if (!data) { setBorradores([]); return setEstado("nuevo"); }
            const { medicamentos = {}, ...datos } = data;
            setPaciente(desdeDb(datos));
            setOncoplan(!!data.oncoplan);
            setBorradores(Object.entries(medicamentos).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
            setEstado("existente");
        } catch (e) { setEstado(null); mostrarFlash("Error al buscar paciente."); }
    };

    const cargarBorrador = (b) => {
        setCarrito(itemsDe(b).map((i) => ({ ...i, id: i.id || `${i.categoria}:${i.key}` })));
        setCodigos(codigosDe(b).map((c) => ({ ...c })));
        setDraftActivo(b); // Guardamos el borrador activo con su ID
        mostrarFlash(b.id ? "Borrador cargado. Podés editarlo." : "Borrador cargado.");
    };

    const iniciarNuevoBorrador = () => {
        setCarrito([]); setCodigos([]); setDraftActivo(null);
        mostrarFlash("Presupuesto limpio. Podés empezar de cero.");
    };

    const limpiarCarrito = () => {
        if (!confirm("¿Estás seguro de que querés vaciar todo el presupuesto actual?")) return;
        setCarrito([]);
        setCodigos([]);
        setDraftActivo(null);
        setFormCodigo({ codigo: "", descripcion: "", monto: "", cantidad: "1" });
        setBusquedaCodigo("");
        mostrarFlash("Carrito vaciado con éxito.");
    };

    const guardarPaciente = async () => {
        if (!paciente.nombreCompleto.trim()) throw new Error("Completá apellido y nombre.");
        const key = dniKey(paciente.dni);
        if (key.length < 7) throw new Error("DNI inválido.");
        if (!paciente.afiliado.trim()) throw new Error("Ingresá el N° de afiliado PAMI.");
        await asegurarPacientePami(aDb(paciente), { usuario: usuarioActual() });
        return key;
    };

    const guardarTodo = async (forceNew = false) => {
        try {
            setSaving(true);
            const key = await guardarPaciente();
            const total = carrito.reduce((s, c) => s + c.precio * (Number(c.cantidad) || 0), 0) + codigos.reduce((s, c) => s + ((Number(c.monto) || 0) * (Number(c.cantidad) || 1)), 0);

            const idAGuardar = forceNew ? null : draftActivo?.id;

            const res = await guardarPresupuestoPami(key, { items: carrito, codigos, total, oncoplan, opId: draftActivo?.opId || null }, { usuario: usuarioActual(), id: idAGuardar });

            setDraftActivo({ ...draftActivo, id: res.id, items: carrito, codigos, total, oncoplan });
            mostrarFlash(forceNew ? "¡Nuevo presupuesto guardado!" : (idAGuardar ? "¡Borrador actualizado!" : "¡Presupuesto guardado!"));

            setPaso(1);
        } catch (e) { alert(e.message); } finally { setSaving(false); }
    };

    const agregarCodigo = () => {
        if (!formCodigo.codigo && !formCodigo.descripcion) return;
        setCodigos([...codigos, { id: `cod-${Date.now()}`, ...formCodigo, monto: Number(formCodigo.monto) || 0, cantidad: Number(formCodigo.cantidad) || 1 }]);
        setFormCodigo({ codigo: "", descripcion: "", monto: "", cantidad: "1" });
        setBusquedaCodigo("");
    };

    const sugerenciasCodigos = useMemo(() => {
        const q = busquedaCodigo.trim();
        if (q.length < 2 || !fuse) return [];
        if (/^[\d.\s]+$/.test(q)) {
            const digits = q.replace(/\D/g, '');
            return nomenclador.filter(n => n.codigo && n.codigo.replace(/\D/g, '').includes(digits)).slice(0, 15);
        }
        return fuse.search(q, { limit: 15 }).map(r => r.item);
    }, [busquedaCodigo, nomenclador, fuse]);

    const seleccionarCodigoNomenclador = (c) => {
        const descCorta = c.descripcion && c.descripcion.length > 30 ? c.descripcion.substring(0, 30) + "..." : c.descripcion;
        setFormCodigo({ ...formCodigo, codigo: c.codigo, descripcion: descCorta, monto: c.origen === 'PAMI' ? (c.monto || "") : "" });
        setBusquedaCodigo("");
    };

    const total = carrito.reduce((s, c) => s + c.precio * (Number(c.cantidad) || 0), 0) + codigos.reduce((s, c) => s + ((Number(c.monto) || 0) * (Number(c.cantidad) || 1)), 0);

    const renderPaso1 = () => (
        <div className={styles.card}>
            <h3 className={styles.cardTitle}>Paso 1: Datos del Paciente</h3>
            <PacienteFormBasico paciente={paciente} onChange={(p) => setPaciente({ ...paciente, ...p })} onDniBlur={() => buscarPaciente()} oncoplan={oncoplan} onOncoplanChange={setOncoplan} statusText={estado === "buscando" ? "Buscando..." : estado === "existente" ? "Paciente encontrado" : ""} pacientesDb={pacientesDb} />
            {borradores.length > 0 && (
                <div style={{ marginTop: "2rem" }}>
                    <h4 className={styles.sub}>Borradores existentes</h4>
                    <BorradoresList borradores={borradores.map((b) => ({ ...b, pacienteDni: paciente.dni, raw: b }))} onAbrir={cargarBorrador} onEliminar={() => { }} showPaciente={false} />
                </div>
            )}
            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
                {borradores.length > 0 && <button type="button" className={styles.btn} onClick={iniciarNuevoBorrador}>+ Crear Nuevo Borrador</button>}
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => { if (!paciente.dni || paciente.dni.length < 7) return alert("Ingresá un DNI válido."); setPaso(2); }}>Ir a Prestaciones →</button>
            </div>
        </div>
    );

    const renderPaso2 = () => (
        <div className={styles.card}>
            <h3 className={styles.cardTitle}>Paso 2: Prestaciones (Códigos)</h3>
            <div className={styles.codigoForm}>
                <label className={styles.field} style={{ position: "relative" }}>
                    <span>Buscar en Nomencladores (Código o Palabra)</span>
                    <input className={styles.input} value={busquedaCodigo} onChange={e => setBusquedaCodigo(e.target.value)} placeholder="Ej: 65.00.01, 'Consulta'..." />
                    {busquedaCodigo.trim().length >= 2 && (
                        <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", listStyle: "none", padding: ".4rem", margin: ".2rem 0 0 0", boxShadow: "var(--shadow)", maxHeight: "250px", overflowY: "auto" }}>
                            {sugerenciasCodigos.length > 0 ? (
                                sugerenciasCodigos.map((c, idx) => (
                                    <li key={`${c.origen}-${c.codigo}-${idx}`}>
                                        <div onMouseDown={(e) => { e.preventDefault(); seleccionarCodigoNomenclador(c); }} style={{ padding: ".5rem", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                            <div>
                                                <span style={{ fontSize: "0.65rem", padding: "2px 4px", borderRadius: "4px", background: c.origen === "PAMI" ? "#e11d48" : "#2563eb", color: "#fff", marginRight: "8px", fontWeight: "bold" }}>{c.origen}</span>
                                                <strong>{c.codigo}</strong> - {c.descripcion}
                                            </div>
                                        </div>
                                    </li>
                                ))
                            ) : (<li style={{ padding: ".5rem", fontSize: ".85rem", color: "var(--muted)" }}>No se encontraron resultados.</li>)}
                        </ul>
                    )}
                </label>
                <div className={styles.codigoRow}>
                    <label className={styles.field}><span>Código</span><input className={styles.input} value={formCodigo.codigo} onChange={e => setFormCodigo({ ...formCodigo, codigo: e.target.value })} /></label>
                    <label className={styles.field}><span>Cant.</span><input className={styles.input} type="number" value={formCodigo.cantidad} onChange={e => setFormCodigo({ ...formCodigo, cantidad: e.target.value })} /></label>
                </div>
                <label className={styles.field}><span>Descripción (Max 30 carac.)</span><input className={styles.input} value={formCodigo.descripcion} onChange={e => setFormCodigo({ ...formCodigo, descripcion: e.target.value })} maxLength={30} /></label>
                <label className={styles.field}><span>Monto (Opcional)</span><input className={styles.input} value={formCodigo.monto} onChange={e => setFormCodigo({ ...formCodigo, monto: e.target.value })} placeholder="0,00" /></label>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={agregarCodigo}>+ Agregar Código</button>
            </div>
            {codigos.map((c, i) => (
                <div key={i} className={styles.codigoItem}>
                    <div><strong>{c.codigo || "Práctica"}</strong> - {c.descripcion} (x{c.cantidad})</div>
                    <div>{formatCurrency((c.monto) * c.cantidad)} <button className={styles.btn} style={{ marginLeft: 10, padding: "2px 8px", minHeight: "auto" }} onClick={() => setCodigos(codigos.filter((_, idx) => idx !== i))}>✕</button></div>
                </div>
            ))}
            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
                <button type="button" className={styles.btn} onClick={() => setPaso(1)}>← Volver</button>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setPaso(3)}>Ir a Medicamentos →</button>
            </div>
        </div>
    );

    const renderPaso3 = () => (
        <div className={styles.card}>
            <h3 className={styles.cardTitle}>Paso 3: Medicación y Descartables</h3>
            <CatalogoProductos items={items} onAgregar={(item, qty) => {
                setCarrito(prev => {
                    const existing = prev.find(x => x.id === `${item.categoria}:${item.key}`);
                    if (existing) return prev.map(x => x.id === existing.id ? { ...x, cantidad: x.cantidad + qty } : x);
                    return [...prev, { id: `${item.categoria}:${item.key}`, nombre: item.nombre, precio: item.precioFacturacion, cantidad: qty }];
                });
            }} />
            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
                <button type="button" className={styles.btn} onClick={() => setPaso(2)}>← Volver</button>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setPaso(4)}>Ver Total →</button>
            </div>
        </div>
    );

    const renderPaso4 = () => (
        <div className={styles.card}>
            <h3 className={styles.cardTitle}>Paso 4: Total y Resumen</h3>

            <div className={styles.cartList}>
                {/* LISTA DE MEDICAMENTOS */}
                {carrito.map(c => (
                    <div key={c.id} className={styles.cartItem}>
                        <div><div className={styles.cartItemName}>{c.nombre}</div><div className={styles.cartItemPrice}>{formatCurrency(c.precio)} c/u</div></div>
                        <div className={styles.cartItemQty}>
                            <input className={styles.input} style={{ width: 60, padding: 4, textAlign: "center" }} type="number" value={c.cantidad} onChange={e => setCarrito(carrito.map(x => x.id === c.id ? { ...x, cantidad: Number(e.target.value) } : x))} />
                        </div>
                        <div className={styles.cartItemSubtotal}>{formatCurrency(c.precio * c.cantidad)}</div>
                        <button className={styles.btn} style={{ color: "red", borderColor: "transparent" }} onClick={() => setCarrito(carrito.filter(x => x.id !== c.id))}>Eliminar</button>
                    </div>
                ))}

                {/* LISTA DE CÓDIGOS PAMI CON EDICIÓN DE CANT Y MONTO */}
                {codigos.map(c => (
                    <div key={c.id} className={styles.cartItem} style={{ background: "rgba(255,255,255,0.02)", flexWrap: "wrap" }}>
                        <div style={{ flex: "1 1 200px" }}>
                            <div className={styles.cartItemName}>Código: {c.codigo}</div>
                            <div className={styles.cartItemPrice}>{c.descripcion}</div>
                        </div>
                        <div className={styles.cartItemQty} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Cant:</label>
                            <input
                                className={styles.input}
                                style={{ width: 60, padding: 4, textAlign: "center", minHeight: "30px" }}
                                type="number"
                                value={c.cantidad}
                                onChange={(e) => {
                                    const newCant = Number(e.target.value) || 0;
                                    setCodigos(codigos.map(x => x.id === c.id ? { ...x, cantidad: newCant } : x));
                                }}
                            />
                            <label style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "8px" }}>Monto:</label>
                            <input
                                className={styles.input}
                                style={{ width: 80, padding: 4, textAlign: "center", minHeight: "30px" }}
                                type="number"
                                value={c.monto || ""}
                                onChange={(e) => {
                                    const newMonto = Number(e.target.value) || 0;
                                    setCodigos(codigos.map(x => x.id === c.id ? { ...x, monto: newMonto } : x));
                                }}
                                placeholder="$ 0"
                            />
                        </div>
                        <div className={styles.cartItemSubtotal} style={{ minWidth: "80px", textAlign: "right" }}>
                            {formatCurrency((Number(c.monto) || 0) * (Number(c.cantidad) || 1))}
                        </div>
                        <button className={styles.btn} style={{ color: "red", borderColor: "transparent" }} onClick={() => setCodigos(codigos.filter(x => x.id !== c.id))}>Eliminar</button>
                    </div>
                ))}

                {carrito.length === 0 && codigos.length === 0 && <div className={styles.empty}>No hay ítems cargados.</div>}
            </div>

            <div className={styles.cartTotalBox}>
                <span>Total Presupuesto:</span>
                <span style={{ color: "var(--accent)" }}>{formatCurrency(total)}</span>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "space-between", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "1rem" }}>
                    <button type="button" className={styles.btn} onClick={() => setPaso(3)}>← Volver</button>
                    <button type="button" className={styles.btn} style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={limpiarCarrito} disabled={total === 0}>
                        🗑️ Limpiar Carrito
                    </button>
                </div>

                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <button type="button" className={styles.btn} onClick={imprimir} disabled={total === 0}>🖨️ Imprimir</button>

                    {draftActivo?.id ? (
                        <>
                            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => guardarTodo(false)} disabled={saving || total === 0}>
                                {saving ? "Guardando..." : "Actualizar Borrador"}
                            </button>
                            <button type="button" className={styles.btn} onClick={() => guardarTodo(true)} disabled={saving || total === 0}>
                                {saving ? "Guardando..." : "Guardar como Nuevo"}
                            </button>
                        </>
                    ) : (
                        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => guardarTodo(false)} disabled={saving || total === 0}>
                            {saving ? "Guardando..." : "Guardar Nuevo Borrador"}
                        </button>
                    )}
                </div>
            </div>

            <div style={{ display: "none" }}>
                <PresupuestoImprimible ref={printRef} paciente={paciente} items={carrito} codigos={codigos} total={total} oncoplan={oncoplan} nro={draftActivo?.id ? draftActivo.id.slice(-6).toUpperCase() : "NUEVO"} />
            </div>
        </div>
    );

    return (
        <>
            {flash && <div className={styles.toast}>{flash}</div>}
            <div className={styles.wizardNav}>
                <div className={`${styles.wizardStep} ${paso === 1 ? styles.wizardStepActive : styles.wizardStepDone}`} onClick={() => setPaso(1)}>1. Paciente</div>
                <div className={`${styles.wizardStep} ${paso === 2 ? styles.wizardStepActive : (paso > 2 ? styles.wizardStepDone : "")}`} onClick={() => setPaso(2)}>2. Prestaciones</div>
                <div className={`${styles.wizardStep} ${paso === 3 ? styles.wizardStepActive : (paso > 3 ? styles.wizardStepDone : "")}`} onClick={() => setPaso(3)}>3. Med y Desc</div>
                <div className={`${styles.wizardStep} ${paso === 4 ? styles.wizardStepActive : ""}`} onClick={() => setPaso(4)}>4. Total</div>
            </div>
            <div className={styles.wizardContent}>
                {paso === 1 && renderPaso1()}
                {paso === 2 && renderPaso2()}
                {paso === 3 && renderPaso3()}
                {paso === 4 && renderPaso4()}
            </div>
        </>
    );
}
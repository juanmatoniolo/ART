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

// Agregamos hcPiso y hcUti
const PACIENTE_VACIO = { dni: "", afiliado: "", nombreCompleto: "", hcPiso: "", hcUti: "", sexo: "", fechaNacimiento: "", telefono: "", domicilio: "", localidad: "", provincia: "", famNombre: "", famParentezco: "", famTelefono: "", cirujano: "", ayudante1: "", ayudante2: "", anestesista: "" };

const desdeDb = (d) => ({
    dni: d.dni || "", afiliado: d.afiliado || "", hcPiso: d.historiaClinicaPiso || "", hcUti: d.historiaClinicaUti || "", sexo: d.sexo || "",
    fechaNacimiento: d.fechaNacimiento || "", telefono: d.telefono || "", domicilio: d.domicilio || "",
    localidad: d.localidad || "", provincia: d.provincia || "", cirujano: d.cirujano || "",
    ayudante1: d.ayudante1 || "", ayudante2: d.ayudante2 || "", anestesista: d.anestesista || "",
    nombreCompleto: [d.apellido, d.nombre].filter(Boolean).join(" ").trim(),
    famNombre: d.familiar?.nombre || "", famParentezco: d.familiar?.parentezco || "", famTelefono: d.familiar?.telefono || "",
});

const aDb = (f) => {
    const { famNombre, famParentezco, famTelefono, nombreCompleto, ...resto } = f;
    const partes = String(nombreCompleto || "").trim().split(/\s+/).filter(Boolean);
    return {
        ...resto,
        apellido: (partes[0] || "").toUpperCase(),
        nombre: partes.slice(1).join(" ").toUpperCase(),
        historiaClinicaPiso: (f.hcPiso || "").trim(),
        historiaClinicaUti: (f.hcUti || "").trim(),
        familiar: {
            nombre: (famNombre || "").trim().toUpperCase(),
            parentezco: (famParentezco || "").trim().toUpperCase(),
            telefono: (famTelefono || "").trim()
        }
    };
};

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

const LOCAL_STORAGE_KEY = "pami:presupuesto:wizard";

const parseNum = (val) => {
    if (val === undefined || val === null || val === "") return 0;
    const num = parseFloat(String(val).replace(",", "."));
    return isNaN(num) ? 0 : num;
};

const parseUnimedical = (data) => {
    let flat = [];
    if (!data || !data.nomencladores) return flat;
    data.nomencladores.forEach(nom => {
        nom.secciones?.forEach(sec => {
            sec.practicas?.forEach(prac => {
                flat.push({
                    codigo: prac.codigo || "",
                    descripcion: prac.descripcion || "",
                    origen: 'UNIMEDICAL',
                    especialidad: nom.nombre,
                    nivel: prac.nivel,
                    esCX: true
                });
            });
        });
    });
    return flat;
};

export default function PresupuestoTab({ items, pacientesDb = [], initialPaciente = null, initialDraft = null, onInitialLoaded }) {
    const [hasMounted, setHasMounted] = useState(false);
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

    const [formCodigo, setFormCodigo] = useState({
        codigo: "", descripcion: "", monto: "", cantidad: "1", medico: "",
        esCX: false, cirujano: "", ayudante1: "", ayudante2: "", anestesista: ""
    });
    const [nomenclador, setNomenclador] = useState([]);
    const [unimedicalNomenclador, setUnimedicalNomenclador] = useState([]);
    const [busquedaCodigo, setBusquedaCodigo] = useState("");

    const printRef = useRef(null);
    const imprimir = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Presupuesto-${paciente.nombreCompleto || "PAMI"}`,
        pageStyle: `@page { size: A4 portrait; margin: 10mm; } @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }`,
    });

    const mostrarFlash = (m, ms = 3500) => { setFlash(m); setTimeout(() => setFlash(""), ms); };

    useEffect(() => {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                if (data.paciente) setPaciente(data.paciente);
                setOncoplan(data.oncoplan || false);
                setCarrito(data.carrito || []);
                setCodigos(data.codigos || []);
                setDraftActivo(data.draftActivo || null);
                setPaso(data.paso || 1);
            } catch (e) {
                console.error("Error al recuperar de memoria", e);
            }
        }
        setHasMounted(true);
    }, []);

    useEffect(() => {
        if (!hasMounted) return;
        const timer = setTimeout(() => {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify({
                paciente, oncoplan, carrito, codigos, draftActivo, paso
            }));
        }, 500);
        return () => clearTimeout(timer);
    }, [paciente, oncoplan, carrito, codigos, draftActivo, paso, hasMounted]);

    useEffect(() => {
        const URL_NACIONAL = '/archivos/nacional-nomenclador.json';
        const URL_PAMI = '/archivos/pami-nomenclador.json';
        const URL_UNIMEDICAL = '/archivos/NomecladorUnimedical.json';

        Promise.all([
            fetch(URL_PAMI).then(r => r.json()).catch(() => ({ items: [] })),
            fetch(URL_NACIONAL).then(r => r.json()).catch(() => ([])),
            fetch(URL_UNIMEDICAL).then(r => r.json()).catch(() => ({}))
        ]).then(([dataPami, dataNacional, dataUnimedical]) => {
            const itemsPami = (dataPami.items || []).map(i => ({ ...i, origen: 'PAMI' }));
            const arrayNacional = Array.isArray(dataNacional) ? dataNacional : (dataNacional.items || []);
            const itemsNacional = arrayNacional.map(i => ({ ...i, origen: 'NACIONAL', monto: null }));
            setNomenclador([...itemsPami, ...itemsNacional]);
            setUnimedicalNomenclador(parseUnimedical(dataUnimedical));
        });
    }, []);

    const fuse = useMemo(() => {
        if (!nomenclador.length) return null;
        return new Fuse(nomenclador, { keys: [{ name: 'codigo', weight: 3 }, { name: 'descripcion', weight: 1 }, { name: 'origen', weight: 0.5 }], threshold: 0.3, ignoreLocation: true });
    }, [nomenclador]);

    const fuseUnimedical = useMemo(() => {
        if (!unimedicalNomenclador.length) return null;
        return new Fuse(unimedicalNomenclador, { keys: [{ name: 'codigo', weight: 3 }, { name: 'descripcion', weight: 1 }, { name: 'especialidad', weight: 0.5 }], threshold: 0.3, ignoreLocation: true });
    }, [unimedicalNomenclador]);

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
        setDraftActivo(b);
        mostrarFlash(b.id ? "Borrador cargado. Podés editarlo." : "Borrador cargado.");
    };

    const iniciarNuevoBorrador = () => { setCarrito([]); setCodigos([]); setDraftActivo(null); mostrarFlash("Presupuesto limpio. Podés empezar de cero."); };

    const limpiarCarrito = () => {
        if (!confirm("¿Estás seguro de que querés vaciar todo el presupuesto actual?")) return;
        setCarrito([]); setCodigos([]); setDraftActivo(null);
        setFormCodigo({ codigo: "", descripcion: "", monto: "", cantidad: "1", medico: "", esCX: false, cirujano: "", ayudante1: "", ayudante2: "", anestesista: "" });
        setBusquedaCodigo(""); mostrarFlash("Carrito vaciado con éxito.");
    };

    const limpiarCodigos = () => { if (!confirm("¿Vaciar la lista de prestaciones/códigos?")) return; setCodigos([]); };

    const guardarPaciente = async () => {
        if (!paciente.nombreCompleto.trim()) throw new Error("Completá apellido y nombre.");
        const key = dniKey(paciente.dni);
        if (key.length < 7) throw new Error("DNI inválido.");
        if (!paciente.afiliado.trim()) throw new Error("Ingresá el N° de afiliado PAMI.");

        const pacienteAGuardar = { ...paciente };
        Object.keys(pacienteAGuardar).forEach(k => {
            if (typeof pacienteAGuardar[k] === 'string') pacienteAGuardar[k] = pacienteAGuardar[k].toUpperCase();
        });
        await asegurarPacientePami(aDb(pacienteAGuardar), { usuario: usuarioActual() });
        return key;
    };

    const guardarTodo = async (forceNew = false) => {
        try {
            setSaving(true);
            const key = await guardarPaciente();
            const carritoAGuardar = carrito.map(c => ({ ...c, cantidad: parseNum(c.cantidad), nombre: c.nombre.toUpperCase() }));
            const codigosAGuardar = codigos.map(c => ({
                ...c, cantidad: parseNum(c.cantidad), codigo: (c.codigo || "").toUpperCase(), descripcion: (c.descripcion || "").toUpperCase(),
                medico: (c.medico || "").toUpperCase(), cirujano: (c.cirujano || "").toUpperCase(), ayudante1: (c.ayudante1 || "").toUpperCase(), ayudante2: (c.ayudante2 || "").toUpperCase(), anestesista: (c.anestesista || "").toUpperCase()
            }));
            const total = carritoAGuardar.reduce((s, c) => s + c.precio * c.cantidad, 0) + codigosAGuardar.reduce((s, c) => s + ((Number(c.monto) || 0) * c.cantidad), 0);
            const idAGuardar = forceNew ? null : draftActivo?.id;

            const res = await guardarPresupuestoPami(key, { items: carritoAGuardar, codigos: codigosAGuardar, total, oncoplan, opId: draftActivo?.opId || null }, { usuario: usuarioActual(), id: idAGuardar });
            setDraftActivo({ ...draftActivo, id: res.id, items: carritoAGuardar, codigos: codigosAGuardar, total, oncoplan });
            mostrarFlash(forceNew ? "¡Nuevo presupuesto guardado!" : (idAGuardar ? "¡Borrador actualizado!" : "¡Presupuesto guardado!"));
            localStorage.removeItem(LOCAL_STORAGE_KEY); setPaso(1);
        } catch (e) { alert(e.message); } finally { setSaving(false); }
    };

    const agregarCodigo = () => {
        if (!formCodigo.codigo && !formCodigo.descripcion) return;
        setCodigos([...codigos, { id: `cod-${Date.now()}`, ...formCodigo, codigo: formCodigo.codigo.toUpperCase(), descripcion: formCodigo.descripcion.toUpperCase(), medico: formCodigo.medico.toUpperCase(), cirujano: formCodigo.cirujano.toUpperCase(), ayudante1: formCodigo.ayudante1.toUpperCase(), ayudante2: formCodigo.ayudante2.toUpperCase(), anestesista: formCodigo.anestesista.toUpperCase(), monto: parseNum(formCodigo.monto), cantidad: String(formCodigo.cantidad).replace(".", ",") }]);
        setFormCodigo({ codigo: "", descripcion: "", monto: "", cantidad: "1", medico: "", esCX: formCodigo.esCX, cirujano: "", ayudante1: "", ayudante2: "", anestesista: "" });
        setBusquedaCodigo("");
    };

    const sugerenciasCodigos = useMemo(() => {
        const q = busquedaCodigo.trim(); if (q.length < 2) return [];
        if (formCodigo.esCX) {
            if (!fuseUnimedical) return [];
            if (/^[\d.\s]+$/.test(q)) return unimedicalNomenclador.filter(n => n.codigo && n.codigo.replace(/\D/g, '').includes(q.replace(/\D/g, ''))).slice(0, 15);
            return fuseUnimedical.search(q, { limit: 15 }).map(r => r.item);
        } else {
            if (!fuse) return [];
            if (/^[\d.\s]+$/.test(q)) return nomenclador.filter(n => n.codigo && n.codigo.replace(/\D/g, '').includes(q.replace(/\D/g, ''))).slice(0, 15);
            return fuse.search(q, { limit: 15 }).map(r => r.item);
        }
    }, [busquedaCodigo, nomenclador, unimedicalNomenclador, fuse, fuseUnimedical, formCodigo.esCX]);

    const seleccionarCodigoNomenclador = (c) => {
        const descCorta = c.descripcion && c.descripcion.length > 100 ? c.descripcion.substring(0, 100).toUpperCase() + "..." : c.descripcion.toUpperCase();
        setFormCodigo({ ...formCodigo, codigo: c.codigo.toUpperCase(), descripcion: descCorta, monto: c.origen === 'PAMI' ? (c.monto || "") : "" });
        setBusquedaCodigo("");
    };

    const total = carrito.reduce((s, c) => s + c.precio * parseNum(c.cantidad), 0) + codigos.reduce((s, c) => s + ((Number(c.monto) || 0) * parseNum(c.cantidad)), 0);

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

            <div style={{ marginBottom: "1.5rem", padding: "0.75rem", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: "1px solid var(--border)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "0.95rem", fontWeight: "bold" }}>
                    <input type="checkbox" checked={formCodigo.esCX} onChange={(e) => setFormCodigo({ ...formCodigo, esCX: e.target.checked })} style={{ width: "18px", height: "18px", cursor: "pointer" }} />
                    ¿Es Cirugía (CX)? (Buscar en Nomenclador Unimedical)
                </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "0.5rem", alignItems: "end", marginBottom: "1.5rem" }}>
                <label className={styles.field} style={{ position: "relative", gridColumn: "1 / -1", marginBottom: "0.5rem" }}>
                    <span>Buscar en Nomencladores (Código o Palabra)</span>
                    <input className={styles.input} value={busquedaCodigo} onChange={e => setBusquedaCodigo(e.target.value)} placeholder={formCodigo.esCX ? "Ej: 10.91.01 (Unimedical)..." : "Ej: 65.00.01, 'Consulta'..."} />
                    {busquedaCodigo.trim().length >= 2 && (
                        <ul style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "8px", listStyle: "none", padding: ".4rem", margin: ".2rem 0 0 0", boxShadow: "var(--shadow)", maxHeight: "250px", overflowY: "auto" }}>
                            {sugerenciasCodigos.length > 0 ? (
                                sugerenciasCodigos.map((c, idx) => (
                                    <li key={`${c.origen}-${c.codigo}-${idx}`}>
                                        <div onMouseDown={(e) => { e.preventDefault(); seleccionarCodigoNomenclador(c); }} style={{ padding: ".5rem", cursor: "pointer", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }} onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-2)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                                            <div>
                                                <span style={{ fontSize: "0.65rem", padding: "2px 4px", borderRadius: "4px", background: c.origen === "PAMI" ? "#e11d48" : c.origen === "UNIMEDICAL" ? "#8b5cf6" : "#2563eb", color: "#fff", marginRight: "8px", fontWeight: "bold" }}>
                                                    {c.origen} {c.especialidad && `- ${c.especialidad}`}
                                                </span>
                                                <strong>{c.codigo}</strong> - {c.descripcion}
                                            </div>
                                        </div>
                                    </li>
                                ))
                            ) : (<li style={{ padding: ".5rem", fontSize: ".85rem", color: "var(--muted)" }}>No se encontraron resultados.</li>)}
                        </ul>
                    )}
                </label>

                <label className={styles.field}><span>Código</span><input className={styles.input} value={formCodigo.codigo} onChange={e => setFormCodigo({ ...formCodigo, codigo: e.target.value.toUpperCase() })} /></label>
                <label className={styles.field} style={{ gridColumn: "span 2" }}><span>Descripción</span><input className={styles.input} value={formCodigo.descripcion} onChange={e => setFormCodigo({ ...formCodigo, descripcion: e.target.value.toUpperCase() })} maxLength={100} /></label>
                <label className={styles.field}><span>Monto</span><input className={styles.input} type="number" value={formCodigo.monto} onChange={e => setFormCodigo({ ...formCodigo, monto: e.target.value })} placeholder="0.00" /></label>
                <label className={styles.field}><span>Cant.</span><input className={styles.input} type="text" inputMode="decimal" value={formCodigo.cantidad} onChange={e => setFormCodigo({ ...formCodigo, cantidad: e.target.value })} /></label>

                {formCodigo.esCX && (
                    <>
                        <label className={styles.field}><span>Cirujano</span><input className={styles.input} value={formCodigo.cirujano} onChange={e => setFormCodigo({ ...formCodigo, cirujano: e.target.value.toUpperCase() })} placeholder="DR. APELLIDO" /></label>
                        <label className={styles.field}><span>Ayudante 1</span><input className={styles.input} value={formCodigo.ayudante1} onChange={e => setFormCodigo({ ...formCodigo, ayudante1: e.target.value.toUpperCase() })} placeholder="DR. APELLIDO" /></label>
                        <label className={styles.field}><span>Ayudante 2</span><input className={styles.input} value={formCodigo.ayudante2} onChange={e => setFormCodigo({ ...formCodigo, ayudante2: e.target.value.toUpperCase() })} placeholder="DR. APELLIDO" /></label>
                        <label className={styles.field}><span>Anestesista</span><input className={styles.input} value={formCodigo.anestesista} onChange={e => setFormCodigo({ ...formCodigo, anestesista: e.target.value.toUpperCase() })} placeholder="DR. APELLIDO" /></label>
                    </>
                )}

                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={agregarCodigo} style={{ height: "42px", gridColumn: formCodigo.esCX ? "1 / -1" : "auto", marginTop: formCodigo.esCX ? "0.5rem" : "0" }}>+ Agregar</button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <h4 style={{ margin: 0, fontSize: "0.9rem", color: "var(--muted)" }}>Códigos Agregados</h4>
                {codigos.length > 0 && (
                    <button type="button" className={styles.btn} style={{ color: "var(--danger)", borderColor: "transparent", padding: "0.25rem 0.5rem", minHeight: "auto", fontSize: "0.8rem" }} onClick={limpiarCodigos}>🗑️ Limpiar todos</button>
                )}
            </div>

            <div className={styles.cartList}>
                {codigos.map((c) => (
                    <div key={c.id} className={styles.cartItem} style={{ padding: "0.75rem", flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "flex-start" }}>
                            <div>
                                <div className={styles.cartItemName}>{c.codigo || "PRÁCTICA"} - {c.descripcion}</div>
                                {c.esCX && (<div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "4px", lineHeight: 1.4 }}><b>Cirujano:</b> {c.cirujano || "—"} | <b>Ayudantes:</b> {c.ayudante1 || "—"}, {c.ayudante2 || "—"} | <b>Anestesista:</b> {c.anestesista || "—"}</div>)}
                            </div>
                            <strong style={{ minWidth: 80, textAlign: "right" }}>{formatCurrency((c.monto || 0) * parseNum(c.cantidad))}</strong>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", justifyContent: "flex-end", width: "100%" }}>
                            {!c.esCX && (<input className={styles.input} style={{ width: 150, minHeight: 32, padding: "4px", fontSize: "0.8rem" }} placeholder="Médico..." value={c.medico || ""} onChange={(e) => { setCodigos(codigos.map(x => x.id === c.id ? { ...x, medico: e.target.value.toUpperCase() } : x)); }} />)}
                            <label style={{ fontSize: "0.75rem", color: "var(--muted)" }}>CANT:</label>
                            <input className={styles.input} style={{ width: 60, minHeight: 32, padding: "4px", textAlign: "center" }} type="text" inputMode="decimal" value={c.cantidad} onChange={(e) => { setCodigos(codigos.map(x => x.id === c.id ? { ...x, cantidad: e.target.value } : x)); }} />
                            <label style={{ fontSize: "0.75rem", color: "var(--muted)", marginLeft: "0.5rem" }}>MONTO:</label>
                            <input className={styles.input} style={{ width: 90, minHeight: 32, padding: "4px", textAlign: "center" }} type="number" value={c.monto || ""} onChange={(e) => { const val = Number(e.target.value) || 0; setCodigos(codigos.map(x => x.id === c.id ? { ...x, monto: val } : x)); }} placeholder="$ 0" />
                            <button className={styles.btn} style={{ color: "var(--danger)", borderColor: "transparent", padding: "0.25rem 0.5rem", minHeight: 32 }} onClick={() => setCodigos(codigos.filter(x => x.id !== c.id))}>🗑️</button>
                        </div>
                    </div>
                ))}
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "2rem", justifyContent: "flex-end" }}>
                <button type="button" className={styles.btn} onClick={() => setPaso(1)}>← Volver</button>
                <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setPaso(3)}>Ir a Medicamentos →</button>
            </div>
        </div>
    );

    const renderPaso3 = () => (
        <div className={styles.card}>
            <h3 className={styles.cardTitle}>Paso 3: Medicación y Descartables</h3>
            <div style={{ paddingBottom: "1rem" }}>
                <CatalogoProductos items={items} onAgregar={(item, qty) => {
                    setCarrito(prev => {
                        const existing = prev.find(x => x.id === `${item.categoria}:${item.key}`);
                        if (existing) {
                            const currentQty = parseNum(existing.cantidad);
                            return prev.map(x => x.id === existing.id ? { ...x, cantidad: String(currentQty + qty).replace(".", ",") } : x);
                        }
                        return [...prev, { id: `${item.categoria}:${item.key}`, nombre: item.nombre.toUpperCase(), precio: item.precioFacturacion, cantidad: String(qty).replace(".", ",") }];
                    });
                }} />
            </div>
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
                {carrito.map(c => (
                    <div key={c.id} className={styles.cartItem}>
                        <div><div className={styles.cartItemName}>{c.nombre}</div></div>
                        <div className={styles.cartItemQty}>
                            <div className={styles.qtyGroup}>
                                <button className={styles.qtyBtn} onClick={() => { const current = parseNum(c.cantidad); setCarrito(carrito.map(x => x.id === c.id ? { ...x, cantidad: String(Math.max(0, current - 1)).replace(".", ",") } : x)); }}>−</button>
                                <input className={styles.qtyInput} type="text" inputMode="decimal" value={c.cantidad} onChange={e => setCarrito(carrito.map(x => x.id === c.id ? { ...x, cantidad: e.target.value } : x))} />
                                <button className={styles.qtyBtn} onClick={() => { const current = parseNum(c.cantidad); setCarrito(carrito.map(x => x.id === c.id ? { ...x, cantidad: String(current + 1).replace(".", ",") } : x)); }}>+</button>
                            </div>
                        </div>
                        <div className={styles.cartItemSubtotal} style={{ textAlign: "right" }}>{formatCurrency(c.precio * parseNum(c.cantidad))}</div>
                        <button className={styles.btn} style={{ color: "var(--danger)", borderColor: "transparent", padding: "0.25rem 0.5rem", minHeight: "32px" }} onClick={() => setCarrito(carrito.filter(x => x.id !== c.id))}>🗑️</button>
                    </div>
                ))}

                {codigos.map(c => (
                    <div key={c.id} className={styles.cartItem}>
                        <div>
                            <div className={styles.cartItemName}>CÓDIGO: {c.codigo}</div>
                            <div className={styles.cartItemPrice}>
                                {c.esCX ? (<><div>{c.descripcion}</div><div style={{ fontSize: "0.75rem" }}>Cirujano: {c.cirujano} | Ayudantes: {c.ayudante1}, {c.ayudante2} | Anestesista: {c.anestesista}</div></>) : (<>{c.medico ? `DR. ${c.medico} - ` : ""}{c.descripcion}</>)}
                            </div>
                        </div>
                        <div className={styles.cartItemQty}>
                            <div className={styles.qtyGroup}>
                                <button className={styles.qtyBtn} onClick={() => { const current = parseNum(c.cantidad); setCodigos(codigos.map(x => x.id === c.id ? { ...x, cantidad: String(Math.max(0, current - 1)).replace(".", ",") } : x)); }}>−</button>
                                <input className={styles.qtyInput} type="text" inputMode="decimal" value={c.cantidad} onChange={e => setCodigos(codigos.map(x => x.id === c.id ? { ...x, cantidad: e.target.value } : x))} />
                                <button className={styles.qtyBtn} onClick={() => { const current = parseNum(c.cantidad); setCodigos(codigos.map(x => x.id === c.id ? { ...x, cantidad: String(current + 1).replace(".", ",") } : x)); }}>+</button>
                            </div>
                        </div>
                        <div className={styles.cartItemSubtotal} style={{ textAlign: "right" }}>{formatCurrency((c.monto || 0) * parseNum(c.cantidad))}</div>
                        <button className={styles.btn} style={{ color: "var(--danger)", borderColor: "transparent", padding: "0.25rem 0.5rem", minHeight: "32px" }} onClick={() => setCodigos(codigos.filter(x => x.id !== c.id))}>🗑️</button>
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
                    <button type="button" className={styles.btn} style={{ color: "var(--danger)", borderColor: "var(--danger)" }} onClick={limpiarCarrito} disabled={total === 0}>🗑️ Limpiar Carrito</button>
                </div>
                <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
                    <button type="button" className={styles.btn} onClick={imprimir} disabled={total === 0}>🖨️ Imprimir</button>
                    {draftActivo?.id ? (
                        <>
                            <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => guardarTodo(false)} disabled={saving || total === 0}>{saving ? "Guardando..." : "Actualizar Borrador"}</button>
                            <button type="button" className={styles.btn} onClick={() => guardarTodo(true)} disabled={saving || total === 0}>{saving ? "Guardando..." : "Guardar como Nuevo"}</button>
                        </>
                    ) : (
                        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => guardarTodo(false)} disabled={saving || total === 0}>{saving ? "Guardando..." : "Guardar Nuevo Borrador"}</button>
                    )}
                </div>
            </div>

            <div style={{ display: "none" }}>
                <PresupuestoImprimible ref={printRef} paciente={paciente} items={carrito} codigos={codigos} total={total} oncoplan={oncoplan} nro={draftActivo?.id ? draftActivo.id.slice(-6).toUpperCase() : "NUEVO"} />
            </div>
        </div>
    );

    if (!hasMounted) return null;

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
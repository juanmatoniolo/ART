"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useReactToPrint } from "react-to-print";
import { getSession } from "@/utils/session";
import { formatCurrency, matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import {
    dniKey,
    obtenerPacientePami,
    asegurarPacientePami,
    guardarPresupuestoPami,
    eliminarPresupuestoPami,
} from "@/lib/pami";
import PresupuestoImprimible from "./PresupuestoImprimible";
import styles from "./insumosAdmin.module.css";
const p = styles;

/* ===========================================================
   Constantes
   =========================================================== */
const PRESENTACIONES = {
    medicamentos: {
        ampolla: "Ampolla", vial: "Vial", tabletas: "Tabletas", frasco: "Frasco",
        bolsa: "Bolsa", jeringa: "Jeringa", gasas: "Gasas", tubo: "Tubo", tiras: "Tiras",
    },
    descartables: {
        unidad: "Unidad", rollo: "Rollo", juego: "Juego", bolsa: "Bolsa",
        frasco: "Frasco", kit: "Kit", set: "Set", tubo: "Tubo",
    },
};
const labelPresentacion = (cat, v) => PRESENTACIONES[cat]?.[v] || v;

const fechaISO = (fecha) => {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
};

const MAX_VISIBLES = 30;
const MIN_BUSQUEDA = 2;

const CAMPOS = [
    "dni", "afiliado", "apellido", "nombre", "historiaClinica", "sexo",
    "fechaNacimiento", "telefono", "domicilio", "localidad", "provincia", "lugarNacimiento",
];

const PACIENTE_VACIO = {
    dni: "", afiliado: "", apellido: "", nombre: "", historiaClinica: "", sexo: "",
    fechaNacimiento: "", telefono: "", domicilio: "",
    localidad: "CHAJARÍ", provincia: "ENTRE RIOS", lugarNacimiento: "",
    famNombre: "", famParentezco: "", famTelefono: "",
};

// Firebase → formulario
const desdeDb = (d) => ({
    ...Object.fromEntries(CAMPOS.map((c) => [c, d[c] ?? ""])),
    famNombre: d.familiar?.nombre ?? "",
    famParentezco: d.familiar?.parentezco ?? "",
    famTelefono: d.familiar?.telefono ?? "",
});

// Formulario → Firebase (misma forma que usa el ingreso PAMI)
const aDb = (f) => {
    const { famNombre, famParentezco, famTelefono, ...resto } = f;
    const limpio = Object.fromEntries(
        Object.entries(resto).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
    );
    return {
        ...limpio,
        familiar: { nombre: famNombre.trim(), parentezco: famParentezco.trim(), telefono: famTelefono.trim() },
    };
};

const miles = (v) => {
    const d = String(v || "").replace(/\D/g, "");
    return d.length <= 8 ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d;
};

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

const itemsDe = (b) => (Array.isArray(b.items) ? b.items : Object.values(b.items || {}));

function Campo({ label, children }) {
    return (
        <label className={p.field}>
            <span>{label}</span>
            {children}
        </label>
    );
}

/* ===========================================================
   Página
   =========================================================== */
export default function PresupuestoPamiPage() {
    // Catálogo
    const [solapa, setSolapa] = useState("presupuesto");
    const [tipo, setTipo] = useState("todos");
    const [pacientesDb, setPacientesDb] = useState([]);
    const [desde, setDesde] = useState("");
    const [hasta, setHasta] = useState("");
    const [filtroCategoria, setFiltroCategoria] = useState("todos");
    const [edadDesde, setEdadDesde] = useState("");
    const [edadHasta, setEdadHasta] = useState("");
    const [items, setItems] = useState([]);
    const [busquedaPaciente, setBusquedaPaciente] = useState("");
    const [busquedaProducto, setBusquedaProducto] = useState("");
    const [periodoActivo, setPeriodoActivo] = useState("todo");

    // Paciente / presupuesto
    const [paciente, setPaciente] = useState(PACIENTE_VACIO);
    const [estadoPaciente, setEstadoPaciente] = useState(null); // null | buscando | nuevo | existente
    const [borradores, setBorradores] = useState([]);
    const [carrito, setCarrito] = useState([]);
    const [edicion, setEdicion] = useState(null); // { pacienteKey, id }
    const [saving, setSaving] = useState(false);
    const [mensaje, setMensaje] = useState("");

    const printRef = useRef(null);

    const flash = (m, ms = 3000) => {
        setMensaje(m);
        setTimeout(() => setMensaje(""), ms);
    };

    // ─── Catálogo desde Firebase ─────────────────────────────────
    useEffect(() => {
        const unsub = onValue(ref(db, "medydescartables"), (snap) => {
            if (!snap.exists()) return setItems([]);
            const data = snap.val();
            const lista = [];
            for (const categoria of ["medicamentos", "descartables"]) {
                Object.entries(data[categoria] || {}).forEach(([key, d]) => {
                    lista.push({
                        key,
                        categoria,
                        nombre: d.nombre || key.replace(/_/g, " "),
                        precioFacturacion: d.precioFacturacion ?? 0,
                        presentacion: d.presentacion || "unidad",
                        tipo: categoria === "medicamentos" ? "medicamento" : "descartable",
                        activo: d.activo !== false,
                    });
                });
            }
            setItems(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        const unsub = onValue(ref(db, "PAMI/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientesDb(Object.entries(data).map(([dni, paciente]) => ({ dni, ...paciente })));
        });
        return () => unsub();
    }, []);

    const consultaActiva = busquedaProducto.trim().length >= MIN_BUSQUEDA;
    const filtrados = useMemo(() => {
        if (!consultaActiva) return [];
        return items
            .filter((i) => i.activo && (tipo === "todos" || i.categoria === tipo) && matchesAllTerms(i.nombre, busquedaProducto))
            .slice(0, MAX_VISIBLES);
    }, [items, tipo, busquedaProducto, consultaActiva]);

    const pacientesFiltrados = useMemo(() => {
        const consulta = busquedaPaciente.trim();
        if (!consulta) return pacientesDb;
        return pacientesDb.filter((x) => matchesAllTerms(
            `${x.dni || ""} ${x.afiliado || ""} ${x.apellido || ""} ${x.nombre || ""}`,
            consulta
        ));
    }, [pacientesDb, busquedaPaciente]);

    const estadisticas = useMemo(() => {
        const hoy = new Date();
        const registros = [];
        for (const paciente of pacientesDb) {
            const nacimiento = paciente.fechaNacimiento ? new Date(`${paciente.fechaNacimiento}T00:00:00`) : null;
            const edad = nacimiento && !Number.isNaN(nacimiento.getTime()) ? Math.max(0, hoy.getFullYear() - nacimiento.getFullYear() - ((hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) ? 1 : 0)) : null;
            for (const [id, b] of Object.entries(paciente.medicamentos || {})) {
                const fechaMs = Number(b.createdAt || b.updatedAt || 0);
                const fecha = fechaMs ? new Date(fechaMs) : null;
                const fechaISO = fecha ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}` : "";
                if (desde && (!fechaISO || fechaISO < desde)) continue;
                if (hasta && (!fechaISO || fechaISO > hasta)) continue;
                if (edadDesde !== "" && (edad === null || edad < Number(edadDesde))) continue;
                if (edadHasta !== "" && (edad === null || edad > Number(edadHasta))) continue;
                const itemsB = itemsDe(b);
                const totalFiltrado = itemsB.filter(i => filtroCategoria === "todos" || i.categoria === filtroCategoria || (filtroCategoria === "medicamentos" && i.tipo === "medicamento") || (filtroCategoria === "descartables" && i.tipo === "descartable"));
                if (!totalFiltrado.length) continue;
                registros.push({ id, dni: paciente.dni || paciente.dni, paciente, fechaMs, edad, items: totalFiltrado, total: totalFiltrado.reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 0), 0) });
            }
        }
        const productos = {};
        let medicamentos = 0, descartables = 0, unidades = 0;
        for (const r of registros) for (const i of r.items) {
            const subtotal = (Number(i.precio) || 0) * (Number(i.cantidad) || 0);
            const categoria = i.categoria || (i.tipo === "medicamento" ? "medicamentos" : "descartables");
            if (categoria === "medicamentos" || i.tipo === "medicamento") medicamentos += subtotal; else descartables += subtotal;
            unidades += Number(i.cantidad) || 0;
            const key = i.nombre || i.key || "Sin nombre";
            productos[key] ||= { nombre: key, cantidad: 0, total: 0 };
            productos[key].cantidad += Number(i.cantidad) || 0;
            productos[key].total += subtotal;
        }
        const total = registros.reduce((s, r) => s + r.total, 0);
        const pacientesUnicos = new Set(registros.map(r => r.dni).filter(Boolean)).size;
        const porMes = {};
        for (const r of registros) { const d = r.fechaMs ? new Date(r.fechaMs) : null; if (!d) continue; const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; porMes[k] = (porMes[k] || 0) + r.total; }
        return { registros, total, medicamentos, descartables, unidades, pacientesUnicos, promedio: pacientesUnicos ? total / pacientesUnicos : 0, top: Object.values(productos).sort((a, b) => b.cantidad - a.cantidad).slice(0, 8), porMes: Object.entries(porMes).sort((a, b) => a[0].localeCompare(b[0])).slice(-8) };
    }, [pacientesDb, desde, hasta, edadDesde, edadHasta, filtroCategoria]);

    // ─── Carrito ─────────────────────────────────────────────────
    const cantidades = useMemo(
        () => Object.fromEntries(carrito.map((c) => [c.id, c.cantidad])),
        [carrito],
    );
    const total = useMemo(
        () => carrito.reduce((s, c) => s + c.precio * c.cantidad, 0),
        [carrito],
    );

    const agregar = (item) =>
        setCarrito((c) => {
            const id = `${item.categoria}:${item.key}`;
            if (c.some((x) => x.id === id))
                return c.map((x) => (x.id === id ? { ...x, cantidad: x.cantidad + 1 } : x));
            return [
                ...c,
                {
                    id,
                    categoria: item.categoria,
                    key: item.key,
                    nombre: item.nombre,
                    presentacion: labelPresentacion(item.categoria, item.presentacion),
                    precio: Number(item.precioFacturacion) || 0, // snapshot del precio
                    cantidad: 1,
                },
            ];
        });

    const cambiarCantidad = (id, v) =>
        setCarrito((c) =>
            c.map((x) => (x.id === id ? { ...x, cantidad: Math.max(1, parseInt(v, 10) || 1) } : x)),
        );

    const quitar = (id) => setCarrito((c) => c.filter((x) => x.id !== id));

    // ─── Paciente: búsqueda por DNI (la clave del nodo) ──────────
    async function buscarPaciente(raw = paciente.dni) {
        const key = dniKey(raw);
        if (key.length < 7) return;
        setEstadoPaciente("buscando");
        try {
            const data = await obtenerPacientePami(key);
            if (!data) {
                setBorradores([]);
                return setEstadoPaciente("nuevo");
            }
            const { medicamentos = {}, ...datos } = data;
            setPaciente(desdeDb(datos));
            setBorradores(
                Object.entries(medicamentos)
                    .map(([id, v]) => ({ id, ...v }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
            );
            setEstadoPaciente("existente");
        } catch (e) {
            console.error(e);
            setEstadoPaciente(null);
            flash("No se pudo consultar el paciente.", 4000);
        }
    }

    const bind = (name) => ({
        className: p.input,
        value: paciente[name],
        onChange: (e) => setPaciente((f) => ({ ...f, [name]: e.target.value })),
    });

    // ─── Borradores ──────────────────────────────────────────────
    const abrirBorrador = (b) => {
        setCarrito(itemsDe(b).map((i) => ({ ...i, id: i.id || `${i.categoria}:${i.key}` })));
        setEdicion({ pacienteKey: dniKey(paciente.dni), id: b.id });
        flash("Borrador cargado. Los precios son los del momento en que se guardó.", 4000);
    };

    async function eliminarBorrador(b) {
        if (!confirm("¿Eliminar este borrador?")) return;
        const key = dniKey(paciente.dni);
        try {
            await eliminarPresupuestoPami(key, b.id);
            if (edicion?.id === b.id) setEdicion(null);
            await buscarPaciente(key);
        } catch (e) {
            console.error(e);
            flash("No se pudo eliminar el borrador.", 4000);
        }
    }

    // ─── Guardar: asegura paciente + guarda presupuesto bajo su DNI ─
    async function guardar() {
        const key = dniKey(paciente.dni);
        if (!paciente.apellido.trim() || !paciente.nombre.trim())
            return flash("Completá apellido y nombre.");
        if (key.length < 7) return flash("Ingresá un DNI válido (mínimo 7 dígitos).");
        if (!paciente.afiliado.trim()) return flash("Ingresá el N° de afiliado PAMI.");
        if (!carrito.length) return flash("El carrito está vacío.");

        setSaving(true);
        try {
            const usuario = usuarioActual();
            const { creado } = await asegurarPacientePami(aDb(paciente), { usuario });
            const id = edicion?.pacienteKey === key ? edicion.id : null;
            const res = await guardarPresupuestoPami(key, { items: carrito, total }, { usuario, id });
            setEdicion({ pacienteKey: key, id: res.id });
            await buscarPaciente(key);
            flash(
                creado
                    ? "Paciente creado y borrador guardado."
                    : id
                        ? "Borrador actualizado."
                        : "Borrador guardado.",
            );
        } catch (e) {
            console.error(e);
            flash("Error al guardar: " + e.message, 5000);
        } finally {
            setSaving(false);
        }
    }

    const nuevo = () => {
        setPaciente(PACIENTE_VACIO);
        setCarrito([]);
        setBorradores([]);
        setEdicion(null);
        setEstadoPaciente(null);
        setBusquedaPaciente("");
        setBusquedaProducto("");
        setPeriodoActivo("todo");
    };

    // ─── Impresión (react-to-print) ──────────────────────────────
    const imprimir = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Presupuesto-${paciente.apellido || "PAMI"}-${paciente.nombre || ""}`.trim(),
        pageStyle: "@page { size: A4; margin: 14mm; }",
    });

    const estadoTxt = {
        buscando: "Buscando paciente…",
        nuevo: "Paciente nuevo: se creará al guardar.",
        existente: "Paciente existente: datos cargados.",
    }[estadoPaciente];

    const aplicarPeriodo = (periodo) => {
        const hoy = new Date();
        const inicio = new Date(hoy);
        if (periodo === "mes") inicio.setDate(1);
        else if (periodo === "30") inicio.setDate(hoy.getDate() - 29);
        else if (periodo === "90") inicio.setDate(hoy.getDate() - 89);
        else if (periodo === "anio") inicio.setMonth(0, 1);
        setDesde(fechaISO(inicio));
        setHasta(fechaISO(hoy));
    };

    // ─── Render ──────────────────────────────────────────────────
    return (
        <div className={`${styles.wrapper} ${styles.dark}`}>
            <div className={styles.headerBar}>
                <h2 className={styles.title}>Presupuesto PAMI</h2>
                <span className={p.headerHint}>Gestión de medicación y descartables</span>
            </div>
            <nav className={p.tabs} aria-label="Secciones PAMI" role="tablist">
                {[
                    ["presupuesto", "Presupuesto", "Crear y consultar presupuestos"],
                    ["pacientes", "Pacientes", "Buscar pacientes registrados"],
                    ["estadisticas", "Estadísticas", "Consultar indicadores"],
                ].map(([id, label, descripcion]) => (
                    <button key={id} type="button" role="tab" aria-selected={solapa === id}
                        className={`${p.tab} ${solapa === id ? p.tabActive : ""}`}
                        onClick={() => setSolapa(id)}>
                        <span>{label}</span><small>{descripcion}</small>
                    </button>
                ))}
            </nav>

            {mensaje && <div className={styles.toast}>{mensaje}</div>}

            {solapa === "pacientes" && <section className={p.card}>
                <h3 className={p.cardTitle}>Pacientes registrados</h3>
                <input
                    className={p.input}
                    type="search"
                    placeholder="Buscar por DNI, afiliado, apellido o nombre..."
                    value={busquedaPaciente}
                    onChange={(e) => setBusquedaPaciente(e.target.value)}
                    aria-label="Buscar pacientes"
                />
                <p className={p.hint}>{pacientesFiltrados.length} pacientes encontrados.</p>
                <ul className={p.list}>
                    {pacientesFiltrados.slice(0, 100).map((x) => (
                        <li className={p.row} key={x.dni}>
                            <div>
                                <div className={p.rowName}>{x.apellido || ""}, {x.nombre || ""}</div>
                                <div className={p.rowMeta}>DNI {miles(x.dni)} · Afiliado {x.afiliado || "—"}</div>
                            </div>
                            <button
                                className={`${p.btn} ${p.btnSm}`}
                                type="button"
                                onClick={async () => {
                                    await buscarPaciente(x.dni);
                                    setSolapa("presupuesto");
                                    setBusquedaPaciente("");
                                }}
                            >
                                Cargar
                            </button>
                        </li>
                    ))}
                </ul>
            </section>}
            {solapa === "estadisticas" && <section className={p.colMain}>
                <div className={p.card}>
                    <div className={p.statsHeader}>
                        <div><h3 className={p.cardTitle}>Resumen de actividad</h3><p className={p.hint}>Visualizá los principales indicadores y ajustá el período solo si lo necesitás.</p></div>
                        <span className={p.dataNote}>Importes presupuestados</span>
                    </div>
                    <div className={p.periodButtons} aria-label="Filtrar período">
                        {[
                            ["todo", "Todo"],
                            ["mes", "Este mes"],
                            ["30", "Últimos 30 días"],
                            ["90", "Últimos 90 días"],
                            ["anio", "Este año"],
                        ].map(([id, label]) => (
                            <button key={id} type="button"
                                className={`${p.periodButton} ${periodoActivo === id ? p.periodButtonActive : ""}`}
                                aria-pressed={periodoActivo === id}
                                onClick={() => {
                                    setPeriodoActivo(id);
                                    if (id === "todo") { setDesde(""); setHasta(""); }
                                    else aplicarPeriodo(id);
                                }}>
                                {label}
                            </button>
                        ))}
                    </div>
                    <details className={p.advancedFilters}>
                        <summary>Filtros avanzados <span>Fechas exactas, categoría y edad</span></summary>
                        <div className={p.filters}>
                            <label className={p.field}><span>Desde</span><input className={p.input} type="date" value={desde} onChange={e => { setDesde(e.target.value); setPeriodoActivo("personalizado"); }} /></label>
                            <label className={p.field}><span>Hasta</span><input className={p.input} type="date" value={hasta} onChange={e => { setHasta(e.target.value); setPeriodoActivo("personalizado"); }} /></label>
                            <label className={p.field}><span>Tipo de insumo</span><select className={p.input} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)}><option value="todos">Todos</option><option value="medicamentos">Medicamentos</option><option value="descartables">Descartables</option></select></label>
                            <label className={p.field}><span>Edad mínima</span><input className={p.input} type="number" min="0" max="120" placeholder="Sin mínimo" value={edadDesde} onChange={e => setEdadDesde(e.target.value)} /></label>
                            <label className={p.field}><span>Edad máxima</span><input className={p.input} type="number" min="0" max="120" placeholder="Sin máximo" value={edadHasta} onChange={e => setEdadHasta(e.target.value)} /></label>
                            <button type="button" className={p.btn} onClick={() => { setDesde(""); setHasta(""); setFiltroCategoria("todos"); setEdadDesde(""); setEdadHasta(""); setPeriodoActivo("todo"); }}>Restablecer filtros</button>
                        </div>
                    </details>
                    <div className={p.kpiGrid}>
                        <article className={p.kpi}><span>Total presupuestado</span><strong>{formatCurrency(estadisticas.total)}</strong></article>
                        <article className={p.kpi}><span>Medicamentos</span><strong>{formatCurrency(estadisticas.medicamentos)}</strong></article>
                        <article className={p.kpi}><span>Descartables</span><strong>{formatCurrency(estadisticas.descartables)}</strong></article>
                        <article className={p.kpi}><span>Promedio por paciente</span><strong>{formatCurrency(estadisticas.promedio)}</strong></article>
                        <article className={p.kpi}><span>Pacientes con presupuestos</span><strong>{estadisticas.pacientesUnicos}</strong></article>
                        <article className={p.kpi}><span>Unidades presupuestadas</span><strong>{estadisticas.unidades}</strong></article>
                    </div>
                </div>
                <div className={p.card}><h3 className={p.cardTitle}>Insumos más utilizados</h3>{estadisticas.top.length === 0 ? <p className={p.empty}>No hay datos para los filtros seleccionados.</p> : <div className={p.statsList}>{estadisticas.top.map(i => <div className={p.statRow} key={i.nombre}><div><strong>{i.nombre}</strong><small>{i.cantidad} unidades · {formatCurrency(i.total)}</small></div><div className={p.barTrack}><span style={{ width: `${Math.max(3, (i.cantidad / estadisticas.top[0].cantidad) * 100)}%` }} /></div></div>)}</div>}</div>
                <div className={p.card}><h3 className={p.cardTitle}>Evolución mensual</h3>{estadisticas.porMes.length === 0 ? <p className={p.empty}>No hay fechas disponibles para graficar.</p> : <div className={p.statsList}>{estadisticas.porMes.map(([mes, monto]) => <div className={p.statRow} key={mes}><strong>{mes}</strong><div className={p.barTrack}><span style={{ width: `${Math.max(2, (monto / Math.max(...estadisticas.porMes.map(x => x[1]))) * 100)}%` }} /></div><strong>{formatCurrency(monto)}</strong></div>)}</div>}</div>
            </section>}
            {solapa === "presupuesto" && <div className={p.layout}>
                <div className={p.colMain}>
                    {/* ── Paciente ── */}
                    <section className={p.card}>
                        <h3 className={p.cardTitle}>Paciente</h3>
                        <div className={p.grid2}>
                            <Campo label="DNI">
                                <input
                                    className={p.input}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={13}
                                    placeholder="Ej: 20.123.456"
                                    value={miles(paciente.dni)}
                                    onChange={(e) => {
                                        const dni = e.target.value.replace(/\D/g, "");
                                        setPaciente((f) => ({ ...f, dni }));
                                        setEstadoPaciente(null);
                                        setBorradores([]);
                                    }}
                                    onBlur={() => buscarPaciente()}
                                />
                            </Campo>
                            <Campo label="N° de afiliado PAMI">
                                <input
                                    className={p.input}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    maxLength={13}
                                    placeholder="Solo números"
                                    value={paciente.afiliado}
                                    onChange={(e) =>
                                        setPaciente((f) => ({ ...f, afiliado: e.target.value.replace(/\D/g, "") }))
                                    }
                                />
                            </Campo>
                            <Campo label="Apellido">
                                <input {...bind("apellido")} autoComplete="family-name" />
                            </Campo>
                            <Campo label="Nombre">
                                <input {...bind("nombre")} autoComplete="given-name" />
                            </Campo>
                            <Campo label="N° Historia Clínica">
                                <input
                                    className={p.input}
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={paciente.historiaClinica}
                                    onChange={(e) =>
                                        setPaciente((f) => ({ ...f, historiaClinica: e.target.value.replace(/\D/g, "") }))
                                    }
                                />
                            </Campo>
                        </div>
                        {estadoTxt && (
                            <p className={p.status} role="status">
                                {estadoTxt}
                            </p>
                        )}

                        <details className={p.more}>
                            <summary>Más datos del paciente</summary>
                            <div className={p.grid2}>
                                <Campo label="Sexo">
                                    <select {...bind("sexo")}>
                                        <option value="">—</option>
                                        <option value="M">Masculino</option>
                                        <option value="F">Femenino</option>
                                    </select>
                                </Campo>
                                <Campo label="Fecha de nacimiento">
                                    <input type="date" {...bind("fechaNacimiento")} />
                                </Campo>
                                <Campo label="Teléfono">
                                    <input type="tel" inputMode="tel" autoComplete="tel" {...bind("telefono")} />
                                </Campo>
                                <Campo label="Domicilio">
                                    <input {...bind("domicilio")} autoComplete="street-address" />
                                </Campo>
                                <Campo label="Localidad">
                                    <input {...bind("localidad")} autoComplete="address-level2" />
                                </Campo>
                                <Campo label="Provincia">
                                    <input {...bind("provincia")} autoComplete="address-level1" />
                                </Campo>
                                <Campo label="Lugar de nacimiento">
                                    <input {...bind("lugarNacimiento")} />
                                </Campo>
                            </div>
                            <h4 className={p.sub}>Familiar responsable</h4>
                            <div className={p.grid2}>
                                <Campo label="Nombre completo">
                                    <input {...bind("famNombre")} autoComplete="off" />
                                </Campo>
                                <Campo label="Parentezco">
                                    <input {...bind("famParentezco")} autoComplete="off" />
                                </Campo>
                                <Campo label="Teléfono">
                                    <input type="tel" inputMode="tel" {...bind("famTelefono")} />
                                </Campo>
                            </div>
                        </details>

                        {borradores.length > 0 && (
                            <>
                                <h4 className={p.sub}>Borradores guardados</h4>
                                {borradores.map((b) => (
                                    <div key={b.id} className={p.borrador}>
                                        <span>
                                            {new Date(b.createdAt || 0).toLocaleDateString("es-AR")} ·{" "}
                                            {itemsDe(b).length} ítems · {formatCurrency(b.total || 0)}
                                            {edicion?.id === b.id ? " · en edición" : ""}
                                        </span>
                                        <button
                                            type="button"
                                            className={`${p.btn} ${p.btnSm}`}
                                            onClick={() => abrirBorrador(b)}
                                        >
                                            Abrir
                                        </button>
                                        <button
                                            type="button"
                                            className={`${p.btn} ${p.btnSm}`}
                                            onClick={() => eliminarBorrador(b)}
                                            aria-label="Eliminar borrador"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                ))}
                            </>
                        )}
                    </section>

                    {/* ── Catálogo ── */}
                    <section className={p.card}>
                        <h3 className={p.cardTitle}>Medicación y descartables</h3>
                        <div className={p.grid2}>
                            <select
                                className={p.input}
                                value={tipo}
                                onChange={(e) => setTipo(e.target.value)}
                                aria-label="Tipo de producto"
                            >
                                <option value="todos">📦 Todos</option>
                                <option value="medicamentos">💊 Medicación</option>
                                <option value="descartables">🧷 Descartables</option>
                            </select>
                            <input
                                type="search"
                                className={p.input}
                                placeholder="Buscar producto..."
                                value={busquedaProducto}
                                onChange={(e) => setBusquedaProducto(e.target.value)}
                                aria-label="Buscar producto"
                            />
                        </div>

                        {!consultaActiva ? (
                            <div className={p.empty}>Escribí al menos {MIN_BUSQUEDA} caracteres para buscar medicamentos o descartables.</div>
                        ) : filtrados.length === 0 ? (
                            <div className={p.empty}>No encontramos productos con esa búsqueda.</div>
                        ) : (
                            <ul className={p.list}>
                                {filtrados.slice(0, MAX_VISIBLES).map((item) => {
                                    const id = `${item.categoria}:${item.key}`;
                                    return (
                                        <li key={id} className={p.row}>
                                            <div>
                                                <div className={p.rowName}>{item.nombre}</div>
                                                <div className={p.rowMeta}>
                                                    <span
                                                        className={
                                                            item.tipo === "medicamento"
                                                                ? p.badgeMed
                                                                : p.badgeDesc
                                                        }
                                                    >
                                                        {item.tipo === "medicamento" ? "Medicamento" : "Descartable"}
                                                    </span>{" "}
                                                    {labelPresentacion(item.categoria, item.presentacion)} ·{" "}
                                                    {formatCurrency(item.precioFacturacion)}
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className={`${p.btn} ${p.btnSm}`}
                                                onClick={() => agregar(item)}
                                            >
                                                {cantidades[id] ? `+1 (${cantidades[id]})` : "Agregar"}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        {consultaActiva && <p className={p.hint}>Mostrando hasta {MAX_VISIBLES} coincidencias. Refiná la búsqueda para encontrar un producto específico.</p>}
                    </section>
                </div>

                {/* ── Carrito ── */}
                <aside id="carrito" className={`${p.card} ${p.cart}`}>
                    <h3 className={p.cardTitle}>
                        🛒 Presupuesto {edicion?.id ? "(borrador en edición)" : ""}
                    </h3>

                    {carrito.length === 0 ? (
                        <div className={p.empty}>Agregá productos desde la lista.</div>
                    ) : (
                        carrito.map((c) => (
                            <div key={c.id} className={p.cartRow}>
                                <div>
                                    <div className={p.rowName}>{c.nombre}</div>
                                    <div className={p.rowMeta}>
                                        {c.presentacion} · {formatCurrency(c.precio)} c/u
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className={`${p.btn} ${p.btnSm}`}
                                    onClick={() => quitar(c.id)}
                                    aria-label={`Quitar ${c.nombre}`}
                                >
                                    ✕
                                </button>
                                <div className={p.cartControls}>
                                    <input
                                        className={`${p.input} ${p.qty}`}
                                        inputMode="numeric"
                                        aria-label={`Cantidad de ${c.nombre}`}
                                        value={c.cantidad}
                                        onChange={(e) => cambiarCantidad(c.id, e.target.value)}
                                    />
                                    <strong>{formatCurrency(c.precio * c.cantidad)}</strong>
                                </div>
                            </div>
                        ))
                    )}

                    <div className={p.total}>
                        <span>Total</span>
                        <span>{formatCurrency(total)}</span>
                    </div>

                    <div className={p.actions}>
                        <button
                            type="button"
                            className={`${p.btn} ${p.btnPrimary} ${p.full}`}
                            onClick={guardar}
                            disabled={saving || carrito.length === 0}
                        >
                            {saving ? "Guardando..." : edicion?.id ? "Actualizar borrador" : "Guardar borrador"}
                        </button>
                        <button
                            type="button"
                            className={p.btn}
                            onClick={imprimir}
                            disabled={carrito.length === 0}
                        >
                            🖨️ Imprimir
                        </button>
                        <button type="button" className={p.btn} onClick={nuevo}>
                            Nuevo
                        </button>
                    </div>
                </aside>
            </div>}

            {solapa === "presupuesto" && <a href="#carrito" className={p.bar}>
                {carrito.length} ítems · {formatCurrency(total)}
            </a>}

            {/* Documento oculto que se imprime */}
            <div style={{ display: "none" }}>
                <PresupuestoImprimible
                    ref={printRef}
                    paciente={paciente}
                    items={carrito}
                    total={total}
                    nro={edicion?.id ? edicion.id.slice(-6).toUpperCase() : ""}
                />
            </div>
        </div>
    );
}
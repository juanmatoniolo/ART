"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { db } from "@/lib/firebase";
import { ref, onValue } from "firebase/database";
import { useReactToPrint } from "react-to-print";
import { getSession } from "@/utils/session";
import { formatCurrency, matchesAllTerms } from "@/app/farmacia/utils/farmacia";
import {
    dniKey,
    obtenerPacienteOS,
    asegurarPacienteOS,
    guardarPresupuestoOS,
    eliminarPresupuestoOS,
    eliminarPacienteOS,
} from "@/lib/os";
import PresupuestoOSImprimible from "./PresupuestoImprimible";
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
const VISIBLES_SIN_BUSQUEDA = 15;

/* Sugerencias de obras sociales guardadas en el navegador */
const LS_KEY_OS = "os_obras_sociales_v1";

const cargarSugerenciasOS = () => {
    try {
        const raw = localStorage.getItem(LS_KEY_OS);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        return Array.isArray(arr) ? arr.filter((x) => typeof x === "string" && x.trim()) : [];
    } catch {
        return [];
    }
};

const persistirSugerenciaOS = (valor) => {
    const v = String(valor || "").trim();
    if (!v) return null;
    try {
        const prev = cargarSugerenciasOS();
        const next = [v, ...prev.filter((x) => x.toLowerCase() !== v.toLowerCase())].slice(0, 20);
        localStorage.setItem(LS_KEY_OS, JSON.stringify(next));
        return next;
    } catch {
        return null;
    }
};

const CAMPOS = [
    "dni", "afiliado", "obraSocial", "historiaClinica", "sexo",
    "fechaNacimiento", "telefono", "domicilio", "localidad", "provincia", "lugarNacimiento",
    "cirujano", "ayudante1", "ayudante2", "anestesista",
];

const PACIENTE_VACIO = {
    dni: "", afiliado: "", obraSocial: "", nombreCompleto: "", historiaClinica: "", sexo: "",
    fechaNacimiento: "", telefono: "", domicilio: "",
    localidad: "", provincia: "", lugarNacimiento: "",
    famNombre: "", famParentezco: "", famTelefono: "",
    cirujano: "", ayudante1: "", ayudante2: "", anestesista: "",
};

const desdeDb = (d) => ({
    ...Object.fromEntries(CAMPOS.map((c) => [c, d[c] ?? ""])),
    nombreCompleto: [d.apellido, d.nombre].filter(Boolean).join(" ").trim(),
    famNombre: d.familiar?.nombre ?? "",
    famParentezco: d.familiar?.parentezco ?? "",
    famTelefono: d.familiar?.telefono ?? "",
});

const aDb = (f) => {
    const { famNombre, famParentezco, famTelefono, nombreCompleto, ...resto } = f;
    const partes = String(nombreCompleto || "").trim().split(/\s+/).filter(Boolean);
    const apellido = partes[0] || "";
    const nombre = partes.slice(1).join(" ");

    const limpio = Object.fromEntries(
        Object.entries(resto).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]),
    );
    return {
        ...limpio,
        apellido,
        nombre,
        familiar: { nombre: famNombre.trim(), parentezco: famParentezco.trim(), telefono: famTelefono.trim() },
    };
};

const miles = (v) => {
    const d = String(v || "").replace(/\D/g, "");
    return d.length <= 8 ? d.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : d;
};

const parseCantidad = (v, fallback = 0) => {
    if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? v : fallback;
    const n = parseFloat(String(v ?? "").trim().replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const fmtCantidad = (n) => {
    const num = Number(n);
    if (!Number.isFinite(num) || num <= 0) return "0";
    return String(num);
};

const parseMonto = (v) => {
    const n = parseFloat(String(v ?? "").trim().replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
};

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

const itemsDe = (b) => (Array.isArray(b.items) ? b.items : Object.values(b.items || {}));
const codigosDe = (b) => (Array.isArray(b.codigos) ? b.codigos : Object.values(b.codigos || {}));

function Campo({ label, children, wide }) {
    return (
        <label
            className={p.field}
            style={wide ? { gridColumn: "1 / -1" } : undefined}
        >
            <span>{label}</span>
            {children}
        </label>
    );
}

/* ===========================================================
   Página
   =========================================================== */
export default function PresupuestoOSPage() {
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
    const [busquedaBorrador, setBusquedaBorrador] = useState("");
    const [periodoActivo, setPeriodoActivo] = useState("todo");

    const [paciente, setPaciente] = useState(PACIENTE_VACIO);
    const [estadoPaciente, setEstadoPaciente] = useState(null);
    const [borradores, setBorradores] = useState([]);
    const [carrito, setCarrito] = useState([]);
    const [codigosOS, setCodigosOS] = useState([]);
    const [formCodigo, setFormCodigo] = useState({ codigo: "", descripcion: "", monto: "" });
    const [edicion, setEdicion] = useState(null);
    const [saving, setSaving] = useState(false);
    const [mensaje, setMensaje] = useState("");

    const [pendientes, setPendientes] = useState({});
    const [notifs, setNotifs] = useState([]);
    const [sugerenciasOS, setSugerenciasOS] = useState([]);

    const printRef = useRef(null);

    const flash = (m, ms = 3000) => {
        setMensaje(m);
        setTimeout(() => setMensaje(""), ms);
    };

    const notify = (text, ms = 2200) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setNotifs((n) => [...n, { id, text }]);
        setTimeout(() => setNotifs((n) => n.filter((x) => x.id !== id)), ms);
    };

    /* Cargar sugerencias de O.S. desde localStorage al iniciar */
    useEffect(() => {
        setSugerenciasOS(cargarSugerenciasOS());
    }, []);

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
        const unsub = onValue(ref(db, "OS/pacientes"), (snap) => {
            const data = snap.val() || {};
            setPacientesDb(Object.entries(data).map(([dni, paciente]) => ({ dni, ...paciente })));
        });
        return () => unsub();
    }, []);

    const consultaActiva = busquedaProducto.trim().length >= MIN_BUSQUEDA;

    const filtrados = useMemo(() => {
        const activos = items.filter((i) => i.activo);
        if (consultaActiva) {
            return activos
                .filter((i) => (tipo === "todos" || i.categoria === tipo) && matchesAllTerms(i.nombre, busquedaProducto))
                .slice(0, MAX_VISIBLES);
        }
        if (tipo === "todos") {
            const meds = activos.filter((i) => i.categoria === "medicamentos").slice(0, VISIBLES_SIN_BUSQUEDA);
            const desc = activos.filter((i) => i.categoria === "descartables").slice(0, VISIBLES_SIN_BUSQUEDA);
            return [...meds, ...desc];
        }
        return activos.filter((i) => i.categoria === tipo).slice(0, MAX_VISIBLES);
    }, [items, tipo, busquedaProducto, consultaActiva]);

    const pacientesFiltrados = useMemo(() => {
        const consulta = busquedaPaciente.trim();
        if (!consulta) return pacientesDb;
        return pacientesDb.filter((x) => matchesAllTerms(
            `${x.dni || ""} ${x.afiliado || ""} ${x.obraSocial || ""} ${x.apellido || ""} ${x.nombre || ""}`,
            consulta
        ));
    }, [pacientesDb, busquedaPaciente]);

    const borradoresTodos = useMemo(() => {
        const lista = [];
        for (const pac of pacientesDb) {
            const meds = pac.medicamentos || {};
            for (const [id, b] of Object.entries(meds)) {
                const itemsB = itemsDe(b);
                const codigosB = codigosDe(b);
                const totalB = itemsB.reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 0), 0)
                    + codigosB.reduce((s, c) => s + (Number(c.monto) || 0), 0);
                lista.push({
                    id,
                    pacienteDni: pac.dni,
                    pacienteNombre: [pac.apellido, pac.nombre].filter(Boolean).join(" "),
                    pacienteAfiliado: pac.afiliado || "",
                    pacienteOS: pac.obraSocial || "",
                    fechaMs: Number(b.createdAt || b.updatedAt || 0),
                    itemsCount: itemsB.length,
                    codigosCount: codigosB.length,
                    total: b.total != null ? Number(b.total) : totalB,
                    raw: b,
                });
            }
        }
        return lista.sort((a, b) => b.fechaMs - a.fechaMs);
    }, [pacientesDb]);

    const borradoresFiltrados = useMemo(() => {
        const consulta = busquedaBorrador.trim();
        if (!consulta) return borradoresTodos;
        return borradoresTodos.filter((b) => matchesAllTerms(
            `${b.pacienteNombre} ${b.pacienteDni} ${b.pacienteAfiliado} ${b.pacienteOS}`,
            consulta
        ));
    }, [borradoresTodos, busquedaBorrador]);

    const estadisticas = useMemo(() => {
        const hoy = new Date();
        const registros = [];
        for (const paciente of pacientesDb) {
            const nacimiento = paciente.fechaNacimiento ? new Date(`${paciente.fechaNacimiento}T00:00:00`) : null;
            const edad = nacimiento && !Number.isNaN(nacimiento.getTime()) ? Math.max(0, hoy.getFullYear() - nacimiento.getFullYear() - ((hoy.getMonth() < nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) ? 1 : 0)) : null;
            for (const [id, b] of Object.entries(paciente.medicamentos || {})) {
                const fechaMs = Number(b.createdAt || b.updatedAt || 0);
                const fecha = fechaMs ? new Date(fechaMs) : null;
                const fechaISOreg = fecha ? `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}` : "";
                if (desde && (!fechaISOreg || fechaISOreg < desde)) continue;
                if (hasta && (!fechaISOreg || fechaISOreg > hasta)) continue;
                if (edadDesde !== "" && (edad === null || edad < Number(edadDesde))) continue;
                if (edadHasta !== "" && (edad === null || edad > Number(edadHasta))) continue;
                const itemsB = itemsDe(b);
                const totalFiltrado = itemsB.filter(i => filtroCategoria === "todos" || i.categoria === filtroCategoria || (filtroCategoria === "medicamentos" && i.tipo === "medicamento") || (filtroCategoria === "descartables" && i.tipo === "descartable"));
                if (!totalFiltrado.length) continue;
                registros.push({ id, dni: paciente.dni, paciente, fechaMs, edad, items: totalFiltrado, total: totalFiltrado.reduce((s, i) => s + (Number(i.precio) || 0) * (Number(i.cantidad) || 0), 0) });
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
    const totalProductos = useMemo(
        () => carrito.reduce((s, c) => s + c.precio * (Number(c.cantidad) || 0), 0),
        [carrito],
    );
    const totalCodigos = useMemo(
        () => codigosOS.reduce((s, c) => s + (Number(c.monto) || 0), 0),
        [codigosOS],
    );
    const total = totalProductos + totalCodigos;

    const getPendienteRaw = (id) =>
        pendientes[id] !== undefined ? pendientes[id] : "1";

    const getPendienteNum = (id) => parseCantidad(getPendienteRaw(id), 0);

    const setPendiente = (id, raw) => {
        setPendientes((prev) => ({ ...prev, [id]: raw }));
    };

    const sumarPendiente = (id) => {
        const next = getPendienteNum(id) + 1;
        setPendientes((prev) => ({ ...prev, [id]: String(next) }));
    };

    const restarPendiente = (id) => {
        const next = Math.max(0, getPendienteNum(id) - 1);
        setPendientes((prev) => ({ ...prev, [id]: String(next) }));
    };

    const confirmarAgregar = (item) => {
        const id = `${item.categoria}:${item.key}`;
        const qty = getPendienteNum(id) || 1;

        setCarrito((c) => {
            const idx = c.findIndex((x) => x.id === id);
            if (idx >= 0) {
                const copy = c.slice();
                const nueva = (Number(copy[idx].cantidad) || 0) + qty;
                copy[idx] = { ...copy[idx], cantidad: nueva, _raw: undefined };
                return copy;
            }
            return [
                ...c,
                {
                    id,
                    categoria: item.categoria,
                    key: item.key,
                    nombre: item.nombre,
                    presentacion: labelPresentacion(item.categoria, item.presentacion),
                    precio: Number(item.precioFacturacion) || 0,
                    cantidad: qty,
                },
            ];
        });

        setPendientes((prev) => ({ ...prev, [id]: "1" }));
        notify(`${item.nombre}  +${fmtCantidad(qty)}`);
    };

    const cambiarCantidad = (id, raw) => {
        setCarrito((c) =>
            c.map((x) => {
                if (x.id !== id) return x;
                return { ...x, _raw: raw, cantidad: parseCantidad(raw, 0) };
            })
        );
    };

    const quitar = (id) => setCarrito((c) => c.filter((x) => x.id !== id));

    const agregarCodigo = () => {
        const codigo = formCodigo.codigo.trim();
        const descripcion = formCodigo.descripcion.trim();
        const monto = parseMonto(formCodigo.monto);
        if (!codigo && !descripcion) return flash("Ingresá el código o la descripción.");
        setCodigosOS((c) => [
            ...c,
            { id: `cod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, codigo, descripcion, monto },
        ]);
        setFormCodigo({ codigo: "", descripcion: "", monto: "" });
        notify(`Código ${codigo || descripcion} agregado`);
    };
    const quitarCodigo = (id) => setCodigosOS((c) => c.filter((x) => x.id !== id));

    // ─── Paciente ────────────────────────────────────────────────
    async function buscarPaciente(raw = paciente.dni) {
        const key = dniKey(raw);
        if (key.length < 7) return;
        setEstadoPaciente("buscando");
        try {
            const data = await obtenerPacienteOS(key);
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
        setCarrito(
            itemsDe(b).map((i) => ({
                ...i,
                id: i.id || `${i.categoria}:${i.key}`,
                cantidad: parseCantidad(i.cantidad, 1) || 1,
                _raw: undefined,
            })),
        );
        setCodigosOS(codigosDe(b).map((c) => ({ ...c })));
        setPendientes({});
        setEdicion({ pacienteKey: dniKey(paciente.dni), id: b.id });
        flash("Borrador cargado. Los precios son los del momento en que se guardó.", 4000);
    };

    async function eliminarBorrador(b) {
        if (!confirm("¿Eliminar este borrador?")) return;
        const key = dniKey(paciente.dni);
        try {
            await eliminarPresupuestoOS(key, b.id);
            if (edicion?.id === b.id) setEdicion(null);
            await buscarPaciente(key);
        } catch (e) {
            console.error(e);
            flash("No se pudo eliminar el borrador.", 4000);
        }
    }

    async function eliminarPaciente(pac) {
        const nombre = [pac.apellido, pac.nombre].filter(Boolean).join(" ") || `DNI ${pac.dni}`;
        if (!confirm(`¿Eliminar el paciente ${nombre}?\nSe borrarán también todos sus borradores.`)) return;
        try {
            await eliminarPacienteOS(pac.dni);
            if (dniKey(paciente.dni) === dniKey(pac.dni)) nuevo();
            flash("Paciente eliminado.");
        } catch (e) {
            console.error(e);
            flash("No se pudo eliminar el paciente.", 4000);
        }
    }

    async function abrirBorradorDesdeLista(b) {
        try {
            const data = await obtenerPacienteOS(b.pacienteDni);
            if (!data) {
                flash("No se encontró el paciente.", 3500);
                return;
            }
            const { medicamentos = {}, ...datos } = data;
            setPaciente(desdeDb(datos));
            setBorradores(
                Object.entries(medicamentos)
                    .map(([id, v]) => ({ id, ...v }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
            );
            setEstadoPaciente("existente");

            setCarrito(
                itemsDe(b.raw).map((i) => ({
                    ...i,
                    id: i.id || `${i.categoria}:${i.key}`,
                    cantidad: parseCantidad(i.cantidad, 1) || 1,
                    _raw: undefined,
                })),
            );
            setCodigosOS(codigosDe(b.raw).map((c) => ({ ...c })));
            setPendientes({});
            setEdicion({ pacienteKey: dniKey(b.pacienteDni), id: b.id });

            setSolapa("presupuesto");
            flash("Borrador cargado. Los precios son los del momento en que se guardó.", 4000);
        } catch (e) {
            console.error(e);
            flash("No se pudo abrir el borrador.", 4000);
        }
    }

    async function eliminarBorradorDesdeLista(b) {
        if (!confirm(`¿Eliminar el borrador de ${b.pacienteNombre || b.pacienteDni}?`)) return;
        try {
            await eliminarPresupuestoOS(b.pacienteDni, b.id);
            if (edicion?.id === b.id) setEdicion(null);
            flash("Borrador eliminado.");
        } catch (e) {
            console.error(e);
            flash("No se pudo eliminar el borrador.", 4000);
        }
    }

    // ─── Guardar ─────────────────────────────────────────────────
    async function guardar() {
        const key = dniKey(paciente.dni);
        if (!paciente.nombreCompleto.trim())
            return flash("Completá apellido y nombre.");
        if (key.length < 7) return flash("Ingresá un DNI válido (mínimo 7 dígitos).");
        if (!paciente.obraSocial.trim()) return flash("Ingresá la Obra Social.");
        if (!paciente.afiliado.trim()) return flash("Ingresá el N° de afiliado.");
        if (!carrito.length && !codigosOS.length) return flash("No hay ítems ni códigos cargados.");

        setSaving(true);
        try {
            const usuario = usuarioActual();
            const { creado } = await asegurarPacienteOS(aDb(paciente), { usuario });
            const id = edicion?.pacienteKey === key ? edicion.id : null;
            const res = await guardarPresupuestoOS(
                key,
                { items: carrito, codigos: codigosOS, total },
                { usuario, id },
            );
            setEdicion({ pacienteKey: key, id: res.id });

            /* Recordar la O.S. en el navegador para sugerirla la próxima vez */
            const actualizadas = persistirSugerenciaOS(paciente.obraSocial);
            if (actualizadas) setSugerenciasOS(actualizadas);

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
        setCodigosOS([]);
        setFormCodigo({ codigo: "", descripcion: "", monto: "" });
        setPendientes({});
        setBorradores([]);
        setEdicion(null);
        setEstadoPaciente(null);
        setBusquedaPaciente("");
        setBusquedaProducto("");
        setPeriodoActivo("todo");
    };

    const imprimir = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Presupuesto-${paciente.nombreCompleto || "OS"}`.trim(),
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

    const fmtFechaHora = (ms) => {
        if (!ms) return "—";
        const d = new Date(ms);
        return `${d.toLocaleDateString("es-AR")} ${d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`;
    };

    // ─── Render ──────────────────────────────────────────────────
    return (
        <div className={`${styles.wrapper} ${styles.dark}`}>
            <div className={styles.headerBar}>
                <h2 className={styles.title}>Presupuesto O.S.</h2>
                <span className={p.headerHint}>Gestión de medicación y descartables</span>
            </div>
            <nav className={p.tabs} aria-label="Secciones O.S." role="tablist">
                {[
                    ["presupuesto", "Presupuesto", "Crear y consultar presupuestos"],
                    ["pacientes", "Pacientes", "Buscar pacientes registrados"],
                    ["borradores", "Borradores", "Todos los borradores"],
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

            {notifs.length > 0 && (
                <div className={p.notifStack} aria-live="polite" aria-atomic="true">
                    {notifs.map((n) => (
                        <div key={n.id} className={p.notif} role="status">
                            ✓ {n.text}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Solapa PACIENTES ── */}
            {solapa === "pacientes" && <section className={p.card}>
                <h3 className={p.cardTitle}>Pacientes registrados</h3>
                <input
                    className={p.input}
                    type="search"
                    placeholder="Buscar por DNI, afiliado, obra social, apellido o nombre..."
                    value={busquedaPaciente}
                    onChange={(e) => setBusquedaPaciente(e.target.value)}
                    aria-label="Buscar pacientes"
                />
                <p className={p.hint}>{pacientesFiltrados.length} pacientes encontrados.</p>
                <ul className={p.list}>
                    {pacientesFiltrados.slice(0, 200).map((x) => (
                        <li className={p.row} key={x.dni}>
                            <div>
                                <div className={p.rowName}>{x.apellido || ""}, {x.nombre || ""}</div>
                                <div className={p.rowMeta}>
                                    DNI {miles(x.dni)}
                                    {x.obraSocial ? ` · ${x.obraSocial}` : ""}
                                    {x.afiliado ? ` · Afiliado ${x.afiliado}` : ""}
                                    {" · "}
                                    {Object.keys(x.medicamentos || {}).length} borrador(es)
                                </div>
                            </div>
                            <div className={p.rowActions}>
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
                                <button
                                    className={`${p.btn} ${p.btnSm} ${p.btnDangerSm}`}
                                    type="button"
                                    onClick={() => eliminarPaciente(x)}
                                    aria-label={`Eliminar paciente ${x.apellido || ""} ${x.nombre || ""}`}
                                >
                                    Eliminar
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </section>}

            {/* ── Solapa BORRADORES ── */}
            {solapa === "borradores" && <section className={p.card}>
                <h3 className={p.cardTitle}>Todos los borradores</h3>
                <p className={p.hint}>
                    Un paciente puede tener varios borradores (por ejemplo, distintas prácticas).
                    Acá los ves todos juntos, sin importar el paciente.
                </p>
                <input
                    className={p.input}
                    type="search"
                    placeholder="Buscar por paciente, DNI, O.S. o afiliado..."
                    value={busquedaBorrador}
                    onChange={(e) => setBusquedaBorrador(e.target.value)}
                    aria-label="Buscar borradores"
                />
                <p className={p.hint}>{borradoresFiltrados.length} borradores.</p>
                {borradoresFiltrados.length === 0 ? (
                    <div className={p.empty}>
                        {busquedaBorrador.trim() ? "No hay borradores que coincidan." : "Todavía no hay borradores guardados."}
                    </div>
                ) : (
                    <ul className={p.list}>
                        {borradoresFiltrados.slice(0, 300).map((b) => (
                            <li key={`${b.pacienteDni}-${b.id}`} className={p.draftItem}>
                                <div className={p.draftInfo}>
                                    <div className={p.draftTitle}>
                                        {b.pacienteNombre || `DNI ${b.pacienteDni}`}
                                    </div>
                                    <div className={p.draftMeta}>
                                        DNI {miles(b.pacienteDni)}
                                        {b.pacienteOS ? ` · ${b.pacienteOS}` : ""}
                                        {b.pacienteAfiliado ? ` · Afiliado ${b.pacienteAfiliado}` : ""}
                                        {" · "}{fmtFechaHora(b.fechaMs)}
                                    </div>
                                    <div className={p.draftMeta}>
                                        {b.itemsCount} ítem(s)
                                        {b.codigosCount > 0 ? ` + ${b.codigosCount} código(s)` : ""}
                                        {" · "}<strong>{formatCurrency(b.total || 0)}</strong>
                                    </div>
                                </div>
                                <div className={p.draftActions}>
                                    <button
                                        type="button"
                                        className={`${p.btn} ${p.btnSm}`}
                                        onClick={() => abrirBorradorDesdeLista(b)}
                                    >
                                        Abrir
                                    </button>
                                    <button
                                        type="button"
                                        className={`${p.btn} ${p.btnSm} ${p.btnDangerSm}`}
                                        onClick={() => eliminarBorradorDesdeLista(b)}
                                        aria-label="Eliminar borrador"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </section>}

            {/* ── Solapa ESTADÍSTICAS ── */}
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

            {/* ── Solapa PRESUPUESTO ── */}
            {solapa === "presupuesto" && <div className={p.layout}>
                <div className={p.colMain}>
                    <section className={p.card}>
                        <h3 className={p.cardTitle}>Paciente</h3>

                        <div className={p.grid2}>
                            <Campo label="Apellido y Nombre" wide>
                                <input
                                    className={p.input}
                                    autoComplete="name"
                                    placeholder="Ej: PÉREZ JUAN CARLOS"
                                    value={paciente.nombreCompleto}
                                    onChange={(e) =>
                                        setPaciente((f) => ({ ...f, nombreCompleto: e.target.value }))
                                    }
                                />
                            </Campo>

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

                            <Campo label="Obra Social">
                                <input
                                    className={p.input}
                                    list="os-sugerencias"
                                    autoComplete="off"
                                    placeholder="Escribí la O.S. (se guarda como sugerencia)"
                                    value={paciente.obraSocial}
                                    onChange={(e) =>
                                        setPaciente((f) => ({ ...f, obraSocial: e.target.value }))
                                    }
                                />
                                <datalist id="os-sugerencias">
                                    {sugerenciasOS.map((os) => (
                                        <option key={os} value={os} />
                                    ))}
                                </datalist>
                            </Campo>

                            <Campo label="N° de afiliado">
                                <input
                                    className={p.input}
                                    autoComplete="off"
                                    maxLength={30}
                                    placeholder="Ej: 1505000015/00"
                                    value={paciente.afiliado}
                                    onChange={(e) =>
                                        setPaciente((f) => ({ ...f, afiliado: e.target.value }))
                                    }
                                />
                            </Campo>
                        </div>

                        {estadoTxt && (
                            <p className={p.status} role="status">
                                {estadoTxt}
                            </p>
                        )}

                        <h4 className={p.sub}>Equipo médico (cirugía / práctica)</h4>
                        <div className={p.grid2}>
                            <Campo label="Cirujano">
                                <input {...bind("cirujano")} autoComplete="off" placeholder="Apellido y nombre" />
                            </Campo>
                            <Campo label="Anestesista">
                                <input {...bind("anestesista")} autoComplete="off" placeholder="Apellido y nombre" />
                            </Campo>
                            <Campo label="Ayudante 1">
                                <input {...bind("ayudante1")} autoComplete="off" placeholder="Apellido y nombre" />
                            </Campo>
                            <Campo label="Ayudante 2">
                                <input {...bind("ayudante2")} autoComplete="off" placeholder="Apellido y nombre" />
                            </Campo>
                        </div>

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
                                {borradores.map((b) => {
                                    const cantItems = itemsDe(b).length + codigosDe(b).length;
                                    return (
                                        <div key={b.id} className={p.borrador}>
                                            <span>
                                                {new Date(b.createdAt || 0).toLocaleDateString("es-AR")} ·{" "}
                                                {cantItems} ítems · {formatCurrency(b.total || 0)}
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
                                    );
                                })}
                            </>
                        )}
                    </section>

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

                        {filtrados.length === 0 ? (
                            <div className={p.empty}>
                                {consultaActiva
                                    ? "No encontramos productos con esa búsqueda."
                                    : "No hay productos cargados en el catálogo."}
                            </div>
                        ) : (
                            <>
                                <ul className={p.list}>
                                    {filtrados.map((item) => {
                                        const id = `${item.categoria}:${item.key}`;
                                        const raw = getPendienteRaw(id);
                                        return (
                                            <li key={id} className={p.productRow}>
                                                <div className={p.productInfo}>
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

                                                <div className={p.productActions}>
                                                    <div className={p.qtyGroup} role="group" aria-label={`Cantidad a agregar de ${item.nombre}`}>
                                                        <button
                                                            type="button"
                                                            className={p.qtyBtn}
                                                            onClick={() => restarPendiente(id)}
                                                            aria-label="Restar uno"
                                                        >
                                                            −
                                                        </button>
                                                        <input
                                                            className={p.qtyInput}
                                                            inputMode="decimal"
                                                            value={raw}
                                                            onChange={(e) => setPendiente(id, e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === "Enter") {
                                                                    e.preventDefault();
                                                                    confirmarAgregar(item);
                                                                }
                                                            }}
                                                            aria-label={`Cantidad de ${item.nombre}`}
                                                        />
                                                        <button
                                                            type="button"
                                                            className={`${p.qtyBtn} ${p.qtyBtnAdd}`}
                                                            onClick={() => sumarPendiente(id)}
                                                            aria-label="Sumar uno"
                                                        >
                                                            +
                                                        </button>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        className={`${p.btn} ${p.btnSm} ${p.btnAdd}`}
                                                        onClick={() => confirmarAgregar(item)}
                                                    >
                                                        Agregar
                                                    </button>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                                <p className={p.hint}>
                                    {consultaActiva
                                        ? `Mostrando hasta ${MAX_VISIBLES} coincidencias.`
                                        : "Mostrando algunos productos del catálogo. Escribí al menos " + MIN_BUSQUEDA + " caracteres para filtrar."}
                                </p>
                            </>
                        )}
                    </section>
                </div>

                <aside id="carrito" className={`${p.card} ${p.cart}`}>
                    <h3 className={p.cardTitle}>
                        🛒 Presupuesto {edicion?.id ? "(borrador en edición)" : ""}
                    </h3>

                    {carrito.length === 0 && codigosOS.length === 0 ? (
                        <div className={p.empty}>Agregá productos o códigos.</div>
                    ) : (
                        <>
                            {carrito.map((c) => (
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
                                            inputMode="decimal"
                                            aria-label={`Cantidad de ${c.nombre}`}
                                            placeholder="0"
                                            value={c._raw !== undefined ? c._raw : String(c.cantidad ?? "")}
                                            onChange={(e) => cambiarCantidad(c.id, e.target.value)}
                                            onBlur={() =>
                                                setCarrito((arr) =>
                                                    arr.map((x) =>
                                                        x.id === c.id
                                                            ? {
                                                                ...x,
                                                                _raw: undefined,
                                                                cantidad:
                                                                    Number.isFinite(x.cantidad) && x.cantidad > 0
                                                                        ? x.cantidad
                                                                        : 1,
                                                            }
                                                            : x,
                                                    ),
                                                )
                                            }
                                        />
                                        <strong>{formatCurrency(c.precio * (Number(c.cantidad) || 0))}</strong>
                                    </div>
                                </div>
                            ))}

                            <h4 className={p.sub}>Códigos / Prácticas</h4>
                            {codigosOS.length === 0 ? (
                                <p className={p.hint}>Todavía no cargaste códigos.</p>
                            ) : (
                                codigosOS.map((c) => (
                                    <div key={c.id} className={p.cartRow}>
                                        <div>
                                            <div className={p.codigoLabel}>
                                                {c.codigo ? `Código ${c.codigo}` : "Sin código"}
                                            </div>
                                            <div className={p.codigoDesc}>
                                                {c.descripcion || "Sin descripción"}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className={`${p.btn} ${p.btnSm}`}
                                            onClick={() => quitarCodigo(c.id)}
                                            aria-label="Quitar código"
                                        >
                                            ✕
                                        </button>
                                        <div className={p.cartControls}>
                                            <span />
                                            <strong>{c.monto > 0 ? formatCurrency(c.monto) : "—"}</strong>
                                        </div>
                                    </div>
                                ))
                            )}

                            <div className={p.codigoForm}>
                                <Campo label="Código">
                                    <input
                                        className={p.input}
                                        placeholder="Ej: 62.001"
                                        value={formCodigo.codigo}
                                        onChange={(e) => setFormCodigo((f) => ({ ...f, codigo: e.target.value }))}
                                    />
                                </Campo>
                                <Campo label="Monto (opcional)">
                                    <input
                                        className={p.input}
                                        placeholder="0,00"
                                        inputMode="decimal"
                                        value={formCodigo.monto}
                                        onChange={(e) => setFormCodigo((f) => ({ ...f, monto: e.target.value }))}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarCodigo(); } }}
                                    />
                                </Campo>
                                <Campo label="Descripción / Práctica" wide>
                                    <input
                                        className={p.input}
                                        placeholder="Ej: Consulta médica..."
                                        value={formCodigo.descripcion}
                                        onChange={(e) => setFormCodigo((f) => ({ ...f, descripcion: e.target.value }))}
                                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarCodigo(); } }}
                                    />
                                </Campo>
                                <button
                                    type="button"
                                    className={`${p.btn} ${p.btnPrimary} ${p.full}`}
                                    onClick={agregarCodigo}
                                >
                                    + Agregar código
                                </button>
                            </div>
                        </>
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
                            disabled={saving || (carrito.length === 0 && codigosOS.length === 0)}
                        >
                            {saving ? "Guardando..." : edicion?.id ? "Actualizar borrador" : "Guardar borrador"}
                        </button>
                        <button
                            type="button"
                            className={p.btn}
                            onClick={imprimir}
                            disabled={carrito.length === 0 && codigosOS.length === 0}
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
                {carrito.length + codigosOS.length} ítems · {formatCurrency(total)}
            </a>}

            <div style={{ display: "none" }}>
                <PresupuestoOSImprimible
                    ref={printRef}
                    paciente={paciente}
                    items={carrito}
                    codigos={codigosOS}
                    total={total}
                    nro={edicion?.id ? edicion.id.slice(-6).toUpperCase() : ""}
                />
            </div>
        </div>
    );
}
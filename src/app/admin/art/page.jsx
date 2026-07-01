"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

// ── Proveedores ──
const PROVEEDORES = [
  {
    id: "asociart", nombre: "ASOCIART", color: "#e11d48",
    siniestros: [
      { nombre: "Alejandro Roll", email: "arolls@asociart.com.ar" },
      { nombre: "Ezequiel Romero (SIPE)", email: "ERomero@asociart.com.ar" },
      { nombre: "Gerardo Sione (SIPE)", email: "GSione@asociart.com.ar" },
      { nombre: "Viviana Colombo (SIPE)", email: "vcolombo@asociart.com.ar" },
      { nombre: "Cirugías ASOCIART", email: "cirugias@asociart.com.ar" },
    ],
    facturacion: [],
  },
  {
    id: "iaps", nombre: "IAPS", color: "#2563eb",
    siniestros: [
      { nombre: "Adm. IAPS (Marcolini)", email: "mmarcolini@iapserseguros.seg.ar" },
      { nombre: "Adm. IAPS (MV López)", email: "mvlopez@iapserseguros.seg.ar" },
      { nombre: "Adriana – Adm. Convenios", email: "Adriana.siniestros@gmail.com" },
      { nombre: "Autorizaciones IAPS", email: "autorizaciones_art@institutoseguro.com.ar" },
      { nombre: "Lucrecia Bacigaluppe", email: "lbacigaluppe@iapserseguros.seg.ar" },
      { nombre: "Sergio Medina", email: "smedina@institutoseguro.com.ar" },
      { nombre: "Cecilia Strohl (Paraná)", email: "mstrohl@iapserseguros.seg.ar" },
    ],
    facturacion: [
      { nombre: "IAPS Siniestros Personales", email: "isiniestrospersonales@iapserseguros.seg.ar" },
      { nombre: "Valentina Sapetti (AP)", email: "vsapetti@iapserseguros.seg.ar" },
    ],
  },
  {
    id: "fedpat_art", nombre: "Fed. Patronal ART", color: "#7c3aed",
    siniestros: [
      { nombre: "Patricio Leraci (Grp. 59)", email: "siniestrosartgrupo59@fedpat.com.ar" },
      { nombre: "Siniestros Grupo 13", email: "siniestrosartgrupo13@fedpat.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación Fed. Patronal", email: "liqprestadoresart01@fedpat.com.ar" },
    ],
  },
  {
    id: "fedpat_ap", nombre: "Fed. Patronal AP", color: "#9333ea",
    siniestros: [
      { nombre: "Accidentes Personales", email: "siniestrosapprescm@fedpat.com.ar" },
      { nombre: "Nico Corazza", email: "NCORAZZA@fedpat.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación Fed. Patronal", email: "liqprestadoresart01@fedpat.com.ar" },
    ],
  },
  {
    id: "la_segunda_art", nombre: "La Segunda ART", color: "#0891b2",
    siniestros: [
      { nombre: "Martina Gordo", email: "mgordo@lasegunda.com.ar" },
      { nombre: "Paola", email: "pravagnani@lasegunda.com.ar" },
      { nombre: "Tablero ART", email: "tableroart@avalian.com" },
      { nombre: "Wilson Norman (Auditor)", email: "wnorman@lasegunda.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación La Segunda ART", email: "facturadigitalart@avalian.com" },
    ],
  },
  {
    id: "la_segunda_ap", nombre: "La Segunda AP", color: "#0e7490",
    siniestros: [
      { nombre: "Ana Clara Campos", email: "acampos@lasegunda.com.ar" },
      { nombre: "Autorizaciones AP", email: "autorizacionaccidentespersonales@lasegunda.com.ar" },
      { nombre: "Miguel Piana", email: "mpiana@lasegunda.com.ar" },
      { nombre: "Pedidos Ortopedia", email: "pedidosortopedia@lasegunda.com.ar" },
    ],
    facturacion: [
      { nombre: "Pagos Acc. Personales", email: "pagosaccidentespersonales@lasegunda.com.ar" },
    ],
  },
  {
    id: "reconquista", nombre: "Reconquista ART", color: "#059669",
    siniestros: [
      { nombre: "Reconquista ART", email: "art@reconquistart.com.ar" },
      { nombre: "Marianela Calabresse", email: "MLC@reconquistart.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación Reconquista", email: "facturacion.prestadores.rec@gmail.com" },
    ],
  },
  {
    id: "medical_work", nombre: "Medical Work", color: "#d97706",
    siniestros: [
      { nombre: "Siniestros Medical Work", email: "siniestros@medicarw.com.ar" },
      { nombre: "Laura Torres", email: "laurat@medicarw.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación Medical Work", email: "siniestros@medicarw.com.ar" },
    ],
  },
  {
    id: "confye", nombre: "CONFYE", color: "#16a34a",
    siniestros: [
      { nombre: "Coordinación Médica", email: "coordinacionmedica.nacional@comfye.com" },
      { nombre: "Irina Manzur", email: "irinamanzur3@gmail.com" },
      { nombre: "Irina Manzur (Auditora)", email: "irina@comfye.com" },
    ],
    facturacion: [
      { nombre: "Coord. Médica (Fact.)", email: "coordinacionmedica.nacional@comfye.com" },
      { nombre: "Irina Manzur (Auditora)", email: "irina@comfye.com" },
    ],
  },
  {
    id: "victoria", nombre: "Victoria Seguros", color: "#dc2626",
    siniestros: [
      { nombre: "Victoria Seguros ART", email: "art@institutosmedicoslabor.com.ar" },
    ],
    facturacion: [
      { nombre: "Proveedores Victoria Seguros", email: "PROVEEDORES@INSTITUTOSMEDICOSLABOR.COM.AR" },
    ],
  },
];

// ── Prácticas por defecto ──
const ACCIONES_DEFAULT = [
  { id: "evolucion", label: "Evolución", short: "EVOLUCIÓN", emoji: "📋", adjunto: "Evolución del paciente", codigo: "/COD.: 42.01.01 CONSULTA MEDICA DR {medico}", defaultSelected: true },
  { id: "curacion", label: "Curación", short: "CURACIÓN", emoji: "🩹", adjunto: "Indicación de curación", codigo: "/COD.: 43.02.01 CURACION + MEDICAMENTOS Y DESCARTABLES" },
  { id: "fkt", label: "FKT", short: "FKT", emoji: "🏃", adjunto: "Pedido de FKT", codigo: "SE SOLICITAN 10 SESIONES DE FKT" },
  { id: "mgt", label: "MGT", short: "MGT", emoji: "💪", adjunto: "Pedido de MGT", codigo: "SE SOLICITAN 10 SESIONES DE MGT" },
  { id: "rx", label: "RX", short: "RX", emoji: "📷", adjunto: "Pedido de RX", codigo: "/COD.: AUTORIZACION RX ______" },
  { id: "rmn", label: "RMN", short: "RMN", emoji: "🧲", adjunto: "Pedido de RMN", codigo: "/COD.: AUTORIZACION RMN SIN CONTRASTE" },
  { id: "sutura", label: "Sutura", short: "SUTURA", emoji: "🧵", adjunto: "Indicación de sutura", codigo: "/COD.: SUTURA 13.01.10 X 1 DR" },
  { id: "yeso", label: "Yeso", short: "YESO", emoji: "🦴", adjunto: "Indicación de yeso", codigo: "/COD.: AUTORIZACION YESO ______" },
  { id: "tac", label: "TAC", short: "TAC", emoji: "🔬", adjunto: "Pedido de TAC", codigo: "/COD.: AUTORIZACION TAC S/C DE ______" },
  { id: "ecografia", label: "Ecografía", short: "ECOGRAFIA", emoji: "🩻", adjunto: "Pedido de ecografía", codigo: "/COD.: AUTORIZACION ECOGRAFIA DE PARTES BLANDAS" },
  { id: "cirugia", label: "Cirugía", short: "CIRUGIA", emoji: "🏥", adjunto: "Solicitud de cirugía", codigo: "/COD.: AUTORIZACION CIRUGIA ______, LAB, ECG Y MATERIALES" },
  { id: "inmovilizador", label: "Inmovilizador", short: "INMOVILIZADOR", emoji: "🦾", adjunto: "Indicación de inmovilizador", codigo: "/COD.: AUTORIZACION INMOVILIZADOR ______" },
];

const FIRMA = `Saludos,
Juanma - Área de ART
Clínica de la Unión S.A.
Chajarí, Entre Ríos
WhatsApp: 3456441580`;

const getPacienteNombre = (p) =>
  `${p?.trabajador?.apellido || ""} ${p?.trabajador?.nombre || ""}`.trim();

const normalize = (value) =>
  String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const buildGmailUrl = ({ to, subject, body }) => {
  const params = new URLSearchParams({ view: "cm", fs: "1", to, su: subject, body });
  return `https://mail.google.com/mail/?${params.toString()}`;
};

// ── Funciones de ayuda para acciones ──
const getAccionesTexto = (ids, accionesDisponibles) => {
  const map = Object.fromEntries(accionesDisponibles.map(a => [a.id, a]));
  const tieneFkt = ids.includes("fkt");
  const tieneMgt = ids.includes("mgt");

  const labels = ids.reduce((acc, id) => {
    if (id === "fkt" || id === "mgt") return acc;
    acc.push(map[id]?.short || id.toUpperCase());
    return acc;
  }, []);

  if (tieneFkt && tieneMgt) {
    labels.push("FKT + MGT");
  } else {
    if (tieneFkt) labels.push("FKT");
    if (tieneMgt) labels.push("MGT");
  }

  return labels.join(" Y ");
};

const buildSolicitudes = (ids, medico, accionesDisponibles) => {
  const map = Object.fromEntries(accionesDisponibles.map(a => [a.id, a]));
  const medicoTexto = medico?.trim() || "______";

  const solicitudes = ids.map(id => {
    const accion = map[id];
    if (!accion) return "";
    return accion.codigo.replace(/\{medico\}/g, medicoTexto);
  }).filter(Boolean);

  if (ids.includes("fkt") && ids.includes("mgt")) {
    // Reemplazar líneas individuales de FKT y MGT por la combinada
    const lineasFiltradas = solicitudes.filter(linea =>
      linea !== map["fkt"]?.codigo.replace("{medico}", medicoTexto) &&
      linea !== map["mgt"]?.codigo.replace("{medico}", medicoTexto)
    );
    return [...lineasFiltradas, "SE SOLICITAN FKT + MGT POR 10 SESIONES"];
  }

  return solicitudes;
};

export default function ARTComunicador() {
  // ── Estados ──
  const [tab, setTab] = useState("siniestros");
  const [selectedArts, setSelectedArts] = useState(new Set());
  const [accionesSeleccionadas, setAccionesSeleccionadas] = useState(["evolucion"]);
  const [destinatariosOff, setDestinatariosOff] = useState({});

  const [pacientes, setPacientes] = useState([]);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [paciente, setPaciente] = useState(null);
  const [medico, setMedico] = useState("");

  const [copiado, setCopiado] = useState(false);

  // Edición del cuerpo
  const [cuerpoEditado, setCuerpoEditado] = useState("");
  const cuerpoEditadoPorUsuario = useRef(false);

  // Atajos personalizados
  const [atajos, setAtajos] = useState([]);
  const [loadingAtajos, setLoadingAtajos] = useState(true);
  const [atajoActivo, setAtajoActivo] = useState(null);

  const [mostrarFormAtajo, setMostrarFormAtajo] = useState(false);
  const [editandoAtajo, setEditandoAtajo] = useState(null);
  const [nuevoAtajoLabel, setNuevoAtajoLabel] = useState("");
  const [nuevoAtajoAsunto, setNuevoAtajoAsunto] = useState("");
  const [nuevoAtajoAcciones, setNuevoAtajoAcciones] = useState(["evolucion"]);
  const [nuevoAtajoCuerpo, setNuevoAtajoCuerpo] = useState("");
  const [guardandoAtajo, setGuardandoAtajo] = useState(false);
  const [errorAtajo, setErrorAtajo] = useState("");

  // Acciones dinámicas
  const [accionesDisponibles, setAccionesDisponibles] = useState(ACCIONES_DEFAULT);
  const [loadingAcciones, setLoadingAcciones] = useState(true);
  const [mostrarGestionAcciones, setMostrarGestionAcciones] = useState(false);

  // ── Carga de acciones desde Firebase ──
  useEffect(() => {
    fetch(`${FIREBASE_URL}/ART-MAILS/acciones.json`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (data && typeof data === "object") {
          const lista = Object.entries(data).map(([id, val]) => ({
            id,
            label: val.label || id,
            short: val.short || val.label?.toUpperCase() || id.toUpperCase(),
            emoji: val.emoji || "📌",
            adjunto: val.adjunto || "",
            codigo: val.codigo || "",
            defaultSelected: !!val.defaultSelected,
          }));
          setAccionesDisponibles(lista);
        }
      })
      .catch(() => console.log("Usando acciones por defecto"))
      .finally(() => setLoadingAcciones(false));
  }, []);

  // Sincronizar acciones seleccionadas con los defaults al cargar
  useEffect(() => {
    if (accionesDisponibles.length > 0) {
      const defaults = accionesDisponibles.filter(a => a.defaultSelected).map(a => a.id);
      if (defaults.length > 0) setAccionesSeleccionadas(defaults);
    }
  }, [accionesDisponibles]);

  // ── Pacientes ──
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${FIREBASE_URL}/pacientes.json`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => {
        if (!data) { setPacientes([]); return; }
        const lista = Object.entries(data)
          .map(([id, v]) => ({ id, ...v, fullName: getPacienteNombre(v) }))
          .filter(p => p.fullName || p.trabajador?.dni)
          .sort((a, b) => a.fullName.localeCompare(b.fullName));
        setPacientes(lista);
      })
      .catch(() => {})
      .finally(() => setLoadingPacientes(false));
    return () => controller.abort();
  }, []);

  // ── Atajos ──
  useEffect(() => {
    fetch(`${FIREBASE_URL}/ART-MAILS/atajos.json`)
      .then(r => r.json())
      .then(data => {
        if (!data) { setAtajos([]); return; }
        const lista = Object.entries(data).map(([id, val]) => ({
          id,
          label: val.label || "Sin nombre",
          asunto: val.asunto || "",
          cuerpo: val.cuerpo || "",
          acciones: val.acciones || [],
        }));
        setAtajos(lista);
      })
      .catch(() => {})
      .finally(() => setLoadingAtajos(false));
  }, []);

  // ── Contactos combinados de las ARTs seleccionadas ──
  const contactos = useMemo(() => {
    if (selectedArts.size === 0) return [];
    const contacts = [];
    selectedArts.forEach(id => {
      const art = PROVEEDORES.find(p => p.id === id);
      if (art) {
        const list = tab === "siniestros" ? art.siniestros : art.facturacion;
        list.forEach(c => contacts.push({ ...c, artId: id }));
      }
    });
    return contacts.filter((c, i, arr) => arr.findIndex(x => x.email === c.email) === i);
  }, [selectedArts, tab]);

  // ── Datos del paciente seleccionado ──
  const pacienteData = useMemo(() => {
    const nombre = paciente?.fullName || "";
    const dni = paciente?.trabajador?.dni || "";
    const stro = paciente?.ART?.nroSiniestro || "";
    const artPaciente = paciente?.ART?.nombre || "";
    return { nombre, dni, stro, artPaciente };
  }, [paciente]);

  // ── Asunto ──
  const asunto = useMemo(() => {
    if (!paciente) return "";
    if (atajoActivo?.asunto) {
      return atajoActivo.asunto
        .replace(/\{nombre\}/g, pacienteData.nombre)
        .replace(/\{dni\}/g, pacienteData.dni || "—")
        .replace(/\{stro\}/g, pacienteData.stro || "—")
        .replace(/\{art\}/g, pacienteData.artPaciente || "—")
        .replace(/\{medico\}/g, medico.trim() || "______");
    }
    if (tab === "facturacion") {
      return `FACTURACION PTE ${pacienteData.nombre} - DNI ${pacienteData.dni || "—"}`;
    }
    const accionesTexto = getAccionesTexto(accionesSeleccionadas, accionesDisponibles);
    return `SE ENVIA ${accionesTexto} PTE ${pacienteData.nombre} DNI ${pacienteData.dni || "—"}`;
  }, [paciente, pacienteData, accionesSeleccionadas, medico, atajoActivo, tab, accionesDisponibles]);

  // ── Cuerpo automático ──
  const cuerpo = useMemo(() => {
    if (!paciente) return "";
    const medicoTexto = medico.trim() || "______";
    if (atajoActivo?.cuerpo) {
      return atajoActivo.cuerpo
        .replace(/\{nombre\}/g, pacienteData.nombre)
        .replace(/\{dni\}/g, pacienteData.dni || "—")
        .replace(/\{stro\}/g, pacienteData.stro || "—")
        .replace(/\{art\}/g, pacienteData.artPaciente || "—")
        .replace(/\{medico\}/g, medicoTexto)
        .replace(/\{firma\}/g, FIRMA);
    }
    if (tab === "facturacion") {
      return `Buen día.

Por medio del presente, se adjunta facturación correspondiente al paciente:

Nombre completo: ${pacienteData.nombre}
DNI: ${pacienteData.dni || "—"}
N° de siniestro: ${pacienteData.stro || "—"}
ART: ${pacienteData.artPaciente || "—"}
Médico: Dr/a. ${medicoTexto}

${FIRMA}`;
    }
    const accionesTexto = getAccionesTexto(accionesSeleccionadas, accionesDisponibles);
    const solicitudes = buildSolicitudes(accionesSeleccionadas, medicoTexto, accionesDisponibles);
    return `Buen día.

Por medio del presente, se remite la documentación médica correspondiente al paciente en referencia.

Adjunto: ${accionesTexto}

Solicito autorización a la brevedad de lo/s siguiente/es código/s:
${solicitudes.join("\n")}

${FIRMA}`;
  }, [paciente, tab, pacienteData, accionesSeleccionadas, medico, atajoActivo, accionesDisponibles]);

  // ── Sincronizar cuerpoEditado con el cuerpo automático ──
  useEffect(() => {
    if (!cuerpoEditadoPorUsuario.current) {
      setCuerpoEditado(cuerpo);
    }
  }, [cuerpo]);

  // Reiniciar la bandera cuando cambian los parámetros principales
  useEffect(() => {
    cuerpoEditadoPorUsuario.current = false;
  }, [paciente, accionesSeleccionadas, medico, tab, atajoActivo]);

  // ── Destinatarios activos ──
  const destinatarioKey = (i) => `${i}`;
  const isDestinatarioActivo = (i) => destinatariosOff[destinatarioKey(i)] !== true;
  const emailsActivos = useMemo(() =>
    contactos.filter((_, i) => isDestinatarioActivo(i)).map(c => c.email),
    [contactos, destinatariosOff]
  );

  // ── URL de Gmail (usa cuerpoEditado) ──
  const gmailUrl = useMemo(() => {
    if (!emailsActivos.length || !asunto || !cuerpoEditado) return "#";
    return buildGmailUrl({ to: emailsActivos.join(","), subject: asunto, body: cuerpoEditado });
  }, [emailsActivos, asunto, cuerpoEditado]);

  // ── Recordatorio de adjuntos ──
  const adjuntosRecordatorio = useMemo(() => {
    if (!paciente || tab !== "siniestros") return [];
    return accionesSeleccionadas.map(id => accionesDisponibles.find(a => a.id === id)?.adjunto).filter(Boolean);
  }, [paciente, tab, accionesSeleccionadas, accionesDisponibles]);

  const canSend = Boolean(selectedArts.size > 0 && paciente && emailsActivos.length && asunto && cuerpoEditado);
  const faltante = useMemo(() => {
    if (selectedArts.size === 0) return "Seleccioná al menos una ART.";
    if (!paciente) return "Seleccioná un paciente.";
    if (!emailsActivos.length) return "Seleccioná al menos un destinatario.";
    return "";
  }, [selectedArts, paciente, emailsActivos.length]);

  // ── Handlers ──
  const handleSelectPaciente = (p) => {
    setPaciente(p);
    setSearchTerm(p.fullName || p.trabajador?.dni || "");
    setShowSuggestions(false);
  };

  const toggleAccion = (id) => {
    setAccionesSeleccionadas(prev => {
      if (prev.includes(id)) {
        const next = prev.filter(a => a !== id);
        return next.length ? next : ["evolucion"];
      }
      return [...prev, id];
    });
    setAtajoActivo(null);
  };

  const toggleArt = (id) => {
    setSelectedArts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllArts = (selectAll) => {
    if (selectAll) setSelectedArts(new Set(PROVEEDORES.map(a => a.id)));
    else setSelectedArts(new Set());
  };

  const toggleDestinatario = (i) => {
    setDestinatariosOff(prev => ({ ...prev, [destinatarioKey(i)]: !prev[destinatarioKey(i)] }));
  };

  const toggleAllDestinatarios = (activo) => {
    setDestinatariosOff(prev => {
      const next = { ...prev };
      contactos.forEach((_, i) => { next[destinatarioKey(i)] = !activo; });
      return next;
    });
  };

  const copiarCuerpo = async () => {
    try {
      await navigator.clipboard.writeText(cuerpoEditado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {}
  };

  const restaurarCuerpo = () => {
    setCuerpoEditado(cuerpo);
    cuerpoEditadoPorUsuario.current = false;
  };

  const filteredPacientes = useMemo(() => {
    const term = normalize(searchTerm.trim());
    if (!term) return [];
    return pacientes
      .filter(p => {
        const nombre = normalize(p.fullName);
        const dni = normalize(p.trabajador?.dni);
        const siniestro = normalize(p.ART?.nroSiniestro);
        return nombre.includes(term) || dni.includes(term) || siniestro.includes(term);
      })
      .slice(0, 10);
  }, [pacientes, searchTerm]);

  // ── Gestión de acciones ──
  const [editActionId, setEditActionId] = useState(null);
  const [formAction, setFormAction] = useState({ id: "", label: "", short: "", emoji: "", adjunto: "", codigo: "", defaultSelected: false });

  const openNewAction = () => {
    setEditActionId(null);
    setFormAction({ id: "", label: "", short: "", emoji: "📌", adjunto: "", codigo: "", defaultSelected: false });
    setMostrarGestionAcciones(true);
  };

  const openEditAction = (accion) => {
    setEditActionId(accion.id);
    setFormAction({ ...accion });
    setMostrarGestionAcciones(true);
  };

  const saveAction = async () => {
    if (!formAction.id.trim() || !formAction.label.trim()) {
      alert("ID y nombre son obligatorios");
      return;
    }
    const url = `${FIREBASE_URL}/ART-MAILS/acciones/${formAction.id}.json`;
    const method = "PUT";
    try {
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: formAction.label,
          short: formAction.short,
          emoji: formAction.emoji,
          adjunto: formAction.adjunto,
          codigo: formAction.codigo,
          defaultSelected: formAction.defaultSelected,
        }),
      });
      const res = await fetch(`${FIREBASE_URL}/ART-MAILS/acciones.json`);
      const data = await res.json();
      if (data) {
        const lista = Object.entries(data).map(([id, val]) => ({
          id,
          label: val.label || id,
          short: val.short || val.label?.toUpperCase() || id.toUpperCase(),
          emoji: val.emoji || "📌",
          adjunto: val.adjunto || "",
          codigo: val.codigo || "",
          defaultSelected: !!val.defaultSelected,
        }));
        setAccionesDisponibles(lista);
      }
      setMostrarGestionAcciones(false);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
  };

  const deleteAction = async (id) => {
    if (!confirm(`¿Eliminar la práctica "${id}"?`)) return;
    await fetch(`${FIREBASE_URL}/ART-MAILS/acciones/${id}.json`, { method: "DELETE" });
    const res = await fetch(`${FIREBASE_URL}/ART-MAILS/acciones.json`);
    const data = await res.json();
    if (data) {
      const lista = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      setAccionesDisponibles(lista);
    } else {
      setAccionesDisponibles([]);
    }
  };

  const eliminarAtajo = async (atajoId) => {
    if (!confirm("¿Eliminar atajo?")) return;
    await fetch(`${FIREBASE_URL}/ART-MAILS/atajos/${atajoId}.json`, { method: "DELETE" });
    if (atajoActivo?.id === atajoId) setAtajoActivo(null);
    fetch(`${FIREBASE_URL}/ART-MAILS/atajos.json`)
      .then(r => r.json())
      .then(data => {
        if (data) setAtajos(Object.entries(data).map(([id, v]) => ({ id, ...v })));
        else setAtajos([]);
      });
  };

  const guardarAtajo = async () => {
    setErrorAtajo("");
    if (!nuevoAtajoLabel.trim()) { setErrorAtajo("El nombre del atajo es obligatorio"); return; }
    if (!nuevoAtajoAsunto.trim() && !nuevoAtajoCuerpo.trim()) {
      setErrorAtajo("Debés completar al menos el asunto o el cuerpo"); return;
    }
    setGuardandoAtajo(true);
    try {
      const nuevoAtajo = {
        label: nuevoAtajoLabel.trim(),
        asunto: nuevoAtajoAsunto.trim(),
        acciones: nuevoAtajoAcciones,
        cuerpo: nuevoAtajoCuerpo.trim(),
      };
      const method = editandoAtajo ? "PUT" : "POST";
      const url = editandoAtajo
        ? `${FIREBASE_URL}/ART-MAILS/atajos/${editandoAtajo.id}.json`
        : `${FIREBASE_URL}/ART-MAILS/atajos.json`;
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoAtajo),
      });
      if (!response.ok) throw new Error("No se pudo guardar el atajo");
      setNuevoAtajoLabel("");
      setNuevoAtajoAsunto("");
      setNuevoAtajoCuerpo("");
      setMostrarFormAtajo(false);
      setEditandoAtajo(null);
      const res = await fetch(`${FIREBASE_URL}/ART-MAILS/atajos.json`);
      const data = await res.json();
      if (data) setAtajos(Object.entries(data).map(([id, v]) => ({ id, ...v })));
      else setAtajos([]);
    } catch (err) {
      setErrorAtajo("Error al guardar el atajo");
    } finally {
      setGuardandoAtajo(false);
    }
  };

  const seleccionarAtajo = (atajo) => {
    setAtajoActivo(atajo);
    if (atajo.acciones?.length) {
      setAccionesSeleccionadas(atajo.acciones);
    } else {
      setAccionesSeleccionadas(["evolucion"]);
    }
  };

  return (
    <main className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <div className={styles.topIcon}>📧</div>
          <div>
            <h1 className={styles.topTitle}>Comunicador ART</h1>
            <p className={styles.topSub}>Buscá el paciente, elegí la práctica y abrí el mail listo en Gmail.</p>
          </div>
        </div>

        <section className={styles.modeTabs} aria-label="Tipo de envío">
          <button
            type="button"
            className={`${styles.modeTab} ${tab === "siniestros" ? styles.modeTabOn : ""}`}
            onClick={() => setTab("siniestros")}
          >
            📋 Siniestros / Autorizaciones
          </button>
          <button
            type="button"
            className={`${styles.modeTab} ${tab === "facturacion" ? styles.modeTabOn : ""}`}
            onClick={() => setTab("facturacion")}
          >
            💰 Facturación
          </button>
        </section>
      </header>

      <div className={styles.grid}>
        {/* ── Panel izquierdo ── */}
        <section className={styles.leftPanel}>
          {/* 1. ARTs múltiples */}
          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>1. ARTs / Aseguradoras</p>
              <span className={styles.blockHint}>{selectedArts.size} seleccionada(s)</span>
              <div className={styles.toggleBtns}>
                <button className={styles.tinyBtn} onClick={() => toggleAllArts(true)}>Todas</button>
                <button className={styles.tinyBtn} onClick={() => toggleAllArts(false)}>Ninguna</button>
              </div>
            </div>
            <div className={styles.artGrid}>
              {PROVEEDORES.map(p => {
                const selected = selectedArts.has(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.artChip} ${selected ? styles.artChipOn : ""}`}
                    style={selected ? { "--c": p.color } : undefined}
                    onClick={() => toggleArt(p.id)}
                  >
                    <span className={styles.artDot} style={{ backgroundColor: p.color }} />
                    {p.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Paciente (con clase searchBlock para z-index) */}
          <div className={`${styles.block} ${styles.searchBlock}`}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>2. Paciente</p>
              {loadingPacientes && <span className={styles.badge}>Cargando...</span>}
            </div>
            <div className={styles.searchWrap}>
              <input
                type="search"
                className={styles.inp}
                placeholder="Buscar por apellido, nombre, DNI o siniestro..."
                value={searchTerm}
                autoComplete="off"
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                  setPaciente(null);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
              />
              {showSuggestions && filteredPacientes.length > 0 && (
                <div className={styles.dropdown}>
                  {filteredPacientes.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.dropItem}
                      onMouseDown={() => handleSelectPaciente(p)}
                    >
                      <span className={styles.dropName}>{p.fullName || "Sin nombre"}</span>
                      <span className={styles.dropMeta}>
                        DNI {p.trabajador?.dni || "—"} · Stro {p.ART?.nroSiniestro || "—"} · {p.ART?.nombre || "Sin ART"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              {showSuggestions && searchTerm && filteredPacientes.length === 0 && (
                <div className={styles.dropdown}>
                  <p className={styles.emptyMsg}>No se encontraron pacientes.</p>
                </div>
              )}
            </div>
            {paciente && (
              <div className={styles.pacienteCard}>
                <span className={styles.pacienteNombre}>{pacienteData.nombre}</span>
                <div className={styles.pacienteMeta}>
                  <span>DNI: <strong>{pacienteData.dni || "—"}</strong></span>
                  <span>Stro: <strong>{pacienteData.stro || "—"}</strong></span>
                  <span>ART: <strong>{pacienteData.artPaciente || "—"}</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* 3. Prácticas (solo en siniestros) */}
          {tab === "siniestros" && (
            <div className={styles.block}>
              <div className={styles.blockTop}>
                <p className={styles.blockLabel}>3. Prácticas / Prestaciones</p>
                <button className={styles.tinyBtn} onClick={() => setMostrarGestionAcciones(true)}>
                  ⚙️ Gestionar
                </button>
              </div>
              <div className={styles.quickRow}>
                <button className={styles.tinyBtn} onClick={() => setAccionesSeleccionadas(["evolucion"])}>Solo evolución</button>
                <button className={styles.tinyBtn} onClick={() => setAccionesSeleccionadas(["evolucion", "curacion"])}>Evolución + curación</button>
                <button className={styles.tinyBtn} onClick={() => setAccionesSeleccionadas(["evolucion", "fkt", "mgt"])}>Evolución + FKT</button>
                <button className={styles.tinyBtn} onClick={() => setAccionesSeleccionadas(["evolucion", "rx"])}>Evolución + RX</button>
                <button className={styles.tinyBtn} onClick={() => setAccionesSeleccionadas(["evolucion", "rmn"])}>Evolución + RMN</button>
              </div>
              <div className={styles.chips}>
                {accionesDisponibles.map(a => (
                  <button
                    key={a.id}
                    type="button"
                    className={`${styles.chip} ${accionesSeleccionadas.includes(a.id) ? styles.chipOn : ""}`}
                    onClick={() => toggleAccion(a.id)}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. Médico */}
          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>4. Médico</p>
              <span className={styles.blockHint}>Opcional</span>
            </div>
            <input
              type="text"
              className={styles.inp}
              placeholder="Ej: Gómez, Pérez..."
              value={medico}
              onChange={(e) => setMedico(e.target.value)}
            />
          </div>

          {/* Asunto generado */}
          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>Asunto generado</p>
              {atajoActivo && <span className={styles.badge}>Atajo: {atajoActivo.label}</span>}
            </div>
            <input
              type="text"
              className={styles.inp}
              value={asunto}
              readOnly
              placeholder="Se genera al seleccionar paciente..."
            />
          </div>

          {/* Cuerpo del mail (EDITABLE) */}
          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>Cuerpo del mail</p>
              <button type="button" className={styles.tinyBtn} onClick={copiarCuerpo} disabled={!cuerpoEditado}>
                {copiado ? "Copiado ✓" : "Copiar"}
              </button>
              <button type="button" className={styles.tinyBtn} onClick={restaurarCuerpo} disabled={!cuerpo}>
                Restaurar
              </button>
            </div>
            <textarea
              className={styles.area}
              value={cuerpoEditado}
              onChange={(e) => {
                setCuerpoEditado(e.target.value);
                cuerpoEditadoPorUsuario.current = true;
              }}
              placeholder="Se genera al seleccionar paciente..."
            />
          </div>

          {/* Atajos personalizados */}
          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>⚡ Atajos de Mail</p>
              <span className={styles.blockHint}>Asunto + Cuerpo personalizado</span>
            </div>
            <div className={styles.atajosWrapper}>
              {loadingAtajos ? (
                <p className={styles.emptyMsg}>Cargando atajos...</p>
              ) : atajos.length > 0 ? (
                <div className={styles.atajosList}>
                  {atajos.map(atajo => (
                    <div key={atajo.id} className={`${styles.atajoCard} ${atajoActivo?.id === atajo.id ? styles.atajoCardActive : ""}`}>
                      <div className={styles.atajoCardHeader}>
                        <button type="button" className={styles.atajoCardBtn} onClick={() => seleccionarAtajo(atajo)}>
                          {atajo.label}
                        </button>
                        <div className={styles.atajoCardActions}>
                          <button type="button" className={styles.atajoEdit} onClick={() => { setEditandoAtajo(atajo); setNuevoAtajoLabel(atajo.label); setNuevoAtajoAsunto(atajo.asunto || ""); setNuevoAtajoAcciones(atajo.acciones?.length ? atajo.acciones : ["evolucion"]); setNuevoAtajoCuerpo(atajo.cuerpo || ""); setMostrarFormAtajo(true); }}>✏️</button>
                          <button type="button" className={styles.atajoDelete} onClick={() => eliminarAtajo(atajo.id)}>×</button>
                        </div>
                      </div>
                      {atajoActivo?.id === atajo.id && (
                        <div className={styles.atajoCardPreview}>
                          <p className={styles.atajoPreviewLabel}>✅ Atajo activo</p>
                          {atajo.asunto && <p className={styles.atajoPreview}><strong>Asunto:</strong> {atajo.asunto}</p>}
                          {atajo.cuerpo && <p className={styles.atajoPreview}><strong>Cuerpo:</strong> {atajo.cuerpo.substring(0, 80)}...</p>}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyMsg}>No hay atajos creados.</p>
              )}
              <button type="button" className={styles.crearAtajoBtn} onClick={() => { setEditandoAtajo(null); setNuevoAtajoLabel(""); setNuevoAtajoAsunto(""); setNuevoAtajoAcciones(["evolucion"]); setNuevoAtajoCuerpo(""); setErrorAtajo(""); setMostrarFormAtajo(true); }}>
                ➕ Crear nuevo atajo
              </button>
            </div>
          </div>
        </section>

        {/* ── Panel derecho ── */}
        <aside className={styles.rightPanel}>
          <div className={styles.recipientsCard}>
            <div className={styles.recipientsTop}>
              <p className={styles.blockLabel}>Destinatarios</p>
              {contactos.length > 0 && (
                <div className={styles.toggleBtns}>
                  <button className={styles.tinyBtn} onClick={() => toggleAllDestinatarios(true)}>Todos</button>
                  <button className={styles.tinyBtn} onClick={() => toggleAllDestinatarios(false)}>Ninguno</button>
                </div>
              )}
            </div>
            {selectedArts.size === 0 ? (
              <p className={styles.emptyMsg}>Seleccioná al menos una ART.</p>
            ) : contactos.length === 0 ? (
              <p className={styles.emptyMsg}>No hay contactos para esta sección.</p>
            ) : (
              <ul className={styles.recipientsList}>
                {contactos.map((c, i) => (
                  <li key={`${c.email}-${i}`}>
                    <label className={`${styles.recipientRow} ${isDestinatarioActivo(i) ? styles.recipientRowOn : ""}`}>
                      <input type="checkbox" className={styles.chk} checked={isDestinatarioActivo(i)} onChange={() => toggleDestinatario(i)} />
                      <span className={styles.recipientData}>
                        <span className={styles.recipientNombre}>{c.nombre}</span>
                        <span className={styles.recipientEmail}>{c.email}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {emailsActivos.length > 0 && (
              <p className={styles.selCount}>{emailsActivos.length} destinatario{emailsActivos.length !== 1 ? "s" : ""} activo{emailsActivos.length !== 1 ? "s" : ""}</p>
            )}
          </div>

          <a
            href={canSend ? gmailUrl : "#"}
            className={`${styles.sendBtn} ${!canSend ? styles.sendBtnOff : ""}`}
            onClick={(e) => !canSend && e.preventDefault()}
            target="_blank"
            rel="noopener noreferrer"
          >
            🚀 Abrir Gmail con mail listo
          </a>

          {!canSend && <p className={styles.sendHint}>{faltante}</p>}

          {canSend && (
            <div className={styles.readyBox}>
              <p className={styles.adjuntosTitle}>✅ Listo para enviar</p>
              <p className={styles.emptyMsg}>Gmail se abre con destinatarios, asunto y cuerpo completo. Solo tenés que adjuntar los archivos y tocar enviar.</p>
            </div>
          )}

          {adjuntosRecordatorio.length > 0 && (
            <div className={styles.adjuntosBox}>
              <p className={styles.adjuntosTitle}>📎 Adjuntar en Gmail:</p>
              <ul className={styles.adjuntosList}>
                {adjuntosRecordatorio.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {/* ── Modal para gestionar prácticas ── */}
      {mostrarGestionAcciones && (
        <div className={styles.formAtajoOverlay} onClick={() => setMostrarGestionAcciones(false)}>
          <div className={styles.formAtajo} onClick={e => e.stopPropagation()}>
            <h3 className={styles.formAtajoTitle}>{editActionId ? "Editar práctica" : "Nueva práctica"}</h3>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>ID (código interno)</label>
              <input className={styles.inp} value={formAction.id} onChange={e => setFormAction({...formAction, id: e.target.value})} disabled={!!editActionId} />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Nombre</label>
              <input className={styles.inp} value={formAction.label} onChange={e => setFormAction({...formAction, label: e.target.value})} />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Texto corto (para asunto)</label>
              <input className={styles.inp} value={formAction.short} onChange={e => setFormAction({...formAction, short: e.target.value})} />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Código (usa {"{medico}"} si es necesario)</label>
              <textarea className={styles.area} rows={2} value={formAction.codigo} onChange={e => setFormAction({...formAction, codigo: e.target.value})} />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Emoji</label>
              <input className={styles.inp} value={formAction.emoji} onChange={e => setFormAction({...formAction, emoji: e.target.value})} />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Adjunto recordatorio</label>
              <input className={styles.inp} value={formAction.adjunto} onChange={e => setFormAction({...formAction, adjunto: e.target.value})} />
            </div>
            <label className={styles.recipientRow} style={{ marginTop: 8 }}>
              <input type="checkbox" className={styles.chk} checked={formAction.defaultSelected} onChange={e => setFormAction({...formAction, defaultSelected: e.target.checked})} />
              <span>Seleccionada por defecto</span>
            </label>
            <div className={styles.formAtajoBtns}>
              <button className={styles.tinyBtn} onClick={saveAction}>Guardar</button>
              <button className={styles.tinyBtn} onClick={() => setMostrarGestionAcciones(false)}>Cancelar</button>
              {editActionId && (
                <button className={styles.tinyBtn} style={{ background: "#b91c1c", color: "white" }} onClick={() => { deleteAction(editActionId); setMostrarGestionAcciones(false); }}>Eliminar</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal para atajos ── */}
      {mostrarFormAtajo && (
        <div className={styles.formAtajoOverlay} onClick={() => { setMostrarFormAtajo(false); setEditandoAtajo(null); setErrorAtajo(""); }}>
          <div className={styles.formAtajo} onClick={e => e.stopPropagation()}>
            <h3 className={styles.formAtajoTitle}>{editandoAtajo ? "Editar atajo" : "Nuevo atajo"}</h3>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Nombre del atajo *</label>
              <input type="text" className={styles.inp} placeholder="Ej: Pedido de RMN urgente" value={nuevoAtajoLabel} onChange={e => setNuevoAtajoLabel(e.target.value)} autoFocus />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Asunto del mail</label>
              <input type="text" className={styles.inp} placeholder="Ej: SOLICITUD RMN - {nombre} - DNI {dni}" value={nuevoAtajoAsunto} onChange={e => setNuevoAtajoAsunto(e.target.value)} />
              <p className={styles.formAtajoHint}>Variables: {"{nombre}"}, {"{dni}"}, {"{stro}"}, {"{art}"}, {"{medico}"}</p>
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Acciones incluidas</label>
              <div className={styles.chips}>
                {accionesDisponibles.map(accion => (
                  <button
                    key={accion.id}
                    type="button"
                    className={`${styles.chip} ${nuevoAtajoAcciones.includes(accion.id) ? styles.chipOn : ""}`}
                    onClick={() => setNuevoAtajoAcciones(prev => prev.includes(accion.id) ? prev.filter(a => a !== accion.id) : [...prev, accion.id])}
                  >
                    {accion.emoji} {accion.label}
                  </button>
                ))}
              </div>
              <p className={styles.formAtajoHint}>Estas acciones se seleccionan automáticamente al aplicar el atajo.</p>
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Cuerpo del mail</label>
              <textarea
                className={styles.area}
                rows={8}
                placeholder="Buen día,..."
                value={nuevoAtajoCuerpo}
                onChange={e => setNuevoAtajoCuerpo(e.target.value)}
              />
              <p className={styles.formAtajoHint}>Variables: {"{nombre}"}, {"{dni}"}, {"{stro}"}, {"{art}"}, {"{medico}"}, {"{firma}"}</p>
            </div>
            {errorAtajo && <p className={styles.errorMsg}>{errorAtajo}</p>}
            <div className={styles.formAtajoBtns}>
              <button type="button" className={styles.tinyBtn} onClick={guardarAtajo} disabled={guardandoAtajo}>
                {guardandoAtajo ? "Guardando..." : "✅ Guardar atajo"}
              </button>
              <button type="button" className={styles.tinyBtn} onClick={() => { setMostrarFormAtajo(false); setEditandoAtajo(null); setErrorAtajo(""); }} disabled={guardandoAtajo}>
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
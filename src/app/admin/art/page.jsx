"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

const PROVEEDORES = [
  {
    id: "asociart",
    nombre: "ASOCIART",
    color: "#e11d48",
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
    id: "iaps",
    nombre: "IAPS",
    color: "#2563eb",
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
    id: "fedpat_art",
    nombre: "Fed. Patronal ART",
    color: "#7c3aed",
    siniestros: [
      { nombre: "Patricio Leraci (Grp. 59)", email: "siniestrosartgrupo59@fedpat.com.ar" },
      { nombre: "Siniestros Grupo 13", email: "siniestrosartgrupo13@fedpat.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación Fed. Patronal", email: "liqprestadoresart01@fedpat.com.ar" },
    ],
  },
  {
    id: "fedpat_ap",
    nombre: "Fed. Patronal AP",
    color: "#9333ea",
    siniestros: [
      { nombre: "Accidentes Personales", email: "siniestrosapprescm@fedpat.com.ar" },
      { nombre: "Nico Corazza", email: "NCORAZZA@fedpat.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación Fed. Patronal", email: "liqprestadoresart01@fedpat.com.ar" },
    ],
  },
  {
    id: "la_segunda_art",
    nombre: "La Segunda ART",
    color: "#0891b2",
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
    id: "la_segunda_ap",
    nombre: "La Segunda AP",
    color: "#0e7490",
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
    id: "reconquista",
    nombre: "Reconquista ART",
    color: "#059669",
    siniestros: [
      { nombre: "Reconquista ART", email: "art@reconquistart.com.ar" },
      { nombre: "Marianela Calabresse", email: "MLC@reconquistart.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación Reconquista", email: "facturacion.prestadores.rec@gmail.com" },
    ],
  },
  {
    id: "medical_work",
    nombre: "Medical Work",
    color: "#d97706",
    siniestros: [
      { nombre: "Siniestros Medical Work", email: "siniestros@medicarw.com.ar" },
      { nombre: "Laura Torres", email: "laurat@medicarw.com.ar" },
    ],
    facturacion: [
      { nombre: "Facturación Medical Work", email: "siniestros@medicarw.com.ar" },
    ],
  },
  {
    id: "confye",
    nombre: "CONFYE",
    color: "#16a34a",
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
    id: "victoria",
    nombre: "Victoria Seguros",
    color: "#dc2626",
    siniestros: [
      { nombre: "Victoria Seguros ART", email: "art@institutosmedicoslabor.com.ar" },
    ],
    facturacion: [
      { nombre: "Proveedores Victoria Seguros", email: "PROVEEDORES@INSTITUTOSMEDICOSLABOR.COM.AR" },
    ],
  },
];

const ACCIONES = [
  {
    id: "evolucion",
    label: "Evolución",
    short: "EVOLUCIÓN",
    emoji: "📋",
    adjunto: "Evolución del paciente",
  },
  {
    id: "curacion",
    label: "Curación",
    short: "CURACIÓN",
    emoji: "🩹",
    adjunto: "Indicación de curación",
  },
  {
    id: "fkt",
    label: "FKT",
    short: "FKT",
    emoji: "🏃",
    adjunto: "Pedido de FKT",
  },
  {
    id: "rx",
    label: "RX",
    short: "RX",
    emoji: "📷",
    adjunto: "Pedido de RX",
  },
  {
    id: "rmn",
    label: "RMN",
    short: "RMN",
    emoji: "🧲",
    adjunto: "Pedido de RMN",
  },
  {
    id: "sutura",
    label: "Sutura",
    short: "SUTURA",
    emoji: "🧵",
    adjunto: "Indicación de sutura",
  },
  {
    id: "yeso",
    label: "Yeso",
    short: "YESO",
    emoji: "🦴",
    adjunto: "Indicación de yeso",
  },
  {
    id: "tac",
    label: "TAC",
    short: "TAC",
    emoji: "🔬",
    adjunto: "Pedido de TAC",
  },
  {
    id: "ecografia",
    label: "Ecografía",
    short: "ECOGRAFÍA",
    emoji: "🩻",
    adjunto: "Pedido de ecografía",
  },
  {
    id: "cirugia",
    label: "Cirugía",
    short: "CIRUGÍA",
    emoji: "🏥",
    adjunto: "Solicitud de cirugía",
  },
  {
    id: "mgt",
    label: "MGT",
    short: "MGT",
    emoji: "💪",
    adjunto: "Pedido de MGT",
  },
  {
    id: "inmovilizador",
    label: "Inmovilizador",
    short: "INMOVILIZADOR",
    emoji: "🦾",
    adjunto: "Indicación de inmovilizador",
  },
];

const FIRMA = `Saludos,
Juanma - Área de ART
Clínica de la Unión S.A.
Chajarí, Entre Ríos
WhatsApp: 3456441580`;

const getPacienteNombre = (p) =>
  `${p?.trabajador?.apellido || ""} ${p?.trabajador?.nombre || ""}`.trim();

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const buildGmailUrl = ({ to, subject, body }) => {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });

  return `https://mail.google.com/mail/?${params.toString()}`;
};

const buildSolicitudes = (ids, medico) => {
  const solicitudes = [];
  const medicoTexto = medico?.trim() || "______";

  if (ids.includes("evolucion")) {
    solicitudes.push(`Evolución cód. 42.01.01 x 1 consulta médica Dr/a. ${medicoTexto}.`);
  }

  if (ids.includes("curacion")) {
    solicitudes.push("Curación cód. 43.02.01 + medicamentos y descartables.");
  }

  if (ids.includes("fkt") && ids.includes("mgt")) {
    solicitudes.push("Autorización por 10 sesiones de FKT + MGT.");
  } else {
    if (ids.includes("fkt")) {
      solicitudes.push("Autorización por 10 sesiones de FKT.");
    }

    if (ids.includes("mgt")) {
      solicitudes.push("Autorización por 10 sesiones de MGT.");
    }
  }

  if (ids.includes("rx")) {
    solicitudes.push("Autorización para RX cód.: ______.");
  }

  if (ids.includes("rmn")) {
    solicitudes.push("Autorización para RMN sin contraste.");
  }

  if (ids.includes("sutura")) {
    solicitudes.push("Sutura cód. 13.01.10 x 1 DR.");
  }

  if (ids.includes("yeso")) {
    solicitudes.push("Autorización de yeso cód.: ______.");
  }

  if (ids.includes("tac")) {
    solicitudes.push("Autorización para TAC s/c de ______.");
  }

  if (ids.includes("ecografia")) {
    solicitudes.push("Autorización para ecografía de partes blandas.");
  }

  if (ids.includes("cirugia")) {
    solicitudes.push(
      "Autorización para cirugía de ______, laboratorio prequirúrgico, ECG prequirúrgico y materiales."
    );
  }

  if (ids.includes("inmovilizador")) {
    solicitudes.push("Autorización para inmovilizador cód.: ______.");
  }

  return solicitudes;
};

export default function ARTComunicador() {
  const [tab, setTab] = useState("siniestros");
  const [artId, setArtId] = useState("");
  const [accionesSeleccionadas, setAccionesSeleccionadas] = useState(["evolucion"]);
  const [destinatariosOff, setDestinatariosOff] = useState({});

  const [pacientes, setPacientes] = useState([]);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [paciente, setPaciente] = useState(null);
  const [medico, setMedico] = useState("");

  const [copiado, setCopiado] = useState(false);

  // Estados para atajos personalizados
  const [atajos, setAtajos] = useState([]);
  const [loadingAtajos, setLoadingAtajos] = useState(true);
  const [atajoActivo, setAtajoActivo] = useState(null);

  // Estados para crear/editar atajo
  const [mostrarFormAtajo, setMostrarFormAtajo] = useState(false);
  const [editandoAtajo, setEditandoAtajo] = useState(null);
  const [nuevoAtajoLabel, setNuevoAtajoLabel] = useState("");
  const [nuevoAtajoAsunto, setNuevoAtajoAsunto] = useState("");
  const [nuevoAtajoAcciones, setNuevoAtajoAcciones] = useState(["evolucion"]);
  const [nuevoAtajoCuerpo, setNuevoAtajoCuerpo] = useState("");
  const [guardandoAtajo, setGuardandoAtajo] = useState(false);
  const [errorAtajo, setErrorAtajo] = useState("");

  useEffect(() => {
    cargarAtajos();
  }, []);

  const cargarAtajos = () => {
    const controller = new AbortController();

    fetch(`${FIREBASE_URL}/ART-MAILS/atajos.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los atajos");
        return r.json();
      })
      .then((data) => {
        if (!data) {
          setAtajos([]);
          return;
        }

        const listaAtajos = Object.entries(data).map(([id, valor]) => ({
          id,
          label: valor.label || "Sin nombre",
          asunto: valor.asunto || "",
          cuerpo: valor.cuerpo || "",
          acciones: Array.isArray(valor.acciones) ? valor.acciones : [],
        }));

        setAtajos(listaAtajos);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error("Error cargando atajos:", err);
      })
      .finally(() => setLoadingAtajos(false));
  };

  useEffect(() => {
    const controller = new AbortController();

    fetch(`${FIREBASE_URL}/pacientes.json`, { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los pacientes");
        return r.json();
      })
      .then((data) => {
        if (!data) {
          setPacientes([]);
          return;
        }

        const lista = Object.entries(data)
          .map(([id, v]) => ({
            id,
            ...v,
            fullName: getPacienteNombre(v),
          }))
          .filter((p) => p.fullName || p.trabajador?.dni)
          .sort((a, b) => a.fullName.localeCompare(b.fullName));

        setPacientes(lista);
      })
      .catch((err) => {
        if (err.name !== "AbortError") console.error(err);
      })
      .finally(() => setLoadingPacientes(false));

    return () => controller.abort();
  }, []);

  const art = useMemo(() => PROVEEDORES.find((p) => p.id === artId), [artId]);

  const contactos = useMemo(() => {
    if (!art) return [];
    return tab === "siniestros" ? art.siniestros : art.facturacion;
  }, [art, tab]);

  const acciones = useMemo(
    () => ACCIONES.filter((a) => accionesSeleccionadas.includes(a.id)),
    [accionesSeleccionadas]
  );

  const labels = useMemo(() => acciones.map((a) => a.short).join(" + "), [acciones]);

  const pacienteData = useMemo(() => {
    const nombre = paciente?.fullName || "";
    const dni = paciente?.trabajador?.dni || "";
    const stro = paciente?.ART?.nroSiniestro || "";
    const artPaciente = paciente?.ART?.nombre || "";

    return { nombre, dni, stro, artPaciente };
  }, [paciente]);

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

    return `SE ENVÍA ${labels || "DOCUMENTACIÓN"} PTE ${pacienteData.nombre} - DNI ${pacienteData.dni || "—"
      } - STRO ${pacienteData.stro || "—"}`;
  }, [paciente, labels, pacienteData, atajoActivo, medico]);

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
      return `Buen día,

Por medio de la presente se adjunta facturación correspondiente al paciente:

Nombre completo: ${pacienteData.nombre}
DNI: ${pacienteData.dni || "—"}
N° de siniestro: ${pacienteData.stro || "—"}
ART: ${pacienteData.artPaciente || "—"}
Médico: Dr/a. ${medicoTexto}

${FIRMA}`;
    }

    const solicitudes = buildSolicitudes(accionesSeleccionadas, medico)
      .map((s) => `- ${s}`)
      .join("\n");

    return `Buen día,

Por medio de la presente se adjunta la documentación del paciente en referencia:

Nombre completo: ${pacienteData.nombre}
DNI: ${pacienteData.dni || "—"}
N° de siniestro: ${pacienteData.stro || "—"}
ART: ${pacienteData.artPaciente || "—"}
Médico: Dr/a. ${medicoTexto}

Se envía: ${labels || "documentación respaldatoria"}.

Solicito autorización a la brevedad de las siguientes prácticas:
${solicitudes || "- ______"}

${FIRMA}`;
  }, [paciente, tab, pacienteData, accionesSeleccionadas, labels, medico, atajoActivo]);

  const filteredPacientes = useMemo(() => {
    const term = normalize(searchTerm.trim());
    if (!term) return [];

    return pacientes
      .filter((p) => {
        const nombre = normalize(p.fullName);
        const dni = normalize(p.trabajador?.dni);
        const siniestro = normalize(p.ART?.nroSiniestro);

        return nombre.includes(term) || dni.includes(term) || siniestro.includes(term);
      })
      .slice(0, 10);
  }, [pacientes, searchTerm]);

  const destinatarioKey = (i) => `${artId}::${tab}::${i}`;

  const isDestinatarioActivo = (i) => destinatariosOff[destinatarioKey(i)] !== true;

  const emailsActivos = useMemo(
    () => contactos.filter((_, i) => isDestinatarioActivo(i)).map((c) => c.email),
    [contactos, destinatariosOff, artId, tab, isDestinatarioActivo]
  );

  const gmailUrl = useMemo(() => {
    if (!emailsActivos.length || !asunto || !cuerpo) return "#";

    return buildGmailUrl({
      to: emailsActivos.join(","),
      subject: asunto,
      body: cuerpo,
    });
  }, [emailsActivos, asunto, cuerpo]);

  const adjuntosRecordatorio = useMemo(() => {
    if (!paciente || tab !== "siniestros") return [];
    return acciones.map((a) => a.adjunto);
  }, [paciente, tab, acciones]);

  const canSend = Boolean(artId && paciente && emailsActivos.length && asunto && cuerpo);

  const faltante = useMemo(() => {
    if (!artId) return "Seleccioná una ART.";
    if (!paciente) return "Seleccioná un paciente.";
    if (!emailsActivos.length) return "Seleccioná al menos un destinatario.";
    return "";
  }, [artId, paciente, emailsActivos.length]);

  const handleSelectPaciente = (p) => {
    setPaciente(p);
    setSearchTerm(p.fullName || p.trabajador?.dni || "");
    setShowSuggestions(false);
  };

  const toggleAccion = (id) => {
    setAccionesSeleccionadas((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((a) => a !== id);
        return next.length ? next : ["evolucion"];
      }

      return [...prev, id];
    });
    setAtajoActivo(null);
  };

  const seleccionarCombo = (ids) => {
    setAccionesSeleccionadas(ids);
    setAtajoActivo(null);
  };

  const toggleNuevoAtajoAccion = (id) => {
    setNuevoAtajoAcciones((prev) =>
      prev.includes(id) ? prev.filter((accion) => accion !== id) : [...prev, id]
    );
  };

  const seleccionarAtajo = (atajo) => {
    setAtajoActivo(atajo);
    if (atajo.acciones?.length) {
      setAccionesSeleccionadas(atajo.acciones);
    } else {
      setAccionesSeleccionadas(["evolucion"]);
    }
  };

  const toggleDestinatario = (i) => {
    setDestinatariosOff((prev) => ({
      ...prev,
      [destinatarioKey(i)]: !prev[destinatarioKey(i)],
    }));
  };

  const toggleAllDestinatarios = (activo) => {
    setDestinatariosOff((prev) => {
      const next = { ...prev };

      contactos.forEach((_, i) => {
        next[destinatarioKey(i)] = !activo;
      });

      return next;
    });
  };

  const handleOpenGmail = (e) => {
    if (!canSend) e.preventDefault();
  };

  const copiarCuerpo = async () => {
    try {
      await navigator.clipboard.writeText(cuerpo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      setCopiado(false);
    }
  };

  const eliminarAtajo = async (atajoId) => {
    if (!confirm("¿Estás seguro de que querés eliminar este atajo?")) return;

    try {
      const response = await fetch(`${FIREBASE_URL}/ART-MAILS/atajos/${atajoId}.json`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("No se pudo eliminar el atajo");

      if (atajoActivo?.id === atajoId) {
        setAtajoActivo(null);
      }

      cargarAtajos();
    } catch (err) {
      console.error("Error eliminando atajo:", err);
      alert("Error al eliminar el atajo");
    }
  };

  const abrirFormNuevoAtajo = () => {
    setEditandoAtajo(null);
    setNuevoAtajoLabel("");
    setNuevoAtajoAsunto("");
    setNuevoAtajoAcciones(["evolucion"]);
    setNuevoAtajoCuerpo("");
    setErrorAtajo("");
    setMostrarFormAtajo(true);
  };

  const abrirFormEditarAtajo = (atajo) => {
    setEditandoAtajo(atajo);
    setNuevoAtajoLabel(atajo.label);
    setNuevoAtajoAsunto(atajo.asunto || "");
    setNuevoAtajoAcciones(atajo.acciones?.length ? atajo.acciones : ["evolucion"]);
    setNuevoAtajoCuerpo(atajo.cuerpo || "");
    setErrorAtajo("");
    setMostrarFormAtajo(true);
  };

  const guardarAtajo = async () => {
    setErrorAtajo("");

    if (!nuevoAtajoLabel.trim()) {
      setErrorAtajo("El nombre del atajo es obligatorio");
      return;
    }

    if (!nuevoAtajoAsunto.trim() && !nuevoAtajoCuerpo.trim()) {
      setErrorAtajo("Debés completar al menos el asunto o el cuerpo");
      return;
    }

    setGuardandoAtajo(true);

    try {
      const nuevoAtajo = {
        label: nuevoAtajoLabel.trim(),
        asunto: nuevoAtajoAsunto.trim(),
        acciones: nuevoAtajoAcciones,
        cuerpo: nuevoAtajoCuerpo.trim(),
      };

      let response;

      if (editandoAtajo) {
        response = await fetch(`${FIREBASE_URL}/ART-MAILS/atajos/${editandoAtajo.id}.json`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nuevoAtajo),
        });
      } else {
        response = await fetch(`${FIREBASE_URL}/ART-MAILS/atajos.json`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(nuevoAtajo),
        });
      }

      if (!response.ok) throw new Error("No se pudo guardar el atajo");

      setNuevoAtajoLabel("");
      setNuevoAtajoAsunto("");
      setNuevoAtajoCuerpo("");
      setMostrarFormAtajo(false);
      setEditandoAtajo(null);
      cargarAtajos();
    } catch (err) {
      console.error("Error guardando atajo:", err);
      setErrorAtajo("Error al guardar el atajo");
    } finally {
      setGuardandoAtajo(false);
    }
  };

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <div className={styles.topIcon}>📧</div>

          <div>
            <h1 className={styles.topTitle}>Comunicador ART</h1>
            <p className={styles.topSub}>
              Buscá el paciente, elegí la práctica y abrí el mail listo en Gmail.
            </p>
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
        <section className={styles.leftPanel}>
          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>1. ART / Aseguradora</p>
              {art && <span className={styles.badge}>{art.nombre}</span>}
            </div>

            <div className={styles.artGrid}>
              {PROVEEDORES.map((p) => {
                const tieneContactos =
                  tab === "siniestros" ? p.siniestros.length > 0 : p.facturacion.length > 0;

                const selected = artId === p.id;

                return (
                  <button
                    key={p.id}
                    type="button"
                    className={`${styles.artChip} ${selected ? styles.artChipOn : ""} ${!tieneContactos ? styles.artChipOff : ""
                      }`}
                    style={selected ? { "--c": p.color } : undefined}
                    onClick={() => tieneContactos && setArtId(p.id)}
                    disabled={!tieneContactos}
                    title={!tieneContactos ? "Sin contactos para esta sección" : p.nombre}
                  >
                    <span className={styles.artDot} style={{ backgroundColor: p.color }} />
                    {p.nombre}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={styles.block}>
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
                  {filteredPacientes.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={styles.dropItem}
                      onMouseDown={() => handleSelectPaciente(p)}
                    >
                      <span className={styles.dropName}>{p.fullName || "Sin nombre"}</span>
                      <span className={styles.dropMeta}>
                        DNI {p.trabajador?.dni || "—"} · Stro {p.ART?.nroSiniestro || "—"} ·{" "}
                        {p.ART?.nombre || "Sin ART"}
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
                  <span>
                    DNI: <strong>{pacienteData.dni || "—"}</strong>
                  </span>
                  <span>
                    Stro: <strong>{pacienteData.stro || "—"}</strong>
                  </span>
                  <span>
                    ART: <strong>{pacienteData.artPaciente || "—"}</strong>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sección de Atajos Personalizados (con wrapper) */}
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
                  {atajos.map((atajo) => (
                    <div
                      key={atajo.id}
                      className={`${styles.atajoCard} ${atajoActivo?.id === atajo.id ? styles.atajoCardActive : ""}`}
                    >
                      <div className={styles.atajoCardHeader}>
                        <button
                          type="button"
                          className={styles.atajoCardBtn}
                          onClick={() => seleccionarAtajo(atajo)}
                        >
                          {atajo.label}
                        </button>
                        <div className={styles.atajoCardActions}>
                          <button
                            type="button"
                            className={styles.atajoEdit}
                            onClick={() => abrirFormEditarAtajo(atajo)}
                            title="Editar atajo"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className={styles.atajoDelete}
                            onClick={() => eliminarAtajo(atajo.id)}
                            title="Eliminar atajo"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                      {atajoActivo?.id === atajo.id && (
                        <div className={styles.atajoCardPreview}>
                          <p className={styles.atajoPreviewLabel}>✅ Atajo activo</p>
                          {atajo.asunto && (
                            <p className={styles.atajoPreview}>
                              <strong>Asunto:</strong> {atajo.asunto}
                            </p>
                          )}
                          {atajo.cuerpo && (
                            <p className={styles.atajoPreview}>
                              <strong>Cuerpo:</strong> {atajo.cuerpo.substring(0, 80)}...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyMsg}>
                  No hay atajos creados. Podés crear uno con el botón de abajo.
                </p>
              )}

              <button
                type="button"
                className={styles.crearAtajoBtn}
                onClick={abrirFormNuevoAtajo}
              >
                ➕ Crear nuevo atajo
              </button>
            </div>

            {mostrarFormAtajo && (
              <div className={styles.formAtajoOverlay}>
                <div className={styles.formAtajo}>
                  <h3 className={styles.formAtajoTitle}>
                    {editandoAtajo ? "Editar atajo" : "Nuevo atajo"}
                  </h3>

                  <div className={styles.formAtajoField}>
                    <label className={styles.formAtajoLabel}>
                      Nombre del atajo *
                    </label>
                    <input
                      type="text"
                      className={styles.inp}
                      placeholder="Ej: Pedido de RMN urgente"
                      value={nuevoAtajoLabel}
                      onChange={(e) => setNuevoAtajoLabel(e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className={styles.formAtajoField}>
                    <label className={styles.formAtajoLabel}>
                      Asunto del mail
                    </label>
                    <input
                      type="text"
                      className={styles.inp}
                      placeholder="Ej: SOLICITUD RMN - {nombre} - DNI {dni}"
                      value={nuevoAtajoAsunto}
                      onChange={(e) => setNuevoAtajoAsunto(e.target.value)}
                    />
                    <p className={styles.formAtajoHint}>
                      Variables: {"{nombre}"}, {"{dni}"}, {"{stro}"}, {"{art}"}, {"{medico}"}
                    </p>
                  </div>

                  <div className={styles.formAtajoField}>
                    <label className={styles.formAtajoLabel}>
                      Acciones incluidas
                    </label>
                    <div className={styles.chips}>
                      {ACCIONES.map((accion) => (
                        <button
                          key={accion.id}
                          type="button"
                          className={`${styles.chip} ${nuevoAtajoAcciones.includes(accion.id) ? styles.chipOn : ""}`}
                          onClick={() => toggleNuevoAtajoAccion(accion.id)}
                        >
                          {accion.emoji} {accion.label}
                        </button>
                      ))}
                    </div>
                    <p className={styles.formAtajoHint}>
                      Estas acciones se seleccionan automáticamente cuando se aplica el atajo.
                    </p>
                  </div>

                  <div className={styles.formAtajoField}>
                    <label className={styles.formAtajoLabel}>
                      Cuerpo del mail
                    </label>
                    <textarea
                      className={styles.area}
                      rows={8}
                      placeholder={`Ej: Buen día,

Se adjunta documentación del paciente {nombre}, DNI {dni}.

Solicito autorización para:
- Práctica solicitada

{firma}`}
                      value={nuevoAtajoCuerpo}
                      onChange={(e) => setNuevoAtajoCuerpo(e.target.value)}
                    />
                    <p className={styles.formAtajoHint}>
                      Variables: {"{nombre}"}, {"{dni}"}, {"{stro}"}, {"{art}"}, {"{medico}"}, {"{firma}"}
                    </p>
                  </div>

                  {errorAtajo && <p className={styles.errorMsg}>{errorAtajo}</p>}

                  <div className={styles.formAtajoBtns}>
                    <button
                      type="button"
                      className={styles.tinyBtn}
                      onClick={guardarAtajo}
                      disabled={guardandoAtajo}
                    >
                      {guardandoAtajo ? "Guardando..." : "✅ Guardar atajo"}
                    </button>
                    <button
                      type="button"
                      className={styles.tinyBtn}
                      onClick={() => {
                        setMostrarFormAtajo(false);
                        setEditandoAtajo(null);
                        setErrorAtajo("");
                      }}
                      disabled={guardandoAtajo}
                    >
                      ❌ Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {tab === "siniestros" && (
            <div className={styles.block}>
              <div className={styles.blockTop}>
                <p className={styles.blockLabel}>3. Qué se envía (acciones)</p>
                <span className={styles.blockHint}>Multiselección</span>
              </div>

              <div className={styles.quickRow}>
                <button
                  type="button"
                  className={styles.tinyBtn}
                  onClick={() => seleccionarCombo(["evolucion"])}
                >
                  Solo evolución
                </button>

                <button
                  type="button"
                  className={styles.tinyBtn}
                  onClick={() => seleccionarCombo(["evolucion", "curacion"])}
                >
                  Evolución + curación
                </button>

                <button
                  type="button"
                  className={styles.tinyBtn}
                  onClick={() => seleccionarCombo(["evolucion", "fkt", "mgt"])}
                >
                  Evolución + FKT
                </button>

                <button
                  type="button"
                  className={styles.tinyBtn}
                  onClick={() => seleccionarCombo(["evolucion", "rx"])}
                >
                  Evolución + RX
                </button>

                <button
                  type="button"
                  className={styles.tinyBtn}
                  onClick={() => seleccionarCombo(["evolucion", "rmn"])}
                >
                  Evolución + RMN
                </button>
              </div>

              <div className={styles.chips}>
                {ACCIONES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={`${styles.chip} ${accionesSeleccionadas.includes(a.id) ? styles.chipOn : ""
                      }`}
                    onClick={() => toggleAccion(a.id)}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>4. Médico</p>
              <span className={styles.blockHint}>Opcional</span>
            </div>

            <input
              type="text"
              className={styles.inp}
              placeholder="Ej: Gómez, Pérez, Rodríguez..."
              value={medico}
              onChange={(e) => setMedico(e.target.value)}
            />
          </div>

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

          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>Cuerpo del mail</p>

              <button
                type="button"
                className={styles.tinyBtn}
                onClick={copiarCuerpo}
                disabled={!cuerpo}
              >
                {copiado ? "Copiado ✓" : "Copiar"}
              </button>
            </div>

            <textarea
              className={styles.area}
              value={cuerpo}
              readOnly
              placeholder="Se genera al seleccionar paciente..."
            />
          </div>
        </section>

        <aside className={styles.rightPanel}>
          <div className={styles.recipientsCard}>
            <div className={styles.recipientsTop}>
              <p className={styles.blockLabel}>Destinatarios</p>

              {contactos.length > 0 && (
                <div className={styles.toggleBtns}>
                  <button
                    type="button"
                    className={styles.tinyBtn}
                    onClick={() => toggleAllDestinatarios(true)}
                  >
                    Todos
                  </button>

                  <button
                    type="button"
                    className={styles.tinyBtn}
                    onClick={() => toggleAllDestinatarios(false)}
                  >
                    Ninguno
                  </button>
                </div>
              )}
            </div>

            {!artId ? (
              <p className={styles.emptyMsg}>Seleccioná una ART.</p>
            ) : contactos.length === 0 ? (
              <p className={styles.emptyMsg}>
                No hay contactos de {tab === "siniestros" ? "siniestros" : "facturación"} para
                esta ART.
              </p>
            ) : (
              <ul className={styles.recipientsList}>
                {contactos.map((c, i) => (
                  <li key={`${c.email}-${i}`}>
                    <label
                      className={`${styles.recipientRow} ${isDestinatarioActivo(i) ? styles.recipientRowOn : ""
                        }`}
                    >
                      <input
                        type="checkbox"
                        className={styles.chk}
                        checked={isDestinatarioActivo(i)}
                        onChange={() => toggleDestinatario(i)}
                      />

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
              <p className={styles.selCount}>
                {emailsActivos.length} destinatario{emailsActivos.length !== 1 ? "s" : ""} activo
                {emailsActivos.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <a
            href={canSend ? gmailUrl : "#"}
            className={`${styles.sendBtn} ${!canSend ? styles.sendBtnOff : ""}`}
            onClick={handleOpenGmail}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!canSend}
          >
            🚀 Abrir Gmail con mail listo
          </a>

          {!canSend && <p className={styles.sendHint}>{faltante}</p>}

          {canSend && (
            <div className={styles.readyBox}>
              <p className={styles.adjuntosTitle}>✅ Listo para enviar</p>
              <p className={styles.emptyMsg}>
                Gmail se abre con destinatarios, asunto y cuerpo completo. Solo tenés que adjuntar
                los archivos y tocar enviar.
              </p>
            </div>
          )}

          {adjuntosRecordatorio.length > 0 && (
            <div className={styles.adjuntosBox}>
              <p className={styles.adjuntosTitle}>📎 Adjuntar en Gmail:</p>

              <ul className={styles.adjuntosList}>
                {adjuntosRecordatorio.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
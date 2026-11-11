"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import { normalize } from "../art/utils/generadores";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";
const RECENT_KEY = "wa-recientes-v1";

const BIOQUIMICOS = [
  { id: "tabeni", label: "Tabeni" },
  { id: "marmol", label: "Mármol" },
  { id: "confalonieri", label: "Confalonieri" },
];

const CARDIOLOGOS = [
  { id: "capovilla", label: "Dr. Capovilla" },
  { id: "percara", label: "Dr. Percara" },
];

const DEFAULT_MESSAGES = {
  "1": {
    id: "1", label: "FKT Aprobada", emoji: "🦵", requiresDate: false, hasBioquimico: false, hasCardiologo: false,
    text: `Hola *{name}* 👋\n\n✅ Sus *sesiones de kinesiología fueron aprobadas*.\n\n📌 Puede retirar la orden por Mesa de Entrada de *Clínica de la Unión*.\n\n🚪 *Ingreso:* Roque Sáenz Peña.\n\n🕒 *Horarios:*\n• Lunes a viernes: 8 a 12 hs y 16 a 20 hs\n• Sábados: 8 a 12 hs\n\n👩‍⚕️ Puede concurrir con:\n\n*Kinesióloga Avancini Natalia*\n📍 Rivadavia 2665\n📲 Contacto: https://wa.me/+5493456513866\n\n*Kinesióloga Rivas Daniela*\n📍 9 de Julio 1870\n📲 Contacto: https://wa.me/+5493456440878\n\n⚠️ *Importante:* Puede consultar con su ART o Seguro Personal la cartilla de todos sus prestadores de kinesiología.\n{datosArt}\n\n*Clínica de la Unión* 🏥`
  },
  "2": {
    id: "2", label: "RMN Aprobada", emoji: "🧲", requiresDate: true, hasBioquimico: false, hasCardiologo: false,
    text: `Hola *{name}* 👋\n\n✅ Su *resonancia fue aprobada*.\n\n📅 *Fecha del turno:* {dia} a las {hora}\n\n📍 *Lugar:* Imágenes Médicas - Av. Siburu 1085\n\n⚠️ *Importante:*\n🪪 Traer DNI físico\n⏰ Llegar 15 minutos antes\n👕 Asistir con ropa cómoda\n⚖️ Peso máximo permitido: 140 kg\n\n🚨 *Aviso:* Informar al personal si posee:\n• Marcapasos\n• Prótesis metálicas\n• Implantes\n• Válvula cardíaca\n• Cirugías recientes\n{datosArt}\n\n*Clínica de la Unión* 🏥`
  },
  "3": {
    id: "3", label: "Medicamentos", emoji: "💊", requiresDate: false, hasBioquimico: false, hasCardiologo: false,
    text: `Hola *{name}* 👋\n\n✅ Sus *medicamentos fueron aprobados*.\n\n📌 Puede retirar la orden por Mesa de Entrada de *Clínica de la Unión*.\n\n🚪 *Ingreso:* Roque Sáenz Peña.\n\n🕒 *Horarios:*\n• Lunes a viernes: 8 a 12 hs y 16 a 20 hs\n• Sábados: 8 a 12 hs\n\n💊 *Cómo retirar según ART:*\n\n🏥 *IAPS:* Orden en Farmacia Zordan o Farmacia de la Unión.\n\n🏥 *Federación Patronal:* Orden + denuncia → Farmacia Del Pueblo.\n\n🏥 *La Segunda:* Orden + copia de denuncia → Farmacia de la Unión.\n\n🏥 *Otras ART:* Orden + copia de denuncia → Farmacia Zordan o Farmacia de la Unión.\n{datosArt}\n\n*Clínica de la Unión* 🏥`
  },
  "4": {
    id: "4", label: "Electrocardiograma", emoji: "❤️", requiresDate: true, hasBioquimico: false, hasCardiologo: true,
    text: `Hola *{name}* 👋\n\n✅ Su *electrocardiograma fue aprobado*.\n\n📅 *Fecha del turno:* {dia} a las {hora}\n\n⚠️ *Importante:*\n🪪 Traer DNI físico\n⏰ Llegar 15 minutos antes\n\n{cardiologo}\n{datosArt}\n\n*Clínica de la Unión* 🏥`
  },
  "5": {
    id: "5", label: "Laboratorio", emoji: "🧪", requiresDate: true, hasBioquimico: true, hasCardiologo: false,
    text: `Hola *{name}* 👋\n\n✅ Su *estudio de laboratorio fue aprobado*.\n\n📅 *Fecha del turno:* {dia} a las {hora}\n\n⚠️ *Importante:*\n🥛 Debe asistir con 8 horas de AYUNO\n🪪 Traer DNI físico\n⏰ Llegar 10 minutos antes\n\n📍 *Lugar:* \n{bioquimico}\n{datosArt}\n\n*Clínica de la Unión* 🏥`
  },
  "6": {
    id: "6", label: "Ecografía", emoji: "🩻", requiresDate: true, hasBioquimico: false, hasCardiologo: false,
    text: `Hola *{name}* 👋\n\n✅ Su *ecografía fue aprobada*.\n\n📅 *Fecha del turno:* {dia} a las {hora}\n\n📍 *Lugar:* Sector BioImagen dentro de Clínica de la Unión.\n🛎️ Al ingresar, consultar en Mesa de Entrada.\n\n⚠️ *Importante:*\n🪪 Traer DNI físico\n⏰ Llegar 10 minutos antes\n{datosArt}\n\n*Clínica de la Unión* 🏥`
  },
  "7": {
    id: "7", label: "Cirugía", emoji: "🏥", requiresDate: true, hasBioquimico: false, hasCardiologo: false,
    text: `Hola *{name}* 👋\n\n✅ Su cirugía fue aprobada por la ART.\n\n📅 Fecha: {dia}\n🕒 Hora: {hora}\n\n⚠️ IMPORTANTE - LEER CON ATENCIÓN\n\n📝 Ahora debe completar el siguiente formulario:\nhttps://art-xi-six.vercel.app/cx\n\nCompletarlo con anticipación nos permitirá agilizar el trámite administrativo el día de la cirugía. De esta manera, al ingresar solo deberá presentar su DNI.\n\nEl día de la cirugía deberá:\n\n🕒 Presentarse en la fecha y horario indicados.\n🥛 Concurrir en ayunas de 8 hs minimo.\n🪪 Traer fotocopia del DNI, frente y dorso + DNI físico original. (Obligatorio para poder ingresar)\n🚪 Anunciarse en Mesa de Entrada al ingresar.\n\n🏥 Ese mismo día se realizará la cirugía.\n\n*Clínica de la Unión* 🏥`
  },
  "8": {
    id: "8", label: "Ortopedia", emoji: "🦴", requiresDate: false, hasBioquimico: false, hasCardiologo: false,
    text: `Hola *{name}* 👋\n\n✅ Su *ortopedia fue aprobada*.\n\n📌 *Pasos a seguir:*\n\n1️⃣ *Retirar autorización*\n📍 *Lugar:* Mesa de Entrada de Clínica de la Unión\n🚪 *Ingreso:* Roque Sáenz Peña.\n🕒 *Horarios:*\n• Lunes a viernes: 8 a 12 hs y 16 a 20 hs\n• Sábados: 8 a 12 hs\n\n2️⃣ *Presentarse en Distrimed*\n📍 9 de Julio 3240 (frente a Farmacia Barbieri)\n\n📄 *Documentación requerida:*\n• Copia de la denuncia\n• Autorización ortopédica\n\n3️⃣ *Consultar cobertura*\n💰 Si la ART cubre el 100%, retira sin costo.\n🧾 Si debe pagar, guarde la factura para solicitar reintegro a la ART.\n{datosArt}\n\n*Clínica de la Unión* 🏥`
  },
  "9": {
    id: "9", label: "Alta otorgada por ART", emoji: "📄", requiresDate: false, hasBioquimico: false, hasCardiologo: false,
    text: `Hola *{name}* 👋\n\nBuen día.\n\nLe informamos que el alta fue otorgada por su *ART*, no por la *Clínica*. Por tal motivo, ya no debe concurrir a la *Clínica* por este siniestro, salvo que su *ART* emita una nueva autorización.\n\nSi no está de acuerdo con el alta o desea realizar un reclamo, deberá comunicarse directamente con su *ART*, ya que es la entidad responsable de esa decisión.\n{datosArt}\n\n💬 Si necesita más información, responda *INFO* y nos estaremos comunicando con usted.\n\n*Clínica de la Unión* 🏥`
  }
};

const normalizePhone = (value = "") => String(value).replace(/\D/g, "");

const autoPrefixPhone = (raw) => {
  const digits = normalizePhone(raw);
  if (!digits) return "";
  if (digits.startsWith("549")) return digits;
  if (digits.startsWith("54")) return digits;
  if (digits.length === 10) return `549${digits}`;
  return digits;
};

const getEntryTimestamp = (p) => {
  const candidates = [p.fechaIngreso, p.fecha_ingreso, p.createdAt, p.created_at, p.timestamp, p.fecha];
  for (const c of candidates) {
    if (c == null || c === "") continue;
    if (typeof c === "number") return c;
    const parsed = Date.parse(c);
    if (!isNaN(parsed)) return parsed;
  }
  const num = parseInt(String(p.id).slice(0, 8), 36);
  return isNaN(num) ? 0 : num;
};

const isPatientActive = (p) => {
  if (typeof p.activo === "boolean") return p.activo;
  if (typeof p.active === "boolean") return p.active;
  const estado = String(p.estado || p.status || "").toLowerCase();
  if (["alta", "inactivo", "baja", "finalizado", "cerrado"].includes(estado)) return false;
  if (["activo", "active", "en curso", "abierto"].includes(estado)) return true;
  if (p.fechaAlta) return false;
  return true;
};

export default function WhatsAppSender() {
  const searchParams = useSearchParams();

  const initialPhone = searchParams.get("phone") || "";
  const initialName = searchParams.get("name") || "";

  // Form State
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [bioquimico, setBioquimico] = useState("tabeni");
  const [cardiologo, setCardiologo] = useState("capovilla");
  const [art, setArt] = useState("");
  const [siniestro, setSiniestro] = useState("");
  const [preview, setPreview] = useState("");

  // Messages State
  const [mensaje, setMensaje] = useState("1");
  const [mensajesList, setMensajesList] = useState(DEFAULT_MESSAGES);
  const [loadingMensajes, setLoadingMensajes] = useState(true);

  // Modal Nuevo Mensaje State
  const [modalOpen, setModalOpen] = useState(false);
  const [newMsgLabel, setNewMsgLabel] = useState("");
  const [newMsgText, setNewMsgText] = useState("");
  const [newMsgRequiresDate, setNewMsgRequiresDate] = useState(false);
  const [savingMsg, setSavingMsg] = useState(false);

  // Pacientes State
  const [pacientes, setPacientes] = useState([]);
  const [loadingPacientes, setLoadingPacientes] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [soloActivos, setSoloActivos] = useState(false);
  
  // Historial State
  const [recientes, setRecientes] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  // Fetch Mensajes
  useEffect(() => {
    const fetchMensajes = async () => {
      try {
        setLoadingMensajes(true);
        const res = await fetch(`${FIREBASE_URL}/WHATSAPP/mensajes.json`);
        const data = await res.json();
        if (data) {
          const parsed = Object.entries(data).map(([id, val]) => ({ id, ...val }));
          const merged = { ...DEFAULT_MESSAGES };
          parsed.forEach(m => { merged[m.id] = m; });
          setMensajesList(merged);
        } else {
          setMensajesList(DEFAULT_MESSAGES);
        }
      } catch (error) {
        console.error("Error cargando mensajes:", error);
      } finally {
        setLoadingMensajes(false);
      }
    };
    fetchMensajes();
  }, []);

  // Fetch Pacientes
  useEffect(() => {
    const fetchPacientes = async () => {
      try {
        setLoadingPacientes(true);
        const res = await fetch(`${FIREBASE_URL}/pacientes.json`);
        if (!res.ok) throw new Error("Error al cargar pacientes");
        const data = await res.json();
        if (!data) {
          setPacientes([]);
          return;
        }
        const arr = Object.entries(data).map(([id, value]) => ({
          id,
          ...value,
          fullName: `${value.trabajador?.apellido || ""} ${value.trabajador?.nombre || ""}`.trim(),
          phone: value.trabajador?.telefono || "",
          art: value.ART?.nombre || "",
          siniestro: value.ART?.nroSiniestro || "",
        }));
        setPacientes(arr);
      } catch (error) {
        console.error("Error cargando pacientes:", error);
      } finally {
        setLoadingPacientes(false);
      }
    };
    fetchPacientes();
  }, []);

  // Cargar Historial Inicial
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setRecientes(parsed);
      }
    } catch { }
  }, []);

  // Debounce Búsqueda
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Stats y Filtros
  const stats = useMemo(() => {
    let activos = 0;
    for (const p of pacientes) if (isPatientActive(p)) activos++;
    return { activos, inactivos: pacientes.length - activos, total: pacientes.length };
  }, [pacientes]);

  const sortedFiltered = useMemo(() => {
    const term = normalize(debouncedSearch);
    if (!term) return []; 

    let base = pacientes;
    if (soloActivos) base = base.filter(isPatientActive);

    const filtered = base.filter((p) => {
      const nombre = normalize(p.fullName);
      const dni = normalize(p.trabajador?.dni);
      const tel = normalize(p.trabajador?.telefono);
      return nombre.includes(term) || dni.includes(term) || tel.includes(term);
    });

    const enriched = filtered.map((p) => ({
      ...p,
      _active: isPatientActive(p),
      _ts: getEntryTimestamp(p),
    }));

    enriched.sort((a, b) => {
      if (a._active !== b._active) return a._active ? -1 : 1;
      return b._ts - a._ts;
    });

    return enriched;
  }, [pacientes, debouncedSearch, soloActivos]);

  const recientesPacientes = useMemo(() => {
    return recientes
      .map((r) => pacientes.find((p) => p.id === r.id))
      .filter(Boolean)
      .map((p) => ({
        ...p,
        _active: isPatientActive(p),
        _ts: getEntryTimestamp(p),
      }));
  }, [recientes, pacientes]);

  const activeMessageObj = mensajesList[mensaje] || DEFAULT_MESSAGES["1"];
  const requiresDateTime = activeMessageObj.requiresDate;

  // Handlers Pacientes y Envíos
  const handleSelectPaciente = (paciente) => {
    setName(paciente.fullName || "");
    setPhone(autoPrefixPhone(paciente.phone || ""));
    setArt(paciente.art || "");
    setSiniestro(paciente.siniestro || "");
    setSearchTerm(""); 
    setSelectedId(paciente.id);
    setShowHistory(false);
  };

  const saveToHistory = () => {
    if (!selectedId) return;
    setRecientes((prev) => {
      const filtered = prev.filter((r) => r.id !== selectedId);
      const next = [{ id: selectedId }, ...filtered].slice(0, 10); // Guardamos los últimos 10
      try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { }
      return next;
    });
  };

  const clearSelection = () => {
    setName("");
    setPhone("");
    setArt("");
    setSiniestro("");
    setSearchTerm("");
    setSelectedId(null);
    setDia("");
    setHora("");
    setShowHistory(false);
  };

  // Construcción dinámica del mensaje
  const buildMessage = () => {
    const datosArtSiniestro = art || siniestro
        ? `\n\n📋 *Datos de la ART:*\n• ART: ${art || "No especificada"}\n• Nro. de Siniestro: ${siniestro || "No especificado"}`
        : "";

    const bioquimicoText = bioquimico === "confalonieri" 
      ? "🧪 *Bioquímica Confalonieri*\n📍 Belgrano y Corrientes (frente a Pepos)"
      : bioquimico === "marmol"
      ? "🧪 *Bioquímico Mármol*\n📍 Sarmiento 2610"
      : "🧪 *Bioquímica Tabeni*\n📍 Jaime Tabeni 1101";

    const cardiologoText = cardiologo === "percara"
      ? "👨‍⚕️ *Médico:* Dr. Percara\n📍 Bolívar 1695 (esquina 9 de Julio)"
      : "👨‍⚕️ *Médico:* Dr. Capovilla\n📍 Bolívar 1645";

    let text = activeMessageObj.text || "";
    
    text = text.replace(/{name}/g, name || "")
               .replace(/{dia}/g, dia || "")
               .replace(/{hora}/g, hora || "")
               .replace(/{art}/g, art || "")
               .replace(/{siniestro}/g, siniestro || "")
               .replace(/{datosArt}/g, datosArtSiniestro)
               .replace(/{bioquimico}/g, bioquimicoText)
               .replace(/{cardiologo}/g, cardiologoText);

    return text;
  };

  useEffect(() => {
    setPreview(buildMessage());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, dia, hora, mensaje, bioquimico, cardiologo, art, siniestro, mensajesList]);

  // Guardar Nuevo Mensaje en Firebase
  const handleSaveMessage = async () => {
    if (!newMsgLabel.trim() || !newMsgText.trim()) return;
    setSavingMsg(true);
    try {
      const payload = {
        label: newMsgLabel.trim(),
        emoji: "📝",
        text: newMsgText.trim(),
        requiresDate: newMsgRequiresDate,
        hasBioquimico: false,
        hasCardiologo: false
      };
      const res = await fetch(`${FIREBASE_URL}/WHATSAPP/mensajes.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.name) {
        setMensajesList(prev => ({ ...prev, [data.name]: { id: data.name, ...payload } }));
        setModalOpen(false);
        setNewMsgLabel("");
        setNewMsgText("");
        setNewMsgRequiresDate(false);
        setMensaje(data.name);
      }
    } catch (error) {
      console.error("Error guardando mensaje:", error);
    } finally {
      setSavingMsg(false);
    }
  };

  const cleanPhone = normalizePhone(phone);
  const canSend = Boolean(cleanPhone && name.trim() && (!requiresDateTime || (dia.trim() && hora.trim())));

  const createWaLink = (mode = "web") => {
    if (!cleanPhone) return "#";
    const encodedText = encodeURIComponent(preview);
    if (mode === "web") return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  };

  const renderPill = (p) => {
    const selected = selectedId === p.id;
    return (
      <button
        key={p.id}
        type="button"
        className={`${styles.pill} ${selected ? styles.pillActive : ""} ${!p._active ? styles.pillInactive : ""}`}
        onClick={() => handleSelectPaciente(p)}
        title={`${p.fullName} · DNI ${p.trabajador?.dni || "—"} · ${p.art || "Sin ART"}`}
      >
        <span className={styles.pillStatus}>{p._active ? "🟢" : "🔴"}</span>
        <span className={styles.pillName}>
          {p.trabajador?.apellido || ""} {p.trabajador?.nombre || ""}
        </span>
        <span className={styles.pillArt}>{p.art || "Sin ART"}</span>
        <span className={styles.pillDni}>DNI {p.trabajador?.dni || "—"}</span>
        {selected && <span className={styles.pillCheck}>✓</span>}
      </button>
    );
  };

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div className={styles.iconCircle}>💬</div>
          <div>
            <h1 className={styles.title}>Envío rápido WhatsApp</h1>
            <p className={styles.subtitle}>Mensajes simples, ordenados y fáciles de leer.</p>
          </div>
        </header>

        <div className={styles.formGrid}>
          {/* ─── SELECTOR DE PACIENTES ──────────────────────────────── */}
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <div className={styles.labelRow}>
              <label className={styles.label}>
                Buscar paciente
                {!loadingPacientes && stats.total > 0 && (
                  <span className={styles.labelStats}> · {stats.activos} activos / {stats.inactivos} inactivos</span>
                )}
              </label>
              <button type="button" onClick={clearSelection} className={styles.clearSelectionBtn}>
                🧹 Limpiar selección
              </button>
            </div>

            <div className={styles.searchInputWrapper}>
              <input
                type="text"
                className={styles.input}
                placeholder="Escribí Apellido, Nombre, DNI o Teléfono para buscar…"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setSelectedId(null); }}
                onFocus={() => setShowHistory(true)}
                onBlur={() => setTimeout(() => setShowHistory(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && sortedFiltered.length > 0) {
                    e.preventDefault(); handleSelectPaciente(sortedFiltered[0]);
                  }
                }}
              />
              {searchTerm && (
                <button type="button" className={styles.clearBtn} onClick={() => { setSearchTerm(""); setSelectedId(null); }}>✕</button>
              )}
            </div>

            <div className={styles.pillsSection}>
              {searchTerm && (
                <div className={styles.pillsHeader}>
                  <p className={styles.pillsSectionLabel}>
                    Resultados ({sortedFiltered.length})
                  </p>
                  <label className={styles.toggleActivos}>
                    <input type="checkbox" checked={soloActivos} onChange={(e) => setSoloActivos(e.target.checked)} />
                    Solo activos
                  </label>
                </div>
              )}

              {loadingPacientes && searchTerm ? (
                <div className={styles.pillsGrid}>
                  {[1, 2, 3, 4, 5].map((i) => <div key={i} className={styles.pillSkeleton} />)}
                </div>
              ) : searchTerm ? (
                sortedFiltered.length === 0 ? (
                  <p className={styles.emptyMsg}>No se encontraron pacientes para "{searchTerm}"</p>
                ) : (
                  <>
                    <div className={styles.pillsGrid}>{sortedFiltered.slice(0, 80).map(renderPill)}</div>
                    {sortedFiltered.length > 80 && (
                      <p className={styles.pillsMore}>Mostrando 80 de {sortedFiltered.length} · refiná la búsqueda</p>
                    )}
                  </>
                )
              ) : showHistory && recientesPacientes.length > 0 ? (
                <div className={styles.pillsGrid}>{recientesPacientes.map(renderPill)}</div>
              ) : null}
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="phone" className={styles.label}>Número de teléfono <span className={styles.required}>*</span></label>
            <input id="phone" type="tel" className={styles.input} placeholder="Ej: 5493456123456" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div className={styles.field}>
            <label htmlFor="name" className={styles.label}>Nombre del paciente <span className={styles.required}>*</span></label>
            <input id="name" type="text" className={styles.input} placeholder="Nombre completo" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className={`${styles.field} ${styles.fullWidth}`}>
            <div className={styles.rowFields}>
              <div className={styles.halfField}>
                <label className={styles.label}>ART</label>
                <input type="text" className={styles.input} value={art} onChange={(e) => setArt(e.target.value)} placeholder="Ej: IAPS ART" />
              </div>
              <div className={styles.halfField}>
                <label className={styles.label}>Nro. de Siniestro</label>
                <input type="text" className={styles.input} value={siniestro} onChange={(e) => setSiniestro(e.target.value)} placeholder="Ej: 162398" />
              </div>
            </div>
          </div>

          {/* ─── SELECTOR DE MENSAJES (PÍLDORAS) ────────────────────── */}
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <div className={styles.labelRow}>
              <label className={styles.label}>Tipo de mensaje</label>
              <button type="button" className={styles.tinyBtn} onClick={() => setModalOpen(true)}>
                + Nuevo
              </button>
            </div>
            <div className={styles.messagePillsGrid}>
              {Object.values(mensajesList).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`${styles.pill} ${mensaje === m.id ? styles.pillActive : ""}`}
                  onClick={() => setMensaje(m.id)}
                >
                  <span className={styles.pillName}>{m.emoji} {m.label}</span>
                  {mensaje === m.id && <span className={styles.pillCheck}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {requiresDateTime && (
            <>
              <div className={styles.field}>
                <label htmlFor="dia" className={styles.label}>Día del turno <span className={styles.required}>*</span></label>
                <input id="dia" type="text" className={styles.input} placeholder="Ej: lunes 15/04" value={dia} onChange={(e) => setDia(e.target.value)} />
              </div>
              <div className={styles.field}>
                <label htmlFor="hora" className={styles.label}>Hora del turno <span className={styles.required}>*</span></label>
                <input id="hora" type="text" className={styles.input} placeholder="Ej: 10:30" value={hora} onChange={(e) => setHora(e.target.value)} />
              </div>
            </>
          )}

          {/* ─── SELECTOR DE BIOQUÍMICO (PÍLDORAS) ────────────────────── */}
          {activeMessageObj.hasBioquimico && (
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label}>Bioquímico</label>
              <div className={styles.messagePillsGrid}>
                {BIOQUIMICOS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`${styles.pill} ${bioquimico === b.id ? styles.pillActive : ""}`}
                    onClick={() => setBioquimico(b.id)}
                  >
                    <span className={styles.pillName}>🧪 {b.label}</span>
                    {bioquimico === b.id && <span className={styles.pillCheck}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── SELECTOR DE CARDIÓLOGO (PÍLDORAS) ────────────────────── */}
          {activeMessageObj.hasCardiologo && (
            <div className={`${styles.field} ${styles.fullWidth}`}>
              <label className={styles.label}>Cardiólogo</label>
              <div className={styles.messagePillsGrid}>
                {CARDIOLOGOS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.pill} ${cardiologo === c.id ? styles.pillActive : ""}`}
                    onClick={() => setCardiologo(c.id)}
                  >
                    <span className={styles.pillName}>👨‍⚕️ {c.label}</span>
                    {cardiologo === c.id && <span className={styles.pillCheck}>✓</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <section className={styles.previewBox}>
          <div className={styles.previewHeader}>
            <div>
              <label htmlFor="preview" className={styles.label}>Vista previa del mensaje</label>
              <p className={styles.previewSubtitle}>Podés editar el texto antes de enviar.</p>
            </div>
            <span className={styles.previewBadge}>WhatsApp</span>
          </div>
          <textarea id="preview" className={styles.textarea} value={preview} onChange={(e) => setPreview(e.target.value)} />
        </section>

        <div className={styles.actionsRow}>
          <a 
            href={canSend ? createWaLink("app") : "#"} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={`${styles.secondaryButton} ${!canSend ? styles.buttonDisabled : ""}`} 
            onClick={(e) => { 
              if (!canSend) return e.preventDefault(); 
              saveToHistory(); 
            }}
          >
            <span className={styles.buttonIcon}>📱</span> Abrir en WhatsApp
          </a>
          <a 
            href={canSend ? createWaLink("web") : "#"} 
            target="_blank" 
            rel="noopener noreferrer" 
            className={`${styles.button} ${!canSend ? styles.buttonDisabled : ""}`} 
            onClick={(e) => { 
              if (!canSend) return e.preventDefault(); 
              saveToHistory(); 
            }}
          >
            <span className={styles.buttonIcon}>🟢</span> Abrir en WhatsApp Web
          </a>
        </div>

        {!canSend && (
          <p className={styles.warningText}>Completá teléfono, nombre {requiresDateTime ? ", día y hora" : ""} para habilitar el envío.</p>
        )}
      </section>

      {/* ─── MODAL NUEVO MENSAJE ──────────────────────────────────── */}
      {modalOpen && (
        <div className={styles.modalOverlay} onClick={() => setModalOpen(false)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>📝 Crear mensaje genérico</h3>
            <p className={styles.modalHint}>Usa variables como <b>{"{name}"}</b>, <b>{"{dia}"}</b>, <b>{"{hora}"}</b>, <b>{"{art}"}</b>, <b>{"{siniestro}"}</b> o <b>{"{datosArt}"}</b>.</p>
            
            <div className={styles.field}>
              <label className={styles.label}>Nombre del botón (Ej: Turno Oftalmología)</label>
              <input type="text" className={styles.input} value={newMsgLabel} onChange={e => setNewMsgLabel(e.target.value)} placeholder="Ej: Receta Médica" autoFocus />
            </div>
            
            <div className={styles.field}>
              <label className={styles.label}>Texto del mensaje</label>
              <textarea 
                className={styles.textarea} 
                rows={6} 
                value={newMsgText} 
                onChange={e => setNewMsgText(e.target.value)} 
                placeholder={
                  newMsgRequiresDate 
                    ? `Hola *{name}* 👋\n\nSu turno para {art} quedó agendado.\n\n📅 Fecha: {dia}\n🕒 Hora: {hora}\n\n*Clínica de la Unión* 🏥`
                    : `Hola *{name}* 👋\n\nLe informamos que su trámite con {art} (Siniestro {siniestro}) ha sido procesado.\n\n*Clínica de la Unión* 🏥`
                } 
              />
            </div>

            <label className={styles.toggleActivos} style={{ marginBottom: 16 }}>
              <input type="checkbox" checked={newMsgRequiresDate} onChange={e => setNewMsgRequiresDate(e.target.checked)} />
              Requiere pedir Día y Hora
            </label>

            <div className={styles.modalBtns}>
              <button className={styles.btnCancel} onClick={() => setModalOpen(false)} disabled={savingMsg}>Cancelar</button>
              <button className={styles.btnSave} onClick={handleSaveMessage} disabled={savingMsg}>{savingMsg ? "Guardando..." : "Guardar Mensaje"}</button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
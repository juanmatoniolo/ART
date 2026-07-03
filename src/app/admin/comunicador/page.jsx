"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

const messageTitles = {
  1: "🦵 Kinesiología aprobada",
  2: "🧲 Resonancia aprobada",
  3: "💊 Medicamentos aprobados",
  4: "❤️ Electrocardiograma aprobado",
  5: "🧪 Laboratorio aprobado",
  6: "🩻 Ecografía aprobada",
  7: "🏥 Cirugía aprobada",
  8: "🦴 Ortopedia aprobada",
};

const normalizePhone = (value = "") => value.replace(/\D/g, "");

const headerClinica = (name) => `Hola *${name}* 👋\n\n`;
const footerClinica = `\n\n*Clínica de la Unión* 🏥`;

export default function WhatsAppSender() {
  const searchParams = useSearchParams();

  const initialPhone = searchParams.get("phone") || "";
  const initialName = searchParams.get("name") || "";

  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [mensaje, setMensaje] = useState("1");
  const [bioquimico, setBioquimico] = useState("confalonieri");
  const [cardiologo, setCardiologo] = useState("percara");
  const [preview, setPreview] = useState("");

  // Estado para ART y siniestro
  const [art, setArt] = useState("");
  const [siniestro, setSiniestro] = useState("");

  const [pacientes, setPacientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const requiresDateTime = ["2", "4", "5", "6", "7"].includes(mensaje);

  // Cargar pacientes desde Firebase
  useEffect(() => {
    const fetchPacientes = async () => {
      try {
        const res = await fetch(`${FIREBASE_URL}/pacientes.json`);

        if (!res.ok) {
          throw new Error("Error al cargar pacientes");
        }

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
  art: value.ART?.nombre || "",          // ✅ CORRECTO
  siniestro: value.ART?.nroSiniestro || "", // ✅ CORRECTO
}));

        setPacientes(arr);
      } catch (error) {
        console.error("Error cargando pacientes:", error);
      }
    };

    fetchPacientes();
  }, []);

  // Filtro de pacientes por nombre o DNI
  const filteredPacientes = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();

    if (!term) return [];

    return pacientes.filter((p) => {
      const dni = p.trabajador?.dni || "";
      return (
        p.fullName.toLowerCase().includes(term) ||
        dni.includes(searchTerm.trim())
      );
    });
  }, [pacientes, searchTerm]);

  // Seleccionar paciente y cargar datos
  const handleSelectPaciente = (paciente) => {
    setName(paciente.fullName || "");
    setPhone(paciente.phone || "");
    setArt(paciente.art || "");
    setSiniestro(paciente.siniestro || "");
    setSearchTerm(paciente.fullName || "");
    setShowSuggestions(false);
  };

  // Construcción del mensaje según el tipo seleccionado
  const buildMessage = () => {
    // Bloque común con ART y siniestro (si existen)
    const datosArtSiniestro =
      art || siniestro
        ? `\n\n📋 *Datos de la ART:*\n• ART: ${art || "No especificada"}\n• Nro. de Siniestro: ${siniestro || "No especificado"}`
        : "";

    if (mensaje === "1") {
      return `${headerClinica(name)}✅ Sus *sesiones de kinesiología fueron aprobadas*.

📌 Puede retirar la orden por Mesa de Entrada de *Clínica de la Unión*.

🚪 *Ingreso:* Roque Sáenz Peña.

🕒 *Horarios:*
• Lunes a viernes: 8 a 12 hs y 16 a 20 hs
• Sábados: 8 a 12 hs

👩‍⚕️ Puede concurrir con:

*Kinesióloga Avancini Natalia*
📍 Rivadavia 2665
📲 Contacto: https://wa.me/+5493456513866

*Kinesióloga Rivas Daniela*
📍 9 de Julio 1870
📲 Contacto: https://wa.me/+5493456440878

⚠️ *Importante:* Puede consultar con su ART o Seguro Personal la cartilla de todos sus prestadores de kinesiología.${datosArtSiniestro}${footerClinica}`;
    }

    if (mensaje === "2") {
      return `${headerClinica(name)}✅ Su *resonancia fue aprobada*.

📅 *Fecha del turno:* ${dia} a las ${hora}

📍 *Lugar:* Imágenes Médicas - Av. Siburu 1085

⚠️ *Importante:*
🪪 Traer DNI físico
⏰ Llegar 15 minutos antes
👕 Asistir con ropa cómoda
⚖️ Peso máximo permitido: 140 kg

🚨 *Aviso:* Informar al personal si posee:
• Marcapasos
• Prótesis metálicas
• Implantes
• Válvula cardíaca
• Cirugías recientes${datosArtSiniestro}${footerClinica}`;
    }

    if (mensaje === "3") {
      return `${headerClinica(name)}✅ Sus *medicamentos fueron aprobados*.

📌 Puede retirar la orden por Mesa de Entrada de *Clínica de la Unión*.

🚪 *Ingreso:* Roque Sáenz Peña.

🕒 *Horarios:*
• Lunes a viernes: 8 a 12 hs y 16 a 20 hs
• Sábados: 8 a 12 hs

💊 *Cómo retirar según ART:*

🏥 *IAPS:* Orden en Farmacia Zordan o Farmacia de la Unión.

🏥 *Federación Patronal:* Orden + denuncia → Farmacia Del Pueblo.

🏥 *La Segunda:* Orden + copia de denuncia → Farmacia de la Unión.

🏥 *Otras ART:* Orden + copia de denuncia → Farmacia Zordan o Farmacia de la Unión.
${datosArtSiniestro}${footerClinica}`;
    }

    if (mensaje === "4") {
      const profesional =
        cardiologo === "percara"
          ? `👨‍⚕️ *Médico:* Dr. Percara\n📍 Bolívar 1695 (esquina 9 de Julio)`
          : `👨‍⚕️ *Médico:* Dr. Capovilla\n📍 Bolívar 1645`;

      return `${headerClinica(name)}✅ Su *electrocardiograma fue aprobado*.

📅 *Fecha del turno:* ${dia} a las ${hora}

⚠️ *Importante:*
🪪 Traer DNI físico
⏰ Llegar 15 minutos antes

${profesional}${datosArtSiniestro}${footerClinica}`;
    }

    if (mensaje === "5") {
      let profesional = "";

      if (bioquimico === "confalonieri") {
        profesional = `🧪 *Bioquímica Confalonieri*\n📍 Belgrano y Corrientes (frente a Pepos)`;
      } else if (bioquimico === "marmol") {
        profesional = `🧪 *Bioquímico Mármol*\n📍 Sarmiento 2610`;
      } else {
        profesional = `🧪 *Bioquímica Tabeni*\n📍 Jaime Tabeni 1101`;
      }

      return `${headerClinica(name)}✅ Su *estudio de laboratorio fue aprobado*.

📅 *Fecha del turno:* ${dia} a las ${hora}

⚠️ *Importante:*
🥛 Debe asistir con 8 horas de AYUNO
🪪 Traer DNI físico
⏰ Llegar 10 minutos antes

📍 *Lugar:* 
${profesional}${datosArtSiniestro}${footerClinica}`;
    }

    if (mensaje === "6") {
      return `${headerClinica(name)}✅ Su *ecografía fue aprobada*.

📅 *Fecha del turno:* ${dia} a las ${hora}

📍 *Lugar:* Sector BioImagen dentro de Clínica de la Unión.
🛎️ Al ingresar, consultar en Mesa de Entrada.

⚠️ *Importante:*
🪪 Traer DNI físico
⏰ Llegar 10 minutos antes${datosArtSiniestro}${footerClinica}`;
    }

    if (mensaje === "7") {
      return `${headerClinica(name)}✅ Su *cirugía fue aprobada por la ART*.

📅 *Fecha de la cirugía:* ${dia} a las ${hora}

⚠️ *Importante:*
🥛 Debe venir en AYUNAS
⏰ Asistir en el horario indicado
🏥 Ese día ya se realiza la cirugía
🪪 Traer DNI físico original
📄 Traer fotocopia del DNI (frente y dorso)

🚪 *Ingreso:* Presentarse en Mesa de Entrada.

📝 Antes de la cirugía complete este formulario:
https://art-xi-six.vercel.app/cx

✅ Por favor responder: *CONFIRMO ASISTENCIA*${datosArtSiniestro}${footerClinica}`;
    }

    if (mensaje === "8") {
      return `${headerClinica(name)}✅ Su *ortopedia fue aprobada*.

📌 *Pasos a seguir:*

1️⃣ *Retirar autorización*
📍 *Lugar:* Mesa de Entrada de Clínica de la Unión
🚪 *Ingreso:* Roque Sáenz Peña.
🕒 *Horarios:*
• Lunes a viernes: 8 a 12 hs y 16 a 20 hs
• Sábados: 8 a 12 hs

2️⃣ *Presentarse en Distrimed*
📍 9 de Julio 3240 (frente a Farmacia Barbieri)

📄 *Documentación requerida:*
• Copia de la denuncia
• Autorización ortopédica

3️⃣ *Consultar cobertura*
💰 Si la ART cubre el 100%, retira sin costo.
🧾 Si debe pagar, guarde la factura para solicitar reintegro a la ART.${datosArtSiniestro}${footerClinica}`;
    }

    return "";
  };

  // Actualizar vista previa cuando cambian los datos
  useEffect(() => {
    setPreview(buildMessage());
  }, [name, dia, hora, mensaje, bioquimico, cardiologo, art, siniestro]);

  const cleanPhone = normalizePhone(phone);

  const canSend = Boolean(
    cleanPhone &&
    name.trim() &&
    (!requiresDateTime || (dia.trim() && hora.trim()))
  );

  const createWaLink = (mode = "web") => {
    if (!cleanPhone) return "#";

    const encodedText = encodeURIComponent(preview);

    if (mode === "web") {
      return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
    }

    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  };

  return (
    <main className={styles.container}>
      <section className={styles.card}>
        <header className={styles.header}>
          <div className={styles.iconCircle}>💬</div>
          <div>
            <h1 className={styles.title}>Envío rápido WhatsApp</h1>
            <p className={styles.subtitle}>
              Mensajes simples, ordenados y fáciles de leer para el paciente.
            </p>
          </div>
        </header>

        <div className={styles.formGrid}>
          {/* Buscador de pacientes */}
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label className={styles.label}>Buscar paciente</label>
            <div className={styles.searchContainer}>
              <input
                type="text"
                className={styles.input}
                placeholder="Escribe nombre o DNI..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              />
              {showSuggestions && searchTerm && filteredPacientes.length > 0 && (
                <div className={styles.suggestions}>
                  {filteredPacientes.slice(0, 8).map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      className={styles.suggestionItem}
                      onClick={() => handleSelectPaciente(p)}
                    >
                      <div className={styles.suggestionMain}>
                        <span className={styles.suggestionName}>
                          {p.fullName || "Sin nombre"}
                        </span>
                        <span className={styles.suggestionPhone}>
                          {p.phone || "Sin teléfono"}
                        </span>
                      </div>
                      <div className={styles.suggestionMeta}>
                        <span className={styles.suggestionArt}>
                          {p.art || "Sin ART"}
                        </span>
                        <span className={styles.suggestionSiniestro}>
                          {p.siniestro || "Sin siniestro"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Teléfono */}
          <div className={styles.field}>
            <label htmlFor="phone" className={styles.label}>
              Número de teléfono <span className={styles.required}>*</span>
            </label>
            <input
              id="phone"
              type="tel"
              className={styles.input}
              placeholder="Ej: 5493456123456"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <small className={styles.helpText}>
              Usar código país y característica. Ej: 5493456123456
            </small>
          </div>

          {/* Nombre del paciente */}
          <div className={styles.field}>
            <label htmlFor="name" className={styles.label}>
              Nombre del paciente <span className={styles.required}>*</span>
            </label>
            <input
              id="name"
              type="text"
              className={styles.input}
              placeholder="Nombre completo"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* ART y Nro. de Siniestro juntos al 50% */}
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <div className={styles.rowFields}>
              <div className={styles.halfField}>
                <label className={styles.label}>ART</label>
                <input
                  type="text"
                  className={styles.input}
                  value={art}
                  onChange={(e) => setArt(e.target.value)}
                  placeholder="Ej: IAPS ART"
                />
              </div>
              <div className={styles.halfField}>
                <label className={styles.label}>Nro. de Siniestro</label>
                <input
                  type="text"
                  className={styles.input}
                  value={siniestro}
                  onChange={(e) => setSiniestro(e.target.value)}
                  placeholder="Ej: 162398"
                />
              </div>
            </div>
          </div>

          {/* Tipo de mensaje - ocupa todo el ancho */}
          <div className={`${styles.field} ${styles.fullWidth}`}>
            <label htmlFor="mensaje" className={styles.label}>
              Tipo de mensaje
            </label>
            <select
              id="mensaje"
              className={styles.input}
              value={mensaje}
              onChange={(e) => setMensaje(e.target.value)}
            >
              <option value="1">Mensaje 1 – FKT Aprobada</option>
              <option value="2">Mensaje 2 – RMN Aprobada</option>
              <option value="3">Mensaje 3 – Medicamentos</option>
              <option value="4">Mensaje 4 – Electrocardiograma</option>
              <option value="5">Mensaje 5 – Laboratorio</option>
              <option value="6">Mensaje 6 – Ecografía</option>
              <option value="7">Mensaje 7 – Cirugía</option>
              <option value="8">Mensaje 8 – Ortopedia</option>
            </select>
          </div>

          {/* Campos de fecha/hora (según tipo) */}
          {requiresDateTime && (
            <>
              <div className={styles.field}>
                <label htmlFor="dia" className={styles.label}>
                  Día del turno <span className={styles.required}>*</span>
                </label>
                <input
                  id="dia"
                  type="text"
                  className={styles.input}
                  placeholder="Ej: lunes 15/04"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="hora" className={styles.label}>
                  Hora del turno <span className={styles.required}>*</span>
                </label>
                <input
                  id="hora"
                  type="text"
                  className={styles.input}
                  placeholder="Ej: 10:30"
                  value={hora}
                  onChange={(e) => setHora(e.target.value)}
                />
              </div>
            </>
          )}

          {/* Selector de bioquímico (solo para Laboratorio) */}
          {mensaje === "5" && (
            <div className={styles.field}>
              <label htmlFor="bioquimico" className={styles.label}>
                Bioquímico
              </label>
              <select
                id="bioquimico"
                className={styles.input}
                value={bioquimico}
                onChange={(e) => setBioquimico(e.target.value)}
              >
                <option value="confalonieri">Bioquímica Confalonieri</option>
                <option value="marmol">Bioquímico Mármol</option>
                <option value="tabeni">Bioquímica Tabeni</option>
              </select>
            </div>
          )}

          {/* Selector de cardiólogo (solo para Electro) */}
          {mensaje === "4" && (
            <div className={styles.field}>
              <label htmlFor="cardiologo" className={styles.label}>
                Cardiólogo
              </label>
              <select
                id="cardiologo"
                className={styles.input}
                value={cardiologo}
                onChange={(e) => setCardiologo(e.target.value)}
              >
                <option value="percara">Dr. Percara</option>
                <option value="capovilla">Dr. Capovilla</option>
              </select>
            </div>
          )}
        </div>

        {/* Vista previa del mensaje */}
        <section className={styles.previewBox}>
          <div className={styles.previewHeader}>
            <div>
              <label htmlFor="preview" className={styles.label}>
                Vista previa del mensaje
              </label>
              <p className={styles.previewSubtitle}>
                {messageTitles[mensaje]} · Podés editar el texto antes de enviar.
              </p>
            </div>
            <span className={styles.previewBadge}>WhatsApp</span>
          </div>
          <textarea
            id="preview"
            className={styles.textarea}
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
        </section>

        {/* Botones de envío */}
        <div className={styles.actionsRow}>
          <a
            href={canSend ? createWaLink("app") : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.secondaryButton} ${!canSend ? styles.buttonDisabled : ""}`}
            onClick={(e) => {
              if (!canSend) e.preventDefault();
            }}
          >
            <span className={styles.buttonIcon}>📱</span>
            Abrir en WhatsApp
          </a>
          <a
            href={canSend ? createWaLink("web") : "#"}
            target="_blank"
            rel="noopener noreferrer"
            className={`${styles.button} ${!canSend ? styles.buttonDisabled : ""}`}
            onClick={(e) => {
              if (!canSend) e.preventDefault();
            }}
          >
            <span className={styles.buttonIcon}>🟢</span>
            Abrir en WhatsApp Web
          </a>
        </div>

        {!canSend && (
          <p className={styles.warningText}>
            Completá teléfono, nombre
            {requiresDateTime ? ", día y hora" : ""} para habilitar el envío.
          </p>
        )}
      </section>
    </main>
  );
}
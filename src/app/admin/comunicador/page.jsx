"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

export default function WhatsAppSender() {
  const searchParams = useSearchParams();

  // Parámetros de URL
  const initialPhone = searchParams.get("phone") || "";
  const initialName = searchParams.get("name") || "";
  const pacienteId = searchParams.get("pacienteId") || null;

  // Estados del formulario
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [mensaje, setMensaje] = useState("1");
  const [bioquimico, setBioquimico] = useState("confalonieri");
  const [cardiologo, setCardiologo] = useState("percara");
  const [preview, setPreview] = useState("");

  // Estados para búsqueda de pacientes
  const [pacientes, setPacientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const requiresDateTime = ["2", "4", "5", "6", "7"].includes(mensaje);

  // Cargar lista de pacientes al montar
  useEffect(() => {
    const fetchPacientes = async () => {
      try {
        const res = await fetch(`${FIREBASE_URL}/pacientes.json`);
        if (!res.ok) throw new Error("Error al cargar pacientes");
        const data = await res.json();
        if (data) {
          const arr = Object.entries(data).map(([id, value]) => ({
            id,
            ...value,
            fullName: `${value.trabajador?.apellido || ""} ${value.trabajador?.nombre || ""}`.trim(),
            phone: value.trabajador?.telefono || "",
          }));
          setPacientes(arr);
        }
      } catch (error) {
        console.error("Error cargando pacientes:", error);
      }
    };
    fetchPacientes();
  }, []);

  // Filtrar pacientes según término de búsqueda
  const filteredPacientes = pacientes.filter((p) =>
    p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.trabajador?.dni || "").includes(searchTerm)
  );

  // Manejar selección de paciente
  const handleSelectPaciente = (paciente) => {
    setName(paciente.fullName);
    setPhone(paciente.phone);
    setSearchTerm(paciente.fullName);
    setShowSuggestions(false);
  };

  // Construcción de mensaje
  const buildMessage = () => {
    if (mensaje === "1") {
      const msgDaniela = encodeURIComponent(
        "Hola Daniela, me acaban de autorizar las sesiones de kinesiología desde la ART. Necesito más información para concurrir."
      );
      const msgNatali = encodeURIComponent(
        "Hola Natali, me acaban de autorizar las sesiones de kinesiología desde la ART. Necesito más información para concurrir."
      );

      return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que *sus sesiones de kinesiología fueron aprobadas*.
Puede pasar a retirar la autorización por *Mesa de Entrada*, de *lunes a viernes de 8 a 12 hs* o de *16 a 20 hs*, y *sábados de 8 a 12 hs*.
Ingreso por *Roque Sáenz Peña*.

También le dejamos las kinesiólogas de Clinica de la Union que trabajan con ART:

• *Daniela Rivas*
  📍 Consultorio: 9 de Julio 1870 (Chajarí – E.R.)
  📱 Tel: 3456440878
  💬 Contactar por WhatsApp: wa.me/5493456440878?text=${msgDaniela}

• *Avancini Natali*
  📍 Consultorio: Rivadavia 2665 (Chajarí – E.R.)
  📱 Tel: 3456513866
  💬 Contactar por WhatsApp: wa.me/5493456513866?text=${msgNatali}

*Tambien puede comunicarse a su ART para consultar la cartilla de profesionales afiliados.*`;
    }
    if (mensaje === "2") {
      return `Buen día, *${name}*.
Le escribimos desde Clínica de la Unión. Su *resonancia fue aprobada* y tiene turno para *${dia} a las ${hora}*.

*Indicaciones importantes:*
• Límite de peso: *140 kg*
• Asistir con ropa cómoda y *DNI físico*
• Llegar *15 minutos antes* del turno
• *Avisar si posee*: prótesis metálicas, implante coclear, marcapasos, válvula cardíaca o cirugías recientes
• Puede asistir con *un acompañante* (en sala de espera)

*Ingreso por Avenida Siburu 1085.* (Imágenes Médicas)`;
    }
    if (mensaje === "3") {
      return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que *sus medicamentos fueron aprobados*.
Puede pasar a retirar la orden por *Mesa de Entrada*, de *lunes a viernes de 8 a 12 hs* o de *16 a 20 hs*, y *sábados de 8 a 12 hs*.
Ingreso por *Roque Sáenz Peña*.

*Cómo trabajan las ART:*

• *IAPS*: Presentarse con la orden en Farmacia Zordan o Farmacia de la Unión.
• *Federación Patronal*: Orden + denuncia → Farmacia Del Pueblo.
• *La Segunda*: Orden + copia de la denuncia → Farmacia de la Unión.
• *Otras ART*: Orden + copia de la denuncia → Farmacia Zordan o Farmacia de la Unión.`;
    }
    if (mensaje === "4") {
      const profesional =
        cardiologo === "percara"
          ? `Dr. Percara
*Dirección:* Bolívar 1695 (esquina con 9 de Julio)`
          : `Dr. Capovilla
*Dirección:* Bolívar 1645 (entre Pablo Estampa y 9 de Julio)`;
      return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que su *electrocardiograma fue aprobado* y tiene turno para *${dia} a las ${hora}*.

*Indicaciones:*
• Asistir con documento
• Llegar 15 minutos antes

*Profesional:*
${profesional}`;
    }
    if (mensaje === "5") {
      const profesional =
        bioquimico === "confalonieri"
          ? `Bioquímica Confalonieri\n*Dirección:* Belgrano y Corrientes (frente a la juguetería Pepos)`
          : bioquimico === "marmol"
            ? `Bioquímico Mármol\n*Dirección:* Sarmiento 2610`
            : `Bioquímica Tabeni\n*Dirección:* Jaime Tabeni 1101 (esquina Uruguay)`;
      return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que su *estudio de laboratorio fue aprobado* y tiene turno para *${dia} a las ${hora}*.

*Profesional:*
${profesional}

*Requisitos:*
• Presentarse con 8 horas de ayuno
• Llevar documento
• Llegar 10 a 15 minutos antes`;
    }
    if (mensaje === "6") {
      return `Buen día, *${name}*.
Le informamos desde Clínica de la Unión que su *ecografía fue aprobada* y tiene turno para *${dia} a las ${hora}*.

*Lugar de realización:*
Sector de *BioImagen* dentro de Clínica de la Unión.
En caso de no conocer la ubicación, puede consultar en *Mesa de Entrada*.

*Indicaciones:*
• Asistir con documento
• Llegar 10 a 15 minutos antes`;
    }
    if (mensaje === "7") {
      return `CLÍNICA DE LA UNIÓN

Buen día, *${name}*.

✅ Su cirugía fue APROBADA por la ART.

📅 *La cirugía será el día ${dia} a las ${hora}.*

⚠️ IMPORTANTE:
• Debe venir en AYUNAS
• Debe asistir en el horario indicado
• Ese día ya se realiza la cirugía
• Traer DNI físico original
• Traer fotocopia del DNI (frente y dorso)

📍 Al ingresar a la clínica, presentarse en Mesa de Entrada.

Antes de la cirugía necesitamos que complete este formulario:

https://art-xi-six.vercel.app/cx

Ante cualquier duda puede responder este mensaje.`;
    }

    if (mensaje === "8") {
      return `Buen día, *${name}*.

Le informamos los pasos para retirar su ortopedia:

1. *Retirar autorización* en Mesa de Entrada de la Clínica (ingreso por Roque Sáenz Peña).  
   Horarios: Lun a vie 8-12 y 16-20, sáb 8-12.

2. *Ir a Distrimed* (9 de Julio 3240, frente a Farmacia Barbieri) con:  
   - Copia de la denuncia  
   - Autorización ortopédica

3. *Consultar cobertura* en la ortopedia:  
   - Si la ART cubre el 100%, retira sin cargo.  
   - Si no, debe abonar y luego pedir reintegro a su ART (guardar factura).`;
    }
    return "";
  };

  useEffect(() => {
    setPreview(buildMessage());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, dia, hora, mensaje, bioquimico, cardiologo]);

  const createWaLink = () => {
    if (!phone) return "";
    return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(preview)}`;
  };

  const canSend = phone && name && (!requiresDateTime || (dia && hora));

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Envío rápido WhatsApp</h1>

        <div className={styles.formGrid}>
          {/* Búsqueda de pacientes */}
          <div className={styles.field} style={{ gridColumn: "span 2" }}>
            <label className={styles.label}>
              Buscar paciente (opcional)
            </label>
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
                    <div
                      key={p.id}
                      className={styles.suggestionItem}
                      onClick={() => handleSelectPaciente(p)}
                    >
                      <span className={styles.suggestionName}>{p.fullName}</span>
                      <span className={styles.suggestionPhone}>{p.phone || "Sin teléfono"}</span>
                    </div>
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
          </div>

          {/* Nombre paciente */}
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

          {/* Campos condicionales: fecha y hora */}
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

          {/* Selector de mensaje */}
          <div className={styles.field}>
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
              <option value="3">Mensaje 3 – Medicamentos Aprobados</option>
              <option value="4">Mensaje 4 – Electrocardiograma</option>
              <option value="5">Mensaje 5 – Estudios Laboratorio</option>
              <option value="6">Mensaje 6 – Ecografía Aprobada</option>
              <option value="7">Mensaje 7 – Cirugía Aprobada</option>
              <option value="8">Mensaje 8 – Ortopedia</option>
            </select>
          </div>

          {/* Selector de bioquímico (solo mensaje 5) */}
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
                <option value="tabeni">Bioquímico/a Tabeni</option>  {/* ← nuevo */}
              </select>
            </div>
          )}

          {/* Selector de cardiólogo (solo mensaje 4) */}
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

        {/* Área de previsualización */}
        <div className={styles.previewBox}>
          <label htmlFor="preview" className={styles.label}>
            Vista previa del mensaje
          </label>
          <textarea
            id="preview"
            className={styles.textarea}
            value={preview}
            onChange={(e) => setPreview(e.target.value)}
          />
        </div>

        {/* Botón de envío */}
        <a
          href={canSend ? createWaLink() : "#"}
          target="_blank"
          className={`${styles.button} ${!canSend ? styles.buttonDisabled : ""}`}
          onClick={(e) => {
            if (!canSend) e.preventDefault();
          }}
          rel="noreferrer"
        >
          Enviar WhatsApp
        </a>
      </div>
    </div>
  );
}
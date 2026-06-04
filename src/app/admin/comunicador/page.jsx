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

// Cargar lista de pacientes
useEffect(() => {
const fetchPacientes = async () => {
try {
const res = await fetch(`${FIREBASE_URL}/pacientes.json`);


    if (!res.ok) {
      throw new Error("Error al cargar pacientes");
    }

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

// Filtrar pacientes
const filteredPacientes = pacientes.filter(
(p) =>
p.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
(p.trabajador?.dni || "").includes(searchTerm)
);

// Seleccionar paciente
const handleSelectPaciente = (paciente) => {
setName(paciente.fullName);
setPhone(paciente.phone);
setSearchTerm(paciente.fullName);
setShowSuggestions(false);
};

// Construcción de mensajes
const buildMessage = () => {
// KINESIOLOGÍA
if (mensaje === "1") {
const msgDaniela = encodeURIComponent(
"Hola Daniela, me aprobaron las sesiones de kinesiología desde Clínica de la Unión y quisiera coordinar un turno."
);

  const msgNatali = encodeURIComponent(
    "Hola Natalia, me aprobaron las sesiones de kinesiología desde Clínica de la Unión y quisiera coordinar un turno."
  );

  return `Buen día, *${name}*.


✅ Sus sesiones de kinesiología fueron APROBADAS.

Puede retirar la autorización por Mesa de Entrada.

📍 Ingreso por Roque Sáenz Peña.

🕒 Horarios:
• Lunes a viernes: 8 a 12 hs y 16 a 20 hs
• Sábados: 8 a 12 hs

Kinesiólogas disponibles:

• *Daniela Rivas*
📱 3456440878
💬 WhatsApp:
https://wa.me/5493456440878?text=${msgDaniela}

• *Avancini Natali*
📱 3456513866
💬 WhatsApp:
https://wa.me/5493456513866?text=${msgNatali}

También puede consultar profesionales en la cartilla de su ART.`;
}


// RESONANCIA
if (mensaje === "2") {
  return `Buen día, *${name}*.


✅ Su resonancia fue APROBADA.

📅 Turno: *${dia} a las ${hora}*

📍 Lugar:
Imágenes Médicas
Av. Siburu 1085

⚠️ Importante:
• Traer DNI físico
• Llegar 15 minutos antes
• Asistir con ropa cómoda
• Peso máximo permitido: 140 kg

❗Avisar antes del estudio si posee:
• Marcapasos
• Prótesis metálicas
• Implantes
• Válvula cardíaca
• Cirugías recientes`;
}

// MEDICAMENTOS
if (mensaje === "3") {
  return `Buen día, *${name}*.


✅ Sus medicamentos fueron APROBADOS.

Puede retirar la orden por Mesa de Entrada.

📍 Ingreso por Roque Sáenz Peña.

🕒 Horarios:
• Lunes a viernes: 8 a 12 hs y 16 a 20 hs
• Sábados: 8 a 12 hs

⚠️ Cómo retirar según ART:

• *IAPS*:
Orden en Farmacia Zordan o Farmacia de la Unión.

• *Federación Patronal*:
Orden + denuncia → Farmacia Del Pueblo.

• *La Segunda*:
Orden + copia de denuncia → Farmacia de la Unión.

• *Otras ART*:
Orden + copia de denuncia → Farmacia Zordan o Farmacia de la Unión.`;
}


// ELECTROCARDIOGRAMA
if (mensaje === "4") {
  const profesional =
    cardiologo === "percara"
      ? `Dr. Percara


📍 Bolívar 1695 (esquina 9 de Julio)`          :`Dr. Capovilla
📍 Bolívar 1645`;

  return `Buen día, *${name}*.


✅ Su electrocardiograma fue APROBADO.

📅 Turno: *${dia} a las ${hora}*

⚠️ Importante:
• Traer DNI físico
• Llegar 15 minutos antes

👨‍⚕️ Profesional:
${profesional}`;
}


// LABORATORIO
if (mensaje === "5") {
  const profesional =
    bioquimico === "confalonieri"
      ? `Bioquímica Confalonieri


📍 Belgrano y Corrientes (frente a Pepos)`          : bioquimico === "marmol"
          ?`Bioquímico Mármol
📍 Sarmiento 2610`          :`Bioquímica Tabeni
📍 Jaime Tabeni 1101`;


  return `Buen día, *${name}*.


✅ Su estudio de laboratorio fue APROBADO.

📅 Turno: *${dia} a las ${hora}*

⚠️ IMPORTANTE:
• Debe asistir con 8 horas de AYUNO
• Traer DNI físico
• Llegar 10 minutos antes

📍 Lugar:
${profesional}`;
}


// ECOGRAFÍA
if (mensaje === "6") {
  return `Buen día, *${name}*.


✅ Su ecografía fue APROBADA.

📅 Turno: *${dia} a las ${hora}*

📍 Lugar:
Sector BioImagen dentro de Clínica de la Unión.

Al ingresar puede consultar en Mesa de Entrada.

⚠️ Importante:
• Traer DNI físico
• Llegar 10 minutos antes`;
}


// CIRUGÍA
if (mensaje === "7") {
  return `CLÍNICA DE LA UNIÓN


Buen día, *${name}*.

✅ Su cirugía fue APROBADA por la ART.

📅 La cirugía será el día *${dia} a las ${hora}*.

⚠️ IMPORTANTE:
• Debe venir en AYUNAS
• Debe asistir en el horario indicado
• Ese día ya se realiza la cirugía
• Traer DNI físico original
• Traer fotocopia del DNI (frente y dorso)

📍 Al ingresar a la clínica, presentarse en Mesa de Entrada.

Antes de la cirugía necesitamos que complete este formulario:

https://art-xi-six.vercel.app/cx

Por favor responder:
*CONFIRMO ASISTENCIA*

Ante cualquier duda puede responder este mensaje.`;
}


// ORTOPEDIA
if (mensaje === "8") {
  return `Buen día, *${name}*.


✅ Su ortopedia fue APROBADA.

📌 Pasos a seguir:

1️⃣ Retirar autorización
📍 Mesa de Entrada de Clínica de la Unión
Ingreso por Roque Sáenz Peña.

🕒 Horarios:
• Lunes a viernes: 8 a 12 hs y 16 a 20 hs
• Sábados: 8 a 12 hs

2️⃣ Presentarse en Distrimed
📍 9 de Julio 3240
(frente a Farmacia Barbieri)

Debe llevar:
• Copia de la denuncia
• Autorización ortopédica

3️⃣ Consultar cobertura
• Si la ART cubre el 100%, retira sin costo
• Si debe pagar, luego puede solicitar reintegro a la ART guardando la factura`;
}


return "";


};

// Actualizar preview
useEffect(() => {
setPreview(buildMessage());
}, [name, dia, hora, mensaje, bioquimico, cardiologo]);

// Link WhatsApp
const createWaLink = () => {
if (!phone) return "";


return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(preview)}`;


};

const canSend =
phone && name && (!requiresDateTime || (dia && hora));

return ( <div className={styles.container}> <div className={styles.card}> <h1 className={styles.title}>Envío rápido WhatsApp</h1>


    <div className={styles.formGrid}>
      {/* Buscar paciente */}
      <div
        className={styles.field}
        style={{ gridColumn: "span 2" }}
      >
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
            onBlur={() =>
              setTimeout(() => setShowSuggestions(false), 200)
            }
          />

          {showSuggestions &&
            searchTerm &&
            filteredPacientes.length > 0 && (
              <div className={styles.suggestions}>
                {filteredPacientes.slice(0, 8).map((p) => (
                  <div
                    key={p.id}
                    className={styles.suggestionItem}
                    onClick={() => handleSelectPaciente(p)}
                  >
                    <span className={styles.suggestionName}>
                      {p.fullName}
                    </span>

                    <span className={styles.suggestionPhone}>
                      {p.phone || "Sin teléfono"}
                    </span>
                  </div>
                ))}
              </div>
            )}
        </div>
      </div>

      {/* Teléfono */}
      <div className={styles.field}>
        <label htmlFor="phone" className={styles.label}>
          Número de teléfono{" "}
          <span className={styles.required}>*</span>
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

      {/* Nombre */}
      <div className={styles.field}>
        <label htmlFor="name" className={styles.label}>
          Nombre del paciente{" "}
          <span className={styles.required}>*</span>
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

      {/* Fecha y hora */}
      {requiresDateTime && (
        <>
          <div className={styles.field}>
            <label htmlFor="dia" className={styles.label}>
              Día del turno{" "}
              <span className={styles.required}>*</span>
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
              Hora del turno{" "}
              <span className={styles.required}>*</span>
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

      {/* Tipo mensaje */}
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
          <option value="3">Mensaje 3 – Medicamentos</option>
          <option value="4">Mensaje 4 – Electrocardiograma</option>
          <option value="5">Mensaje 5 – Laboratorio</option>
          <option value="6">Mensaje 6 – Ecografía</option>
          <option value="7">Mensaje 7 – Cirugía</option>
          <option value="8">Mensaje 8 – Ortopedia</option>
        </select>
      </div>

      {/* Bioquímico */}
      {mensaje === "5" && (
        <div className={styles.field}>
          <label
            htmlFor="bioquimico"
            className={styles.label}
          >
            Bioquímico
          </label>

          <select
            id="bioquimico"
            className={styles.input}
            value={bioquimico}
            onChange={(e) =>
              setBioquimico(e.target.value)
            }
          >
            <option value="confalonieri">
              Bioquímica Confalonieri
            </option>

            <option value="marmol">
              Bioquímico Mármol
            </option>

            <option value="tabeni">
              Bioquímica Tabeni
            </option>
          </select>
        </div>
      )}

      {/* Cardiólogo */}
      {mensaje === "4" && (
        <div className={styles.field}>
          <label
            htmlFor="cardiologo"
            className={styles.label}
          >
            Cardiólogo
          </label>

          <select
            id="cardiologo"
            className={styles.input}
            value={cardiologo}
            onChange={(e) =>
              setCardiologo(e.target.value)
            }
          >
            <option value="percara">
              Dr. Percara
            </option>

            <option value="capovilla">
              Dr. Capovilla
            </option>
          </select>
        </div>
      )}
    </div>

    {/* Vista previa */}
    <div className={styles.previewBox}>
      <label
        htmlFor="preview"
        className={styles.label}
      >
        Vista previa del mensaje
      </label>

      <textarea
        id="preview"
        className={styles.textarea}
        value={preview}
        onChange={(e) => setPreview(e.target.value)}
      />
    </div>

    {/* Botón enviar */}
    <a
      href={canSend ? createWaLink() : "#"}
      target="_blank"
      rel="noreferrer"
      className={`${styles.button} ${
        !canSend ? styles.buttonDisabled : ""
      }`}
      onClick={(e) => {
        if (!canSend) e.preventDefault();
      }}
    >
      Enviar WhatsApp
    </a>
  </div>
</div>


);
}

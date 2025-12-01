"use client";
import { useState, useEffect } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [mensaje, setMensaje] = useState("1");

  // Opciones nuevas
  const [bioquimico, setBioquimico] = useState("confalonieri");
  const [cardiologo, setCardiologo] = useState("percara");

  // Vista previa
  const [preview, setPreview] = useState("");

  // 🔵 AHORA buildMessage SOLO DEVUELVE EL TEXTO — NO SETEA NADA
  const buildMessage = () => {
    let text = "";

    if (mensaje === "1") {
      text = `Buen día, *${name}*.  
Le informamos desde Clínica de la Unión que *sus sesiones de kinesiología fueron aprobadas*.  
Puede pasar a retirar la autorización por *Mesa de Entrada*, de *8 a 12 hs* o de *16 a 20 hs*.  
Ingreso por *Roque Sáenz Peña*.

También le dejamos las kinesiólogas que trabajan con ART:

• *Daniela Rivas*  
  Consultorio: 9 de Julio 1870 (Chajarí – E.R.)

• *Avancini Natali*  
  Consultorio: Rivadavia 2665 (Chajarí – E.R.)

En caso de que su ART sea *IAPS*, puede comunicarse para consultar la cartilla de profesionales afiliados.`;
    }

    if (mensaje === "2") {
      text = `Buen día, *${name}*.  
Le escribimos desde Clínica de la Unión. Su *resonancia fue aprobada* y tiene turno para *${dia} a las ${hora}*.

*Indicaciones importantes:*  
• Límite de peso: *140 kg*  
• Asistir con ropa cómoda  
• Llegar *15 minutos antes* del turno  
• *Avisar si posee*: prótesis metálicas, implante coclear, marcapasos, desfibrilador, válvula cardíaca o cirugías recientes  
• Puede asistir con *un acompañante* (en sala de espera)

*Ingreso por Avenida Siburu 1085.* (Imágenes Médicas)`;
    }

    if (mensaje === "3") {
      text = `Buen día, *${name}*.  
Le informamos desde Clínica de la Unión que *sus medicamentos fueron aprobados*.  
Puede pasar a retirar la orden por *Mesa de Entrada*, de *8 a 12 hs* o de *16 a 20 hs*.  
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

      text = `Buen día, *${name}*.  
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
          ? `Bioquímica Confalonieri  
*Dirección:* Belgrano y Corrientes (frente a la juguetería Pepos)`
          : `Bioquímico Mármol  
*Dirección:* Sarmiento 2610`;

      text = `Buen día, *${name}*.  
Le informamos desde Clínica de la Unión que su *estudio de laboratorio fue aprobado* y tiene turno para *${dia} a las ${hora}*.

*Profesional:*  
${profesional}

*Requisitos:*  
• Presentarse con 8 horas de ayuno  
• Llevar documento  
• Llegar 10 a 15 minutos antes`;
    }

    return text;
  };

  // 🔵 EL PREVIEW SE SETEA SOLAMENTE ACÁ — YA NO CAUSA LOOP
  useEffect(() => {
    const text = buildMessage();
    setPreview(text);
  }, [phone, name, dia, hora, mensaje, bioquimico, cardiologo]);

  const createWaLink = () => {
    if (!phone) return "";
    return `https://wa.me/${phone}?text=${encodeURIComponent(preview)}`;
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Envío rápido WhatsApp</h1>

        <input
          type="text"
          placeholder="Número de teléfono (ej: 549xxxxxxxxx)"
          className={styles.input}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <input
          type="text"
          placeholder="Nombre del paciente"
          className={styles.input}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        {(mensaje === "2" || mensaje === "4" || mensaje === "5") && (
          <>
            <input
              type="text"
              placeholder="Día del turno"
              className={styles.input}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />

            <input
              type="text"
              placeholder="Hora del turno"
              className={styles.input}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </>
        )}

        {mensaje === "5" && (
          <select
            className={styles.input}
            value={bioquimico}
            onChange={(e) => setBioquimico(e.target.value)}
          >
            <option value="confalonieri">Bioquímica Confalonieri</option>
            <option value="marmol">Bioquímico Mármol</option>
          </select>
        )}

        {mensaje === "4" && (
          <select
            className={styles.input}
            value={cardiologo}
            onChange={(e) => setCardiologo(e.target.value)}
          >
            <option value="percara">Dr. Percara</option>
            <option value="capovilla">Dr. Capovilla</option>
          </select>
        )}

        <select
          className={styles.input}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        >
          <option value="1">Mensaje 1 – FKT Aprobada</option>
          <option value="2">Mensaje 2 – RMN Aprobada</option>
          <option value="3">Mensaje 3 – Medicamentos Aprobados</option>
          <option value="4">Mensaje 4 – Electrocardiograma</option>
          <option value="5">Mensaje 5 – Estudios Laboratorio</option>
        </select>

        <div className={styles.previewBox}>
          <h3>Vista previa del mensaje:</h3>
          <textarea className={styles.textarea} value={preview} readOnly />
        </div>

        <a href={createWaLink()} target="_blank" className={styles.button}>
          Enviar WhatsApp
        </a>
      </div>
    </div>
  );
}

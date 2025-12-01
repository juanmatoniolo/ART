"use client";
import { useState } from "react";
import styles from "./page.module.css";

export default function Home() {
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [dia, setDia] = useState("");
  const [hora, setHora] = useState("");
  const [mensaje, setMensaje] = useState("1");

  const buildMessage = () => {
    let text = "";

    // --- MENSAJE 1: FKT APROBADA ---
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

    // --- MENSAJE 2: RESONANCIA APROBADA ---
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

    // --- MENSAJE 3: MEDICAMENTOS APROBADOS ---
    if (mensaje === "3") {
      text = `Buen día, *${name}*.  
Le informamos desde Clínica de la Unión que *sus medicamentos fueron aprobados*.  
Puede pasar a retirar la orden por *Mesa de Entrada*, de *8 a 12 hs* o de *16 a 20 hs*.  
Ingreso por *Roque Sáenz Peña*.

*Cómo trabajan las ART:*  

• *IAPS*: Presentarse con la orden en Farmacia Zordan o Farmacia de la Unión.  
• *Federación Patronal*: Orden + denuncia → Farmacia Del Pueblo.  
• *La Segunda*: Orden + copia de la denuncia → Farmacia de la Unión.  
  Si no posee copia de la denuncia, debe concurrir a la oficina de la ART.  
• *Otras ART*: Orden + copia de la denuncia → Farmacia Zordan o Farmacia de la Unión.`;
    }

    // --- MENSAJE 4: ELECTROCARDIOGRAMA APROBADO ---
    if (mensaje === "4") {
      text = `Buen día, *${name}*.  
Le informamos desde Clínica de la Unión que su *electrocardiograma fue aprobado* y tiene turno para *${dia} a las ${hora}*.

*Indicaciones importantes:*  
• Asistir con documento  
• Llegar *15 minutos antes* del turno  


*Consultorio del profesional:* Bolívar 1695 (esquina con 9 de Julio).`;
    }

    // --- MENSAJE 5: LABORATORIO CLÍNICO – DR. PERCARA ---
    if (mensaje === "5") {
      text = `Buen día, *${name}*.  
Le informamos desde Clínica de la Unión que su *estudio de laboratorio fue aprobado* y tiene turno para *${dia} a las ${hora}*.

*Profesional:* Dra. Confalonieri  
*Dirección:* Belgrano y Corrientes ( frente a la jugueteria Pepos).

*Recomendaciones:*  
• Presentarse con *8 horas de ayuno*  
• Llevar documento  
• Llegar *15 minutos antes* del turno`;
    }

    // --- MENSAJE 6: BIOQUÍMICA – CONFALONIERI ---
    if (mensaje === "6") {
      text = `Buen día, *${name}*.  
Le informamos desde Clínica de la Unión que su *estudio bioquímico fue aprobado*.  

Tiene turno para el *jueves 27/11 a las 7:30 hs* con la bioquímica *Confalonieri*.

*Consultorio:* Belgrano y Corrientes (frente a la juguetería Pepos).  

*Requisitos:*  
• Presentarse con *8 horas de ayuno*  
• Llevar documento  
• Llegar *10 a 15 minutos antes*`;
    }

    return encodeURIComponent(text);
  };

  const createWaLink = () => {
    if (!phone) return "";
    return `https://wa.me/${phone}?text=${buildMessage()}`;
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

        {/* Campos extras sólo para mensajes que requieren día y hora */}
        {(mensaje === "2" || mensaje === "4" || mensaje === "5") && (
          <>
            <input
              type="text"
              placeholder="Día del turno (ej: 6/11)"
              className={styles.input}
              value={dia}
              onChange={(e) => setDia(e.target.value)}
            />

            <input
              type="text"
              placeholder="Hora del turno (ej: 19hs)"
              className={styles.input}
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </>
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
          <option value="5">Mensaje 5 – Laboratorio Dr. Percara</option>
          <option value="6">Mensaje 6 – Bioquímica Confalonieri</option>
        </select>

        <a href={createWaLink()} target="_blank" className={styles.button}>
          Enviar WhatsApp
        </a>
      </div>
    </div>
  );
}

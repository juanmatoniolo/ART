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

    if (mensaje === "1") {
      text = `Buenas tardes *${name}*. Me comunico de Clínica de la Unión. Sus sesiones de kinesiología fueron aprobadas, tiene que pasar a retirar la autorización por mesa de entrada en los horarios de 8 a 12 o de 16 a 20 horas.\n\nTambién ya te dejo las kines que trabajan con ART:\n- Daniela Rivas\n  Consultorio: 9 de Julio 1870 (Chajarí - E.R)\n\n- Avancini Natali\n  Consultorio: Rivadavia 2665, Chajarí (E.R)\n\n_En caso que su ART sea IAPS puede ponerse en contacto y ver la cartilla de profesionales afiliados._`;
    }

    if (mensaje === "2") {
      text = `Buen día *${name}*. Me comunico de Clínica de la Unión.\nSu resonancia fue aprobada, tiene turno el día *${dia}* a las *${hora}*.\nSe ingresa por calle Siburu 1085.`;
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

        {mensaje === "2" && (
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

        <select
          className={styles.input}
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        >
          <option value="1">Mensaje 1 – Kinesiología aprobada</option>
          <option value="2">Mensaje 2 – Resonancia aprobada</option>
        </select>

        <a
          href={createWaLink()}
          target="_blank"
          className={styles.button}
        >
          Enviar WhatsApp
        </a>
      </div>
    </div>
  );
}

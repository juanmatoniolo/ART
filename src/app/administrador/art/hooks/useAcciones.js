import { useState, useEffect } from "react";
import { FIREBASE_URL } from "../utils/firebase";

// Acciones por defecto (definidas directamente aquí)
const ACCIONES_DEFAULT = [
  { id: "evolucion", label: "Evolución", short: "EVOLUCIÓN", emoji: "📋", adjunto: "Evolución del paciente", codigo: "/COD.: 42.01.01 CONSULTA MEDICA DR {medico}", defaultSelected: true, categoria: "consulta" },
  { id: "curacion", label: "Curación", short: "CURACIÓN", emoji: "🩹", adjunto: "Indicación de curación", codigo: "/COD.: 43.02.01 CURACION + MEDICAMENTOS Y DESCARTABLES", categoria: "practica" },
  { id: "fkt", label: "FKT", short: "FKT", emoji: "🏃", adjunto: "Pedido de FKT", codigo: "SE SOLICITAN 10 SESIONES DE FKT", categoria: "sesion" },
  { id: "mgt", label: "MGT", short: "MGT", emoji: "💪", adjunto: "Pedido de MGT", codigo: "SE SOLICITAN 10 SESIONES DE MGT", categoria: "sesion" },
  { id: "rx", label: "RX", short: "RX", emoji: "📷", adjunto: "Pedido de RX", codigo: "/COD.: AUTORIZACION RX ______", categoria: "estudio" },
  { id: "rmn", label: "RMN", short: "RMN", emoji: "🧲", adjunto: "Pedido de RMN", codigo: "/COD.: AUTORIZACION RMN SIN CONTRASTE", categoria: "estudio" },
  { id: "sutura", label: "Sutura", short: "SUTURA", emoji: "🧵", adjunto: "Indicación de sutura", codigo: "/COD.: SUTURA 13.01.10 X 1 DR", categoria: "practica" },
  { id: "yeso", label: "Yeso", short: "YESO", emoji: "🦴", adjunto: "Indicación de yeso", codigo: "/COD.: AUTORIZACION YESO ______", categoria: "practica" },
  { id: "tac", label: "TAC", short: "TAC", emoji: "🔬", adjunto: "Pedido de TAC", codigo: "/COD.: AUTORIZACION TAC S/C DE ______", categoria: "estudio" },
  { id: "ecografia", label: "Ecografía", short: "ECOGRAFIA", emoji: "🩻", adjunto: "Pedido de ecografía", codigo: "/COD.: AUTORIZACION ECOGRAFIA DE PARTES BLANDAS", categoria: "estudio" },
  { id: "cirugia", label: "Cirugía", short: "CIRUGIA", emoji: "🏥", adjunto: "Solicitud de cirugía", codigo: "/COD.: AUTORIZACION CIRUGIA ______, LAB, ECG Y MATERIALES", categoria: "practica" },
  { id: "inmovilizador", label: "Inmovilizador", short: "INMOVILIZADOR", emoji: "🦾", adjunto: "Indicación de inmovilizador", codigo: "/COD.: AUTORIZACION INMOVILIZADOR ______", categoria: "practica" },
];

export default function useAcciones() {
  const [acciones, setAcciones] = useState(ACCIONES_DEFAULT);
  const [loading, setLoading] = useState(true);

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
            categoria: val.categoria || "practica",
          }));
          setAcciones(lista);
        }
      })
      .catch(() => console.log("Usando acciones por defecto"))
      .finally(() => setLoading(false));
  }, []);

  return { acciones, loading, setAcciones };
}
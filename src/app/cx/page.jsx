"use client";

import { useState, useRef } from "react";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";
const WHATSAPP_NUMBER = "5493456441580"; // Ajusta según formato correcto

export default function FormularioCirugia() {
  const formRef = useRef(null);
  const [form, setForm] = useState({
    apellido: "",
    nombre: "",
    sexo: "",
    dni: "",
    nacimiento: "",
    lugarNacimiento: "",
    domicilio: "",
    localidad: "",
    provincia: "",
    telefono: "",
  });

  const [edad, setEdad] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });

  // Función para calcular edad
  const calcularEdad = (fecha) => {
    if (!fecha) return "";
    const [year, month, day] = fecha.split("-");
    const hoy = new Date();
    const nacimiento = new Date(year, month - 1, day);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const diffMeses = hoy.getMonth() - nacimiento.getMonth();
    if (diffMeses < 0 || (diffMeses === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad >= 0 ? edad : "";
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));

    if (name === "nacimiento") {
      const nuevaEdad = calcularEdad(value);
      setEdad(nuevaEdad);
    }
  };

  const limpiarFormulario = () => {
    setForm({
      apellido: "",
      nombre: "",
      sexo: "",
      dni: "",
      nacimiento: "",
      lugarNacimiento: "",
      domicilio: "",
      localidad: "",
      provincia: "",
      telefono: "",
    });
    setEdad("");
  };

  const mostrarMensaje = (texto, tipo) => {
    setMensaje({ texto, tipo });
    setTimeout(() => {
      setMensaje({ texto: "", tipo: "" });
    }, 5000);
  };

  // Generar texto para WhatsApp
  const generarMensajeWhatsApp = () => {
    return `
*SOLICITUD DE CIRUGÍA*
--------------------------------
*DATOS DEL PACIENTE*
- Apellido: ${form.apellido}
- Nombre: ${form.nombre}
- Sexo: ${form.sexo === "M" ? "Masculino" : "Femenino"}
- DNI/CUIL: ${form.dni}
- Fecha de nacimiento: ${form.nacimiento}
- Edad: ${edad} años
--------------------------------
*DATOS COMPLEMENTARIOS*
- Lugar de nacimiento: ${form.lugarNacimiento}
- Domicilio actual: ${form.domicilio}
- Localidad: ${form.localidad}
- Provincia: ${form.provincia}
- Teléfono de contacto: ${form.telefono}
--------------------------------
*Enviado desde el sistema de Clínica de la Unión*
    `.trim();
  };

  const enviarWhatsApp = () => {
    const mensaje = generarMensajeWhatsApp();
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(mensaje)}`;
    const nuevaVentana = window.open(url, "_blank");
    
    // Si el navegador bloqueó la ventana emergente, mostrar enlace manual
    if (!nuevaVentana || nuevaVentana.closed || typeof nuevaVentana.closed === "undefined") {
      mostrarMensaje(
        <span>
          ✅ Solicitud guardada.{" "}
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: "white", fontWeight: "bold", textDecoration: "underline" }}>
            Haz clic aquí para enviar por WhatsApp
          </a>
        </span>,
        "exito"
      );
    } else {
      mostrarMensaje("✅ Solicitud enviada. Se abrió WhatsApp para notificar.", "exito");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje({ texto: "", tipo: "" });

    // Validaciones
    const camposObligatorios = [
      "apellido",
      "nombre",
      "sexo",
      "dni",
      "nacimiento",
      "lugarNacimiento",
      "domicilio",
      "localidad",
      "provincia",
      "telefono",
    ];

    for (const campo of camposObligatorios) {
      if (!form[campo]?.trim()) {
        mostrarMensaje(`El campo ${campo} es obligatorio`, "error");
        document.querySelector(`[name="${campo}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // Validar DNI/CUIL
    const dniLimpio = form.dni.replace(/\D/g, "");
    if (dniLimpio.length < 7 || dniLimpio.length > 11) {
      mostrarMensaje("DNI/CUIL inválido (debe tener entre 7 y 11 dígitos)", "error");
      return;
    }

    // Validar fecha de nacimiento coherente
    if (form.nacimiento) {
      const edadCalculada = calcularEdad(form.nacimiento);
      if (edadCalculada === "" || edadCalculada < 0 || edadCalculada > 120) {
        mostrarMensaje("Fecha de nacimiento inválida", "error");
        return;
      }
    }

    setEnviando(true);
    try {
      const data = {
        ...form,
        edad: edad,
        fechaSolicitud: Date.now(),
        atendida: false,
        createdAt: new Date().toISOString(),
      };

      const res = await fetch(`${FIREBASE_URL}/solicitudes-cirugia.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Error al enviar");

      // Éxito: limpiar formulario y enviar WhatsApp
      limpiarFormulario();
      enviarWhatsApp();

      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error(error);
      mostrarMensaje("❌ Hubo un error. Intente nuevamente más tarde.", "error");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Solicitud de Cirugía</h1>
        <p className={styles.subtitle}>Complete todos los campos para solicitar su cirugía</p>

        {mensaje.texto && (
          <div className={`${styles.mensaje} ${styles[mensaje.tipo]}`}>
            {mensaje.texto}
          </div>
        )}

        <form ref={formRef} onSubmit={handleSubmit} className={styles.form} noValidate>
          {/* DATOS DEL PACIENTE */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Datos del paciente</h2>

            <div className={styles.formGroup}>
              <label htmlFor="apellido">Apellido *</label>
              <input
                type="text"
                id="apellido"
                name="apellido"
                value={form.apellido}
                onChange={handleChange}
                placeholder="Ej: Pérez"
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="nombre">Nombre *</label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                value={form.nombre}
                onChange={handleChange}
                placeholder="Ej: Juan"
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Sexo *</label>
              <div className={styles.sexoGroup}>
                <button
                  type="button"
                  className={`${styles.sexoBtn} ${form.sexo === "M" ? styles.active : ""}`}
                  onClick={() => !enviando && setForm((prev) => ({ ...prev, sexo: "M" }))}
                  disabled={enviando}
                >
                  Masculino
                </button>
                <button
                  type="button"
                  className={`${styles.sexoBtn} ${form.sexo === "F" ? styles.active : ""}`}
                  onClick={() => !enviando && setForm((prev) => ({ ...prev, sexo: "F" }))}
                  disabled={enviando}
                >
                  Femenino
                </button>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="dni">DNI / CUIL *</label>
              <input
                type="text"
                id="dni"
                name="dni"
                value={form.dni}
                onChange={handleChange}
                placeholder="Ej: 20-12345678-9 o 12345678"
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="nacimiento">Fecha de nacimiento *</label>
              <input
                type="date"
                id="nacimiento"
                name="nacimiento"
                value={form.nacimiento}
                onChange={handleChange}
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Edad</label>
              <input
                type="text"
                value={edad ? `${edad} años` : ""}
                className={`${styles.input} ${styles.readonly}`}
                readOnly
                disabled
              />
            </div>
          </div>

          {/* DATOS COMPLEMENTARIOS */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Datos complementarios</h2>

            <div className={styles.formGroup}>
              <label htmlFor="lugarNacimiento">Lugar de nacimiento *</label>
              <input
                type="text"
                id="lugarNacimiento"
                name="lugarNacimiento"
                value={form.lugarNacimiento}
                onChange={handleChange}
                placeholder="Ciudad, Provincia, País"
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="domicilio">Domicilio actual *</label>
              <input
                type="text"
                id="domicilio"
                name="domicilio"
                value={form.domicilio}
                onChange={handleChange}
                placeholder="Calle, número, depto"
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="localidad">Localidad actual *</label>
              <input
                type="text"
                id="localidad"
                name="localidad"
                value={form.localidad}
                onChange={handleChange}
                placeholder="Ej: Chajarí"
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="provincia">Provincia del domicilio *</label>
              <input
                type="text"
                id="provincia"
                name="provincia"
                value={form.provincia}
                onChange={handleChange}
                placeholder="Ej: Entre Ríos"
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="telefono">Teléfono de contacto *</label>
              <input
                type="tel"
                id="telefono"
                name="telefono"
                value={form.telefono}
                onChange={handleChange}
                placeholder="Ej: 3456-123456"
                className={styles.input}
                disabled={enviando}
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={enviando}>
            {enviando ? "Enviando solicitud..." : "Enviar solicitud"}
          </button>
        </form>
      </div>
    </div>
  );
}
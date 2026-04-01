"use client";

import { useState } from "react";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

export default function FormularioCirugia() {
  // Estados del formulario
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
        setMensaje({ texto: `El campo ${campo} es obligatorio`, tipo: "error" });
        return;
      }
    }

    // Formatear DNI a xx-xxxxxxxx-x (opcional)
    const dniLimpio = form.dni.replace(/\D/g, "");
    if (dniLimpio.length < 7 || dniLimpio.length > 11) {
      setMensaje({ texto: "DNI/CUIL inválido", tipo: "error" });
      return;
    }

    // Guardar en Firebase
    setEnviando(true);
    try {
      const data = {
        ...form,
        edad: edad,
        fechaSolicitud: Date.now(),
        estado: "pendiente", // o "recibido"
        createdAt: new Date().toISOString(),
      };

      const res = await fetch(`${FIREBASE_URL}/solicitudes-cirugia.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Error al enviar");

      setMensaje({ texto: "Solicitud enviada con éxito. Pronto nos contactaremos.", tipo: "exito" });
      // Limpiar formulario (opcional)
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
    } catch (error) {
      console.error(error);
      setMensaje({ texto: "Hubo un error. Intente nuevamente más tarde.", tipo: "error" });
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

        <form onSubmit={handleSubmit} className={styles.form}>
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
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label>Sexo *</label>
              <div className={styles.sexoGroup}>
                <button
                  type="button"
                  className={`${styles.sexoBtn} ${form.sexo === "M" ? styles.active : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, sexo: "M" }))}
                >
                  Masculino
                </button>
                <button
                  type="button"
                  className={`${styles.sexoBtn} ${form.sexo === "F" ? styles.active : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, sexo: "F" }))}
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
                required
              />
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={enviando}>
            {enviando ? "Enviando..." : "Enviar solicitud"}
          </button>
        </form>
      </div>
    </div>
  );
}
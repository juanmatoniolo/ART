"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";
const WHATSAPP_NUMBER = "5493456441580"; // Ajusta según formato correcto

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const FORM_VACIO = {
  apellido: "",
  nombre: "",
  sexo: "",
  dni: "",
  nacDia: "",
  nacMes: "",
  nacAnio: "",
  lugarNacimiento: "",
  domicilio: "",
  localidad: "",
  provincia: "",
  telefono: "",
  /* 🆕 Familiar responsable */
  familiarNombre: "",
  familiarParentezco: "",
  familiarTelefono: "",
};

/* ---------- helpers de fecha ---------- */
const diasEnMes = (mes, anio) => {
  if (!mes) return 31;
  const m = Number(mes);
  if (!anio) return m === 2 ? 29 : new Date(2000, m, 0).getDate();
  return new Date(Number(anio), m, 0).getDate();
};

const esFechaValida = (dia, mes, anio) => {
  const d = Number(dia), m = Number(mes), a = Number(anio);
  if (!d || !m || !a) return false;
  const f = new Date(a, m - 1, d);
  return f.getFullYear() === a && f.getMonth() === m - 1 && f.getDate() === d;
};

const aISO = (dia, mes, anio) =>
  `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

const aFechaLegible = (dia, mes, anio) =>
  `${String(dia).padStart(2, "0")}/${String(mes).padStart(2, "0")}/${anio}`;

export default function FormularioCirugia() {
  const formRef = useRef(null);

  const [form, setForm] = useState(FORM_VACIO);
  const [edad, setEdad] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState({ texto: "", tipo: "" });
  const [tema, setTema] = useState("claro");

  /* ---------- tema (claro / oscuro) ---------- */
  useEffect(() => {
    let inicial = "claro";
    try {
      const guardado = window.localStorage.getItem("tema");
      const prefiereOscuro = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
      inicial = guardado || (prefiereOscuro ? "oscuro" : "claro");
    } catch {
      /* localStorage bloqueado */
    }
    setTema(inicial);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.tema = tema;
    document.documentElement.style.colorScheme = tema === "oscuro" ? "dark" : "light";
  }, [tema]);

  const alternarTema = () => {
    const nuevo = tema === "oscuro" ? "claro" : "oscuro";
    setTema(nuevo);
    try {
      window.localStorage.setItem("tema", nuevo);
    } catch {
      /* ignorar */
    }
  };

  /* ---------- fecha de nacimiento ---------- */
  const anios = useMemo(() => {
    const actual = new Date().getFullYear();
    return Array.from({ length: 121 }, (_, i) => actual - i);
  }, []);

  const diasDelMes = useMemo(
    () => diasEnMes(form.nacMes, form.nacAnio),
    [form.nacMes, form.nacAnio]
  );

  const fechaNacimiento = useMemo(() => {
    if (!form.nacDia || !form.nacMes || !form.nacAnio) return "";
    return esFechaValida(form.nacDia, form.nacMes, form.nacAnio)
      ? aISO(form.nacDia, form.nacMes, form.nacAnio)
      : "";
  }, [form.nacDia, form.nacMes, form.nacAnio]);

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
    const nuevo = { ...form, [name]: value };

    // Si cambia el mes o el año, y el día elegido ya no existe, lo limpiamos
    if ((name === "nacMes" || name === "nacAnio") && nuevo.nacDia) {
      if (Number(nuevo.nacDia) > diasEnMes(nuevo.nacMes, nuevo.nacAnio)) {
        nuevo.nacDia = "";
      }
    }

    setForm(nuevo);

    if (name === "nacDia" || name === "nacMes" || name === "nacAnio") {
      setEdad(
        esFechaValida(nuevo.nacDia, nuevo.nacMes, nuevo.nacAnio)
          ? calcularEdad(aISO(nuevo.nacDia, nuevo.nacMes, nuevo.nacAnio))
          : ""
      );
    }
  };

  const limpiarFormulario = () => {
    setForm(FORM_VACIO);
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
- Fecha de nacimiento: ${aFechaLegible(form.nacDia, form.nacMes, form.nacAnio)}
- Edad: ${edad} años
--------------------------------
*DATOS COMPLEMENTARIOS*
- Lugar de nacimiento: ${form.lugarNacimiento}
- Domicilio actual: ${form.domicilio}
- Localidad: ${form.localidad}
- Provincia: ${form.provincia}
- Teléfono de contacto: ${form.telefono}
--------------------------------
*FAMILIAR RESPONSABLE*
- Nombre: ${form.familiarNombre || "—"}
- Parentezco: ${form.familiarParentezco || "—"}
- Teléfono: ${form.familiarTelefono || "—"}
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
          <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}>
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

    // Validaciones de campos de texto
    const camposObligatorios = [
      "apellido",
      "nombre",
      "sexo",
      "dni",
      "lugarNacimiento",
      "domicilio",
      "localidad",
      "provincia",
      "telefono",
    ];

    for (const campo of camposObligatorios) {
      if (!form[campo]?.trim()) {
        mostrarMensaje(`El campo ${campo} es obligatorio`, "error");
        document
          .querySelector(`[name="${campo}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
    }

    // Validar fecha de nacimiento
    if (!form.nacDia || !form.nacMes || !form.nacAnio) {
      mostrarMensaje("Completá tu fecha de nacimiento (día, mes y año)", "error");
      document
        .querySelector('[name="nacDia"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!esFechaValida(form.nacDia, form.nacMes, form.nacAnio)) {
      mostrarMensaje("La fecha de nacimiento no es válida", "error");
      return;
    }

    // Validar DNI/CUIL
    const dniLimpio = form.dni.replace(/\D/g, "");
    if (dniLimpio.length < 7 || dniLimpio.length > 11) {
      mostrarMensaje("DNI/CUIL inválido (debe tener entre 7 y 11 dígitos)", "error");
      return;
    }

    // Validar edad coherente
    const edadCalculada = calcularEdad(fechaNacimiento);
    if (edadCalculada === "" || edadCalculada < 0 || edadCalculada > 120) {
      mostrarMensaje("Fecha de nacimiento inválida", "error");
      return;
    }

    setEnviando(true);
    try {
      const { nacDia, nacMes, nacAnio, ...resto } = form;

      const data = {
        ...resto,
        nacimiento: fechaNacimiento,
        edad: edadCalculada,
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
    <div className={styles.container} data-theme={tema}>
      <div className={styles.card}>
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.temaBtn}
            onClick={alternarTema}
            aria-label={tema === "oscuro" ? "Activar modo claro" : "Activar modo oscuro"}
            title={tema === "oscuro" ? "Modo claro" : "Modo oscuro"}
          >
            {tema === "oscuro" ? "☀️" : "🌙"}
          </button>
        </div>

        <h1 className={styles.title}>Solicitud de Cirugía</h1>
        <p className={styles.subtitle}>Complete todos los campos para solicitar su cirugía</p>

        {mensaje.texto && (
          <div className={`${styles.mensaje} ${styles[mensaje.tipo]}`}>{mensaje.texto}</div>
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
                inputMode="numeric"
                disabled={enviando}
                required
              />
            </div>

            {/* FECHA DE NACIMIENTO — 3 selectores (mucho más simple en celular) */}
            <div className={styles.formGroup}>
              <label>Fecha de nacimiento *</label>
              <div className={styles.fechaGroup}>
                <select
                  name="nacDia"
                  value={form.nacDia}
                  onChange={handleChange}
                  className={`${styles.input} ${styles.select}`}
                  disabled={enviando}
                  aria-label="Día de nacimiento"
                >
                  <option value="">Día</option>
                  {Array.from({ length: diasDelMes }, (_, i) => i + 1).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>

                <select
                  name="nacMes"
                  value={form.nacMes}
                  onChange={handleChange}
                  className={`${styles.input} ${styles.select}`}
                  disabled={enviando}
                  aria-label="Mes de nacimiento"
                >
                  <option value="">Mes</option>
                  {MESES.map((m, i) => (
                    <option key={m} value={i + 1}>
                      {m}
                    </option>
                  ))}
                </select>

                <select
                  name="nacAnio"
                  value={form.nacAnio}
                  onChange={handleChange}
                  className={`${styles.input} ${styles.select}`}
                  disabled={enviando}
                  aria-label="Año de nacimiento"
                >
                  <option value="">Año</option>
                  {anios.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {fechaNacimiento && (
                <p className={styles.helper}>
                  📅 {aFechaLegible(form.nacDia, form.nacMes, form.nacAnio)} · {edad} años
                </p>
              )}
            </div>

            <div className={styles.formGroup}>
              <label>Edad</label>
              <input
                type="text"
                value={edad === "" ? "" : `${edad} años`}
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
                inputMode="tel"
                disabled={enviando}
                required
              />
            </div>
          </div>

          {/* 🆕 FAMILIAR RESPONSABLE */}
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Familiar responsable</h2>
            <span className={styles.sectionHint}>
              Datos de algún familiar o persona de confianza para poder comunicarnos en caso de urgencia.
            </span>

            <div className={styles.formGroup}>
              <label htmlFor="familiarNombre">Nombre completo</label>
              <input
                type="text"
                id="familiarNombre"
                name="familiarNombre"
                value={form.familiarNombre}
                onChange={handleChange}
                placeholder="Apellido y nombre del familiar"
                className={styles.input}
                disabled={enviando}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="familiarParentezco">Parentezco</label>
              <input
                type="text"
                id="familiarParentezco"
                name="familiarParentezco"
                value={form.familiarParentezco}
                onChange={handleChange}
                placeholder="Ej: Cónyuge, Hijo/a, Madre, Padre..."
                className={styles.input}
                disabled={enviando}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="familiarTelefono">Teléfono</label>
              <input
                type="tel"
                id="familiarTelefono"
                name="familiarTelefono"
                value={form.familiarTelefono}
                onChange={handleChange}
                placeholder="Ej: 3456 123456"
                className={styles.input}
                inputMode="tel"
                disabled={enviando}
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
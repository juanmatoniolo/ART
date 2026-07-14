"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import styles from "./page.module.css";
import PasoArtes from "./components/PasoArtes";
import PasoPaciente from "./components/PasoPaciente";
import PasoMedico from "./components/PasoMedico";
import AtajosDeMail from "./components/AtajosDeMail";
import PasoDestinatarios from "./components/PasoDestinatarios";
import ResumenEnvio from "./components/ResumenEnvio";
import GestionArts from "./components/GestionArts";
import usePacientes from "./hooks/usePacientes";
import useAcciones from "./hooks/useAcciones";
import useAtajos from "./hooks/useAtajos";
import useArts from "./hooks/useArts";
import { generarAsunto, generarCuerpo, buildGmailUrl } from "./utils/generadores";
import { FIREBASE_URL } from "./utils/firebase";

export default function ARTComunicador() {
  const [tab, setTab] = useState("siniestros");
  const [selectedArts, setSelectedArts] = useState(new Set());
  const [accionesSeleccionadas, setAccionesSeleccionadas] = useState(["evolucion"]);
  const [destinatariosOff, setDestinatariosOff] = useState({});
  const [paciente, setPaciente] = useState(null);
  const [medico, setMedico] = useState("");
  const [atajoActivo, setAtajoActivo] = useState(null);
  const [cuerpoEditado, setCuerpoEditado] = useState("");
  const [copiado, setCopiado] = useState(false);

  // Estados para modales
  const [mostrarGestionArts, setMostrarGestionArts] = useState(false);
  const [mostrarGestionAcciones, setMostrarGestionAcciones] = useState(false);
  const [mostrarFormAtajo, setMostrarFormAtajo] = useState(false);
  const [editActionId, setEditActionId] = useState(null);
  const [formAction, setFormAction] = useState({
    id: "",
    label: "",
    short: "",
    emoji: "",
    adjunto: "",
    codigo: "",
    defaultSelected: false,
    categoria: "practica",
  });
  const [editandoAtajo, setEditandoAtajo] = useState(null);
  const [nuevoAtajoLabel, setNuevoAtajoLabel] = useState("");
  const [nuevoAtajoAsunto, setNuevoAtajoAsunto] = useState("");
  const [nuevoAtajoAcciones, setNuevoAtajoAcciones] = useState(["evolucion"]);
  const [nuevoAtajoCuerpo, setNuevoAtajoCuerpo] = useState("");
  const [guardandoAtajo, setGuardandoAtajo] = useState(false);
  const [errorAtajo, setErrorAtajo] = useState("");

  // Hooks de datos
  const { pacientes, loading: loadingPacientes } = usePacientes();
  const {
    acciones: accionesDisponibles,
    loading: loadingAcciones,
    setAcciones: setAccionesDisponibles,
  } = useAcciones();
  const { atajos, loading: loadingAtajos, recargar: recargarAtajos } = useAtajos();
  const { arts, loading: loadingArts, addArt, updateArt, deleteArt, refetch: refetchArts } = useArts();

  // Sincronizar defaults de acciones al cargar
  useEffect(() => {
    if (accionesDisponibles.length > 0) {
      const defaults = accionesDisponibles
        .filter((a) => a.defaultSelected)
        .map((a) => a.id);
      if (defaults.length > 0) setAccionesSeleccionadas(defaults);
    }
  }, [accionesDisponibles]);

  // Generar asunto y cuerpo
  const asunto = useMemo(
    () =>
      generarAsunto(paciente, tab, accionesSeleccionadas, medico, atajoActivo, accionesDisponibles),
    [paciente, tab, accionesSeleccionadas, medico, atajoActivo, accionesDisponibles]
  );
  const cuerpo = useMemo(
    () =>
      generarCuerpo(paciente, tab, accionesSeleccionadas, medico, atajoActivo, accionesDisponibles),
    [paciente, tab, accionesSeleccionadas, medico, atajoActivo, accionesDisponibles]
  );

  const cuerpoEditadoPorUsuario = useRef(false);
  useEffect(() => {
    if (!cuerpoEditadoPorUsuario.current) setCuerpoEditado(cuerpo);
  }, [cuerpo]);
  useEffect(() => {
    cuerpoEditadoPorUsuario.current = false;
  }, [paciente, accionesSeleccionadas, medico, tab, atajoActivo]);

  // Contactos y destinatarios (ahora desde arts dinámicas)
  const contactos = useMemo(() => {
    if (selectedArts.size === 0 || arts.length === 0) return [];
    const list = [];
    selectedArts.forEach((id) => {
      const art = arts.find((p) => p.id === id);
      if (art) {
        let emails = [];
        if (tab === "siniestros") emails = art.siniestros || [];
        else if (tab === "facturacion") emails = art.facturacion || [];
        else emails = art.convenios || [];
        emails.forEach((c) => list.push({ ...c, artId: id }));
      }
    });
    return list.filter((c, i, arr) => arr.findIndex((x) => x.email === c.email) === i);
  }, [selectedArts, tab, arts]);

  const emailsActivos = useMemo(
    () =>
      contactos.filter((_, i) => destinatariosOff[`${i}`] !== true).map((c) => c.email),
    [contactos, destinatariosOff]
  );

  const gmailUrl = useMemo(() => {
    if (!emailsActivos.length || !asunto || !cuerpoEditado) return "#";
    return buildGmailUrl({ to: emailsActivos.join(","), subject: asunto, body: cuerpoEditado });
  }, [emailsActivos, asunto, cuerpoEditado]);

  const adjuntosRecordatorio = useMemo(() => {
    if (!paciente || tab !== "siniestros") return [];
    return accionesSeleccionadas
      .map((id) => accionesDisponibles.find((a) => a.id === id)?.adjunto)
      .filter(Boolean);
  }, [paciente, tab, accionesSeleccionadas, accionesDisponibles]);

  // Validación de envío
  const canSend = Boolean(
    selectedArts.size > 0 && paciente && emailsActivos.length && asunto && cuerpoEditado
  );
  const faltantes = [];
  if (selectedArts.size === 0) faltantes.push("🏢 Seleccionar al menos una ART");
  if (!paciente) faltantes.push("👤 Seleccionar un paciente");
  if (!emailsActivos.length && selectedArts.size > 0)
    faltantes.push("📧 Activar al menos un destinatario");

  // Handlers de ARTs
  const toggleArt = (id) =>
    setSelectedArts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAllArts = (all) =>
    setSelectedArts(all ? new Set(arts.map((a) => a.id)) : new Set());

  // Handlers de destinatarios
  const toggleDestinatario = (i) =>
    setDestinatariosOff((prev) => ({ ...prev, [`${i}`]: !prev[`${i}`] }));
  const toggleAllDestinatarios = (active) => {
    setDestinatariosOff((prev) => {
      const next = { ...prev };
      contactos.forEach((_, i) => {
        next[`${i}`] = !active;
      });
      return next;
    });
  };

  // Copiar y restaurar cuerpo
  const copiarCuerpo = async () => {
    try {
      await navigator.clipboard.writeText(cuerpoEditado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {}
  };
  const restaurarCuerpo = () => {
    setCuerpoEditado(cuerpo);
    cuerpoEditadoPorUsuario.current = false;
  };

  // Funciones para atajos
  const aplicarAtajo = (atajo) => {
    setAtajoActivo(atajo);
    if (atajo.acciones?.length) {
      setAccionesSeleccionadas(atajo.acciones);
    }
  };
  const desactivarAtajo = () => setAtajoActivo(null);

  // Gestión de acciones (modal)
  const openNewAction = () => {
    setEditActionId(null);
    setFormAction({
      id: "",
      label: "",
      short: "",
      emoji: "📌",
      adjunto: "",
      codigo: "",
      defaultSelected: false,
      categoria: "practica",
    });
    setMostrarGestionAcciones(true);
  };
  const openEditAction = (accion) => {
    setEditActionId(accion.id);
    setFormAction({ ...accion });
    setMostrarGestionAcciones(true);
  };
  const saveAction = async () => {
    if (!formAction.id.trim() || !formAction.label.trim()) {
      alert("ID y nombre son obligatorios");
      return;
    }
    const url = `${FIREBASE_URL}/ART-MAILS/acciones/${formAction.id}.json`;
    try {
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: formAction.label,
          short: formAction.short,
          emoji: formAction.emoji,
          adjunto: formAction.adjunto,
          codigo: formAction.codigo,
          defaultSelected: formAction.defaultSelected,
          categoria: formAction.categoria,
        }),
      });
      const res = await fetch(`${FIREBASE_URL}/ART-MAILS/acciones.json`);
      const data = await res.json();
      if (data) {
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
        setAccionesDisponibles(lista);
      }
      setMostrarGestionAcciones(false);
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
  };
  const deleteAction = async (id) => {
    if (!confirm(`¿Eliminar la práctica "${id}"?`)) return;
    await fetch(`${FIREBASE_URL}/ART-MAILS/acciones/${id}.json`, {
      method: "DELETE",
    });
    const res = await fetch(`${FIREBASE_URL}/ART-MAILS/acciones.json`);
    const data = await res.json();
    if (data) {
      const lista = Object.entries(data).map(([id, val]) => ({ id, ...val }));
      setAccionesDisponibles(lista);
    } else {
      setAccionesDisponibles([]);
    }
  };

  // Gestión de atajos
  const guardarAtajo = async () => {
    setErrorAtajo("");
    if (!nuevoAtajoLabel.trim()) {
      setErrorAtajo("El nombre del atajo es obligatorio");
      return;
    }
    if (!nuevoAtajoAsunto.trim() && !nuevoAtajoCuerpo.trim()) {
      setErrorAtajo("Debés completar al menos el asunto o el cuerpo");
      return;
    }
    setGuardandoAtajo(true);
    
    try {
      const nuevoAtajo = {
        label: nuevoAtajoLabel.trim(),
        asunto: nuevoAtajoAsunto.trim(),
        acciones: nuevoAtajoAcciones,
        cuerpo: nuevoAtajoCuerpo.trim(),
      };
      
      const method = editandoAtajo ? "PUT" : "POST";
      const url = editandoAtajo
        ? `${FIREBASE_URL}/ART-MAILS/atajos/${editandoAtajo.id}.json`
        : `${FIREBASE_URL}/ART-MAILS/atajos.json`;
      
      console.log("📤 Enviando a:", url, "Método:", method);
      
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoAtajo),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        throw new Error("No se pudo guardar el atajo");
      }
      
      let atajoGuardado = null;
      if (!editandoAtajo) {
        const data = await response.json();
        atajoGuardado = { id: data.name, ...nuevoAtajo };
        console.log("✅ Atajo creado:", atajoGuardado);
      } else {
        atajoGuardado = { id: editandoAtajo.id, ...nuevoAtajo };
        console.log("✅ Atajo actualizado:", atajoGuardado);
      }
      
      setNuevoAtajoLabel("");
      setNuevoAtajoAsunto("");
      setNuevoAtajoAcciones(["evolucion"]);
      setNuevoAtajoCuerpo("");
      setMostrarFormAtajo(false);
      setEditandoAtajo(null);
      
      if (!atajoActivo) {
        aplicarAtajo(atajoGuardado);
      }
      
      await recargarAtajos();
      
    } catch (err) {
      console.error("❌ Error completo:", err);
      setErrorAtajo("Error al guardar el atajo: " + err.message);
    } finally {
      setGuardandoAtajo(false);
    }
  };

  const eliminarAtajo = async (id) => {
    if (!confirm("¿Eliminar atajo?")) return;
    await fetch(`${FIREBASE_URL}/ART-MAILS/atajos/${id}.json`, {
      method: "DELETE",
    });
    if (atajoActivo?.id === id) setAtajoActivo(null);
    recargarAtajos();
  };

  return (
    <main className={styles.page}>
      <header className={styles.topBar}>
        <div className={styles.topLeft}>
          <div className={styles.topIcon}>📧</div>
          <div>
            <h1 className={styles.topTitle}>Comunicador ART</h1>
            <p className={styles.topSub}>Generá mails profesionales en segundos</p>
          </div>
        </div>
        <section className={styles.modeTabs}>
          <button
            className={`${styles.modeTab} ${tab === "siniestros" ? styles.modeTabOn : ""}`}
            onClick={() => setTab("siniestros")}
          >
            📋 Siniestros
          </button>
          <button
            className={`${styles.modeTab} ${tab === "facturacion" ? styles.modeTabOn : ""}`}
            onClick={() => setTab("facturacion")}
          >
            💰 Facturación
          </button>
          <button
            className={`${styles.modeTab} ${tab === "convenios" ? styles.modeTabOn : ""}`}
            onClick={() => setTab("convenios")}
          >
            📄 Convenios
          </button>
          <button
            className={styles.tinyBtn}
            onClick={() => setMostrarGestionAcciones(true)}
            title="Gestionar prácticas y prestaciones"
          >
            ⚙️
          </button>
        </section>
      </header>

      <div className={styles.mainContainer}>
        
        {/* ARTS */}
        <PasoArtes
          arts={arts}
          selectedArts={selectedArts}
          toggleArt={toggleArt}
          toggleAllArts={toggleAllArts}
          onManageArts={() => setMostrarGestionArts(true)}
        />
        
        {/* ATAJOS DE MAIL */}
        <AtajosDeMail
          atajos={atajos}
          loading={loadingAtajos}
          atajoActivo={atajoActivo}
          aplicarAtajo={aplicarAtajo}
          desactivarAtajo={desactivarAtajo}
          setMostrarFormAtajo={setMostrarFormAtajo}
          setEditandoAtajo={setEditandoAtajo}
          setNuevoAtajoLabel={setNuevoAtajoLabel}
          setNuevoAtajoAsunto={setNuevoAtajoAsunto}
          setNuevoAtajoAcciones={setNuevoAtajoAcciones}
          setNuevoAtajoCuerpo={setNuevoAtajoCuerpo}
          eliminarAtajo={eliminarAtajo}
        />

        {/* Paciente + Médico */}
        <div className={styles.pacienteMedicoRow}>
          <PasoPaciente
            pacientes={pacientes}
            loading={loadingPacientes}
            paciente={paciente}
            setPaciente={setPaciente}
          />
          <PasoMedico medico={medico} setMedico={setMedico} />
        </div>

        {/* ASUNTO GENERADO */}
        <div className={styles.block}>
          <div className={styles.blockTop}>
            <p className={styles.blockLabel}>📝 Asunto generado</p>
            {atajoActivo && <span className={styles.badge}>⚡ {atajoActivo.label}</span>}
          </div>
          <input className={`${styles.inp} ${styles.inpReadonly}`} value={asunto} readOnly />
        </div>

        {/* CUERPO DEL MAIL */}
        <div className={styles.block}>
          <div className={styles.blockTop}>
            <p className={styles.blockLabel}>📄 Cuerpo del mail</p>
            <div className={styles.toggleRow}>
              <button className={styles.tinyBtn} onClick={copiarCuerpo} disabled={!cuerpoEditado}>
                {copiado ? "✓ Copiado" : "📋 Copiar"}
              </button>
              <button className={styles.tinyBtn} onClick={restaurarCuerpo} disabled={!cuerpo}>
                ↩ Restaurar
              </button>
            </div>
          </div>
          <textarea
            className={styles.area}
            value={cuerpoEditado}
            onChange={(e) => {
              setCuerpoEditado(e.target.value);
              cuerpoEditadoPorUsuario.current = true;
            }}
          />
        </div>

        {/* DESTINATARIOS */}
        <PasoDestinatarios
          selectedArts={selectedArts}
          tab={tab}
          destinatariosOff={destinatariosOff}
          toggleDestinatario={toggleDestinatario}
          toggleAllDestinatarios={toggleAllDestinatarios}
        />

        {/* RESUMEN Y BOTÓN DE ENVÍO */}
        <ResumenEnvio
          canSend={canSend}
          gmailUrl={gmailUrl}
          faltantes={faltantes}
          adjuntosRecordatorio={adjuntosRecordatorio}
          asunto={asunto}
          emailsActivos={emailsActivos}
          paciente={paciente}
        />
      </div>

      {/* MODAL GESTIONAR ARTs */}
      {mostrarGestionArts && (
        <GestionArts
          arts={arts}
          onAdd={addArt}
          onUpdate={updateArt}
          onDelete={deleteArt}
          onClose={() => setMostrarGestionArts(false)}
        />
      )}

      {/* MODAL GESTIONAR PRÁCTICAS */}
      {mostrarGestionAcciones && (
        <div className={styles.formAtajoOverlay} onClick={() => setMostrarGestionAcciones(false)}>
          <div className={styles.formAtajo} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.formAtajoTitle}>
              {editActionId ? "✏️ Editar práctica" : "➕ Nueva práctica"}
            </h3>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>ID (código interno) *</label>
              <input
                className={styles.inp}
                value={formAction.id}
                onChange={(e) => setFormAction({ ...formAction, id: e.target.value })}
                disabled={!!editActionId}
                placeholder="ej: evolucion"
              />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Nombre *</label>
              <input
                className={styles.inp}
                value={formAction.label}
                onChange={(e) => setFormAction({ ...formAction, label: e.target.value })}
                placeholder="ej: Evolución"
              />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Texto corto (para asunto)</label>
              <input
                className={styles.inp}
                value={formAction.short}
                onChange={(e) => setFormAction({ ...formAction, short: e.target.value })}
                placeholder="ej: EVOLUCIÓN"
              />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Categoría</label>
              <select
                className={styles.inp}
                value={formAction.categoria}
                onChange={(e) => setFormAction({ ...formAction, categoria: e.target.value })}
              >
                <option value="consulta">📋 Consultas</option>
                <option value="practica">🏥 Prácticas</option>
                <option value="estudio">🔬 Estudios</option>
                <option value="sesion">🏃 Sesiones</option>
              </select>
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Código (usa {"{medico}"} si es necesario)</label>
              <textarea
                className={styles.area}
                rows={2}
                value={formAction.codigo}
                onChange={(e) => setFormAction({ ...formAction, codigo: e.target.value })}
                placeholder="/COD.: ..."
              />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Emoji</label>
              <input
                className={styles.inp}
                value={formAction.emoji}
                onChange={(e) => setFormAction({ ...formAction, emoji: e.target.value })}
                placeholder="📋"
              />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Adjunto recordatorio</label>
              <input
                className={styles.inp}
                value={formAction.adjunto}
                onChange={(e) => setFormAction({ ...formAction, adjunto: e.target.value })}
                placeholder="ej: Evolución del paciente"
              />
            </div>
            <label className={styles.recipientRow} style={{ marginTop: 8, cursor: "pointer" }}>
              <input
                type="checkbox"
                className={styles.chk}
                checked={formAction.defaultSelected}
                onChange={(e) => setFormAction({ ...formAction, defaultSelected: e.target.checked })}
              />
              <span>Seleccionada por defecto</span>
            </label>
            <div className={styles.formAtajoBtns}>
              <button className={styles.formBtnSave} onClick={saveAction}>
                💾 Guardar
              </button>
              <button className={styles.formBtnCancel} onClick={() => setMostrarGestionAcciones(false)}>
                Cancelar
              </button>
              {editActionId && (
                <button
                  className={styles.formBtnDelete}
                  onClick={() => {
                    deleteAction(editActionId);
                    setMostrarGestionAcciones(false);
                  }}
                >
                  🗑 Eliminar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR/EDITAR ATAJO */}
      {mostrarFormAtajo && (
        <div
          className={styles.formAtajoOverlay}
          onClick={() => {
            setMostrarFormAtajo(false);
            setEditandoAtajo(null);
            setErrorAtajo("");
          }}
        >
          <div className={styles.formAtajo} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.formAtajoTitle}>
              {editandoAtajo ? "✏️ Editar atajo" : "➕ Nuevo atajo"}
            </h3>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Nombre del atajo *</label>
              <input
                type="text"
                className={styles.inp}
                placeholder="Ej: Pedido de RMN urgente"
                value={nuevoAtajoLabel}
                onChange={(e) => setNuevoAtajoLabel(e.target.value)}
                autoFocus
              />
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Asunto del mail</label>
              <input
                type="text"
                className={styles.inp}
                placeholder="Ej: SOLICITUD RMN - {nombre} - DNI {dni}"
                value={nuevoAtajoAsunto}
                onChange={(e) => setNuevoAtajoAsunto(e.target.value)}
              />
              <p className={styles.formAtajoHint}>
                Variables: {"{nombre}"}, {"{dni}"}, {"{stro}"}, {"{art}"}, {"{medico}"}
              </p>
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Acciones incluidas</label>
              <div className={styles.chips}>
                {accionesDisponibles.map((accion) => (
                  <button
                    key={accion.id}
                    type="button"
                    className={`${styles.chip} ${
                      nuevoAtajoAcciones.includes(accion.id) ? styles.chipOn : ""
                    }`}
                    onClick={() =>
                      setNuevoAtajoAcciones((prev) =>
                        prev.includes(accion.id)
                          ? prev.filter((a) => a !== accion.id)
                          : [...prev, accion.id]
                      )
                    }
                  >
                    {accion.emoji} {accion.label}
                  </button>
                ))}
              </div>
              <p className={styles.formAtajoHint}>
                Estas acciones se seleccionan automáticamente al aplicar el atajo.
              </p>
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Cuerpo del mail</label>
              <textarea
                className={styles.area}
                rows={8}
                placeholder="Buen día,..."
                value={nuevoAtajoCuerpo}
                onChange={(e) => setNuevoAtajoCuerpo(e.target.value)}
              />
              <p className={styles.formAtajoHint}>
                Variables: {"{nombre}"}, {"{dni}"}, {"{stro}"}, {"{art}"}, {"{medico}"},{" "}
                {"{firma}"}
              </p>
            </div>
            {errorAtajo && <p className={styles.errorMsg}>{errorAtajo}</p>}
            <div className={styles.formAtajoBtns}>
              <button
                type="button"
                className={styles.formBtnSave}
                onClick={guardarAtajo}
                disabled={guardandoAtajo}
              >
                {guardandoAtajo ? "Guardando..." : "✅ Guardar atajo"}
              </button>
              <button
                type="button"
                className={styles.formBtnCancel}
                onClick={() => {
                  setMostrarFormAtajo(false);
                  setEditandoAtajo(null);
                  setErrorAtajo("");
                }}
                disabled={guardandoAtajo}
              >
                ❌ Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
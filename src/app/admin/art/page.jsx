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
import useAtajos from "./hooks/useAtajos";
import useArts from "./hooks/useArts";
import { generarAsunto, generarCuerpo, buildGmailUrl } from "./utils/generadores";
import { FIREBASE_URL } from "./utils/firebase";

export default function ARTComunicador() {
  const [tab, setTab] = useState("siniestros");
  const [selectedArts, setSelectedArts] = useState(new Set());
  const [destinatariosOff, setDestinatariosOff] = useState({});
  const [paciente, setPaciente] = useState(null);
  const [medico, setMedico] = useState("");
  const [atajosActivos, setAtajosActivos] = useState([]);
  const [cuerpoEditado, setCuerpoEditado] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [mostrarGestionArts, setMostrarGestionArts] = useState(false);
  const [mostrarFormAtajo, setMostrarFormAtajo] = useState(false);
  const [editandoAtajo, setEditandoAtajo] = useState(null);
  const [nuevoAtajoLabel, setNuevoAtajoLabel] = useState("");
  const [nuevoAtajoAdjunto, setNuevoAtajoAdjunto] = useState("");
  const [nuevoAtajoSolicitud, setNuevoAtajoSolicitud] = useState("");
  const [guardandoAtajo, setGuardandoAtajo] = useState(false);
  const [errorAtajo, setErrorAtajo] = useState("");

  const { pacientes, loading: loadingPacientes } = usePacientes();
  const { atajos, loading: loadingAtajos, recargar: recargarAtajos } = useAtajos();
  const { arts, loading: loadingArts, error: artsError, addArt, updateArt, deleteArt, refetch: refetchArts } = useArts();

  const filteredArts = useMemo(() => {
    return arts.filter(art => {
      let contacts;
      if (tab === "siniestros") {
        contacts = art.siniestros;
      } else if (tab === "facturacion") {
        contacts = art.facturacion;
      } else {
        contacts = art.convenios;
      }
      if (!contacts) return false;
      const list = Array.isArray(contacts) ? contacts : Object.values(contacts);
      return list.some(c => c && c.email);
    });
  }, [arts, tab]);

  if (artsError) {
    return (
      <main className={styles.page}>
        <div className={styles.errorContainer}>
          <h2>⚠️ Error al cargar ARTs</h2>
          <p>{artsError}</p>
          <p style={{ fontSize: "14px", color: "#6b7280", marginTop: "8px" }}>
            Verifica que la URL de Firebase sea correcta y que tengas conexión a internet.
          </p>
          <button onClick={refetchArts} className={styles.retryBtn}>
            🔄 Reintentar
          </button>
        </div>
      </main>
    );
  }

  const limpiarTodo = () => {
    setTab("siniestros");
    setSelectedArts(new Set());
    setDestinatariosOff({});
    setPaciente(null);
    setMedico("");
    setAtajosActivos([]);
    cuerpoEditadoPorUsuario.current = false;
    setCuerpoEditado("");
    setCopiado(false);
    setResetKey((prev) => prev + 1);
  };

  const cuerpoEditadoPorUsuario = useRef(false);

  const asunto = useMemo(
    () => generarAsunto(paciente, tab, atajosActivos),
    [paciente, tab, atajosActivos]
  );
  const cuerpo = useMemo(
    () => generarCuerpo(paciente, tab, atajosActivos, medico),
    [paciente, tab, atajosActivos, medico]
  );

  useEffect(() => {
    if (!cuerpoEditadoPorUsuario.current) setCuerpoEditado(cuerpo);
  }, [cuerpo]);
  useEffect(() => {
    cuerpoEditadoPorUsuario.current = false;
  }, [paciente, medico, tab, atajosActivos]);

  const contactos = useMemo(() => {
    if (selectedArts.size === 0 || arts.length === 0) return [];
    const list = [];
    selectedArts.forEach((id) => {
      const art = arts.find((p) => p.id === id);
      if (art) {
        if (tab === "siniestros") {
          let siniestros = art.siniestros;
          if (typeof siniestros === "object" && !Array.isArray(siniestros)) {
            siniestros = Object.values(siniestros);
          }
          const contactosArray = Array.isArray(siniestros) ? siniestros : [];
          contactosArray.forEach((c) => {
            if (c && c.email) list.push({ ...c, artId: id });
          });
        } else if (tab === "facturacion") {
          let facturacion = art.facturacion;
          if (typeof facturacion === "object" && !Array.isArray(facturacion)) {
            facturacion = Object.values(facturacion);
          }
          const contactosArray = Array.isArray(facturacion) ? facturacion : [];
          contactosArray.forEach((c) => {
            if (c && c.email) list.push({ ...c, artId: id });
          });
        } else {
          let convenios = art.convenios;
          if (typeof convenios === "object" && !Array.isArray(convenios)) {
            convenios = Object.values(convenios);
          }
          const contactosArray = Array.isArray(convenios) ? convenios : [];
          contactosArray.forEach((c) => {
            if (c && c.email) list.push({ ...c, artId: id });
          });
        }
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

  const canSend = useMemo(() => {
    if (selectedArts.size === 0) return false;
    if (emailsActivos.length === 0) return false;
    if (tab === "facturacion" || tab === "convenios") {
      return true;
    }
    return paciente && asunto && cuerpoEditado;
  }, [selectedArts, emailsActivos, tab, paciente, asunto, cuerpoEditado]);

  const faltantes = useMemo(() => {
    const f = [];
    if (selectedArts.size === 0) f.push("🏢 Seleccionar al menos una ART");
    if (emailsActivos.length === 0 && selectedArts.size > 0) f.push("📧 Activar al menos un destinatario");
    if (tab === "siniestros") {
      if (!paciente) f.push("👤 Seleccionar un paciente");
    }
    return f;
  }, [selectedArts, emailsActivos, tab, paciente]);

  const toggleArt = (id) =>
    setSelectedArts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAllArts = (all) =>
    setSelectedArts(all ? new Set(filteredArts.map((a) => a.id)) : new Set());

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

  const copiarCuerpo = async () => {
    try {
      await navigator.clipboard.writeText(cuerpoEditado);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch { }
  };
  const restaurarCuerpo = () => {
    setCuerpoEditado(cuerpo);
    cuerpoEditadoPorUsuario.current = false;
  };

  const aplicarAtajo = (atajo) => {
    setAtajosActivos((prev) =>
      prev.some((a) => a.id === atajo.id) ? prev : [...prev, atajo]
    );
  };
  const quitarAtajo = (atajoId) => {
    setAtajosActivos((prev) => prev.filter((a) => a.id !== atajoId));
  };
  const desactivarAtajo = () => setAtajosActivos([]);

  const guardarAtajo = async () => {
    setErrorAtajo("");
    if (!nuevoAtajoLabel.trim()) {
      setErrorAtajo("El nombre del atajo es obligatorio");
      return;
    }
    if (!nuevoAtajoAdjunto.trim() && !nuevoAtajoSolicitud.trim()) {
      setErrorAtajo("Completá al menos Adjunto o Solicito");
      return;
    }
    setGuardandoAtajo(true);

    try {
      const nuevoAtajo = {
        label: nuevoAtajoLabel.trim(),
        adjunto: nuevoAtajoAdjunto.trim(),
        solicitud: nuevoAtajoSolicitud.trim(),
      };

      const method = editandoAtajo ? "PUT" : "POST";
      const url = editandoAtajo
        ? `${FIREBASE_URL}/ART-MAILS/atajos/${editandoAtajo.id}.json`
        : `${FIREBASE_URL}/ART-MAILS/atajos.json`;

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
      } else {
        atajoGuardado = { id: editandoAtajo.id, ...nuevoAtajo };
        setAtajosActivos((prev) =>
          prev.map((a) => (a.id === atajoGuardado.id ? atajoGuardado : a))
        );
      }

      setNuevoAtajoLabel("");
      setNuevoAtajoAdjunto("");
      setNuevoAtajoSolicitud("");
      setMostrarFormAtajo(false);
      setEditandoAtajo(null);

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
    setAtajosActivos((prev) => prev.filter((a) => a.id !== id));
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
            onClick={() => setMostrarFormAtajo(true)}
            title="Gestionar atajos"
          >
            ⚙️
          </button>
        </section>
      </header>

      <div className={styles.pageLayout}>
        <div className={styles.mainContent}>
          <PasoArtes
            arts={filteredArts}
            loading={loadingArts}
            selectedArts={selectedArts}
            toggleArt={toggleArt}
            toggleAllArts={toggleAllArts}
            onManageArts={() => setMostrarGestionArts(true)}
          />

          {tab === "siniestros" && (
            <>
              <div className={styles.pacienteMedicoRow}>
                <PasoPaciente
                  key={`paciente-${resetKey}`}
                  pacientes={pacientes}
                  loading={loadingPacientes}
                  paciente={paciente}
                  setPaciente={setPaciente}
                />
                <PasoMedico
                  key={`medico-${resetKey}`}
                  medico={medico}
                  setMedico={setMedico}
                />
              </div>
              <AtajosDeMail
                atajos={atajos}
                loading={loadingAtajos}
                atajosActivos={atajosActivos}
                aplicarAtajo={aplicarAtajo}
                quitarAtajo={quitarAtajo}
                desactivarAtajo={desactivarAtajo}
                setMostrarFormAtajo={setMostrarFormAtajo}
                setEditandoAtajo={setEditandoAtajo}
                setNuevoAtajoLabel={setNuevoAtajoLabel}
                setNuevoAtajoAdjunto={setNuevoAtajoAdjunto}
                setNuevoAtajoSolicitud={setNuevoAtajoSolicitud}
                eliminarAtajo={eliminarAtajo}
              />
            </>
          )}

          <div className={styles.block}>
            <div className={styles.blockTop}>
              <p className={styles.blockLabel}>📝 Asunto generado</p>
              {atajosActivos.length > 0 && tab === "siniestros" && (
                <div className={styles.blockBadges}>
                  {atajosActivos.map((a) => (
                    <span key={a.id} className={styles.badge}>⚡ {a.label}</span>
                  ))}
                </div>
              )}
            </div>
            <input className={`${styles.inp} ${styles.inpReadonly}`} value={asunto} readOnly />
          </div>

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

          <PasoDestinatarios
            contactos={contactos}
            destinatariosOff={destinatariosOff}
            toggleDestinatario={toggleDestinatario}
            toggleAllDestinatarios={toggleAllDestinatarios}
          />
        </div>

        <aside className={styles.sidebar}>
          <button
            className={styles.clearSidebarBtn}
            onClick={limpiarTodo}
            title="Restablecer todos los campos a su estado inicial"
          >
            🧹 Limpiar todo
          </button>

          <ResumenEnvio
            canSend={canSend}
            gmailUrl={gmailUrl}
            faltantes={faltantes}
            asunto={asunto}
            emailsActivos={emailsActivos}
            paciente={paciente}
          />
        </aside>
      </div>

      {mostrarGestionArts && (
        <GestionArts
          arts={arts}
          onAdd={addArt}
          onUpdate={updateArt}
          onDelete={deleteArt}
          onClose={() => setMostrarGestionArts(false)}
          onSaved={() => refetchArts()}
        />
      )}

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
                placeholder="Ej: RMN"
                value={nuevoAtajoLabel}
                onChange={(e) => setNuevoAtajoLabel(e.target.value)}
                autoFocus
              />
              <p className={styles.formAtajoHint}>
                Se muestra en el asunto: "SE ENVIA ... + {nuevoAtajoLabel.toUpperCase() || "NOMBRE"} ..."
              </p>
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Adjunto:</label>
              <input
                type="text"
                className={styles.inp}
                placeholder="Ej: Pedido de RMN"
                value={nuevoAtajoAdjunto}
                onChange={(e) => setNuevoAtajoAdjunto(e.target.value)}
              />
              <p className={styles.formAtajoHint}>Se suma a la línea "Adjunto:" del mail.</p>
            </div>
            <div className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>Solicito:</label>
              <textarea
                className={styles.area}
                rows={2}
                placeholder="Ej: /COD.: AUTORIZACION RMN SIN CONTRASTE"
                value={nuevoAtajoSolicitud}
                onChange={(e) => setNuevoAtajoSolicitud(e.target.value)}
              />
              <p className={styles.formAtajoHint}>
                Se suma como línea a "Solicito autorización...". Podés usar {"{medico}"}.
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
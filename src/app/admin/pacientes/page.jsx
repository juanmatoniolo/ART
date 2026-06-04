"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

export default function PacientesPage() {
  const router = useRouter();
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("activo");
  const [filtroArt, setFiltroArt] = useState("todas");
  const [activeView, setActiveView] = useState("listado");
  const [printingId, setPrintingId] = useState(null);

  const fetchPacientes = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${FIREBASE_URL}/pacientes.json`);
      if (!res.ok) throw new Error("Error al cargar pacientes");

      const data = await res.json();

      if (data) {
        const arr = Object.entries(data).map(([id, value]) => ({ id, ...value }));
        arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        setPacientes(arr);
      } else {
        setPacientes([]);
      }
    } catch {
      setError("No se pudieron cargar los pacientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPacientes();
  }, []);

  const artOptions = useMemo(() => {
    const uniqueArts = Array.from(
      new Set(
        pacientes
          .map((p) => p.ART?.nombre?.trim())
          .filter(Boolean)
      )
    );

    return uniqueArts.sort((a, b) => a.localeCompare(b, "es"));
  }, [pacientes]);

  const filteredPacientes = useMemo(() => {
    return pacientes.filter((p) => {
      const fullName = `${p.trabajador?.apellido || ""} ${p.trabajador?.nombre || ""}`.toLowerCase();
      const dni = p.trabajador?.dni || "";
      const artNombre = p.ART?.nombre || "";
      const matchSearch =
        fullName.includes(searchTerm.toLowerCase()) || dni.includes(searchTerm);

      const matchEstado =
        filtroEstado === "todos" || (p.estado || "activo") === filtroEstado;

      const matchArt =
        filtroArt === "todas" || artNombre === filtroArt;

      return matchSearch && matchEstado && matchArt;
    });
  }, [pacientes, searchTerm, filtroEstado, filtroArt]);

  const stats = useMemo(() => {
    const total = pacientes.length;
    const activos = pacientes.filter((p) => (p.estado || "activo") === "activo").length;
    const cerrados = pacientes.filter((p) => (p.estado || "activo") === "cerrado").length;

    const edades = pacientes
      .map((p) => Number(p.trabajador?.edad))
      .filter((edad) => Number.isFinite(edad) && edad > 0);

    const promedioEdad = edades.length
      ? (edades.reduce((acc, n) => acc + n, 0) / edades.length).toFixed(1)
      : "—";

    const sexos = pacientes.reduce(
      (acc, p) => {
        const sexo = p.trabajador?.sexo;
        if (sexo === "M") acc.m += 1;
        if (sexo === "F") acc.f += 1;
        return acc;
      },
      { m: 0, f: 0 }
    );

    const motivos = pacientes.reduce(
      (acc, p) => {
        const tipo = p.consulta?.tipo || "Sin dato";
        acc[tipo] = (acc[tipo] || 0) + 1;
        return acc;
      },
      {}
    );

    const porArt = pacientes.reduce((acc, p) => {
      const art = p.ART?.nombre?.trim() || "Sin ART";
      const estado = p.estado || "activo";
      const edad = Number(p.trabajador?.edad);

      if (!acc[art]) {
        acc[art] = {
          art,
          total: 0,
          activos: 0,
          cerrados: 0,
          edades: [],
        };
      }

      acc[art].total += 1;
      if (estado === "cerrado") acc[art].cerrados += 1;
      else acc[art].activos += 1;

      if (Number.isFinite(edad) && edad > 0) {
        acc[art].edades.push(edad);
      }

      return acc;
    }, {});

    const porArtArray = Object.values(porArt)
      .map((item) => ({
        ...item,
        promedioEdad: item.edades.length
          ? (item.edades.reduce((acc, n) => acc + n, 0) / item.edades.length).toFixed(1)
          : "—",
      }))
      .sort((a, b) => b.total - a.total || a.art.localeCompare(b.art, "es"));

    const ingresosPorMes = pacientes.reduce((acc, p) => {
      const fi = p.fechaIngreso || {};
      if (fi.anio && fi.mes) {
        const key = `${fi.anio}-${String(fi.mes).padStart(2, "0")}`;
        acc[key] = (acc[key] || 0) + 1;
      }
      return acc;
    }, {});

    const ingresosPorMesArray = Object.entries(ingresosPorMes)
      .map(([mes, cantidad]) => ({ mes, cantidad }))
      .sort((a, b) => b.mes.localeCompare(a.mes));

    return {
      total,
      activos,
      cerrados,
      promedioEdad,
      sexos,
      motivos,
      porArtArray,
      ingresosPorMesArray,
    };
  }, [pacientes]);

  const handleDelete = async (id) => {
    if (!confirm("¿Estás seguro de eliminar este paciente?")) return;

    try {
      await fetch(`${FIREBASE_URL}/pacientes/${id}.json`, { method: "DELETE" });
      await fetchPacientes();
    } catch {
      alert("Error al eliminar.");
    }
  };

  const getPrestadorDefault = (paciente) =>
    paciente.prestador || {
      nombre: "CLINICA DE LA UNION S.A",
      cuit: "30-70754530-1",
      calle: "Av. Siburu",
      nro: "1085",
      piso: "-",
      depto: "-",
      localidad: "Chajari",
      provincia: "Entre Rios",
      cp: "3228",
      celular: "3456-441580",
      mail: "clinicadelaunionart@gmail.com",
    };

  const buildPayloadByType = (paciente, type) => {
    const basePayload = {
      ...paciente,
      prestador: getPrestadorDefault(paciente),
    };

    if (type === "evolucion") {
      return {
        ...basePayload,
        fechaIngreso: {
          ...basePayload.fechaIngreso,
          dia: "",
          mes: "",
          anio: "",
        },
      };
    }

    return basePayload;
  };

  const buildFileNameByType = (payload, type) => {
    const apellido = payload.trabajador?.apellido || "SIN_APELLIDO";
    const dni = payload.trabajador?.dni?.replace(/\D/g, "") || "SIN_DNI";
    const nroSiniestro = payload.ART?.nroSiniestro || "SINIESTRO";

    return type === "evolucion"
      ? `EVOLUCION_${apellido}_${dni}_${nroSiniestro}.pdf`
      : `ART_${apellido}_${dni}_${nroSiniestro}.pdf`;
  };

  const handlePrint = async (paciente, type = "art") => {
    const printWindow = window.open("", "_blank");

    if (!printWindow) {
      alert("El navegador bloqueó la ventana de impresión.");
      return;
    }

    printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>Cargando impresión...</title>
          <style>
            html, body {
              margin: 0;
              height: 100%;
              display: grid;
              place-items: center;
              font-family: Arial, sans-serif;
              background: #f3f4f6;
            }
            .loader {
              text-align: center;
              color: #111827;
            }
          </style>
        </head>
        <body>
          <div class="loader">Generando vista de impresión...</div>
        </body>
      </html>
    `);
    printWindow.document.close();

    setPrintingId(`${paciente.id}-${type}`);

    try {
      const payload = buildPayloadByType(paciente, type);
      const fileName = buildFileNameByType(payload, type);

      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload,
          fileName,
          templateName: type === "evolucion" ? "EVOLUCION.pdf" : "ART-COMPLETOS.pdf",
          pdfType: type,
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error al generar PDF: ${res.status} ${errorText}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      printWindow.location.href = url;

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 60000);
    } catch (err) {
      console.error(err);

      printWindow.document.open();
      printWindow.document.write(`
        <!doctype html>
        <html lang="es">
          <head>
            <meta charset="utf-8" />
            <title>Error</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                padding: 24px;
                color: #111827;
              }
            </style>
          </head>
          <body>
            <h2>No se pudo generar la vista de impresión</h2>
            <pre>${String(err.message || err)}</pre>
          </body>
        </html>
      `);
      printWindow.document.close();
    } finally {
      setPrintingId(null);
    }
  };

  const handleWhatsAppClick = (paciente) => {
    const t = paciente.trabajador || {};
    const fullName = `${t.apellido || ""} ${t.nombre || ""}`.trim();
    const phone = t.telefono || "";
    const params = new URLSearchParams();

    if (phone) params.set("phone", phone);
    if (fullName) params.set("name", fullName);
    if (paciente.id) params.set("pacienteId", paciente.id);

    router.push(`/admin/comunicador?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <span>Cargando pacientes...</span>
      </div>
    );
  }

  if (error) return <div className={styles.errorScreen}>{error}</div>;

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>Pacientes</h1>
          <div className={styles.statsRow}>
            <span className={styles.statBadge} data-type="activo">{stats.activos} activos</span>
            <span className={styles.statBadge} data-type="cerrado">{stats.cerrados} cerrados</span>
            <span className={styles.statBadge} data-type="total">{stats.total} total</span>
          </div>
        </div>

        <button
          className={styles.newBtn}
          onClick={() => router.push("/admin/pacientes/nuevo")}
        >
          <span>+</span> Nuevo Paciente
        </button>
      </div>

      <div className={styles.viewTabs}>
        <button
          className={`${styles.viewTab} ${activeView === "listado" ? styles.viewTabActive : ""}`}
          onClick={() => setActiveView("listado")}
        >
          📋 Listado
        </button>
        <button
          className={`${styles.viewTab} ${activeView === "estadisticas" ? styles.viewTabActive : ""}`}
          onClick={() => setActiveView("estadisticas")}
        >
          📊 Estadísticas
        </button>
      </div>

      {activeView === "listado" ? (
        <>
          <div className={styles.filterBar}>
            <div className={styles.filterGroup}>
              <div className={styles.tabGroup}>
                {["activo", "cerrado", "todos"].map((estado) => (
                  <button
                    key={estado}
                    className={`${styles.tab} ${filtroEstado === estado ? styles.tabActive : ""}`}
                    onClick={() => setFiltroEstado(estado)}
                  >
                    {estado.charAt(0).toUpperCase() + estado.slice(1)}
                  </button>
                ))}
              </div>

              <select
                value={filtroArt}
                onChange={(e) => setFiltroArt(e.target.value)}
                className={styles.selectInput}
              >
                <option value="todas">Todas las ART</option>
                {artOptions.map((art) => (
                  <option key={art} value={art}>
                    {art}
                  </option>
                ))}
              </select>
            </div>

            <input
              type="text"
              placeholder="Buscar por nombre o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          {filteredPacientes.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔍</div>
              <p>No se encontraron pacientes con esos filtros.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Paciente</th>
                    <th>DNI</th>
                    <th>Edad</th>
                    <th>ART</th>
                    <th>N° Siniestro</th>
                    <th>Ingreso</th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPacientes.map((paciente) => {
                    const t = paciente.trabajador || {};
                    const art = paciente.ART || {};
                    const fi = paciente.fechaIngreso || {};
                    const estado = paciente.estado || "activo";

                    return (
                      <tr
                        key={paciente.id}
                        className={estado === "cerrado" ? styles.rowCerrado : ""}
                      >
                        <td className={styles.cellName}>
                          {t.apellido} {t.nombre}
                        </td>
                        <td>{t.dni || "—"}</td>
                        <td>{t.edad ? `${t.edad}` : "—"}</td>
                        <td><span className={styles.artTag}>{art.nombre || "—"}</span></td>
                        <td className={styles.mono}>{art.nroSiniestro || "—"}</td>
                        <td className={styles.mono}>
                          {fi.dia && fi.mes && fi.anio ? `${fi.dia}/${fi.mes}/${fi.anio}` : "—"}
                        </td>

                        <td className={styles.actionsCell}>
                          <button
                            className={styles.iconBtn}
                            title="Editar"
                            onClick={() => router.push(`/admin/pacientes/editar/${paciente.id}`)}
                          >
                            ✏️
                          </button>

                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                            title="Eliminar"
                            onClick={() => handleDelete(paciente.id)}
                          >
                            🗑️
                          </button>

                          {t.telefono && (
                            <button
                              className={`${styles.iconBtn} ${styles.iconBtnWa}`}
                              title="WhatsApp"
                              onClick={() => handleWhatsAppClick(paciente)}
                            >
                              📱
                            </button>
                          )}

                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnPrint}`}
                            title="Imprimir ART completo"
                            onClick={() => handlePrint(paciente, "art")}
                            disabled={printingId === `${paciente.id}-art`}
                          >
                            {printingId === `${paciente.id}-art` ? "⏳" : "🖨️"}
                          </button>

                          <button
                            className={`${styles.iconBtn} ${styles.iconBtnPrint}`}
                            title="Imprimir hoja de evolución"
                            onClick={() => handlePrint(paciente, "evolucion")}
                            disabled={printingId === `${paciente.id}-evolucion`}
                          >
                            {printingId === `${paciente.id}-evolucion` ? "⏳" : "📄"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className={styles.statsLayout}>
          <div className={styles.statsCards}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Total siniestros</span>
              <strong className={styles.metricValue}>{stats.total}</strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Activos</span>
              <strong className={styles.metricValue}>{stats.activos}</strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Cerrados</span>
              <strong className={styles.metricValue}>{stats.cerrados}</strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Promedio de edad</span>
              <strong className={styles.metricValue}>
                {stats.promedioEdad === "—" ? "—" : `${stats.promedioEdad} años`}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Masculino</span>
              <strong className={styles.metricValue}>{stats.sexos.m}</strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Femenino</span>
              <strong className={styles.metricValue}>{stats.sexos.f}</strong>
            </article>
          </div>

          <div className={styles.statsPanels}>
            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Resumen por ART</h2>
              </div>

              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>ART</th>
                      <th>Total</th>
                      <th>Activos</th>
                      <th>Cerrados</th>
                      <th>Prom. edad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.porArtArray.length === 0 ? (
                      <tr>
                        <td colSpan={5}>No hay datos.</td>
                      </tr>
                    ) : (
                      stats.porArtArray.map((item) => (
                        <tr key={item.art}>
                          <td>{item.art}</td>
                          <td>{item.total}</td>
                          <td>{item.activos}</td>
                          <td>{item.cerrados}</td>
                          <td>{item.promedioEdad === "—" ? "—" : `${item.promedioEdad} años`}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Motivos de consulta</h2>
              </div>

              <div className={styles.simpleStatsList}>
                {Object.keys(stats.motivos).length === 0 ? (
                  <div className={styles.emptyMini}>No hay datos.</div>
                ) : (
                  Object.entries(stats.motivos)
                    .sort((a, b) => b[1] - a[1])
                    .map(([motivo, cantidad]) => (
                      <div key={motivo} className={styles.simpleStatsItem}>
                        <span>{motivo}</span>
                        <strong>{cantidad}</strong>
                      </div>
                    ))
                )}
              </div>
            </section>

            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Ingresos por mes</h2>
              </div>

              <div className={styles.simpleStatsList}>
                {stats.ingresosPorMesArray.length === 0 ? (
                  <div className={styles.emptyMini}>No hay datos.</div>
                ) : (
                  stats.ingresosPorMesArray.map((item) => (
                    <div key={item.mes} className={styles.simpleStatsItem}>
                      <span>{item.mes}</span>
                      <strong>{item.cantidad}</strong>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
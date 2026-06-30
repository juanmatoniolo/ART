"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

function pacienteIncompleto(p) {
  const t = p.trabajador || {};
  const art = p.ART || {};
  const fi = p.fechaIngreso || {};

  const faltan = [];

  if (!t.apellido?.trim()) faltan.push("Apellido");
  if (!t.nombre?.trim()) faltan.push("Nombre");
  if (!t.dni?.trim()) faltan.push("DNI");
  if (!art.nombre?.trim()) faltan.push("ART");
  if (!t.telefono?.trim()) faltan.push("Teléfono");
  if (!fi.dia || !fi.mes || !fi.anio) faltan.push("Fecha Ingreso");

  return faltan.length > 0 ? faltan : false;
}

export default function PacientesPage() {
  const router = useRouter();

  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState(null);

  const [filtroEstado, setFiltroEstado] = useState("abierto");
  const [filtroArt, setFiltroArt] = useState("todas");
  const [filtroCompletitud, setFiltroCompletitud] = useState("todos");

  const [activeView, setActiveView] = useState("listado");
  const [printingId, setPrintingId] = useState(null);

  const [ordenColumna, setOrdenColumna] = useState("fechaIngreso");
  const [ordenDireccion, setOrdenDireccion] = useState("desc");

  const [showUnionModal, setShowUnionModal] = useState(false);
  const [pacientesDuplicados, setPacientesDuplicados] = useState([]);
  const [principalId, setPrincipalId] = useState(null);

  const fetchPacientes = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${FIREBASE_URL}/pacientes.json`);

      if (!res.ok) {
        throw new Error("Error al cargar pacientes");
      }

      const data = await res.json();

      if (!data) {
        setPacientes([]);
        return;
      }

      const arr = Object.entries(data).map(([id, value]) => ({
        id,
        ...value,
      }));

      arr.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setPacientes(arr);
    } catch (err) {
      console.error(err);
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
    const filtrados = pacientes.filter((p) => {
      const fullName = `${p.trabajador?.apellido || ""} ${p.trabajador?.nombre || ""
        }`.toLowerCase();

      const dni = p.trabajador?.dni || "";
      const artNombre = p.ART?.nombre || "";
      const estado = p.estado || "abierto";
      const incompleto = pacienteIncompleto(p);

      const matchSearch =
        fullName.includes(searchTerm.toLowerCase()) ||
        dni.includes(searchTerm);

      const matchEstado =
        filtroEstado === "todos" || estado === filtroEstado;

      const matchArt =
        filtroArt === "todas" || artNombre === filtroArt;

      const matchCompletitud =
        filtroCompletitud === "todos" ||
        (filtroCompletitud === "completos" && !incompleto) ||
        (filtroCompletitud === "incompletos" && !!incompleto);

      return matchSearch && matchEstado && matchArt && matchCompletitud;
    });

    const sorted = [...filtrados];

    sorted.sort((a, b) => {
      let valA;
      let valB;

      switch (ordenColumna) {
        case "nombre":
          valA = `${a.trabajador?.apellido || ""} ${a.trabajador?.nombre || ""}`.toLowerCase();
          valB = `${b.trabajador?.apellido || ""} ${b.trabajador?.nombre || ""}`.toLowerCase();
          break;

        case "dni":
          valA = a.trabajador?.dni || "";
          valB = b.trabajador?.dni || "";
          break;

        case "edad":
          valA = parseInt(a.trabajador?.edad, 10) || 0;
          valB = parseInt(b.trabajador?.edad, 10) || 0;
          break;

        case "art":
          valA = a.ART?.nombre || "";
          valB = b.ART?.nombre || "";
          break;

        case "nroSiniestro":
          valA = a.ART?.nroSiniestro || "";
          valB = b.ART?.nroSiniestro || "";
          break;

        case "fechaIngreso":
          valA = a.fechaIngreso?.iso || "";
          valB = b.fechaIngreso?.iso || "";
          break;

        case "estado":
          valA = a.estado || "abierto";
          valB = b.estado || "abierto";
          break;

        default:
          valA = a.createdAt || 0;
          valB = b.createdAt || 0;
      }

      if (typeof valA === "string") {
        return ordenDireccion === "asc"
          ? valA.localeCompare(valB)
          : valB.localeCompare(valA);
      }

      return ordenDireccion === "asc" ? valA - valB : valB - valA;
    });

    return sorted;
  }, [
    pacientes,
    searchTerm,
    filtroEstado,
    filtroArt,
    filtroCompletitud,
    ordenColumna,
    ordenDireccion,
  ]);

  const stats = useMemo(() => {
    const total = pacientes.length;

    const abiertos = pacientes.filter(
      (p) => (p.estado || "abierto") === "abierto"
    ).length;

    const cerrados = pacientes.filter(
      (p) => (p.estado || "abierto") === "cerrado"
    ).length;

    const incompletos = pacientes.filter((p) => pacienteIncompleto(p)).length;

    const edades = pacientes
      .map((p) => Number(p.trabajador?.edad))
      .filter((edad) => Number.isFinite(edad) && edad > 0);

    const promedioEdad = edades.length
      ? (edades.reduce((acc, n) => acc + n, 0) / edades.length).toFixed(1)
      : "—";

    const edadMin = edades.length ? Math.min(...edades) : "—";
    const edadMax = edades.length ? Math.max(...edades) : "—";

    const rangos = {
      "18-30": 0,
      "31-45": 0,
      "46-60": 0,
      "60+": 0,
    };

    edades.forEach((edad) => {
      if (edad >= 18 && edad <= 30) rangos["18-30"] += 1;
      else if (edad >= 31 && edad <= 45) rangos["31-45"] += 1;
      else if (edad >= 46 && edad <= 60) rangos["46-60"] += 1;
      else if (edad > 60) rangos["60+"] += 1;
    });

    const sexos = pacientes.reduce(
      (acc, p) => {
        const sexo = p.trabajador?.sexo;

        if (sexo === "M") acc.m += 1;
        if (sexo === "F") acc.f += 1;

        return acc;
      },
      { m: 0, f: 0 }
    );

    const porArt = pacientes.reduce((acc, p) => {
      const art = p.ART?.nombre?.trim() || "Sin ART";
      const estado = p.estado || "abierto";
      const edad = Number(p.trabajador?.edad);

      if (!acc[art]) {
        acc[art] = {
          art,
          total: 0,
          abiertos: 0,
          cerrados: 0,
          edades: [],
        };
      }

      acc[art].total += 1;

      if (estado === "cerrado") acc[art].cerrados += 1;
      else acc[art].abiertos += 1;

      if (Number.isFinite(edad) && edad > 0) {
        acc[art].edades.push(edad);
      }

      return acc;
    }, {});

    const porArtArray = Object.values(porArt)
      .map((item) => ({
        ...item,
        promedioEdad: item.edades.length
          ? (
            item.edades.reduce((acc, n) => acc + n, 0) / item.edades.length
          ).toFixed(1)
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

    const diffDias = pacientes
      .filter((p) => p.fechaIngreso?.iso && p.fechaDenuncia?.iso)
      .map((p) => {
        const ingreso = new Date(p.fechaIngreso.iso);
        const denuncia = new Date(p.fechaDenuncia.iso);

        return Math.abs((denuncia - ingreso) / (1000 * 60 * 60 * 24));
      })
      .filter((dias) => Number.isFinite(dias) && dias >= 0);

    const promedioDias = diffDias.length
      ? (diffDias.reduce((a, b) => a + b, 0) / diffDias.length).toFixed(1)
      : "—";

    const diasEvolucion = pacientes
      .filter(
        (p) =>
          (p.estado || "abierto") === "cerrado" &&
          p.fechaIngreso?.iso &&
          p.fechaDenuncia?.iso
      )
      .map((p) => {
        const ingreso = new Date(p.fechaIngreso.iso);
        const denuncia = new Date(p.fechaDenuncia.iso);

        return Math.abs((denuncia - ingreso) / (1000 * 60 * 60 * 24));
      })
      .filter((dias) => Number.isFinite(dias) && dias >= 0);

    const promedioEvolucion = diasEvolucion.length
      ? (
        diasEvolucion.reduce((a, b) => a + b, 0) / diasEvolucion.length
      ).toFixed(1)
      : "—";

    return {
      total,
      abiertos,
      cerrados,
      promedioEdad,
      edadMin,
      edadMax,
      rangos,
      sexos,
      porArtArray,
      ingresosPorMesArray,
      promedioDias,
      promedioEvolucion,
      incompletos,
    };
  }, [pacientes]);

  const handleSort = (columna) => {
    if (ordenColumna === columna) {
      setOrdenDireccion((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setOrdenColumna(columna);
    setOrdenDireccion("asc");
  };

  const handleUnionClickGlobal = () => {
    const mapa = new Map();

    pacientes.forEach((p) => {
      const dni = p.trabajador?.dni?.replace(/\D/g, "");
      const nombre = `${p.trabajador?.apellido || ""} ${p.trabajador?.nombre || ""
        }`
        .trim()
        .toLowerCase();

      const clave = dni || nombre;

      if (!clave) return;

      if (mapa.has(clave)) {
        mapa.get(clave).push(p);
      } else {
        mapa.set(clave, [p]);
      }
    });

    const grupos = [];

    for (const grupo of mapa.values()) {
      if (grupo.length > 1) grupos.push(grupo);
    }

    if (grupos.length === 0) {
      alert("No se encontraron duplicados.");
      return;
    }

    const primerGrupo = grupos[0];

    setPacientesDuplicados(primerGrupo);
    setPrincipalId(primerGrupo[0].id);
    setShowUnionModal(true);
  };

  const fusionarPacientes = async () => {
    if (!principalId) {
      alert("Selecciona un paciente principal.");
      return;
    }

    const principal = pacientesDuplicados.find((p) => p.id === principalId);
    const secundarios = pacientesDuplicados.filter((p) => p.id !== principalId);

    if (!principal) return;

    const combinarObjeto = (objPrincipal = {}, objSecundario = {}) => {
      const resultado = { ...objPrincipal };

      for (const key in objSecundario) {
        if (
          Object.prototype.hasOwnProperty.call(objSecundario, key) &&
          (!resultado[key] || resultado[key] === "" || resultado[key] === null)
        ) {
          resultado[key] = objSecundario[key];
        }
      }

      return resultado;
    };

    const nuevoData = {
      ART: combinarObjeto(principal.ART, secundarios[0]?.ART),
      empleador: combinarObjeto(principal.empleador, secundarios[0]?.empleador),
      trabajador: combinarObjeto(principal.trabajador, secundarios[0]?.trabajador),
      fechaIngreso: combinarObjeto(
        principal.fechaIngreso,
        secundarios[0]?.fechaIngreso
      ),
      fechaDenuncia: combinarObjeto(
        principal.fechaDenuncia,
        secundarios[0]?.fechaDenuncia
      ),
      prestador:
        principal.prestador || {
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
        },
      estado: principal.estado || "abierto",
      updatedAt: Date.now(),
    };

    try {
      await fetch(`${FIREBASE_URL}/pacientes/${principalId}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoData),
      });

      await Promise.all(
        secundarios.map((sec) =>
          fetch(`${FIREBASE_URL}/pacientes/${sec.id}.json`, {
            method: "DELETE",
          })
        )
      );

      await fetchPacientes();

      setShowUnionModal(false);
      alert("Pacientes fusionados correctamente.");
    } catch (error) {
      console.error(error);
      alert("Error al fusionar pacientes.");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Estás seguro de eliminar este paciente?")) return;

    try {
      await fetch(`${FIREBASE_URL}/pacientes/${id}.json`, {
        method: "DELETE",
      });

      await fetchPacientes();
    } catch (error) {
      console.error(error);
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
          <title>Cargando...</title>
          <style>
            html,
            body {
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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          payload,
          fileName,
          templateName:
            type === "evolucion" ? "EVOLUCION.pdf" : "ART-COMPLETOS.pdf",
          pdfType: type,
        }),
      });

      if (!res.ok) {
        throw new Error(`Error ${res.status}`);
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
        <html>
          <body>
            <h2>Error</h2>
            <pre>${String(err.message)}</pre>
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

  if (error) {
    return <div className={styles.errorScreen}>{error}</div>;
  }

  return (
    <main className={styles.container}>
      <header className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>Pacientes</h1>

          <div className={styles.statsRow}>
            <span className={styles.statBadge} data-type="abierto">
              🟢 {stats.abiertos} abiertos
            </span>

            <span className={styles.statBadge} data-type="cerrado">
              🔴 {stats.cerrados} cerrados
            </span>

            <span className={styles.statBadge} data-type="total">
              {stats.total} total
            </span>

            <span className={styles.statBadge} data-type="incompleto">
              ⚠️ {stats.incompletos} incompletos
            </span>
          </div>
        </div>

        <button
          type="button"
          className={styles.newBtn}
          onClick={() => router.push("/admin/pacientes/nuevo")}
        >
          <span>+</span>
          Nuevo Paciente
        </button>
      </header>

      <nav className={styles.viewTabs} aria-label="Vista de pacientes">
        <button
          type="button"
          className={`${styles.viewTab} ${activeView === "listado" ? styles.viewTabActive : ""
            }`}
          onClick={() => setActiveView("listado")}
        >
          📋 Listado
        </button>

        <button
          type="button"
          className={`${styles.viewTab} ${activeView === "estadisticas" ? styles.viewTabActive : ""
            }`}
          onClick={() => setActiveView("estadisticas")}
        >
          📊 Estadísticas
        </button>
      </nav>

      {activeView === "listado" ? (
        <>
          <section className={styles.filterBar} aria-label="Filtros">
            <div className={styles.filterGroup}>
              <div className={styles.tabGroup}>
                {["abierto", "cerrado", "todos"].map((estado) => (
                  <button
                    type="button"
                    key={estado}
                    className={`${styles.tab} ${filtroEstado === estado ? styles.tabActive : ""
                      }`}
                    onClick={() => setFiltroEstado(estado)}
                  >
                    {estado === "abierto"
                      ? "🟢 Abierto"
                      : estado === "cerrado"
                        ? "🔴 Cerrado"
                        : "Todos"}
                  </button>
                ))}
              </div>

              <select
                value={filtroArt}
                onChange={(e) => setFiltroArt(e.target.value)}
                className={styles.selectInput}
                aria-label="Filtrar por ART"
              >
                <option value="todas">Todas las ART</option>

                {artOptions.map((art) => (
                  <option key={art} value={art}>
                    {art}
                  </option>
                ))}
              </select>

              <div className={styles.tabGroup}>
                {["todos", "completos", "incompletos"].map((tipo) => (
                  <button
                    type="button"
                    key={tipo}
                    className={`${styles.tab} ${filtroCompletitud === tipo ? styles.tabActive : ""
                      }`}
                    onClick={() => setFiltroCompletitud(tipo)}
                  >
                    {tipo === "todos"
                      ? "Todos"
                      : tipo === "completos"
                        ? "✅ Completos"
                        : "⚠️ Incompletos"}
                  </button>
                ))}
              </div>

              <button
                type="button"
                className={styles.duplicadosBtn}
                onClick={handleUnionClickGlobal}
              >
                🔍 Duplicados
              </button>
            </div>

            <input
              type="search"
              placeholder="Buscar por nombre o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
              aria-label="Buscar paciente por nombre o DNI"
            />
          </section>

          {filteredPacientes.length === 0 ? (
            <div className={styles.empty}>
              <div className={styles.emptyIcon}>🔍</div>
              <p>No se encontraron pacientes con esos filtros.</p>
            </div>
          ) : (
            <section className={styles.tableWrapper} aria-label="Listado de pacientes">
              <table className={styles.table}>
                <colgroup>
                  <col className={styles.colPaciente} />
                  <col className={styles.colDni} />
                  <col className={styles.colEdad} />
                  <col className={styles.colArt} />
                  <col className={styles.colSiniestro} />
                  <col className={styles.colIngreso} />
                  <col className={styles.colEstado} />
                  <col className={styles.colAcciones} />
                </colgroup>

                <thead>
                  <tr>
                    {[
                      ["nombre", "Paciente"],
                      ["dni", "DNI"],
                      ["edad", "Edad"],
                      ["art", "ART"],
                      ["nroSiniestro", "N° Siniestro"],
                      ["fechaIngreso", "Ingreso"],
                      ["estado", "Estado"],
                    ].map(([key, label]) => (
                      <th key={key} className={styles.sortable}>
                        <button
                          type="button"
                          className={styles.sortButton}
                          onClick={() => handleSort(key)}
                          aria-label={`Ordenar por ${label}`}
                        >
                          <span>{label}</span>

                          {ordenColumna === key && (
                            <span className={styles.sortArrow}>
                              {ordenDireccion === "asc" ? "↑" : "↓"}
                            </span>
                          )}
                        </button>
                      </th>
                    ))}

                    <th className={styles.accionesHeader}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredPacientes.map((paciente) => {
                    const t = paciente.trabajador || {};
                    const art = paciente.ART || {};
                    const fi = paciente.fechaIngreso || {};
                    const estado = paciente.estado || "abierto";
                    const incompleto = pacienteIncompleto(paciente);

                    const nombreCompleto =
                      `${t.apellido || ""} ${t.nombre || ""}`.trim() || "—";

                    return (
                      <tr
                        key={paciente.id}
                        className={estado === "cerrado" ? styles.rowCerrado : ""}
                      >
                        <td data-label="Paciente">
                          <div className={styles.cellNameContent}>
                            <span className={styles.patientName}>
                              {nombreCompleto}
                            </span>

                            {incompleto && (
                              <span
                                className={styles.incompletoIcon}
                                title={`Faltan: ${incompleto.join(", ")}`}
                                aria-label="Paciente incompleto"
                              >
                                ⚠️
                              </span>
                            )}
                          </div>
                        </td>

                        <td data-label="DNI">
                          <span className={styles.cellTextWrap}>
                            {t.dni || "—"}
                          </span>
                        </td>

                        <td data-label="Edad">
                          {t.edad ? `${t.edad}` : "—"}
                        </td>

                        <td data-label="ART">
                          <span className={styles.artTag}>
                            {art.nombre || "—"}
                          </span>
                        </td>

                        <td data-label="N° Siniestro" className={styles.mono}>
                          <span className={styles.cellTextWrap}>
                            {art.nroSiniestro || "—"}
                          </span>
                        </td>

                        <td data-label="Ingreso" className={styles.mono}>
                          {fi.dia && fi.mes && fi.anio
                            ? `${fi.dia}/${fi.mes}/${fi.anio}`
                            : "—"}
                        </td>

                        <td data-label="Estado">
                          <span
                            className={
                              estado === "abierto"
                                ? styles.bolitaVerde
                                : styles.bolitaRoja
                            }
                            title={estado === "abierto" ? "Abierto" : "Cerrado"}
                          />
                        </td>

                        <td data-label="Acciones">
                          <div className={styles.actionsCellContent}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Editar"
                              aria-label={`Editar ${nombreCompleto}`}
                              onClick={() =>
                                router.push(
                                  `/admin/pacientes/editar/${paciente.id}`
                                )
                              }
                            >
                              ✏️
                            </button>

                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                              title="Eliminar"
                              aria-label={`Eliminar ${nombreCompleto}`}
                              onClick={() => handleDelete(paciente.id)}
                            >
                              🗑️
                            </button>

                            {t.telefono && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.iconBtnWa}`}
                                title="WhatsApp"
                                aria-label={`Enviar WhatsApp a ${nombreCompleto}`}
                                onClick={() => handleWhatsAppClick(paciente)}
                              >
                                📱
                              </button>
                            )}

                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnPrint}`}
                              title="ART completo"
                              aria-label={`Imprimir ART completo de ${nombreCompleto}`}
                              onClick={() => handlePrint(paciente, "art")}
                              disabled={printingId === `${paciente.id}-art`}
                            >
                              {printingId === `${paciente.id}-art`
                                ? "⏳"
                                : "🖨️"}
                            </button>

                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnPrint}`}
                              title="Evolución"
                              aria-label={`Imprimir evolución de ${nombreCompleto}`}
                              onClick={() => handlePrint(paciente, "evolucion")}
                              disabled={
                                printingId === `${paciente.id}-evolucion`
                              }
                            >
                              {printingId === `${paciente.id}-evolucion`
                                ? "⏳"
                                : "📄"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </>
      ) : (
        <section className={styles.statsLayout}>
          <div className={styles.statsCards}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Total siniestros</span>
              <strong className={styles.metricValue}>{stats.total}</strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Abiertos</span>
              <strong className={styles.metricValue}>{stats.abiertos}</strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Cerrados</span>
              <strong className={styles.metricValue}>{stats.cerrados}</strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Promedio de edad</span>
              <strong className={styles.metricValue}>
                {stats.promedioEdad === "—"
                  ? "—"
                  : `${stats.promedioEdad} años`}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Edad mínima</span>
              <strong className={styles.metricValue}>
                {stats.edadMin === "—" ? "—" : `${stats.edadMin} años`}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Edad máxima</span>
              <strong className={styles.metricValue}>
                {stats.edadMax === "—" ? "—" : `${stats.edadMax} años`}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Prom. días ingreso→denuncia
              </span>
              <strong className={styles.metricValue}>
                {stats.promedioDias === "—"
                  ? "—"
                  : `${stats.promedioDias} días`}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>
                Prom. evolución cerrados
              </span>
              <strong className={styles.metricValue}>
                {stats.promedioEvolucion === "—"
                  ? "—"
                  : `${stats.promedioEvolucion} días`}
              </strong>
            </article>

            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Incompletos</span>
              <strong className={styles.metricValue}>{stats.incompletos}</strong>
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
                      <th>Abiertos</th>
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
                          <td>{item.abiertos}</td>
                          <td>{item.cerrados}</td>
                          <td>
                            {item.promedioEdad === "—"
                              ? "—"
                              : `${item.promedioEdad} años`}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Distribución por sexo</h2>
              </div>

              <div className={styles.simpleStatsList}>
                <div className={styles.simpleStatsItem}>
                  <span>👨 Masculino</span>
                  <strong>{stats.sexos.m}</strong>
                </div>

                <div className={styles.simpleStatsItem}>
                  <span>👩 Femenino</span>
                  <strong>{stats.sexos.f}</strong>
                </div>

                <div className={styles.simpleStatsItem}>
                  <span>📊 % Mujeres</span>
                  <strong>
                    {stats.total
                      ? ((stats.sexos.f / stats.total) * 100).toFixed(1)
                      : 0}
                    %
                  </strong>
                </div>
              </div>
            </section>

            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h2 className={styles.panelTitle}>Rango etario</h2>
              </div>

              <div className={styles.simpleStatsList}>
                {Object.entries(stats.rangos).map(([rango, count]) => {
                  const pct = stats.total
                    ? ((count / stats.total) * 100).toFixed(1)
                    : 0;

                  return (
                    <div key={rango} className={styles.simpleStatsItem}>
                      <span>{rango} años</span>
                      <strong>
                        {count} ({pct}%)
                      </strong>
                    </div>
                  );
                })}
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
        </section>
      )}

      {showUnionModal && (
        <div className={styles.unionOverlay}>
          <div className={styles.unionPanel}>
            <div className={styles.unionHeader}>
              <h3>Fusionar pacientes duplicados</h3>

              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setShowUnionModal(false)}
                aria-label="Cerrar modal"
              >
                ✕
              </button>
            </div>

            <p>
              Selecciona el paciente principal. Se conservarán sus datos y se
              completarán con los de los demás.
            </p>

            <div className={styles.unionList}>
              {pacientesDuplicados.map((p) => {
                const t = p.trabajador || {};
                const fullName =
                  `${t.apellido || ""} ${t.nombre || ""}`.trim() ||
                  "Sin nombre";
                const dni = t.dni || "Sin DNI";

                return (
                  <label key={p.id} className={styles.unionItem}>
                    <input
                      type="radio"
                      name="principal"
                      value={p.id}
                      checked={principalId === p.id}
                      onChange={() => setPrincipalId(p.id)}
                    />

                    <span>
                      {fullName} ({dni})
                    </span>
                  </label>
                );
              })}
            </div>

            <div className={styles.unionActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setShowUnionModal(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={styles.saveBtn}
                onClick={fusionarPacientes}
              >
                Fusionar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
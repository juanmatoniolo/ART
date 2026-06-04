"use client";

import { useEffect, useState } from "react";
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

  const filteredPacientes = pacientes.filter((p) => {
    const fullName = `${p.trabajador?.apellido || ""} ${p.trabajador?.nombre || ""}`.toLowerCase();
    const dni = p.trabajador?.dni || "";
    const matchSearch =
      fullName.includes(searchTerm.toLowerCase()) || dni.includes(searchTerm);
    const matchEstado =
      filtroEstado === "todos" || (p.estado || "activo") === filtroEstado;

    return matchSearch && matchEstado;
  });

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

    if (type === "evolucion") {
      return `EVOLUCION_${apellido}_${dni}_${nroSiniestro}.pdf`;
    }

    return `ART_${apellido}_${dni}_${nroSiniestro}.pdf`;
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

      printWindow.document.open();
      printWindow.document.write(`
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8" />
          <title>${type === "evolucion" ? "Hoja de evolución" : "Formulario ART"}</title>
          <style>
            html, body {
              margin: 0;
              height: 100%;
              background: #525659;
            }
            iframe {
              width: 100%;
              height: 100%;
              border: 0;
            }
          </style>
        </head>
        <body>
          <iframe src="${url}"></iframe>
        </body>
      </html>
    `);
      printWindow.document.close();

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


  const activosCount = pacientes.filter((p) => (p.estado || "activo") === "activo").length;
  const cerradosCount = pacientes.filter((p) => p.estado === "cerrado").length;
  const totalCount = pacientes.length;

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner} />
        <span>Cargando pacientes...</span>
      </div>
    );
  }

  if (error) return <div className={styles.errorScreen}>{error}</div>;

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

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.titleBlock}>
          <h1 className={styles.pageTitle}>Pacientes</h1>
          <div className={styles.statsRow}>
            <span className={styles.statBadge} data-type="activo">{activosCount} activos</span>
            <span className={styles.statBadge} data-type="cerrado">{cerradosCount} cerrados</span>
            <span className={styles.statBadge} data-type="total">{totalCount} total</span>
          </div>
        </div>

        <button
          className={styles.newBtn}
          onClick={() => router.push("/admin/pacientes/nuevo")}
        >
          <span>+</span> Nuevo Paciente
        </button>
      </div>

      <div className={styles.filterBar}>
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
          <p>
            {searchTerm
              ? "No se encontraron pacientes con ese criterio."
              : "No hay pacientes en esta categoría."}
          </p>
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
    </div>
  );
}
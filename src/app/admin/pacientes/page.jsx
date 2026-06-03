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
    } catch (err) {
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

  const handlePrint = async (paciente) => {
    setPrintingId(paciente.id);
    try {
      // Asegurar que la estructura coincida con la esperada por /api/pdf
      const payload = {
        ...paciente,
        // Si falta el prestador, usamos el mismo que en SiniestroPage
        prestador: paciente.prestador || {
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
      };

      const apellido = payload.trabajador?.apellido || "SIN_APELLIDO";
      const dni = payload.trabajador?.dni?.replace(/\D/g, "") || "SIN_DNI";
      const nroSiniestro = payload.ART?.nroSiniestro || "SINIESTRO";
      const fileName = `ART_${apellido}_${dni}_${nroSiniestro}.pdf`;

      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, fileName }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error al generar PDF: ${res.status} ${errorText}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("No se pudo generar el PDF. Revisá consola.");
    } finally {
      setPrintingId(null);
    }
  };

  const activosCount = pacientes.filter((p) => (p.estado || "activo") === "activo").length;
  const cerradosCount = pacientes.filter((p) => p.estado === "cerrado").length;
  const totalCount = pacientes.length;

  if (loading) return <div className={styles.loadingScreen}><div className={styles.spinner} /><span>Cargando pacientes...</span></div>;
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
        <button className={styles.newBtn} onClick={() => router.push("/admin/pacientes/nuevo")}>
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
          <p>{searchTerm ? "No se encontraron pacientes con ese criterio." : "No hay pacientes en esta categoría."}</p>
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
                  <tr key={paciente.id} className={estado === "cerrado" ? styles.rowCerrado : ""}>
                    <td className={styles.cellName}>
                     {t.apellido} {t.nombre}
                    </td>
                    <td>{t.dni || "—"}</td>
                    <td>{t.edad ? `${t.edad}` : "—"}</td>
                    <td><span className={styles.artTag}>{art.nombre || "—"}</span></td>
                    <td className={styles.mono}>{art.nroSiniestro || "—"}</td>
                    <td className={styles.mono}>
                      {fi.dia && fi.mes && fi.anio
                        ? `${fi.dia}/${fi.mes}/${fi.anio}`
                        : "—"}
                    </td>

                    <td className={styles.actionsCell}>
                      <button
                        className={styles.iconBtn}
                        title="Editar"
                        onClick={() => router.push(`/admin/pacientes/editar/${paciente.id}`)}
                      >✏️</button>
                      <button
                        className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                        title="Eliminar"
                        onClick={() => handleDelete(paciente.id)}
                      >🗑️</button>
                      {t.telefono && (
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnWa}`}
                          title="WhatsApp"
                          onClick={() => handleWhatsAppClick(paciente)}
                        >📱</button>
                      )}
                      <button
                        className={`${styles.iconBtn} ${styles.iconBtnPrint}`}
                        title="Imprimir formulario de siniestro"
                        onClick={() => handlePrint(paciente)}
                        disabled={printingId === paciente.id}
                      >
                        {printingId === paciente.id ? "⏳" : "🖨️"}
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

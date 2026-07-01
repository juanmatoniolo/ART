"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
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
  const [filtroSexo, setFiltroSexo] = useState("todos"); // nuevo filtro

  const [activeView, setActiveView] = useState("listado");
  const [printingId, setPrintingId] = useState(null);

  const [ordenColumna, setOrdenColumna] = useState("fechaIngreso");
  const [ordenDireccion, setOrdenDireccion] = useState("desc");

  const [showUnionModal, setShowUnionModal] = useState(false);
  const [pacientesDuplicados, setPacientesDuplicados] = useState([]);
  const [principalId, setPrincipalId] = useState(null);

  // Datos de facturación en tiempo real
  const [facturacionData, setFacturacionData] = useState({});

  // Filtros de fecha para estadísticas
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");

  // ---- Carga de pacientes ----
  const fetchPacientes = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${FIREBASE_URL}/pacientes.json`);
      if (!res.ok) throw new Error("Error al cargar pacientes");
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

  // ---- Carga en tiempo real de Facturación ----
  useEffect(() => {
    const factRef = ref(db, "Facturacion");
    const unsub = onValue(
      factRef,
      (snap) => setFacturacionData(snap.exists() ? snap.val() : {}),
      (err) => {
        console.error("Error al cargar facturación:", err);
        setFacturacionData({});
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    fetchPacientes();
  }, []);

  // ---- Lista de ART únicas para filtro ----
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

  // ---- Filtrado y ordenamiento de pacientes ----
  const filteredPacientes = useMemo(() => {
    const filtrados = pacientes.filter((p) => {
      const fullName = `${p.trabajador?.apellido || ""} ${p.trabajador?.nombre || ""
        }`.toLowerCase();
      const dni = p.trabajador?.dni || "";
      const artNombre = p.ART?.nombre || "";
      const estado = p.estado || "abierto";
      const incompleto = pacienteIncompleto(p);
      const sexo = String(p.trabajador?.sexo || "").toUpperCase().trim();

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
      
      // Filtro por sexo
      let matchSexo = true;
      if (filtroSexo === "M") {
        matchSexo = sexo === "M" || sexo === "MASCULINO";
      } else if (filtroSexo === "F") {
        matchSexo = sexo === "F" || sexo === "FEMENINO";
      } else if (filtroSexo === "sinDato") {
        matchSexo = !sexo || (sexo !== "M" && sexo !== "MASCULINO" && sexo !== "F" && sexo !== "FEMENINO");
      }

      return matchSearch && matchEstado && matchArt && matchCompletitud && matchSexo;
    });

    const sorted = [...filtrados];
    sorted.sort((a, b) => {
      let valA, valB;
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
    filtroSexo,
    ordenColumna,
    ordenDireccion,
  ]);

  // ---- Estadísticas generales de pacientes ----
  const stats = useMemo(() => {
    const total = pacientes.length;
    const abiertos = pacientes.filter((p) => (p.estado || "abierto") === "abierto").length;
    const cerrados = pacientes.filter((p) => (p.estado || "abierto") === "cerrado").length;
    const incompletos = pacientes.filter((p) => pacienteIncompleto(p)).length;
    const completos = total - incompletos;

    const edades = pacientes
      .map((p) => Number(p.trabajador?.edad))
      .filter((edad) => Number.isFinite(edad) && edad > 0);
    const promedioEdad = edades.length
      ? (edades.reduce((acc, n) => acc + n, 0) / edades.length).toFixed(1)
      : "—";
    const edadMin = edades.length ? Math.min(...edades) : "—";
    const edadMax = edades.length ? Math.max(...edades) : "—";

    const rangos = {
      "0-17": 0,
      "18-30": 0,
      "31-45": 0,
      "46-60": 0,
      "60+": 0,
    };
    edades.forEach((edad) => {
      if (edad <= 17) rangos["0-17"] += 1;
      else if (edad <= 30) rangos["18-30"] += 1;
      else if (edad <= 45) rangos["31-45"] += 1;
      else if (edad <= 60) rangos["46-60"] += 1;
      else rangos["60+"] += 1;
    });

    const sexos = pacientes.reduce(
      (acc, p) => {
        const sexo = String(p.trabajador?.sexo || "").toUpperCase();
        if (sexo === "M" || sexo === "MASCULINO") acc.m += 1;
        else if (sexo === "F" || sexo === "FEMENINO") acc.f += 1;
        else acc.sinDato += 1;
        return acc;
      },
      { m: 0, f: 0, sinDato: 0 }
    );

    const porArt = pacientes.reduce((acc, p) => {
      const art = p.ART?.nombre?.trim() || "Sin ART";
      const estado = p.estado || "abierto";
      const edad = Number(p.trabajador?.edad);
      const incompleto = pacienteIncompleto(p);
      if (!acc[art]) {
        acc[art] = {
          art,
          total: 0,
          abiertos: 0,
          cerrados: 0,
          incompletos: 0,
          completos: 0,
          edades: [],
        };
      }
      acc[art].total += 1;
      if (estado === "cerrado") acc[art].cerrados += 1;
      else acc[art].abiertos += 1;
      if (incompleto) acc[art].incompletos += 1;
      else acc[art].completos += 1;
      if (Number.isFinite(edad) && edad > 0) {
        acc[art].edades.push(edad);
      }
      return acc;
    }, {});

    const porArtArray = Object.values(porArt)
      .map((item) => ({
        ...item,
        porcentaje:
          total > 0 ? ((item.total / total) * 100).toFixed(1) : "0.0",
        promedioEdad: item.edades.length
          ? (
            item.edades.reduce((acc, n) => acc + n, 0) / item.edades.length
          ).toFixed(1)
          : "—",
      }))
      .sort((a, b) => b.total - a.total || a.art.localeCompare(b.art, "es"));

    const topArts = porArtArray.slice(0, 5);

    const ingresosPorMes = pacientes.reduce((acc, p) => {
      const fi = p.fechaIngreso || {};
      if (fi.anio && fi.mes) {
        const key = `${fi.anio}-${String(fi.mes).padStart(2, "0")}`;
        if (!acc[key]) {
          acc[key] = {
            mes: key,
            total: 0,
            abiertos: 0,
            cerrados: 0,
          };
        }
        acc[key].total += 1;
        if ((p.estado || "abierto") === "cerrado") acc[key].cerrados += 1;
        else acc[key].abiertos += 1;
      }
      return acc;
    }, {});

    const ingresosPorMesArray = Object.values(ingresosPorMes)
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .slice(0, 12);

    const conTelefono = pacientes.filter((p) =>
      p.trabajador?.telefono?.trim()
    ).length;
    const conSiniestro = pacientes.filter((p) =>
      p.ART?.nroSiniestro?.trim()
    ).length;
    const sinSiniestro = total - conSiniestro;
    const tasaCierre = total > 0 ? ((cerrados / total) * 100).toFixed(1) : "0.0";
    const tasaCompletitud =
      total > 0 ? ((completos / total) * 100).toFixed(1) : "0.0";
    const artMasFrecuente = porArtArray[0]?.art || "—";
    const artMasFrecuenteCantidad = porArtArray[0]?.total || 0;

    return {
      total,
      abiertos,
      cerrados,
      incompletos,
      completos,
      promedioEdad,
      edadMin,
      edadMax,
      rangos,
      sexos,
      porArtArray,
      topArts,
      ingresosPorMesArray,
      conTelefono,
      conSiniestro,
      sinSiniestro,
      tasaCierre,
      tasaCompletitud,
      artMasFrecuente,
      artMasFrecuenteCantidad,
    };
  }, [pacientes]);

  // ---- Función para obtener timestamp en milisegundos desde una fecha ----
  const dateToTs = (dateStr, isEndOfDay = false) => {
    if (!dateStr) return null;
    const d = new Date(dateStr + (isEndOfDay ? "T23:59:59.999" : "T00:00:00"));
    return isNaN(d.getTime()) ? null : d.getTime();
  };

  // ---- Estadísticas de facturación (con filtro de fechas) ----
  const facturacionStats = useMemo(() => {
    const facturas = Object.values(facturacionData || {});
    if (!facturas.length) return null;

    const desdeTs = dateToTs(fechaDesde);
    const hastaTs = dateToTs(fechaHasta, true);

    let totalFacturado = 0;     // cerrados
    let totalBorradores = 0;   // borradores

    const porArtMap = {};
    const porMesMap = {};

    facturas.forEach((f) => {
      // Total correcto, igual que en FacturadosPage
      const total = Number(
        f?.totales?.total ??
        f?.total ??
        (Number(f?.totales?.honorarios || 0) + Number(f?.totales?.gastos || 0)) ??
        0
      );

      const estado = f?.estado || (f?.cerradoAt ? "cerrado" : "borrador");
      const esCerrado = estado === "cerrado";

      // Fecha de referencia según estado
      const ts = esCerrado
        ? (f?.cerradoAt || f?.createdAt)
        : (f?.updatedAt || f?.createdAt);
      const tsNum = Number(ts) || 0;
      if (desdeTs !== null && tsNum < desdeTs) return;
      if (hastaTs !== null && tsNum > hastaTs) return;

      if (esCerrado) totalFacturado += total;
      else totalBorradores += total;

      // ART (ahora con la misma lógica que FacturadosPage)
      const art = (
        f?.paciente?.artSeguro?.trim() ||
        f?.artNombre?.trim() ||
        f?.artSeguro?.trim() ||
        "Sin ART"
      );

      if (!porArtMap[art]) {
        porArtMap[art] = {
          art,
          cerrado: { total: 0, count: 0 },
          borrador: { total: 0, count: 0 },
        };
      }
      if (esCerrado) {
        porArtMap[art].cerrado.total += total;
        porArtMap[art].cerrado.count += 1;
      } else {
        porArtMap[art].borrador.total += total;
        porArtMap[art].borrador.count += 1;
      }

      // Mes
      if (tsNum) {
        const fecha = new Date(tsNum);
        if (!isNaN(fecha.getTime())) {
          const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
          if (!porMesMap[key]) {
            porMesMap[key] = {
              mes: key,
              cerrado: { total: 0, count: 0 },
              borrador: { total: 0, count: 0 },
            };
          }
          if (esCerrado) {
            porMesMap[key].cerrado.total += total;
            porMesMap[key].cerrado.count += 1;
          } else {
            porMesMap[key].borrador.total += total;
            porMesMap[key].borrador.count += 1;
          }
        }
      }
    });

    const porArtArray = Object.values(porArtMap)
      .map((item) => ({
        ...item,
        totalGeneral: item.cerrado.total + item.borrador.total,
        countGeneral: item.cerrado.count + item.borrador.count,
      }))
      .sort((a, b) => b.totalGeneral - a.totalGeneral)
      .slice(0, 10);

    const porMesArray = Object.values(porMesMap)
      .map((item) => ({
        ...item,
        totalGeneral: item.cerrado.total + item.borrador.total,
        countGeneral: item.cerrado.count + item.borrador.count,
      }))
      .sort((a, b) => b.mes.localeCompare(a.mes))
      .slice(0, 12);

    return {
      totalFacturado,
      totalBorradores,
      totalGeneral: totalFacturado + totalBorradores,
      porArtArray,
      porMesArray,
    };
  }, [facturacionData, fechaDesde, fechaHasta]);

  // ---- Estadísticas de prácticas y médicos (con filtro de fechas) ----
  const consultasStats = useMemo(() => {
    const facturas = Object.values(facturacionData || {});
    if (!facturas.length) return null;

    const desdeTs = dateToTs(fechaDesde);
    const hastaTs = dateToTs(fechaHasta, true);

    const practicasCount = {};
    const medicosCount = {};

    facturas.forEach((f) => {
      const ts = Number(f?.cerradoAt || f?.updatedAt || f?.createdAt || 0);
      if (desdeTs !== null && ts < desdeTs) return;
      if (hastaTs !== null && ts > hastaTs) return;

      const procesarItems = (items) => {
        if (!Array.isArray(items)) return;
        items.forEach((item) => {
          const codigo = item?.codigo || item?.descripcion || item?.nombre || "Sin código";
          practicasCount[codigo] = (practicasCount[codigo] || 0) + 1;

          const medico = item?.prestadorNombre?.trim();
          if (medico) {
            medicosCount[medico] = (medicosCount[medico] || 0) + 1;
          }
        });
      };

      procesarItems(f.practicas);
      procesarItems(f.cirugias);
      procesarItems(f.laboratorios);
    });

    const topPracticas = Object.entries(practicasCount)
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topMedicos = Object.entries(medicosCount)
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return { topPracticas, topMedicos };
  }, [facturacionData, fechaDesde, fechaHasta]);

  // ---- Ordenamiento ----
  const handleSort = (columna) => {
    if (ordenColumna === columna) {
      setOrdenDireccion((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setOrdenColumna(columna);
    setOrdenDireccion("asc");
  };

  // ---- Cambio rápido de estado (doble clic) ----
  const handleToggleEstado = async (id, estadoActual) => {
    const nuevoEstado = estadoActual === "abierto" ? "cerrado" : "abierto";
    if (!confirm(`¿Cambiar estado a ${nuevoEstado.toUpperCase()}?`)) return;
    try {
      await fetch(`${FIREBASE_URL}/pacientes/${id}.json`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      await fetchPacientes();
    } catch (error) {
      console.error(error);
      alert("Error al cambiar el estado.");
    }
  };

  // ---- Unión de duplicados ----
  const handleUnionClickGlobal = () => {
    const mapa = new Map();
    pacientes.forEach((p) => {
      const dni = p.trabajador?.dni?.replace(/\D/g, "");
      const nombre = `${p.trabajador?.apellido || ""} ${p.trabajador?.nombre || ""}`
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
      fechaIngreso: combinarObjeto(principal.fechaIngreso, secundarios[0]?.fechaIngreso),
      fechaDenuncia: combinarObjeto(principal.fechaDenuncia, secundarios[0]?.fechaDenuncia),
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

  // ---- Eliminar paciente ----
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

  // ---- Ir a listado con filtro Sin dato ----
  const verSinDatoSexo = () => {
    setFiltroSexo("sinDato");
    setActiveView("listado");
    // Opcional: limpiar otros filtros para que solo se vean esos
    setFiltroEstado("todos");
    setFiltroArt("todas");
    setFiltroCompletitud("todos");
    setSearchTerm("");
  };

  // ---- Impresión de PDF (se mantiene igual) ----
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
    const basePayload = { ...paciente, prestador: getPrestadorDefault(paciente) };
    if (type === "evolucion") {
      return {
        ...basePayload,
        fechaIngreso: { ...basePayload.fechaIngreso, dia: "", mes: "", anio: "" },
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
        <head><meta charset="utf-8" /><title>Cargando...</title>
          <style>
            html,body{margin:0;height:100%;display:grid;place-items:center;font-family:Arial,sans-serif;background:#f3f4f6}
            .loader{text-align:center;color:#111827}
          </style>
        </head>
        <body><div class="loader">Generando vista de impresión...</div></body>
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
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      printWindow.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) {
      console.error(err);
      printWindow.document.open();
      printWindow.document.write(`<html><body><h2>Error</h2><pre>${String(err.message)}</pre></body></html>`);
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

  // ---- Renderizado ----
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
      {/* Header y botón nuevo paciente */}
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

      {/* Pestañas de vista */}
      <nav className={styles.viewTabs} aria-label="Vista de pacientes">
        <button
          type="button"
          className={`${styles.viewTab} ${activeView === "listado" ? styles.viewTabActive : ""}`}
          onClick={() => setActiveView("listado")}
        >
          📋 Listado
        </button>
        <button
          type="button"
          className={`${styles.viewTab} ${activeView === "estadisticas" ? styles.viewTabActive : ""}`}
          onClick={() => setActiveView("estadisticas")}
        >
          📊 Estadísticas
        </button>
      </nav>

      {activeView === "listado" ? (
        <>
          {/* Filtros del listado */}
          <section className={styles.filterBar} aria-label="Filtros">
            <div className={styles.filterGroup}>
              <div className={styles.tabGroup}>
                {["abierto", "cerrado", "todos"].map((estado) => (
                  <button
                    type="button"
                    key={estado}
                    className={`${styles.tab} ${filtroEstado === estado ? styles.tabActive : ""}`}
                    onClick={() => setFiltroEstado(estado)}
                  >
                    {estado === "abierto" ? "🟢 Abierto" : estado === "cerrado" ? "🔴 Cerrado" : "Todos"}
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
                    className={`${styles.tab} ${filtroCompletitud === tipo ? styles.tabActive : ""}`}
                    onClick={() => setFiltroCompletitud(tipo)}
                  >
                    {tipo === "todos" ? "Todos" : tipo === "completos" ? "✅ Completos" : "⚠️ Incompletos"}
                  </button>
                ))}
              </div>
              {/* Filtro de sexo nuevo */}
              <select
                value={filtroSexo}
                onChange={(e) => setFiltroSexo(e.target.value)}
                className={styles.selectInput}
                aria-label="Filtrar por sexo"
                style={{ minWidth: "130px" }}
              >
                <option value="todos">Todos los sexos</option>
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
                <option value="sinDato">Sin dato</option>
              </select>
              <button type="button" className={styles.duplicadosBtn} onClick={handleUnionClickGlobal}>
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

          {/* Tabla de pacientes */}
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
                    const nombreCompleto = `${t.apellido || ""} ${t.nombre || ""}`.trim() || "—";

                    return (
                      <tr key={paciente.id} className={estado === "cerrado" ? styles.rowCerrado : ""}>
                        <td data-label="Paciente">
                          <div className={styles.cellNameContent}>
                            <span className={styles.patientName}>{nombreCompleto}</span>
                            {incompleto && (
                              <span className={styles.incompletoIcon} title={`Faltan: ${incompleto.join(", ")}`} aria-label="Paciente incompleto">
                                ⚠️
                              </span>
                            )}
                          </div>
                        </td>
                        <td data-label="DNI">
                          <span className={styles.cellTextWrap}>{t.dni || "—"}</span>
                        </td>
                        <td data-label="Edad">{t.edad ? `${t.edad}` : "—"}</td>
                        <td data-label="ART">
                          <span className={styles.artTag}>{art.nombre || "—"}</span>
                        </td>
                        <td data-label="N° Siniestro" className={styles.mono}>
                          <span className={styles.cellTextWrap}>{art.nroSiniestro || "—"}</span>
                        </td>
                        <td data-label="Ingreso" className={styles.mono}>
                          {fi.dia && fi.mes && fi.anio ? `${fi.dia}/${fi.mes}/${fi.anio}` : "—"}
                        </td>
                        {/* Celda de estado con doble clic */}
                        <td
                          data-label="Estado"
                          onDoubleClick={() => handleToggleEstado(paciente.id, estado)}
                          style={{ cursor: "pointer" }}
                          title="Doble clic para cambiar estado"
                        >
                          <span
                            className={estado === "abierto" ? styles.bolitaVerde : styles.bolitaRoja}
                          />
                        </td>
                        <td data-label="Acciones">
                          <div className={styles.actionsCellContent}>
                            <button
                              type="button"
                              className={styles.iconBtn}
                              title="Editar"
                              aria-label={`Editar ${nombreCompleto}`}
                              onClick={() => router.push(`/admin/pacientes/editar/${paciente.id}`)}
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
                              {printingId === `${paciente.id}-art` ? "⏳" : "🖨️"}
                            </button>
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.iconBtnPrint}`}
                              title="Evolución"
                              aria-label={`Imprimir evolución de ${nombreCompleto}`}
                              onClick={() => handlePrint(paciente, "evolucion")}
                              disabled={printingId === `${paciente.id}-evolucion`}
                            >
                              {printingId === `${paciente.id}-evolucion` ? "⏳" : "📄"}
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
        /* ========== VISTA ESTADÍSTICAS ========== */
        <section className={styles.statsLayout}>
          {/* Encabezado y filtro de fechas */}
          <div className={styles.statsHeader}>
            <div>
              <h2 className={styles.statsTitle}>Estadísticas generales</h2>
              <p className={styles.statsSubtitle}>
                Resumen operativo de pacientes, ART, estados y calidad de carga.
              </p>
            </div>
            <span className={styles.statsTotalBadge}>{stats.total} pacientes registrados</span>
          </div>

          {/* Filtro de fechas para facturación / consultas */}
          <div className={styles.statsHeader} style={{ justifyContent: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Desde
              <input
                type="date"
                className={styles.selectInput}
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                max={fechaHasta || undefined}
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Hasta
              <input
                type="date"
                className={styles.selectInput}
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                min={fechaDesde || undefined}
              />
            </label>
            {(fechaDesde || fechaHasta) && (
              <button
                type="button"
                className={styles.duplicadosBtn}
                onClick={() => { setFechaDesde(""); setFechaHasta(""); }}
              >
                Limpiar fechas
              </button>
            )}
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginLeft: "auto" }}>
              {!fechaDesde && !fechaHasta
                ? "Mostrando todos los datos"
                : `Filtrando facturación y consultas`}
            </span>
          </div>

          {/* KPI cards de pacientes */}
          <div className={styles.kpiGrid}>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}>👥</span>
              <div>
                <span className={styles.kpiLabel}>Total pacientes</span>
                <strong className={styles.kpiValue}>{stats.total}</strong>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}>🟢</span>
              <div>
                <span className={styles.kpiLabel}>Abiertos</span>
                <strong className={styles.kpiValue}>{stats.abiertos}</strong>
                <small className={styles.kpiHint}>
                  {stats.total ? ((stats.abiertos / stats.total) * 100).toFixed(1) : 0}%
                </small>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}>🔴</span>
              <div>
                <span className={styles.kpiLabel}>Cerrados</span>
                <strong className={styles.kpiValue}>{stats.cerrados}</strong>
                <small className={styles.kpiHint}>{stats.tasaCierre}% cierre</small>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}>✅</span>
              <div>
                <span className={styles.kpiLabel}>Completitud</span>
                <strong className={styles.kpiValue}>{stats.tasaCompletitud}%</strong>
                <small className={styles.kpiHint}>
                  {stats.completos} completos / {stats.incompletos} incompletos
                </small>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}>🎂</span>
              <div>
                <span className={styles.kpiLabel}>Edad promedio</span>
                <strong className={styles.kpiValue}>
                  {stats.promedioEdad === "—" ? "—" : `${stats.promedioEdad}`}
                </strong>
                <small className={styles.kpiHint}>
                  Min {stats.edadMin} / Max {stats.edadMax}
                </small>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}>🏥</span>
              <div>
                <span className={styles.kpiLabel}>ART principal</span>
                <strong className={styles.kpiValueSmall}>{stats.artMasFrecuente}</strong>
                <small className={styles.kpiHint}>{stats.artMasFrecuenteCantidad} pacientes</small>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}>📱</span>
              <div>
                <span className={styles.kpiLabel}>Con teléfono</span>
                <strong className={styles.kpiValue}>{stats.conTelefono}</strong>
                <small className={styles.kpiHint}>
                  {stats.total ? ((stats.conTelefono / stats.total) * 100).toFixed(1) : 0}% contactables
                </small>
              </div>
            </article>
            <article className={styles.kpiCard}>
              <span className={styles.kpiIcon}>📄</span>
              <div>
                <span className={styles.kpiLabel}>Sin N° siniestro</span>
                <strong className={styles.kpiValue}>{stats.sinSiniestro}</strong>
                <small className={styles.kpiHint}>Revisar carga administrativa</small>
              </div>
            </article>
          </div>

          {/* Paneles de pacientes */}
          <div className={styles.statsGrid}>
            <section className={`${styles.statsPanel} ${styles.statsPanelLarge}`}>
              <div className={styles.panelHeader}>
                <div>
                  <h3 className={styles.panelTitle}>Resumen por ART</h3>
                  <p className={styles.panelSubtitle}>Cantidad, estado, completitud y promedio de edad.</p>
                </div>
              </div>
              <div className={styles.statsTableScroll}>
                <table className={styles.statsTable}>
                  <thead>
                    <tr>
                      <th>ART</th>
                      <th>Total</th>
                      <th>%</th>
                      <th>Abiertos</th>
                      <th>Cerrados</th>
                      <th>Incompletos</th>
                      <th>Prom. edad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.porArtArray.length === 0 ? (
                      <tr><td colSpan={7}>No hay datos.</td></tr>
                    ) : (
                      stats.porArtArray.map((item) => (
                        <tr key={item.art}>
                          <td><strong>{item.art}</strong></td>
                          <td>{item.total}</td>
                          <td>{item.porcentaje}%</td>
                          <td><span className={styles.statusPillGreen}>{item.abiertos}</span></td>
                          <td><span className={styles.statusPillRed}>{item.cerrados}</span></td>
                          <td>
                            <span className={item.incompletos > 0 ? styles.statusPillYellow : styles.statusPillNeutral}>
                              {item.incompletos}
                            </span>
                          </td>
                          <td>{item.promedioEdad === "—" ? "—" : `${item.promedioEdad} años`}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Distribución por sexo mejorada */}
            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Distribución por sexo</h3>
              </div>
              <div className={styles.compactList}>
                <div className={styles.compactItem}>
                  <span>👨 Masculino</span>
                  <strong>{stats.sexos.m} <small>({stats.total ? ((stats.sexos.m / stats.total) * 100).toFixed(1) : 0}%)</small></strong>
                </div>
                <div className={styles.compactItem}>
                  <span>👩 Femenino</span>
                  <strong>{stats.sexos.f} <small>({stats.total ? ((stats.sexos.f / stats.total) * 100).toFixed(1) : 0}%)</small></strong>
                </div>
                <div
                  className={styles.compactItem}
                  onClick={verSinDatoSexo}
                  style={{ cursor: "pointer", background: "var(--btn-ghost-hover)" }}
                  title="Hacé clic para ver los pacientes sin dato de sexo"
                >
                  <span>❔ Sin dato</span>
                  <strong>{stats.sexos.sinDato} <small>({stats.total ? ((stats.sexos.sinDato / stats.total) * 100).toFixed(1) : 0}%)</small></strong>
                </div>
              </div>
            </section>

            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Rango etario</h3>
              </div>
              <div className={styles.compactList}>
                {Object.entries(stats.rangos).map(([rango, count]) => {
                  const pct = stats.total ? ((count / stats.total) * 100).toFixed(1) : 0;
                  return (
                    <div key={rango} className={styles.compactItem}>
                      <span>{rango} años</span>
                      <strong>{count} <small>({pct}%)</small></strong>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Últimos ingresos</h3>
              </div>
              <div className={styles.compactList}>
                {stats.ingresosPorMesArray.length === 0 ? (
                  <div className={styles.emptyMini}>No hay datos.</div>
                ) : (
                  stats.ingresosPorMesArray.map((item) => (
                    <div key={item.mes} className={styles.compactItem}>
                      <span>{item.mes}</span>
                      <strong>{item.total}</strong>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className={styles.statsPanel}>
              <div className={styles.panelHeader}>
                <h3 className={styles.panelTitle}>Calidad de datos</h3>
              </div>
              <div className={styles.compactList}>
                <div className={styles.compactItem}><span>✅ Completos</span><strong>{stats.completos}</strong></div>
                <div className={styles.compactItem}><span>⚠️ Incompletos</span><strong>{stats.incompletos}</strong></div>
                <div className={styles.compactItem}><span>📱 Con teléfono</span><strong>{stats.conTelefono}</strong></div>
                <div className={styles.compactItem}><span>📄 Con siniestro</span><strong>{stats.conSiniestro}</strong></div>
              </div>
            </section>
          </div>

          {/* ========== FACTURACIÓN ========== */}
          {facturacionStats && (
            <>
              <div className={styles.statsHeader} style={{ marginTop: "1rem" }}>
                <div>
                  <h2 className={styles.statsTitle}>💰 Facturación</h2>
                  <p className={styles.statsSubtitle}>
                    Diferenciado entre cerrados (facturado) y borradores (próximos a facturar).
                  </p>
                </div>
                <span className={styles.statsTotalBadge}>
                  Total general: ${facturacionStats.totalGeneral.toLocaleString()}
                </span>
              </div>

              <div className={styles.kpiGrid}>
                <article className={styles.kpiCard}>
                  <span className={styles.kpiIcon}>✅</span>
                  <div>
                    <span className={styles.kpiLabel}>Facturado (cerrado)</span>
                    <strong className={styles.kpiValue}>
                      ${facturacionStats.totalFacturado.toLocaleString()}
                    </strong>
                  </div>
                </article>
                <article className={styles.kpiCard}>
                  <span className={styles.kpiIcon}>📝</span>
                  <div>
                    <span className={styles.kpiLabel}>Borradores</span>
                    <strong className={styles.kpiValue}>
                      ${facturacionStats.totalBorradores.toLocaleString()}
                    </strong>
                  </div>
                </article>
              </div>

              <div className={styles.statsGrid}>
                <section className={`${styles.statsPanel} ${styles.statsPanelLarge}`}>
                  <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>Facturación por ART</h3>
                  </div>
                  <div className={styles.statsTableScroll}>
                    <table className={styles.statsTable}>
                      <thead>
                        <tr>
                          <th>ART</th>
                          <th>Facturado</th>
                          <th>Borradores</th>
                          <th>Total</th>
                          <th>% del total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facturacionStats.porArtArray.map((item) => {
                          const pct = ((item.totalGeneral / facturacionStats.totalGeneral) * 100).toFixed(1);
                          return (
                            <tr key={item.art}>
                              <td><strong>{item.art}</strong></td>
                              <td>${item.cerrado.total.toLocaleString()} ({item.cerrado.count})</td>
                              <td>${item.borrador.total.toLocaleString()} ({item.borrador.count})</td>
                              <td>${item.totalGeneral.toLocaleString()}</td>
                              <td>{pct}%</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className={styles.statsPanel}>
                  <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>Facturación mensual</h3>
                  </div>
                  <div className={styles.statsTableScroll}>
                    <table className={styles.statsTable}>
                      <thead>
                        <tr>
                          <th>Mes</th>
                          <th>Facturado</th>
                          <th>Borradores</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {facturacionStats.porMesArray.map((item) => (
                          <tr key={item.mes}>
                            <td><strong>{item.mes}</strong></td>
                            <td>${item.cerrado.total.toLocaleString()}</td>
                            <td>${item.borrador.total.toLocaleString()}</td>
                            <td>${item.totalGeneral.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>
            </>
          )}

          {/* ========== PRÁCTICAS Y MÉDICOS ========== */}
          {consultasStats && (
            <>
              <div className={styles.statsHeader} style={{ marginTop: "1rem" }}>
                <div>
                  <h2 className={styles.statsTitle}>🩺 Atenciones</h2>
                  <p className={styles.statsSubtitle}>
                    Prácticas más frecuentes y médicos que más atienden.
                  </p>
                </div>
              </div>

              <div className={styles.statsGrid}>
                <section className={styles.statsPanel}>
                  <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>Prácticas más usadas</h3>
                  </div>
                  <div className={styles.compactList}>
                    {consultasStats.topPracticas.map((p) => {
                      const pct = consultasStats.topPracticas[0].count > 0
                        ? ((p.count / consultasStats.topPracticas[0].count) * 100).toFixed(0)
                        : 0;
                      return (
                        <div key={p.nombre} className={styles.compactItem}>
                          <span>{p.nombre}</span>
                          <strong>{p.count} <small>({pct}%)</small></strong>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.statsPanel}>
                  <div className={styles.panelHeader}>
                    <h3 className={styles.panelTitle}>Médicos con más atenciones</h3>
                  </div>
                  <div className={styles.compactList}>
                    {consultasStats.topMedicos.map((m) => {
                      const pct = consultasStats.topMedicos[0].count > 0
                        ? ((m.count / consultasStats.topMedicos[0].count) * 100).toFixed(0)
                        : 0;
                      return (
                        <div key={m.nombre} className={styles.compactItem}>
                          <span>{m.nombre}</span>
                          <strong>{m.count} <small>({pct}%)</small></strong>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </>
          )}

          {!facturacionStats && !consultasStats && (
            <div className={styles.emptyMini} style={{ textAlign: "center", padding: "2rem" }}>
              No hay datos de facturación ni consultas para mostrar.
            </div>
          )}
        </section>
      )}

      {/* Modal de unión de duplicados */}
      {showUnionModal && (
        <div className={styles.unionOverlay}>
          <div className={styles.unionPanel}>
            <div className={styles.unionHeader}>
              <h3>Fusionar pacientes duplicados</h3>
              <button type="button" className={styles.closeBtn} onClick={() => setShowUnionModal(false)} aria-label="Cerrar modal">
                ✕
              </button>
            </div>
            <p>Selecciona el paciente principal. Se conservarán sus datos y se completarán con los de los demás.</p>
            <div className={styles.unionList}>
              {pacientesDuplicados.map((p) => {
                const t = p.trabajador || {};
                const fullName = `${t.apellido || ""} ${t.nombre || ""}`.trim() || "Sin nombre";
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
                    <span>{fullName} ({dni})</span>
                  </label>
                );
              })}
            </div>
            <div className={styles.unionActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setShowUnionModal(false)}>
                Cancelar
              </button>
              <button type="button" className={styles.saveBtn} onClick={fusionarPacientes}>
                Fusionar
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
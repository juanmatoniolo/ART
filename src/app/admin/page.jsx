"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";
import {
  Users,
  Briefcase,
  FileText,
  Pill,
  BookOpen,
  FolderTree,
} from "lucide-react";

const FIREBASE_URL = "https://datos-clini-default-rtdb.firebaseio.com";

const countObject = (value, filter = () => true) => {
  if (!value || typeof value !== "object") return 0;
  return Object.entries(value).filter(([key, item]) => filter(item, key)).length;
};

const toDateLabel = (value) => {
  if (!value) return "Sin fecha";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return date.toLocaleDateString("es-AR");
};

const getTimestamp = (item = {}) => {
  const value = item.timestamp || item.createdAt || item.modifiedAt || item.updatedAt || item.cerradoAt || 0;
  const timestamp = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const getFojaPatient = (item = {}) =>
  item?.paciente?.apelidoynombre || item?.paciente?.nombre || item?.apelidoynombre || "Sin paciente";

const mapRecentFojas = (fojas = {}) =>
  Object.entries(fojas || {})
    .filter(([key, item]) => key !== "plantilla" && item && typeof item === "object")
    .map(([id, item]) => ({
      id,
      title: getFojaPatient(item),
      meta: item?.equipo?.cirujano || "Sin cirujano",
      date: toDateLabel(item.timestamp || item.createdAt),
      ts: getTimestamp(item),
    }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

const mapRecentHistorias = (general = {}, uti = {}) => {
  const normalize = (label, item = {}, id) => ({
    id: `${label}-${id}`,
    title: item.nombre_apellido || item.nombre || "Sin paciente",
    meta: `${label} ${item.historia_clinica || item.historia_clinica_1 || "-"}`,
    date: toDateLabel(item.createdAt || item.modifiedAt),
    ts: getTimestamp(item),
  });

  return [
    ...Object.entries(general || {}).map(([id, item]) => normalize("HC", item, id)),
    ...Object.entries(uti || {}).map(([id, item]) => normalize("HC UTI", item, id)),
  ]
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);
};

const mapRecentFacturas = (facturas = {}) =>
  Object.entries(facturas || {})
    .filter(([key, item]) => key !== "siniestros" && item && typeof item === "object")
    .map(([id, item]) => ({
      id,
      title: item?.paciente?.nombreCompleto || item?.nombre || "Sin paciente",
      meta: item.estado === "cerrado" ? "Cerrada" : "Borrador",
      date: toDateLabel(item.cerradoAt || item.updatedAt || item.createdAt),
      ts: getTimestamp(item),
    }))
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

async function fetchJson(path) {
  const res = await fetch(`${FIREBASE_URL}/${path}.json`);
  if (!res.ok) throw new Error(`No se pudo leer ${path}`);
  return res.json();
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    pacientes: 0,
    empleados: 0,
    facturas: 0,
    medDesc: 0,
    cxPendientes: 0,
    fojas: 0,
    historias: 0,
    farmacia: 0,
    siniestros: 0,
  });
  const [recent, setRecent] = useState({
    fojas: [],
    historias: [],
    facturas: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [
          pacientes,
          empleados,
          facturasData,
          medData,
          descData,
          cirugiasData,
          fojasData,
          historiasData,
          historiasUtiData,
          farmaciaData,
          siniestrosData,
        ] = await Promise.all([
          fetchJson("pacientes"),
          fetchJson("users"),
          fetchJson("Facturacion"),
          fetchJson("medydescartables/medicamentos"),
          fetchJson("medydescartables/descartables"),
          fetchJson("cirugias"),
          fetchJson("fojaqx"),
          fetchJson("historias-clinicas"),
          fetchJson("historias-clinica-uti"),
          fetchJson("farmacia"),
          fetchJson("siniestros"),
        ]);

        const cirugiasArray = Array.isArray(cirugiasData)
          ? cirugiasData
          : Object.values(cirugiasData || {});

        setStats({
          pacientes: countObject(pacientes),
          empleados: countObject(empleados),
          facturas: countObject(
            facturasData,
            (item, key) => key !== "siniestros" && item?.estado === "cerrado"
          ),
          medDesc: countObject(medData) + countObject(descData),
          cxPendientes: cirugiasArray.filter((item) => item && item.realizada !== true).length,
          fojas: countObject(fojasData, (_item, key) => key !== "plantilla"),
          historias: countObject(historiasData) + countObject(historiasUtiData),
          farmacia: countObject(farmaciaData),
          siniestros: countObject(siniestrosData),
        });

        setRecent({
          fojas: mapRecentFojas(fojasData),
          historias: mapRecentHistorias(historiasData, historiasUtiData),
          facturas: mapRecentFacturas(facturasData),
        });
      } catch (error) {
        console.error("Error cargando estadisticas:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const cards = [
    { title: "Pacientes", value: stats.pacientes, icon: Users, color: "#44794d", href: "/admin/pacientes" },
    { title: "Empleados", value: stats.empleados, icon: Briefcase, color: "#2563eb", href: "/admin/empleados" },
    { title: "Facturacion", value: stats.facturas, icon: FileText, color: "#d97706", href: "/admin/Facturacion/Facturados?estado=cerrado" },
    { title: "Med + Descartables", value: stats.medDesc, icon: Pill, color: "#7c3aed", href: "/admin/med-descartables" },
    { title: "Nomencladores", value: "4", icon: BookOpen, color: "#059669", href: "/admin/nomencladores" },
    { title: "CX", value: stats.cxPendientes, icon: FolderTree, color: "#b45309", href: "/admin/cx/programada" },
    { title: "Fojas quirurgicas", value: stats.fojas, icon: FileText, color: "#06b6d4", href: "/admin/foja/medicos" },
    { title: "Historias clinicas", value: stats.historias, icon: BookOpen, color: "#14b8a6", href: "/historia-clinica" },
    { title: "Farmacia", value: stats.farmacia, icon: Pill, color: "#a855f7", href: "/farmacia" },
    { title: "Siniestros", value: stats.siniestros, icon: FolderTree, color: "#ef4444", href: "/admin/Siniestro" },
    { title: "UTI", value: "Abrir", icon: FileText, color: "#38bdf8", href: "/uti/admin" },
    { title: "Comunicador", value: "Abrir", icon: Users, color: "#84cc16", href: "/admin/comunicador" },
  ];

  const recentGroups = [
    { title: "Fojas quirurgicas cargadas", href: "/admin/foja/medicos", items: recent.fojas },
    { title: "Historias clinicas", href: "/historia-clinica", items: recent.historias },
    { title: "Facturacion reciente", href: "/admin/Facturacion/Facturados", items: recent.facturas },
  ];

  if (loading) {
    return <div className={styles.loading}>Cargando dashboard...</div>;
  }

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>Panel de Control</h1>
      <p className={styles.subtitle}>
        Vista central de Clinica Union: administracion, facturacion, fojas, historias y modulos operativos.
      </p>

      <div className={styles.statsGrid}>
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className={styles.card}>
              <div
                className={styles.cardIcon}
                style={{ backgroundColor: `${card.color}20`, color: card.color }}
              >
                <Icon size={28} />
              </div>
              <div className={styles.cardContent}>
                <h3>{card.title}</h3>
                <p>{card.value}</p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className={styles.recentSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2 className={styles.sectionTitle}>Actividad reciente</h2>
            <p className={styles.sectionSubtitle}>Registros cargados desde los modulos de otros usuarios.</p>
          </div>
        </div>

        <div className={styles.recentGrid}>
          {recentGroups.map((group) => (
            <div className={styles.recentCard} key={group.title}>
              <div className={styles.recentCardHeader}>
                <h4>{group.title}</h4>
                <Link href={group.href} className={styles.miniLink}>Ver todo</Link>
              </div>

              {group.items.length === 0 ? (
                <p className={styles.placeholder}>Sin informacion</p>
              ) : (
                <div className={styles.recentList}>
                  {group.items.map((item) => (
                    <Link href={group.href} className={styles.recentItem} key={item.id}>
                      <span className={styles.recentTitle}>{item.title}</span>
                      <span className={styles.recentMeta}>{item.meta}</span>
                      <span className={styles.recentDate}>{item.date}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
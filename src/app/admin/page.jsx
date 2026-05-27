// app/admin/page.jsx (dashboard)
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

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    pacientes: 0,
    empleados: 0,
    facturas: 0,
    medDesc: 0,
    cxPendientes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const CIRUGIAS_URL = "https://datos-clini-default-rtdb.firebaseio.com/cirugias.json";

        const [pacientesRes, empleadosRes, facturasRes, medRes, descRes, cirugiasRes] =
          await Promise.all([
            fetch("https://datos-clini-default-rtdb.firebaseio.com/pacientes.json"),
            fetch("https://datos-clini-default-rtdb.firebaseio.com/users.json"),
            fetch("https://datos-clini-default-rtdb.firebaseio.com/Facturacion.json"),
            fetch("https://datos-clini-default-rtdb.firebaseio.com/medydescartables/medicamentos.json"),
            fetch("https://datos-clini-default-rtdb.firebaseio.com/medydescartables/descartables.json"),
            fetch(CIRUGIAS_URL),
          ]);

        const pacientes = await pacientesRes.json();
        const empleados = await empleadosRes.json();
        const facturasData = await facturasRes.json();
        const medData = await medRes.json();
        const descData = await descRes.json();
        const cirugiasData = await cirugiasRes.json();

        const pacientesCount = pacientes ? Object.keys(pacientes).length : 0;
        const empleadosCount = empleados ? Object.keys(empleados).length : 0;

        let facturadasCount = 0;
        if (facturasData) {
          facturadasCount = Object.values(facturasData).filter(
            (f) => f && typeof f === "object" && f.estado === "cerrado"
          ).length;
        }

        const medCount = medData ? Object.keys(medData).length : 0;
        const descCount = descData ? Object.keys(descData).length : 0;
        const totalMedDesc = medCount + descCount;

        let pendientesCount = 0;
        if (cirugiasData) {
          const cirugiasArray = Array.isArray(cirugiasData)
            ? cirugiasData
            : Object.values(cirugiasData);
          pendientesCount = cirugiasArray.filter(
            (c) => c && typeof c === "object" && c.realizada !== true
          ).length;
        }

        setStats({
          pacientes: pacientesCount,
          empleados: empleadosCount,
          facturas: facturadasCount,
          medDesc: totalMedDesc,
          cxPendientes: pendientesCount,
        });
      } catch (error) {
        console.error("Error cargando estadísticas:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const cards = [
    {
      title: "Pacientes",
      value: stats.pacientes,
      icon: Users,
      color: "#44794d",
      href: "/admin/pacientes",
    },
    {
      title: "Empleados",
      value: stats.empleados,
      icon: Briefcase,
      color: "#2563eb",
      href: "/admin/empleados",
    },
    {
      title: "Facturación",
      value: stats.facturas,
      icon: FileText,
      color: "#d97706",
      href: "/admin/Facturacion/Facturados?estado=cerrado",
    },
    {
      title: "Med + Descartables",
      value: stats.medDesc,
      icon: Pill,
      color: "#7c3aed",
      href: "/admin/med-descartables",
    },
    {
      title: "Nomencladores",
      value: "4",
      icon: BookOpen,
      color: "#059669",
      href: "/admin/nomencladores",
    },
    {
      title: "CX",
      value: stats.cxPendientes,
      icon: FolderTree,
      color: "#b45309",
      href: "/admin/cx/programada",
    },
  ];

  if (loading) {
    return <div className={styles.loading}>Cargando dashboard...</div>;
  }

  return (
    <div className={styles.dashboard}>
      <h1 className={styles.title}>Panel de Control</h1>
      <p className={styles.subtitle}>
        Bienvenido al sistema de gestión de Clínica Unión.
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
        <h2 className={styles.sectionTitle}>Actividad reciente</h2>
        <div className={styles.recentGrid}>
          <div className={styles.recentCard}>
            <h4>Últimos pacientes</h4>
            <p className={styles.placeholder}>Sin datos recientes</p>
          </div>
          <div className={styles.recentCard}>
            <h4>Próximos vencimientos</h4>
            <p className={styles.placeholder}>Sin novedades</p>
          </div>
          <div className={styles.recentCard}>
            <h4>Facturas pendientes</h4>
            <p className={styles.placeholder}>Sin información</p>
          </div>
        </div>
      </div>
    </div>
  );
}
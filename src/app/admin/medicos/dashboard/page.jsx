'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import useDoctorDashboard from '../hooks/useDoctorDashboard';
import { money } from '../../Facturacion/utils/calculos';
import styles from '../medicos.module.css';

function getLocalDateInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}

export default function DashboardPage() {
  const today = useMemo(() => getLocalDateInputValue(), []);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState(today);

  const { stats, loading } = useDoctorDashboard(fechaDesde, fechaHasta);

  const doctores = Array.isArray(stats?.doctores) ? stats.doctores : [];
  const totalHonorarios = stats?.totalHonorarios ?? 0;
  const totalGastos = stats?.totalGastos ?? 0;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>📊 Dashboard de médicos</h1>
        <div className={styles.headerButtons}>
          <Link href="/admin/medicos" className={styles.btnSecondary}>
            ← Volver
          </Link>
        </div>
      </header>

      <div className={styles.dateRange}>
        <label htmlFor="fechaDesde">Desde:</label>
        <input
          id="fechaDesde"
          type="date"
          value={fechaDesde}
          onChange={(e) => setFechaDesde(e.target.value)}
          max={fechaHasta || undefined}
        />

        <label htmlFor="fechaHasta">Hasta:</label>
        <input
          id="fechaHasta"
          type="date"
          value={fechaHasta}
          onChange={(e) => setFechaHasta(e.target.value)}
          min={fechaDesde || undefined}
          max={today}
        />
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando estadísticas...</div>
      ) : (
        <>
          <div className={styles.totales}>
            <div className={styles.totalCard}>
              <span>Honorarios médicos</span>
              <strong>$ {money(totalHonorarios)}</strong>
            </div>

            <div className={styles.totalCard}>
              <span>Gastos clínicos</span>
              <strong>$ {money(totalGastos)}</strong>
            </div>
          </div>

          <h2>Desglose por médico</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Médico</th>
                  <th>Cantidad de apariciones</th>
                  <th>Total honorarios</th>
                </tr>
              </thead>

              <tbody>
                {doctores.length > 0 ? (
                  doctores.map((doc) => (
                    <tr key={doc.nombre}>
                      <td>{doc.nombre || '—'}</td>
                      <td>{doc.count ?? 0}</td>
                      <td>$ {money(doc.total ?? 0)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className={styles.empty}>
                      No hay datos para el período seleccionado
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
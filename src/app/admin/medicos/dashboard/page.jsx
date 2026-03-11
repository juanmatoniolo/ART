'use client';

import { useState } from 'react';
import useDoctorDashboard from '../hooks/useDoctorDashboard';
import { money } from '../../Facturacion/utils/calculos';
import styles from '../medicos.module.css';

export default function DashboardPage() {
  const today = new Date().toISOString().split('T')[0];
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState(today);

  const { stats, loading } = useDoctorDashboard(fechaDesde, fechaHasta);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>📊 Dashboard de médicos</h1>
      </header>

      <div className={styles.dateRange}>
        <label>Desde:</label>
        <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} />
        <label>Hasta:</label>
        <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} />
      </div>

      {loading ? (
        <div className={styles.loading}>Cargando estadísticas...</div>
      ) : (
        <>
          <div className={styles.totales}>
            <div className={styles.totalCard}>
              <span>Honorarios médicos</span>
              <strong>$ {money(stats.totalHonorarios)}</strong>
            </div>
            <div className={styles.totalCard}>
              <span>Gastos clínicos</span>
              <strong>$ {money(stats.totalGastos)}</strong>
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
                {stats.doctores.map((doc) => (
                  <tr key={doc.nombre}>
                    <td>{doc.nombre}</td>
                    <td>{doc.count}</td>
                    <td>$ {money(doc.total)}</td>
                  </tr>
                ))}
                {stats.doctores.length === 0 && (
                  <tr><td colSpan="3" className={styles.empty}>No hay datos para el período seleccionado</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
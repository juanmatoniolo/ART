'use client';

import React, { useMemo, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import useDoctors from '../hooks/useDoctors';
import useFacturas from '../hooks/useFacturas';
import { money, safeNum } from '../../Facturacion/utils/calculos';
import dashStyles from './dashboard.module.css';
import styles from '../medicos.module.css';

/* ---------- helpers ---------- */
function getLocalDateStr() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().split('T')[0];
}

function normTs(fact) {
  return Number(fact.cerradoAt ?? fact.updatedAt ?? fact.createdAt) || 0;
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const TABS = [
  { id: 'resumen', label: '📊 Resumen general' },
  { id: 'balance', label: '👨‍⚕️ Balance por médico' },
  { id: 'directorio', label: '📋 Directorio' },
];

export default function DashboardMedicosPage() {
  const { doctors, loading: loadingDoctors } = useDoctors();
  const { facturas, loading: loadingFacturas } = useFacturas();
  const [activeTab, setActiveTab] = useState('resumen');

  const today = useMemo(() => getLocalDateStr(), []);
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState(today);

  const [selectedDoctorForBalance, setSelectedDoctorForBalance] = useState('');

  const loading = loadingDoctors || loadingFacturas;

  /* ---------- stats globales ---------- */
  const statsGenerales = useMemo(() => {
    const desdeTs = fechaDesde ? new Date(fechaDesde + 'T00:00:00').getTime() : null;
    const hastaTs = fechaHasta ? new Date(fechaHasta + 'T23:59:59.999').getTime() : null;

    let totalHonorarios = 0;
    let totalGastos = 0;
    const porMedico = new Map();
    const porArt = new Map();
    const porMes = new Map();
    const practicasCount = new Map();
    const medicosCount = new Map();

    Object.values(facturas || {}).forEach((f) => {
      if (!f || typeof f !== 'object') return;
      const ts = normTs(f);
      if (desdeTs !== null && ts < desdeTs) return;
      if (hastaTs !== null && ts > hastaTs) return;

      const art = f.paciente?.artSeguro?.trim() || f.artNombre?.trim() || f.artSeguro?.trim() || 'Sin ART';
      const pacienteNombre = f.nombreCompleto || f.paciente?.nombreCompleto || '—';

      let factHonorarios = 0;
      let factGastos = 0;

      const procesar = (items) => {
        if (!Array.isArray(items)) return;
        items.forEach((it) => {
          const honor = safeNum(it?.honorarioMedico);
          const gasto = safeNum(it?.gastoSanatorial);
          factHonorarios += honor;
          factGastos += gasto;
          totalHonorarios += honor;
          totalGastos += gasto;

          const medicoNombre = it?.prestadorNombre?.trim();
          if (medicoNombre) {
            if (!porMedico.has(medicoNombre)) {
              porMedico.set(medicoNombre, {
                honorarios: 0, gastos: 0, total: 0,
                pacientes: new Set(),
                arts: new Map(),
              });
            }
            const m = porMedico.get(medicoNombre);
            m.honorarios += honor;
            m.gastos += gasto;
            m.total += honor + gasto;
            m.pacientes.add(pacienteNombre);
            m.arts.set(art, (m.arts.get(art) || 0) + 1);

            if (!porArt.has(art)) {
              porArt.set(art, { totalHonorarios: 0, totalGastos: 0, count: 0 });
            }
            const a = porArt.get(art);
            a.totalHonorarios += honor;
            a.totalGastos += gasto;
            a.count += 1;

            medicosCount.set(medicoNombre, (medicosCount.get(medicoNombre) || 0) + 1);
          }

          const codigo = it?.codigo || it?.descripcion || it?.nombre || 'Sin código';
          practicasCount.set(codigo, (practicasCount.get(codigo) || 0) + 1);
        });
      };

      procesar(f.practicas);
      procesar(f.cirugias);
      procesar(f.laboratorios);

      const sumarGastosSimples = (items) => {
        if (!Array.isArray(items)) return;
        items.forEach((it) => {
          const gasto = safeNum(it?.gastoSanatorial ?? it?.total);
          factGastos += gasto;
          totalGastos += gasto;
        });
      };
      sumarGastosSimples(f.medicamentos);
      sumarGastosSimples(f.descartables);

      if (ts) {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!porMes.has(key)) porMes.set(key, { honorarios: 0, gastos: 0, total: 0 });
          const m = porMes.get(key);
          m.honorarios += factHonorarios;
          m.gastos += factGastos;
          m.total += factHonorarios + factGastos;
        }
      }
    });

    const porMedicoArray = Array.from(porMedico.entries()).map(([nombre, data]) => {
      const artsSorted = Array.from(data.arts.entries()).sort((a, b) => b[1] - a[1]);
      return {
        nombre,
        honorarios: data.honorarios,
        gastos: data.gastos,
        total: data.total,
        pacientes: data.pacientes.size,
        artPrincipal: artsSorted[0]?.[0] || '—',
      };
    }).sort((a, b) => b.total - a.total);

    const porArtArray = Array.from(porArt.entries())
      .map(([art, data]) => ({ art, ...data }))
      .sort((a, b) => b.totalHonorarios - a.totalHonorarios);

    const porMesArray = Array.from(porMes.entries())
      .map(([mes, data]) => ({ mes, ...data }))
      .sort((a, b) => b.mes.localeCompare(a.mes));

    const topPracticas = Array.from(practicasCount.entries())
      .map(([codigo, count]) => ({ codigo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const topMedicos = Array.from(medicosCount.entries())
      .map(([nombre, count]) => ({ nombre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalHonorarios,
      totalGastos,
      totalGeneral: totalHonorarios + totalGastos,
      porMedico: porMedicoArray,
      porArt: porArtArray,
      porMes: porMesArray,
      topPracticas,
      topMedicos,
      cantMedicosActivos: porMedicoArray.length,
    };
  }, [facturas, fechaDesde, fechaHasta]);

  const handleSelectMedico = useCallback((medicoNombre) => {
    const doctor = doctors.find(d => `${d.apellido}, ${d.nombre}` === medicoNombre);
    if (doctor) {
      setSelectedDoctorForBalance(doctor.id);
      setActiveTab('balance');
    }
  }, [doctors]);

  return (
    <div className={dashStyles.container}>
      <header className={dashStyles.header}>
        <h1>Dashboard de médicos</h1>
        <Link href="/admin/medicos" className={styles.btnSecondary}>← Volver al listado</Link>
      </header>

      <div className={dashStyles.filterBar}>
        <div className={dashStyles.filterGroup}>
          <label>Desde</label>
          <input type="date" className={dashStyles.dateInput} value={fechaDesde} max={fechaHasta || undefined} onChange={(e) => setFechaDesde(e.target.value)} />
        </div>
        <div className={dashStyles.filterGroup}>
          <label>Hasta</label>
          <input type="date" className={dashStyles.dateInput} value={fechaHasta} min={fechaDesde || undefined} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>
        {(fechaDesde || fechaHasta) && (
          <button className={dashStyles.clearBtn} onClick={() => { setFechaDesde(''); setFechaHasta(today); }}>
            Limpiar fechas
          </button>
        )}
      </div>

      <div className={dashStyles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} className={`${dashStyles.tab} ${activeTab === t.id ? dashStyles.tabActive : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={dashStyles.loading}>Cargando datos...</div>
      ) : (
        <>
          {activeTab === 'resumen' && <ResumenGeneral stats={statsGenerales} onSelectMedico={handleSelectMedico} />}
          {activeTab === 'balance' && (
            <BalanceMedico
              doctors={doctors}
              facturas={facturas}
              fechaDesde={fechaDesde}
              fechaHasta={fechaHasta}
              preSelectedId={selectedDoctorForBalance}
              onClearSelection={() => setSelectedDoctorForBalance('')}
            />
          )}
          {activeTab === 'directorio' && <DirectorioMedicos doctors={doctors} facturas={facturas} />}
        </>
      )}
    </div>
  );
}

/* ================================================================
   COMPONENTE: Resumen General
   ================================================================ */
function ResumenGeneral({ stats, onSelectMedico }) {
  if (!stats) return null;
  return (
    <>
      <div className={dashStyles.kpiGrid}>
        <div className={dashStyles.kpiCard}>
          <span className={dashStyles.kpiLabel}>Honorarios</span>
          <strong className={dashStyles.kpiValueBlue}>$ {money(stats.totalHonorarios)}</strong>
        </div>
        <div className={dashStyles.kpiCard}>
          <span className={dashStyles.kpiLabel}>Gastos</span>
          <strong className={dashStyles.kpiValueAmber}>$ {money(stats.totalGastos)}</strong>
        </div>
        <div className={dashStyles.kpiCard}>
          <span className={dashStyles.kpiLabel}>Total</span>
          <strong className={dashStyles.kpiValueGreen}>$ {money(stats.totalGeneral)}</strong>
        </div>
        <div className={dashStyles.kpiCard}>
          <span className={dashStyles.kpiLabel}>Médicos activos</span>
          <strong className={dashStyles.kpiValue}>{stats.cantMedicosActivos}</strong>
        </div>
      </div>

      <div className={dashStyles.section}>
        <h2 className={dashStyles.sectionTitle}>Honorarios por médico</h2>
        <div className={styles.tableWrapper}>
          <table className={`${styles.table} ${dashStyles.table}`}>
            <thead>
              <tr><th>Médico</th><th>Honorarios</th><th>Gastos</th><th>Total</th><th>Pacientes</th><th>ART principal</th></tr>
            </thead>
            <tbody>
              {stats.porMedico.map((m) => (
                <tr key={m.nombre} className={dashStyles.clickableRow} onClick={() => onSelectMedico(m.nombre)} title="Ver balance detallado">
                  <td style={{ fontWeight: 500 }}>{m.nombre}</td>
                  <td className={dashStyles.numBlue}>$ {money(m.honorarios)}</td>
                  <td className={dashStyles.numAmber}>$ {money(m.gastos)}</td>
                  <td className={dashStyles.numGreen}>$ {money(m.total)}</td>
                  <td>{m.pacientes}</td>
                  <td><span className={dashStyles.artBadge}>{m.artPrincipal}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={dashStyles.section}>
        <h2 className={dashStyles.sectionTitle}>Honorarios por ART</h2>
        <div className={styles.tableWrapper}>
          <table className={`${styles.table} ${dashStyles.table}`}>
            <thead>
              <tr><th>ART</th><th>Honorarios</th><th>Gastos</th><th>% total</th><th>Apariciones</th></tr>
            </thead>
            <tbody>
              {stats.porArt.map((a) => {
                const pct = stats.totalHonorarios ? ((a.totalHonorarios / stats.totalHonorarios) * 100).toFixed(1) : 0;
                return (
                  <tr key={a.art}>
                    <td><strong>{a.art}</strong></td>
                    <td className={dashStyles.numBlue}>$ {money(a.totalHonorarios)}</td>
                    <td className={dashStyles.numAmber}>$ {money(a.totalGastos)}</td>
                    <td>{pct}%</td>
                    <td>{a.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={dashStyles.section}>
        <h2 className={dashStyles.sectionTitle}>Evolución mensual</h2>
        <div className={styles.tableWrapper}>
          <table className={`${styles.table} ${dashStyles.table}`}>
            <thead>
              <tr><th>Mes</th><th>Honorarios</th><th>Gastos</th><th>Total</th></tr>
            </thead>
            <tbody>
              {stats.porMes.map((m) => (
                <tr key={m.mes}>
                  <td><strong>{m.mes}</strong></td>
                  <td className={dashStyles.numBlue}>$ {money(m.honorarios)}</td>
                  <td className={dashStyles.numAmber}>$ {money(m.gastos)}</td>
                  <td className={dashStyles.numGreen}>$ {money(m.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={dashStyles.grid2col}>
        <div className={dashStyles.section}>
          <h2 className={dashStyles.sectionTitle}>Prácticas más frecuentes</h2>
          <div className={dashStyles.compactList}>
            {stats.topPracticas.map((p) => (
              <div key={p.codigo} className={dashStyles.compactItem}>
                <span>{p.codigo}</span>
                <strong>{p.count}</strong>
              </div>
            ))}
          </div>
        </div>
        <div className={dashStyles.section}>
          <h2 className={dashStyles.sectionTitle}>Médicos que más atienden</h2>
          <div className={dashStyles.compactList}>
            {stats.topMedicos.map((m) => (
              <div key={m.nombre} className={dashStyles.compactItem}>
                <span>{m.nombre}</span>
                <strong>{m.count}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ================================================================
   COMPONENTE: Balance por médico
   ================================================================ */
function BalanceMedico({ doctors, facturas, fechaDesde, fechaHasta, preSelectedId, onClearSelection }) {
  const [selectedDoctor, setSelectedDoctor] = useState(preSelectedId || '');
  const [sortBy, setSortBy] = useState('fecha');
  const [sortDir, setSortDir] = useState('desc');
  const [searchSiniestro, setSearchSiniestro] = useState('');
  const [expandedSiniestro, setExpandedSiniestro] = useState(null);

  useEffect(() => {
    if (preSelectedId) {
      setSelectedDoctor(preSelectedId);
      if (onClearSelection) onClearSelection();
    }
  }, [preSelectedId, onClearSelection]);

  const doctorName = useMemo(() => {
    if (!selectedDoctor) return '';
    const d = doctors.find((doc) => doc.id === selectedDoctor);
    return d ? `${d.apellido}, ${d.nombre}` : '';
  }, [selectedDoctor, doctors]);

  const siniestros = useMemo(() => {
    if (!selectedDoctor || !doctorName) return [];

    const desdeTs = fechaDesde ? new Date(fechaDesde + 'T00:00:00').getTime() : null;
    const hastaTs = fechaHasta ? new Date(fechaHasta + 'T23:59:59.999').getTime() : null;

    const results = [];
    Object.entries(facturas).forEach(([id, fact]) => {
      if (!fact || typeof fact !== 'object') return;
      const ts = normTs(fact);
      if (desdeTs && ts < desdeTs) return;
      if (hastaTs && ts > hastaTs) return;

      const matchName = (n) => n && n.trim().toLowerCase() === doctorName.trim().toLowerCase();
      const practicasDoc = (fact.practicas || []).filter((p) => matchName(p?.prestadorNombre));
      const cirugiasDoc = (fact.cirugias || []).filter((c) => matchName(c?.prestadorNombre));
      const labsDoc = (fact.laboratorios || []).filter((l) => matchName(l?.prestadorNombre));
      const allItems = [...practicasDoc, ...cirugiasDoc, ...labsDoc];
      if (allItems.length === 0) return;
      if (searchSiniestro && !(fact.nroSiniestro || '').includes(searchSiniestro)) return;

      const honorarios = allItems.reduce((acc, it) => acc + safeNum(it?.honorarioMedico), 0);
      const gastos = allItems.reduce((acc, it) => acc + safeNum(it?.gastoSanatorial), 0);

      results.push({
        id,
        nroSiniestro: fact.nroSiniestro || '—',
        paciente: fact.nombreCompleto || fact.paciente?.nombreCompleto || '—',
        art: fact.paciente?.artSeguro || fact.artSeguro || '—',
        fecha: ts,
        honorarios,
        gastos,
        total: honorarios + gastos,
        practicas: practicasDoc,
        cirugias: cirugiasDoc,
        laboratorios: labsDoc,
      });
    });

    results.sort((a, b) => {
      const va = sortBy === 'fecha' ? a.fecha : sortBy === 'total' ? a.total : a.nroSiniestro;
      const vb = sortBy === 'fecha' ? b.fecha : sortBy === 'total' ? b.total : b.nroSiniestro;
      if (typeof va === 'string') return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      return sortDir === 'asc' ? va - vb : vb - va;
    });
    return results;
  }, [selectedDoctor, doctorName, facturas, fechaDesde, fechaHasta, sortBy, sortDir, searchSiniestro]);

  const totales = useMemo(() => ({
    honorarios: siniestros.reduce((a, s) => a + s.honorarios, 0),
    gastos: siniestros.reduce((a, s) => a + s.gastos, 0),
    total: siniestros.reduce((a, s) => a + s.total, 0),
    siniestros: siniestros.length,
    practicas: siniestros.reduce((a, s) => a + s.practicas.length + s.cirugias.length + s.laboratorios.length, 0),
  }), [siniestros]);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortBy(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => (
    <span className={dashStyles.sortIcon}>
      {sortBy !== col ? '↕' : sortDir === 'asc' ? '↑' : '↓'}
    </span>
  );

  return (
    <>
      <div className={dashStyles.filterBar}>
        <div className={dashStyles.filterGroup}>
          <label>Médico</label>
          <select className={dashStyles.select} value={selectedDoctor} onChange={(e) => { setSelectedDoctor(e.target.value); setExpandedSiniestro(null); }}>
            <option value="">— Seleccionar —</option>
            {doctors.map((d, i) => (
              <option key={d.id} value={d.id}>{i + 1} — {d.apellido}, {d.nombre}</option>
            ))}
          </select>
        </div>
        <div className={dashStyles.filterGroup}>
          <label>N° siniestro</label>
          <input type="text" className={dashStyles.textInput} placeholder="Buscar..." value={searchSiniestro} onChange={(e) => setSearchSiniestro(e.target.value)} />
        </div>
      </div>

      {!selectedDoctor ? (
        <div className={dashStyles.emptyState}>Seleccioná un médico para ver su balance</div>
      ) : (
        <>
          <div className={dashStyles.kpiGrid}>
            <div className={dashStyles.kpiCard}>
              <span className={dashStyles.kpiLabel}>Siniestros</span>
              <strong className={dashStyles.kpiValue}>{totales.siniestros}</strong>
            </div>
            <div className={dashStyles.kpiCard}>
              <span className={dashStyles.kpiLabel}>Prácticas</span>
              <strong className={dashStyles.kpiValue}>{totales.practicas}</strong>
            </div>
            <div className={dashStyles.kpiCard}>
              <span className={dashStyles.kpiLabel}>Honorarios</span>
              <strong className={dashStyles.kpiValueBlue}>$ {money(totales.honorarios)}</strong>
            </div>
            <div className={dashStyles.kpiCard}>
              <span className={dashStyles.kpiLabel}>Gastos</span>
              <strong className={dashStyles.kpiValueAmber}>$ {money(totales.gastos)}</strong>
            </div>
            <div className={dashStyles.kpiCard}>
              <span className={dashStyles.kpiLabel}>Total</span>
              <strong className={dashStyles.kpiValueGreen}>$ {money(totales.total)}</strong>
            </div>
          </div>

          <div className={dashStyles.section}>
            <h2 className={dashStyles.sectionTitle}>
              Participación en siniestros — {doctorName}
              {siniestros.length > 0 && <span className={dashStyles.badge}>{siniestros.length}</span>}
            </h2>
            {siniestros.length === 0 ? (
              <div className={dashStyles.emptyState}>Sin resultados</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={`${styles.table} ${dashStyles.table}`}>
                  <thead>
                    <tr>
                      <th className={dashStyles.thSortable} onClick={() => toggleSort('nroSiniestro')}>N° Siniestro <SortIcon col="nroSiniestro" /></th>
                      <th>Paciente</th>
                      <th>ART</th>
                      <th className={dashStyles.thSortable} onClick={() => toggleSort('fecha')}>Fecha <SortIcon col="fecha" /></th>
                      <th>Prácticas</th>
                      <th className={dashStyles.thSortable} onClick={() => toggleSort('total')}>Honorarios / Total <SortIcon col="total" /></th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {siniestros.map((s) => (
                      <React.Fragment key={s.id}>
                        <tr className={`${dashStyles.siniestroRow} ${expandedSiniestro === s.id ? dashStyles.expanded : ''}`} onClick={() => setExpandedSiniestro(expandedSiniestro === s.id ? null : s.id)}>
                          <td><span className={dashStyles.nroSiniestro}>{s.nroSiniestro}</span></td>
                          <td>{s.paciente}</td>
                          <td><span className={dashStyles.artBadge}>{s.art}</span></td>
                          <td>{formatDate(s.fecha)}</td>
                          <td><span className={dashStyles.badgePill}>{s.practicas.length + s.cirugias.length + s.laboratorios.length}</span></td>
                          <td>
                            <div className={dashStyles.montoCell}>
                              <span className={dashStyles.montoHon}>Hon: $ {money(s.honorarios)}</span>
                              <span className={dashStyles.montoTotal}>Total: $ {money(s.total)}</span>
                            </div>
                          </td>
                          <td><span className={dashStyles.expandIcon}>{expandedSiniestro === s.id ? '▲' : '▼'}</span></td>
                        </tr>
                        {expandedSiniestro === s.id && (
                          <tr>
                            <td colSpan={7} className={dashStyles.detailRow}>
                              <div className={dashStyles.detailContent}>
                                {[{ label: 'Prácticas', items: s.practicas }, { label: 'Cirugías', items: s.cirugias }, { label: 'Laboratorios', items: s.laboratorios }]
                                  .filter((g) => g.items.length > 0)
                                  .map((group) => (
                                    <div key={group.label} className={dashStyles.detailGroup}>
                                      <h4 className={dashStyles.detailGroupTitle}>{group.label}</h4>
                                      <table className={dashStyles.detailTable}>
                                        <thead>
                                          <tr><th>Código</th><th>Descripción</th><th>Rol</th><th>Cant.</th><th>Honorario</th><th>Gasto</th><th>Total</th></tr>
                                        </thead>
                                        <tbody>
                                          {group.items.map((p, i) => (
                                            <tr key={i}>
                                              <td className={dashStyles.detailCodigo}>{p.codigo || '—'}</td>
                                              <td>{p.descripcion || p.nombre || '—'}</td>
                                              <td>
                                                <span className={dashStyles.rolPill} style={{ background: rolColor(p.prestadorRol) + '22', color: rolColor(p.prestadorRol), border: `1px solid ${rolColor(p.prestadorRol)}44` }}>
                                                  {p.prestadorRol || 'Profesional'}
                                                </span>
                                              </td>
                                              <td className={dashStyles.num}>{p.cantidad ?? 1}</td>
                                              <td className={dashStyles.num}>$ {money(p.honorarioMedico ?? 0)}</td>
                                              <td className={dashStyles.num}>$ {money(p.gastoSanatorial ?? 0)}</td>
                                              <td className={`${dashStyles.num} ${dashStyles.detailTotal}`}>$ {money(safeNum(p.honorarioMedico) + safeNum(p.gastoSanatorial))}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}
                                <div className={dashStyles.detailTotales}>
                                  <span>Honorarios: <strong>$ {money(s.honorarios)}</strong></span>
                                  <span>Gastos: <strong>$ {money(s.gastos)}</strong></span>
                                  <span className={dashStyles.detailTotalFinal}>Total: <strong>$ {money(s.total)}</strong></span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </>
  );
}

/* ================================================================
   COMPONENTE: Directorio de médicos (con totales)
   ================================================================ */
function DirectorioMedicos({ doctors, facturas }) {
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  const statsporMedico = useMemo(() => {
    const map = new Map();
    Object.values(facturas).forEach((fact) => {
      if (!fact || typeof fact !== 'object') return;
      const paciente = fact.nombreCompleto || fact.paciente?.nombreCompleto || '—';
      const nroSiniestro = fact.nroSiniestro || '—';
      const art = fact.paciente?.artSeguro || fact.artSeguro || '—';
      const fecha = normTs(fact);
      const procesarItems = (items) => {
        (items || []).forEach((it) => {
          const nombre = it?.prestadorNombre?.trim();
          if (!nombre) return;
          if (!map.has(nombre)) map.set(nombre, { honorarios: 0, gastos: 0, gastoDetalle: [] });
          const entry = map.get(nombre);
          entry.honorarios += safeNum(it?.honorarioMedico);
          const gasto = safeNum(it?.gastoSanatorial);
          if (gasto > 0) {
            entry.gastos += gasto;
            entry.gastoDetalle.push({
              paciente, nroSiniestro, art, fecha,
              codigo: it.codigo || '—',
              descripcion: it.descripcion || it.nombre || '—',
              monto: gasto,
            });
          }
        });
      };
      procesarItems(fact.practicas);
      procesarItems(fact.cirugias);
      procesarItems(fact.laboratorios);
    });
    return map;
  }, [facturas]);

  const doctoresFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase();
    return doctors.filter((d) =>
      !q || d.apellido?.toLowerCase().includes(q) || d.nombre?.toLowerCase().includes(q) ||
      d.matricula?.toLowerCase().includes(q) || d.especialidad?.toLowerCase().includes(q)
    );
  }, [doctors, busqueda]);

  return (
    <div className={dashStyles.section}>
      <div className={dashStyles.sectionHeader}>
        <h2 className={dashStyles.sectionTitle}>Directorio de médicos</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input type="text" className={dashStyles.textInput} placeholder="Buscar médico..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          <Link href="/admin/medicos/nuevo" className={styles.btnPrimary} style={{ whiteSpace: 'nowrap' }}>+ Nuevo médico</Link>
        </div>
      </div>
      <div className={styles.tableWrapper}>
        <table className={`${styles.table} ${dashStyles.table}`}>
          <thead>
            <tr>
              <th>#</th>
              <th>Apellido y nombre</th>
              <th>Matrícula</th>
              <th>Especialidad</th>
              <th>Teléfono</th>
              <th>Honorarios totales</th>
              <th>Gastos sanatoriales</th>
              <th>Total</th>
              <th style={{ width: 80 }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {doctoresFiltrados.map((doc, i) => {
              const nombre = `${doc.apellido}, ${doc.nombre}`;
              const stats = statsporMedico.get(nombre) || { honorarios: 0, gastos: 0, gastoDetalle: [] };
              const waLink = doc.telefono ? `https://wa.me/${doc.telefono.replace(/[\s-]/g, '')}` : null;
              const isExp = expandedDoc === doc.id;
              return (
                <React.Fragment key={doc.id}>
                  <tr className={`${dashStyles.siniestroRow} ${isExp ? dashStyles.expanded : ''}`} onClick={() => setExpandedDoc(isExp ? null : doc.id)}>
                    <td><span className={dashStyles.nroSiniestro}>{doc.numero ?? i + 1}</span></td>
                    <td style={{ fontWeight: 500 }}>{doc.apellido}, {doc.nombre}</td>
                    <td><span className={dashStyles.artBadge}>{doc.matricula || '—'}</span></td>
                    <td style={{ color: '#94a3b8', fontSize: '0.9rem' }}>{doc.especialidad || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>{doc.telefono || '—'}</span>
                        {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className={dashStyles.waBadge} onClick={(e) => e.stopPropagation()} title="Enviar WhatsApp">WA</a>}
                      </div>
                    </td>
                    <td className={dashStyles.numBlue}>$ {money(stats.honorarios)}</td>
                    <td className={dashStyles.numAmber}>$ {money(stats.gastos)}{stats.gastoDetalle.length > 0 && <span className={dashStyles.gastoCount}>{stats.gastoDetalle.length}</span>}</td>
                    <td className={dashStyles.numGreen}>$ {money(stats.honorarios + stats.gastos)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Link href={`/admin/medicos/${doc.id}`} className={styles.btnEdit} title="Editar">✏️</Link>
                    </td>
                  </tr>
                  {isExp && stats.gastoDetalle.length > 0 && (
                    <tr>
                      <td colSpan={9} className={dashStyles.detailRow}>
                        <div className={dashStyles.detailContent}>
                          <h4 className={dashStyles.detailGroupTitle}>Gastos sanatoriales — {doc.apellido}, {doc.nombre}</h4>
                          <table className={dashStyles.detailTable}>
                            <thead>
                              <tr><th>Paciente</th><th>N° Siniestro</th><th>ART</th><th>Fecha</th><th>Código</th><th>Descripción</th><th>Monto</th></tr>
                            </thead>
                            <tbody>
                              {stats.gastoDetalle.sort((a, b) => b.fecha - a.fecha).map((g, gi) => (
                                <tr key={gi}>
                                  <td>{g.paciente}</td>
                                  <td className={dashStyles.detailCodigo}>{g.nroSiniestro}</td>
                                  <td><span className={dashStyles.artBadge}>{g.art}</span></td>
                                  <td>{formatDate(g.fecha)}</td>
                                  <td className={dashStyles.detailCodigo}>{g.codigo}</td>
                                  <td>{g.descripcion}</td>
                                  <td className={`${dashStyles.num} ${dashStyles.detailTotal}`}>$ {money(g.monto)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          <div className={dashStyles.detailTotales}>
                            <span className={dashStyles.detailTotalFinal}>Total gastos: <strong>$ {money(stats.gastos)}</strong></span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  {isExp && stats.gastoDetalle.length === 0 && (
                    <tr>
                      <td colSpan={9} style={{ background: '#0f172a', padding: '1rem 1.5rem', color: '#64748b', fontStyle: 'italic', fontSize: '0.9rem' }}>
                        Sin gastos sanatoriales registrados
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function rolColor(rol) {
  const colors = {
    Cirujano: '#185FA5', Ayudante: '#0F6E56', 'Ayudante 2': '#3B6D11',
    Anestesista: '#854F0B', 'Bioquímico/a': '#993C1D', Profesional: '#534AB7'
  };
  for (const key of Object.keys(colors)) if (rol?.includes(key)) return colors[key];
  return '#888780';
}
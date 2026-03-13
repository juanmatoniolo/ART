'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import useDoctors from './hooks/useDoctors';
import { money, safeNum } from '../Facturacion/utils/calculos';
import styles from './medicos.module.css';
import dashStyles from './dashboard.module.css';

function getLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().split('T')[0];
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(Number(ts));
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function normTs(fact) {
  return Number(fact.cerradoAt ?? fact.updatedAt ?? fact.createdAt) || 0;
}

const ROL_COLORS = {
  Cirujano: '#185FA5',
  Ayudante: '#0F6E56',
  'Ayudante 2': '#3B6D11',
  Anestesista: '#854F0B',
  'Bioquímico/a': '#993C1D',
  Profesional: '#534AB7',
};

function rolColor(rol) {
  for (const key of Object.keys(ROL_COLORS)) {
    if (rol?.includes(key)) return ROL_COLORS[key];
  }
  return '#888780';
}

function getWhatsAppLink(telefono) {
  if (!telefono) return null;
  let n = telefono.trim().replace(/[\s-]/g, '');
  if (!n.startsWith('+')) n = n.startsWith('549') ? `+${n}` : `+549${n}`;
  return `https://wa.me/${encodeURIComponent(n)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: carga todas las facturas una sola vez
// ─────────────────────────────────────────────────────────────────────────────
function useFacturas() {
  const [facturas, setFacturas] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onValue(
      ref(db, 'Facturacion'),
      (snap) => { setFacturas(snap.exists() ? snap.val() : {}); setLoading(false); },
      () => { setFacturas({}); setLoading(false); }
    );
    return () => unsubscribe();
  }, []);

  return { facturas, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN: Directorio de médicos
// ─────────────────────────────────────────────────────────────────────────────
function DirectorioMedicos({ doctors, facturas }) {
  const [expandedDoc, setExpandedDoc] = useState(null);
  const [busqueda, setBusqueda] = useState('');

  // Calcula totales por médico y recolecta gastos sanatoriales con datos de paciente
  const statsporMedico = useMemo(() => {
    const map = new Map();

    Object.values(facturas).forEach((fact) => {
      if (!fact || typeof fact !== 'object') return;

      const paciente = fact.nombreCompleto || fact.paciente?.nombreCompleto || '—';
      const nroSiniestro = fact.nroSiniestro || '—';
      const art = fact.artSeguro || fact.paciente?.artSeguro || '—';
      const fecha = normTs(fact);

      const procesarItems = (items) => {
        (items || []).forEach((it) => {
          const nombre = it?.prestadorNombre?.trim();
          if (!nombre) return;

          if (!map.has(nombre)) {
            map.set(nombre, { honorarios: 0, gastos: 0, gastoDetalle: [] });
          }
          const entry = map.get(nombre);
          entry.honorarios += safeNum(it?.honorarioMedico);

          const gasto = safeNum(it?.gastoSanatorial);
          if (gasto > 0) {
            entry.gastos += gasto;
            entry.gastoDetalle.push({
              paciente,
              nroSiniestro,
              art,
              fecha,
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
    return doctors.filter(
      (d) =>
        !q ||
        d.apellido?.toLowerCase().includes(q) ||
        d.nombre?.toLowerCase().includes(q) ||
        d.matricula?.toLowerCase().includes(q) ||
        d.especialidad?.toLowerCase().includes(q)
    );
  }, [doctors, busqueda]);

  return (
    <div className={dashStyles.section}>
      <div className={dashStyles.sectionHeader}>
        <h2 className={dashStyles.sectionTitle}>Directorio de médicos</h2>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            type="text"
            className={dashStyles.textInput}
            placeholder="Buscar médico..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <Link href="/admin/medicos/nuevo" className={styles.btnPrimary} style={{ whiteSpace: 'nowrap' }}>
            + Nuevo médico
          </Link>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        <table className={`${styles.table} ${dashStyles.siniestroTable}`}>
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
              const waLink = getWhatsAppLink(doc.telefono);
              const isExp = expandedDoc === doc.id;

              return (
                <React.Fragment key={doc.id}>
                  <tr
                    className={`${dashStyles.siniestroRow} ${isExp ? dashStyles.expanded : ''}`}
                    onClick={() => setExpandedDoc(isExp ? null : doc.id)}
                  >
                    <td><span className={dashStyles.nroSiniestro}>{doc.numero ?? i + 1}</span></td>
                    <td style={{ fontWeight: 500 }}>{doc.apellido}, {doc.nombre}</td>
                    <td><span className={dashStyles.artBadge}>{doc.matricula || '—'}</span></td>
                    <td style={{ color: '#a0a0c0', fontSize: '0.9rem' }}>{doc.especialidad || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontSize: '0.9rem' }}>{doc.telefono || '—'}</span>
                        {waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={dashStyles.waBadge}
                            onClick={(e) => e.stopPropagation()}
                            title="Enviar WhatsApp"
                          >
                            WA
                          </a>
                        )}
                      </div>
                    </td>
                    <td className={dashStyles.detailNum} style={{ color: '#5b9bd5' }}>
                      $ {money(stats.honorarios)}
                    </td>
                    <td className={dashStyles.detailNum} style={{ color: '#d4a04a' }}>
                      $ {money(stats.gastos)}
                      {stats.gastoDetalle.length > 0 && (
                        <span className={dashStyles.gastoCount}>{stats.gastoDetalle.length}</span>
                      )}
                    </td>
                    <td className={dashStyles.detailNum} style={{ color: '#6abd72', fontWeight: 600 }}>
                      $ {money(stats.honorarios + stats.gastos)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <Link href={`/admin/medicos/${doc.id}`} className={styles.btnEdit} title="Editar">✏️</Link>
                      </div>
                    </td>
                  </tr>

                  {/* ── Detalle de gastos sanatoriales expandible ───────── */}
                  {isExp && stats.gastoDetalle.length > 0 && (
                    <tr key={`${doc.id}-gastos`}>
                      <td colSpan={9} className={dashStyles.detailRow} style={{ padding: 0 }}>
                        <div className={dashStyles.detailContent}>
                          <h4 className={dashStyles.detailGroupTitle}>
                            Gastos sanatoriales — {doc.apellido}, {doc.nombre}
                          </h4>
                          <table className={dashStyles.detailTable}>
                            <thead>
                              <tr>
                                <th>Paciente</th>
                                <th>N° Siniestro</th>
                                <th>ART</th>
                                <th>Fecha</th>
                                <th>Código</th>
                                <th>Descripción</th>
                                <th>Monto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {stats.gastoDetalle
                                .sort((a, b) => b.fecha - a.fecha)
                                .map((g, gi) => (
                                  <tr key={gi}>
                                    <td>{g.paciente}</td>
                                    <td className={dashStyles.detailCodigo}>{g.nroSiniestro}</td>
                                    <td><span className={dashStyles.artBadge}>{g.art}</span></td>
                                    <td>{formatDate(g.fecha)}</td>
                                    <td className={dashStyles.detailCodigo}>{g.codigo}</td>
                                    <td>{g.descripcion}</td>
                                    <td className={`${dashStyles.detailNum} ${dashStyles.detailTotal}`}>
                                      $ {money(g.monto)}
                                    </td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                          <div className={dashStyles.detailTotales}>
                            <span className={dashStyles.detailTotalFinal}>
                              Total gastos: <strong>$ {money(stats.gastos)}</strong>
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {isExp && stats.gastoDetalle.length === 0 && (
                    <tr key={`${doc.id}-empty`}>
                      <td colSpan={9} style={{ background: '#1e1e30', padding: '1rem 1.5rem', color: '#6060a0', fontStyle: 'italic', fontSize: '0.9rem' }}>
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

// ─────────────────────────────────────────────────────────────────────────────
// SECCIÓN: Balance individual por médico
// ─────────────────────────────────────────────────────────────────────────────
function BalanceMedico({ doctors, facturas }) {
  const today = useMemo(getLocalDate, []);

  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState(today);
  const [sortBy, setSortBy] = useState('fecha');
  const [sortDir, setSortDir] = useState('desc');
  const [searchSiniestro, setSearchSiniestro] = useState('');
  const [expandedSiniestro, setExpandedSiniestro] = useState(null);

  const doctorName = useMemo(() => {
    if (!selectedDoctor) return '';
    const d = doctors.find((doc) => doc.id === selectedDoctor);
    return d ? `${d.apellido}, ${d.nombre}` : '';
  }, [selectedDoctor, doctors]);

  const siniestros = useMemo(() => {
    if (!selectedDoctor || !doctorName) return [];

    const desdeTs = fechaDesde ? new Date(`${fechaDesde}T00:00:00`).getTime() : null;
    const hastaTs = fechaHasta ? new Date(`${fechaHasta}T23:59:59.999`).getTime() : null;

    const results = [];

    Object.entries(facturas).forEach(([id, fact]) => {
      if (!fact || typeof fact !== 'object') return;

      const ts = normTs(fact);
      if (desdeTs && ts < desdeTs) return;
      if (hastaTs && ts > hastaTs) return;

      const matchName = (nombre) =>
        nombre && nombre.trim().toLowerCase() === doctorName.trim().toLowerCase();

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
        art: fact.artSeguro || fact.paciente?.artSeguro || '—',
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

  const topPracticas = useMemo(() => {
    const map = new Map();
    siniestros.forEach((s) => {
      [...s.practicas, ...s.cirugias, ...s.laboratorios].forEach((p) => {
        const key = p.codigo || p.descripcion || p.nombre || '?';
        const desc = p.descripcion || p.nombre || key;
        const rol = p.prestadorRol || 'Profesional';
        const prev = map.get(key) || { codigo: key, desc, rol, count: 0, total: 0 };
        prev.count++;
        prev.total += safeNum(p?.honorarioMedico);
        map.set(key, prev);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [siniestros]);

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
      {/* ── Filtros ─────────────────────────────────────────────────────────── */}
      <div className={dashStyles.filterBar}>
        <div className={dashStyles.filterGroup}>
          <label>Médico</label>
          <select
            className={dashStyles.select}
            value={selectedDoctor}
            onChange={(e) => { setSelectedDoctor(e.target.value); setExpandedSiniestro(null); }}
          >
            <option value="">— Seleccionar —</option>
            {doctors.map((d, i) => (
              <option key={d.id} value={d.id}>
                {i + 1} — {d.apellido}, {d.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className={dashStyles.filterGroup}>
          <label>Desde</label>
          <input type="date" className={dashStyles.dateInput} value={fechaDesde} max={fechaHasta || undefined} onChange={(e) => setFechaDesde(e.target.value)} />
        </div>

        <div className={dashStyles.filterGroup}>
          <label>Hasta</label>
          <input type="date" className={dashStyles.dateInput} value={fechaHasta} min={fechaDesde || undefined} onChange={(e) => setFechaHasta(e.target.value)} />
        </div>

        <div className={dashStyles.filterGroup}>
          <label>N° siniestro</label>
          <input type="text" className={dashStyles.textInput} placeholder="Buscar..." value={searchSiniestro} onChange={(e) => setSearchSiniestro(e.target.value)} />
        </div>
      </div>

      {!selectedDoctor && (
        <div className={dashStyles.emptyState}>Seleccioná un médico para ver su balance</div>
      )}

      {selectedDoctor && (
        <>
          {/* ── Métricas ──────────────────────────────────────────────────── */}
          <div className={dashStyles.metricsRow}>
            <div className={dashStyles.metricCard}>
              <span className={dashStyles.metricLabel}>Siniestros</span>
              <strong className={dashStyles.metricValue}>{totales.siniestros}</strong>
            </div>
            <div className={dashStyles.metricCard}>
              <span className={dashStyles.metricLabel}>Prácticas / cirugías</span>
              <strong className={dashStyles.metricValue}>{totales.practicas}</strong>
            </div>
            <div className={dashStyles.metricCard}>
              <span className={dashStyles.metricLabel}>Honorarios</span>
              <strong className={`${dashStyles.metricValue} ${dashStyles.colorBlue}`}>$ {money(totales.honorarios)}</strong>
            </div>
            <div className={dashStyles.metricCard}>
              <span className={dashStyles.metricLabel}>Gastos sanatoriales</span>
              <strong className={`${dashStyles.metricValue} ${dashStyles.colorAmber}`}>$ {money(totales.gastos)}</strong>
            </div>
            <div className={dashStyles.metricCard}>
              <span className={dashStyles.metricLabel}>Total general</span>
              <strong className={`${dashStyles.metricValue} ${dashStyles.colorGreen}`}>$ {money(totales.total)}</strong>
            </div>
          </div>

          {/* ── Top prácticas ──────────────────────────────────────────────── */}
          {topPracticas.length > 0 && (
            <div className={dashStyles.section}>
              <h2 className={dashStyles.sectionTitle}>Prácticas más frecuentes</h2>
              <div className={dashStyles.topPracticas}>
                {topPracticas.map((p) => (
                  <div key={p.codigo} className={dashStyles.practicaChip}>
                    <span className={dashStyles.rolDot} style={{ background: rolColor(p.rol) }} />
                    <div className={dashStyles.practicaInfo}>
                      <span className={dashStyles.practicaCodigo}>{p.codigo}</span>
                      <span className={dashStyles.practicaDesc}>{p.desc}</span>
                    </div>
                    <div className={dashStyles.practicaStats}>
                      <span className={dashStyles.practicaCount}>{p.count}×</span>
                      <span className={dashStyles.practicaMonto}>$ {money(p.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Tabla de siniestros ────────────────────────────────────────── */}
          <div className={dashStyles.section}>
            <h2 className={dashStyles.sectionTitle}>
              Participación en siniestros — {doctorName}
              {siniestros.length > 0 && <span className={dashStyles.siniestroCount}>{siniestros.length}</span>}
            </h2>

            {siniestros.length === 0 ? (
              <div className={dashStyles.emptyState}>Sin resultados para el período seleccionado</div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={`${styles.table} ${dashStyles.siniestroTable}`}>
                  <thead>
                    <tr>
                      <th className={dashStyles.thSortable} onClick={() => toggleSort('nroSiniestro')}>
                        N° Siniestro <SortIcon col="nroSiniestro" />
                      </th>
                      <th>Paciente</th>
                      <th>ART</th>
                      <th className={dashStyles.thSortable} onClick={() => toggleSort('fecha')}>
                        Fecha <SortIcon col="fecha" />
                      </th>
                      <th>Prácticas</th>
                      <th className={dashStyles.thSortable} onClick={() => toggleSort('total')}>
                        Honorarios / Total <SortIcon col="total" />
                      </th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {siniestros.map((s) => (
                      // ✅ React.Fragment con key en lugar de <> para evitar el warning
                      <React.Fragment key={s.id}>
                        <tr
                          className={`${dashStyles.siniestroRow} ${expandedSiniestro === s.id ? dashStyles.expanded : ''}`}
                          onClick={() => setExpandedSiniestro(expandedSiniestro === s.id ? null : s.id)}
                        >
                          <td><span className={dashStyles.nroSiniestro}>{s.nroSiniestro}</span></td>
                          <td>{s.paciente}</td>
                          <td><span className={dashStyles.artBadge}>{s.art}</span></td>
                          <td>{formatDate(s.fecha)}</td>
                          <td>
                            <span className={dashStyles.practicasBadge}>
                              {s.practicas.length + s.cirugias.length + s.laboratorios.length}
                            </span>
                          </td>
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
                            <td colSpan={7} style={{ padding: 0, background: '#1e1e30', borderTop: 'none' }}>
                              <div className={dashStyles.detailContent}>
                                {[
                                  { label: 'Prácticas', items: s.practicas },
                                  { label: 'Cirugías', items: s.cirugias },
                                  { label: 'Laboratorios', items: s.laboratorios },
                                ]
                                  .filter((g) => g.items.length > 0)
                                  .map((group) => (
                                    <div key={group.label} className={dashStyles.detailGroup}>
                                      <h4 className={dashStyles.detailGroupTitle}>{group.label}</h4>
                                      <table className={dashStyles.detailTable}>
                                        <thead>
                                          <tr>
                                            <th>Código</th>
                                            <th>Descripción</th>
                                            <th>Rol</th>
                                            <th>Cant.</th>
                                            <th>Honorario</th>
                                            <th>Gasto</th>
                                            <th>Total</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.items.map((p, i) => (
                                            <tr key={i}>
                                              <td className={dashStyles.detailCodigo}>{p.codigo || '—'}</td>
                                              <td>{p.descripcion || p.nombre || '—'}</td>
                                              <td>
                                                <span
                                                  className={dashStyles.rolPill}
                                                  style={{
                                                    background: rolColor(p.prestadorRol) + '22',
                                                    color: rolColor(p.prestadorRol),
                                                    border: `1px solid ${rolColor(p.prestadorRol)}44`,
                                                  }}
                                                >
                                                  {p.prestadorRol || 'Profesional'}
                                                </span>
                                              </td>
                                              <td className={dashStyles.detailNum}>{p.cantidad ?? 1}</td>
                                              <td className={dashStyles.detailNum}>$ {money(p.honorarioMedico ?? 0)}</td>
                                              <td className={dashStyles.detailNum}>$ {money(p.gastoSanatorial ?? 0)}</td>
                                              <td className={`${dashStyles.detailNum} ${dashStyles.detailTotal}`}>
                                                $ {money(safeNum(p.honorarioMedico) + safeNum(p.gastoSanatorial))}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  ))}

                                <div className={dashStyles.detailTotales}>
                                  <span>Honorarios: <strong>$ {money(s.honorarios)}</strong></span>
                                  <span>Gastos: <strong>$ {money(s.gastos)}</strong></span>
                                  <span className={dashStyles.detailTotalFinal}>
                                    Total: <strong>$ {money(s.total)}</strong>
                                  </span>
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

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

const TABS = [
  { id: 'balance', label: 'Balance por médico' },
  { id: 'directorio', label: 'Directorio' },
];

export default function DashboardMedicosPage() {
  const { doctors, loading: loadingDoctors } = useDoctors();
  const { facturas, loading: loadingFacturas } = useFacturas();
  const [activeTab, setActiveTab] = useState('balance');

  const loading = loadingDoctors || loadingFacturas;

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>Dashboard de médicos</h1>
        <Link href="/admin/medicos" className={styles.btnSecondary}>← Volver</Link>
      </header>

      {/* ── Tabs ─────────────────────────────────────────────────────────────── */}
      <div className={dashStyles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`${dashStyles.tab} ${activeTab === t.id ? dashStyles.tabActive : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className={styles.loading}>Cargando datos...</div>}

      {!loading && activeTab === 'balance' && (
        <BalanceMedico doctors={doctors} facturas={facturas} />
      )}

      {!loading && activeTab === 'directorio' && (
        <DirectorioMedicos doctors={doctors} facturas={facturas} />
      )}
    </div>
  );
}
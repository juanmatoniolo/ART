'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ref, update, remove, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money } from '../utils/calculos';
import { cerrarPacientePorFactura } from '../utils/siniestroPacienteSync';
import useFacturados from './Hook/useFacturados';
import styles from './facturados.module.css';

const fmtDate = (ms) => {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString('es-AR');
  } catch {
    return '—';
  }
};

export default function FacturadosPage() {
  const {
    loading,
    q, setQ,
    estado, setEstadoQuery,
    art, setArt,
    orden, setOrden,
    fechaDesde, setFechaDesde,
    fechaHasta, setFechaHasta,
    selectedIds, toggleSelect, toggleSelectAll,
    deleting, deleteSelected,
    exportCompleto, exportJson, printART,
    counts, arts, filtered,
  } = useFacturados();

  const [showMore, setShowMore] = useState(false);
  const [busyId, setBusyId] = useState('');

  const allSelected = selectedIds.size === filtered.length && filtered.length > 0;
  const haySeleccion = selectedIds.size > 0;

  // ----- Acciones por tarjeta -----
  const marcarFacturado = useCallback(async (id) => {
    if (!window.confirm('¿Pasar este borrador a FACTURADO / CERRADO?')) return;
    setBusyId(id);
    try {
      const snap = await get(ref(db, `Facturacion/${id}`));
      if (!snap.exists()) return alert('Ya no existe este registro.');
      const prev = snap.val();
      const now = Date.now();
      const facturaNro = prev?.facturaNro || `FAC-${new Date().getFullYear()}-${now}`;

      await update(ref(db, `Facturacion/${id}`), {
        estado: 'cerrado', cerradoAt: now, updatedAt: now, facturaNro,
      });
      await cerrarPacientePorFactura(
        { id, ...prev, estado: 'cerrado', cerradoAt: now, facturaNro }, id
      );
      alert(`✅ Marcado como CERRADO.\nFactura: ${facturaNro}`);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error al marcar como facturado.');
    } finally {
      setBusyId('');
    }
  }, []);

  const eliminarUno = useCallback(async (id) => {
    if (!window.confirm('¿Eliminar este registro definitivamente?')) return;
    setBusyId(id);
    try {
      const snap = await get(ref(db, `Facturacion/${id}`));
      const prev = snap.exists() ? snap.val() : null;
      await remove(ref(db, `Facturacion/${id}`));
      if (prev?.siniestroKey) {
        // limpieza informativa (el nodo puede no existir)
        await remove(ref(db, `Facturacion/siniestros/${prev.siniestroKey}`)).catch(() => { });
      }
      alert('🗑️ Registro eliminado.');
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error al eliminar.');
    } finally {
      setBusyId('');
    }
  }, []);

  const tabs = [
    { key: 'todos', label: 'Todos', count: counts.total },
    { key: 'borrador', label: 'Borradores', count: counts.borradores },
    { key: 'cerrado', label: 'Cerrados', count: counts.cerrados },
  ];

  return (
    <div className={styles.container}>
      {/* ENCABEZADO */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>📦 Facturación</h1>
            <p className={styles.subtitle}>Borradores y facturas cerradas, todo en un solo lugar.</p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/Facturacion" className={styles.btnGhost}>← Volver</Link>
            <Link href="/admin/Facturacion/Nuevo?new=1" className={styles.btnPrimary}>➕ Nueva</Link>
          </div>
        </div>

        {/* TABS DE ESTADO */}
        <div className={styles.tabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${estado === t.key ? styles.tabActive : ''}`}
              onClick={() => setEstadoQuery(t.key)}
            >
              {t.label}
              <span className={styles.tabCount}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* FILTROS */}
        <div className={styles.filters}>
          <input
            className={styles.search}
            placeholder="🔎 Buscar paciente, DNI, siniestro, ART, factura…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className={styles.select} value={art} onChange={(e) => setArt(e.target.value)}>
            <option value="">Todas las ART</option>
            {arts.map((a) => (
              <option key={a.key} value={a.key}>{a.name}</option>
            ))}
          </select>
          <select className={styles.select} value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="fecha_desc">Más recientes</option>
            <option value="fecha_asc">Más antiguos</option>
            <option value="nombre_asc">Nombre A→Z</option>
            <option value="nombre_desc">Nombre Z→A</option>
            <option value="total_desc">Mayor total</option>
            <option value="total_asc">Menor total</option>
          </select>
          <button className={styles.btnLink} onClick={() => setShowMore((s) => !s)}>
            {showMore ? '▲ Menos' : '▼ Fechas'}
          </button>
        </div>

        {showMore && (
          <div className={styles.dateRow}>
            <label>Desde <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} /></label>
            <label>Hasta <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} /></label>
            {(fechaDesde || fechaHasta) && (
              <button className={styles.btnLink} onClick={() => { setFechaDesde(''); setFechaHasta(''); }}>
                Limpiar fechas
              </button>
            )}
          </div>
        )}

        {/* BARRA DE SELECCIÓN / ACCIONES MASIVAS */}
        <div className={styles.bulkBar}>
          <label className={styles.checkAll}>
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            <span>{haySeleccion ? `${selectedIds.size} seleccionado(s)` : 'Seleccionar todos'}</span>
          </label>
          {haySeleccion && (
            <div className={styles.bulkActions}>
              <button className={styles.btnInfo} onClick={exportCompleto}>📊 Exportar Excel</button>
              <button className={styles.btnJson} onClick={exportJson}>JSON</button>
              <button className={styles.btnDanger} onClick={deleteSelected} disabled={deleting}>
                {deleting ? 'Eliminando…' : '🗑️ Eliminar'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* LISTA */}
      <main className={styles.content}>
        {loading ? (
          <div className={styles.empty}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay registros con estos filtros.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((it) => {
              const busy = busyId === it.id;
              const esCerrado = it.estado === 'cerrado';
              return (
                <article key={it.id} className={`${styles.card} ${esCerrado ? styles.cardClosed : ''}`}>
                  <div className={styles.cardTop}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(it.id)}
                      onChange={() => toggleSelect(it.id)}
                      disabled={busy}
                    />
                    <span className={`${styles.badge} ${esCerrado ? styles.badgeClosed : styles.badgeDraft}`}>
                      {esCerrado ? '✅ CERRADO' : '📝 BORRADOR'}
                    </span>
                    <span className={styles.date}>📅 {fmtDate(it.fecha)}</span>
                    <span className={styles.total}>$ {money(it.total || 0)}</span>
                  </div>

                  <div className={styles.name}>{it.pacienteNombre || 'Sin nombre'}</div>

                  <div className={styles.pills}>
                    <span className={styles.pill}>DNI: {it.dni || '—'}</span>
                    <span className={styles.pill}>Stro: {it.nroSiniestro || '—'}</span>
                    <span className={styles.pill}>{it.artNombre || 'SIN ART'}</span>
                    {esCerrado && it.facturaNro && (
                      <span className={`${styles.pill} ${styles.pillFactura}`}>🧾 {it.facturaNro}</span>
                    )}
                  </div>

                  <div className={styles.actions}>
                    {!esCerrado && (
                      <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/admin/Facturacion/Nuevo?draft=${it.id}`}>
                        ▶ Retomar
                      </Link>
                    )}
                    <Link className={`${styles.btn} ${styles.btnGhost}`} href={`/admin/Facturacion/Facturados/${it.id}`}>
                      👁 Ver
                    </Link>
                    <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => printART(it.id)} disabled={busy}>
                      🖨️ Imprimir
                    </button>
                    {!esCerrado && (
                      <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={() => marcarFacturado(it.id)} disabled={busy}>
                        ✅ Facturar
                      </button>
                    )}
                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => eliminarUno(it.id)} disabled={busy}>
                      🗑️
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

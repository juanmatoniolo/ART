'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { ref, onValue, update, remove, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, parseNumber } from '../../utils/calculos';
import styles from './page.module.css';

const normalizeKey = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const norm = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const fmtDate = (ms) => {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString('es-AR');
  } catch {
    return '—';
  }
};

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : parseNumber(v);
  return Number.isFinite(n) ? n : 0;
};

export default function BorradoresPage() {
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState('');
  const [art, setArt] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [busyId, setBusyId] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const r = ref(db, 'Facturacion');
    return onValue(
      r,
      (snap) => {
        setData(snap.exists() ? snap.val() : {});
        setLoading(false);
      },
      (err) => {
        console.error(err);
        setData({});
        setLoading(false);
      }
    );
  }, []);

  const items = useMemo(() => {
    const obj = data || {};
    const arr = Object.entries(obj).map(([id, v]) => {
      const pacienteNombre =
        v?.paciente?.nombreCompleto ||
        v?.pacienteNombre ||
        v?.paciente?.nombre ||
        v?.nombrePaciente ||
        '';
      const dni = v?.paciente?.dni || v?.dni || '';
      const nroSiniestro = v?.paciente?.nroSiniestro || v?.nroSiniestro || '';
      const artNombre = v?.paciente?.artSeguro || v?.artNombre || v?.artSeguro || 'SIN ART';
      const artKey = v?.artKey || normalizeKey(artNombre);

      // Determinar estado: si tiene cerradoAt o closedAt, es cerrado; si no, es borrador
      const cerradoAt = v?.cerradoAt || v?.closedAt || 0;
      const estado = v?.estado || (cerradoAt ? 'cerrado' : 'borrador');
      const updatedAt = v?.updatedAt || v?.createdAt || 0;

      const total =
        v?.totales?.total ??
        v?.total ??
        (Number(v?.totales?.honorarios || 0) + Number(v?.totales?.gastos || 0)) ??
        0;

      return {
        id,
        pacienteNombre,
        dni,
        nroSiniestro,
        artNombre,
        artKey,
        updatedAt,
        estado,
        cerradoAt,
        siniestroKey: v?.siniestroKey || '',
        total,
      };
    });

    return arr
      .filter((it) => it.estado === 'borrador')
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }, [data]);

  const arts = useMemo(() => {
    const map = new Map();
    items.forEach((it) => {
      const key = it.artKey || normalizeKey(it.artNombre || '');
      const name = it.artNombre || it.artKey || 'SIN ART';
      if (!map.has(key)) map.set(key, name);
    });
    return Array.from(map.entries())
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    const qq = norm(q);
    return items.filter((it) => {
      if (art && (it.artKey || '') !== art) return false;
      if (!qq) return true;
      const blob = norm(`${it.pacienteNombre || ''} ${it.dni || ''} ${it.nroSiniestro || ''} ${it.artNombre || ''}`);
      return blob.includes(qq);
    });
  }, [items, q, art]);

  // Handlers de selección
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((it) => it.id)));
    }
  };

  const isAllSelected = selectedIds.size === filtered.length && filtered.length > 0;

  // =========================
  // ✅ Acciones
  // =========================

  const marcarComoFacturado = useCallback(async (id) => {
    setErrorMsg('');
    const ok = window.confirm('¿Pasar este borrador a FACTURADO/CERRADO?');
    if (!ok) return;

    setBusyId(id);
    try {
      const snap = await get(ref(db, `Facturacion/${id}`));
      if (!snap.exists()) {
        setErrorMsg('No existe el borrador (ya fue eliminado).');
        return;
      }

      const prev = snap.val();
      const now = Date.now();

      const prevEstado = prev?.estado || (prev?.cerradoAt ? 'cerrado' : 'borrador');
      if (prevEstado === 'cerrado') {
        setErrorMsg('Este siniestro ya está cerrado.');
        return;
      }

      const facturaNro = prev?.facturaNro || `FAC-${new Date().getFullYear()}-${now}`;

      await update(ref(db, `Facturacion/${id}`), {
        estado: 'cerrado',
        cerradoAt: now,
        updatedAt: now,
        facturaNro,
      });

      if (prev?.siniestroKey) {
        await update(ref(db, `Facturacion/siniestros/${prev.siniestroKey}`), {
          status: 'cerrado',
          id,
          updatedAt: now,
        });
      }

      alert(`✅ Listo. Se marcó como CERRADO.\nFactura: ${facturaNro}`);
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || 'Error al pasar a facturado.');
    } finally {
      setBusyId('');
    }
  }, []);

  const eliminarBorrador = useCallback(async (id) => {
    setErrorMsg('');
    const ok = window.confirm('¿Eliminar este borrador definitivamente?');
    if (!ok) return;

    setBusyId(id);
    try {
      const snap = await get(ref(db, `Facturacion/${id}`));
      const prev = snap.exists() ? snap.val() : null;

      await remove(ref(db, `Facturacion/${id}`));

      if (prev?.siniestroKey) {
        await remove(ref(db, `Facturacion/siniestros/${prev.siniestroKey}`));
      }

      alert('🗑️ Borrador eliminado.');
    } catch (e) {
      console.error(e);
      setErrorMsg(e?.message || 'Error al eliminar el borrador.');
    } finally {
      setBusyId('');
    }
  }, []);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>📝 Borradores</h1>
            <p className={styles.subtitle}>Retomá una carga guardada o cerrala como facturada.</p>
            {errorMsg && <div className={styles.alert}>{errorMsg}</div>}
          </div>

          <div className={styles.headerActions}>
            <Link href="/admin/Facturacion" className={styles.btnGhost}>
              ← Volver
            </Link>
            <Link href="/admin/Facturacion/Nuevo" className={styles.btnPrimary}>
              ➕ Nueva
            </Link>
          </div>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.filters}>
            <select className={styles.select} value={art} onChange={(e) => setArt(e.target.value)}>
              <option value="">Todas las ART</option>
              {arts.map((a) => (
                <option key={a.key} value={a.key}>
                  {a.name}
                </option>
              ))}
            </select>

            <input
              className={styles.input}
              placeholder="Buscar paciente, DNI, siniestro..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            <label className={styles.checkboxAll}>
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={toggleSelectAll}
              />
              <span>Seleccionar todos</span>
            </label>
          </div>
        </div>
      </header>

      <main className={styles.content}>
        {loading ? (
          <div className={styles.empty}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay borradores.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((it) => {
              const busy = busyId === it.id;
              return (
                <article key={it.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <div className={styles.checkboxInline}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(it.id)}
                        onChange={() => toggleSelect(it.id)}
                        disabled={busy}
                      />
                    </div>
                    <div className={styles.state}>
                      <span className={`${styles.badge} ${styles.badgeDraft}`}>BORRADOR</span>
                      <span className={styles.date}>📅 {fmtDate(it.updatedAt)}</span>
                    </div>
                    <div className={styles.total}>
                      <span className={styles.totalLabel}>TOTAL</span>
                      <span className={styles.totalValue}>$ {money(it.total || 0)}</span>
                    </div>
                  </div>

                  <div className={styles.mainInfo}>
                    <div className={styles.name}>{it.pacienteNombre || 'Sin nombre'}</div>

                    <div className={styles.metaRow}>
                      <span className={styles.pill}>DNI: {it.dni || '—'}</span>
                      <span className={styles.pill}>Siniestro: {it.nroSiniestro || '—'}</span>
                      <span className={styles.pill}>{it.artNombre || 'SIN ART'}</span>
                    </div>

                    <div className={styles.actions}>
                      <Link
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        href={`/admin/Facturacion/Nuevo?draft=${it.id}`}
                      >
                        ▶ Retomar
                      </Link>
                      <Link
                        className={`${styles.btn} ${styles.btnInfo}`}
                        href={`/admin/Facturacion/Facturados/${it.id}`}
                      >
                        👁 Ver
                      </Link>
               
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => eliminarBorrador(it.id)}
                        disabled={busy}
                        title="Eliminar borrador"
                      >
                        🗑️ Eliminar
                      </button>
                    </div>
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
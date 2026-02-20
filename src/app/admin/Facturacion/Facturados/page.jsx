'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money } from '../utils/calculos';
import styles from './facturados.module.css';

const normalizeKey = (s) =>
    String(s ?? '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

const prettyLabel = (s) =>
    String(s ?? '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const norm = (s) =>
    String(s ?? '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();

const fmtDate = (ms) => {
    if (!ms) return '—';
    try {
        return new Date(ms).toLocaleString('es-AR');
    } catch {
        return '—';
    }
};

export default function FacturadosPage() {
    const sp = useSearchParams();
    const router = useRouter();

    const [raw, setRaw] = useState({});
    const [loading, setLoading] = useState(true);

    const [q, setQ] = useState('');
    const [estado, setEstado] = useState('todos'); // todos | cerrado | borrador
    const [art, setArt] = useState(''); // artKey

    // ✅ toma estado desde query (?estado=borrador|cerrado|todos)
    useEffect(() => {
        const e = sp.get('estado');
        if (e === 'cerrado' || e === 'borrador' || e === 'todos') {
            setEstado(e);
        }
        // no setear por defecto si no viene
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const r = ref(db, 'Facturacion');
        return onValue(
            r,
            (snap) => {
                setRaw(snap.exists() ? snap.val() : {});
                setLoading(false);
            },
            (err) => {
                console.error(err);
                setRaw({});
                setLoading(false);
            }
        );
    }, []);

    const items = useMemo(() => {
        const obj = raw || {};
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

            const estadoVal = v?.estado || (v?.cerradoAt ? 'cerrado' : 'borrador');
            const createdAt = v?.createdAt || 0;
            const closedAt = v?.cerradoAt || v?.closedAt || 0;
            const updatedAt = v?.updatedAt || 0;

            const total =
                v?.totales?.total ??
                v?.total ??
                (Number(v?.totales?.honorarios || 0) + Number(v?.totales?.gastos || 0)) ??
                0;

            const convenioNombre = v?.convenioNombre || v?.convenio || '—';
            const facturaNro = v?.facturaNro || '';

            return {
                id,
                estado: estadoVal,
                createdAt,
                closedAt,
                updatedAt,
                pacienteNombre,
                dni,
                nroSiniestro,
                artNombre,
                artKey,
                convenioNombre,
                facturaNro,
                total,
            };
        });

        // Orden: cerrados primero por fecha cierre, luego borradores por updatedAt/createdAt
        arr.sort((a, b) => {
            const aKey = a.estado === 'cerrado' ? (a.closedAt || a.createdAt) : (a.updatedAt || a.createdAt);
            const bKey = b.estado === 'cerrado' ? (b.closedAt || b.createdAt) : (b.updatedAt || b.createdAt);
            return (bKey || 0) - (aKey || 0);
        });

        return arr;
    }, [raw]);

    const counts = useMemo(() => {
        let cerrados = 0;
        let borradores = 0;
        items.forEach((it) => {
            if (it.estado === 'cerrado') cerrados += 1;
            else borradores += 1;
        });
        return { cerrados, borradores, total: items.length };
    }, [items]);

    const arts = useMemo(() => {
        const map = new Map();
        items.forEach((it) => {
            const key = it.artKey || normalizeKey(it.artNombre || '');
            const name = it.artNombre || 'SIN ART';
            if (!map.has(key)) map.set(key, name);
        });
        return Array.from(map.entries())
            .map(([key, name]) => ({ key, name }))
            .sort((a, b) => prettyLabel(a.name).localeCompare(prettyLabel(b.name)));
    }, [items]);

    const filtered = useMemo(() => {
        const qq = norm(q);
        return items.filter((it) => {
            if (estado !== 'todos' && it.estado !== estado) return false;
            if (art && (it.artKey || '') !== art) return false;
            if (!qq) return true;

            const blob = norm(
                `${it.pacienteNombre || ''} ${it.dni || ''} ${it.nroSiniestro || ''} ${it.artNombre || ''} ${it.convenioNombre || ''
                } ${it.facturaNro || ''}`
            );
            return blob.includes(qq);
        });
    }, [items, q, estado, art]);

    // ✅ helper para actualizar query sin recargar
    const setEstadoQuery = (next) => {
        const params = new URLSearchParams(sp.toString());
        if (!next || next === 'todos') params.delete('estado');
        else params.set('estado', next);
        router.push(`/admin/Facturacion/facturados?${params.toString()}`);
        setEstado(next || 'todos');
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>📦 Facturados / Siniestros</h1>
                        <p className={styles.subtitle}>Lista de cerrados y borradores desde Firebase (/Facturacion).</p>
                    </div>

                    <div className={styles.headerActions}>
                        <Link href="/admin/Facturacion" className={styles.btnGhost}>
                            ← Volver
                        </Link>
                        <Link href="/admin/Facturacion/Nuevo" className={styles.btnPrimary}>
                            ➕ Nueva factura
                        </Link>
                    </div>
                </div>

                {/* ✅ NUEVO: switch rápido por estado (compatible con tu panel) */}
                <div className={styles.quickSwitch}>
                    <button
                        type="button"
                        className={`${styles.switchBtn} ${estado === 'borrador' ? styles.switchBtnActive : ''}`}
                        onClick={() => setEstadoQuery('borrador')}
                    >
                        📝 Borradores ({counts.borradores})
                    </button>

                    <button
                        type="button"
                        className={`${styles.switchBtn} ${estado === 'cerrado' ? styles.switchBtnActive : ''}`}
                        onClick={() => setEstadoQuery('cerrado')}
                    >
                        ✅ Facturados ({counts.cerrados})
                    </button>

                    <button
                        type="button"
                        className={`${styles.switchBtn} ${estado === 'todos' ? styles.switchBtnActive : ''}`}
                        onClick={() => setEstadoQuery('todos')}
                    >
                        📄 Todos ({counts.total})
                    </button>
                </div>

                <div className={styles.chipsRow}>
                    <span className={`${styles.chip} ${styles.chipOk}`}>✅ Cerrados: {counts.cerrados}</span>
                    <span className={`${styles.chip} ${styles.chipDraft}`}>💾 Borradores: {counts.borradores}</span>
                    <span className={`${styles.chip} ${styles.chipTotal}`}>📄 Total: {counts.total}</span>
                </div>

                <div className={styles.toolbar}>
                    <div className={styles.searchBlock}>
                        <input
                            className={styles.search}
                            placeholder="Buscar por paciente, DNI, siniestro, ART, convenio, factura…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>

                    <div className={styles.filters}>
                        <select className={styles.select} value={estado} onChange={(e) => setEstadoQuery(e.target.value)}>
                            <option value="todos">Todos</option>
                            <option value="cerrado">Cerrados</option>
                            <option value="borrador">Borradores</option>
                        </select>

                        <select className={styles.select} value={art} onChange={(e) => setArt(e.target.value)}>
                            <option value="">Todas las ART</option>
                            {arts.map((a) => (
                                <option key={a.key} value={a.key}>
                                    {prettyLabel(a.name)}
                                </option>
                            ))}
                        </select>

                        <select className={styles.select} value="fecha_desc" onChange={() => { }}>
                            <option value="fecha_desc">Fecha ↓</option>
                        </select>
                    </div>
                </div>
            </header>

            <main className={styles.content}>
                {loading ? (
                    <div className={styles.empty}>Cargando…</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>No hay resultados con esos filtros.</div>
                ) : (
                    <div className={styles.grid}>
                        {filtered.map((it) => {
                            const isClosed = it.estado === 'cerrado';
                            const fecha = isClosed ? (it.closedAt || it.createdAt) : (it.updatedAt || it.createdAt);

                            return (
                                <article key={it.id} className={styles.card}>
                                    <div className={styles.cardTop}>
                                        <div className={styles.state}>
                                            <span className={`${styles.badge} ${isClosed ? styles.badgeOk : styles.badgeDraft}`}>
                                                {isClosed ? 'CERRADO' : 'BORRADOR'}
                                            </span>
                                            <div className={styles.date}>📅 {fmtDate(fecha)}</div>
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
                                            <span className={styles.pill}>{prettyLabel(it.artNombre || 'SIN ART')}</span>
                                            <span className={styles.pill}>Conv.: {prettyLabel(it.convenioNombre || '—')}</span>
                                        </div>

                                        {isClosed ? (
                                            <div className={styles.facturaLine}>🧾 Factura: {it.facturaNro || '—'}</div>
                                        ) : (
                                            <div className={styles.facturaLineMuted}>📝 Pendiente de cierre</div>
                                        )}

                                        <div className={styles.actions}>
                                            <Link className={styles.btn} href={`/admin/Facturacion/facturados/${it.id}`}>
                                                👁 Ver detalle
                                            </Link>

                                            {!isClosed && (
                                                <Link className={styles.btn} href={`/admin/Facturacion/Nuevo?draft=${it.id}`}>
                                                    ✏️ Retomar
                                                </Link>
                                            )}

                                            <button
                                                className={`${styles.btn} ${styles.btnGhostSmall}`}
                                                disabled
                                                title="Próximo paso: PDF/Excel"
                                            >
                                                ⬇️ Descargar
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
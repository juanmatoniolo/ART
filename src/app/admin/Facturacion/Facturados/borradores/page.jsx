'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { ref, onValue, update, remove, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from '../facturados.module.css';

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

export default function BorradoresPage() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);

    const [q, setQ] = useState('');
    const [art, setArt] = useState('');

    // UI feedback por fila
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
                v?.paciente?.nombreCompleto || v?.pacienteNombre || v?.paciente?.nombre || v?.nombrePaciente || '';
            const dni = v?.paciente?.dni || v?.dni || '';
            const nroSiniestro = v?.paciente?.nroSiniestro || v?.nroSiniestro || '';
            const artNombre = v?.paciente?.artSeguro || v?.artNombre || v?.artSeguro || 'SIN ART';
            const artKey = v?.artKey || normalizeKey(artNombre);

            const estado = v?.estado || (v?.cerradoAt ? 'cerrado' : 'borrador');

            return {
                id,
                pacienteNombre,
                dni,
                nroSiniestro,
                artNombre,
                artKey,
                updatedAt: v?.updatedAt || v?.createdAt || 0,
                estado,
                siniestroKey: v?.siniestroKey || '', // ✅ para liberar lock
            };
        });

        return arr.filter((it) => it.estado === 'borrador').sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
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

    // =========================
    // ✅ Acciones
    // =========================

    const marcarComoFacturado = useCallback(async (id) => {
        setErrorMsg('');
        const ok = window.confirm('¿Pasar este borrador a FACTURADO/CERRADO?');
        if (!ok) return;

        setBusyId(id);
        try {
            // Traigo snapshot para no pisar facturaNro si ya existe
            const snap = await get(ref(db, `Facturacion/${id}`));
            if (!snap.exists()) {
                setErrorMsg('No existe el borrador (ya fue eliminado).');
                return;
            }

            const prev = snap.val();
            const now = Date.now();

            // si ya estaba cerrado, no hacemos nada
            const prevEstado = prev?.estado || (prev?.cerradoAt ? 'cerrado' : 'borrador');
            if (prevEstado === 'cerrado') {
                setErrorMsg('Este siniestro ya está cerrado.');
                return;
            }

            const facturaNro = prev?.facturaNro || `FAC-${new Date().getFullYear()}-${now}`;

            // 1) actualizar registro principal
            await update(ref(db, `Facturacion/${id}`), {
                estado: 'cerrado',
                cerradoAt: now,
                updatedAt: now,
                facturaNro,
            });

            // 2) actualizar lock si existe siniestroKey
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
            // leo para obtener siniestroKey (y no romper lock)
            const snap = await get(ref(db, `Facturacion/${id}`));
            const prev = snap.exists() ? snap.val() : null;

            // 1) borrar registro
            await remove(ref(db, `Facturacion/${id}`));

            // 2) liberar lock si existía
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
                        {errorMsg ? <div className={styles.alert}>{errorMsg}</div> : null}
                    </div>

                    <div className={styles.headerActions}>
                        <Link href="/admin/facturacion" className={styles.btnGhost}>
                            ← Volver
                        </Link>
                        <Link href="/admin/facturacion/nuevo" className={styles.btnPrimary}>
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
                            placeholder="Buscar por paciente / DNI / siniestro…"
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                        />
                    </div>
                </div>
            </header>

            <main className={styles.content}>
                {loading ? (
                    <div className={styles.empty}>Cargando…</div>
                ) : filtered.length === 0 ? (
                    <div className={styles.empty}>No hay borradores.</div>
                ) : (
                    <div className={styles.list}>
                        {filtered.map((it) => {
                            const busy = busyId === it.id;

                            return (
                                <div key={it.id} className={styles.rowCard}>
                                    <div className={styles.rowTop}>
                                        <div className={styles.rowTitle}>{it.pacienteNombre || 'Sin nombre'}</div>
                                        <div className={styles.meta}>
                                            <span className={styles.pill}>DNI: {it.dni || '—'}</span>
                                            <span className={styles.pill}>Siniestro: {it.nroSiniestro || '—'}</span>
                                            <span className={styles.pill}>{it.artNombre || 'SIN ART'}</span>
                                        </div>
                                    </div>

                                    <div className={styles.actions}>
                                        <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/admin/Facturacion/Nuevo?draft=${it.id}`}>
                                            ▶ Retomar
                                        </Link>

                                        <Link className={styles.btn} href={`/admin/Facturacion/Facturados/${it.id}`}>
                                            👁 Ver detalle
                                        </Link>

                                        <button
                                            type="button"
                                            className={`${styles.btn} ${styles.btnOk}`}
                                            onClick={() => marcarComoFacturado(it.id)}
                                            disabled={busy}
                                            title="Cierra el borrador como facturado"
                                        >
                                            ✅ Facturar
                                        </button>

                                        <button
                                            type="button"
                                            className={`${styles.btn} ${styles.btnDanger}`}
                                            onClick={() => eliminarBorrador(it.id)}
                                            disabled={busy}
                                            title="Elimina el borrador de la base"
                                        >
                                            🗑️ Eliminar
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>
        </div>
    );
}
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money } from '../../utils/calculos';
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

export default function CerradosPage() {
    const [data, setData] = useState({});
    const [loading, setLoading] = useState(true);

    const [q, setQ] = useState('');
    const [art, setArt] = useState('');

    useEffect(() => {
        const r = ref(db, 'Facturacion/index/cerrados');
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
        const arr = Object.values(data || {});
        arr.sort((a, b) => (b.closedAt || 0) - (a.closedAt || 0));
        return arr;
    }, [data]);

    const arts = useMemo(() => {
        const map = new Map();
        items.forEach((it) => {
            const key = it.artKey || normalizeKey(it.artNombre || '');
            const name = it.artNombre || it.artKey || 'SIN ART';
            if (!map.has(key)) map.set(key, name);
        });
        return Array.from(map.entries()).map(([key, name]) => ({ key, name }));
    }, [items]);

    const filtered = useMemo(() => {
        const qq = norm(q);
        return items.filter((it) => {
            if (art && (it.artKey || '') !== art) return false;
            if (!qq) return true;
            const blob = norm(
                `${it.pacienteNombre || ''} ${it.dni || ''} ${it.nroSiniestro || ''} ${it.artNombre || ''}`
            );
            return blob.includes(qq);
        });
    }, [items, q, art]);

    return (
        <div className={stylesBase.container}>
            <header className={stylesBase.header}>
                <div className={stylesBase.titleBlock}>
                    <h1 className={stylesBase.title}>✅ Cerrados</h1>
                    <p className={stylesBase.subtitle}>Ver detalles y descargar.</p>
                </div>
            </header>

            <div className={stylesBase.content}>
                <div className={styles.wrapper}>
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

                        <Link href="/admin/Facturacion" className={styles.btn}>
                            ← Volver
                        </Link>
                    </div>

                    {loading ? (
                        <div className={styles.empty}>Cargando…</div>
                    ) : filtered.length === 0 ? (
                        <div className={styles.empty}>No hay cerrados.</div>
                    ) : (
                        <div className={styles.list}>
                            {filtered.map((it) => (
                                <div key={it.id} className={styles.card}>
                                    <div className={styles.rowTop}>
                                        <div className={styles.title}>{it.pacienteNombre || 'Sin nombre'}</div>
                                        <div className={styles.meta}>
                                            <span className={styles.pill}>DNI: {it.dni || '—'}</span>
                                            <span className={styles.pill}>Siniestro: {it.nroSiniestro || '—'}</span>
                                            <span className={styles.pill}>{it.artNombre || 'SIN ART'}</span>
                                            <span className={styles.pill}>Total: $ {money(it.total || 0)}</span>
                                        </div>
                                    </div>

                                    <div className={styles.actions}>
                                        <Link className={`${styles.btn} ${styles.btnInfo}`} href={`/admin/Facturacion/facturados/cerrados/${it.id}`}>
                                            👁 Ver detalle
                                        </Link>
                                        {/* luego acá agregamos descargar PDF/Excel */}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

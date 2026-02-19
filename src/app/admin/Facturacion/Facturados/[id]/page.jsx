'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money } from '../utils/calculos';
import styles from '../facturados.module.css';

const fmtDate = (ms) => {
    if (!ms) return '—';
    try {
        return new Date(ms).toLocaleString('es-AR');
    } catch {
        return '—';
    }
};

export default function FacturadoDetallePage() {
    const { id } = useParams();
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [item, setItem] = useState(null);

    useEffect(() => {
        let alive = true;

        async function run() {
            try {
                const snap = await get(ref(db, `Facturacion/${id}`));
                if (!alive) return;
                setItem(snap.exists() ? snap.val() : null);
            } catch (e) {
                console.error(e);
                if (!alive) return;
                setItem(null);
            } finally {
                if (alive) setLoading(false);
            }
        }

        if (id) run();
        return () => {
            alive = false;
        };
    }, [id]);

    const paciente = item?.paciente || {};
    const estado = item?.estado || (item?.cerradoAt ? 'cerrado' : 'borrador');
    const tot = item?.totales?.total ?? item?.total ?? 0;

    if (loading) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>Cargando…</h1>
                    </div>
                </div>
            </div>
        );
    }

    if (!item) {
        return (
            <div className={styles.container}>
                <div className={styles.header}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>No encontrado</h1>
                        <p className={styles.subtitle}>No existe el registro /Facturacion/{id}</p>
                    </div>

                    <div className={styles.headerActions}>
                        <Link className={styles.btnGhost} href="/admin/facturacion/facturados">
                            ← Volver
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.titleBlock}>
                        <h1 className={styles.title}>
                            {estado === 'cerrado' ? '✅ Factura cerrada' : '💾 Borrador'}
                        </h1>
                        <p className={styles.subtitle}>
                            ID: <b>{id}</b>
                        </p>
                    </div>

                    <div className={styles.headerActions}>
                        <Link className={styles.btnGhost} href="/admin/facturacion/facturados">
                            ← Volver
                        </Link>

                        {estado !== 'cerrado' && (
                            <Link className={styles.btnPrimary} href={`/admin/facturacion/Nuevo?draft=${id}`}>
                                ✏️ Retomar borrador
                            </Link>
                        )}

                        <button
                            className={styles.btn}
                            onClick={() => router.refresh()}
                            title="Refrescar"
                        >
                            ↻ Actualizar
                        </button>
                    </div>
                </div>
            </header>

            <main className={styles.content}>
                <section className={styles.detailGrid}>
                    <div className={styles.detailCard}>
                        <h3 className={styles.detailTitle}>Paciente</h3>
                        <div className={styles.detailRow}><span>Nombre</span><b>{paciente?.nombreCompleto || '—'}</b></div>
                        <div className={styles.detailRow}><span>DNI</span><b>{paciente?.dni || '—'}</b></div>
                        <div className={styles.detailRow}><span>ART</span><b>{paciente?.artSeguro || '—'}</b></div>
                        <div className={styles.detailRow}><span>Siniestro</span><b>{paciente?.nroSiniestro || '—'}</b></div>
                        <div className={styles.detailRow}><span>Fecha</span><b>{paciente?.fechaAtencion || '—'}</b></div>
                    </div>

                    <div className={styles.detailCard}>
                        <h3 className={styles.detailTitle}>Factura</h3>
                        <div className={styles.detailRow}><span>Estado</span><b>{estado}</b></div>
                        <div className={styles.detailRow}><span>Convenio</span><b>{item?.convenioNombre || item?.convenio || '—'}</b></div>
                        <div className={styles.detailRow}><span>N° Factura</span><b>{item?.facturaNro || '—'}</b></div>
                        <div className={styles.detailRow}><span>Creado</span><b>{fmtDate(item?.createdAt)}</b></div>
                        <div className={styles.detailRow}><span>Cerrado</span><b>{fmtDate(item?.cerradoAt)}</b></div>
                        <div className={styles.detailRow}><span>Total</span><b>$ {money(tot)}</b></div>
                    </div>
                </section>

                <section className={styles.detailCard}>
                    <h3 className={styles.detailTitle}>Items (resumen)</h3>

                    <div className={styles.simpleList}>
                        <div className={styles.simpleLine}>
                            <span>Prácticas</span>
                            <b>{(item?.practicas || []).length}</b>
                        </div>
                        <div className={styles.simpleLine}>
                            <span>Cirugías</span>
                            <b>{(item?.cirugias || []).length}</b>
                        </div>
                        <div className={styles.simpleLine}>
                            <span>Laboratorios</span>
                            <b>{(item?.laboratorios || []).length}</b>
                        </div>
                        <div className={styles.simpleLine}>
                            <span>Medicamentos</span>
                            <b>{(item?.medicamentos || []).length}</b>
                        </div>
                        <div className={styles.simpleLine}>
                            <span>Descartables</span>
                            <b>{(item?.descartables || []).length}</b>
                        </div>
                    </div>

                    <p className={styles.detailHint}>
                        (Luego hacemos la vista “linda” con el detalle por práctica: cantidad, unitario, total y Dr.)
                    </p>
                </section>
            </main>
        </div>
    );
}

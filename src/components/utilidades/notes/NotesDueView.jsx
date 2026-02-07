"use client";

import React, { useMemo, useState } from "react";
import styles from "./NotesDueView.module.css";
import { useRtdbNode } from "@/components/utilidades/hooks/useRtdbNode";
import { NOTES_NODE, isDueWithinDays, isOverdue } from "./noteUtils";

export default function NotesDueView({ onGoCreate }) {
    const { list, loading, errorMsg } = useRtdbNode(NOTES_NODE);
    const [days, setDays] = useState(14);

    const { upcoming, overdue } = useMemo(() => {
        const active = (list || []).filter((n) => n && !n.archived);

        const overdueList = active
            .filter((n) => isOverdue(n))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        const upcomingList = active
            .filter((n) => isDueWithinDays(n, Number(days) || 14))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return { upcoming: upcomingList, overdue: overdueList };
    }, [list, days]);

    return (
        <section className={styles.grid}>
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.h3}>Notas por vencer</h3>
                        <p className={styles.sub}>
                            Mostrando próximas con fecha dentro de X días. (Archivadas no cuentan)
                        </p>
                    </div>

                    <div className={styles.controls}>
                        <label className={styles.label}>Días</label>
                        <select
                            className={styles.input}
                            value={days}
                            onChange={(e) => setDays(e.target.value)}
                        >
                            <option value={7}>7</option>
                            <option value={14}>14</option>
                            <option value={30}>30</option>
                            <option value={60}>60</option>
                        </select>

                        <button type="button" className={styles.primaryBtn} onClick={onGoCreate}>
                            Crear nota
                        </button>
                    </div>
                </div>

                {errorMsg ? <div className={styles.error}>{errorMsg}</div> : null}

                {!loading && upcoming.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyTitle}>No hay próximas por vencer</div>
                        <div className={styles.emptyText}>Si querés, agregá fechas a tus notas.</div>
                    </div>
                ) : null}

                <div className={styles.list}>
                    {upcoming.map((n) => (
                        <div key={n.id} className={styles.row}>
                            <div className={styles.rowMain}>
                                <div className={styles.title}>{n.title}</div>
                                <div className={styles.meta}>
                                    <span className={styles.badge}>{n.type || "nota"}</span>
                                    <span className={styles.badgeSecondary}>Fecha: {n.date}</span>
                                    {n.pinned ? <span className={styles.badgeStrong}>Anclada</span> : null}
                                </div>
                            </div>
                            <div className={styles.dateCol}>{n.date}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <div>
                        <h3 className={styles.h3}>Vencidas</h3>
                        <p className={styles.sub}>Fechas en el pasado (requieren revisión).</p>
                    </div>
                </div>

                {!loading && overdue.length === 0 ? (
                    <div className={styles.empty}>
                        <div className={styles.emptyTitle}>Sin vencidas</div>
                        <div className={styles.emptyText}>Perfecto: nada quedó atrás.</div>
                    </div>
                ) : null}

                <div className={styles.list}>
                    {overdue.map((n) => (
                        <div key={n.id} className={styles.row}>
                            <div className={styles.rowMain}>
                                <div className={styles.title}>{n.title}</div>
                                <div className={styles.meta}>
                                    <span className={styles.badgeMuted}>{n.type || "nota"}</span>
                                    <span className={styles.badgeDanger}>Vencida: {n.date}</span>
                                </div>
                            </div>
                            <div className={styles.dateCol}>{n.date}</div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

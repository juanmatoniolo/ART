"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./NotesDueView.module.css";
import { ref, onValue, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { NOTES_NODE, nowTs } from "./noteUtils";

function formatDate(date) {
    if (!date) return "";
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
}

export default function NotesView() {
    const [notes, setNotes] = useState([]);

    useEffect(() => {
        const r = ref(db, NOTES_NODE);
        return onValue(r, (snap) => {
            const val = snap.val() || {};
            const list = Object.entries(val).map(([id, n]) => ({
                id,
                ...n,
            }));
            setNotes(list);
        });
    }, []);

    const ordered = useMemo(() => {
        return [...notes]
            .filter((n) => !n.archived)
            .sort((a, b) => {
                if (!!a.done !== !!b.done) return a.done ? 1 : -1;
                return new Date(a.date || "2999-01-01") - new Date(b.date || "2999-01-01");
            });
    }, [notes]);

    async function toggleDone(note) {
        await update(ref(db, `${NOTES_NODE}/${note.id}`), {
            done: !note.done,
            updatedAt: nowTs(),
        });
    }

    async function deleteNote(id) {
        await remove(ref(db, `${NOTES_NODE}/${id}`));
    }

    return (
        <section className={styles.page}>
            <h2 className={styles.title}>Notas</h2>

            {ordered.length === 0 ? (
                <div className={styles.empty}>
                    <strong>No hay notas activas</strong>
                    <span>Todo al día 👍</span>
                </div>
            ) : null}

            <div className={styles.grid}>
                {ordered.map((n) => (
                    <article
                        key={n.id}
                        className={`${styles.card} ${n.done ? styles.done : ""}`}
                    >
                        <div className={styles.header}>
                            <div className={styles.headerLeft}>
                                <input
                                    type="checkbox"
                                    checked={!!n.done}
                                    onChange={() => toggleDone(n)}
                                    className={styles.checkbox}
                                />
                                <strong className={styles.cardTitle}>{n.title}</strong>
                            </div>

                            {n.date && (
                                <span className={styles.date}>{formatDate(n.date)}</span>
                            )}
                        </div>

                        {n.body && <p className={styles.body}>{n.body}</p>}

                        <div className={styles.footer}>
                            <span className={styles.type}>{n.type}</span>

                            <button
                                className={styles.deleteBtn}
                                onClick={() => deleteNote(n.id)}
                            >
                                Eliminar
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    );
}

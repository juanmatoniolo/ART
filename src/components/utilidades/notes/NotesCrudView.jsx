"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./NotesCrudView.module.css";
import { ref, onValue, push, set, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { NOTES_NODE, nowTs } from "./noteUtils";

const NOTE_TYPES = [
    { value: "nota", label: "Nota" },
    { value: "cirugia", label: "Cirugía" },
    { value: "estudios", label: "Estudios" },
    { value: "recordatorio", label: "Recordatorio" },
];

function daysUntil(date) {
    const d = new Date(`${date}T00:00:00`);
    const today = new Date();
    const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return Math.floor((d - t0) / 86400000);
}

function urgencyClass(date) {
    const d = daysUntil(date);
    if (d <= 3) return "red";
    if (d <= 7) return "yellow";
    return "green";
}

function formatDate(date) {
    const [y, m, d] = date.split("-");
    return `${d}/${m}/${y}`;
}

export default function NotesSimpleView() {
    const [notes, setNotes] = useState([]);
    const [draft, setDraft] = useState({
        type: "nota",
        title: "",
        body: "",
        date: "",
    });

    const [editingId, setEditingId] = useState(null);

    useEffect(() => {
        const r = ref(db, NOTES_NODE);
        return onValue(r, (snap) => {
            const val = snap.val() || {};
            const list = Object.entries(val).map(([id, n]) => ({ id, ...n }));
            setNotes(list);
        });
    }, []);

    const ordered = useMemo(() => {
        return [...notes].sort((a, b) => new Date(a.date) - new Date(b.date));
    }, [notes]);

    async function createNote(e) {
        e.preventDefault();
        if (!draft.title || !draft.date) return;

        const r = push(ref(db, NOTES_NODE));
        await set(r, {
            ...draft,
            createdAt: nowTs(),
        });

        setDraft({ type: "nota", title: "", body: "", date: "" });
    }

    async function saveEdit(id, note) {
        await update(ref(db, `${NOTES_NODE}/${id}`), {
            title: note.title,
            body: note.body || "",
            date: note.date,
        });
        setEditingId(null);
    }

    async function deleteNote(id) {
        await remove(ref(db, `${NOTES_NODE}/${id}`));
    }

    return (
        <section className={styles.page}>
            {/* CREAR */}
            <form className={styles.card} onSubmit={createNote}>
                <h3 className={styles.title}>Nueva nota</h3>

                <select
                    className={styles.input}
                    value={draft.type}
                    onChange={(e) => setDraft({ ...draft, type: e.target.value })}
                >
                    {NOTE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>

                <input
                    className={styles.input}
                    placeholder="Título"
                    value={draft.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />

                <input
                    className={styles.input}
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                />

                <textarea
                    className={styles.textarea}
                    placeholder="Detalle (opcional)"
                    value={draft.body}
                    onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                />

                <button className={styles.primaryBtn} type="submit">
                    Crear nota
                </button>
            </form>

            {/* LISTA */}
            <div className={styles.grid}>
                {ordered.map((n) => {
                    const color = urgencyClass(n.date);

                    return (
                        <div key={n.id} className={`${styles.note} ${styles[color]}`}>
                            {editingId === n.id ? (
                                <>
                                    <input
                                        className={styles.input}
                                        value={n.title}
                                        onChange={(e) =>
                                            setNotes((all) =>
                                                all.map((x) =>
                                                    x.id === n.id ? { ...x, title: e.target.value } : x
                                                )
                                            )
                                        }
                                    />

                                    <input
                                        className={styles.input}
                                        type="date"
                                        value={n.date}
                                        onChange={(e) =>
                                            setNotes((all) =>
                                                all.map((x) =>
                                                    x.id === n.id ? { ...x, date: e.target.value } : x
                                                )
                                            )
                                        }
                                    />

                                    <textarea
                                        className={styles.textarea}
                                        value={n.body || ""}
                                        onChange={(e) =>
                                            setNotes((all) =>
                                                all.map((x) =>
                                                    x.id === n.id ? { ...x, body: e.target.value } : x
                                                )
                                            )
                                        }
                                    />

                                    <div className={styles.actions}>
                                        <button
                                            className={styles.primaryBtn}
                                            type="button"
                                            onClick={() => saveEdit(n.id, n)}
                                        >
                                            Guardar
                                        </button>
                                        <button
                                            className={styles.secondaryBtn}
                                            type="button"
                                            onClick={() => setEditingId(null)}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className={styles.header}>
                                        <strong>{n.title}</strong>
                                        <span className={styles.date}>{formatDate(n.date)}</span>
                                    </div>

                                    {n.body && <p className={styles.body}>{n.body}</p>}

                                    <div className={styles.actions}>
                                        <button
                                            className={styles.secondaryBtn}
                                            onClick={() => setEditingId(n.id)}
                                        >
                                            Editar
                                        </button>
                                        <button
                                            className={styles.dangerBtn}
                                            onClick={() => deleteNote(n.id)}
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </section>
    );
}

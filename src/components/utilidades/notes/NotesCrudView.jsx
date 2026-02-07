"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./NotesCrudView.module.css";

import { ref, onValue, push, set, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";

import { NOTES_NODE, nowTs, safeText, parseTags, normalizeText } from "./noteUtils";

const NOTE_TYPES = [
    { value: "cirugias", label: "Fechas de cirugías" },
    { value: "internos", label: "Internos de la clínica" },
    { value: "anotaciones", label: "Anotaciones" },
    { value: "tareas", label: "Tareas" },
    { value: "recordatorios", label: "Recordatorios" },
    { value: "administracion", label: "Administración" },
    { value: "compras_stock", label: "Compras / Stock" },
    { value: "finanzas", label: "Finanzas" },
];

const PRIORITIES = [
    { value: "alta", label: "Alta" },
    { value: "media", label: "Media" },
    { value: "baja", label: "Baja" },
];

function matchesQuery(note, q) {
    if (!q) return true;
    const hay = [
        note.title,
        note.body,
        note.type,
        (note.tags || []).join(" "),
        note.date || "",
    ]
        .join(" ")
        .toLowerCase();

    return hay.includes(q.toLowerCase());
}

function makeEmptyDraft() {
    return {
        type: "anotaciones",
        title: "",
        body: "",
        date: "",
        priority: "media",
        tagsInput: "",
        pinned: false,
    };
}

export default function NotesCrudView() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [toastMsg, setToastMsg] = useState("");

    const [notesById, setNotesById] = useState({});
    const [draft, setDraft] = useState(makeEmptyDraft());

    const [query, setQuery] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterPinned, setFilterPinned] = useState("all");
    const [filterArchived, setFilterArchived] = useState("active");
    const [sortMode, setSortMode] = useState("updated_desc");

    const [editingId, setEditingId] = useState(null);
    const [editBuffer, setEditBuffer] = useState(null);

    const [deleteTarget, setDeleteTarget] = useState(null);

    const toastTimerRef = useRef(null);

    function showToast(msg) {
        setToastMsg(msg);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setToastMsg(""), 2200);
    }

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setErrorMsg("");

        const r = ref(db, NOTES_NODE);
        const off = onValue(
            r,
            (snap) => {
                if (cancelled) return;
                setNotesById(snap.val() || {});
                setLoading(false);
            },
            (err) => {
                if (cancelled) return;
                setErrorMsg(err?.message || "Error al leer notas.");
                setLoading(false);
            }
        );

        return () => {
            cancelled = true;
            try {
                if (typeof off === "function") off();
            } catch { }
        };
    }, []);

    useEffect(() => {
        return () => {
            if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        };
    }, []);

    const notesList = useMemo(() => {
        const all = Object.entries(notesById || {}).map(([id, note]) => ({ id, ...note }));

        const q = normalizeText(query);
        let filtered = all.filter((n) => matchesQuery(n, q));

        if (filterType !== "all") filtered = filtered.filter((n) => n.type === filterType);

        if (filterPinned === "pinned") filtered = filtered.filter((n) => !!n.pinned);
        if (filterPinned === "unpinned") filtered = filtered.filter((n) => !n.pinned);

        if (filterArchived === "active") filtered = filtered.filter((n) => !n.archived);
        if (filterArchived === "archived") filtered = filtered.filter((n) => !!n.archived);

        const sorted = [...filtered].sort((a, b) => {
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;

            if (sortMode === "date_asc") {
                const da = a.date ? new Date(a.date).getTime() : Number.MAX_SAFE_INTEGER;
                const dbb = b.date ? new Date(b.date).getTime() : Number.MAX_SAFE_INTEGER;
                if (da !== dbb) return da - dbb;
                return (b.updatedAt || 0) - (a.updatedAt || 0);
            }

            if (sortMode === "created_desc") return (b.createdAt || 0) - (a.createdAt || 0);

            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        return sorted;
    }, [notesById, query, filterType, filterPinned, filterArchived, sortMode]);

    const stats = useMemo(() => {
        const all = Object.values(notesById || {});
        const total = all.length;
        const active = all.filter((n) => n && !n.archived).length;
        const pinned = all.filter((n) => n && !n.archived && !!n.pinned).length;
        return { total, active, pinned };
    }, [notesById]);

    async function createNote(e) {
        e.preventDefault();
        setErrorMsg("");
        setSaving(true);

        try {
            const title = safeText(draft.title, 80);
            const body = (draft.body || "").trim();
            const type = draft.type || "anotaciones";
            const priority = draft.priority || "media";
            const date = safeText(draft.date, 10);
            const tags = parseTags(draft.tagsInput);

            if (!title) {
                setErrorMsg("El título es obligatorio.");
                setSaving(false);
                return;
            }
            if (body.length > 5000) {
                setErrorMsg("El cuerpo es demasiado largo (máx. 5000 caracteres).");
                setSaving(false);
                return;
            }

            const ts = nowTs();
            const nodeRef = ref(db, NOTES_NODE);
            const newRef = push(nodeRef);

            await set(newRef, {
                title,
                body,
                type,
                priority,
                date: date || "",
                tags,
                pinned: !!draft.pinned,
                archived: false,
                createdAt: ts,
                updatedAt: ts,
            });

            setDraft(makeEmptyDraft());
            showToast("Nota creada.");
        } catch (err) {
            setErrorMsg(err?.message || "No se pudo crear la nota.");
        } finally {
            setSaving(false);
        }
    }

    function startEdit(note) {
        setEditingId(note.id);
        setEditBuffer({
            title: note.title || "",
            body: note.body || "",
            type: note.type || "anotaciones",
            priority: note.priority || "media",
            date: note.date || "",
            tagsInput: (note.tags || []).join(", "),
            pinned: !!note.pinned,
            archived: !!note.archived,
        });
    }

    function cancelEdit() {
        setEditingId(null);
        setEditBuffer(null);
    }

    async function saveEdit(noteId) {
        if (!editBuffer) return;

        setErrorMsg("");
        setSaving(true);

        try {
            const title = safeText(editBuffer.title, 80);
            const body = (editBuffer.body || "").trim();
            const type = editBuffer.type || "anotaciones";
            const priority = editBuffer.priority || "media";
            const date = safeText(editBuffer.date, 10);
            const tags = parseTags(editBuffer.tagsInput);

            if (!title) {
                setErrorMsg("El título es obligatorio.");
                setSaving(false);
                return;
            }
            if (body.length > 5000) {
                setErrorMsg("El cuerpo es demasiado largo (máx. 5000 caracteres).");
                setSaving(false);
                return;
            }

            await update(ref(db, `${NOTES_NODE}/${noteId}`), {
                title,
                body,
                type,
                priority,
                date: date || "",
                tags,
                pinned: !!editBuffer.pinned,
                archived: !!editBuffer.archived,
                updatedAt: nowTs(),
            });

            showToast("Cambios guardados.");
            cancelEdit();
        } catch (err) {
            setErrorMsg(err?.message || "No se pudo guardar.");
        } finally {
            setSaving(false);
        }
    }

    async function togglePinned(note) {
        setErrorMsg("");
        try {
            await update(ref(db, `${NOTES_NODE}/${note.id}`), {
                pinned: !note.pinned,
                updatedAt: nowTs(),
            });
            showToast(note.pinned ? "Desanclada." : "Anclada.");
        } catch (err) {
            setErrorMsg(err?.message || "No se pudo actualizar el pin.");
        }
    }

    async function toggleArchived(note) {
        setErrorMsg("");
        try {
            await update(ref(db, `${NOTES_NODE}/${note.id}`), {
                archived: !note.archived,
                updatedAt: nowTs(),
            });
            showToast(note.archived ? "Restaurada." : "Archivada.");
        } catch (err) {
            setErrorMsg(err?.message || "No se pudo archivar/restaurar.");
        }
    }

    async function confirmDelete() {
        if (!deleteTarget) return;
        setErrorMsg("");
        setSaving(true);

        try {
            await remove(ref(db, `${NOTES_NODE}/${deleteTarget.id}`));
            showToast("Eliminada.");
            setDeleteTarget(null);
            if (editingId === deleteTarget.id) cancelEdit();
        } catch (err) {
            setErrorMsg(err?.message || "No se pudo eliminar.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className={styles.section}>
            <div className={styles.statsRow}>
                <div className={styles.stat}>
                    <div className={styles.statLabel}>Activas</div>
                    <div className={styles.statValue}>{stats.active}</div>
                </div>
                <div className={styles.stat}>
                    <div className={styles.statLabel}>Ancladas</div>
                    <div className={styles.statValue}>{stats.pinned}</div>
                </div>
                <div className={styles.stat}>
                    <div className={styles.statLabel}>Total</div>
                    <div className={styles.statValue}>{stats.total}</div>
                </div>
            </div>

            <div className={styles.grid}>
                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3 className={styles.h3}>Crear nota</h3>
                        <div className={styles.hint}>
                            Nodo: <span className={styles.mono}>{NOTES_NODE}</span>
                        </div>
                    </div>

                    <form className={styles.form} onSubmit={createNote}>
                        <div className={styles.row2}>
                            <div className={styles.field}>
                                <label className={styles.label}>Tipo</label>
                                <select
                                    className={styles.input}
                                    value={draft.type}
                                    onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                                >
                                    {NOTE_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Prioridad</label>
                                <select
                                    className={styles.input}
                                    value={draft.priority}
                                    onChange={(e) => setDraft((d) => ({ ...d, priority: e.target.value }))}
                                >
                                    {PRIORITIES.map((p) => (
                                        <option key={p.value} value={p.value}>
                                            {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className={styles.row2}>
                            <div className={styles.field}>
                                <label className={styles.label}>Título</label>
                                <input
                                    className={styles.input}
                                    value={draft.title}
                                    onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                                    placeholder="Ej: Cirugía — Pérez Juan — Rodilla"
                                    maxLength={120}
                                />
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Fecha (opcional)</label>
                                <input
                                    className={styles.input}
                                    type="date"
                                    value={draft.date}
                                    onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Contenido</label>
                            <textarea
                                className={styles.textarea}
                                value={draft.body}
                                onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
                                placeholder="Detalle, checklist, observaciones..."
                            />
                        </div>

                        <div className={styles.row2}>
                            <div className={styles.field}>
                                <label className={styles.label}>Tags (coma)</label>
                                <input
                                    className={styles.input}
                                    value={draft.tagsInput}
                                    onChange={(e) => setDraft((d) => ({ ...d, tagsInput: e.target.value }))}
                                    placeholder="cirugia, preop"
                                />
                            </div>

                            <div className={styles.fieldInline}>
                                <label className={styles.label}>Opciones</label>
                                <label className={styles.checkbox}>
                                    <input
                                        type="checkbox"
                                        checked={draft.pinned}
                                        onChange={(e) => setDraft((d) => ({ ...d, pinned: e.target.checked }))}
                                    />
                                    <span>Anclar</span>
                                </label>
                            </div>
                        </div>

                        {errorMsg ? <div className={styles.error}>{errorMsg}</div> : null}

                        <div className={styles.actions}>
                            <button className={styles.primaryBtn} disabled={saving || loading} type="submit">
                                {saving ? "Guardando..." : "Crear"}
                            </button>
                            <button
                                className={styles.secondaryBtn}
                                type="button"
                                onClick={() => setDraft(makeEmptyDraft())}
                                disabled={saving}
                            >
                                Limpiar
                            </button>
                        </div>
                    </form>
                </div>

                <div className={styles.card}>
                    <div className={styles.cardHeader}>
                        <h3 className={styles.h3}>Editar notas</h3>
                        <div className={styles.hint}>{loading ? "Cargando..." : `${notesList.length} visibles`}</div>
                    </div>

                    <div className={styles.filters}>
                        <div className={styles.field}>
                            <label className={styles.label}>Buscar</label>
                            <input
                                className={styles.input}
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="título, tags, contenido, fecha..."
                            />
                        </div>

                        <div className={styles.row3}>
                            <div className={styles.field}>
                                <label className={styles.label}>Tipo</label>
                                <select
                                    className={styles.input}
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    {NOTE_TYPES.map((t) => (
                                        <option key={t.value} value={t.value}>
                                            {t.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Pin</label>
                                <select
                                    className={styles.input}
                                    value={filterPinned}
                                    onChange={(e) => setFilterPinned(e.target.value)}
                                >
                                    <option value="all">Todos</option>
                                    <option value="pinned">Solo ancladas</option>
                                    <option value="unpinned">Sin anclar</option>
                                </select>
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Estado</label>
                                <select
                                    className={styles.input}
                                    value={filterArchived}
                                    onChange={(e) => setFilterArchived(e.target.value)}
                                >
                                    <option value="active">Activas</option>
                                    <option value="archived">Archivadas</option>
                                    <option value="all">Todas</option>
                                </select>
                            </div>
                        </div>

                        <div className={styles.row2}>
                            <div className={styles.field}>
                                <label className={styles.label}>Orden</label>
                                <select
                                    className={styles.input}
                                    value={sortMode}
                                    onChange={(e) => setSortMode(e.target.value)}
                                >
                                    <option value="updated_desc">Actualización (desc)</option>
                                    <option value="created_desc">Creación (desc)</option>
                                    <option value="date_asc">Fecha (asc)</option>
                                </select>
                            </div>

                            <div className={styles.fieldInline}>
                                <label className={styles.label}>Atajos</label>
                                <button
                                    type="button"
                                    className={styles.secondaryBtn}
                                    onClick={() => {
                                        setQuery("");
                                        setFilterType("all");
                                        setFilterPinned("all");
                                        setFilterArchived("active");
                                        setSortMode("updated_desc");
                                        showToast("Filtros reiniciados.");
                                    }}
                                >
                                    Reset filtros
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className={styles.notesGrid}>
                        {!loading && notesList.length === 0 ? (
                            <div className={styles.empty}>
                                <div className={styles.emptyTitle}>Sin notas visibles</div>
                                <div className={styles.emptyText}>Creá una o ajustá filtros.</div>
                            </div>
                        ) : null}

                        {notesList.map((note) => {
                            const isEditing = editingId === note.id;

                            return (
                                <article key={note.id} className={styles.noteCard}>
                                    <div className={styles.noteTop}>
                                        <div className={styles.noteMeta}>
                                            <span className={styles.badge}>{note.type || "nota"}</span>
                                            {note.date ? (
                                                <span className={styles.badgeSecondary}>Fecha: {note.date}</span>
                                            ) : null}
                                            {note.archived ? <span className={styles.badgeMuted}>Archivada</span> : null}
                                            {note.pinned ? <span className={styles.badgeStrong}>Anclada</span> : null}
                                        </div>

                                        <div className={styles.noteActions}>
                                            <button
                                                type="button"
                                                className={styles.smallBtn}
                                                onClick={() => togglePinned(note)}
                                                disabled={saving}
                                            >
                                                {note.pinned ? "Desanclar" : "Anclar"}
                                            </button>

                                            <button
                                                type="button"
                                                className={styles.smallBtn}
                                                onClick={() => toggleArchived(note)}
                                                disabled={saving}
                                            >
                                                {note.archived ? "Restaurar" : "Archivar"}
                                            </button>

                                            {!isEditing ? (
                                                <button
                                                    type="button"
                                                    className={styles.smallBtnPrimary}
                                                    onClick={() => startEdit(note)}
                                                    disabled={saving}
                                                >
                                                    Editar
                                                </button>
                                            ) : null}

                                            <button
                                                type="button"
                                                className={styles.smallBtnDanger}
                                                onClick={() => setDeleteTarget(note)}
                                                disabled={saving}
                                            >
                                                Eliminar
                                            </button>
                                        </div>
                                    </div>

                                    {!isEditing ? (
                                        <>
                                            <h4 className={styles.noteTitle}>{note.title}</h4>
                                            {note.body ? <pre className={styles.noteBody}>{note.body}</pre> : null}

                                            {Array.isArray(note.tags) && note.tags.length ? (
                                                <div className={styles.tagsRow}>
                                                    {note.tags.slice(0, 12).map((t) => (
                                                        <span key={t} className={styles.tag}>
                                                            {t}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : null}
                                        </>
                                    ) : (
                                        <div className={styles.editBox}>
                                            <div className={styles.row2}>
                                                <div className={styles.field}>
                                                    <label className={styles.label}>Tipo</label>
                                                    <select
                                                        className={styles.input}
                                                        value={editBuffer.type}
                                                        onChange={(e) =>
                                                            setEditBuffer((b) => ({ ...b, type: e.target.value }))
                                                        }
                                                    >
                                                        {NOTE_TYPES.map((t) => (
                                                            <option key={t.value} value={t.value}>
                                                                {t.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>

                                                <div className={styles.field}>
                                                    <label className={styles.label}>Prioridad</label>
                                                    <select
                                                        className={styles.input}
                                                        value={editBuffer.priority}
                                                        onChange={(e) =>
                                                            setEditBuffer((b) => ({ ...b, priority: e.target.value }))
                                                        }
                                                    >
                                                        {PRIORITIES.map((p) => (
                                                            <option key={p.value} value={p.value}>
                                                                {p.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            <div className={styles.row2}>
                                                <div className={styles.field}>
                                                    <label className={styles.label}>Título</label>
                                                    <input
                                                        className={styles.input}
                                                        value={editBuffer.title}
                                                        onChange={(e) =>
                                                            setEditBuffer((b) => ({ ...b, title: e.target.value }))
                                                        }
                                                    />
                                                </div>

                                                <div className={styles.field}>
                                                    <label className={styles.label}>Fecha</label>
                                                    <input
                                                        className={styles.input}
                                                        type="date"
                                                        value={editBuffer.date}
                                                        onChange={(e) =>
                                                            setEditBuffer((b) => ({ ...b, date: e.target.value }))
                                                        }
                                                    />
                                                </div>
                                            </div>

                                            <div className={styles.field}>
                                                <label className={styles.label}>Contenido</label>
                                                <textarea
                                                    className={styles.textarea}
                                                    value={editBuffer.body}
                                                    onChange={(e) =>
                                                        setEditBuffer((b) => ({ ...b, body: e.target.value }))
                                                    }
                                                />
                                            </div>

                                            <div className={styles.row2}>
                                                <div className={styles.field}>
                                                    <label className={styles.label}>Tags</label>
                                                    <input
                                                        className={styles.input}
                                                        value={editBuffer.tagsInput}
                                                        onChange={(e) =>
                                                            setEditBuffer((b) => ({ ...b, tagsInput: e.target.value }))
                                                        }
                                                        placeholder="tag1, tag2"
                                                    />
                                                </div>

                                                <div className={styles.fieldInline}>
                                                    <label className={styles.label}>Opciones</label>
                                                    <label className={styles.checkbox}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!editBuffer.pinned}
                                                            onChange={(e) =>
                                                                setEditBuffer((b) => ({ ...b, pinned: e.target.checked }))
                                                            }
                                                        />
                                                        <span>Anclada</span>
                                                    </label>

                                                    <label className={styles.checkbox}>
                                                        <input
                                                            type="checkbox"
                                                            checked={!!editBuffer.archived}
                                                            onChange={(e) =>
                                                                setEditBuffer((b) => ({ ...b, archived: e.target.checked }))
                                                            }
                                                        />
                                                        <span>Archivada</span>
                                                    </label>
                                                </div>
                                            </div>

                                            {errorMsg ? <div className={styles.error}>{errorMsg}</div> : null}

                                            <div className={styles.actions}>
                                                <button
                                                    type="button"
                                                    className={styles.primaryBtn}
                                                    onClick={() => saveEdit(note.id)}
                                                    disabled={saving}
                                                >
                                                    {saving ? "Guardando..." : "Guardar"}
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.secondaryBtn}
                                                    onClick={cancelEdit}
                                                    disabled={saving}
                                                >
                                                    Cancelar
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                    </div>
                </div>
            </div>

            {toastMsg ? <div className={styles.toast}>{toastMsg}</div> : null}

            {deleteTarget ? (
                <div className={styles.modalOverlay} role="dialog" aria-modal="true">
                    <div className={styles.modalCard}>
                        <div className={styles.modalTitle}>Confirmar eliminación</div>
                        <div className={styles.modalText}>
                            Vas a eliminar definitivamente:
                            <div className={styles.modalStrong}>{deleteTarget.title}</div>
                        </div>

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => setDeleteTarget(null)}
                                disabled={saving}
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                className={styles.dangerBtn}
                                onClick={confirmDelete}
                                disabled={saving}
                            >
                                {saving ? "Eliminando..." : "Eliminar"}
                            </button>
                        </div>
                    </div>
                </div>
            ) : null}
        </section>
    );
}

"use client";

import React, { useMemo, useState } from "react";
import styles from "./InternosView.module.css";

import { ref, push, set, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useRtdbNode } from "@/components/utilidades/hooks/useRtdbNode";
import { nowTs, safeText, normalizeText } from "@/components/utilidades/notes/noteUtils";

const NODE = "utilidades_root/internos";

function makeDraft() {
    return { sector: "", interno: "", nombre: "", notas: "" };
}

export default function InternosView() {
    const { list, loading, errorMsg } = useRtdbNode(NODE);

    const [draft, setDraft] = useState(makeDraft());
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState("");

    const [query, setQuery] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editBuffer, setEditBuffer] = useState(null);

    const filtered = useMemo(() => {
        const q = normalizeText(query).toLowerCase();
        const base = [...(list || [])].sort((a, b) => (a.sector || "").localeCompare(b.sector || ""));
        if (!q) return base;

        return base.filter((x) => {
            const hay = [x.sector, x.interno, x.nombre, x.notas].join(" ").toLowerCase();
            return hay.includes(q);
        });
    }, [list, query]);

    async function create(e) {
        e.preventDefault();
        setLocalError("");
        setSaving(true);

        try {
            const sector = safeText(draft.sector, 60);
            const interno = safeText(draft.interno, 20);
            const nombre = safeText(draft.nombre, 80);
            const notas = safeText(draft.notas, 500);

            if (!sector) return setLocalError("Sector es obligatorio."), setSaving(false);
            if (!interno) return setLocalError("Interno es obligatorio."), setSaving(false);

            const ts = nowTs();
            const newRef = push(ref(db, NODE));
            await set(newRef, { sector, interno, nombre, notas, createdAt: ts, updatedAt: ts });

            setDraft(makeDraft());
        } catch (err) {
            setLocalError(err?.message || "No se pudo guardar.");
        } finally {
            setSaving(false);
        }
    }

    function startEdit(row) {
        setEditingId(row.id);
        setEditBuffer({
            sector: row.sector || "",
            interno: row.interno || "",
            nombre: row.nombre || "",
            notas: row.notas || "",
        });
    }

    function cancelEdit() {
        setEditingId(null);
        setEditBuffer(null);
    }

    async function saveEdit(id) {
        if (!editBuffer) return;
        setLocalError("");
        setSaving(true);

        try {
            const sector = safeText(editBuffer.sector, 60);
            const interno = safeText(editBuffer.interno, 20);
            const nombre = safeText(editBuffer.nombre, 80);
            const notas = safeText(editBuffer.notas, 500);

            if (!sector) return setLocalError("Sector es obligatorio."), setSaving(false);
            if (!interno) return setLocalError("Interno es obligatorio."), setSaving(false);

            await update(ref(db, `${NODE}/${id}`), {
                sector,
                interno,
                nombre,
                notas,
                updatedAt: nowTs(),
            });

            cancelEdit();
        } catch (err) {
            setLocalError(err?.message || "No se pudo actualizar.");
        } finally {
            setSaving(false);
        }
    }

    async function delRow(row) {
        const ok = window.confirm(`Eliminar interno "${row.interno}" (${row.sector})?`);
        if (!ok) return;

        setLocalError("");
        setSaving(true);
        try {
            await remove(ref(db, `${NODE}/${row.id}`));
            if (editingId === row.id) cancelEdit();
        } catch (err) {
            setLocalError(err?.message || "No se pudo eliminar.");
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className={styles.grid}>
            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h3 className={styles.h3}>Cargar interno</h3>
                    <div className={styles.hint}>Nodo: <span className={styles.mono}>{NODE}</span></div>
                </div>

                <form className={styles.form} onSubmit={create}>
                    <div className={styles.row2}>
                        <div className={styles.field}>
                            <label className={styles.label}>Sector</label>
                            <input
                                className={styles.input}
                                value={draft.sector}
                                onChange={(e) => setDraft((d) => ({ ...d, sector: e.target.value }))}
                                placeholder="Ej: Guardia, Administración, Rx, Quirófano"
                            />
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Interno</label>
                            <input
                                className={styles.input}
                                value={draft.interno}
                                onChange={(e) => setDraft((d) => ({ ...d, interno: e.target.value }))}
                                placeholder="Ej: 123"
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Nombre (opcional)</label>
                        <input
                            className={styles.input}
                            value={draft.nombre}
                            onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                            placeholder="Ej: Enfermería / Recepción"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Notas (opcional)</label>
                        <textarea
                            className={styles.textarea}
                            value={draft.notas}
                            onChange={(e) => setDraft((d) => ({ ...d, notas: e.target.value }))}
                            placeholder="Horario, guardia, observaciones..."
                        />
                    </div>

                    {errorMsg ? <div className={styles.error}>{errorMsg}</div> : null}
                    {localError ? <div className={styles.error}>{localError}</div> : null}

                    <div className={styles.actions}>
                        <button className={styles.primaryBtn} disabled={saving} type="submit">
                            {saving ? "Guardando..." : "Agregar"}
                        </button>
                        <button
                            className={styles.secondaryBtn}
                            type="button"
                            onClick={() => setDraft(makeDraft())}
                            disabled={saving}
                        >
                            Limpiar
                        </button>
                    </div>
                </form>
            </div>

            <div className={styles.card}>
                <div className={styles.cardHeader}>
                    <h3 className={styles.h3}>Listado</h3>
                    <div className={styles.hint}>{loading ? "Cargando..." : `${filtered.length} visibles`}</div>
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Buscar</label>
                    <input
                        className={styles.input}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="sector, interno, nombre..."
                    />
                </div>

                <div className={styles.list}>
                    {!loading && filtered.length === 0 ? (
                        <div className={styles.empty}>Sin registros.</div>
                    ) : null}

                    {filtered.map((row) => {
                        const isEditing = editingId === row.id;

                        return (
                            <div key={row.id} className={styles.item}>
                                {!isEditing ? (
                                    <>
                                        <div className={styles.itemTop}>
                                            <div className={styles.itemTitle}>
                                                <span className={styles.badge}>{row.sector || "Sector"}</span>
                                                <span className={styles.valueStrong}>Interno: {row.interno}</span>
                                            </div>

                                            <div className={styles.itemActions}>
                                                <button
                                                    type="button"
                                                    className={styles.smallBtnPrimary}
                                                    onClick={() => startEdit(row)}
                                                    disabled={saving}
                                                >
                                                    Editar
                                                </button>
                                                <button
                                                    type="button"
                                                    className={styles.smallBtnDanger}
                                                    onClick={() => delRow(row)}
                                                    disabled={saving}
                                                >
                                                    Eliminar
                                                </button>
                                            </div>
                                        </div>

                                        {row.nombre ? <div className={styles.line}><b>Nombre:</b> {row.nombre}</div> : null}
                                        {row.notas ? <div className={styles.line}><b>Notas:</b> {row.notas}</div> : null}
                                    </>
                                ) : (
                                    <div className={styles.editBox}>
                                        <div className={styles.row2}>
                                            <div className={styles.field}>
                                                <label className={styles.label}>Sector</label>
                                                <input
                                                    className={styles.input}
                                                    value={editBuffer.sector}
                                                    onChange={(e) => setEditBuffer((b) => ({ ...b, sector: e.target.value }))}
                                                />
                                            </div>
                                            <div className={styles.field}>
                                                <label className={styles.label}>Interno</label>
                                                <input
                                                    className={styles.input}
                                                    value={editBuffer.interno}
                                                    onChange={(e) => setEditBuffer((b) => ({ ...b, interno: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <div className={styles.field}>
                                            <label className={styles.label}>Nombre</label>
                                            <input
                                                className={styles.input}
                                                value={editBuffer.nombre}
                                                onChange={(e) => setEditBuffer((b) => ({ ...b, nombre: e.target.value }))}
                                            />
                                        </div>

                                        <div className={styles.field}>
                                            <label className={styles.label}>Notas</label>
                                            <textarea
                                                className={styles.textarea}
                                                value={editBuffer.notas}
                                                onChange={(e) => setEditBuffer((b) => ({ ...b, notas: e.target.value }))}
                                            />
                                        </div>

                                        <div className={styles.actions}>
                                            <button
                                                type="button"
                                                className={styles.primaryBtn}
                                                onClick={() => saveEdit(row.id)}
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
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}

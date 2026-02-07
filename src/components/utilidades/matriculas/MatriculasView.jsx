"use client";

import React, { useMemo, useState } from "react";
import styles from "./MatriculasView.module.css";

import { ref, push, set, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useRtdbNode } from "@/components/utilidades/hooks/useRtdbNode";
import { nowTs, safeText, normalizeText } from "@/components/utilidades/notes/noteUtils";

const NODE = "utilidades_root/matriculas_medicos";

function makeDraft() {
    return { nombre: "", apellido: "", especialidad: "", matricula: "", telefono: "" };
}

function cleanPhone(input) {
    const s = normalizeText(input);
    if (!s) return "";
    // conserva + y números, elimina ruido
    return s.replace(/[^\d+]/g, "").slice(0, 20);
}

export default function MatriculasView() {
    const { list, loading, errorMsg } = useRtdbNode(NODE);

    const [draft, setDraft] = useState(makeDraft());
    const [saving, setSaving] = useState(false);
    const [localError, setLocalError] = useState("");

    const [query, setQuery] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [editBuffer, setEditBuffer] = useState(null);

    const filtered = useMemo(() => {
        const q = normalizeText(query).toLowerCase();
        const base = [...(list || [])].sort((a, b) => (a.apellido || "").localeCompare(b.apellido || ""));
        if (!q) return base;

        return base.filter((x) => {
            const hay = [x.nombre, x.apellido, x.especialidad, x.matricula, x.telefono].join(" ").toLowerCase();
            return hay.includes(q);
        });
    }, [list, query]);

    async function create(e) {
        e.preventDefault();
        setLocalError("");
        setSaving(true);

        try {
            const nombre = safeText(draft.nombre, 50);
            const apellido = safeText(draft.apellido, 50);
            const especialidad = safeText(draft.especialidad, 60);
            const matricula = safeText(draft.matricula, 30);
            const telefono = cleanPhone(draft.telefono);

            if (!apellido || !nombre) return setLocalError("Nombre y apellido son obligatorios."), setSaving(false);
            if (!matricula) return setLocalError("Matrícula es obligatoria."), setSaving(false);

            const ts = nowTs();
            const newRef = push(ref(db, NODE));
            await set(newRef, { nombre, apellido, especialidad, matricula, telefono, createdAt: ts, updatedAt: ts });

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
            nombre: row.nombre || "",
            apellido: row.apellido || "",
            especialidad: row.especialidad || "",
            matricula: row.matricula || "",
            telefono: row.telefono || "",
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
            const nombre = safeText(editBuffer.nombre, 50);
            const apellido = safeText(editBuffer.apellido, 50);
            const especialidad = safeText(editBuffer.especialidad, 60);
            const matricula = safeText(editBuffer.matricula, 30);
            const telefono = cleanPhone(editBuffer.telefono);

            if (!apellido || !nombre) return setLocalError("Nombre y apellido son obligatorios."), setSaving(false);
            if (!matricula) return setLocalError("Matrícula es obligatoria."), setSaving(false);

            await update(ref(db, `${NODE}/${id}`), {
                nombre,
                apellido,
                especialidad,
                matricula,
                telefono,
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
        const ok = window.confirm(`Eliminar matrícula de "${row.apellido} ${row.nombre}"?`);
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
                    <h3 className={styles.h3}>Cargar matrícula</h3>
                    <div className={styles.hint}>Nodo: <span className={styles.mono}>{NODE}</span></div>
                </div>

                <form className={styles.form} onSubmit={create}>
                    <div className={styles.row2}>
                        <div className={styles.field}>
                            <label className={styles.label}>Nombre</label>
                            <input
                                className={styles.input}
                                value={draft.nombre}
                                onChange={(e) => setDraft((d) => ({ ...d, nombre: e.target.value }))}
                                placeholder="Ej: Juan"
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Apellido</label>
                            <input
                                className={styles.input}
                                value={draft.apellido}
                                onChange={(e) => setDraft((d) => ({ ...d, apellido: e.target.value }))}
                                placeholder="Ej: Pérez"
                            />
                        </div>
                    </div>

                    <div className={styles.row2}>
                        <div className={styles.field}>
                            <label className={styles.label}>Especialidad</label>
                            <input
                                className={styles.input}
                                value={draft.especialidad}
                                onChange={(e) => setDraft((d) => ({ ...d, especialidad: e.target.value }))}
                                placeholder="Ej: Traumatología"
                            />
                        </div>
                        <div className={styles.field}>
                            <label className={styles.label}>Matrícula</label>
                            <input
                                className={styles.input}
                                value={draft.matricula}
                                onChange={(e) => setDraft((d) => ({ ...d, matricula: e.target.value }))}
                                placeholder="Ej: MP 12345"
                            />
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label}>Teléfono personal (opcional)</label>
                        <input
                            className={styles.input}
                            value={draft.telefono}
                            onChange={(e) => setDraft((d) => ({ ...d, telefono: e.target.value }))}
                            placeholder="+54 9 11 1234-5678"
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
                        placeholder="apellido, matrícula, especialidad..."
                    />
                </div>

                <div className={styles.list}>
                    {!loading && filtered.length === 0 ? <div className={styles.empty}>Sin registros.</div> : null}

                    {filtered.map((row) => {
                        const isEditing = editingId === row.id;

                        return (
                            <div key={row.id} className={styles.item}>
                                {!isEditing ? (
                                    <>
                                        <div className={styles.itemTop}>
                                            <div className={styles.itemTitle}>
                                                <span className={styles.valueStrong}>
                                                    {row.apellido} {row.nombre}
                                                </span>
                                                {row.especialidad ? <span className={styles.badge}>{row.especialidad}</span> : null}
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

                                        <div className={styles.line}><b>Matrícula:</b> {row.matricula || "-"}</div>
                                        {row.telefono ? <div className={styles.line}><b>Tel:</b> {row.telefono}</div> : null}
                                    </>
                                ) : (
                                    <div className={styles.editBox}>
                                        <div className={styles.row2}>
                                            <div className={styles.field}>
                                                <label className={styles.label}>Nombre</label>
                                                <input
                                                    className={styles.input}
                                                    value={editBuffer.nombre}
                                                    onChange={(e) => setEditBuffer((b) => ({ ...b, nombre: e.target.value }))}
                                                />
                                            </div>
                                            <div className={styles.field}>
                                                <label className={styles.label}>Apellido</label>
                                                <input
                                                    className={styles.input}
                                                    value={editBuffer.apellido}
                                                    onChange={(e) => setEditBuffer((b) => ({ ...b, apellido: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <div className={styles.row2}>
                                            <div className={styles.field}>
                                                <label className={styles.label}>Especialidad</label>
                                                <input
                                                    className={styles.input}
                                                    value={editBuffer.especialidad}
                                                    onChange={(e) => setEditBuffer((b) => ({ ...b, especialidad: e.target.value }))}
                                                />
                                            </div>
                                            <div className={styles.field}>
                                                <label className={styles.label}>Matrícula</label>
                                                <input
                                                    className={styles.input}
                                                    value={editBuffer.matricula}
                                                    onChange={(e) => setEditBuffer((b) => ({ ...b, matricula: e.target.value }))}
                                                />
                                            </div>
                                        </div>

                                        <div className={styles.field}>
                                            <label className={styles.label}>Teléfono</label>
                                            <input
                                                className={styles.input}
                                                value={editBuffer.telefono}
                                                onChange={(e) => setEditBuffer((b) => ({ ...b, telefono: e.target.value }))}
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

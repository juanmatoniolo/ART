"use client";

import React, { useEffect, useMemo, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";

const NOTES_NODE = "utilidades_root/notes";

function endOfDayLocalMs(yyyyMmDd) {
    // yyyy-mm-dd -> end of day local time
    const d = new Date(`${yyyyMmDd}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}

function noteDueMs(note) {
    // Soporta futuro: si guardás dueAt (timestamp), se usa.
    if (!note) return null;
    if (typeof note.dueAt === "number" && Number.isFinite(note.dueAt)) return note.dueAt;
    if (typeof note.date === "string" && note.date) return endOfDayLocalMs(note.date);
    return null;
}

export default function UtilidadesDueBadge({ className = "" }) {
    const [notesById, setNotesById] = useState(null);

    useEffect(() => {
        const r = ref(db, NOTES_NODE);
        const unsub = onValue(r, (snap) => setNotesById(snap.val() || {}));
        return () => {
            try {
                if (typeof unsub === "function") unsub();
            } catch { }
        };
    }, []);

    const count = useMemo(() => {
        if (!notesById) return 0;

        const now = Date.now();
        const limit = now + 24 * 60 * 60 * 1000;

        let c = 0;
        for (const note of Object.values(notesById)) {
            if (!note) continue;
            if (note.archived) continue;

            const due = noteDueMs(note);
            if (!due) continue;

            // vencen dentro de las próximas 24 hs
            if (due >= now && due <= limit) c += 1;
        }
        return c;
    }, [notesById]);

    if (!count) return null;

    return <span className={className}>{count}</span>;
}

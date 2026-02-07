"use client";

import React, { useMemo, useState } from "react";
import styles from "./UtilidadesShell.module.css";

import UtilidadesTabs from "./UtilidadesTabs";

import NotesDueView from "./notes/NotesDueView";
import NotesCrudView from "./notes/NotesCrudView";
import InternosView from "./internos/InternosView";
import MatriculasView from "./matriculas/MatriculasView";

const TABS = [
    { key: "notas", label: "Ver notas" },
    { key: "crear", label: "Crear nota" },
    { key: "internos", label: "Internos" },
    { key: "matriculas", label: "Matrículas médicos" },
];

export default function UtilidadesShell() {
    const [tab, setTab] = useState("notas");

    const title = useMemo(() => {
        const found = TABS.find((t) => t.key === tab);
        return found ? found.label : "Utilidades";
    }, [tab]);

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <div className={styles.headerText}>
                        <h1 className={styles.h1}>Utilidades</h1>
                        <p className={styles.sub}>
                            Panel operativo: notas por vencer, carga/edición, internos y matrículas.
                        </p>
                    </div>
                </div>

                <UtilidadesTabs tabs={TABS} value={tab} onChange={setTab} />
            </header>

            <main className={styles.main}>
                <div className={styles.viewHeader}>
                    <h2 className={styles.h2}>{title}</h2>
                </div>

                {tab === "notas" ? (
                    <NotesDueView onGoCreate={() => setTab("crear")} />
                ) : null}

                {tab === "crear" ? <NotesCrudView /> : null}

                {tab === "internos" ? <InternosView /> : null}

                {tab === "matriculas" ? <MatriculasView /> : null}
            </main>
        </div>
    );
}

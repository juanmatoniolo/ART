"use client";

import React from "react";
import styles from "./UtilidadesTabs.module.css";

export default function UtilidadesTabs({ tabs, value, onChange }) {
    return (
        <nav className={styles.nav} aria-label="Secciones de utilidades">
            {tabs.map((t) => {
                const active = t.key === value;
                return (
                    <button
                        key={t.key}
                        type="button"
                        className={`${styles.tab} ${active ? styles.active : ""}`}
                        onClick={() => onChange(t.key)}
                    >
                        {t.label}
                    </button>
                );
            })}
        </nav>
    );
}

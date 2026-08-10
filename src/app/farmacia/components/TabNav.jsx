"use client";
import Icon from "./Icon";
import s from "../farmaciaDashboard.module.css";

const TABS = [
    { id: "dashboard", icon: "home", label: "Inicio" },
    { id: "stock", icon: "box", label: "Stock" },
    { id: "precios", icon: "tag", label: "Precios" },
    { id: "movimientos", icon: "list", label: "Movim." },
    { id: "catalogo", icon: "pills", label: "Catálogo" },
    { id: "exportar", icon: "upload2", label: "Exportar" },
];

export default function TabNav({ activeTab, onTabChange }) {
    return (
        <nav className={s.tabNav} aria-label="Secciones">
            {TABS.map((t) => {
                const active = activeTab === t.id;
                return (
                    <button
                        key={t.id}
                        className={`${s.tabNavBtn} ${active ? s.tabNavBtnActive : ""}`}
                        onClick={() => onTabChange(t.id)}
                        aria-current={active ? "page" : undefined}
                    >
                        <Icon name={t.icon} size={26} stroke={active ? 2.4 : 2} />
                        <span className={s.tabNavLabel}>{t.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
"use client";
import s from "../farmaciaDashboard.module.css";

const TABS = [
    { id: "dashboard", icon: "📊", label: "Dashboard" },
    { id: "stock", icon: "📦", label: "Stock" },
    { id: "movimientos", icon: "📋", label: "Movimientos" },
    { id: "catalogo", icon: "💊", label: "Catálogo" },
    { id: "exportar", icon: "📤", label: "Exportar" },
];

export default function TabNav({ activeTab, onTabChange }) {
    return (
        <nav className={s.mainNav}>
            {TABS.map(tab => (
                <button
                    key={tab.id}
                    className={`${s.tabBtn} ${activeTab === tab.id ? s.tabActive : ""}`}
                    onClick={() => onTabChange(tab.id)}
                >
                    <span className={s.tabIcon}>{tab.icon}</span>
                    <span className={s.tabLabel}>{tab.label}</span>
                    {activeTab === tab.id && <span className={s.tabUnderline} />}
                </button>
            ))}
        </nav>
    );
}
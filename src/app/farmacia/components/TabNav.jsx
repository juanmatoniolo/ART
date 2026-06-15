"use client";
import Icon from "./Icon";

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
        <nav className="fxnav" aria-label="Secciones">
            {TABS.map((t) => {
                const active = activeTab === t.id;
                return (
                    <button
                        key={t.id}
                        className={"fxnav-btn" + (active ? " is-active" : "")}
                        onClick={() => onTabChange(t.id)}
                        aria-current={active ? "page" : undefined}
                    >
                        <Icon name={t.icon} size={26} stroke={active ? 2.4 : 2} />
                        <span className="fxnav-label">{t.label}</span>
                    </button>
                );
            })}

            <style>{`
                .fxnav {
                    position: sticky; bottom: 0; z-index: 40;
                    display: flex; justify-content: space-between;
                    background: #ffffff;
                    border-top: 1px solid #e5e7eb;
                    padding: 6px 4px;
                    box-shadow: 0 -2px 10px rgba(0,0,0,.04);
                }
                .fxnav-btn {
                    flex: 1; min-width: 0;
                    display: flex; flex-direction: column; align-items: center; gap: 3px;
                    background: none; border: none; cursor: pointer;
                    padding: 8px 2px; min-height: 58px;
                    color: #6b7280; border-radius: 12px;
                    transition: color .15s, background .15s;
                }
                .fxnav-btn:hover { background: #f3f4f6; }
                .fxnav-btn.is-active { color: #2563eb; }
                .fxnav-label {
                    font-size: 12px; font-weight: 700; line-height: 1;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;
                }

                /* PC / tablet: barra arriba, más aire */
                @media (min-width: 768px) {
                    .fxnav {
                        position: static;
                        border-top: none; border-bottom: 2px solid #e5e7eb;
                        box-shadow: none; padding: 4px 8px; gap: 4px;
                    }
                    .fxnav-btn {
                        flex-direction: row; gap: 10px; min-height: 52px;
                        padding: 10px 18px; font-size: 16px;
                        border-radius: 12px 12px 0 0;
                    }
                    .fxnav-label { font-size: 16px; }
                    .fxnav-btn.is-active {
                        background: #eff6ff;
                        box-shadow: inset 0 -3px 0 #2563eb;
                    }
                }
            `}</style>
        </nav>
    );
}
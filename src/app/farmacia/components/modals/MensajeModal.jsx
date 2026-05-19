"use client";
import s from "../../farmaciaDashboard.module.css";
import { Overlay } from "./AgregarModal";

const CONFIGS = {
    success: { bg: "linear-gradient(135deg,#10b981,#059669)", icon: "✅" },
    error: { bg: "linear-gradient(135deg,#ef4444,#b91c1c)", icon: "❌" },
    warning: { bg: "linear-gradient(135deg,#f59e0b,#d97706)", icon: "⚠️" },
    info: { bg: "linear-gradient(135deg,#3b82f6,#2563eb)", icon: "ℹ️" },
};

export default function MensajeModal({ data, onClose }) {
    const cfg = CONFIGS[data.tipo] || CONFIGS.info;
    return (
        <Overlay onClose={onClose}>
            <div className={s.modalHeader} style={{ background: cfg.bg }}>
                <h3 className={s.modalTitle} style={{ color: "#fff" }}>
                    {cfg.icon} {data.titulo}
                </h3>
                <button className={s.closeBtn} style={{ color: "#fff" }} onClick={onClose}>✕</button>
            </div>
            <div className={s.modalBody}>
                <p className={s.mensajeText}>{data.mensaje}</p>
            </div>
            <div className={s.modalFooter} style={{ justifyContent: "center" }}>
                <button className={`${s.actionBtn} ${s.btn_primary}`}
                    style={{ background: cfg.bg }} onClick={onClose}>
                    Aceptar
                </button>
            </div>
        </Overlay>
    );
}
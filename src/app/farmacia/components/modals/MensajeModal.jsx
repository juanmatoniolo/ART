"use client";
import Icon from "../Icon";
import { Overlay, CloseBtn } from "./AgregarModal";
import s from "../../farmaciaDashboard.module.css";

const CONFIGS = {
    success: { tone: "success", icon: "check", color: "var(--c-green)" },
    error: { tone: "danger", icon: "alert", color: "var(--c-red)" },
    warning: { tone: "warning", icon: "alert", color: "var(--c-amber)" },
    info: { tone: "", icon: "list", color: "var(--c-primary)" },
};

export default function MensajeModal({ data, onClose }) {
    const cfg = CONFIGS[data.tipo] || CONFIGS.info;
    return (
        <Overlay onClose={onClose}>
            <div className={s.modalHeader} style={cfg.tone ? { background: cfg.color } : {}}>
                <h3 className={s.modalTitle}><Icon name={cfg.icon} size={24} /> {data.titulo}</h3>
                <CloseBtn onClick={onClose} />
            </div>
            <div className={s.modalBody}>
                <p className={s.mensajeText}>{data.mensaje}</p>
            </div>
            <div className={s.modalFooter}>
                <button className={`${s.actionBtn} ${s.btn_primary}`} style={{ background: cfg.color }} onClick={onClose}>
                    Aceptar
                </button>
            </div>
        </Overlay>
    );
}
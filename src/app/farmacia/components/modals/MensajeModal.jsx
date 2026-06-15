"use client";
import Icon from "../Icon";
import { Overlay } from "./AgregarModal";

const CONFIGS = {
    success: { tone: "success", icon: "check", color: "#059669" },
    error: { tone: "danger", icon: "alert", color: "#dc2626" },
    warning: { tone: "warning", icon: "alert", color: "#d97706" },
    info: { tone: "", icon: "list", color: "#2563eb" },
};

export default function MensajeModal({ data, onClose }) {
    const cfg = CONFIGS[data.tipo] || CONFIGS.info;
    return (
        <Overlay onClose={onClose}>
            <div className={"fxm-head" + (cfg.tone ? " " + cfg.tone : "")}>
                <h3 className="fxm-title"><Icon name={cfg.icon} size={24} /> {data.titulo}</h3>
                <button className="fxm-close" onClick={onClose} aria-label="Cerrar"><Icon name="close" size={22} /></button>
            </div>
            <div className="fxm-body">
                <p style={{ margin: 0, fontSize: 18, lineHeight: 1.4 }}>{data.mensaje}</p>
            </div>
            <div className="fxm-footer">
                <button className="fxm-btn primary" style={{ background: cfg.color }} onClick={onClose}>Aceptar</button>
            </div>
        </Overlay>
    );
}
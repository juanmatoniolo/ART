"use client";
import { useState } from "react";
import Icon from "../Icon";
import { Overlay, Header } from "./AgregarModal";

export default function EliminarModal({ item, onClose, onSubmit }) {
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        const ok = await onSubmit(item);
        setLoading(false);
        if (ok) onClose();
    };

    return (
        <Overlay onClose={onClose}>
            <Header icon="trash" title="Eliminar producto" onClose={onClose} tone="danger" />
            <div className="fxm-body">
                <div className="fxd-warn">
                    <Icon name="alert" size={28} />
                    <p>El producto se dará de <strong>baja</strong> y dejará de aparecer en el stock.</p>
                </div>
                <div className="fxd-prod">
                    <span className="fxd-ic"><Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={26} /></span>
                    <div>
                        <p className="fxd-name">{item.nombre.replace(/_/g, " ")}</p>
                        <p className="fxd-meta">Stock actual: <strong>{item.stockActual}</strong> unidades</p>
                    </div>
                </div>
            </div>
            <div className="fxm-footer">
                <button className="fxm-btn ghost" onClick={onClose}>Cancelar</button>
                <button className="fxm-btn danger" onClick={handleSubmit} disabled={loading}>
                    <Icon name="trash" size={20} /> {loading ? "Eliminando..." : "Sí, eliminar"}
                </button>
            </div>

            <style>{`
                .fxd-warn { display: flex; align-items: center; gap: 12px; background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; border-radius: 14px; padding: 14px; }
                .fxd-warn p { margin: 0; font-size: 16px; }
                .fxd-prod { display: flex; align-items: center; gap: 12px; background: #f9fafb; border: 1px solid #eef0f2; border-radius: 14px; padding: 14px; }
                .fxd-ic { color: #6b7280; display: flex; }
                .fxd-name { margin: 0; font-size: 18px; font-weight: 800; }
                .fxd-meta { margin: 3px 0 0; font-size: 14px; color: #6b7280; }
            `}</style>
        </Overlay>
    );
}
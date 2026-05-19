"use client";
import { useState } from "react";
import s from "../../farmaciaDashboard.module.css";
import { Overlay, CloseBtn } from "./AgregarModal";

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
            <div className={s.modalHeader} style={{ background: "linear-gradient(135deg,#ef4444,#b91c1c)" }}>
                <h3 className={s.modalTitle} style={{ color: "#fff" }}>🗑️ Eliminar Producto</h3>
                <CloseBtn onClick={onClose} />
            </div>

            <div className={s.modalBody}>
                <div className={s.deleteWarning}>
                    <span className={s.deleteWarningIcon}>⚠️</span>
                    <p>Esta acción es <strong>permanente</strong>. No se puede deshacer.</p>
                </div>

                <div className={s.editProductInfo} style={{ marginTop: "1rem" }}>
                    <span className={s.editProductIcon}>
                        {item.tipo === "medicamento" ? "💊" : "🧷"}
                    </span>
                    <div>
                        <p className={s.editProductName}>{item.nombre.replace(/_/g, " ")}</p>
                        <p className={s.editProductMeta}>
                            Stock actual: <strong>{item.stockActual}</strong> unidades
                        </p>
                    </div>
                </div>
            </div>

            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                <button
                    className={`${s.actionBtn} ${s.btn_danger}`}
                    onClick={handleSubmit}
                    disabled={loading}
                >
                    {loading ? "Eliminando..." : "Sí, eliminar"}
                </button>
            </div>
        </Overlay>
    );
}
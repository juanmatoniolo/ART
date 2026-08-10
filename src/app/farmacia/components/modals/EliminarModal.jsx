"use client";
import { useState } from "react";
import Icon from "../Icon";
import { Overlay, Header } from "./AgregarModal";
import s from "../../farmaciaDashboard.module.css";

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
            <div className={s.modalBody}>
                <div className={s.deleteWarning}>
                    <span className={s.deleteWarningIcon}><Icon name="alert" size={28} /></span>
                    <p>El producto se dará de <strong>baja</strong> y dejará de aparecer en el stock.</p>
                </div>
                <div className={s.editProductInfo}>
                    <span className={s.editProductIcon}><Icon name={item.tipo === "medicamento" ? "pills" : "box"} size={26} /></span>
                    <div>
                        <p className={s.editProductName}>{item.nombre.replace(/_/g, " ")}</p>
                        <p className={s.editProductMeta}>Stock actual: <strong>{item.stockActual}</strong> unidades</p>
                    </div>
                </div>
            </div>
            <div className={s.modalFooter}>
                <button className={s.btnCancel} onClick={onClose}>Cancelar</button>
                <button className={`${s.actionBtn} ${s.btn_danger}`} onClick={handleSubmit} disabled={loading}>
                    <Icon name="trash" size={20} /> {loading ? "Eliminando..." : "Sí, eliminar"}
                </button>
            </div>
        </Overlay>
    );
}
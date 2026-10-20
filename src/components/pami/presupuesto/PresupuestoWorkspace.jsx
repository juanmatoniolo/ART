"use client";
import { useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { getSession } from "@/utils/session";
import { guardarPresupuestoPami, itemsDe, codigosDe, parseCantidad } from "@/lib/pami/presupuestos";
import CatalogoProductos from "./CatalogoProductos";
import CarritoPresupuesto from "./CarritoPresupuesto";
import PresupuestoImprimible from "./PresupuestoImprimible";
import styles from "./presupuesto.module.css";

const usuarioActual = () => {
    const s = (typeof getSession === "function" && getSession()) || {};
    return s.user || s.usuario || s.nombre || "sistema";
};

export default function PresupuestoWorkspace({ items, paciente, oncoplan, contexto, initialDraft, beforeSave, onSaved, onNuevo }) {
    const [carrito, setCarrito] = useState(initialDraft ? itemsDe(initialDraft).map((i) => ({ ...i, id: i.id || `${i.categoria}:${i.key}`, cantidad: parseCantidad(i.cantidad, 1) || 1 })) : []);
    const [codigos, setCodigos] = useState(initialDraft ? codigosDe(initialDraft).map((c) => ({ ...c })) : []);
    const [edicionId, setEdicionId] = useState(initialDraft?.id || null);
    const [saving, setSaving] = useState(false);

    const printRef = useRef(null);
    const imprimir = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Presupuesto-${paciente?.nombreCompleto || "PAMI"}`,
        pageStyle: "@page { size: A4; margin: 14mm; }",
    });

    const total = useMemo(
        () => carrito.reduce((s, c) => s + c.precio * (Number(c.cantidad) || 0), 0) + codigos.reduce((s, c) => s + ((Number(c.monto) || 0) * (Number(c.cantidad) || 1)), 0),
        [carrito, codigos]
    );

    const agregarItem = (item, qty) => {
        const id = `${item.categoria}:${item.key}`;
        setCarrito((c) => {
            const idx = c.findIndex((x) => x.id === id);
            if (idx >= 0) {
                const copy = c.slice();
                copy[idx] = { ...copy[idx], cantidad: (Number(copy[idx].cantidad) || 0) + qty };
                return copy;
            }
            return [...c, { id, categoria: item.categoria, key: item.key, nombre: item.nombre, presentacion: item.presentacion, precio: Number(item.precioFacturacion) || 0, cantidad: qty }];
        });
    };

    const guardar = async () => {
        if (!paciente?.dni) return alert("Falta el paciente.");
        setSaving(true);
        try {
            let pacienteKey = beforeSave ? await beforeSave() : String(paciente.dni).replace(/\D/g, "");
            const res = await guardarPresupuestoPami(pacienteKey, { items: carrito, codigos, total, oncoplan, opId: contexto.opId || null }, { usuario: usuarioActual(), id: edicionId });
            setEdicionId(res.id);
            onSaved?.({ id: res.id, items: carrito, codigos, total, oncoplan, ...contexto });
        } catch (e) {
            console.error(e); alert("Error al guardar: " + e.message);
        } finally { setSaving(false); }
    };

    return (
        <div className={styles.layout}>
            {/* COLUMNA IZQUIERDA: CATÁLOGO */}
            <div className={styles.colMain}>
                <CatalogoProductos items={items} onAgregar={agregarItem} />
            </div>

            {/* COLUMNA DERECHA: CARRITO */}
            <CarritoPresupuesto
                carrito={carrito} setCarrito={setCarrito}
                codigos={codigos} setCodigos={setCodigos}
                oncoplan={oncoplan} edicionId={edicionId} saving={saving}
                onGuardar={guardar} onImprimir={imprimir} onNuevo={onNuevo} contexto={contexto}
            />

            <div style={{ display: "none" }}>
                <PresupuestoImprimible ref={printRef} paciente={paciente || {}} items={carrito} codigos={codigos} total={total} oncoplan={oncoplan} nro={edicionId ? edicionId.slice(-6).toUpperCase() : ""} />
            </div>
        </div>
    );
}
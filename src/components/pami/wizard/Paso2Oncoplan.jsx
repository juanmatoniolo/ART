"use client";
import { useState } from "react";
import styles from "./wizard.module.css";

export default function Paso2Oncoplan({ estado, actualizar }) {
    const paciente = estado.paciente || {};
    const [oncoplan, setOncoplan] = useState(!!paciente.oncoplan);
    const [confirmado, setConfirmado] = useState(
        !!paciente.oncoplanConfirmado?.fecha
    );

    const aplicar = (nuevoOnc, nuevaConf) => {
        actualizar({
            paciente: {
                ...paciente,
                oncoplan: nuevoOnc,
                oncoplanConfirmado: nuevaConf
                    ? { fecha: Date.now(), por: "actual" }
                    : null,
            },
        });
    };

    const toggleOncoplan = (val) => {
        setOncoplan(val);
        if (!val) setConfirmado(false);
        aplicar(val, val ? confirmado : false);
    };

    const toggleConfirmado = (val) => {
        setConfirmado(val);
        aplicar(oncoplan, val);
    };

    return (
        <div>
            <h2 className={styles.titulo}>Paso 2 · Modalidad PAMI</h2>
            <p className={styles.hint}>
                Si el paciente es <strong>oncológico</strong>, todas sus OP y
                eventos heredan la etiqueta ONCOPLAN.
            </p>

            <label className={styles.toggleCard}>
                <input
                    type="checkbox"
                    checked={oncoplan}
                    onChange={(e) => toggleOncoplan(e.target.checked)}
                />
                <div>
                    <strong>Paciente ONCOPLAN</strong>
                    <small>Marcá esta opción si el paciente tiene diagnóstico oncológico (PAMI cáncer).</small>
                </div>
            </label>

            {oncoplan && (
                <label
                    className={styles.confirmCard}
                    style={{ borderColor: confirmado ? 'var(--accent)' : 'var(--warn-border)' }}
                >
                    <input
                        type="checkbox"
                        checked={confirmado}
                        onChange={(e) => toggleConfirmado(e.target.checked)}
                    />
                    <div>
                        <strong>
                            Alta en ONCOPLAN confirmada por PAMI
                        </strong>
                        <small>
                            Tildá esta casilla <strong>solo si PAMI ya te dio el alta formal</strong> en el sistema de oncología.
                            Si aún estás esperando la autorización, podés dejarlo destildado y completarlo más adelante desde la ficha del paciente.
                        </small>
                    </div>
                </label>
            )}

            {!oncoplan && (
                <p className={styles.hint}>
                    El paciente se considerará <strong>PAMI normal</strong>. Si
                    después necesitás cambiar esto, lo podés hacer desde la
                    ficha del paciente.
                </p>
            )}
        </div>
    );
}
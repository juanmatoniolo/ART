"use client";
import { useState } from "react";
import { guardarInternacionPami } from "@/lib/pami/internaciones";
import { inicializarFormIngreso } from "@/app/ingresos/helpers"; // helper nuevo que ves abajo
import IngresoFormCampos from "../ingreso/IngresoFormCampos";
import IngresoPdfPreview from "../ingreso/IngresoPdfPreview";
import styles from "./wizard.module.css";

export default function PasoInternacion({ estado, actualizar }) {
    const paciente = estado.paciente || {};
    const op = estado.op || {};
    const [form, setForm] = useState(() => inicializarFormIngreso({ paciente, tipoIngreso: "PISO" }));
    const [grupoMedico, setGrupoMedico] = useState({ cirujano: "", ayudante1: "", ayudante2: "", anestesista: "" });
    const [saving, setSaving] = useState(false);
    const [resultado, setResultado] = useState(null);
    const [error, setError] = useState("");

    const onChange = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

    const guardar = async () => {
        setSaving(true);
        setError("");
        try {
            const res = await guardarInternacionPami({
                pacienteDni: paciente.dni,
                pacienteData: paciente,
                opId: op.id,
                opData: op,
                grupoMedico,
                form,
                oncoplan: !!paciente.oncoplan,
                usuario: "actual", // reemplazá con usuarioActual()
            });
            setResultado(res);
            actualizar({ internacion: { id: res.pamiId, ingresosId: res.ingresosId } });
        } catch (e) {
            console.error(e);
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    if (resultado) {
        return (
            <div>
                <h2 className={styles.titulo}>✅ Internación guardada</h2>
                <p className={styles.hint}>
                    Ya podés generar el PDF y los documentos correspondientes.
                </p>
                <IngresoPdfPreview
                    payload={resultado.payload}
                    tipoIngreso={resultado.tipoIngreso}
                    onContinue={() => actualizar({ internacion: resultado })}
                />
            </div>
        );
    }

    return (
        <div>
            <h2 className={styles.titulo}>Internación</h2>
            <p className={styles.hint}>
                Completá los datos del ingreso. Se guarda en <b>/ingresos</b> y queda
                también en el historial del paciente PAMI.
            </p>

            <IngresoFormCampos form={form} onChange={onChange} modo="internacion" />

            <fieldset className={styles.fieldset}>
                <legend>Grupo médico (opcional)</legend>
                <div className={styles.row2}>
                    <label className={styles.field}>
                        <span>Cirujano</span>
                        <input className={styles.input} value={grupoMedico.cirujano} onChange={(e) => setGrupoMedico((p) => ({ ...p, cirujano: e.target.value }))} />
                    </label>
                    <label className={styles.field}>
                        <span>Anestesista</span>
                        <input className={styles.input} value={grupoMedico.anestesista} onChange={(e) => setGrupoMedico((p) => ({ ...p, anestesista: e.target.value }))} />
                    </label>
                    <label className={styles.field}>
                        <span>Ayudante 1</span>
                        <input className={styles.input} value={grupoMedico.ayudante1} onChange={(e) => setGrupoMedico((p) => ({ ...p, ayudante1: e.target.value }))} />
                    </label>
                    <label className={styles.field}>
                        <span>Ayudante 2</span>
                        <input className={styles.input} value={grupoMedico.ayudante2} onChange={(e) => setGrupoMedico((p) => ({ ...p, ayudante2: e.target.value }))} />
                    </label>
                </div>
            </fieldset>

            {error && <p className={styles.error}>{error}</p>}

            <button type="button" className={styles.btnPrimario} onClick={guardar} disabled={saving}>
                {saving ? "Guardando…" : "Guardar internación"}
            </button>
        </div>
    );
}
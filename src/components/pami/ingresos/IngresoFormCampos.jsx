"use client";
import { DatePartInput } from "@/app/ingresos/helpers";
import styles from "./ingreso.module.css";

export default function IngresoFormCampos({ form, onChange, onChangeNacimiento, errors = {}, modo = "internacion" }) {
    return (
        <>
            {modo === "internacion" && (
                <fieldset className={styles.fieldset}>
                    <legend>Tipo de internación</legend>
                    <div className={styles.chips}>
                        {[["PISO", "PISO"], ["UTI", "UTI (Terapia)"]].map(([v, l]) => (
                            <label key={v} className={`${styles.chip} ${form.tipoIngreso === v ? styles.chipActive : ""}`}>
                                <input
                                    type="radio"
                                    name="tipoIngreso"
                                    value={v}
                                    checked={form.tipoIngreso === v}
                                    onChange={onChange("tipoIngreso")}
                                />
                                {l}
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}

            <div className={styles.row3}>
                <DatePartInput label="Día" value={modo === "cirugia" ? form.diaCirugia : form.diaIngreso} onChange={onChange(modo === "cirugia" ? "diaCirugia" : "diaIngreso")} maxLength={2} placeholder="DD" error={errors.diaIngreso} />
                <DatePartInput label="Mes" value={modo === "cirugia" ? form.mesCirugia : form.mesIngreso} onChange={onChange(modo === "cirugia" ? "mesCirugia" : "mesIngreso")} maxLength={2} placeholder="MM" error={errors.mesIngreso} />
                <DatePartInput label="Año" value={modo === "cirugia" ? form.anioCirugia : form.anioIngreso} onChange={onChange(modo === "cirugia" ? "anioCirugia" : "anioIngreso")} maxLength={4} placeholder="AAAA" error={errors.anioIngreso} />
            </div>

            <div className={styles.row2}>
                <label className={styles.field}>
                    <span>Cama {modo === "internacion" ? "(opcional)" : ""}</span>
                    <div className={styles.row2}>
                        <input className={styles.input} value={form.camaNumero} onChange={onChange("camaNumero")} placeholder="N°" inputMode="numeric" />
                        {form.tipoIngreso !== "UTI" && (
                            <input className={styles.input} value={form.camaLetra} onChange={onChange("camaLetra")} placeholder="A" maxLength={2} />
                        )}
                    </div>
                </label>
                <label className={styles.field}>
                    <span>Médico solicitante</span>
                    <input className={styles.input} value={form.medicoSolicitante} onChange={onChange("medicoSolicitante")} placeholder="Apellido y nombre" />
                </label>
            </div>

            <label className={styles.field}>
                <span>Diagnóstico</span>
                <input className={styles.input} value={form.diagnostico} onChange={onChange("diagnostico")} placeholder="Diagnóstico de ingreso / cirugía" />
            </label>

            <label className={styles.field}>
                <span>Teléfono del paciente</span>
                <input className={styles.input} value={form.trabajadorTelefono} onChange={onChange("trabajadorTelefono")} inputMode="tel" placeholder="3456-123456" />
            </label>

            <label className={styles.field}>
                <span>Domicilio (calle y número)</span>
                <div className={styles.row2}>
                    <input className={styles.input} value={form.trabajadorCalle} onChange={onChange("trabajadorCalle")} placeholder="Calle" />
                    <input className={styles.input} value={form.trabajadorNumero} onChange={onChange("trabajadorNumero")} placeholder="N°" />
                </div>
            </label>

            <div className={styles.row2}>
                <label className={styles.field}>
                    <span>Localidad</span>
                    <input className={styles.input} value={form.trabajadorLocalidad} onChange={onChange("trabajadorLocalidad")} />
                </label>
                <label className={styles.field}>
                    <span>Provincia</span>
                    <input className={styles.input} value={form.trabajadorProvincia} onChange={onChange("trabajadorProvincia")} />
                </label>
            </div>
        </>
    );
}
'use client';

import { useState } from 'react';
import styles from '../medicos.module.css';

const atencionOptions = ['ART', 'PAMI', 'Particular', 'OSDE', 'Swiss Medical', 'Galeno', 'Otra'];

export default function DoctorForm({ initialData = {}, onSubmit, onCancel }) {
  const [form, setForm] = useState({
    apellido: '',
    nombre: '',
    matricula: '',
    especialidad: '',
    telefono: '',
    atencion: [],
    notas: '',
    ...initialData,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleAtencionChange = (option) => {
    setForm((prev) => {
      const current = prev.atencion || [];
      if (current.includes(option)) {
        return { ...prev, atencion: current.filter((o) => o !== option) };
      } else {
        return { ...prev, atencion: [...current, option] };
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <div className={styles.formGrid}>
        <div>
          <label>Apellido *</label>
          <input name="apellido" value={form.apellido} onChange={handleChange} required />
        </div>
        <div>
          <label>Nombre *</label>
          <input name="nombre" value={form.nombre} onChange={handleChange} required />
        </div>
        <div>
          <label>Matrícula</label>
          <input name="matricula" value={form.matricula} onChange={handleChange} />
        </div>
        <div>
          <label>Especialidad</label>
          <input name="especialidad" value={form.especialidad} onChange={handleChange} />
        </div>
        <div>
          <label>Teléfono</label>
          <input name="telefono" value={form.telefono} onChange={handleChange} placeholder="+549..." />
        </div>
        <div className={styles.fullWidth}>
          <label>Atención (tipos de paciente)</label>
          <div className={styles.checkboxGroup}>
            {atencionOptions.map((opt) => (
              <label key={opt} className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={form.atencion?.includes(opt)}
                  onChange={() => handleAtencionChange(opt)}
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        <div className={styles.fullWidth}>
          <label>Notas / Días de cirugía</label>
          <textarea name="notas" value={form.notas} onChange={handleChange} rows={3} />
        </div>
      </div>
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnPrimary}>Guardar</button>
        <button type="button" className={styles.btnSecondary} onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  );
}
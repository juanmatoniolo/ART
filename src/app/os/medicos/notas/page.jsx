'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './notas.module.css';

// Helper para formatear fecha local a YYYY-MM-DD
function getLocalDateString(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
}

// Formatear fecha para mostrar
function formatDate(isoString) {
  if (!isoString) return '—';
  const [year, month, day] = isoString.split('-');
  return `${day}/${month}/${year}`;
}

export default function NotasPage() {
  // Estado para la lista de cirugías
  const [cirugias, setCirugias] = useState([]);
  // Estado para el formulario (nueva/edición)
  const [form, setForm] = useState({
    id: null,
    fecha: getLocalDateString(),
    tipoCirugia: '',
    medico: '',
    ecgRealizado: false,
    laboratorioRealizado: false,
    necesitaMaterial: false,
    notas: '',
    realizada: false,
  });
  // Estado para modo edición
  const [editMode, setEditMode] = useState(false);

  // Cargar datos al montar (simulado - aquí deberías conectar con Firebase)
  useEffect(() => {
    // Ejemplo: cargar desde localStorage o Firebase
    const stored = localStorage.getItem('cirugias');
    if (stored) {
      setCirugias(JSON.parse(stored));
    }
  }, []);

  // Guardar en localStorage cada vez que cambie la lista (simulado)
  useEffect(() => {
    localStorage.setItem('cirugias', JSON.stringify(cirugias));
  }, [cirugias]);

  // Manejar cambios en el formulario
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Guardar nueva cirugía o actualizar existente
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.tipoCirugia.trim() || !form.medico.trim()) {
      alert('Completá los campos obligatorios: Cirugía y Médico');
      return;
    }

    if (editMode) {
      // Actualizar
      setCirugias(prev =>
        prev.map(c => (c.id === form.id ? { ...form } : c))
      );
      setEditMode(false);
    } else {
      // Crear nueva
      const nueva = {
        ...form,
        id: Date.now().toString(),
      };
      setCirugias(prev => [nueva, ...prev]);
    }

    // Resetear formulario
    setForm({
      id: null,
      fecha: getLocalDateString(),
      tipoCirugia: '',
      medico: '',
      ecgRealizado: false,
      laboratorioRealizado: false,
      necesitaMaterial: false,
      notas: '',
      realizada: false,
    });
  };

  // Cargar datos en el formulario para editar
  const handleEdit = (cirugia) => {
    setForm(cirugia);
    setEditMode(true);
    // Hacer scroll al formulario
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Eliminar una cirugía
  const handleDelete = (id) => {
    if (confirm('¿Eliminar esta cirugía?')) {
      setCirugias(prev => prev.filter(c => c.id !== id));
    }
  };

  // Marcar como realizada (toggle)
  const toggleRealizada = (id) => {
    setCirugias(prev =>
      prev.map(c =>
        c.id === id ? { ...c, realizada: !c.realizada } : c
      )
    );
  };

  // Cancelar edición
  const handleCancel = () => {
    setEditMode(false);
    setForm({
      id: null,
      fecha: getLocalDateString(),
      tipoCirugia: '',
      medico: '',
      ecgRealizado: false,
      laboratorioRealizado: false,
      necesitaMaterial: false,
      notas: '',
      realizada: false,
    });
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>📋 Planificación de Cirugías</h1>
        <Link href="/admin/medicos" className={styles.btnSecondary}>
          ← Volver
        </Link>
      </header>

      {/* Formulario para agregar/editar */}
      <div className={styles.formCard}>
        <h2 className={styles.formTitle}>
          {editMode ? '✏️ Editar cirugía' : '➕ Nueva cirugía'}
        </h2>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label>Fecha de la cirugía *</label>
              <input
                type="date"
                name="fecha"
                value={form.fecha}
                onChange={handleChange}
                required
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label>Médico *</label>
              <input
                type="text"
                name="medico"
                value={form.medico}
                onChange={handleChange}
                placeholder="Apellido, Nombre"
                required
                className={styles.input}
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Tipo de cirugía *</label>
            <input
              type="text"
              name="tipoCirugia"
              value={form.tipoCirugia}
              onChange={handleChange}
              placeholder="Ej: Colecistectomía, Artroscopia..."
              required
              className={styles.input}
            />
          </div>

          <div className={styles.checkboxGroup}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="ecgRealizado"
                checked={form.ecgRealizado}
                onChange={handleChange}
              />
              ECG realizado
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="laboratorioRealizado"
                checked={form.laboratorioRealizado}
                onChange={handleChange}
              />
              Laboratorio realizado
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="necesitaMaterial"
                checked={form.necesitaMaterial}
                onChange={handleChange}
              />
              Necesita material especial
            </label>
          </div>

          <div className={styles.formGroup}>
            <label>Notas / observaciones</label>
            <textarea
              name="notas"
              value={form.notas}
              onChange={handleChange}
              rows="3"
              className={styles.textarea}
              placeholder="Detalles adicionales, material requerido, etc."
            />
          </div>

          <div className={styles.formActions}>
            <button type="submit" className={styles.btnPrimary}>
              {editMode ? 'Actualizar' : 'Guardar cirugía'}
            </button>
            {editMode && (
              <button type="button" onClick={handleCancel} className={styles.btnSecondary}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Listado de cirugías */}
      <div className={styles.listSection}>
        <h2 className={styles.listTitle}>📅 Cirugías programadas</h2>
        {cirugias.length === 0 ? (
          <p className={styles.empty}>No hay cirugías registradas.</p>
        ) : (
          <div className={styles.cirugiasGrid}>
            {cirugias.map(c => (
              <div
                key={c.id}
                className={`${styles.cirugiaCard} ${c.realizada ? styles.realizada : ''}`}
              >
                <div className={styles.cardHeader}>
                  <span className={styles.fechaBadge}>{formatDate(c.fecha)}</span>
                  <span className={styles.medicoBadge}>{c.medico}</span>
                </div>
                <h3 className={styles.cirugiaTipo}>{c.tipoCirugia}</h3>

                <div className={styles.estudios}>
                  <span className={`${styles.estudio} ${c.ecgRealizado ? styles.ok : styles.pending}`}>
                    ECG {c.ecgRealizado ? '✅' : '⏳'}
                  </span>
                  <span className={`${styles.estudio} ${c.laboratorioRealizado ? styles.ok : styles.pending}`}>
                    Lab {c.laboratorioRealizado ? '✅' : '⏳'}
                  </span>
                  {c.necesitaMaterial && (
                    <span className={styles.materialBadge}>🛠️ Material</span>
                  )}
                </div>

                {c.notas && <p className={styles.notas}>{c.notas}</p>}

                <div className={styles.cardActions}>
                  <button
                    onClick={() => toggleRealizada(c.id)}
                    className={`${styles.btnAction} ${styles.btnToggle}`}
                    title={c.realizada ? 'Marcar como pendiente' : 'Marcar como realizada'}
                  >
                    {c.realizada ? '↩️' : '✅'}
                  </button>
                  <button
                    onClick={() => handleEdit(c)}
                    className={`${styles.btnAction} ${styles.btnEdit}`}
                    title="Editar"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className={`${styles.btnAction} ${styles.btnDelete}`}
                    title="Eliminar"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
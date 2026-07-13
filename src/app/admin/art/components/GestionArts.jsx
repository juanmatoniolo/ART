import { useState } from 'react';
import styles from '../page.module.css';

export default function GestionArts({ 
  arts, 
  onAdd, 
  onUpdate, 
  onDelete, 
  onClose,
}) {
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    nombre: '',
    color: '#3b82f6',
    siniestros: [],
    facturacion: [],
    convenios: [],
  });

  // RESETEAR FORM PARA NUEVO
  const resetForm = () => {
    setEditingId(null);
    setForm({
      nombre: '',
      color: '#3b82f6',
      siniestros: [],
      facturacion: [],
      convenios: [],
    });
  };

  // EDITAR UNA ART EXISTENTE
  const editArt = (art) => {
    setEditingId(art.id);
    setForm({
      nombre: art.nombre || '',
      color: art.color || '#3b82f6',
      siniestros: Array.isArray(art.siniestros) ? art.siniestros : [],
      facturacion: Array.isArray(art.facturacion) ? art.facturacion : [],
      convenios: Array.isArray(art.convenios) ? art.convenios : [],
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) return alert('El nombre es obligatorio');
    try {
      if (editingId) {
        await onUpdate(editingId, form);
      } else {
        await onAdd(form);
      }
      resetForm();
      onClose();
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    }
  };

  const addEmail = (category) => {
    setForm(prev => ({
      ...prev,
      [category]: [...(prev[category] || []), { nombre: '', email: '' }],
    }));
  };

  const updateEmail = (category, index, field, value) => {
    setForm(prev => {
      const current = prev[category] || [];
      const updated = [...current];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, [category]: updated };
    });
  };

  const removeEmail = (category, index) => {
    setForm(prev => ({
      ...prev,
      [category]: (prev[category] || []).filter((_, i) => i !== index),
    }));
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <div className={styles.formAtajoOverlay} onClick={handleClose}>
      <div className={styles.formAtajo} onClick={e => e.stopPropagation()}>
        <h3 className={styles.formAtajoTitle}>
          {editingId ? '✏️ Editar ART' : '➕ Nueva ART'}
        </h3>
        <form onSubmit={handleSubmit}>
          <div className={styles.formAtajoField}>
            <label className={styles.formAtajoLabel}>Nombre *</label>
            <input
              className={styles.inp}
              value={form.nombre}
              onChange={e => setForm({...form, nombre: e.target.value})}
              placeholder="Ej: Asociart"
              required
            />
          </div>
          <div className={styles.formAtajoField}>
            <label className={styles.formAtajoLabel}>Color</label>
            <input
              type="color"
              className={styles.inp}
              value={form.color}
              onChange={e => setForm({...form, color: e.target.value})}
            />
          </div>

          {['siniestros', 'facturacion', 'convenios'].map(cat => (
            <div key={cat} className={styles.formAtajoField}>
              <label className={styles.formAtajoLabel}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </label>
              {(form[cat] || []).map((item, idx) => (
                <div key={idx} className={styles.emailRow} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                  <input
                    className={styles.inp}
                    placeholder="Nombre"
                    value={item.nombre}
                    onChange={e => updateEmail(cat, idx, 'nombre', e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <input
                    className={styles.inp}
                    placeholder="Email"
                    value={item.email}
                    onChange={e => updateEmail(cat, idx, 'email', e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <button type="button" className={styles.tinyBtn} onClick={() => removeEmail(cat, idx)}>✕</button>
                </div>
              ))}
              <button type="button" className={styles.tinyBtn} onClick={() => addEmail(cat)}>+ Agregar</button>
            </div>
          ))}

          <div className={styles.formAtajoBtns}>
            <button type="submit" className={styles.formBtnSave}>
              {editingId ? '💾 Actualizar' : '➕ Guardar'}
            </button>
            <button type="button" className={styles.formBtnCancel} onClick={handleClose}>
              Cancelar
            </button>
            {editingId && (
              <button type="button" className={styles.formBtnDelete} onClick={() => { if(confirm('¿Eliminar ART?')) onDelete(editingId); }}>
                🗑 Eliminar
              </button>
            )}
          </div>
        </form>

        <div style={{ marginTop: 20, borderTop: '1px solid rgba(148,163,184,0.2)', paddingTop: 12 }}>
          <p className={styles.formAtajoLabel}>ARTs existentes</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {arts.map(art => (
              <button key={art.id} className={styles.tinyBtn} onClick={() => editArt(art)}>
                {art.nombre}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
'use client';

import { useState } from 'react';
import styles from './facturacion.module.css';

// Opciones para el seguro/ART
const OPCIONES_SEGURO = [
  { value: '', label: 'Seleccionar seguro...' },
  { value: 'IAPS A.P', label: 'IAPS A.P' },
  { value: 'Medicar Work', label: 'Medicar Work' },
  { value: 'IAPS ART', label: 'IAPS ART' },
  { value: 'La Segunda Personas', label: 'La Segunda Personas' },
  { value: 'La Segunda ART', label: 'La Segunda ART' },
  { value: 'Victoria Seguro', label: 'Victoria Seguro' },
  { value: 'Asociart', label: 'Asociart' },
  { value: 'Otro', label: 'Otro' }
];

export default function DatosPaciente({ paciente, setPaciente, onSiguiente }) {
  const [seguroCustom, setSeguroCustom] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setPaciente(prev => ({ ...prev, [name]: value }));
  };

  const handleSeguroChange = (e) => {
    const value = e.target.value;
    
    if (value === 'Otro') {
      setShowCustomInput(true);
      setPaciente(prev => ({ ...prev, artSeguro: '' }));
      setSeguroCustom('');
    } else {
      setShowCustomInput(false);
      setSeguroCustom('');
      setPaciente(prev => ({ ...prev, artSeguro: value }));
    }
  };

  const handleCustomSeguroChange = (e) => {
    const value = e.target.value;
    setSeguroCustom(value);
    setPaciente(prev => ({ ...prev, artSeguro: value }));
  };

  const handleSiguiente = () => {
    if (!paciente.nombreCompleto || !paciente.dni) {
      alert('Complete Nombre Completo y DNI');
      return;
    }
    onSiguiente();
  };

  return (
    <div className={styles.tabContent}>
      <h2>👤 Datos del Paciente</h2>
      
      <div className={styles.formGrid}>
        {/* Nombre y Apellido en un solo campo */}
        <div className={styles.formGroupFull}>
          <label>Nombre Completo *</label>
          <input
            type="text"
            name="nombreCompleto"
            value={paciente.nombreCompleto || ''}
            onChange={handleChange}
            placeholder="Apellido y Nombre"
            className={styles.input}
            autoFocus
          />
        </div>
        
        {/* DNI */}
        <div className={styles.formGroup}>
          <label>DNI *</label>
          <input
            type="text"
            name="dni"
            value={paciente.dni || ''}
            onChange={handleChange}
            placeholder="Número de DNI"
            className={styles.input}
          />
        </div>
        
        {/* ART/Seguro - Menu desplegable */}
        <div className={styles.formGroup}>
          <label>ART/Seguro</label>
          <select
            name="artSeguro"
            value={paciente.artSeguro === seguroCustom ? 'Otro' : paciente.artSeguro}
            onChange={handleSeguroChange}
            className={styles.select}
          >
            {OPCIONES_SEGURO.map((opcion) => (
              <option key={opcion.value} value={opcion.value}>
                {opcion.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Campo para "Otro" seguro */}
        {showCustomInput && (
          <div className={styles.formGroupFull}>
            <label>Especificar otro seguro</label>
            <input
              type="text"
              value={seguroCustom}
              onChange={handleCustomSeguroChange}
              placeholder="Ingrese el nombre del seguro"
              className={styles.input}
            />
          </div>
        )}
        
        {/* N° Siniestro (Opcional) */}
        <div className={styles.formGroup}>
          <label>N° Siniestro (STRO)</label>
          <input
            type="text"
            name="nroSiniestro"
            value={paciente.nroSiniestro || ''}
            onChange={handleChange}
            placeholder="Opcional"
            className={styles.input}
          />
        </div>
        
  
      </div>
      
      {/* Información adicional */}
      <div className={styles.infoBox}>
        <p><strong>Nota:</strong> Solo los campos marcados con * son obligatorios.</p>
        <p>El número de siniestro es opcional y solo necesario para casos de ART.</p>
      </div>
      
      <div className={styles.botonesNavegacion}>
        <button 
          className={styles.btnSiguiente}
          onClick={handleSiguiente}
          disabled={!paciente.nombreCompleto || !paciente.dni}
        >
          Siguiente → Prácticas
        </button>
      </div>
    </div>
  );
}
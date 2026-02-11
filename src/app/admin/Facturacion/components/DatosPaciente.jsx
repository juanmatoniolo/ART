'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './datosPaciente.module.css';

const OPCIONES_SEGURO = [
  { value: '', label: 'Seleccionar seguro...', disabled: true },
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
  const [errors, setErrors] = useState({});
  const [isFormValid, setIsFormValid] = useState(false);
  const nombreRef = useRef(null);

  useEffect(() => {
    const validateForm = () => {
      const nombreValido = paciente.nombreCompleto?.trim().length >= 3;
      const dniValido = paciente.dni?.trim().length >= 7 && /^\d+$/.test(paciente.dni?.trim());
      setIsFormValid(nombreValido && dniValido);

      const newErrors = {};
      if (paciente.nombreCompleto && !nombreValido) {
        newErrors.nombreCompleto = 'Nombre debe tener al menos 3 caracteres';
      }
      if (paciente.dni && !dniValido) {
        newErrors.dni = 'DNI debe tener al menos 7 dígitos numéricos';
      }
      setErrors(newErrors);
    };
    validateForm();
  }, [paciente.nombreCompleto, paciente.dni]);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isFormValid) {
      if (!paciente.nombreCompleto?.trim()) {
        alert('Ingrese el nombre completo');
        nombreRef.current?.focus();
      } else if (!paciente.dni?.trim()) {
        alert('Ingrese el DNI');
      }
      return;
    }
    onSiguiente();
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabContent}>
        <h2>Datos del Paciente</h2>
        <form onSubmit={handleSubmit} className={styles.formGrid} noValidate>
          <div className={styles.formGroupFull}>
            <label htmlFor="nombreCompleto" required>Nombre Completo *</label>
            <input
              ref={nombreRef}
              id="nombreCompleto"
              type="text"
              name="nombreCompleto"
              value={paciente.nombreCompleto || ''}
              onChange={handleChange}
              placeholder="Apellido y Nombre"
              className={`${styles.input} ${errors.nombreCompleto ? styles.hasError : ''}`}
              required
              minLength="3"
            />
            {errors.nombreCompleto && <span className={styles.errorMessage}>{errors.nombreCompleto}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="dni" required>DNI *</label>
            <input
              id="dni"
              type="text"
              name="dni"
              value={paciente.dni || ''}
              onChange={handleChange}
              placeholder="Número de DNI (solo números)"
              className={`${styles.input} ${errors.dni ? styles.hasError : ''}`}
              required
              inputMode="numeric"
              pattern="[0-9]*"
              minLength="7"
              maxLength="10"
            />
            {errors.dni && <span className={styles.errorMessage}>{errors.dni}</span>}
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="artSeguro">ART/Seguro</label>
            <select
              id="artSeguro"
              name="artSeguro"
              value={paciente.artSeguro === seguroCustom ? 'Otro' : paciente.artSeguro}
              onChange={handleSeguroChange}
              className={styles.select}
            >
              {OPCIONES_SEGURO.map(opcion => (
                <option key={opcion.value} value={opcion.value} disabled={opcion.disabled}>
                  {opcion.label}
                </option>
              ))}
            </select>
          </div>

          {showCustomInput && (
            <div className={`${styles.formGroupFull} ${styles.customSeguroInput}`}>
              <label htmlFor="seguroCustom">Especificar otro seguro</label>
              <input
                id="seguroCustom"
                type="text"
                value={seguroCustom}
                onChange={handleCustomSeguroChange}
                placeholder="Ingrese el nombre del seguro"
                className={styles.input}
                autoFocus
              />
            </div>
          )}

          <div className={styles.formGroup}>
            <label htmlFor="nroSiniestro">N° Siniestro (STRO)</label>
            <input
              id="nroSiniestro"
              type="text"
              name="nroSiniestro"
              value={paciente.nroSiniestro || ''}
              onChange={handleChange}
              placeholder="Opcional"
              className={styles.input}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="fechaAtencion">Fecha de Atención</label>
            <input
              id="fechaAtencion"
              type="date"
              name="fechaAtencion"
              value={paciente.fechaAtencion || new Date().toISOString().split('T')[0]}
              onChange={handleChange}
              className={styles.input}
            />
          </div>

          <div className={styles.infoBox}>
            <p><strong>Nota:</strong> Los campos marcados con * son obligatorios.</p>
          </div>

          <div className={styles.botonesNavegacion}>
            <button type="submit" className={styles.btnSiguiente} disabled={!isFormValid}>
              Siguiente: Prácticas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
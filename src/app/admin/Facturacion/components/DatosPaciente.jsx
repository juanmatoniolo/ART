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

  // Validar formulario en tiempo real
  useEffect(() => {
    const validateForm = () => {
      const nombreValido = paciente.nombreCompleto?.trim().length >= 3;
      const dniValido = paciente.dni?.trim().length >= 7 && /^\d+$/.test(paciente.dni?.trim());
      
      setIsFormValid(nombreValido && dniValido);
      
      // Actualizar errores
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
    if (nombreRef.current) {
      nombreRef.current.focus();
    }
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
    
    // Validación final
    if (!isFormValid) {
      // Mostrar alerta más informativa
      if (!paciente.nombreCompleto?.trim()) {
        alert('Por favor, ingrese el nombre completo del paciente');
        nombreRef.current?.focus();
      } else if (!paciente.dni?.trim()) {
        alert('Por favor, ingrese el DNI del paciente');
      } else if (paciente.nombreCompleto?.trim().length < 3) {
        alert('El nombre debe tener al menos 3 caracteres');
        nombreRef.current?.focus();
      } else if (!/^\d+$/.test(paciente.dni?.trim())) {
        alert('El DNI debe contener solo números');
      } else {
        alert('Complete todos los campos obligatorios correctamente');
      }
      return;
    }
    
    // Si todo está bien, proceder
    console.log('Formulario válido, navegando a prácticas...');
    onSiguiente();
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabContent}>
        <h2>Datos del Paciente</h2>
        
        <form onSubmit={handleSubmit} className={styles.formGrid} noValidate>
          {/* Nombre Completo */}
          <div className={styles.formGroupFull}>
            <label htmlFor="nombreCompleto" required>
              Nombre Completo *
            </label>
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
              aria-required="true"
              aria-label="Nombre completo del paciente"
              aria-invalid={!!errors.nombreCompleto}
              aria-describedby={errors.nombreCompleto ? 'nombre-error' : undefined}
              minLength="3"
            />
            {errors.nombreCompleto && (
              <span id="nombre-error" className={styles.errorMessage}>
                {errors.nombreCompleto}
              </span>
            )}
          </div>
          
          {/* DNI */}
          <div className={styles.formGroup}>
            <label htmlFor="dni" required>
              DNI *
            </label>
            <input
              id="dni"
              type="text"
              name="dni"
              value={paciente.dni || ''}
              onChange={handleChange}
              placeholder="Número de DNI (solo números)"
              className={`${styles.input} ${errors.dni ? styles.hasError : ''}`}
              required
              aria-required="true"
              aria-label="Número de documento del paciente"
              inputMode="numeric"
              pattern="[0-9]*"
              minLength="7"
              maxLength="10"
              aria-invalid={!!errors.dni}
              aria-describedby={errors.dni ? 'dni-error' : undefined}
            />
            {errors.dni && (
              <span id="dni-error" className={styles.errorMessage}>
                {errors.dni}
              </span>
            )}
          </div>
          
          {/* ART/Seguro */}
          <div className={styles.formGroup}>
            <label htmlFor="artSeguro">
              ART/Seguro
            </label>
            <select
              id="artSeguro"
              name="artSeguro"
              value={paciente.artSeguro === seguroCustom ? 'Otro' : paciente.artSeguro}
              onChange={handleSeguroChange}
              className={styles.select}
              aria-label="Seleccionar seguro o ART"
            >
              {OPCIONES_SEGURO.map((opcion) => (
                <option 
                  key={opcion.value} 
                  value={opcion.value}
                  disabled={opcion.disabled}
                >
                  {opcion.label}
                </option>
              ))}
            </select>
          </div>
          
          {/* Campo para "Otro" seguro */}
          {showCustomInput && (
            <div className={`${styles.formGroupFull} ${styles.customSeguroInput}`}>
              <label htmlFor="seguroCustom">
                Especificar otro seguro
              </label>
              <input
                id="seguroCustom"
                type="text"
                value={seguroCustom}
                onChange={handleCustomSeguroChange}
                placeholder="Ingrese el nombre del seguro"
                className={styles.input}
                aria-label="Nombre personalizado del seguro"
                autoFocus
              />
            </div>
          )}
          
          {/* N° Siniestro */}
          <div className={styles.formGroup}>
            <label htmlFor="nroSiniestro">
              N° Siniestro (STRO)
            </label>
            <input
              id="nroSiniestro"
              type="text"
              name="nroSiniestro"
              value={paciente.nroSiniestro || ''}
              onChange={handleChange}
              placeholder="Opcional"
              className={styles.input}
              aria-label="Número de siniestro (opcional)"
            />
          </div>
          
          {/* Fecha de Atención */}
          <div className={styles.formGroup}>
            <label htmlFor="fechaAtencion">
              Fecha de Atención
            </label>
            <input
              id="fechaAtencion"
              type="date"
              name="fechaAtencion"
              value={paciente.fechaAtencion || new Date().toISOString().split('T')[0]}
              onChange={handleChange}
              className={styles.input}
              aria-label="Fecha de atención"
            />
          </div>
          
          {/* Información adicional */}
          <div className={styles.infoBox} role="note" aria-label="Nota informativa">
            <p><strong>Nota:</strong> Los campos marcados con * son obligatorios.</p>
            <p>El nombre debe tener al menos 3 caracteres y el DNI debe ser numérico.</p>
          </div>
          
          <div className={styles.botonesNavegacion}>
            <button 
              type="submit"
              className={styles.btnSiguiente}
              disabled={!isFormValid}
              aria-disabled={!isFormValid}
            >
              Siguiente: Prácticas
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
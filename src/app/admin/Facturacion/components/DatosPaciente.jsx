'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

const onlyDigits = (s) => (s ?? '').replace(/\D/g, '');

export default function DatosPaciente({ paciente, setPaciente, onSiguiente }) {
  const [seguroCustom, setSeguroCustom] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const nombreRef = useRef(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // 🔎 Detecta si el seguro actual es uno de la lista
  const seguroEsDeLista = useMemo(() => {
    const v = (paciente.artSeguro || '').trim();
    if (!v) return true; // vacío => se considera “de lista”
    return OPCIONES_SEGURO.some((o) => o.value === v);
  }, [paciente.artSeguro]);

  // Si el paciente trae un seguro que no está en lista, lo tratamos como custom
  useEffect(() => {
    const v = (paciente.artSeguro || '').trim();
    if (v && !seguroEsDeLista) {
      setShowCustomInput(true);
      setSeguroCustom(v);
    }
  }, [paciente.artSeguro, seguroEsDeLista]);

  const isFormValid = useMemo(() => {
    const nombreValido = (paciente.nombreCompleto || '').trim().length >= 3;
    const dni = (paciente.dni || '').trim();
    const dniValido = dni.length >= 7 && /^\d+$/.test(dni);
    return nombreValido && dniValido;
  }, [paciente.nombreCompleto, paciente.dni]);

  useEffect(() => {
    const newErrors = {};
    const nombre = (paciente.nombreCompleto || '').trim();
    const dni = (paciente.dni || '').trim();

    if (touched.nombreCompleto && nombre && nombre.length < 3) {
      newErrors.nombreCompleto = 'Nombre debe tener al menos 3 caracteres.';
    }
    if (touched.dni && dni && (dni.length < 7 || !/^\d+$/.test(dni))) {
      newErrors.dni = 'DNI debe tener al menos 7 dígitos numéricos.';
    }

    setErrors(newErrors);
  }, [paciente.nombreCompleto, paciente.dni, touched]);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  const setField = (name, value) => {
    setPaciente((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleSeguroChange = (e) => {
    const value = e.target.value;
    if (value === 'Otro') {
      setShowCustomInput(true);
      setSeguroCustom('');
      setField('artSeguro', '');
      return;
    }
    setShowCustomInput(false);
    setSeguroCustom('');
    setField('artSeguro', value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Marcar touched para mostrar errores si intentan avanzar
    setTouched({ nombreCompleto: true, dni: true });

    if (!isFormValid) {
      if (!(paciente.nombreCompleto || '').trim()) {
        nombreRef.current?.focus();
      }
      return;
    }
    onSiguiente();
  };

  // ✅ value del select sin el bug de "Otro" cuando está vacío
  const selectValue = showCustomInput ? 'Otro' : (paciente.artSeguro || '');

  return (
    <section className={styles.container} aria-label="Datos del paciente">
      <header className={styles.header}>
        <h2 className={styles.title}>Datos del Paciente</h2>
        <p className={styles.subtitle}>
          Completa los datos mínimos para continuar con prácticas y cálculos.
        </p>
      </header>

      <form onSubmit={handleSubmit} className={styles.card} noValidate>
        {/* Nombre */}
        <div className={styles.formGroupFull}>
          <label className={styles.label} htmlFor="nombreCompleto">
            Nombre Completo <span className={styles.req}>*</span>
          </label>

          <input
            ref={nombreRef}
            id="nombreCompleto"
            type="text"
            name="nombreCompleto"
            value={paciente.nombreCompleto || ''}
            onChange={(e) => setField('nombreCompleto', e.target.value)}
            onBlur={handleBlur}
            placeholder="Apellido y Nombre"
            className={`${styles.input} ${errors.nombreCompleto ? styles.hasError : ''}`}
            autoComplete="name"
            aria-invalid={!!errors.nombreCompleto}
            aria-describedby={errors.nombreCompleto ? 'err-nombre' : 'help-nombre'}
          />

          {!errors.nombreCompleto ? (
            <small id="help-nombre" className={styles.help}>
              Ej: “Pérez Juan”. Mínimo 3 caracteres.
            </small>
          ) : (
            <span id="err-nombre" className={styles.errorMessage} role="alert">
              {errors.nombreCompleto}
            </span>
          )}
        </div>

        {/* DNI */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="dni">
            DNI <span className={styles.req}>*</span>
          </label>

          <input
            id="dni"
            type="text"
            name="dni"
            value={paciente.dni || ''}
            onChange={(e) => setField('dni', onlyDigits(e.target.value).slice(0, 10))}
            onBlur={handleBlur}
            placeholder="Solo números"
            className={`${styles.input} ${errors.dni ? styles.hasError : ''}`}
            inputMode="numeric"
            autoComplete="off"
            aria-invalid={!!errors.dni}
            aria-describedby={errors.dni ? 'err-dni' : 'help-dni'}
          />

          {!errors.dni ? (
            <small id="help-dni" className={styles.help}>
              Mínimo 7 dígitos (sin puntos).
            </small>
          ) : (
            <span id="err-dni" className={styles.errorMessage} role="alert">
              {errors.dni}
            </span>
          )}
        </div>

        {/* ART/Seguro */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="artSeguro">
            ART / Seguro
          </label>

          <select
            id="artSeguro"
            name="artSeguro"
            value={selectValue}
            onChange={handleSeguroChange}
            className={styles.select}
          >
            {OPCIONES_SEGURO.map((op) => (
              <option key={op.value} value={op.value} disabled={op.disabled}>
                {op.label}
              </option>
            ))}
          </select>

          <small className={styles.help}>Si no figura en la lista, elegí “Otro”.</small>
        </div>

        {showCustomInput && (
          <div className={styles.formGroupFull}>
            <label className={styles.label} htmlFor="seguroCustom">
              Especificar otro seguro
            </label>

            <input
              id="seguroCustom"
              type="text"
              value={seguroCustom}
              onChange={(e) => {
                const v = e.target.value;
                setSeguroCustom(v);
                setField('artSeguro', v);
              }}
              placeholder="Ingrese el nombre del seguro"
              className={styles.input}
              autoFocus
            />

            <small className={styles.help}>Ej: “Swiss Medical”, “OSDE”, etc.</small>
          </div>
        )}

        {/* Siniestro */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="nroSiniestro">
            N° Siniestro (STRO)
          </label>

          <input
            id="nroSiniestro"
            type="text"
            name="nroSiniestro"
            value={paciente.nroSiniestro || ''}
            onChange={(e) => setField('nroSiniestro', e.target.value)}
            placeholder="Opcional"
            className={styles.input}
            autoComplete="off"
          />

          <small className={styles.help}>Si no lo tenés, podés dejarlo vacío.</small>
        </div>

        {/* Fecha */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="fechaAtencion">
            Fecha de Atención
          </label>

          <input
            id="fechaAtencion"
            type="date"
            name="fechaAtencion"
            value={paciente.fechaAtencion || today}
            onChange={(e) => setField('fechaAtencion', e.target.value)}
            className={styles.input}
          />

          <small className={styles.help}>Por defecto: hoy. Podés ajustarla.</small>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <div className={styles.note} role="note">
            <span className={styles.noteIcon}>ℹ️</span>
            Los campos con <b>*</b> son obligatorios.
          </div>

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={!isFormValid}
            aria-disabled={!isFormValid}
          >
            {isFormValid ? 'Siguiente: Prácticas →' : 'Completa nombre y DNI'}
          </button>
        </div>
      </form>
    </section>
  );
}

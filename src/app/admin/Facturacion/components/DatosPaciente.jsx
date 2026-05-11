'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import styles from './datosPaciente.module.css';



const FIREBASE_URL = 'https://datos-clini-default-rtdb.firebaseio.com';

// Lista completa de ART (igual que en el formulario de pacientes)
const ART_OPTIONS = [
  'Asociart',
  'COMFYE',
  'Federacion patronal AP',
  'Federacion patronal ART',
  'IAPS AP',
  'IAPS ART',
  'La segunda ART',
  'La segunda personas',
  'Medicar work',
  'Victoria seguros',
];

const onlyDigits = (s) => (s ?? '').replace(/\D/g, '');

export default function DatosPaciente({ paciente, setPaciente, onSiguiente }) {
  const [seguroCustom, setSeguroCustom] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const nombreRef = useRef(null);

  // Estado para búsqueda de pacientes
  const [pacientesActivos, setPacientesActivos] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [cargandoPacientes, setCargandoPacientes] = useState(false);
  const searchRef = useRef(null);

  const today = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Cargar pacientes activos desde Firebase
  useEffect(() => {
    const fetchPacientes = async () => {
      setCargandoPacientes(true);
      try {
        const res = await fetch(`${FIREBASE_URL}/pacientes.json`);
        if (!res.ok) throw new Error('Error al cargar pacientes');
        const data = await res.json();
        if (data) {
          const activos = Object.entries(data)
            .map(([id, value]) => ({ id, ...value }))
            .filter((p) => (p.estado || 'activo') === 'activo')
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
          setPacientesActivos(activos);
        }
      } catch (err) {
        console.error('Error cargando pacientes activos:', err);
      } finally {
        setCargandoPacientes(false);
      }
    };
    fetchPacientes();
  }, []);

  // Filtrar resultados de búsqueda localmente
  const resultadosBusqueda = useMemo(() => {
    if (!busqueda.trim()) return [];
    const term = busqueda.toLowerCase();
    return pacientesActivos.filter((p) => {
      const nombreCompleto = `${p.trabajador?.apellido || ''} ${p.trabajador?.nombre || ''}`.toLowerCase();
      const dni = p.trabajador?.dni || '';
      return nombreCompleto.includes(term) || dni.includes(term);
    });
  }, [busqueda, pacientesActivos]);

  // Ocultar resultados al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setMostrarResultados(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Seleccionar un paciente y cargar sus datos en el formulario
  const seleccionarPaciente = (pac) => {
    const t = pac.trabajador || {};
    const art = pac.ART || {};
    const nombreCompleto = `${t.apellido || ''} ${t.nombre || ''}`.trim();

    setPaciente((prev) => ({
      ...prev,
      nombreCompleto,
      dni: t.dni || '',
      artSeguro: art.nombre || '',
      nroSiniestro: art.nroSiniestro || '',
    }));

    setBusqueda('');
    setMostrarResultados(false);
    nombreRef.current?.focus();
  };

  // Determina si el seguro actual está en la lista predefinida
  const seguroEsDeLista = useMemo(() => {
    const v = (paciente.artSeguro || '').trim();
    if (!v) return true;
    return ART_OPTIONS.includes(v);
  }, [paciente.artSeguro]);

  // Sincronizar el campo custom
  useEffect(() => {
    const v = (paciente.artSeguro || '').trim();
    if (v && !seguroEsDeLista) {
      setShowCustomInput(true);
      setSeguroCustom(v);
    } else {
      setShowCustomInput(false);
      setSeguroCustom('');
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
    setTouched({ nombreCompleto: true, dni: true });
    if (!isFormValid) {
      if (!(paciente.nombreCompleto || '').trim()) {
        nombreRef.current?.focus();
      }
      return;
    }
    onSiguiente();
  };

  const selectValue = showCustomInput ? 'Otro' : (paciente.artSeguro || '');

  return (
    <>
      {/* Estilos globales para modo oscuro dentro de este componente */}
      <style jsx>{`
        .darkContainer {
          background-color: #121212;
          color: #ffffff;
        }
        .darkContainer input,
        .darkContainer select,
        .darkContainer textarea {
          background-color: #2c2c2c;
          color: #ffffff;
          border-color: #444;
        }
        .darkContainer input:focus,
        .darkContainer select:focus {
          border-color: #3b82f6;
          outline: none;
        }
        .darkContainer .help,
        .darkContainer .label {
          color: #cccccc;
        }
        .darkContainer .resultadoItem {
          color: #ffffff;
          background-color: #1e1e1e;
          border-bottom-color: #333;
        }
        .darkContainer .resultadoItem:hover {
          background-color: #2c2c2c;
        }
        .darkContainer .searchInput {
          background-color: #2c2c2c;
          color: #fff;
        }
      `}</style>

      <section className={`${styles.container} darkContainer`} aria-label="Datos del paciente">
        <header className={styles.header}>
          <h2 className={styles.title}>Datos del Paciente</h2>
          <p className={styles.subtitle}>
            Podés buscar un paciente existente o cargar sus datos manualmente.
          </p>
        </header>

        {/* BLOQUE DE BÚSQUEDA DE PACIENTES EXISTENTES */}
        <div className={styles.cardSearch} ref={searchRef}>
          <label className={styles.label}>🔎 Buscar paciente activo</label>
          <div className={styles.searchWrapper}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Escribí nombre, apellido o DNI..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setMostrarResultados(true);
              }}
              onFocus={() => setMostrarResultados(true)}
            />
            {cargandoPacientes && <span className={styles.spinnerSmall} />}
          </div>

          {mostrarResultados && busqueda.trim() !== '' && (
            <div className={styles.resultadosLista}>
              {resultadosBusqueda.length === 0 ? (
                <div className={styles.sinResultados}>No se encontraron pacientes activos.</div>
              ) : (
                resultadosBusqueda.map((pac) => {
                  const nombre = `${pac.trabajador?.apellido || ''} ${pac.trabajador?.nombre || ''}`.trim();
                  const dni = pac.trabajador?.dni || '';
                  return (
                    <button
                      key={pac.id}
                      type="button"
                      className={styles.resultadoItem}
                      onClick={() => seleccionarPaciente(pac)}
                    >
                      <strong>{nombre}</strong> {dni && `(DNI: ${dni})`}
                      {pac.ART?.nombre && <span className={styles.resultadoArt}> • {pac.ART.nombre}</span>}
                    </button>
                  );
                })
              )}
            </div>
          )}
          <small className={styles.help}>Al seleccionar, se completarán los campos de abajo. Podés editarlos si es necesario.</small>
        </div>

        {/* FORMULARIO MANUAL */}
        <form onSubmit={handleSubmit} className={styles.card} noValidate>
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
            />
            {!errors.nombreCompleto ? (
              <small className={styles.help}>Mínimo 3 caracteres.</small>
            ) : (
              <span className={styles.errorMessage}>{errors.nombreCompleto}</span>
            )}
          </div>

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
            />
            {!errors.dni ? (
              <small className={styles.help}>Mínimo 7 dígitos.</small>
            ) : (
              <span className={styles.errorMessage}>{errors.dni}</span>
            )}
          </div>

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
              <option value="" disabled>Seleccionar ART...</option>
              {ART_OPTIONS.map((art) => (
                <option key={art} value={art}>{art}</option>
              ))}
              <option value="Otro">Otro</option>
            </select>
            <small className={styles.help}>Si no figura, elegí “Otro”.</small>
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
                placeholder="Ej: Swiss Medical, OSDE, etc."
                className={styles.input}
                autoFocus
              />
            </div>
          )}

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
            />
          </div>

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
            <small className={styles.help}>Por defecto: hoy.</small>
          </div>

          <div className={styles.footer}>
            <div className={styles.note}>
              <span className={styles.noteIcon}>ℹ️</span>
              Los campos con <b>*</b> son obligatorios.
            </div>
            <button type="submit" className={styles.btnPrimary} disabled={!isFormValid}>
              {isFormValid ? 'Siguiente: Prácticas →' : 'Completa nombre y DNI'}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
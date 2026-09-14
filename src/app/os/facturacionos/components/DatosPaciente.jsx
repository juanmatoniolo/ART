'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useConvenio } from './ConvenioContext';
import styles from './datosPaciente.module.css';

const onlyDigits = (s) => (s ?? '').replace(/\D/g, '');

function formatDocument(value) {
  const digits = onlyDigits(value);
  if (!digits) return '';
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 4)}.${digits.slice(4, 7)}.${digits.slice(7, 10)}-${digits.slice(10)}`;
  }
  if (digits.length >= 7 && digits.length <= 9) {
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  return digits;
}

// helper para saber si la OS de un convenio matchea con la sigla
const osMatches = (os, sigla) => {
  if (!os || !sigla) return false;
  if (typeof os === 'string') return os === sigla;
  return os.sigla === sigla || os.codOS === sigla || os.descripcion === sigla;
};

export default function DatosPaciente({
  paciente,
  setPaciente,
  onSiguiente,
  onPacienteSeleccionado,
}) {
  const {
    obrasSociales,
    osSel,
    cambiarOS,
    conveniosDeOS,
    convenioSel,
    convenioData,
    cambiarConvenio,
    arancelesVisibles,
  } = useConvenio();

  const [seguroCustom, setSeguroCustom] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [busquedaOS, setBusquedaOS] = useState(osSel || '');
  const [mostrarListaOS, setMostrarListaOS] = useState(false);
  const nombreRef = useRef(null);
  const osRef = useRef(null);

  /* ---------- Sincronizar Context → paciente ---------- */
  useEffect(() => {
    if (!osSel) return;
    if (busquedaOS !== osSel) setBusquedaOS(osSel);
    setPaciente((prev) =>
      prev.artSeguro === osSel ? prev : { ...prev, artSeguro: osSel }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [osSel]);

  useEffect(() => {
    if (!convenioSel) return;
    const nombre =
      convenioData?.nombreConvenio ||
      convenioData?.obraSocial?.sigla ||
      '';
    setPaciente((prev) =>
      prev.convenioId === convenioSel && prev.convenioNombre === nombre
        ? prev
        : { ...prev, convenioId: convenioSel, convenioNombre: nombre }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convenioSel, convenioData]);

  /* ---------- Cerrar lista OS al hacer click afuera ---------- */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (osRef.current && !osRef.current.contains(e.target)) {
        setMostrarListaOS(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* ---------- Filtros y validaciones ---------- */
  const obrasFiltradas = useMemo(() => {
    const term = busquedaOS.toLowerCase().trim();
    if (!term) return obrasSociales;
    return obrasSociales.filter(
      (os) =>
        String(os.codOS || '').toLowerCase().includes(term) ||
        String(os.sigla || '').toLowerCase().includes(term) ||
        String(os.descripcion || '').toLowerCase().includes(term) ||
        String(os.cuenta || '').toLowerCase().includes(term)
    );
  }, [busquedaOS, obrasSociales]);

  // FIX: ahora devuelve TODOS los convenios de la OS ordenados por fecha
  const conveniosFiltrados = useMemo(
    () => conveniosDeOS(paciente.artSeguro),
    [conveniosDeOS, paciente.artSeguro]
  );

  const seguroEsDeLista = useMemo(() => {
    const v = (paciente.artSeguro || '').trim();
    if (!v) return true;
    return obrasSociales.some((os) => os.sigla === v || os.descripcion === v);
  }, [paciente.artSeguro, obrasSociales]);

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
    const digits = onlyDigits(paciente.dni || '');
    const docValido =
      (digits.length >= 7 && digits.length <= 9) || digits.length === 11;
    return nombreValido && docValido;
  }, [paciente.nombreCompleto, paciente.dni]);

  useEffect(() => {
    const newErrors = {};
    const nombre = (paciente.nombreCompleto || '').trim();
    const digits = onlyDigits(paciente.dni || '');
    if (touched.nombreCompleto && nombre && nombre.length < 3) {
      newErrors.nombreCompleto = 'Nombre debe tener al menos 3 caracteres.';
    }
    if (
      touched.dni &&
      paciente.dni?.trim() &&
      !((digits.length >= 7 && digits.length <= 9) || digits.length === 11)
    ) {
      newErrors.dni =
        'Documento inválido (DNI de 7-9 dígitos o CUIL de 11 dígitos)';
    }
    setErrors(newErrors);
  }, [paciente.nombreCompleto, paciente.dni, touched]);

  useEffect(() => {
    nombreRef.current?.focus();
  }, []);

  const diasInternacion = useMemo(() => {
    const desde = paciente.fechaIngreso;
    const hasta = paciente.fechaEgreso;
    if (!desde || !hasta) return null;
    const diffTime = new Date(hasta).getTime() - new Date(desde).getTime();
    if (diffTime < 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }, [paciente.fechaIngreso, paciente.fechaEgreso]);

  /* ---------- Handlers ---------- */
  const setField = (name, value) => {
    setPaciente((prev) => ({ ...prev, [name]: value }));
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
  };

  const handleDniChange = (e) => {
    const digits = onlyDigits(e.target.value).slice(0, 11);
    setField('dni', formatDocument(digits));
  };

  const handleSelectObraSocial = (os) => {
    setBusquedaOS(os.sigla);
    setMostrarListaOS(false);
    setShowCustomInput(false);
    cambiarOS(os.sigla);
    setPaciente((prev) => ({
      ...prev,
      artSeguro: os.sigla,
      convenioId: '',
      convenioNombre: '',
    }));
  };

  const handleSelectOtro = () => {
    setMostrarListaOS(false);
    setBusquedaOS('');
    setShowCustomInput(true);
    setSeguroCustom('');
    cambiarOS('');
    setPaciente((prev) => ({
      ...prev,
      artSeguro: '',
      convenioId: '',
      convenioNombre: '',
    }));
  };

  const handleSelectConvenio = (e) => {
    const id = e.target.value;
    if (!id) {
      cambiarConvenio('');
      setField('convenioId', '');
      setField('convenioNombre', '');
      return;
    }
    const conv = conveniosFiltrados.find((c) => c.id === id);
    if (conv) {
      cambiarConvenio(conv.id);
      setPaciente((prev) => ({
        ...prev,
        convenioId: conv.id,
        convenioNombre: conv.nombreConvenio || conv.obraSocial?.sigla || '',
      }));
    }
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

  /* ---------- Render ---------- */
  return (
    <section className={styles.container} aria-label="Datos del paciente">
      <header className={styles.header}>
        <h2 className={styles.title}>Datos del Paciente</h2>
        <p className={styles.subtitle}>
          Cargá los datos del paciente para Obras Sociales.
        </p>
      </header>

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
            N° de afiliado (DNI / CUIL) <span className={styles.req}>*</span>
          </label>
          <input
            id="dni"
            type="text"
            name="dni"
            value={paciente.dni || ''}
            onChange={handleDniChange}
            onBlur={handleBlur}
            placeholder="Ej: 12345678 o 20-33957390-6"
            className={`${styles.input} ${errors.dni ? styles.hasError : ''}`}
            autoComplete="off"
          />
          {!errors.dni ? (
            <small className={styles.help}>
              DNI (7-9 dígitos) o CUIL (11 dígitos).
            </small>
          ) : (
            <span className={styles.errorMessage}>{errors.dni}</span>
          )}
        </div>

        {/* Buscador de obra social */}
        <div
          className={styles.formGroup}
          ref={osRef}
          style={{ position: 'relative' }}
        >
          <label className={styles.label} htmlFor="busquedaOS">
            Obra Social
          </label>
          <input
            id="busquedaOS"
            type="text"
            placeholder="Buscar por código, sigla o descripción..."
            value={busquedaOS}
            onChange={(e) => {
              setBusquedaOS(e.target.value);
              setMostrarListaOS(true);
            }}
            onFocus={() => setMostrarListaOS(true)}
            className={styles.input}
            autoComplete="off"
          />

          {mostrarListaOS && (
            <ul className={styles.osList}>
              {obrasFiltradas.length > 0 ? (
                obrasFiltradas.map((os) => (
                  <li key={os.codOS || os.sigla || os.id}>
                    <button
                      type="button"
                      className={styles.osItem}
                      onClick={() => handleSelectObraSocial(os)}
                    >
                      <span className={styles.osSigla}>{os.sigla}</span>
                      <span className={styles.osDesc}>{os.descripcion}</span>
                      <span className={styles.osCod}>Cod: {os.codOS}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className={styles.osNoResult}>Sin resultados</li>
              )}
              <li>
                <button
                  type="button"
                  className={styles.osItemOtro}
                  onClick={handleSelectOtro}
                >
                  ➕ Otro (ingresar manualmente)
                </button>
              </li>
            </ul>
          )}
          <small className={styles.help}>
            Escribí para buscar o elegí "Otro".
          </small>
        </div>

        {showCustomInput && (
          <div className={styles.formGroupFull}>
            <label className={styles.label} htmlFor="seguroCustom">
              Especificar otra obra social
            </label>
            <input
              id="seguroCustom"
              type="text"
              value={seguroCustom}
              onChange={(e) => {
                const v = e.target.value;
                setSeguroCustom(v);
                setField('artSeguro', v);
                cambiarOS(v);
              }}
              placeholder="Ej: OSDE, Swiss Medical, etc."
              className={styles.input}
              autoFocus
            />
          </div>
        )}

        {/* Selector de Convenio (todos los de la OS, ordenados por fecha) */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="convenioId">
            Convenio
          </label>
          <select
            id="convenioId"
            name="convenioId"
            value={paciente.convenioId || ''}
            onChange={handleSelectConvenio}
            className={styles.select}
            disabled={!paciente.artSeguro || conveniosFiltrados.length === 0}
          >
            <option value="">
              {paciente.artSeguro
                ? 'Seleccionar convenio...'
                : 'Primero elegí una obra social'}
            </option>
            {conveniosFiltrados.map((conv) => (
              <option key={conv.id} value={conv.id}>
                {(conv.nombreConvenio || conv.obraSocial?.sigla || conv.id) +
                  (conv.fechaCarga
                    ? ` (${new Date(conv.fechaCarga).toLocaleDateString('es-AR')})`
                    : '')}
              </option>
            ))}
          </select>
          {paciente.artSeguro && conveniosFiltrados.length === 0 && (
            <small className={styles.help}>
              No hay convenios cargados para esta obra social.
            </small>
          )}
          {paciente.artSeguro && conveniosFiltrados.length > 1 && (
            <small className={styles.help}>
              {conveniosFiltrados.length} convenios disponibles (el más reciente primero).
            </small>
          )}
        </div>

        {/* Resumen de aranceles del convenio activo (solo > 0) */}
        {convenioData && arancelesVisibles.length > 0 && (
          <div className={styles.formGroupFull}>
            <div
              style={{
                border: '1px solid var(--border, #cbd5e1)',
                borderRadius: 12,
                padding: '0.75rem 1rem',
                background: 'var(--surface-2, #f8fafc)',
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  marginBottom: '0.5rem',
                  fontSize: '0.9rem',
                }}
              >
                Valores arancelarios –{' '}
                {convenioData.nombreConvenio || convenioData.obraSocial?.sigla}
              </div>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                  gap: '0.4rem 1rem',
                  fontSize: '0.85rem',
                }}
              >
                {arancelesVisibles.map((a) => (
                  <li
                    key={a.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '0.5rem',
                      borderBottom: '1px dashed var(--border, #cbd5e1)',
                      paddingBottom: 2,
                    }}
                  >
                    <span>{a.label}</span>
                    <strong>
                      ${a.value.toLocaleString('es-AR')}
                    </strong>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Fechas */}
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="fechaIngreso">
            Fecha de Ingreso
          </label>
          <input
            id="fechaIngreso"
            type="date"
            name="fechaIngreso"
            value={paciente.fechaIngreso || ''}
            onChange={(e) => setField('fechaIngreso', e.target.value)}
            className={styles.input}
          />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="fechaEgreso">
            Fecha de Egreso
          </label>
          <input
            id="fechaEgreso"
            type="date"
            name="fechaEgreso"
            value={paciente.fechaEgreso || ''}
            onChange={(e) => setField('fechaEgreso', e.target.value)}
            className={styles.input}
          />
        </div>

        {diasInternacion !== null && (
          <div className={styles.formGroupFull}>
            <div className={styles.diasInfo}>
              <span>🕒 Días de internación: </span>
              <strong>{diasInternacion}</strong>
            </div>
          </div>
        )}

        <div className={styles.footer}>
          <div className={styles.note}>
            <span className={styles.noteIcon}>ℹ️</span>
            Los campos con <b>*</b> son obligatorios.
          </div>
          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={!isFormValid}
          >
            {isFormValid
              ? 'Siguiente: Prácticas →'
              : 'Completa nombre y documento válido'}
          </button>
        </div>
      </form>
    </section>
  );
}
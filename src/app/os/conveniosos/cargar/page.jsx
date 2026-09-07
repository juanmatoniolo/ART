'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { ref as dbRef, set } from 'firebase/database';
import { db } from '@/lib/firebase';
import styles from '../conveniosos.module.css';

const FIREBASE_URL = 'https://datos-clini-default-rtdb.firebaseio.com';

// Función para limpiar texto y usarlo como clave
const limpiarClave = (str) =>
  String(str)
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

export default function CargarConvenio() {
  const [obrasSociales, setObrasSociales] = useState([]);
  const [busquedaOS, setBusquedaOS] = useState('');
  const [mostrarListaOS, setMostrarListaOS] = useState(false);
  const [obraSocialSeleccionada, setObraSocialSeleccionada] = useState(null);
  const osRef = useRef(null);

  const [nombreConvenio, setNombreConvenio] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [datosParseados, setDatosParseados] = useState(null);
  const [errorArchivo, setErrorArchivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState('');

  // Cargar obras sociales
  useEffect(() => {
    const fetchOS = async () => {
      try {
        const res = await fetch(`${FIREBASE_URL}/facturacionOS/osociales.json`);
        if (!res.ok) throw new Error('Error al cargar obras sociales');
        const data = await res.json();
        setObrasSociales(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchOS();
  }, []);

  // Cerrar lista al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (osRef.current && !osRef.current.contains(e.target)) {
        setMostrarListaOS(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const obrasFiltradas = useMemo(() => {
    const term = busquedaOS.toLowerCase().trim();
    if (!term) return obrasSociales;
    return obrasSociales.filter((os) =>
      String(os.codOS || '').toLowerCase().includes(term) ||
      String(os.sigla || '').toLowerCase().includes(term) ||
      String(os.descripcion || '').toLowerCase().includes(term) ||
      String(os.cuenta || '').toLowerCase().includes(term)
    );
  }, [busquedaOS, obrasSociales]);

  const handleSelectObraSocial = (os) => {
    setObraSocialSeleccionada(os);
    setBusquedaOS(os.sigla);
    setMostrarListaOS(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setArchivo(file);
    setErrorArchivo('');
    setDatosParseados(null);
    setMensajeExito('');

    try {
      const data = await parsearExcel(file);
      setDatosParseados(data);
    } catch (err) {
      setErrorArchivo(err.message);
    }
  };

  const parsearExcel = async (file) => {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    const hojas = workbook.SheetNames;
    if (hojas.length < 4) {
      throw new Error('El archivo debe contener al menos 4 hojas.');
    }

    const hojaValores = workbook.Sheets[hojas[0]];
    const hojaModulos = workbook.Sheets[hojas[1]];
    const hojaPracticas = workbook.Sheets[hojas[2]];
    const hojaObservaciones = workbook.Sheets[hojas[3]];

    // Hoja 1: Valores Arancelarios (B=descripción, C=valor)
    const valoresArancelarios = [];
    const filasValores = XLSX.utils.sheet_to_json(hojaValores, { header: 1 });
    for (let i = 1; i < filasValores.length; i++) {
      const fila = filasValores[i];
      if (fila && fila.length >= 3) {
        const descripcion = String(fila[1] ?? '').trim();
        const valorRaw = fila[2];
        let valor = 0;
        if (typeof valorRaw === 'number') valor = valorRaw;
        else if (typeof valorRaw === 'string') {
          valor = parseFloat(valorRaw.replace(/\./g, '').replace(',', '.')) || 0;
        }
        if (descripcion) {
          valoresArancelarios.push({ concepto: descripcion, valor });
        }
      }
    }

    // Hoja 2: Módulos Incluidos
    const modulosIncluidos = [];
    const filasModulos = XLSX.utils.sheet_to_json(hojaModulos, { header: 1 });
    for (let i = 1; i < filasModulos.length; i++) {
      const fila = filasModulos[i];
      if (fila && fila.length >= 3) {
        const codigo = String(fila[0] ?? '').trim();
        const descripcion = String(fila[1] ?? '').trim();
        const gastosRaw = fila[2] ?? 0;
        const honorariosRaw = fila[3] ?? 0;
        const gastos = typeof gastosRaw === 'number' ? gastosRaw : parseFloat(String(gastosRaw).replace(/[$.]/g, '').replace(',', '.')) || 0;
        const honorarios = typeof honorariosRaw === 'number' ? honorariosRaw : parseFloat(String(honorariosRaw).replace(/[$.]/g, '').replace(',', '.')) || 0;
        const completo = fila[4] ? String(fila[4]).trim() : '';
        if (codigo || descripcion) {
          modulosIncluidos.push({ codigo, descripcion, gastos, honorarios, completo });
        }
      }
    }

    // Hoja 3: Prácticas Incluidas
    const practicasIncluidas = [];
    const filasPracticas = XLSX.utils.sheet_to_json(hojaPracticas, { header: 1 });
    for (let i = 1; i < filasPracticas.length; i++) {
      const fila = filasPracticas[i];
      if (fila && fila.length >= 3) {
        const codigo = String(fila[0] ?? '').trim();
        const descripcion = String(fila[1] ?? '').trim();
        const valorRaw = fila[2] ?? 0;
        const valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(/[$.]/g, '').replace(',', '.')) || 0;
        if (codigo || descripcion) {
          practicasIncluidas.push({ codigo, descripcion, valor });
        }
      }
    }

    // Hoja 4: Observaciones
    const observaciones = [];
    const filasObs = XLSX.utils.sheet_to_json(hojaObservaciones, { header: 1 });
    for (let i = 1; i < filasObs.length; i++) {
      const fila = filasObs[i];
      if (fila && fila.length >= 2) {
        const titulo = String(fila[0] ?? '').trim();
        const detalle = String(fila[1] ?? '').trim();
        if (titulo || detalle) {
          observaciones.push({ titulo, detalle });
        }
      }
    }

    return {
      valoresArancelarios,
      modulosIncluidos,
      practicasIncluidas,
      observaciones,
    };
  };

  const handleGuardar = async () => {
    if (!obraSocialSeleccionada || !datosParseados) {
      alert('Seleccioná una obra social y cargá un archivo Excel válido.');
      return;
    }
    if (!nombreConvenio.trim()) {
      alert('Ingresá un nombre para el convenio.');
      return;
    }

    setGuardando(true);
    setMensajeExito('');

    try {
      const sigla = obraSocialSeleccionada.sigla || obraSocialSeleccionada.codOS;
      const nombreLimpio = limpiarClave(nombreConvenio);
      const siglaLimpia = limpiarClave(sigla);
      const fecha = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const timestamp = Date.now();

      // Clave legible: convenio_{nombre}_{sigla}_{fecha}_{timestamp}
      const key = `convenio_${nombreLimpio}_${siglaLimpia}_${fecha}_${timestamp}`;

      const datosAGuardar = {
        nombreConvenio: nombreConvenio.trim(),
        obraSocial: {
          codOS: obraSocialSeleccionada.codOS,
          sigla: obraSocialSeleccionada.sigla,
          descripcion: obraSocialSeleccionada.descripcion,
          cuenta: obraSocialSeleccionada.cuenta,
        },
        fechaCarga: new Date().toISOString(),
        vigente: true, // puedes manejar vigencia
        ...datosParseados,
      };

      await set(dbRef(db, `facturacionOS/convenios/${key}`), datosAGuardar);

      setMensajeExito(`✅ Convenio "${nombreConvenio.trim()}" guardado para ${sigla}`);
      setArchivo(null);
      setDatosParseados(null);
      setObraSocialSeleccionada(null);
      setBusquedaOS('');
      setNombreConvenio('');
    } catch (err) {
      console.error('Error guardando convenio:', err);
      alert('Error al guardar el convenio.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>📥 Cargar Convenio desde Excel</h1>
        <p className={styles.subtitle}>
          Seleccioná una obra social, ingresá el nombre del convenio y subí el archivo Excel.
        </p>
      </header>

      <div className={styles.card}>
        {/* Selector de obra social */}
        <div className={styles.field} ref={osRef} style={{ position: 'relative' }}>
          <label className={styles.label}>Obra Social</label>
          <input
            type="text"
            placeholder="Buscar por código, sigla o descripción..."
            value={busquedaOS}
            onChange={(e) => {
              setBusquedaOS(e.target.value);
              setMostrarListaOS(true);
              if (obraSocialSeleccionada && obraSocialSeleccionada.sigla !== e.target.value) {
                setObraSocialSeleccionada(null);
              }
            }}
            onFocus={() => setMostrarListaOS(true)}
            className={styles.input}
          />
          {mostrarListaOS && (
            <ul className={styles.osList}>
              {obrasFiltradas.length > 0 ? (
                obrasFiltradas.map((os) => (
                  <li key={os.codOS}>
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
            </ul>
          )}
        </div>

        {/* Campo nombre del convenio */}
        <div className={styles.field}>
          <label className={styles.label}>Nombre del Convenio</label>
          <input
            type="text"
            placeholder="Ej: Convenio Septiembre 2025"
            value={nombreConvenio}
            onChange={(e) => setNombreConvenio(e.target.value)}
            className={styles.input}
          />
          <small className={styles.help}>Este nombre identificará el convenio en la facturación.</small>
        </div>

        {/* Input de archivo */}
        <div className={styles.field}>
          <label className={styles.label}>Archivo Excel</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className={styles.fileInput}
          />
          <small className={styles.help}>
            El archivo debe contener 4 hojas: Valores Arancelarios, Modulos Incluidos,
            Practicas Incluidas, Observaciones.
          </small>
          {errorArchivo && <p className={styles.error}>{errorArchivo}</p>}
        </div>

        {/* Resumen de datos parseados */}
        {datosParseados && (
          <div className={styles.resumen}>
            <h3>Resumen de datos</h3>
            <div className={styles.resumenGrid}>
              <div className={styles.resumenItem}>
                <span>Valores Arancelarios:</span>
                <strong>{datosParseados.valoresArancelarios.length}</strong>
              </div>
              <div className={styles.resumenItem}>
                <span>Módulos Incluidos:</span>
                <strong>{datosParseados.modulosIncluidos.length}</strong>
              </div>
              <div className={styles.resumenItem}>
                <span>Prácticas Incluidas:</span>
                <strong>{datosParseados.practicasIncluidas.length}</strong>
              </div>
              <div className={styles.resumenItem}>
                <span>Observaciones:</span>
                <strong>{datosParseados.observaciones.length}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Botón guardar */}
        <button
          onClick={handleGuardar}
          disabled={!obraSocialSeleccionada || !datosParseados || !nombreConvenio.trim() || guardando}
          className={styles.btnGuardar}
        >
          {guardando ? 'Guardando...' : '💾 Guardar Convenio'}
        </button>

        {mensajeExito && <p className={styles.exito}>{mensajeExito}</p>}
      </div>
    </div>
  );
}
// utils/storage.js - Funciones para manejar localStorage con soporte SSR y manejo de errores

/**
 * Claves de almacenamiento centralizadas
 */
export const STORAGE_KEYS = {
  FACTURA: 'facturacion_sistema_factura',
  PACIENTE: 'facturacion_paciente',
  PRACTICAS: 'facturacion_practicas',
  LABORATORIOS: 'facturacion_laboratorios',
  MEDICAMENTOS: 'facturacion_medicamentos',
  DESCARTABLES: 'facturacion_descartables',
  TAB_ACTIVA: 'facturacion_tab_activa',
  CONVENIO_ACTIVO: 'convenioActivoFacturacion',
  SINIESTROS: 'facturacion_siniestros'
};

/**
 * Verifica si estamos en el cliente (SSR safe)
 */
const isClient = typeof window !== 'undefined';

/**
 * Lee un valor de localStorage con manejo de errores y valor por defecto
 * Si el valor está corrupto, lo elimina y devuelve el defaultValue
 * @param {string} key - Clave del localStorage
 * @param {any} defaultValue - Valor por defecto si no existe o hay error
 * @returns {any}
 */
export function getStorageItem(key, defaultValue) {
  if (!isClient) return defaultValue;
  try {
    const item = localStorage.getItem(key);
    if (item === null) return defaultValue;
    // Intentar parsear JSON
    return JSON.parse(item);
  } catch (error) {
    console.error(`Error reading localStorage key “${key}”:`, error);
    // Si hay error, el valor está corrupto → lo eliminamos
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`No se pudo eliminar la clave corrupta “${key}”:`, e);
    }
    return defaultValue;
  }
}

/**
 * Escribe un valor en localStorage con manejo de errores
 * @param {string} key - Clave del localStorage
 * @param {any} value - Valor a guardar (se serializa a JSON)
 * @returns {boolean} - true si se guardó correctamente
 */
export function setStorageItem(key, value) {
  if (!isClient) return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error writing localStorage key “${key}”:`, error);
    return false;
  }
}

/**
 * Elimina una clave de localStorage
 * @param {string} key - Clave a eliminar
 * @returns {boolean} - true si se eliminó correctamente
 */
export function removeStorageItem(key) {
  if (!isClient) return false;
  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing localStorage key “${key}”:`, error);
    return false;
  }
}

/**
 * Limpia TODOS los datos de facturación (útil para cerrar siniestro)
 * @returns {boolean} - true si se limpió correctamente
 */
export function limpiarTodoStorage() {
  if (!isClient) return false;
  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Error limpiando localStorage:', error);
    return false;
  }
}

/**
 * Exporta los datos actuales de la factura a un archivo JSON
 * @returns {boolean} - true si se pudo generar el archivo
 */
export function exportarDatos() {
  if (!isClient) return false;

  try {
    const datos = {
      paciente: getStorageItem(STORAGE_KEYS.PACIENTE, null),
      practicas: getStorageItem(STORAGE_KEYS.PRACTICAS, []),
      laboratorios: getStorageItem(STORAGE_KEYS.LABORATORIOS, []),
      medicamentos: getStorageItem(STORAGE_KEYS.MEDICAMENTOS, []),
      descartables: getStorageItem(STORAGE_KEYS.DESCARTABLES, []),
      tabActiva: getStorageItem(STORAGE_KEYS.TAB_ACTIVA, 'datos'),
      convenioActivo: getStorageItem(STORAGE_KEYS.CONVENIO_ACTIVO, ''),
      fechaExportacion: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `siniestro_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Error exportando datos:', error);
    alert('No se pudo exportar el archivo. Intente nuevamente.');
    return false;
  }
}

/**
 * Importa datos desde un archivo JSON y ejecuta un callback con los datos
 * @param {File} file - Archivo JSON seleccionado por el usuario
 * @param {Function} callback - Función que recibe los datos parseados
 */
export function importarDatos(file, callback) {
  if (!isClient) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const datos = JSON.parse(e.target.result);
      if (!datos || typeof datos !== 'object') {
        throw new Error('Formato inválido');
      }
      callback(datos);
    } catch (error) {
      console.error('Error importando archivo:', error);
      alert('Error: El archivo seleccionado no es válido o está corrupto.');
    }
  };
  reader.onerror = () => {
    alert('Error al leer el archivo.');
  };
  reader.readAsText(file);
}

/**
 * Guarda un siniestro en la lista de siniestros guardados
 * @param {Object} siniestro - Objeto con los datos del siniestro
 * @returns {boolean} - true si se guardó correctamente
 */
export function guardarSiniestro(siniestro) {
  if (!isClient) return false;

  try {
    const siniestros = getStorageItem(STORAGE_KEYS.SINIESTROS, []);
    siniestros.push({
      ...siniestro,
      id: siniestro.id || Date.now(),
      fecha: siniestro.fecha || new Date().toISOString()
    });
    return setStorageItem(STORAGE_KEYS.SINIESTROS, siniestros);
  } catch (error) {
    console.error('Error guardando siniestro:', error);
    return false;
  }
}

/**
 * Obtiene la lista de siniestros guardados
 * @returns {Array}
 */
export function getSiniestrosGuardados() {
  return getStorageItem(STORAGE_KEYS.SINIESTROS, []);
}

/**
 * Elimina un siniestro por su ID
 * @param {number|string} id - ID del siniestro a eliminar
 * @returns {boolean} - true si se eliminó correctamente
 */
export function eliminarSiniestro(id) {
  if (!isClient) return false;
  try {
    const siniestros = getSiniestrosGuardados();
    const nuevos = siniestros.filter(s => s.id !== id);
    return setStorageItem(STORAGE_KEYS.SINIESTROS, nuevos);
  } catch (error) {
    console.error('Error eliminando siniestro:', error);
    return false;
  }
}

/**
 * Carga un siniestro en localStorage (sobrescribe datos actuales)
 * @param {Object} siniestro - Objeto con los datos a cargar
 * @returns {boolean} - true si se cargó correctamente
 */
export function cargarSiniestroEnStorage(siniestro) {
  if (!isClient) return false;
  try {
    if (siniestro.paciente !== undefined) setStorageItem(STORAGE_KEYS.PACIENTE, siniestro.paciente);
    if (siniestro.practicas !== undefined) setStorageItem(STORAGE_KEYS.PRACTICAS, siniestro.practicas);
    if (siniestro.laboratorios !== undefined) setStorageItem(STORAGE_KEYS.LABORATORIOS, siniestro.laboratorios);
    if (siniestro.medicamentos !== undefined) setStorageItem(STORAGE_KEYS.MEDICAMENTOS, siniestro.medicamentos);
    if (siniestro.descartables !== undefined) setStorageItem(STORAGE_KEYS.DESCARTABLES, siniestro.descartables);
    if (siniestro.tabActiva !== undefined) setStorageItem(STORAGE_KEYS.TAB_ACTIVA, siniestro.tabActiva);
    if (siniestro.convenioActivo !== undefined) setStorageItem(STORAGE_KEYS.CONVENIO_ACTIVO, siniestro.convenioActivo);
    return true;
  } catch (error) {
    console.error('Error cargando siniestro:', error);
    return false;
  }
}
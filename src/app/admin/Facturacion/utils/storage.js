// utils/storage.js - Funciones adicionales para manejar storage
export const STORAGE_KEYS = {
  FACTURA: 'facturacion_sistema_factura',
  PACIENTE: 'facturacion_paciente',
  PRACTICAS: 'facturacion_practicas',
  LABORATORIOS: 'facturacion_laboratorios',
  MEDICAMENTOS: 'facturacion_medicamentos',
  DESCARTABLES: 'facturacion_descartables',
  TAB_ACTIVA: 'facturacion_tab_activa',
  SINIESTROS: 'facturacion_siniestros'
};

// Exportar datos a archivo JSON
export const exportarDatos = () => {
  const datos = {
    paciente: JSON.parse(localStorage.getItem(STORAGE_KEYS.PACIENTE)),
    practicas: JSON.parse(localStorage.getItem(STORAGE_KEYS.PRACTICAS)),
    laboratorios: JSON.parse(localStorage.getItem(STORAGE_KEYS.LABORATORIOS)),
    medicamentos: JSON.parse(localStorage.getItem(STORAGE_KEYS.MEDICAMENTOS)),
    descartables: JSON.parse(localStorage.getItem(STORAGE_KEYS.DESCARTABLES)),
    tabActiva: localStorage.getItem(STORAGE_KEYS.TAB_ACTIVA),
    fechaExportacion: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `siniestro_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

// Importar datos desde archivo JSON
export const importarDatos = (file, callback) => {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const datos = JSON.parse(e.target.result);
      callback(datos);
    } catch (error) {
      alert('Error: Archivo JSON inválido');
    }
  };
  reader.readAsText(file);
};

// Limpiar todos los datos
export const limpiarTodoStorage = () => {
  Object.values(STORAGE_KEYS).forEach(key => {
    localStorage.removeItem(key);
  });
};

// Obtener lista de siniestros guardados
export const getSiniestrosGuardados = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.SINIESTROS)) || [];
  } catch {
    return [];
  }
};

// Eliminar siniestro por ID
export const eliminarSiniestro = (id) => {
  try {
    const siniestros = getSiniestrosGuardados();
    const nuevos = siniestros.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEYS.SINIESTROS, JSON.stringify(nuevos));
    return true;
  } catch {
    return false;
  }
};
// Configuración pública centralizada. Los valores viven en .env.local.
// No hardcodear URLs ni claves en los componentes: importarlas desde acá.

export const DB_URL = (process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "").replace(/\/+$/, "");

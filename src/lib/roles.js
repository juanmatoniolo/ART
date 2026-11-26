// Fuente única de roles y permisos de pantallas.
// Los permisos sobre los DATOS están en src/lib/permissions.js (de ahí salen las reglas de la base).
//
// Cada rol tiene:
//   id:     clave guardada en usuarios/{uid}/roles/{id}. NO cambiar (lo usan las reglas de la base).
//   label:  nombre que se muestra en pantalla.
//   legacy: nombre histórico (TipoEmpleado) que esperan las pantallas viejas.
//
// Equivalencias de nombres visibles:
//   id ROOT          -> "SUPERROOT"  (control total + administración de usuarios)
//   id ADM           -> "ROOT"       (todos los paneles y datos; alta de usuarios comunes)
//   id ADMINISTRADOR -> "ART"
//   id OS            -> "Obras sociales"
export const ROLES = [
  {
    id: "ROOT",
    label: "SUPERROOT",
    legacy: "ROOT",
    desc: "Control total del sistema: usuarios, roles, cortes de servicio y entrar como otro usuario.",
    panel: "Panel Root",
    home: "/admin",
  },
  {
    id: "ADM",
    label: "ROOT",
    legacy: "ADM",
    desc: "Acceso a todos los paneles y datos. Puede dar de alta usuarios comunes.",
    panel: "Panel Root",
    home: "/admin",
  },
  {
    id: "ADMINISTRADOR",
    label: "ART",
    legacy: "ADMINISTRADOR",
    desc: "Ingresos, PAMI, CX, comunicador ART, pacientes e historias clínicas.",
    panel: "Panel ART",
    home: "/administrador",
  },
  {
    id: "FARMACIA",
    label: "Farmacia",
    legacy: "Farmacia",
    desc: "Stock, movimientos, precios, reparto y catálogo.",
    panel: "Farmacia",
    home: "/farmacia",
  },
  {
    id: "RECEPCION",
    label: "Recepción",
    legacy: "RECEPCION",
    desc: "Alta y búsqueda de historias clínicas.",
    panel: "Historias clínicas",
    home: "/historia-clinica",
  },
  {
    id: "UTI",
    label: "UTI",
    legacy: "UTI",
    desc: "Unidad de terapia intensiva.",
    panel: "UTI",
    home: "/uti/admin",
  },
  {
    id: "MEDICO",
    label: "Médico",
    legacy: "MEDICO",
    desc: "Fojas quirúrgicas y plantillas.",
    panel: "Fojas quirúrgicas",
    home: "/foja/medicos",
  },
  {
    id: "OS",
    label: "Obras sociales",
    legacy: "OS",
    desc: "Convenios, facturación y nomencladores de obras sociales.",
    panel: "Obras sociales",
    home: "/os",
  },
];

export const ROLE_IDS = ROLES.map((r) => r.id);
const BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));
const BY_LEGACY = Object.fromEntries(ROLES.map((r) => [r.legacy, r]));
// Roles viejos que se unificaron
const ALIASES = { ADM_FARMACIA: "FARMACIA", "ADM Farmacia": "FARMACIA", ADMIN: "ADM", FARM: "FARMACIA" };

// Roles que solo SUPERROOT (id ROOT) puede otorgar o modificar
export const PRIVILEGED_ROLES = ["ROOT", "ADM"];

/** Nombre visible del rol. */
export const roleLabel = (id) => BY_ID[id]?.label || id;
/** Nombre histórico (TipoEmpleado) del rol. */
export const roleLegacy = (id) => BY_ID[id]?.legacy || id;
/** Acepta id, nombre histórico o alias viejo ("ADM Farmacia"). */
export const toRoleId = (value) =>
  BY_ID[value]?.id || BY_LEGACY[value]?.id || ALIASES[value] || null;

/** {ADM: true, OS: true} -> ["ADM", "OS"] respetando el orden de ROLES (incluye alias viejos). */
export function rolesFromMap(map) {
  if (!map || typeof map !== "object") return [];
  const ids = new Set();
  for (const [k, v] of Object.entries(map)) {
    if (v !== true) continue;
    const id = BY_ID[k] ? k : ALIASES[k];
    if (id) ids.add(id);
  }
  return ROLE_IDS.filter((id) => ids.has(id));
}

// Áreas de la app y qué roles pueden entrar. SUPERROOT (ROOT) y ROOT (ADM) entran a todas.
export const AREAS = {
  "/admin": ["ADM"],
  "/administrador": ["ADMINISTRADOR"],
  "/farmacia": ["FARMACIA"],
  "/historia-clinica": ["RECEPCION", "ADMINISTRADOR"],
  "/uti": ["UTI"],
  "/foja": ["MEDICO"],
  "/os": ["OS"],
  "/ingresos": ["ADMINISTRADOR"],
  "/Siniestro": ["ADMINISTRADOR"],
  "/NomecladorNAcional": "*", // cualquier usuario activo
};

const FULL_ACCESS = ["ROOT", "ADM"];

/** ¿Alguno de los roles (ids) habilita la lista permitida? SUPERROOT y ROOT siempre. */
export function canUse(roleIds = [], allowed = []) {
  if (roleIds.some((r) => FULL_ACCESS.includes(r))) return true;
  if (allowed === "*") return roleIds.length > 0;
  return roleIds.some((r) => allowed.includes(r) || allowed.includes(roleLegacy(r)));
}

/** Paneles (destinos) distintos a los que puede ir un usuario, en orden de prioridad. */
export function panelsFor(roleIds = []) {
  const seen = new Set();
  const out = [];
  for (const r of ROLES) {
    if (!roleIds.includes(r.id) || seen.has(r.home)) continue;
    seen.add(r.home);
    out.push({ href: r.home, label: r.panel, roleId: r.id });
  }
  return out;
}

// Login por nombre de usuario: se traduce a un email interno.
export const INTERNAL_EMAIL_DOMAIN = "usuarios.clinica-union.internal";
export function toLoginEmail(identifier) {
  const v = String(identifier || "").trim().toLowerCase();
  return v.includes("@") ? v : `${v}@${INTERNAL_EMAIL_DOMAIN}`;
}
export const isInternalEmail = (email = "") => email.endsWith("@" + INTERNAL_EMAIL_DOMAIN);

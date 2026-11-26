// Matriz de permisos sobre los DATOS (nodos de la Realtime Database).
// La usan: scripts/build-rules.mjs (genera database.rules.json) y el dashboard ROOT.
// ROOT y ADM tienen acceso a todos los nodos; acá se listan los demás roles.

const FARMACIA = ["FARMACIA"];
export const ANY = "*"; // cualquier usuario activo

// nodo: { label, rw: roles que leen y escriben, r: roles que solo leen, publicCreate,
//         indexOn: campos indexados para consultas (orderBy/equalTo) }
export const DATA_NODES = {
  // publicCreate: la pantalla pública /Siniestro crea pacientes sin login (no puede leer ni editar)
  pacientes: { label: "Pacientes", rw: ["ADMINISTRADOR", "OS"], publicCreate: true },
  "historias-clinicas": { label: "Historias clínicas (piso)", rw: ["ADMINISTRADOR", "RECEPCION"] },
  "historias-clinica-uti": { label: "Historias clínicas (UTI)", rw: ["ADMINISTRADOR", "RECEPCION"] },
  counters: { label: "Numeradores de HC", rw: ["ADMINISTRADOR", "RECEPCION"] },
  // publicCreate: la pantalla pública /ingresos crea ingresos sin login
  "ingresos-pacientes": { label: "Ingresos de pacientes", rw: ["ADMINISTRADOR"], publicCreate: true },
  UTI: { label: "UTI", rw: ["UTI"] },
  // publicCreate: la pantalla pública /foja crea fojas sin login (las plantillas no: ya existen)
  fojaqx: { label: "Fojas quirúrgicas", rw: ["MEDICO", "ADMINISTRADOR"], publicCreate: true },
  plantillas_qx: { label: "Plantillas de fojas", rw: ["MEDICO"] },
  cirugias: { label: "Cirugías programadas", rw: ["ADMINISTRADOR"], r: ["MEDICO"] },
  "solicitudes-cirugia": {
    label: "Solicitudes de cirugía",
    rw: ["ADMINISTRADOR"],
    r: ["MEDICO"],
    publicCreate: true,
  },
  PAMI: { label: "PAMI", rw: ["ADMINISTRADOR"] },
  "ART-MAILS": { label: "Comunicador ART", rw: ["ADMINISTRADOR"] },
  Facturacion: { label: "Facturación", rw: ["ADMINISTRADOR", "OS"], indexOn: ["estado"] },
  OS: { label: "Obras sociales", rw: ["OS"] },
  facturacionOS: { label: "Facturación OS", rw: ["OS"] },
  laboratorios: { label: "Laboratorios", rw: ["OS"] },
  nomencladores: { label: "Nomencladores", rw: ["OS"] },
  convenios: { label: "Convenios", rw: ["ADMINISTRADOR", "OS"], r: ANY },
  medicos: { label: "Médicos", rw: ["OS", "ADMINISTRADOR"] },
  medydescartables: { label: "Medicación y descartables", rw: [...FARMACIA, "ADMINISTRADOR", "OS"] },
  movimientos: { label: "Movimientos de farmacia", rw: FARMACIA },
  auditoria_movimientos: { label: "Auditoría de farmacia", rw: FARMACIA },
  listas_precios: { label: "Listas de precios", rw: FARMACIA },
  WHATSAPP: { label: "WhatsApp", rw: [] },
  rp: { label: "Recetas (RP)", rw: [] },
  snippets: { label: "Snippets", rw: [] },
  users: { label: "Usuarios (sistema viejo)", rw: [] },
};

/** Acceso de un rol a un nodo: "rw" | "r" | null. ROOT y ADM: "rw" en todo. */
export function accessOf(roleId, node) {
  if (roleId === "ROOT" || roleId === "ADM") return "rw";
  const n = DATA_NODES[node];
  if (!n) return null;
  if (n.rw.includes(roleId)) return "rw";
  if (n.r === ANY || n.r?.includes(roleId)) return "r";
  return null;
}

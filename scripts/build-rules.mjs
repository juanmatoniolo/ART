// Genera database.rules.json a partir de la matriz de permisos por rol.
// Uso: node scripts/build-rules.mjs
//
// Reglas generales:
// - Hay que estar logueado y con el servicio activo (usuarios/{uid}/activo === true).
// - ROOT y ADM pueden leer/escribir todos los nodos de datos.
// - usuarios/ solo lo escribe el servidor (API con Admin SDK): nadie puede
//   darse roles a sí mismo desde el navegador.
// - Un permiso otorgado en un nodo padre no se puede quitar en un hijo,
//   por eso no hay permiso en la raíz: cada nodo se declara aparte.
import fs from "node:fs";

import { DATA_NODES as NODES, ANY } from "../src/lib/permissions.js";

const ACTIVE =
  "auth != null && root.child('usuarios').child(auth.uid).child('activo').val() === true";
const has = (role) => `root.child('usuarios').child(auth.uid).child('roles').child('${role}').val() === true`;

function allow(roles) {
  if (roles === ANY) return ACTIVE;
  const all = ["ROOT", "ADM", ...roles];
  return `${ACTIVE} && (${all.map(has).join(" || ")})`;
}

function nodeRules({ rw, r, publicCreate, indexOn }) {
  const readRoles = r === ANY ? ANY : [...rw, ...(r || [])];
  const rules = { ".read": allow(readRoles), ".write": allow(rw) };
  if (indexOn?.length) rules[".indexOn"] = indexOn;
  if (publicCreate) {
    // Formulario público: solo puede CREAR solicitudes nuevas (no leer, editar ni borrar)
    rules.$id = { ".write": "!data.exists() && newData.exists() && newData.hasChildren()" };
  }
  return rules;
}

const rules = {
  rules: {
    usuarios: {
      ".read": allow([]), // listado completo: ADM / ROOT
      ".write": false, // solo el servidor (Admin SDK)
      $uid: {
        ".read": "auth != null && auth.uid === $uid", // cada uno su propio perfil (aunque esté cortado)
      },
    },
    ...Object.fromEntries(Object.entries(NODES).map(([k, v]) => [k, nodeRules(v)])),
    // Cualquier otro nodo: solo ADM / ROOT
    $other: { ".read": allow([]), ".write": allow([]) },
  },
};

const out = new URL("../database.rules.json", import.meta.url);
fs.writeFileSync(out, JSON.stringify(rules, null, 2) + "\n");
console.log(`database.rules.json generado: ${Object.keys(NODES).length + 2} nodos.`);
export default rules;

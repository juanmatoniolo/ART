// Crea o actualiza el perfil (usuarios/{uid}) de una cuenta que YA existe en
// Firebase Authentication. Útil para el primer ROOT o para cuentas creadas
// a mano desde la consola.
//
//   node scripts/grant-roles.mjs email@dominio.com --roles=ROOT,ADM            -> simulación
//   node scripts/grant-roles.mjs email@dominio.com --roles=ROOT,ADM --apply    -> aplica
import { auth, db } from "./_admin.mjs";
import { ROLE_IDS } from "../src/lib/roles.js";

const email = process.argv[2];
const APPLY = process.argv.includes("--apply");
const roles = ((process.argv.find((a) => a.startsWith("--roles=")) || "").slice(8) || "")
  .split(",")
  .map((r) => r.trim())
  .filter(Boolean);

if (!email || !email.includes("@") || !roles.length) {
  console.log("Uso: node scripts/grant-roles.mjs email --roles=ROOT,ADM [--apply]");
  process.exit(1);
}
const invalid = roles.filter((r) => !ROLE_IDS.includes(r));
if (invalid.length) {
  console.log(`Roles inválidos: ${invalid.join(", ")}. Válidos: ${ROLE_IDS.join(", ")}`);
  process.exit(1);
}

const user = await auth.getUserByEmail(email);
const ref = db.ref(`usuarios/${user.uid}`);
const current = (await ref.get()).val();
console.log(`Cuenta: ${email} (uid ${user.uid})`);
console.log(`Perfil actual: ${current ? JSON.stringify({ roles: current.roles, activo: current.activo }) : "no tiene"}`);
console.log(`Quedaría con roles: ${roles.join(" + ")}, activo`);

if (!APPLY) {
  console.log("\nSimulación: no se escribió nada. Agregá --apply para aplicar.");
  process.exit(0);
}

const now = Date.now();
await ref.update({
  nombre: current?.nombre || user.displayName || email.split("@")[0],
  user: current?.user || email.split("@")[0],
  email,
  roles: Object.fromEntries(roles.map((r) => [r, true])),
  activo: true,
  createdAt: current?.createdAt || now,
  createdBy: current?.createdBy || "script",
  updatedAt: now,
  updatedBy: "script",
});
if (user.disabled) await auth.updateUser(user.uid, { disabled: false });
console.log("Listo.");
process.exit(0);

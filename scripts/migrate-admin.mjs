// Migra la cuenta ADM del sistema viejo (nodo users, contraseña en texto plano)
// a Firebase Authentication (roles por defecto ROOT + ADM; ver --roles).
// Sigue entrando con su mismo usuario y contraseña.
//
//   node scripts/migrate-admin.mjs            -> simulación (no escribe nada)
//   node scripts/migrate-admin.mjs --apply    -> crea la cuenta y el perfil
//
// Nunca imprime contraseñas.
import { auth, db } from "./_admin.mjs";
import { toLoginEmail } from "../src/lib/roles.js";

const APPLY = process.argv.includes("--apply");
// --roles=ADM  (por defecto ROOT,ADM)
const rolesArg = (process.argv.find((a) => a.startsWith("--roles=")) || "--roles=ROOT,ADM").slice(8);
const ROLES_MAP = Object.fromEntries(rolesArg.split(",").filter(Boolean).map((r) => [r.trim(), true]));

const legacy = (await db.ref("users").get()).val() || {};
const admins = Object.entries(legacy).filter(([, u]) => u?.TipoEmpleado === "ADM" && !u?.migratedTo);

if (admins.length !== 1) {
  console.log(`Se esperaba 1 usuario ADM sin migrar y hay ${admins.length}. No hago nada.`);
  process.exit(1);
}

const [legacyKey, old] = admins[0];
const email = toLoginEmail(old.user);
const password = String(old.password || "");
console.log(`Usuario ADM: ${old.nombre || old.user} (usuario "${old.user}", clave vieja ${legacyKey})`);
console.log(`Cuenta Firebase: ${email}  roles: ${Object.keys(ROLES_MAP).join(" + ")}`);

if (password.length < 6) {
  console.log("La contraseña actual tiene menos de 6 caracteres (mínimo de Firebase). Cambiala antes de migrar.");
  process.exit(1);
}

if (!APPLY) {
  console.log("\nSimulación: no se escribió nada. Corré con --apply para migrar.");
  process.exit(0);
}

let uid;
try {
  uid = (await auth.getUserByEmail(email)).uid;
  await auth.updateUser(uid, { password, disabled: false, displayName: old.nombre || old.user });
  console.log("La cuenta ya existía: se actualizó la contraseña.");
} catch (err) {
  if (err?.code !== "auth/user-not-found") throw err;
  uid = (await auth.createUser({ email, password, displayName: old.nombre || old.user })).uid;
  console.log("Cuenta creada.");
}

const now = Date.now();
await db.ref(`usuarios/${uid}`).set({
  nombre: old.nombre || old.user,
  user: old.user,
  email,
  roles: ROLES_MAP,
  activo: true,
  legacyKey,
  createdAt: now,
  createdBy: "migración",
  updatedAt: now,
  updatedBy: "migración",
});
// La contraseña en texto plano deja de existir en la base
await db.ref(`users/${legacyKey}`).update({ password: null, migratedTo: uid });

console.log(`Listo. uid ${uid}. La contraseña vieja se borró del nodo users.`);
process.exit(0);

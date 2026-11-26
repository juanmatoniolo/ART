// Publica database.rules.json en la Realtime Database de producción.
//
//   node scripts/deploy-rules.mjs            -> muestra qué cambiaría (no publica)
//   node scripts/deploy-rules.mjs --apply    -> publica (guarda backup de las reglas actuales)
//
// IMPORTANTE: publicar las reglas antes de desplegar la app nueva deja sin
// acceso a la versión vieja (login por usuario/contraseña en la base).
import fs from "node:fs";
import { db } from "./_admin.mjs";

const APPLY = process.argv.includes("--apply");
const file = new URL("../database.rules.json", import.meta.url);
const next = fs.readFileSync(file, "utf8");
JSON.parse(next); // valida que sea JSON

const current = await db.getRules();
console.log("Reglas actuales:\n" + current.trim().slice(0, 400) + (current.length > 400 ? "\n…" : ""));
console.log(`\nReglas nuevas: ${Object.keys(JSON.parse(next).rules).length} nodos (${next.length} bytes).`);

if (!APPLY) {
  console.log("\nSimulación: no se publicó nada. Corré con --apply para publicar.");
  process.exit(0);
}

const backup = new URL(`../database.rules.backup-${Date.now()}.json`, import.meta.url);
fs.writeFileSync(backup, current);
await db.setRules(next);
console.log(`\nPublicadas. Backup de las anteriores: ${backup.pathname.split("/").pop()}`);
process.exit(0);

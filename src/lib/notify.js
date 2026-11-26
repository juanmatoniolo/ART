// Notificaciones no bloqueantes. Reemplazo de window.alert.
// Uso: notify("texto") detecta el tipo por el contenido,
// o notify.success / notify.error / notify.warning / notify.info para forzarlo.

const listeners = new Set();
let seq = 0;

const ERROR_RE = /❌|\berror\b|no se pudo|no se pudieron|no se puede|fall[óo]|falla|fallid|inv[áa]lid|denegad|incorrect|corrupt|bloque[óo]|no existe|no se encontr[óo] (el|la) |no implementad|no configurad/i;
const WARNING_RE = /⚠|\bdebe|\bdeb[ée]s\b|ingres[áa] |complet[áa]|\bcomplete\b|seleccion[áa]|seleccione|eleg[íi] |establec[ée]|vincul[áa] |\bfalta|obligatori|requerid|primero|no hay|ya existe|atenci[óo]n|m[áa]ximo|m[íi]nimo|no puede pesar|ventanas emergentes|solo se permiten|por favor|a[úu]n no|no (permite|soporta)|no tiene/i;
const SUCCESS_RE = /✅|✔|correctamente|exitosamente|con [ée]xito|guardad[oa]s?\b|cread[oa]s?\b|actualizad[oa]s?\b|eliminad[oa]s?\b|enviad[oa]s?\b|registrad[oa]s?\b|copiad[oa]s?\b|marcad[oa]s?\b|facturad[oa]s?\b|agregad[oa]s?\b|vinculad[oa]s?\b|asignad[oa]s?\b|completad[oa]\b|listo\b/i;

// Emojis y símbolos decorativos al inicio del texto: el ícono ya indica el tipo.
const LEADING_SYMBOLS_RE = /^[\s←-⯿✀-➿️‍]+|^(?:\p{Extended_Pictographic}️?\s*)+/u;

export function classify(text) {
  if (ERROR_RE.test(text)) return "error";
  if (WARNING_RE.test(text)) return "warning";
  if (SUCCESS_RE.test(text)) return "success";
  return "info";
}

function toText(message) {
  if (message == null) return "";
  if (message instanceof Error) return message.message || String(message);
  if (typeof message === "object") {
    try {
      return JSON.stringify(message);
    } catch {
      return String(message);
    }
  }
  return String(message);
}

export function notify(message, options = {}) {
  const raw = toText(message);
  const type = options.type || classify(raw);
  const text = raw.replace(LEADING_SYMBOLS_RE, "").trim() || raw;

  if (typeof window === "undefined" || listeners.size === 0) {
    // Sin contenedor montado (SSR o fuera del layout): no perder el mensaje.
    (type === "error" ? console.error : console.log)(`[notify:${type}]`, raw);
    return;
  }

  const duration =
    options.duration ??
    Math.min(10000, (type === "error" ? 5000 : 3500) + text.length * 35);

  const item = { id: ++seq, type, text, duration };
  listeners.forEach((fn) => fn(item));
  return item.id;
}

notify.success = (m, o) => notify(m, { ...o, type: "success" });
notify.error = (m, o) => notify(m, { ...o, type: "error" });
notify.warning = (m, o) => notify(m, { ...o, type: "warning" });
notify.info = (m, o) => notify(m, { ...o, type: "info" });

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export default notify;

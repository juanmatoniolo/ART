// Evita envíos duplicados: mientras la ejecución anterior con la misma `key`
// no terminó, los nuevos clicks/submits se ignoran.
// El botón que disparó la acción queda marcado con data-busy (ver globals.css).

const pending = new Set();

function findTriggerElement(evt) {
  const el = evt && typeof evt === "object" ? evt.currentTarget : null;
  if (!el || typeof el.setAttribute !== "function") return null;
  if (el.tagName === "FORM") {
    return (
      el.querySelector('button[type="submit"], button:not([type]), input[type="submit"]') || el
    );
  }
  return el;
}

export function singleFlight(key, fn) {
  return (...args) => {
    const evt = args[0];
    if (pending.has(key)) {
      if (evt && typeof evt.preventDefault === "function") evt.preventDefault();
      return undefined;
    }

    const trigger = findTriggerElement(evt);
    const result = fn(...args);

    // Handlers síncronos: nada que esperar
    if (!result || typeof result.then !== "function") return result;

    pending.add(key);
    trigger?.setAttribute("data-busy", "true");
    trigger?.setAttribute("aria-busy", "true");
    return Promise.resolve(result).finally(() => {
      pending.delete(key);
      trigger?.removeAttribute("data-busy");
      trigger?.removeAttribute("aria-busy");
    });
  };
}

export default singleFlight;

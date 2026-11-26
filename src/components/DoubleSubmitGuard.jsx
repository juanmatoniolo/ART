"use client";

import { useEffect } from "react";

// Red de seguridad global contra el doble click / doble toque:
// ignora un segundo click sobre el mismo botón de acción (o un segundo submit
// del mismo formulario) dentro de REPEAT_WINDOW ms.
// Para excluir un botón que necesita clicks rápidos: data-allow-repeat.

const REPEAT_WINDOW = 800;
const ACTION_RE =
  /\b(guardar|enviar|crear|confirmar|registrar|eliminar|borrar|facturar|generar|subir|actualizar|aceptar|ingresar|fusionar|descargar|imprimir|reservar|agregar|nuev[oa])\b/i;

function isActionButton(btn) {
  if ("allowRepeat" in btn.dataset) return false;
  const type = (btn.getAttribute("type") || "submit").toLowerCase();
  if (type === "submit" && btn.form) return true;
  const label = `${btn.textContent || ""} ${btn.getAttribute("aria-label") || ""} ${btn.title || ""}`;
  return ACTION_RE.test(label);
}

export default function DoubleSubmitGuard() {
  useEffect(() => {
    const last = new WeakMap();

    const block = (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
    };

    const onClick = (e) => {
      const btn = e.target?.closest?.('button, input[type="submit"]');
      if (!btn) return;
      if (btn.getAttribute("data-busy") === "true") return block(e);
      if (!isActionButton(btn)) return;
      const now = Date.now();
      if (now - (last.get(btn) || 0) < REPEAT_WINDOW) return block(e);
      last.set(btn, now);
    };

    const onSubmit = (e) => {
      const form = e.target;
      if (!(form instanceof HTMLFormElement)) return;
      const now = Date.now();
      if (now - (last.get(form) || 0) < REPEAT_WINDOW) return block(e);
      last.set(form, now);
    };

    window.addEventListener("click", onClick, true);
    window.addEventListener("submit", onSubmit, true);
    return () => {
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("submit", onSubmit, true);
    };
  }, []);

  return null;
}

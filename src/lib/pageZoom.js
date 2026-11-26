// Factor entre coordenadas de getBoundingClientRect y px de CSS para
// elementos position:fixed colgados de <body>. Con la escala global
// (html { zoom }) los navegadores modernos devuelven coordenadas visuales
// y los viejos no: se mide con una sonda para que funcione en ambos.
export function getRectScale() {
  if (typeof document === "undefined" || !document.body) return 1;
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:0;left:0;width:100px;height:0;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const width = probe.getBoundingClientRect().width;
  probe.remove();
  return width > 0 ? width / 100 : 1;
}

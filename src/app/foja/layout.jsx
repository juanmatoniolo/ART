"use client";

// Pantalla PÚBLICA de carga (pedido del usuario): /foja se abre sin login.
// Sin sesión solo permite cargar la foja y descargar el PDF; las plantillas
// requieren sesión (useAreaAccess en la página). /foja/medicos sigue protegida
// con su propio layout (RoleGate).
export default function Layout({ children }) {
  return children;
}

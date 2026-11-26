"use client";

// Pantalla PÚBLICA de carga (pedido del usuario): se abre sin login.
// Sin sesión solo permite cargar un siniestro nuevo y descargar el PDF;
// buscar y editar pacientes requieren sesión con rol habilitado
// (ver useAreaAccess en la página y AREAS["/Siniestro"] en lib/roles.js).
export default function Layout({ children }) {
  return children;
}

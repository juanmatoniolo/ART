"use client";

// Pantalla PÚBLICA de carga (pedido del usuario): se abre sin login.
// Sin sesión solo permite cargar un ingreso nuevo y descargar el PDF;
// buscar/editar, historias clínicas, documentación y PAMI requieren sesión
// con rol habilitado (ver useAreaAccess en la página y AREAS["/ingresos"]).
export default function Layout({ children }) {
  return children;
}

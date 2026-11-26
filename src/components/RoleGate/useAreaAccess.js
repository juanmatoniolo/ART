"use client";
// Para pantallas PÚBLICAS de carga (ART/Siniestro, Ingresos, FojaQX):
// la pantalla se abre sin login, pero las funciones que leen, editan o borran
// datos solo se muestran si hay sesión activa con un rol habilitado para el área.
import { useSession } from "@/context/SessionContext";
import { AREAS, canUse } from "@/lib/roles";

/** true si hay sesión activa y el rol puede usar el área (ej. "/Siniestro"). */
export function useAreaAccess(area) {
  const { status, usuario } = useSession();
  return status === "active" && canUse(usuario?.roles || [], AREAS[area]);
}

/** Texto común del aviso de "modo carga" para quien no inició sesión. */
export const MODO_CARGA_TEXTO =
  "Modo carga: no iniciaste sesión. Podés cargar un registro nuevo y descargar el PDF. Para buscar, editar o ver registros, iniciá sesión.";

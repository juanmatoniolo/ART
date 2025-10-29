'use client';
import { useEffect } from 'react';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

/**
 * Este componente se encarga de cargar los scripts de Bootstrap
 * únicamente en el cliente, evitando errores SSR.
 */
export default function BootstrapClient() {
	useEffect(() => {
		// Podés agregar lógica si necesitás inicializar algo de Bootstrap
	}, []);

	return null;
}

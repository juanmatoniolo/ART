'use client';
import { useEffect } from 'react';

export default function BootstrapClient() {
	useEffect(() => {
		// ✅ Cargar Bootstrap JS solo en el cliente (no rompe SSR)
		import('bootstrap/dist/js/bootstrap.bundle.min.js')
			.then(() => console.log('✅ Bootstrap JS cargado correctamente'))
			.catch((err) => console.error('❌ Error al cargar Bootstrap JS:', err));
	}, []);

	return null; // No renderiza nada visualmente
}

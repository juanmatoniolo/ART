'use client';
import { useEffect } from 'react';

export default function BootstrapWrapper() {
	useEffect(() => {
		import('bootstrap/dist/js/bootstrap.bundle.min.js')
			.then(() => console.log('✅ Bootstrap cargado en cliente'))
			.catch(err => console.error('❌ Error al cargar Bootstrap:', err));
	}, []);

	return null;
}

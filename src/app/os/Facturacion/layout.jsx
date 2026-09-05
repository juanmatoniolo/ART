// src/app/admin/Facturacion/layout.jsx
import { Suspense } from 'react';

export default function FacturacionLayout({ children }) {
  return (
    <Suspense fallback={null}>
      {children}
    </Suspense>
  );
}
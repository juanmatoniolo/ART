// src/app/admin/facturacion/page.jsx
'use client';

import { ConvenioProvider } from './components/ConvenioContext';
import FacturaContainer from './components/FacturaContainer';
import './facturacion.module.css';

export default function Facturacion() {
  return (
    <ConvenioProvider>
      <FacturaContainer />
    </ConvenioProvider>
  );
}


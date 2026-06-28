// src/app/admin/Facturacion/Facturados/borradores/page.jsx
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/admin/Facturacion/Facturados?estado=borrador');
}
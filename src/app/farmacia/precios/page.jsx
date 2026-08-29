'use client';

import { useFarmaciaContext } from '../context/FarmaciaContext';
import ListasPreciosTab from '../components/ListasPreciosTab';

export default function PreciosPage() {
  const { items, listasPrecios, guardarListaPrecio, eliminarListaPrecio, editarProducto } = useFarmaciaContext();

  return (
    <ListasPreciosTab
      items={items}
      listas={listasPrecios}
      onGuardarLista={guardarListaPrecio}
      onEliminarLista={eliminarListaPrecio}
      onActualizarItem={editarProducto}
    />
  );
}

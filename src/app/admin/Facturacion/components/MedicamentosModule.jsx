'use client';

import { useState, useEffect, useMemo } from 'react';
import { ref, onValue } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, normalize } from '../utils/calculos';
import styles from './facturacion.module.css';

export default function MedicamentosModule({
  medicamentosAgregados,
  descartablesAgregados,
  agregarMedicamento,
  agregarDescartable,
  onAtras,
  onSiguiente
}) {
  const [busqueda, setBusqueda] = useState('');
  const [medicacionDB, setMedicacionDB] = useState([]);
  const [descartablesDB, setDescartablesDB] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar medicamentos desde Firebase
  useEffect(() => {
    const medicamentosRef = ref(db, 'medydescartables/medicamentos');
    const descartablesRef = ref(db, 'medydescartables/descartables');
    
    const unsubMed = onValue(medicamentosRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const lista = Object.entries(data).map(([key, item]) => ({
          id: key,
          tipo: 'medicamento',
          nombre: item.nombre || key,
          presentacion: item.presentacion || 'ampolla',
          precio: parseFloat(item.precioReferencia || item.precio || 0)
        }));
        setMedicacionDB(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
      setLoading(false);
    });
    
    const unsubDesc = onValue(descartablesRef, (snap) => {
      if (snap.exists()) {
        const data = snap.val();
        const lista = Object.entries(data).map(([key, item]) => ({
          id: key,
          tipo: 'descartable',
          nombre: item.nombre || key,
          presentacion: item.presentacion || 'unidad',
          precio: parseFloat(item.precioReferencia || item.precio || 0)
        }));
        setDescartablesDB(lista.sort((a, b) => a.nombre.localeCompare(b.nombre)));
      }
    });
    
    return () => {
      unsubMed();
      unsubDesc();
    };
  }, []);

  // Filtrar medicamentos
  const medicamentosFiltrados = useMemo(() => {
    if (!busqueda) return medicacionDB.slice(0, 50);
    
    const busquedaNorm = normalize(busqueda);
    return medicacionDB
      .filter(m => normalize(m.nombre).includes(busquedaNorm))
      .slice(0, 50);
  }, [medicacionDB, busqueda]);

  // Filtrar descartables
  const descartablesFiltrados = useMemo(() => {
    if (!busqueda) return descartablesDB.slice(0, 50);
    
    const busquedaNorm = normalize(busqueda);
    return descartablesDB
      .filter(d => normalize(d.nombre).includes(busquedaNorm))
      .slice(0, 50);
  }, [descartablesDB, busqueda]);

  const handleAgregarMedicamento = (medicamento) => {
    const nuevoMedicamento = {
      id: `med-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...medicamento,
      total: medicamento.precio,
      cantidad: 1
    };
    agregarMedicamento(nuevoMedicamento);
  };

  const handleAgregarDescartable = (descartable) => {
    const nuevoDescartable = {
      id: `desc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...descartable,
      total: descartable.precio,
      cantidad: 1
    };
    agregarDescartable(nuevoDescartable);
  };

  return (
    <div className={styles.tabContent}>
      <h2>💊 Medicamentos y Descartables</h2>
      
      <div className={styles.buscadorContainer}>
        <input
          type="text"
          placeholder="Buscar medicamento o descartable..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className={styles.buscadorInput}
        />
      </div>
      
      {loading ? (
        <div className={styles.loading}>Cargando medicamentos...</div>
      ) : (
        <>
          {/* Medicamentos */}
          <h3>💊 Medicamentos</h3>
          <div className={styles.listaItems}>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Presentación</th>
                    <th>Precio</th>
                    <th>Agregar</th>
                  </tr>
                </thead>
                <tbody>
                  {medicamentosFiltrados.map((m, i) => (
                    <tr key={`med-${m.id}-${i}`}>
                      <td>{m.nombre}</td>
                      <td>{m.presentacion}</td>
                      <td>${money(m.precio)}</td>
                      <td>
                        <button
                          onClick={() => handleAgregarMedicamento(m)}
                          className={styles.btnAgregar}
                          title="Agregar a factura"
                        >
                          ➕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Descartables */}
          <h3>🧷 Descartables</h3>
          <div className={styles.listaItems}>
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Presentación</th>
                    <th>Precio</th>
                    <th>Agregar</th>
                  </tr>
                </thead>
                <tbody>
                  {descartablesFiltrados.map((d, i) => (
                    <tr key={`desc-${d.id}-${i}`}>
                      <td>{d.nombre}</td>
                      <td>{d.presentacion}</td>
                      <td>${money(d.precio)}</td>
                      <td>
                        <button
                          onClick={() => handleAgregarDescartable(d)}
                          className={styles.btnAgregar}
                          title="Agregar a factura"
                        >
                          ➕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      
      <div className={styles.botonesNavegacion}>
        <button 
          className={styles.btnAtras}
          onClick={onAtras}
        >
          ← Atrás
        </button>
        <button 
          className={styles.btnSiguiente}
          onClick={onSiguiente}
        >
          Siguiente → Resumen
        </button>
      </div>
    </div>
  );
}
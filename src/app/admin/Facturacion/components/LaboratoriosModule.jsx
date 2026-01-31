'use client';

import { useState, useEffect, useMemo } from 'react';
import { useConvenio } from './ConvenioContext';
import { calcularLaboratorio, money, normalize } from '../utils/calculos';
import styles from './facturacion.module.css';

export default function LaboratoriosModule({
  laboratoriosAgregados,
  agregarLaboratorio,
  onAtras,
  onSiguiente
}) {
  const { valoresConvenio } = useConvenio();
  const [busqueda, setBusqueda] = useState('');
  const [nomenclador, setNomenclador] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cargar nomenclador bioquímica
  useEffect(() => {
    fetch('/archivos/NomecladorBioquimica.json')
      .then(res => res.json())
      .then(json => {
        const practicas = json.practicas?.map(p => ({
          tipo: 'laboratorio',
          codigo: p.codigo,
          descripcion: p.practica_bioquimica || p.descripcion,
          unidadBioquimica: parseFloat(p.unidad_bioquimica) || 0
        })) || [];
        setNomenclador(practicas);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error cargando laboratorios:', err);
        setLoading(false);
      });
  }, []);

  // Filtrar laboratorios
  const laboratoriosFiltrados = useMemo(() => {
    if (!busqueda) return nomenclador.slice(0, 50);
    
    const busquedaNorm = normalize(busqueda);
    return nomenclador
      .filter(l => 
        normalize(l.codigo).includes(busquedaNorm) ||
        normalize(l.descripcion).includes(busquedaNorm)
      )
      .slice(0, 50);
  }, [nomenclador, busqueda]);

  const handleAgregar = (laboratorio) => {
    const valores = calcularLaboratorio(laboratorio, valoresConvenio);
    const nuevoLaboratorio = {
      id: `lab-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...laboratorio,
      ...valores,
      cantidad: 1
    };
    agregarLaboratorio(nuevoLaboratorio);
  };

  const getValorEstimado = (laboratorio) => {
    const valores = calcularLaboratorio(laboratorio, valoresConvenio);
    return valores.total;
  };

  return (
    <div className={styles.tabContent}>
      <h2>🧪 Estudios de Laboratorio</h2>
      
      {/* Mostrar valores del convenio */}
      <div className={styles.infoBox}>
        <p><strong>Valor UB del convenio:</strong> ${money(valoresConvenio.valorUB)}</p>
        <p>Los valores se calculan automáticamente: UB × Valor UB del convenio</p>
      </div>
      
      <div className={styles.buscadorContainer}>
        <input
          type="text"
          placeholder="Buscar estudio por código o descripción..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className={styles.buscadorInput}
        />
        <div className={styles.buscadorInfo}>
          {laboratoriosFiltrados.length} estudios encontrados
        </div>
      </div>
      
      {loading ? (
        <div className={styles.loading}>Cargando laboratorios...</div>
      ) : (
        <div className={styles.listaItems}>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Práctica Bioquímica</th>
                  <th>U.B.</th>
                  <th>Valor Estimado</th>
                  <th>Agregar</th>
                </tr>
              </thead>
              <tbody>
                {laboratoriosFiltrados.map((l, i) => (
                  <tr key={`${l.codigo}-${i}`}>
                    <td>{l.codigo}</td>
                    <td>{l.descripcion}</td>
                    <td>{money(l.unidadBioquimica)}</td>
                    <td>${money(getValorEstimado(l))}</td>
                    <td>
                      <button
                        onClick={() => handleAgregar(l)}
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
          Siguiente → Medicamentos
        </button>
      </div>
    </div>
  );
}
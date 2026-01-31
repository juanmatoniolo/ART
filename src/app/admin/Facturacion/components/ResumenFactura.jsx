'use client';

import { useMemo } from 'react';
import { useConvenio } from './ConvenioContext';
import { money } from '../utils/calculos';
import styles from './facturacion.module.css';

export default function ResumenFactura({
  paciente,
  practicas,
  laboratorios,
  medicamentos,
  descartables,
  actualizarCantidad,
  eliminarItem,
  limpiarFactura,
  onAtras,
  generarExcel
}) {
  const { valoresConvenio, convenioSel, convenios } = useConvenio();

  // Calcular totales
  const totales = useMemo(() => {
    const totalPracticas = practicas.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalLaboratorios = laboratorios.reduce((sum, l) => sum + (l.total || 0), 0);
    const totalMedicamentos = medicamentos.reduce((sum, m) => sum + (m.total || 0), 0);
    const totalDescartables = descartables.reduce((sum, d) => sum + (d.total || 0), 0);
    const subtotal = totalPracticas + totalLaboratorios + totalMedicamentos + totalDescartables;
    
    return {
      totalPracticas,
      totalLaboratorios,
      totalMedicamentos,
      totalDescartables,
      subtotal,
      totalFinal: subtotal // Podrías agregar impuestos aquí si es necesario
    };
  }, [practicas, laboratorios, medicamentos, descartables]);

  // Nombre del convenio
  const nombreConvenio = convenios[convenioSel]?.nombre || convenioSel || 'No seleccionado';

  // Función para renderizar fórmula
  const renderFormula = (item) => {
    if (item.tipo === 'practica' && item.formula) {
      return <div className={styles.formulaPequeña}>{item.formula}</div>;
    }
    if (item.tipo === 'laboratorio' && item.formula) {
      return <div className={styles.formulaPequeña}>{item.formula}</div>;
    }
    return null;
  };

  // Función para renderizar item
  const renderItem = (item, index, tipo) => {
    const esRX = item.esRX;
    
    return (
      <tr key={item.id || index} className={esRX ? styles.rxRow : ''}>
        <td className={styles.columnaCodigo}>
          <strong>{item.codigo || '—'}</strong>
          {esRX && <span className={styles.badgeRx}>RX</span>}
          {item.urgencia && <span className={styles.badgeUrgencia}>U</span>}
        </td>
        <td className={styles.columnaDescripcion}>
          {item.descripcion || item.nombre || 'Sin descripción'}
          {renderFormula(item)}
        </td>
        <td className={styles.columnaCantidad}>
          <div className={styles.contadorCantidad}>
            <button 
              onClick={() => actualizarCantidad(item.id, Math.max(1, item.cantidad - 1))}
              className={styles.btnCantidad}
            >
              −
            </button>
            <input
              type="number"
              min="1"
              value={item.cantidad || 1}
              onChange={(e) => {
                const nuevaCantidad = parseInt(e.target.value) || 1;
                actualizarCantidad(item.id, Math.max(1, nuevaCantidad));
              }}
              className={styles.inputCantidad}
            />
            <button 
              onClick={() => actualizarCantidad(item.id, (item.cantidad || 1) + 1)}
              className={styles.btnCantidad}
            >
              +
            </button>
          </div>
        </td>
        <td className={styles.columnaUnidad}>
          {item.tipo === 'practica' && (
            <>
              <div>GAL: {money(item.qgal || 0)}</div>
              <div>GTO: {money(item.gto || 0)}</div>
            </>
          )}
          {item.tipo === 'laboratorio' && (
            <div>UB: {money(item.unidadBioquimica || 0)}</div>
          )}
          {item.tipo === 'medicamento' && (
            <div>Unit: ${money(item.valorUnitario || 0)}</div>
          )}
          {item.tipo === 'descartable' && (
            <div>Unit: ${money(item.valorUnitario || 0)}</div>
          )}
        </td>
        <td className={styles.columnaValor}>
          <strong>${money(item.total || 0)}</strong>
          <div className={styles.formulaPequeña}>
            {item.cantidad || 1} × ${money(item.total / (item.cantidad || 1))}
          </div>
        </td>
        <td className={styles.columnaAcciones}>
          <button
            onClick={() => eliminarItem(item.id)}
            className={styles.btnEliminar}
            title="Eliminar item"
          >
            🗑️
          </button>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.tabContent}>
      <h2>📋 Resumen de Factura</h2>
      
      {/* Información del paciente y convenio */}
      <div className={styles.infoResumen}>
        <div className={styles.infoPaciente}>
          <h3>👤 Paciente</h3>
          <p><strong>Nombre:</strong> {paciente.nombre || 'No especificado'}</p>
          <p><strong>DNI:</strong> {paciente.dni || '—'}</p>
          <p><strong>N° Afiliado:</strong> {paciente.nAfiliado || '—'}</p>
        </div>
        
        <div className={styles.infoConvenio}>
          <h3>🏥 Convenio</h3>
          <p><strong>Nombre:</strong> {nombreConvenio}</p>
          <p><strong>Valores activos:</strong></p>
          <div className={styles.valoresMini}>
            <span>Galeno Rx: ${money(valoresConvenio.galenoRx)}</span>
            <span>Gasto Rx: ${money(valoresConvenio.gastoRx)}</span>
            <span>Valor UB: ${money(valoresConvenio.valorUB)}</span>
          </div>
        </div>
      </div>

      {/* Prácticas médicas */}
      {practicas.length > 0 && (
        <div className={styles.seccionItems}>
          <h3>🏥 Prácticas Médicas ({practicas.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th>Unidades</th>
                  <th>Valor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {practicas.map((item, index) => renderItem(item, index, 'practica'))}
              </tbody>
              <tfoot>
                <tr className={styles.totalFila}>
                  <td colSpan={4} className={styles.textoTotal}>
                    <strong>Total Prácticas:</strong>
                  </td>
                  <td colSpan={2}>
                    <strong className={styles.montoTotal}>
                      ${money(totales.totalPracticas)}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Laboratorios */}
      {laboratorios.length > 0 && (
        <div className={styles.seccionItems}>
          <h3>🧪 Estudios de Laboratorio ({laboratorios.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Práctica Bioquímica</th>
                  <th>Cantidad</th>
                  <th>U.B.</th>
                  <th>Valor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {laboratorios.map((item, index) => renderItem(item, index, 'laboratorio'))}
              </tbody>
              <tfoot>
                <tr className={styles.totalFila}>
                  <td colSpan={4} className={styles.textoTotal}>
                    <strong>Total Laboratorios:</strong>
                  </td>
                  <td colSpan={2}>
                    <strong className={styles.montoTotal}>
                      ${money(totales.totalLaboratorios)}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Medicamentos */}
      {medicamentos.length > 0 && (
        <div className={styles.seccionItems}>
          <h3>💊 Medicamentos ({medicamentos.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Medicamento</th>
                  <th>Cantidad</th>
                  <th>Precio Unit.</th>
                  <th>Valor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {medicamentos.map((item, index) => renderItem(item, index, 'medicamento'))}
              </tbody>
              <tfoot>
                <tr className={styles.totalFila}>
                  <td colSpan={4} className={styles.textoTotal}>
                    <strong>Total Medicamentos:</strong>
                  </td>
                  <td colSpan={2}>
                    <strong className={styles.montoTotal}>
                      ${money(totales.totalMedicamentos)}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Descartables */}
      {descartables.length > 0 && (
        <div className={styles.seccionItems}>
          <h3>🩹 Descartables ({descartables.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Descartable</th>
                  <th>Cantidad</th>
                  <th>Precio Unit.</th>
                  <th>Valor</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {descartables.map((item, index) => renderItem(item, index, 'descartable'))}
              </tbody>
              <tfoot>
                <tr className={styles.totalFila}>
                  <td colSpan={4} className={styles.textoTotal}>
                    <strong>Total Descartables:</strong>
                  </td>
                  <td colSpan={2}>
                    <strong className={styles.montoTotal}>
                      ${money(totales.totalDescartables)}
                    </strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Totales generales */}
      <div className={styles.totalesGenerales}>
        <h3>💰 Total General</h3>
        <div className={styles.gridTotales}>
          <div className={styles.totalItem}>
            <span>Prácticas Médicas:</span>
            <strong>${money(totales.totalPracticas)}</strong>
          </div>
          <div className={styles.totalItem}>
            <span>Estudios de Laboratorio:</span>
            <strong>${money(totales.totalLaboratorios)}</strong>
          </div>
          <div className={styles.totalItem}>
            <span>Medicamentos:</span>
            <strong>${money(totales.totalMedicamentos)}</strong>
          </div>
          <div className={styles.totalItem}>
            <span>Descartables:</span>
            <strong>${money(totales.totalDescartables)}</strong>
          </div>
          <div className={styles.totalItemGrande}>
            <span>TOTAL A FACTURAR:</span>
            <strong className={styles.totalFinal}>
              ${money(totales.totalFinal)}
            </strong>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className={styles.botonesResumen}>
        <div className={styles.botonesIzquierda}>
          <button 
            className={styles.btnAtras}
            onClick={onAtras}
          >
            ← Atrás
          </button>
          <button 
            className={styles.btnLimpiar}
            onClick={limpiarFactura}
          >
            🗑️ Limpiar Todo
          </button>
        </div>
        
        <div className={styles.botonesDerecha}>
          <button 
            className={styles.btnDescargar}
            onClick={generarExcel}
            disabled={totales.totalFinal === 0}
          >
            📊 Generar Excel
          </button>
          <button 
            className={styles.btnImprimir}
            onClick={() => window.print()}
            disabled={totales.totalFinal === 0}
          >
            🖨️ Imprimir
          </button>
        </div>
      </div>

      {/* Mensaje si no hay items */}
      {practicas.length === 0 && 
       laboratorios.length === 0 && 
       medicamentos.length === 0 && 
       descartables.length === 0 && (
        <div className={styles.sinItems}>
          <p>📝 No hay items en la factura</p>
          <p><small>Agregue prácticas, laboratorios, medicamentos o descartables para continuar</small></p>
        </div>
      )}
    </div>
  );
}
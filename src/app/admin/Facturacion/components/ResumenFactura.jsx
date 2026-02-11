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

  const totales = useMemo(() => {
    const totalPracticas = practicas.reduce((sum, p) => sum + (p.total || 0), 0);
    const totalLaboratorios = laboratorios.reduce((sum, l) => sum + (l.total || 0), 0);
    const totalMedicamentos = medicamentos.reduce((sum, m) => sum + (m.total || 0), 0);
    const totalDescartables = descartables.reduce((sum, d) => sum + (d.total || 0), 0);
    const subtotal = totalPracticas + totalLaboratorios + totalMedicamentos + totalDescartables;
    return { totalPracticas, totalLaboratorios, totalMedicamentos, totalDescartables, subtotal, totalFinal: subtotal };
  }, [practicas, laboratorios, medicamentos, descartables]);

  const nombreConvenio = convenios[convenioSel]?.nombre || convenioSel || 'No seleccionado';

  const renderFormula = (item) => item.formula && <div className={styles.formulaPequeña}>{item.formula}</div>;

  const renderItem = (item, tipo) => {
    const esRX = item.esRX;
    const cantidad = item.cantidad || 1;
    const valorUnitario = item.total / cantidad;

    // ✅ Key única: tipo + id (garantiza unicidad global)
    const uniqueKey = `${tipo}-${item.id}`;

    return (
      <tr key={uniqueKey} className={esRX ? styles.rxRow : ''}>
        <td className={styles.columnaCodigo}>
          <strong>{item.codigo || '—'}</strong>
          {esRX && <span className={styles.badgeRx}>RX</span>}
        </td>
        <td className={styles.columnaDescripcion}>
          {item.descripcion || item.nombre || 'Sin descripción'}
          {renderFormula(item)}
        </td>
        <td className={styles.columnaCantidad}>
          <div className={styles.contadorCantidad}>
            <button onClick={() => actualizarCantidad(item.id, cantidad - 1)} className={styles.btnCantidad}>−</button>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => actualizarCantidad(item.id, parseInt(e.target.value) || 1)}
              className={styles.inputCantidad}
            />
            <button onClick={() => actualizarCantidad(item.id, cantidad + 1)} className={styles.btnCantidad}>+</button>
          </div>
        </td>
        <td className={styles.columnaUnidad}>
          {tipo === 'practica' && (
            <>
              <div>Hon: {money(item.honorarioMedico / cantidad)}</div>
              <div>Gas: {money(item.gastoSanatorial / cantidad)}</div>
            </>
          )}
          {tipo === 'laboratorio' && <div>UB: {money(item.unidadBioquimica || 0)}</div>}
          {(tipo === 'medicamento' || tipo === 'descartable') && <div>Unit: ${money(item.precio || 0)}</div>}
        </td>
        <td className={styles.columnaValor}>
          <strong>${money(item.total || 0)}</strong>
          <div className={styles.formulaPequeña}>{cantidad} × ${money(valorUnitario)}</div>
        </td>
        <td className={styles.columnaAcciones}>
          <button onClick={() => eliminarItem(item.id)} className={styles.btnEliminar} title="Eliminar">🗑️</button>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.tabContent}>
      <h2>📋 Resumen de Factura</h2>

      <div className={styles.infoResumen}>
        <div className={styles.infoPaciente}>
          <h3>👤 Paciente</h3>
          <p><strong>Nombre:</strong> {paciente.nombreCompleto || 'No especificado'}</p>
          <p><strong>DNI:</strong> {paciente.dni || '—'}</p>
          <p><strong>N° Siniestro:</strong> {paciente.nroSiniestro || '—'}</p>
          <p><strong>ART/Seguro:</strong> {paciente.artSeguro || '—'}</p>
          <p><strong>Fecha atención:</strong> {paciente.fechaAtencion || '—'}</p>
        </div>
        <div className={styles.infoConvenio}>
          <h3>🏥 Convenio</h3>
          <p><strong>Nombre:</strong> {nombreConvenio}</p>
          <div className={styles.valoresMini}>
            <span>Galeno Rx: ${money(valoresConvenio?.galenoRx)}</span>
            <span>Gasto Rx: ${money(valoresConvenio?.gastoRx)}</span>
            <span>Valor UB: ${money(valoresConvenio?.valorUB)}</span>
          </div>
        </div>
      </div>

      {practicas.length > 0 && (
        <div className={styles.seccionItems}>
          <h3>🏥 Prácticas Médicas ({practicas.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>{/* ... */}</thead>
              <tbody>{practicas.map(p => renderItem(p, 'practica'))}</tbody>
              <tfoot>{/* ... */}</tfoot>
            </table>
          </div>
        </div>
      )}

      {laboratorios.length > 0 && (
        <div className={styles.seccionItems}>
          <h3>🧪 Estudios de Laboratorio ({laboratorios.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>{/* ... */}</thead>
              <tbody>{laboratorios.map(l => renderItem(l, 'laboratorio'))}</tbody>
              <tfoot>{/* ... */}</tfoot>
            </table>
          </div>
        </div>
      )}

      {medicamentos.length > 0 && (
        <div className={styles.seccionItems}>
          <h3>💊 Medicamentos ({medicamentos.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>{/* ... */}</thead>
              <tbody>{medicamentos.map(m => renderItem(m, 'medicamento'))}</tbody>
              <tfoot>{/* ... */}</tfoot>
            </table>
          </div>
        </div>
      )}

      {descartables.length > 0 && (
        <div className={styles.seccionItems}>
          <h3>🩹 Descartables ({descartables.length})</h3>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>{/* ... */}</thead>
              <tbody>{descartables.map(d => renderItem(d, 'descartable'))}</tbody>
              <tfoot>{/* ... */}</tfoot>
            </table>
          </div>
        </div>
      )}

      <div className={styles.totalesGenerales}>
        <h3>💰 Total General</h3>
        <div className={styles.gridTotales}>
          <div className={styles.totalItem}><span>Prácticas:</span><strong>${money(totales.totalPracticas)}</strong></div>
          <div className={styles.totalItem}><span>Laboratorios:</span><strong>${money(totales.totalLaboratorios)}</strong></div>
          <div className={styles.totalItem}><span>Medicamentos:</span><strong>${money(totales.totalMedicamentos)}</strong></div>
          <div className={styles.totalItem}><span>Descartables:</span><strong>${money(totales.totalDescartables)}</strong></div>
          <div className={styles.totalItemGrande}>
            <span>TOTAL A FACTURAR:</span>
            <strong className={styles.totalFinal}>${money(totales.totalFinal)}</strong>
          </div>
        </div>
      </div>

      <div className={styles.botonesResumen}>
        <div className={styles.botonesIzquierda}>
          <button className={styles.btnAtras} onClick={onAtras}>← Atrás</button>
          <button className={styles.btnLimpiar} onClick={limpiarFactura}>🗑️ Limpiar Todo</button>
        </div>
        <div className={styles.botonesDerecha}>
          <button className={styles.btnDescargar} onClick={generarExcel} disabled={totales.totalFinal === 0}>📊 Generar Excel</button>
          <button className={styles.btnImprimir} onClick={() => window.print()} disabled={totales.totalFinal === 0}>🖨️ Imprimir</button>
        </div>
      </div>
    </div>
  );
}
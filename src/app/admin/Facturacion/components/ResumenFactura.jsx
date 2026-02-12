'use client';

import { useMemo, useState } from 'react';
import { useConvenio } from './ConvenioContext';
import { money } from '../utils/calculos';
import styles from './resumenFactura.module.css';

export default function ResumenFactura(props) {
  const {
    paciente: pacienteProp,
    practicas = [],
    laboratorios = [],
    medicamentos = [],
    descartables = [],
    actualizarCantidad = () => { },
    actualizarItem = () => { },
    eliminarItem = () => { },
    limpiarFactura = () => { },
    onAtras = () => { }
  } = props || {};

  // ✅ fallback seguro (evita "Cannot read ... of undefined")
  const paciente = pacienteProp || {
    nombreCompleto: '',
    dni: '',
    artSeguro: '',
    nroSiniestro: '',
    fechaAtencion: ''
  };

  const { valoresConvenio, convenioSel, convenios } = useConvenio();

  const [open, setOpen] = useState({
    practicas: true,
    practicasHonorarios: true,
    practicasGastos: true,
    laboratorios: false,
    medicamentos: false,
    descartables: false
  });

  const toggle = (key) => setOpen((p) => ({ ...p, [key]: !p[key] }));

  const nombreConvenio = convenios?.[convenioSel]?.nombre || convenioSel || 'No seleccionado';

  const practicasHonorarios = useMemo(
    () => practicas.filter((p) => (p?.prestadorTipo || 'Clinica') === 'Dr'),
    [practicas]
  );

  const practicasGastos = useMemo(
    () => practicas.filter((p) => (p?.prestadorTipo || 'Clinica') !== 'Dr'),
    [practicas]
  );

  const sum = (arr, field = 'total') => (arr || []).reduce((a, x) => a + (Number(x?.[field]) || 0), 0);

  const totales = useMemo(() => {
    const totalPracticas = sum(practicas);
    const totalLaboratorios = sum(laboratorios);
    const totalMedicamentos = sum(medicamentos);
    const totalDescartables = sum(descartables);
    const subtotal = totalPracticas + totalLaboratorios + totalMedicamentos + totalDescartables;

    const totalHonorarios = sum(practicas, 'honorarioMedico') + sum(laboratorios, 'honorarioMedico');
    const totalGastos =
      sum(practicas, 'gastoSanatorial') + sum(medicamentos, 'gastoSanatorial') + sum(descartables, 'gastoSanatorial');

    return {
      totalPracticas,
      totalLaboratorios,
      totalMedicamentos,
      totalDescartables,
      subtotal,
      totalFinal: subtotal,
      totalHonorarios,
      totalGastos
    };
  }, [practicas, laboratorios, medicamentos, descartables]);

  const renderFormula = (item) => (item?.formula ? <div className={styles.formulaPequeña}>{item.formula}</div> : null);

  const renderItem = (item, tipo) => {
    const it = item || {};
    const cantidad = Math.max(1, Number(it.cantidad) || 1);
    const total = Number(it.total) || 0;
    const valorUnitario = cantidad > 0 ? total / cantidad : total;

    const uniqueKey = `${tipo}-${it.id ?? `${it.codigo ?? it.nombre ?? 'x'}-${Math.random()}`}`;

    const prestadorTipo = it.prestadorTipo || (tipo === 'practica' ? 'Clinica' : '');
    const prestadorNombre =
      tipo === 'practica'
        ? prestadorTipo === 'Dr'
          ? it.prestadorNombre || ''
          : it.prestadorNombre || 'Clínica de la Unión'
        : '';

    return (
      <tr key={uniqueKey} className={it.esRX ? styles.rxRow : ''}>
        <td className={styles.columnaCodigo}>
          <strong>{it.codigo || '—'}</strong>
          {it.esRX && <span className={styles.badgeRx}>RX</span>}
        </td>

        <td className={styles.columnaDescripcion}>
          <div className={styles.descPrincipal}>{it.descripcion || it.nombre || 'Sin descripción'}</div>

          {tipo === 'practica' && (
            <div className={styles.subMeta}>
              <span className={styles.metaPill}>{prestadorTipo === 'Dr' ? '👨‍⚕️ Dr' : '🏥 Clínica'}</span>
              <span className={styles.metaText}>{prestadorNombre || '—'}</span>
            </div>
          )}

          {renderFormula(it)}
        </td>

        <td className={styles.columnaCantidad}>
          <div className={styles.contadorCantidad}>
            <button onClick={() => actualizarCantidad(it.id, cantidad - 1)} className={styles.btnCantidad}>
              −
            </button>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={(e) => actualizarCantidad(it.id, parseInt(e.target.value, 10) || 1)}
              className={styles.inputCantidad}
            />
            <button onClick={() => actualizarCantidad(it.id, cantidad + 1)} className={styles.btnCantidad}>
              +
            </button>
          </div>
        </td>

        <td className={styles.columnaUnidad}>
          {tipo === 'practica' && (
            <>
              <div>Hon: {money((Number(it.honorarioMedico) || 0) / cantidad)}</div>
              <div>Gas: {money((Number(it.gastoSanatorial) || 0) / cantidad)}</div>
            </>
          )}
          {tipo === 'laboratorio' && <div>UB: {money(it.unidadBioquimica || 0)}</div>}
          {(tipo === 'medicamento' || tipo === 'descartable') && (
            <div>Unit: ${money(it.valorUnitario ?? it.precio ?? 0)}</div>
          )}
        </td>

        <td className={styles.columnaValor}>
          <div className={styles.valorStack}>
            <div className={styles.valorLine}>
              <span className={styles.valorLabel}>Hon</span>
              <strong className={styles.valorNumber}>${money(it.honorarioMedico || 0)}</strong>
            </div>
            <div className={styles.valorLine}>
              <span className={styles.valorLabel}>Gas</span>
              <strong className={styles.valorNumber}>${money(it.gastoSanatorial || 0)}</strong>
            </div>
            <div className={styles.formulaPequeña}>
              {cantidad} × ${money(valorUnitario)}
            </div>
          </div>
        </td>

        <td className={styles.columnaAcciones}>
          <button onClick={() => eliminarItem(it.id)} className={styles.btnEliminar} title="Eliminar">
            🗑️
          </button>
        </td>
      </tr>
    );
  };

  const renderTabla = (items, tipo, emptyText) => {
    if (!items || items.length === 0) return <div className={styles.emptyBlock}>{emptyText}</div>;

    return (
      <div className={styles.tableContainer}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thCode}>Cód.</th>
              <th className={styles.thDesc}>Descripción</th>
              <th className={styles.thQty}>Cant.</th>
              <th className={styles.thUnit}>Unit.</th>
              <th className={styles.thNum}>Importe</th>
              <th className={styles.thAction}>—</th>
            </tr>
          </thead>
          <tbody>{items.map((x) => renderItem(x, tipo))}</tbody>
        </table>
      </div>
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
            <span>Galeno Quir: ${money(valoresConvenio?.galenoQuir)}</span>
            <span>G. Oper.: ${money(valoresConvenio?.gastoOperatorio)}</span>
            <span>Pensión: ${money(valoresConvenio?.pension ?? valoresConvenio?.diaPension)}</span>
            <span>Valor UB: ${money(valoresConvenio?.valorUB)}</span>
          </div>
        </div>
      </div>

      {/* PRACTICAS */}
      <section className={styles.acSection}>
        <button className={styles.acHeader} onClick={() => toggle('practicas')}>
          <span className={styles.acTitle}>🏥 Prácticas</span>
          <span className={styles.acRight}>
            <span className={styles.acCount}>{practicas.length}</span>
            <span className={styles.acAmount}>${money(sum(practicas))}</span>
            <span className={`${styles.acChevron} ${open.practicas ? styles.acChevronOpen : ''}`}>▾</span>
          </span>
        </button>

        {open.practicas && (
          <div className={styles.acBody}>
            <div className={styles.subAcc}>
              <button className={styles.subAccHeader} onClick={() => toggle('practicasHonorarios')}>
                <span className={styles.subAccTitle}>👨‍⚕️ Honorarios Médicos (Dr)</span>
                <span className={styles.subAccRight}>
                  <span className={styles.acCount}>{practicasHonorarios.length}</span>
                  <span className={styles.acAmount}>${money(sum(practicasHonorarios, 'honorarioMedico'))}</span>
                  <span className={`${styles.acChevron} ${open.practicasHonorarios ? styles.acChevronOpen : ''}`}>▾</span>
                </span>
              </button>
              {open.practicasHonorarios && (
                <div className={styles.subAccBody}>
                  {renderTabla(practicasHonorarios, 'practica', 'No hay prácticas con prestador tipo Dr.')}
                </div>
              )}
            </div>

            <div className={styles.subAcc}>
              <button className={styles.subAccHeader} onClick={() => toggle('practicasGastos')}>
                <span className={styles.subAccTitle}>🏥 Gtos Sanatoriales (Clínica de la Unión)</span>
                <span className={styles.subAccRight}>
                  <span className={styles.acCount}>{practicasGastos.length}</span>
                  <span className={styles.acAmount}>${money(sum(practicasGastos, 'gastoSanatorial'))}</span>
                  <span className={`${styles.acChevron} ${open.practicasGastos ? styles.acChevronOpen : ''}`}>▾</span>
                </span>
              </button>
              {open.practicasGastos && (
                <div className={styles.subAccBody}>
                  {renderTabla(practicasGastos, 'practica', 'No hay prácticas con prestador tipo Clínica.')}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* LAB */}
      <section className={styles.acSection}>
        <button className={styles.acHeader} onClick={() => toggle('laboratorios')}>
          <span className={styles.acTitle}>🧪 Laboratorios</span>
          <span className={styles.acRight}>
            <span className={styles.acCount}>{laboratorios.length}</span>
            <span className={styles.acAmount}>${money(sum(laboratorios))}</span>
            <span className={`${styles.acChevron} ${open.laboratorios ? styles.acChevronOpen : ''}`}>▾</span>
          </span>
        </button>
        {open.laboratorios && <div className={styles.acBody}>{renderTabla(laboratorios, 'laboratorio', 'Sin laboratorios cargados.')}</div>}
      </section>

      {/* MED */}
      <section className={styles.acSection}>
        <button className={styles.acHeader} onClick={() => toggle('medicamentos')}>
          <span className={styles.acTitle}>💊 Medicamentos</span>
          <span className={styles.acRight}>
            <span className={styles.acCount}>{medicamentos.length}</span>
            <span className={styles.acAmount}>${money(sum(medicamentos))}</span>
            <span className={`${styles.acChevron} ${open.medicamentos ? styles.acChevronOpen : ''}`}>▾</span>
          </span>
        </button>
        {open.medicamentos && <div className={styles.acBody}>{renderTabla(medicamentos, 'medicamento', 'Sin medicamentos cargados.')}</div>}
      </section>

      {/* DESC */}
      <section className={styles.acSection}>
        <button className={styles.acHeader} onClick={() => toggle('descartables')}>
          <span className={styles.acTitle}>🩹 Descartables</span>
          <span className={styles.acRight}>
            <span className={styles.acCount}>{descartables.length}</span>
            <span className={styles.acAmount}>${money(sum(descartables))}</span>
            <span className={`${styles.acChevron} ${open.descartables ? styles.acChevronOpen : ''}`}>▾</span>
          </span>
        </button>
        {open.descartables && <div className={styles.acBody}>{renderTabla(descartables, 'descartable', 'Sin descartables cargados.')}</div>}
      </section>

      <div className={styles.totalesGenerales}>
        <h3>💰 Total General</h3>
        <div className={styles.gridTotales}>
          <div className={styles.totalItem}><span>Honorarios (Prácticas+Labs):</span><strong>${money(totales.totalHonorarios)}</strong></div>
          <div className={styles.totalItem}><span>Gastos (Prácticas+Med+Desc):</span><strong>${money(totales.totalGastos)}</strong></div>
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
      </div>
    </div>
  );
}

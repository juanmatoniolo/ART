'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { money, parseNumber } from '../utils/calculos';
import styles from './resumenFactura.module.css';

// Helper para redondear a 1 decimal
const to1Decimal = (n) => {
  const num = parseNumber(n);
  return Number.isFinite(num) ? Math.round(num * 10) / 10 : 0;
};

// Función unificada para cantidades (decimal > 0) con 1 decimal
const clampDecimalQty = (v) => {
  const n = parseNumber(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return to1Decimal(n);
};

// Formateo de cantidad: 1 decimal, pero sin ",0" si es entero
const fmtQtyInput = (v) => {
  const n = parseNumber(v);
  if (!Number.isFinite(n)) return '1';
  // Redondear a 1 decimal
  const rounded = to1Decimal(n);
  // Convertir a string con un decimal (ej. 1.0 -> "1,0")
  const withDecimal = rounded.toFixed(1).replace('.', ',');
  // Si termina en ",0", quitar el ",0"
  return withDecimal.replace(/,0$/, '');
};

const stopBubbling = (e) => {
  e.stopPropagation();
};

const stopInputKeys = (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') e.preventDefault();
};

function StableNameInput({ value, placeholder, onCommit }) {
  const [local, setLocal] = useState(value ?? '');
  useEffect(() => {
    setLocal(value ?? '');
  }, [value]);
  const commit = useCallback(() => {
    onCommit?.(local);
  }, [local, onCommit]);
  return (
    <input
      className={styles.inputDoctor}
      placeholder={placeholder}
      value={local}
      onClick={stopBubbling}
      onKeyDown={(e) => {
        stopInputKeys(e);
        if (e.key === 'Enter') commit();
      }}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
    />
  );
}

function CantidadInputResumen({ itemId, initialValue, onChange }) {
  const [localValue, setLocalValue] = useState(fmtQtyInput(initialValue));
  useEffect(() => {
    setLocalValue(fmtQtyInput(initialValue));
  }, [initialValue]);
  const handleBlur = () => {
    const parsed = clampDecimalQty(localValue);
    onChange(itemId, parsed);
  };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };
  return (
    <input
      className={`${styles.inputCantidad} ${styles.inputCantidadDecimal}`}
      type="text"
      inputMode="decimal"
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={stopBubbling}
      placeholder="1"
    />
  );
}

export default function ResumenFactura({
  paciente,
  practicas,
  cirugias,
  laboratorios,
  medicamentos,
  descartables,
  actualizarCantidad,
  actualizarItem,
  eliminarItem,
  limpiarFactura,
  onAtras
}) {
  // Para la vista normal (pantalla) mantenemos los acordeones, pero para impresión se ignora
  const [open, setOpen] = useState({
    practicas: true,
    practHon: true,
    practGas: true,
    cirugias: true,
    labs: true,
    medDesc: true,
    med: true,
    desc: true
  });

  // Los totales monetarios se calculan con money (2 decimales), pero sumamos con parseNumber
  const totalSeccion = (items) =>
    items.reduce((acc, it) => acc + (parseNumber(it?.total) || 0), 0);

  const totales = useMemo(() => {
    const all = [...practicas, ...cirugias, ...laboratorios, ...medicamentos, ...descartables];
    const honor = all.reduce((acc, it) => acc + (parseNumber(it?.honorarioMedico) || 0), 0);
    const gasto = all.reduce((acc, it) => acc + (parseNumber(it?.gastoSanatorial) || 0), 0);
    return { honor, gasto, total: honor + gasto };
  }, [practicas, cirugias, laboratorios, medicamentos, descartables]);

  // Separación prácticas como antes
  const practicasHonorarios = useMemo(
    () => practicas.filter((p) => String(p?.prestadorTipo) === 'Dr'),
    [practicas]
  );
  const practicasGastos = useMemo(
    () => practicas.filter((p) => String(p?.prestadorTipo) !== 'Dr'),
    [practicas]
  );

  // Para impresión, vamos a generar las secciones planas
  // Datos del paciente
  const pacienteData = {
    nombre: paciente?.nombreCompleto || '—',
    dni: paciente?.dni || '—',
    art: paciente?.artSeguro || '—',
    siniestro: paciente?.nroSiniestro || '—',
    fecha: paciente?.fechaAtencion || '—'
  };

  // Función para renderizar una tabla genérica para honorarios (Dr)
  const renderTablaHonorarios = (items, tipo) => {
    if (items.length === 0) return null;
    return (
      <div className={styles.printSection}>
        <h4>{tipo}</h4>
        <table className={styles.printTable}>
          <thead>
            <tr>
              <th>Dr</th>
              <th>Código</th>
              <th>Práctica</th>
              <th>Cantidad</th>
              <th>Valor unitario</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cantidad = clampDecimalQty(item.cantidad);
              const total = parseNumber(item.honorarioMedico);
              const unitario = total / cantidad;
              return (
                <tr key={item.id}>
                  <td>{item.prestadorNombre || '—'}</td>
                  <td>{item.codigo || '—'}</td>
                  <td>{item.descripcion || item.nombre || '—'}</td>
                  <td className={styles.printNumber}>{fmtQtyInput(cantidad)}</td>
                  <td className={styles.printNumber}>$ {money(unitario)}</td>
                  <td className={styles.printNumber}>$ {money(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Función para gastos de clínica (CdU)
  const renderTablaGastosClinica = (items, tipo) => {
    if (items.length === 0) return null;
    return (
      <div className={styles.printSection}>
        <h4>{tipo}</h4>
        <table className={styles.printTable}>
          <thead>
            <tr>
              <th>CdU</th>
              <th>Código</th>
              <th>Práctica</th>
              <th>Cantidad</th>
              <th>Valor unitario</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cantidad = clampDecimalQty(item.cantidad);
              const total = parseNumber(item.gastoSanatorial);
              const unitario = total / cantidad;
              return (
                <tr key={item.id}>
                  <td>{item.prestadorNombre || 'Clínica de la Unión'}</td>
                  <td>{item.codigo || '—'}</td>
                  <td>{item.descripcion || item.nombre || '—'}</td>
                  <td className={styles.printNumber}>{fmtQtyInput(cantidad)}</td>
                  <td className={styles.printNumber}>$ {money(unitario)}</td>
                  <td className={styles.printNumber}>$ {money(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Para medicamentos y descartables (sin código, solo descripción)
  const renderTablaMedicamentos = (items, tipo) => {
    if (items.length === 0) return null;
    return (
      <div className={styles.printSection}>
        <h4>{tipo}</h4>
        <table className={styles.printTable}>
          <thead>
            <tr>
              <th>Descripción</th>
              <th>Cantidad</th>
              <th>Valor unitario</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cantidad = clampDecimalQty(item.cantidad);
              const unitario = parseNumber(item.valorUnitario);
              const total = parseNumber(item.total);
              return (
                <tr key={item.id}>
                  <td>{item.nombre} ({item.presentacion})</td>
                  <td className={styles.printNumber}>{fmtQtyInput(cantidad)}</td>
                  <td className={styles.printNumber}>$ {money(unitario)}</td>
                  <td className={styles.printNumber}>$ {money(total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Renderizado de cantidad con decimales y prevención de scroll (para pantalla)
  const renderCantidad = (item) => {
    const cur = clampDecimalQty(item?.cantidad);
    const step = cur < 1 ? 0.1 : 1;
    const itemId = item.id;
    return (
      <div className={styles.contadorCantidad} onClick={stopBubbling}>
        <button
          type="button"
          className={styles.btnCantidad}
          onClick={() => {
            const newVal = to1Decimal(Math.max(0.01, cur - step));
            actualizarCantidad(itemId, newVal);
          }}
          title="Restar"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          −
        </button>
        <CantidadInputResumen
          itemId={itemId}
          initialValue={cur}
          onChange={actualizarCantidad}
        />
        <button
          type="button"
          className={styles.btnCantidad}
          onClick={() => {
            const newVal = to1Decimal(cur + step);
            actualizarCantidad(itemId, newVal);
          }}
          title="Sumar"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
        >
          +
        </button>
      </div>
    );
  };

  const renderValorStack = (item) => (
    <div className={styles.valorStack}>
      <div className={styles.valorLine}>
        <span className={styles.valorLabel}>Hon</span>
        <span className={styles.valorNumber}>{money(item?.honorarioMedico ?? 0)}</span>
      </div>
      <div className={styles.valorLine}>
        <span className={styles.valorLabel}>Gto</span>
        <span className={styles.valorNumber}>{money(item?.gastoSanatorial ?? 0)}</span>
      </div>
      <div className={`${styles.valorLine} ${styles.valorLineTotal}`}>
        <span className={styles.valorLabel}>Total</span>
        <span className={styles.valorNumber}>{money(item?.total ?? 0)}</span>
      </div>
      {item?.formula && <div className={styles.formulaPequeña}>{item.formula}</div>}
    </div>
  );

  const Acordeon = ({ k, title, count, amount, children }) => (
    <section className={styles.acSection}>
      <button
        type="button"
        className={styles.acHeader}
        onClick={() => setOpen((p) => ({ ...p, [k]: !p[k] }))}
      >
        <div className={styles.acTitle}>{title}</div>
        <div className={styles.acRight}>
          <span className={styles.acCount}>{count}</span>
          <span className={styles.acAmount}>$ {money(amount)}</span>
          <span className={`${styles.acChevron} ${open[k] ? styles.acChevronOpen : ''}`}>⌄</span>
        </div>
      </button>
      {open[k] && <div className={styles.acBody}>{children}</div>}
    </section>
  );

  const SubAcordeon = ({ k, title, count, amount, children }) => (
    <div className={styles.subAcc}>
      <button
        type="button"
        className={styles.subAccHeader}
        onClick={() => setOpen((p) => ({ ...p, [k]: !p[k] }))}
      >
        <div className={styles.subAccTitle}>{title}</div>
        <div className={styles.subAccRight}>
          <span className={styles.acCount}>{count}</span>
          <span className={styles.acAmount}>$ {money(amount)}</span>
          <span className={`${styles.acChevron} ${open[k] ? styles.acChevronOpen : ''}`}>⌄</span>
        </div>
      </button>
      {open[k] && <div className={styles.subAccBody}>{children}</div>}
    </div>
  );

  const TablaPracticas = ({ items, mostrarInputDoctor }) => (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.thCode}>Código</th>
            <th className={styles.thDesc}>Descripción</th>
            <th className={styles.thQty}>Cantidad</th>
            <th className={styles.thNum}>Valor</th>
            <th className={styles.thAction}>Acc.</th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} className={p?.esRX ? styles.rxRow : ''}>
              <td className={styles.columnaCodigo}>
                <strong>{p.codigo}</strong>
                {p?.esRX && <span className={styles.badgeRx}>RX</span>}
              </td>
              <td className={styles.columnaDescripcion}>
                <div className={styles.descPrincipal}>{p.descripcion}</div>
                <div className={styles.subMeta}>
                  <span className={styles.metaPill}>{p.prestadorTipo || '—'}</span>
                  <span className={styles.metaText}>
                    {p.capitulo} – {p.capituloNombre}
                  </span>
                </div>
                {mostrarInputDoctor && (
                  <div className={styles.doctorRow}>
                    <StableNameInput
                      value={p?.prestadorNombre ?? ''}
                      placeholder="Dr que realiza…"
                      onCommit={(val) => actualizarItem(p.id, { prestadorNombre: val })}
                    />
                  </div>
                )}
              </td>
              <td className={styles.columnaCantidad}>{renderCantidad(p)}</td>
              <td className={styles.columnaValor}>{renderValorStack(p)}</td>
              <td className={styles.columnaAcciones}>
                <button type="button" className={styles.btnEliminar} onClick={() => eliminarItem(p.id)} title="Eliminar">
                  🗑️
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={styles.tabContent}>
      <h2>📋 Resumen</h2>

      {/* Vista para pantalla (con acordeones) */}
      <div className={styles.screenView}>
        <div className={styles.infoResumen}>
          <div className={styles.infoPaciente}>
            <h3>👤 Paciente</h3>
            <p><b>Nombre:</b> {paciente?.nombreCompleto || '—'}</p>
            <p><b>DNI:</b> {paciente?.dni || '—'}</p>
            <p><b>Fecha:</b> {paciente?.fechaAtencion || '—'}</p>
            <p><b>ART/Seguro:</b> {paciente?.artSeguro || '—'}</p>
            <p><b>Siniestro:</b> {paciente?.nroSiniestro || '—'}</p>
          </div>
          <div className={styles.infoConvenio}>
            <h3>🧮 Totales</h3>
            <p><b>Honorarios:</b> $ {money(totales.honor)}</p>
            <p><b>Gastos:</b> $ {money(totales.gasto)}</p>
            <p><b>Total:</b> $ {money(totales.total)}</p>
          </div>
        </div>

        {/* PRACTICAS separadas */}
        <Acordeon k="practicas" title="🏥 Prácticas" count={practicas.length} amount={totalSeccion(practicas)}>
          {practicas.length === 0 ? (
            <div className={styles.emptyBlock}>Sin prácticas.</div>
          ) : (
            <>
              <SubAcordeon k="practHon" title="👨‍⚕️ Honorarios (Dr)" count={practicasHonorarios.length} amount={totalSeccion(practicasHonorarios)}>
                {practicasHonorarios.length === 0 ? (
                  <div className={styles.emptyBlock}>No hay honorarios cargados.</div>
                ) : (
                  <TablaPracticas items={practicasHonorarios} mostrarInputDoctor={true} />
                )}
              </SubAcordeon>
              <SubAcordeon k="practGas" title="🏥 Gastos (Clínica)" count={practicasGastos.length} amount={totalSeccion(practicasGastos)}>
                {practicasGastos.length === 0 ? (
                  <div className={styles.emptyBlock}>No hay gastos cargados.</div>
                ) : (
                  <TablaPracticas items={practicasGastos} mostrarInputDoctor={false} />
                )}
              </SubAcordeon>
            </>
          )}
        </Acordeon>

        {/* CIRUGIAS con input Dr */}
        <Acordeon k="cirugias" title="🩺 Cirugías" count={cirugias.length} amount={totalSeccion(cirugias)}>
          {cirugias.length === 0 ? (
            <div className={styles.emptyBlock}>Sin cirugías.</div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thCode}>Código</th>
                    <th className={styles.thDesc}>Descripción</th>
                    <th className={styles.thQty}>Cantidad</th>
                    <th className={styles.thNum}>Valor</th>
                    <th className={styles.thAction}>Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {cirugias.map((c) => (
                    <tr key={c.id}>
                      <td className={styles.columnaCodigo}><strong>{c.codigo || '—'}</strong></td>
                      <td className={styles.columnaDescripcion}>
                        <div className={styles.descPrincipal}>{c.descripcion || c.nombre || 'Cirugía'}</div>
                        <div className={styles.doctorRow}>
                          <StableNameInput
                            value={c?.prestadorNombre ?? ''}
                            placeholder="Dr que realiza…"
                            onCommit={(val) => actualizarItem(c.id, { prestadorNombre: val })}
                          />
                        </div>
                      </td>
                      <td className={styles.columnaCantidad}>{renderCantidad(c)}</td>
                      <td className={styles.columnaValor}>{renderValorStack(c)}</td>
                      <td className={styles.columnaAcciones}>
                        <button type="button" className={styles.btnEliminar} onClick={() => eliminarItem(c.id)} title="Eliminar">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Acordeon>

        {/* LABS con input Bioquímico por estudio */}
        <Acordeon k="labs" title="🧪 Laboratorios" count={laboratorios.length} amount={totalSeccion(laboratorios)}>
          {laboratorios.length === 0 ? (
            <div className={styles.emptyBlock}>Sin laboratorios.</div>
          ) : (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.thCode}>Código</th>
                    <th className={styles.thDesc}>Descripción</th>
                    <th className={styles.thQty}>Cantidad</th>
                    <th className={styles.thNum}>Total</th>
                    <th className={styles.thAction}>Acc.</th>
                  </tr>
                </thead>
                <tbody>
                  {laboratorios.map((l) => (
                    <tr key={l.id}>
                      <td className={styles.columnaCodigo}><strong>{l.codigo || '—'}</strong></td>
                      <td className={styles.columnaDescripcion}>
                        <div className={styles.descPrincipal}>{l.descripcion || l.nombre || 'Laboratorio'}</div>
                        <div className={styles.doctorRow}>
                          <StableNameInput
                            value={l?.prestadorNombre ?? ''}
                            placeholder="Bioquímico/a…"
                            onCommit={(val) => actualizarItem(l.id, { prestadorNombre: val })}
                          />
                        </div>
                      </td>
                      <td className={styles.columnaCantidad}>{renderCantidad(l)}</td>
                      <td className={styles.columnaValor}>
                        <div className={styles.valorStack}>
                          <div className={`${styles.valorLine} ${styles.valorLineTotal}`}>
                            <span className={styles.valorLabel}>Total</span>
                            <span className={styles.valorNumber}>{money(l.total)}</span>
                          </div>
                          {l?.formula && <div className={styles.formulaPequeña}>{l.formula}</div>}
                        </div>
                      </td>
                      <td className={styles.columnaAcciones}>
                        <button type="button" className={styles.btnEliminar} onClick={() => eliminarItem(l.id)} title="Eliminar">
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Acordeon>

        {/* MED + DESC agrupados */}
        <Acordeon
          k="medDesc"
          title="💊 Medicación + 🧷 Descartables"
          count={medicamentos.length + descartables.length}
          amount={totalSeccion(medicamentos) + totalSeccion(descartables)}
        >
          <SubAcordeon k="med" title="💊 Medicación" count={medicamentos.length} amount={totalSeccion(medicamentos)}>
            {medicamentos.length === 0 ? (
              <div className={styles.emptyBlock}>Sin medicación.</div>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.thDesc}>Descripción</th>
                      <th className={styles.thQty}>Cantidad</th>
                      <th className={styles.thUnit}>Unidad</th>
                      <th className={styles.thNum}>Total</th>
                      <th className={styles.thAction}>Acc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medicamentos.map((m) => (
                      <tr key={m.id}>
                        <td className={styles.columnaDescripcion}>
                          <div className={styles.descPrincipal}><strong>{m.nombre}</strong></div>
                          <div className={styles.metaText}>{m.presentacion}</div>
                        </td>
                        <td className={styles.columnaCantidad}>{renderCantidad(m)}</td>
                        <td className={styles.columnaUnidad}>$ {money(m.valorUnitario)}</td>
                        <td className={styles.columnaValor}>
                          <div className={styles.valorStack}>
                            <div className={`${styles.valorLine} ${styles.valorLineTotal}`}>
                              <span className={styles.valorLabel}>Total</span>
                              <span className={styles.valorNumber}>{money(m.total)}</span>
                            </div>
                          </div>
                        </td>
                        <td className={styles.columnaAcciones}>
                          <button type="button" className={styles.btnEliminar} onClick={() => eliminarItem(m.id)} title="Eliminar">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SubAcordeon>
          <SubAcordeon k="desc" title="🧷 Descartables" count={descartables.length} amount={totalSeccion(descartables)}>
            {descartables.length === 0 ? (
              <div className={styles.emptyBlock}>Sin descartables.</div>
            ) : (
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.thDesc}>Descripción</th>
                      <th className={styles.thQty}>Cantidad</th>
                      <th className={styles.thUnit}>Unidad</th>
                      <th className={styles.thNum}>Total</th>
                      <th className={styles.thAction}>Acc.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {descartables.map((d) => (
                      <tr key={d.id}>
                        <td className={styles.columnaDescripcion}>
                          <div className={styles.descPrincipal}><strong>{d.nombre}</strong></div>
                          <div className={styles.metaText}>{d.presentacion}</div>
                        </td>
                        <td className={styles.columnaCantidad}>{renderCantidad(d)}</td>
                        <td className={styles.columnaUnidad}>$ {money(d.valorUnitario)}</td>
                        <td className={styles.columnaValor}>
                          <div className={styles.valorStack}>
                            <div className={`${styles.valorLine} ${styles.valorLineTotal}`}>
                              <span className={styles.valorLabel}>Total</span>
                              <span className={styles.valorNumber}>{money(d.total)}</span>
                            </div>
                          </div>
                        </td>
                        <td className={styles.columnaAcciones}>
                          <button type="button" className={styles.btnEliminar} onClick={() => eliminarItem(d.id)} title="Eliminar">
                            🗑️
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SubAcordeon>
        </Acordeon>

        <div className={styles.botonesResumen}>
          <div className={styles.botonesIzquierda}>
            <button type="button" className={styles.btnAtras} onClick={onAtras}>← Atrás</button>
          </div>
          <div className={styles.botonesDerecha}>
            <button type="button" className={styles.btnLimpiar} onClick={limpiarFactura}>🗑️ Limpiar factura</button>
          </div>
        </div>
      </div>

      {/* Vista para impresión (oculta en pantalla, se muestra al imprimir) */}
      <div className={styles.printView}>
        <div className={styles.printHeader}>
          <h1>Resumen de Facturación</h1>
          <div className={styles.printPaciente}>
            <p><strong>Paciente:</strong> {pacienteData.nombre} - DNI: {pacienteData.dni}</p>
            <p><strong>ART/Seguro:</strong> {pacienteData.art} - Siniestro: {pacienteData.siniestro}</p>
            <p><strong>Fecha de atención:</strong> {pacienteData.fecha}</p>
          </div>
        </div>

        {/* Honorarios Médicos */}
        <div className={styles.printHonorarios}>
          <h3>Honorarios Médicos</h3>
          {renderTablaHonorarios(practicasHonorarios, 'Prácticas')}
          {renderTablaHonorarios(cirugias, 'Cirugías')}
          {renderTablaHonorarios(laboratorios, 'Laboratorio')}
        </div>

        {/* Gastos Sanatoriales */}
        <div className={styles.printGastos}>
          <h3>Gastos Sanatoriales</h3>
          {renderTablaGastosClinica(practicasGastos, 'Gastos Clínica')}
          {renderTablaMedicamentos(medicamentos, 'Medicación')}
          {renderTablaMedicamentos(descartables, 'Descartables')}
        </div>

        {/* Subtotales y Total */}
        <div className={styles.printTotales}>
          <div className={styles.printTotalLine}>
            <span>Subtotal Honorarios:</span>
            <span>$ {money(totales.honor)}</span>
          </div>
          <div className={styles.printTotalLine}>
            <span>Subtotal Gastos:</span>
            <span>$ {money(totales.gasto)}</span>
          </div>
          <div className={`${styles.printTotalLine} ${styles.printTotalFinal}`}>
            <span>TOTAL:</span>
            <span>$ {money(totales.total)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
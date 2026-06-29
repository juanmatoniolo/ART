import { useMemo, useState, useEffect } from 'react';
import { money, parseNumber } from '../utils/calculos';
import styles from './resumenFactura.module.css';
import * as XLSX from 'xlsx';
import useDoctors from '../../medicos/hooks/useDoctors';

const to1Decimal = (n) => {
  const num = parseNumber(n);
  return Number.isFinite(num) ? Math.round(num * 10) / 10 : 0;
};

const clampDecimalQty = (v) => {
  const n = parseNumber(v);
  if (!Number.isFinite(n) || n <= 0) return 1;
  return to1Decimal(n);
};

const fmtQtyInput = (v) => {
  const n = parseNumber(v);
  if (!Number.isFinite(n)) return '1';
  const rounded = to1Decimal(n);
  const withDecimal = rounded.toFixed(1).replace('.', ',');
  return withDecimal.replace(/,0$/, '');
};

const stopBubbling = (e) => e.stopPropagation();

const getRolLabel = (item) => {
  if (item?.prestadorRol === 'Ayudante 2' && item?.ayudanteIndex) {
    return `Ayudante 2 (${item.ayudanteIndex})`;
  }
  return item?.prestadorRol || 'Profesional';
};

const getArtroscopiaLabel = (item) => {
  if (item?.codigo !== '120902') return null;
  const tipo = item?.tipoArtroscopia;
  if (tipo === 'simple') return '🔹 Simple';
  if (tipo === 'ligamento') return '🔸 Ligamento cruzado';
  if (tipo === 'hombro') return '🔸 Hombro';
  return null;
};

// ─── DoctorSelect ─────────────────────────────────────────────────────────────
const DoctorSelect = ({ value, onChange, placeholder, roleLabel }) => {
  const { doctors } = useDoctors();
  const [inputValue, setInputValue] = useState(value || '');
  const [datalistId] = useState(
    () => `doctor-list-${Math.random().toString(36).slice(2, 11)}`
  );

  useEffect(() => { setInputValue(value || ''); }, [value]);

  const resolveDoctor = (text) => {
    const trimmed = text.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const idx = parseInt(trimmed, 10) - 1;
      if (idx >= 0 && idx < doctors.length) return doctors[idx];
    }
    const lower = trimmed.toLowerCase();
    return doctors.find((doc) =>
      `${doc.apellido} ${doc.nombre}`.toLowerCase().includes(lower) ||
      `${doc.nombre} ${doc.apellido}`.toLowerCase().includes(lower)
    );
  };

  const commitValue = (currentText) => {
    const matched = resolveDoctor(currentText);
    const finalValue = matched
      ? `${matched.apellido || ''}, ${matched.nombre || ''}`.trim()
      : currentText;
    setInputValue(finalValue);
    onChange(finalValue);
    return finalValue;
  };

  const handleBlur = () => commitValue(inputValue);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitValue(inputValue);
      const all = Array.from(document.querySelectorAll('[data-doctorinput]'));
      const idx = all.indexOf(e.currentTarget);
      if (idx >= 0 && idx + 1 < all.length) all[idx + 1].focus();
    }
  };

  const formatDoctorName = (doc, index) => {
    const apellido = doc?.apellido || '';
    const nombre = doc?.nombre || '';
    const nombreTruncado = nombre.length > 12 ? `${nombre.slice(0, 12)}…` : nombre;
    return `${index + 1} - ${apellido}, ${nombreTruncado}`;
  };

  return (
    <div className={styles.doctorSelectContainer} onClick={stopBubbling} onMouseDown={stopBubbling}>
      <input
        list={datalistId}
        className={styles.doctorInput}
        placeholder={placeholder}
        value={inputValue}
        autoComplete="off"
        tabIndex={0}
        data-doctorinput="true"
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={stopBubbling}
        onMouseDown={stopBubbling}
      />
      <datalist id={datalistId}>
        {doctors.map((doc, idx) => (
          <option key={doc.id} value={`${doc.apellido || ''}, ${doc.nombre || ''}`.trim()}>
            {formatDoctorName(doc, idx)}
          </option>
        ))}
      </datalist>
      <button
        type="button"
        className={styles.addDoctorBtn}
        onClick={() => window.open('/admin/medicos/nuevo', '_blank', 'noopener,noreferrer')}
        title={`Agregar nuevo médico${roleLabel ? ` (${roleLabel})` : ''}`}
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
      >
        ➕
      </button>
    </div>
  );
};

// ─── CantidadInputResumen ─────────────────────────────────────────────────────
function CantidadInputResumen({ itemId, initialValue, onChange }) {
  const [localValue, setLocalValue] = useState(fmtQtyInput(initialValue));

  useEffect(() => { setLocalValue(fmtQtyInput(initialValue)); }, [initialValue]);

  const handleBlur = () => {
    const parsed = clampDecimalQty(localValue);
    onChange(itemId, parsed);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); }
  };

  return (
    <input
      className={`${styles.inputCantidad} ${styles.inputCantidadDecimal}`}
      type="text"
      inputMode="decimal"
      tabIndex={0}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onClick={stopBubbling}
      placeholder="1"
    />
  );
}

// ─── CantidadControl ──────────────────────────────────────────────────────────
function CantidadControl({ item, onUpdate }) {
  const cur = clampDecimalQty(item?.cantidad);
  const step = cur < 1 ? 0.1 : 1;
  const itemId = item.id;
  return (
    <div className={styles.contadorCantidad} onClick={stopBubbling}>
      <button
        type="button"
        className={styles.btnCantidad}
        onClick={() => onUpdate(itemId, to1Decimal(Math.max(0.01, cur - step)))}
        title="Restar"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
      >−</button>
      <CantidadInputResumen itemId={itemId} initialValue={cur} onChange={onUpdate} />
      <button
        type="button"
        className={styles.btnCantidad}
        onClick={() => onUpdate(itemId, to1Decimal(cur + step))}
        title="Sumar"
        tabIndex={-1}
        onMouseDown={(e) => e.preventDefault()}
      >+</button>
    </div>
  );
}

// ─── ValorStack ───────────────────────────────────────────────────────────────
function ValorStack({ item }) {
  return (
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
      {item?.prestadorRol && (
        <div className={styles.rolePill}>{getRolLabel(item)}</div>
      )}
      {item?.formula && (
        <div className={styles.formulaPequeña}>{item.formula}</div>
      )}
    </div>
  );
}

// ─── Acordeon ─────────────────────────────────────────────────────────────────
function Acordeon({ k, title, count, amount, children, open, setOpen }) {
  return (
    <section className={styles.acSection}>
      <button
        type="button"
        tabIndex={-1}
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
}

// ─── SubAcordeon ──────────────────────────────────────────────────────────────
function SubAcordeon({ k, title, count, amount, children, open, setOpen }) {
  return (
    <div className={styles.subAcc}>
      <button
        type="button"
        tabIndex={-1}
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
}

// ─── TablaPracticas ───────────────────────────────────────────────────────────
function TablaPracticas({ items, mostrarInputDoctor, onUpdateItem, onUpdateQty, onDelete }) {
  return (
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
          {items.map((p) => {
            const artroLabel = getArtroscopiaLabel(p);
            return (
              <tr key={p.id} className={p?.esRX ? styles.rxRow : ''}>
                <td className={styles.columnaCodigo}>
                  <strong>{p.codigo}</strong>
                  {p?.esRX && <span className={styles.badgeRx}>RX</span>}
                </td>
                <td className={styles.columnaDescripcion}>
                  <div className={styles.descPrincipal}>
                    {p.descripcion}
                    {artroLabel && <span className={styles.artroBadge}> {artroLabel}</span>}
                  </div>
                  <div className={styles.subMeta}>
                    <span className={styles.metaPill}>{p.prestadorTipo || '—'}</span>
                    <span className={styles.metaText}>{p.capitulo} – {p.capituloNombre}</span>
                  </div>
                  {mostrarInputDoctor && (
                    <div className={styles.doctorRow}>
                      <DoctorSelect
                        value={p?.prestadorNombre ?? ''}
                        placeholder="Dr que realiza…"
                        roleLabel={getRolLabel(p)}
                        onChange={(val) => onUpdateItem(p.id, { prestadorNombre: val })}
                      />
                    </div>
                  )}
                </td>
                <td className={styles.columnaCantidad}>
                  <CantidadControl item={p} onUpdate={onUpdateQty} />
                </td>
                <td className={styles.columnaValor}><ValorStack item={p} /></td>
                <td className={styles.columnaAcciones}>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={styles.btnEliminar}
                    onClick={() => onDelete(p.id)}
                    title="Eliminar"
                  >🗑️</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── ResumenFactura ───────────────────────────────────────────────────────────
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
  onAtras,
}) {
  const [open, setOpen] = useState({
    practicas: true,
    practHon: true,
    practGas: true,
    cirugias: true,
    labs: true,
    medDesc: true,
    med: true,
    desc: true,
  });

  const totalSeccion = (items) =>
    items.reduce((acc, it) => acc + (parseNumber(it?.total) || 0), 0);

  const totales = useMemo(() => {
    const all = [...practicas, ...cirugias, ...laboratorios, ...medicamentos, ...descartables];
    const honor = all.reduce((acc, it) => acc + (parseNumber(it?.honorarioMedico) || 0), 0);
    const gasto = all.reduce((acc, it) => acc + (parseNumber(it?.gastoSanatorial) || 0), 0);
    return { honor, gasto, total: honor + gasto };
  }, [practicas, cirugias, laboratorios, medicamentos, descartables]);

  const practicasHonorarios = useMemo(
    () => practicas.filter((p) => String(p?.prestadorTipo) === 'Dr'),
    [practicas]
  );
  const practicasGastos = useMemo(
    () => practicas.filter((p) => String(p?.prestadorTipo) !== 'Dr'),
    [practicas]
  );

  const totalPracticasHonorarios = useMemo(() => totalSeccion(practicasHonorarios), [practicasHonorarios]);
  const totalPracticasGastos = useMemo(() => totalSeccion(practicasGastos), [practicasGastos]);
  const totalCirugias = useMemo(() => totalSeccion(cirugias), [cirugias]);
  const totalLaboratorios = useMemo(() => totalSeccion(laboratorios), [laboratorios]);
  const totalMedicamentos = useMemo(() => totalSeccion(medicamentos), [medicamentos]);
  const totalDescartables = useMemo(() => totalSeccion(descartables), [descartables]);

  const pacienteData = {
    nombre: paciente?.nombreCompleto || '—',
    dni: paciente?.dni || '—',
    art: paciente?.artSeguro || '—',
    siniestro: paciente?.nroSiniestro || '—',
    fecha: paciente?.fechaAtencion || '—',
  };

  // ─── Excel export ────────────────────────────────────────────────────────────
  const exportarDetalle = () => {
    const rows = [];
    rows.push(['RESUMEN DE FACTURACIÓN']);
    rows.push([]);
    rows.push(['Paciente:', pacienteData.nombre]);
    rows.push(['DNI:', pacienteData.dni]);
    rows.push(['ART/Seguro:', pacienteData.art]);
    rows.push(['N° Siniestro:', pacienteData.siniestro]);
    rows.push(['Fecha de atención:', pacienteData.fecha]);
    rows.push([]);
    rows.push(['CATEGORÍA','TIPO','ROL','CÓDIGO','DESCRIPCIÓN','CANTIDAD','VALOR UNITARIO','HONORARIO','GASTO','TOTAL','ORIGEN']);

    const agregarItems = (items, categoria, tipo) => {
      items.forEach((it) => {
        const cantidad = clampDecimalQty(it.cantidad);
        const total = parseNumber(it.total) || 0;
        const unitario = parseNumber(it.valorUnitario) || (cantidad > 0 ? total / cantidad : 0) || 0;
        const honorario = parseNumber(it.honorarioMedico) || 0;
        const gasto = parseNumber(it.gastoSanatorial) || 0;
        const origen = it.prestadorNombre || it.doctorNombre || it.medico || (categoria.includes('Gasto') ? 'Clínica' : '');
        rows.push([categoria, tipo, getRolLabel(it), it.codigo || '', it.descripcion || it.nombre || '', cantidad, unitario, honorario, gasto, total, origen]);
      });
    };

    agregarItems(practicasHonorarios, 'Prácticas - Honorarios', 'Dr');
    agregarItems(practicasGastos, 'Prácticas - Gastos', 'Clínica');
    agregarItems(cirugias, 'Cirugías', 'Dr');
    agregarItems(laboratorios, 'Laboratorios', 'Bioquímico');
    agregarItems(medicamentos, 'Medicación', 'Gasto');
    agregarItems(descartables, 'Descartables', 'Gasto');

    rows.push([]);
    rows.push(['SUBTOTALES POR CATEGORÍA']);
    [
      { nombre: 'Honorarios Médicos', items: [...practicasHonorarios, ...cirugias, ...laboratorios] },
      { nombre: 'Gastos Clínicos (Prácticas)', items: practicasGastos },
      { nombre: 'Laboratorios', items: laboratorios },
      { nombre: 'Medicación', items: medicamentos },
      { nombre: 'Descartables', items: descartables },
    ].forEach((cat) => {
      const totalCat = cat.items.reduce((acc, it) => acc + (parseNumber(it.total) || 0), 0);
      if (totalCat > 0) rows.push([cat.nombre, '', '', '', '', '', '', '', '', money(totalCat)]);
    });

    rows.push([]);
    rows.push(['TOTALES GENERALES']);
    rows.push(['Honorarios:', '', '', '', '', '', '', '', '', money(totales.honor)]);
    rows.push(['Gastos:', '', '', '', '', '', '', '', '', money(totales.gasto)]);
    rows.push(['TOTAL:', '', '', '', '', '', '', '', '', money(totales.total)]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [
      { wch: 24 },{ wch: 15 },{ wch: 15 },{ wch: 12 },{ wch: 40 },
      { wch: 10 },{ wch: 15 },{ wch: 15 },{ wch: 15 },{ wch: 15 },{ wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, 'Detalle Factura');
    XLSX.writeFile(wb, `factura_${pacienteData.nombre}_${pacienteData.dni}.xlsx`);
  };

  // ─── Print helpers ────────────────────────────────────────────────────────────
  const renderTablaHonorarios = (items, tipo) => {
    if (items.length === 0) return null;
    return (
      <div className={styles.printSection}>
        <h4>{tipo}</h4>
        <table className={styles.printTable}>
          <thead>
            <tr><th>Rol</th><th>Dr</th><th>Código</th><th>Práctica</th><th>Cantidad</th><th>Valor unitario</th><th>Total</th></tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cantidad = clampDecimalQty(item.cantidad);
              const total = parseNumber(item.honorarioMedico);
              const unitario = cantidad > 0 ? total / cantidad : total;
              const artroLabel = getArtroscopiaLabel(item);
              return (
                <tr key={item.id}>
                  <td>{getRolLabel(item)}</td>
                  <td>{item.prestadorNombre || '—'}</td>
                  <td>{item.codigo || '—'}{item?.esRX && <span className={styles.badgeRx}>RX</span>}</td>
                  <td>{item.descripcion || item.nombre || '—'}{artroLabel && <span className={styles.artroBadge}> {artroLabel}</span>}</td>
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

  const renderTablaGastosClinica = (items, tipo) => {
    if (items.length === 0) return null;
    return (
      <div className={styles.printSection}>
        <h4>{tipo}</h4>
        <table className={styles.printTable}>
          <thead>
            <tr><th>CdU</th><th>Código</th><th>Práctica</th><th>Cantidad</th><th>Valor unitario</th><th>Total</th></tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cantidad = clampDecimalQty(item.cantidad);
              const total = parseNumber(item.gastoSanatorial);
              const unitario = cantidad > 0 ? total / cantidad : total;
              const artroLabel = getArtroscopiaLabel(item);
              return (
                <tr key={item.id}>
                  <td>{item.prestadorNombre || 'Clínica de la Unión'}</td>
                  <td>{item.codigo || '—'}{item?.esRX && <span className={styles.badgeRx}>RX</span>}</td>
                  <td>{item.descripcion || item.nombre || '—'}{artroLabel && <span className={styles.artroBadge}> {artroLabel}</span>}</td>
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

  const renderTablaMedicamentos = (items, tipo) => {
    if (items.length === 0) return null;
    return (
      <div className={styles.printSection}>
        <h4>{tipo}</h4>
        <table className={styles.printTable}>
          <thead>
            <tr><th>Descripción</th><th>Cantidad</th><th>Valor unitario</th><th>Total</th></tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const cantidad = clampDecimalQty(item.cantidad);
              const unitario = parseNumber(item.valorUnitario);
              const total = parseNumber(item.total);
              return (
                <tr key={item.id}>
                  <td>{item.nombre} {item.presentacion ? `(${item.presentacion})` : ''}</td>
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

  // ─── JSX ──────────────────────────────────────────────────────────────────────
  return (
    <div className={styles.tabContent}>
      <h2>📋 Resumen</h2>

      <div className={styles.screenView}>
        {/* ── Info paciente / totales ──────────────────────────────────────────── */}
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

        {/* ── Prácticas ──────────────────────────────────────────────────────────── */}
        <Acordeon k="practicas" title="🏥 Prácticas" count={practicas.length} amount={totalSeccion(practicas)} open={open} setOpen={setOpen}>
          {practicas.length === 0 ? (
            <div className={styles.emptyBlock}>Sin prácticas.</div>
          ) : (
            <>
              <SubAcordeon k="practHon" title="👨‍⚕️ Honorarios (Dr)" count={practicasHonorarios.length} amount={totalSeccion(practicasHonorarios)} open={open} setOpen={setOpen}>
                {practicasHonorarios.length === 0 ? (
                  <div className={styles.emptyBlock}>No hay honorarios cargados.</div>
                ) : (
                  <TablaPracticas
                    items={practicasHonorarios}
                    mostrarInputDoctor={true}
                    onUpdateItem={actualizarItem}
                    onUpdateQty={actualizarCantidad}
                    onDelete={eliminarItem}
                  />
                )}
              </SubAcordeon>

              <SubAcordeon k="practGas" title="🏥 Gastos (Clínica)" count={practicasGastos.length} amount={totalSeccion(practicasGastos)} open={open} setOpen={setOpen}>
                {practicasGastos.length === 0 ? (
                  <div className={styles.emptyBlock}>No hay gastos cargados.</div>
                ) : (
                  <TablaPracticas
                    items={practicasGastos}
                    mostrarInputDoctor={false}
                    onUpdateItem={actualizarItem}
                    onUpdateQty={actualizarCantidad}
                    onDelete={eliminarItem}
                  />
                )}
              </SubAcordeon>
            </>
          )}
        </Acordeon>

        {/* ── Cirugías ─────────────────────────────────────────────────────────── */}
        <Acordeon k="cirugias" title="🩺 Cirugías" count={cirugias.length} amount={totalSeccion(cirugias)} open={open} setOpen={setOpen}>
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
                  {cirugias.map((c) => {
                    const artroLabel = getArtroscopiaLabel(c);
                    return (
                      <tr key={c.id}>
                        <td className={styles.columnaCodigo}>
                          <strong>{c.codigo || '—'}</strong>
                        </td>
                        <td className={styles.columnaDescripcion}>
                          <div className={styles.descPrincipal}>
                            {c.descripcion || c.nombre || 'Cirugía'}
                            {artroLabel && <span className={styles.artroBadge}> {artroLabel}</span>}
                          </div>
                          <div className={styles.rolesBlock}>
                            <div className={styles.roleItem}>
                              <label className={styles.roleLabel}>{getRolLabel(c)}:</label>
                              <DoctorSelect
                                value={c?.prestadorNombre ?? ''}
                                placeholder={`Dr ${getRolLabel(c).toLowerCase()}...`}
                                roleLabel={getRolLabel(c)}
                                onChange={(val) => actualizarItem(c.id, { prestadorNombre: val })}
                              />
                            </div>
                          </div>
                        </td>
                        <td className={styles.columnaCantidad}>
                          <CantidadControl item={c} onUpdate={actualizarCantidad} />
                        </td>
                        <td className={styles.columnaValor}><ValorStack item={c} /></td>
                        <td className={styles.columnaAcciones}>
                          <button type="button" tabIndex={-1} className={styles.btnEliminar} onClick={() => eliminarItem(c.id)} title="Eliminar">🗑️</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Acordeon>

        {/* ── Laboratorios ──────────────────────────────────────────────────────── */}
        <Acordeon k="labs" title="🧪 Laboratorios" count={laboratorios.length} amount={totalSeccion(laboratorios)} open={open} setOpen={setOpen}>
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
                          <DoctorSelect
                            value={l?.prestadorNombre ?? ''}
                            placeholder="Bioquímico/a…"
                            roleLabel="Bioquímico/a"
                            onChange={(val) => actualizarItem(l.id, { prestadorNombre: val })}
                          />
                        </div>
                      </td>
                      <td className={styles.columnaCantidad}>
                        <CantidadControl item={l} onUpdate={actualizarCantidad} />
                      </td>
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
                        <button type="button" tabIndex={-1} className={styles.btnEliminar} onClick={() => eliminarItem(l.id)}>🗑️</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Acordeon>

        {/* ── Medicación + Descartables ─────────────────────────────────────────── */}
        <Acordeon k="medDesc" title="💊 Medicación + 🧷 Descartables" count={medicamentos.length + descartables.length} amount={totalSeccion(medicamentos) + totalSeccion(descartables)} open={open} setOpen={setOpen}>
          <SubAcordeon k="med" title="💊 Medicación" count={medicamentos.length} amount={totalSeccion(medicamentos)} open={open} setOpen={setOpen}>
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
                        <td className={styles.columnaCantidad}>
                          <CantidadControl item={m} onUpdate={actualizarCantidad} />
                        </td>
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
                          <button type="button" tabIndex={-1} className={styles.btnEliminar} onClick={() => eliminarItem(m.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SubAcordeon>

          <SubAcordeon k="desc" title="🧷 Descartables" count={descartables.length} amount={totalSeccion(descartables)} open={open} setOpen={setOpen}>
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
                        <td className={styles.columnaCantidad}>
                          <CantidadControl item={d} onUpdate={actualizarCantidad} />
                        </td>
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
                          <button type="button" tabIndex={-1} className={styles.btnEliminar} onClick={() => eliminarItem(d.id)}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SubAcordeon>
        </Acordeon>

        {/* ── Botones ───────────────────────────────────────────────────────────── */}
        <div className={styles.botonesResumen}>
          <div className={styles.botonesIzquierda}>
            <button type="button" className={styles.btnAtras} onClick={onAtras}>← Atrás</button>
          </div>
          <div className={styles.botonesDerecha}>
            <button type="button" className={styles.btnDescargar} onClick={exportarDetalle}>📥 Descargar detalle</button>
            <button type="button" className={styles.btnLimpiar} onClick={limpiarFactura}>🗑️ Limpiar factura</button>
          </div>
        </div>
      </div>

      {/* ── Vista de impresión ────────────────────────────────────────────────── */}
      <div className={styles.printView}>
        <div className={styles.printHeader}>
          <h1>Resumen de Facturación</h1>
          <div className={styles.printPaciente}>
            <p><strong>Paciente:</strong> {pacienteData.nombre} - DNI: {pacienteData.dni}</p>
            <p><strong>ART/Seguro:</strong> {pacienteData.art} - Siniestro: {pacienteData.siniestro}</p>
            <p><strong>Fecha de atención:</strong> {pacienteData.fecha}</p>
          </div>
        </div>

        <div className={styles.printHonorarios}>
          <h3>Honorarios Médicos</h3>
          {renderTablaHonorarios(practicasHonorarios, 'Prácticas')}
          {totalPracticasHonorarios > 0 && <div className={styles.printSubtotal}>Subtotal Prácticas: $ {money(totalPracticasHonorarios)}</div>}
          {renderTablaHonorarios(cirugias, 'Cirugías')}
          {totalCirugias > 0 && <div className={styles.printSubtotal}>Subtotal Cirugías: $ {money(totalCirugias)}</div>}
          {renderTablaHonorarios(laboratorios, 'Laboratorio')}
          {totalLaboratorios > 0 && <div className={styles.printSubtotal}>Subtotal Laboratorio: $ {money(totalLaboratorios)}</div>}
        </div>

        <div className={styles.printGastos}>
          <h3>Gastos Sanatoriales</h3>
          {renderTablaGastosClinica(practicasGastos, 'Gastos Clínica')}
          {totalPracticasGastos > 0 && <div className={styles.printSubtotal}>Subtotal Gastos Prácticas: $ {money(totalPracticasGastos)}</div>}
          {renderTablaMedicamentos(medicamentos, 'Medicación')}
          {totalMedicamentos > 0 && <div className={styles.printSubtotal}>Subtotal Medicación: $ {money(totalMedicamentos)}</div>}
          {renderTablaMedicamentos(descartables, 'Descartables')}
          {totalDescartables > 0 && <div className={styles.printSubtotal}>Subtotal Descartables: $ {money(totalDescartables)}</div>}
        </div>

        <div className={styles.printTotales}>
          <div className={styles.printTotalLine}><span>Subtotal Honorarios:</span><span>$ {money(totales.honor)}</span></div>
          <div className={styles.printTotalLine}><span>Subtotal Gastos:</span><span>$ {money(totales.gasto)}</span></div>
          <div className={`${styles.printTotalLine} ${styles.printTotalFinal}`}><span>TOTAL:</span><span>$ {money(totales.total)}</span></div>
        </div>
      </div>
    </div>
  );
}

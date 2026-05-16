'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ref, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, parseNumber } from '../../utils/calculos';
import styles from './facturadoss.module.css';
import { useReactToPrint } from 'react-to-print';

// ─────────────────────────────────────────────────────────────────────────────
//  Función para formatear DNI con puntos (separadores de miles) o CUIL con guiones
// ─────────────────────────────────────────────────────────────────────────────
const formatDNI = (dni) => {
  if (!dni || dni === '—') return '—';
  const digits = String(dni).replace(/\D/g, '');
  if (digits.length === 0) return '—';

  if (digits.length === 7 || digits.length === 8) {
    // DNI: puntos cada 3 desde la derecha
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } else if (digits.length === 11) {
    // CUIL: XX-XX.XXX.XXX-X
    const part1 = digits.slice(0, 2);
    const part2 = digits.slice(2, 4);
    const part3 = digits.slice(4, 7);
    const part4 = digits.slice(7, 10);
    const check = digits.slice(10, 11);
    return `${part1}-${part2}.${part3}.${part4}-${check}`;
  } else {
    // Cualquier otra longitud: devolver el número original sin formato
    return dni;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Funciones auxiliares
// ─────────────────────────────────────────────────────────────────────────────
const fmtDate = (ms) => {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleString('es-AR');
  } catch {
    return '—';
  }
};

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : parseNumber(v);
  return Number.isFinite(n) ? n : 0;
};

function csvEscape(s) {
  const str = String(s ?? '');
  const needsQuotes = /[;"\n\r]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
}

function buildCsv({ paciente, estado, item, honorRows, gastoRows }) {
  return '';
}

function ShortText({ text, max = 30 }) {
  const [open, setOpen] = useState(false);
  const str = String(text ?? '');
  const isLong = str.length > max;

  if (!isLong) return <span>{str || '—'}</span>;

  return (
    <span className={styles.shortWrap}>
      <span className={styles.shortText}>{open ? str : `${str.slice(0, max)}…`}</span>
      <button type="button" className={styles.moreBtn} onClick={() => setOpen((v) => !v)}>
        {open ? 'ver menos' : 'ver más'}
      </button>
    </span>
  );
}

const truncate = (str, max = 40) => {
  if (!str) return '—';
  const s = String(str);
  return s.length > max ? s.slice(0, max) + '…' : s;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Vista en pantalla (ScreenView) – con DNI formateado
// ─────────────────────────────────────────────────────────────────────────────
function ScreenView({
  paciente,
  honorPracticas,
  honorCirugias,
  honorLaboratorios,
  gastoPracticas,
  gastoMedicamentos,
  gastoDescartables,
  totalHonor,
  totalGasto,
  totalFactura,
  id,
  estado,
  convenio,
  onPrint,
  onDownloadCsv,
  onPrintMedDescLab,
}) {
  const renderTable = (items, columns) => {
    if (items.length === 0) return <div className={styles.emptySmall}>Sin datos.</div>;
    return (
      <div className={styles.tableWrap}>
        <table className={styles.plainTable}>
          <thead>
            <tr>
              {columns.map((col, idx) => (
                <th key={idx} className={col.className || ''}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx}>
                {columns.map((col, colIdx) => {
                  let content = item[col.field];
                  if (col.field === 'desc') content = <ShortText text={content} max={45} />;
                  else if (col.field === 'total' || col.field === 'unit') content = `$ ${money(item[col.field])}`;
                  else if (col.field === 'unidades') content = item.unidades;
                  return <td key={colIdx} className={col.className || ''}>{content || '—'}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const honorColumns = [
    { label: 'Código - Práctica', field: 'desc' },
    { label: 'Dr', field: 'origen' },
    { label: 'Cant.', field: 'unidades', className: styles.num },
    { label: 'Valor unit.', field: 'unit', className: styles.num },
    { label: 'Total', field: 'total', className: styles.numStrong }
  ];

  const gastoPracticasColumns = [
    { label: 'Código - Práctica', field: 'desc' },
    { label: 'CdU', field: 'origen' },
    { label: 'Cant.', field: 'unidades', className: styles.num },
    { label: 'Valor unit.', field: 'unit', className: styles.num },
    { label: 'Total', field: 'total', className: styles.numStrong }
  ];

  const medDescColumns = [
    { label: 'Descripción', field: 'desc' },
    { label: 'Cant.', field: 'unidades', className: styles.num },
    { label: 'Valor unit.', field: 'unit', className: styles.num },
    { label: 'Total', field: 'total', className: styles.numStrong }
  ];

  const dniFormateado = formatDNI(paciente?.dni);

  return (
    <>
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title}>
              {estado === 'cerrado' ? '✅ Factura cerrada' : '💾 Borrador'}
            </h1>
            <p className={styles.subtitle}>
              ID: <b>{id}</b> • Convenio: <b>{convenio || '—'}</b>
            </p>
          </div>
          <div className={styles.headerActions}>
            <Link className={styles.btnGhost} href="/admin/Facturacion/Facturados">← Volver</Link>
            <Link className={styles.btnPrimary} href={`/admin/Facturacion/Nuevo?draft=${id}`}>
              ✏️ Editar
            </Link>
            <button className={styles.btn} onClick={onPrint}>🖨️ Imprimir todo</button>
            <button className={styles.btn} onClick={onPrintMedDescLab}>📋 Med+Desc+Lab</button>
          </div>
        </div>
      </header>

      <div className={styles.patientLine}>
        <span><b>Nombre completo:</b> {paciente?.nombreCompleto || paciente?.nombre || '—'}</span>
        <span><b>DNI:</b> {dniFormateado}</span>
        <span><b>ART:</b> {paciente?.artSeguro || '—'}</span>
        <span><b>Siniestro:</b> {paciente?.nroSiniestro || '—'}</span>
      </div>

      {/* Honorarios Médicos */}
      <section className={styles.plainSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>HONORARIOS MÉDICOS</h3>
          <div className={styles.sectionSubtotal}>Subtotal: $ {money(totalHonor)}</div>
        </div>
        {honorPracticas.length > 0 && (
          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>Prácticas</h4>
            {renderTable(honorPracticas, honorColumns)}
          </div>
        )}
        {honorCirugias.length > 0 && (
          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>CX</h4>
            {renderTable(honorCirugias, honorColumns)}
          </div>
        )}
        {honorLaboratorios.length > 0 && (
          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>Laboratorio</h4>
            {renderTable(honorLaboratorios, honorColumns)}
          </div>
        )}
        {honorPracticas.length === 0 && honorCirugias.length === 0 && honorLaboratorios.length === 0 && (
          <div className={styles.emptySmall}>Sin honorarios médicos.</div>
        )}
      </section>

      {/* Gastos Clínicos */}
      <section className={styles.plainSection}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>GASTOS CLÍNICOS</h3>
          <div className={styles.sectionSubtotal}>Subtotal: $ {money(totalGasto)}</div>
        </div>
        {gastoPracticas.length > 0 && (
          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>Prácticas</h4>
            {renderTable(gastoPracticas, gastoPracticasColumns)}
          </div>
        )}
        {gastoMedicamentos.length > 0 && (
          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>Medicación</h4>
            {renderTable(gastoMedicamentos, medDescColumns)}
          </div>
        )}
        {gastoDescartables.length > 0 && (
          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>Descartables</h4>
            {renderTable(gastoDescartables, medDescColumns)}
          </div>
        )}
        {gastoPracticas.length === 0 && gastoMedicamentos.length === 0 && gastoDescartables.length === 0 && (
          <div className={styles.emptySmall}>Sin gastos clínicos.</div>
        )}
      </section>

      <div className={styles.totalBar}>
        <div className={styles.totalLabelBig}>TOTAL FACTURA</div>
        <div className={styles.totalValueBig}>$ {money(totalFactura)}</div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
//  Vista de impresión (PrintView) – DNI formateado y SIN firma
// ─────────────────────────────────────────────────────────────────────────────
const PrintView = React.forwardRef(({
  paciente,
  honorPracticas,
  honorCirugias,
  honorLaboratorios,
  gastoPracticas,
  gastoMedicamentos,
  gastoDescartables,
  totalHonor,
  totalGasto,
  totalFactura,
  subtotalHonorPracticas,
  subtotalHonorCirugias,
  subtotalHonorLaboratorios,
  subtotalGastoPracticas,
  subtotalGastoMedicamentos,
  subtotalGastoDescartables,
  artNombre,
}, ref) => {
  const getArtImage = (artName) => {
    if (!artName || artName === 'SIN ART') return '/img-art/default.webp';
    const normalizeForMap = (str) => str
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^\w\s]/g, '')
      .trim();
    const key = normalizeForMap(artName);
    const artFiles = {
      "asociart": "Asociart.webp",
      "comfye": "COMFYE.webp",
      "federacion patronal ap": "FederacionpatronalAP.webp",
      "federacion patronal art": "FederacionpatronalART.webp",
      "iaps art": "IAPSART.webp",
      "iaps": "IAPS.webp",
      "la segunda ap": "LASEGUNDAAP.webp",
      "la segunda art": "lasegundaart.webp",
      "medicar work": "medicarwork.webp",
      "victoria art": "vicotriaart.webp",
      "vicotria art": "vicotriaart.webp"
    };
    const fileName = artFiles[key];
    return fileName ? `/img-art/${fileName}` : '/img-art/default.webp';
  };

  const artImageUrl = getArtImage(artNombre);

  const apellido = paciente?.apellido || '';
  const nombrePaciente = paciente?.nombre || paciente?.nombreCompleto || '';
  const nombreCompleto = (apellido && nombrePaciente)
    ? `${apellido}, ${nombrePaciente}`
    : (paciente?.nombreCompleto || '—');
  const dniFormateado = formatDNI(paciente?.dni);
  const siniestro = paciente?.nroSiniestro || '—';

  const renderCompactTable = (items, columns) => {
    if (items.length === 0) return null;
    return (
      <table className={styles.printTableCompact}>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx}>
              {columns.map((col, colIdx) => {
                let content = item[col.field];
                if (col.field === 'desc') content = truncate(item.desc, 40);
                else if (col.field === 'origen') content = truncate(item.origen, 30);
                else if (col.field === 'total' || col.field === 'unit') content = `$ ${money(item[col.field])}`;
                return <td key={colIdx} className={col.className || ''}>{content || '—'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  const honorColumns = [
    { label: 'Código - Práctica', field: 'desc' },
    { label: 'Dr', field: 'origen' },
    { label: 'Cant.', field: 'unidades', className: styles.printNumber },
    { label: 'Valor unit.', field: 'unit', className: styles.printNumber },
    { label: 'Total', field: 'total', className: styles.printNumber }
  ];

  const gastoPracticasColumns = [
    { label: 'Código - Práctica', field: 'desc' },
    { label: 'CdU', field: 'origen' },
    { label: 'Cant.', field: 'unidades', className: styles.printNumber },
    { label: 'Valor unit.', field: 'unit', className: styles.printNumber },
    { label: 'Total', field: 'total', className: styles.printNumber }
  ];

  const medDescColumns = [
    { label: 'Descripción', field: 'desc' },
    { label: 'Cant.', field: 'unidades', className: styles.printNumber },
    { label: 'Valor unit.', field: 'unit', className: styles.printNumber },
    { label: 'Total', field: 'total', className: styles.printNumber }
  ];

  return (
    <div ref={ref} className={styles.printRoot}>
      <div className={styles.printHeaderRow}>
        <div className={styles.printPatientData}>
          <div className={styles.printPatientName}>{nombreCompleto}</div>
          <div className={styles.printPatientDni}>DNI {dniFormateado}</div>
        </div>
        <div className={styles.printArtBlock}>
          <img src={artImageUrl} alt={artNombre} className={styles.printArtLogo} onError={(e) => e.target.src = '/img-art/default.webp'} />
          <div className={styles.printSiniestro}>N° Siniestro: {siniestro}</div>
        </div>
      </div>

      {/* Honorarios Médicos */}
      <div className={styles.printSectionCompact}>
        <div className={styles.printSectionTitle}>
          HONORARIOS MÉDICOS — Total: $ {money(totalHonor)}
        </div>
        {honorPracticas.length > 0 && (
          <>
            <div className={styles.printSubsectionTitle}>
              Prácticas — $ {money(subtotalHonorPracticas)}
            </div>
            {renderCompactTable(honorPracticas, honorColumns)}
          </>
        )}
        {honorCirugias.length > 0 && (
          <>
            <div className={styles.printSubsectionTitle}>
              CX — $ {money(subtotalHonorCirugias)}
            </div>
            {renderCompactTable(honorCirugias, honorColumns)}
          </>
        )}
        {honorLaboratorios.length > 0 && (
          <>
            <div className={styles.printSubsectionTitle}>
              Laboratorio — $ {money(subtotalHonorLaboratorios)}
            </div>
            {renderCompactTable(honorLaboratorios, honorColumns)}
          </>
        )}
      </div>

      {/* Gastos Clínicos */}
      <div className={styles.printSectionCompact}>
        <div className={styles.printSectionTitle}>
          GASTOS CLÍNICOS — Total: $ {money(totalGasto)}
        </div>
        {gastoPracticas.length > 0 && (
          <>
            <div className={styles.printSubsectionTitle}>
              Prácticas — $ {money(subtotalGastoPracticas)}
            </div>
            {renderCompactTable(gastoPracticas, gastoPracticasColumns)}
          </>
        )}
        {gastoMedicamentos.length > 0 && (
          <>
            <div className={styles.printSubsectionTitle}>
              Medicación — $ {money(subtotalGastoMedicamentos)}
            </div>
            {renderCompactTable(gastoMedicamentos, medDescColumns)}
          </>
        )}
        {gastoDescartables.length > 0 && (
          <>
            <div className={styles.printSubsectionTitle}>
              Descartables — $ {money(subtotalGastoDescartables)}
            </div>
            {renderCompactTable(gastoDescartables, medDescColumns)}
          </>
        )}
      </div>

      {/* Totales finales */}
      <div className={styles.printTotalesCompact}>
        <hr style={{ margin: '8px 0', borderColor: '#ccc' }} />
        <div className={styles.printTotalLine}>
          <span>Subtotal Honorarios:</span>
          <span>$ {money(totalHonor)}</span>
        </div>
        <div className={styles.printTotalLine}>
          <span>Subtotal Gastos:</span>
          <span>$ {money(totalGasto)}</span>
        </div>
        <div className={styles.printTotalLineFinal}>
          <span>TOTAL:</span>
          <span>$ {money(totalFactura)}</span>
        </div>
      </div>

      <div className={styles.printFooter}>
        Clínica de la Unión S.A. - Av. Siburu 1085, Chajarí, Entre Ríos<br />
        Fecha de emisión: {new Date().toLocaleDateString('es-AR')}
      </div>
    </div>
  );
});

PrintView.displayName = 'PrintView';

// ─────────────────────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function FacturadoDetallePage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const printRef = useRef(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const snap = await get(ref(db, `Facturacion/${id}`));
        if (!alive) return;
        setItem(snap.exists() ? snap.val() : null);
      } catch (e) {
        console.error(e);
        if (alive) setItem(null);
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (id) load();
    return () => { alive = false; };
  }, [id]);

  const {
    honorPracticas,
    honorCirugias,
    honorLaboratorios,
    gastoPracticas,
    gastoMedicamentos,
    gastoDescartables,
    totalHonor,
    totalGasto,
    totalFactura,
    subtotalHonorPracticas,
    subtotalHonorCirugias,
    subtotalHonorLaboratorios,
    subtotalGastoPracticas,
    subtotalGastoMedicamentos,
    subtotalGastoDescartables,
  } = useMemo(() => {
    if (!item) return {
      honorPracticas: [], honorCirugias: [], honorLaboratorios: [],
      gastoPracticas: [], gastoMedicamentos: [], gastoDescartables: [],
      totalHonor: 0, totalGasto: 0, totalFactura: 0,
      subtotalHonorPracticas: 0, subtotalHonorCirugias: 0, subtotalHonorLaboratorios: 0,
      subtotalGastoPracticas: 0, subtotalGastoMedicamentos: 0, subtotalGastoDescartables: 0,
    };

    const practicas = Array.isArray(item.practicas) ? item.practicas : [];
    const cirugias = Array.isArray(item.cirugias) ? item.cirugias : [];
    const laboratorios = Array.isArray(item.laboratorios) ? item.laboratorios : [];
    const medicamentos = Array.isArray(item.medicamentos) ? item.medicamentos : [];
    const descartables = Array.isArray(item.descartables) ? item.descartables : [];

    const pickName = (x) => x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '—';
    const pickCode = (x) => x?.codigo || x?.code || x?.cod || x?.codigoPractica || '';
    const pickDoctor = (x) => x?.doctorNombre || x?.doctor || x?.medico || x?.nombreDr || x?.profesional || x?.prestadorNombre || x?.prestador || '—';
    const pickQty = (x) => {
      const c = x?.cantidad ?? x?.unidades ?? 1;
      const n = safeNum(c);
      return n > 0 ? n : 1;
    };
    const pickUnit = (x) => {
      const unit = x?.valorUnitario ?? x?.unitario ?? x?.precio ?? null;
      if (unit != null && unit !== '') return safeNum(unit);
      const qty = pickQty(x);
      const tot = safeNum(x?.total);
      return qty > 0 ? tot / qty : 0;
    };
    const formatCodeName = (x) => {
      const code = String(pickCode(x) || '').trim();
      const name = String(pickName(x) || '').trim();
      return code ? `${code} - ${name}` : name;
    };

    const honorPracticasArr = [];
    const honorCirugiasArr = [];
    const honorLaboratoriosArr = [];
    const gastoPracticasArr = [];
    const gastoMedicamentosArr = [];
    const gastoDescartablesArr = [];

    practicas.forEach(p => {
      const honorario = safeNum(p?.honorarioMedico);
      const gasto = safeNum(p?.gastoSanatorial);
      const qty = pickQty(p);
      const unit = pickUnit(p);
      const desc = formatCodeName(p);
      const doctor = pickDoctor(p);
      if (honorario > 0) honorPracticasArr.push({ desc, origen: doctor, unidades: qty, unit, total: honorario });
      if (gasto > 0) gastoPracticasArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
    });

    cirugias.forEach(c => {
      const honorario = safeNum(c?.honorarioMedico);
      const gasto = safeNum(c?.gastoSanatorial);
      const qty = pickQty(c);
      const unit = pickUnit(c);
      const desc = formatCodeName(c);
      const doctor = pickDoctor(c);
      if (honorario > 0) honorCirugiasArr.push({ desc, origen: doctor, unidades: qty, unit, total: honorario });
      if (gasto > 0) gastoPracticasArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
    });

    laboratorios.forEach(l => {
      const honorario = safeNum(l?.honorarioMedico);
      const gasto = safeNum(l?.gastoSanatorial);
      const qty = pickQty(l);
      const unit = pickUnit(l);
      const desc = formatCodeName(l);
      const doctor = pickDoctor(l);
      if (honorario > 0) honorLaboratoriosArr.push({ desc, origen: doctor, unidades: qty, unit, total: honorario });
      if (gasto > 0) gastoPracticasArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
    });

    medicamentos.forEach(m => {
      const gasto = safeNum(m?.gastoSanatorial ?? m?.total);
      const qty = pickQty(m);
      const unit = pickUnit(m);
      const desc = m?.nombre || '—';
      if (gasto > 0) gastoMedicamentosArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
    });

    descartables.forEach(d => {
      const gasto = safeNum(d?.gastoSanatorial ?? d?.total);
      const qty = pickQty(d);
      const unit = pickUnit(d);
      const desc = d?.nombre || '—';
      if (gasto > 0) gastoDescartablesArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
    });

    const subtotalHonorPracticas = honorPracticasArr.reduce((a, r) => a + r.total, 0);
    const subtotalHonorCirugias = honorCirugiasArr.reduce((a, r) => a + r.total, 0);
    const subtotalHonorLaboratorios = honorLaboratoriosArr.reduce((a, r) => a + r.total, 0);
    const totalHonor = subtotalHonorPracticas + subtotalHonorCirugias + subtotalHonorLaboratorios;

    const subtotalGastoPracticas = gastoPracticasArr.reduce((a, r) => a + r.total, 0);
    const subtotalGastoMedicamentos = gastoMedicamentosArr.reduce((a, r) => a + r.total, 0);
    const subtotalGastoDescartables = gastoDescartablesArr.reduce((a, r) => a + r.total, 0);
    const totalGasto = subtotalGastoPracticas + subtotalGastoMedicamentos + subtotalGastoDescartables;

    return {
      honorPracticas: honorPracticasArr,
      honorCirugias: honorCirugiasArr,
      honorLaboratorios: honorLaboratoriosArr,
      gastoPracticas: gastoPracticasArr,
      gastoMedicamentos: gastoMedicamentosArr,
      gastoDescartables: gastoDescartablesArr,
      totalHonor,
      totalGasto,
      totalFactura: totalHonor + totalGasto,
      subtotalHonorPracticas,
      subtotalHonorCirugias,
      subtotalHonorLaboratorios,
      subtotalGastoPracticas,
      subtotalGastoMedicamentos,
      subtotalGastoDescartables,
    };
  }, [item]);

  // ── Impresión de Medicamentos + Descartables + Laboratorio (SIN firma) ──
  const printMedDescLab = () => {
    if (!item) return;

    const paciente = item.paciente || {};
    const apellido = paciente.apellido || '';
    const nombrePaciente = paciente.nombre || paciente.nombreCompleto || '';
    const nombreCompleto = apellido && nombrePaciente ? `${apellido}, ${nombrePaciente}` : (paciente.nombreCompleto || '—');
    const dniFormateado = formatDNI(paciente.dni);
    const siniestro = paciente.nroSiniestro || item.nroSiniestro || '—';
    const artNombre = item.artNombre || paciente.artSeguro || item.convenioNombre || 'SIN ART';

    const getArtImage = (artName) => {
      if (!artName || artName === 'SIN ART') return '/img-art/default.webp';
      const normalizeForMap = (str) => str
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\w\s]/g, '')
        .trim();
      const key = normalizeForMap(artName);
      const artFiles = {
        "asociart": "Asociart.webp",
        "comfye": "COMFYE.webp",
        "federacion patronal ap": "FederacionpatronalAP.webp",
        "federacion patronal art": "FederacionpatronalART.webp",
        "iaps art": "IAPSART.webp",
        "iaps": "IAPS.webp",
        "la segunda ap": "LASEGUNDAAP.webp",
        "la segunda art": "lasegundaart.webp",
        "medicar work": "medicarwork.webp",
        "victoria art": "vicotriaart.webp",
        "vicotria art": "vicotriaart.webp"
      };
      const fileName = artFiles[key];
      return fileName ? `/img-art/${fileName}` : '/img-art/default.webp';
    };
    const artImageUrl = getArtImage(artNombre);

    const medicamentos = Array.isArray(item.medicamentos) ? item.medicamentos : [];
    const descartables = Array.isArray(item.descartables) ? item.descartables : [];
    const laboratorios = Array.isArray(item.laboratorios) ? item.laboratorios : [];

    const safeNumLocal = (v) => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const pickName = (x) => x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '—';
    const pickCode = (x) => x?.codigo || x?.code || x?.cod || x?.codigoPractica || '';
    const pickDoctor = (x) => x?.doctorNombre || x?.doctor || x?.medico || x?.nombreDr || x?.profesional || x?.prestadorNombre || x?.prestador || '—';
    const pickQty = (x) => {
      const c = x?.cantidad ?? x?.unidades ?? 1;
      const n = safeNumLocal(c);
      return n > 0 ? n : 1;
    };
    const pickUnit = (x) => {
      const unit = x?.valorUnitario ?? x?.unitario ?? x?.precio ?? null;
      if (unit != null && unit !== '') return safeNumLocal(unit);
      const qty = pickQty(x);
      const tot = safeNumLocal(x?.total);
      return qty > 0 ? tot / qty : 0;
    };
    const formatCodeName = (x) => {
      const code = String(pickCode(x) || '').trim();
      const name = String(pickName(x) || '').trim();
      return code ? `${code} — ${name}` : name;
    };

    const rowsMedDesc = (arr) =>
      arr.map((x) => {
        const qty = pickQty(x);
        const unit = pickUnit(x);
        const tot = safeNumLocal(x?.gastoSanatorial ?? x?.total);
        const desc = x?.nombre || x?.descripcion || '—';
        const pres = x?.presentacion ? ` (${x.presentacion})` : '';
        return `
          <tr>
            <td>${desc}${pres}</td>
            <td class="num">${qty}</td>
            <td class="num">$ ${money(unit)}</td>
            <td class="num">$ ${money(tot)}</td>
          </tr>
        `;
      }).join('');

    const rowsLab = laboratorios.map((l) => {
      const qty = pickQty(l);
      const ub = safeNumLocal(l?.unidadBioquimica ?? l?.ub ?? pickUnit(l));
      const total = safeNumLocal(l?.honorarioMedico ?? l?.total);
      const desc = formatCodeName(l);
      const doctor = pickDoctor(l);
      return `
        <tr>
          <td>${desc}</td>
          <td>${doctor !== '—' ? doctor : ''}</td>
          <td class="num">${qty}</td>
          <td class="num">${money(ub)}</td>
          <td class="num">$ ${money(total)}</td>
        </tr>
      `;
    }).join('');

    const totalMed = medicamentos.reduce((a, x) => a + safeNumLocal(x?.gastoSanatorial ?? x?.total), 0);
    const totalDesc = descartables.reduce((a, x) => a + safeNumLocal(x?.gastoSanatorial ?? x?.total), 0);
    const totalLab = laboratorios.reduce((a, x) => a + safeNumLocal(x?.honorarioMedico ?? x?.total), 0);
    const totalGen = totalMed + totalDesc + totalLab;

    const secMed = medicamentos.length === 0 ? '' : `
      <div class="section">
        <div class="section-title">MEDICAMENTOS — $ ${money(totalMed)}</div>
        <table class="compact-table">
          <thead><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead>
          <tbody>${rowsMedDesc(medicamentos)}</tbody>
        </table>
      </div>
    `;
    const secDesc = descartables.length === 0 ? '' : `
      <div class="section">
        <div class="section-title">DESCARTABLES — $ ${money(totalDesc)}</div>
        <table class="compact-table">
          <thead><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Valor unit.</th><th class="num">Total</th></tr></thead>
          <tbody>${rowsMedDesc(descartables)}</tbody>
        </table>
      </div>
    `;
    const secLab = laboratorios.length === 0 ? '' : `
      <div class="section">
        <div class="section-title">LABORATORIO — $ ${money(totalLab)}</div>
        <table class="compact-table">
          <thead><tr><th>Código — Estudio</th><th>Bioquímico/a</th><th class="num">Cant.</th><th class="num">UB</th><th class="num">Total</th></tr></thead>
          <tbody>${rowsLab}</tbody>
        </table>
      </div>
    `;

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Medicamentos, Descartables y Laboratorio — ${siniestro}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Roboto, Arial, sans-serif;
      font-size: 9pt;
      margin: 0.8cm;
      color: #1e293b;
      background: white;
      position: relative;
    }
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.12;
      z-index: -1;
      pointer-events: none;
    }
    .watermark img {
      width: 280px;
      height: auto;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #aaa;
      flex-wrap: wrap;
    }
    .patient-info {
      text-align: left;
    }
    .patient-name {
      font-size: 12pt;
      font-weight: bold;
    }
    .patient-dni {
      font-size: 11pt;
      color: #2c3e66;
      font-weight: 500;
    }
    .art-block {
      text-align: right;
    }
    .art-logo {
      max-height: 50px;
      max-width: 140px;
      object-fit: contain;
    }
    .siniestro-num {
      font-size: 10pt;
      font-weight: bold;
      color: #1e3a8a;
      margin-top: 4px;
    }
    .section {
      margin-top: 16px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 10pt;
      font-weight: bold;
      background: #eef2ff;
      padding: 5px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
      color: #1e3a8a;
    }
    .compact-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
      margin-bottom: 12px;
    }
    .compact-table th {
      background: #e2e8f0;
      text-align: left;
      padding: 4px 6px;
      border: 1px solid #cbd5e1;
      font-weight: 600;
    }
    .compact-table td {
      padding: 4px 6px;
      border: 1px solid #e2e8f0;
    }
    .num {
      text-align: right;
    }
    .total-row {
      margin-top: 16px;
      text-align: right;
      font-size: 11pt;
      font-weight: bold;
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
    }
    @media print {
      body { margin: 0.5cm; }
    }
  </style>
</head>
<body>
  <div class="watermark">
    <img src="/logo.png" alt="Clínica de la Unión" onerror="this.src='/logo.jpg'">
  </div>

  <div class="header-row">
    <div class="patient-info">
      <div class="patient-name">${nombreCompleto}</div>
      <div class="patient-dni">DNI ${dniFormateado}</div>
    </div>
    <div class="art-block">
      <img src="${artImageUrl}" alt="${artNombre}" class="art-logo" onerror="this.src='/img-art/default.webp'">
      <div class="siniestro-num">N° Siniestro: ${siniestro}</div>
    </div>
  </div>

  ${secMed}
  ${secDesc}
  ${secLab}

  <div class="total-row">
    TOTAL GENERAL: $ ${money(totalGen)}
  </div>
</body>
</html>`;

    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const onDownloadCsv = () => {
    alert('Función CSV no implementada aún.');
  };

  const onPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Factura_${id}_${item?.paciente?.dni || 'sin_dni'}`,
  });

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>Cargando…</h1>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className={styles.container}>
        <div className={styles.header}>
          <h1 className={styles.title}>No encontrado</h1>
          <p className={styles.subtitle}>No existe el registro /Facturacion/{id}</p>
          <Link className={styles.btnGhost} href="/admin/Facturacion/Facturados">← Volver</Link>
        </div>
      </div>
    );
  }

  const paciente = item.paciente || {};
  const estado = item.estado || (item.cerradoAt ? 'cerrado' : 'borrador');
  const artNombre = item.artNombre || paciente.artSeguro || item.convenioNombre || 'SIN ART';

  return (
    <div className={styles.container}>
      <div className={styles.screenView}>
        <ScreenView
          paciente={paciente}
          honorPracticas={honorPracticas}
          honorCirugias={honorCirugias}
          honorLaboratorios={honorLaboratorios}
          gastoPracticas={gastoPracticas}
          gastoMedicamentos={gastoMedicamentos}
          gastoDescartables={gastoDescartables}
          totalHonor={totalHonor}
          totalGasto={totalGasto}
          totalFactura={totalFactura}
          id={id}
          estado={estado}
          convenio={item.convenioNombre || item.convenio}
          onPrint={onPrint}
          onDownloadCsv={onDownloadCsv}
          onPrintMedDescLab={printMedDescLab}
        />
      </div>
      <PrintView
        ref={printRef}
        paciente={paciente}
        honorPracticas={honorPracticas}
        honorCirugias={honorCirugias}
        honorLaboratorios={honorLaboratorios}
        gastoPracticas={gastoPracticas}
        gastoMedicamentos={gastoMedicamentos}
        gastoDescartables={gastoDescartables}
        totalHonor={totalHonor}
        totalGasto={totalGasto}
        totalFactura={totalFactura}
        subtotalHonorPracticas={subtotalHonorPracticas}
        subtotalHonorCirugias={subtotalHonorCirugias}
        subtotalHonorLaboratorios={subtotalHonorLaboratorios}
        subtotalGastoPracticas={subtotalGastoPracticas}
        subtotalGastoMedicamentos={subtotalGastoMedicamentos}
        subtotalGastoDescartables={subtotalGastoDescartables}
        artNombre={artNombre}
      />
    </div>
  );
}
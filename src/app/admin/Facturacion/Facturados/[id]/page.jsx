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
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  } else if (digits.length === 11) {
    const part1 = digits.slice(0, 2);
    const part2 = digits.slice(2, 4);
    const part3 = digits.slice(4, 7);
    const part4 = digits.slice(7, 10);
    const check = digits.slice(10, 11);
    return `${part1}-${part2}.${part3}.${part4}-${check}`;
  } else {
    return dni;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  Mapa unificado de imágenes de ART (claves normalizadas sin espacios ni tildes)
// ─────────────────────────────────────────────────────────────────────────────
const getArtImage = (artName) => {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const normalize = (value = '') =>
    String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');

  const raw = String(artName || '').trim();
  const normalized = normalize(raw);

  if (!normalized || normalized === 'sinart') {
    return `${baseUrl}/img-art/default.webp`;
  }

  if (normalized.includes('asociart')) {
    return `${baseUrl}/img-art/ASOCIART.png`;
  }

  if (normalized.includes('comfye')) {
    return `${baseUrl}/img-art/COMFYE.png`;
  }

  if (
    normalized.includes('federacionpatronalap') ||
    normalized.includes('fedpatronalap') ||
    normalized.includes('fedpatronal')
  ) {
    return `${baseUrl}/img-art/FEDPATRONAL-AP.png`;
  }

  if (
    normalized.includes('federacionpatronalart') ||
    normalized.includes('fedpatronalart') ||
    normalized === 'fpart'
  ) {
    return `${baseUrl}/img-art/FPART.png`;
  }

  if (normalized.includes('iapsart')) {
    return `${baseUrl}/img-art/IAPSART.png`;
  }

  if (normalized.includes('iapsseguros') || normalized === 'iaps') {
    return `${baseUrl}/img-art/IAPSSEGUROS.webp`;
  }

  if (normalized.includes('lasegundaart')) {
    return `${baseUrl}/img-art/LASEGUNDAART.png`;
  }

  if (normalized.includes('lasegunda')) {
    return `${baseUrl}/img-art/LASEGUNDA.webp`;
  }

  if (
    normalized.includes('medicarwork') ||
    normalized.includes('medicarwor')
  ) {
    return `${baseUrl}/img-art/MEDICARWOR.png`;
  }

  if (
    normalized.includes('victoriaart') ||
    normalized.includes('victoriaseguro') ||
    normalized.includes('victoriaseguros')
  ) {
    return `${baseUrl}/img-art/vicotriaart.png`;
  }

  console.warn('Logo ART no mapeado:', { artName: raw, normalized });
  return `${baseUrl}/img-art/default.webp`;
};

// ─────────────────────────────────────────────────────────────────────────────
//  Funciones auxiliares
// ─────────────────────────────────────────────────────────────────────────────
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
        {(gastoMedicamentos.length > 0 || gastoDescartables.length > 0) && (
          <div className={styles.subsection}>
            <h4 className={styles.subsectionTitle}>Medicación y Descartables</h4>
            {renderTable([...gastoMedicamentos, ...gastoDescartables], medDescColumns)}
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
//  Vista de impresión principal (PrintView)
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
          <div className={styles.printPatientDni} style={{ fontSize: '13pt', fontWeight: 'bold' }}>
            DNI {dniFormateado}
          </div>
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
              Cx y/o Prácticas médicas nomecladas — $ {money(subtotalHonorCirugias)}
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
        {(gastoMedicamentos.length > 0 || gastoDescartables.length > 0) && (
          <>
            <div className={styles.printSubsectionTitle}>
              Medicación y Descartables — $ {money(subtotalGastoMedicamentos + subtotalGastoDescartables)}
            </div>
            {renderCompactTable([...gastoMedicamentos, ...gastoDescartables], medDescColumns)}
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
    </div>
  );
});

PrintView.displayName = 'PrintView';

// ─────────────────────────────────────────────────────────────────────────────
//  Vista de impresión solo Medicamentos + Descartables + Laboratorio
// ─────────────────────────────────────────────────────────────────────────────
const PrintMedDescLabView = React.forwardRef(({
  paciente,
  medicamentos,
  descartables,
  laboratorios,
  artNombre,
}, ref) => {
  const artImageUrl = getArtImage(artNombre);

  const apellido = paciente?.apellido || '';
  const nombrePaciente = paciente?.nombre || paciente?.nombreCompleto || '';
  const nombreCompleto = (apellido && nombrePaciente)
    ? `${apellido}, ${nombrePaciente}`
    : (paciente?.nombreCompleto || '—');
  const dniFormateado = formatDNI(paciente?.dni);
  const siniestro = paciente?.nroSiniestro || '—';

  // Unimos medicamentos y descartables
  const medDesc = [
    ...(Array.isArray(medicamentos) ? medicamentos : []),
    ...(Array.isArray(descartables) ? descartables : []),
  ];

  const medDescColumns = [
    { label: 'Descripción', field: 'desc' },
    { label: 'Cant.', field: 'unidades', className: styles.printNumber },
    { label: 'Valor unit.', field: 'unit', className: styles.printNumber },
    { label: 'Total', field: 'total', className: styles.printNumber }
  ];

  const labColumns = [
    { label: 'Código – Estudio', field: 'desc' },
    { label: 'Bioquímico/a', field: 'origen' },
    { label: 'Cant.', field: 'unidades', className: styles.printNumber },
    { label: 'UB', field: 'ub', className: styles.printNumber },
    { label: 'Total', field: 'total', className: styles.printNumber }
  ];

  const labRows = (Array.isArray(laboratorios) ? laboratorios : []).map(l => {
    const codigo = l.codigo || l.code || '';
    const nombre = l.nombre || l.descripcion || l.practica || '—';
    return {
      desc: codigo ? `${codigo} — ${nombre}` : nombre,
      origen: l.doctor || l.bioquimico || l.prestador || '—',
      unidades: l.cantidad ?? 1,
      ub: l.unidadBioquimica ?? l.ub ?? 0,
      total: l.honorarioMedico ?? l.total ?? 0,
    };
  });

  const totalMedDesc = medDesc.reduce(
    (sum, m) => sum + safeNum(m.gastoSanatorial ?? m.total ?? 0),
    0
  );
  const totalLab = labRows.reduce((sum, l) => sum + safeNum(l.total), 0);
  const totalGeneral = totalMedDesc + totalLab;

  return (
    <div ref={ref} className={styles.printRoot}>
      <div className={styles.printHeaderRow}>
        <div className={styles.printPatientData}>
          <div className={styles.printPatientName}>{nombreCompleto}</div>
          {/* DNI más grande y en negrita */}
          <div className={styles.printPatientDni} style={{ fontSize: '12pt', fontWeight: 'bold' }}>
            DNI {dniFormateado}
          </div>
        </div>
        <div className={styles.printArtBlock}>
          <img
            src={artImageUrl}
            alt={artNombre}
            className={styles.printArtLogo}
            onError={(e) => e.target.src = '/img-art/default.webp'}
          />
          <div className={styles.printSiniestro}>N° Siniestro: {siniestro}</div>
        </div>
      </div>

      {/* Medicamentos y Descartables */}
      {medDesc.length > 0 && (
        <div className={styles.printSectionCompact}>
          <div className={styles.printSectionTitle}>
            MEDICACIÓN Y DESCARTABLES — Total: $ {money(totalMedDesc)}
          </div>
          <table className={styles.printTableCompact}>
            <thead>
              <tr>
                {medDescColumns.map((col, i) => (
                  <th key={i}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {medDesc.map((item, idx) => {
                const qty = item.cantidad ?? 1;
                // ✅ Se evita el error separando ?? y ||
                const rawUnit = item.valorUnitario ?? (qty > 0 ? item.total / qty : 0);
                const unit = rawUnit || 0;
                const total = item.gastoSanatorial ?? item.total ?? 0;
                const descripcion =
                  (item.nombre || item.descripcion || '—') +
                  (item.presentacion ? ` (${item.presentacion})` : '');
                return (
                  <tr key={idx}>
                    <td>{descripcion}</td>
                    <td className={styles.printNumber}>{qty}</td>
                    <td className={styles.printNumber}>$ {money(unit)}</td>
                    <td className={styles.printNumber}>$ {money(total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Laboratorio */}
      {labRows.length > 0 && (
        <div className={styles.printSectionCompact}>
          <div className={styles.printSectionTitle}>
            LABORATORIO — Total: $ {money(totalLab)}
          </div>
          <table className={styles.printTableCompact}>
            <thead>
              <tr>
                {labColumns.map((col, i) => (
                  <th key={i}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {labRows.map((lab, idx) => (
                <tr key={idx}>
                  <td>{lab.desc}</td>
                  <td>{lab.origen}</td>
                  <td className={styles.printNumber}>{lab.unidades}</td>
                  <td className={styles.printNumber}>$ {money(lab.ub)}</td>
                  <td className={styles.printNumber}>$ {money(lab.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Totales */}
      <div className={styles.printTotalesCompact}>
        <hr style={{ margin: '8px 0', borderColor: '#ccc' }} />
        <div className={styles.printTotalLine}>
          <span>Subtotal Medicación y Descartables:</span>
          <span>$ {money(totalMedDesc)}</span>
        </div>
        {labRows.length > 0 && (
          <div className={styles.printTotalLine}>
            <span>Subtotal Laboratorio:</span>
            <span>$ {money(totalLab)}</span>
          </div>
        )}
        <div className={styles.printTotalLineFinal}>
          <span>TOTAL GENERAL:</span>
          <span>$ {money(totalGeneral)}</span>
        </div>
      </div>


      {/* Firma */}
      <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              borderBottom: '1.5px solid #1e293b',
              width: 200,
              marginBottom: 6,
              height: 40,
            }}
          />
          <span>Firma y sello – Administración</span>
        </div>
      </div>
    </div>
  );
});

PrintMedDescLabView.displayName = 'PrintMedDescLabView';

// ─────────────────────────────────────────────────────────────────────────────
//  Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function FacturadoDetallePage() {
  const { id } = useParams();
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState(null);
  const printRef = useRef(null);
  const printMedDescRef = useRef(null);

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

    const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
    const practicas = toArr(item.practicas);
    const cirugias = toArr(item.cirugias);
    const laboratorios = toArr(item.laboratorios);
    const medicamentos = toArr(item.medicamentos);
    const descartables = toArr(item.descartables);

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
      const nombre = m?.nombre || '—';
      const desc = m?.presentacion ? `${nombre} (${m.presentacion})` : nombre;
      gastoMedicamentosArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
    });

    descartables.forEach(d => {
      const gasto = safeNum(d?.gastoSanatorial ?? d?.total);
      const qty = pickQty(d);
      const unit = pickUnit(d);
      const nombre = d?.nombre || '—';
      const desc = d?.presentacion ? `${nombre} (${d.presentacion})` : nombre;
      gastoDescartablesArr.push({ desc, origen: 'Clínica de la Unión', unidades: qty, unit, total: gasto });
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

  // ── Handlers de impresión ─────────────────────────────────────────────────
  const onPrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Factura_${id}_${item?.paciente?.dni || 'sin_dni'}`,
  });

  const onPrintMedDescLab = useReactToPrint({
    contentRef: printMedDescRef,
    documentTitle: `Med_Desc_Lab_${id}_${item?.paciente?.dni || 'sin_dni'}`,
  });

  const onDownloadCsv = () => {
    alert('Función CSV no implementada aún.');
  };

  // ── Renderizado condicional ───────────────────────────────────────────────
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

  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);

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
          onPrintMedDescLab={onPrintMedDescLab}
        />
      </div>

      {/* Vista impresión principal */}
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

      {/* Vista impresión Med+Desc+Lab (oculta en pantalla) */}
      <PrintMedDescLabView
        ref={printMedDescRef}
        paciente={paciente}
        medicamentos={toArr(item.medicamentos)}
        descartables={toArr(item.descartables)}
        laboratorios={toArr(item.laboratorios)}
        artNombre={artNombre}
      />
    </div>
  );
}
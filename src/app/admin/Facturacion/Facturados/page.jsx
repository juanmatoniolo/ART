// src/app/admin/Facturacion/Facturados/page.jsx
'use client';

import useFacturados from './Hook/useFacturados';
import Header from './components/Header';
import QuickSwitch from './components/QuickSwitch';
import Toolbar from './components/Toolbar';
import ItemCard from './components/ItemCard';
import styles from './facturados.module.css';
import { money } from '../utils/calculos';

// ── Helpers internos ─────────────────────────────────────────────────────────

const safeNum = (v) => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

const pickName = (x) =>
  x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '—';

const pickCode = (x) =>
  x?.codigo || x?.code || x?.cod || x?.codigoPractica || '';

const pickDoctor = (x) =>
  x?.doctorNombre || x?.doctor || x?.medico || x?.nombreDr ||
  x?.profesional || x?.prestadorNombre || x?.prestador || '—';

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
  return code ? `${code} — ${name}` : name;
};

// ── Función de impresión Med + Desc + Lab ────────────────────────────────────

function buildMedDescLabHtml(item) {
  const paciente  = item.paciente  || {};
  const nombre    = paciente.nombreCompleto || paciente.nombre || '—';
  const dni       = paciente.dni       || '—';
  const siniestro = paciente.nroSiniestro || item.nroSiniestro || '—';
  const artNombre = item.artNombre || paciente.artSeguro || item.convenioNombre || 'SIN ART';

  const medicamentos  = Array.isArray(item.medicamentos)  ? item.medicamentos  : [];
  const descartables  = Array.isArray(item.descartables)  ? item.descartables  : [];
  const laboratorios  = Array.isArray(item.laboratorios)  ? item.laboratorios  : [];

  // ── filas medicamentos / descartables ──────────────────────────────────────
  const rowsMedDesc = (arr) =>
    arr.map((x) => {
      const qty  = pickQty(x);
      const unit = pickUnit(x);
      const tot  = safeNum(x?.gastoSanatorial ?? x?.total);
      const desc = x?.nombre || x?.descripcion || '—';
      const pres = x?.presentacion ? ` (${x.presentacion})` : '';
      return `<tr>
        <td>${desc}${pres}</td>
        <td class="num">${qty}</td>
        <td class="num">$ ${money(unit)}</td>
        <td class="num">$ ${money(tot)}</td>
      </tr>`;
    }).join('');

  // ── filas laboratorios ─────────────────────────────────────────────────────
  const rowsLab = laboratorios.map((l) => {
    const qty    = pickQty(l);
    const ub     = safeNum(l?.unidadBioquimica ?? l?.ub ?? pickUnit(l));
    const total  = safeNum(l?.honorarioMedico ?? l?.total);
    const desc   = formatCodeName(l);
    const doctor = pickDoctor(l);
    return `<tr>
      <td>${desc}</td>
      <td>${doctor !== '—' ? doctor : ''}</td>
      <td class="num">${qty}</td>
      <td class="num">${money(ub)}</td>
      <td class="num">$ ${money(total)}</td>
    </tr>`;
  }).join('');

  const totalMed  = medicamentos.reduce((a, x) => a + safeNum(x?.gastoSanatorial ?? x?.total), 0);
  const totalDesc = descartables.reduce((a, x) => a + safeNum(x?.gastoSanatorial ?? x?.total), 0);
  const totalLab  = laboratorios.reduce((a, x) => a + safeNum(x?.honorarioMedico ?? x?.total), 0);
  const totalGen  = totalMed + totalDesc + totalLab;

  // ── sección medicamentos ───────────────────────────────────────────────────
  const secMed = medicamentos.length === 0 ? '' : `
    <h2>Medicamentos</h2>
    <table>
      <thead><tr><th>Descripción</th><th>Cant.</th><th>Valor unit.</th><th>Total</th></tr></thead>
      <tbody>${rowsMedDesc(medicamentos)}</tbody>
    </table>
    <div class="subtotal">Subtotal medicamentos: $ ${money(totalMed)}</div>`;

  // ── sección descartables ───────────────────────────────────────────────────
  const secDesc = descartables.length === 0 ? '' : `
    <h2>Descartables</h2>
    <table>
      <thead><tr><th>Descripción</th><th>Cant.</th><th>Valor unit.</th><th>Total</th></tr></thead>
      <tbody>${rowsMedDesc(descartables)}</tbody>
    </table>
    <div class="subtotal">Subtotal descartables: $ ${money(totalDesc)}</div>`;

  // ── sección laboratorios ───────────────────────────────────────────────────
  const secLab = laboratorios.length === 0 ? '' : `
    <h2>Estudios de Laboratorio</h2>
    <table>
      <thead><tr><th>Código — Estudio</th><th>Bioquímico/a</th><th>Cant.</th><th>UB</th><th>Total</th></tr></thead>
      <tbody>${rowsLab}</tbody>
    </table>
    <div class="subtotal">Subtotal laboratorio: $ ${money(totalLab)}</div>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Med + Desc + Lab — ${artNombre} — ${siniestro}</title>
  <style>
    @page { margin: 1cm; }
    body { font-family: Arial, sans-serif; font-size: 11pt; margin: 0; color: #000; }

    /* marca de agua */
    .watermark {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      opacity: .12; z-index: -1; pointer-events: none;
    }
    .watermark img { width: 280px; height: auto; }

    h1 { font-size: 16pt; margin: 0 0 10px; }
    h2 { font-size: 13pt; margin: 18px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }

    .info-header {
      display: flex; flex-wrap: wrap; gap: 12px;
      background: #f4f4f4; padding: 8px 12px;
      border-radius: 4px; margin-bottom: 14px; font-size: 10pt;
    }
    .info-header p { margin: 0; }

    table {
      border-collapse: collapse; width: 100%;
      font-size: 10pt; margin-bottom: 4px;
      page-break-inside: avoid;
    }
    th {
      background: #e0e0e0; text-align: left;
      padding: 5px 6px; border: 1px solid #ccc;
    }
    td { padding: 4px 6px; border: 1px solid #ccc; }
    td.num { text-align: right; }

    .subtotal {
      font-weight: bold; text-align: right;
      font-size: 10pt; margin-bottom: 6px; padding-right: 4px;
    }

    .totales {
      margin-top: 18px; border-top: 2px solid #333;
      padding-top: 10px; page-break-inside: avoid;
    }
    .totales p { margin: 2px 0; font-weight: bold; font-size: 11pt; }
    .total-general { font-size: 14pt; margin-top: 6px; }

    .footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 20px; border-top: 1px solid #aaa; padding-top: 14px;
      page-break-inside: avoid;
    }
    .firma { text-align: center; flex: 1; }
    .firma-linea { font-size: 13pt; letter-spacing: 2px; color: #444; margin-bottom: 2px; }
    .firma-label { font-size: 9pt; color: #666; }
    .clinica { text-align: center; flex: 1; }
    .clinica img { max-width: 70px; height: auto; margin-bottom: 4px; }
    .clinica-info { font-size: 8pt; color: #666; line-height: 1.3; }
  </style>
</head>
<body>
  <div class="watermark"><img src="/logo.png" alt=""></div>

  <h1>Medicamentos, Descartables y Laboratorio</h1>

  <div class="info-header">
    <p><strong>ART / Convenio:</strong> ${artNombre}</p>
    <p><strong>Paciente:</strong> ${nombre}</p>
    <p><strong>DNI:</strong> ${dni}</p>
    <p><strong>N° Siniestro:</strong> ${siniestro}</p>
  </div>

  ${secMed}
  ${secDesc}
  ${secLab}

  <div class="totales">
    ${totalMed  > 0 ? `<p>Total Medicamentos: $ ${money(totalMed)}</p>`  : ''}
    ${totalDesc > 0 ? `<p>Total Descartables: $ ${money(totalDesc)}</p>` : ''}
    ${totalLab  > 0 ? `<p>Total Laboratorio: $ ${money(totalLab)}</p>`   : ''}
    <p class="total-general">TOTAL GENERAL: $ ${money(totalGen)}</p>
  </div>

  <div class="footer">
    <div class="firma">
      <div class="firma-linea">_________________________</div>
      <div class="firma-label">Firma y sello del responsable</div>
    </div>
    <div class="clinica">
      <img src="/logo.jpg" alt="Clínica de la Unión">
      <div class="clinica-info">
        Clínica de la Unión S.A.<br>
        Chajarí, Entre Ríos — Av. Siburu 1085
      </div>
    </div>
  </div>
</body>
</html>`;
}

function printMedDescLab(item) {
  const html = buildMedDescLabHtml(item);
  const win  = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function FacturadosPage() {
  const {
    loading,
    q,
    setQ,
    estado,
    setEstadoQuery,
    art,
    setArt,
    orden,
    setOrden,
    selectedIds,
    toggleSelect,
    toggleSelectAll,
    deleting,
    deleteSelected,
    exportCompleto,
    printART,
    counts,
    arts,
    filtered,
    fechaDesde,
    setFechaDesde,
    fechaHasta,
    setFechaHasta,
  } = useFacturados();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <Header
          selectedCount={selectedIds.size}
          onExport={exportCompleto}
          onDelete={deleteSelected}
          deleting={deleting}
        />
        <QuickSwitch estado={estado} counts={counts} onSwitch={setEstadoQuery} />
        <Toolbar
          q={q}
          onSearchChange={setQ}
          estado={estado}
          onEstadoChange={setEstadoQuery}
          art={art}
          onArtChange={setArt}
          arts={arts}
          orden={orden}
          onOrdenChange={setOrden}
          selectedCount={selectedIds.size}
          totalFiltered={filtered.length}
          onToggleSelectAll={toggleSelectAll}
          fechaDesde={fechaDesde}
          onFechaDesdeChange={setFechaDesde}
          fechaHasta={fechaHasta}
          onFechaHastaChange={setFechaHasta}
        />
      </header>

      <main className={styles.content}>
        {loading ? (
          <div className={styles.empty}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay resultados con esos filtros.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map(it => (
              <ItemCard
                key={it.id}
                item={it}
                isSelected={selectedIds.has(it.id)}
                onToggleSelect={toggleSelect}
                onPrintART={printART}
                onPrintMedDescLab={printMedDescLab}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
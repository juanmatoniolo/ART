'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { ref, update, remove, get } from 'firebase/database';
import { db } from '@/lib/firebase';
import { money, parseNumber } from '../utils/calculos'; // 🔹 Importamos parseNumber
import { cerrarPacientePorFactura } from '../utils/siniestroPacienteSync';
import useFacturados from './Hook/useFacturados';
import styles from './facturados.module.css';

// ─────────────────────────────────────────────────────────────────────────────
//  Utilidades para el script ARCA
// ─────────────────────────────────────────────────────────────────────────────
const safeNum = (v) => {
  const n = typeof v === 'number' ? v : parseNumber(v);
  return Number.isFinite(n) ? n : 0;
};

const getIvaForArt = (artNombre) => {
  const key = (artNombre || '').toUpperCase().trim();

  const iva21Group = new Set([
    'IAPS AP',
    'FEDERACION PATRONAL AP',
    'LA SEGUNDA PERSONAS'
  ]);
  const exentoGroup = new Set([
    'IAPS ART',
    'VICTORIA SEGUROS',
    'FEDERACION PATRONAL ART'
  ]);
  const iva105Group = new Set([
    'COMFYE'
  ]);
  const facturaBGroup = new Set([
    'RECONQUISTA ART',
    'MEDICAR WORK',
    'ASOCIART',
    'LA SEGUNDA ART'
  ]);

  if (iva21Group.has(key)) return '21%';
  if (exentoGroup.has(key) || facturaBGroup.has(key)) return 'Exento';
  if (iva105Group.has(key)) return '10.5%';
  return '21%';
};

const fmtDate = (ms) => {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString('es-AR');
  } catch {
    return '—';
  }
};

export default function FacturadosPage() {
  const {
    loading,
    q, setQ,
    estado, setEstadoQuery,
    art, setArt,
    orden, setOrden,
    fechaDesde, setFechaDesde,
    fechaHasta, setFechaHasta,
    selectedIds, toggleSelect, toggleSelectAll,
    deleting, deleteSelected,
    exportCompleto, exportJson,
    counts, arts, filtered,
  } = useFacturados();

  const [showMore, setShowMore] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [showIapsModal, setShowIapsModal] = useState(false);
  const [cmdScript, setCmdScript] = useState('');
  const [copied, setCopied] = useState(false);

  // 🔹 Estados para ARCA Script
  const [showArcaModal, setShowArcaModal] = useState(false);
  const [arcaScript, setArcaScript] = useState('');
  const [arcaCopied, setArcaCopied] = useState(false);
  const [arcaLoadingId, setArcaLoadingId] = useState('');

  const allSelected = selectedIds.size === filtered.length && filtered.length > 0;
  const haySeleccion = selectedIds.size > 0;

  // ----- Acciones por tarjeta -----
  const marcarFacturado = useCallback(async (id) => {
    if (!window.confirm('¿Pasar este borrador a FACTURADO / CERRADO?')) return;
    setBusyId(id);
    try {
      const snap = await get(ref(db, `Facturacion/${id}`));
      if (!snap.exists()) return alert('Ya no existe este registro.');
      const prev = snap.val();
      const now = Date.now();
      const facturaNro = prev?.facturaNro || `FAC-${new Date().getFullYear()}-${now}`;

      await update(ref(db, `Facturacion/${id}`), {
        estado: 'cerrado', cerradoAt: now, updatedAt: now, facturaNro,
      });
      await cerrarPacientePorFactura(
        { id, ...prev, estado: 'cerrado', cerradoAt: now, facturaNro }, id
      );
      alert(`✅ Marcado como CERRADO.\nFactura: ${facturaNro}`);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error al marcar como facturado.');
    } finally {
      setBusyId('');
    }
  }, []);

  const eliminarUno = useCallback(async (id) => {
    if (!window.confirm('¿Eliminar este registro definitivamente?')) return;
    setBusyId(id);
    try {
      const snap = await get(ref(db, `Facturacion/${id}`));
      const prev = snap.exists() ? snap.val() : null;
      await remove(ref(db, `Facturacion/${id}`));
      if (prev?.siniestroKey) {
        await remove(ref(db, `Facturacion/siniestros/${prev.siniestroKey}`)).catch(() => { });
      }
      alert('🗑️ Registro eliminado.');
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error al eliminar.');
    } finally {
      setBusyId('');
    }
  }, []);

  // ----- Acciones masivas -----
  const facturarSeleccionados = useCallback(async () => {
    const ids = Array.from(selectedIds);
    const borradores = filtered.filter(it => ids.includes(it.id) && it.estado !== 'cerrado');
    if (borradores.length === 0) {
      alert('Seleccioná al menos un borrador (no cerrado).');
      return;
    }
    if (!window.confirm(`¿Facturar ${borradores.length} registro(s)?`)) return;

    setBusyId('bulk');
    try {
      let count = 0;
      for (const it of borradores) {
        const now = Date.now();
        const facturaNro = it.facturaNro || `FAC-${new Date().getFullYear()}-${now}`;
        await update(ref(db, `Facturacion/${it.id}`), {
          estado: 'cerrado',
          cerradoAt: now,
          updatedAt: now,
          facturaNro,
        });
        await cerrarPacientePorFactura(
          { ...it, estado: 'cerrado', cerradoAt: now, facturaNro },
          it.id
        );
        count++;
      }
      alert(`✅ ${count} registro(s) facturados correctamente.`);
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error al facturar seleccionados.');
    } finally {
      setBusyId('');
    }
  }, [selectedIds, filtered]);

  const generarCarpetasIAPS = useCallback(() => {
    let items = filtered.filter(it => selectedIds.has(it.id) || selectedIds.size === 0);
    if (items.length === 0) {
      alert('No hay registros para generar carpetas.');
      return;
    }
    items = items.sort((a, b) => (a.pacienteNombre || '').localeCompare(b.pacienteNombre || ''));

    const base64PDF = "JVBERi0xLjQKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MTIgNzkyXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDA5IDAwMDAwIG4gCjAwMDAwMDAwNTcgMDAwMDAgbiAKMDAwMDAwMDExMyAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5MAolJUVPRg==";

    const escapedBase64 = base64PDF.replace(/%/g, '%%');

    const lines = items.map(it => {
      const nombre = (it.pacienteNombre || 'SIN_NOMBRE').replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '');
      const dni = it.dni || 'SIN_DNI';
      const siniestro = it.nroSiniestro || '';
      const folderName = `${nombre} - ${dni} - ${siniestro}`;
      const mkdir = `mkdir "${folderName}"`;
      const pdf = `powershell -Command "$pdfBase64='${escapedBase64}'; $bytes=[Convert]::FromBase64String($pdfBase64); [IO.File]::WriteAllBytes('${folderName}\\${folderName}.pdf',$bytes)"`;
      return `${mkdir}\n${pdf}`;
    });

    const script = `@echo off\nREM Crear carpetas para IAPS + PDF en blanco\n${lines.join('\n')}\npause`;
    setCmdScript(script);
    setShowIapsModal(true);
  }, [selectedIds, filtered]);

  // 🔹 Función para generar el script ARCA de un item completo
const generateArcaScript = useCallback((fullItem) => {
  if (!fullItem) return '';

  const toArr = (v) => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  const practicas = toArr(fullItem.practicas);
  const cirugias = toArr(fullItem.cirugias);
  const laboratorios = toArr(fullItem.laboratorios);
  const medicamentos = toArr(fullItem.medicamentos);
  const descartables = toArr(fullItem.descartables);

  if (
    practicas.length === 0 && cirugias.length === 0 && laboratorios.length === 0 &&
    medicamentos.length === 0 && descartables.length === 0
  ) {
    alert('No hay datos para generar el script.');
    return '';
  }

  const art = fullItem.artNombre || fullItem.paciente?.artSeguro || '';
  const iva = getIvaForArt(art);

  const pickCode = (x) => x?.codigo || x?.code || x?.cod || x?.codigoPractica || '';
  const pickDescripcion = (x) => x?.descripcion || x?.nombre || x?.practica || x?.detalle || x?.producto || '';
  const pickPrestador = (x) =>
    x?.doctorNombre || x?.doctor || x?.medico || x?.nombreDr || x?.profesional ||
    x?.prestadorNombre || x?.prestador || 'Médico';
  const pickRol = (x) => x?.rol || x?.funcion || x?.cargo || '';
  const pickCantidad = (x) => {
    const c = x?.cantidad ?? x?.unidades ?? 1;
    const n = safeNum(c);
    return n > 0 ? n : 1;
  };

  // 🔹 MODIFICACIÓN: truncar55 convierte a MAYÚSCULAS
  const truncar55 = (desc) => {
    const upperDesc = String(desc).toUpperCase();
    return upperDesc.length > 55 ? upperDesc.slice(0, 52) + '...' : upperDesc;
  };

  const ivaMapSelect = { 'Exento': '2', '21%': '5', '10.5%': '4' };
  const ivaValue = ivaMapSelect[iva] || '0';

  const rowsHonorarios = [];
  const rowsGastos = [];

  practicas.forEach((x) => {
    const cantidad = pickCantidad(x);
    const codigo = pickCode(x);
    const descripcion = pickDescripcion(x);
    const honorario = safeNum(x.honorarioMedico);
    const gasto = safeNum(x.gastoSanatorial);
    const prestador = pickPrestador(x);

    if (honorario > 0) {
      rowsHonorarios.push({
        codigo: '2',
        descripcion: truncar55(`Dr ${prestador} - ${codigo} ${descripcion}`),
        cantidad,
        precio: (honorario / cantidad).toFixed(2),
        iva: ivaValue,
      });
    }
    if (gasto > 0) {
      rowsGastos.push({
        codigo: '7',
        descripcion: truncar55(`Gto San. - ${codigo} ${descripcion}`),
        cantidad,
        precio: (gasto / cantidad).toFixed(2),
        iva: ivaValue,
      });
    }
  });

  cirugias.forEach((x) => {
    const cantidad = pickCantidad(x);
    const codigo = pickCode(x);
    const descripcion = pickDescripcion(x);
    const honorario = safeNum(x.honorarioMedico);
    const gasto = safeNum(x.gastoSanatorial);
    const prestador = pickPrestador(x);
    const rol = pickRol(x);

    if (honorario > 0) {
      const desc = rol
        ? `Dr ${prestador} - ${rol} ${codigo} ${descripcion}`
        : `Dr ${prestador} - ${codigo} ${descripcion}`;
      rowsHonorarios.push({
        codigo: '2',
        descripcion: truncar55(desc),
        cantidad,
        precio: (honorario / cantidad).toFixed(2),
        iva: ivaValue,
      });
    }
    if (gasto > 0) {
      rowsGastos.push({
        codigo: '7',
        descripcion: truncar55(`Gto San. - ${codigo} ${descripcion}`),
        cantidad,
        precio: (gasto / cantidad).toFixed(2),
        iva: ivaValue,
      });
    }
  });

  const labHonorPorDoctor = new Map();
  laboratorios.forEach((x) => {
    const honorario = safeNum(x.honorarioMedico);
    if (honorario > 0) {
      const prestador = pickPrestador(x);
      labHonorPorDoctor.set(prestador, (labHonorPorDoctor.get(prestador) || 0) + honorario);
    }
    const gasto = safeNum(x.gastoSanatorial);
    if (gasto > 0) {
      const codigo = pickCode(x);
      const descripcion = pickDescripcion(x);
      const cantidad = pickCantidad(x);
      rowsGastos.push({
        codigo: '7',
        descripcion: truncar55(`Gto San. - ${codigo} ${descripcion}`),
        cantidad,
        precio: (gasto / cantidad).toFixed(2),
        iva: ivaValue,
      });
    }
  });
  labHonorPorDoctor.forEach((total, prestador) => {
    rowsHonorarios.push({
      codigo: '2',
      descripcion: truncar55(`Dr ${prestador} - Laboratorio`),
      cantidad: 1,
      precio: total.toFixed(2),
      iva: ivaValue,
    });
  });

  const totalMedDesc = [...medicamentos, ...descartables].reduce(
    (sum, m) => sum + safeNum(m?.gastoSanatorial ?? m?.total),
    0
  );
  if (totalMedDesc > 0) {
    rowsGastos.push({
      codigo: '7',
      descripcion: 'MEDICACIÓN Y DESCARTABLES', // ya en mayúsculas
      cantidad: 1,
      precio: totalMedDesc.toFixed(2),
      iva: ivaValue,
    });
  }

  const paciente = fullItem.paciente || {};
  const nombrePaciente = paciente.nombreCompleto || paciente.nombre || '';
  const dniPaciente = paciente.dni || '';
  // 🔹 MODIFICACIÓN: convertir a MAYÚSCULAS
  const pacienteDesc = `PTE ${nombrePaciente} - DNI ${dniPaciente} - ${art} -`.toUpperCase();
  rowsGastos.push({
    codigo: '',
    descripcion: pacienteDesc,
    cantidad: 1,
    precio: '0.00',
    iva: '2',
  });

  const rowsData = [...rowsHonorarios, ...rowsGastos];
  if (rowsData.length === 0) return '';

  const rowsDataJson = JSON.stringify(rowsData);
  return `
(function() {
  const rowsData = ${rowsDataJson};
  const MEDIDA_UNIDADES = '7';

  function getTable() {
    let table = document.querySelector('table#idoperacion tbody');
    if (!table) table = document.querySelector('table.jig_formvertical tbody');
    if (!table) {
      const allTables = document.querySelectorAll('table tbody');
      for (const t of allTables) {
        if (t.querySelector('input[name="detalleCodigoArticulo"]')) { table = t; break; }
      }
    }
    return table;
  }

  function getDataRows(table) {
    const rows = [];
    for (let i = 0; i < table.rows.length; i++) {
      if (table.rows[i].querySelector('input[name="detalleCodigoArticulo"]')) {
        rows.push(table.rows[i]);
      }
    }
    return rows;
  }

  function getAddButton() {
    return document.querySelector('input[value="Agregar línea descripción"]');
  }

  function fireChange(el) {
    if (!el) return;
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('keyup', { bubbles: true }));
  }

  function setRowValues(row, data) {
    const codigoInput = row.querySelector('input[name="detalleCodigoArticulo"]');
    if (codigoInput) codigoInput.value = data.codigo;

    const descTextarea = row.querySelector('textarea[name="detalleDescripcion"]');
    if (descTextarea) descTextarea.value = data.descripcion;

    const cantInput = row.querySelector('input[name="detalleCantidad"]');
    if (cantInput) cantInput.value = data.cantidad;

    const medidaSelect = row.querySelector('select[name="detalleMedida"]');
    if (medidaSelect) {
      medidaSelect.value = MEDIDA_UNIDADES;
      fireChange(medidaSelect);
    }

    const precioInput = row.querySelector('input[name="detallePrecio"]');
    if (precioInput) precioInput.value = data.precio;

    const ivaSelect = row.querySelector('select[name="detalleTipoIVA"]');
    if (ivaSelect) ivaSelect.value = data.iva;

    fireChange(cantInput);
    fireChange(precioInput);
    fireChange(ivaSelect);
  }

  const table = getTable();
  if (!table) { alert('No se encontró la tabla de detalles.'); return; }

  const addBtn = getAddButton();
  if (!addBtn) { alert('No se encontró el botón "Agregar línea descripción".'); return; }

  let dataRows = getDataRows(table);
  const targetCount = rowsData.length;

  let guard = 0;
  while (dataRows.length < targetCount && guard < 200) {
    addBtn.click();
    dataRows = getDataRows(table);
    guard++;
  }

  guard = 0;
  while (dataRows.length > targetCount && guard < 200) {
    const lastRow = dataRows[dataRows.length - 1];
    const delBtn = lastRow.querySelector('input[name="Eliminar"]');
    if (delBtn) delBtn.click();
    else break;
    dataRows = getDataRows(table);
    guard++;
  }

  if (dataRows.length !== targetCount) {
    alert('No se pudo ajustar la cantidad de filas (' + dataRows.length + ' de ' + targetCount + ').');
    return;
  }

  for (let i = 0; i < targetCount; i++) {
    setRowValues(dataRows[i], rowsData[i]);
  }

  console.log('✅ Se procesaron ' + targetCount + ' filas.');
  alert('✅ Se procesaron ' + targetCount + ' filas correctamente.');
})();
`;
}, []);

  // 🔹 Función que obtiene el item completo y abre el modal ARCA
  const handleGenerarARCA = useCallback(async (id) => {
    setArcaLoadingId(id);
    try {
      const snap = await get(ref(db, `Facturacion/${id}`));
      if (!snap.exists()) {
        alert('No existe el registro.');
        return;
      }
      const fullItem = snap.val();
      const script = generateArcaScript(fullItem);
      if (script) {
        setArcaScript(script);
        setShowArcaModal(true);
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || 'Error al obtener los datos.');
    } finally {
      setArcaLoadingId('');
    }
  }, [generateArcaScript]);

  const handleCopyArca = useCallback(() => {
    navigator.clipboard.writeText(arcaScript)
      .then(() => {
        setArcaCopied(true);
        setTimeout(() => setArcaCopied(false), 3000);
      })
      .catch(() => alert('No se pudo copiar el texto.'));
  }, [arcaScript]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(cmdScript)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      })
      .catch(() => alert('No se pudo copiar el texto.'));
  }, [cmdScript]);

  // --- Render ---
  const tabs = [
    { key: 'todos', label: 'Todos', count: counts.total },
    { key: 'borrador', label: 'Borradores', count: counts.borradores },
    { key: 'cerrado', label: 'Cerrados', count: counts.cerrados },
  ];

  const hayBorradoresSeleccionados = Array.from(selectedIds).some(id => {
    const item = filtered.find(f => f.id === id);
    return item && item.estado !== 'cerrado';
  });

  return (
    <div className={styles.container}>
      {/* ENCABEZADO */}
      <header className={styles.header}>
        <div className={styles.headerTop}>
          <div>
            <h1 className={styles.title}>📦 Facturación</h1>
            <p className={styles.subtitle}>Borradores y facturas cerradas, todo en un solo lugar.</p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/admin/Facturacion" className={styles.btnGhost}>← Volver</Link>
            <Link href="/admin/Facturacion/Nuevo?new=1" className={styles.btnPrimary}>➕ Nueva</Link>
          </div>
        </div>

        {/* TABS DE ESTADO */}
        <div className={styles.tabs}>
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`${styles.tab} ${estado === t.key ? styles.tabActive : ''}`}
              onClick={() => setEstadoQuery(t.key)}
            >
              {t.label}
              <span className={styles.tabCount}>{t.count}</span>
            </button>
          ))}
        </div>

        {/* FILTROS */}
        <div className={styles.filters}>
          <input
            className={styles.search}
            placeholder="🔎 Buscar paciente, DNI, siniestro, ART, factura…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className={styles.select} value={art} onChange={(e) => setArt(e.target.value)}>
            <option value="">Todas las ART</option>
            {arts.map((a) => (
              <option key={a.key} value={a.key}>{a.name}</option>
            ))}
          </select>
          <select className={styles.select} value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="fecha_desc">Más recientes</option>
            <option value="fecha_asc">Más antiguos</option>
            <option value="nombre_asc">Nombre A→Z</option>
            <option value="nombre_desc">Nombre Z→A</option>
            <option value="total_desc">Mayor total</option>
            <option value="total_asc">Menor total</option>
          </select>
          <button className={styles.btnLink} onClick={() => setShowMore((s) => !s)}>
            {showMore ? '▲ Menos' : '▼ Fechas'}
          </button>
        </div>

        {showMore && (
          <div className={styles.dateRow}>
            <label>Desde <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)} /></label>
            <label>Hasta <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)} /></label>
            {(fechaDesde || fechaHasta) && (
              <button className={styles.btnLink} onClick={() => { setFechaDesde(''); setFechaHasta(''); }}>
                Limpiar fechas
              </button>
            )}
          </div>
        )}

        {/* BARRA DE SELECCIÓN / ACCIONES MASIVAS */}
        <div className={styles.bulkBar}>
          <label className={styles.checkAll}>
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} />
            <span>{haySeleccion ? `${selectedIds.size} seleccionado(s)` : 'Seleccionar todos'}</span>
          </label>
          {haySeleccion && (
            <div className={styles.bulkActions}>
              <button className={styles.btnInfo} onClick={exportCompleto}>📊 Exportar Excel</button>
              <button className={styles.btnJson} onClick={exportJson}>JSON</button>
              <button
                className={`${styles.btn} ${styles.btnSuccess}`}
                onClick={facturarSeleccionados}
                disabled={!hayBorradoresSeleccionados || deleting}
              >
                ✅ Facturar seleccionados
              </button>
              <button className={`${styles.btn} ${styles.btnIaps}`} onClick={generarCarpetasIAPS}>
                📁 Carpetas IAPS
              </button>
              <button className={styles.btnDanger} onClick={deleteSelected} disabled={deleting}>
                {deleting ? 'Eliminando…' : '🗑️ Eliminar'}
              </button>
            </div>
          )}
        </div>
      </header>

      {/* LISTA */}
      <main className={styles.content}>
        {loading ? (
          <div className={styles.empty}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No hay registros con estos filtros.</div>
        ) : (
          <div className={styles.grid}>
            {filtered.map((it) => {
              const busy = busyId === it.id || busyId === 'bulk';
              const esCerrado = it.estado === 'cerrado';
              return (
                <article key={it.id} className={`${styles.card} ${esCerrado ? styles.cardClosed : ''}`}>
                  <div className={styles.cardTop}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(it.id)}
                      onChange={() => toggleSelect(it.id)}
                      disabled={busy}
                    />
                    <span className={`${styles.badge} ${esCerrado ? styles.badgeClosed : styles.badgeDraft}`}>
                      {esCerrado ? '✅ CERRADO' : '📝 BORRADOR'}
                    </span>
                    <span className={styles.date}>📅 {fmtDate(it.fecha)}</span>
                    <span className={styles.total}>$ {money(it.total || 0)}</span>
                  </div>

                  <div className={styles.name}>{it.pacienteNombre || 'Sin nombre'}</div>

                  <div className={styles.pills}>
                    <span className={styles.pill}>DNI: {it.dni || '—'}</span>
                    <span className={styles.pill}>Stro: {it.nroSiniestro || '—'}</span>
                    <span className={styles.pill}>{it.artNombre || 'SIN ART'}</span>
                    {esCerrado && it.facturaNro && (
                      <span className={`${styles.pill} ${styles.pillFactura}`}>🧾 {it.facturaNro}</span>
                    )}
                  </div>

                  <div className={styles.actions}>
                    {!esCerrado && (
                      <Link className={`${styles.btn} ${styles.btnPrimary}`} href={`/admin/Facturacion/Nuevo?draft=${it.id}`}>
                        ▶ Retomar
                      </Link>
                    )}
                    <Link className={`${styles.btn} ${styles.btnGhost}`} href={`/admin/Facturacion/Facturados/${it.id}`}>
                      👁 Ver
                    </Link>
                    {/* 🔹 Reemplazamos el botón Imprimir por ARCA Script */}
                    <button
                      className={`${styles.btn} ${styles.btnGhost}`}
                      onClick={() => handleGenerarARCA(it.id)}
                      disabled={busy || arcaLoadingId === it.id}
                    >
                      {arcaLoadingId === it.id ? '⏳ Generando…' : '📋 ARCA Script'}
                    </button>
                    {!esCerrado && (
                      <button className={`${styles.btn} ${styles.btnSuccess}`} onClick={() => marcarFacturado(it.id)} disabled={busy}>
                        ✅ Facturar
                      </button>
                    )}
                    <button className={`${styles.btn} ${styles.btnDanger}`} onClick={() => eliminarUno(it.id)} disabled={busy}>
                      🗑️
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* MODAL CARPETAS IAPS */}
      {showIapsModal && (
        <div className={styles.modalOverlay} onClick={() => setShowIapsModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>📁 Carpetas IAPS</h2>
            <p>Copiá el siguiente código en un archivo <code>.bat</code> y ejecutalo en Windows para crear las carpetas.</p>
            <pre className={styles.cmdScript}>{cmdScript}</pre>
            <div className={styles.modalActions}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  className={styles.btnGhost}
                  onClick={handleCopy}
                  disabled={copied}
                >
                  {copied ? '✅ Copiado' : '📋 Copiar'}
                </button>
                {copied && (
                  <span style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '8px',
                    backgroundColor: '#333',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.8em',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    opacity: 1,
                    transition: 'opacity 0.3s',
                  }}>
                    ✅ ¡Copiado al portapapeles!
                  </span>
                )}
              </div>
              <button className={styles.btnPrimary} onClick={() => setShowIapsModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ARCA SCRIPT */}
      {showArcaModal && (
        <div className={styles.modalOverlay} onClick={() => setShowArcaModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '550px' }}>
            <h2>📋 ARCA Script</h2>
            <p>Copiá el siguiente script y pegálo en la consola de ARCA (F12) para cargar los detalles automáticamente.</p>
            <pre className={styles.cmdScript} style={{ background: '#04060B', color: '#e2e8f0' }}>
              {arcaScript}
            </pre>
            <div className={styles.modalActions}>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <button
                  className={styles.btnPrimary}
                  onClick={handleCopyArca}
                  disabled={arcaCopied}
                >
                  {arcaCopied ? '✅ ¡Copiado!' : '📋 Copiar script'}
                </button>
                {arcaCopied && (
                  <span style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    marginBottom: '8px',
                    backgroundColor: '#333',
                    color: '#fff',
                    padding: '4px 10px',
                    borderRadius: '4px',
                    fontSize: '0.8em',
                    whiteSpace: 'nowrap',
                    zIndex: 10,
                    opacity: 1,
                    transition: 'opacity 0.3s',
                  }}>
                    ✅ ¡Copiado al portapapeles!
                  </span>
                )}
              </div>
              <button className={styles.btnGhost} onClick={() => setShowArcaModal(false)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
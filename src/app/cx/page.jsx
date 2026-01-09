'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const MAPPING_URL = '/mappings/cd-campos_fields_rects.json';
const TEMPLATE_URL = '/templates/cd-campos.pdf';

// Si tenés duplicados con nombres distintos, agrupálos acá (opcional)
const CANONICAL_ALIASES = {};

// ===== Helpers =====
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ===== Ajuste fino impresión (global) =====
const PRINT_OFFSET_X_PT = 5;   // derecha
const PRINT_OFFSET_Y_PT = -5;  // arriba

function normalizeName(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[()]/g, '')
    .replace(/__\d+$/g, '')
    .replace(/-\d+$/g, '');
}

function humanizeKey(k) {
  const s = (k || '').replace(/[-_]+/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function isLikelyCheckbox(fieldType) {
  return fieldType === '/Btn';
}

function isLikelyText(fieldType) {
  return fieldType === '/Tx' || !fieldType;
}

// ===== Canon helpers (por nombre canónico normalizado) =====
const isCanonDia = (c) => normalizeName(c) === 'dia';
const isCanonMes = (c) => normalizeName(c) === 'mes';
const isCanonAnio = (c) => {
  const n = normalizeName(c);
  return n === 'anio' || n === 'año' || n === 'ano';
};

const isCanonCX = (c) => normalizeName(c) === 'cx';

const isCanonApellido = (c) => normalizeName(c) === 'apellido-paciente' || normalizeName(c) === 'apellido';
const isCanonNombre = (c) => normalizeName(c) === 'nombre-paciente' || normalizeName(c) === 'nombre';

// NO visible, se arma con apellido + nombre
const isCanonNombresPaciente = (c) => normalizeName(c) === 'nombres-paciente';

// Servicio fijo, NO visible
const isCanonServicio = (c) => normalizeName(c) === 'servicio';

// Edad (si existe)
const isCanonEdad = (c) => normalizeName(c) === 'edad';

// Edad-paciente (si existe)
const isCanonEdadPaciente = (c) => normalizeName(c) === 'edad-paciente';

// Campo "edad paciente" (NO mostrar en UI - porque ya la calculamos arriba)
const isCanonEdadPacienteUI = (c) => {
  const n = normalizeName(c);
  return n === 'edad-paciente' || n.includes('edad-paciente') || n.includes('edad_paciente');
};

// ART (ajustable)
const isCanonART = (c) => {
  const n = normalizeName(c);
  return n === 'art' || n.includes('art-') || n.includes('-art');
};

// Doctor (heurístico)
const isCanonDoctor = (c) => {
  const n = normalizeName(c);
  return (
    n === 'nombre-dr' ||
    n.includes('nombre-dr') ||
    n.includes('doctor') ||
    n.includes('dr') ||
    n.includes('medico') ||
    n.includes('cirujano')
  );
};

function computeAgeYears(d, m, y) {
  const dd = Number(d);
  const mm = Number(m);
  const yy = Number(y);

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return '';

  if (yy < 1900 || yy > 2100) return '';
  if (mm < 1 || mm > 12) return '';
  if (dd < 1 || dd > 31) return '';

  const today = new Date();
  const birth = new Date(yy, mm - 1, dd);
  if (Number.isNaN(birth.getTime())) return '';

  let age = today.getFullYear() - birth.getFullYear();

  const hadBirthday =
    today.getMonth() > birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());

  if (!hadBirthday) age -= 1;
  if (age < 0) return '';

  return String(age);
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});

  // Cargar mapping
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError('');

        const res = await fetch(MAPPING_URL, { cache: 'no-store' });
        if (!res.ok) throw new Error(`No pude cargar mapping (${res.status})`);
        const json = await res.json();

        if (!alive) return;
        setMapping(json);
      } catch (e) {
        setError(e?.message || 'Error cargando mapping');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // Capa canónica: oculta repetidos y replica internamente
  const canonical = useMemo(() => {
    if (!mapping) return null;

    const canonicalToInternal = {};
    const internalToCanonical = {};

    // 1) Aliases manuales
    for (const [canon, internals] of Object.entries(CANONICAL_ALIASES)) {
      canonicalToInternal[canon] = Array.from(new Set(internals));
      for (const internal of internals) internalToCanonical[internal] = canon;
    }

    // 2) Resto por normalización
    for (const internalName of Object.keys(mapping)) {
      if (internalToCanonical[internalName]) continue;
      const canon = normalizeName(internalName);
      internalToCanonical[internalName] = canon;
      if (!canonicalToInternal[canon]) canonicalToInternal[canon] = [];
      canonicalToInternal[canon].push(internalName);
    }

    for (const k of Object.keys(canonicalToInternal)) {
      canonicalToInternal[k] = Array.from(new Set(canonicalToInternal[k])).sort();
    }

    return { canonicalToInternal, internalToCanonical };
  }, [mapping]);

  // keys canónicos presentes
  const canonKeys = useMemo(() => {
    if (!canonical) return [];
    return Object.keys(canonical.canonicalToInternal);
  }, [canonical]);

  // canónicos detectados
  const canonART = useMemo(() => canonKeys.find(isCanonART), [canonKeys]);
  const canonCX = useMemo(() => canonKeys.find(isCanonCX), [canonKeys]);
  const canonDoctor = useMemo(() => canonKeys.find(isCanonDoctor), [canonKeys]);

  const canonApellido = useMemo(() => canonKeys.find(isCanonApellido), [canonKeys]);
  const canonNombre = useMemo(() => canonKeys.find(isCanonNombre), [canonKeys]);

  // NO visibles
  const canonNombres = useMemo(() => canonKeys.find(isCanonNombresPaciente), [canonKeys]);
  const canonServicio = useMemo(() => canonKeys.find(isCanonServicio), [canonKeys]);
  const canonEdad = useMemo(() => canonKeys.find(isCanonEdad), [canonKeys]);
  const canonEdadPaciente = useMemo(() => canonKeys.find(isCanonEdadPaciente), [canonKeys]);

  // fecha nac
  const canonDia = useMemo(() => canonKeys.find(isCanonDia), [canonKeys]);
  const canonMes = useMemo(() => canonKeys.find(isCanonMes), [canonKeys]);
  const canonAnio = useMemo(() => canonKeys.find(isCanonAnio), [canonKeys]);

  // Inicializar form con canónicos
  useEffect(() => {
    if (!canonical || !mapping) return;

    const initial = {};
    const keys = Object.keys(canonical.canonicalToInternal).sort((a, b) => a.localeCompare(b, 'es'));
    for (const k of keys) initial[k] = '';

    // Sexo especial
    const internals = Object.keys(mapping || {});
    const hasM = internals.includes('masculino-paciente');
    const hasF = internals.includes('femenino-paciente');
    if (hasM || hasF) initial['sexo'] = '';

    // Servicio fijo interno (NO visible)
    if (keys.some((k) => isCanonServicio(k))) {
      initial['servicio'] = 'PISO';
    }

    setForm(initial);
  }, [canonical, mapping]);

  function setValue(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function resetAll() {
    if (!canonical) return;

    const next = {};
    for (const k of Object.keys(canonical.canonicalToInternal)) next[k] = '';
    if (next.sexo !== undefined) next.sexo = '';

    if (Object.keys(canonical.canonicalToInternal).some((k) => isCanonServicio(k))) {
      next.servicio = 'PISO';
    }

    setForm(next);
  }

  // edad calculada
  const edadCalculada = useMemo(() => {
    const d = canonDia ? form?.[canonDia] : '';
    const m = canonMes ? form?.[canonMes] : '';
    const y = canonAnio ? form?.[canonAnio] : '';
    return computeAgeYears(d, m, y);
  }, [form, canonDia, canonMes, canonAnio]);

  // ✅ Auto-set de edad: guarda en "edad" y en "edad-paciente" (si existen)
  useEffect(() => {
    const next = edadCalculada ? `${edadCalculada} años` : '';
    if (!canonEdad && !canonEdadPaciente) return;

    setForm((prev) => {
      let changed = false;
      const out = { ...prev };

      if (canonEdad && (out?.[canonEdad] ?? '') !== next) {
        out[canonEdad] = next;
        changed = true;
      }

      if (canonEdadPaciente && (out?.[canonEdadPaciente] ?? '') !== next) {
        out[canonEdadPaciente] = next;
        changed = true;
      }

      return changed ? out : prev;
    });
  }, [edadCalculada, canonEdad, canonEdadPaciente]);

  // Resto de campos (no top, no ocultos)
  const orderedResto = useMemo(() => {
    if (!canonical) return [];

    const all = Object.keys(canonical.canonicalToInternal);
    const hidden = new Set(['masculino-paciente', 'femenino-paciente', 'sexo']);

    if (canonNombres) hidden.add(canonNombres);
    if (canonServicio) hidden.add(canonServicio);
    if (canonEdad) hidden.add(canonEdad);
    if (canonEdadPaciente) hidden.add(canonEdadPaciente);

    // Ocultar campos edad-paciente* del resto
    for (const k of all) {
      if (isCanonEdadPacienteUI(k)) hidden.add(k);
    }

    const top = new Set(
      [canonART, canonCX, canonDoctor, canonApellido, canonNombre, canonDia, canonMes, canonAnio].filter(Boolean)
    );

    return all
      .filter((k) => !hidden.has(k) && !top.has(k))
      .sort((a, b) => a.localeCompare(b, 'es'));
  }, [
    canonical,
    canonNombres,
    canonServicio,
    canonEdad,
    canonEdadPaciente,
    canonART,
    canonCX,
    canonDoctor,
    canonApellido,
    canonNombre,
    canonDia,
    canonMes,
    canonAnio,
  ]);

  function getCanonFieldType(canonName) {
    const internals = canonical?.canonicalToInternal?.[canonName] || [];
    const sample = mapping?.[internals?.[0]]?.[0];
    return sample?.field_type;
  }

  // ===== PDF generation (overlay solo datos) =====
  async function buildOverlayPdfBytes() {
    if (!mapping || !canonical) throw new Error('Mapping no cargado');

    const templateBytes = await fetch(TEMPLATE_URL, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`No pude cargar template PDF (${r.status})`);
      return r.arrayBuffer();
    });

    const templateDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const outDoc = await PDFDocument.create();
    const font = await outDoc.embedFont(StandardFonts.Helvetica);

    // páginas vacías del mismo tamaño
    const tplPages = templateDoc.getPages();
    for (const p of tplPages) {
      const { width, height } = p.getSize();
      outDoc.addPage([width, height]);
    }

    // --- Helpers de dibujo ---
    function drawTextOnOcc(outPage, occ, text) {
      const x = Number(occ.x_pt) + PRINT_OFFSET_X_PT;
      const y = Number(occ.y_pt) + PRINT_OFFSET_Y_PT;
      const w = Number(occ.w_pt);
      const h = Number(occ.h_pt);

      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) return;

      const size = clamp(h * 0.6, 8, 12);
      const dy = y + (h - size) * 0.5;
      const dx = x + Math.min(2, w * 0.05);

      const maxChars = Math.max(4, Math.floor(w / (size * 0.55)));
      const t = text.length > maxChars ? text.slice(0, maxChars) : text;

      outPage.drawText(t, { x: dx, y: dy, size, font });
    }

    function drawValueOnInternal(internalName, value) {
      const occurrences = mapping[internalName] || [];
      if (!occurrences.length) return;

      const fieldType = occurrences?.[0]?.field_type;
      const isBtn = isLikelyCheckbox(fieldType);
      const isTx = isLikelyText(fieldType);

      let v = value;
      if (isBtn) v = !!v;
      if (isTx) v = (v ?? '').toString();

      if (isTx && v.trim() === '') return;
      if (isBtn && v !== true) return;

      for (const occ of occurrences) {
        const pageIndex = (occ.page ?? 1) - 1;
        const outPage = outDoc.getPage(pageIndex);

        if (isBtn) {
          const x = Number(occ.x_pt) + PRINT_OFFSET_X_PT;
          const y = Number(occ.y_pt) + PRINT_OFFSET_Y_PT;
          const w = Number(occ.w_pt);
          const h = Number(occ.h_pt);
          const size = clamp(h * 0.9, 8, 14);

          outPage.drawText('X', { x: x + w * 0.25, y: y + h * 0.15, size, font });
        } else {
          drawTextOnOcc(outPage, occ, v);
        }
      }
    }

    // Variante: elegir el valor por ocurrencia (para páginas 3 y 6)
    function drawValueOnInternalByOcc(internalName, getValueForOcc) {
      const occurrences = mapping[internalName] || [];
      if (!occurrences.length) return;

      const fieldType = occurrences?.[0]?.field_type;
      const isBtn = isLikelyCheckbox(fieldType);
      const isTx = isLikelyText(fieldType);

      for (const occ of occurrences) {
        let v = getValueForOcc(occ);

        if (isBtn) v = !!v;
        if (isTx) v = (v ?? '').toString();

        if (isTx && v.trim() === '') continue;
        if (isBtn && v !== true) continue;

        const pageIndex = (occ.page ?? 1) - 1;
        const outPage = outDoc.getPage(pageIndex);

        if (isBtn) {
          const x = Number(occ.x_pt) + PRINT_OFFSET_X_PT;
          const y = Number(occ.y_pt) + PRINT_OFFSET_Y_PT;
          const w = Number(occ.w_pt);
          const h = Number(occ.h_pt);
          const size = clamp(h * 0.9, 8, 14);
          outPage.drawText('X', { x: x + w * 0.25, y: y + h * 0.15, size, font });
        } else {
          drawTextOnOcc(outPage, occ, v);
        }
      }
    }

    // ===== Valores derivados =====
    const apellido = canonApellido ? (form?.[canonApellido] ?? '').toString().trim() : '';
    const nombre = canonNombre ? (form?.[canonNombre] ?? '').toString().trim() : '';
    const nombreCompuesto = [apellido, nombre].filter(Boolean).join(' ').trim();

    const edadValuePrint = edadCalculada ? `${edadCalculada} años` : '';

    const doctorRaw = canonDoctor ? (form?.[canonDoctor] ?? '').toString().trim() : '';
    const doctorPrint = doctorRaw && !/^dr\.?\s/i.test(doctorRaw) ? `Dr. ${doctorRaw}` : doctorRaw;

    // ===== 1) Sexo (checkbox internos) =====
    const sexValue = form?.sexo; // 'M' | 'F' | ''
    const sexoInternals = [];
    if ((mapping['masculino-paciente'] || []).length) sexoInternals.push('masculino-paciente');
    if ((mapping['femenino-paciente'] || []).length) sexoInternals.push('femenino-paciente');

    if (sexValue && sexoInternals.length) {
      for (const internal of sexoInternals) {
        const shouldMark =
          (internal === 'masculino-paciente' && sexValue === 'M') ||
          (internal === 'femenino-paciente' && sexValue === 'F');

        if (!shouldMark) continue;
        drawValueOnInternal(internal, true);
      }
    }

    // ===== 2) Servicio fijo PISO (NO visible) =====
    if (canonServicio) {
      for (const internal of canonical.canonicalToInternal[canonServicio] || []) {
        drawValueOnInternal(internal, 'PISO');
      }
    }
    if ((mapping['servicio'] || []).length) drawValueOnInternal('servicio', 'PISO');

    // ===== 3) nombres-paciente (NO visible): apellido + nombre =====
    if (canonNombres) {
      for (const internal of canonical.canonicalToInternal[canonNombres] || []) {
        drawValueOnInternal(internal, nombreCompuesto);
      }
    }
    if ((mapping['nombres-paciente'] || []).length) drawValueOnInternal('nombres-paciente', nombreCompuesto);

    // ===== 4) Edad: imprimir en "edad" y en "edad-paciente" =====
    if (canonEdad) {
      for (const internal of canonical.canonicalToInternal[canonEdad] || []) {
        drawValueOnInternal(internal, edadValuePrint);
      }
    }
    if (canonEdadPaciente) {
      for (const internal of canonical.canonicalToInternal[canonEdadPaciente] || []) {
        drawValueOnInternal(internal, edadValuePrint);
      }
    }

    // fallback directo por si existen como internos
    if ((mapping['edad'] || []).length) drawValueOnInternal('edad', edadValuePrint);
    if ((mapping['edad-paciente'] || []).length) drawValueOnInternal('edad-paciente', edadValuePrint);

    // ===== 5) nombre-paciente: en páginas 3 y 6 usar nombreCompuesto =====
    if (canonNombre) {
      for (const internal of canonical.canonicalToInternal[canonNombre] || []) {
        drawValueOnInternalByOcc(internal, (occ) => {
          const p = Number(occ.page ?? 0); // 1-based
          if (p === 3 || p === 6) return nombreCompuesto; // nombre completo
          return nombre; // solo nombre
        });
      }
    }

    // ===== 6) Replicar resto de campos canónicos =====
    for (const canonName of Object.keys(canonical.canonicalToInternal)) {
      if (canonName === 'masculino-paciente' || canonName === 'femenino-paciente') continue;
      if (canonName === 'sexo') continue;

      // ya gestionados
      if (canonServicio && canonName === canonServicio) continue;
      if (canonNombres && canonName === canonNombres) continue;
      if (canonEdad && canonName === canonEdad) continue;
      if (canonEdadPaciente && canonName === canonEdadPaciente) continue;
      if (canonNombre && canonName === canonNombre) continue;

      // doctor: imprimir con prefijo Dr.
      let canonValue = form?.[canonName];
      if (canonDoctor && canonName === canonDoctor) canonValue = doctorPrint;

      const internalNames = canonical.canonicalToInternal[canonName] || [];
      for (const internal of internalNames) {
        drawValueOnInternal(internal, canonValue);
      }
    }

    return await outDoc.save();
  }

  async function printOverlay() {
    try {
      setError('');
      const bytes = await buildOverlayPdfBytes();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      iframe.src = url;

      document.body.appendChild(iframe);

      iframe.onload = () => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } finally {
          setTimeout(() => {
            URL.revokeObjectURL(url);
            iframe.remove();
          }, 1500);
        }
      };
    } catch (e) {
      setError(e?.message || 'Error al generar/imprimir');
    }
  }

  async function downloadOverlay() {
    try {
      setError('');
      const bytes = await buildOverlayPdfBytes();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `overlay-solo-datos-${Date.now()}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      setTimeout(() => URL.revokeObjectURL(url), 1200);
    } catch (e) {
      setError(e?.message || 'Error al generar descarga');
    }
  }

  // ===== Render =====
  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.heroLeft}>
            <h1 className={styles.h1}>Formulario · Impresión</h1>
            <p className={styles.lead}>Cargando campos…</p>
          </div>
        </div>
      </main>
    );
  }

  if (!mapping || !canonical) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.heroLeft}>
            <h1 className={styles.h1}>Formulario · Impresión</h1>
            <p className={styles.lead}>No se pudo cargar el mapping.</p>
          </div>

          <div className={styles.bannerError}>
            {error || 'Error desconocido'}
            <div className={styles.small}>
              Verificá:
              <div><code className={styles.code}>public/mappings/cd-campos_fields_rects.json</code></div>
              <div><code className={styles.code}>public/templates/cd-campos.pdf</code></div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const hasSexo = form?.sexo !== undefined;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.hero}>
          <div className={styles.heroLeft}>
            <h1 className={styles.h1}>Formulario · Impresión</h1>
          </div>

          <div className={`${styles.heroRight} ${styles.stickyActions}`}>
            <div className={styles.actionCard}>
              <div className={styles.actionTitle}>Acciones</div>
              <div className={styles.actionButtons}>
                <button className={styles.secondaryBtn} onClick={resetAll} type="button">
                  Limpiar
                </button>
                <button className={styles.ghostBtn} onClick={downloadOverlay} type="button">
                  Descargar PDF
                </button>
                <button className={styles.primaryBtn} onClick={printOverlay} type="button">
                  Imprimir
                </button>
              </div>
              <div className={styles.note}>
                Imprimir con <b>escala 100%</b> (sin “Ajustar a página”).
              </div>
            </div>
          </div>
        </div>

        {error ? <div className={styles.bannerError}>{error}</div> : null}

        <div className={styles.card}>
          <div className={styles.grid}>
            {canonART ? (
              <div className={`${styles.field} ${styles.fieldWide}`} key={canonART}>
                <div className={styles.labelRow}>
                  <label className={styles.fieldLabel}>ART</label>
                </div>
                <input
                  className={styles.input}
                  value={form?.[canonART] ?? ''}
                  onChange={(e) => setValue(canonART, e.target.value)}
                  placeholder="ART…"
                  autoComplete="on"
                />
              </div>
            ) : null}

            {canonCX ? (
              <div className={`${styles.field} ${styles.fieldWide}`} key={canonCX}>
                <div className={styles.labelRow}>
                  <label className={styles.fieldLabel}>CX a realizar</label>
                </div>
                <input
                  className={styles.input}
                  value={form?.[canonCX] ?? ''}
                  onChange={(e) => setValue(canonCX, e.target.value)}
                  placeholder="Cirugía a realizar…"
                  autoComplete="on"
                />
              </div>
            ) : null}

            {canonDoctor ? (
              <div className={`${styles.field} ${styles.fieldWide}`} key={canonDoctor}>
                <div className={styles.labelRow}>
                  <label className={styles.fieldLabel}>Dr que realiza la CX</label>
                </div>
                <input
                  className={styles.input}
                  value={form?.[canonDoctor] ?? ''}
                  onChange={(e) => setValue(canonDoctor, e.target.value)}
                  placeholder="Nombre del profesional…"
                  autoComplete="on"
                />
              </div>
            ) : null}
          </div>

          <div className={styles.divider} />

          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <div className={styles.labelRow}>
                <label className={styles.fieldLabel}>Paciente</label>
                <span className={styles.badge}>arma nombres-paciente</span>
              </div>

              <div className={styles.row2}>
                <div>
                  <div className={styles.subLabel}>Apellido</div>
                  <input
                    className={styles.input}
                    value={canonApellido ? (form?.[canonApellido] ?? '') : ''}
                    onChange={(e) => canonApellido && setValue(canonApellido, e.target.value)}
                    placeholder="Apellido…"
                    autoComplete="on"
                    disabled={!canonApellido}
                  />
                </div>

                <div>
                  <div className={styles.subLabel}>Nombre</div>
                  <input
                    className={styles.input}
                    value={canonNombre ? (form?.[canonNombre] ?? '') : ''}
                    onChange={(e) => canonNombre && setValue(canonNombre, e.target.value)}
                    placeholder="Nombre…"
                    autoComplete="on"
                    disabled={!canonNombre}
                  />
                </div>
              </div>
            </div>

            {hasSexo ? (
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label className={styles.fieldLabel}>Sexo</label>
                </div>
                <div className={styles.sexRowInline}>
                  <button
                    type="button"
                    className={`${styles.chip} ${form.sexo === 'M' ? styles.chipActive : ''}`}
                    onClick={() => setValue('sexo', form.sexo === 'M' ? '' : 'M')}
                  >
                    Masculino
                  </button>
                  <button
                    type="button"
                    className={`${styles.chip} ${form.sexo === 'F' ? styles.chipActive : ''}`}
                    onClick={() => setValue('sexo', form.sexo === 'F' ? '' : 'F')}
                  >
                    Femenino
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className={styles.grid}>
            <div className={`${styles.field} ${styles.fieldWide}`}>
              <div className={styles.labelRow}>
                <label className={styles.fieldLabel}>Fecha de nacimiento</label>
                <span className={styles.badge}>día / mes / año</span>
              </div>

              <div className={styles.row3}>
                <div>
                  <div className={styles.subLabel}>Día</div>
                  <input
                    className={styles.input}
                    value={canonDia ? (form?.[canonDia] ?? '') : ''}
                    onChange={(e) => canonDia && setValue(canonDia, e.target.value)}
                    placeholder="DD"
                    inputMode="numeric"
                    disabled={!canonDia}
                  />
                </div>
                <div>
                  <div className={styles.subLabel}>Mes</div>
                  <input
                    className={styles.input}
                    value={canonMes ? (form?.[canonMes] ?? '') : ''}
                    onChange={(e) => canonMes && setValue(canonMes, e.target.value)}
                    placeholder="MM"
                    inputMode="numeric"
                    disabled={!canonMes}
                  />
                </div>
                <div>
                  <div className={styles.subLabel}>Año</div>
                  <input
                    className={styles.input}
                    value={canonAnio ? (form?.[canonAnio] ?? '') : ''}
                    onChange={(e) => canonAnio && setValue(canonAnio, e.target.value)}
                    placeholder="AAAA"
                    inputMode="numeric"
                    disabled={!canonAnio}
                  />
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <div className={styles.labelRow}>
                <label className={styles.fieldLabel}>Edad</label>
                <span className={styles.badge}>auto</span>
              </div>
              <input
                className={styles.input}
                value={edadCalculada ? `${edadCalculada} años` : ''}
                placeholder="—"
                readOnly
                disabled
              />
            </div>
          </div>

          <div className={styles.divider} />

          <div className={styles.formHeaderRow}>
            <div>
              <div className={styles.cardTitle}>Resto de datos del paciente</div>
            </div>
          </div>

          <div className={styles.grid}>
            {orderedResto.map((canonName) => {
              const internals = canonical.canonicalToInternal[canonName] || [];
              const fieldType = getCanonFieldType(canonName);
              const isBtn = isLikelyCheckbox(fieldType);

              return (
                <div className={styles.field} key={canonName}>
                  <div className={styles.labelRow}>
                    <label className={styles.fieldLabel}>{humanizeKey(canonName)}</label>
                  </div>

                  {isBtn ? (
                    <label className={styles.checkboxRow}>
                      <input
                        type="checkbox"
                        checked={!!form[canonName]}
                        onChange={(e) => setValue(canonName, e.target.checked)}
                      />
                      <span>Marcar</span>
                    </label>
                  ) : (
                    <input
                      className={styles.input}
                      value={form?.[canonName] ?? ''}
                      onChange={(e) => setValue(canonName, e.target.value)}
                      placeholder="Completar…"
                      autoComplete="on"
                    />
                  )}

                  <div className={styles.hint}>
                    Internos:{' '}
                    <code className={styles.code}>{internals.slice(0, 2).join(', ')}</code>
                    {internals.length > 2 ? <span> +{internals.length - 2}</span> : null}
                  </div>
                </div>
              );
            })}
          </div>

          <br />
        </div>

        <div className={`${styles.heroRight} ${styles.stickyActions} mt-3`}>
          <div className={styles.actionCard}>
            <div className={styles.actionTitle}>Acciones</div>
            <div className={styles.actionButtons}>
           
              <button className={styles.ghostBtn} onClick={downloadOverlay} type="button">
                Descargar PDF
              </button>
          
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

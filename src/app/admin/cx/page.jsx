'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import { PDFDocument } from 'pdf-lib';
import Header from '@/components/Header/Header';

const MAPPING_URL = '/mappings/cd-campos_fields_rects.json';
const TEMPLATE_FRENTE_URL = '/templates/FRENTE-CX.pdf';
const TEMPLATE_DORSO_URL = '/templates/DORSO-CX.pdf';

const CANONICAL_ALIASES = {};
const SUGGESTIONS_MAX = 20;
const LS_KEY = 'cx_form_suggestions_v1';

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

function isLikelyCheckbox(fieldType) { return fieldType === '/Btn'; }

const isCanonDia = (c) => normalizeName(c) === 'dia';
const isCanonMes = (c) => normalizeName(c) === 'mes';
const isCanonAnio = (c) => { const n = normalizeName(c); return n === 'anio' || n === 'año' || n === 'ano'; };
const isCanonCX = (c) => normalizeName(c) === 'cx';
const isCanonApellido = (c) => normalizeName(c) === 'apellido-paciente' || normalizeName(c) === 'apellido';
const isCanonNombre = (c) => normalizeName(c) === 'nombre-paciente' || normalizeName(c) === 'nombre';
const isCanonNombresPaciente = (c) => normalizeName(c) === 'nombres-paciente';
const isCanonServicio = (c) => normalizeName(c) === 'servicio';
const isCanonEdad = (c) => normalizeName(c) === 'edad';
const isCanonEdadPaciente = (c) => normalizeName(c) === 'edad-paciente';
const isCanonEdadPacienteUI = (c) => { const n = normalizeName(c); return n === 'edad-paciente' || n.includes('edad-paciente') || n.includes('edad_paciente'); };
const isCanonART = (c) => { const n = normalizeName(c); return n === 'art' || n.includes('art-') || n.includes('-art'); };
const isCanonDoctor = (c) => { const n = normalizeName(c); return n === 'nombre-dr' || n.includes('nombre-dr') || n.includes('doctor') || n.includes('dr') || n.includes('medico') || n.includes('cirujano'); };
const isCanonLocalidad = (c) => normalizeName(c) === 'localidad';
const isCanonProvincia = (c) => normalizeName(c) === 'provincia';
const isCanonNacimientoPaciente = (c) => { const n = normalizeName(c); return n === 'nacimiento-paciente' || n === 'nacmiento-paciente' || n.includes('nacimiento') || n.includes('nacmiento'); };
const isCanonDomicilioPaciente = (c) => { const n = normalizeName(c); return n === 'domicilio-paciente' || n.includes('domicilio'); };
const isCanonHCPaciente = (c) => { const n = normalizeName(c); return n === 'hc-paciente' || n.includes('hc') || n.includes('historia-clinica'); };

function computeAgeYears(d, m, y) {
  const dd = Number(d), mm = Number(m), yy = Number(y);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) return '';
  if (yy < 1900 || yy > 2100 || mm < 1 || mm > 12 || dd < 1 || dd > 31) return '';
  const today = new Date();
  const birth = new Date(yy, mm - 1, dd);
  if (Number.isNaN(birth.getTime())) return '';
  let age = today.getFullYear() - birth.getFullYear();
  const hadBirthday = today.getMonth() > birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
  if (!hadBirthday) age -= 1;
  return age < 0 ? '' : String(age);
}

function safeUpper(v) { return v === null || v === undefined ? '' : String(v).toUpperCase(); }

function formatNumberWithThousands(value) {
  if (!value) return '';
  const n = String(value).replace(/[^\d]/g, '');
  return n ? n.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
}

function parseFormattedNumber(v) { return v ? String(v).replace(/\./g, '') : ''; }

function generateSafeFilename(baseName) {
  if (!baseName || baseName.trim() === '') return 'Paciente';
  return baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim().toUpperCase();
}

function loadSuggestions() {
  try { const raw = localStorage.getItem(LS_KEY); const data = raw ? JSON.parse(raw) : {}; return typeof data === 'object' && data ? data : {}; } catch { return {}; }
}
function saveSuggestions(next) { try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch { } }
function addSuggestion(sug, canonName, valueRaw) {
  const v = (valueRaw ?? '').toString().trim();
  if (!v) return sug;
  const val = v.toUpperCase();
  const prev = Array.isArray(sug?.[canonName]) ? sug[canonName] : [];
  const without = prev.filter((x) => (x ?? '').toString().toUpperCase() !== val);
  return { ...sug, [canonName]: [val, ...without].slice(0, SUGGESTIONS_MAX) };
}

// ── Sub-componente: input con datalist ──────────────────────────────────────
function AutoInput({ canonName, value, onChange, onBlur, suggestions, placeholder, autoComplete, disabled, inputMode }) {
  return (
    <>
      <input
        className={styles.input}
        name={canonName}
        autoComplete={autoComplete || 'on'}
        value={value ?? ''}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder || 'Completar…'}
        disabled={disabled}
        list={`dl-${canonName}`}
        inputMode={inputMode}
      />
      <datalist id={`dl-${canonName}`}>
        {(suggestions?.[canonName] || []).map((opt) => <option value={opt} key={opt} />)}
      </datalist>
    </>
  );
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});
  const [suggestions, setSuggestions] = useState({});

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true); setError('');
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
    return () => { alive = false; };
  }, []);

  const canonical = useMemo(() => {
    if (!mapping) return null;
    const canonicalToInternal = {};
    const internalToCanonical = {};
    for (const [canon, internals] of Object.entries(CANONICAL_ALIASES)) {
      canonicalToInternal[canon] = Array.from(new Set(internals));
      for (const internal of internals) internalToCanonical[internal] = canon;
    }
    for (const internalName of Object.keys(mapping)) {
      if (internalToCanonical[internalName]) continue;
      const canon = normalizeName(internalName);
      internalToCanonical[internalName] = canon;
      if (!canonicalToInternal[canon]) canonicalToInternal[canon] = [];
      canonicalToInternal[canon].push(internalName);
    }
    for (const k of Object.keys(canonicalToInternal)) canonicalToInternal[k] = Array.from(new Set(canonicalToInternal[k])).sort();
    return { canonicalToInternal, internalToCanonical };
  }, [mapping]);

  const canonKeys = useMemo(() => canonical ? Object.keys(canonical.canonicalToInternal) : [], [canonical]);

  const canonART = useMemo(() => canonKeys.find(isCanonART), [canonKeys]);
  const canonCX = useMemo(() => canonKeys.find(isCanonCX), [canonKeys]);
  const canonDoctor = useMemo(() => canonKeys.find(isCanonDoctor), [canonKeys]);
  const canonApellido = useMemo(() => canonKeys.find(isCanonApellido), [canonKeys]);
  const canonNombre = useMemo(() => canonKeys.find(isCanonNombre), [canonKeys]);
  const canonLocalidad = useMemo(() => canonKeys.find(isCanonLocalidad), [canonKeys]);
  const canonProvincia = useMemo(() => canonKeys.find(isCanonProvincia), [canonKeys]);
  const canonNacimientoPaciente = useMemo(() => canonKeys.find(isCanonNacimientoPaciente), [canonKeys]);
  const canonDomicilioPaciente = useMemo(() => canonKeys.find(isCanonDomicilioPaciente), [canonKeys]);
  const canonHCPaciente = useMemo(() => canonKeys.find(isCanonHCPaciente), [canonKeys]);
  const canonNombres = useMemo(() => canonKeys.find(isCanonNombresPaciente), [canonKeys]);
  const canonServicio = useMemo(() => canonKeys.find(isCanonServicio), [canonKeys]);
  const canonEdad = useMemo(() => canonKeys.find(isCanonEdad), [canonKeys]);
  const canonEdadPaciente = useMemo(() => canonKeys.find(isCanonEdadPaciente), [canonKeys]);
  const canonDia = useMemo(() => canonKeys.find(isCanonDia), [canonKeys]);
  const canonMes = useMemo(() => canonKeys.find(isCanonMes), [canonKeys]);
  const canonAnio = useMemo(() => canonKeys.find(isCanonAnio), [canonKeys]);

  useEffect(() => {
    if (!canonical || !mapping) return;
    const initial = {};
    for (const k of Object.keys(canonical.canonicalToInternal).sort((a, b) => a.localeCompare(b, 'es'))) initial[k] = '';
    const internals = Object.keys(mapping || {});
    if (internals.includes('masculino-paciente') || internals.includes('femenino-paciente')) initial['sexo'] = '';
    if (Object.keys(canonical.canonicalToInternal).some(isCanonServicio)) initial['servicio'] = 'PISO';
    setForm(initial);
  }, [canonical, mapping]);

  useEffect(() => {
    if (!canonical) return;
    let seeded = loadSuggestions();
    if (canonLocalidad) seeded = addSuggestion(seeded, canonLocalidad, 'CHAJARÍ');
    if (canonProvincia) seeded = addSuggestion(seeded, canonProvincia, 'ENTRE RIOS');
    if (canonNacimientoPaciente) {
      seeded = addSuggestion(seeded, canonNacimientoPaciente, 'CHAJARÍ, ENTRE RIOS');
      seeded = addSuggestion(seeded, canonNacimientoPaciente, 'CONCORDIA, ENTRE RIOS');
      seeded = addSuggestion(seeded, canonNacimientoPaciente, 'PARANÁ, ENTRE RIOS');
    }
    setSuggestions(seeded);
    saveSuggestions(seeded);
    setForm((prev) => {
      const out = { ...prev }; let changed = false;
      if (canonLocalidad && !(out?.[canonLocalidad] ?? '').toString().trim()) { out[canonLocalidad] = 'CHAJARÍ'; changed = true; }
      if (canonProvincia && !(out?.[canonProvincia] ?? '').toString().trim()) { out[canonProvincia] = 'ENTRE RIOS'; changed = true; }
      return changed ? out : prev;
    });
  }, [canonical, canonLocalidad, canonProvincia, canonNacimientoPaciente]);

  function setValue(name, value) { setForm((prev) => ({ ...prev, [name]: value })); }

  function commitSuggestion(canonName, value) {
    const nextSug = addSuggestion(suggestions, canonName, value);
    if (nextSug === suggestions) return;
    setSuggestions(nextSug);
    saveSuggestions(nextSug);
  }

  const edadCalculada = useMemo(() => {
    const d = canonDia ? form?.[canonDia] : '';
    const m = canonMes ? form?.[canonMes] : '';
    const y = canonAnio ? form?.[canonAnio] : '';
    return computeAgeYears(d, m, y);
  }, [form, canonDia, canonMes, canonAnio]);

  useEffect(() => {
    const next = edadCalculada ? `${edadCalculada} años` : '';
    if (!canonEdad && !canonEdadPaciente) return;
    setForm((prev) => {
      let changed = false; const out = { ...prev };
      if (canonEdad && (out?.[canonEdad] ?? '') !== next) { out[canonEdad] = next; changed = true; }
      if (canonEdadPaciente && (out?.[canonEdadPaciente] ?? '') !== next) { out[canonEdadPaciente] = next; changed = true; }
      return changed ? out : prev;
    });
  }, [edadCalculada, canonEdad, canonEdadPaciente]);

  const orderedResto = useMemo(() => {
    if (!canonical) return [];
    const all = Object.keys(canonical.canonicalToInternal);
    const knownSet = new Set([
      'masculino-paciente', 'femenino-paciente', 'sexo',
      canonNombres, canonServicio, canonEdad, canonEdadPaciente,
      canonART, canonCX, canonDoctor, canonApellido, canonNombre,
      canonDia, canonMes, canonAnio,
      canonLocalidad, canonProvincia, canonNacimientoPaciente, canonDomicilioPaciente, canonHCPaciente,
    ].filter(Boolean));
    for (const k of all) { if (isCanonEdadPacienteUI(k)) knownSet.add(k); }
    return all.filter((k) => !knownSet.has(k)).sort((a, b) => a.localeCompare(b, 'es'));
  }, [canonical, canonNombres, canonServicio, canonEdad, canonEdadPaciente, canonART, canonCX, canonDoctor, canonApellido, canonNombre, canonDia, canonMes, canonAnio, canonLocalidad, canonProvincia, canonNacimientoPaciente, canonDomicilioPaciente, canonHCPaciente]);

  function getCanonFieldType(canonName) {
    const internals = canonical?.canonicalToInternal?.[canonName] || [];
    return mapping?.[internals?.[0]]?.[0]?.field_type;
  }

  function getAutoCompleteAttr(canonName) {
    const n = normalizeName(canonName);
    if (n === 'provincia') return 'address-level1';
    if (n === 'localidad') return 'address-level2';
    if (n.includes('domicilio') || n.includes('direccion')) return 'street-address';
    if (n.includes('telefono') || n.includes('celular')) return 'tel';
    if (n.includes('dni') || n.includes('hc') || n.includes('historia-clinica')) return 'off';
    if (n.includes('nacimiento') || n.includes('nacmiento')) return 'address-level2';
    return 'on';
  }

  function generateFilename(type) {
    const apellido = canonApellido ? (form?.[canonApellido] ?? '').toString().trim() : '';
    const nombre = canonNombre ? (form?.[canonNombre] ?? '').toString().trim() : '';
    const baseName = apellido && nombre ? `${apellido} ${nombre}` : apellido || nombre || 'Paciente';
    const safeName = generateSafeFilename(baseName);
    return (!safeName || safeName.trim() === '') ? `Paciente-${type}-${Date.now()}` : `${safeName}-${type}`;
  }

  async function buildFilledPdfBytes(templateUrl) {
    if (!mapping || !canonical) throw new Error('Mapping no cargado');
    const templateBytes = await fetch(templateUrl, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`No pude cargar template PDF (${r.status})`);
      return r.arrayBuffer();
    });
    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const pdfForm = pdfDoc.getForm();

    const trySetText = (fieldName, value) => {
      const v = safeUpper((value ?? '').toString()).trim();
      if (!v) return;
      try { pdfForm.getTextField(fieldName).setText(v); } catch { }
    };
    const tryCheck = (fieldName, shouldCheck) => {
      if (!shouldCheck) return;
      try { pdfForm.getCheckBox(fieldName).check(); } catch { }
    };

    const apellido = canonApellido ? (form?.[canonApellido] ?? '').toString().trim() : '';
    const nombre = canonNombre ? (form?.[canonNombre] ?? '').toString().trim() : '';
    const nombresPaciente = [apellido, nombre].filter(Boolean).join(' ').trim();
    const edadValuePrint = edadCalculada ? `${edadCalculada} años` : '';
    const doctorRaw = canonDoctor ? (form?.[canonDoctor] ?? '').toString().trim() : '';
    const doctorPrint = doctorRaw && !/^dr\.?\s/i.test(doctorRaw) ? `Dr. ${doctorRaw}` : doctorRaw;

    trySetText('apellido-paciente', apellido);
    trySetText('nombre-paciente', nombre);
    trySetText('nombres-paciente', nombresPaciente);
    trySetText('edad', edadValuePrint);
    trySetText('edad-paciente', edadValuePrint);
    trySetText('servicio', 'PISO');

    const sexValue = form?.sexo;
    tryCheck('masculino-paciente', sexValue === 'M');
    tryCheck('femenino-paciente', sexValue === 'F');

    for (const canonName of Object.keys(canonical.canonicalToInternal)) {
      if (canonName === 'sexo') continue;
      let canonValue = form?.[canonName];
      if (canonName === canonHCPaciente && canonValue) canonValue = parseFormattedNumber(canonValue);
      if (canonDoctor && canonName === canonDoctor) canonValue = doctorPrint;
      if (canonEdad && canonName === canonEdad) canonValue = edadValuePrint;
      if (canonEdadPaciente && canonName === canonEdadPaciente) canonValue = edadValuePrint;
      if (canonNombres && canonName === canonNombres) canonValue = nombresPaciente;
      if (canonServicio && canonName === canonServicio) canonValue = 'PISO';
      const isBtn = isLikelyCheckbox(getCanonFieldType(canonName));
      for (const internal of (canonical.canonicalToInternal[canonName] || [])) {
        if (isBtn) tryCheck(internal, !!canonValue);
        else trySetText(internal, canonValue);
      }
      if (isBtn) tryCheck(canonName, !!canonValue);
      else trySetText(canonName, canonValue);
    }

    pdfForm.flatten();
    return await pdfDoc.save();
  }

  async function downloadPdf(templateUrl, type) {
    try {
      setError('');
      const bytes = await buildFilledPdfBytes(templateUrl);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${generateFilename(type)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1200);
    } catch (e) {
      setError(e?.message || 'Error al generar descarga');
    }
  }

  // ── Render: loading / error ────────────────────────────────────────────────
  if (loading) {
    return (
      <main className={styles.page}>
        <div className={styles.loadingState}>
          <div className={styles.loadingSpinner} />
          <p>Cargando campos del formulario…</p>
        </div>
      </main>
    );
  }

  if (!mapping || !canonical) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <div className={styles.bannerError}>
            <strong>Error:</strong> {error || 'No se pudo cargar el mapping.'}
            <div className={styles.small}>
              Verificá: <code className={styles.code}>public/mappings/cd-campos_fields_rects.json</code>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const hasSexo = form?.sexo !== undefined;
  const hasLocation = canonDomicilioPaciente || canonNacimientoPaciente || canonLocalidad || canonProvincia;

  // ── Render principal ───────────────────────────────────────────────────────
  return (
    <main className={styles.page}>
      <div className={styles.layout}>

        {/* ══ FORMULARIO ══════════════════════════════════════════════════════ */}
        <div className={styles.formColumn}>

          {error && <div className={styles.bannerError}>{error}</div>}

          {/* SECCIÓN 1 — Cirugía */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>🏥</span>
              <h2 className={styles.sectionTitle}>Datos de la Cirugía</h2>
            </div>
            <div className={`${styles.sectionBody} ${styles.cols3}`}>

              {canonCX && (
                <div className={`${styles.field} ${styles.fieldSpan2}`}>
                  <label className={styles.fieldLabel}>Cirugía a realizar</label>
                  <AutoInput canonName={canonCX} value={form?.[canonCX]}
                    onChange={(e) => setValue(canonCX, e.target.value)}
                    onBlur={(e) => commitSuggestion(canonCX, e.target.value)}
                    suggestions={suggestions} placeholder="Describir la cirugía…" />
                </div>
              )}

              {canonDoctor && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Médico cirujano</label>
                  <AutoInput canonName={canonDoctor} value={form?.[canonDoctor]}
                    onChange={(e) => setValue(canonDoctor, e.target.value)}
                    onBlur={(e) => commitSuggestion(canonDoctor, e.target.value)}
                    suggestions={suggestions} placeholder="Nombre del profesional…" />
                </div>
              )}

              {canonART && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>ART / Obra Social</label>
                  <AutoInput canonName={canonART} value={form?.[canonART]}
                    onChange={(e) => setValue(canonART, e.target.value)}
                    onBlur={(e) => commitSuggestion(canonART, e.target.value)}
                    suggestions={suggestions} placeholder="ART u obra social…" />
                </div>
              )}

            </div>
          </section>

          {/* SECCIÓN 2 — Paciente */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>👤</span>
              <h2 className={styles.sectionTitle}>Identificación del Paciente</h2>
            </div>
            <div className={`${styles.sectionBody} ${styles.cols4}`}>

              {canonApellido && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Apellido</label>
                  <AutoInput canonName={canonApellido} value={form?.[canonApellido]}
                    onChange={(e) => setValue(canonApellido, e.target.value)}
                    onBlur={(e) => commitSuggestion(canonApellido, e.target.value)}
                    suggestions={suggestions} placeholder="Apellido…" autoComplete="family-name" />
                </div>
              )}

              {canonNombre && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Nombre</label>
                  <AutoInput canonName={canonNombre} value={form?.[canonNombre]}
                    onChange={(e) => setValue(canonNombre, e.target.value)}
                    onBlur={(e) => commitSuggestion(canonNombre, e.target.value)}
                    suggestions={suggestions} placeholder="Nombre…" autoComplete="given-name" />
                </div>
              )}

              {canonHCPaciente && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>N° Historia Clínica</label>
                  <input className={styles.input} name={canonHCPaciente} autoComplete="off" inputMode="numeric"
                    value={formatNumberWithThousands(form?.[canonHCPaciente] ?? '')}
                    onChange={(e) => setValue(canonHCPaciente, parseFormattedNumber(e.target.value))}
                    onBlur={(e) => commitSuggestion(canonHCPaciente, e.target.value)}
                    placeholder="Ej: 12.345.678" />
                </div>
              )}

              {hasSexo && (
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Sexo</label>
                  <div className={styles.sexRowInline}>
                    <button type="button"
                      className={`${styles.chip} ${form.sexo === 'M' ? styles.chipActive : ''}`}
                      onClick={() => setValue('sexo', form.sexo === 'M' ? '' : 'M')}>
                      Masculino
                    </button>
                    <button type="button"
                      className={`${styles.chip} ${form.sexo === 'F' ? styles.chipActive : ''}`}
                      onClick={() => setValue('sexo', form.sexo === 'F' ? '' : 'F')}>
                      Femenino
                    </button>
                  </div>
                </div>
              )}

            </div>
          </section>

          {/* SECCIÓN 3 — Fecha nacimiento + Edad */}
          <section className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionIcon}>🎂</span>
              <h2 className={styles.sectionTitle}>Fecha de Nacimiento</h2>
              <span className={styles.sectionHint}>La edad se calcula automáticamente</span>
            </div>
            <div className={`${styles.sectionBody} ${styles.cols4}`}>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Día</label>
                <input className={styles.input} autoComplete="off" inputMode="numeric"
                  value={canonDia ? (form?.[canonDia] ?? '') : ''}
                  onChange={(e) => canonDia && setValue(canonDia, e.target.value)}
                  placeholder="DD" disabled={!canonDia} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Mes</label>
                <input className={styles.input} autoComplete="off" inputMode="numeric"
                  value={canonMes ? (form?.[canonMes] ?? '') : ''}
                  onChange={(e) => canonMes && setValue(canonMes, e.target.value)}
                  placeholder="MM" disabled={!canonMes} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Año</label>
                <input className={styles.input} autoComplete="off" inputMode="numeric"
                  value={canonAnio ? (form?.[canonAnio] ?? '') : ''}
                  onChange={(e) => canonAnio && setValue(canonAnio, e.target.value)}
                  placeholder="AAAA" disabled={!canonAnio} />
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>
                  Edad <span className={styles.badge}>auto</span>
                </label>
                <input className={`${styles.input} ${styles.inputReadonly}`}
                  value={edadCalculada ? `${edadCalculada} años` : '—'}
                  readOnly disabled />
              </div>

            </div>
          </section>

          {/* SECCIÓN 4 — Domicilio */}
          {hasLocation && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIcon}>📍</span>
                <h2 className={styles.sectionTitle}>Domicilio y Procedencia</h2>
              </div>
              <div className={`${styles.sectionBody} ${styles.cols3}`}>

                {canonDomicilioPaciente && (
                  <div className={`${styles.field} ${styles.fieldSpan2}`}>
                    <label className={styles.fieldLabel}>Domicilio</label>
                    <AutoInput canonName={canonDomicilioPaciente} value={form?.[canonDomicilioPaciente]}
                      onChange={(e) => setValue(canonDomicilioPaciente, e.target.value)}
                      onBlur={(e) => commitSuggestion(canonDomicilioPaciente, e.target.value)}
                      suggestions={suggestions} placeholder="Dirección completa…" autoComplete="street-address" />
                  </div>
                )}

                {canonLocalidad && (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Localidad</label>
                    <AutoInput canonName={canonLocalidad} value={form?.[canonLocalidad]}
                      onChange={(e) => setValue(canonLocalidad, e.target.value)}
                      onBlur={(e) => commitSuggestion(canonLocalidad, e.target.value)}
                      suggestions={suggestions} placeholder="Localidad…" autoComplete="address-level2" />
                  </div>
                )}

                {canonProvincia && (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Provincia</label>
                    <AutoInput canonName={canonProvincia} value={form?.[canonProvincia]}
                      onChange={(e) => setValue(canonProvincia, e.target.value)}
                      onBlur={(e) => commitSuggestion(canonProvincia, e.target.value)}
                      suggestions={suggestions} placeholder="Provincia…" autoComplete="address-level1" />
                  </div>
                )}

                {canonNacimientoPaciente && (
                  <div className={styles.field}>
                    <label className={styles.fieldLabel}>Lugar de Nacimiento</label>
                    <AutoInput canonName={canonNacimientoPaciente} value={form?.[canonNacimientoPaciente]}
                      onChange={(e) => setValue(canonNacimientoPaciente, e.target.value)}
                      onBlur={(e) => commitSuggestion(canonNacimientoPaciente, e.target.value)}
                      suggestions={suggestions} placeholder="Ciudad, Provincia…" />
                  </div>
                )}

              </div>
            </section>
          )}

          {/* SECCIÓN 5 — Datos adicionales */}
          {orderedResto.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHeader}>
                <span className={styles.sectionIcon}>📋</span>
                <h2 className={styles.sectionTitle}>Datos Adicionales</h2>
              </div>
              <div className={`${styles.sectionBody} ${styles.cols3}`}>
                {orderedResto.map((canonName) => {
                  const internals = canonical.canonicalToInternal[canonName] || [];
                  const isBtn = isLikelyCheckbox(getCanonFieldType(canonName));
                  return (
                    <div className={styles.field} key={canonName}>
                      <label className={styles.fieldLabel}>{humanizeKey(canonName)}</label>
                      {isBtn ? (
                        <label className={styles.checkboxRow}>
                          <input type="checkbox" checked={!!form[canonName]}
                            onChange={(e) => setValue(canonName, e.target.checked)} />
                          <span>Marcar</span>
                        </label>
                      ) : (
                        <AutoInput canonName={canonName} value={form?.[canonName]}
                          onChange={(e) => setValue(canonName, e.target.value)}
                          onBlur={(e) => commitSuggestion(canonName, e.target.value)}
                          suggestions={suggestions} autoComplete={getAutoCompleteAttr(canonName)} />
                      )}
                      <div className={styles.hint}>
                        <code className={styles.code}>{internals.slice(0, 2).join(', ')}</code>
                        {internals.length > 2 && <span>+{internals.length - 2}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

        </div>
        {/* ══ FIN FORMULARIO ═════════════════════════════════════════════════ */}

        {/* ══ SIDEBAR ═════════════════════════════════════════════════════════ */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>

            {/* Vista previa del paciente */}
            <div className={styles.patientPreview}>
              <div className={styles.patientAvatar}>
                {form.sexo === 'F' ? '👩' : form.sexo === 'M' ? '👨' : '🧑'}
              </div>
              <div className={styles.patientInfo}>
                <div className={styles.patientName}>
                  {[
                    canonApellido && form?.[canonApellido],
                    canonNombre && form?.[canonNombre],
                  ].filter(Boolean).join(' ') || <span className={styles.patientNameEmpty}>Sin nombre</span>}
                </div>
                {edadCalculada && <div className={styles.patientAge}>{edadCalculada} años</div>}
                {canonHCPaciente && form?.[canonHCPaciente] && (
                  <div className={styles.patientHC}>HC {formatNumberWithThousands(form[canonHCPaciente])}</div>
                )}
              </div>
            </div>

            {canonCX && form?.[canonCX] && (
              <div className={styles.cxPreview}>
                <span className={styles.cxLabel}>CX</span>
                <span className={styles.cxValue}>{form[canonCX]}</span>
              </div>
            )}

            <div className={styles.sidebarDivider} />

            <p className={styles.downloadTitle}>Descargar PDF</p>

            <button className={styles.downloadBtn} type="button"
              onClick={() => downloadPdf(TEMPLATE_FRENTE_URL, 'Frente')}>
              <span className={styles.downloadIcon}>↓</span>
              <span className={styles.downloadBtnText}>
                <strong>Frente</strong>
                <small>{generateFilename('Frente')}.pdf</small>
              </span>
            </button>

            <button className={styles.downloadBtn} type="button"
              onClick={() => downloadPdf(TEMPLATE_DORSO_URL, 'Dorso')}>
              <span className={styles.downloadIcon}>↓</span>
              <span className={styles.downloadBtnText}>
                <strong>Dorso</strong>
                <small>{generateFilename('Dorso')}.pdf</small>
              </span>
            </button>

            <p className={styles.sidebarNote}>
              Los PDFs se generan con los datos del formulario y se descargan listos para imprimir.
            </p>

          </div>
        </aside>
        {/* ══ FIN SIDEBAR ════════════════════════════════════════════════════ */}

      </div>
    </main>
  );
}
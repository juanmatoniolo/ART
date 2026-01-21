'use client';

import { useEffect, useMemo, useState } from 'react';
import styles from './page.module.css';
import { PDFDocument } from 'pdf-lib';
import Header from '@/components/Header/Header';

const MAPPING_URL = '/mappings/cd-campos_fields_rects.json';

// ✅ AHORA: PDFs INTERACTIVOS (AcroForm) a completar
const TEMPLATE_FRENTE_URL = '/templates/FRENTE-CX.pdf';
const TEMPLATE_DORSO_URL = '/templates/DORSO-CX.pdf';

// Si tenés duplicados con nombres distintos, agrupálos acá (opcional)
const CANONICAL_ALIASES = {};

// ===== Autocomplete (historial) =====
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

const isCanonNombresPaciente = (c) => normalizeName(c) === 'nombres-paciente';
const isCanonServicio = (c) => normalizeName(c) === 'servicio';

const isCanonEdad = (c) => normalizeName(c) === 'edad';
const isCanonEdadPaciente = (c) => normalizeName(c) === 'edad-paciente';

const isCanonEdadPacienteUI = (c) => {
  const n = normalizeName(c);
  return n === 'edad-paciente' || n.includes('edad-paciente') || n.includes('edad_paciente');
};

const isCanonART = (c) => {
  const n = normalizeName(c);
  return n === 'art' || n.includes('art-') || n.includes('-art');
};

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

// ✅ para defaults/autocomplete fuerte
const isCanonLocalidad = (c) => normalizeName(c) === 'localidad';
const isCanonProvincia = (c) => normalizeName(c) === 'provincia';

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

function safeUpper(v) {
  if (v === null || v === undefined) return '';
  return String(v).toUpperCase();
}

function loadSuggestions() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    return typeof data === 'object' && data ? data : {};
  } catch {
    return {};
  }
}

function saveSuggestions(next) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

function addSuggestion(sug, canonName, valueRaw) {
  const v = (valueRaw ?? '').toString().trim();
  if (!v) return sug;

  const val = v.toUpperCase(); // guardamos en MAYUS para evitar duplicados
  const prev = Array.isArray(sug?.[canonName]) ? sug[canonName] : [];
  const without = prev.filter((x) => (x ?? '').toString().toUpperCase() !== val);
  const nextArr = [val, ...without].slice(0, SUGGESTIONS_MAX);
  return { ...sug, [canonName]: nextArr };
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});

  // ✅ historial de sugerencias
  const [suggestions, setSuggestions] = useState({});

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

  const canonLocalidad = useMemo(() => canonKeys.find(isCanonLocalidad), [canonKeys]);
  const canonProvincia = useMemo(() => canonKeys.find(isCanonProvincia), [canonKeys]);

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

  // ✅ cargar historial + sembrar defaults (Chajarí / Entre Rios)
  useEffect(() => {
    if (!canonical) return;

    const loaded = loadSuggestions();

    let seeded = loaded;

    if (canonLocalidad) {
      seeded = addSuggestion(seeded, canonLocalidad, 'CHAJARÍ');
    }
    if (canonProvincia) {
      seeded = addSuggestion(seeded, canonProvincia, 'ENTRE RIOS');
    }

    setSuggestions(seeded);
    saveSuggestions(seeded);

    // opcional: si están vacíos, pre-rellenar (solo localidad/provincia)
    setForm((prev) => {
      const out = { ...prev };
      let changed = false;

      if (canonLocalidad && !(out?.[canonLocalidad] ?? '').toString().trim()) {
        out[canonLocalidad] = 'CHAJARÍ';
        changed = true;
      }
      if (canonProvincia && !(out?.[canonProvincia] ?? '').toString().trim()) {
        out[canonProvincia] = 'ENTRE RIOS';
        changed = true;
      }

      return changed ? out : prev;
    });
  }, [canonical, canonLocalidad, canonProvincia]);

  function setValue(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function commitSuggestion(canonName, value) {
    const nextSug = addSuggestion(suggestions, canonName, value);
    if (nextSug === suggestions) return;
    setSuggestions(nextSug);
    saveSuggestions(nextSug);
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

  function getAutoCompleteAttr(canonName) {
    const n = normalizeName(canonName);
    if (n === 'provincia') return 'address-level1';
    if (n === 'localidad') return 'address-level2';
    if (n.includes('domicilio') || n.includes('direccion')) return 'street-address';
    if (n.includes('telefono') || n.includes('celular')) return 'tel';
    if (n.includes('dni')) return 'off';
    return 'on';
  }

  // ==========================================================
  // ✅ NUEVO: PDF generation (rellenar PDF interactivo, sin coordenadas)
  // - Sirve para FRENTE y DORSO
  // - Deja el PDF listo para imprimir (flatten)
  // ==========================================================
  async function buildFilledPdfBytes(templateUrl) {
    if (!mapping || !canonical) throw new Error('Mapping no cargado');

    const templateBytes = await fetch(templateUrl, { cache: 'no-store' }).then((r) => {
      if (!r.ok) throw new Error(`No pude cargar template PDF (${r.status})`);
      return r.arrayBuffer();
    });

    const pdfDoc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const pdfForm = pdfDoc.getForm();

    // Helpers tolerantes (si no existe el campo, no rompe)
    const trySetText = (fieldName, value) => {
      const v = safeUpper((value ?? '').toString()).trim();
      if (!v) return;
      try {
        pdfForm.getTextField(fieldName).setText(v);
      } catch {
        // ignore
      }
    };

    const tryCheck = (fieldName, shouldCheck) => {
      if (!shouldCheck) return;
      try {
        pdfForm.getCheckBox(fieldName).check();
      } catch {
        // ignore
      }
    };

    // ===== Valores derivados =====
    const apellido = canonApellido ? (form?.[canonApellido] ?? '').toString().trim() : '';
    const nombre = canonNombre ? (form?.[canonNombre] ?? '').toString().trim() : '';
    const nombresPaciente = [apellido, nombre].filter(Boolean).join(' ').trim(); // ✅ CONCAT

    const edadValuePrint = edadCalculada ? `${edadCalculada} años` : '';

    const doctorRaw = canonDoctor ? (form?.[canonDoctor] ?? '').toString().trim() : '';
    const doctorPrint = doctorRaw && !/^dr\.?\s/i.test(doctorRaw) ? `Dr. ${doctorRaw}` : doctorRaw;

    // ===== Reglas explícitas que pediste =====
    // Paciente (campos exactos del PDF)
    trySetText('apellido-paciente', apellido);
    trySetText('nombre-paciente', nombre);
    trySetText('nombres-paciente', nombresPaciente);

    // Edad (si existe)
    trySetText('edad', edadValuePrint);
    trySetText('edad-paciente', edadValuePrint);

    // Servicio fijo (si existe)
    trySetText('servicio', 'PISO');

    // Sexo (checkbox internos)
    const sexValue = form?.sexo; // 'M' | 'F' | ''
    tryCheck('masculino-paciente', sexValue === 'M');
    tryCheck('femenino-paciente', sexValue === 'F');

    // ===== Replicar el resto de campos (por internos y por canónico) =====
    for (const canonName of Object.keys(canonical.canonicalToInternal)) {
      if (canonName === 'sexo') continue;

      let canonValue = form?.[canonName];

      // overrides
      if (canonDoctor && canonName === canonDoctor) canonValue = doctorPrint;
      if (canonEdad && canonName === canonEdad) canonValue = edadValuePrint;
      if (canonEdadPaciente && canonName === canonEdadPaciente) canonValue = edadValuePrint;
      if (canonNombres && canonName === canonNombres) canonValue = nombresPaciente;
      if (canonServicio && canonName === canonServicio) canonValue = 'PISO';

      const fieldType = getCanonFieldType(canonName);
      const isBtn = isLikelyCheckbox(fieldType);

      const internalNames = canonical.canonicalToInternal[canonName] || [];

      // 1) intentar por internal name
      for (const internal of internalNames) {
        if (isBtn) tryCheck(internal, !!canonValue);
        else trySetText(internal, canonValue);
      }

      // 2) intentar por canon name
      if (isBtn) tryCheck(canonName, !!canonValue);
      else trySetText(canonName, canonValue);
    }

    // ✅ Para imprimir: "aplana" los campos (queda no editable, pero visible e imprimible)
    pdfForm.flatten();

    return await pdfDoc.save();
  }

  async function downloadPdf(templateUrl, filenameBase) {
    try {
      setError('');
      const bytes = await buildFilledPdfBytes(templateUrl);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}-${Date.now()}.pdf`;
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
              <div>
                <code className={styles.code}>public/mappings/cd-campos_fields_rects.json</code>
              </div>
              <div>
                <code className={styles.code}>public/templates/FRENTE-CX.pdf</code>
              </div>
              <div>
                <code className={styles.code}>public/templates/DORSO-CX.pdf</code>
              </div>
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
        {error ? <div className={styles.bannerError}>{error}</div> : null}
        <Header />
        <div className={styles.card}>
          <div className={styles.grid}>
            {canonART ? (
              <div className={`${styles.field} ${styles.fieldWide}`} key={canonART}>
                <div className={styles.labelRow}>
                  <label className={styles.fieldLabel}>ART</label>
                </div>
                <input
                  className={styles.input}
                  name={canonART}
                  autoComplete="on"
                  value={form?.[canonART] ?? ''}
                  onChange={(e) => setValue(canonART, e.target.value)}
                  onBlur={(e) => commitSuggestion(canonART, e.target.value)}
                  placeholder="ART…"
                />
                <datalist id={`dl-${canonART}`}>
                  {(suggestions?.[canonART] || []).map((opt) => (
                    <option value={opt} key={opt} />
                  ))}
                </datalist>
              </div>
            ) : null}

            {canonCX ? (
              <div className={`${styles.field} ${styles.fieldWide}`} key={canonCX}>
                <div className={styles.labelRow}>
                  <label className={styles.fieldLabel}>CX a realizar</label>
                </div>
                <input
                  className={styles.input}
                  name={canonCX}
                  autoComplete="on"
                  value={form?.[canonCX] ?? ''}
                  onChange={(e) => setValue(canonCX, e.target.value)}
                  onBlur={(e) => commitSuggestion(canonCX, e.target.value)}
                  placeholder="Cirugía a realizar…"
                  list={`dl-${canonCX}`}
                />
                <datalist id={`dl-${canonCX}`}>
                  {(suggestions?.[canonCX] || []).map((opt) => (
                    <option value={opt} key={opt} />
                  ))}
                </datalist>
              </div>
            ) : null}

            {canonDoctor ? (
              <div className={`${styles.field} ${styles.fieldWide}`} key={canonDoctor}>
                <div className={styles.labelRow}>
                  <label className={styles.fieldLabel}>Dr que realiza la CX</label>
                </div>
                <input
                  className={styles.input}
                  name={canonDoctor}
                  autoComplete="on"
                  value={form?.[canonDoctor] ?? ''}
                  onChange={(e) => setValue(canonDoctor, e.target.value)}
                  onBlur={(e) => commitSuggestion(canonDoctor, e.target.value)}
                  placeholder="Nombre del profesional…"
                  list={`dl-${canonDoctor}`}
                />
                <datalist id={`dl-${canonDoctor}`}>
                  {(suggestions?.[canonDoctor] || []).map((opt) => (
                    <option value={opt} key={opt} />
                  ))}
                </datalist>
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
                    name={canonApellido || 'apellido'}
                    autoComplete="family-name"
                    value={canonApellido ? (form?.[canonApellido] ?? '') : ''}
                    onChange={(e) => canonApellido && setValue(canonApellido, e.target.value)}
                    onBlur={(e) => canonApellido && commitSuggestion(canonApellido, e.target.value)}
                    placeholder="Apellido…"
                    disabled={!canonApellido}
                    list={canonApellido ? `dl-${canonApellido}` : undefined}
                  />
                  {canonApellido ? (
                    <datalist id={`dl-${canonApellido}`}>
                      {(suggestions?.[canonApellido] || []).map((opt) => (
                        <option value={opt} key={opt} />
                      ))}
                    </datalist>
                  ) : null}
                </div>

                <div>
                  <div className={styles.subLabel}>Nombre</div>
                  <input
                    className={styles.input}
                    name={canonNombre || 'nombre'}
                    autoComplete="given-name"
                    value={canonNombre ? (form?.[canonNombre] ?? '') : ''}
                    onChange={(e) => canonNombre && setValue(canonNombre, e.target.value)}
                    onBlur={(e) => canonNombre && commitSuggestion(canonNombre, e.target.value)}
                    placeholder="Nombre…"
                    disabled={!canonNombre}
                    list={canonNombre ? `dl-${canonNombre}` : undefined}
                  />
                  {canonNombre ? (
                    <datalist id={`dl-${canonNombre}`}>
                      {(suggestions?.[canonNombre] || []).map((opt) => (
                        <option value={opt} key={opt} />
                      ))}
                    </datalist>
                  ) : null}
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
                    name={canonDia || 'dia'}
                    autoComplete="off"
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
                    name={canonMes || 'mes'}
                    autoComplete="off"
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
                    name={canonAnio || 'anio'}
                    autoComplete="off"
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
              <input className={styles.input} value={edadCalculada ? `${edadCalculada} años` : ''} placeholder="—" readOnly disabled />
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
                      <input type="checkbox" checked={!!form[canonName]} onChange={(e) => setValue(canonName, e.target.checked)} />
                      <span>Marcar</span>
                    </label>
                  ) : (
                    <>
                      <input
                        className={styles.input}
                        name={canonName}
                        autoComplete={getAutoCompleteAttr(canonName)}
                        value={form?.[canonName] ?? ''}
                        onChange={(e) => setValue(canonName, e.target.value)}
                        onBlur={(e) => commitSuggestion(canonName, e.target.value)}
                        placeholder="Completar…"
                        list={`dl-${canonName}`}
                      />
                      <datalist id={`dl-${canonName}`}>
                        {(suggestions?.[canonName] || []).map((opt) => (
                          <option value={opt} key={opt} />
                        ))}
                      </datalist>
                    </>
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
              {/* ✅ Descargables imprimibles */}
              <button
                className={styles.ghostBtn}
                onClick={() => downloadPdf(TEMPLATE_FRENTE_URL, 'FRENTE-CX-completado')}
                type="button"
              >
                Descargar FRENTE-CX
              </button>

              <button
                className={styles.ghostBtn}
                onClick={() => downloadPdf(TEMPLATE_DORSO_URL, 'DORSO-CX-completado')}
                type="button"
              >
                Descargar DORSO-CX
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

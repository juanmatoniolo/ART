'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { PDFDocument } from 'pdf-lib';
import Header from '@/components/Header/Header';

// ==================== CONSTANTES Y FUNCIONES AUXILIARES ====================
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

const isCanonDia = (c) => {
  const n = normalizeName(c);
  return n === 'dia' || n === 'día';
};

const isCanonMes = (c) => {
  const n = normalizeName(c);
  return n === 'mes';
};

const isCanonAnio = (c) => {
  const n = normalizeName(c);
  return n === 'anio' || n === 'año' || n === 'ano';
};

const isCanonCX = (c) => {
  const n = normalizeName(c);
  return n === 'cx';
};

const isCanonApellido = (c) => {
  const n = normalizeName(c);
  return n === 'apellido-paciente' || n === 'apellido';
};

const isCanonNombre = (c) => {
  const n = normalizeName(c);
  return n === 'nombre-paciente' || n === 'nombre';
};

const isCanonNombresPaciente = (c) => {
  const n = normalizeName(c);
  return n === 'nombres-paciente';
};

const isCanonServicio = (c) => {
  const n = normalizeName(c);
  return n === 'servicio';
};

const isCanonEdad = (c) => {
  const n = normalizeName(c);
  return n === 'edad';
};

const isCanonEdadPaciente = (c) => {
  const n = normalizeName(c);
  return n === 'edad-paciente';
};

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
  return n === 'nombre-dr' || n.includes('nombre-dr') || n.includes('doctor') || n.includes('dr') || n.includes('medico') || n.includes('cirujano');
};

const isCanonLocalidad = (c) => {
  const n = normalizeName(c);
  return n === 'localidad' || n === 'localidad-paciente';
};

const isCanonProvincia = (c) => {
  const n = normalizeName(c);
  return n === 'provincia' || n === 'provincia-paciente';
};

const isCanonNacimientoPaciente = (c) => {
  const n = normalizeName(c);
  return n === 'nacimiento-paciente' || n === 'nacmiento-paciente' || n.includes('nacimiento') || n.includes('nacmiento');
};

const isCanonDomicilioPaciente = (c) => {
  const n = normalizeName(c);
  return n === 'domicilio-paciente' || n.includes('domicilio');
};

const isCanonHCPaciente = (c) => {
  const n = normalizeName(c);
  return n === 'hc-paciente' || n.includes('hc') || n.includes('historia-clinica');
};

const isCanonDNI = (c) => {
  const n = normalizeName(c);
  return n === 'dni-paciente' || n === 'dni';
};

const isCanonSexo = (c) => {
  const n = normalizeName(c);
  return n === 'sexo' || n === 'sexo-paciente';
};

const isCanonTelefono = (c) => {
  const n = normalizeName(c);
  return n === 'telefono-paciente' || n.includes('telefono') || n.includes('teléfono');
};

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

// ==================== COMPONENTES INTERNOS ====================
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

// Componente selector de pacientes
function PacienteSelector({ onSelect, selectedPacienteId }) {
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchPacientes = async () => {
      try {
        const res = await fetch("https://datos-clini-default-rtdb.firebaseio.com/pacientes.json");
        const data = await res.json();
        if (data) {
          const list = Object.entries(data).map(([id, value]) => ({
            id,
            ...value,
            nombreCompleto: `${value.trabajador?.apellido || ""} ${value.trabajador?.nombre || ""}`.trim(),
            dni: value.trabajador?.dni || "",
          }));
          setPacientes(list);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPacientes();
  }, []);

  const filtered = pacientes.filter(p =>
    p.nombreCompleto.toLowerCase().includes(search.toLowerCase()) ||
    p.dni.includes(search)
  );

  if (loading) return <div className={styles.loadingSpinner}>Cargando pacientes...</div>;

  return (
    <div className={styles.pacienteSelector}>
      <input
        type="text"
        placeholder="Buscar por nombre o DNI..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={styles.input}
      />
      <div className={styles.pacienteList}>
        {filtered.map(p => (
          <div
            key={p.id}
            className={`${styles.pacienteItem} ${selectedPacienteId === p.id ? styles.selected : ''}`}
            onClick={() => onSelect(p)}
          >
            <strong>{p.nombreCompleto}</strong> <span className={styles.pacienteDni}>(DNI: {p.dni || "—"})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== PÁGINA PRINCIPAL ====================
export default function Page() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [mapping, setMapping] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({});
  const [suggestions, setSuggestions] = useState({});
  const [mode, setMode] = useState('manual'); // 'manual' o 'paciente'
  const [selectedPaciente, setSelectedPaciente] = useState(null);
  const [fechaEstimada, setFechaEstimada] = useState('');
  const [saving, setSaving] = useState(false);

  // Cargar mapping
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

  // Construir canonical
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
  const canonDNI = useMemo(() => canonKeys.find(isCanonDNI), [canonKeys]);
  const canonSexo = useMemo(() => canonKeys.find(isCanonSexo), [canonKeys]);
  const canonTelefono = useMemo(() => canonKeys.find(isCanonTelefono), [canonKeys]);


  // Inicializar formulario
  useEffect(() => {
    if (!canonical || !mapping) return;
    const initial = {};
    for (const k of Object.keys(canonical.canonicalToInternal).sort((a, b) => a.localeCompare(b, 'es'))) initial[k] = '';
    const internals = Object.keys(mapping || {});
    if (internals.includes('masculino-paciente') || internals.includes('femenino-paciente')) initial['sexo'] = '';
    if (Object.keys(canonical.canonicalToInternal).some(isCanonServicio)) initial['servicio'] = 'PISO';
    setForm(initial);
  }, [canonical, mapping]);

  // Cargar sugerencias iniciales
  // ... (todo el código anterior hasta el useEffect de sugerencias)

  // Cargar sugerencias iniciales (sin médicos)
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
  }, [canonical, canonLocalidad, canonProvincia, canonNacimientoPaciente]); // ← 4 dependencias fijas

  // Cargar sugerencias de médicos (independiente)
  useEffect(() => {
    if (!canonDoctor) return;
    let seeded = loadSuggestions();
    const doctoresLista = [
      "BRARDA AGUSTIN",
      "CANAGLIA GUSTAVO",
      "CIANCIOSI SEBASTIAN",
      "DEL PUERTO RODRIGO",
      "GIMENEZ MARTIN",
      "PERTUS DIEGO"
    ];
    doctoresLista.forEach(dr => {
      seeded = addSuggestion(seeded, canonDoctor, dr);
    });
    setSuggestions(seeded);
    saveSuggestions(seeded);
  }, [canonDoctor]); // ← dependencia fija de 1 elemento

  // Precargar datos del paciente seleccionado
  useEffect(() => {
    if (mode === 'paciente' && selectedPaciente) {
      console.log('Paciente seleccionado:', selectedPaciente);
      const t = selectedPaciente.trabajador || {};
      const art = selectedPaciente.ART || {};
      const newForm = { ...form };

      console.log('Datos del trabajador:', t);
      console.log('ART:', art);

      // Asignar valores
      if (canonApellido) {
        console.log(`Asignando canonApellido (${canonApellido}) = ${t.apellido}`);
        newForm[canonApellido] = t.apellido || '';
      }
      if (canonNombre) {
        console.log(`Asignando canonNombre (${canonNombre}) = ${t.nombre}`);
        newForm[canonNombre] = t.nombre || '';
      }
      if (canonDNI) {
        console.log(`Asignando canonDNI (${canonDNI}) = ${t.dni}`);
        newForm[canonDNI] = t.dni || '';
      }
      if (canonEdad) {
        const edad = t.edad ? `${t.edad} años` : '';
        console.log(`Asignando canonEdad (${canonEdad}) = ${edad}`);
        newForm[canonEdad] = edad;
      }
      if (canonEdadPaciente) {
        const edad = t.edad ? `${t.edad} años` : '';
        console.log(`Asignando canonEdadPaciente (${canonEdadPaciente}) = ${edad}`);
        newForm[canonEdadPaciente] = edad;
      }

      // 🔹 Asignación del sexo (independiente de canonSexo)
      if (t.sexo) {
        console.log(`Asignando sexo = ${t.sexo}`);
        newForm.sexo = t.sexo;
      }

      if (canonTelefono && t.telefono) {
        console.log(`Asignando canonTelefono (${canonTelefono}) = ${t.telefono}`);
        newForm[canonTelefono] = t.telefono;
      }
      if (canonDia && t.nacimiento) {
        const [y, m, d] = t.nacimiento.split('-');
        console.log(`Asignando canonDia (${canonDia}) = ${d}, canonMes = ${m}, canonAnio = ${y}`);
        newForm[canonDia] = d || '';
        newForm[canonMes] = m || '';
        newForm[canonAnio] = y || '';
      }
      if (canonLocalidad && t.localidad) {
        console.log(`Asignando canonLocalidad (${canonLocalidad}) = ${t.localidad}`);
        newForm[canonLocalidad] = t.localidad;
      }
      if (canonProvincia && t.provincia) {
        console.log(`Asignando canonProvincia (${canonProvincia}) = ${t.provincia}`);
        newForm[canonProvincia] = t.provincia;
      }
      if (canonDomicilioPaciente) {
        const calleNumero = `${t.calle || ''} ${t.numero || ''}`.trim();
        console.log(`Asignando canonDomicilioPaciente (${canonDomicilioPaciente}) = ${calleNumero}`);
        newForm[canonDomicilioPaciente] = calleNumero;
      }
      if (canonART && art.nombre) {
        console.log(`Asignando canonART (${canonART}) = ${art.nombre}`);
        newForm[canonART] = art.nombre;
      }

      console.log('Nuevo form antes de setForm:', newForm);
      setForm(newForm);
    }
  }, [selectedPaciente, mode, canonical]);
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
      canonTelefono,
    ].filter(Boolean));
    for (const k of all) { if (isCanonEdadPacienteUI(k)) knownSet.add(k); }
    return all.filter((k) => !knownSet.has(k)).sort((a, b) => a.localeCompare(b, 'es'));
  }, [canonical, canonNombres, canonServicio, canonEdad, canonEdadPaciente, canonART, canonCX, canonDoctor, canonApellido, canonNombre, canonDia, canonMes, canonAnio, canonLocalidad, canonProvincia, canonNacimientoPaciente, canonDomicilioPaciente, canonHCPaciente, canonTelefono]);

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

  async function guardarCX() {
    if (!fechaEstimada) {
      alert("Por favor ingrese una fecha estimativa para la cirugía");
      return;
    }
    const apellido = canonApellido ? form[canonApellido] : '';
    const nombre = canonNombre ? form[canonNombre] : '';
    if (!apellido || !nombre) {
      alert("Por favor complete al menos apellido y nombre del paciente");
      return;
    }

    setSaving(true);
    try {
      const data = {
        pacienteId: mode === 'paciente' ? selectedPaciente?.id : null,
        pacienteDatos: {
          apellido,
          nombre,
          dni: form[canonDNI] || '',
          fechaNacimiento: form[canonAnio] && form[canonMes] && form[canonDia] ? `${form[canonAnio]}-${form[canonMes]}-${form[canonDia]}` : '',
          edad: edadCalculada,
          sexo: form.sexo,
          localidad: form[canonLocalidad] || '',
          provincia: form[canonProvincia] || '',
          domicilio: form[canonDomicilioPaciente] || '',
          telefono: form[canonTelefono] || '',
        },
        fechaEstimada,
        formulario: form,
        realizada: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const res = await fetch("https://datos-clini-default-rtdb.firebaseio.com/cirugias.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Error al guardar");
      alert("Cirugía guardada correctamente. Ahora aparece en 'Programadas'.");
    } catch (err) {
      console.error(err);
      alert("Error al guardar la cirugía");
    } finally {
      setSaving(false);
    }
  }

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

  return (
    <main className={styles.page}>
      <div className={styles.layout}>
        {/* COLUMNA FORMULARIO */}
        <div className={styles.formColumn}>
          {error && <div className={styles.bannerError}>{error}</div>}

          {/* Selector de modo + botón a programadas */}
          <div className={styles.headerRow}>
            <div className={styles.modeSelector}>
              <button className={`${styles.modeBtn} ${mode === 'manual' ? styles.active : ''}`} onClick={() => setMode('manual')}>
                Cargar manualmente
              </button>
              <button className={`${styles.modeBtn} ${mode === 'paciente' ? styles.active : ''}`} onClick={() => setMode('paciente')}>
                Desde paciente existente
              </button>
            </div>
            <button
              className={styles.programadasBtn}
              onClick={() => router.push('/admin/cx/programada')}
            >
              📋 Ver Cirugías Programadas
            </button>
          </div>

          {mode === 'paciente' && (
            <div className={styles.pacienteSection}>
              <h3>Seleccionar paciente</h3>
              <PacienteSelector onSelect={setSelectedPaciente} selectedPacienteId={selectedPaciente?.id} />
              {selectedPaciente && (
                <div className={styles.selectedPacienteInfo}>
                  <strong>Paciente seleccionado:</strong> {selectedPaciente.nombreCompleto} (DNI: {selectedPaciente.dni || "—"})
                </div>
              )}
            </div>
          )}

          {/* ========== FORMULARIO ========== */}
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

          {/* Campo de fecha estimativa y botón guardar */}
          <div className={styles.fechaSection}>
            <label className={styles.fieldLabel}>Fecha estimativa de Cirugía</label>
            <input type="date" value={fechaEstimada} onChange={(e) => setFechaEstimada(e.target.value)} className={styles.input} />
          </div>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} onClick={guardarCX} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Cirugía'}
            </button>
          </div>
        </div>

        {/* SIDEBAR */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarCard}>
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
      </div>
    </main>
  );
}
'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ref, set, get, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import useDoctors from '@/app/admin/medicos/hooks/useDoctors';
import { useDebounce } from '@/hooks/useDebounce';
import Fuse from 'fuse.js';
import {
    money,
    calcularPractica,
    obtenerHonorariosAoter,
} from '../Facturacion/utils/calculos';

import styles from './page.module.css';
import {
    fmtDate,
    sanitizeForFirebase,
    extraerValoresConvenio,
    tipoCostoPorOrigen,
    buildPrintHtml,
} from './helpers';
import { SaveAtajoModal, AtajosModal } from './AtajosModal';
import Estadisticas from './Estadisticas';

// =====================================================================
//  HELPERS LOCALES
// =====================================================================
const todayISO = () => new Date().toISOString().split('T')[0];
const makeId = (p = 'rp') =>
    `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const initialPaciente = () => ({
    pacienteId: '', nombreCompleto: '', dni: '', artSeguro: '', nroSiniestro: '',
});
const initialMedico = () => ({
    id: '', nombre: '', apellido: '', matricula: '', especialidad: '',
});
const newRp = () => ({
    id: makeId(),
    tipoDoc: 'RP',
    esLab: false,
    paciente: initialPaciente(),
    medico: initialMedico(),
    practicas: [],
    estudiosLab: [],
    solicitaManual: '',   // 👈 texto editable de "Se solicita"
    diagnostico: '',
    fecha: todayISO(),
});

// =====================================================================
//  SUBCOMPONENTES
// =====================================================================
function PacientePicker({ paciente, setPaciente, pacientes, loading, onFocusLoad }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        const onClick = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const results = useMemo(() => {
        if (!q.trim()) return [];
        const t = q.toLowerCase();
        return pacientes
            .filter((p) => {
                const n = `${p.trabajador?.apellido || ''} ${p.trabajador?.nombre || ''}`.toLowerCase();
                const d = p.trabajador?.dni || '';
                return n.includes(t) || d.includes(t);
            })
            .slice(0, 8);
    }, [q, pacientes]);

    const select = (p) => {
        const t = p.trabajador || {};
        const art = p.ART || {};
        setPaciente({
            pacienteId: p.id,
            nombreCompleto: `${t.apellido || ''} ${t.nombre || ''}`.trim(),
            dni: t.dni || '',
            artSeguro: art.nombre || '',
            nroSiniestro: art.nroSiniestro || '',
        });
        setQ('');
        setOpen(false);
    };

    if (paciente.nombreCompleto) {
        return (
            <div className={styles.selectedCard}>
                <div>
                    <strong>👤 {paciente.nombreCompleto}</strong>
                    <div className={styles.meta}>DNI: {paciente.dni || '—'}</div>
                    {paciente.artSeguro && <div className={styles.meta}>ART: {paciente.artSeguro}</div>}
                </div>
                <button className={styles.btnGhost} onClick={() => setPaciente(initialPaciente())}>
                    Cambiar
                </button>
            </div>
        );
    }

    return (
        <div className={styles.picker} ref={boxRef}>
            <input
                className={styles.input}
                placeholder="Buscar paciente por nombre o DNI…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => { setOpen(true); onFocusLoad?.(); }}
            />
            {loading && <span className={styles.loadingInline}>cargando…</span>}
            {open && q.trim() && (
                <div className={styles.dropdown}>
                    {results.length === 0 ? (
                        <div className={styles.empty}>Sin resultados</div>
                    ) : (
                        results.map((p) => {
                            const t = p.trabajador || {};
                            return (
                                <div key={p.id} className={styles.dropdownItem} onClick={() => select(p)}>
                                    <strong>{t.apellido} {t.nombre}</strong>
                                    <span className={styles.meta}>
                                        {' · '}{t.dni}{p.ART?.nombre ? ` · ${p.ART.nombre}` : ''}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

function MedicoPicker({ medico, setMedico, doctors }) {
    const [q, setQ] = useState('');
    const [open, setOpen] = useState(false);
    const boxRef = useRef(null);

    useEffect(() => {
        const onClick = (e) => {
            if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const results = useMemo(() => {
        const t = q.toLowerCase().trim();
        const base = t
            ? doctors.filter((d) =>
                `${d.apellido || ''} ${d.nombre || ''} ${d.matricula || ''}`
                    .toLowerCase().includes(t)
            )
            : doctors;
        return base.slice(0, 10);
    }, [q, doctors]);

    const select = (d) => {
        setMedico({
            id: d.id,
            nombre: d.nombre || '',
            apellido: d.apellido || '',
            matricula: d.matricula || '',
            especialidad: d.especialidad || '',
        });
        setQ('');
        setOpen(false);
    };

    if (medico.id) {
        return (
            <div className={styles.selectedCard}>
                <div>
                    <strong>🩺 Dr/a. {medico.apellido}, {medico.nombre}</strong>
                    {medico.matricula && <div className={styles.meta}>MP: {medico.matricula}</div>}
                    {medico.especialidad && <div className={styles.meta}>{medico.especialidad}</div>}
                </div>
                <button className={styles.btnGhost} onClick={() => setMedico(initialMedico())}>
                    Cambiar
                </button>
            </div>
        );
    }

    return (
        <div className={styles.picker} ref={boxRef}>
            <input
                className={styles.input}
                placeholder="Buscar médico por nombre o matrícula…"
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
            />
            {open && results.length > 0 && (
                <div className={styles.dropdown}>
                    {results.map((d) => (
                        <div key={d.id} className={styles.dropdownItem} onClick={() => select(d)}>
                            <strong>{d.apellido}, {d.nombre}</strong>
                            {d.matricula && <span className={styles.meta}> · MP {d.matricula}</span>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PracticaSearch({ onAdd, nacional, aoter, loading }) {
    const [q, setQ] = useState('');
    const debounced = useDebounce(q, 250);

    const fuseNac = useMemo(
        () => nacional.length ? new Fuse(nacional, {
            keys: ['codigo', 'descripcion'],
            threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2,
        }) : null,
        [nacional]
    );
    const fuseAot = useMemo(
        () => aoter.length ? new Fuse(aoter, {
            keys: ['codigo', 'descripcion', 'region_nombre', 'region'],
            threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2,
        }) : null,
        [aoter]
    );

    const results = useMemo(() => {
        if (!debounced.trim()) return [];
        const out = [];
        if (fuseNac) fuseNac.search(debounced).slice(0, 15).forEach((r) =>
            out.push({ ...r.item, origen: 'nacional' })
        );
        if (fuseAot) fuseAot.search(debounced).slice(0, 10).forEach((r) =>
            out.push({ ...r.item, origen: 'aoter' })
        );
        return out;
    }, [debounced, fuseNac, fuseAot]);

    return (
        <div className={styles.searchBlock}>
            <input
                className={styles.input}
                placeholder="Buscar práctica por código o descripción (nacional o AOTER)…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={loading}
            />
            {results.length > 0 && (
                <div className={styles.resultsList}>
                    {results.map((r, i) => (
                        <div
                            key={`${r.origen}-${r.codigo}-${i}`}
                            className={styles.resultItem}
                            onClick={() => { onAdd(r); setQ(''); }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onAdd(r); setQ('');
                                }
                            }}
                        >
                            <div className={styles.resultMain}>
                                <strong>{r.codigo}</strong> — {r.descripcion}
                                <div className={styles.meta}>
                                    {r.origen === 'aoter'
                                        ? `${r.region_nombre || r.region} · Comp. ${r.complejidad}`
                                        : `${r.capitulo} · ${r.capituloNombre}`}
                                </div>
                            </div>
                            <button
                                className={styles.btnAdd}
                                onClick={(e) => { e.stopPropagation(); onAdd(r); setQ(''); }}
                                tabIndex={-1}
                            >
                                + Agregar
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function LabSearch({ onAdd, nomenclador, loading }) {
    const [q, setQ] = useState('');
    const debounced = useDebounce(q, 250);

    const fuse = useMemo(
        () => nomenclador.length ? new Fuse(nomenclador, {
            keys: ['codigo', 'descripcion'],
            threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2,
        }) : null,
        [nomenclador]
    );

    const results = useMemo(() => {
        if (!debounced.trim() || !fuse) return [];
        return fuse.search(debounced).slice(0, 15).map((r) => r.item);
    }, [debounced, fuse]);

    return (
        <div className={styles.searchBlock}>
            <input
                className={styles.input}
                placeholder="Buscar estudio de laboratorio por código o descripción…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                disabled={loading}
            />
            {results.length > 0 && (
                <div className={styles.resultsList}>
                    {results.map((r, i) => (
                        <div
                            key={`${r.codigo}-${i}`}
                            className={styles.resultItem}
                            onClick={() => { onAdd(r); setQ(''); }}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    onAdd(r); setQ('');
                                }
                            }}
                        >
                            <div className={styles.resultMain}>
                                <strong>{r.codigo}</strong> — {r.descripcion}
                                {r.unidadBioquimica > 0 && (
                                    <div className={styles.meta}>UB: {r.unidadBioquimica}</div>
                                )}
                            </div>
                            <button
                                className={styles.btnAdd}
                                onClick={(e) => { e.stopPropagation(); onAdd(r); setQ(''); }}
                                tabIndex={-1}
                            >
                                + Agregar
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PracticaRow({ item, onRemove, showCost, hayAoter }) {
    const tipo = tipoCostoPorOrigen(item.origen, hayAoter);
    return (
        <div className={styles.practicaRow}>
            <div className={styles.practicaMain}>
                <strong>{item.codigo}</strong> — {item.descripcion}
                <div className={styles.meta}>
                    {item.origen === 'aoter'
                        ? `AOTER · Comp. ${item.complejidad}`
                        : item.capituloNombre}
                    {tipo ? ` · ${tipo}` : ''}
                </div>
            </div>
            {showCost && (
                <div className={styles.costo}>{money(item.costo?.total ?? 0)}</div>
            )}
            <button className={styles.btnRemove} onClick={() => onRemove(item.id)} title="Quitar">
                ✕
            </button>
        </div>
    );
}

function LabRow({ item, onRemove }) {
    return (
        <div className={styles.practicaRow}>
            <div className={styles.practicaMain}>
                <strong>{item.codigo}</strong> — {item.descripcion}
                {item.unidadBioquimica > 0 && (
                    <div className={styles.meta}>UB: {item.unidadBioquimica}</div>
                )}
            </div>
            <button className={styles.btnRemove} onClick={() => onRemove(item.id)} title="Quitar">
                ✕
            </button>
        </div>
    );
}

function RPCard({ rp, onDelete, onEdit, onPrint, onDownload, selectable, selected, onToggleSelect }) {
    const total = (rp.practicas || []).reduce((a, p) => a + (p.costo?.total || 0), 0);
    const cantLabs = (rp.estudiosLab || []).length;
    return (
        <div className={`${styles.rpCard} ${selected ? styles.rpCardSelected : ''}`}>
            <div className={styles.rpCardHeader}>
                {selectable && (
                    <input
                        type="checkbox"
                        className={styles.rpCardCheckbox}
                        checked={!!selected}
                        onChange={() => onToggleSelect(rp.id)}
                        aria-label="Seleccionar RP"
                    />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>
                        {rp.tipoDoc}
                        {rp.esLab ? ' LAB' : ''}
                        {' · '}
                        {rp.paciente?.nombreCompleto || 'Sin paciente'}
                    </strong>
                    <div className={styles.meta}>DNI: {rp.paciente?.dni || '—'}</div>
                </div>
                <span className={styles.badge}>{fmtDate(rp.fecha)}</span>
            </div>
            <div className={styles.meta}>
                🩺 {rp.medico?.apellido ? `${rp.medico.apellido}, ${rp.medico.nombre}` : 'Sin médico'}
                {rp.medico?.matricula ? ` · MP ${rp.medico.matricula}` : ''}
            </div>
            <div className={styles.meta}>
                {rp.esLab
                    ? `${cantLabs} estudio(s) de laboratorio`
                    : `${rp.practicas?.length || 0} práctica(s)`}
                {!rp.esLab && ` · Total: ${money(total)}`}
            </div>
            <div className={styles.rpCardActions}>
                {onPrint && (
                    <button
                        className={styles.btnGhost}
                        onClick={() => onPrint(rp)}
                        title="Imprimir"
                    >
                        🖨️ Imprimir
                    </button>
                )}
                {onDownload && (
                    <button
                        className={styles.btnGhost}
                        onClick={() => onDownload(rp)}
                        title="Descargar PDF"
                    >
                        📥 PDF
                    </button>
                )}
                {onEdit && (
                    <button
                        className={styles.btnGhost}
                        onClick={() => onEdit(rp)}
                        title="Editar"
                    >
                        ✏️
                    </button>
                )}
                {onDelete && (
                    <button
                        className={styles.btnDanger}
                        onClick={() => onDelete(rp.id)}
                        title="Eliminar"
                    >
                        🗑️
                    </button>
                )}
            </div>
        </div>
    );
}

// =====================================================================
//  MAIN
// =====================================================================
export default function RPPage() {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => setIsClient(true), []);

    const [activeTab, setActiveTab] = useState('nueva');

    const [convenios, setConvenios] = useState({});
    const [convenioSel, setConvenioSel] = useState('');
    const valoresConvenio = useMemo(
        () => extraerValoresConvenio(convenios[convenioSel]),
        [convenios, convenioSel]
    );

    const [pacientes, setPacientes] = useState([]);
    const [loadingPacientes, setLoadingPacientes] = useState(false);

    const [nacional, setNacional] = useState([]);
    const [aoter, setAoter] = useState([]);
    const [nacionalBioq, setNacionalBioq] = useState([]);
    const [loadingNomen, setLoadingNomen] = useState(true);
    const [loadingBioq, setLoadingBioq] = useState(true);

    const { doctors } = useDoctors();

    const [rp, setRp] = useState(newRp);
    const [carrito, setCarrito] = useState([]);
    const [historial, setHistorial] = useState([]);
    const [saving, setSaving] = useState(false);
    const [selectedIds, setSelectedIds] = useState(() => new Set());

    const [atajos, setAtajos] = useState([]);
    const [saveAtajoOpen, setSaveAtajoOpen] = useState(false);
    const [atajosOpen, setAtajosOpen] = useState(false);

    // ============ Cargas ============
    useEffect(() => {
        if (!isClient) return;
        (async () => {
            try {
                const [convSnap, rpSnap, atajosSnap] = await Promise.all([
                    get(ref(db, 'convenios')),
                    get(ref(db, 'rp')),
                    get(ref(db, 'rp/atajos')),
                ]);
                const conv = convSnap.exists() ? convSnap.val() : {};
                setConvenios(conv);
                setConvenioSel(Object.keys(conv)[0] || '');

                if (rpSnap.exists()) {
                    const h = rpSnap.val();
                    const list = Object.entries(h)
                        .filter(([id]) => id !== 'atajos')
                        .map(([id, v]) => ({ id, ...v }))
                        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    setHistorial(list);
                }

                if (atajosSnap.exists()) {
                    const a = atajosSnap.val();
                    const list = Object.entries(a).map(([id, v]) => ({ id, ...v }));
                    list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    setAtajos(list);
                }
            } catch (e) {
                console.error('Error cargando:', e);
            }
        })();
    }, [isClient]);

    const loadPacientes = useCallback(async () => {
        if (pacientes.length || loadingPacientes) return;
        setLoadingPacientes(true);
        try {
            const snap = await get(ref(db, 'pacientes'));
            if (snap.exists()) {
                const data = snap.val();
                const list = Object.entries(data).map(([id, v]) => ({ id, ...v }));
                list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                setPacientes(list);
            }
        } catch (e) { console.error(e); }
        finally { setLoadingPacientes(false); }
    }, [pacientes.length, loadingPacientes]);

    useEffect(() => {
        let alive = true;
        Promise.all([
            fetch('/archivos/NomecladorNacional.json').then((r) => r.json()),
            fetch('/archivos/Nomeclador_AOTER.json').then((r) => r.json()),
        ])
            .then(([nacJson, aotJson]) => {
                if (!alive) return;
                const counts = new Map();
                const nacFlat = [];
                if (Array.isArray(nacJson)) {
                    nacJson.forEach((cap) => {
                        (cap.practicas || []).forEach((p) => {
                            const capStr = String(cap.capitulo ?? '').trim();
                            const cod = String(p.codigo ?? '').trim();
                            const base = `${capStr}|${cod}`;
                            const n = (counts.get(base) ?? 0) + 1;
                            counts.set(base, n);
                            nacFlat.push({
                                ...p,
                                capitulo: cap.capitulo,
                                capituloNombre: cap.descripcion,
                                __key: `${base}#${n}`,
                            });
                        });
                    });
                }
                setNacional(nacFlat);

                const aotFlat = [];
                if (aotJson?.practicas && Array.isArray(aotJson.practicas)) {
                    aotJson.practicas.forEach((prac) => {
                        (prac.practicas || []).forEach((p) => {
                            aotFlat.push({
                                ...p,
                                region: prac.region || '',
                                region_nombre: prac.region_nombre || '',
                                complejidad: prac.complejidad || 0,
                                __key: `aoter-${prac.region}-${prac.complejidad}-${p.codigo}`,
                            });
                        });
                    });
                }
                setAoter(aotFlat);
                setLoadingNomen(false);
            })
            .catch((e) => { console.error(e); setLoadingNomen(false); });
        return () => { alive = false; };
    }, []);

    useEffect(() => {
        let alive = true;
        fetch('/archivos/NomecladorBioquimica.json')
            .then((r) => r.json())
            .then((json) => {
                if (!alive) return;
                const list = (json.practicas || []).map((p) => ({
                    codigo: String(p.codigo ?? '').trim(),
                    descripcion: (p.practica_bioquimica || p.descripcion || '').trim(),
                    unidadBioquimica: Number(p.unidad_bioquimica) || 0,
                }));
                setNacionalBioq(list);
                setLoadingBioq(false);
            })
            .catch((e) => { console.error(e); setLoadingBioq(false); });
        return () => { alive = false; };
    }, []);

    // ============ Selección ============
    const toggleSelect = useCallback((id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);
    const selectAll = useCallback((list) => setSelectedIds(new Set(list.map((r) => r.id))), []);
    const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

    // ============ Prácticas / Labs ============
    const addPractica = useCallback((item) => {
        let costo = { total: 0, honorarioMedico: 0, gastoSanatorial: 0, formula: '' };
        if (item.origen === 'aoter') {
            const { cirujano } = obtenerHonorariosAoter(item.complejidad, valoresConvenio);
            costo = {
                honorarioMedico: cirujano, gastoSanatorial: 0, total: cirujano,
                formula: `AOTER Comp.${item.complejidad}`,
            };
        } else {
            const c = calcularPractica(item, valoresConvenio);
            costo = {
                honorarioMedico: c.honorarioMedico || 0,
                gastoSanatorial: c.gastoSanatorial || 0,
                total: c.total || 0,
                formula: c.formula || '',
            };
        }
        setRp((prev) => ({
            ...prev,
            practicas: [
                ...prev.practicas,
                {
                    id: makeId('prac'),
                    codigo: item.codigo ?? '',
                    descripcion: item.descripcion ?? '',
                    origen: item.origen ?? '',
                    complejidad: item.complejidad ?? 0,
                    capitulo: item.capitulo ?? '',
                    capituloNombre: item.capituloNombre ?? '',
                    region_nombre: item.region_nombre ?? '',
                    costo,
                },
            ],
        }));
    }, [valoresConvenio]);

    const removePractica = useCallback((id) => {
        setRp((prev) => ({ ...prev, practicas: prev.practicas.filter((p) => p.id !== id) }));
    }, []);

    const addLab = useCallback((item) => {
        setRp((prev) => ({
            ...prev,
            estudiosLab: [
                ...prev.estudiosLab,
                {
                    id: makeId('lab'),
                    codigo: item.codigo ?? '',
                    descripcion: item.descripcion ?? '',
                    unidadBioquimica: item.unidadBioquimica ?? 0,
                },
            ],
        }));
    }, []);

    const removeLab = useCallback((id) => {
        setRp((prev) => ({
            ...prev,
            estudiosLab: prev.estudiosLab.filter((l) => l.id !== id),
        }));
    }, []);

    // ============ Toggle LAB ============
    const toggleEsLab = useCallback((checked) => {
        setRp((prev) => ({
            ...prev,
            esLab: !!checked,
            practicas: checked ? [] : prev.practicas,
            estudiosLab: checked ? prev.estudiosLab : [],
        }));
    }, []);

    // ============ Atajos ============
    const saveAtajo = useCallback(async (nombre) => {
        if (!nombre) return;
        const atajo = {
            id: makeId('atajo'),
            nombre,
            esLab: !!rp.esLab,
            practicas: rp.practicas,
            estudiosLab: rp.estudiosLab,
            solicitaManual: rp.solicitaManual || '',
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        try {
            await set(ref(db, `rp/atajos/${atajo.id}`), sanitizeForFirebase(atajo));
            setAtajos((prev) => [atajo, ...prev]);
            setSaveAtajoOpen(false);
        } catch (e) {
            console.error(e);
            alert('❌ Error guardando atajo: ' + (e?.message || e));
        }
    }, [rp.practicas, rp.estudiosLab, rp.esLab, rp.solicitaManual]);

    const deleteAtajo = useCallback(async (id) => {
        if (!window.confirm('¿Eliminar este atajo?')) return;
        try {
            await remove(ref(db, `rp/atajos/${id}`));
            setAtajos((prev) => prev.filter((a) => a.id !== id));
        } catch (e) {
            console.error(e);
            alert('Error al eliminar atajo');
        }
    }, []);

    const applyAtajo = useCallback((atajo) => {
        const esLab = !!rp.esLab;

        if (esLab) {
            const estudiosLab = (atajo.estudiosLab || []).map((l) => ({
                ...l, id: makeId('lab'),
            }));
            setRp((prev) => ({
                ...prev,
                estudiosLab,
                practicas: [],
                solicitaManual: atajo.solicitaManual || '',
            }));
        } else {
            const practicas = (atajo.practicas || []).map((p) => {
                let costo;
                if (p.origen === 'aoter') {
                    const { cirujano } = obtenerHonorariosAoter(p.complejidad, valoresConvenio);
                    costo = {
                        honorarioMedico: cirujano, gastoSanatorial: 0, total: cirujano,
                        formula: `AOTER Comp.${p.complejidad}`,
                    };
                } else {
                    const c = calcularPractica(p, valoresConvenio);
                    costo = {
                        honorarioMedico: c.honorarioMedico || 0,
                        gastoSanatorial: c.gastoSanatorial || 0,
                        total: c.total || 0,
                        formula: c.formula || '',
                    };
                }
                return { ...p, costo, id: makeId('prac') };
            });
            setRp((prev) => ({
                ...prev,
                practicas,
                estudiosLab: [],
                solicitaManual: atajo.solicitaManual || '',
            }));
        }
    }, [valoresConvenio, rp.esLab]);

    // ============ Carrito ============
    const canAddToList =
        rp.paciente.nombreCompleto &&
        rp.medico.id &&
        (rp.esLab ? rp.estudiosLab.length > 0 : rp.practicas.length > 0);

    const addToList = useCallback(() => {
        if (!canAddToList) return;
        setCarrito((prev) => [...prev, { ...rp }]);
        setRp(newRp());
    }, [rp, canAddToList]);

    const removeFromCart = (id) => setCarrito((prev) => prev.filter((r) => r.id !== id));

    const saveAll = useCallback(async () => {
        if (carrito.length === 0) return;
        setSaving(true);
        try {
            const now = Date.now();
            const saves = carrito.map((r) => {
                const total = (r.practicas || []).reduce((a, p) => a + (p.costo?.total || 0), 0);
                const payload = sanitizeForFirebase({
                    ...r,
                    convenio: convenioSel,
                    convenioNombre: convenios[convenioSel]?.nombre || convenioSel,
                    total,
                    createdAt: now,
                    updatedAt: now,
                });
                return set(ref(db, `rp/${r.id}`), payload).then(() => payload);
            });
            const saved = await Promise.all(saves);
            setHistorial((prev) => [...saved, ...prev].sort(
                (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            ));
            setCarrito([]);
            clearSelection();
            alert(`✅ ${carrito.length} RP guardadas.`);
        } catch (e) {
            console.error(e);
            alert('❌ Error guardando: ' + (e?.message || e));
        } finally { setSaving(false); }
    }, [carrito, convenioSel, convenios, clearSelection]);

    // ============ Impresión / Descarga ============
    const openOutputWindow = useCallback((rps, mode) => {
        if (!rps?.length) return;
        const logoSrc = `${window.location.origin}/logo.png`;
        const html = buildPrintHtml(rps, logoSrc, mode);
        const w = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes');
        if (!w) { alert('⚠️ Habilitá las ventanas emergentes.'); return; }
        w.document.open();
        w.document.write(html);
        w.document.close();
        w.focus();
    }, []);

    const printList = useCallback((list) => {
        if (!list?.length) return;
        const toPrint = selectedIds.size > 0
            ? list.filter((r) => selectedIds.has(r.id))
            : list;
        if (!toPrint.length) return;
        openOutputWindow(toPrint, 'print');
    }, [selectedIds, openOutputWindow]);

    const downloadList = useCallback((list) => {
        if (!list?.length) return;
        const toPrint = selectedIds.size > 0
            ? list.filter((r) => selectedIds.has(r.id))
            : list;
        if (!toPrint.length) return;
        openOutputWindow(toPrint, 'download');
    }, [selectedIds, openOutputWindow]);

    const printOne = useCallback((r) => openOutputWindow([r], 'print'), [openOutputWindow]);
    const downloadOne = useCallback((r) => openOutputWindow([r], 'download'), [openOutputWindow]);

    // ============ Historial ============
    const deleteHistorial = useCallback(async (id) => {
        if (!window.confirm('¿Eliminar esta RP del historial?')) return;
        try {
            await remove(ref(db, `rp/${id}`));
            setHistorial((prev) => prev.filter((r) => r.id !== id));
            setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        } catch (e) { console.error(e); alert('Error al eliminar'); }
    }, []);

    const editFromHistorial = (r) => {
        const clean = sanitizeForFirebase({ ...r });
        const base = newRp();
        setRp({
            ...base,
            ...clean,
            esLab: !!clean.esLab,
            practicas: Array.isArray(clean.practicas) ? clean.practicas : [],
            estudiosLab: Array.isArray(clean.estudiosLab) ? clean.estudiosLab : [],
            solicitaManual: clean.solicitaManual || '',
            paciente: { ...initialPaciente(), ...(clean.paciente || {}) },
            medico: { ...initialMedico(), ...(clean.medico || {}) },
        });
        setActiveTab('nueva');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const editFromCart = (rpToEdit) => {
        const base = newRp();
        setRp({
            ...base,
            ...rpToEdit,
            esLab: !!rpToEdit.esLab,
            practicas: Array.isArray(rpToEdit.practicas) ? rpToEdit.practicas : [],
            estudiosLab: Array.isArray(rpToEdit.estudiosLab) ? rpToEdit.estudiosLab : [],
            solicitaManual: rpToEdit.solicitaManual || '',
            paciente: { ...initialPaciente(), ...(rpToEdit.paciente || {}) },
            medico: { ...initialMedico(), ...(rpToEdit.medico || {}) },
        });
        removeFromCart(rpToEdit.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ============ Render ============
    if (!isClient) {
        return <div className={styles.page}><div className={styles.loading}>Cargando…</div></div>;
    }

    const totalRp = rp.practicas.reduce((a, p) => a + (p.costo?.total || 0), 0);
    const totalCarrito = carrito.reduce(
        (a, r) => a + (r.practicas || []).reduce((b, p) => b + (p.costo?.total || 0), 0),
        0
    );
    const hayAoterRp = rp.practicas.some((p) => p.origen === 'aoter');
    const hasContent = rp.esLab
        ? rp.estudiosLab.length > 0
        : rp.practicas.length > 0;

    // 👇 Preview de "Se solicita" para el placeholder del input
    const solicitaAuto = rp.esLab
        ? rp.estudiosLab.map((l) => l.descripcion).join(' · ')
        : rp.practicas.map((p) => p.descripcion).join(' · ');

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div>
                    <h1 className={styles.title}>🩺 Recetas / RP</h1>
                    <p className={styles.subtitle}>
                        Generá recetas médicas, guardá historial y analizá los datos.
                    </p>
                </div>
                <label className={styles.labelInline}>
                    Convenio:
                    <select
                        className={styles.select}
                        value={convenioSel}
                        onChange={(e) => setConvenioSel(e.target.value)}
                    >
                        {Object.keys(convenios).map((k) => (
                            <option key={k} value={k}>{convenios[k]?.nombre || k}</option>
                        ))}
                    </select>
                </label>
            </header>

            <div className={styles.tabs}>
                <button className={`${styles.tab} ${activeTab === 'nueva' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('nueva')}>📝 Nueva RP</button>
                <button className={`${styles.tab} ${activeTab === 'historial' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('historial')}>📚 Historial ({historial.length})</button>
                <button className={`${styles.tab} ${activeTab === 'stats' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('stats')}>📊 Estadísticas</button>
            </div>

            {activeTab === 'nueva' && (
                <>
                    <section className={styles.editor}>
                        <h2 className={styles.sectionTitle}>Nueva RP</h2>

                        <div className={styles.atajosBar}>
                            <button className={styles.btnGhost} onClick={() => setAtajosOpen(true)}>
                                📋 Atajos ({atajos.length})
                            </button>
                            <button
                                className={styles.btnGhost}
                                onClick={() => setSaveAtajoOpen(true)}
                                disabled={!hasContent}
                                title={!hasContent
                                    ? 'Cargá al menos un código primero'
                                    : 'Guardar como atajo'}
                            >
                                💾 Guardar atajo
                            </button>
                            <span className={styles.atajosHint}>
                                Aplicá un atajo y solo elegí paciente + médico.
                            </span>
                        </div>

                        {/* Toggle LAB */}
                        <label className={`${styles.labToggle} ${rp.esLab ? styles.labToggleOn : ''}`}>
                            <input
                                type="checkbox"
                                checked={!!rp.esLab}
                                onChange={(e) => toggleEsLab(e.target.checked)}
                            />
                            <span className={styles.labToggleBox} aria-hidden="true" />
                            <span className={styles.labToggleContent}>
                                <span className={styles.labToggleTitle}>
                                    Es una RP solo de laboratorio
                                </span>
                                <span className={styles.labToggleHint}>
                                    {rp.esLab
                                        ? 'Se van a solicitar únicamente estudios de laboratorio.'
                                        : 'Se van a solicitar prácticas médicas (nacional / AOTER).'}
                                </span>
                            </span>
                        </label>

                        <div className={styles.grid2}>
                            <div className={styles.field}>
                                <label className={styles.label}>Paciente</label>
                                <PacientePicker
                                    paciente={rp.paciente}
                                    setPaciente={(p) => setRp((prev) => ({ ...prev, paciente: p }))}
                                    pacientes={pacientes}
                                    loading={loadingPacientes}
                                    onFocusLoad={loadPacientes}
                                />
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Médico solicitante</label>
                                <MedicoPicker
                                    medico={rp.medico}
                                    setMedico={(m) => setRp((prev) => ({ ...prev, medico: m }))}
                                    doctors={doctors}
                                />
                            </div>

                            <div className={styles.field}>
                                <label className={styles.label}>Fecha</label>
                                <input
                                    type="date"
                                    className={styles.input}
                                    value={rp.fecha}
                                    onChange={(e) => setRp((prev) => ({ ...prev, fecha: e.target.value }))}
                                />
                            </div>
                        </div>

                        {/* Bloque condicional: prácticas o laboratorio */}
                        {rp.esLab ? (
                            <div className={styles.field}>
                                <label className={styles.label}>Estudios de laboratorio</label>
                                <LabSearch
                                    onAdd={addLab}
                                    nomenclador={nacionalBioq}
                                    loading={loadingBioq}
                                />

                                {rp.estudiosLab.length > 0 && (
                                    <div className={styles.practicasList}>
                                        {rp.estudiosLab.map((l) => (
                                            <LabRow key={l.id} item={l} onRemove={removeLab} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className={styles.field}>
                                <label className={styles.label}>Prácticas / estudios solicitados</label>
                                <PracticaSearch
                                    onAdd={addPractica}
                                    nacional={nacional}
                                    aoter={aoter}
                                    loading={loadingNomen}
                                />

                                {rp.practicas.length > 0 && (
                                    <div className={styles.practicasList}>
                                        {rp.practicas.map((p) => (
                                            <PracticaRow
                                                key={p.id}
                                                item={p}
                                                onRemove={removePractica}
                                                showCost={true}
                                                hayAoter={hayAoterRp}
                                            />
                                        ))}
                                        <div className={styles.totalRow}>
                                            <span>Total RP (solo interno)</span>
                                            <strong>{money(totalRp)}</strong>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 👇 Campo editable "Se solicita" */}
                        <div className={styles.field}>
                            <label className={styles.label}>Se solicita (editable)</label>
                            <input
                                type="text"
                                className={styles.input}
                                placeholder={solicitaAuto || 'Cargá códigos para autocompletar…'}
                                value={rp.solicitaManual || ''}
                                onChange={(e) => setRp((prev) => ({ ...prev, solicitaManual: e.target.value }))}
                            />
                            <p className={styles.hintInline}>
                                Si lo dejás vacío, se autocompleta con las descripciones de los códigos.
                            </p>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>DG (diagnóstico)</label>
                            <textarea
                                className={styles.textarea}
                                rows={3}
                                value={rp.diagnostico}
                                onChange={(e) => setRp((prev) => ({ ...prev, diagnostico: e.target.value }))}
                                placeholder="Diagnóstico…"
                            />
                        </div>

                        <div className={styles.editorActions}>
                            <button className={styles.btnGhost} onClick={() => setRp(newRp())}>
                                Limpiar
                            </button>
                            <button
                                className={styles.btnPrimary}
                                disabled={!canAddToList}
                                title={!canAddToList
                                    ? 'Completá paciente, médico y al menos 1 código'
                                    : ''}
                                onClick={addToList}
                            >
                                ➕ Agregar a la lista
                            </button>
                        </div>
                    </section>

                    {carrito.length > 0 && (
                        <section className={styles.cart}>
                            <h2 className={styles.sectionTitle}>
                                🧺 Por guardar ({carrito.length}) — Total: {money(totalCarrito)}
                            </h2>

                            <div className={styles.listToolbar}>
                                <label className={styles.toolbarLabel}>
                                    <input
                                        type="checkbox"
                                        checked={carrito.length > 0 && selectedIds.size === carrito.length}
                                        onChange={(e) =>
                                            e.target.checked ? selectAll(carrito) : clearSelection()
                                        }
                                    />
                                    Seleccionar todo
                                </label>
                                <span className={styles.toolbarCount}>
                                    {selectedIds.size} seleccionada(s)
                                </span>
                            </div>

                            <div className={styles.cartGrid}>
                                {carrito.map((r) => (
                                    <RPCard
                                        key={r.id}
                                        rp={r}
                                        selectable
                                        selected={selectedIds.has(r.id)}
                                        onToggleSelect={toggleSelect}
                                        onDelete={removeFromCart}
                                        onEdit={editFromCart}
                                        onPrint={printOne}
                                        onDownload={downloadOne}
                                    />
                                ))}
                            </div>
                            <div className={styles.cartActions}>
                                <button className={styles.btnGhost} onClick={() => printList(carrito)}>
                                    🖨️ Imprimir {selectedIds.size > 0
                                        ? `(${selectedIds.size})`
                                        : 'todas'}
                                </button>
                                <button className={styles.btnGhost} onClick={() => downloadList(carrito)}>
                                    📥 Descargar {selectedIds.size > 0
                                        ? `(${selectedIds.size})`
                                        : 'todas'}
                                </button>
                                <button className={styles.btnPrimary} onClick={saveAll} disabled={saving}>
                                    {saving ? 'Guardando…' : '💾 Guardar todas'}
                                </button>
                            </div>
                        </section>
                    )}
                </>
            )}

            {activeTab === 'historial' && (
                <section className={styles.history}>
                    {historial.length === 0 ? (
                        <div className={styles.empty}>Todavía no hay RPs guardadas.</div>
                    ) : (
                        <>
                            <div className={styles.listToolbar}>
                                <label className={styles.toolbarLabel}>
                                    <input
                                        type="checkbox"
                                        checked={historial.length > 0 && selectedIds.size === historial.length}
                                        onChange={(e) =>
                                            e.target.checked ? selectAll(historial) : clearSelection()
                                        }
                                    />
                                    Seleccionar todo
                                </label>
                                <span className={styles.toolbarCount}>
                                    {selectedIds.size} seleccionada(s)
                                </span>
                                <button
                                    className={styles.btnGhost}
                                    onClick={() => printList(historial)}
                                    disabled={historial.length === 0}
                                >
                                    🖨️ Imprimir {selectedIds.size > 0
                                        ? `(${selectedIds.size})`
                                        : 'todas'}
                                </button>
                                <button
                                    className={styles.btnPrimary}
                                    onClick={() => downloadList(historial)}
                                    disabled={historial.length === 0}
                                >
                                    📥 Descargar {selectedIds.size > 0
                                        ? `(${selectedIds.size})`
                                        : 'todas'}
                                </button>
                            </div>

                            <div className={styles.cartGrid}>
                                {historial.map((h) => (
                                    <RPCard
                                        key={h.id}
                                        rp={h}
                                        selectable
                                        selected={selectedIds.has(h.id)}
                                        onToggleSelect={toggleSelect}
                                        onDelete={deleteHistorial}
                                        onEdit={editFromHistorial}
                                        onPrint={printOne}
                                        onDownload={downloadOne}
                                    />
                                ))}
                            </div>
                        </>
                    )}
                </section>
            )}

            {activeTab === 'stats' && <Estadisticas historial={historial} />}

            <SaveAtajoModal
                open={saveAtajoOpen}
                onClose={() => setSaveAtajoOpen(false)}
                onSave={saveAtajo}
                hasContent={hasContent}
            />
            <AtajosModal
                open={atajosOpen}
                onClose={() => setAtajosOpen(false)}
                atajos={atajos}
                onApply={applyAtajo}
                onDelete={deleteAtajo}
            />
        </div>
    );
}
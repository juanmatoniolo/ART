'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ref, push, set, get, remove } from 'firebase/database';
import { db } from '@/lib/firebase';
import useDoctors from '@/app/admin/medicos/hooks/useDoctors';
import { useDebounce } from '@/hooks/useDebounce';
import Fuse from 'fuse.js';
import {
    money,
    parseNumber,
    calcularPractica,
    obtenerHonorariosAoter,
} from '../Facturacion/utils/calculos';
import styles from './page.module.css';

// =====================================================================
//  HELPERS
// =====================================================================
const todayISO = () => new Date().toISOString().split('T')[0];
const makeId = (p = 'rp') =>
    `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const fmtDate = (iso) => {
    if (!iso) return '—';
    const [y, m, d] = String(iso).split('-');
    return `${d}/${m}/${y}`;
};

const fmtDateLong = (iso) => {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleDateString('es-AR', {
            day: '2-digit', month: 'long', year: 'numeric',
        });
    } catch { return iso; }
};

function extraerValoresConvenio(c) {
    if (!c?.valores_generales) return { honorarios_medicos: [] };
    const out = { honorarios_medicos: c.honorarios_medicos || [] };
    for (const [k, v] of Object.entries(c.valores_generales)) {
        out[k] = typeof v === 'number' ? v : parseNumber(v);
    }
    return out;
}

const initialPaciente = () => ({
    pacienteId: '', nombreCompleto: '', dni: '', artSeguro: '', nroSiniestro: '',
});
const initialMedico = () => ({
    id: '', nombre: '', apellido: '', matricula: '', especialidad: '',
});
const newRp = () => ({
    id: makeId(),
    paciente: initialPaciente(),
    medico: initialMedico(),
    practicas: [],
    cuerpo: '',
    diagnostico: '',
    observaciones: '',
    fecha: todayISO(),
    tipoDoc: 'RP',
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
                    {paciente.nroSiniestro && <div className={styles.meta}>Siniestro: {paciente.nroSiniestro}</div>}
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
        () =>
            nacional.length
                ? new Fuse(nacional, {
                    keys: ['codigo', 'descripcion'],
                    threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2,
                })
                : null,
        [nacional]
    );

    const fuseAot = useMemo(
        () =>
            aoter.length
                ? new Fuse(aoter, {
                    keys: ['codigo', 'descripcion', 'region_nombre', 'region'],
                    threshold: 0.3, ignoreLocation: true, minMatchCharLength: 2,
                })
                : null,
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
                        <div key={`${r.origen}-${r.codigo}-${i}`} className={styles.resultItem}>
                            <div className={styles.resultMain}>
                                <strong>{r.codigo}</strong> — {r.descripcion}
                                <div className={styles.meta}>
                                    {r.origen === 'aoter'
                                        ? `${r.region_nombre || r.region} · Comp. ${r.complejidad}`
                                        : `${r.capitulo} · ${r.capituloNombre}`}
                                </div>
                            </div>
                            <button className={styles.btnAdd} onClick={() => { onAdd(r); setQ(''); }}>
                                + Agregar
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function PracticaRow({ item, onRemove, showCost }) {
    return (
        <div className={styles.practicaRow}>
            <div className={styles.practicaMain}>
                <strong>{item.codigo}</strong> — {item.descripcion}
                <div className={styles.meta}>
                    {item.origen === 'aoter'
                        ? `AOTER · Comp. ${item.complejidad}`
                        : item.capituloNombre}
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

function RPCard({ rp, onDelete, onEdit, onPrint }) {
    const total = rp.practicas.reduce((a, p) => a + (p.costo?.total || 0), 0);
    return (
        <div className={styles.rpCard}>
            <div className={styles.rpCardHeader}>
                <div>
                    <strong>{rp.tipoDoc} · {rp.paciente?.nombreCompleto || 'Sin paciente'}</strong>
                    <div className={styles.meta}>DNI: {rp.paciente?.dni || '—'}</div>
                </div>
                <span className={styles.badge}>{fmtDate(rp.fecha)}</span>
            </div>
            <div className={styles.meta}>
                🩺 {rp.medico?.apellido ? `${rp.medico.apellido}, ${rp.medico.nombre}` : 'Sin médico'}
                {rp.medico?.matricula ? ` · MP ${rp.medico.matricula}` : ''}
            </div>
            <div className={styles.meta}>{rp.practicas?.length || 0} práctica(s) · Total: {money(total)}</div>
            <div className={styles.rpCardActions}>
                {onPrint && <button className={styles.btnGhost} onClick={() => onPrint(rp)}>🖨️</button>}
                {onEdit && <button className={styles.btnGhost} onClick={() => onEdit(rp)}>✏️</button>}
                {onDelete && <button className={styles.btnDanger} onClick={() => onDelete(rp.id)}>🗑️</button>}
            </div>
        </div>
    );
}

// =====================================================================
//  PRINT VIEW — formato RP limpio (sin precios)
// =====================================================================
function RPPrintView({ rp }) {
    return (
        <div className={styles.printRp}>
            {/* Datos del paciente (sacados de la BD) */}
            <div className={styles.printPacienteBlock}>
                <div className={styles.printLine}>
                    <span className={styles.printLabel}>Nombre completo:</span>
                    <span className={styles.printValue}>{rp.paciente?.nombreCompleto || ''}</span>
                </div>
                <div className={styles.printLine}>
                    <span className={styles.printLabel}>DNI:</span>
                    <span className={styles.printValue}>{rp.paciente?.dni || ''}</span>
                </div>
                <div className={styles.printLine}>
                    <span className={styles.printLabel}>ART:</span>
                    <span className={styles.printValue}>{rp.paciente?.artSeguro || ''}</span>
                </div>
            </div>

            {/* Cuerpo — espacio libre + prácticas */}
            <div className={styles.printCuerpo}>
                {rp.practicas?.length > 0 ? (
                    <div className={styles.printPracticas}>
                        {rp.practicas.map((p, i) => (
                            <div key={p.id} className={styles.printPracticaItem}>
                                <span className={styles.printPracticaCod}>{p.codigo}</span>
                                <span className={styles.printPracticaDesc}>{p.descripcion}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className={styles.printBlank} />
                )}

                {rp.cuerpo && (
                    <div className={styles.printCuerpoLibre}>{rp.cuerpo}</div>
                )}

                {rp.practicas?.length === 0 && !rp.cuerpo && (
                    <>
                        <div className={styles.printBlank} />
                        <div className={styles.printBlank} />
                        <div className={styles.printBlank} />
                    </>
                )}
            </div>

            {/* DG + Fecha */}
            <div className={styles.printFooterBlock}>
                <div className={styles.printLine}>
                    <span className={styles.printLabel}>DG:</span>
                    <span className={styles.printValue}>{rp.diagnostico || ''}</span>
                </div>
                <div className={styles.printLine}>
                    <span className={styles.printLabel}>Fecha:</span>
                    <span className={styles.printValue}>{fmtDateLong(rp.fecha)}</span>
                </div>
            </div>

            {/* Firma */}
            <div className={styles.printFirma}>
                <div className={styles.printFirmaLine}></div>
                <div className={styles.printFirmaNombre}>
                    Dr/a. {rp.medico?.apellido}, {rp.medico?.nombre}
                </div>
                {rp.medico?.matricula && (
                    <div className={styles.printFirmaMeta}>MP {rp.medico.matricula}</div>
                )}
                {rp.medico?.especialidad && (
                    <div className={styles.printFirmaMeta}>{rp.medico.especialidad}</div>
                )}
            </div>
        </div>
    );
}

// =====================================================================
//  ESTADÍSTICAS
// =====================================================================
function Estadisticas({ historial }) {
    const stats = useMemo(() => {
        const totalMonto = historial.reduce((a, r) => a + (r.total || 0), 0);
        const totalRps = historial.length;

        const pacientesSet = new Set();
        const medicosMap = new Map();     // id -> { nombre, monto, cantidad }
        const codigosMap = new Map();     // codigo -> { descripcion, cantidad }
        const mesesMap = new Map();       // 'YYYY-MM' -> monto

        historial.forEach((r) => {
            // Pacientes únicos
            if (r.paciente?.dni) pacientesSet.add(r.paciente.dni);

            // Médicos
            const medId = r.medico?.id || r.medico?.apellido || 'sin_medico';
            const medNombre = r.medico?.apellido
                ? `${r.medico.apellido}, ${r.medico.nombre}`
                : 'Sin médico';
            const prevM = medicosMap.get(medId) || { nombre: medNombre, monto: 0, cantidad: 0 };
            prevM.monto += r.total || 0;
            prevM.cantidad += 1;
            medicosMap.set(medId, prevM);

            // Códigos
            (r.practicas || []).forEach((p) => {
                const key = p.codigo;
                const prevC = codigosMap.get(key) || { descripcion: p.descripcion, cantidad: 0 };
                prevC.cantidad += 1;
                codigosMap.set(key, prevC);
            });

            // Por mes
            const mes = String(r.fecha || r.createdAt || '').slice(0, 7);
            if (mes) {
                mesesMap.set(mes, (mesesMap.get(mes) || 0) + (r.total || 0));
            }
        });

        const topMedicos = [...medicosMap.values()]
            .sort((a, b) => b.monto - a.monto)
            .slice(0, 10);

        const topCodigos = [...codigosMap.entries()]
            .map(([codigo, v]) => ({ codigo, ...v }))
            .sort((a, b) => b.cantidad - a.cantidad)
            .slice(0, 10);

        const porMes = [...mesesMap.entries()]
            .sort((a, b) => a[0].localeCompare(b[0]))
            .slice(-6);

        const maxMontoMes = Math.max(1, ...porMes.map(([, m]) => m));
        const maxMontoMedico = Math.max(1, ...topMedicos.map((m) => m.monto));
        const maxCodigo = Math.max(1, ...topCodigos.map((c) => c.cantidad));

        return {
            totalMonto,
            totalRps,
            totalPacientes: pacientesSet.size,
            totalMedicos: medicosMap.size,
            promedio: totalRps > 0 ? totalMonto / totalRps : 0,
            topMedicos,
            topCodigos,
            porMes,
            maxMontoMes,
            maxMontoMedico,
            maxCodigo,
        };
    }, [historial]);

    return (
        <section className={styles.stats}>
            {/* KPIs */}
            <div className={styles.kpiGrid}>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Monto total</div>
                    <div className={styles.kpiValue}>$ {money(stats.totalMonto)}</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>RPs generadas</div>
                    <div className={styles.kpiValue}>{stats.totalRps}</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Pacientes únicos</div>
                    <div className={styles.kpiValue}>{stats.totalPacientes}</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Médicos</div>
                    <div className={styles.kpiValue}>{stats.totalMedicos}</div>
                </div>
                <div className={styles.kpiCard}>
                    <div className={styles.kpiLabel}>Promedio por RP</div>
                    <div className={styles.kpiValue}>$ {money(stats.promedio)}</div>
                </div>
            </div>

            {/* Monto por mes */}
            {stats.porMes.length > 0 && (
                <div className={styles.chartBlock}>
                    <h3 className={styles.chartTitle}>📅 Monto por mes</h3>
                    <div className={styles.barChart}>
                        {stats.porMes.map(([mes, monto]) => {
                            const pct = (monto / stats.maxMontoMes) * 100;
                            return (
                                <div key={mes} className={styles.barRow}>
                                    <span className={styles.barLabel}>{mes}</span>
                                    <div className={styles.barTrack}>
                                        <div className={styles.barFill} style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={styles.barValue}>$ {money(monto)}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Monto por médico */}
            {stats.topMedicos.length > 0 && (
                <div className={styles.chartBlock}>
                    <h3 className={styles.chartTitle}>🩺 Monto por médico (Top 10)</h3>
                    <div className={styles.barChart}>
                        {stats.topMedicos.map((m, i) => {
                            const pct = (m.monto / stats.maxMontoMedico) * 100;
                            return (
                                <div key={i} className={styles.barRow}>
                                    <span className={styles.barLabel}>{m.nombre}</span>
                                    <div className={styles.barTrack}>
                                        <div
                                            className={`${styles.barFill} ${styles.barFillAlt}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span className={styles.barValue}>
                                        $ {money(m.monto)} <small>({m.cantidad})</small>
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Códigos más frecuentes */}
            {stats.topCodigos.length > 0 && (
                <div className={styles.chartBlock}>
                    <h3 className={styles.chartTitle}>🔝 Códigos más solicitados (Top 10)</h3>
                    <div className={styles.barChart}>
                        {stats.topCodigos.map((c, i) => {
                            const pct = (c.cantidad / stats.maxCodigo) * 100;
                            return (
                                <div key={i} className={styles.barRow}>
                                    <span className={styles.barLabel}>
                                        <b>{c.codigo}</b> · {c.descripcion?.slice(0, 30)}
                                    </span>
                                    <div className={styles.barTrack}>
                                        <div
                                            className={`${styles.barFill} ${styles.barFillWarn}`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                    <span className={styles.barValue}>{c.cantidad}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {historial.length === 0 && (
                <div className={styles.empty}>
                    Todavía no hay RPs guardadas para mostrar estadísticas.
                </div>
            )}
        </section>
    );
}

// =====================================================================
//  MAIN
// =====================================================================

export default function RPPage() {
    const [isClient, setIsClient] = useState(false);
    useEffect(() => setIsClient(true), []);

    const [activeTab, setActiveTab] = useState('nueva'); // nueva | historial | stats

    // Convenios
    const [convenios, setConvenios] = useState({});
    const [convenioSel, setConvenioSel] = useState('');
    const valoresConvenio = useMemo(
        () => extraerValoresConvenio(convenios[convenioSel]),
        [convenios, convenioSel]
    );

    // Pacientes
    const [pacientes, setPacientes] = useState([]);
    const [loadingPacientes, setLoadingPacientes] = useState(false);

    // Nomencladores
    const [nacional, setNacional] = useState([]);
    const [aoter, setAoter] = useState([]);
    const [loadingNomen, setLoadingNomen] = useState(true);

    // Médicos
    const { doctors } = useDoctors();

    // RP + carrito
    const [rp, setRp] = useState(newRp);
    const [carrito, setCarrito] = useState([]);
    const [historial, setHistorial] = useState([]);
    const [printQueue, setPrintQueue] = useState([]);
    const [saving, setSaving] = useState(false);

    // ============ Cargas ============
    useEffect(() => {
        if (!isClient) return;
        (async () => {
            try {
                const [convSnap, rpSnap] = await Promise.all([
                    get(ref(db, 'convenios')),
                    get(ref(db, 'rp')),
                ]);
                const conv = convSnap.exists() ? convSnap.val() : {};
                setConvenios(conv);
                setConvenioSel(Object.keys(conv)[0] || '');

                if (rpSnap.exists()) {
                    const h = rpSnap.val();
                    const list = Object.entries(h)
                        .map(([id, v]) => ({ id, ...v }))
                        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
                    setHistorial(list);
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
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingPacientes(false);
        }
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

    // ============ Acciones ============
    const addPractica = useCallback(
        (item) => {
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
                        codigo: item.codigo,
                        descripcion: item.descripcion,
                        origen: item.origen,
                        complejidad: item.complejidad,
                        capitulo: item.capitulo,
                        capituloNombre: item.capituloNombre,
                        region_nombre: item.region_nombre,
                        costo,
                    },
                ],
            }));
        },
        [valoresConvenio]
    );

    const removePractica = useCallback((id) => {
        setRp((prev) => ({ ...prev, practicas: prev.practicas.filter((p) => p.id !== id) }));
    }, []);

    const canAddToList = rp.paciente.nombreCompleto && rp.medico.id && rp.practicas.length > 0;

    const addToList = useCallback(() => {
        if (!canAddToList) return;
        setCarrito((prev) => [...prev, { ...rp }]);
        setRp(newRp());
    }, [rp, canAddToList]);

    const removeFromCart = (id) =>
        setCarrito((prev) => prev.filter((r) => r.id !== id));

    const saveAll = useCallback(async () => {
        if (carrito.length === 0) return;
        setSaving(true);
        try {
            const now = Date.now();
            const saves = carrito.map((r) => {
                const total = r.practicas.reduce((a, p) => a + (p.costo?.total || 0), 0);
                const payload = {
                    ...r,
                    convenio: convenioSel,
                    convenioNombre: convenios[convenioSel]?.nombre || convenioSel,
                    total,
                    createdAt: now,
                    updatedAt: now,
                };
                return set(ref(db, `rp/${r.id}`), payload).then(() => payload);
            });
            const saved = await Promise.all(saves);
            setHistorial((prev) => [...saved, ...prev].sort(
                (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
            ));
            setCarrito([]);
            alert(`✅ ${carrito.length} RP guardadas.`);
        } catch (e) {
            console.error(e);
            alert('❌ Error guardando: ' + (e?.message || e));
        } finally {
            setSaving(false);
        }
    }, [carrito, convenioSel, convenios]);

    const printCart = useCallback(() => {
        if (carrito.length === 0) return;
        setPrintQueue(carrito);
        setTimeout(() => {
            window.print();
            setPrintQueue([]);
        }, 150);
    }, [carrito]);

    const printOne = useCallback((r) => {
        setPrintQueue([r]);
        setTimeout(() => {
            window.print();
            setPrintQueue([]);
        }, 150);
    }, []);

    const deleteHistorial = useCallback(async (id) => {
        if (!window.confirm('¿Eliminar esta RP del historial?')) return;
        try {
            await remove(ref(db, `rp/${id}`));
            setHistorial((prev) => prev.filter((r) => r.id !== id));
        } catch (e) {
            console.error(e);
            alert('Error al eliminar');
        }
    }, []);

    const editFromHistorial = (r) => {
        setRp({ ...r });
        setActiveTab('nueva');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ============ Render ============
    if (!isClient) {
        return <div className={styles.page}><div className={styles.loading}>Cargando…</div></div>;
    }

    const totalRp = rp.practicas.reduce((a, p) => a + (p.costo?.total || 0), 0);
    const totalCarrito = carrito.reduce(
        (a, r) => a + r.practicas.reduce((b, p) => b + (p.costo?.total || 0), 0),
        0
    );

    return (
        <div className={styles.page}>
            {/* ================ HEADER ================ */}
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

            {/* ================ TABS ================ */}
            <div className={styles.tabs}>
                <button
                    className={`${styles.tab} ${activeTab === 'nueva' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('nueva')}
                >
                    📝 Nueva RP
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'historial' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('historial')}
                >
                    📚 Historial ({historial.length})
                </button>
                <button
                    className={`${styles.tab} ${activeTab === 'stats' ? styles.tabActive : ''}`}
                    onClick={() => setActiveTab('stats')}
                >
                    📊 Estadísticas
                </button>
            </div>

            {/* ================ TAB: NUEVA ================ */}
            {activeTab === 'nueva' && (
                <>
                    <section className={styles.editor}>
                        <h2 className={styles.sectionTitle}>Nueva RP</h2>

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
                                <label className={styles.label}>Tipo</label>
                                <select
                                    className={styles.select}
                                    value={rp.tipoDoc}
                                    onChange={(e) => setRp((prev) => ({ ...prev, tipoDoc: e.target.value }))}
                                >
                                    <option value="RP">RP</option>
                                    <option value="Receta">Receta</option>
                                    <option value="Orden médica">Orden médica</option>
                                </select>
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
                                        />
                                    ))}
                                    <div className={styles.totalRow}>
                                        <span>Total RP (solo interno)</span>
                                        <strong>{money(totalRp)}</strong>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className={styles.grid2}>
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

                            <div className={styles.field}>
                                <label className={styles.label}>Observaciones</label>
                                <textarea
                                    className={styles.textarea}
                                    rows={3}
                                    value={rp.observaciones}
                                    onChange={(e) => setRp((prev) => ({ ...prev, observaciones: e.target.value }))}
                                    placeholder="Notas adicionales (no salen en la impresión)…"
                                />
                            </div>
                        </div>

                        <div className={styles.field}>
                            <label className={styles.label}>Cuerpo libre (aparece en la impresión)</label>
                            <textarea
                                className={styles.textarea}
                                rows={4}
                                value={rp.cuerpo}
                                onChange={(e) => setRp((prev) => ({ ...prev, cuerpo: e.target.value }))}
                                placeholder="Indicaciones, texto libre que se imprime en el cuerpo de la RP…"
                            />
                        </div>

                        <div className={styles.editorActions}>
                            <button className={styles.btnGhost} onClick={() => setRp(newRp())}>
                                Limpiar
                            </button>
                            <button
                                className={styles.btnPrimary}
                                disabled={!canAddToList}
                                title={!canAddToList ? 'Completá paciente, médico y al menos 1 práctica' : ''}
                                onClick={addToList}
                            >
                                ➕ Agregar a la lista
                            </button>
                        </div>
                    </section>

                    {/* Carrito */}
                    {carrito.length > 0 && (
                        <section className={styles.cart}>
                            <h2 className={styles.sectionTitle}>
                                🧺 Por guardar ({carrito.length}) — Total: {money(totalCarrito)}
                            </h2>
                            <div className={styles.cartGrid}>
                                {carrito.map((r) => (
                                    <RPCard
                                        key={r.id}
                                        rp={r}
                                        onDelete={removeFromCart}
                                        onEdit={(rpToEdit) => {
                                            setRp(rpToEdit);
                                            removeFromCart(rpToEdit.id);
                                        }}
                                        onPrint={printOne}
                                    />
                                ))}
                            </div>
                            <div className={styles.cartActions}>
                                <button className={styles.btnGhost} onClick={printCart}>
                                    🖨️ Imprimir todas
                                </button>
                                <button className={styles.btnPrimary} onClick={saveAll} disabled={saving}>
                                    {saving ? 'Guardando…' : '💾 Guardar todas'}
                                </button>
                            </div>
                        </section>
                    )}
                </>
            )}

            {/* ================ TAB: HISTORIAL ================ */}
            {activeTab === 'historial' && (
                <section className={styles.history}>
                    {historial.length === 0 ? (
                        <div className={styles.empty}>Todavía no hay RPs guardadas.</div>
                    ) : (
                        <div className={styles.cartGrid}>
                            {historial.map((h) => (
                                <RPCard
                                    key={h.id}
                                    rp={h}
                                    onDelete={deleteHistorial}
                                    onEdit={editFromHistorial}
                                    onPrint={printOne}
                                />
                            ))}
                        </div>
                    )}
                </section>
            )}

            {/* ================ TAB: ESTADÍSTICAS ================ */}
            {activeTab === 'stats' && <Estadisticas historial={historial} />}

            {/* ================ PRINT ================ */}
            {printQueue.length > 0 && (
                <div className={styles.printArea}>
                    {printQueue.map((r, i) => (
                        <div key={r.id} className={styles.printPage}>
                            <RPPrintView rp={r} />
                            {i < printQueue.length - 1 && <div className={styles.pageBreak} />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
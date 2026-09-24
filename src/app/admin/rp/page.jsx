'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ref, set, get, remove } from 'firebase/database';
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

const fmtPct = (n, total) =>
    total > 0 ? `${((n / total) * 100).toFixed(1)}%` : '—';

function chunk(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

const esc = (s) =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

function sanitizeForFirebase(value) {
    if (Array.isArray(value)) return value.map(sanitizeForFirebase);
    if (value && typeof value === 'object') {
        const out = {};
        for (const [k, v] of Object.entries(value)) {
            if (v === undefined) continue;
            out[k] = sanitizeForFirebase(v);
        }
        return out;
    }
    return value;
}

function extraerValoresConvenio(c) {
    if (!c?.valores_generales) return { honorarios_medicos: [] };
    const out = { honorarios_medicos: c.honorarios_medicos || [] };
    for (const [k, v] of Object.entries(c.valores_generales)) {
        out[k] = typeof v === 'number' ? v : parseNumber(v);
    }
    return out;
}

const tipoCostoPorOrigen = (origen, hayAoter) => {
    if (origen === 'aoter') return 'Honorario Médico';
    if (origen === 'bioquimica') return 'Gasto Sanatorial';
    if (hayAoter) return 'Gasto Sanatorial';
    return '';
};

const initialPaciente = () => ({
    pacienteId: '', nombreCompleto: '', dni: '', artSeguro: '', nroSiniestro: '',
});
const initialMedico = () => ({
    id: '', nombre: '', apellido: '', matricula: '', especialidad: '',
});
const newRp = () => ({
    id: makeId(),
    tipoDoc: 'RP',                // fijo, ya no se elige
    paciente: initialPaciente(),
    medico: initialMedico(),
    practicas: [],
    estudiosLab: [],
    diagnostico: '',
    fecha: todayISO(),
});

// =====================================================================
//  HTML DE IMPRESIÓN
// =====================================================================

function renderRpHtml(rp, logoSrc) {
    const pac = rp.paciente || {};
    const med = rp.medico || {};
    const practicas = rp.practicas || [];
    const labs = rp.estudiosLab || [];

    const hayAoter = practicas.some((p) => p.origen === 'aoter');

    const solicitaParts = [
        ...practicas.map((p) => esc(p.descripcion)),
        ...labs.map((l) => esc(l.descripcion)),
    ];
    const solicitaTxt = solicitaParts.length ? solicitaParts.join(' · ') : '—';

    const codesHtml = practicas.length
        ? practicas
            .map((p) => {
                const tipo = tipoCostoPorOrigen(p.origen, hayAoter);
                return `
                <div class="code-row">
                    <span class="code">${esc(p.codigo)}</span>
                    <span class="code-desc">${esc(p.descripcion)}</span>
                    <span class="code-type">${esc(tipo)}</span>
                </div>`;
            })
            .join('')
        : '<div class="code-row"><span class="code-desc italic">Sin prácticas cargadas</span></div>';

    const labHtml = labs.length
        ? `
        <div class="lab-block">
            <div class="lab-title">🧪 Estudios de laboratorio</div>
            ${labs.map((l) => `
                <div class="code-row">
                    <span class="code">${esc(l.codigo)}</span>
                    <span class="code-desc">${esc(l.descripcion)}</span>
                    <span class="code-type"></span>
                </div>`).join('')}
        </div>`
        : '';

    return `
        <div class="rp">
            <div class="head">
                <img class="logo" src="${logoSrc}" alt="logo" />
                <div class="clinic">
                    <div class="clinic-name">CLINICA DE LA UNION S.A</div>
                    <div class="clinic-addr">AV. SIBURU 1085 - CHAJARI, E.R (3228)</div>
                </div>
                <div class="tipo-badge">${esc(rp.tipoDoc || 'RP')}</div>
            </div>

            <div class="sep"></div>

            <div class="row">
                <span class="lbl">Paciente:</span>
                <span class="val bold grow">${esc(pac.nombreCompleto)}</span>
            </div>
            <div class="row">
                <span class="lbl">DNI:</span>
                <span class="val grow">${esc(pac.dni)}</span>
                <span class="lbl">ART:</span>
                <span class="val grow">${esc(pac.artSeguro)}</span>
            </div>

            <div class="sep"></div>

            <div class="solicita">
                <span class="lbl">Solicita:</span>
                <span class="val italic grow">${solicitaTxt}</span>
            </div>

            <div class="codes">
                <div class="codes-title">Códigos</div>
                ${codesHtml}
            </div>

            ${labHtml}

            <div class="bottom">
                <div class="dg-row">
                    <span class="lbl">DG:</span>
                    <span class="val grow">${esc(rp.diagnostico)}</span>
                </div>
                <div class="fecha-row">
                    <span class="lbl">Fecha:</span>
                    <span class="val bold">${esc(fmtDate(rp.fecha))}</span>
                </div>

                <div class="firma">
                    <div class="firma-line"></div>
                    <div class="firma-name">Dr/a. ${esc(med.apellido)}, ${esc(med.nombre)}</div>
                    ${med.matricula ? `<div class="firma-meta">MP ${esc(med.matricula)}</div>` : ''}
                    ${med.especialidad ? `<div class="firma-meta">${esc(med.especialidad)}</div>` : ''}
                </div>
            </div>
        </div>
    `;
}

function buildPrintHtml(rps, logoSrc) {
    const sheets = chunk(rps, 4);
    const body = sheets
        .map(
            (sheet) => `
            <div class="sheet">
                ${sheet.map((rp) => renderRpHtml(rp, logoSrc)).join('')}
            </div>`
        )
        .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Recetas / RP</title>
<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
<style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }

    .toolbar {
        position: sticky; top: 0; z-index: 100;
        display: flex; align-items: center; gap: 12px;
        padding: 12px 20px;
        background: #1f2937; color: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        flex-wrap: wrap;
    }
    .toolbar .btn {
        cursor: pointer; border: 1px solid rgba(255,255,255,0.2);
        background: rgba(255,255,255,0.08); color: #fff;
        padding: 8px 16px; border-radius: 8px;
        font-size: 14px; font-weight: 600; font-family: inherit;
        transition: all 0.15s;
    }
    .toolbar .btn:hover:not(:disabled) { background: rgba(255,255,255,0.15); }
    .toolbar .btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .toolbar .btn-primary { background: linear-gradient(90deg, #44794d, #6fa17b); border-color: transparent; }
    .toolbar .btn-primary:hover:not(:disabled) { filter: brightness(1.1); }
    .toolbar .hint { font-size: 12px; color: #cbd5e1; margin-left: auto; }

    .sheet {
        display: grid;
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 1fr 1fr;
        width: 210mm; height: 297mm;
        padding: 4mm; gap: 3mm;
        page-break-after: always;
        break-after: page;
        background: #fff;
    }
    .sheet:last-child { page-break-after: auto; break-after: auto; }

    .rp {
        width: 100%; height: 100%;
        padding: 4mm 4.5mm 3.5mm;
        border: 1px dashed #cbd5e1;
        display: flex; flex-direction: column;
        gap: 1.6mm;
        font-size: 9pt; line-height: 1.3;
        color: #000; overflow: hidden;
        page-break-inside: avoid;
        break-inside: avoid;
    }

    .head { display: flex; align-items: center; gap: 3mm; flex-shrink: 0; }
    .logo { width: 13mm; height: 13mm; object-fit: contain; flex-shrink: 0; }
    .clinic { flex: 1; min-width: 0; }
    .clinic-name { font-weight: 800; font-size: 10.5pt; letter-spacing: 0.3px; line-height: 1.05; }
    .clinic-addr { font-weight: 700; font-size: 8.5pt; line-height: 1.15; margin-top: 0.6mm; }
    .tipo-badge {
        font-size: 8pt; font-weight: 700;
        border: 1px solid #111; border-radius: 999px;
        padding: 0.6mm 2.5mm; letter-spacing: 0.5px;
        flex-shrink: 0;
    }

    .sep { border-top: 0.6pt solid #94a3b8; margin: 0.2mm 0; flex-shrink: 0; }
    .row { display: flex; align-items: baseline; gap: 1.6mm; flex-shrink: 0; }
    .lbl { font-weight: 700; white-space: nowrap; flex-shrink: 0; }
    .val {
        border-bottom: 0.6pt solid #111;
        padding: 0 1mm 0.4mm;
        min-height: 4mm; min-width: 12mm;
    }
    .val.bold { font-weight: 700; }
    .val.grow { flex: 1; min-width: 0; }
    .val.italic { font-style: italic; }

    .solicita {
        display: flex; align-items: flex-start;
        gap: 1.6mm; font-size: 9.5pt; line-height: 1.4;
        flex-shrink: 0;
        min-height: 22mm;
        padding: 1mm 0 2mm;
    }
    .solicita .lbl { padding-top: 0.8mm; }
    .solicita .val {
        min-height: 18mm; padding: 1mm 1mm 0.5mm;
        display: flex; align-items: flex-start;
        border-bottom: 0.6pt solid #111;
    }

    .codes {
        flex: 1; min-height: 0;
        border-top: 0.5pt dashed #cbd5e1;
        padding-top: 1.5mm; overflow: hidden;
    }
    .codes-title {
        font-weight: 800; font-size: 8pt;
        text-transform: uppercase; letter-spacing: 0.5px;
        color: #334155; margin-bottom: 1.2mm;
    }
    .code-row {
        display: grid;
        grid-template-columns: 22mm 1fr auto;
        gap: 2mm; align-items: baseline;
        font-size: 8.5pt; line-height: 1.4;
        padding: 0.4mm 0;
    }
    .code { font-family: 'Courier New', monospace; font-weight: 700; white-space: nowrap; }
    .code-desc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .code-type { font-size: 7.5pt; font-style: italic; color: #475569; white-space: nowrap; }
    .italic { font-style: italic; }

    .lab-block {
        border-top: 0.5pt dashed #cbd5e1;
        padding-top: 1.5mm; margin-top: 1mm;
        flex-shrink: 0; font-size: 8.5pt;
        max-height: 30mm; overflow: hidden;
    }
    .lab-title {
        font-weight: 800; font-size: 8pt;
        text-transform: uppercase; letter-spacing: 0.5px;
        color: #334155; margin-bottom: 1mm;
    }

    .bottom {
        margin-top: auto;
        border-top: 0.6pt solid #94a3b8;
        padding-top: 2mm;
        display: flex; flex-direction: column;
        gap: 1.5mm; flex-shrink: 0;
    }
    .dg-row, .fecha-row { display: flex; align-items: baseline; gap: 1.6mm; font-size: 9pt; }

    .firma { margin-top: 4mm; text-align: center; padding-top: 2mm; }
    .firma-line { border-top: 0.7pt solid #111; width: 55mm; margin: 0 auto 1.2mm; }
    .firma-name { font-weight: 700; font-size: 8.5pt; line-height: 1.15; }
    .firma-meta { font-size: 7.5pt; color: #475569; line-height: 1.15; }

    @media screen {
        body { background: #e5e7eb; padding: 0; }
        #content { padding: 6mm 0; }
        .sheet { margin: 0 auto 6mm; box-shadow: 0 4px 16px rgba(0,0,0,0.15); }
    }
    @media print {
        body { background: #fff; padding: 0; }
        #content { padding: 0; }
        .no-print { display: none !important; }
        .sheet { margin: 0; box-shadow: none; }
    }
</style>
</head>
<body>

<div class="toolbar no-print">
    <button class="btn btn-primary" onclick="window.print()">🖨️ Imprimir</button>
    <button class="btn" id="btnPdf" onclick="downloadPdf()">📥 Descargar PDF</button>
    <span class="hint">Tip: usá "Descargar PDF" para guardar el archivo directamente.</span>
</div>

<div id="content">
${body}
</div>

<script>
async function downloadPdf() {
    const btn = document.getElementById('btnPdf');
    const sheets = document.querySelectorAll('.sheet');
    if (!sheets.length) return;
    const originalText = btn.textContent;
    btn.disabled = true; btn.textContent = '⏳ Generando…';
    try {
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        for (let i = 0; i < sheets.length; i++) {
            const canvas = await html2canvas(sheets[i], {
                scale: 3, useCORS: true,
                backgroundColor: '#ffffff', logging: false,
                windowWidth: sheets[i].scrollWidth,
                windowHeight: sheets[i].scrollHeight,
            });
            const imgData = canvas.toDataURL('image/jpeg', 0.95);
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
        }
        const stamp = new Date().toISOString().slice(0, 10);
        pdf.save('recetas-rp-' + stamp + '.pdf');
    } catch (err) {
        console.error(err);
        alert('Error al generar PDF: ' + (err && err.message ? err.message : err));
    } finally {
        btn.disabled = false; btn.textContent = originalText;
    }
}
<\/script>
</body>
</html>`;
}

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
                        <div key={`${r.codigo}-${i}`} className={styles.resultItem}>
                            <div className={styles.resultMain}>
                                <strong>{r.codigo}</strong> — {r.descripcion}
                                {r.unidadBioquimica > 0 && (
                                    <div className={styles.meta}>UB: {r.unidadBioquimica}</div>
                                )}
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

function RPCard({ rp, onDelete, onEdit, onPrint, selectable, selected, onToggleSelect }) {
    const total = rp.practicas.reduce((a, p) => a + (p.costo?.total || 0), 0);
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
                        aria-label="Seleccionar RP para imprimir"
                    />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{rp.tipoDoc} · {rp.paciente?.nombreCompleto || 'Sin paciente'}</strong>
                    <div className={styles.meta}>DNI: {rp.paciente?.dni || '—'}</div>
                </div>
                <span className={styles.badge}>{fmtDate(rp.fecha)}</span>
            </div>
            <div className={styles.meta}>
                🩺 {rp.medico?.apellido ? `${rp.medico.apellido}, ${rp.medico.nombre}` : 'Sin médico'}
                {rp.medico?.matricula ? ` · MP ${rp.medico.matricula}` : ''}
            </div>
            <div className={styles.meta}>
                {rp.practicas?.length || 0} práctica(s)
                {cantLabs > 0 ? ` · 🧪 ${cantLabs} lab` : ''}
                {' · Total: '}{money(total)}
            </div>
            <div className={styles.rpCardActions}>
                {onPrint && <button className={styles.btnGhost} onClick={() => onPrint(rp)}>🖨️</button>}
                {onEdit && <button className={styles.btnGhost} onClick={() => onEdit(rp)}>✏️</button>}
                {onDelete && <button className={styles.btnDanger} onClick={() => onDelete(rp.id)}>🗑️</button>}
            </div>
        </div>
    );
}

// =====================================================================
//  MODALES DE ATAJOS
// =====================================================================
const overlayStyle = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 200, padding: 16,
};
const modalStyle = {
    background: '#111827', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, padding: 20, width: '100%', maxWidth: 560,
    maxHeight: '85vh', overflow: 'auto', color: '#e5e7eb',
};

function SaveAtajoModal({ open, onClose, onSave }) {
    const [nombre, setNombre] = useState('');
    useEffect(() => { if (open) setNombre(''); }, [open]);
    if (!open) return null;
    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>💾 Guardar atajo</h3>
                <p style={{ fontSize: 13, color: '#9ca3af' }}>
                    Guardá las prácticas y estudios de laboratorio actuales como atajo
                    reutilizable. Después solo elegís paciente y médico.
                </p>
                <input
                    className={styles.input}
                    placeholder="Nombre del atajo (ej: Consulta trauma + RX)"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoFocus
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 20 }}>
                    <button className={styles.btnGhost} onClick={onClose}>Cancelar</button>
                    <button
                        className={styles.btnPrimary}
                        disabled={nombre.trim().length < 3}
                        onClick={() => { onSave(nombre.trim()); }}
                    >
                        Guardar atajo
                    </button>
                </div>
            </div>
        </div>
    );
}

function AtajosModal({ open, onClose, atajos, onApply, onDelete }) {
    if (!open) return null;
    return (
        <div style={overlayStyle} onClick={onClose}>
            <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ marginTop: 0 }}>📋 Atajos guardados ({atajos.length})</h3>
                {atajos.length === 0 ? (
                    <p style={{ color: '#9ca3af', fontSize: 13 }}>
                        Todavía no hay atajos. Cargá prácticas y estudios, y después dale a
                        <b> 💾 Guardar atajo</b>.
                    </p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                        {atajos.map((a) => (
                            <div key={a.id} style={{
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 8, padding: 12,
                                display: 'flex', alignItems: 'center', gap: 12,
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <strong>{a.nombre}</strong>
                                    <div className={styles.meta}>
                                        {a.practicas?.length || 0} práctica(s)
                                        {(a.estudiosLab?.length || 0) > 0
                                            ? ` · 🧪 ${a.estudiosLab.length} lab`
                                            : ''}
                                    </div>
                                </div>
                                <button
                                    className={styles.btnPrimary}
                                    onClick={() => { onApply(a); onClose(); }}
                                >
                                    Aplicar
                                </button>
                                <button
                                    className={styles.btnDanger}
                                    onClick={() => onDelete(a.id)}
                                    title="Eliminar atajo"
                                >
                                    🗑️
                                </button>
                            </div>
                        ))}
                    </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
                    <button className={styles.btnGhost} onClick={onClose}>Cerrar</button>
                </div>
            </div>
        </div>
    );
}

// =====================================================================
//  ESTADÍSTICAS (sin gráficos)
// =====================================================================
function Estadisticas({ historial }) {
    const [medicoSel, setMedicoSel] = useState('todos');

    // Agrupar por médico
    const medicosList = useMemo(() => {
        const map = new Map();
        historial.forEach((r) => {
            const id = r.medico?.id || r.medico?.apellido || 'sin_medico';
            const nombre = r.medico?.apellido
                ? `${r.medico.apellido}, ${r.medico.nombre}`
                : 'Sin médico';
            if (!map.has(id)) {
                map.set(id, { id, nombre, cantidad: 0, monto: 0, rps: [] });
            }
            const m = map.get(id);
            m.cantidad += 1;
            m.monto += r.total || 0;
            m.rps.push(r);
        });
        return [...map.values()].sort((a, b) => b.monto - a.monto);
    }, [historial]);

    const totalGeneral = medicosList.reduce((a, m) => a + m.monto, 0);
    const totalRps = historial.length;

    // Si hay un médico seleccionado
    const medicoData = useMemo(
        () => (medicoSel === 'todos' ? null : medicosList.find((m) => m.id === medicoSel) || null),
        [medicoSel, medicosList]
    );

    // Datos a mostrar según selección
    const rpsVisibles = useMemo(
        () => (medicoData ? medicoData.rps : historial),
        [medicoData, historial]
    );

    // Códigos agregados (prácticas + labs) del set visible
    const codigosList = useMemo(() => {
        const map = new Map();
        rpsVisibles.forEach((r) => {
            (r.practicas || []).forEach((p) => {
                const k = p.codigo || '—';
                const prev = map.get(k) || {
                    codigo: k, descripcion: p.descripcion, cantidad: 0,
                    origen: p.origen || '',
                };
                prev.cantidad += 1;
                map.set(k, prev);
            });
            (r.estudiosLab || []).forEach((l) => {
                const k = l.codigo || '—';
                const prev = map.get(k) || {
                    codigo: k, descripcion: l.descripcion, cantidad: 0,
                    origen: 'bioquimica',
                };
                prev.cantidad += 1;
                map.set(k, prev);
            });
        });
        return [...map.values()].sort((a, b) => b.cantidad - a.cantidad);
    }, [rpsVisibles]);

    const totalCodigos = codigosList.reduce((a, c) => a + c.cantidad, 0);

    const montoVisible = rpsVisibles.reduce((a, r) => a + (r.total || 0), 0);
    const promedioVisible = rpsVisibles.length > 0 ? montoVisible / rpsVisibles.length : 0;

    return (
        <section className={styles.stats}>
            {/* Filtro */}
            <div className={styles.statsFilter}>
                <label className={styles.labelInline}>
                    Filtrar por médico:
                    <select
                        className={styles.select}
                        value={medicoSel}
                        onChange={(e) => setMedicoSel(e.target.value)}
                    >
                        <option value="todos">Todos los médicos ({totalRps} RPs)</option>
                        {medicosList.map((m) => (
                            <option key={m.id} value={m.id}>
                                {m.nombre} ({m.cantidad} RPs)
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {historial.length === 0 ? (
                <div className={styles.empty}>
                    Todavía no hay RPs guardadas para mostrar estadísticas.
                </div>
            ) : (
                <>
                    {/* KPIs del set visible */}
                    <div className={styles.kpiGrid}>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiLabel}>Monto total</div>
                            <div className={styles.kpiValue}>$ {money(montoVisible)}</div>
                            <div className={styles.kpiSub}>
                                {medicoData
                                    ? `${fmtPct(montoVisible, totalGeneral)} del total general`
                                    : 'Suma de todas las RPs'}
                            </div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiLabel}>RPs generadas</div>
                            <div className={styles.kpiValue}>{rpsVisibles.length}</div>
                            <div className={styles.kpiSub}>
                                {medicoData
                                    ? `${fmtPct(rpsVisibles.length, totalRps)} del total`
                                    : `${totalRps} en total`}
                            </div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiLabel}>Promedio por RP</div>
                            <div className={styles.kpiValue}>$ {money(promedioVisible)}</div>
                            <div className={styles.kpiSub}>
                                Sobre {rpsVisibles.length} RP(s)
                            </div>
                        </div>
                        <div className={styles.kpiCard}>
                            <div className={styles.kpiLabel}>
                                {medicoData ? 'Médicos' : 'Médicos activos'}
                            </div>
                            <div className={styles.kpiValue}>
                                {medicoData ? 1 : medicosList.length}
                            </div>
                            <div className={styles.kpiSub}>
                                {medicoData
                                    ? medicoData.nombre
                                    : 'Con al menos 1 RP'}
                            </div>
                        </div>
                    </div>

                    {/* Tabla por médico — solo en vista "Todos" */}
                    {medicoSel === 'todos' && medicosList.length > 0 && (
                        <div className={styles.tableBlock}>
                            <h3 className={styles.chartTitle}>
                                🩺 Ranking de médicos por monto
                            </h3>
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Médico</th>
                                        <th className={styles.numCol}>RPs</th>
                                        <th className={styles.numCol}>Monto</th>
                                        <th className={styles.numCol}>% del total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {medicosList.map((m, i) => (
                                        <tr key={m.id}>
                                            <td className={styles.rankCell}>{i + 1}</td>
                                            <td>{m.nombre}</td>
                                            <td className={styles.numCol}>{m.cantidad}</td>
                                            <td className={styles.numCol}>$ {money(m.monto)}</td>
                                            <td className={styles.numCol}>
                                                <span className={styles.pctBadge}>
                                                    {fmtPct(m.monto, totalGeneral)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={2}><b>Total</b></td>
                                        <td className={styles.numCol}><b>{totalRps}</b></td>
                                        <td className={styles.numCol}><b>$ {money(totalGeneral)}</b></td>
                                        <td className={styles.numCol}><b>100%</b></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Listado de RPs — solo cuando hay médico seleccionado */}
                    {medicoData && (
                        <div className={styles.tableBlock}>
                            <h3 className={styles.chartTitle}>
                                📋 RPs de {medicoData.nombre} ({medicoData.rps.length})
                            </h3>
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Paciente</th>
                                        <th className={styles.numCol}>Práct.</th>
                                        <th className={styles.numCol}>🧪 Lab</th>
                                        <th className={styles.numCol}>Monto</th>
                                        <th className={styles.numCol}>% del médico</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {medicoData.rps
                                        .slice()
                                        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                                        .map((r) => (
                                            <tr key={r.id}>
                                                <td>{fmtDate(r.fecha)}</td>
                                                <td>{r.paciente?.nombreCompleto || '—'}</td>
                                                <td className={styles.numCol}>
                                                    {r.practicas?.length || 0}
                                                </td>
                                                <td className={styles.numCol}>
                                                    {(r.estudiosLab || []).length}
                                                </td>
                                                <td className={styles.numCol}>
                                                    $ {money(r.total || 0)}
                                                </td>
                                                <td className={styles.numCol}>
                                                    <span className={styles.pctBadge}>
                                                        {fmtPct(r.total || 0, medicoData.monto)}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                                <tfoot>
                                    <tr>
                                        <td colSpan={4}><b>Total</b></td>
                                        <td className={styles.numCol}>
                                            <b>$ {money(medicoData.monto)}</b>
                                        </td>
                                        <td className={styles.numCol}><b>100%</b></td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}

                    {/* Códigos más usados (según set visible) */}
                    {codigosList.length > 0 && (
                        <div className={styles.tableBlock}>
                            <h3 className={styles.chartTitle}>
                                🔝 Códigos más solicitados
                                {medicoData ? ` — ${medicoData.nombre}` : ''}
                            </h3>
                            <table className={styles.dataTable}>
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Código</th>
                                        <th>Descripción</th>
                                        <th className={styles.numCol}>Veces</th>
                                        <th className={styles.numCol}>%</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {codigosList.map((c, i) => (
                                        <tr key={c.codigo}>
                                            <td className={styles.rankCell}>{i + 1}</td>
                                            <td className={styles.codeCell}>{c.codigo}</td>
                                            <td>{c.descripcion?.slice(0, 55)}</td>
                                            <td className={styles.numCol}>{c.cantidad}</td>
                                            <td className={styles.numCol}>
                                                <span className={styles.pctBadge}>
                                                    {fmtPct(c.cantidad, totalCodigos)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
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

    // ============ Prácticas ============
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

    // ============ Laboratorio ============
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

    // ============ Atajos ============
    const saveAtajo = useCallback(async (nombre) => {
        if (!nombre) return;
        const atajo = {
            id: makeId('atajo'),
            nombre,
            practicas: rp.practicas,
            estudiosLab: rp.estudiosLab,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        try {
            await set(
                ref(db, `rp/atajos/${atajo.id}`),
                sanitizeForFirebase(atajo)
            );
            setAtajos((prev) => [atajo, ...prev]);
            setSaveAtajoOpen(false);
            alert(`✅ Atajo "${nombre}" guardado.`);
        } catch (e) {
            console.error(e);
            alert('❌ Error guardando atajo: ' + (e?.message || e));
        }
    }, [rp.practicas, rp.estudiosLab]);

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

        const estudiosLab = (atajo.estudiosLab || []).map((l) => ({
            ...l, id: makeId('lab'),
        }));

        setRp((prev) => ({ ...prev, practicas, estudiosLab }));
    }, [valoresConvenio]);

    // ============ Agregar / Guardar ============
    // 👇 Bioquímicos cuentan igual que los demás
    const canAddToList =
        rp.paciente.nombreCompleto &&
        rp.medico.id &&
        (rp.practicas.length > 0 || rp.estudiosLab.length > 0);

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
                const total = r.practicas.reduce((a, p) => a + (p.costo?.total || 0), 0);
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

    // ============ Impresión ============
    const openPrintWindow = useCallback((rps) => {
        if (!rps?.length) return;
        const logoSrc = `${window.location.origin}/logo.png`;
        const html = buildPrintHtml(rps, logoSrc);
        const w = window.open('', '_blank', 'width=1100,height=900,scrollbars=yes');
        if (!w) { alert('⚠️ Habilitá las ventanas emergentes para imprimir.'); return; }
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
        openPrintWindow(toPrint);
    }, [selectedIds, openPrintWindow]);

    const printOne = useCallback((r) => openPrintWindow([r]), [openPrintWindow]);

    const deleteHistorial = useCallback(async (id) => {
        if (!window.confirm('¿Eliminar esta RP del historial?')) return;
        try {
            await remove(ref(db, `rp/${id}`));
            setHistorial((prev) => prev.filter((r) => r.id !== id));
            setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
        } catch (e) { console.error(e); alert('Error al eliminar'); }
    }, []);

    const editFromHistorial = (r) => {
        setRp(sanitizeForFirebase({ ...r }));
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
    const hayAoterRp = rp.practicas.some((p) => p.origen === 'aoter');
    const hasContent = rp.practicas.length > 0 || rp.estudiosLab.length > 0;

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
                            <button
                                className={styles.btnGhost}
                                onClick={() => setAtajosOpen(true)}
                            >
                                📋 Atajos ({atajos.length})
                            </button>
                            <button
                                className={styles.btnGhost}
                                onClick={() => setSaveAtajoOpen(true)}
                                disabled={!hasContent}
                                title={!hasContent
                                    ? 'Cargá prácticas o laboratorio primero'
                                    : 'Guardar como atajo'}
                            >
                                💾 Guardar atajo
                            </button>
                            <span className={styles.atajosHint}>
                                Aplicá un atajo y solo elegí paciente + médico.
                            </span>
                        </div>

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

                        <div className={styles.field}>
                            <label className={styles.label}>🧪 Estudios de laboratorio</label>
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
                                title={!canAddToList ? 'Completá paciente, médico y al menos 1 práctica o estudio' : ''}
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
                                        onEdit={(rpToEdit) => {
                                            setRp(rpToEdit);
                                            removeFromCart(rpToEdit.id);
                                        }}
                                        onPrint={printOne}
                                    />
                                ))}
                            </div>
                            <div className={styles.cartActions}>
                                <button className={styles.btnGhost} onClick={() => printList(carrito)}>
                                    🖨️ / 📥 {selectedIds.size > 0
                                        ? `Seleccionadas (${selectedIds.size})`
                                        : 'Todas'}
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
                                    className={styles.btnPrimary}
                                    onClick={() => printList(historial)}
                                    disabled={historial.length === 0}
                                >
                                    🖨️ / 📥 {selectedIds.size > 0
                                        ? `Seleccionadas (${selectedIds.size})`
                                        : 'Todas'}
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